/**
 * WebApp Karma - Espositori (WCAM 2.0)
 * Studio di Revisione Scatto, Allineamento Ghost Planigramma, Compressione ed Invio
 */

let currentPhotoDataUrl = null;
let currentRotation = 0;
let isEnhanced = false;

const reviewScreen = document.getElementById('reviewScreen');
const reviewPreview = document.getElementById('reviewImagePreview');
const reviewGhostOverlay = document.getElementById('reviewGhostOverlay');
const progressOverlay = document.getElementById('uploadingProgressOverlay');

function openReviewScreen(dataUrl) {
  currentPhotoDataUrl = dataUrl;
  currentRotation = 0;
  isEnhanced = false;
  
  reviewPreview.src = dataUrl;
  reviewPreview.style.transform = 'none';
  reviewPreview.style.filter = 'none';

  if (reviewGhostOverlay) {
    reviewGhostOverlay.style.opacity = '0';
  }
  const slider = document.getElementById('reviewGhostSlider');
  if (slider) slider.value = '0';
  const label = document.getElementById('reviewGhostVal');
  if (label) label.textContent = '0%';
  
  const btnEnhance = document.getElementById('btnAutoEnhance');
  if (btnEnhance) btnEnhance.classList.remove('active');
  
  reviewScreen.style.display = 'flex';
}

function retakePhoto() {
  reviewScreen.style.display = 'none';
  currentPhotoDataUrl = null;
}

// Aggiorna la sovrapposizione del planigramma sullo scatto
function updateReviewGhostOpacity(val) {
  if (reviewGhostOverlay) {
    reviewGhostOverlay.style.opacity = (val / 100);
  }
  const label = document.getElementById('reviewGhostVal');
  if (label) label.textContent = val + '%';
}

// Rotazione 90° con elaborazione Canvas reale
function rotatePreviewImage(degrees = 90) {
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = img.height;
    canvas.height = img.width;
    
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((degrees * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    
    currentPhotoDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    reviewPreview.src = currentPhotoDataUrl;
  };
  img.src = currentPhotoDataUrl;
}

// Ottimizzazione automatica contrasto/luminosità
function toggleAutoEnhance() {
  isEnhanced = !isEnhanced;
  const btn = document.getElementById('btnAutoEnhance');
  if (btn) btn.classList.toggle('active', isEnhanced);

  if (isEnhanced) {
    reviewPreview.style.filter = 'contrast(1.15) brightness(1.08) saturate(1.1)';
  } else {
    reviewPreview.style.filter = 'none';
  }
}

function toggleNotesField() {
  const box = document.getElementById('notesContainer');
  if (box) {
    box.style.display = (box.style.display === 'none' ? 'block' : 'none');
    if (box.style.display === 'block') {
      document.getElementById('photoNotesInput').focus();
    }
  }
}

/**
 * Comprime e ridimensiona l'immagine prima del caricamento
 * Essenziale per utenti esterni su reti mobili (3G/4G/5G)
 */
function compressImage(dataUrl, maxDimension = 1920, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = function() {
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (isEnhanced) {
        ctx.filter = 'contrast(1.15) brightness(1.08) saturate(1.1)';
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };
    img.src = dataUrl;
  });
}

// Conferma e invio al server
async function confirmAndUpload() {
  if (!currentPhotoDataUrl) return;

  progressOverlay.style.display = 'flex';
  const notes = document.getElementById('photoNotesInput') ? document.getElementById('photoNotesInput').value.trim() : '';

  try {
    const finalDataUrl = await compressImage(currentPhotoDataUrl);

    const payload = {
      pv_id: window.APP_CONFIG.pvId,
      espositore_id: window.APP_CONFIG.espositoreId,
      notes: notes,
      image_base64: finalDataUrl
    };

    const response = await fetch(window.APP_CONFIG.uploadApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.status === 'success') {
      window.location.href = 'shops.php?pv=' + encodeURIComponent(window.APP_CONFIG.pvId) + '&saved=1';
    } else {
      alert("Errore salvataggio: " + (result.message || "Errore sconosciuto"));
      progressOverlay.style.display = 'none';
    }
  } catch (err) {
    console.error("Errore di rete durante upload:", err);
    saveToOfflineQueue(window.APP_CONFIG.pvId, window.APP_CONFIG.espositoreId, currentPhotoDataUrl, notes);
    alert("Attenzione: connessione assente o instabile. La fotografia è stata salvata temporaneamente sul dispositivo e verrà sincronizzata appena tornerà la rete.");
    window.location.href = 'shops.php?pv=' + encodeURIComponent(window.APP_CONFIG.pvId) + '&offline=1';
  }
}

function saveToOfflineQueue(pvId, espositoreId, dataUrl, notes) {
  try {
    const queue = JSON.parse(localStorage.getItem('karma_offline_queue') || '[]');
    queue.push({
      pvId,
      espositoreId,
      dataUrl,
      notes,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('karma_offline_queue', JSON.stringify(queue));
  } catch (e) {
    console.warn("Impossibile salvare nella coda offline:", e);
  }
}
