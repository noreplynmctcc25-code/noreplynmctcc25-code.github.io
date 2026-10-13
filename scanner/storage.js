/* Browser-local storage for saved PDFs. The scanner engine is shared with
   the parent app and expects these small storage helpers to exist globally. */
(() => {
  'use strict';
  const META_KEY = 'clearscan.library.v1';
  const DB_NAME = 'clearscan-local-v1';
  const STORE = 'files';
  let dbPromise;

  function readMeta() {
    try {
      const value = JSON.parse(localStorage.getItem(META_KEY) || '{"scans":[]}');
      if (!Array.isArray(value.scans)) value.scans = [];
      return value;
    } catch (_) { return { scans: [] }; }
  }
  const data = readMeta();
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open local scan storage.'));
    });
    return dbPromise;
  }
  async function put(id, blob) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Could not save this scan.'));
      tx.onabort = () => reject(tx.error || new Error('Scan save was cancelled.'));
    });
  }
  async function get(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Could not open this scan.'));
    });
  }
  async function remove(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Could not delete this scan.'));
    });
  }
  function persist() {
    try { localStorage.setItem(META_KEY, JSON.stringify(data)); } catch (_) { /* IndexedDB keeps the actual PDFs. */ }
    if (window.updateSavedCount) window.updateSavedCount();
  }

  window.C = () => data;
  window.uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  window.fput = put;
  window.fget = get;
  window.fdel = id => { remove(id).catch(console.error); };
  window.mark = persist;
  window.esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  window.fwhy = () => 'This scan is not available in this browser profile.';
  window.toast = message => {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('on');
    clearTimeout(window.__clearScanToast);
    window.__clearScanToast = setTimeout(() => node.classList.remove('on'), 2600);
  };
  window.fmtSz = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
  window.fmtDt = time => new Date(time).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  window.loadJs = async file => {
    if (window.pdfjsLib) return;
    if (window.__pdfLoader) return window.__pdfLoader;
    window.__pdfLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `../${file}`;
      script.onload = resolve;
      script.onerror = () => reject(new Error('PDF tools could not be loaded.'));
      document.head.appendChild(script);
    });
    return window.__pdfLoader;
  };
  window.viewInto = async (container, blob, name) => {
    const url = URL.createObjectURL(blob);
    container.innerHTML = '';
    const frame = document.createElement('iframe');
    frame.title = name || 'PDF preview';
    frame.src = url;
    frame.style.cssText = 'display:block;width:100%;height:100%;min-height:70vh;border:0;background:#fff';
    container.dataset.objectUrl = url;
    container.appendChild(frame);
  };
  window.updateSavedCount = () => {
    const node = document.getElementById('savedCount');
    if (node) node.textContent = data.scans.filter(scan => !scan.del).length;
  };
  window.updateSavedCount();
})();
