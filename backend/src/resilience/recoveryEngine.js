const { db } = require('../config/db');
const operationJournal = require('./operationJournal');
const backupManager = require('./backupManager');
const healthMonitor = require('./healthMonitor');
const recoveryQueue = require('./recoveryQueue');

/**
 * Recovery Engine - Orchestrates disaster recovery
 * Handles backup restoration and operation replay
 */

class RecoveryEngine {
  constructor() {
    this.recovering = false;
    this.io = null; // Socket.IO instance for broadcasting
  }

  /**
   * Set Socket.IO instance for event broadcasting
   * @param {Object} ioInstance - Socket.IO server instance
   */
  setIO(ioInstance) {
    this.io = ioInstance;
  }

  /**
   * Broadcast system event via Socket.IO
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  broadcast(event, data) {
    if (this.io) {
      this.io.emit(`system:${event}`, data);
      console.log(`[Recovery] Broadcast: system:${event}`, data);
    }
  }

  /**
   * Start recovery process
   * @param {number} backupId - Optional backup ID to restore (uses latest if not provided)
   * @returns {Object} Recovery result
   */
  async startRecovery(backupId = null) {
    if (this.recovering) {
      throw new Error('Recovery already in progress');
    }

    this.recovering = true;
    healthMonitor.setState('RECOVERY');
    this.broadcast('recovery:started', { backupId });

    const result = {
      success: false,
      backupRestored: false,
      queuedOperations: 0,
      journaledOperations: 0,
      replayedOperations: 0,
      errors: []
    };

    try {
      console.log('[Recovery] ═══ Starting recovery ═══');

      // Step 1: Flush in-memory queue to journal (if DB is accessible)
      const queuedOps = recoveryQueue.getAll();
      result.queuedOperations = queuedOps.length;

      if (queuedOps.length > 0) {
        console.log(`[Recovery] Journaling ${queuedOps.length} queued operations...`);
        
        queuedOps.forEach(op => {
          try {
            operationJournal.log(op.operation, op.payload, op.eventId);
            result.journaledOperations++;
          } catch (err) {
            console.error('[Recovery] Error journaling operation:', err.message);
            result.errors.push(`Journal error: ${err.message}`);
          }
        });

        recoveryQueue.clear();
      }

      // Step 2: Restore from backup if requested
      if (backupId) {
        console.log(`[Recovery] Restoring from backup ${backupId}...`);
        await backupManager.restoreBackup(backupId);
        result.backupRestored = true;
        this.broadcast('recovery:backup-restored', { backupId });
      }

      // Step 3: Replay pending operations from journal
      console.log('[Recovery] Replaying pending operations...');
      const pending = operationJournal.getPending();
      
      for (const entry of pending) {
        try {
          await this.replayOperation(entry);
          operationJournal.markReplayed(entry.id);
          result.replayedOperations++;
        } catch (err) {
          console.error(`[Recovery] Replay failed for ${entry.id}:`, err.message);
          operationJournal.markFailed(entry.id, err.message);
          result.errors.push(`Replay ${entry.id}: ${err.message}`);
        }
      }

      // Step 4: Mark recovery complete
      healthMonitor.setState('ONLINE');
      result.success = true;

      console.log('[Recovery] ═══ Recovery complete ═══');
      console.log(`[Recovery] Stats:`, {
        queued: result.queuedOperations,
        journaled: result.journaledOperations,
        replayed: result.replayedOperations,
        errors: result.errors.length
      });

      this.broadcast('recovery:completed', result);

      // Log recovery event
      try {
        db.prepare(`
          INSERT INTO recovery_events (event_type, details)
          VALUES ('recovery_completed', ?)
        `).run(JSON.stringify(result));
      } catch (err) {
        console.error('[Recovery] Could not log event:', err.message);
      }

    } catch (err) {
      console.error('[Recovery] ✗ Failed:', err.message);
      result.success = false;
      result.errors.push(err.message);
      healthMonitor.setState('OFFLINE');
      this.broadcast('recovery:failed', { error: err.message });
    } finally {
      this.recovering = false;
    }

    return result;
  }

  /**
   * Replay a single operation from journal
   * @param {Object} entry - Journal entry
   */
  async replayOperation(entry) {
    const { operation, payload: payloadStr } = entry;
    const payload = JSON.parse(payloadStr);

    console.log(`[Recovery] Replaying: ${operation} (ID: ${entry.id})`);

    switch (operation) {
      case 'booking_create':
        await this.replayBookingCreate(payload);
        break;

      case 'gps_update':
        await this.replayGPSUpdate(payload);
        break;

      case 'driver_assign':
        await this.replayDriverAssign(payload);
        break;

      case 'parcel_create':
        await this.replayParcelCreate(payload);
        break;

      default:
        console.warn(`[Recovery] Unknown operation type: ${operation}`);
    }
  }

  /**
   * Replay booking creation
   */
  async replayBookingCreate(payload) {
    const { bookingData } = payload;
    
    db.prepare(`
      INSERT INTO bookings (
        user_id, bus_id, from_stop, to_stop, 
        seats, total_amount, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      bookingData.user_id,
      bookingData.bus_id,
      bookingData.from_stop,
      bookingData.to_stop,
      bookingData.seats,
      bookingData.total_amount,
      bookingData.status || 'CONFIRMED'
    );
  }

  /**
   * Replay GPS update
   */
  async replayGPSUpdate(payload) {
    const { busId, latitude, longitude } = payload;
    
    db.prepare(`
      UPDATE buses 
      SET latitude = ?, longitude = ?, 
          last_gps_update = datetime('now'),
          gps_status = 'CONNECTED',
          updated_at = datetime('now')
      WHERE id = ?
    `).run(latitude, longitude, busId);
  }

  /**
   * Replay driver assignment
   */
  async replayDriverAssign(payload) {
    const { busId, driverId } = payload;
    
    db.prepare(`
      UPDATE buses 
      SET driver_id = ?, 
          updated_at = datetime('now')
      WHERE id = ?
    `).run(driverId, busId);
  }

  /**
   * Replay parcel creation
   */
  async replayParcelCreate(payload) {
    const { parcelData } = payload;
    
    db.prepare(`
      INSERT INTO parcels (
        sender_id, bus_id, from_stop, to_stop,
        weight, dimensions, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      parcelData.sender_id,
      parcelData.bus_id,
      parcelData.from_stop,
      parcelData.to_stop,
      parcelData.weight,
      parcelData.dimensions,
      parcelData.status || 'PENDING'
    );
  }

  /**
   * Simulate database failure (for testing)
   */
  simulateFailure() {
    console.log('[Recovery] ⚠️ SIMULATING DATABASE FAILURE');
    healthMonitor.forceState('OFFLINE');
    this.broadcast('recovery:failure-simulated', { timestamp: Date.now() });
    
    // Log event
    try {
      db.prepare(`
        INSERT INTO recovery_events (event_type, details)
        VALUES ('failure_simulated', ?)
      `).run(JSON.stringify({ timestamp: new Date().toISOString() }));
    } catch (err) {
      console.error('[Recovery] Could not log simulation:', err.message);
    }
  }

  /**
   * Get recovery status
   * @returns {Object} Current recovery status
   */
  getStatus() {
    return {
      recovering: this.recovering,
      systemState: healthMonitor.getState(),
      queueSize: recoveryQueue.size(),
      pendingJournal: operationJournal.getPending().length,
      lastBackup: backupManager.getLatestBackup()
    };
  }
}

module.exports = new RecoveryEngine();
