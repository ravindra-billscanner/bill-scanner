require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:8080',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, mobile apps)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '25mb' }));  // large enough for base64 bill images

// ── Health check (Railway uses this) ─────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

// ── WhatsApp webhooks (no JWT — Meta calls these directly) ────────────────────
app.use('/webhook', require('./routes/whatsapp'));

// ── Protected REST API ────────────────────────────────────────────────────────
const guard = require('./middleware/auth');
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/customers', guard, require('./routes/customers'));
app.use('/api/bills',     guard, require('./routes/bills'));
app.use('/api/extract',   guard, require('./routes/extract'));
app.use('/api/analytics', guard, require('./routes/analytics'));

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ data: null, error: 'Route not found' }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ data: null, error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BillScan backend running on port ${PORT}`);
  console.log(`WhatsApp webhook: POST /webhook`);
  console.log(`API base: /api`);
});
