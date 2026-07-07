/**
 * Motorcycle detail page
 */

async function init() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  let product;
  try {
    const res = await fetch(`/api/products/${id}`);
    if (res.ok) product = await res.json();
  } catch {
    // offline fallback
  }

  if (!product) {
    const products = await loadProducts();
    product = products.find(p => p.id === id);
  }

  initNav();
  initHeader();
  initScrollTop();

  if (!product) {
    document.getElementById('detailGrid').innerHTML = `
      <div class="detail__not-found">
        <h2>Motorcykel ikke fundet</h2>
        <p>Den ønskede motorcykel findes ikke i vores lager.</p>
        <a href="koeb-motorcykel.html" class="btn btn--primary">Se alle motorcykler</a>
      </div>`;
    return;
  }

  if (product.status === 'sold') {
    document.getElementById('detailGrid').innerHTML = `
      <div class="detail__not-found">
        <h2>Denne motorcykel er solgt</h2>
        <p>${product.title} er desværre ikke længere tilgængelig.</p>
        <a href="koeb-motorcykel.html" class="btn btn--primary">Se andre motorcykler</a>
      </div>`;
    return;
  }

  document.title = `${product.title} – Xtreme Machines`;
  const note = product.note || (product.title.toUpperCase().includes('U/AFG') ? 'Uden afgift' : null);
  const specs = parseSpecs(product.description);

  document.getElementById('detailGrid').innerHTML = `
    <div class="detail__gallery">
      <div class="detail__main-image">
        <img id="mainImage" src="${product.image || product.images[0]}" alt="${product.title}">
      </div>
      ${product.images.length > 1 ? `
      <div class="detail__thumbs">
        ${product.images.map((img, i) => `
          <button class="detail__thumb${i === 0 ? ' detail__thumb--active' : ''}" data-src="${img}" aria-label="Billede ${i + 1}">
            <img src="${img}" alt="" loading="lazy">
          </button>
        `).join('')}
      </div>` : ''}
    </div>

    <div class="detail__info">
      <p class="section-eyebrow">${product.badge || 'Til salg'}</p>
      <h1 class="detail__title">${product.title}</h1>

      <div class="detail__pricing">
        <div class="detail__price-row">
          <span class="detail__price-label">Pris</span>
          <span class="detail__price-value">${formatPrice(product.price)}</span>
        </div>
        ${product.downPayment ? `
        <div class="detail__price-row">
          <span class="detail__price-label">Udbetaling</span>
          <span class="detail__price-value">${formatPrice(product.downPayment)}</span>
        </div>
        <div class="detail__price-row">
          <span class="detail__price-label">Månedlig ydelse</span>
          <span class="detail__price-value">${formatPrice(product.monthly)}</span>
        </div>` : ''}
        ${note ? `<p class="detail__note">${note}</p>` : ''}
      </div>

      <a href="index.html#kontakt" class="btn btn--primary btn--full">Kontakt os om denne motorcykel</a>
      <a href="tel:+4543446484" class="detail__phone">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        Ring +45 4344 6484
      </a>

      <div class="detail__specs">
        <h2 class="detail__specs-title">Specifikationer</h2>
        <ul class="detail__specs-list">
          ${specs.map(s => `<li>${s}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;

  document.querySelectorAll('.detail__thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      document.getElementById('mainImage').src = thumb.dataset.src;
      document.querySelectorAll('.detail__thumb').forEach(t => t.classList.remove('detail__thumb--active'));
      thumb.classList.add('detail__thumb--active');
    });
  });
}

init();
