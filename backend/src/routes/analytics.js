const express = require('express');
const { pool } = require('../db/pool');
const analytics = require('../services/analytics');

const router = express.Router();

// GET /api/analytics/:customerId  (customerId = 'all' for global)
router.get('/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const { from, to } = req.query;

    const conditions = [];
    const params     = [];

    if (customerId !== 'all') {
      params.push(customerId);
      conditions.push(`b.customer_id = $${params.length}`);
    }
    if (from) { params.push(from); conditions.push(`b.date >= $${params.length}`); }
    if (to)   { params.push(to);   conditions.push(`b.date <= $${params.length}`); }

    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await pool.query(
      `SELECT b.*,
         json_agg(json_build_object(
           'name', bi.name, 'brand', bi.brand, 'category', bi.category,
           'quantity', bi.quantity::float, 'price', bi.price::float
         ) ORDER BY bi.id) FILTER (WHERE bi.id IS NOT NULL) AS items
       FROM bills b
       LEFT JOIN bill_items bi ON bi.bill_id = b.id
       ${where}
       GROUP BY b.id`,
      params
    );

    const bills = rows.map(r => ({
      ...r,
      date:  r.date  ? r.date.toISOString().slice(0, 10) : null,
      total: parseFloat(r.total),
    }));

    res.json({
      data: {
        kpi:        analytics.getKpiSummary(bills),
        segment:    customerId !== 'all' ? analytics.computeSegment(bills) : null,
        spending:   analytics.getSpendingByMonth(bills),
        categories: analytics.getCategoryBreakdown(bills),
        brands:     analytics.getBrandFrequency(bills),
        stores:     analytics.getStoreFrequency(bills),
      },
      error: null,
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ data: null, error: 'Server error' });
  }
});

module.exports = router;
