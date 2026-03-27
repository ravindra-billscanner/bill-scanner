// CustomerList.js
function CustomerList() {
  const { customers, bills, navigate, refreshData } = React.useContext(BS.AppContext);
  const { useState, useMemo } = React;
  const [search, setSearch]     = useState('');
  const [sortBy, setSortBy]     = useState('name');
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const enriched = useMemo(() => customers.map(c => {
    const cb = bills.filter(b => b.customerId === c.id);
    const kpi = BS.analytics.getKpiSummary(cb);
    const seg = BS.analytics.computeSegment(cb);
    const lastDate = cb.map(b => b.date).filter(Boolean).sort().pop() || null;
    return { ...c, kpi, segment: seg, lastDate, currency: (cb[0] && cb[0].currency) || '' };
  }), [customers, bills]);

  const filtered = useMemo(() => {
    let rows = enriched;
    if (search) { const s = search.toLowerCase(); rows = rows.filter(c => (c.name || '').toLowerCase().includes(s) || (c.email || '').toLowerCase().includes(s)); }
    switch (sortBy) {
      case 'spend': return [...rows].sort((a, b) => b.kpi.totalSpend - a.kpi.totalSpend);
      case 'bills': return [...rows].sort((a, b) => b.kpi.totalBills - a.kpi.totalBills);
      case 'lastDate': return [...rows].sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''));
      default: return [...rows].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
  }, [enriched, search, sortBy]);

  const unlinked = bills.filter(b => !b.customerId);

  async function handleDelete(id) {
    setDeleting(true);
    try { await BS.storage.deleteCustomer(id); await refreshData(); }
    finally { setDeleting(false); setDeleteId(null); }
  }

  if (!customers.length) return (
    <div className="empty-state">
      <div className="empty-state-icon">👥</div>
      <h3>No customers yet</h3>
      <p>When you save a bill and link it to a customer, they'll appear here.</p>
      <button className="btn btn-primary" onClick={() => navigate('upload')}>⬆ Upload First Bill</button>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, flex: 1 }}>Customers ({customers.length})</h2>
        <input className="input" style={{ width: 220 }} placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input" style={{ width: 160 }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="name">Sort: Name</option>
          <option value="spend">Sort: Total Spend</option>
          <option value="bills">Sort: Bill Count</option>
          <option value="lastDate">Sort: Last Activity</option>
        </select>
      </div>
      <div className="card">
        <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Bills</th><th>Total Spend</th><th>Last Bill</th><th>Segment</th><th>Actions</th></tr></thead><tbody>
          {filtered.map(c => (
            <tr key={c.id}>
              <td style={{ fontWeight: 600 }}>{c.name || <span style={{ color: 'var(--text-dim)' }}>Unnamed</span>}</td>
              <td style={{ color: 'var(--text-muted)' }}>{c.email || '—'}</td>
              <td style={{ textAlign: 'center' }}>{c.kpi.totalBills}</td>
              <td style={{ fontWeight: 600, color: 'var(--accent-light)' }}>{c.kpi.totalBills > 0 ? c.currency + ' ' + c.kpi.totalSpend.toFixed(2) : '—'}</td>
              <td style={{ color: 'var(--text-muted)' }}>{c.lastDate || '—'}</td>
              <td>{c.segment.primary === 'Insufficient Data'
                ? <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>—</span>
                : <span className="badge" style={{ background: c.segment.color + '22', color: c.segment.color, border: '1px solid ' + c.segment.color + '44', fontSize: 11 }}>{c.segment.primary}</span>}
              </td>
              <td>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate('dashboard', { customer: c.id })}>📊 View</button>
                  <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(c.id)}>🗑</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody></table></div>
      </div>
      {unlinked.length > 0 && <div className="alert alert-info" style={{ marginTop: 16 }}>📋 {unlinked.length} bill{unlinked.length > 1 ? 's are' : ' is'} not linked to any customer.</div>}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Delete Customer?</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>This will permanently delete the customer and all their bills. This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={() => handleDelete(deleteId)} disabled={deleting}>
                {deleting ? <span><span className="spinner" style={{ width: 14, height: 14 }} /> Deleting…</span> : 'Yes, Delete'}
              </button>
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
BS.CustomerList = CustomerList;
