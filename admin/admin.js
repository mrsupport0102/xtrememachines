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
const specRows = document.getElementById('specRows');
const specFieldGrid = document.getElementById('specFieldGrid');
const specPreview = document.getElementById('specPreview');

const SPEC_FIELD_DEFS = [
  { id: 'highlight', label: 'Salgstekst / highlight', type: 'text', placeholder: 'Fx !!! DANMARKS BILLIGSTE SPORT GLIDE !!!', fullWidth: true },
  { id: 'udstoedning', label: 'Udstødning', type: 'text', placeholder: 'Fx KESS TECH ELEKTRONISK JUSTERBAR UDSTØDNING', fullWidth: true },
  { id: 'abs', label: 'ABS', type: 'toggle', value: 'ABS' },
  { id: 'keyless', label: 'Keyless ride', type: 'toggle', value: 'KEYLESS RIDE' },
  { id: 'alarm', label: 'Betjeningsfri alarm og startspærre', type: 'toggle', value: 'BETJENINGSFRI ALARM OG STARTSPÆRRE' },
  { id: 'cruise', label: 'Cruise control', type: 'toggle', value: 'CRUISE CONTROL' },
  { id: 'navigation', label: 'Navigation', type: 'text', placeholder: 'Fx TOM TOM NAVIGATION' },
  { id: 'gearindikator', label: 'Gearindikator', type: 'toggle', value: 'GEARINDIKATOR' },
  { id: 'koerecomputer', label: 'Kørecomputer', type: 'toggle', value: 'KØRECOMPUTER' },
  { id: 'injection', label: 'Injection', type: 'toggle', value: 'INJECTION' },
  { id: 'ryglaen', label: 'Aftagelig H-D ryglæn', type: 'toggle', value: 'AFTAGELIG H-D RYGLÆN' },
  { id: 'blinklys', label: 'Blinklysglas for', type: 'text', placeholder: 'Fx SORTE BLINKLYSGLAS FOR' },
  { id: 'tasker', label: 'Aftagelige tasker', type: 'toggle', value: 'AFTAGELIGE TASKER' },
  { id: 'kaabe', label: 'Kåbe', type: 'text', placeholder: 'Fx AFTAGELIG KÅBE MED 3 SLAGS KÅBEGLAS', fullWidth: true },
  { id: 'forgaffel', label: 'Forgaffel', type: 'text', placeholder: 'Fx SORT UPSIDE DOWN FORGAFFEL' },
  { id: 'hjul', label: 'Hjul', type: 'text', placeholder: 'Fx CONTRAST CUT ALU HJUL' },
  { id: 'forlygte', label: 'Forlygte', type: 'text', placeholder: 'Fx SORT LED FORLYGTE' },
  { id: 'speedometer', label: 'Digital speedometer', type: 'toggle', value: 'DIGITAL SPEEDOMETER' },
  { id: 'fremflytter', label: 'Fremflyttersæt', type: 'text', placeholder: 'Fx FREMFLYTTERSÆT' },
  { id: 'stoeddaemper', label: 'Justerbar støddæmper', type: 'toggle', value: 'JUSTERBAR STØDDÆMPER' },
  { id: 'passager_fod', label: 'Passager fodhvilersæt', type: 'toggle', value: 'PASSAGER FODHVILERSÆT' },
  { id: 'passager_saede', label: 'Passager sæde', type: 'toggle', value: 'PASSAGER SÆDE' },
  { id: 'styr', label: 'Styr', type: 'text', placeholder: 'Fx FAT BAR STYR' },
  { id: 'bagende', label: 'Bag-ende', type: 'text', placeholder: 'Fx 180 BAGENDE' },
  { id: 'synet', label: 'Synet', type: 'toggle', value: 'SYNET' },
  { id: 'klargoering', label: 'Gennemgang og klargøring', type: 'toggle', value: 'GENNEMGANG OG KLARGØRING GENNEMFØRT' },
  { id: 'levomk', label: 'Leveringsomkostninger', type: 'toggle', value: 'LEV. OMK. KR. 2.500' },
  { id: 'pris_ialt', label: 'Pris i alt', type: 'text', placeholder: 'Fx PRIS IALT KR. 242.400', fullWidth: true },
];

// ---- Specifikationer (matcher server/productUtils.js) ----

function buildDescription({ cc, gears, km, specs = [] }) {
  const parts = [];

  if (cc) parts.push(`${String(cc).trim()} CC`);
  if (gears) parts.push(`${String(gears).trim()} GEAR`);
  if (km) parts.push(`KM. ${String(km).trim().replace(/\./g, '')}`);

  specs
    .map(s => String(s || '').trim())
    .filter(Boolean)
    .forEach(spec => parts.push(spec.toUpperCase()));

  if (!parts.length) return '';
  return `${parts.join(' - ')}.`;
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
    const ccMatch = part.match(/^(\d+)\s*CC$/i);
    if (ccMatch) {
      cc = ccMatch[1];
      continue;
    }

    const gearMatch = part.match(/^(\d+)\s*GEAR$/i);
    if (gearMatch) {
      gears = gearMatch[1];
      continue;
    }

    const kmMatch = part.match(/^KM\.?\s*(.+)$/i);
    if (kmMatch) {
      km = kmMatch[1].replace(/\./g, '').trim();
      continue;
    }

    specs.push(part);
  }

  return { cc, gears, km, specs };
}

function normalizeSpecText(value) {
  return String(value || '').trim().toUpperCase();
}

function specMatchesField(spec, field) {
  const normalized = normalizeSpecText(spec);
  if (field.type === 'toggle') {
    return normalized === normalizeSpecText(field.value);
  }

  const example = normalizeSpecText(field.placeholder?.replace(/^FX\s+/i, ''));
  if (example && normalized === example) return true;

  const keywords = {
    highlight: ['!!!', '!! ', 'SUPERPRIS', 'BILLIGSTE'],
    udstoedning: ['UDSTØDNING', 'UDSTODNING'],
    navigation: ['NAVIGATION', 'TOM TOM'],
    blinklys: ['BLINKLYSGLAS', 'BLINKLYS GLAS'],
    kaabe: ['KÅBE', 'KABE', 'VINDSKÆRM'],
    forgaffel: ['FORGAFFEL'],
    hjul: ['ALU HJUL', 'HJUL'],
    forlygte: ['FORLYGTE'],
    fremflytter: ['FREMFLYTTERSÆT', 'FREMFLYTTERSAET'],
    styr: ['STYR'],
    bagende: ['BAGENDE'],
    pris_ialt: ['PRIS IALT'],
  };

  const keys = keywords[field.id];
  return Boolean(keys && keys.some(key => normalized.includes(key)));
}

function renderSpecFieldGrid(values = {}) {
  specFieldGrid.innerHTML = SPEC_FIELD_DEFS.map(field => {
    if (field.type === 'toggle') {
      const checked = Boolean(values[field.id]);
      return `
        <div class="spec-field spec-field--toggle${field.fullWidth ? ' spec-field--full' : ''}">
          <input type="checkbox" id="specField_${field.id}" data-spec-field="${field.id}" ${checked ? 'checked' : ''}>
          <label for="specField_${field.id}">${escapeHtml(field.label)}</label>
        </div>
      `;
    }

    const value = values[field.id] || '';
    return `
      <div class="spec-field${field.fullWidth ? ' spec-field--full' : ''}">
        <label for="specField_${field.id}">${escapeHtml(field.label)}</label>
        <input type="text" id="specField_${field.id}" data-spec-field="${field.id}" value="${escapeAttr(value)}" placeholder="${escapeAttr(field.placeholder || '')}">
      </div>
    `;
  }).join('');
  updateSpecPreview();
}

function getFieldSpecValues() {
  const values = {};

  SPEC_FIELD_DEFS.forEach(field => {
    const el = document.getElementById(`specField_${field.id}`);
    if (!el) return;

    if (field.type === 'toggle') {
      values[field.id] = el.checked;
      return;
    }

    values[field.id] = el.value.trim();
  });

  return values;
}

function collectSpecsFromFields(fieldValues) {
  const specs = [];

  SPEC_FIELD_DEFS.forEach(field => {
    if (field.type === 'toggle') {
      if (fieldValues[field.id]) specs.push(field.value);
      return;
    }

    const value = String(fieldValues[field.id] || '').trim();
    if (value) specs.push(value);
  });

  return specs;
}

function getSpecValues() {
  const cc = document.getElementById('specCc').value.trim();
  const gears = document.getElementById('specGears').value.trim();
  const km = document.getElementById('specKm').value.trim();
  const fieldValues = getFieldSpecValues();
  const specs = [
    ...collectSpecsFromFields(fieldValues),
    ...[...specRows.querySelectorAll('.spec-row input')]
      .map(input => input.value.trim())
      .filter(Boolean),
  ];

  return { cc, gears, km, specs };
}

function updateSpecPreview() {
  const values = getSpecValues();
  const built = buildDescription(values);
  specPreview.textContent = built || '–';
}

function renderSpecRows(specs = []) {
  specRows.innerHTML = specs.map((value, index) => `
    <div class="spec-row">
      <input type="text" class="spec-row__input" value="${escapeAttr(value)}" placeholder="Fx SORT THUNDERBIKE LUFTFILTER">
      <button type="button" class="spec-row__remove" data-remove-spec aria-label="Fjern specifikation">×</button>
    </div>
  `).join('');
  updateSpecPreview();
}

function fillSpecFields(description) {
  const parsed = parseDescription(description);
  document.getElementById('specCc').value = parsed.cc;
  document.getElementById('specGears').value = parsed.gears;
  document.getElementById('specKm').value = parsed.km
    ? parsed.km.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    : '';

  const fieldValues = {};
  const usedFields = new Set();
  const assignedSpecs = new Set();
  const extras = [];

  parsed.specs.forEach((spec, index) => {
    const toggleField = SPEC_FIELD_DEFS.find(def =>
      def.type === 'toggle'
      && !usedFields.has(def.id)
      && normalizeSpecText(spec) === normalizeSpecText(def.value)
    );

    if (toggleField) {
      usedFields.add(toggleField.id);
      assignedSpecs.add(index);
      fieldValues[toggleField.id] = true;
    }
  });

  parsed.specs.forEach((spec, index) => {
    if (assignedSpecs.has(index)) return;

    const textField = SPEC_FIELD_DEFS.find(def =>
      def.type === 'text'
      && !usedFields.has(def.id)
      && specMatchesField(spec, def)
    );

    if (textField) {
      usedFields.add(textField.id);
      assignedSpecs.add(index);
      fieldValues[textField.id] = spec;
      return;
    }

    extras.push(spec);
  });

  renderSpecFieldGrid(fieldValues);
  renderSpecRows(extras);
}

function imageSrc(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith('/') ? url : `/${url}`;
}

function syncImagesFromProduct(product) {
  if (!product) return;
  formImages = [...(product.images || [])];
  mainImage = product.image || formImages[0] || '';
}

// ---- Auth check ----

async function checkAuth() {
  const res = await fetch('/api/admin/me', { credentials: 'same-origin' });
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
  const res = await fetch('/api/admin/products', { credentials: 'same-origin' });
  if (res.status === 401) {
    window.location.href = '/admin/';
    return;
  }
  const data = await res.json();
  if (!res.ok || !Array.isArray(data)) {
    showToast(data?.error || 'Kunne ikke hente motorcykler');
    allBikes = [];
  } else {
    allBikes = data;
  }
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
      <img class="bike-row__thumb" src="${escapeAttr(imageSrc(b.image))}" alt="" loading="lazy">
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

function escapeAttr(str) {
  return escapeHtml(str);
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
    credentials: 'same-origin',
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
  const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE', credentials: 'same-origin' });
  if (!res.ok) {
    showToast('Kunne ikke slette motorcykel');
    return;
  }
  showToast('Motorcykel slettet');
  loadBikes();
}

// ---- Formular ----

async function openForm(id = null) {
  editingId = id;
  formError.hidden = true;
  formSuccess.hidden = true;
  bikeForm.reset();
  formImages = [];
  mainImage = '';

  if (id) {
    formTitle.textContent = 'Rediger motorcykel';
    document.getElementById('bikeId').value = id;

    const res = await fetch(`/api/admin/products/${id}`, { credentials: 'same-origin' });
    if (!res.ok) {
      showToast('Kunne ikke hente motorcykel');
      return;
    }

    const bike = await res.json();
    document.getElementById('title').value = bike.title;
    document.getElementById('price').value = bike.price;
    document.getElementById('downPayment').value = bike.downPayment || '';
    document.getElementById('monthly').value = bike.monthly || '';
    document.getElementById('note').value = bike.note || '';
    fillSpecFields(bike.description);
    syncImagesFromProduct(bike);
  } else {
    formTitle.textContent = 'Ny motorcykel';
    document.getElementById('bikeId').value = '';
    renderSpecFieldGrid();
    renderSpecRows([]);
  }

  renderImageGrid();
  showView('form');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderImageGrid() {
  if (!formImages.length) {
    imageGrid.innerHTML = '';
    return;
  }

  imageGrid.innerHTML = formImages.map(url => {
    const src = imageSrc(url);
    const isMain = url === mainImage || src === imageSrc(mainImage);
    return `
      <div class="image-item${isMain ? ' image-item--main' : ''}" data-url="${escapeAttr(url)}">
        <img src="${escapeAttr(src)}" alt="" loading="lazy">
        ${isMain ? '<span class="image-item__badge">Hovedbillede</span>' : ''}
        <button type="button" class="image-item__remove" data-remove="${escapeAttr(url)}" aria-label="Fjern billede">×</button>
      </div>
    `;
  }).join('');
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

// ---- Specifikationsfelter ----

document.getElementById('addSpecBtn').addEventListener('click', () => {
  const extras = [...specRows.querySelectorAll('.spec-row input')]
    .map(input => input.value.trim());
  renderSpecRows([...extras, '']);
});

specFieldGrid.addEventListener('input', updateSpecPreview);
specFieldGrid.addEventListener('change', updateSpecPreview);

specRows.addEventListener('input', updateSpecPreview);
specRows.addEventListener('click', e => {
  const btn = e.target.closest('[data-remove-spec]');
  if (!btn) return;
  const extras = [...specRows.querySelectorAll('.spec-row input')]
    .map(input => input.value.trim());
  const row = btn.closest('.spec-row');
  const index = [...specRows.querySelectorAll('.spec-row')].indexOf(row);
  extras.splice(index, 1);
  renderSpecRows(extras);
});

['specCc', 'specGears', 'specKm'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateSpecPreview);
});

// ---- Drag & drop upload ----

async function compressImageFile(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Kun billedfiler er tilladt');
  }

  const bitmap = await createImageBitmap(file);
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(result => {
      if (result) resolve(result);
      else reject(new Error('Kunne ikke komprimere billede'));
    }, 'image/jpeg', 0.85);
  });

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'billede';
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      const base64 = String(result).split(',')[1];
      if (!base64) reject(new Error('Kunne ikke læse billede'));
      else resolve(base64);
    };
    reader.onerror = () => reject(new Error('Kunne ikke læse billede'));
    reader.readAsDataURL(file);
  });
}

async function uploadSingleImage(productId, file) {
  const compressed = await compressImageFile(file);
  const data = await fileToBase64(compressed);

  const res = await fetch(`/api/admin/products/${productId}/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      images: [{ name: compressed.name, data }],
    }),
  });

  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || 'Upload fejlede');
  return payload;
}

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

  pendingUploads++;
  document.getElementById('saveBtn').disabled = true;
  dropZone.classList.add('drop-zone--uploading');

  let uploadedCount = 0;

  try {
    for (const file of fileList) {
      const payload = await uploadSingleImage(productId, file);
      if (payload.product) {
        syncImagesFromProduct(payload.product);
      } else if (payload.urls?.length) {
        formImages.push(...payload.urls);
        if (!mainImage) mainImage = formImages[0];
      }
      uploadedCount += payload.urls?.length || 1;
    }

    renderImageGrid();
    showToast(`${uploadedCount} billede${uploadedCount !== 1 ? 'r' : ''} uploadet`);
  } catch (err) {
    formError.textContent = err.message;
    formError.hidden = false;
  } finally {
    pendingUploads--;
    dropZone.classList.remove('drop-zone--uploading');
    document.getElementById('saveBtn').disabled = pendingUploads > 0;
  }
}

function getFormPayload() {
  const specValues = getSpecValues();
  const description = buildDescription(specValues);

  return {
    title: document.getElementById('title').value.trim(),
    cc: specValues.cc,
    gears: specValues.gears,
    km: specValues.km,
    specs: specValues.specs,
    description,
    price: document.getElementById('price').value.trim(),
    downPayment: document.getElementById('downPayment').value.trim() || null,
    monthly: document.getElementById('monthly').value.trim() || null,
    note: document.getElementById('note').value.trim() || null,
    images: formImages,
    image: mainImage || formImages[0],
  };
}

async function createDraftForUpload() {
  const payload = getFormPayload();
  if (!payload.description) {
    payload.description = 'Udfyld specifikationer';
    payload.cc = '';
    payload.gears = '';
    payload.km = '';
    payload.specs = [];
  }

  const res = await fetch('/api/admin/products/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      title: payload.title || 'Ny motorcykel',
      cc: payload.cc,
      gears: payload.gears,
      km: payload.km,
      specs: payload.specs,
      description: payload.description,
      price: payload.price || '0',
      downPayment: payload.downPayment,
      monthly: payload.monthly,
      note: payload.note,
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

  const payload = getFormPayload();

  if (!payload.description) {
    formError.textContent = 'Udfyld mindst én specifikation (CC, gear, km eller øvrige felter)';
    formError.hidden = false;
    return;
  }

  if (!formImages.length) {
    formError.textContent = 'Upload mindst ét billede';
    formError.hidden = false;
    return;
  }

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
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kunne ikke gemme');

    syncImagesFromProduct(data);
    renderImageGrid();

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
  await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
  window.location.href = '/admin/';
});

// ---- Init ----

(async () => {
  if (await checkAuth()) {
    await loadBikes();
    showView('list');
  }
})();
