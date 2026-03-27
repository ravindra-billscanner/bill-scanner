// WhatsApp Cloud API helpers

async function _fetch(url, opts) {
  const fetch = (await import('node-fetch')).default;
  return fetch(url, opts);
}

const BASE = 'https://graph.facebook.com/v18.0';

async function downloadMedia(mediaId) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  // Step 1: get the CDN URL from the media ID
  const metaRes = await _fetch(`${BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) throw new Error(`Media meta fetch failed: ${metaRes.status}`);
  const meta = await metaRes.json();

  // Step 2: download the actual bytes
  const fileRes = await _fetch(meta.url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!fileRes.ok) throw new Error(`Media download failed: ${fileRes.status}`);
  const buf = await fileRes.arrayBuffer();

  return {
    base64:   Buffer.from(buf).toString('base64'),
    mimeType: meta.mime_type || 'image/jpeg',
  };
}

async function sendText(to, text) {
  const token   = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const res = await _fetch(`${BASE}/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text, preview_url: false },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`sendText failed (${res.status}):`, body);
  }
}

// Send a message with up to 3 quick-reply buttons
// buttons: [{ id: string, title: string (max 20 chars) }]
async function sendInteractive(to, bodyText, buttons) {
  const token   = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const res = await _fetch(`${BASE}/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.map(b => ({
            type: 'reply',
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`sendInteractive failed (${res.status}):`, body);
  }
}

module.exports = { downloadMedia, sendText, sendInteractive };
