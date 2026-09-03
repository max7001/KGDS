/**
 * WebApp Karma - Espositori (WCAM 2.0)
 * Studio di Revisione & Allineamento Planigramma Ghost Post-Scatto
 */

const EditorController = (function() {
  let currentPhotoDataUrl = null;
  let currentContext = null;
  let isContrastEnhanced = false;

  const studioScreen = document.getElementById('reviewStudioScreen');
  const capturedPhoto = document.getElementById('reviewCapturedPhoto');
  const ghostPlanigramma = document.getElementById('reviewGhostPlanigramma');
  const ghostSlider = document.getElementById('reviewGhostSlider');
  const ghostValLabel = document.getElementById('reviewGhostVal');
  const spinnerOverlay = document.getElementById('uploadSpinnerOverlay');
  const btnContrast = document.getElementById('btnAutoContrast');

  function openStudio(dataUrl, ctx) {
    currentPhotoDataUrl = dataUrl;
    currentContext = ctx;
    isContrastEnhanced = false;

    capturedPhoto.src = dataUrl;
    capturedPhoto.style.filter = 'none';

    // Se l'espositore ha un planigramma, caricalo per il confronto Ghost
    if (currentContext && currentContext.planImgUrl) {
      ghostPlanigramma.src = currentContext.planImgUrl;
      ghostPlanigramma.style.display = 'block';
      ghostSlider.parentElement.style.display = 'flex';
      ghostPlanigramma.style.opacity = '0';
      ghostSlider.value = '0';
      ghostValLabel.textContent = '0%';
    } else {
      ghostPlanigramma.style.display = 'none';
      ghostSlider.parentElement.style.display = 'none';
    }

    if (btnContrast) btnContrast.classList.remove('active');

    studioScreen.style.display = 'flex';
  }

  function closeStudio() {
    studioScreen.style.display = 'none';
    currentPhotoDataUrl = null;
  }

  function updateGhostTransparency(val) {
    if (ghostPlanigramma) {
      ghostPlanigramma.style.opacity = (val / 100);
    }
    if (ghostValLabel) {
      ghostValLabel.textContent = val + '%';
    }
  }

  function rotateImage(degrees = 90) {
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
      capturedPhoto.src = currentPhotoDataUrl;
    };
    img.src = currentPhotoDataUrl;
  }

  function toggleContrast() {
    isContrastEnhanced = !isContrastEnhanced;
    if (btnContrast) btnContrast.classList.toggle('active', isContrastEnhanced);

    if (isContrastEnhanced) {
      capturedPhoto.style.filter = 'contrast(1.15) brightness(1.08) saturate(1.1)';
    } else {
      capturedPhoto.style.filter = 'none';
    }
  }

  function compressImage(dataUrl, maxDimension = 1920, quality = 0.85) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = function() {
        let srcX = 0, srcY = 0;
        let srcW = img.width, srcH = img.height;

        // Richiesta: La foto avrà formato verticale
        if (srcW > srcH) {
          srcW = Math.round(srcH * (3 / 4));
          srcX = Math.round((img.width - srcW) / 2);
        }

        let width = srcW;
        let height = srcH;

        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (isContrastEnhanced) {
          ctx.filter = 'contrast(1.15) brightness(1.08) saturate(1.1)';
        }

        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = dataUrl;
    });
  }

  async function submitPhoto() {
    if (!currentPhotoDataUrl || !currentContext) return;

    spinnerOverlay.style.display = 'flex';

    try {
      // 1. Compressione intelligente client-side prima del caricamento
      const compressedDataUrl = await compressImage(currentPhotoDataUrl);

      // 2. Invio e salvataggio su Firebase (fotografia e record statistico)
      const currentAgent = localStorage.getItem('karma_logged_user') || 'Agente';
      const inspectionPayload = {
        groupId: currentContext.groupId,
        chain: currentContext.chainName || '',
        shopId: currentContext.shopId,
        shop: currentContext.shopName,
        exId: currentContext.exId,
        exTitle: currentContext.exTitle,
        agent: currentAgent,
        imageBase64: compressedDataUrl
      };

      const fbResult = await KarmaAPI.saveInspection(inspectionPayload);

      // 3. Invio sincrono al database di karmaitaliana.it/wcam
      try {
        await KarmaAPI.uploadPhoto(
          currentContext.groupId,
          currentContext.shopId,
          currentContext.exId,
          compressedDataUrl
        );
      } catch (kErr) {
        console.warn("Upload secondario karma:", kErr);
      }

      spinnerOverlay.style.display = 'none';

      closeStudio();
      // Ritorna immediatamente alla schermata del negozio con l'espositore aggiornato
      AppRouter.returnToShop(currentContext.exId);
    } catch (err) {
      console.error("Errore durante l'upload:", err);
      spinnerOverlay.style.display = 'none';
      alert("Errore di connessione durante l'invio della fotografia. Verifica la rete.");
    }
  }

  return {
    openStudio,
    closeStudio,
    updateGhostTransparency,
    rotateImage,
    toggleContrast,
    submitPhoto
  };
})();

// Global wrappers per onclick
function cancelReviewAndRetake() { EditorController.closeStudio(); }
function updateReviewGhostTransparency(val) { EditorController.updateGhostTransparency(val); }
function rotateCapturedImage(deg) { EditorController.rotateImage(deg); }
function toggleAutoContrast() { EditorController.toggleContrast(); }
function submitFinalPhoto() { EditorController.submitPhoto(); }
