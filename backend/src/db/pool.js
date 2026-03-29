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

module.exports = { pool };
