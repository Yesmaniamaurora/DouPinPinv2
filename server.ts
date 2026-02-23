import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';

const db = new Database('keys.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS licenses (
    key TEXT PRIMARY KEY,
    fingerprint TEXT
  );
  CREATE TABLE IF NOT EXISTS login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT,
    fingerprint TEXT,
    ip TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT
  );
`);

// Insert some dummy keys for testing
try {
  db.prepare('INSERT OR IGNORE INTO licenses (key, fingerprint) VALUES (?, ?)').run('VIP-8888', null);
  db.prepare('INSERT OR IGNORE INTO licenses (key, fingerprint) VALUES (?, ?)').run('TEST-0000', null);
} catch (e) {}

const ADMIN_KEYS = ['zaojuzi777', 'haibaihe'];

const app = express();
app.use(express.json());
app.set('trust proxy', true);

// API routes
app.post('/api/verify', (req, res) => {
  const { key, fingerprint } = req.body;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  const logLogin = (status: string) => {
    try {
      db.prepare('INSERT INTO login_logs (key, fingerprint, ip, status) VALUES (?, ?, ?, ?)').run(key, fingerprint, ip, status);
    } catch (e) {
      console.error('Failed to log login:', e);
    }
  };

  if (!key || !fingerprint) {
    return res.status(400).json({ error: 'Missing key or fingerprint' });
  }

  if (ADMIN_KEYS.includes(key)) {
    logLogin('admin_success');
    return res.json({ success: true, isAdmin: true, message: '管理员登录成功 (Admin Verified)' });
  }

  const stmt = db.prepare('SELECT * FROM licenses WHERE key = ?');
  const license = stmt.get(key) as any;

  if (!license) {
    logLogin('invalid_key');
    return res.status(404).json({ error: '无效的密钥 (Invalid Key)' });
  }

  if (license.fingerprint) {
    if (license.fingerprint === fingerprint) {
      logLogin('success');
      return res.json({ success: true, message: '验证成功 (Verified)' });
    } else {
      logLogin('fingerprint_mismatch');
      return res.status(403).json({ error: '该密钥已在其他设备绑定 (Key already bound to another device)' });
    }
  } else {
    // Bind the key
    const updateStmt = db.prepare('UPDATE licenses SET fingerprint = ? WHERE key = ?');
    updateStmt.run(fingerprint, key);
    logLogin('bound_success');
    return res.json({ success: true, message: '设备绑定成功 (Device bound successfully)' });
  }
});

// Admin APIs
const isAdmin = (req: express.Request) => {
  const adminKey = req.headers['x-admin-key'] as string;
  return ADMIN_KEYS.includes(adminKey);
};

app.get('/api/admin/logs', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });
  const logs = db.prepare('SELECT * FROM login_logs ORDER BY timestamp DESC LIMIT 10').all();
  res.json(logs);
});

app.get('/api/admin/keys', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });
  const keys = db.prepare('SELECT * FROM licenses').all();
  res.json(keys);
});

app.post('/api/admin/keys', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'Key required' });
  try {
    db.prepare('INSERT INTO licenses (key, fingerprint) VALUES (?, ?)').run(key, null);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Key already exists' });
  }
});

app.delete('/api/admin/keys/:key', (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Unauthorized' });
  const { key } = req.params;
  try {
    db.prepare('DELETE FROM licenses WHERE key = ?').run(key);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }
}

setupVite();

if (process.env.NODE_ENV !== 'production') {
  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
