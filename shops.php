<?php
/**
 * WebApp Karma - Espositori (WCAM 2.0)
 * Dashboard Punti Vendita ed Espositori
 */

require_once __DIR__ . '/includes/app_functions.php';
requireAuth();

$user = getCurrentUser();
$puntiVendita = getPuntiVendita();
$currentPvId = $_GET['pv'] ?? ($puntiVendita[0]['id'] ?? 'pv-verona');
$currentPv = getPuntoVenditaById($currentPvId) ?: $puntiVendita[0];

$allEspositori = getEspositoriList();
$assignedEspositori = getEspositoriByPv($currentPv['id']);
$scatti = getScattiByPv($currentPv['id']);

$scattiMap = [];
foreach ($scatti as $s) {
    $scattiMap[$s['espositore_id']] = $s;
}

$completedCount = count($scatti);
$totalCount = count($assignedEspositori);
$percent = $totalCount > 0 ? round(($completedCount / $totalCount) * 100) : 0;
?>
<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#181B20">
  <title>Espositori - <?= htmlspecialchars($currentPv['name']) ?></title>
  
  <link rel="shortcut icon" type="image/png" href="assets/brand/favicon-16x16.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  
  <link rel="manifest" href="manifest.json">
  <link href="assets/css/modern.css" rel="stylesheet">
</head>
<body class="app-page">
  <!-- Header Top Bar -->
  <header class="app-header">
    <div class="header-left">
      <a href="shops.php" class="header-brand">
        <div class="brand-badge-dot"></div>
        <span class="brand-title">Karma WCAM</span>
      </a>
      <div class="pv-dropdown-container">
        <label for="pvSelect" class="sr-only">Seleziona Punto Vendita</label>
        <select id="pvSelect" class="pv-select" onchange="switchPv(this.value)">
          <?php foreach ($puntiVendita as $pv): ?>
            <option value="<?= htmlspecialchars($pv['id']) ?>" <?= $pv['id'] === $currentPv['id'] ? 'selected' : '' ?>>
              <?= htmlspecialchars($pv['name']) ?>
            </option>
          <?php endforeach; ?>
        </select>
      </div>
    </div>

    <div class="header-right">
      <div class="user-pill" title="Utente collegato">
        <span class="user-avatar"><?= strtoupper(substr($user['name'] ?? 'U', 0, 1)) ?></span>
        <span class="user-name"><?= htmlspecialchars($user['name'] ?? 'Utente') ?></span>
      </div>
      <a href="logout.php" class="btn-icon" title="Disconnetti" aria-label="Logout">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
      </a>
    </div>
  </header>

  <main class="app-main">
    <!-- Banner PV Attivo e Avanzamento -->
    <section class="pv-summary-card">
      <div class="pv-info">
        <div class="pv-badge-status <?= $percent === 100 ? 'status-complete' : 'status-progress' ?>">
          <?= $percent === 100 ? '✓ Verificato' : 'In Rilevazione' ?>
        </div>
        <h1 class="pv-heading"><?= htmlspecialchars($currentPv['name']) ?></h1>
        <p class="pv-subheading">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <?= htmlspecialchars($currentPv['city']) ?> &bull; <?= htmlspecialchars($currentPv['address']) ?>
        </p>
      </div>

      <div class="progress-box">
        <div class="progress-labels">
          <span class="progress-text">Avanzamento scatti</span>
          <span class="progress-count"><strong><?= $completedCount ?></strong> di <?= $totalCount ?> (<?= $percent ?>%)</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: <?= $percent ?>%;"></div>
        </div>
      </div>
    </section>

    <!-- Barra Ricerca e Filtro Rapido -->
    <div class="filter-bar">
      <div class="search-input-wrapper">
        <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" id="espositoreSearch" class="search-input" placeholder="Cerca espositore o categoria..." oninput="filterEspositori()">
      </div>
      <div class="filter-tabs">
        <button class="filter-tab active" data-filter="all" onclick="setFilter('all', this)">Tutti (<?= $totalCount ?>)</button>
        <button class="filter-tab" data-filter="pending" onclick="setFilter('pending', this)">Da fare (<?= $totalCount - $completedCount ?>)</button>
        <button class="filter-tab" data-filter="done" onclick="setFilter('done', this)">Fatti (<?= $completedCount ?>)</button>
      </div>
    </div>

    <!-- Lista Espositori del Punto Vendita -->
    <section class="espositori-list" id="espositoriContainer">
      <?php foreach ($assignedEspositori as $esp): 
        $hasPhoto = isset($scattiMap[$esp['id']]);
        $scatto = $hasPhoto ? $scattiMap[$esp['id']] : null;
      ?>
        <article class="espositore-card <?= $hasPhoto ? 'card-completed' : 'card-pending' ?>" 
                 data-id="<?= $esp['id'] ?>"
                 data-title="<?= strtolower(htmlspecialchars($esp['title'])) ?>"
                 data-cat="<?= strtolower(htmlspecialchars($esp['category'])) ?>"
                 data-status="<?= $hasPhoto ? 'done' : 'pending' ?>">
          
          <div class="card-left-visual">
            <div class="brand-swirl-icon <?= $hasPhoto ? 'swirl-done' : '' ?>">
              <svg viewBox="0 0 70 70" width="40" height="40">
                <circle cx="35" cy="35" r="34" fill="<?= $hasPhoto ? '#10B981' : '#E30613' ?>"/>
                <path d="M 35 11 A 24 24 0 0 1 59 35 C 59 48.2 48.2 59 35 59 C 24 59 18 51 24 43 C 28 37 36 37 38 41 C 39 43 38 46 35 46 C 31 46 29 41 33 37 C 37 33 46 36 45 42 C 44 49 34 52 28 47 C 22 42 23 27 35 21 Z" fill="#FFFFFF"/>
                <circle cx="35" cy="35" r="5" fill="<?= $hasPhoto ? '#10B981' : '#E30613' ?>"/>
              </svg>
            </div>
          </div>

          <div class="card-body-content">
            <div class="card-meta-row">
              <span class="category-tag"><?= htmlspecialchars($esp['category']) ?></span>
              <?php if ($hasPhoto): ?>
                <span class="badge-done">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Foto Acquisita
                </span>
              <?php else: ?>
                <span class="badge-pending">Da fotografare</span>
              <?php endif; ?>
            </div>

            <h2 class="card-title"><?= htmlspecialchars($esp['title']) ?></h2>
            <p class="card-subtitle"><?= htmlspecialchars($esp['subtitle']) ?></p>

            <div class="card-guides-actions">
              <button type="button" class="btn-guide-link" onclick="openPlanogramModal('<?= htmlspecialchars($esp['title']) ?>', '<?= htmlspecialchars($esp['planigramma_img']) ?>', '<?= htmlspecialchars($esp['target_img']) ?>')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="3" y1="9" x2="21" y2="9"></line>
                  <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
                Vedi Planigramma Ideale
              </button>
            </div>
          </div>

          <div class="card-action-col">
            <?php if ($hasPhoto): ?>
              <div class="done-actions">
                <button type="button" class="btn-review-photo" onclick="previewTakenPhoto('<?= htmlspecialchars($esp['title']) ?>', '<?= htmlspecialchars($scatto['filepath']) ?>', '<?= htmlspecialchars($scatto['timestamp']) ?>')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  <span>Vedi Scatto</span>
                </button>
                <a href="camera.php?pv=<?= urlencode($currentPv['id']) ?>&espositore=<?= $esp['id'] ?>" class="btn-retake" title="Riscattata nuova foto">
                  Rifai scatto
                </a>
              </div>
            <?php else: ?>
              <a href="camera.php?pv=<?= urlencode($currentPv['id']) ?>&espositore=<?= $esp['id'] ?>" class="btn-shoot-action">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                  <circle cx="12" cy="13" r="4"></circle>
                </svg>
                <span>Scatta Foto</span>
              </a>
            <?php endif; ?>
          </div>
        </article>
      <?php endforeach; ?>
    </section>
  </main>

  <!-- Modal Anteprima Planigramma e Allestimento -->
  <div id="planogramModal" class="modal-overlay" style="display: none;">
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="modalPlanogramTitle" class="modal-title">Guida Allestimento</h3>
        <button type="button" class="btn-close-modal" onclick="closePlanogramModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="planogram-tabs">
          <button type="button" class="tab-btn active" id="tabSchemaBtn" onclick="switchGuideTab('schema')">Schema Planigramma</button>
          <button type="button" class="tab-btn" id="tabIdealBtn" onclick="switchGuideTab('ideal')">Foto Campione</button>
        </div>
        <div class="guide-image-view">
          <img id="modalGuideImage" src="" alt="Guida espositore" class="guide-img">
        </div>
        <p class="modal-help-text">Utilizza questo allestimento come riferimento visivo prima di inquadrare e scattare.</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-primary" onclick="closePlanogramModal()">Ho capito</button>
      </div>
    </div>
  </div>

  <!-- Modal Anteprima Scatto Effettuato -->
  <div id="photoPreviewModal" class="modal-overlay" style="display: none;">
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="modalPhotoTitle" class="modal-title">Foto Espositore</h3>
        <button type="button" class="btn-close-modal" onclick="closePhotoPreviewModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="taken-photo-container">
          <img id="modalPhotoImg" src="" alt="Scatto espositore" class="taken-img">
        </div>
        <div class="photo-info-bar">
          <span id="modalPhotoTimestamp" class="photo-timestamp"></span>
          <span class="badge-verified">✓ Caricata nel server</span>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" onclick="closePhotoPreviewModal()">Chiudi</button>
      </div>
    </div>
  </div>

  <script src="assets/js/app.js"></script>
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW fail:', err));
      });
    }
  </script>
</body>
</html>
