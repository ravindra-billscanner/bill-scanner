// Settings.js — admin settings (no API key; server-managed)
function Settings() {
  const { navigate } = React.useContext(BS.AppContext);
  const { useState } = React;
  const [pwForm, setPwForm]   = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg]     = useState('');
  const [pwErr, setPwErr]     = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (!pwForm.current || !pwForm.next)  { setPwErr('All fields required.'); return; }
    if (pwForm.next !== pwForm.confirm)   { setPwErr('New passwords do not match.'); return; }
    if (pwForm.next.length < 8)           { setPwErr('New password must be at least 8 characters.'); return; }
    setPwLoading(true); setPwErr(''); setPwMsg('');
    try {
      const BASE = window.BS_API_BASE || '';
      const r = await fetch(BASE + '/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + BS.auth.getToken() },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      });
      const j = await r.json();
      if (!r.ok || j.error) { setPwErr(j.error || 'Failed to change password.'); return; }
      setPwMsg('Password changed successfully!');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch { setPwErr('Server error. Try again.'); }
    finally { setPwLoading(false); }
  }

  async function handleExport() {
    try {
      const data = await BS.storage.exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'billscan-export-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg('Export downloaded!');
      setTimeout(() => setExportMsg(''), 3000);
    } catch (err) { setExportMsg('Export failed: ' + err.message); }
  }

  function handleLogout() {
    BS.auth.clearToken();
    window.location.reload();
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Settings</h2>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Change Admin Password</div>
        <form onSubmit={handlePasswordChange}>
          <div className="form-group">
            <label className="label">Current Password</label>
            <input className="input" type="password" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} placeholder="Current password" autoComplete="current-password" />
          </div>
          <div className="form-group">
            <label className="label">New Password</label>
            <input className="input" type="password" value={pwForm.next} onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} placeholder="Min 8 characters" autoComplete="new-password" />
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="label">Confirm New Password</label>
            <input className="input" type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} placeholder="Repeat new password" autoComplete="new-password" />
          </div>
          {pwErr && <div className="alert alert-error" style={{ marginBottom: 10 }}>{pwErr}</div>}
          {pwMsg && <div className="alert alert-ok"   style={{ marginBottom: 10 }}>{pwMsg}</div>}
          <button className="btn btn-primary btn-sm" type="submit" disabled={pwLoading}>
            {pwLoading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Data Export</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>Download all customers and bills as JSON.</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={handleExport}>⬇ Export All Data</button>
          {exportMsg && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{exportMsg}</span>}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Session</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>You are signed in as an admin.</p>
        <button className="btn btn-danger btn-sm" onClick={handleLogout}>Sign Out</button>
      </div>
    </div>
  );
}
BS.Settings = Settings;
