/**
 * Xtreme Machines – Adminpanel
 */

let allBikes = [];
let formImages = [];
let mainImage = '';
let editingId = null;
let pendingUploads = 0;

const viewList = document.getElementById('viewList');
const viewForm = document.getElementById('viewForm');
const bikeList = document.getElementById('bikeList');
const listCount = document.getElementById('listCount');
const listEmpty = document.getElementById('listEmpty');
const listSearch = document.getElementById('listSearch');
const bikeForm = document.getElementById('bikeForm');
const formTitle = document.getElementById('formTitle');
const formError = document.getElementById('formError');
const formSuccess = document.getElementById('formSuccess');
const imageGrid = document.getElementById('imageGrid');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

// ---- Auth check ----

async function checkAuth() {
  const res = await fetch('/api/admin/me');
  const data = await res.json();
  if (!data.loggedIn) {
    window.location.href = '/admin/';
    return false;
  }
  return true;
}

// ---- Navigation ----

function showView(view) {
  viewList.hidden = view !== 'list';
  viewForm.hidden = view !== 'form';

  document.querySelectorAll('.admin-nav__link[data-view]').forEach(btn => {
    btn.classList.toggle('admin-nav__link--active', btn.dataset.view === view && !btn.dataset.new);
  });
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => { toast.hidden = true; }, 3000);
}

// ---- Liste ----

async function loadBikes() {
  const res = await fetch('/api/admin/products');
  if (res.status === 401) {
    window.location.href = '/admin/';
    return;
  }
  allBikes = await res.json();
  renderList(allBikes);
}

function formatListPrice(price) {
  return price ? `${price},00 kr.` : '–';
}

function renderList(bikes) {
  listCount.textContent = `${bikes.length} motorcykel${bikes.length !== 1 ? 'er' : ''} i alt`;
  listEmpty.hidden = bikes.length > 0;
  bikeList.innerHTML = bikes.map(b => `
    <article class="bike-row" data-id="${b.id}">
      <img class="bike-row__thumb" src="${b.image}" alt="" loading="lazy">
      <div class="bike-row__info">
        <p class="bike-row__title">${escapeHtml(b.title)}</p>
        <p class="bike-row__meta">${formatListPrice(b.price)} · ${b.images?.length || 0} billeder</p>
      </div>
      <span class="bike-row__status bike-row__status--${b.status === 'sold' ? 'sold' : b.status === 'draft' ? 'draft' : 'available'}">
        ${b.status === 'sold' ? 'Solgt' : b.status === 'draft' ? 'Kladde' : 'Til salg'}
      </span>
      <div class="bike-row__actions">
        <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-action="edit" data-id="${b.id}">Rediger</button>
        ${b.status === 'sold'
          ? `<button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-action="unsold" data-id="${b.id}">Gør tilgængelig</button>`
          : `<button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-action="sold" data-id="${b.id}">Markér solgt</button>`
        }
        <button type="button" class="admin-btn admin-btn--danger admin-btn--small" data-action="delete" data-id="${b.id}">Slet</button>
      </div>
    </article>
  `).join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

listSearch.addEventListener('input', e => {
  const q = e.target.value.toLowerCase().trim();
  const filtered = q
    ? allBikes.filter(b =>
        b.title.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q)
      )
    : allBikes;
  renderList(filtered);
});

bikeList.addEventListener('click', async e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === 'edit') {
    openForm(id);
    return;
  }

  if (action === 'sold') {
    if (!confirm('Markér denne motorcykel som solgt? Den fjernes fra hjemmesiden.')) return;
    await patchSold(id, true);
    return;
  }

  if (action === 'unsold') {
    await patchSold(id, false);
    return;
  }

  if (action === 'delete') {
    if (!confirm('Er du sikker på, at du vil slette denne motorcykel permanent? Det kan ikke fortrydes.')) return;
    await deleteBike(id);
  }
});

async function patchSold(id, sold) {
  const res = await fetch(`/api/admin/products/${id}/sold`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sold }),
  });
  if (!res.ok) {
    showToast('Kunne ikke opdatere status');
    return;
  }
  showToast(sold ? 'Motorcykel markeret som solgt' : 'Motorcykel er tilgængelig igen');
  loadBikes();
}

async function deleteBike(id) {
  const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    showToast('Kunne ikke slette motorcykel');
    return;
  }
  showToast('Motorcykel slettet');
  loadBikes();
}

// ---- Formular ----

function openForm(id = null) {
  editingId = id;
  formError.hidden = true;
  formSuccess.hidden = true;
  bikeForm.reset();
  formImages = [];
  mainImage = '';

  if (id) {
    const bike = allBikes.find(b => b.id === id);
    if (!bike) return;
    formTitle.textContent = 'Rediger motorcykel';
    document.getElementById('bikeId').value = id;
    document.getElementById('title').value = bike.title;
    document.getElementById('description').value = bike.description;
    document.getElementById('price').value = bike.price;
    document.getElementById('downPayment').value = bike.downPayment || '';
    document.getElementById('monthly').value = bike.monthly || '';
    document.getElementById('note').value = bike.note || '';
    formImages = [...(bike.images || [])];
    mainImage = bike.image || formImages[0] || '';
  } else {
    formTitle.textContent = 'Ny motorcykel';
    document.getElementById('bikeId').value = '';
  }

  renderImageGrid();
  showView('form');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderImageGrid() {
  imageGrid.innerHTML = formImages.map(url => `
    <div class="image-item${url === mainImage ? ' image-item--main' : ''}" data-url="${url}">
      <img src="${url}" alt="">
      ${url === mainImage ? '<span class="image-item__badge">Hovedbillede</span>' : ''}
      <button type="button" class="image-item__remove" data-remove="${url}" aria-label="Fjern billede">×</button>
    </div>
  `).join('');
}

imageGrid.addEventListener('click', e => {
  const removeBtn = e.target.closest('[data-remove]');
  if (removeBtn) {
    e.stopPropagation();
    const url = removeBtn.dataset.remove;
    formImages = formImages.filter(u => u !== url);
    if (mainImage === url) mainImage = formImages[0] || '';
    renderImageGrid();
    return;
  }

  const item = e.target.closest('.image-item');
  if (item) {
    mainImage = item.dataset.url;
    renderImageGrid();
  }
});

// ---- Drag & drop upload ----

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drop-zone--active');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drop-zone--active');
});

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drop-zone--active');
  if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', e => {
  if (e.target.files.length) uploadFiles(e.target.files);
  e.target.value = '';
});

async function uploadFiles(fileList) {
  formError.hidden = true;

  let productId = editingId;
  if (!productId) {
    productId = await createDraftForUpload();
    if (!productId) return;
    editingId = productId;
    document.getElementById('bikeId').value = productId;
  }

  const formData = new FormData();
  for (const file of fileList) {
    formData.append('images', file);
  }

  pendingUploads++;
  document.getElementById('saveBtn').disabled = true;

  try {
    const res = await fetch(`/api/admin/products/${productId}/images`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload fejlede');

    formImages.push(...data.urls);
    if (!mainImage && formImages.length) mainImage = formImages[0];
    renderImageGrid();
    showToast(`${data.urls.length} billede${data.urls.length !== 1 ? 'r' : ''} uploadet`);
  } catch (err) {
    formError.textContent = err.message;
    formError.hidden = false;
  } finally {
    pendingUploads--;
    document.getElementById('saveBtn').disabled = pendingUploads > 0;
  }
}

async function createDraftForUpload() {
  const res = await fetch('/api/admin/products/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: document.getElementById('title').value.trim() || 'Ny motorcykel',
      description: document.getElementById('description').value.trim() || 'Udfyld specifikationer',
      price: document.getElementById('price').value.trim() || '0',
      downPayment: document.getElementById('downPayment').value.trim() || null,
      monthly: document.getElementById('monthly').value.trim() || null,
      note: document.getElementById('note').value.trim() || null,
    }),
  });

  if (!res.ok) {
    const data = await res.json();
    formError.textContent = data.error || 'Kunne ikke oprette kladde';
    formError.hidden = false;
    return null;
  }

  const product = await res.json();
  await loadBikes();
  return product.id;
}

// ---- Gem ----

bikeForm.addEventListener('submit', async e => {
  e.preventDefault();
  formError.hidden = true;
  formSuccess.hidden = true;

  if (!formImages.length) {
    formError.textContent = 'Upload mindst ét billede';
    formError.hidden = false;
    return;
  }

  const payload = {
    title: document.getElementById('title').value.trim(),
    description: document.getElementById('description').value.trim(),
    price: document.getElementById('price').value.trim(),
    downPayment: document.getElementById('downPayment').value.trim() || null,
    monthly: document.getElementById('monthly').value.trim() || null,
    note: document.getElementById('note').value.trim() || null,
    images: formImages,
    image: mainImage || formImages[0],
  };

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Gemmer…';

  try {
    const id = document.getElementById('bikeId').value;
    const url = id ? `/api/admin/products/${id}` : '/api/admin/products';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kunne ikke gemme');

    formSuccess.textContent = 'Motorcykel gemt – den vises nu på hjemmesiden';
    formSuccess.hidden = false;
    editingId = data.id;
    document.getElementById('bikeId').value = data.id;
    showToast('Gemt!');
    await loadBikes();

    setTimeout(() => {
      showView('list');
    }, 1200);
  } catch (err) {
    formError.textContent = err.message;
    formError.hidden = false;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Gem motorcykel';
  }
});

// ---- Navigation events ----

document.querySelectorAll('[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.view === 'form' && btn.dataset.new) {
      openForm(null);
    } else if (btn.dataset.view === 'list') {
      showView('list');
    }
  });
});

document.getElementById('newBikeBtn').addEventListener('click', () => openForm(null));
document.getElementById('backToListBtn').addEventListener('click', () => showView('list'));
document.getElementById('cancelFormBtn').addEventListener('click', () => showView('list'));

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  window.location.href = '/admin/';
});

// ---- Init ----

(async () => {
  if (await checkAuth()) {
    await loadBikes();
    showView('list');
  }
})();
