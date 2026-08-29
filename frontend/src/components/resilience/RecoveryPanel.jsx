import { useState, useEffect } from 'react';
import { socketService } from '../../services/socketService';
import api from '../../services/api';

/**
 * RecoveryPanel - Admin dashboard component for Blackout Challenge
 * Real-time system health monitoring and manual recovery controls
 */

export default function RecoveryPanel() {
  const [health, setHealth] = useState(null);
  const [status, setStatus] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Poll health status every 5 seconds
  useEffect(() => {
    fetchHealth();
    fetchStatus();
    fetchBackups();

    const interval = setInterval(() => {
      fetchHealth();
      fetchStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Real-time Socket.IO listeners
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    // Subscribe to system events
    socket.emit('subscribe:system');

    const handlers = {
      'system:health': (data) => {
        console.log('[Recovery] Health update:', data);
        setHealth(prev => ({ ...prev, ...data }));
      },
      'system:recovery:started': (data) => {
        console.log('[Recovery] Recovery started:', data);
        setMessage({ type: 'info', text: 'Recovery process started...' });
      },
      'system:recovery:completed': (data) => {
        console.log('[Recovery] Recovery completed:', data);
        setMessage({
          type: 'success',
          text: `Recovery completed! Replayed: ${data.replayedOperations} operations`
        });
        fetchHealth();
        fetchStatus();
      },
      'system:recovery:failed': (data) => {
        console.error('[Recovery] Recovery failed:', data);
        setMessage({ type: 'error', text: `Recovery failed: ${data.error}` });
      },
      'system:recovery:failure-simulated': (data) => {
        console.log('[Recovery] Failure simulated:', data);
        setMessage({ type: 'warning', text: 'Database failure simulated' });
        fetchHealth();
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.keys(handlers).forEach(event => socket.off(event));
    };
  }, []);

  const fetchHealth = async () => {
    try {
      const res = await api.get('/recovery/health');
      setHealth(res.data);
    } catch (err) {
      console.error('[Recovery] Health fetch error:', err);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await api.get('/recovery/status');
      setStatus(res.data);
    } catch (err) {
      console.error('[Recovery] Status fetch error:', err);
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await api.get('/recovery/backups?limit=10');
      setBackups(res.data.backups || []);
    } catch (err) {
      console.error('[Recovery] Backups fetch error:', err);
    }
  };

  const handleCreateBackup = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await api.post('/recovery/backup', { type: 'manual' });
      setMessage({ type: 'success', text: 'Backup created successfully' });
      fetchBackups();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Backup failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateFailure = async () => {
    if (!window.confirm('⚠️ This will simulate a database failure. Continue?')) return;
    
    setLoading(true);
    setMessage(null);
    try {
      await api.post('/recovery/simulate-failure');
      setMessage({ type: 'warning', text: 'Database failure simulated' });
      fetchHealth();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Simulation failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async (backupId = null) => {
    const msg = backupId
      ? `Restore from backup #${backupId} and replay operations?`
      : 'Start recovery (replay pending operations)?';
    
    if (!window.confirm(msg)) return;

    setLoading(true);
    setMessage(null);
    try {
      const res = await api.post('/recovery/recover', { backupId });
      setMessage({
        type: 'success',
        text: `Recovery completed! Replayed: ${res.data.replayedOperations} operations`
      });
      fetchHealth();
      fetchStatus();
      fetchBackups();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Recovery failed' });
    } finally {
      setLoading(false);
    }
  };

  const getStateColor = (state) => {
    switch (state) {
      case 'ONLINE': return 'bg-green-500';
      case 'DEGRADED': return 'bg-yellow-500';
      case 'OFFLINE': return 'bg-red-500';
      case 'RECOVERY': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getStateBadge = (state) => {
    const color = getStateColor(state);
    return (
      <span className={`px-3 py-1 rounded-full text-white text-sm font-bold ${color}`}>
        {state}
      </span>
    );
  };

  const formatBytes = (bytes) => {
    if (!bytes) return 'N/A';
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">
          🛡️ System Resilience - Challenge 1: The Blackout
        </h2>
        {health && getStateBadge(health.state)}
      </div>

      {/* Alert Messages */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-100 text-green-800' :
          message.type === 'error' ? 'bg-red-100 text-red-800' :
          message.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-700 mb-2">Database Health</h3>
          {health ? (
            <>
              <p className="text-sm">Status: <span className="font-mono">{health.healthy ? '✓ Healthy' : '✗ Unhealthy'}</span></p>
              <p className="text-sm">Response: <span className="font-mono">{health.responseTime}ms</span></p>
              <p className="text-sm">Failures: <span className="font-mono">{health.failureCount}</span></p>
            </>
          ) : (
            <p className="text-sm text-gray-500">Loading...</p>
          )}
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-700 mb-2">Recovery Queue</h3>
          {health?.queue ? (
            <>
              <p className="text-sm">Queued: <span className="font-mono">{health.queue.size}</span></p>
              <p className="text-sm">Max: <span className="font-mono">{health.queue.maxSize}</span></p>
            </>
          ) : (
            <p className="text-sm text-gray-500">No queue data</p>
          )}
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-700 mb-2">Operation Journal</h3>
          {status ? (
            <>
              <p className="text-sm">Pending: <span className="font-mono">{status.pendingJournal}</span></p>
              <p className="text-sm">Last Backup: <span className="font-mono text-xs">{formatDate(status.lastBackup?.created_at)}</span></p>
            </>
          ) : (
            <p className="text-sm text-gray-500">Loading...</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleCreateBackup}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          📦 Create Backup
        </button>

        <button
          onClick={() => handleRecover(null)}
          disabled={loading || health?.state === 'ONLINE'}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          🔄 Start Recovery
        </button>

        <button
          onClick={handleSimulateFailure}
          disabled={loading}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          💥 Simulate Failure
        </button>
      </div>

      {/* Backups List */}
      <div>
        <h3 className="font-semibold text-gray-700 mb-3">Recent Backups</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left">ID</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Size</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Created</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.map(backup => (
                <tr key={backup.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono">{backup.id}</td>
                  <td className="px-4 py-2">{backup.backup_type}</td>
                  <td className="px-4 py-2">{formatBytes(backup.size_bytes)}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      backup.status === 'SUCCESS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {backup.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">{formatDate(backup.created_at)}</td>
                  <td className="px-4 py-2">
                    {backup.status === 'SUCCESS' && (
                      <button
                        onClick={() => handleRecover(backup.id)}
                        disabled={loading}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {backups.length === 0 && (
            <p className="text-center text-gray-500 py-4">No backups yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
