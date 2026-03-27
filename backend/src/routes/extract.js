const express = require('express');
const { extractBill } = require('../services/claude');

const router = express.Router();

// POST /api/extract
// Body: { image_base64: string, image_mime_type: string }
router.post('/', async (req, res) => {
  const { image_base64, image_mime_type } = req.body || {};
  if (!image_base64) return res.status(400).json({ data: null, error: 'image_base64 required' });

  const mimeType = image_mime_type || 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType))
    return res.status(400).json({ data: null, error: 'Unsupported image type' });

  try {
    const result = await extractBill(image_base64, mimeType);

    if (result && result.error === 'not_a_bill')
      return res.status(400).json({ data: null, error: 'not_a_bill' });

    res.json({ data: result, error: null });
  } catch (err) {
    console.error('Extract error:', err.message);
    res.status(500).json({ data: null, error: err.message || 'Extraction failed' });
  }
});

module.exports = router;
