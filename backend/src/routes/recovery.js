const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');

const operationJournal = require('../resilience/operationJournal');
const backupManager = require('../resilience/backupManager');
const healthMonitor = require('../resilience/healthMonitor');
const recoveryQueue = require('../resilience/recoveryQueue');
const recoveryEngine = require('../resilience/recoveryEngine');

/**
 * Recovery API Routes - Admin only
 * Challenge 1: The Blackout endpoints
 */

// Get system health status
router.get('/health', authenticate, requireRole('ADMIN'), (req, res) => {
  try {
    const health = healthMonitor.checkHealth();
    const queueStats = recoveryQueue.getStats();
    const journalStats = operationJournal.getStats();
    
    res.json({
      ...health,
      queue: queueStats,
      journal: journalStats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get recovery status
router.get('/status', authenticate, requireRole('ADMIN'), (req, res) => {
  try {
    const status = recoveryEngine.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create backup
router.post('/backup', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { type = 'manual' } = req.body;
    const backup = await backupManager.createBackup(type);
    res.json({ success: true, backup });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List backups
router.get('/backups', authenticate, requireRole('ADMIN'), (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const backups = backupManager.listBackups(limit);
    res.json({ backups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start recovery
router.post('/recover', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { backupId } = req.body;
    const result = await recoveryEngine.startRecovery(backupId || null);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simulate failure (for testing)
router.post('/simulate-failure', authenticate, requireRole('ADMIN'), (req, res) => {
  try {
    recoveryEngine.simulateFailure();
    res.json({ success: true, message: 'Database failure simulated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get operation journal
router.get('/journal', authenticate, requireRole('ADMIN'), (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const pending = operationJournal.getPending(limit);
    const stats = operationJournal.getStats();
    res.json({ pending, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
