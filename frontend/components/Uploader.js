// Uploader.js
function CameraModal({ onCapture, onClose }) {
  const { useState, useRef, useEffect } = React;
  const videoRef = useRef();
  const [stream, setStream] = useState(null);
  const [camError, setCamError] = useState('');
  const [captured, setCaptured] = useState(null);

  useEffect(() => {
    let s;
    (async () => {
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (err) {
        if (err.name === 'NotAllowedError') setCamError('Camera access denied. Please allow camera access in browser settings.');
        else if (err.name === 'NotFoundError') setCamError('No camera found. Please use file upload instead.');
        else setCamError('Could not access camera: ' + err.message);
      }
    })();
    return () => { if (s) s.getTracks().forEach(t => t.stop()); };
  }, []);

  function capture() {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    setCaptured(c.toDataURL('image/jpeg', 0.92).split(',')[1]);
    if (stream) stream.getTracks().forEach(t => t.stop());
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-title">📷 Camera Capture</div>
        {camError && <div className="alert alert-error">{camError}</div>}
        {!captured && !camError && (
          <>
            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: 6, background: '#000', marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={capture}>📸 Capture</button>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
        {captured && (
          <>
            <img src={'data:image/jpeg;base64,' + captured} alt="Captured" style={{ width: '100%', borderRadius: 6, marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onCapture({ base64: captured, mimeType: 'image/jpeg' })}>✓ Use This Photo</button>
              <button className="btn btn-ghost" onClick={() => setCaptured(null)}>Retake</button>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
        {camError && <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={onClose}>Close</button>}
      </div>
    </div>
  );
}

function Uploader() {
  const { navigate, setPendingBill, setPendingImage } = React.useContext(BS.AppContext);
  const { useState, useRef } = React;
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus]     = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [preview, setPreview]   = useState(null);
  const [pdfInfo, setPdfInfo]   = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef();

  async function processFile(file) {
    setErrorMsg('');
    if (!file) return;
    if (file.type === 'application/pdf') {
      try {
        const pageCount = await BS.pdfReader.getPdfPageCount(file);
        setPdfInfo({ file, pageCount, currentPage: 1 });
        const { base64 } = await BS.pdfReader.getPdfPageAsBase64(file, 1);
        setPreview({ src: 'data:image/jpeg;base64,' + base64, type: 'pdf', name: file.name });
      } catch (err) {
        setErrorMsg(err.message === 'PDF_PASSWORD_PROTECTED' ? 'This PDF is password-protected.' : (err.message || 'Could not read PDF.'));
      }
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => { setPreview({ src: e.target.result, type: 'image', name: file.name }); setPdfInfo(null); };
      reader.readAsDataURL(file);
    } else {
      setErrorMsg('Unsupported file type. Please upload JPG, PNG, or PDF.');
    }
  }

  async function changePage(delta) {
    if (!pdfInfo) return;
    const np = pdfInfo.currentPage + delta;
    if (np < 1 || np > pdfInfo.pageCount) return;
    const { base64 } = await BS.pdfReader.getPdfPageAsBase64(pdfInfo.file, np);
    setPreview(prev => ({ ...prev, src: 'data:image/jpeg;base64,' + base64 }));
    setPdfInfo(prev => ({ ...prev, currentPage: np }));
  }

  async function handleExtract() {
    if (!preview) return;
    setStatus('extracting'); setErrorMsg('');
    try {
      let base64 = preview.src.split(',')[1];
      const mimeType = preview.src.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      // Compress if large (>4MB)
      if (base64.length > 5400000) {
        const img = new Image(); img.src = preview.src;
        await new Promise(r => img.onload = r);
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        base64 = c.toDataURL('image/jpeg', 0.7).split(',')[1];
      }
      const result = await BS.claudeApi.extractBill(base64, mimeType);
      if (result && result.error === 'not_a_bill') { setErrorMsg("This doesn't appear to be a bill. Please try a different image."); setStatus('error'); return; }
      setPendingBill(result); setPendingImage({ base64, mimeType }); navigate('review');
    } catch (err) {
      if (err.message === 'AUTH_ERROR') setErrorMsg('Session expired. Please log in again.');
      else if (err.message === 'RATE_LIMIT') setErrorMsg('Rate limit reached. Wait a moment and retry.');
      else setErrorMsg(err.message || 'Extraction failed. Please try again.');
      setStatus('error');
    } finally {
      setStatus(s => s === 'extracting' ? 'idle' : s);
    }
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Upload a Bill</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 13 }}>Upload a photo or PDF of any receipt or invoice.</p>
      {!preview && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); processFile(e.dataTransfer.files && e.dataTransfer.files[0]); }}
          onClick={() => fileInputRef.current.click()}
          style={{ border: '2px dashed ' + (dragOver ? 'var(--accent)' : 'var(--border)'), borderRadius: 'var(--radius)', padding: '48px 32px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'var(--accent-dim)' : 'var(--surface)', transition: 'all .2s', marginBottom: 16 }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Drag & drop a bill here</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>or click to browse — JPG, PNG, PDF supported</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={e => { e.stopPropagation(); fileInputRef.current.click(); }}>📁 Choose File</button>
            <button className="btn btn-ghost" onClick={e => { e.stopPropagation(); setShowCamera(true); }}>📷 Use Camera</button>
          </div>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,application/pdf" style={{ display: 'none' }} onChange={e => processFile(e.target.files && e.target.files[0])} />
      {preview && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>📄 {preview.name || 'Bill Preview'}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => { setPreview(null); setPdfInfo(null); setStatus('idle'); setErrorMsg(''); }}>✕ Remove</button>
          </div>
          <img src={preview.src} alt="Bill preview" style={{ width: '100%', maxHeight: 400, objectFit: 'contain', borderRadius: 6, background: '#fff' }} />
          {pdfInfo && pdfInfo.pageCount > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => changePage(-1)} disabled={pdfInfo.currentPage <= 1}>‹ Prev</button>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Page {pdfInfo.currentPage} of {pdfInfo.pageCount}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => changePage(1)} disabled={pdfInfo.currentPage >= pdfInfo.pageCount}>Next ›</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleExtract} disabled={status === 'extracting'} style={{ flex: 1, justifyContent: 'center' }}>
              {status === 'extracting' ? <span><span className="spinner" style={{ width: 14, height: 14 }} /> Extracting with Claude…</span> : '✨ Extract Bill Data'}
            </button>
            <button className="btn btn-ghost" onClick={() => fileInputRef.current.click()}>Change File</button>
          </div>
        </div>
      )}
      {errorMsg && <div className="alert alert-error">{errorMsg}</div>}
      {showCamera && <CameraModal onCapture={({ base64, mimeType }) => { setPreview({ src: 'data:image/jpeg;base64,' + base64, type: 'image', name: 'camera-capture.jpg' }); setPdfInfo(null); setShowCamera(false); }} onClose={() => setShowCamera(false)} />}
      {!preview && (
        <div style={{ color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.8 }}>
          <strong style={{ color: 'var(--text-muted)' }}>Tips for best results:</strong>
          <ul style={{ marginTop: 6, paddingLeft: 18 }}>
            <li>Ensure the entire bill is visible and in focus</li>
            <li>Good lighting reduces extraction errors</li>
            <li>PDFs from apps (Amazon, Zomato, etc.) work great</li>
          </ul>
        </div>
      )}
    </div>
  );
}
BS.Uploader = Uploader;
