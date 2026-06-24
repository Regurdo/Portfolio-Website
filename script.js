const root = document.documentElement;

/* ---------------- Helpers ---------------- */
const isTouchDevice = () =>
  window.matchMedia('(hover: none), (pointer: coarse)').matches ||
  'ontouchstart' in window;

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- Lenis smooth scroll ---------------- */
let lenis;
if (window.Lenis && !prefersReducedMotion()) {
  lenis = new Lenis({
    duration: 1.05,
    easing: (t) => 1 - Math.pow(1 - t, 3),
    smoothWheel: true,
    // Disable on touch devices to use native momentum scrolling
    smoothTouch: false,
  });
  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
}

/* ---------------- Scroll progress bar (rAF-throttled) ---------------- */
const progressBar = document.getElementById('scrollProgressBar');
let scrollProgressTicking = false;
function updateScrollProgress() {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  if (progressBar) progressBar.style.width = pct + '%';
  scrollProgressTicking = false;
}
function onScrollProgress() {
  if (!scrollProgressTicking) {
    requestAnimationFrame(updateScrollProgress);
    scrollProgressTicking = true;
  }
}
window.addEventListener('scroll', onScrollProgress, { passive: true });
if (lenis) lenis.on('scroll', updateScrollProgress);

/* ---------------- Hero watermark zig-zag parallax ---------------- */
const heroEl = document.querySelector('.hero-v2');
const heroBgTexts = document.querySelectorAll('.hero-v2__bg-text');
let heroWatermarkTicking = false;
function updateHeroWatermark() {
  if (heroEl && heroBgTexts.length) {
    const rect = heroEl.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, -rect.top / (rect.height || 1)));
    heroBgTexts.forEach((el) => {
      const dir = el.dataset.dir === 'left' ? -1 : 1;
      const distance = parseFloat(el.dataset.distance) || 70;
      el.style.transform = `translateX(${dir * progress * distance}px)`;
    });
  }
  heroWatermarkTicking = false;
}
function onHeroWatermarkScroll() {
  if (!heroWatermarkTicking) {
    requestAnimationFrame(updateHeroWatermark);
    heroWatermarkTicking = true;
  }
}
if (heroEl && heroBgTexts.length && !prefersReducedMotion()) {
  window.addEventListener('scroll', onHeroWatermarkScroll, { passive: true });
  if (lenis) lenis.on('scroll', updateHeroWatermark);
  updateHeroWatermark();
}
updateScrollProgress();

/* ---------------- Magnetic buttons (desktop only) ---------------- */
if (!isTouchDevice()) {
  document.querySelectorAll('.magnetic').forEach(el => {
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const relX = e.clientX - rect.left - rect.width / 2;
      const relY = e.clientY - rect.top - rect.height / 2;
      el.style.transform = `translate(${relX * 0.25}px, ${relY * 0.35}px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });
}

/* ---------------- Tilt 3D pada foto hero (desktop only) ---------------- */
const heroPhotoFrame = document.getElementById('heroPhotoFrame');
if (heroPhotoFrame && !isTouchDevice()) {
  const heroVisual = heroPhotoFrame.closest('.hero-v2__photo-wrap');
  if (!heroVisual) { /* no-op if markup changed */ }
  else {
  heroVisual.addEventListener('mousemove', (e) => {
    const rect = heroPhotoFrame.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    heroPhotoFrame.style.transform = `rotateY(${px * 10}deg) rotateX(${-py * 10}deg) scale(1.01)`;
  });
  heroVisual.addEventListener('mouseleave', () => {
    heroPhotoFrame.style.transform = 'rotateY(0deg) rotateX(0deg) scale(1)';
  });
  }
}

/* ---------------- GitHub heatmap: dark theme only ---------------- */
const GH_USERNAME = 'Regurdo';
const GH_HEATMAP = document.getElementById('ghHeatmap');
function updateGhHeatmap() {
  if (!GH_HEATMAP) return;
  // Dark mode only — use a light accent so squares read well on dark cards.
  const hex = 'a8c4e6';
  GH_HEATMAP.src = `https://ghchart.rshah.org/${hex}/${GH_USERNAME}`;
}
updateGhHeatmap();

/* ---------------- Active Nav State (scroll-based scrollspy) ---------------- */
// A robust scroll-based scrollspy. The old IntersectionObserver with
// `-40% 0px -55% 0px` rootMargin skipped short sections (gallery) and never
// fired for the sticky #about div. We now use offsetTop walking + a 35% threshold.
const allNavLinks = document.querySelectorAll('.dock-item[data-section], .mobile-nav-item[data-section]');

// Build the list of sections to track.
// The ap-section contains BOTH #about (sticky left) and #projects (scrolling right)
// at the same vertical position, so we treat the parent .ap-section as one block
// and split it into two halves by scroll progress (About = top half, Projects = bottom half).
function getDocTop(el) {
  let top = 0;
  while (el) {
    top += el.offsetTop;
    el = el.offsetParent;
  }
  return top;
}

function buildSectionList() {
  // Only track sections that have a corresponding nav link.
  // #github is intentionally NOT in the dock, so we skip it — when the user
  // scrolls through the github section, the previous active state (showcase)
  // remains until contact takes over. This gives continuous visual feedback.
  const list = [];
  const topEl = document.getElementById('top');
  if (topEl) list.push({ id: 'top', el: topEl, docTop: getDocTop(topEl) });

  // New section layout: about → resume → gallery → showcase → github → contact
  ['about', 'resume', 'gallery', 'showcase', 'github', 'contact'].forEach(id => {
    const el = document.getElementById(id);
    if (el) list.push({ id, el, docTop: getDocTop(el) });
  });
  // Sort by docTop just in case
  list.sort((a, b) => a.docTop - b.docTop);
  return list;
}
let sectionList = buildSectionList();
let sectionListDirty = true; // Rebuild on first scroll since positions may shift as images/fonts load

let scrollspyTicking = false;
function updateActiveNav() {
  scrollspyTicking = false;
  if (sectionListDirty) {
    sectionList = buildSectionList();
    sectionListDirty = false;
  }
  const threshold = window.innerHeight * 0.35; // 35% from viewport top
  const scrollPos = window.scrollY + threshold;

  let activeId = sectionList[0]?.id || 'top';
  for (let i = 0; i < sectionList.length; i++) {
    const s = sectionList[i];
    if (!s.el) continue;
    if (scrollPos >= s.docTop) {
      activeId = s.id;
    } else {
      break;
    }
  }

  allNavLinks.forEach(link => {
    link.classList.toggle('active', link.getAttribute('data-section') === activeId);
  });
}
function onScrollSpy() {
  if (!scrollspyTicking) {
    requestAnimationFrame(updateActiveNav);
    scrollspyTicking = true;
  }
}
window.addEventListener('scroll', onScrollSpy, { passive: true });
if (lenis) lenis.on('scroll', onScrollSpy);
// Recompute section positions after fonts/images settle and on resize
let resizeSpyT;
window.addEventListener('resize', () => {
  clearTimeout(resizeSpyT);
  resizeSpyT = setTimeout(() => {
    sectionListDirty = true;
    updateActiveNav();
  }, 200);
});
window.addEventListener('load', () => {
  sectionListDirty = true;
  updateActiveNav();
});
// Also rebuild when webfonts load (Fraunces is wider than fallback serif)
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    sectionListDirty = true;
    updateActiveNav();
  });
}
// Mark dirty after images load (heights change)
document.querySelectorAll('img').forEach(img => {
  if (!img.complete) {
    img.addEventListener('load', () => { sectionListDirty = true; }, { once: true });
    img.addEventListener('error', () => { sectionListDirty = true; }, { once: true });
  }
});
// Initial run (after a small delay so layout is ready)
requestAnimationFrame(() => requestAnimationFrame(updateActiveNav));
// Re-check after a longer delay to catch late-arriving image dimensions
setTimeout(() => { sectionListDirty = true; updateActiveNav(); }, 1500);

/* ---------------- Hero & Reveal Animations ---------------- */
requestAnimationFrame(() => {
  const heroSection = document.querySelector('.hero');
  if (heroSection) heroSection.classList.add('is-in');
});

const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  });
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

/* ---------------- Stack Component ---------------- */
function initStack(containerId, images, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { cardOffset = 10, scaleFactor = 0.06, sendToBackOnClick = true } = options;
  container.innerHTML = '';
  let order = images.map((_, i) => i);

  function render() {
    order.forEach((imgIndex, stackPos) => {
      let card = container.querySelector(`[data-img="${imgIndex}"]`);
      if (!card) {
        card = document.createElement('div');
        card.className = 'stack-card';
        card.dataset.img = imgIndex;
        const img = document.createElement('img');
        img.src = images[imgIndex];
        img.draggable = false;
        img.alt = 'Dafa Fatian Akbar gallery';
        // Graceful fallback if local assets are missing
        img.onerror = function () {
          this.onerror = null;
          this.src = `https://picsum.photos/seed/stack${imgIndex + 1}/400/500`;
        };
        card.appendChild(img);
        container.appendChild(card);
        attachDrag(card);
      }
      const depthFromTop = order.length - 1 - stackPos;
      card.style.zIndex = stackPos;
      card.style.transform = `translateY(${depthFromTop * -cardOffset}px) scale(${1 - depthFromTop * scaleFactor})`;
    });
  }

  function sendToBack(imgIndex) {
    order = order.filter(i => i !== imgIndex);
    order.unshift(imgIndex);
    render();
  }

  function attachDrag(card) {
    let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false;
    const isTopCard = () => Number(card.dataset.img) === order[order.length - 1];

    function onDown(e) {
      if (!isTopCard()) return;
      dragging = true;
      card.classList.add('is-dragging');
      const point = e.touches ? e.touches[0] : e;
      startX = point.clientX; startY = point.clientY;
    }
    function onMove(e) {
      if (!dragging) return;
      const point = e.touches ? e.touches[0] : e;
      dx = point.clientX - startX; dy = point.clientY - startY;
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx * 0.05}deg)`;
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      card.classList.remove('is-dragging');
      if (Math.abs(dx) > 80 || Math.abs(dy) > 80) {
        sendToBack(Number(card.dataset.img));
      } else {
        render();
      }
      dx = 0; dy = 0;
    }

    card.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    card.addEventListener('touchstart', onDown, { passive: true });
    card.addEventListener('touchmove', onMove, { passive: true });
    card.addEventListener('touchend', onUp);

    if (sendToBackOnClick) {
      card.addEventListener('click', () => {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5 && isTopCard()) {
          sendToBack(Number(card.dataset.img));
        }
      });
    }
  }
  render();
}

initStack('aboutStack', [
  'Assets/stack1.png',
  'Assets/stack2.JPG',
  'Assets/stack3.jpeg',
], {
  cardOffset: 12, scaleFactor: 0.05,
});

/* ---------------- Gallery: smooth infinite draggable canvas ---------------- */
(function initGalleryCanvas() {
  const wrap = document.getElementById('galleryWrap');
  const canvas = document.getElementById('galleryCanvas');
  const template = canvas ? canvas.querySelector('.gallery-tile') : null;
  if (!wrap || !canvas || !template) return;

  const TILE_W = 1480;
  const TILE_H = 1180;

  // Build 3x3 grid of the same tile so it loops seamlessly
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const isOrigin = i === 0 && j === 0;
      const tile = isOrigin ? template : template.cloneNode(true);
      tile.style.left = (i * TILE_W) + 'px';
      tile.style.top = (j * TILE_H) + 'px';
      if (!isOrigin) canvas.appendChild(tile);
    }
  }

  let targetX = -220, targetY = -180;
  let curX = targetX, curY = targetY;
  let velX = 0, velY = 0;
  let dragging = false;
  let lastX = 0, lastY = 0, lastT = 0;
  let hasMoved = false;
  let rafId = null;

  function wrapVal(v, size) {
    return ((v % size) + size) % size - size;
  }

  function render() {
    const wx = wrapVal(curX, TILE_W);
    const wy = wrapVal(curY, TILE_H);
    canvas.style.transform = `translate3d(${wx}px, ${wy}px, 0)`;
  }

  function markMoved() {
    if (!hasMoved) {
      hasMoved = true;
      wrap.classList.add('has-moved');
    }
  }

  function loop() {
    curX += (targetX - curX) * 0.16;
    curY += (targetY - curY) * 0.16;

    if (!dragging) {
      if (Math.abs(velX) > 0.02 || Math.abs(velY) > 0.02) {
        targetX += velX;
        targetY += velY;
        velX *= 0.93;
        velY *= 0.93;
      } else {
        velX = 0; velY = 0;
      }
    }

    render();

    const settled = !dragging && velX === 0 && velY === 0 &&
      Math.abs(targetX - curX) < 0.05 && Math.abs(targetY - curY) < 0.05;

    if (!settled) {
      rafId = requestAnimationFrame(loop);
    } else {
      rafId = null;
    }
  }
  function ensureLoop() {
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  function pointerDown(e) {
    dragging = true;
    velX = 0; velY = 0;
    wrap.classList.add('is-dragging');
    const p = e.touches ? e.touches[0] : e;
    lastX = p.clientX; lastY = p.clientY; lastT = performance.now();
    ensureLoop();
  }
  function pointerMove(e) {
    if (!dragging) return;
    const p = e.touches ? e.touches[0] : e;
    const now = performance.now();
    const dx = p.clientX - lastX;
    const dy = p.clientY - lastY;
    const dt = Math.max(now - lastT, 1);

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) markMoved();

    targetX += dx;
    targetY += dy;

    velX = (dx / dt) * 16;
    velY = (dy / dt) * 16;

    lastX = p.clientX; lastY = p.clientY; lastT = now;
    ensureLoop();
  }
  function pointerUp() {
    dragging = false;
    wrap.classList.remove('is-dragging');
    ensureLoop();
  }

  wrap.addEventListener('mousedown', pointerDown);
  window.addEventListener('mousemove', pointerMove);
  window.addEventListener('mouseup', pointerUp);
  wrap.addEventListener('touchstart', pointerDown, { passive: true });
  wrap.addEventListener('touchmove', pointerMove, { passive: true });
  wrap.addEventListener('touchend', pointerUp);

  // EVENT WHEEL DIHAPUS AGAR SCROLL MOUSE TIDAK TERHALANG OLEH GALERI

  render();
})();

/* ---------------- Project modal (With Focus Trap) ---------------- */
const projectModal = document.getElementById('projectModal');
const modalClose = document.getElementById('modalClose');
let lastFocusedElement = null;

function openProjectModal(card) {
  const isLocked = card.dataset.locked === 'true';
  document.getElementById('modalTitle').textContent = card.dataset.title || '';
  document.getElementById('modalCategory').textContent = card.dataset.category || '';
  document.getElementById('modalYear').textContent = card.dataset.year ? '· ' + card.dataset.year : '';
  document.getElementById('modalDesc').textContent = card.dataset.desc || '';

  const modalTags = document.getElementById('modalTags');
  modalTags.innerHTML = '';
  (card.dataset.tags || '').split(',').map(t => t.trim()).filter(Boolean).forEach(tag => {
    const span = document.createElement('span');
    span.className = 'modal-tag';
    span.textContent = tag;
    modalTags.appendChild(span);
  });

  const modalLockedNote = document.getElementById('modalLockedNote');
  const modalLink = document.getElementById('modalLink');
  if (isLocked) {
    modalLockedNote.style.display = 'flex';
    modalLink.style.display = 'none';
  } else {
    modalLockedNote.style.display = 'none';
    modalLink.style.display = 'inline-flex';
    modalLink.href = card.dataset.link || '#';
  }

  lastFocusedElement = card;
  projectModal.classList.add('is-open');
  projectModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  if (lenis) lenis.stop();

  setTimeout(() => modalClose.focus(), 100);
}

function closeProjectModal() {
  projectModal.classList.remove('is-open');
  projectModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (lenis) lenis.start();
  if (lastFocusedElement) lastFocusedElement.focus();
}

document.querySelectorAll('.project-list-item').forEach(card => {
  card.addEventListener('click', () => openProjectModal(card));
});
modalClose.addEventListener('click', closeProjectModal);
projectModal.addEventListener('click', (e) => {
  if (e.target === projectModal) closeProjectModal();
});

// Focus Trap & Escape Key
document.addEventListener('keydown', (e) => {
  if (!projectModal.classList.contains('is-open')) return;

  if (e.key === 'Escape') {
    closeProjectModal();
  } else if (e.key === 'Tab') {
    const focusableElements = projectModal.querySelectorAll('button, a[href]');
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }
});

/* ---------------- Certificate viewer modal (image / PDF preview) ---------------- */
const certModal = document.getElementById('certModal');
const certModalClose = document.getElementById('certModalClose');
const certModalViewer = document.getElementById('certModalViewer');
const certModalTitle = document.getElementById('certModalTitle');
const certModalIssuer = document.getElementById('certModalIssuer');
const certModalYear = document.getElementById('certModalYear');
const certModalOpen = document.getElementById('certModalOpen');
let lastFocusedCertCard = null;

function openCertModal(card) {
  const src = card.dataset.certSrc;
  const type = card.dataset.certType || 'image';
  if (!src) return;

  const title = card.querySelector('.cert-card__title')?.textContent || '';
  const issuer = card.dataset.issuer || '';
  const year = card.dataset.year || '';

  certModalTitle.textContent = title;
  certModalIssuer.textContent = issuer;
  certModalYear.textContent = year ? '· ' + year : '';
  certModalOpen.href = src;

  certModalViewer.innerHTML = '';
  if (type === 'pdf') {
    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.title = 'Pratinjau PDF — ' + title;
    certModalViewer.appendChild(iframe);
  } else {
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Sertifikat — ' + title;
    certModalViewer.appendChild(img);
  }

  lastFocusedCertCard = card;
  certModal.classList.add('is-open');
  certModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  if (lenis) lenis.stop();

  setTimeout(() => certModalClose.focus(), 100);
}

function closeCertModal() {
  certModal.classList.remove('is-open');
  certModal.setAttribute('aria-hidden', 'true');
  certModalViewer.innerHTML = '';
  document.body.style.overflow = '';
  if (lenis) lenis.start();
  if (lastFocusedCertCard) lastFocusedCertCard.focus();
}

document.querySelectorAll('.cert-card[data-cert-src]').forEach(card => {
  card.addEventListener('click', () => openCertModal(card));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openCertModal(card);
    }
  });
});
certModalClose.addEventListener('click', closeCertModal);
certModal.addEventListener('click', (e) => {
  if (e.target === certModal) closeCertModal();
});

document.addEventListener('keydown', (e) => {
  if (!certModal.classList.contains('is-open')) return;

  if (e.key === 'Escape') {
    closeCertModal();
  } else if (e.key === 'Tab') {
    const focusableElements = certModal.querySelectorAll('button, a[href]');
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }
});

/* ---------------- Smooth Anchor Link Scrolling ---------------- */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length <= 1) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    // Offset for desktop dock height; mobile has bottom nav so top is fine
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const offset = isMobile ? 16 : 96;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    if (lenis) {
      lenis.scrollTo(top, { immediate: false, duration: 1.2 });
    } else {
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

/* ---------------- Handle window resize: refresh Lenis ---------------- */
/* NOTE: Contact form submission is handled by setupContactForm() IIFE
   near the bottom of this file — do NOT add a second submit listener
   here, or the form will be POSTed twice per click. */
let resizeT;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    if (lenis) lenis.resize();
  }, 150);
});

/* ---------------- Page load fade-in ---------------- */
window.addEventListener('load', () => {
  document.body.classList.add('is-loaded');
});
// Fallback in case 'load' takes too long
setTimeout(() => document.body.classList.add('is-loaded'), 1500);

/* ---------------- Hero name: split into chars for staggered reveal ---------------- */
(function initHeroNameChars() {
  const heroName = document.getElementById('heroName');
  if (!heroName) return;
  // Preserve <br> by walking child nodes
  const fragments = [];
  Array.from(heroName.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      for (const ch of text) {
        if (ch === ' ') {
          fragments.push({ type: 'space' });
        } else {
          fragments.push({ type: 'char', ch });
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') {
      fragments.push({ type: 'br' });
    }
  });
  heroName.innerHTML = '';
  let i = 0;
  fragments.forEach(f => {
    if (f.type === 'char') {
      const span = document.createElement('span');
      span.className = 'char';
      span.textContent = f.ch;
      span.style.transitionDelay = `${i * 35}ms`;
      heroName.appendChild(span);
      i++;
    } else if (f.type === 'space') {
      const span = document.createElement('span');
      span.className = 'char space';
      span.innerHTML = '&nbsp;';
      heroName.appendChild(span);
    } else if (f.type === 'br') {
      const br = document.createElement('br');
      heroName.appendChild(br);
    }
  });
})();

/* ---------------- Custom cursor + skill tilt removed per user request ---------------- */
/* (kept the section comment as a marker so the diff is easy to follow) */

/* ---------------- Project list: sibling dim on hover (ReactBits focus effect) ---------------- */
const projectList = document.getElementById('projectList');
if (projectList) {
  projectList.querySelectorAll('.project-list-item').forEach(item => {
    item.addEventListener('mouseenter', () => projectList.classList.add('has-hover'));
    item.addEventListener('mouseleave', () => projectList.classList.remove('has-hover'));
  });
}

/* ---------------- Project list: thumbnail parallax on hover (desktop) ---------------- */
if (!isTouchDevice() && !prefersReducedMotion()) {
  document.querySelectorAll('.project-list-item').forEach(card => {
    const thumb = card.querySelector('.project-list-item__thumb img');
    if (!thumb) return;
    card.addEventListener('mousemove', (e) => {
      const rect = card.querySelector('.project-list-item__thumb').getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      // Combine the existing scale(1.08) from CSS with a small translate
      thumb.style.transform = `scale(1.08) translate(${px * -8}px, ${py * -6}px)`;
    });
    card.addEventListener('mouseleave', () => {
      thumb.style.transform = '';
    });
  });
}

/* ---------------- GitHub stats: 2x2 stat grid animated counters ---------------- */
// Pull numbers from the GitHub API and animate count-up on the four stat cards
// (Public Repos, Contributions, Followers, Year Joined) when the section scrolls in.
(function initGithubStats() {
  const ghSection = document.getElementById('github');
  if (!ghSection || !GH_USERNAME) return;

  const reposEl = document.getElementById('ghStatRepos');
  const contribEl = document.getElementById('ghStatContrib');
  const followersEl = document.getElementById('ghStatFollowers');
  const yearEl = document.getElementById('ghStatYear');
  const contribTotalEl = document.getElementById('ghContribTotal');
  const contribSubEl = document.getElementById('ghContribSub');

  // Year joined — a sensible default based on the GitHub username creation year
  // (We'll set it once fetch succeeds if the API returns created_at; otherwise keep 2023.)
  let fetched = false;

  function animateNumber(el, target, opts = {}) {
    if (!el) return;
    const dur = opts.duration || 1500;
    const fmt = opts.formatter || (v => v.toString());
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(Math.floor(eased * target));
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = fmt(target);
    }
    requestAnimationFrame(tick);
  }

  function animateYear(el, target) {
    if (!el) return;
    const dur = 1200;
    const start = performance.now();
    const baseYear = 2008; // GitHub founding year
    function tick(now) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = Math.round(baseYear + (target - baseYear) * eased);
      el.textContent = cur.toString();
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = target.toString();
    }
    requestAnimationFrame(tick);
  }

  const fmtThousand = (v) => v.toLocaleString('en-US');

  async function fetchGh() {
    if (fetched) return;
    fetched = true;

    // Animate Year Joined right away (we have a default)
    if (yearEl) animateYear(yearEl, parseInt(yearEl.dataset.target || '2023', 10));

    try {
      // Try the public REST API first
      const res = await fetch(`https://api.github.com/users/${GH_USERNAME}`);
      if (!res.ok) throw new Error('GH API error');
      const data = await res.json();

      const repos = data.public_repos || 0;
      const followers = data.followers || 0;

      // Use created_at to derive the actual join year
      let joinYear = 2023;
      if (data.created_at) {
        const d = new Date(data.created_at);
        if (!isNaN(d.getTime())) joinYear = d.getFullYear();
      }

      // Animate the four stat cards
      animateNumber(reposEl, repos, { formatter: fmtThousand });
      animateNumber(followersEl, followers, { formatter: fmtThousand });
      if (yearEl && parseInt(yearEl.dataset.target, 10) !== joinYear) {
        yearEl.dataset.target = joinYear;
        animateYear(yearEl, joinYear);
      }

      // Contributions count: we approximate via a second fetch to the
      // contributions SVG (count "rect" elements with fill that's not the empty color).
      // If that fails, fall back to a derived number based on repos + gists.
      let contribCount = 0;
      try {
        const ghChartRes = await fetch(`https://ghchart.rshah.org/${GH_USERNAME}`);
        if (ghChartRes.ok) {
          const svgText = await ghChartRes.text();
          // Count rect elements that have a fill other than the empty/background color (#ebedf0 or #eee)
          const matches = svgText.match(/<rect[^>]*fill="(#[0-9a-fA-F]{3,6})"[^>]*>/g) || [];
          contribCount = matches.filter(m => {
            const fillMatch = m.match(/fill="(#[0-9a-fA-F]{3,6})"/);
            if (!fillMatch) return false;
            const fill = fillMatch[1].toLowerCase();
            // Filter out empty colors
            return !['#ebedf0', '#eee', '#ebede9', '#f3f3f0'].includes(fill);
          }).length;
        }
      } catch (e) { /* ignore — fall back below */ }

      if (contribCount === 0) {
        // Fallback: rough estimate based on public activity
        contribCount = (data.public_gists || 0) * 12 + repos * 8;
      }

      animateNumber(contribEl, contribCount, { formatter: fmtThousand });
      if (contribTotalEl) animateNumber(contribTotalEl, contribCount, { formatter: fmtThousand });

      // Update subtitle to show date range
      if (contribSubEl) {
        const now = new Date();
        const lastYear = new Date(now);
        lastYear.setFullYear(now.getFullYear() - 1);
        const fmtMonth = (d) => d.toLocaleString('en-US', { month: 'short' });
        contribSubEl.textContent = `${fmtMonth(lastYear)} ${lastYear.getFullYear()} — ${fmtMonth(now)} ${now.getFullYear()}`;
      }
    } catch (e) {
      // Silent fail — counters stay at 0 / Year Joined stays at 2023
      if (contribSubEl) contribSubEl.textContent = 'Last 12 months';
    }
  }

  const ghObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        fetchGh();
        ghObserver.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -20% 0px', threshold: 0.1 });
  ghObserver.observe(ghSection);

  /* Contribution map intro animation: clip-path wipe from left to right
     (auto-plays once when the panel scrolls into view — no manual button). */
  const contribPanel = document.querySelector('.gh-contribution');
  if (contribPanel) {
    function playContribution() {
      contribPanel.classList.remove('is-played');
      // Force reflow so the animation restarts
      void contribPanel.offsetWidth;
      contribPanel.classList.add('is-played');
    }
    // Auto-play once when the panel scrolls into view
    const playObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          setTimeout(playContribution, 200);
          playObserver.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -15% 0px', threshold: 0.15 });
    playObserver.observe(contribPanel);
  }
})();

/* ---------------- Page loader: eased progress bar + graceful exit ---------------- */
(function initPageLoader() {
  const loader = document.getElementById('pageLoader');
  const barFill = document.getElementById('loaderBarFill');
  const pctEl = document.getElementById('loaderPct');
  const hintEl = document.getElementById('loaderHint');
  if (!loader || !barFill || !pctEl) return;

  const hints = ['Initializing', 'Loading fonts', 'Fetching projects', 'Almost there'];
  let progress = 0;
  let target = 6;
  let hintIdx = 0;
  let done = false;
  let exited = false;

  function paint() {
    // Ease progress smoothly toward its current target instead of jumping.
    progress += (target - progress) * 0.12;
    if (target - progress < 0.1) progress = target;
    barFill.style.width = progress + '%';
    pctEl.textContent = Math.round(progress) + '%';

    const newHintIdx = Math.min(hints.length - 1, Math.floor(progress / 26));
    if (newHintIdx !== hintIdx && hintEl) {
      hintIdx = newHintIdx;
      hintEl.textContent = hints[hintIdx];
    }

    if (progress >= 99.5 && done) {
      barFill.style.width = '100%';
      pctEl.textContent = '100%';
      exitLoader();
      return;
    }
    requestAnimationFrame(paint);
  }
  requestAnimationFrame(paint);

  // Let the target drift upward over time so the bar always feels alive,
  // capped below 100 until the page has actually finished loading.
  const drift = setInterval(() => {
    if (done) return;
    target = Math.min(92, target + Math.random() * 9 + 4);
  }, 260);

  function hideLoader() {
    if (done) return;
    done = true;
    clearInterval(drift);
    target = 100;
  }

  function exitLoader() {
    if (exited) return;
    exited = true;
    setTimeout(() => {
      loader.classList.add('is-leaving');
      document.body.classList.add('is-loaded');
      setTimeout(() => {
        loader.classList.add('is-hidden');
        setTimeout(() => { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 600);
      }, 520);
    }, 180);
  }

  // Hide on window load (or after 3.5s fallback)
  if (document.readyState === 'complete') {
    hideLoader();
  } else {
    window.addEventListener('load', () => setTimeout(hideLoader, 200));
  }
  // Fallback in case 'load' takes too long
  setTimeout(hideLoader, 3500);
})();

/* ---------------- Hero & reveal: ensure new card classes trigger entrance ---------------- */
// Add the new class names to the existing IntersectionObserver pattern.
// We re-run an observer here so the new cards animate in even if the original
// .reveal observer was set up before these elements existed.
(function initExtendedReveals() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });

  document.querySelectorAll('.gh-stat, .cert-card, .resume-tl__item, .techstack-card').forEach(el => io.observe(el));
})();

/* ---------------- Portfolio Showcase: tab switching ---------------- */
(function initShowcaseTabs() {
  const tabs = document.querySelectorAll('.showcase-tab');
  const panels = document.querySelectorAll('.showcase-panel');
  const panelsWrap = document.querySelector('.showcase-panels');
  if (!tabs.length || !panels.length) return;

  // Measure every panel's natural height (even the hidden ones) and lock
  // .showcase-panels to the tallest one, so switching tabs never makes the
  // section jump up/down.
  function syncShowcasePanelsHeight() {
    if (!panelsWrap) return;
    let maxH = 0;
    panels.forEach(panel => {
      const wasHidden = panel.hidden;
      const prevCssText = panel.style.cssText;
      // Force it into the layout invisibly so we can read its real height,
      // without it ever being painted or interactive.
      panel.hidden = false;
      panel.style.cssText = 'display:block !important; position:absolute; visibility:hidden; pointer-events:none; width:' + panelsWrap.clientWidth + 'px;';
      const h = panel.scrollHeight;
      if (h > maxH) maxH = h;
      panel.style.cssText = prevCssText;
      panel.hidden = wasHidden;
    });
    if (maxH > 0) panelsWrap.style.minHeight = maxH + 'px';
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      // Update tab states
      tabs.forEach(t => {
        const active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      // Update panel states
      panels.forEach(panel => {
        const active = panel.dataset.panel === target;
        panel.classList.toggle('is-active', active);
        if (active) {
          panel.hidden = false;
          // Re-trigger reveal animations on the newly-shown panel
          requestAnimationFrame(() => {
            panel.querySelectorAll('.reveal:not(.is-in), .project-list-item:not(.is-in), .cert-card:not(.is-in), .techstack-card:not(.is-in)').forEach((el, i) => {
              // Stagger the entrance slightly
              setTimeout(() => el.classList.add('is-in'), i * 60);
            });
          });
        } else {
          panel.hidden = true;
        }
      });
    });
  });

  // Initial measurement + re-measure on resize and once images/fonts settle.
  syncShowcasePanelsHeight();
  window.addEventListener('load', syncShowcasePanelsHeight);
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(syncShowcasePanelsHeight, 150);
  });
})();

/* ---------------- Subtle parallax for blob decorations (desktop only) ---------------- */
if (!isTouchDevice() && !prefersReducedMotion()) {
  const blobs = document.querySelectorAll('.blob');
  let parallaxTicking = false;
  let mouseX = 0.5, mouseY = 0.5;
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX / window.innerWidth;
    mouseY = e.clientY / window.innerHeight;
    if (!parallaxTicking) {
      requestAnimationFrame(() => {
        blobs.forEach((blob, i) => {
          const depth = (i + 1) * 18;
          const dx = (mouseX - 0.5) * depth;
          const dy = (mouseY - 0.5) * depth;
          blob.style.translate = `${dx}px ${dy}px`;
        });
        parallaxTicking = false;
      });
      parallaxTicking = true;
    }
  });
}

/* ---------------- Resume timeline items: hover sync dot+card ---------------- */
document.querySelectorAll('.resume-tl__item').forEach(item => {
  item.addEventListener('mouseenter', () => item.classList.add('is-hover'));
  item.addEventListener('mouseleave', () => item.classList.remove('is-hover'));
});

/* ---------------- Certificate PDF thumbnails (rendered from the actual first page via pdf.js) ---------------- */
(function renderPdfCertThumbnails() {
  if (typeof pdfjsLib === 'undefined') return; // library failed to load (e.g. offline) — keep the static placeholder image
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  document.querySelectorAll('.cert-card[data-cert-type="pdf"]').forEach(async (card) => {
    const src = card.dataset.certSrc;
    const imgEl = card.querySelector('.cert-card__preview img');
    if (!src || !imgEl) return;
    try {
      const pdf = await pdfjsLib.getDocument(src).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      canvas.setAttribute('aria-hidden', 'true');
      imgEl.replaceWith(canvas);
    } catch (err) {
      // PDF belum ada / gagal dimuat — preview tetap memakai gambar placeholder, tidak ada yang rusak
      console.warn('Tidak bisa membuat thumbnail PDF untuk', src, err);
    }
  });
})();

/* ============================================================
   CONTACT FORM — Formspree AJAX submission
   Sends form data to Formspree via fetch, shows inline status
   (sending → success/error), and preserves the form on error
   so the user can retry without losing what they typed.
   ============================================================ */
(function setupContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const submitBtn = document.getElementById('contactSubmit');
  const statusEl = document.getElementById('contactStatus');
  const btnTextEl = form.querySelector('.contact-v2__btn-text');

  function setStatus(kind, message) {
    if (!statusEl) return;
    statusEl.className = 'contact-v2__status is-visible contact-v2__status--' + kind;
    statusEl.textContent = message;
  }

  function clearStatus() {
    if (!statusEl) return;
    statusEl.className = 'contact-v2__status';
    statusEl.textContent = '';
  }

  function setSending(isSending) {
    if (!submitBtn) return;
    submitBtn.disabled = isSending;
    submitBtn.classList.toggle('is-sending', isSending);
    if (btnTextEl) btnTextEl.textContent = isSending ? 'Sending…' : 'Send Message';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearStatus();

    // Native HTML5 validation first
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const action = form.getAttribute('action');
    if (!action || action.indexOf('YOUR_FORM_ID') !== -1) {
      // Placeholder is still in place — remind the owner to swap it in.
      setStatus('error', 'Formspree endpoint belum dikonfigurasi. Ganti YOUR_FORM_ID di attribute action (index.html baris 847) pake ID form kamu dari formspree.io.');
      return;
    }

    setSending(true);
    setStatus('sending', 'Mengirim pesan…');

    try {
      const formData = new FormData(form);
      const response = await fetch(action, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' }
      });

      setSending(false);

      if (response.ok) {
        setStatus('success', '✓ Terkirim! Makasih udah ngirim pesan, aku akan segera membalas.');
        form.reset();
      } else {
        // Try to parse Formspree's JSON error shape
        let msg = 'Terjadi kesalahan saat mengirim. Coba lagi sebentar.';
        try {
          const data = await response.json();
          if (data && data.errors && data.errors.length) {
            msg = data.errors.map(err => err.message).join(' ');
          }
        } catch (_) { /* ignore parse errors */ }
        setStatus('error', '✕ ' + msg);
      }
    } catch (err) {
      setSending(false);
      setStatus('error', '✕ Koneksi gagal. Cek internet kamu lalu coba lagi.');
    }
  });
})();
