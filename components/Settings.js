// Settings.js — uses BS.storage, BS.claudeApi, BS.AppContext
function Settings() {
  const { apiKey, setApiKey, refreshData } = React.useContext(BS.AppContext);
  const { useState, useRef } = React;
  const [keyInput, setKeyInput]     = useState(apiKey);
  const [showKey, setShowKey]       = useState(false);
  const [testStatus, setTestStatus] = useState(null);
  const [saveMsg, setSaveMsg]       = useState('');
  const [storageInfo, setStorageInfo] = useState(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [importMsg, setImportMsg]   = useState('');
  const importRef = useRef();

  async function handleSaveKey() {
    BS.storage.saveApiKey(keyInput); setApiKey(keyInput);
    setSaveMsg('Saved!'); setTimeout(() => setSaveMsg(''), 2000);
  }
  async function handleTestKey() {
    setTestStatus('testing');
    try { setTestStatus(await BS.claudeApi.testApiKey(keyInput) ? 'ok' : 'fail'); }
    catch { setTestStatus('fail'); }
  }
  async function handleExport() {
    const data = await BS.storage.exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = 'billscan-export-' + new Date().toISOString().slice(0,10) + '.json';
    a.click(); URL.revokeObjectURL(url);
  }
  async function handleImport(e) {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    try {
      const skipped = await BS.storage.importAllData(JSON.parse(await file.text()));
      await refreshData(); setImportMsg('Import successful! ' + skipped + ' duplicate(s) skipped.');
    } catch (err) { setImportMsg('Import failed: ' + err.message); }
    importRef.current.value = ''; setTimeout(() => setImportMsg(''), 5000);
  }
  async function handleClearAll() {
    await BS.storage.clearAllData(); setApiKey(''); setKeyInput('');
    await refreshData(); setClearConfirm(false);
  }
  async function checkStorage() {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      setStorageInfo((est.usage/1024/1024).toFixed(1) + ' MB used of ~' + (est.quota/1024/1024).toFixed(0) + ' MB');
    } else setStorageInfo('Not available in this browser.');
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Settings</h2>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Claude API Key</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>Required to scan bills. Stored locally in your browser only.</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input type={showKey ? 'text' : 'password'} className="input" placeholder="sk-ant-api03-..." value={keyInput} onChange={e => setKeyInput(e.target.value)} style={{ flex: 1, fontFamily: 'monospace', fontSize: 13 }} />
          <button className="btn btn-ghost btn-sm" onClick={() => setShowKey(s => !s)}>{showKey ? '🙈 Hide' : '👁 Show'}</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={handleSaveKey}>Save Key</button>
          <button className="btn btn-ghost btn-sm" onClick={handleTestKey} disabled={!keyInput || testStatus === 'testing'}>
            {testStatus === 'testing' ? React.createElement('span', null, React.createElement('span', { className: 'spinner', style: { width: 12, height: 12 } }), ' Testing…') : 'Test Key'}
          </button>
          {apiKey && <button className="btn btn-danger btn-sm" onClick={() => { BS.storage.clearApiKey(); setApiKey(''); setKeyInput(''); }}>Remove</button>}
          {saveMsg && <span style={{ color: 'var(--green)', fontSize: 13 }}>{saveMsg}</span>}
          {testStatus === 'ok'   && <span style={{ color: 'var(--green)', fontSize: 13 }}>✓ Key is valid</span>}
          {testStatus === 'fail' && <span style={{ color: 'var(--red)',   fontSize: 13 }}>✗ Invalid key</span>}
        </div>
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Data Management</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleExport}>⬇ Export All Data</button>
          <button className="btn btn-ghost btn-sm" onClick={() => importRef.current.click()}>⬆ Import Data</button>
          <input type="file" accept=".json" ref={importRef} style={{ display: 'none' }} onChange={handleImport} />
        </div>
        {importMsg && <div className={'alert ' + (importMsg.includes('failed') ? 'alert-error' : 'alert-ok')}>{importMsg}</div>}
        <hr className="divider" />
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 10 }}>Permanently delete all bills, customers, and settings.</p>
        {!clearConfirm
          ? <button className="btn btn-danger btn-sm" onClick={() => setClearConfirm(true)}>🗑 Clear All Data</button>
          : <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--red)' }}>Are you sure? This cannot be undone.</span>
              <button className="btn btn-danger btn-sm" onClick={handleClearAll}>Yes, Delete All</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setClearConfirm(false)}>Cancel</button>
            </div>
        }
      </div>
      <div className="card">
        <div className="card-title">Storage</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={checkStorage}>Check Usage</button>
          {storageInfo && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{storageInfo}</span>}
        </div>
      </div>
    </div>
  );
}
BS.Settings = Settings;
