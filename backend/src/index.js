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

console.log('=== CORS Configuration ===');
console.log('Allowed Origins:', allowedOrigins);
console.log('FRONTEND_URL env var:', process.env.FRONTEND_URL);
console.log('========================');

app.use(cors({
  origin: (origin, cb) => {
    console.log('📨 Incoming request origin:', origin);
    if (!origin || allowedOrigins.includes(origin)) {
      console.log('✅ CORS allowed for:', origin);
      return cb(null, true);
    }
    console.log('❌ CORS blocked for:', origin);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '25mb' }));

app.get('/health', (_, res) => res.json({ ok: true }));

app.use('/webhook', require('./routes/whatsapp'));

const guard = require('./middleware/auth');
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/customers', guard, require('./routes/customers'));
app.use('/api/bills',     guard, require('./routes/bills'));
app.use('/api/extract',   guard, require('./routes/extract'));
app.use('/api/analytics', guard, require('./routes/analytics'));

app.use((req, res) => res.status(404).json({ data: null, error: 'Route not found' }));

app.use((err, req, res, _next) => {
  console.error('❌ Unhandled error:', err.message);
  res.status(500).json({ data: null, error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BillScan backend running on port ${PORT}`);
  console.log(`WhatsApp webhook: POST /webhook`);
  console.log(`API base: /api`);
});
