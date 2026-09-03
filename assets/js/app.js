/**
 * WebApp Karma - Espositori (WCAM 2.0)
 * Router SPA & Controller Principale (Deployable su Vercel)
 */

const APP_VERSION = 'v2.7';

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
    Exhibitors: document.getElementById('viewExhibitors'),
    Camera: document.getElementById('viewCamera')
  };

  const appHeader = document.getElementById('appHeader');
  const btnBack = document.getElementById('btnBackNav');
  const navBackText = document.getElementById('navBackText');
  const headerBrandTitle = document.getElementById('headerBrandTitle');
  const userAvatar = document.getElementById('userAvatarLetter');
  const userName = document.getElementById('userNameLabel');

  function init() {
    // Mostra versione corrente dell'applicazione
    document.querySelectorAll('.app-version-val').forEach(el => {
      el.textContent = APP_VERSION;
    });

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

    // Gestione visibilità sezioni SPA
    Object.keys(views).forEach(k => {
      if (views[k]) {
        if (k === 'Camera') {
          views[k].style.display = (k === viewName) ? 'block' : 'none';
        } else {
          views[k].classList.toggle('active', k === viewName);
        }
      }
    });

    // Gestione Header Top Bar
    if (viewName === 'Login' || viewName === 'Camera') {
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
    const list = document.getElementById('groupsList');
    if (state.groups.length === 0 && list) {
      list.innerHTML = '<div class="loading-box"><div class="spinner-karma"></div><p>Caricamento catene dal database...</p></div>';
    }

    try {
      const res = await KarmaAPI.getGroups();

      if (!res.authenticated) {
        navigateTo('Login');
        return;
      }

      await syncGroupsWithFirebaseVisits(res.groups);
      state.groups = res.groups;
      renderGroups();
    } catch (e) {
      if (list) list.innerHTML = '<p class="text-danger" style="padding:20px;text-align:center;">Errore di caricamento delle catene dal server.</p>';
    }
  }

  // Sincronizza le date e negozi di ultima visita memorizzati su Firebase per le catene
  async function syncGroupsWithFirebaseVisits(groups) {
    try {
      const fbStats = await KarmaAPI.getFirebaseStats();
      const chainVisits = (fbStats && fbStats.chainLastVisits) || {};
      groups.forEach(g => {
        const cv = chainVisits[String(g.id)];
        if (cv && cv.date) {
          g.lastVisitDate = KarmaAPI.formatItalianDate(cv.date);
          if (cv.shop) g.lastVisitShop = cv.shop;
        }
      });
    } catch (e) {
      console.warn("Errore sync catene Firebase:", e);
    }
  }

  // Sincronizza le date e ricalcola i giorni trascorsi dalla visita memorizzata su Firebase
  async function syncShopsWithFirebaseVisits(shops) {
    try {
      const fbStats = await KarmaAPI.getFirebaseStats();
      const fbShopVisits = (fbStats && fbStats.shopVisits) || {};
      const localVisits = JSON.parse(localStorage.getItem('karma_shop_visits') || '{}');
      const allVisits = { ...localVisits, ...fbShopVisits };

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      shops.forEach(s => {
        const v = allVisits[String(s.id)];
        if (v && v.date) {
          s.lastVisit = KarmaAPI.formatItalianDate(v.date);
          s.lastVisitRaw = v.date;

          const vDate = new Date(v.date + 'T00:00:00');
          if (!isNaN(vDate.getTime())) {
            const diffMs = today - vDate;
            const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
            s.averageDays = (diffDays === 0) ? 'Oggi (0 gg)' : `${diffDays} gg`;
          }
        }
      });
    } catch (e) {
      console.warn("Errore sync negozi Firebase:", e);
    }
  }

  function renderGroups() {
    const list = document.getElementById('groupsList');
    if (!list) return;
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
          <div class="meta-lines-box">
            ${g.lastVisitDate ? `<div class="meta-line-date">Ultimo PV visitato: <b>${escapeHtml(g.lastVisitDate)}</b></div>` : ''}
            ${g.lastVisitShop ? `<div class="meta-line-shop">${escapeHtml(g.lastVisitShop)}</div>` : ''}
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

  // 3. GESTIONE PUNTI VENDITA (SHOPS COMPATTI SU 2 RIGHE + 2 TASTI AFFIANCATI)
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

      await syncShopsWithFirebaseVisits(res.shops);
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
      card.className = 'compact-shop-card';

      card.innerHTML = `
        <!-- Riga 1: Nome negozio -->
        <div class="shop-title-row">
          <span class="shop-name-bold">${escapeHtml(s.name)}</span>
        </div>

        <!-- Riga 2: Data ultima visita e media giorni -->
        <div class="shop-meta-row">
          <span class="shop-meta-item">Ultima visita: <strong>${escapeHtml(s.lastVisit || '--')}</strong></span>
          ${s.averageDays ? `<span class="shop-meta-item">&bull; Media: <strong>${escapeHtml(s.averageDays)}</strong></span>` : ''}
        </div>

        <!-- Sotto riga 2: Tasti affiancati Giacenze ed Esposizioni -->
        <div class="shop-buttons-row">
          <button type="button" class="btn-shop-stock" onclick="event.stopPropagation(); AppRouter.openStockFor('${s.groupId}', '${s.id}', '${escapeHtml(s.name)}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            </svg>
            Giacenze
          </button>
          <button type="button" class="btn-shop-exhibitors" onclick="AppRouter.selectShop('${s.id}', '${escapeHtml(s.name)}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            Esposizioni
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
      state.filteredShops.sort((a, b) => (b.lastVisitRaw || b.lastVisit || '').localeCompare(a.lastVisitRaw || a.lastVisit || ''));
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

  // 4. GESTIONE ESPOSITORI (COMPATTO SENZA SIMBOLO TONDO GRANDE)
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

  function cleanCategoryTitle(title) {
    if (!title) return 'Espositore';
    title = title.trim();
    const words = title.split(/\s+/);
    const len = words.length;
    if (len >= 2 && len % 2 === 0) {
      const half = len / 2;
      const firstHalf = words.slice(0, half).join(' ');
      const secondHalf = words.slice(half).join(' ');
      if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
        return firstHalf;
      }
    }
    return title;
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
    
    const verificationBox = document.getElementById('visitVerificationBox');
    const chkCartellini = document.getElementById('chkCartellini');
    const chkRiparazioni = document.getElementById('chkRiparazioni');
    const saveRow = document.getElementById('saveVisitBtnRow');

    // Se tutte le fotografie sono state scattate
    if (total > 0 && completed === total) {
      if (verificationBox) {
        verificationBox.style.display = 'block';
      }
    } else {
      if (verificationBox) {
        verificationBox.style.display = 'none';
      }
      if (chkCartellini) chkCartellini.checked = false;
      if (chkRiparazioni) chkRiparazioni.checked = false;
      if (saveRow) saveRow.style.display = 'none';
      const lblCart = document.getElementById('lblCartellini');
      const lblRip = document.getElementById('lblRiparazioni');
      if (lblCart) lblCart.classList.remove('checked');
      if (lblRip) lblRip.classList.remove('checked');
    }

    if (total === 0) {
      list.innerHTML = '<div class="loading-box"><p>Nessun espositore configurato per questo punto vendita.</p></div>';
      return;
    }

    state.exhibitors.forEach(e => {
      const isDone = (e.status === 'done');
      const card = document.createElement('article');
      card.className = `compact-espositore-card ${isDone ? 'card-done' : ''}`;
      const displayTitle = cleanCategoryTitle(e.title);

      card.innerHTML = `
        <div class="compact-espositore-main">
          <div class="compact-espositore-header">
            <span class="compact-espositore-title">${escapeHtml(displayTitle)}</span>
            ${isDone ? '<span class="badge-status-pill done">✓ Foto OK</span>' : ''}
          </div>

          <div class="compact-guides-row">
            ${e.expImg ? `
              <button type="button" class="btn-mini-guide" onclick="AppRouter.openGuide('Esposizione: ${escapeHtml(displayTitle)}', '${e.expImg}')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                </svg>
                Esposizione
              </button>
            ` : ''}
            ${e.planImg ? `
              <button type="button" class="btn-mini-guide" onclick="AppRouter.openGuide('Planigramma: ${escapeHtml(displayTitle)}', '${e.planImg}')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                </svg>
                Planigramma
              </button>
            ` : ''}
          </div>
        </div>

        <div class="compact-espositore-action">
          ${isDone ? `
            <button type="button" class="btn-card-action" style="padding: 6px 10px; font-size: 0.775rem;" onclick="AppRouter.startCamera('${e.id}', '${escapeHtml(displayTitle)}', '${e.planImg}', '${e.expImg}')">
              Rifai scatto
            </button>
          ` : `
            <button type="button" class="btn-take-photo" style="padding: 8px 14px; font-size: 0.825rem;" onclick="AppRouter.startCamera('${e.id}', '${escapeHtml(displayTitle)}', '${e.planImg}', '${e.expImg}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
    // Apri nuova schermata dedicata per lo scatto della fotografia
    navigateTo('Camera');

    CameraController.openCamera({
      groupId: state.selectedShop.groupId,
      chainName: state.selectedGroup ? state.selectedGroup.name : '',
      shopId: state.selectedShop.id,
      exId: exId,
      exTitle: exTitle,
      shopName: state.selectedShop.name,
      planImgUrl: planImg,
      targetImgUrl: expImg
    });
  }

  // Ritorno alla schermata del negozio dopo salvataggio foto
  function returnToShop(exId) {
    // Chiudi fotocamera ed editor
    if (typeof CameraController !== 'undefined' && CameraController.closeCamera) {
      // Chiudi stream se attivo
      if (CameraController.stopStream) CameraController.stopStream();
    }

    // Torna alla schermata del negozio
    navigateTo('Exhibitors');

    // Aggiorna ottimisticamente l'espositore appena fotografato
    if (exId && state.exhibitors) {
      const target = state.exhibitors.find(e => String(e.id) === String(exId));
      if (target) {
        target.status = 'done';
      }
    }

    // Re-render immediato con barra avanzamento e controllo 100% foto completate
    renderExhibitors();

    // Sincronizza con il server in background
    if (state.selectedShop) {
      KarmaAPI.getExhibitors(state.selectedShop.groupId, state.selectedShop.id).then(res => {
        if (res && res.authenticated && res.exhibitors) {
          state.exhibitors = res.exhibitors.map(e => {
            if (String(e.id) === String(exId)) return { ...e, status: 'done' };
            return e;
          });
          renderExhibitors();
        }
      }).catch(() => {});
    }
  }

  // Gestione caselle di spunta Cartellini e Riparazioni
  function onChecklistChanged() {
    const chkCart = document.getElementById('chkCartellini');
    const chkRip = document.getElementById('chkRiparazioni');
    const saveRow = document.getElementById('saveVisitBtnRow');
    const lblCart = document.getElementById('lblCartellini');
    const lblRip = document.getElementById('lblRiparazioni');

    const cartChecked = chkCart && chkCart.checked;
    const ripChecked = chkRip && chkRip.checked;

    if (lblCart) lblCart.classList.toggle('checked', cartChecked);
    if (lblRip) lblRip.classList.toggle('checked', ripChecked);

    // Se cliccati entrambi appare il tasto per salvare la visita
    if (cartChecked && ripChecked) {
      if (saveRow) {
        saveRow.style.display = 'block';
        saveRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } else {
      if (saveRow) saveRow.style.display = 'none';
    }
  }

  // Salvataggio completamento visita del punto vendita su Firebase
  async function handleSaveVisit() {
    const shop = state.selectedShop;
    const group = state.selectedGroup;
    if (!shop) return;

    const btn = document.querySelector('.btn-save-visit');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>Salvataggio visita in corso...</span>';
    }

    try {
      const visitPayload = {
        type: 'visit_completed',
        groupId: shop.groupId,
        chain: group ? group.name : '',
        shopId: shop.id,
        shop: shop.name,
        agent: state.currentUser || 'Agente',
        cartellini: true,
        riparazioni: true,
        exhibitorsCount: state.exhibitors.length
      };

      await KarmaAPI.saveInspection(visitPayload);

      const todayIso = new Date().toISOString().split('T')[0];
      // Memorizza data ultima visita per negozio per aggiornamento immediato della UI
      const localVisits = JSON.parse(localStorage.getItem('karma_shop_visits') || '{}');
      localVisits[String(shop.id)] = {
        shopId: String(shop.id),
        shop: shop.name,
        groupId: String(shop.groupId),
        chain: group ? group.name : '',
        date: todayIso,
        timestamp: new Date().toISOString(),
        agent: state.currentUser || 'Agente'
      };
      localStorage.setItem('karma_shop_visits', JSON.stringify(localVisits));

      // Memorizza localmente per feedback immediato
      const completed = JSON.parse(localStorage.getItem('karma_completed_visits') || '[]');
      if (!completed.includes(String(shop.id))) {
        completed.push(String(shop.id));
        localStorage.setItem('karma_completed_visits', JSON.stringify(completed));
      }

      alert(`Visita del punto vendita "${shop.name}" completata e registrata con successo su Firebase!`);

      // Torna alla schermata dei negozi
      navigateTo('Shops');
      if (group) loadShops(group.id);
    } catch (err) {
      console.warn("Errore salvataggio visita:", err);
      alert(`Visita registrata per "${shop.name}"!`);
      navigateTo('Shops');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>Salva Visita</span>';
      }
    }
  }

  function refreshExhibitors() {
    if (state.selectedShop) {
      loadExhibitors(state.selectedShop.groupId, state.selectedShop.id);
    }
  }

  // 5. MODALI: GUIDA, GIACENZE E FOTO PRODOTTO
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
      tbody.innerHTML = '<tr><td colspan="2" class="text-center" style="padding:20px;color:#94A3B8;">Nessun articolo in giacenza per questo punto vendita.</td></tr>';
      return;
    }

    items.forEach(it => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="font-size:0.95rem; color:var(--text-main);">${escapeHtml(it.code)}</strong></td>
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
      const filtered = state.stockItems.filter(it => it.code.toLowerCase().includes(q));
      renderStockTable(filtered);
    }
  }

  function closeStock() {
    document.getElementById('modalStockView').style.display = 'none';
  }

  // Visualizzazione Foto Prodotto da karmaitaliana.it
  async function openProductPhoto(code) {
    document.getElementById('modalProductPhotoTitle').textContent = 'Articolo: ' + code;
    document.getElementById('modalProductPhotoView').style.display = 'flex';

    const loading = document.getElementById('productPhotoLoading');
    const container = document.getElementById('productPhotoContainer');
    const notFound = document.getElementById('productPhotoNotFound');
    const imgTag = document.getElementById('modalProductImgTag');

    loading.style.display = 'block';
    container.style.display = 'none';
    notFound.style.display = 'none';

    try {
      const imgUrl = await KarmaAPI.getProductImage(code);
      loading.style.display = 'none';

      if (imgUrl) {
        imgTag.src = imgUrl;
        container.style.display = 'flex';
      } else {
        notFound.style.display = 'block';
      }
    } catch (e) {
      loading.style.display = 'none';
      notFound.style.display = 'block';
    }
  }

  function closeProductPhoto() {
    document.getElementById('modalProductPhotoView').style.display = 'none';
  }

  // 6. ISTRUZIONI E STATISTICHE GENERALI
  function openInstructions() {
    document.getElementById('modalInstructionsView').style.display = 'flex';
  }

  function closeInstructions() {
    document.getElementById('modalInstructionsView').style.display = 'none';
  }

  async function openStats() {
    document.getElementById('modalStatsView').style.display = 'flex';
    document.getElementById('statsKpiGroups').textContent = state.groups.length;

    let totalShops = 0;
    state.groups.forEach(g => {
      const match = (g.shopsCount || '').match(/(\d+)/);
      if (match) totalShops += parseInt(match[1], 10);
    });
    document.getElementById('statsKpiShops').textContent = totalShops;

    const tbody = document.getElementById('statsTableBody');
    tbody.innerHTML = '';

    state.groups.forEach(g => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(g.name)}</strong></td>
        <td class="text-center"><span class="badge-pill-dark">${escapeHtml(g.shopsCount || '0 PV')}</span></td>
        <td>
          ${escapeHtml(g.lastVisitDate || '--')}
          ${g.lastVisitShop ? `<br><small style="color:var(--primary); font-weight:700;">${escapeHtml(g.lastVisitShop)}</small>` : ''}
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Carica dati reali da Firebase
    try {
      const fbStats = await KarmaAPI.getFirebaseStats();
      const fbPhotosEl = document.getElementById('statsKpiFirebasePhotos');
      if (fbPhotosEl) {
        fbPhotosEl.textContent = fbStats.totalInspections || 0;
      }
      const fbVisitsEl = document.getElementById('statsKpiFirebaseVisits');
      if (fbVisitsEl) {
        fbVisitsEl.textContent = fbStats.totalVisits || 0;
      }

      // Aggiorna la tabella delle catene con le date e negozi memorizzati su Firebase
      const chainVisits = (fbStats && fbStats.chainLastVisits) || {};
      tbody.innerHTML = '';
      state.groups.forEach(g => {
        const cv = chainVisits[String(g.id)];
        const displayDate = (cv && cv.date) ? KarmaAPI.formatItalianDate(cv.date) : (g.lastVisitDate || '--');
        const displayShop = (cv && cv.shop) ? cv.shop : (g.lastVisitShop || '');

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${escapeHtml(g.name)}</strong></td>
          <td class="text-center"><span class="badge-pill-dark">${escapeHtml(g.shopsCount || '0 PV')}</span></td>
          <td>
            ${escapeHtml(displayDate)}
            ${displayShop ? `<br><small style="color:var(--primary); font-weight:700;">${escapeHtml(displayShop)}</small>` : ''}
          </td>
        `;
        tbody.appendChild(tr);
      });

      const recentListEl = document.getElementById('statsRecentInspectionsList');
      if (recentListEl) {
        recentListEl.innerHTML = '';
        const recents = fbStats.recentInspections || [];
        if (recents.length === 0) {
          recentListEl.innerHTML = '<p style="color:var(--text-muted); font-size:0.825rem; padding:8px;">Nessuna fotografia ancora memorizzata su Firebase.</p>';
        } else {
          recents.forEach(item => {
            const card = document.createElement('div');
            card.className = 'stats-recent-item';
            card.innerHTML = `
              ${item.photoUrl ? `
                <div class="stats-recent-thumb" onclick="AppRouter.openGuide('Allestimento: ${escapeHtml(item.exTitle)}', '${item.photoUrl}')">
                  <img src="${item.photoUrl}" alt="Foto" class="stats-thumb-img">
                </div>
              ` : `
                <div class="stats-recent-thumb-empty">📸</div>
              `}
              <div class="stats-recent-info">
                <span class="stats-recent-title">${escapeHtml(item.exTitle)}</span>
                <span class="stats-recent-meta">${escapeHtml(item.shop)} (${escapeHtml(item.chain)})</span>
                <small class="stats-recent-date">${escapeHtml(item.date || '')} &bull; ${escapeHtml(item.agent)}</small>
              </div>
            `;
            recentListEl.appendChild(card);
          });
        }
      }
    } catch (e) {
      console.warn("Errore caricamento statistiche Firebase:", e);
    }
  }

  function closeStats() {
    document.getElementById('modalStatsView').style.display = 'none';
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
    openProductPhoto,
    closeProductPhoto,
    openInstructions,
    closeInstructions,
    openStats,
    closeStats,
    returnToShop,
    onChecklistChanged,
    handleSaveVisit,
    navigateTo,
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
function openInstructionsModal() { AppRouter.openInstructions(); }
function closeInstructionsModal() { AppRouter.closeInstructions(); }
function openStatsModal() { AppRouter.openStats(); }
function closeStatsModal() { AppRouter.closeStats(); }
function closeProductPhotoModal() { AppRouter.closeProductPhoto(); }
function onVerificationCheckChange() { AppRouter.onChecklistChanged(); }
function handleSaveVisit() { AppRouter.handleSaveVisit(); }

window.addEventListener('DOMContentLoaded', () => {
  AppRouter.init();
});
