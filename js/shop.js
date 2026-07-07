/**
 * Shop listing page
 */

let allProducts = [];

async function init() {
  allProducts = await loadProducts();
  renderGrid(allProducts);
  initNav();
  initHeader();
  initScrollTop();

  document.getElementById('searchInput').addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    const filtered = q
      ? allProducts.filter(p =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
        )
      : allProducts;
    renderGrid(filtered);
  });
}

function renderGrid(products) {
  const grid = document.getElementById('shopGrid');
  const empty = document.getElementById('shopEmpty');
  const count = document.getElementById('resultCount');

  count.textContent = `${products.length} motorcykel${products.length !== 1 ? 'er' : ''}`;
  empty.hidden = products.length > 0;

  grid.innerHTML = products.map(p => productCardHTML(p)).join('');
}

init();
