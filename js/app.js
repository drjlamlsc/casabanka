const VERSION = 'v1.6 · 2026-05-12 16:30';

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────
let S = {
  screen: 'loading',
  modal: null,
  homes: [],
  apiKey: '',
  // github sync
  ghEnabled:  localStorage.getItem('cb_gh_enabled') === 'true',
  ghToken:    localStorage.getItem('cb_gh_token')   || '',
  ghOwner:    localStorage.getItem('cb_gh_owner')   || '',
  ghRepo:     localStorage.getItem('cb_gh_repo')    || 'casabanka-data',
  ghFileSha:  localStorage.getItem('cb_gh_sha')     || null,
  ghLastSync: localStorage.getItem('cb_gh_last_sync') || null,
  ghStatus:   'idle',  // 'idle' | 'syncing' | 'error'
  // current home
  homeId: null,
  home: null,
  layout: null,
  items: [],
  // browse
  browsePath: [], // [{level:'room'|'area'|'spot', id, name}]
  // setup flow
  setupFrames: [],
  draftLayout: null,
  editingLayout: null,  // deep-cloned layout being edited
  layoutEditSource: 'setup', // 'setup' | 'settings' — where to go back to on cancel
  // add-item flow
  addPhotos: [],        // array of base64 strings
  addDesc: '',
  addDrafts: [],        // array of AI results, one per photo
  addDraftEdits: [],    // array of user-override objects
  // search
  query: '',
  results: [],
  searchAi: false,
  // detail view
  detailItem: null,
  // move item
  moveItemId: null,
  moveAiDesc: '',
  moveLocation: { roomId: '', roomName: '', areaId: '', areaName: '', spotId: '', spotName: '' },
  moveAiWorking: false,
};

// ─────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────
function go(screen, patch = {}) {
  Object.assign(S, patch, { screen });
  render();
}

function render() {
  const app = document.getElementById('app');
  app.innerHTML = buildScreen() + buildModal();
  bindEvents();
}

function buildScreen() {
  switch (S.screen) {
    case 'loading':          return scrLoading();
    case 'api-key':          return scrApiKey();
    case 'home-selector':    return scrHomeSelector();
    case 'setup-guide':      return scrSetupGuide();
    case 'setup-processing': return scrSetupProcessing();
    case 'setup-editor':     return scrSetupEditor();
    case 'dashboard':        return scrDashboard();
    case 'browse':           return scrBrowse();
    case 'add-item':         return scrAddItem();
    case 'add-confirm':      return scrAddConfirm();
    case 'item-detail':      return scrItemDetail();
    case 'settings':         return scrSettings();
    default:                 return '<p style="padding:2rem">Unknown screen</p>';
  }
}

function buildModal() {
  if (!S.modal) return '';
  switch (S.modal.type) {
    case 'add-home':       return modalAddHome();
    case 'rename-home':    return modalRenameHome();
    case 'delete-home':    return modalDeleteHome();
    case 'delete-item':    return modalDeleteItem();
    case 'api-key-edit':   return modalApiKeyEdit();
    case 'tree-edit':      return modalTreeEdit();
    case 'tree-add':       return modalTreeAdd();
    case 'location-pick':  return modalLocationPick();
    case 'menu':           return modalMenu();
    case 'gh-setup':       return modalGHSetup();
    case 'move-item':      return modalMoveItem();
    default:               return '';
  }
}

function bindEvents() {
  const app = document.getElementById('app');

  app.addEventListener('click', handleClick);
  app.addEventListener('input', handleInput);
  app.addEventListener('change', handleChange);

  // Close modal on overlay click
  app.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target === el) closeModal();
    });
  });
}

// ─────────────────────────────────────────────
// Screens
// ─────────────────────────────────────────────
function scrLoading() {
  return `<div class="loading-overlay" style="min-height:100vh">
    <div class="spinner"></div>
    <p class="text-muted">Loading…</p>
  </div>`;
}

function scrApiKey() {
  return `<div class="api-key-screen safe-top safe-bottom">
    <div class="api-key-icon">🔑</div>
    <div>
      <h2>Claude API Key</h2>
      <p class="text-muted mt-sm">Casabanka uses Claude AI to analyse your home video and identify items. Your key is stored only on this device.</p>
    </div>
    <div style="width:100%">
      <label class="form-label">Anthropic API Key</label>
      <input id="apiKeyInput" class="form-input" type="password" placeholder="sk-ant-…" value="${esc(S.apiKey)}" autocomplete="off">
      <p class="text-sm text-muted mt-sm">Get yours at <strong>console.anthropic.com</strong></p>
    </div>
    <button class="btn btn-primary btn-full" data-action="save-api-key">Save &amp; Continue</button>
    <p class="text-sm text-muted" style="text-align:center">Your key never leaves your browser.</p>
  </div>`;
}

function scrHomeSelector() {
  const cards = S.homes.map(h => `
    <div class="home-card" data-action="enter-home" data-id="${h.id}">
      <div class="home-card-icon">🏠</div>
      <div class="home-card-name">${esc(h.name)}</div>
      ${h.setupDone ? '' : '<div class="setup-badge">Setup needed</div>'}
      <button class="home-card-menu btn-icon" data-action="home-menu" data-id="${h.id}" title="Options">⋯</button>
    </div>`).join('');

  return `
    <div class="header safe-top">
      <span class="header-title">My Homes</span>
      <button class="btn btn-ghost btn-sm" data-action="open-api-settings">⚙ API</button>
    </div>
    <div class="homes-grid">
      ${cards}
      <div class="home-card home-card-add" data-action="open-add-home">
        <div style="font-size:32px;color:var(--color-accent)">＋</div>
        <div class="home-card-name" style="color:var(--color-accent)">Add Home</div>
      </div>
    </div>
    ${S.homes.length === 0 ? `<div class="empty-state">
      <div class="empty-icon">🏡</div>
      <div class="empty-title">No homes yet</div>
      <div class="empty-text">Tap "Add Home" to get started.</div>
    </div>` : ''}

    ${buildDriveBar()}

    <div style="text-align:center;padding:4px 0 2px;font-size:11px;color:var(--txt3);letter-spacing:0.3px">${VERSION}</div>

    <div class="data-bar">
      <button class="data-btn" data-action="export-data">
        <span>⬆</span> Export backup
      </button>
      <label class="data-btn" for="importFile">
        <span>⬇</span> Import backup
      </label>
      <input id="importFile" type="file" accept=".json" style="display:none" data-action="import-file">
    </div>
  `;
}

function scrSetupGuide() {
  return `
    <div class="header safe-top">
      <span class="header-back" data-action="back-to-homes">‹ Homes</span>
      <span class="header-title">Set Up ${esc(S.home?.name || '')}</span>
    </div>
    <div class="content safe-bottom">
      <div class="alert alert-info mb-md">
        <span class="alert-icon">📹</span>
        <div class="alert-content">
          <div class="alert-title">Film a walkthrough video</div>
          <div class="alert-text">Walk through your home and film all storage areas. Claude AI will generate the room layout automatically.</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Filming Tips</div>
        <ul class="guide-steps">
          <li class="guide-step"><span class="guide-step-num">1</span><span class="guide-step-text">Walk slowly through each room.</span></li>
          <li class="guide-step"><span class="guide-step-num">2</span><span class="guide-step-text">Say the room name out loud as you enter — <em>"This is the Master Bedroom."</em></span></li>
          <li class="guide-step"><span class="guide-step-num">3</span><span class="guide-step-text">Open all wardrobes, cabinets, and drawers, pointing the camera inside.</span></li>
          <li class="guide-step"><span class="guide-step-num">4</span><span class="guide-step-text">Name storage spots out loud — <em>"Top shelf,"</em> <em>"Left drawer."</em></span></li>
          <li class="guide-step"><span class="guide-step-num">5</span><span class="guide-step-text">Aim for 3–5 minutes total. Longer is fine.</span></li>
        </ul>
      </div>

      <div class="section">
        <div class="section-title">Upload Your Video</div>
        <label class="photo-upload" for="videoFile" style="display:flex;flex-direction:column;align-items:center;gap:8px">
          <div class="photo-upload-icon">🎬</div>
          <div class="photo-upload-text">Tap to select video</div>
          <div class="photo-upload-hint">MP4, MOV, or any common mobile format</div>
        </label>
        <input id="videoFile" type="file" accept="video/*" style="display:none" data-action="video-selected">
      </div>

      <p class="text-sm text-muted text-center mt-md">You can redo this setup later from Home Settings.</p>
    </div>`;
}

function scrSetupProcessing() {
  return `
    <div class="header safe-top">
      <span class="header-title">Analysing Your Home</span>
    </div>
    <div class="content safe-bottom" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:var(--spacing-lg);text-align:center">
      <div style="font-size:64px">${S._procStage === 'ai' ? '🧠' : '🎬'}</div>
      <div>
        <h2>${S._procStage === 'ai' ? 'Claude is mapping your home' : 'Extracting video frames'}</h2>
        <p class="text-muted mt-sm">${S._procMsg || 'Please wait…'}</p>
      </div>
      <div class="progress-container" style="width:100%;max-width:360px">
        <div class="progress-bar-wrap">
          <div class="progress-bar" id="procBar" style="width:${Math.round((S._procPct || 0) * 100)}%"></div>
        </div>
        <div class="progress-label" id="procLabel">${Math.round((S._procPct || 0) * 100)}%</div>
      </div>
    </div>`;
}

function scrSetupEditor() {
  const layout = S.editingLayout || S.draftLayout || { rooms: [] };
  const cancelAction = S.layoutEditSource === 'settings' ? 'go-settings' : 'back-to-homes';
  const cancelLabel = S.layoutEditSource === 'settings' ? '‹ Settings' : '✕ Cancel';
  return `
    <div class="header safe-top">
      <span class="header-back" data-action="${cancelAction}">${cancelLabel}</span>
      <span class="header-title">${S.layoutEditSource === 'settings' ? 'Edit Layout' : 'Review Layout'}</span>
      <button class="btn btn-primary btn-sm" data-action="confirm-layout">Save</button>
    </div>
    <div class="content safe-bottom">
      <div class="alert alert-info mb-md">
        <span class="alert-icon">✏️</span>
        <div class="alert-content">
          <div class="alert-title">AI-generated layout</div>
          <div class="alert-text">Review and edit the rooms, areas, and spots below. Add anything that was missed.</div>
        </div>
      </div>

      <div class="tree-editor" id="treeEditor">
        ${renderTree(layout)}
      </div>

      <button class="btn btn-ghost mt-md" data-action="tree-add-room" style="margin-left:0">＋ Add Room</button>

      <div style="height:80px"></div>
    </div>`;
}

function renderTree(layout) {
  return (layout.rooms || []).map(room => `
    <div class="tree-room" data-room-id="${room.id}">
      <div class="tree-room-header">
        <span style="font-size:18px">🚪</span>
        <span class="tree-room-name">${esc(room.name)}</span>
        <button class="tree-edit-btn" data-action="tree-edit" data-type="room" data-id="${room.id}" title="Rename">✎</button>
        <button class="tree-edit-btn delete" data-action="tree-delete" data-type="room" data-id="${room.id}" title="Delete">🗑</button>
      </div>
      <div class="tree-areas">
        ${(room.areas || []).map(area => `
          <div class="tree-area" data-area-id="${area.id}">
            <div class="tree-area-header">
              <span style="font-size:16px">🗄</span>
              <span class="tree-area-name">${esc(area.name)}</span>
              <button class="tree-edit-btn" data-action="tree-edit" data-type="area" data-id="${area.id}" data-room="${room.id}" title="Rename">✎</button>
              <button class="tree-edit-btn delete" data-action="tree-delete" data-type="area" data-id="${area.id}" data-room="${room.id}" title="Delete">🗑</button>
            </div>
            <div class="tree-spots">
              ${(area.spots || []).map(spot => `
                <div class="tree-spot" data-spot-id="${spot.id}">
                  <span style="font-size:14px">📍</span>
                  <span class="tree-spot-name">${esc(spot.name)}</span>
                  <button class="tree-edit-btn" data-action="tree-edit" data-type="spot" data-id="${spot.id}" data-area="${area.id}" data-room="${room.id}" title="Rename">✎</button>
                  <button class="tree-edit-btn delete" data-action="tree-delete" data-type="spot" data-id="${spot.id}" data-area="${area.id}" data-room="${room.id}" title="Delete">🗑</button>
                </div>`).join('')}
              <button class="tree-add-btn" data-action="tree-add" data-type="spot" data-area="${area.id}" data-room="${room.id}">＋ Add Spot</button>
            </div>
          </div>`).join('')}
        <button class="tree-add-btn" data-action="tree-add" data-type="area" data-room="${room.id}">＋ Add Area</button>
      </div>
    </div>`).join('');
}

function scrDashboard() {
  const items = S.results.length > 0 || S.query ? S.results : null;
  const hasResults = items !== null;
  const isEmpty = !S.query && (!S.items || S.items.length === 0);

  let mainContent;
  if (S.query && S.results.length === 0) {
    mainContent = `<div class="empty-state">
      <div class="empty-icon">🔍</div>
      <div class="empty-title">No results</div>
      <div class="empty-text">Try a different search term.</div>
    </div>`;
  } else if (hasResults) {
    mainContent = `<div class="content"><div class="item-list">${S.results.map(itemCard).join('')}</div></div>`;
  } else if (isEmpty) {
    mainContent = `<div class="empty-state">
      <div class="empty-icon">📦</div>
      <div class="empty-title">No items yet</div>
      <div class="empty-text">Tap + to log your first item.</div>
    </div>`;
  } else {
    mainContent = `<div class="content"><div class="item-list">${(S.items || []).slice(0, 50).map(itemCard).join('')}</div></div>`;
  }

  return `
    <div class="header safe-top">
      <span class="header-back" data-action="back-to-homes">‹ Homes</span>
      <span class="header-title">${esc(S.home?.name || '')}</span>
      <button class="btn btn-ghost btn-sm" data-action="go-settings">⚙</button>
    </div>
    <div class="search-container">
      <div class="search-input-wrap">
        <span class="search-icon">🔍</span>
        <input class="search-input" id="searchBox" placeholder="Search anything…" value="${esc(S.query)}" autocomplete="off">
        ${S.query ? `<button style="background:none;border:none;color:var(--color-text2);cursor:pointer;padding:4px;font-size:18px" data-action="clear-search">✕</button>` : ''}
      </div>
      ${S.query ? `<div id="searchAiIndicator" class="search-ai-indicator">${S.searchAi ? '✦ AI results' : ''}</div>` : ''}
    </div>
    ${!S.query ? `<div class="action-row">
      <button class="action-btn" data-action="go-browse">
        <span class="action-btn-icon">🗂</span>
        <span class="action-btn-label">Browse</span>
      </button>
      <button class="action-btn" data-action="go-add-item">
        <span class="action-btn-icon">📷</span>
        <span class="action-btn-label">Add Item</span>
      </button>
    </div>` : ''}
    ${mainContent}
    <button class="fab" data-action="go-add-item" title="Add item">＋</button>`;
}

function itemCard(item) {
  const loc = formatLoc(item);
  return `<div class="item-card" data-action="view-item" data-id="${item.id}">
    ${item.photoData
      ? `<img class="item-photo" src="${item.photoData}" alt="${esc(item.name)}" loading="lazy">`
      : `<div class="item-photo-placeholder">📦</div>`}
    <div class="item-info">
      <div class="item-name">${esc(item.name || 'Unnamed item')}</div>
      ${item.purpose ? `<div class="item-purpose">${esc(item.purpose)}</div>` : ''}
      ${loc ? `<div class="item-location">📍 ${esc(loc)}</div>` : ''}
    </div>
  </div>`;
}

function scrBrowse() {
  const path = S.browsePath;
  const layout = S.layout || { rooms: [] };
  const items = S.items || [];

  // Build breadcrumb
  const breadcrumb = buildBreadcrumb(path);

  let listContent;

  if (path.length === 0) {
    // Show rooms
    const rows = layout.rooms.map(room => {
      const count = items.filter(it => it.roomId === room.id).length;
      return `<div class="list-item" data-action="browse-into" data-level="room" data-id="${room.id}" data-name="${esc(room.name)}">
        <span class="list-item-icon">🚪</span>
        <span class="list-item-label">${esc(room.name)}</span>
        <span class="list-item-count">${count} item${count !== 1 ? 's' : ''}</span>
        <span class="list-item-arrow">›</span>
      </div>`;
    }).join('');
    listContent = `<div class="list">${rows || emptyRow('No rooms in layout')}</div>`;

  } else if (path.length === 1) {
    // Show areas in room
    const room = layout.rooms.find(r => r.id === path[0].id);
    if (!room) { listContent = emptyRow('Room not found'); }
    else {
      const rows = (room.areas || []).map(area => {
        const count = items.filter(it => it.areaId === area.id).length;
        return `<div class="list-item" data-action="browse-into" data-level="area" data-id="${area.id}" data-name="${esc(area.name)}">
          <span class="list-item-icon">🗄</span>
          <span class="list-item-label">${esc(area.name)}</span>
          <span class="list-item-count">${count} item${count !== 1 ? 's' : ''}</span>
          <span class="list-item-arrow">›</span>
        </div>`;
      }).join('');
      listContent = `<div class="list">${rows || emptyRow('No areas in this room')}</div>`;
    }

  } else if (path.length === 2) {
    // Show spots in area
    const room = layout.rooms.find(r => r.id === path[0].id);
    const area = room?.areas?.find(a => a.id === path[1].id);
    if (!area) { listContent = emptyRow('Area not found'); }
    else {
      const rows = (area.spots || []).map(spot => {
        const count = items.filter(it => it.spotId === spot.id).length;
        return `<div class="list-item" data-action="browse-into" data-level="spot" data-id="${spot.id}" data-name="${esc(spot.name)}">
          <span class="list-item-icon">📍</span>
          <span class="list-item-label">${esc(spot.name)}</span>
          <span class="list-item-count">${count} item${count !== 1 ? 's' : ''}</span>
          <span class="list-item-arrow">›</span>
        </div>`;
      }).join('');
      listContent = `<div class="list">${rows || emptyRow('No spots in this area')}</div>`;
    }

  } else {
    // path.length === 3 → show items at this spot
    const spot = path[2];
    const spotItems = items.filter(it => it.spotId === spot.id);
    if (spotItems.length === 0) {
      listContent = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">Nothing stored here</div><div class="empty-text">Add an item with the + button.</div></div>`;
    } else {
      listContent = `<div class="item-list">${spotItems.map(itemCard).join('')}</div>`;
    }
  }

  return `
    <div class="header safe-top">
      ${path.length > 0
        ? `<span class="header-back" data-action="browse-back">‹ Back</span>`
        : `<span class="header-back" data-action="go-dashboard">‹ Home</span>`}
      <span class="header-title">${path.length > 0 ? esc(path[path.length - 1].name) : 'Browse'}</span>
    </div>
    ${path.length > 0 ? `<div style="padding:8px 16px 0;border-bottom:1px solid var(--color-border);background:white">${breadcrumb}</div>` : ''}
    <div class="content safe-bottom">${listContent}</div>
    <button class="fab" data-action="go-add-item" title="Add item">＋</button>`;
}

function buildBreadcrumb(path) {
  const parts = [{ name: 'Browse', action: 'browse-root' }, ...path];
  return `<div class="breadcrumb" style="padding-bottom:8px">` +
    parts.map((p, i) => {
      if (i === parts.length - 1) return `<span class="breadcrumb-item" style="color:var(--color-text)">${esc(p.name)}</span>`;
      if (i === 0) return `<span class="breadcrumb-item" data-action="browse-root">${esc(p.name)}</span><span class="breadcrumb-sep"> › </span>`;
      return `<span class="breadcrumb-item" data-action="browse-to" data-depth="${i}">${esc(p.name)}</span><span class="breadcrumb-sep"> › </span>`;
    }).join('') + `</div>`;
}

function buildDriveBar() {
  if (!S.ghEnabled) {
    return `<div class="drive-bar drive-bar--off">
      <span class="drive-bar-icon">🐙</span>
      <div class="drive-bar-info">
        <span class="drive-bar-title">GitHub sync</span>
        <span class="drive-bar-sub">Auto-save &amp; load across all devices</span>
      </div>
      <button class="btn btn-sm btn-secondary" data-action="open-gh-setup">Connect</button>
    </div>`;
  }

  const syncLabel = S.ghStatus === 'syncing' ? 'Saving…'
    : S.ghStatus === 'error' ? 'Sync failed — tap ↻ to retry'
    : S.ghLastSync ? 'Synced ' + timeAgo(S.ghLastSync)
    : 'Not yet synced';

  const dotClass = S.ghStatus === 'syncing' ? 'dot-pulse'
    : S.ghStatus === 'error' ? 'dot-error'
    : 'dot-ok';

  return `<div class="drive-bar drive-bar--on">
    <span class="drive-bar-icon">🐙</span>
    <div class="drive-bar-info">
      <span class="drive-bar-title"><span class="dot ${dotClass}"></span> GitHub · ${esc(S.ghRepo)}</span>
      <span class="drive-bar-sub">${syncLabel}</span>
    </div>
    <button class="btn btn-sm btn-ghost" data-action="sync-gh-now"
      ${S.ghStatus === 'syncing' ? 'disabled' : ''}>↻ Sync</button>
    <button class="btn btn-sm btn-ghost text-danger" data-action="disconnect-gh">✕</button>
  </div>`;
}

function emptyRow(msg) {
  return `<div class="list-item" style="color:var(--color-text2);cursor:default">${msg}</div>`;
}

function scrAddItem() {
  const photos = S.addPhotos || [];
  const MAX = 10;
  const canSubmit = photos.length > 0 || S.addDesc.trim();

  const thumbs = photos.map((p, i) => `
    <div class="photo-thumb-wrap">
      <img class="photo-thumb" src="${p}" alt="Photo ${i + 1}">
      <button class="photo-thumb-remove" data-action="remove-photo" data-index="${i}">✕</button>
    </div>`).join('');

  return `
    <div class="header safe-top">
      <span class="header-back" data-action="go-dashboard">✕ Cancel</span>
      <span class="header-title">Log Items</span>
    </div>
    <div class="content safe-bottom">

      <div class="section">
        <div class="section-title">Photos <span style="font-weight:400;text-transform:none;font-size:12px;color:var(--txt3)">${photos.length}/${MAX}</span></div>
        ${photos.length > 0 ? `<div class="photo-thumb-grid">${thumbs}</div>` : ''}
        ${photos.length < MAX ? `
          <label class="photo-upload ${photos.length > 0 ? 'photo-upload-compact' : ''}" for="itemPhoto" style="margin-top:${photos.length > 0 ? '10px' : '0'}">
            <div class="photo-upload-icon">${photos.length > 0 ? '➕' : '📷'}</div>
            <div class="photo-upload-text">${photos.length > 0 ? 'Add more photos' : 'Tap to add photos'}</div>
            ${photos.length === 0 ? `<div class="photo-upload-hint">Select multiple — one item per photo</div>` : ''}
          </label>
          <input id="itemPhoto" type="file" accept="image/*" multiple style="display:none" data-action="photo-selected">
        ` : `<p class="text-sm text-muted mt-sm text-center">Maximum ${MAX} photos reached</p>`}
      </div>

      <div class="section">
        <div class="section-title">Context <span style="font-weight:400;text-transform:none;font-size:12px;color:var(--txt3)">optional</span></div>
        <textarea id="itemDesc" class="form-textarea" rows="3"
          placeholder='Optional context for all photos, e.g. "all from the garage" or "tools stored in the shed"'>${esc(S.addDesc)}</textarea>
      </div>

      <div class="alert alert-info mb-md">
        <span class="alert-icon">🤖</span>
        <div class="alert-content">
          <div class="alert-title">AI analyses each photo separately</div>
          <div class="alert-text">Claude identifies the item in each photo and suggests its name, purpose, and location. You can edit everything before saving.</div>
        </div>
      </div>

      <button class="btn btn-primary btn-full" data-action="submit-add-item" ${!canSubmit ? 'disabled' : ''}>
        Analyse ${photos.length > 1 ? photos.length + ' photos' : 'with AI'} →
      </button>

      <div class="loading-overlay hidden" id="addItemLoading" style="position:fixed;inset:0;background:rgba(255,255,255,0.92);z-index:300">
        <div class="spinner"></div>
        <p id="addItemLoadingMsg">Claude is analysing your photos…</p>
      </div>
    </div>`;
}

function scrAddConfirm() {
  const drafts = S.addDrafts || [];
  const edits  = S.addDraftEdits || [];
  const opts   = buildLocationOptions();
  const active = drafts.filter((_, i) => edits[i]?.removed !== true);

  const cards = drafts.map((d, i) => {
    if (edits[i]?.removed) return '';
    const e = edits[i] || {};
    const val = f => e[f] !== undefined ? e[f] : (d[f] || '');

    return `
    <div class="multi-item-card" data-card-index="${i}">
      <div class="multi-item-card-header">
        ${S.addPhotos[i] ? `<img src="${S.addPhotos[i]}" class="multi-item-thumb" alt="Photo ${i+1}">` : `<div class="multi-item-thumb-placeholder">📦</div>`}
        <div class="multi-item-card-title">
          <span class="section-title" style="margin:0">Item ${i + 1}</span>
          ${d.locationConfident === false ? `<span class="badge-warn">⚠ Location unmatched</span>` : ''}
        </div>
        <button class="btn btn-ghost btn-sm text-danger" data-action="remove-draft-item" data-index="${i}" title="Remove">✕</button>
      </div>

      <div class="form-group">
        <label class="form-label">Item Name *</label>
        <input class="form-input" data-ci="${i}" data-cf="name" value="${esc(val('name'))}" placeholder="Item name">
      </div>
      <div class="form-group">
        <label class="form-label">Purpose</label>
        <textarea class="form-textarea" rows="2" data-ci="${i}" data-cf="purpose" placeholder="What it's for…">${esc(val('purpose'))}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Room</label>
        <select class="form-select" data-ci="${i}" data-cf="roomSel">
          <option value="">— not specified —</option>
          ${opts.rooms.map(r => `<option value="${esc(r.id)}|${esc(r.name)}" ${(e.roomId||d.roomId)===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Area</label>
        <select class="form-select" data-ci="${i}" data-cf="areaSel">
          <option value="">— not specified —</option>
          ${opts.areas.map(a => `<option value="${esc(a.roomId)}|${esc(a.id)}|${esc(a.name)}" ${(e.areaId||d.areaId)===a.id?'selected':''}>${esc(a.roomName)} › ${esc(a.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Spot</label>
        <select class="form-select" data-ci="${i}" data-cf="spotSel">
          <option value="">— not specified —</option>
          ${opts.spots.map(s => `<option value="${esc(s.areaId)}|${esc(s.id)}|${esc(s.name)}" ${(e.spotId||d.spotId)===s.id?'selected':''}>${esc(s.roomName)} › ${esc(s.areaName)} › ${esc(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <input class="form-input" data-ci="${i}" data-cf="notes" value="${esc(val('notes'))}" placeholder="Optional notes…">
      </div>
    </div>`;
  }).join('');

  return `
    <div class="header safe-top">
      <span class="header-back" data-action="back-to-add-item">‹ Edit</span>
      <span class="header-title">Review ${active.length} Item${active.length !== 1 ? 's' : ''}</span>
    </div>
    <div class="content safe-bottom">
      ${cards}
      <button class="btn btn-primary btn-full mt-md" data-action="save-all-items">
        Save ${active.length} Item${active.length !== 1 ? 's' : ''} →
      </button>
      <div style="height:20px"></div>
    </div>`;
}

function buildLocationOptions() {
  const layout = S.layout || { rooms: [] };
  const rooms = layout.rooms || [];
  const areas = [];
  const spots = [];
  rooms.forEach(r => {
    (r.areas || []).forEach(a => {
      areas.push({ ...a, roomId: r.id, roomName: r.name });
      (a.spots || []).forEach(s => {
        spots.push({ ...s, areaId: a.id, areaName: a.name, roomId: r.id, roomName: r.name });
      });
    });
  });
  return { rooms, areas, spots };
}

function scrItemDetail() {
  const item = S.detailItem;
  if (!item) return scrDashboard();
  const loc = formatLoc(item);
  return `
    <div class="header safe-top">
      <span class="header-back" data-action="go-dashboard">‹ Back</span>
      <span class="header-title">Item Details</span>
      <button class="btn btn-ghost btn-sm text-danger" data-action="open-delete-item" data-id="${item.id}">Delete</button>
    </div>
    <div class="content safe-bottom">
      ${item.photoData ? `<img src="${item.photoData}" style="width:100%;max-height:300px;object-fit:cover;border-radius:var(--r-lg);margin-bottom:var(--sp-md)" alt="${esc(item.name)}">` : ''}

      <h2 style="margin-bottom:var(--sp-sm)">${esc(item.name || 'Unnamed')}</h2>
      ${item.purpose ? `<p class="text-muted" style="margin-bottom:var(--sp-md)">${esc(item.purpose)}</p>` : ''}

      <div class="alert ${loc ? 'alert-info' : 'alert-warning'} mb-md">
        <span class="alert-icon">📍</span>
        <div class="alert-content">
          <div class="alert-title">Storage Location</div>
          <div class="alert-text">${loc ? esc(loc) : 'No location set'}</div>
        </div>
        <button class="btn btn-sm btn-secondary" data-action="open-move-item" data-id="${item.id}">Move</button>
      </div>

      ${item.notes ? `<div class="card mb-md">
        <div class="section-title" style="margin-bottom:4px">Notes</div>
        <p>${esc(item.notes)}</p>
      </div>` : ''}

      <p class="text-sm text-muted text-center">Added ${formatDate(item.createdAt)}</p>
    </div>`;
}

function scrSettings() {
  return `
    <div class="header safe-top">
      <span class="header-back" data-action="go-dashboard">‹ Back</span>
      <span class="header-title">${esc(S.home?.name || '')} Settings</span>
    </div>
    <div class="content safe-bottom">
      <div class="section">
        <div class="section-title">Home</div>
        <div class="settings-list">
          <div class="settings-item" data-action="open-rename-home">
            <div class="settings-item-icon" style="background:#e8f4fd">✏️</div>
            <div class="settings-item-label">Rename Home</div>
            <div class="settings-item-arrow">›</div>
          </div>
          <div class="settings-item" data-action="edit-layout">
            <div class="settings-item-icon" style="background:#eef4ff">🗂</div>
            <div class="settings-item-label">Edit Layout</div>
            <div class="settings-item-value">Rooms, areas &amp; spots</div>
            <div class="settings-item-arrow">›</div>
          </div>
          <div class="settings-item" data-action="redo-setup">
            <div class="settings-item-icon" style="background:#fef3e2">🎬</div>
            <div class="settings-item-label">Redo Video Setup</div>
            <div class="settings-item-value">Rebuilds layout from video</div>
            <div class="settings-item-arrow">›</div>
          </div>
          <div class="settings-item" data-action="open-delete-home" style="color:var(--color-danger)">
            <div class="settings-item-icon" style="background:#fde8e8">🗑</div>
            <div class="settings-item-label" style="color:var(--color-danger)">Delete This Home</div>
            <div class="settings-item-arrow">›</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">API</div>
        <div class="settings-list">
          <div class="settings-item" data-action="open-api-settings">
            <div class="settings-item-icon" style="background:#f0f4ff">🔑</div>
            <div class="settings-item-label">Claude API Key</div>
            <div class="settings-item-value">${S.apiKey ? '••••••' + S.apiKey.slice(-4) : 'Not set'}</div>
            <div class="settings-item-arrow">›</div>
          </div>
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────
// Modals
// ─────────────────────────────────────────────
function modalAddHome() {
  return `<div class="modal-overlay">
    <div class="modal">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <span class="modal-title">New Home</span>
        <button class="modal-close" data-action="close-modal">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Home Name</label>
          <input class="form-input" id="newHomeName" placeholder="e.g. Main House, Apartment, Cabin…" autofocus>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary flex-1" data-action="close-modal">Cancel</button>
        <button class="btn btn-primary flex-1" data-action="confirm-add-home">Add Home</button>
      </div>
    </div>
  </div>`;
}

function modalRenameHome() {
  const home = S.homes.find(h => h.id === S.modal?.homeId) || S.home;
  return `<div class="modal-overlay">
    <div class="modal">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <span class="modal-title">Rename Home</span>
        <button class="modal-close" data-action="close-modal">✕</button>
      </div>
      <div class="modal-body">
        <input class="form-input" id="renameHomeInput" value="${esc(home?.name || '')}" autofocus>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary flex-1" data-action="close-modal">Cancel</button>
        <button class="btn btn-primary flex-1" data-action="confirm-rename-home" data-id="${home?.id}">Save</button>
      </div>
    </div>
  </div>`;
}

function modalDeleteHome() {
  const home = S.homes.find(h => h.id === S.modal?.homeId) || S.home;
  return `<div class="modal-overlay center">
    <div class="modal center-modal" style="max-width:340px">
      <div class="modal-header">
        <span class="modal-title">Delete Home?</span>
      </div>
      <div class="modal-body">
        <p>This will permanently delete <strong>${esc(home?.name || 'this home')}</strong> and all its items. This cannot be undone.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary flex-1" data-action="close-modal">Cancel</button>
        <button class="btn btn-danger flex-1" data-action="confirm-delete-home" data-id="${home?.id}">Delete</button>
      </div>
    </div>
  </div>`;
}

function modalDeleteItem() {
  return `<div class="modal-overlay center">
    <div class="modal center-modal" style="max-width:340px">
      <div class="modal-header"><span class="modal-title">Delete Item?</span></div>
      <div class="modal-body"><p>This item will be permanently deleted.</p></div>
      <div class="modal-footer">
        <button class="btn btn-secondary flex-1" data-action="close-modal">Cancel</button>
        <button class="btn btn-danger flex-1" data-action="confirm-delete-item" data-id="${S.modal?.itemId}">Delete</button>
      </div>
    </div>
  </div>`;
}

function modalApiKeyEdit() {
  return `<div class="modal-overlay">
    <div class="modal">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <span class="modal-title">Claude API Key</span>
        <button class="modal-close" data-action="close-modal">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <input class="form-input" id="apiKeyModalInput" type="password" value="${esc(S.apiKey)}" placeholder="sk-ant-…" autocomplete="off">
          <p class="text-sm text-muted mt-sm">Your key is stored only in your browser's local storage. Get one at <strong>console.anthropic.com</strong></p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary flex-1" data-action="close-modal">Cancel</button>
        <button class="btn btn-primary flex-1" data-action="save-api-key-modal">Save</button>
      </div>
    </div>
  </div>`;
}

function modalTreeEdit() {
  const m = S.modal;
  return `<div class="modal-overlay">
    <div class="modal">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <span class="modal-title">Rename ${cap(m.nodeType)}</span>
        <button class="modal-close" data-action="close-modal">✕</button>
      </div>
      <div class="modal-body">
        <input class="form-input" id="treeEditInput" value="${esc(m.currentName)}" autofocus>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary flex-1" data-action="close-modal">Cancel</button>
        <button class="btn btn-primary flex-1" data-action="confirm-tree-edit"
          data-type="${m.nodeType}" data-id="${m.nodeId}"
          data-room="${m.roomId || ''}" data-area="${m.areaId || ''}">Save</button>
      </div>
    </div>
  </div>`;
}

function modalTreeAdd() {
  const m = S.modal;
  const label = m.nodeType === 'room' ? 'Room' : m.nodeType === 'area' ? 'Area' : 'Spot';
  return `<div class="modal-overlay">
    <div class="modal">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <span class="modal-title">Add ${label}</span>
        <button class="modal-close" data-action="close-modal">✕</button>
      </div>
      <div class="modal-body">
        <input class="form-input" id="treeAddInput" placeholder="${label} name…" autofocus>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary flex-1" data-action="close-modal">Cancel</button>
        <button class="btn btn-primary flex-1" data-action="confirm-tree-add"
          data-type="${m.nodeType}" data-room="${m.roomId || ''}" data-area="${m.areaId || ''}">Add</button>
      </div>
    </div>
  </div>`;
}

function modalLocationPick() {
  return '';  // handled inline in confirm screen via select dropdowns
}

function modalMoveItem() {
  const opts = buildLocationOptions();
  const loc = S.moveLocation;
  const working = S.moveAiWorking;

  return `<div class="modal-overlay">
    <div class="modal" style="max-height:92dvh;overflow-y:auto">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <span class="modal-title">Move Item</span>
        <button class="modal-close" data-action="close-modal">✕</button>
      </div>
      <div class="modal-body">

        <div class="section-title">✦ AI — describe the new location</div>
        <div style="display:flex;gap:var(--sp-sm);margin-bottom:var(--sp-md)">
          <input class="form-input" id="moveAiInput" placeholder='e.g. "on the top shelf in the garage" or "with the other tools"'
            value="${esc(S.moveAiDesc)}" style="flex:1">
          <button class="btn btn-primary" data-action="ai-interpret-location" ${working ? 'disabled' : ''} style="flex-shrink:0;white-space:nowrap">
            ${working ? '…' : '✦ Ask AI'}
          </button>
        </div>

        ${loc.roomName || loc.areaName || loc.spotName ? `
        <div class="alert alert-info mb-md">
          <span class="alert-icon">📍</span>
          <div class="alert-content">
            <div class="alert-title">AI suggested</div>
            <div class="alert-text">${esc([loc.roomName, loc.areaName, loc.spotName].filter(Boolean).join(' › '))}</div>
          </div>
        </div>` : ''}

        <div class="move-divider">or pick manually</div>

        <div class="form-group">
          <label class="form-label">Room</label>
          <select class="form-select" id="moveRoom" data-move-field="room">
            <option value="">— not specified —</option>
            ${opts.rooms.map(r => `<option value="${esc(r.id)}|${esc(r.name)}" ${loc.roomId === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Area</label>
          <select class="form-select" id="moveArea" data-move-field="area">
            <option value="">— not specified —</option>
            ${opts.areas
              .filter(a => !loc.roomId || a.roomId === loc.roomId)
              .map(a => `<option value="${esc(a.roomId)}|${esc(a.id)}|${esc(a.name)}" ${loc.areaId === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Spot</label>
          <select class="form-select" id="moveSpot" data-move-field="spot">
            <option value="">— not specified —</option>
            ${opts.spots
              .filter(s => !loc.areaId || s.areaId === loc.areaId)
              .map(s => `<option value="${esc(s.areaId)}|${esc(s.id)}|${esc(s.name)}" ${loc.spotId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
          </select>
        </div>

      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary flex-1" data-action="close-modal">Cancel</button>
        <button class="btn btn-primary flex-1" data-action="save-move-item">Save Location</button>
      </div>
    </div>
  </div>`;
}

function modalGHSetup() {
  return `<div class="modal-overlay">
    <div class="modal" style="max-height:90dvh;overflow-y:auto">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <span class="modal-title">Connect GitHub Sync</span>
        <button class="modal-close" data-action="close-modal">✕</button>
      </div>
      <div class="modal-body">
        <p class="text-muted text-sm" style="margin-bottom:var(--sp-md)">
          Your data will be saved as a JSON file in a private GitHub repository and loaded automatically on every device.
        </p>

        <div class="alert alert-info mb-md">
          <span class="alert-icon">🔒</span>
          <div class="alert-content">
            <div class="alert-title">Use a private repository</div>
            <div class="alert-text">Your inventory data (including photos) will be stored in this repo. Create a new <strong>private</strong> repo at github.com/new — name it anything, e.g. <code>casabanka-data</code>.</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">GitHub Personal Access Token</label>
          <input class="form-input" id="ghTokenInput" type="password"
            placeholder="ghp_…"
            value="${esc(S.ghToken)}" autocomplete="off">
          <p class="text-sm text-muted mt-sm">Needs <strong>repo</strong> scope. Create one at github.com → Settings → Developer settings → Personal access tokens.</p>
        </div>
        <div class="form-group">
          <label class="form-label">Repository name</label>
          <input class="form-input" id="ghRepoInput"
            placeholder="casabanka-data"
            value="${esc(S.ghRepo)}">
          <p class="text-sm text-muted mt-sm">Just the repo name, not the full URL. The repo must already exist.</p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary flex-1" data-action="close-modal">Cancel</button>
        <button class="btn btn-primary flex-1" data-action="confirm-gh-connect">Connect →</button>
      </div>
    </div>
  </div>`;
}

function modalMenu() {
  const m = S.modal;
  const home = S.homes.find(h => h.id === m.homeId);
  return `<div class="modal-overlay">
    <div class="modal">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <span class="modal-title">${esc(home?.name || '')}</span>
        <button class="modal-close" data-action="close-modal">✕</button>
      </div>
      <div class="modal-body" style="padding:0">
        <div class="list">
          <div class="list-item" data-action="rename-home-from-menu" data-id="${m.homeId}">
            <span class="list-item-icon">✏️</span>
            <span class="list-item-label">Rename</span>
          </div>
          <div class="list-item" style="color:var(--color-danger)" data-action="delete-home-from-menu" data-id="${m.homeId}">
            <span class="list-item-icon">🗑</span>
            <span class="list-item-label" style="color:var(--color-danger)">Delete</span>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// ─────────────────────────────────────────────
// Event Handling
// ─────────────────────────────────────────────
function handleClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  e.stopPropagation();
  const action = el.dataset.action;

  // Prevent double-tap on disabled
  if (el.disabled) return;

  switch (action) {
    // Navigation
    case 'back-to-homes':      exitHome(); break;
    case 'go-dashboard':       go('dashboard'); break;
    case 'go-browse':          go('browse', { browsePath: [] }); break;
    case 'go-add-item':        go('add-item', { addPhotos: [], addDesc: '', addDrafts: [], addDraftEdits: [] }); break;
    case 'go-settings':        go('settings'); break;

    // API key
    case 'save-api-key':       saveApiKey(); break;
    case 'open-api-settings':  openModal({ type: 'api-key-edit' }); break;
    case 'save-api-key-modal': saveApiKeyModal(); break;

    // Home selector
    case 'open-add-home':      openModal({ type: 'add-home' }); break;
    case 'confirm-add-home':   confirmAddHome(); break;
    case 'enter-home':         enterHome(el.dataset.id); break;
    case 'home-menu':          e.stopPropagation(); openModal({ type: 'menu', homeId: el.dataset.id }); break;
    case 'rename-home-from-menu': openModal({ type: 'rename-home', homeId: el.dataset.id }); break;
    case 'delete-home-from-menu': openModal({ type: 'delete-home', homeId: el.dataset.id }); break;
    case 'open-rename-home':   openModal({ type: 'rename-home', homeId: S.homeId }); break;
    case 'confirm-rename-home': confirmRenameHome(el.dataset.id); break;
    case 'open-delete-home':   openModal({ type: 'delete-home', homeId: S.homeId }); break;
    case 'confirm-delete-home': confirmDeleteHome(el.dataset.id); break;
    case 'edit-layout':        editLayout(); break;
    case 'redo-setup':         redoSetup(); break;

    // Setup flow
    case 'video-selected':     break; // handled by change event
    case 'confirm-layout':     confirmLayout(); break;

    // Tree editor
    case 'tree-edit':
      openModal({ type: 'tree-edit', nodeType: el.dataset.type, nodeId: el.dataset.id,
                  currentName: getNodeName(el.dataset.type, el.dataset.id),
                  roomId: el.dataset.room, areaId: el.dataset.area }); break;
    case 'tree-delete':        treeDelete(el.dataset.type, el.dataset.id, el.dataset.room, el.dataset.area); break;
    case 'tree-add':           openModal({ type: 'tree-add', nodeType: el.dataset.type, roomId: el.dataset.room, areaId: el.dataset.area }); break;
    case 'tree-add-room':      openModal({ type: 'tree-add', nodeType: 'room' }); break;
    case 'confirm-tree-edit':  confirmTreeEdit(el); break;
    case 'confirm-tree-add':   confirmTreeAdd(el); break;

    // Browse
    case 'browse-into':
      browseInto(el.dataset.level, el.dataset.id, el.dataset.name); break;
    case 'browse-back':        browseBack(); break;
    case 'browse-root':        go('browse', { browsePath: [] }); break;
    case 'browse-to':          browseTo(parseInt(el.dataset.depth)); break;

    // Add item
    case 'remove-photo':       S.addPhotos.splice(parseInt(el.dataset.index), 1); render(); break;
    case 'remove-draft-item':  removeDraftItem(parseInt(el.dataset.index)); break;
    case 'back-to-add-item':   go('add-item'); break;
    case 'submit-add-item':    submitAddItem(); break;
    case 'save-all-items':     saveAllItems(); break;

    // Item detail
    case 'view-item':          viewItem(el.dataset.id); break;
    case 'open-move-item':     openMoveItem(el.dataset.id); break;
    case 'ai-interpret-location': aiInterpretLocation(); break;
    case 'save-move-item':     saveMoveItem(); break;
    case 'open-delete-item':   openModal({ type: 'delete-item', itemId: el.dataset.id }); break;
    case 'confirm-delete-item': confirmDeleteItem(el.dataset.id); break;

    // Search
    case 'clear-search':       S.query = ''; S.results = []; render(); break;

    // Drive
    case 'open-gh-setup':        openModal({ type: 'gh-setup' }); break;
    case 'confirm-gh-connect':   confirmGHConnect(); break;
    case 'disconnect-gh':        disconnectGH(); break;
    case 'sync-gh-now':          syncToGH(); break;

    // Data
    case 'export-data':        exportData(); break;

    // Modal
    case 'close-modal':        closeModal(); break;
  }
}

function handleInput(e) {
  const el = e.target;
  if (el.id === 'searchBox') {
    S.query = el.value;
    doSearch(S.query);
    scheduleAiSearch(S.query);
  }
  // Multi-item confirm card edits
  if (S.screen === 'add-confirm' && el.dataset.ci !== undefined && el.dataset.cf) {
    const i = parseInt(el.dataset.ci);
    if (!S.addDraftEdits[i]) S.addDraftEdits[i] = {};
    S.addDraftEdits[i][el.dataset.cf] = el.value;
  }
  // Keep move AI input in sync
  if (el.id === 'moveAiInput') S.moveAiDesc = el.value;
}

function handleChange(e) {
  const el = e.target;
  if (el.dataset.action === 'video-selected' || el.id === 'videoFile') {
    const file = el.files[0];
    if (file) processVideo(file);
  }
  if (el.dataset.action === 'import-file' || el.id === 'importFile') {
    const file = el.files[0];
    if (file) importData(file);
  }
  if (el.dataset.action === 'photo-selected' || el.id === 'itemPhoto') {
    if (el.files?.length) handlePhotoSelected(el.files);
  }
  // Multi-item confirm card location selects
  if (S.screen === 'add-confirm' && el.dataset.ci !== undefined && el.dataset.cf) {
    const i = parseInt(el.dataset.ci);
    if (!S.addDraftEdits[i]) S.addDraftEdits[i] = {};
    const f = el.dataset.cf;
    if (f === 'roomSel' && el.value) {
      const [id, name] = el.value.split('|');
      S.addDraftEdits[i].roomId = id; S.addDraftEdits[i].roomName = name;
    }
    if (f === 'areaSel' && el.value) {
      const [rId, id, name] = el.value.split('|');
      S.addDraftEdits[i].areaId = id; S.addDraftEdits[i].areaName = name;
      if (!S.addDraftEdits[i].roomId) S.addDraftEdits[i].roomId = rId;
    }
    if (f === 'spotSel' && el.value) {
      const [aId, id, name] = el.value.split('|');
      S.addDraftEdits[i].spotId = id; S.addDraftEdits[i].spotName = name;
      if (!S.addDraftEdits[i].areaId) S.addDraftEdits[i].areaId = aId;
    }
  }
  // Move item manual dropdowns — re-render modal to cascade area/spot options
  if (el.id === 'moveRoom') {
    if (el.value) {
      const [id, name] = el.value.split('|');
      S.moveLocation = { roomId: id, roomName: name, areaId: '', areaName: '', spotId: '', spotName: '' };
    } else {
      S.moveLocation = { roomId: '', roomName: '', areaId: '', areaName: '', spotId: '', spotName: '' };
    }
    openModal({ type: 'move-item' });
  }
  if (el.id === 'moveArea') {
    if (el.value) {
      const [rId, id, name] = el.value.split('|');
      S.moveLocation = { ...S.moveLocation, roomId: rId, areaId: id, areaName: name, spotId: '', spotName: '' };
    } else {
      S.moveLocation = { ...S.moveLocation, areaId: '', areaName: '', spotId: '', spotName: '' };
    }
    openModal({ type: 'move-item' });
  }
  if (el.id === 'moveSpot') {
    if (el.value) {
      const [aId, id, name] = el.value.split('|');
      S.moveLocation = { ...S.moveLocation, areaId: aId, spotId: id, spotName: name };
    } else {
      S.moveLocation = { ...S.moveLocation, spotId: '', spotName: '' };
    }
  }
}

// ─────────────────────────────────────────────
// Business Logic
// ─────────────────────────────────────────────
async function init() {
  await DB.open();
  S.apiKey = localStorage.getItem('cb_api_key') || 'sk-W3iFOmFHkaXd63EewBuKyAaDmgQDrItDzH5I2DqvrY7NK6UM';

  const migrated = await DB.migrateFromOldDB();

  S.homes = await DB.getHomes();

  // Drive init runs after GIS script has had a chance to load
  setTimeout(initGHSync, 800);

  if (!S.apiKey) {
    go('api-key');
  } else {
    go('home-selector');
  }

  if (migrated) {
    setTimeout(() => showToast(`Migrated ${migrated.homes} home(s) · ${migrated.items} item(s) ✓`), 300);
  }
}

function saveApiKey() {
  const val = document.getElementById('apiKeyInput')?.value?.trim();
  if (!val) return alert('Please enter your API key.');
  localStorage.setItem('cb_api_key', val);
  S.apiKey = val;
  go('home-selector');
}

function saveApiKeyModal() {
  const val = document.getElementById('apiKeyModalInput')?.value?.trim();
  if (!val) return alert('Please enter a key.');
  localStorage.setItem('cb_api_key', val);
  S.apiKey = val;
  closeModal();
  showToast('API key saved');
}

async function enterHome(id) {
  const home = await DB.getHome(id);
  if (!home) return;
  const layoutRec = await DB.getLayout(id);
  const items = await DB.getItemsByHome(id);
  S.homeId = id;
  S.home = home;
  S.layout = layoutRec?.data || null;
  S.items = items;
  S.query = '';
  S.results = [];

  if (!home.setupDone) {
    go('setup-guide');
  } else {
    go('dashboard');
  }
}

function exitHome() {
  S.homeId = null;
  S.home = null;
  S.layout = null;
  S.items = [];
  go('home-selector');
}

async function confirmAddHome() {
  const name = document.getElementById('newHomeName')?.value?.trim();
  if (!name) return alert('Please enter a name.');
  const home = {
    id: uid(),
    name,
    createdAt: Date.now(),
    setupDone: false,
  };
  await DB.saveHome(home);
  S.homes = await DB.getHomes();
  closeModal();
  scheduleDriveSync();
  await enterHome(home.id);
}

async function confirmRenameHome(id) {
  const name = document.getElementById('renameHomeInput')?.value?.trim();
  if (!name) return alert('Please enter a name.');
  const home = await DB.getHome(id);
  home.name = name;
  await DB.saveHome(home);
  S.homes = await DB.getHomes();
  if (S.homeId === id) S.home = home;
  closeModal();
  scheduleDriveSync();
  render();
}

async function confirmDeleteHome(id) {
  await DB.deleteHome(id);
  S.homes = await DB.getHomes();
  closeModal();
  scheduleDriveSync();
  if (S.homeId === id) {
    S.homeId = null; S.home = null; S.layout = null; S.items = [];
  }
  go('home-selector');
}

function editLayout() {
  S.editingLayout = deepClone(S.layout || { rooms: [] });
  S.layoutEditSource = 'settings';
  go('setup-editor');
}

function redoSetup() {
  S.layoutEditSource = 'setup';
  go('setup-guide');
}

// ── Video processing ──
async function processVideo(file) {
  if (!S.apiKey) { openModal({ type: 'api-key-edit' }); return; }

  go('setup-processing', { _procPct: 0, _procStage: 'video', _procMsg: 'Initialising…' });

  try {
    const frames = await Video.extractFrames(file, (pct, msg) => {
      S._procPct = pct * 0.6; // video = 0–60%
      S._procMsg = msg;
      S._procStage = 'video';
      updateProcessingUI();
    });

    S.setupFrames = frames;
    S._procPct = 0.62;
    S._procStage = 'ai';
    S._procMsg = 'Sending frames to Claude…';
    updateProcessingUI();

    const layout = await AI.analyzeLayout(frames, S.apiKey);

    S.draftLayout = layout;
    S.editingLayout = deepClone(layout);
    S.layoutEditSource = 'setup';
    go('setup-editor');
  } catch (err) {
    alert('Error processing video: ' + err.message);
    go('setup-guide');
  }
}

function updateProcessingUI() {
  const bar = document.getElementById('procBar');
  const label = document.getElementById('procLabel');
  if (bar) bar.style.width = Math.round(S._procPct * 100) + '%';
  if (label) label.textContent = Math.round(S._procPct * 100) + '%';
  const msgEl = document.querySelector('#app p.text-muted');
  if (msgEl) msgEl.textContent = S._procMsg || '';
}

async function confirmLayout() {
  const layout = S.editingLayout;
  if (!layout || !layout.rooms?.length) {
    alert('Please add at least one room before saving.');
    return;
  }
  await DB.saveLayout(S.homeId, layout);
  S.home.setupDone = true;
  await DB.saveHome(S.home);
  S.layout = layout;
  S.homes = await DB.getHomes();
  scheduleDriveSync();
  go(S.layoutEditSource === 'settings' ? 'settings' : 'dashboard');
  showToast('Layout saved!');
}

// ── Tree editing ──
function getNodeName(type, id) {
  const l = S.editingLayout || { rooms: [] };
  if (type === 'room') return l.rooms.find(r => r.id === id)?.name || '';
  if (type === 'area') {
    for (const r of l.rooms) {
      const a = r.areas?.find(a => a.id === id);
      if (a) return a.name;
    }
  }
  if (type === 'spot') {
    for (const r of l.rooms) {
      for (const a of r.areas || []) {
        const s = a.spots?.find(s => s.id === id);
        if (s) return s.name;
      }
    }
  }
  return '';
}

function confirmTreeEdit(btn) {
  const name = document.getElementById('treeEditInput')?.value?.trim();
  if (!name) return alert('Please enter a name.');
  const type = btn.dataset.type;
  const id = btn.dataset.id;
  const l = S.editingLayout;

  if (type === 'room') {
    l.rooms.find(r => r.id === id).name = name;
  } else if (type === 'area') {
    for (const r of l.rooms) {
      const a = r.areas?.find(a => a.id === id);
      if (a) { a.name = name; break; }
    }
  } else {
    for (const r of l.rooms) {
      for (const a of r.areas || []) {
        const s = a.spots?.find(s => s.id === id);
        if (s) { s.name = name; break; }
      }
    }
  }
  closeModal();
  refreshTree();
}

function confirmTreeAdd(btn) {
  const name = document.getElementById('treeAddInput')?.value?.trim();
  if (!name) return alert('Please enter a name.');
  const type = btn.dataset.type;
  const roomId = btn.dataset.room;
  const areaId = btn.dataset.area;
  const l = S.editingLayout;
  const newId = uid();

  if (type === 'room') {
    l.rooms.push({ id: newId, name, areas: [] });
  } else if (type === 'area') {
    const room = l.rooms.find(r => r.id === roomId);
    if (room) { if (!room.areas) room.areas = []; room.areas.push({ id: newId, name, spots: [] }); }
  } else {
    for (const r of l.rooms) {
      if (r.id !== roomId) continue;
      const area = r.areas?.find(a => a.id === areaId);
      if (area) { if (!area.spots) area.spots = []; area.spots.push({ id: newId, name }); break; }
    }
  }
  closeModal();
  refreshTree();
}

function treeDelete(type, id, roomId, areaId) {
  const l = S.editingLayout;
  if (type === 'room') {
    if (!confirm('Delete this room and all its areas and spots?')) return;
    l.rooms = l.rooms.filter(r => r.id !== id);
  } else if (type === 'area') {
    const room = l.rooms.find(r => r.id === roomId);
    if (room) room.areas = (room.areas || []).filter(a => a.id !== id);
  } else {
    for (const r of l.rooms) {
      if (r.id !== roomId) continue;
      const area = r.areas?.find(a => a.id === areaId);
      if (area) { area.spots = (area.spots || []).filter(s => s.id !== id); break; }
    }
  }
  refreshTree();
}

function refreshTree() {
  const el = document.getElementById('treeEditor');
  if (el) el.innerHTML = renderTree(S.editingLayout);
}

// ── Add item ──
async function handlePhotoSelected(files) {
  const fileList = files instanceof FileList ? Array.from(files) : [files];
  const MAX = 10;
  const remaining = MAX - (S.addPhotos || []).length;
  const toProcess = fileList.slice(0, remaining);
  for (const f of toProcess) {
    const compressed = await compressImage(f);
    if (compressed) S.addPhotos.push(compressed);
  }
  render();
}

async function submitAddItem() {
  const photos = S.addPhotos || [];
  const desc = document.getElementById('itemDesc')?.value || S.addDesc;
  S.addDesc = desc;
  if (!photos.length && !desc.trim()) return;
  if (!S.apiKey) { openModal({ type: 'api-key-edit' }); return; }

  const loading = document.getElementById('addItemLoading');
  const msgEl   = document.getElementById('addItemLoadingMsg');
  if (loading) loading.classList.remove('hidden');
  if (msgEl) msgEl.textContent = `Claude is analysing ${photos.length || 1} photo${photos.length !== 1 ? 's' : ''}…`;

  try {
    const layout = S.layout || { rooms: [] };
    let drafts;

    if (photos.length > 1) {
      drafts = await AI.parseMultipleItems(photos, desc, layout, S.items, S.apiKey);
    } else if (photos.length === 1) {
      const single = await AI.parseItem(photos[0], desc, layout, S.items, S.apiKey);
      drafts = [{ ...single, photoIndex: 0 }];
    } else {
      const single = await AI.parseItem('', desc, layout, S.items, S.apiKey);
      drafts = [{ ...single, photoIndex: 0 }];
    }

    S.addDrafts     = drafts;
    S.addDraftEdits = drafts.map(() => ({}));
    go('add-confirm');
  } catch (err) {
    if (loading) loading.classList.add('hidden');
    alert('AI error: ' + err.message);
  }
}

function removeDraftItem(index) {
  if (!S.addDraftEdits[index]) S.addDraftEdits[index] = {};
  S.addDraftEdits[index].removed = true;
  render();
}

async function saveAllItems() {
  const drafts = S.addDrafts || [];
  const edits  = S.addDraftEdits || [];
  const toSave = [];

  // Collect current DOM values per card before processing
  document.querySelectorAll('.multi-item-card').forEach(card => {
    const i = parseInt(card.dataset.cardIndex);
    if (!S.addDraftEdits[i]) S.addDraftEdits[i] = {};
    card.querySelectorAll('[data-ci][data-cf]').forEach(el => {
      S.addDraftEdits[i][el.dataset.cf] = el.value;
    });
  });

  for (let i = 0; i < drafts.length; i++) {
    if (edits[i]?.removed) continue;
    const d = drafts[i] || {};
    const e = edits[i]  || {};
    const val = f => (e[f] !== undefined && e[f] !== '') ? e[f] : (d[f] || '');

    const name = val('name');
    if (!name.trim()) { alert(`Item ${i + 1} is missing a name. Please fill it in.`); return; }

    // Parse location from select values stored in edits
    let roomId = val('roomId'), roomName = val('roomName');
    let areaId = val('areaId'), areaName = val('areaName');
    let spotId = val('spotId'), spotName = val('spotName');

    if (e.roomSel) { const [id, nm] = e.roomSel.split('|'); roomId = id; roomName = nm; }
    if (e.areaSel) { const [rId, id, nm] = e.areaSel.split('|'); areaId = id; areaName = nm; if (!roomId) roomId = rId; }
    if (e.spotSel) { const [aId, id, nm] = e.spotSel.split('|'); spotId = id; spotName = nm; if (!areaId) areaId = aId; }

    toSave.push({
      id: uid(), homeId: S.homeId,
      name: name.trim(),
      purpose: val('purpose'),
      notes: val('notes'),
      roomId, roomName, areaId, areaName, spotId, spotName,
      photoData: S.addPhotos[i] || null,
      createdAt: Date.now() + i,
    });
  }

  if (!toSave.length) { go('dashboard'); return; }

  for (const item of toSave) await DB.saveItem(item);
  S.items       = await DB.getItemsByHome(S.homeId);
  S.addPhotos   = [];
  S.addDesc     = '';
  S.addDrafts   = [];
  S.addDraftEdits = [];
  scheduleDriveSync();
  go('dashboard');
  showToast(`Saved ${toSave.length} item${toSave.length !== 1 ? 's' : ''} ✓`);
}

async function viewItem(id) {
  const item = await DB.getItem(id);
  if (!item) return;
  S.detailItem = item;
  go('item-detail');
}

function openMoveItem(id) {
  S.moveItemId = id;
  S.moveAiDesc = '';
  S.moveAiWorking = false;
  // Pre-fill with current location
  const item = S.detailItem;
  S.moveLocation = {
    roomId: item?.roomId || '', roomName: item?.roomName || '',
    areaId: item?.areaId || '', areaName: item?.areaName || '',
    spotId: item?.spotId || '', spotName: item?.spotName || '',
  };
  openModal({ type: 'move-item' });
}

async function aiInterpretLocation() {
  const desc = document.getElementById('moveAiInput')?.value?.trim();
  if (!desc) { alert('Please describe the new location.'); return; }
  S.moveAiDesc = desc;
  S.moveAiWorking = true;
  openModal({ type: 'move-item' });
  try {
    const result = await AI.interpretLocation(desc, S.layout, S.items, S.apiKey);
    S.moveLocation = {
      roomId: result.roomId || '', roomName: result.roomName || '',
      areaId: result.areaId || '', areaName: result.areaName || '',
      spotId: result.spotId || '', spotName: result.spotName || '',
    };
    if (!result.confident) showToast('AI wasn\'t sure — please verify the location');
  } catch (err) {
    alert('AI error: ' + err.message);
  }
  S.moveAiWorking = false;
  openModal({ type: 'move-item' });
}

async function saveMoveItem() {
  // Read current select values from DOM before closing modal
  const roomSel = document.getElementById('moveRoom');
  const areaSel = document.getElementById('moveArea');
  const spotSel = document.getElementById('moveSpot');

  let loc = { ...S.moveLocation };
  if (roomSel?.value) { const [id, name] = roomSel.value.split('|'); loc.roomId = id; loc.roomName = name; }
  if (areaSel?.value) { const [rId, id, name] = areaSel.value.split('|'); loc.areaId = id; loc.areaName = name; if (!loc.roomId) loc.roomId = rId; }
  if (spotSel?.value) { const [aId, id, name] = spotSel.value.split('|'); loc.spotId = id; loc.spotName = name; if (!loc.areaId) loc.areaId = aId; }

  const item = await DB.getItem(S.moveItemId);
  if (!item) return;
  Object.assign(item, {
    roomId: loc.roomId, roomName: loc.roomName,
    areaId: loc.areaId, areaName: loc.areaName,
    spotId: loc.spotId, spotName: loc.spotName,
  });
  await DB.saveItem(item);
  S.items = await DB.getItemsByHome(S.homeId);
  S.detailItem = item;
  closeModal();
  scheduleDriveSync();
  go('item-detail');
  showToast('Location updated');
}

async function confirmDeleteItem(id) {
  await DB.deleteItem(id);
  S.items = await DB.getItemsByHome(S.homeId);
  closeModal();
  scheduleDriveSync();
  if (S.detailItem?.id === id) {
    go('dashboard');
  } else {
    render();
  }
  showToast('Item deleted');
}

// Instant local search — runs on every keystroke
function doSearch(query) {
  if (!S.homeId) return;
  if (!query.trim()) { S.results = []; S.searchAi = false; render(); return; }

  const q = query.toLowerCase();
  S.results = (S.items || []).filter(it =>
    (it.name || '').toLowerCase().includes(q) ||
    (it.purpose || '').toLowerCase().includes(q) ||
    (it.notes || '').toLowerCase().includes(q) ||
    (it.roomName || '').toLowerCase().includes(q) ||
    (it.areaName || '').toLowerCase().includes(q) ||
    (it.spotName || '').toLowerCase().includes(q)
  );
  S.searchAi = false;
  updateSearchResults();
}

// AI search — fires 800ms after the user stops typing
let _aiSearchTimer = null;
function scheduleAiSearch(query) {
  clearTimeout(_aiSearchTimer);
  if (!query || query.trim().length < 2) return;
  _aiSearchTimer = setTimeout(() => runAiSearch(query), 800);
}

async function runAiSearch(query) {
  if (!S.homeId || !S.apiKey || !query.trim()) return;
  if (query !== S.query) return; // user already changed the query

  setSearchLoading(true);
  try {
    const matchedIds = await AI.searchItems(query, S.items || [], S.apiKey);
    if (query !== S.query) return; // query changed while waiting

    // Re-order items by AI ranking, include all AI matches
    const idSet = new Set(matchedIds);
    const ordered = matchedIds
      .map(id => (S.items || []).find(it => it.id === id))
      .filter(Boolean);
    S.results = ordered;
    S.searchAi = true;
  } catch (_) {
    // AI failed silently — local results already showing
  }
  setSearchLoading(false);
  updateSearchResults();
}

function setSearchLoading(on) {
  const indicator = document.getElementById('searchAiIndicator');
  if (indicator) indicator.textContent = on ? '✦ AI thinking…' : (S.searchAi ? '✦ AI results' : '');
  if (indicator) indicator.style.opacity = on ? '0.5' : '1';
}

function updateSearchResults() {
  const app = document.getElementById('app');
  const existing = app.querySelector('.item-list') || app.querySelector('.empty-state');
  const indicator = document.getElementById('searchAiIndicator');
  if (indicator) indicator.textContent = S.searchAi ? '✦ AI results' : '';

  const html = S.results.length > 0
    ? `<div class="item-list">${S.results.map(itemCard).join('')}</div>`
    : `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">No results</div><div class="empty-text">Try rephrasing your search.</div></div>`;

  if (existing) {
    existing.outerHTML = html;
  } else {
    render();
  }
}

function browseInto(level, id, name) {
  S.browsePath = [...S.browsePath, { level, id, name }];
  go('browse');
}

function browseBack() {
  S.browsePath = S.browsePath.slice(0, -1);
  go('browse');
}

function browseTo(depth) {
  S.browsePath = S.browsePath.slice(0, depth);
  go('browse');
}

// ─────────────────────────────────────────────
// Modals helper
// ─────────────────────────────────────────────
function openModal(modalState) {
  S.modal = modalState;
  render();
  // Focus first input in modal
  setTimeout(() => {
    const input = document.querySelector('.modal input, .modal textarea');
    if (input) input.focus();
  }, 50);
}

function closeModal() {
  S.modal = null;
  render();
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cap(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function formatLoc(item) {
  const parts = [item.roomName, item.areaName, item.spotName].filter(Boolean);
  return parts.join(' › ');
}

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

async function compressImage(file) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 900;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

function timeAgo(isoString) {
  const secs = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (secs < 10)  return 'just now';
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function showToast(msg) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'toast';
  el.textContent = msg;
  el.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:#1c1c1e;color:#fff;padding:10px 20px;border-radius:99px;
    font-size:15px;font-weight:500;z-index:999;white-space:nowrap;
    animation:fadeIn 0.2s ease;pointer-events:none;
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// ─────────────────────────────────────────────
// GitHub sync
// ─────────────────────────────────────────────
let _syncTimer = null;

function scheduleDriveSync() {   // kept as name so all call-sites still work
  if (!S.ghEnabled) return;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(syncToGH, 10000);  // 10s debounce — each save = 1 commit
}

async function syncToGH() {
  if (!S.ghEnabled) return;
  setGHStatus('syncing');
  try {
    const payload = await buildExportPayload();
    const newSha = await GHSync.save(S.ghToken, S.ghOwner, S.ghRepo, payload, S.ghFileSha);
    S.ghFileSha  = newSha;
    S.ghLastSync = new Date().toISOString();
    localStorage.setItem('cb_gh_sha',       newSha  || '');
    localStorage.setItem('cb_gh_last_sync', S.ghLastSync);
    setGHStatus('idle');
  } catch (err) {
    console.error('GitHub sync error:', err.message);
    setGHStatus('error');
  }
}

async function loadFromGH() {
  const result = await GHSync.load(S.ghToken, S.ghOwner, S.ghRepo);
  if (!result) return false;
  const { content: payload, sha } = result;
  for (const home   of payload.homes   || []) await DB.saveHome(home);
  for (const layout of payload.layouts || []) await DB.saveLayout(layout.homeId, layout.data);
  for (const item   of payload.items   || []) await DB.saveItem(item);
  S.ghFileSha  = sha;
  S.ghLastSync = new Date().toISOString();
  localStorage.setItem('cb_gh_sha',       sha);
  localStorage.setItem('cb_gh_last_sync', S.ghLastSync);
  return true;
}

async function initGHSync() {
  if (!S.ghEnabled || !S.ghToken || !S.ghOwner) return;
  try {
    await loadFromGH();
    S.homes = await DB.getHomes();
    setGHStatus('idle');
    render();
  } catch (err) {
    console.warn('GitHub sync init error:', err.message);
    setGHStatus('error');
  }
}

async function confirmGHConnect() {
  const token = document.getElementById('ghTokenInput')?.value?.trim();
  const repo  = document.getElementById('ghRepoInput')?.value?.trim();
  if (!token) { alert('Please enter your GitHub token.'); return; }
  if (!repo)  { alert('Please enter a repository name.'); return; }

  closeModal();
  showToast('Connecting to GitHub…');

  try {
    const owner = await GHSync.getOwner(token);
    S.ghToken   = token;
    S.ghRepo    = repo;
    S.ghOwner   = owner;
    S.ghEnabled = true;
    S.ghFileSha = null;
    localStorage.setItem('cb_gh_token',   token);
    localStorage.setItem('cb_gh_repo',    repo);
    localStorage.setItem('cb_gh_owner',   owner);
    localStorage.setItem('cb_gh_enabled', 'true');
    localStorage.removeItem('cb_gh_sha');

    const hadData = await loadFromGH();
    S.homes = await DB.getHomes();
    if (!hadData) await syncToGH();   // push local data up on first connect
    go('home-selector');
    showToast(`GitHub connected · ${owner}/${repo} ✓`);
  } catch (err) {
    S.ghEnabled = false;
    alert('Could not connect: ' + err.message + '\n\nCheck your token has the "repo" scope and the repository exists.');
  }
}

function disconnectGH() {
  if (!confirm('Disconnect GitHub sync?\n\nYour local data stays intact.')) return;
  S.ghEnabled  = false;
  S.ghToken    = '';
  S.ghOwner    = '';
  S.ghFileSha  = null;
  S.ghLastSync = null;
  S.ghStatus   = 'idle';
  localStorage.setItem('cb_gh_enabled', 'false');
  localStorage.removeItem('cb_gh_last_sync');
  localStorage.removeItem('cb_gh_sha');
  render();
  showToast('GitHub sync disconnected');
}

function setGHStatus(status) {
  S.ghStatus = status;
  const bar = document.querySelector('.drive-bar');
  if (bar && S.ghEnabled) {
    const sub     = bar.querySelector('.drive-bar-sub');
    const dot     = bar.querySelector('.dot');
    const syncBtn = bar.querySelector('[data-action="sync-gh-now"]');
    if (sub) sub.textContent = status === 'syncing' ? 'Saving…'
      : status === 'error' ? 'Sync failed — tap ↻ to retry'
      : S.ghLastSync ? 'Synced ' + timeAgo(S.ghLastSync) : 'Synced';
    if (dot) dot.className = 'dot ' + (status === 'syncing' ? 'dot-pulse' : status === 'error' ? 'dot-error' : 'dot-ok');
    if (syncBtn) syncBtn.disabled = status === 'syncing';
  }
}

// ─────────────────────────────────────────────
// Export / Import
// ─────────────────────────────────────────────
async function buildExportPayload() {
  const homes = await DB.getHomes();
  const layouts = [], items = [];
  for (const home of homes) {
    const layout = await DB.getLayout(home.id);
    if (layout) layouts.push(layout);
    const homeItems = await DB.getItemsByHome(home.id);
    items.push(...homeItems);
  }
  return { version: 1, exportedAt: new Date().toISOString(), homes, layouts, items };
}

async function exportData() {
  try {
    const payload = await buildExportPayload();

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `casabanka-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${payload.homes.length} home(s), ${payload.items.length} item(s)`);
  } catch (err) {
    alert('Export failed: ' + err.message);
  }
}

async function importData(file) {
  try {
    const text = await file.text();
    const payload = JSON.parse(text);

    if (!payload.version || !Array.isArray(payload.homes)) {
      alert('This doesn\'t look like a valid Casabanka backup file.');
      return;
    }

    const homeCount = payload.homes?.length || 0;
    const itemCount = payload.items?.length || 0;

    const ok = confirm(
      `Import this backup?\n\n` +
      `• ${homeCount} home(s)\n` +
      `• ${itemCount} item(s)\n\n` +
      `Existing data is kept. Records with the same ID will be overwritten.`
    );
    if (!ok) return;

    for (const home of payload.homes || []) await DB.saveHome(home);
    for (const layout of payload.layouts || []) await DB.saveLayout(layout.homeId, layout.data);
    for (const item of payload.items || []) await DB.saveItem(item);

    S.homes = await DB.getHomes();
    go('home-selector');
    showToast(`Imported ${homeCount} home(s), ${itemCount} item(s)`);
  } catch (err) {
    alert('Import failed: ' + err.message);
  }
}

// ─────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
