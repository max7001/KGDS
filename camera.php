<?php
/**
 * WebApp Karma - Espositori (WCAM 2.0)
 * Modulo Avanzato di Acquisizione Fotografica
 * Ottimizzato per utenti interni ed esterni su qualsiasi browser mobile/desktop
 */

require_once __DIR__ . '/includes/app_functions.php';
requireAuth();

$pvId = $_GET['pv'] ?? 'pv-verona';
$espositoreId = (int)($_GET['espositore'] ?? 101);

$pv = getPuntoVenditaById($pvId);
if (!$pv) {
    header('Location: shops.php');
    exit;
}

$allEspositori = getEspositoriList();
$currentEspositore = null;
foreach ($allEspositori as $e) {
    if ($e['id'] === $espositoreId) {
        $currentEspositore = $e;
        break;
    }
}

if (!$currentEspositore) {
    $currentEspositore = $allEspositori[0] ?? [
        'id' => 101,
        'title' => 'Espositore',
        'subtitle' => 'Metro lineare',
        'planigramma_img' => 'assets/images/planigramma.jpg',
        'target_img' => 'assets/images/esposizione.jpg'
    ];
}
?>
<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#000000">
  <title>Scatto: <?= htmlspecialchars($currentEspositore['title']) ?> - <?= htmlspecialchars($pv['name']) ?></title>
  
  <link rel="shortcut icon" type="image/png" href="assets/brand/favicon-16x16.png">
  <link rel="manifest" href="manifest.json">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  
  <link href="assets/css/modern.css" rel="stylesheet">
  <link href="assets/css/camera.css" rel="stylesheet">
</head>
<body class="camera-page">

  <!-- Input nativi di acquisizione: garantiscono compatibilità al 100% per utenti esterni -->
  <input type="file" id="nativeCameraInput" accept="image/*" capture="environment" class="sr-only" onchange="handleFileSelected(event)">
  <input type="file" id="fileGalleryInput" accept="image/*" class="sr-only" onchange="handleFileSelected(event)">

  <!-- Schermata Principale Viewfinder Fotocamera -->
  <div class="camera-viewport-container" id="cameraViewport">
    <!-- Stream Video Live (WebRTC se supportato) -->
    <video id="cameraVideo" playsinline autoplay muted class="camera-video-feed"></video>
    
    <!-- Canvas offscreen per cattura ed elaborazione -->
    <canvas id="captureCanvas" class="hidden-canvas"></canvas>

    <!-- Fallback Box se WebRTC non disponibile su HTTP o bloccato da browser -->
    <div id="fallbackViewfinderBox" class="fallback-camera-box" style="display: none;" onclick="triggerNativeCamera()">
      <div class="fallback-icon-ring">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
          <circle cx="12" cy="13" r="4"></circle>
        </svg>
      </div>
      <h2>Fotocamera Dispositivo Pronta</h2>
      <p>Tocca lo schermo o il pulsante in basso per attivare la fotocamera del tuo smartphone con autofocus HD.</p>
      <button type="button" class="btn-activate-native" onclick="event.stopPropagation(); triggerNativeCamera()">
        <span>Apri Fotocamera</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>

    <!-- Griglia Terzi / Allineamento -->
    <div id="cameraGrid" class="camera-grid-overlay visible">
      <div class="grid-line grid-h1"></div>
      <div class="grid-line grid-h2"></div>
      <div class="grid-line grid-v1"></div>
      <div class="grid-line grid-v2"></div>
      <div class="grid-center-cross"></div>
    </div>

    <!-- Ghost Overlay del Planigramma Live -->
    <div id="ghostOverlayContainer" class="ghost-overlay-wrapper" style="display: none;">
      <img id="ghostOverlayImg" src="<?= htmlspecialchars($currentEspositore['planigramma_img']) ?>" alt="Planigramma Guida" class="ghost-image">
    </div>

    <!-- Top Bar Controlli Fotocamera -->
    <header class="camera-top-bar">
      <a href="shops.php?pv=<?= urlencode($pv['id']) ?>" class="cam-nav-btn" aria-label="Torna indietro">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <span>Indietro</span>
      </a>

      <div class="cam-target-info">
        <span class="cam-target-pv"><?= htmlspecialchars($pv['name']) ?></span>
        <h1 class="cam-target-name"><?= htmlspecialchars($currentEspositore['title']) ?></h1>
      </div>

      <div class="cam-quick-actions">
        <!-- Tasto Torcia LED -->
        <button type="button" id="btnTorch" class="cam-icon-btn" title="Attiva/Disattiva Torcia LED" onclick="toggleTorch()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        </button>

        <!-- Tasto Switch Fotocamera (Fronte / Retro) -->
        <button type="button" id="btnSwitchCam" class="cam-icon-btn" title="Cambia Fotocamera" onclick="switchCamera()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3"></path>
            <polyline points="16 2 21 7 16 12"></polyline>
            <path d="M21 7H9"></path>
          </svg>
        </button>

        <!-- Tasto Ghost Planigramma -->
        <button type="button" id="btnGhost" class="cam-icon-btn active-state" title="Sovrapponi Planigramma Guida" onclick="toggleGhostOverlay()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        </button>
      </div>
    </header>

    <!-- Barra Slider Trasparenza Planigramma Live -->
    <div id="ghostSliderBar" class="ghost-slider-container" style="display: none;">
      <span class="slider-label">Guida Planigramma:</span>
      <input type="range" id="ghostOpacitySlider" min="10" max="90" value="40" oninput="updateGhostOpacity(this.value)">
      <span id="ghostOpacityVal" class="slider-val">40%</span>
    </div>

    <!-- Suggerimento guida inquadratura -->
    <div class="framing-hint-pill">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
      <span>Inquadra l'intero espositore perpendicolarmente</span>
    </div>

    <!-- Bottom Bar Scatto e Controlli -->
    <footer class="camera-bottom-bar">
      <!-- Sfoglia da Galleria -->
      <button type="button" class="cam-bottom-btn" title="Carica da Galleria" onclick="triggerGalleryPicker()">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        <span class="btn-subtext">Galleria</span>
      </button>

      <!-- Pulsante di Scatto Centrale -->
      <div class="shutter-wrapper">
        <button type="button" id="shutterBtn" class="shutter-button" onclick="handleShutterClick()" aria-label="Scatta fotografia">
          <div class="shutter-inner-ring"></div>
        </button>
      </div>

      <!-- Vedi Allestimento Ideale -->
      <button type="button" class="cam-bottom-btn" onclick="toggleReferenceModal(true)" title="Vedi Allestimento">
        <div class="ref-thumb-mini">
          <img src="<?= htmlspecialchars($currentEspositore['target_img']) ?>" alt="Campione" class="ref-thumb-img">
        </div>
        <span class="btn-subtext">Campione</span>
      </button>
    </footer>
  </div>

  <!-- Schermata Post-Scatto / Studio di Verifica e Revisione -->
  <div id="reviewScreen" class="review-viewport-container" style="display: none;">
    <header class="review-top-bar">
      <button type="button" class="review-action-btn" onclick="retakePhoto()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="1 4 1 10 7 10"></polyline>
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
        </svg>
        <span>Riprova</span>
      </button>

      <span class="review-title">Verifica Allestimento</span>

      <button type="button" class="review-action-btn primary" id="btnConfirmUpload" onclick="confirmAndUpload()">
        <span>Conferma e Salva</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </button>
    </header>

    <!-- Area Immagine con Ghost Overlay a confronto -->
    <div class="review-image-canvas-wrapper">
      <div class="review-comparison-container" id="reviewComparisonBox">
        <img id="reviewImagePreview" src="" alt="Anteprima Scatto" class="review-preview-img">
        <img id="reviewGhostOverlay" src="<?= htmlspecialchars($currentEspositore['planigramma_img']) ?>" alt="Planigramma" class="review-ghost-img" style="opacity: 0;">
      </div>
    </div>

    <!-- Barra Slider Confronto Planigramma Post-Scatto -->
    <div class="review-slider-bar">
      <span class="slider-text-label">Sovrapponi Planigramma:</span>
      <input type="range" id="reviewGhostSlider" min="0" max="100" value="0" oninput="updateReviewGhostOpacity(this.value)">
      <span id="reviewGhostVal" class="slider-val">0%</span>
    </div>

    <!-- Controlli Ritocco Rapido -->
    <div class="review-toolbox">
      <button type="button" class="tool-btn" onclick="rotatePreviewImage(90)">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
        <span>Ruota 90°</span>
      </button>

      <button type="button" class="tool-btn" id="btnAutoEnhance" onclick="toggleAutoEnhance()">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
        </svg>
        <span id="enhanceLabel">Auto Contrasto</span>
      </button>

      <button type="button" class="tool-btn" onclick="toggleNotesField()">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        <span>Note Scatto</span>
      </button>
    </div>

    <!-- Campo Note Opzionale -->
    <div id="notesContainer" class="review-notes-box" style="display: none;">
      <input type="text" id="photoNotesInput" class="notes-input" placeholder="Aggiungi note per questo allestimento...">
    </div>

    <!-- Barra di Caricamento / Upload Overlay -->
    <div id="uploadingProgressOverlay" class="uploading-overlay" style="display: none;">
      <div class="uploading-card">
        <div class="spinner-karma"></div>
        <h3>Compressione e Caricamento...</h3>
        <p>Salvataggio in corso sul server Karma</p>
      </div>
    </div>
  </div>

  <!-- Modal Riferimento Allestimento Campione -->
  <div id="referenceModal" class="modal-overlay" style="display: none;">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">Allestimento Ideale</h3>
        <button type="button" class="btn-close-modal" onclick="toggleReferenceModal(false)">&times;</button>
      </div>
      <div class="modal-body">
        <img src="<?= htmlspecialchars($currentEspositore['target_img']) ?>" alt="Allestimento Ideale" class="guide-img">
        <p class="modal-help-text">Verifica la disposizione corretta dei prodotti e dei cartellini come da foto campione.</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-primary" onclick="toggleReferenceModal(false)">Chiudi</button>
      </div>
    </div>
  </div>

  <script>
    window.APP_CONFIG = {
      pvId: '<?= htmlspecialchars($pv['id']) ?>',
      espositoreId: <?= (int)$currentEspositore['id'] ?>,
      planigrammaUrl: '<?= htmlspecialchars($currentEspositore['planigramma_img']) ?>',
      targetImgUrl: '<?= htmlspecialchars($currentEspositore['target_img']) ?>',
      uploadApiUrl: 'api/save_photo.php'
    };
  </script>
  <script src="assets/js/camera-engine.js"></script>
  <script src="assets/js/image-editor.js"></script>
</body>
</html>
