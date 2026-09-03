/**
 * WebApp Karma - Espositori (WCAM 2.0)
 * Router SPA & Controller Principale (Deployable su Vercel)
 */

const AppRouter = (function() {
  let state = {
    currentView: 'Login',
    currentUser: '',
    selectedGroup: null,
    selectedShop: null,
    groups: [],
    shops: [],
    filteredShops: [],
    currentSort: 'name',
    exhibitors: [],
    stockItems: []
  };

  const views = {
    Login: document.getElementById('viewLogin'),
    Groups: document.getElementById('viewGroups'),
    Shops: document.getElementById('viewShops'),
    Exhibitors: document.getElementById('viewExhibitors')
  };

  const appHeader = document.getElementById('appHeader');
  const btnBack = document.getElementById('btnBackNav');
  const navBackText = document.getElementById('navBackText');
  const headerBrandTitle = document.getElementById('headerBrandTitle');
  const userAvatar = document.getElementById('userAvatarLetter');
  const userName = document.getElementById('userNameLabel');

  function init() {
    // Verifica se c'è un utente ricordato per comodità dell'agente
    const savedUser = localStorage.getItem('karma_remembered_username');
    if (savedUser) {
      const userInput = document.getElementById('inputUsername');
      if (userInput) userInput.value = savedUser;
      document.getElementById('checkRemember').checked = true;
    }

    // Prova a verificare se la sessione verso il server è già attiva
    checkExistingSession();
  }

  async function checkExistingSession() {
    try {
      const res = await KarmaAPI.getGroups();
      if (res.authenticated && res.groups.length > 0) {
        state.currentUser = localStorage.getItem('karma_logged_user') || 'Agente';
        updateUserHeader();
        state.groups = res.groups;
        renderGroups();
        navigateTo('Groups');
      } else {
        navigateTo('Login');
      }
    } catch (e) {
      navigateTo('Login');
    }
  }

  function navigateTo(viewName) {
    state.currentView = viewName;

    // Gestione visibilità sezioni
    Object.keys(views).forEach(k => {
      if (views[k]) {
        views[k].classList.toggle('active', k === viewName);
      }
    });

    // Gestione Header Top Bar
    if (viewName === 'Login') {
      appHeader.style.display = 'none';
    } else {
      appHeader.style.display = 'flex';
      btnBack.style.display = (viewName === 'Groups') ? 'none' : 'inline-flex';

      if (viewName === 'Shops') {
        navBackText.textContent = 'Catene';
        headerBrandTitle.textContent = state.selectedGroup ? state.selectedGroup.name : 'Punti Vendita';
      } else if (viewName === 'Exhibitors') {
        navBackText.textContent = 'Negozi';
        headerBrandTitle.textContent = state.selectedShop ? state.selectedShop.name : 'Espositori';
      } else {
        headerBrandTitle.textContent = 'Karma WCAM';
      }
    }

    window.scrollTo(0, 0);
  }

  function updateUserHeader() {
    const name = state.currentUser || 'Agente';
    if (userName) userName.textContent = name;
    if (userAvatar) userAvatar.textContent = name.charAt(0).toUpperCase();
  }

  // 1. GESTIONE LOGIN
  async function handleLogin(username, password, remember) {
    const errorAlert = document.getElementById('loginErrorAlert');
    const errorText = document.getElementById('loginErrorText');
    const btnSubmit = document.getElementById('btnLoginSubmit');
    const btnText = document.getElementById('loginBtnText');
    const spinner = document.getElementById('loginSpinner');

    errorAlert.style.display = 'none';
    btnSubmit.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'inline-block';

    try {
      const res = await KarmaAPI.login(username, password);

      if (res.success) {
        state.currentUser = username;
        updateUserHeader();

        if (remember) {
          localStorage.setItem('karma_remembered_username', username);
        } else {
          localStorage.removeItem('karma_remembered_username');
        }

        // Pulisci il campo password per sicurezza
        document.getElementById('inputPassword').value = '';

        await loadGroups();
        navigateTo('Groups');
      } else {
        errorText.textContent = res.message || 'Credenziali non valide.';
        errorAlert.style.display = 'flex';
      }
    } catch (err) {
      errorText.textContent = 'Errore di connessione al server Karma. Verifica la rete.';
      errorAlert.style.display = 'flex';
    } finally {
      btnSubmit.disabled = false;
      btnText.style.display = 'inline';
      spinner.style.display = 'none';
    }
  }

  // 2. GESTIONE CATENE
  async function loadGroups() {
    const loading = document.getElementById('groupsLoading');
    const list = document.getElementById('groupsList');

    loading.style.display = 'block';
    list.innerHTML = '';

    try {
      const res = await KarmaAPI.getGroups();
      loading.style.display = 'none';

      if (!res.authenticated) {
        navigateTo('Login');
        return;
      }

      state.groups = res.groups;
      renderGroups();
    } catch (e) {
      loading.innerHTML = '<p class="text-danger">Errore di caricamento delle catene dal server.</p>';
    }
  }

  function renderGroups() {
    const list = document.getElementById('groupsList');
    list.innerHTML = '';

    if (state.groups.length === 0) {
      list.innerHTML = '<div class="loading-box"><p>Nessuna catena retail assegnata a questo utente.</p></div>';
      return;
    }

    state.groups.forEach(g => {
      const card = document.createElement('div');
      card.className = 'interactive-card';
      card.onclick = () => selectGroup(g);

      card.innerHTML = `
        <div class="card-content-main">
          <h2 class="card-item-title">${escapeHtml(g.name)}</h2>
          <div class="card-item-meta">
            ${g.lastVisit ? `<span class="meta-pill">Ultima visita: <b>${escapeHtml(g.lastVisit)}</b></span>` : ''}
          </div>
        </div>
        <div class="card-actions-group">
          ${g.shopsCount ? `<span class="badge-pill-dark">${escapeHtml(g.shopsCount)}</span>` : ''}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      `;
      list.appendChild(card);
    });
  }

  function selectGroup(g) {
    state.selectedGroup = g;
    document.getElementById('currentGroupBadge').textContent = 'Catena: ' + g.name;
    document.getElementById('currentGroupHeading').textContent = 'PV - ' + g.name;
    loadShops(g.id);
    navigateTo('Shops');
  }

  // 3. GESTIONE PUNTI VENDITA (SHOPS)
  async function loadShops(groupId) {
    const loading = document.getElementById('shopsLoading');
    const list = document.getElementById('shopsList');

    loading.style.display = 'block';
    list.innerHTML = '';
    document.getElementById('shopSearchInput').value = '';

    try {
      const res = await KarmaAPI.getShops(groupId);
      loading.style.display = 'none';

      if (!res.authenticated) {
        navigateTo('Login');
        return;
      }

      state.shops = res.shops;
      state.filteredShops = [...res.shops];
      sortShops(state.currentSort);
    } catch (e) {
      loading.innerHTML = '<p class="text-danger">Errore di caricamento dei punti vendita.</p>';
    }
  }

  function renderShops() {
    const list = document.getElementById('shopsList');
    list.innerHTML = '';

    if (state.filteredShops.length === 0) {
      list.innerHTML = '<div class="loading-box"><p>Nessun punto vendita trovato con i filtri correnti.</p></div>';
      return;
    }

    state.filteredShops.forEach(s => {
      const card = document.createElement('div');
      card.className = 'interactive-card';

      card.innerHTML = `
        <div class="card-content-main" onclick="AppRouter.selectShop('${s.id}', '${escapeHtml(s.name)}')">
          <h2 class="card-item-title">${escapeHtml(s.name)}</h2>
          <div class="card-item-meta">
            ${s.lastVisit ? `<span class="meta-pill">Ultima visita: <b>${escapeHtml(s.lastVisit)}</b></span>` : ''}
            ${s.averageDays ? `<span class="meta-pill">Media: <b>${escapeHtml(s.averageDays)}</b></span>` : ''}
          </div>
        </div>
        <div class="card-actions-group">
          ${s.hasStock ? `
            <button type="button" class="btn-card-action" title="Visualizza giacenze" onclick="event.stopPropagation(); AppRouter.openStockFor('${s.groupId}', '${s.id}', '${escapeHtml(s.name)}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              </svg>
              Giacenze
            </button>
          ` : ''}
          <button type="button" class="btn-card-action primary-action" onclick="AppRouter.selectShop('${s.id}', '${escapeHtml(s.name)}')">
            Espositori
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      `;
      list.appendChild(card);
    });
  }

  function filterShops() {
    const q = document.getElementById('shopSearchInput').value.toLowerCase().trim();
    if (!q) {
      state.filteredShops = [...state.shops];
    } else {
      state.filteredShops = state.shops.filter(s => s.name.toLowerCase().includes(q));
    }
    renderShops();
  }

  function sortShops(criteria) {
    state.currentSort = criteria;
    document.getElementById('sortNameBtn').classList.toggle('active', criteria === 'name');
    document.getElementById('sortDateBtn').classList.toggle('active', criteria === 'date');

    if (criteria === 'name') {
      state.filteredShops.sort((a, b) => a.name.localeCompare(b.name));
    } else if (criteria === 'date') {
      state.filteredShops.sort((a, b) => (b.lastVisit || '').localeCompare(a.lastVisit || ''));
    }
    renderShops();
  }

  function selectShop(shopId, shopName) {
    state.selectedShop = {
      id: shopId,
      groupId: state.selectedGroup ? state.selectedGroup.id : null,
      name: shopName
    };

    document.getElementById('currentShopTitle').textContent = shopName + ' - ' + (state.selectedGroup ? state.selectedGroup.name : '');
    loadExhibitors(state.selectedShop.groupId, shopId);
    navigateTo('Exhibitors');
  }

  // 4. GESTIONE ESPOSITORI
  async function loadExhibitors(groupId, shopId) {
    const loading = document.getElementById('exhibitorsLoading');
    const list = document.getElementById('exhibitorsList');

    loading.style.display = 'block';
    list.innerHTML = '';

    try {
      const res = await KarmaAPI.getExhibitors(groupId, shopId);
      loading.style.display = 'none';

      if (!res.authenticated) {
        navigateTo('Login');
        return;
      }

      state.exhibitors = res.exhibitors;
      renderExhibitors();
    } catch (e) {
      loading.innerHTML = '<p class="text-danger">Errore di caricamento degli espositori.</p>';
    }
  }

  function renderExhibitors() {
    const list = document.getElementById('exhibitorsList');
    list.innerHTML = '';

    const total = state.exhibitors.length;
    const completed = state.exhibitors.filter(e => e.status === 'done').length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Aggiorna progress bar
    document.getElementById('progressCountLabel').innerHTML = `<strong>${completed}</strong> di ${total} (${percent}%)`;
    document.getElementById('progressFillBar').style.width = percent + '%';
    
    const statusBadge = document.getElementById('pvProgressStatusBadge');
    if (statusBadge) {
      if (percent === 100 && total > 0) {
        statusBadge.textContent = '✓ Verificato';
        statusBadge.style.background = 'var(--success-bg)';
        statusBadge.style.color = 'var(--success-text)';
      } else {
        statusBadge.textContent = 'In Rilevazione';
        statusBadge.style.background = '#EFF6FF';
        statusBadge.style.color = '#2563EB';
      }
    }

    if (total === 0) {
      list.innerHTML = '<div class="loading-box"><p>Nessun espositore configurato per questo punto vendita.</p></div>';
      return;
    }

    state.exhibitors.forEach(e => {
      const isDone = (e.status === 'done');
      const card = document.createElement('article');
      card.className = `espositore-row-card ${isDone ? 'card-done' : ''}`;

      card.innerHTML = `
        <div class="status-indicator-col">
          <div class="status-icon-bubble ${isDone ? 'bubble-done' : 'bubble-pending'}">
            ${isDone ? `
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ` : `
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            `}
          </div>
        </div>

        <div class="espositore-body-col">
          <h2 class="espositore-title">${escapeHtml(e.title)}</h2>
          <div class="espositore-guide-btns">
            ${e.expImg ? `
              <button type="button" class="btn-mini-guide" onclick="AppRouter.openGuide('Esposizione: ${escapeHtml(e.title)}', '${e.expImg}')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                  <line x1="4" y1="22" x2="4" y2="15"></line>
                </svg>
                Esposizione
              </button>
            ` : ''}
            ${e.planImg ? `
              <button type="button" class="btn-mini-guide" onclick="AppRouter.openGuide('Planigramma: ${escapeHtml(e.title)}', '${e.planImg}')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="3" y1="9" x2="21" y2="9"></line>
                  <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
                Planigramma
              </button>
            ` : ''}
          </div>
        </div>

        <div class="espositore-action-col">
          ${isDone ? `
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
              <span class="badge-completed-chip">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Foto OK
              </span>
              <button type="button" style="background:none;border:none;color:#64748B;font-size:0.75rem;cursor:pointer;text-decoration:underline;" onclick="AppRouter.startCamera('${e.id}', '${escapeHtml(e.title)}', '${e.planImg}', '${e.expImg}')">
                Rifai scatto
              </button>
            </div>
          ` : `
            <button type="button" class="btn-take-photo" onclick="AppRouter.startCamera('${e.id}', '${escapeHtml(e.title)}', '${e.planImg}', '${e.expImg}')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
              Scatta Foto
            </button>
          `}
        </div>
      `;
      list.appendChild(card);
    });
  }

  function startCamera(exId, exTitle, planImg, expImg) {
    CameraController.openCamera({
      groupId: state.selectedShop.groupId,
      shopId: state.selectedShop.id,
      exId: exId,
      exTitle: exTitle,
      shopName: state.selectedShop.name,
      planImgUrl: planImg,
      targetImgUrl: expImg
    });
  }

  function refreshExhibitors() {
    if (state.selectedShop) {
      loadExhibitors(state.selectedShop.groupId, state.selectedShop.id);
    }
  }

  // 5. MODALI GUIDA & GIACENZE
  function openGuide(title, imgUrl) {
    document.getElementById('modalGuideTitle').textContent = title;
    document.getElementById('modalGuideImgTag').src = imgUrl;
    document.getElementById('modalGuideView').style.display = 'flex';
  }

  function closeGuide() {
    document.getElementById('modalGuideView').style.display = 'none';
  }

  async function openStockFor(groupId, shopId, shopName) {
    document.getElementById('stockModalShopSubtitle').textContent = shopName;
    document.getElementById('modalStockView').style.display = 'flex';
    document.getElementById('stockFilterInput').value = '';

    const loading = document.getElementById('stockLoading');
    const tbody = document.getElementById('stockTableBody');

    loading.style.display = 'block';
    tbody.innerHTML = '';

    try {
      state.stockItems = await KarmaAPI.getStock(groupId, shopId);
      loading.style.display = 'none';
      renderStockTable(state.stockItems);
    } catch (e) {
      loading.innerHTML = '<p class="text-danger">Errore di caricamento delle giacenze.</p>';
    }
  }

  function renderStockTable(items) {
    const tbody = document.getElementById('stockTableBody');
    tbody.innerHTML = '';

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center" style="padding:20px;color:#94A3B8;">Nessun articolo in giacenza per questo punto vendita.</td></tr>';
      return;
    }

    items.forEach(it => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(it.code)}</strong></td>
        <td>${escapeHtml(it.barcode)}</td>
        <td class="text-center"><span class="badge-pill-dark">${escapeHtml(it.qty)}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function filterStockTable() {
    const q = document.getElementById('stockFilterInput').value.toLowerCase().trim();
    if (!q) {
      renderStockTable(state.stockItems);
    } else {
      const filtered = state.stockItems.filter(it => it.code.toLowerCase().includes(q) || it.barcode.toLowerCase().includes(q));
      renderStockTable(filtered);
    }
  }

  function closeStock() {
    document.getElementById('modalStockView').style.display = 'none';
  }

  // NAVIGAZIONE INDIETRO
  function handleNavBack() {
    if (state.currentView === 'Exhibitors') {
      navigateTo('Shops');
    } else if (state.currentView === 'Shops') {
      navigateTo('Groups');
    }
  }

  async function handleLogout() {
    if (confirm("Vuoi disconnetterti dall'applicazione?")) {
      await KarmaAPI.logout();
      navigateTo('Login');
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return {
    init,
    handleLogin,
    selectGroup,
    selectShop,
    filterShops,
    sortShops,
    startCamera,
    getCurrentShop: () => state.selectedShop,
    refreshExhibitors,
    openGuide,
    closeGuide,
    openStockFor,
    filterStockTable,
    closeStock,
    handleNavBack,
    handleLogout
  };
})();

// Gestione Submit Form Login
function handleLoginSubmit(e) {
  e.preventDefault();
  const u = document.getElementById('inputUsername').value.trim();
  const p = document.getElementById('inputPassword').value;
  const rem = document.getElementById('checkRemember').checked;
  AppRouter.handleLogin(u, p, rem);
}

function handleNavBack() { AppRouter.handleNavBack(); }
function handleLogout() { AppRouter.handleLogout(); }
function filterShops() { AppRouter.filterShops(); }
function sortShops(criteria) { AppRouter.sortShops(criteria); }
function openStockModal() {
  const shop = AppRouter.getCurrentShop();
  if (shop) {
    AppRouter.openStockFor(shop.groupId, shop.id, shop.name);
  }
}
function closeStockModal() { AppRouter.closeStock(); }
function filterStockTable() { AppRouter.filterStockTable(); }
function openGuideModal(t, img) { AppRouter.openGuide(t, img); }
function closeGuideModal() { AppRouter.closeGuide(); }

window.addEventListener('DOMContentLoaded', () => {
  AppRouter.init();
});
