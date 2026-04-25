// Customer service: find or create by email/phone (for bill auto-linking)
const { pool } = require('../db/pool');

async function findOrCreateCustomer(email, phone, storeName) {
  // Priority: search by email (case-insensitive) → phone → create new

  if (!email && !phone) {
    console.log('⚠️  No contact info to link customer');
    return null;
  }

  try {
    // Try email first
    if (email) {
      console.log('🔍 Searching customer by email:', email);
      const emailResult = await pool.query(
        'SELECT id, name FROM customers WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [email]
      );
      if (emailResult.rows.length > 0) {
        console.log('✅ Found customer by email:', emailResult.rows[0].id);
        return emailResult.rows[0];
      }
    }

    // Try phone
    if (phone) {
      console.log('🔍 Searching customer by phone:', phone);
      const phoneResult = await pool.query(
        'SELECT id, name FROM customers WHERE phone = $1 LIMIT 1',
        [phone]
      );
      if (phoneResult.rows.length > 0) {
        console.log('✅ Found customer by phone:', phoneResult.rows[0].id);
        return phoneResult.rows[0];
      }
    }

    // No existing customer — create new
    console.log('🆕 Creating new customer');
    const newName = email ? email.split('@')[0] : `Customer ${phone}`;
    const createResult = await pool.query(
      'INSERT INTO customers (name, email, phone) VALUES ($1, $2, $3) RETURNING id, name',
      [newName, email || null, phone || null]
    );
    const customer = createResult.rows[0];
    console.log('✅ Created customer:', customer.id, 'name:', customer.name);
    return customer;

  } catch (err) {
    console.error('❌ Error finding/creating customer:', err.message);
    return null;
  }
}

module.exports = { findOrCreateCustomer };
