// BillReview.js
function BillReview() {
  const { pendingBill, pendingImage, setPendingBill, setPendingImage, customers, navigate, refreshData } = React.useContext(BS.AppContext);
  const { useState, useEffect, useMemo } = React;
  const [bill, setBill]     = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [customerMode, setCustomerMode] = useState('existing');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '' });
  const [customerSearch, setCustomerSearch] = useState('');

  useEffect(() => {
    if (pendingBill) {
      const b = { store_name: '', date: '', total: 0, currency: 'USD', payment_method: '', items: [], ...pendingBill };
      b.items = (b.items || []).map(i => ({ name: '', brand: '', category: 'Other', quantity: 1, unit_price: null, price: 0, ...i }));
      b.id = b.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
      setBill(b);
    }
  }, [pendingBill]);

  const itemsTotal = useMemo(() => bill ? +bill.items.reduce((s, i) => s + (parseFloat(i.price) || 0), 0).toFixed(2) : 0, [bill && bill.items]);
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    const s = customerSearch.toLowerCase();
    return customers.filter(c => (c.name || '').toLowerCase().includes(s) || (c.email || '').toLowerCase().includes(s));
  }, [customers, customerSearch]);

  function upd(field, val) { setBill(prev => ({ ...prev, [field]: val })); }
  function updItem(idx, field, val) { setBill(prev => { const items = [...prev.items]; items[idx] = { ...items[idx], [field]: val }; return { ...prev, items }; }); }

  async function handleSave() {
    if (!bill) return;
    if (!bill.store_name.trim()) { setSaveError('Store name is required.'); return; }
    if (!bill.date) { setSaveError('Date is required.'); return; }
    setSaving(true); setSaveError('');
    try {
      let customerId = null;
      if (customerMode === 'existing' && selectedCustomerId) customerId = selectedCustomerId;
      else if (customerMode === 'new' && newCustomer.name.trim()) customerId = await BS.storage.saveCustomer({ name: newCustomer.name.trim(), email: newCustomer.email.trim() });
      await BS.storage.saveBill({ ...bill, customerId }, pendingImage && pendingImage.base64, pendingImage && pendingImage.mimeType);
      await refreshData(); setPendingBill(null); setPendingImage(null);
      navigate(customerId ? 'dashboard' : 'dashboard', customerId ? { customer: customerId } : {});
    } catch (err) { setSaveError('Save failed: ' + err.message); }
    finally { setSaving(false); }
  }

  if (!pendingBill && !bill) return (
    <div className="empty-state">
      <div className="empty-state-icon">📋</div>
      <h3>No bill to review</h3>
      <p>Upload a bill first to extract and review its data.</p>
      <button className="btn btn-primary" onClick={() => navigate('upload')}>⬆ Upload a Bill</button>
    </div>
  );
  if (!bill) return <div style={{ padding: 20 }}><span className="spinner" /></div>;

  const CURRENCIES = ['USD','EUR','GBP','INR','AED','SGD','AUD','CAD','JPY','CNY','SAR','OTHER'];

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('upload')}>← Back</button>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Review Extracted Data</h2>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Verify and correct before saving</span>
      </div>
      {bill.parse_failed && (
        <div className="alert alert-warn" style={{ marginBottom: 16 }}>
          ⚠ Claude couldn't fully parse this bill. Please fill in the fields manually.
          {bill.raw_text && <details style={{ marginTop: 8 }}><summary style={{ cursor: 'pointer', fontSize: 12 }}>Show raw text</summary><pre style={{ marginTop: 6, fontSize: 11, whiteSpace: 'pre-wrap', opacity: 0.7 }}>{bill.raw_text}</pre></details>}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: pendingImage ? '1fr 2fr' : '1fr', gap: 20 }}>
        {pendingImage && (
          <div><div className="card" style={{ padding: 12 }}>
            <img src={'data:' + pendingImage.mimeType + ';base64,' + pendingImage.base64} alt="Bill" style={{ width: '100%', borderRadius: 6, maxHeight: 500, objectFit: 'contain', background: '#fff' }} />
          </div></div>
        )}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Bill Details</div>
            <div className="grid-2">
              <div className="form-group">
                <label className="label">Store / Merchant *</label>
                <input className="input" value={bill.store_name} onChange={e => upd('store_name', e.target.value)} placeholder="e.g. Walmart" />
              </div>
              <div className="form-group">
                <label className="label">Date *</label>
                <input className="input" type="date" value={bill.date || ''} onChange={e => upd('date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Total Amount</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select className="input" style={{ width: 90, flex: 'none' }} value={bill.currency} onChange={e => upd('currency', e.target.value)}>
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <input className="input" type="number" step="0.01" value={bill.total} onChange={e => upd('total', parseFloat(e.target.value) || 0)} />
                </div>
                {Math.abs(itemsTotal - bill.total) > 0.01 && bill.items.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--gold)', marginTop: 4 }}>
                    Items sum: {bill.currency} {itemsTotal} &nbsp;
                    <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => upd('total', itemsTotal)}>Sync ↑</button>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="label">Payment Method</label>
                <input className="input" value={bill.payment_method || ''} onChange={e => upd('payment_method', e.target.value)} placeholder="e.g. credit card" />
              </div>
            </div>
          </div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>Items ({bill.items.length})</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setBill(prev => ({ ...prev, items: [...prev.items, { name: '', brand: '', category: 'Other', quantity: 1, unit_price: null, price: 0 }] }))}>+ Add Item</button>
            </div>
            {bill.items.length === 0
              ? <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No items extracted. Click "Add Item" to add manually.</div>
              : <div className="table-wrap"><table><thead><tr><th>Name</th><th>Brand</th><th>Category</th><th style={{ width: 60 }}>Qty</th><th style={{ width: 80 }}>Price</th><th style={{ width: 36 }}></th></tr></thead><tbody>
                {bill.items.map((item, idx) => (
                  <tr key={idx}>
                    <td><input className="input input-sm" value={item.name} onChange={e => updItem(idx, 'name', e.target.value)} placeholder="Item name" /></td>
                    <td><input className="input input-sm" value={item.brand || ''} onChange={e => updItem(idx, 'brand', e.target.value)} placeholder="Brand" /></td>
                    <td><select className="input input-sm" value={item.category} onChange={e => updItem(idx, 'category', e.target.value)}>{BS.CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></td>
                    <td><input className="input input-sm" type="number" min="0" value={item.quantity} onChange={e => updItem(idx, 'quantity', parseFloat(e.target.value) || 1)} /></td>
                    <td><input className="input input-sm" type="number" step="0.01" value={item.price} onChange={e => updItem(idx, 'price', parseFloat(e.target.value) || 0)} /></td>
                    <td><button style={{ color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '4px 8px' }} onClick={() => setBill(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))}>✕</button></td>
                  </tr>
                ))}
              </tbody></table></div>
            }
          </div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Link to Customer</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {[['existing','👤 Existing'],['new','➕ New Customer'],['skip','⏭ Skip']].map(([m, l]) => (
                <button key={m} className={'btn btn-sm ' + (customerMode === m ? 'btn-primary' : 'btn-ghost')} onClick={() => setCustomerMode(m)}>{l}</button>
              ))}
            </div>
            {customerMode === 'existing' && (
              customers.length === 0
                ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No customers yet. Create a new one.</p>
                : <>
                    <input className="input" placeholder="Search customers…" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} style={{ marginBottom: 8 }} />
                    <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
                      {filteredCustomers.map(c => (
                        <div key={c.id} onClick={() => setSelectedCustomerId(c.id)} style={{ padding: '8px 12px', cursor: 'pointer', background: selectedCustomerId === c.id ? 'var(--accent-dim)' : 'transparent', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: selectedCustomerId === c.id ? 600 : 400 }}>{c.name || 'Unnamed'}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.email}</span>
                        </div>
                      ))}
                    </div>
                  </>
            )}
            {customerMode === 'new' && (
              <div className="grid-2">
                <div className="form-group"><label className="label">Name *</label><input className="input" value={newCustomer.name} onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))} placeholder="Full name" /></div>
                <div className="form-group"><label className="label">Email</label><input className="input" type="email" value={newCustomer.email} onChange={e => setNewCustomer(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" /></div>
              </div>
            )}
            {customerMode === 'skip' && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Bill will be saved without a customer profile.</p>}
          </div>
          {saveError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{saveError}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSave} disabled={saving}>
              {saving ? <span><span className="spinner" style={{ width: 14, height: 14 }} /> Saving…</span> : '💾 Save Bill'}
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('upload')}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
BS.BillReview = BillReview;
