const express = require('express');
const { pool } = require('../db/pool');
const { getKpiSummary, computeSegment } = require('../services/analytics');

const router = express.Router();

// Fetch bills for a customer and build enriched KPI + segment
async function enrichCustomer(customer) {
  const { rows: bills } = await pool.query(
    `SELECT b.*, json_agg(json_build_object(
       'name', bi.name, 'brand', bi.brand, 'category', bi.category,
       'quantity', bi.quantity::float, 'unit', bi.unit,
       'unit_price', bi.unit_price::float, 'price', bi.price::float
     ) ORDER BY bi.id) FILTER (WHERE bi.id IS NOT NULL) AS items
     FROM bills b
     LEFT JOIN bill_items bi ON bi.bill_id = b.id
     WHERE b.customer_id = $1
     GROUP BY b.id
     ORDER BY b.scanned_at DESC`,
    [customer.id]
  );
  const kpi     = getKpiSummary(bills);
  const segment = computeSegment(bills);
  const lastDate = bills.map(b => b.date).filter(Boolean).sort().pop() || null;
  const currency = (bills[0] && bills[0].currency) || '';
  return { ...customer, kpi, segment, lastDate, currency };
}

// GET /api/customers
router.get('/', async (req, res) => {
  try {
    const { search, sort } = req.query;
    let query = 'SELECT * FROM customers';
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      query += ` WHERE name ILIKE $1 OR email ILIKE $1`;
    }
    query += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(query, params);
    const enriched = await Promise.all(rows.map(enrichCustomer));

    // Sort enriched results
    if (sort === 'spend')    enriched.sort((a, b) => b.kpi.totalSpend - a.kpi.totalSpend);
    else if (sort === 'bills') enriched.sort((a, b) => b.kpi.totalBills - a.kpi.totalBills);
    else if (sort === 'lastDate') enriched.sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''));
    else enriched.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    res.json({ data: enriched, error: null });
  } catch (err) {
    console.error('GET /customers error:', err);
    res.status(500).json({ data: null, error: 'Server error' });
  }
});

// GET /api/customers/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ data: null, error: 'Not found' });
    res.json({ data: await enrichCustomer(rows[0]), error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: 'Server error' });
  }
});

// POST /api/customers
router.post('/', async (req, res) => {
  const { name = '', email, phone, whatsapp_id, notes = '' } = req.body || {};
  try {
    const { rows } = await pool.query(
      `INSERT INTO customers (name, email, phone, whatsapp_id, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [name, email || null, phone || null, whatsapp_id || null, notes]
    );
    res.status(201).json({ data: { id: rows[0].id }, error: null });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ data: null, error: 'WhatsApp ID already exists' });
    res.status(500).json({ data: null, error: 'Server error' });
  }
});

// PUT /api/customers/:id
router.put('/:id', async (req, res) => {
  const { name, email, phone, whatsapp_id, notes } = req.body || {};
  try {
    const { rows } = await pool.query(
      `UPDATE customers SET
         name = COALESCE($1, name),
         email = COALESCE($2, email),
         phone = COALESCE($3, phone),
         whatsapp_id = COALESCE($4, whatsapp_id),
         notes = COALESCE($5, notes)
       WHERE id = $6 RETURNING *`,
      [name, email, phone, whatsapp_id, notes, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ data: null, error: 'Not found' });
    res.json({ data: rows[0], error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: 'Server error' });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM customers WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ data: null, error: 'Not found' });
    res.json({ data: { deleted: true }, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: 'Server error' });
  }
});

module.exports = router;
