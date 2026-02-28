/**
 * プラントライフ Podcast サイト — Script
 * ======================================
 * Sticky header, mobile menu, scroll animations,
 * dynamic episode loading, and smooth scrolling.
 */

document.addEventListener('DOMContentLoaded', () => {
  initStickyHeader();
  initMobileMenu();
  initSmoothScroll();
  initActiveNav();
  initScrollReveal();
  initLatestEpisodes();
});

/* ── Sticky header ── */
function initStickyHeader() {
  const header = document.getElementById('header');
  if (!header) return;
  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 60);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ── Mobile menu ── */
function initMobileMenu() {
  const btn = document.getElementById('mobile-menu-btn');
  const nav = document.getElementById('header-nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => {
    btn.classList.toggle('open');
    nav.classList.toggle('open');
  });
  nav.querySelectorAll('.nav-link').forEach(link =>
    link.addEventListener('click', () => {
      btn.classList.remove('open');
      nav.classList.remove('open');
    })
  );
}

/* ── Smooth scroll for anchor links ── */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const id = link.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ── Active navigation ── */
function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const links = document.querySelectorAll('.nav-link');
  if (!sections.length || !links.length) return;

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        links.forEach(l => {
          l.classList.toggle('active', l.getAttribute('href') === `#${id}`);
        });
      });
    },
    { rootMargin: '-20% 0px -70% 0px' }
  );

  sections.forEach(s => observer.observe(s));
}

/* ── Scroll reveal ── */
function initScrollReveal() {
  const selectors = [
    '.ep-latest-card',
    '.bento-item', '.genre-chip',
    '.link-card', '.cta-item',
    '.platform-pill',
    '.timeline-item'
  ];

  const els = document.querySelectorAll(selectors.join(','));
  if (!els.length) return;

  els.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    el.style.transition = `opacity 0.5s ease ${(i % 8) * 0.05}s, transform 0.5s ease ${(i % 8) * 0.05}s`;
  });

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -40px 0px', threshold: 0.05 }
  );

  els.forEach(el => observer.observe(el));
}

/* ── Latest 5 episodes with thumbnails ── */
function initLatestEpisodes() {
  const grid = document.getElementById('ep-latest-grid');
  if (!grid) return;

  fetch('episodes.json')
    .then(r => r.json())
    .then(data => {
      // Sort newest first, take top 5
      const latest = data
        .filter(ep => ep.number && parseInt(ep.number) > 0)
        .sort((a, b) => parseInt(b.number) - parseInt(a.number))
        .slice(0, 5);

      latest.forEach((ep, i) => {
        // Clean title
        let displayTitle = ep.title;
        const m = displayTitle.match(/^#?\d+\s+(.+)/);
        if (m) displayTitle = m[1];

        const card = document.createElement('a');
        card.href = `episodes/${ep.number}.html`;
        card.className = 'ep-latest-card';

        card.innerHTML = `
          <div class="ep-latest-thumb">
            <img src="${escapeHtml(ep.thumbnail || 'images/podcast-artwork.png')}" alt="${escapeHtml(displayTitle)}" loading="lazy">
            <span class="ep-latest-number">#${ep.number}</span>
          </div>
          <div class="ep-latest-body">
            <div class="ep-latest-meta">
              <time>${ep.pub_date || ''}</time>
              ${ep.duration ? `<span>⏱ ${ep.duration}</span>` : ''}
            </div>
            <h3 class="ep-latest-title">${escapeHtml(displayTitle)}</h3>
            <p class="ep-latest-desc">${escapeHtml((ep.description || '').slice(0, 120))}${(ep.description || '').length > 120 ? '...' : ''}</p>
          </div>
        `;

        // Animate in staggered
        card.style.opacity = '0';
        card.style.transform = 'translateY(16px)';
        card.style.transition = `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s`;
        grid.appendChild(card);

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';

            // Allow time for the transition to finish, then clear inline styles
            // so CSS :hover effects can apply properly
            setTimeout(() => {
              card.style.transition = '';
              card.style.transform = '';
            }, 600 + (i * 100));
          });
        });
      });
    })
    .catch(err => console.warn('episodes.json load error:', err));
}

/* ── Utility ── */
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
