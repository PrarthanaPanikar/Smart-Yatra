const { db } = require('../config/db');
const fs = require('fs');
const path = require('path');

/**
 * Backup Manager - Creates and manages database backups
 * Uses SQLite VACUUM INTO for atomic backups (no race conditions)
 */

class BackupManager {
  constructor() {
    this.backupDir = path.join(__dirname, '../../data/backups');
    this.ensureBackupDir();
  }

  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log('[Backup] Created backup directory:', this.backupDir);
    }
  }

  /**
   * Create a database backup using VACUUM INTO (atomic operation)
   * @param {string} type - Backup type: 'scheduled' | 'manual' | 'pre-recovery'
   * @returns {Object} Backup metadata
   */
  async createBackup(type = 'manual') {
    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `smartyatra-${type}-${timestamp}.db`;
    const filepath = path.join(this.backupDir, filename);

    try {
      console.log(`[Backup] Starting ${type} backup...`);
      
      // Use VACUUM INTO for atomic backup (recommended for SQLite)
      db.prepare(`VACUUM INTO ?`).run(filepath);
      
      const stats = fs.statSync(filepath);
      const duration = Date.now() - startTime;
      
      // Record backup metadata
      const stmt = db.prepare(`
        INSERT INTO system_backups (filename, filepath, size_bytes, backup_type, duration_ms, status)
        VALUES (?, ?, ?, ?, ?, 'SUCCESS')
      `);
      
      const result = stmt.run(filename, filepath, stats.size, type, duration);
      
      console.log(`[Backup] ✓ Completed: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB, ${duration}ms)`);
      
      return {
        id: result.lastInsertRowid,
        filename,
        filepath,
        size: stats.size,
        type,
        duration
      };
    } catch (err) {
      console.error('[Backup] ✗ Failed:', err.message);
      
      // Record failure
      try {
        db.prepare(`
          INSERT INTO system_backups (filename, filepath, backup_type, status, error)
          VALUES (?, ?, ?, 'FAILED', ?)
        `).run(filename, filepath, type, err.message);
      } catch (dbErr) {
        console.error('[Backup] Could not log failure:', dbErr.message);
      }
      
      throw err;
    }
  }

  /**
   * Get the latest successful backup
   * @returns {Object|null} Backup metadata
   */
  getLatestBackup() {
    try {
      return db.prepare(`
        SELECT * FROM system_backups
        WHERE status = 'SUCCESS'
        ORDER BY created_at DESC
        LIMIT 1
      `).get();
    } catch (err) {
      console.error('[Backup] Error fetching latest:', err.message);
      return null;
    }
  }

  /**
   * Restore database from backup
   * @param {number} backupId - Backup ID to restore
   * @returns {boolean} Success status
   */
  async restoreBackup(backupId) {
    try {
      const backup = db.prepare('SELECT * FROM system_backups WHERE id = ?').get(backupId);
      if (!backup) throw new Error('Backup not found');
      if (!fs.existsSync(backup.filepath)) throw new Error('Backup file not found');

      console.log(`[Backup] Restoring from: ${backup.filename}`);
      
      // Create emergency backup before restore
      await this.createBackup('pre-recovery');
      
      // Close current connection
      db.close();
      
      // Replace database file
      const mainDbPath = path.join(__dirname, '../../data/smartyatra.db');
      fs.copyFileSync(backup.filepath, mainDbPath);
      
      console.log('[Backup] ✓ Database restored successfully');
      
      // Note: Server restart required to reconnect to restored DB
      return true;
    } catch (err) {
      console.error('[Backup] ✗ Restore failed:', err.message);
      throw err;
    }
  }

  /**
   * Get all backups
   * @param {number} limit - Max backups to retrieve
   * @returns {Array} Backup list
   */
  listBackups(limit = 50) {
    try {
      return db.prepare(`
        SELECT * FROM system_backups
        ORDER BY created_at DESC
        LIMIT ?
      `).all(limit);
    } catch (err) {
      console.error('[Backup] Error listing backups:', err.message);
      return [];
    }
  }

  /**
   * Clean old backups (keep last 10 successful + all failed for audit)
   */
  cleanup() {
    try {
      // Get backups to delete (keep last 10 successful)
      const toDelete = db.prepare(`
        SELECT * FROM system_backups
        WHERE status = 'SUCCESS'
        AND id NOT IN (
          SELECT id FROM system_backups
          WHERE status = 'SUCCESS'
          ORDER BY created_at DESC
          LIMIT 10
        )
      `).all();

      toDelete.forEach(backup => {
        try {
          if (fs.existsSync(backup.filepath)) {
            fs.unlinkSync(backup.filepath);
          }
          db.prepare('DELETE FROM system_backups WHERE id = ?').run(backup.id);
          console.log(`[Backup] Cleaned: ${backup.filename}`);
        } catch (err) {
          console.error(`[Backup] Error cleaning ${backup.filename}:`, err.message);
        }
      });

      return toDelete.length;
    } catch (err) {
      console.error('[Backup] Cleanup error:', err.message);
      return 0;
    }
  }
}

module.exports = new BackupManager();
