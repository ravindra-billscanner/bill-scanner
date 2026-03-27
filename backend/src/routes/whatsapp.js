const express = require('express');
const { pool } = require('../db/pool');
const { extractBill } = require('../services/claude');
const { downloadMedia, sendText, sendInteractive } = require('../services/whatsapp');
const { getSession, setState, setPending, clearPending } = require('../sessions');
const { getKpiSummary, computeSegment } = require('../services/analytics');

const router = express.Router();

// ── Webhook Verification (GET) ────────────────────────────────────────────────
router.get('/', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ── Incoming Messages (POST) ──────────────────────────────────────────────────
router.post('/', async (req, res) => {
  // Always ACK immediately — Meta retries if we don't respond within 20s
  res.sendStatus(200);

  try {
    const entry   = (req.body.entry || [])[0];
    const change  = (entry && entry.changes || [])[0];
    const value   = change && change.value;
    if (!value || !value.messages) return;

    const msg     = value.messages[0];
    const waId    = msg.from;                                // e.g. "919876543210"
    const contact = (value.contacts || [])[0];
    const profileName = contact && contact.profile && contact.profile.name;

    await handleMessage(waId, msg, profileName);
  } catch (err) {
    console.error('WhatsApp webhook error:', err);
  }
});

// ── Core Message Handler ──────────────────────────────────────────────────────
async function handleMessage(waId, msg, profileName) {
  // Look up customer by whatsapp_id
  const { rows } = await pool.query(
    'SELECT * FROM customers WHERE whatsapp_id = $1', [waId]
  );
  const customer = rows[0] || null;

  const session = getSession(waId);

  // ── New user — any first message ──
  if (!customer) {
    await sendText(waId,
      `👋 Welcome to BillScan!\n\nI can scan your shopping bills and build your spending profile.\n\nWhat's your name?`
    );
    setState(waId, 'AWAITING_NAME');
    return;
  }

  // ── AWAITING_NAME state ──
  if (session.state === 'AWAITING_NAME') {
    const name = (msg.text && msg.text.body && msg.text.body.trim()) || profileName || 'Friend';
    await pool.query(
      `INSERT INTO customers (name, whatsapp_id) VALUES ($1, $2)
       ON CONFLICT (whatsapp_id) DO UPDATE SET name = $1`,
      [name, waId]
    );
    await sendText(waId,
      `Thanks ${name}! You're all set. 🎉\n\nSend me a photo of any bill or receipt to start scanning. 📸\n\nType *stats* for your spending summary or *bills* for recent bills.`
    );
    setState(waId, 'IDLE');
    return;
  }

  // ── CONFIRMING_BILL — waiting for Save/Discard button tap ──
  if (session.state === 'CONFIRMING_BILL') {
    if (msg.type === 'interactive') {
      const reply = msg.interactive && msg.interactive.button_reply;
      if (reply && reply.id === 'save_bill') {
        await saveBill(waId, customer, session);
        return;
      }
      if (reply && reply.id === 'discard_bill') {
        clearPending(waId);
        setState(waId, 'IDLE');
        await sendText(waId, 'Discarded. Send another bill anytime! 📸');
        return;
      }
    }
    // User sent something else while waiting — remind them
    await sendText(waId, 'Please tap ✅ Save or ❌ Discard for the bill above, or send a new photo to replace it.');
    if (msg.type === 'image') {
      clearPending(waId);
      setState(waId, 'IDLE');
      await handleImage(waId, customer, msg);
    }
    return;
  }

  // ── IDLE state ──
  if (msg.type === 'image') {
    await handleImage(waId, customer, msg);
    return;
  }

  if (msg.type === 'text') {
    const text = (msg.text && msg.text.body || '').trim().toLowerCase();

    if (['stats', 'stat', 'summary', 'profile'].includes(text)) {
      await handleStats(waId, customer);
      return;
    }
    if (['bills', 'history', 'recent', 'list'].includes(text)) {
      await handleBillsList(waId, customer);
      return;
    }
    if (['hi', 'hello', 'hey', 'help', 'start', '/start', '/help'].includes(text)) {
      await sendText(waId,
        `👋 Hi ${customer.name}!\n\nSend me a bill photo to scan it. 📸\n\nCommands:\n• *stats* — your spending summary\n• *bills* — last 5 bills`
      );
      return;
    }

    // Unknown text
    await sendText(waId,
      `Send me a photo of a bill or receipt and I'll extract it for you. 📸\n\nType *help* for available commands.`
    );
    return;
  }

  // Unsupported message type (voice, sticker, etc.)
  await sendText(waId, 'Please send a photo of a bill or receipt. 📸');
}

// ── Handle Image ──────────────────────────────────────────────────────────────
async function handleImage(waId, customer, msg) {
  // Check daily rate limit (10 scans/day per customer)
  const { rows: limitRows } = await pool.query(
    `SELECT COUNT(*) FROM bills WHERE customer_id = $1 AND source = 'whatsapp' AND scanned_at::date = CURRENT_DATE`,
    [customer.id]
  );
  if (parseInt(limitRows[0].count) >= 10) {
    await sendText(waId, "You've reached today's scan limit (10 bills). Try again tomorrow! 🔄");
    return;
  }

  await sendText(waId, '⏳ Reading your bill...');

  try {
    const mediaId  = msg.image.id;
    const { base64, mimeType } = await downloadMedia(mediaId);
    const result   = await extractBill(base64, mimeType);

    if (result && result.error === 'not_a_bill') {
      await sendText(waId, "That doesn't look like a bill. Please send a clear photo of a receipt, invoice, or bill. 🧾");
      return;
    }

    if (result && result.parse_failed) {
      await sendText(waId, "Couldn't fully read that bill (image too blurry or low contrast). Please try again in better lighting. 💡");
      return;
    }

    setPending(waId, result, { base64, mimeType });
    setState(waId, 'CONFIRMING_BILL');

    // Build summary text
    const topItems = (result.items || []).slice(0, 3).map(i => i.name).filter(Boolean).join(', ');
    const topCat   = (result.items || []).length > 0 ? (result.items[0].category || '') : '';
    const itemLine = topItems ? `🛒 ${(result.items || []).length} items: ${topItems}${(result.items || []).length > 3 ? '...' : ''}` : '';
    const catLine  = topCat ? ` (${topCat})` : '';

    const summary = [
      `✅ Bill extracted!\n`,
      result.store_name    ? `🏪 ${result.store_name}` : '',
      result.date          ? `📅 ${result.date}  |  💰 ${result.currency || 'USD'} ${parseFloat(result.total || 0).toFixed(2)}` : `💰 ${result.currency || 'USD'} ${parseFloat(result.total || 0).toFixed(2)}`,
      itemLine + catLine,
      `\nSave this bill to your profile?`,
    ].filter(Boolean).join('\n');

    await sendInteractive(waId, summary, [
      { id: 'save_bill',    title: '✅ Save Bill' },
      { id: 'discard_bill', title: '❌ Discard' },
    ]);
  } catch (err) {
    console.error('Image handler error:', err);
    await sendText(waId, 'Something went wrong reading that bill. Please try again. 🔄');
    setState(waId, 'IDLE');
  }
}

// ── Save Bill to DB ───────────────────────────────────────────────────────────
async function saveBill(waId, customer, session) {
  const { pendingBill, pendingImage } = session;
  clearPending(waId);
  setState(waId, 'IDLE');

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert bill
      const { rows: billRows } = await client.query(
        `INSERT INTO bills (customer_id, store_name, store_address, date, time, bill_number,
           subtotal, tax, discount, total, currency, payment_method,
           image_base64, image_mime_type, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'whatsapp')
         RETURNING id`,
        [
          customer.id,
          pendingBill.store_name || '',
          pendingBill.store_address || null,
          pendingBill.date || null,
          pendingBill.time || null,
          pendingBill.bill_number || null,
          pendingBill.subtotal || null,
          pendingBill.tax || null,
          pendingBill.discount || null,
          parseFloat(pendingBill.total) || 0,
          pendingBill.currency || 'USD',
          pendingBill.payment_method || null,
          (pendingImage && pendingImage.base64) || null,
          (pendingImage && pendingImage.mimeType) || null,
        ]
      );
      const billId = billRows[0].id;

      // Insert items
      for (const item of (pendingBill.items || [])) {
        await client.query(
          `INSERT INTO bill_items (bill_id, name, brand, category, quantity, unit, unit_price, price)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [billId, item.name||'', item.brand||null, item.category||'Other',
           item.quantity||1, item.unit||null, item.unit_price||null, item.price||0]
        );
      }

      await client.query('COMMIT');

      // Get updated stats for reply
      const { rows: allBills } = await pool.query(
        `SELECT b.total, b.currency, b.date,
           json_agg(json_build_object('category', bi.category, 'price', bi.price::float, 'brand', bi.brand)
           ) FILTER (WHERE bi.id IS NOT NULL) AS items
         FROM bills b LEFT JOIN bill_items bi ON bi.bill_id = b.id
         WHERE b.customer_id = $1 GROUP BY b.id`,
        [customer.id]
      );

      const totalBills = allBills.length;
      const currency   = pendingBill.currency || 'USD';
      const now        = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const monthSpend = allBills
        .filter(b => b.date && b.date.toISOString().slice(0, 10) >= monthStart)
        .reduce((s, b) => s + parseFloat(b.total || 0), 0);

      await sendText(waId,
        `💾 Saved! That's bill #${totalBills} for you.\n📅 Your spend this month: ${currency} ${monthSpend.toFixed(2)}`
      );
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Save bill error:', err);
    await sendText(waId, 'Sorry, something went wrong saving your bill. Please try again.');
  }
}

// ── /stats command ────────────────────────────────────────────────────────────
async function handleStats(waId, customer) {
  const { rows } = await pool.query(
    `SELECT b.total, b.currency, b.date,
       json_agg(json_build_object('category', bi.category, 'price', bi.price::float, 'brand', bi.brand)
       ) FILTER (WHERE bi.id IS NOT NULL) AS items
     FROM bills b LEFT JOIN bill_items bi ON bi.bill_id = b.id
     WHERE b.customer_id = $1 GROUP BY b.id`,
    [customer.id]
  );

  const bills = rows.map(r => ({
    ...r,
    date:  r.date  ? r.date.toISOString().slice(0, 10) : null,
    total: parseFloat(r.total),
  }));

  const kpi = getKpiSummary(bills);
  const seg = computeSegment(bills);
  const currency = (rows[0] && rows[0].currency) || '';

  if (!kpi.totalBills) {
    await sendText(waId, "You haven't scanned any bills yet. Send me a bill photo to get started! 📸");
    return;
  }

  const segLine = seg.primary !== 'Insufficient Data'
    ? `\n🎯 Your profile: *${seg.primary}*${seg.secondary ? ` · ${seg.secondary}` : ''}`
    : '';

  await sendText(waId,
    `📊 *Your spending summary*\n\n` +
    `• Bills scanned: ${kpi.totalBills}\n` +
    `• Total spend: ${currency} ${kpi.totalSpend.toFixed(2)}\n` +
    `• Avg per bill: ${currency} ${kpi.avgBillValue.toFixed(2)}\n` +
    `• Fav store: ${kpi.topStore}\n` +
    `• Top brand: ${kpi.topBrand}\n` +
    `• Top category: ${kpi.topCategory}` +
    segLine
  );
}

// ── /bills command ────────────────────────────────────────────────────────────
async function handleBillsList(waId, customer) {
  const { rows } = await pool.query(
    `SELECT store_name, total, currency, date FROM bills WHERE customer_id = $1
     ORDER BY scanned_at DESC LIMIT 5`,
    [customer.id]
  );

  if (!rows.length) {
    await sendText(waId, "You haven't scanned any bills yet. Send me a bill photo to get started! 📸");
    return;
  }

  const lines = rows.map((b, i) => {
    const date  = b.date ? b.date.toISOString().slice(0, 10) : '—';
    const store = b.store_name || 'Unknown Store';
    const amt   = `${b.currency} ${parseFloat(b.total).toFixed(2)}`;
    return `${i + 1}. ${store} — ${amt} — ${date}`;
  });

  await sendText(waId, `🧾 *Your last ${rows.length} bills*\n\n${lines.join('\n')}`);
}

module.exports = router;
