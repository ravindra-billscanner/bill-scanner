// claudeApi.js — thin proxy to backend /api/extract (API key stays on server)
(function() {
  const BASE = window.BS_API_BASE || '';

  async function extractBill(base64Image, mimeType, _ignored) {
    const r = await fetch(BASE + '/api/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (localStorage.getItem('bs_jwt') || ''),
      },
      body: JSON.stringify({ image_base64: base64Image, image_mime_type: mimeType }),
    });
    if (r.status === 401) {
      BS.auth && BS.auth.clearToken();
      window.location.hash = 'login';
      throw new Error('AUTH_ERROR');
    }
    if (r.status === 429) throw new Error('RATE_LIMIT');
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error || 'API error ' + r.status);
    }
    return (await r.json()).data;
  }

  // Always returns true — API key validity is the server's concern
  async function testApiKey() { return true; }

  BS.claudeApi = { extractBill, testApiKey };
})();
