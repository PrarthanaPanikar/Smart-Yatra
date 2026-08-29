const { db } = require('../config/db');

/**
 * Health Monitor - Tracks system health with state machine
 * States: ONLINE → DEGRADED → OFFLINE → RECOVERY → ONLINE
 */

class HealthMonitor {
  constructor() {
    this.state = 'ONLINE';
    this.lastCheck = Date.now();
    this.failureCount = 0;
    this.degradedThreshold = 3;  // 3 failures → DEGRADED
    this.offlineThreshold = 5;   // 5 failures → OFFLINE
    this.listeners = [];
  }

  /**
   * Check database health
   * @returns {Object} Health status
   */
  checkHealth() {
    const startTime = Date.now();
    let healthy = false;
    let error = null;

    try {
      // Simple health check query
      db.prepare('SELECT 1 as health').get();
      healthy = true;
      this.failureCount = 0; // Reset on success
    } catch (err) {
      healthy = false;
      error = err.message;
      this.failureCount++;
    }

    const duration = Date.now() - startTime;
    const oldState = this.state;
    
    // State machine transitions
    if (healthy) {
      if (this.state === 'RECOVERY') {
        this.setState('ONLINE');
      } else if (this.state === 'DEGRADED') {
        this.setState('ONLINE');
      } else if (this.state === 'OFFLINE') {
        // Offline → Online requires explicit recovery
        // Don't auto-transition
      }
    } else {
      if (this.failureCount >= this.offlineThreshold) {
        this.setState('OFFLINE');
      } else if (this.failureCount >= this.degradedThreshold) {
        this.setState('DEGRADED');
      }
    }

    this.lastCheck = Date.now();

    const status = {
      state: this.state,
      healthy,
      failureCount: this.failureCount,
      lastCheck: this.lastCheck,
      responseTime: duration,
      error,
      stateChanged: oldState !== this.state
    };

    // Log state changes
    if (status.stateChanged) {
      console.log(`[Health] State transition: ${oldState} → ${this.state}`);
      this.notifyListeners(status);
    }

    return status;
  }

  /**
   * Set system state
   * @param {string} newState - New state
   */
  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    
    // Log state transition
    try {
      db.prepare(`
        INSERT INTO recovery_events (event_type, details)
        VALUES ('state_transition', ?)
      `).run(JSON.stringify({ from: oldState, to: newState }));
    } catch (err) {
      console.error('[Health] Could not log state transition:', err.message);
    }
  }

  /**
   * Register a listener for state changes
   * @param {Function} callback - Called with (status) when state changes
   */
  onStateChange(callback) {
    this.listeners.push(callback);
  }

  /**
   * Notify all listeners of state change
   * @param {Object} status - Current health status
   */
  notifyListeners(status) {
    this.listeners.forEach(callback => {
      try {
        callback(status);
      } catch (err) {
        console.error('[Health] Listener error:', err.message);
      }
    });
  }

  /**
   * Get current state
   * @returns {string} Current state
   */
  getState() {
    return this.state;
  }

  /**
   * Force state change (for testing/manual override)
   * @param {string} state - Target state
   */
  forceState(state) {
    console.log(`[Health] Force state: ${this.state} → ${state}`);
    this.setState(state);
  }

  /**
   * Start monitoring loop
   * @param {number} interval - Check interval in ms (default 5000)
   */
  startMonitoring(interval = 5000) {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.checkHealth();
    }, interval);

    console.log(`[Health] Monitoring started (interval: ${interval}ms)`);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[Health] Monitoring stopped');
    }
  }

  /**
   * Get health history from recovery_events
   * @param {number} limit - Max events to retrieve
   * @returns {Array} Health events
   */
  getHistory(limit = 100) {
    try {
      return db.prepare(`
        SELECT * FROM recovery_events
        WHERE event_type = 'state_transition'
        ORDER BY created_at DESC
        LIMIT ?
      `).all(limit);
    } catch (err) {
      console.error('[Health] Error fetching history:', err.message);
      return [];
    }
  }
}

module.exports = new HealthMonitor();
