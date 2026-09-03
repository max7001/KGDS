/**
 * WebApp Karma - Espositori (WCAM 2.0)
 * Modulo Fotocamera Dual-Engine per Vercel SPA (WebRTC + Native Camera)
 */

const CameraController = (function() {
  let currentStream = null;
  let currentFacingMode = 'environment';
  let isWebRtcActive = false;
  let currentContext = {
    groupId: null,
    shopId: null,
    exId: null,
    exTitle: '',
    shopName: '',
    planImgUrl: '',
    targetImgUrl: ''
  };

  const viewCamera = document.getElementById('viewCamera');
  const videoEl = document.getElementById('liveVideoFeed');
  const canvasEl = document.getElementById('cameraCanvasOffscreen');
  const fallbackBox = document.getElementById('cameraFallbackBox');
  const gridOverlay = document.getElementById('gridOverlay');
  const ghostOverlay = document.getElementById('ghostOverlayWrapper');
  const ghostImg = document.getElementById('ghostOverlayImg');
  const ghostSlider = document.getElementById('liveGhostSliderBar');
  const btnGhost = document.getElementById('btnLiveGhost');
  const btnSwitch = document.getElementById('btnSwitchCam');
  const nativeInput = document.getElementById('cameraNativeFileInput');
  const galleryInput = document.getElementById('cameraGalleryFileInput');
  const targetThumb = document.getElementById('camTargetSampleThumb');

  // Avvio fotocamera per un espositore specifico
  async function openCamera(ctx) {
    currentContext = { ...ctx };

    // Imposta titoli e riferimenti
    document.getElementById('cameraTargetPvLabel').textContent = currentContext.shopName || 'Punto Vendita';
    document.getElementById('cameraTargetExTitle').textContent = currentContext.exTitle || 'Espositore';

    if (currentContext.planImgUrl) {
      ghostImg.src = currentContext.planImgUrl;
      btnGhost.style.display = 'flex';
    } else {
      btnGhost.style.display = 'none';
      ghostOverlay.style.display = 'none';
      ghostSlider.style.display = 'none';
    }

    if (currentContext.targetImgUrl) {
      targetThumb.src = currentContext.targetImgUrl;
    }

    // Mostra vista camera a schermo intero
    viewCamera.style.display = 'flex';

    // Inizializza stream o attiva fallback nativo
    await initStream();
  }

  function closeCamera() {
    stopStream();
    viewCamera.style.display = 'none';
    if (typeof AppRouter !== 'undefined' && AppRouter.returnToShop) {
      AppRouter.returnToShop();
    }
  }

  async function initStream() {
    const isSecure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !isSecure) {
      console.log("WebRTC non consentito in questo contesto. Attivazione fotocamera nativa dello smartphone.");
      activateNativeFallback();
      return;
    }

    stopStream();

    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: currentFacingMode },
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 }
      }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      attachStream(stream);
    } catch (err) {
      console.warn("Tentativo stream HD non riuscito, provo vincoli base:", err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: currentFacingMode } });
        attachStream(stream);
      } catch (fallbackErr) {
        console.warn("Accesso video negato, attivo fallback nativo:", fallbackErr);
        activateNativeFallback();
      }
    }
  }

  function attachStream(stream) {
    currentStream = stream;
    videoEl.srcObject = stream;
    isWebRtcActive = true;

    fallbackBox.style.display = 'none';
    videoEl.style.display = 'block';
    gridOverlay.style.display = 'block';
    if (btnSwitch) btnSwitch.style.display = 'flex';
  }

  function activateNativeFallback() {
    isWebRtcActive = false;
    stopStream();

    videoEl.style.display = 'none';
    gridOverlay.style.display = 'none';
    fallbackBox.style.display = 'flex';
    ghostSlider.style.display = 'none';
    if (btnGhost) btnGhost.style.display = 'none';
    if (btnSwitch) btnSwitch.style.display = 'none';
  }

  function stopStream() {
    if (currentStream) {
      currentStream.getTracks().forEach(t => t.stop());
      currentStream = null;
      isWebRtcActive = false;
    }
  }

  async function switchCamera() {
    if (!isWebRtcActive) return;
    currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
    await initStream();
  }

  function toggleLiveGhost() {
    const isVis = (ghostOverlay.style.display !== 'none');
    if (isVis) {
      ghostOverlay.style.display = 'none';
      ghostSlider.style.display = 'none';
      btnGhost.classList.remove('active-state');
    } else {
      ghostOverlay.style.display = 'flex';
      ghostSlider.style.display = 'flex';
      btnGhost.classList.add('active-state');
    }
  }

  function updateLiveGhostOpacity(val) {
    if (ghostImg) ghostImg.style.opacity = (val / 100);
    const label = document.getElementById('liveGhostVal');
    if (label) label.textContent = val + '%';
  }

  function handleShutterClick() {
    if (isWebRtcActive && videoEl && videoEl.videoWidth > 0) {
      takeSnapshot();
    } else {
      triggerNativeCapture();
    }
  }

  function takeSnapshot() {
    if (navigator.vibrate) navigator.vibrate([40]);

    let videoW = videoEl.videoWidth || 1280;
    let videoH = videoEl.videoHeight || 720;

    // Richiesta: La foto avrà formato verticale (portrait)
    let srcX = 0;
    let srcY = 0;
    let srcW = videoW;
    let srcH = videoH;

    // Se lo stream è orizzontale, ritaglia al centro in formato verticale 3:4
    if (videoW > videoH) {
      srcW = Math.round(videoH * (3 / 4));
      srcX = Math.round((videoW - srcW) / 2);
    }

    canvasEl.width = srcW;
    canvasEl.height = srcH;
    const ctx = canvasEl.getContext('2d');

    if (currentFacingMode === 'user') {
      ctx.translate(srcW, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(videoEl, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
    const dataUrl = canvasEl.toDataURL('image/jpeg', 0.92);

    closeCamera();
    EditorController.openStudio(dataUrl, currentContext);
  }

  function triggerNativeCapture() {
    if (nativeInput) nativeInput.click();
  }

  function triggerGalleryCapture() {
    if (galleryInput) galleryInput.click();
  }

  function handleFileCapture(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      const dataUrl = e.target.result;
      const img = new Image();
      img.onload = function() {
        let srcW = img.width;
        let srcH = img.height;
        let srcX = 0;
        let srcY = 0;

        // Assicura formato verticale
        if (srcW > srcH) {
          srcW = Math.round(srcH * (3 / 4));
          srcX = Math.round((img.width - srcW) / 2);
        }

        const cv = document.createElement('canvas');
        cv.width = srcW;
        cv.height = srcH;
        const ctx = cv.getContext('2d');
        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
        const verticalDataUrl = cv.toDataURL('image/jpeg', 0.92);

        closeCamera();
        EditorController.openStudio(verticalDataUrl, currentContext);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function showTargetSampleModal() {
    if (currentContext.targetImgUrl) {
      openGuideModal('Allestimento Ideale - ' + currentContext.exTitle, currentContext.targetImgUrl);
    }
  }

  return {
    openCamera,
    closeCamera,
    switchCamera,
    toggleLiveGhost,
    updateLiveGhostOpacity,
    handleShutterClick,
    triggerNativeCapture,
    triggerGalleryCapture,
    handleFileCapture,
    showTargetSampleModal
  };
})();

// Global wrappers per HTML onclick
function closeCamera() { CameraController.closeCamera(); }
function switchCameraFeed() { CameraController.switchCamera(); }
function toggleLiveGhost() { CameraController.toggleLiveGhost(); }
function updateLiveGhostOpacity(val) { CameraController.updateLiveGhostOpacity(val); }
function performShutterClick() { CameraController.handleShutterClick(); }
function triggerCameraCapture() { CameraController.triggerNativeCapture(); }
function triggerGalleryCapture() { CameraController.triggerGalleryCapture(); }
function handleFileCapture(e) { CameraController.handleFileCapture(e); }
function showTargetSampleModal() { CameraController.showTargetSampleModal(); }
