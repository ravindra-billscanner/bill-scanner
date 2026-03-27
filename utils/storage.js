// storage.js — IndexedDB CRUD, all functions exposed on BS.storage
(function() {
  const DB_NAME = 'BillScannerDB';
  const DB_VERSION = 1;
  let _db = null;

  function req(r) {
    return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  }

  function genId() {
    return crypto.randomUUID ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
  }

  async function initDB() {
    if (_db) return _db;
    return new Promise((resolve, reject) => {
      const open = indexedDB.open(DB_NAME, DB_VERSION);
      open.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('bills')) {
          const s = db.createObjectStore('bills', { keyPath: 'id' });
          s.createIndex('customerId', 'customerId', { unique: false });
          s.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('customers')) {
          const s = db.createObjectStore('customers', { keyPath: 'id' });
          s.createIndex('email', 'email', { unique: false });
        }
      };
      open.onsuccess = () => { _db = open.result; resolve(_db); };
      open.onerror   = () => reject(open.error);
    });
  }

  async function saveBill(billData, imageBase64, imageMimeType) {
    const db = await initDB();
    const bill = { ...billData, id: billData.id || genId(), scannedAt: billData.scannedAt || new Date().toISOString(), imageBase64: imageBase64 || null, imageMimeType: imageMimeType || null };
    await req(db.transaction('bills', 'readwrite').objectStore('bills').put(bill));
    return bill.id;
  }

  async function getAllBills() {
    const db = await initDB();
    return req(db.transaction('bills').objectStore('bills').getAll());
  }

  async function getBillsByCustomer(customerId) {
    const db = await initDB();
    return req(db.transaction('bills').objectStore('bills').index('customerId').getAll(customerId));
  }

  async function deleteBill(id) {
    const db = await initDB();
    return req(db.transaction('bills', 'readwrite').objectStore('bills').delete(id));
  }

  async function saveCustomer(data) {
    const db = await initDB();
    const now = new Date().toISOString();
    const c = { name: '', email: '', phone: null, notes: '', ...data, id: data.id || genId(), createdAt: data.createdAt || now, updatedAt: now };
    await req(db.transaction('customers', 'readwrite').objectStore('customers').put(c));
    return c.id;
  }

  async function getAllCustomers() {
    const db = await initDB();
    return req(db.transaction('customers').objectStore('customers').getAll());
  }

  async function deleteCustomer(id) {
    const db = await initDB();
    await req(db.transaction('customers', 'readwrite').objectStore('customers').delete(id));
    const bills = await getBillsByCustomer(id);
    for (const b of bills) await deleteBill(b.id);
  }

  function saveApiKey(key) { localStorage.setItem('bs_api_key', key); }
  function getApiKey()     { return localStorage.getItem('bs_api_key') || ''; }
  function clearApiKey()   { localStorage.removeItem('bs_api_key'); }

  async function exportAllData() {
    const [customers, bills] = await Promise.all([getAllCustomers(), getAllBills()]);
    return { customers, bills, exportedAt: new Date().toISOString(), version: 1 };
  }

  async function importAllData(jsonData) {
    let skipped = 0;
    const existing = await getAllBills();
    const ids = new Set(existing.map(b => b.id));
    for (const c of (jsonData.customers || [])) await saveCustomer(c);
    for (const b of (jsonData.bills || [])) {
      if (ids.has(b.id)) { skipped++; continue; }
      await saveBill(b, b.imageBase64, b.imageMimeType);
    }
    return skipped;
  }

  async function clearAllData() {
    const db = await initDB();
    const tx = db.transaction(['bills', 'customers'], 'readwrite');
    tx.objectStore('bills').clear();
    tx.objectStore('customers').clear();
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    clearApiKey();
  }

  BS.storage = { initDB, saveBill, getAllBills, getBillsByCustomer, deleteBill, saveCustomer, getAllCustomers, deleteCustomer, saveApiKey, getApiKey, clearApiKey, exportAllData, importAllData, clearAllData };
})();
