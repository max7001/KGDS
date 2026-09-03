/**
 * WebApp Karma - Espositori (WCAM 2.0)
 * Motore WebRTC Fotocamera HD & Native Camera Fallback
 * Garantisce funzionamento su qualsiasi smartphone, tablet o browser desktop (anche HTTP esterno)
 */

let currentStream = null;
let currentFacingMode = 'environment';
let isTorchOn = false;
let videoTrack = null;
let isWebRtcActive = false;

const videoEl = document.getElementById('cameraVideo');
const captureCanvas = document.getElementById('captureCanvas');
const fallbackBox = document.getElementById('fallbackViewfinderBox');
const cameraGrid = document.getElementById('cameraGrid');
const ghostOverlay = document.getElementById('ghostOverlayContainer');
const ghostSlider = document.getElementById('ghostSliderBar');
const btnGhost = document.getElementById('btnGhost');
const btnTorch = document.getElementById('btnTorch');
const btnSwitchCam = document.getElementById('btnSwitchCam');
const nativeCameraInput = document.getElementById('nativeCameraInput');
const fileGalleryInput = document.getElementById('fileGalleryInput');

window.addEventListener('DOMContentLoaded', () => {
  initCamera();
});

async function initCamera() {
  // Verifica contesto sicuro (HTTPS o localhost)
  const isSecure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !isSecure) {
    console.log("WebRTC MediaDevices non disponibile in questo contesto (richiede HTTPS o localhost). Attivazione fallback nativo ad alta risoluzione.");
    enableNativeCameraFallback();
    return;
  }

  stopCamera();

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
    console.warn("Tentativo fotocamera HD fallito, provo con vincoli base:", err);
    try {
      const basicConstraints = {
        audio: false,
        video: { facingMode: currentFacingMode }
      };
      const stream = await navigator.mediaDevices.getUserMedia(basicConstraints);
      attachStream(stream);
    } catch (fallbackErr) {
      console.warn("Accesso video WebRTC non consentito, attivo fotocamera nativa:", fallbackErr);
      enableNativeCameraFallback();
    }
  }
}

function attachStream(stream) {
  currentStream = stream;
  videoEl.srcObject = stream;
  videoTrack = stream.getVideoTracks()[0];
  isWebRtcActive = true;

  if (fallbackBox) fallbackBox.style.display = 'none';
  if (videoEl) videoEl.style.display = 'block';
  if (cameraGrid) cameraGrid.style.display = 'block';

  checkTorchSupport();
}

function enableNativeCameraFallback() {
  isWebRtcActive = false;
  stopCamera();

  if (videoEl) videoEl.style.display = 'none';
  if (cameraGrid) cameraGrid.style.display = 'none';
  if (fallbackBox) fallbackBox.style.display = 'flex';
  if (ghostSlider) ghostSlider.style.display = 'none';
  if (btnGhost) btnGhost.style.display = 'none';
  if (btnTorch) btnTorch.style.display = 'none';
  if (btnSwitchCam) btnSwitchCam.style.display = 'none';
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
    videoTrack = null;
    isWebRtcActive = false;
  }
}

// Switch fotocamera Posteriore / Anteriore
async function switchCamera() {
  if (!isWebRtcActive) return;
  currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
  await initCamera();
}

function checkTorchSupport() {
  if (!videoTrack) {
    if (btnTorch) btnTorch.style.display = 'none';
    return;
  }
  const capabilities = (typeof videoTrack.getCapabilities === 'function') ? videoTrack.getCapabilities() : {};
  if ('torch' in capabilities) {
    if (btnTorch) btnTorch.style.display = 'flex';
  } else {
    if (btnTorch) btnTorch.style.opacity = '0.35';
  }
}

async function toggleTorch() {
  if (!videoTrack) return;
  try {
    const capabilities = (typeof videoTrack.getCapabilities === 'function') ? videoTrack.getCapabilities() : {};
    if ('torch' in capabilities) {
      isTorchOn = !isTorchOn;
      await videoTrack.applyConstraints({
        advanced: [{ torch: isTorchOn }]
      });
      if (btnTorch) {
        btnTorch.classList.toggle('active-state', isTorchOn);
      }
    } else {
      alert("La torcia non è supportata dal sensore della fotocamera in uso.");
    }
  } catch (e) {
    console.warn("Errore attivazione torcia:", e);
  }
}

// Ghost Overlay Live
function toggleGhostOverlay() {
  const isVisible = (ghostOverlay.style.display !== 'none');
  if (isVisible) {
    ghostOverlay.style.display = 'none';
    ghostSlider.style.display = 'none';
    btnGhost.classList.remove('active-state');
  } else {
    ghostOverlay.style.display = 'flex';
    ghostSlider.style.display = 'flex';
    btnGhost.classList.add('active-state');
  }
}

function updateGhostOpacity(val) {
  const img = document.getElementById('ghostOverlayImg');
  const label = document.getElementById('ghostOpacityVal');
  if (img) img.style.opacity = (val / 100);
  if (label) label.textContent = val + '%';
}

function toggleReferenceModal(show) {
  const modal = document.getElementById('referenceModal');
  if (modal) modal.style.display = show ? 'flex' : 'none';
}

// Click sul pulsante di scatto centrale
function handleShutterClick() {
  if (isWebRtcActive && videoEl && videoEl.videoWidth > 0) {
    takeSnapshotWebRtc();
  } else {
    triggerNativeCamera();
  }
}

// Scatto da WebRTC Canvas
function takeSnapshotWebRtc() {
  if (navigator.vibrate) {
    navigator.vibrate([40]);
  }

  let width = videoEl.videoWidth || 1280;
  let height = videoEl.videoHeight || 720;

  captureCanvas.width = width;
  captureCanvas.height = height;
  const ctx = captureCanvas.getContext('2d');

  if (currentFacingMode === 'user') {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(videoEl, 0, 0, width, height);
  const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.92);
  openReviewScreen(dataUrl);
}

// Apertura Fotocamera Nativa dello smartphone
function triggerNativeCamera() {
  if (nativeCameraInput) {
    nativeCameraInput.click();
  }
}

// Apertura Galleria
function triggerGalleryPicker() {
  if (fileGalleryInput) {
    fileGalleryInput.click();
  }
}

// Caricamento file selezionato da fotocamera nativa o galleria
function handleFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    openReviewScreen(e.target.result);
  };
  reader.readAsDataURL(file);
}
