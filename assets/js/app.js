/**
 * WebApp Karma - Espositori (WCAM 2.0)
 * Controller Frontend Dashboard, Filtri e Modali
 */

function switchPv(pvId) {
  window.location.href = 'shops.php?pv=' + encodeURIComponent(pvId);
}

// Filtro di ricerca per testo
function filterEspositori() {
  const query = document.getElementById('espositoreSearch').value.toLowerCase().trim();
  const activeTab = document.querySelector('.filter-tab.active');
  const statusFilter = activeTab ? activeTab.getAttribute('data-filter') : 'all';
  
  const cards = document.querySelectorAll('.espositore-card');
  cards.forEach(card => {
    const title = card.getAttribute('data-title') || '';
    const cat = card.getAttribute('data-cat') || '';
    const status = card.getAttribute('data-status') || '';
    
    const matchesText = !query || title.includes(query) || cat.includes(query);
    const matchesStatus = (statusFilter === 'all') || (statusFilter === status);
    
    if (matchesText && matchesStatus) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
}

// Filtro per stato (Tutti, Da fare, Fatti)
function setFilter(filterType, buttonEl) {
  document.querySelectorAll('.filter-tab').forEach(btn => btn.classList.remove('active'));
  buttonEl.classList.add('active');
  filterEspositori();
}

// Modal Planigramma Guida
let currentGuideSchema = '';
let currentGuideIdeal = '';

function openPlanogramModal(title, schemaImg, idealImg) {
  currentGuideSchema = schemaImg;
  currentGuideIdeal = idealImg;
  
  document.getElementById('modalPlanogramTitle').textContent = title + ' - Guida Allestimento';
  switchGuideTab('schema');
  
  const modal = document.getElementById('planogramModal');
  modal.style.display = 'flex';
}

function switchGuideTab(tab) {
  const schemaBtn = document.getElementById('tabSchemaBtn');
  const idealBtn = document.getElementById('tabIdealBtn');
  const img = document.getElementById('modalGuideImage');

  if (tab === 'schema') {
    schemaBtn.classList.add('active');
    idealBtn.classList.remove('active');
    img.src = currentGuideSchema;
  } else {
    idealBtn.classList.add('active');
    schemaBtn.classList.remove('active');
    img.src = currentGuideIdeal;
  }
}

function closePlanogramModal() {
  document.getElementById('planogramModal').style.display = 'none';
}

// Modal Anteprima Scatto Effettuato
function previewTakenPhoto(title, photoUrl, timestamp) {
  document.getElementById('modalPhotoTitle').textContent = title + ' - Scatto Effettuato';
  document.getElementById('modalPhotoImg').src = photoUrl;
  document.getElementById('modalPhotoTimestamp').textContent = 'Rilevato il: ' + (timestamp || 'Oggi');
  
  const modal = document.getElementById('photoPreviewModal');
  modal.style.display = 'flex';
}

function closePhotoPreviewModal() {
  document.getElementById('photoPreviewModal').style.display = 'none';
}

// Chiusura modali su click fuori dal box
window.addEventListener('click', function(e) {
  const planogramModal = document.getElementById('planogramModal');
  const photoPreviewModal = document.getElementById('photoPreviewModal');
  if (e.target === planogramModal) closePlanogramModal();
  if (e.target === photoPreviewModal) closePhotoPreviewModal();
});

// Chiusura modali con tasto ESC
window.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closePlanogramModal();
    closePhotoPreviewModal();
  }
});
