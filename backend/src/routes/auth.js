const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const { pool } = require('../db/pool');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ data: null, error: 'Username and password required' });

  try {
    const { rows } = await pool.query('SELECT id, password_hash FROM admins WHERE username = $1', [username]);
    const admin = rows[0];
    if (!admin) return res.status(401).json({ data: null, error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ data: null, error: 'Invalid credentials' });

    const token = jwt.sign({ adminId: admin.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
    res.json({ data: { token, expiresIn: process.env.JWT_EXPIRES_IN || '7d' }, error: null });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ data: null, error: 'Server error' });
  }
});

// PUT /api/auth/password — change admin password
router.put('/password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || newPassword.length < 8)
    return res.status(400).json({ data: null, error: 'Current and new password (min 8 chars) required' });

  try {
    const { rows } = await pool.query('SELECT password_hash FROM admins WHERE id = $1', [req.adminId]);
    const admin = rows[0];
    if (!admin) return res.status(404).json({ data: null, error: 'Admin not found' });

    const match = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!match) return res.status(401).json({ data: null, error: 'Current password incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE admins SET password_hash = $1 WHERE id = $2', [hash, req.adminId]);
    res.json({ data: { changed: true }, error: null });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ data: null, error: 'Server error' });
  }
});

module.exports = router;
