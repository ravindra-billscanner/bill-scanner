const { Pool } = require('pg');

console.log('🔌 Database Configuration:');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ SET' : '❌ NOT SET');
console.log('NODE_ENV:', process.env.NODE_ENV);

if (process.env.DATABASE_URL) {
  const url = process.env.DATABASE_URL;
  const masked = url.replace(/:[^@]*@/, ':****@');
  console.log('Connection string (masked):', masked);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('❌ Unexpected PG pool error:', err.message);
  console.error('Error code:', err.code);
});

pool.on('connect', () => {
  console.log('✅ Successfully connected to PostgreSQL');
});

// Initialize database tables on first run if they don't exist
(async () => {
  try {
    if (!process.env.DATABASE_URL) {
      console.warn('⚠️ DATABASE_URL not set - database initialization skipped');
      return;
    }

    console.log('📊 Initializing database tables...');

    await pool.query(`CREATE TABLE IF NOT EXISTS admins (id SERIAL PRIMARY KEY, username VARCHAR(100) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());`);
    await pool.query(`CREATE TABLE IF NOT EXISTS customers (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, whatsapp_id VARCHAR(50) UNIQUE, email VARCHAR(100), phone VARCHAR(20), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());`);
    await pool.query(`CREATE TABLE IF NOT EXISTS bills (id SERIAL PRIMARY KEY, customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE, store_name VARCHAR(200), bill_date DATE, total_amount DECIMAL(10,2), currency VARCHAR(10), raw_data JSONB, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());`);
    await pool.query(`CREATE TABLE IF NOT EXISTS bill_items (id SERIAL PRIMARY KEY, bill_id INTEGER REFERENCES bills(id) ON DELETE CASCADE, item_name VARCHAR(200), brand VARCHAR(100), category VARCHAR(50), quantity DECIMAL(10,2), price DECIMAL(10,2), created_at TIMESTAMP DEFAULT NOW());`);

    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('changeme', 12);
    await pool.query('INSERT INTO admins (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING', ['admin', hash]);

    console.log('✅ Database tables ready');
  } catch (err) {
    console.error('⚠️ Database initialization error (non-blocking):', err.message);
  }
})();

module.exports = { pool };
