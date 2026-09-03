/**
 * WebApp Karma - Espositori (WCAM 2.0)
 * Client API per Vercel: comunica con il backend di karmaitaliana.it/wcam
 * tramite Vercel Edge Rewrites (/api/wcam/...) senza problemi di CORS.
 */

const KarmaAPI = (function() {
  // Se siamo su Vercel o server locale con proxy, usiamo /api/wcam
  const API_BASE = '/api/wcam';

  // Formatta date nel formato richiesto: GG Mese ANNO (es. 3 Settembre 2026 o 28 Maggio 2026)
  function formatItalianDate(rawStr) {
    if (!rawStr) return '';
    rawStr = String(rawStr).split('T')[0].trim();

    const mesi = [
      '', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ];

    // 1. Formato ISO: YYYY-MM-DD (es. 2026-09-03 da Firebase)
    const matchIso = rawStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (matchIso) {
      const year = parseInt(matchIso[1], 10);
      const monthNum = parseInt(matchIso[2], 10);
      const day = parseInt(matchIso[3], 10);
      const meseNome = mesi[monthNum] || monthNum;
      return `${day} ${meseNome} ${year}`;
    }

    // 2. Formato Europeo/Italiano: GG-MM-AA o GG-MM-AAAA (es. 28-05-26 da Karma)
    const matchEu = rawStr.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (matchEu) {
      const day = parseInt(matchEu[1], 10);
      const monthNum = parseInt(matchEu[2], 10);
      let year = parseInt(matchEu[3], 10);
      if (year < 100) year += 2000;
      const meseNome = mesi[monthNum] || monthNum;
      return `${day} ${meseNome} ${year}`;
    }

    return rawStr;
  }

  // Helper per inviare richieste con credenziali/cookie inclusi
  async function request(endpoint, options = {}) {
    const url = `${API_BASE}/${endpoint.replace(/^\//, '')}`;
    const defaultHeaders = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    };

    const config = {
      ...options,
      credentials: 'include', // Include cookie PHPSESSID
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    };

    const response = await fetch(url, config);
    return response;
  }

  // 1. LOGIN
  async function login(username, password) {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('cmdConfirm', 'cmdConfirm');

    const response = await request('index.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    const html = await response.text();

    // Se l'HTML contiene ancora il form di login o errore
    if (html.includes('Inserisci le credenziali') && !html.includes('CATENE') && !html.includes('groups.php')) {
      return { success: false, message: 'Credenziali non corrette. Verifica nome utente e password.' };
    }

    // Salva l'utente loggato in localStorage (solo username, MAI la password)
    localStorage.setItem('karma_logged_user', username);

    return { success: true };
  }

  // 2. GET GROUPS (Catene: BRUNO, COMET, UNIEURO)
  async function getGroups() {
    const response = await request('groups.php');
    const html = await response.text();

    // Se reindirizzato al login (sessione scaduta)
    if (html.includes('Inserisci le credenziali')) {
      return { authenticated: false, groups: [] };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = doc.querySelectorAll('a[href*="shops.php?groupid="]');

    const groups = [];
    links.forEach(a => {
      const href = a.getAttribute('href') || '';
      const matchId = href.match(/groupid=(\d+)/);
      const groupId = matchId ? matchId[1] : null;

      const titleEl = a.querySelector('h6');
      const name = titleEl ? titleEl.textContent.trim() : 'Catena';

      const descEl = a.querySelector('p');
      let lastVisitDate = '';
      let lastVisitShop = '';
      if (descEl) {
        const bEl = descEl.querySelector('b');
        let rawDate = '';
        if (bEl && bEl.textContent.trim()) {
          rawDate = bEl.textContent.trim();
          lastVisitDate = formatItalianDate(rawDate);
        }
        // Estrai il nome del punto vendita (es. Mantova, Riccione, Udine)
        const fullText = descEl.textContent.replace('Ultimo PV visitato:', '').trim();
        if (rawDate) {
          lastVisitShop = fullText.replace(rawDate, '').trim();
        } else {
          lastVisitShop = fullText;
        }
      }

      const badgeEl = a.querySelector('.badge');
      const badgeText = badgeEl ? badgeEl.textContent.trim() : '';

      if (groupId) {
        groups.push({
          id: groupId,
          name: name,
          lastVisitDate: lastVisitDate,
          lastVisitShop: lastVisitShop,
          shopsCount: badgeText
        });
      }
    });

    return { authenticated: true, groups };
  }

  // Cache immagini prodotti
  const productImageCache = {};

  // Recupero fotografia prodotto da www.karmaitaliana.it
  async function getProductImage(productCode) {
    const code = (productCode || '').trim();
    if (!code) return null;
    if (productImageCache[code]) return productImageCache[code];

    try {
      const formData = new URLSearchParams();
      formData.append('keyword', code);

      const response = await fetch('/api/karma-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const imgs = doc.querySelectorAll('img');
      for (const img of imgs) {
        const src = img.getAttribute('src') || '';
        if (src.includes('catalogmedia/images/medium/') || src.includes('catalogmedia/images/large/') || src.includes('catalogmedia/images/product/')) {
          productImageCache[code] = src;
          return src;
        }
      }
    } catch (e) {
      console.warn("Impossibile recuperare foto prodotto per", code, e);
    }
    return null;
  }

  // 3. GET SHOPS (Punti Vendita per Catena)
  async function getShops(groupId) {
    const response = await request(`shops.php?groupid=${groupId}`);
    const html = await response.text();

    if (html.includes('Inserisci le credenziali')) {
      return { authenticated: false, shops: [], groupName: '' };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Nome catena da card-header
    const headerEl = doc.querySelector('.card-header');
    let groupName = 'Punti Vendita';
    if (headerEl) {
      const text = headerEl.childNodes[0] ? headerEl.childNodes[0].textContent.trim() : '';
      if (text) groupName = text.replace('PV -', '').replace('PV', '').trim();
    }

    const rows = doc.querySelectorAll('tbody[data-jplist-group="group1"] tr, tbody tr');
    const shops = [];

    rows.forEach(tr => {
      const linkExhibitors = tr.querySelector('a[href*="exhibitors.php"]');
      if (!linkExhibitors) return;

      const href = linkExhibitors.getAttribute('href') || '';
      const matchShopId = href.match(/shopid=(\d+)/);
      const shopId = matchShopId ? matchShopId[1] : null;

      const titleEl = linkExhibitors.querySelector('.title, h6');
      const name = titleEl ? titleEl.textContent.trim() : 'Punto Vendita';

      // Data ultima visita
      let lastVisitFormatted = '';
      let lastVisitSortKey = '';
      const ps = linkExhibitors.querySelectorAll('p');
      ps.forEach(p => {
        if (p.textContent.includes('Ultima Visita:')) {
          const cloneP = p.cloneNode(true);
          cloneP.querySelectorAll('.duv, [hidden]').forEach(el => el.remove());
          const cleanText = cloneP.textContent.replace(/Ultima Visita:/i, '').trim();
          lastVisitFormatted = formatItalianDate(cleanText);
          const match = cleanText.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
          if (match) {
            let y = parseInt(match[3], 10);
            if (y < 100) y += 2000;
            lastVisitSortKey = `${y}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
          }
        }
      });

      // Media giorni
      let averageDays = '';
      ps.forEach(p => {
        if (p.textContent.includes('Media')) {
          const matchMedia = p.textContent.match(/Media\s*(\d+)/i);
          if (matchMedia) averageDays = matchMedia[1] + ' gg';
        }
      });

      // Link giacenze
      const linkStock = tr.querySelector('a[href*="shopstock.php"]');
      const hasStock = !!linkStock;

      if (shopId) {
        shops.push({
          id: shopId,
          groupId: groupId,
          name: name,
          lastVisit: lastVisitFormatted,
          lastVisitRaw: lastVisitSortKey,
          averageDays: averageDays,
          hasStock: hasStock
        });
      }
    });

    return { authenticated: true, groupName, shops };
  }

  // 4. GET EXHIBITORS (Espositori per Punto Vendita)
  async function getExhibitors(groupId, shopId) {
    const response = await request(`exhibitors.php?groupid=${groupId}&shopid=${shopId}`);
    const html = await response.text();

    if (html.includes('Inserisci le credenziali')) {
      return { authenticated: false, exhibitors: [], shopName: '' };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const headerEl = doc.querySelector('.card-header');
    let shopName = 'Punto Vendita';
    if (headerEl) {
      shopName = headerEl.childNodes[0] ? headerEl.childNodes[0].textContent.trim() : '';
    }

    // Modal maps per immagini esposizione e planigramma
    const modalImgMap = {};
    doc.querySelectorAll('.modal').forEach(modal => {
      const id = modal.getAttribute('id');
      const img = modal.querySelector('img');
      if (id && img) {
        modalImgMap[id] = img.getAttribute('src');
      }
    });

    const rows = doc.querySelectorAll('table tbody tr');
    const exhibitors = [];

    rows.forEach(tr => {
      // Verifica status: icona rossa (da fare) vs verde/check (fatto)
      const th = tr.querySelector('th');
      const isPending = th && th.innerHTML.includes('color: red');
      const isDone = !isPending;

      // Titolo espositore (elimina duplicazioni da <br>)
      const tdText = tr.querySelector('td:not(.align-middle)');
      let title = 'Espositore';
      if (tdText) {
        const parts = tdText.innerHTML.split(/<br\s*\/?>/i)
          .map(p => p.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim())
          .filter(Boolean);
        if (parts.length > 0) {
          title = parts[0];
        } else {
          title = tdText.textContent.trim().replace(/\s+/g, ' ');
        }
      }

      // Link camera ed exid
      const camLink = tr.querySelector('a[href*="camera.php"]');
      let exId = 0;
      if (camLink) {
        const href = camLink.getAttribute('href') || '';
        const matchEx = href.match(/exid=(\d+)/);
        if (matchEx) exId = matchEx[1];
      }

      // Riferimenti modal Esposizione e Planigramma
      const expBtn = tr.querySelector('a[data-bs-target*="ModalExp"]');
      const planBtn = tr.querySelector('a[data-bs-target*="ModalPlan"]');

      let expImg = '';
      if (expBtn) {
        const targetId = expBtn.getAttribute('data-bs-target').replace('#', '');
        expImg = modalImgMap[targetId] || '';
      }

      let planImg = '';
      if (planBtn) {
        const targetId = planBtn.getAttribute('data-bs-target').replace('#', '');
        planImg = modalImgMap[targetId] || '';
      }

      exhibitors.push({
        id: exId,
        groupId: groupId,
        shopId: shopId,
        title: title,
        status: isDone ? 'done' : 'pending',
        expImg: expImg,
        planImg: planImg
      });
    });

    return { authenticated: true, shopName, exhibitors };
  }

  // 5. GET STOCK (Giacenze Prodotti)
  async function getStock(groupId, shopId) {
    const response = await request(`shopstock.php?groupid=${groupId}&shopid=${shopId}`);
    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const rows = doc.querySelectorAll('table tbody tr');
    const items = [];

    rows.forEach(tr => {
      const tds = tr.querySelectorAll('td');
      if (tds.length >= 3) {
        items.push({
          code: tds[0].textContent.trim(),
          barcode: tds[1].textContent.trim(),
          qty: tds[2].textContent.trim()
        });
      }
    });

    return items;
  }

  // 6. UPLOAD PHOTO (Invio scatto con salvataggio nel database live)
  async function uploadPhoto(groupId, shopId, exId, base64DataUrl) {
    const formData = new URLSearchParams();
    formData.append('image', base64DataUrl);
    formData.append('exid', exId);
    formData.append('shopid', shopId);
    formData.append('groupid', groupId);
    formData.append('cmdSave', 'Salva');

    const response = await request('camera.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    return response.ok;
  }

  // 7. SALVATAGGIO FOTOGRAFIA E STATISTICHE SU FIREBASE (Sicuro via serverless API)
  async function saveInspection(payload) {
    try {
      const response = await fetch('/api/save-inspection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      return await response.json();
    } catch (e) {
      console.warn("Errore salvataggio Firebase:", e);
      return { success: false, error: e.message };
    }
  }

  // 8. STATISTICHE GENERALI DA FIREBASE
  async function getFirebaseStats() {
    try {
      const response = await fetch('/api/stats');
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn("Errore recupero statistiche Firebase:", e);
    }
    return {
      totalInspections: 0,
      recentInspections: [],
      inspectionsByChain: {},
      inspectionsByAgent: {}
    };
  }

  // 9. LOGOUT
  async function logout() {
    localStorage.removeItem('karma_logged_user');
    await request('logout.php');
    return true;
  }

  return {
    login,
    getGroups,
    getShops,
    getExhibitors,
    getStock,
    getProductImage,
    uploadPhoto,
    saveInspection,
    getFirebaseStats,
    formatItalianDate,
    logout
  };
})();
