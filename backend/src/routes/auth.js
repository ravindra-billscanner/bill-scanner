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

router.post('/migrate', async (req, res) => {
  try {
    console.log('🔧 Running database migration...');
    console.log('🔌 Testing database connection...');

    // Test connection
    const testConn = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', testConn.rows[0]);

    // Create admins table
    console.log('📝 Creating admins table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ admins table ready');

    // Create customers table
    console.log('📝 Creating customers table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        whatsapp_id VARCHAR(50) UNIQUE,
        email VARCHAR(100),
        phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ customers table ready');

    // Create bills table
    console.log('📝 Creating bills table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bills (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        store_name VARCHAR(200),
        bill_date DATE,
        total_amount DECIMAL(10,2),
        currency VARCHAR(10),
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ bills table ready');

    // Create bill_items table
    console.log('📝 Creating bill_items table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bill_items (
        id SERIAL PRIMARY KEY,
        bill_id INTEGER REFERENCES bills(id) ON DELETE CASCADE,
        item_name VARCHAR(200),
        brand VARCHAR(100),
        category VARCHAR(50),
        quantity DECIMAL(10,2),
        price DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ bill_items table ready');

    // Insert default admin user
    console.log('🔐 Creating admin user...');
    const hash = await bcrypt.hash('changeme', 12);
    await pool.query(
      'INSERT INTO admins (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING',
      ['admin', hash]
    );
    console.log('✅ admin user ready (password: changeme)');

    res.json({ data: { message: 'Database migration completed successfully' } });
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    console.error('❌ Full error:', JSON.stringify(err, null, 2));
    console.error('❌ Error code:', err.code);
    console.error('❌ Error detail:', err.detail);
    res.status(500).json({ data: null, error: 'Migration error: ' + (err.message || JSON.stringify(err)) });
  }
});

module.exports = router;
