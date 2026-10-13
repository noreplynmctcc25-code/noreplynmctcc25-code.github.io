(() => {
  'use strict';
  const dialog = document.getElementById('quickTool');
  const canvas = document.getElementById('toolCanvas');
  const ctx = canvas.getContext('2d');
  const state = { mode: 'count', image: null, url: '', points: [], pending: [], scale: 0, history: [] };
  const clone = () => ({ points: state.points.map(p => ({ ...p })), pending: state.pending.map(p => ({ ...p })), scale: state.scale });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const reset = () => { state.points = []; state.pending = []; state.scale = 0; state.history = []; draw(); };

  function setMode(mode) {
    if (state.mode !== mode) { state.points = []; state.pending = []; state.scale = 0; state.history = []; }
    state.mode = mode;
    document.getElementById('knownLengthWrap').hidden = mode !== 'measure';
    document.getElementById('countMode').classList.toggle('button-primary', mode === 'count');
    document.getElementById('countMode').classList.toggle('button-quiet', mode !== 'count');
    document.getElementById('measureMode').classList.toggle('button-primary', mode === 'measure');
    document.getElementById('measureMode').classList.toggle('button-quiet', mode !== 'measure');
    document.getElementById('quickTitle').textContent = mode === 'count' ? 'Count items' : 'Measure distances';
    instruction();
    draw();
  }
  function instruction() {
    const message = state.mode === 'count'
      ? 'Tap the center of each object. This is a manual counting aid; it does not run an object-detection model.'
      : state.scale ? 'Tap two endpoints to measure. Replace the reference by clearing the marks and calibrating again.'
      : `Tap the two ends of a known ${document.getElementById('knownLength').value || 10} cm reference in the photo.`;
    document.getElementById('toolInstruction').textContent = message;
    document.getElementById('toolCount').textContent = state.mode === 'count' ? `${state.points.length} marked` : state.scale ? 'Calibrated' : 'Not calibrated';
    document.getElementById('toolMeasure').textContent = state.pending.length ? 'Tap the second endpoint' : '';
  }
  function draw() {
    if (!state.image) {
      canvas.width = canvas.height = 0;
      document.getElementById('toolEmpty').hidden = false;
      instruction();
      return;
    }
    document.getElementById('toolEmpty').hidden = true;
    canvas.width = state.image.width;
    canvas.height = state.image.height;
    ctx.drawImage(state.image, 0, 0);
    ctx.lineWidth = Math.max(3, canvas.width / 360);
    for (let i = 0; i < state.points.length; i++) {
      const p = state.points[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(13, canvas.width / 90), 0, Math.PI * 2);
      ctx.fillStyle = p.type === 'reference' ? '#f5bc59' : '#58e2c0';
      ctx.globalAlpha = .9;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#07121a';
      ctx.font = `700 ${Math.max(13, canvas.width / 100)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.label || String(i + 1), p.x, p.y);
    }
    if (state.pending.length) {
      const p = state.pending[0];
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(8, canvas.width / 130), 0, Math.PI * 2);
      ctx.strokeStyle = '#c6b0ff'; ctx.stroke();
    }
    instruction();
  }
  function saveHistory() { state.history.push(clone()); if (state.history.length > 50) state.history.shift(); }
  function undo() {
    const prior = state.history.pop();
    if (!prior) return;
    state.points = prior.points; state.pending = prior.pending; state.scale = prior.scale; draw();
  }
  function loadImage(file) {
    if (!file) return;
    if (state.url) URL.revokeObjectURL(state.url);
    state.url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const k = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
      const scaled = document.createElement('canvas');
      scaled.width = Math.max(1, Math.round(image.naturalWidth * k));
      scaled.height = Math.max(1, Math.round(image.naturalHeight * k));
      scaled.getContext('2d').drawImage(image, 0, 0, scaled.width, scaled.height);
      state.image = scaled;
      reset();
    };
    image.onerror = () => window.toast('That photo could not be opened.');
    image.src = state.url;
  }
  function onCanvasClick(event) {
    if (!state.image) return;
    const rect = canvas.getBoundingClientRect();
    const p = { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
    saveHistory();
    if (state.mode === 'count') {
      state.points.push({ ...p, type: 'count', label: String(state.points.length + 1) });
    } else {
      state.pending.push(p);
      if (state.pending.length === 2) {
        const [a, b] = state.pending; state.pending = [];
        if (!state.scale) {
          const cm = Number(document.getElementById('knownLength').value);
          if (!(cm > 0)) { window.toast('Enter a known reference length greater than zero.'); return; }
          state.scale = cm / distance(a, b);
          state.points.push({ ...a, type: 'reference', label: 'A' }, { ...b, type: 'reference', label: 'B' });
        } else {
          const cm = distance(a, b) * state.scale;
          const label = `${cm.toFixed(cm < 10 ? 2 : 1)} cm`;
          state.points.push({ ...a, type: 'measure', label }, { ...b, type: 'measure', label });
        }
      }
    }
    draw();
  }
  window.openQuickTool = mode => {
    setMode(mode || 'count');
    if (!dialog.open) dialog.showModal();
  };
  document.getElementById('countMode').addEventListener('click', () => setMode('count'));
  document.getElementById('measureMode').addEventListener('click', () => setMode('measure'));
  document.getElementById('toolPhoto').addEventListener('change', event => loadImage(event.target.files && event.target.files[0]));
  document.getElementById('knownLength').addEventListener('input', instruction);
  document.getElementById('undoMark').addEventListener('click', undo);
  document.getElementById('clearMarks').addEventListener('click', reset);
  canvas.addEventListener('click', onCanvasClick);
  dialog.addEventListener('close', () => { state.image = null; reset(); if (state.url) URL.revokeObjectURL(state.url); state.url = ''; document.getElementById('toolPhoto').value = ''; });
})();
