const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');

const router = express.Router();

router.post('/login', async (req, res) => {
  console.log('🔐 Login attempt:', req.body.username);
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      console.log('❌ Missing username or password');
      return res.status(400).json({ data: null, error: 'Username and password required' });
    }

    console.log('📊 Querying database for user:', username);
    const result = await pool.query('SELECT id, username, password_hash FROM admins WHERE username = $1', [username]);
    const admin = result.rows[0];

    if (!admin) {
      console.log('❌ User not found:', username);
      return res.status(401).json({ data: null, error: 'Invalid credentials' });
    }

    console.log('🔑 Comparing passwords');
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      console.log('❌ Invalid password');
      return res.status(401).json({ data: null, error: 'Invalid credentials' });
    }

    console.log('✅ Password valid, generating JWT');
    const token = jwt.sign({ adminId: admin.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ data: { token, adminId: admin.id } });

  } catch (err) {
    console.error('❌ Login error:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ data: null, error: 'Server error: ' + err.message });
  }
});

router.put('/password', async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const adminId = req.adminId;

    const result = await pool.query('SELECT password_hash FROM admins WHERE id = $1', [adminId]);
    const admin = result.rows[0];

    if (!admin || !await bcrypt.compare(oldPassword, admin.password_hash)) {
      return res.status(401).json({ data: null, error: 'Invalid password' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE admins SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, adminId]);

    res.json({ data: { message: 'Password updated' } });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ data: null, error: 'Server error' });
  }
});

module.exports = router;
