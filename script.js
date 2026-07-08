/**
 * Xtreme Machines – Landing Page
 */

let products = [];

function getItemsPerView() {
  if (window.innerWidth <= 480) return 1;
  if (window.innerWidth <= 768) return 2;
  if (window.innerWidth <= 1024) return 3;
  return 4;
}

function createCarousel({ trackEl, dotsEl, prevEl, nextEl, items, maxItems = 8, autoPlayMs = 5000 }) {
  const subset = items.slice(0, maxItems);
  let currentIndex = 0;
  let itemsPerView = getItemsPerView();
  let autoPlay = null;
  let paused = false;
  const gap = 24;
  const wrapperEl = trackEl.closest('.carousel-wrapper');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shouldAutoPlay = autoPlayMs > 0 && !prefersReducedMotion;

  function render() {
    trackEl.innerHTML = subset.map(p => productCardHTML(p)).join('');
  }

  function getMaxIndex() {
    return Math.max(0, subset.length - itemsPerView);
  }

  function renderDots() {
    if (!dotsEl) return;
    const totalDots = getMaxIndex() + 1;
    dotsEl.innerHTML = Array.from({ length: totalDots }, (_, i) =>
      `<button class="carousel-dot${i === currentIndex ? ' carousel-dot--active' : ''}" data-index="${i}" aria-label="Slide ${i + 1}"></button>`
    ).join('');

    dotsEl.querySelectorAll('.carousel-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        currentIndex = parseInt(dot.dataset.index, 10);
        update();
        resetAutoPlay();
      });
    });
  }

  function update() {
    const card = trackEl.querySelector('.product-card');
    if (!card) return;
    const cardWidth = card.getBoundingClientRect().width + gap;
    trackEl.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
    renderDots();
  }

  function scheduleUpdate() {
    requestAnimationFrame(() => {
      requestAnimationFrame(update);
    });
  }

  function next() {
    currentIndex = currentIndex >= getMaxIndex() ? 0 : currentIndex + 1;
    update();
  }

  function prev() {
    currentIndex = currentIndex <= 0 ? getMaxIndex() : currentIndex - 1;
    update();
  }

  function startAutoPlay() {
    if (!shouldAutoPlay || paused) return;
    stopAutoPlay();
    autoPlay = setInterval(next, autoPlayMs);
  }

  function stopAutoPlay() {
    if (autoPlay) {
      clearInterval(autoPlay);
      autoPlay = null;
    }
  }

  function resetAutoPlay() {
    stopAutoPlay();
    startAutoPlay();
  }

  function pauseAutoPlay() {
    paused = true;
    stopAutoPlay();
  }

  function resumeAutoPlay() {
    paused = false;
    startAutoPlay();
  }

  prevEl.addEventListener('click', () => { prev(); resetAutoPlay(); });
  nextEl.addEventListener('click', () => { next(); resetAutoPlay(); });

  const hoverTarget = wrapperEl || trackEl;
  hoverTarget.addEventListener('mouseenter', pauseAutoPlay);
  hoverTarget.addEventListener('mouseleave', resumeAutoPlay);

  let touchStartX = 0;
  trackEl.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  trackEl.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? next() : prev();
      resetAutoPlay();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseAutoPlay();
    else resumeAutoPlay();
  });

  function onResize() {
    itemsPerView = getItemsPerView();
    currentIndex = Math.min(currentIndex, getMaxIndex());
    scheduleUpdate();
  }

  render();
  renderDots();
  scheduleUpdate();
  window.addEventListener('load', scheduleUpdate, { once: true });
  startAutoPlay();

  return { onResize };
}

let mainCarousel;

document.querySelectorAll('.tabs__btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tabs__btn').forEach(b => b.classList.remove('tabs__btn--active'));
    document.querySelectorAll('.tabs__panel').forEach(p => p.classList.remove('tabs__panel--active'));
    btn.classList.add('tabs__btn--active');
    document.getElementById(btn.dataset.tab).classList.add('tabs__panel--active');
  });
});

async function init() {
  const trackEl = document.getElementById('carouselTrack');
  if (!trackEl) return;

  products = await loadNewestProducts(8);

  if (!products.length && Array.isArray(window.__CAROUSEL_PRODUCTS__) && window.__CAROUSEL_PRODUCTS__.length) {
    products = window.__CAROUSEL_PRODUCTS__;
  }

  if (!products.length) {
    trackEl.innerHTML = `
      <p class="carousel-empty">Kunne ikke indlæse motorcykler. Genindlæs siden eller kontakt os.</p>`;
    initNav();
    initHeader();
    initScrollTop();
    initActiveNav();
    initContactForm();
    return;
  }

  mainCarousel = createCarousel({
    trackEl,
    dotsEl: document.getElementById('carouselDots'),
    prevEl: document.getElementById('prevBtn'),
    nextEl: document.getElementById('nextBtn'),
    items: products,
    maxItems: 8,
    autoPlayMs: 4500,
  });

  initNav();
  initHeader();
  initScrollTop();
  initActiveNav();
  initContactForm();
}

init().catch(() => {
  const trackEl = document.getElementById('carouselTrack');
  if (trackEl && !trackEl.children.length) {
    trackEl.innerHTML = `
      <p class="carousel-empty">Kunne ikke indlæse motorcykler. Genindlæs siden.</p>`;
  }
});

window.addEventListener('resize', () => {
  mainCarousel?.onResize();
});
