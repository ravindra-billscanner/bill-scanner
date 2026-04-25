// Server-side Claude Vision extraction (API key never leaves server)

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
  "bill_contact": {
    "email": "string or null (extract from bill if visible)",
    "phone": "string or null (extract customer/merchant phone if visible)"
  },
  "items": [
    {
      "name": "string",
      "brand": "string or null (IMPORTANT: extract product brand if visible, e.g. 'Coca-Cola', 'Samsung', 'Nike')",
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
- Currency: $ -> USD, euro -> EUR, pound -> GBP, rupee/Rs -> INR, default USD.
- BRAND EXTRACTION: For each item, look for product branding information. Examples: 'Amul Butter', 'Apple iPhone', 'Pepsi', 'Samsung TV'. If visible, extract the brand name. Otherwise null.
- EMAIL/PHONE: If the bill shows a customer email, merchant phone, or receipt identifier with contact info, extract it. Otherwise null.
- If not a bill: {"error": "not_a_bill"}
- Normalize item names to title case.`;

async function extractBill(base64Image, mimeType) {
  const fetch = (await import('node-fetch')).default;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
            { type: 'text', text: 'Extract the bill data from this image.' },
          ],
        }],
      }),
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Claude request timed out');
    throw new Error('Network error calling Claude: ' + err.message);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const raw = ((data.content || [])[0] || {}).text || '';
  const cleaned = raw.trim().replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return { parse_failed: true, raw_text: raw };
  }
}

module.exports = { extractBill };
