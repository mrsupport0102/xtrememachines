/**
 * Shared utilities for Xtreme Machines
 */

let _productsCache = null;

function normalizeAvailableProducts(products) {
  if (!Array.isArray(products)) return [];
  return products.filter(p => !p.status || p.status === 'available');
}

async function fetchProductsFromApi() {
  const res = await fetch('/api/products', { cache: 'no-store' });
  if (!res.ok) return null;
  const data = await res.json();
  const products = normalizeAvailableProducts(data);
  return products.length ? products : null;
}

async function fetchProductsFromJson() {
  const res = await fetch('/data/products.json', { cache: 'no-store' });
  if (!res.ok) return null;
  const data = await res.json();
  const products = normalizeAvailableProducts(data);
  return products.length ? products : null;
}

async function loadProducts() {
  if (_productsCache) return _productsCache;

  try {
    const fromApi = await fetchProductsFromApi();
    if (fromApi) {
      _productsCache = fromApi;
      return _productsCache;
    }
  } catch {
    // Prøv statisk fallback nedenfor
  }

  try {
    const fromJson = await fetchProductsFromJson();
    if (fromJson) {
      _productsCache = fromJson;
      return _productsCache;
    }
  } catch {
    // Returnerer tom liste nedenfor
  }

  _productsCache = [];
  return _productsCache;
}

function clearProductsCache() {
  _productsCache = null;
}

async function loadNewestProducts(limit = 5) {
  const products = await loadProducts();
  return [...products]
    .sort((a, b) => {
      const da = a.createdAt || a.id;
      const db = b.createdAt || b.id;
      return da > db ? -1 : da < db ? 1 : 0;
    })
    .slice(0, limit);
}

function formatPrice(value) {
  return value ? `${value},00 kr.` : null;
}

function parseSpecs(description) {
  if (!description) return [];
  return description.split(' - ').map(s => s.trim()).filter(Boolean);
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function productCardHTML(p, { link = true } = {}) {
  const href = link ? `motorcykel.html?id=${p.id}` : '#';
  const tag = link ? 'a' : 'article';
  const note = p.note || (p.title.toUpperCase().includes('U/AFG') ? 'Uden afgift' : null);

  return `
    <${tag} class="product-card${link ? ' product-card--link' : ''}" ${link ? `href="${href}"` : ''}>
      <div class="product-card__image">
        <img src="${p.image}" alt="${p.title}" loading="lazy">
        ${p.badge ? `<span class="product-card__badge">${p.badge}</span>` : ''}
      </div>
      <div class="product-card__body">
        <h3 class="product-card__title">${p.title}</h3>
        <ul class="product-card__specs">
          <li class="product-card__spec">
            <span class="product-card__spec-label">Pris</span>
            <span class="product-card__spec-value product-card__spec-value--price">${formatPrice(p.price)}</span>
          </li>
          ${p.downPayment ? `
          <li class="product-card__spec">
            <span class="product-card__spec-label">Udbetaling</span>
            <span class="product-card__spec-value">${formatPrice(p.downPayment)}</span>
          </li>
          <li class="product-card__spec">
            <span class="product-card__spec-label">Månedlig ydelse</span>
            <span class="product-card__spec-value">${formatPrice(p.monthly)}</span>
          </li>` : ''}
        </ul>
        ${note ? `<p class="product-card__note">${note}</p>` : ''}
        ${link ? '<span class="product-card__cta">Se detaljer →</span>' : ''}
      </div>
    </${tag}>
  `;
}

function initNav() {
  const navToggle = document.getElementById('navToggle');
  const nav = document.getElementById('nav');
  if (!navToggle || !nav) return;

  navToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('nav--open');
    navToggle.setAttribute('aria-expanded', isOpen);
  });

  nav.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('click', () => nav.classList.remove('nav--open'));
  });
}

function initHeader() {
  const header = document.getElementById('header');
  if (!header) return;
  window.addEventListener('scroll', () => {
    header.classList.toggle('header--scrolled', window.scrollY > 50);
  });
}

function initScrollTop() {
  const btn = document.getElementById('scrollTop');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('scroll-top--visible', window.scrollY > 600);
  });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav__link[href^="#"]');
  if (!sections.length || !navLinks.length) return;

  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
      if (window.scrollY >= section.offsetTop - 200) {
        current = section.getAttribute('id');
      }
    });
    navLinks.forEach(link => {
      link.classList.remove('nav__link--active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('nav__link--active');
      }
    });
  });
}

function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Tak – vi kontakter dig snart!';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
      e.target.reset();
    }, 3000);
  });
}
