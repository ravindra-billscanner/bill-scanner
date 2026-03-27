// claudeApi.js — Claude Vision API, exposed on BS.claudeApi
(function() {
  const SYSTEM_PROMPT = `You are a bill and receipt data extraction assistant. Given an image of a bill, receipt, or invoice, extract all information and return ONLY a valid JSON object with no additional text, markdown, or explanation.

The JSON must follow this exact schema:
{
  "store_name": "string",
  "store_address": "string or null",
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM or null",
  "bill_number": "string or null",
  "subtotal": "number or null",
  "tax": "number or null",
  "discount": "number or null",
  "total": "number",
  "currency": "ISO 4217 code e.g. USD, EUR, GBP, INR",
  "payment_method": "string or null",
  "items": [
    {
      "name": "string",
      "brand": "string or null",
      "category": "one of: Food & Grocery, Electronics, Clothing & Apparel, Health & Beauty, Home & Garden, Dining & Restaurants, Fuel & Transport, Other",
      "quantity": "number (default 1)",
      "unit": "string or null",
      "unit_price": "number or null",
      "price": "number"
    }
  ]
}
Rules:
- Return ONLY the JSON. No preamble, no markdown fences.
- Use null for unknown optional fields.
- Currency: $ -> USD, euro -> EUR, pound -> GBP, rupee -> INR, default USD.
- If not a bill: {"error": "not_a_bill"}
- Normalize item names to title case.`;

  async function extractBill(base64Image, mimeType, apiKey) {
    if (!apiKey) throw new Error('NO_API_KEY');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
            { type: 'text', text: 'Extract the bill data from this image.' },
          ]}],
        }),
      });
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Request timed out. The image may be too large.');
      throw new Error('Network error. Check your internet connection.');
    } finally {
      clearTimeout(timeout);
    }
    if (response.status === 401) throw new Error('AUTH_ERROR');
    if (response.status === 429) throw new Error('RATE_LIMIT');
    if (!response.ok) throw new Error('API error ' + response.status);
    const data = await response.json();
    const raw = ((data.content || [])[0] || {}).text || '';
    const cleaned = raw.trim().replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
    try { return JSON.parse(cleaned); }
    catch { return { parse_failed: true, raw_text: raw }; }
  }

  async function testApiKey(apiKey) {
    if (!apiKey) return false;
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] }),
      });
      return r.status === 200;
    } catch { return false; }
  }

  BS.claudeApi = { extractBill, testApiKey };
})();
