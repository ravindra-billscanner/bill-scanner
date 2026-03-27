// pdfReader.js — PDF.js helpers, exposed on BS.pdfReader
(function() {
  function lib() {
    if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js not loaded.');
    return pdfjsLib;
  }

  async function getPdfPageCount(file) {
    const ab = await file.arrayBuffer();
    try {
      const pdf = await lib().getDocument({ data: ab }).promise;
      return pdf.numPages;
    } catch (err) {
      if (err.name === 'PasswordException') throw new Error('PDF_PASSWORD_PROTECTED');
      throw new Error('Could not read PDF.');
    }
  }

  async function getPdfPageAsBase64(file, pageNumber, scale) {
    pageNumber = pageNumber || 1;
    scale = scale || 2.0;
    const ab = await file.arrayBuffer();
    let pdf;
    try { pdf = await lib().getDocument({ data: ab }).promise; }
    catch (err) {
      if (err.name === 'PasswordException') throw new Error('PDF_PASSWORD_PROTECTED');
      throw new Error('Could not read PDF.');
    }
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' };
  }

  BS.pdfReader = { getPdfPageCount, getPdfPageAsBase64 };
})();
