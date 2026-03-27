// app.js — root React app, hash router, AppContext
// All dependencies already on window.BS from prior script tags

BS.AppContext = React.createContext(null);

const NAV = [
  { route: 'upload',    label: '⬆ Upload Bill' },
  { route: 'dashboard', label: '📊 Dashboard' },
  { route: 'customers', label: '👥 Customers' },
  { route: 'settings',  label: '⚙ Settings' },
];

function parseRoute() {
  const h = (window.location.hash || '').slice(1).split('?');
  const route = h[0] || 'upload';
  const params = {};
  try { new URLSearchParams(h[1] || '').forEach((v, k) => { params[k] = v; }); } catch(e) {}
  return { route, params };
}

function App() {
  const { useState, useEffect, useCallback } = React;
  const [routeState, setRouteState] = useState(parseRoute);
  const { route, params } = routeState;
  const [customers, setCustomers] = useState([]);
  const [bills, setBills]         = useState([]);
  const [apiKey, setApiKey]       = useState('');
  const [pendingBill, setPendingBill]   = useState(null);
  const [pendingImage, setPendingImage] = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    (async () => {
      try {
        await BS.storage.initDB();
        const [c, b] = await Promise.all([BS.storage.getAllCustomers(), BS.storage.getAllBills()]);
        setCustomers(c); setBills(b); setApiKey(BS.storage.getApiKey());
      } catch(e) { console.error('Init error:', e); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    const handler = () => setRouteState(parseRoute());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = useCallback((r, p) => {
    p = p || {};
    const qs = new URLSearchParams(p).toString();
    window.location.hash = qs ? r + '?' + qs : r;
  }, []);

  const refreshData = useCallback(async () => {
    const [c, b] = await Promise.all([BS.storage.getAllCustomers(), BS.storage.getAllBills()]);
    setCustomers(c); setBills(b);
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
      <span style={{ color: 'var(--text-muted)' }}>Loading BillScan…</span>
    </div>
  );

  const ctx = { route, params, navigate, customers, bills, apiKey, setApiKey, pendingBill, setPendingBill, pendingImage, setPendingImage, refreshData };

  function renderView() {
    switch (route) {
      case 'upload':    return <BS.Uploader />;
      case 'review':    return <BS.BillReview />;
      case 'dashboard': return <BS.Dashboard />;
      case 'customers': return <BS.CustomerList />;
      case 'settings':  return <BS.Settings />;
      default:          return <BS.Uploader />;
    }
  }

  return (
    <BS.AppContext.Provider value={ctx}>
      <nav className="nav">
        <div className="nav-logo">BillScan <span>/ Profiling</span></div>
        <div className="nav-links">
          {NAV.map(n => (
            <button key={n.route} className={'nav-link' + (route === n.route ? ' active' : '')} onClick={() => navigate(n.route)}>
              {n.label}
            </button>
          ))}
        </div>
      </nav>
      <main className="main">{renderView()}</main>
    </BS.AppContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
