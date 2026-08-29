/**
 * Recovery Queue - In-memory queue for operations during database failure
 * Acceptable loss during server crash during DB failure (design decision)
 * Operations are journaled to DB when health is restored
 */

class RecoveryQueue {
  constructor() {
    this.queue = [];
    this.maxSize = 10000; // Prevent memory exhaustion
  }

  /**
   * Add operation to queue
   * @param {string} operation - Operation type
   * @param {Object} payload - Operation data
   * @param {string} eventId - Unique event ID
   * @returns {boolean} Success status
   */
  enqueue(operation, payload, eventId = null) {
    if (this.queue.length >= this.maxSize) {
      console.error('[Queue] Max size reached, dropping operation:', operation);
      return false;
    }

    this.queue.push({
      operation,
      payload,
      eventId,
      timestamp: Date.now()
    });

    console.log(`[Queue] Enqueued: ${operation} (size: ${this.queue.length})`);
    return true;
  }

  /**
   * Get all queued operations
   * @returns {Array} Queued operations
   */
  getAll() {
    return [...this.queue];
  }

  /**
   * Get queue size
   * @returns {number} Queue length
   */
  size() {
    return this.queue.length;
  }

  /**
   * Clear the queue
   */
  clear() {
    const size = this.queue.length;
    this.queue = [];
    console.log(`[Queue] Cleared ${size} operations`);
  }

  /**
   * Remove first N operations from queue
   * @param {number} count - Number of operations to dequeue
   * @returns {Array} Dequeued operations
   */
  dequeue(count = 1) {
    const items = this.queue.splice(0, count);
    console.log(`[Queue] Dequeued ${items.length} operations (remaining: ${this.queue.length})`);
    return items;
  }

  /**
   * Get queue stats
   * @returns {Object} Queue statistics
   */
  getStats() {
    const operationCounts = {};
    this.queue.forEach(item => {
      operationCounts[item.operation] = (operationCounts[item.operation] || 0) + 1;
    });

    return {
      size: this.queue.length,
      maxSize: this.maxSize,
      operations: operationCounts,
      oldestTimestamp: this.queue[0]?.timestamp || null
    };
  }
}

module.exports = new RecoveryQueue();
