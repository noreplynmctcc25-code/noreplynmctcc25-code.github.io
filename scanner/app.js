(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const input = $('#fileInput');
  const search = $('#searchInput');
  let sortByName = false;

  const openScanner = options => {
    if (typeof window.scnOpen !== 'function') {
      window.toast('Scanner is still loading. Try again in a moment.');
      return;
    }
    window.scnOpen(options || {});
  };

  const setTab = name => {
    document.querySelectorAll('.app-view').forEach(view => { view.hidden = view.id !== name + 'View'; });
    document.querySelectorAll('.nav-item[data-tab]').forEach(item => item.classList.toggle('active', item.dataset.tab === name));
    if (name === 'docs') renderRecent();
  };

  const scanItems = () => {
    try { return (window.C().scans || []).filter(item => !item.del); }
    catch (_) { return []; }
  };

  const renderRecent = () => {
    const list = $('#recentList');
    const empty = $('#emptyState');
    if (!list || !empty) return;
    const query = (search.value || '').trim().toLocaleLowerCase();
    const items = scanItems().sort((a, b) => sortByName
      ? String(a.name).localeCompare(String(b.name))
      : (b.t || 0) - (a.t || 0));
    const shown = items.filter(item => !query || String(item.name || '').toLocaleLowerCase().includes(query)).slice(0, 12);
    $('#recentSubtitle').textContent = query ? shown.length + ' matching document' + (shown.length === 1 ? '' : 's') : (items.length ? items.length + ' saved document' + (items.length === 1 ? '' : 's') : 'Your scans will appear here');
    empty.hidden = shown.length > 0;
    list.hidden = shown.length === 0;
    if (!shown.length) {
      $('#emptyState h2').textContent = query ? 'No matching scans' : 'No scans yet';
      $('#emptyState p').textContent = query ? 'Try another name or clear your search.' : 'Capture a page or import a file to create your first document.';
      $('#emptyScanBtn').hidden = !!query;
      list.innerHTML = '';
      return;
    }
    $('#emptyScanBtn').hidden = true;
    list.innerHTML = shown.map(item => {
      const name = window.esc(item.name || 'Untitled scan');
      const thumb = item.th
        ? '<img src="' + item.th + '" alt="">'
        : '<span class="recent-placeholder" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
      const pages = Number(item.pages) || 1;
      const date = item.t ? window.fmtDt(item.t) : 'Saved locally';
      return '<button class="recent-card" type="button" aria-label="Open saved scans"><span class="recent-thumb">' + thumb + '</span><span class="recent-card-meta"><b>' + name + '</b><small>' + pages + ' page' + (pages === 1 ? '' : 's') + ' · ' + date + '</small></span></button>';
    }).join('');
  };

  const updateCounts = window.updateSavedCount;
  window.updateSavedCount = () => {
    if (updateCounts) updateCounts();
    const count = scanItems().length;
    const profileCount = $('#profileSavedCount');
    if (profileCount) profileCount.textContent = count;
    renderRecent();
  };

  $('#captureBtn').addEventListener('click', () => openScanner());
  $('#navScan').addEventListener('click', () => openScanner());
  $('#emptyScanBtn').addEventListener('click', () => openScanner());
  $('#savedBtn').addEventListener('click', () => openScanner({ lib: true }));
  $('#navFiles').addEventListener('click', () => openScanner({ lib: true }));
  $('#profileSavedBtn').addEventListener('click', () => openScanner({ lib: true }));
  $('#importBtn').addEventListener('click', () => input.click());
  $('#pdfToolsBtn').addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const files = Array.from(input.files || []);
    input.value = '';
    if (files.length) openScanner({ initialFiles: files });
  });

  $('#idModeBtn').addEventListener('click', () => {
    openScanner();
    window.toast('In the editor, choose ID card · 2 copies in Page settings for an A4 print sheet.');
  });

  document.querySelectorAll('[data-tab]').forEach(button => {
    button.addEventListener('click', () => setTab(button.dataset.tab));
  });

  document.querySelectorAll('.tool-row').forEach(button => {
    button.addEventListener('click', () => {
      const tool = button.dataset.tool;
      if (tool === 'merge') input.click();
      else if (tool === 'id') {
        openScanner();
        window.toast('Choose ID card · 2 copies or Passport photos · 4-up A4 in Page settings.');
      } else if (tool === 'book') {
        openScanner();
        window.toast('Use Split book in the editor. Whiteboard is available in the filter row.');
      } else if (tool === 'count') {
        window.openQuickTool('count');
      } else if (tool === 'ai') {
        window.toast('AI inpainting models are not bundled. Local contrast and noise cleanup are available.');
      }
    });
  });

  $('#searchToggle').addEventListener('click', () => search.focus());
  search.addEventListener('input', () => {
    $('#clearSearch').hidden = !search.value;
    renderRecent();
  });
  $('#clearSearch').addEventListener('click', () => {
    search.value = '';
    $('#clearSearch').hidden = true;
    renderRecent();
    search.focus();
  });
  $('#sortButton').addEventListener('click', () => {
    sortByName = !sortByName;
    $('#sortButton').innerHTML = (sortByName ? 'Name' : 'Date added') + ' <span>⌄</span>';
    renderRecent();
  });
  $('#viewToggle').addEventListener('click', () => {
    $('#recentList').classList.toggle('list-view');
    $('#viewToggle').classList.toggle('selected');
  });
  $('#recentList').addEventListener('click', event => {
    if (event.target.closest('.recent-card')) openScanner({ lib: true });
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Offline cache unavailable:', error));
  }
  window.addEventListener('focus', () => window.updateSavedCount && window.updateSavedCount());
  window.updateSavedCount();
})();
