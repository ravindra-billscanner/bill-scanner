// Login.js — admin login screen
function Login({ onLogin }) {
  const { useState } = React;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username || !password) { setError('Enter username and password.'); return; }
    setLoading(true); setError('');
    try {
      const BASE = window.BS_API_BASE || '';
      const r = await fetch(BASE + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const j = await r.json();
      if (!r.ok || j.error) { setError(j.error || 'Login failed'); return; }
      BS.auth.setToken(j.data.token);
      onLogin();
    } catch (err) {
      setError('Cannot reach server. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-light)', marginBottom: 4 }}>BillScan</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Admin Dashboard</p>
        </div>
        <div className="card">
          <div className="card-title" style={{ textAlign: 'center', marginBottom: 20 }}>Sign In</div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="label">Username</label>
              <input className="input" type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" autoFocus autoComplete="username" />
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </div>
            {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? <span><span className="spinner" style={{ width: 14, height: 14 }} /> Signing in…</span> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
BS.Login = Login;
