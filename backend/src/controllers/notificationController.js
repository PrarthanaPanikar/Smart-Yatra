const { db } = require('../config/db');

const getNotifications = async (req, res) => {
  try {
    const rows = db.prepare(
      `SELECT * FROM notifications
       WHERE user_id = ? OR role = ?
       ORDER BY created_at DESC LIMIT 50`
    ).all(req.user.id, req.user.role);
    res.json({ notifications: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

const markRead = async (req, res) => {
  try {
    db.prepare("UPDATE notifications SET is_read=1 WHERE id=? AND (user_id=? OR role=?)")
      .run(req.params.id, req.user.id, req.user.role);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification' });
  }
};

const markAllRead = async (req, res) => {
  try {
    db.prepare("UPDATE notifications SET is_read=1 WHERE user_id=? OR role=?")
      .run(req.user.id, req.user.role);
    res.json({ message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all' });
  }
};

module.exports = { getNotifications, markRead, markAllRead };
