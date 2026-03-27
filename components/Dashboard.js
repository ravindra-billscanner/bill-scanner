// Dashboard.js
function Dashboard() {
  const { bills, customers, params, navigate } = React.useContext(BS.AppContext);
  const { useState, useEffect, useRef, useMemo } = React;
  const [selectedId, setSelectedId] = useState((params && params.customer) || 'all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const spendRef = useRef(null); const spendCanvas = useRef();
  const catRef   = useRef(null); const catCanvas   = useRef();
  const brandRef = useRef(null); const brandCanvas = useRef();
  const storeRef = useRef(null); const storeCanvas = useRef();
  function destroy(r) { if (r.current) { r.current.destroy(); r.current = null; } }

  const filteredBills = useMemo(() => {
    let b = selectedId === 'all' ? bills : bills.filter(x => x.customerId === selectedId);
    if (dateFrom) b = b.filter(x => x.date && x.date >= dateFrom);
    if (dateTo)   b = b.filter(x => x.date && x.date <= dateTo);
    return b;
  }, [bills, selectedId, dateFrom, dateTo]);

  const kpi      = useMemo(() => BS.analytics.getKpiSummary(filteredBills), [filteredBills]);
  const segment  = useMemo(() => selectedId !== 'all' ? BS.analytics.computeSegment(filteredBills) : null, [filteredBills, selectedId]);
  const spending = useMemo(() => BS.analytics.getSpendingByMonth(filteredBills), [filteredBills]);
  const cats     = useMemo(() => BS.analytics.getCategoryBreakdown(filteredBills), [filteredBills]);
  const brands   = useMemo(() => BS.analytics.getBrandFrequency(filteredBills, 10), [filteredBills]);
  const stores   = useMemo(() => BS.analytics.getStoreFrequency(filteredBills, 10), [filteredBills]);

  const C = '#e2e8f0', G = 'rgba(51,65,85,0.6)', A = '#a78bfa';

  useEffect(() => {
    destroy(spendRef);
    if (!spendCanvas.current || !spending.labels.length) return;
    spendRef.current = new Chart(spendCanvas.current, { type: 'line', data: { labels: spending.labels, datasets: [{ label: 'Spending', data: spending.data, borderColor: A, backgroundColor: 'rgba(167,139,250,0.1)', fill: true, tension: 0.4, pointBackgroundColor: A, pointRadius: 4 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: C }, grid: { color: G } }, y: { ticks: { color: C }, grid: { color: G }, beginAtZero: true } } } });
    return () => destroy(spendRef);
  }, [spending]);

  useEffect(() => {
    destroy(catRef);
    if (!catCanvas.current || !cats.length) return;
    catRef.current = new Chart(catCanvas.current, { type: 'doughnut', data: { labels: cats.map(c => c.category), datasets: [{ data: cats.map(c => c.total), backgroundColor: cats.map(c => BS.CATEGORY_COLORS[c.category] || '#475569'), borderWidth: 2, borderColor: '#1e293b' }] }, options: { responsive: true, plugins: { legend: { position: 'right', labels: { color: C, padding: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: ctx => ' ' + ctx.label + ': ' + ctx.parsed.toFixed(2) + ' (' + (cats[ctx.dataIndex] && cats[ctx.dataIndex].percentage) + '%)' } } } } });
    return () => destroy(catRef);
  }, [cats]);

  useEffect(() => {
    destroy(brandRef);
    if (!brandCanvas.current || !brands.length) return;
    brandRef.current = new Chart(brandCanvas.current, { type: 'bar', data: { labels: brands.map(b => b.brand), datasets: [{ label: 'Purchases', data: brands.map(b => b.count), backgroundColor: '#7c3aed99', borderColor: A, borderWidth: 1 }] }, options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: C }, grid: { color: G }, beginAtZero: true }, y: { ticks: { color: C }, grid: { color: G } } } } });
    return () => destroy(brandRef);
  }, [brands]);

  useEffect(() => {
    destroy(storeRef);
    if (!storeCanvas.current || !stores.length) return;
    storeRef.current = new Chart(storeCanvas.current, { type: 'bar', data: { labels: stores.map(s => s.store), datasets: [{ label: 'Visits', data: stores.map(s => s.visits), backgroundColor: '#3b82f699', borderColor: '#60a5fa', borderWidth: 1 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: C, maxRotation: 30 }, grid: { color: G } }, y: { ticks: { color: C }, grid: { color: G }, beginAtZero: true } } } });
    return () => destroy(storeRef);
  }, [stores]);

  if (!bills.length) return (
    <div className="empty-state">
      <div className="empty-state-icon">📊</div>
      <h3>No data yet</h3>
      <p>Scan your first bill to start building customer profiles and analytics.</p>
      <button className="btn btn-primary" onClick={() => navigate('upload')}>⬆ Upload First Bill</button>
    </div>
  );

  const selectedCustomer = customers.find(c => c.id === selectedId);
  const currency = (filteredBills[0] && filteredBills[0].currency) || '';

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, flex: 1 }}>{selectedId === 'all' ? 'All Customers' : ((selectedCustomer && selectedCustomer.name) || 'Customer')} — Dashboard</h2>
        <select className="input" style={{ width: 'auto', minWidth: 180 }} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
          <option value="all">All Customers</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name || 'Unnamed'}</option>)}
        </select>
        <input type="date" className="input" style={{ width: 140 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" />
        <span style={{ color: 'var(--text-muted)' }}>to</span>
        <input type="date" className="input" style={{ width: 140 }} value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" />
        {(dateFrom || dateTo) && <button className="btn btn-ghost btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear ✕</button>}
      </div>

      {segment && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Customer Segment:</span>
            <span className="badge" style={{ background: segment.color + '22', color: segment.color, border: '1px solid ' + segment.color + '44', fontSize: 12, padding: '4px 12px' }}>{segment.primary}</span>
            {segment.secondary && <span className="badge" style={{ background: '#f9730322', color: '#f97316', border: '1px solid #f9730344', fontSize: 12, padding: '4px 12px' }}>{segment.secondary}</span>}
            {segment.description && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{segment.description}</span>}
          </div>
          {segment.scores && Object.keys(segment.scores).length > 0 && (
            <div style={{ display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
              {Object.entries(segment.scores).map(([k, v]) => (
                <div key={k} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize', marginBottom: 4 }}>{k.replace(/([A-Z])/g, ' $1')}</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{v}</div>
                  <div style={{ height: 4, width: 60, background: 'var(--border)', borderRadius: 2, marginTop: 4 }}>
                    <div style={{ height: '100%', width: v + '%', background: 'var(--accent)', borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Bills Scanned', value: kpi.totalBills },
          { label: 'Total Spend', value: currency + ' ' + kpi.totalSpend.toFixed(2), accent: 'var(--accent-light)' },
          { label: 'Avg Bill Value', value: currency + ' ' + kpi.avgBillValue.toFixed(2) },
          { label: 'Top Store', value: kpi.topStore, sub: 'most visited' },
          { label: 'Top Brand', value: kpi.topBrand, sub: 'most purchased' },
          { label: 'Top Category', value: kpi.topCategory },
        ].map(k => (
          <div className="kpi-card" key={k.label}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={k.accent ? { color: k.accent } : {}}>{k.value}</div>
            {k.sub && <div className="kpi-sub">{k.sub}</div>}
          </div>
        ))}
      </div>

      {filteredBills.length === 0
        ? <div className="alert alert-info">No bills found for the selected filters.</div>
        : <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Spending Over Time</div>
            {spending.labels.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Not enough dated bills to show a trend.</p> : <canvas ref={spendCanvas} style={{ maxHeight: 240 }} />}
          </div>
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="card">
              <div className="card-title">Category Breakdown</div>
              {cats.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No categorized items found.</p> : <canvas ref={catCanvas} style={{ maxHeight: 240 }} />}
            </div>
            <div className="card">
              <div className="card-title">Top Brands</div>
              {brands.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No brand data found.</p> : <canvas ref={brandCanvas} style={{ maxHeight: 240 }} />}
            </div>
          </div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Store Visit Frequency</div>
            {stores.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No store data.</p> : <canvas ref={storeCanvas} style={{ maxHeight: 200 }} />}
          </div>
          <div className="card">
            <div className="card-title">Recent Bills</div>
            <div className="table-wrap"><table><thead><tr><th>Date</th><th>Store</th><th>Items</th><th>Total</th><th>Payment</th></tr></thead><tbody>
              {[...filteredBills].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 15).map(b => (
                <tr key={b.id}>
                  <td>{b.date || '—'}</td><td>{b.store_name || '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{(b.items && b.items.length) || 0}</td>
                  <td style={{ fontWeight: 600 }}>{b.currency} {(b.total || 0).toFixed(2)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{b.payment_method || '—'}</td>
                </tr>
              ))}
            </tbody></table></div>
          </div>
        </>
      }
    </div>
  );
}
BS.Dashboard = Dashboard;
