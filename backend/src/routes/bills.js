const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

// Build a bill object with items from a joined query row
function buildBill(row) {
  return {
    id:              row.id,
    customer_id:     row.customer_id,
    store_name:      row.store_name,
    store_address:   row.store_address,
    date:            row.date ? row.date.toISOString().slice(0, 10) : null,
    time:            row.time,
    bill_number:     row.bill_number,
    subtotal:        row.subtotal !== null ? parseFloat(row.subtotal) : null,
    tax:             row.tax     !== null ? parseFloat(row.tax)     : null,
    discount:        row.discount !== null ? parseFloat(row.discount) : null,
    total:           parseFloat(row.total),
    currency:        row.currency,
    payment_method:  row.payment_method,
    source:          row.source,
    scanned_at:      row.scanned_at,
    items:           row.items || [],
  };
}

const BILLS_WITH_ITEMS = `
  SELECT b.*,
    json_agg(json_build_object(
      'id', bi.id, 'name', bi.name, 'brand', bi.brand, 'category', bi.category,
      'quantity', bi.quantity::float, 'unit', bi.unit,
      'unit_price', bi.unit_price::float, 'price', bi.price::float
    ) ORDER BY bi.id) FILTER (WHERE bi.id IS NOT NULL) AS items
  FROM bills b
  LEFT JOIN bill_items bi ON bi.bill_id = b.id
`;

// GET /api/bills
router.get('/', async (req, res) => {
  try {
    const { customerId, from, to, limit = 500, offset = 0 } = req.query;
    const conditions = [];
    const params     = [];

    if (customerId) { params.push(customerId); conditions.push(`b.customer_id = $${params.length}`); }
    if (from)       { params.push(from);        conditions.push(`b.date >= $${params.length}`); }
    if (to)         { params.push(to);           conditions.push(`b.date <= $${params.length}`); }

    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await pool.query(
      `${BILLS_WITH_ITEMS}${where} GROUP BY b.id ORDER BY b.scanned_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countParams = params.slice(0, params.length - 2);
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM bills b${where}`, countParams
    );

    res.json({ data: { bills: rows.map(buildBill), total: parseInt(countRows[0].count) }, error: null });
  } catch (err) {
    console.error('GET /bills error:', err);
    res.status(500).json({ data: null, error: 'Server error' });
  }
});

// GET /api/bills/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `${BILLS_WITH_ITEMS} WHERE b.id = $1 GROUP BY b.id`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ data: null, error: 'Not found' });
    res.json({ data: buildBill(rows[0]), error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: 'Server error' });
  }
});

async function saveBillWithItems(client, billData, isUpdate) {
  const {
    id, customer_id, store_name = '', store_address, date, time, bill_number,
    subtotal, tax, discount, total = 0, currency = 'USD', payment_method,
    image_base64, image_mime_type, source = 'web', items = [],
  } = billData;

  let billId;
  if (isUpdate) {
    const { rows } = await client.query(
      `UPDATE bills SET customer_id=$1,store_name=$2,store_address=$3,date=$4,time=$5,
         bill_number=$6,subtotal=$7,tax=$8,discount=$9,total=$10,currency=$11,
         payment_method=$12,image_base64=$13,image_mime_type=$14,source=$15
       WHERE id=$16 RETURNING id`,
      [customer_id||null,store_name,store_address||null,date||null,time||null,
       bill_number||null,subtotal||null,tax||null,discount||null,total,currency,
       payment_method||null,image_base64||null,image_mime_type||null,source,id]
    );
    if (!rows[0]) throw Object.assign(new Error('Not found'), { status: 404 });
    billId = rows[0].id;
    await client.query('DELETE FROM bill_items WHERE bill_id = $1', [billId]);
  } else {
    const { rows } = await client.query(
      `INSERT INTO bills (customer_id,store_name,store_address,date,time,bill_number,
         subtotal,tax,discount,total,currency,payment_method,image_base64,image_mime_type,source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [customer_id||null,store_name,store_address||null,date||null,time||null,
       bill_number||null,subtotal||null,tax||null,discount||null,total,currency,
       payment_method||null,image_base64||null,image_mime_type||null,source]
    );
    billId = rows[0].id;
  }

  for (const item of items) {
    await client.query(
      `INSERT INTO bill_items (bill_id,name,brand,category,quantity,unit,unit_price,price)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [billId, item.name||'', item.brand||null, item.category||'Other',
       item.quantity||1, item.unit||null, item.unit_price||null, item.price||0]
    );
  }
  return billId;
}

// POST /api/bills
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const billId = await saveBillWithItems(client, req.body, false);
    await client.query('COMMIT');
    res.status(201).json({ data: { id: billId }, error: null });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ data: null, error: 'Server error' });
  } finally {
    client.release();
  }
});

// PUT /api/bills/:id
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await saveBillWithItems(client, { ...req.body, id: req.params.id }, true);
    await client.query('COMMIT');
    res.json({ data: { id: req.params.id }, error: null });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status === 404) return res.status(404).json({ data: null, error: 'Not found' });
    res.status(500).json({ data: null, error: 'Server error' });
  } finally {
    client.release();
  }
});

// DELETE /api/bills/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM bills WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ data: null, error: 'Not found' });
    res.json({ data: { deleted: true }, error: null });
  } catch (err) {
    res.status(500).json({ data: null, error: 'Server error' });
  }
});

module.exports = router;
