const { db } = require('../config/db');

/**
 * Operation Journal - Records all critical operations for replay during recovery
 * Ensures idempotency via event_id to prevent duplicate replay
 */

class OperationJournal {
  /**
   * Log a critical operation to the journal
   * @param {string} operation - Type of operation (booking_create, gps_update, driver_assign, etc.)
   * @param {Object} payload - Operation data for replay
   * @param {string} eventId - Unique event ID for idempotency
   * @returns {number} Journal entry ID
   */
  log(operation, payload, eventId = null) {
    try {
      const stmt = db.prepare(`
        INSERT INTO operation_journal (operation, payload, event_id, status)
        VALUES (?, ?, ?, 'PENDING')
      `);
      
      const result = stmt.run(
        operation,
        JSON.stringify(payload),
        eventId
      );
      
      console.log(`[Journal] Logged: ${operation} (ID: ${result.lastInsertRowid})`);
      return result.lastInsertRowid;
    } catch (err) {
      // If event_id already exists, operation is duplicate - skip silently
      if (err.message.includes('UNIQUE constraint')) {
        console.log(`[Journal] Duplicate event_id skipped: ${eventId}`);
        return null;
      }
      throw err;
    }
  }

  /**
   * Get pending operations for replay
   * @param {number} limit - Max operations to retrieve
   * @returns {Array} Pending operations
   */
  getPending(limit = 100) {
    try {
      return db.prepare(`
        SELECT * FROM operation_journal 
        WHERE status = 'PENDING' 
        ORDER BY created_at ASC 
        LIMIT ?
      `).all(limit);
    } catch (err) {
      console.error('[Journal] Error fetching pending:', err.message);
      return [];
    }
  }

  /**
   * Mark operation as replayed
   * @param {number} id - Journal entry ID
   */
  markReplayed(id) {
    try {
      db.prepare(`
        UPDATE operation_journal 
        SET status = 'REPLAYED', replayed_at = datetime('now')
        WHERE id = ?
      `).run(id);
      console.log(`[Journal] Marked replayed: ${id}`);
    } catch (err) {
      console.error(`[Journal] Error marking replayed ${id}:`, err.message);
    }
  }

  /**
   * Mark operation as failed
   * @param {number} id - Journal entry ID
   * @param {string} error - Error message
   */
  markFailed(id, error) {
    try {
      db.prepare(`
        UPDATE operation_journal 
        SET status = 'FAILED', error = ?, replayed_at = datetime('now')
        WHERE id = ?
      `).run(error, id);
      console.log(`[Journal] Marked failed: ${id} - ${error}`);
    } catch (err) {
      console.error(`[Journal] Error marking failed ${id}:`, err.message);
    }
  }

  /**
   * Get journal stats
   */
  getStats() {
    try {
      return db.prepare(`
        SELECT 
          status,
          COUNT(*) as count
        FROM operation_journal
        GROUP BY status
      `).all();
    } catch (err) {
      console.error('[Journal] Error fetching stats:', err.message);
      return [];
    }
  }

  /**
   * Clean old entries (older than 7 days and replayed/failed)
   */
  cleanup() {
    try {
      const result = db.prepare(`
        DELETE FROM operation_journal
        WHERE status IN ('REPLAYED', 'FAILED')
        AND created_at < datetime('now', '-7 days')
      `).run();
      
      console.log(`[Journal] Cleaned ${result.changes} old entries`);
      return result.changes;
    } catch (err) {
      console.error('[Journal] Cleanup error:', err.message);
      return 0;
    }
  }
}

module.exports = new OperationJournal();
