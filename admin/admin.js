/**
 * Xtreme Machines Admin v2
 * Spejler produktsidens layout. Upload, sortering og gem i én flow.
 */

const state = {
  view: 'list',
  bikes: [],
  productId: null,
  product: null,
  images: [],
  specLines: [''],
  cc: '',
  gears: '',
  km: '',
  title: '',
  price: '',
  downPayment: '',
  monthly: '',
  note: '',
  saving: false,
  uploading: false,
  uploadProgress: '',
  dragImageIdx: null,
  dragSpecIdx: null,
  message: { type: '', text: '' },
};

// ---- API ----

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { error: text }; }
  }

  if (res.status === 401) {
    window.location.href = '/admin/';
    throw new Error('Ikke logget ind');
  }

  if (!res.ok) {
    throw new Error(data?.error || `Fejl ${res.status}`);
  }

  return data;
}

// ---- Spec helpers ----

function buildDescription() {
  const parts = [];
  if (state.cc.trim()) parts.push(`${state.cc.trim()} CC`);
  if (state.gears.trim()) parts.push(`${state.gears.trim()} GEAR`);
  if (state.km.trim()) parts.push(`KM. ${state.km.trim().replace(/\./g, '')}`);
  state.specLines
    .map(s => s.trim())
    .filter(Boolean)
    .forEach(s => parts.push(s.toUpperCase()));
  return parts.length ? `${parts.join(' - ')}.` : '';
}

function parseDescription(description = '') {
  const parts = String(description)
    .split(' - ')
    .map(s => s.trim().replace(/\.$/, ''))
    .filter(Boolean);

  let cc = '';
  let gears = '';
  let km = '';
  const specs = [];

  for (const part of parts) {
    const ccM = part.match(/^(\d+)\s*CC$/i);
    if (ccM) { cc = ccM[1]; continue; }
    const gearM = part.match(/^(\d+)\s*GEAR$/i);
    if (gearM) { gears = gearM[1]; continue; }
    const kmM = part.match(/^KM\.?\s*(.+)$/i);
    if (kmM) { km = kmM[1].replace(/\./g, ''); continue; }
    specs.push(part);
  }

  return { cc, gears, km, specs };
}

function getPreviewSpecs() {
  const items = [];
  if (state.cc.trim()) items.push(`${state.cc.trim()} CC`);
  if (state.gears.trim()) items.push(`${state.gears.trim()} GEAR`);
  if (state.km.trim()) items.push(`KM. ${state.km.trim()}`);
  state.specLines.filter(s => s.trim()).forEach(s => items.push(s.trim()));
  return items;
}

function imageSrc(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith('/') ? url : `/${url}`;
}

function relativePath(url) {
  if (!url) return '';
  try {
    if (url.startsWith('/')) return url;
    const u = new URL(url);
    return u.pathname;
  } catch {
    return url;
  }
}

// ---- Image compression (Netlify 6MB limit) ----

async function compressFile(file, maxDim = 1024, quality = 0.72) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  let q = quality;
  let blob = await canvasToBlob(canvas, q);

  while (blob.size > 450000 && q > 0.4) {
    q -= 0.08;
    blob = await canvasToBlob(canvas, q);
  }

  const name = (file.name || 'billede').replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Komprimering fejlede'))), 'image/jpeg', quality);
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Kunne ikke læse fil'));
    reader.readAsDataURL(file);
  });
}

// ---- Data loading ----

async function loadBikes() {
  state.bikes = await api('/api/admin/products');
}

async function ensureProductId() {
  if (state.productId) return state.productId;

  const draft = await api('/api/admin/products/draft', {
    method: 'POST',
    body: JSON.stringify({
      title: state.title.trim() || 'Ny motorcykel',
      price: state.price.trim() || '0',
      description: buildDescription() || 'Udfyld specifikationer',
      cc: state.cc,
      gears: state.gears,
      km: state.km,
      specs: state.specLines.filter(s => s.trim()),
    }),
  });

  state.productId = draft.id;
  state.product = draft;
  return draft.id;
}

async function openEditor(id = null) {
  state.message = { type: '', text: '' };

  if (id) {
    const bike = await api(`/api/admin/products/${id}`);
    state.productId = bike.id;
    state.product = bike;
    state.title = bike.title;
    state.price = bike.price || '';
    state.downPayment = bike.downPayment || '';
    state.monthly = bike.monthly || '';
    state.note = bike.note || '';
    const parsed = parseDescription(bike.description);
    state.cc = parsed.cc;
    state.km = parsed.km ? parsed.km.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
    state.gears = parsed.gears;
    state.specLines = parsed.specs.length ? parsed.specs : [''];
    state.images = (bike.images || []).map((url, i) => ({
      id: `img-${i}-${Date.now()}`,
      url,
      main: relativePath(url) === relativePath(bike.image) || i === 0,
    }));
    if (state.images.length && !state.images.some(img => img.main)) {
      state.images[0].main = true;
    }
  } else {
    state.productId = null;
    state.product = null;
    state.title = '';
    state.price = '';
    state.downPayment = '';
    state.monthly = '';
    state.note = '';
    state.cc = '';
    state.gears = '';
    state.km = '';
    state.specLines = [''];
    state.images = [];
  }

  state.view = 'edit';
  render();
}

async function saveProduct() {
  state.message = { type: '', text: '' };

  if (!state.title.trim()) {
    state.message = { type: 'error', text: 'Titel er påkrævet' };
    render();
    return;
  }
  if (!buildDescription()) {
    state.message = { type: 'error', text: 'Udfyld mindst CC, gear, km eller én specifikationslinje' };
    render();
    return;
  }
  if (!state.price.trim()) {
    state.message = { type: 'error', text: 'Pris er påkrævet' };
    render();
    return;
  }
  if (!state.images.length) {
    state.message = { type: 'error', text: 'Upload mindst ét billede' };
    render();
    return;
  }

  state.saving = true;
  render();

  try {
    await ensureProductId();

    const mainImg = state.images.find(i => i.main) || state.images[0];
    const images = state.images.map(i => relativePath(i.url));
    const mainPath = relativePath(mainImg.url);

    const payload = {
      title: state.title.trim(),
      cc: state.cc.trim(),
      gears: state.gears.trim(),
      km: state.km.trim(),
      specs: state.specLines.filter(s => s.trim()),
      description: buildDescription(),
      price: state.price.trim(),
      downPayment: state.downPayment.trim() || null,
      monthly: state.monthly.trim() || null,
      note: state.note.trim() || null,
      images,
      image: mainPath,
    };

    const saved = await api(`/api/admin/products/${state.productId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    state.product = saved;
    toast('Motorcykel gemt – vises nu på hjemmesiden');
    await loadBikes();
    state.view = 'list';
    state.saving = false;
    render();
  } catch (err) {
    state.saving = false;
    state.message = { type: 'error', text: err.message };
    render();
  }
}

async function uploadFiles(fileList) {
  if (!fileList.length) return;

  state.uploading = true;
  state.message = { type: '', text: '' };
  render();

  try {
    await ensureProductId();
    const files = [...fileList].filter(f => f.type.startsWith('image/'));
    let done = 0;

    for (const file of files) {
      state.uploadProgress = `Uploader ${done + 1} af ${files.length}…`;
      render();

      const compressed = await compressFile(file);
      const data = await fileToBase64(compressed);

      const result = await api(`/api/admin/products/${state.productId}/images`, {
        method: 'POST',
        body: JSON.stringify({ images: [{ name: compressed.name, data }] }),
      });

      const newUrls = result.urls || [];
      newUrls.forEach(url => {
        state.images.push({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          url,
          main: state.images.length === 0,
        });
      });

      if (result.product?.images) {
        state.images = result.product.images.map((url, i) => ({
          id: state.images[i]?.id || `img-${i}-${Date.now()}`,
          url,
          main: relativePath(url) === relativePath(result.product.image),
        }));
        if (!state.images.some(i => i.main) && state.images.length) {
          state.images[0].main = true;
        }
      }

      done++;
    }

    toast(`${done} billede${done !== 1 ? 'r' : ''} uploadet`);
  } catch (err) {
    state.message = { type: 'error', text: err.message };
  } finally {
    state.uploading = false;
    state.uploadProgress = '';
    render();
  }
}

async function removeImage(idx) {
  const img = state.images[idx];
  if (!img) return;

  if (state.productId && img.url && !img.url.startsWith('blob:')) {
    try {
      await api(`/api/admin/products/${state.productId}/images`, {
        method: 'DELETE',
        body: JSON.stringify({ url: relativePath(img.url) }),
      });
    } catch (err) {
      state.message = { type: 'error', text: err.message };
      render();
      return;
    }
  }

  const wasMain = img.main;
  state.images.splice(idx, 1);
  if (wasMain && state.images.length) state.images[0].main = true;
  render();
}

function setMainImage(idx) {
  state.images.forEach((img, i) => { img.main = i === idx; });
  render();
}

function moveImage(from, to) {
  if (from === to || from < 0 || to < 0 || from >= state.images.length || to >= state.images.length) return;
  const [item] = state.images.splice(from, 1);
  state.images.splice(to, 0, item);
  render();
}

async function deleteBike(id) {
  if (!confirm('Slet denne motorcykel permanent?')) return;
  try {
    await api(`/api/admin/products/${id}`, { method: 'DELETE' });
    toast('Motorcykel slettet');
    await loadBikes();
    render();
  } catch (err) {
    toast(err.message, true);
  }
}

async function toggleSold(id, sold) {
  try {
    await api(`/api/admin/products/${id}/sold`, {
      method: 'PATCH',
      body: JSON.stringify({ sold }),
    });
    toast(sold ? 'Markeret som solgt' : 'Tilgængelig igen');
    await loadBikes();
    render();
  } catch (err) {
    toast(err.message, true);
  }
}

// ---- UI helpers ----

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  el.style.borderColor = isError ? 'rgba(227,30,36,0.5)' : '';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 3000);
}

function formatPrice(v) {
  return v ? `${v},00 kr.` : '–';
}

// ---- Render ----

function render() {
  const app = document.getElementById('app');
  if (state.view === 'list') {
    app.innerHTML = renderList();
    bindListEvents();
  } else {
    app.innerHTML = renderEditor();
    bindEditorEvents();
  }
}

function renderShell(content) {
  return `
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <div class="admin-sidebar__brand">
          <p>Xtreme Machines</p>
          <span>Admin</span>
        </div>
        <nav class="admin-nav">
          <button type="button" class="admin-nav__btn${state.view === 'list' ? ' admin-nav__btn--active' : ''}" data-action="list">Motorcykler</button>
          <button type="button" class="admin-nav__btn${state.view === 'edit' && !state.productId ? ' admin-nav__btn--active' : ''}" data-action="new">Ny motorcykel</button>
        </nav>
        <button type="button" class="admin-nav__btn" data-action="logout">Log ud</button>
      </aside>
      <main class="admin-main">${content}</main>
    </div>
  `;
}

function renderList() {
  const q = state.search || '';
  const filtered = q
    ? state.bikes.filter(b =>
        b.title.toLowerCase().includes(q.toLowerCase()) ||
        (b.description || '').toLowerCase().includes(q.toLowerCase())
      )
    : state.bikes;

  const rows = filtered.map(b => `
    <article class="bike-row">
      <img class="bike-row__thumb" src="${esc(imageSrc(b.image))}" alt="" loading="lazy">
      <div class="bike-row__info">
        <p class="bike-row__title">${esc(b.title)}</p>
        <p class="bike-row__meta">${formatPrice(b.price)} · ${b.images?.length || 0} billeder</p>
      </div>
      <span class="badge badge--${b.status === 'sold' ? 'sold' : b.status === 'draft' ? 'draft' : 'available'}">
        ${b.status === 'sold' ? 'Solgt' : b.status === 'draft' ? 'Kladde' : 'Til salg'}
      </span>
      <div class="bike-row__actions">
        <button type="button" class="btn btn--ghost btn--small" data-edit="${esc(b.id)}">Rediger</button>
        ${b.status === 'sold'
          ? `<button type="button" class="btn btn--ghost btn--small" data-unsold="${esc(b.id)}">Gør tilgængelig</button>`
          : `<button type="button" class="btn btn--ghost btn--small" data-sold="${esc(b.id)}">Markér solgt</button>`
        }
        <button type="button" class="btn btn--danger btn--small" data-delete="${esc(b.id)}">Slet</button>
      </div>
    </article>
  `).join('');

  return renderShell(`
    <div class="list-header">
      <div>
        <h1>Motorcykler</h1>
        <p class="list-header__sub">${state.bikes.length} i alt</p>
      </div>
      <button type="button" class="btn btn--primary" data-action="new">+ Ny motorcykel</button>
    </div>
    <input type="search" class="list-search" id="searchInput" placeholder="Søg efter model eller specifikation…" value="${esc(q)}">
    ${filtered.length ? `<div class="bike-list">${rows}</div>` : '<p style="color:var(--silver-muted)">Ingen motorcykler fundet.</p>'}
  `);
}

function renderEditor() {
  const mainImg = state.images.find(i => i.main) || state.images[0];
  const previewSpecs = getPreviewSpecs();

  return renderShell(`
    <button type="button" class="editor-back" data-action="list">← Tilbage til liste</button>

    <div class="editor-grid">
      <div class="editor-gallery">
        <div class="editor-gallery__main">
          ${mainImg
            ? `<img src="${esc(imageSrc(mainImg.url))}" alt="Hovedbillede">`
            : `<div class="editor-gallery__empty"><span>Ingen billeder endnu</span><span>Upload nedenfor</span></div>`
          }
        </div>

        ${state.images.length ? `
        <div class="editor-gallery__thumbs" id="thumbGrid">
          ${state.images.map((img, i) => `
            <div class="editor-thumb${img.main ? ' editor-thumb--main' : ''}"
                 draggable="true" data-idx="${i}">
              <img src="${esc(imageSrc(img.url))}" alt="">
              ${img.main ? '<span class="editor-thumb__badge">Hovedbillede</span>' : ''}
              <div class="editor-thumb__actions">
                ${!img.main ? `<button type="button" class="editor-thumb__btn" data-set-main="${i}" title="Sæt som hovedbillede">★</button>` : ''}
                <button type="button" class="editor-thumb__btn" data-remove-img="${i}" title="Fjern">×</button>
              </div>
            </div>
          `).join('')}
        </div>
        <p style="font-size:0.75rem;color:var(--silver-muted);margin-top:8px">Træk billeder for at ændre rækkefølge · Klik ★ for hovedbillede</p>
        ` : ''}

        <div class="upload-zone${state.uploading ? ' upload-zone--uploading' : ''}" id="uploadZone">
          <p>Træk billeder hertil eller klik for at vælge</p>
          <span>Du kan vælge mange billeder på én gang</span>
          ${state.uploadProgress ? `<p class="upload-progress">${esc(state.uploadProgress)}</p>` : ''}
          <input type="file" id="fileInput" accept="image/*" multiple hidden>
        </div>
      </div>

      <div class="editor-info">
        <p class="editor-info__eyebrow">Til salg</p>
        <input type="text" class="editor-info__title" id="titleInput" value="${esc(state.title)}" placeholder="Titel / model">

        <div class="editor-pricing">
          <div class="editor-price-row">
            <label for="priceInput">Pris</label>
            <input type="text" id="priceInput" inputmode="numeric" value="${esc(state.price)}" placeholder="239.900">
          </div>
          <div class="editor-price-row">
            <label for="downInput">Udbetaling</label>
            <input type="text" id="downInput" inputmode="numeric" value="${esc(state.downPayment)}" placeholder="48.480">
          </div>
          <div class="editor-price-row">
            <label for="monthlyInput">Månedlig ydelse</label>
            <input type="text" id="monthlyInput" inputmode="numeric" value="${esc(state.monthly)}" placeholder="2.317">
          </div>
          <input type="text" class="editor-note" id="noteInput" value="${esc(state.note)}" placeholder="Note (fx Uden afgift)">
        </div>

        <div class="editor-specs">
          <h2 class="editor-specs__title">Specifikationer</h2>
          <div class="editor-specs__core">
            <div>
              <label for="ccInput">CC</label>
              <input type="text" id="ccInput" inputmode="numeric" value="${esc(state.cc)}" placeholder="1745">
            </div>
            <div>
              <label for="gearsInput">Gear</label>
              <input type="text" id="gearsInput" inputmode="numeric" value="${esc(state.gears)}" placeholder="6">
            </div>
            <div>
              <label for="kmInput">KM</label>
              <input type="text" id="kmInput" inputmode="numeric" value="${esc(state.km)}" placeholder="30.141">
            </div>
          </div>

          <div class="spec-lines" id="specLines">
            ${state.specLines.map((line, i) => `
              <div class="spec-line" data-spec-idx="${i}">
                <span class="spec-line__drag">⠿</span>
                <input type="text" data-spec-input="${i}" value="${esc(line)}" placeholder="Fx ABS, CRUISE CONTROL, SYNET…">
                <button type="button" class="spec-line__remove" data-remove-spec="${i}">×</button>
              </div>
            `).join('')}
          </div>
          <button type="button" class="btn btn--ghost btn--small" id="addSpecBtn">+ Tilføj specifikationslinje</button>

          ${previewSpecs.length ? `
          <div class="spec-preview">
            <p class="spec-preview__label">Forhåndsvisning (som på hjemmesiden)</p>
            <ul class="spec-preview__list">
              ${previewSpecs.map(s => `<li>${esc(s)}</li>`).join('')}
            </ul>
          </div>` : ''}
        </div>

        ${state.message.text ? `<p class="form-${state.message.type === 'error' ? 'error' : 'success'}">${esc(state.message.text)}</p>` : ''}

        <div class="editor-actions">
          <button type="button" class="btn btn--primary" id="saveBtn" ${state.saving ? 'disabled' : ''}>
            ${state.saving ? 'Gemmer…' : 'Gem motorcykel'}
          </button>
          <button type="button" class="btn btn--ghost" data-action="list">Annuller</button>
        </div>
      </div>
    </div>
  `);
}

// ---- Event binding ----

function bindShellEvents() {
  document.querySelector('[data-action="list"]')?.addEventListener('click', () => {
    state.view = 'list';
    render();
  });
  document.querySelector('[data-action="new"]')?.addEventListener('click', () => openEditor(null));
  document.querySelector('[data-action="logout"]')?.addEventListener('click', async () => {
    await api('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin/';
  });
}

function bindListEvents() {
  bindShellEvents();

  document.querySelector('[data-action="new"]')?.addEventListener('click', () => openEditor(null));
  document.getElementById('searchInput')?.addEventListener('input', e => {
    state.search = e.target.value;
    render();
  });

  document.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openEditor(btn.dataset.edit));
  });
  document.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteBike(btn.dataset.delete));
  });
  document.querySelectorAll('[data-sold]').forEach(btn => {
    btn.addEventListener('click', () => toggleSold(btn.dataset.sold, true));
  });
  document.querySelectorAll('[data-unsold]').forEach(btn => {
    btn.addEventListener('click', () => toggleSold(btn.dataset.unsold, false));
  });
}

function bindEditorEvents() {
  bindShellEvents();

  document.getElementById('titleInput')?.addEventListener('input', e => { state.title = e.target.value; });
  document.getElementById('priceInput')?.addEventListener('input', e => { state.price = e.target.value; });
  document.getElementById('downInput')?.addEventListener('input', e => { state.downPayment = e.target.value; });
  document.getElementById('monthlyInput')?.addEventListener('input', e => { state.monthly = e.target.value; });
  document.getElementById('noteInput')?.addEventListener('input', e => { state.note = e.target.value; });
  document.getElementById('ccInput')?.addEventListener('input', e => { state.cc = e.target.value; renderEditorFields(); });
  document.getElementById('gearsInput')?.addEventListener('input', e => { state.gears = e.target.value; renderEditorFields(); });
  document.getElementById('kmInput')?.addEventListener('input', e => { state.km = e.target.value; renderEditorFields(); });

  document.querySelectorAll('[data-spec-input]').forEach(input => {
    input.addEventListener('input', e => {
      state.specLines[+e.target.dataset.specInput] = e.target.value;
      renderEditorFields();
    });
  });

  document.querySelectorAll('[data-remove-spec]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.specLines.splice(+btn.dataset.removeSpec, 1);
      if (!state.specLines.length) state.specLines = [''];
      render();
    });
  });

  document.getElementById('addSpecBtn')?.addEventListener('click', () => {
    state.specLines.push('');
    render();
  });

  document.getElementById('saveBtn')?.addEventListener('click', saveProduct);

  document.querySelectorAll('[data-set-main]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); setMainImage(+btn.dataset.setMain); });
  });

  document.querySelectorAll('[data-remove-img]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); removeImage(+btn.dataset.removeImg); });
  });

  bindThumbDrag();
  bindUploadZone();
}

function renderEditorFields() {
  const specs = getPreviewSpecs();
  let preview = document.querySelector('.spec-preview');

  if (!specs.length) {
    preview?.remove();
    return;
  }

  const listHtml = specs.map(s => `<li>${esc(s)}</li>`).join('');

  if (preview) {
    const list = preview.querySelector('.spec-preview__list');
    if (list) list.innerHTML = listHtml;
    return;
  }

  document.getElementById('addSpecBtn')?.insertAdjacentHTML('afterend', `
    <div class="spec-preview">
      <p class="spec-preview__label">Forhåndsvisning (som på hjemmesiden)</p>
      <ul class="spec-preview__list">${listHtml}</ul>
    </div>`);
}

function bindThumbDrag() {
  const grid = document.getElementById('thumbGrid');
  if (!grid) return;

  grid.querySelectorAll('.editor-thumb').forEach(thumb => {
    thumb.addEventListener('dragstart', e => {
      state.dragImageIdx = +thumb.dataset.idx;
      thumb.classList.add('editor-thumb--dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    thumb.addEventListener('dragend', () => {
      state.dragImageIdx = null;
      grid.querySelectorAll('.editor-thumb').forEach(t => t.classList.remove('editor-thumb--dragging', 'editor-thumb--over'));
    });
    thumb.addEventListener('dragover', e => {
      e.preventDefault();
      thumb.classList.add('editor-thumb--over');
    });
    thumb.addEventListener('dragleave', () => thumb.classList.remove('editor-thumb--over'));
    thumb.addEventListener('drop', e => {
      e.preventDefault();
      thumb.classList.remove('editor-thumb--over');
      const to = +thumb.dataset.idx;
      if (state.dragImageIdx !== null) moveImage(state.dragImageIdx, to);
    });
  });
}

function bindUploadZone() {
  const zone = document.getElementById('uploadZone');
  const input = document.getElementById('fileInput');
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('upload-zone--active'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('upload-zone--active'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('upload-zone--active');
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  });
  input.addEventListener('change', e => {
    if (e.target.files.length) uploadFiles(e.target.files);
    e.target.value = '';
  });
}

// ---- Init ----

async function init() {
  try {
    const me = await api('/api/admin/me');
    if (!me.loggedIn) {
      window.location.href = '/admin/';
      return;
    }
    await loadBikes();
    render();
  } catch {
    window.location.href = '/admin/';
  }
}

init();
