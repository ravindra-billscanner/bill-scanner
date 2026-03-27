// storage.js — same BS.storage interface, backed by REST API instead of IndexedDB
(function() {
  const BASE = window.BS_API_BASE || '';

  function token() { return localStorage.getItem('bs_jwt') || ''; }

  async function api(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const r = await fetch(BASE + path, opts);
    if (r.status === 401) {
      BS.auth && BS.auth.clearToken();
      window.location.hash = 'login';
      throw new Error('AUTH_REQUIRED');
    }
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j.data;
  }

  async function initDB()          { return true; }  // no-op

  async function getAllBills()      { return (await api('GET', '/api/bills')).bills; }
  async function getAllCustomers()  { return api('GET', '/api/customers'); }

  async function getBillsByCustomer(customerId) {
    return (await api('GET', '/api/bills?customerId=' + customerId)).bills;
  }

  async function saveBill(billData, imageBase64, imageMimeType) {
    const method = billData.id ? 'PUT' : 'POST';
    const path   = billData.id ? '/api/bills/' + billData.id : '/api/bills';
    const result = await api(method, path, {
      ...billData,
      image_base64:    imageBase64    || null,
      image_mime_type: imageMimeType  || null,
    });
    return (result && result.id) || billData.id;
  }

  async function saveCustomer(data) {
    if (data.id) {
      await api('PUT', '/api/customers/' + data.id, data);
      return data.id;
    }
    return (await api('POST', '/api/customers', data)).id;
  }

  async function deleteBill(id)      { return api('DELETE', '/api/bills/' + id); }
  async function deleteCustomer(id)  { return api('DELETE', '/api/customers/' + id); }

  async function exportAllData() {
    const [customers, billData] = await Promise.all([
      getAllCustomers(),
      api('GET', '/api/bills?limit=9999'),
    ]);
    return { customers, bills: billData.bills, exportedAt: new Date().toISOString(), version: 2 };
  }

  async function importAllData() { return 0; }  // future: POST /api/import

  async function clearAllData() {
    BS.auth && BS.auth.clearToken();
    window.location.hash = 'login';
  }

  // API key methods — server-managed; return truthy values so existing guards pass silently
  function saveApiKey()  {}
  function getApiKey()   { return 'server-managed'; }
  function clearApiKey() {}

  BS.storage = {
    initDB, getAllBills, getAllCustomers, getBillsByCustomer,
    saveBill, saveCustomer, deleteBill, deleteCustomer,
    saveApiKey, getApiKey, clearApiKey,
    exportAllData, importAllData, clearAllData,
  };
})();
