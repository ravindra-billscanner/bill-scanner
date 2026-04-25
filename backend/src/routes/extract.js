const express = require('express');
const { extractBill } = require('../services/claude');
const { findOrCreateCustomer } = require('../services/customerService');

const router = express.Router();

// POST /api/extract
// Body: { image_base64: string, image_mime_type: string }
// Returns: { data: { ...bill, customer_id?, auto_linked?: bool }, error: null }
router.post('/', async (req, res) => {
  const { image_base64, image_mime_type } = req.body || {};
  if (!image_base64) return res.status(400).json({ data: null, error: 'image_base64 required' });

  const mimeType = image_mime_type || 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType))
    return res.status(400).json({ data: null, error: 'Unsupported image type' });

  try {
    console.log('📸 Extracting bill from image...');
    const result = await extractBill(image_base64, mimeType);

    if (result && result.error === 'not_a_bill')
      return res.status(400).json({ data: null, error: 'not_a_bill' });

    // Auto-link customer by email/phone from bill
    let auto_linked = false;
    const bill_contact = result.bill_contact || {};
    if (bill_contact.email || bill_contact.phone) {
      console.log('🔗 Attempting auto-link customer...');
      const customer = await findOrCreateCustomer(
        bill_contact.email,
        bill_contact.phone,
        result.store_name
      );
      if (customer) {
        result.customer_id = customer.id;
        result.customer_name = customer.name;
        auto_linked = true;
      }
    }

    res.json({
      data: { ...result, auto_linked },
      error: null
    });
  } catch (err) {
    console.error('Extract error:', err.message);
    res.status(500).json({ data: null, error: err.message || 'Extraction failed' });
  }
});

module.exports = router;
