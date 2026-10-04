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
  initHashOnLoad();
  initActiveNav();
  initScrollReveal();
  initLatestEpisodes();
  initShareButtons();
  initTranscriptToc();
  initBackToTop();
  initEpisodePlayButton();
  initAnalyticsEvents();
});

/* ── Clean up hash on landing (e.g. /#episodes from sub-pages) ── */
function initHashOnLoad() {
  if (!location.hash) return;
  const id = location.hash.slice(1);
  const target = document.getElementById(id);
  if (!target) return;
  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', location.pathname + location.search);
  });
}

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
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'header-nav');
  const setMenu = (open) => {
    btn.classList.toggle('open', open);
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  btn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  nav.querySelectorAll('.nav-link').forEach(link =>
    link.addEventListener('click', () => setMenu(false))
  );
  // Escキーでも閉じる（キーボード操作で開いたままにならないように）
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) {
      setMenu(false);
      btn.focus();
    }
  });
}

/* ── Smooth scroll for anchor links ── */
function initSmoothScroll() {
  // 再生ボタン（data-ep-play）はその場で再生するので、スクロールの対象から外す
  document.querySelectorAll('a[href^="#"]:not([data-ep-play])').forEach(link => {
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
  // ページ内の見出しを指すリンク（トップの「ホーム」など）だけを切り替える。
  // 他のページの現在地（例：ノーベル化学賞のページの「エピソード」）を消さないため
  const links = [...document.querySelectorAll('.nav-link')]
    .filter(l => (l.getAttribute('href') || '').startsWith('#'));
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
  const statCount = document.getElementById('stat-ep-count');
  if (!grid && !statCount) return;

  fetch('episodes.json')
    .then(r => r.json())
    .then(data => {
      const valid = data.filter(ep => ep.number && parseInt(ep.number) > 0);

      // ヒーローのエピソード数スタットを実データで更新（話数増加でも自動追従）
      if (statCount) statCount.textContent = valid.length;
      if (!grid) return;

      // 新しい順に6件（PCの5列では5件だけ見せる。3列・2列の画面で最後の行が欠けないように）
      const latest = valid
        .sort((a, b) => parseInt(b.number) - parseInt(a.number))
        .slice(0, 6);

      // 再生時間の時計アイコン（エピソードページと同じ。絵文字はアイコン代わりに使わない）
      const clockSvg = '<svg class="icon-clock" width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">'
        + '<circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.2"/>'
        + '<path d="M6 3.2V6l1.9 1.9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';

      latest.forEach((ep, i) => {
        // Clean title
        let displayTitle = ep.title;
        const m = displayTitle.match(/^#?\d+\s+(.+)/);
        if (m) displayTitle = m[1];

        const card = document.createElement('a');
        card.href = `episodes/${ep.number}/`;
        card.className = 'ep-latest-card';

        // 画像は縮小版（400px。build_episodes.py が作る）。代替テキストは空にする
        // （すぐ下にタイトルがあり、読み上げが二重になるため）
        const thumb = ep.thumb_s || ep.thumbnail || 'images/podcast-artwork.png';
        card.innerHTML = `
          <div class="ep-latest-thumb">
            <img src="${escapeHtml(thumb)}" alt="" width="400" height="400" loading="lazy" decoding="async">
            <span class="ep-latest-number">#${ep.number}</span>
          </div>
          <div class="ep-latest-body">
            <div class="ep-latest-meta">
              <time>${ep.pub_date || ''}</time>
              ${ep.duration ? `<span>${clockSvg} ${escapeHtml(ep.duration)}</span>` : ''}
            </div>
            <h3 class="ep-latest-title">${escapeHtml(displayTitle)}</h3>
            <p class="ep-latest-desc">${escapeHtml(cleanDescription(ep.description).slice(0, 120))}${cleanDescription(ep.description).length > 120 ? '…' : ''}</p>
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

/* 説明文から参考資料・URL・番組定型文を取り除いて表示用にする
   （build_episodes.py の clean_description と同じ考え方） */
function cleanDescription(desc) {
  if (!desc) return '';
  let text = desc.replace(/ /g, ' ').replace(/　/g, ' ');
  const markers = ['――', '📚', '📅', '💬', '🎧', '🔖', 'LISTEN共通トークテーマ',
    'LISTENで開く', 'LISTENで先行公開', '参考資料', 'http://', 'https://', '\n', '\r'];
  let cut = text.length;
  markers.forEach(mk => {
    const i = text.indexOf(mk);
    if (i !== -1 && i < cut) cut = i;
  });
  text = text.slice(0, cut).replace(/\s+/g, ' ').trim();
  if (!text) text = desc.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
  return text;
}

/* ── Share buttons ── */
function initShareButtons() {
  // 404ページなど、共有しても意味のないページには出さない（<body data-no-share>）
  if (document.body.hasAttribute('data-no-share')) return;
  const pageUrl = encodeURIComponent(window.location.href);
  const pageTitle = encodeURIComponent(document.title);

  const shareContainer = document.createElement('div');
  shareContainer.className = 'share-buttons';
  shareContainer.id = 'share-buttons';

  shareContainer.innerHTML = `
    <span class="share-buttons__label">Share</span>
    <a href="https://x.com/intent/tweet?url=${pageUrl}&text=${pageTitle}&hashtags=プラントライフ&via=chem_fac"
       target="_blank" rel="noopener noreferrer"
       class="share-btn share-btn--x" data-tooltip="Xでシェア" aria-label="Xでシェア">
      <img src="/images/x_logo.png" alt="X">
    </a>
    <a href="https://note.com/intent/post?url=${pageUrl}"
       target="_blank" rel="noopener noreferrer"
       class="share-btn share-btn--note" data-tooltip="noteでシェア" aria-label="noteでシェア">
      <img src="/images/note_n.png" alt="note">
    </a>
    <a href="https://social-plugins.line.me/lineit/share?url=${pageUrl}"
       target="_blank" rel="noopener noreferrer"
       class="share-btn share-btn--line" data-tooltip="LINEでシェア" aria-label="LINEでシェア">
      <img src="/images/LINE_icon.png" alt="LINE">
    </a>
    <a href="https://www.facebook.com/sharer/sharer.php?u=${pageUrl}"
       target="_blank" rel="noopener noreferrer"
       class="share-btn share-btn--facebook" data-tooltip="Facebookでシェア" aria-label="Facebookでシェア">
      <img src="/images/Facebook_icon.png" alt="Facebook">
    </a>
  `;

  document.body.appendChild(shareContainer);

  // Show/hide based on scroll position
  const showAfter = 300;
  const onScroll = () => {
    shareContainer.classList.toggle('visible', window.scrollY > showAfter);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ── Episode number from URL (/episodes/{n}/) ── */
function currentEpisodeNumber() {
  const m = location.pathname.match(/\/episodes\/(\d+)\//);
  return m ? m[1] : '';
}

/* ── Transcript table of contents (all episode pages) ── */
function initTranscriptToc() {
  const body = document.querySelector('.transcript-body');
  if (!body) return;
  const headings = body.querySelectorAll('.transcript-heading');
  if (headings.length < 2) return; // 見出しが1つ以下なら目次は作らない

  const toc = document.createElement('nav');
  toc.className = 'transcript-toc';
  toc.setAttribute('aria-label', '文字起こしの目次');

  const list = document.createElement('ol');
  list.className = 'transcript-toc-list';

  headings.forEach((h, i) => {
    if (!h.id) h.id = `talk-${i + 1}`;
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${h.id}`;
    a.textContent = h.textContent;
    li.appendChild(a);
    list.appendChild(li);
  });

  const title = document.createElement('div');
  title.className = 'transcript-toc-title';
  title.innerHTML = '<span>🎧</span><span>この回の目次</span>';
  toc.appendChild(title);
  toc.appendChild(list);

  body.insertBefore(toc, body.firstChild);
}

/* ── Back to top button (episode pages) ── */
function initBackToTop() {
  if (!document.querySelector('.ep-detail-main')) return;
  const btn = document.createElement('button');
  btn.className = 'back-to-top';
  btn.setAttribute('aria-label', 'ページの先頭へ戻る');
  btn.innerHTML = '↑';
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.appendChild(btn);

  const onScroll = () => btn.classList.toggle('visible', window.scrollY > 600);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ── この回を再生（エピソードページ。タイトル下のボタンを「この回を聴く」のプレイヤーにつなぐ） ──
   スマホでは聴く欄が最初の画面に入らないため、タイトルのすぐ下から再生・一時停止できるようにする。
   ボタンの文字は「再生する」「一時停止」で同じ長さにして、押しても幅が変わらないようにしている。 */
function initEpisodePlayButton() {
  const playBtn = document.querySelector('[data-ep-play]');
  const audio = document.querySelector('.ep-audio');
  if (!playBtn || !audio) return;
  const label = playBtn.querySelector('.ep-play-label');
  playBtn.setAttribute('role', 'button');

  const sync = () => {
    const playing = !audio.paused && !audio.ended;
    playBtn.classList.toggle('is-playing', playing);
    if (label) label.textContent = playing ? '一時停止' : '再生する';
  };

  const toggle = () => {
    if (audio.paused || audio.ended) {
      const p = audio.play();
      // 再生できなかったとき（通信の失敗など）は表示を戻し、下のプレイヤーと各アプリのリンクへ移動する
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          audio.pause();
          sync();
          document.getElementById('ep-listen')?.scrollIntoView({ block: 'start' });
        });
      }
    } else {
      audio.pause();
    }
  };

  playBtn.addEventListener('click', (e) => {
    e.preventDefault();
    toggle();
  });
  // role="button" のリンクなので、スペースキーでも押せるようにする
  playBtn.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });
  ['play', 'playing', 'pause', 'ended'].forEach(ev => audio.addEventListener(ev, sync));
  sync();
}

/* ── GA4 event tracking (funnel measurement) ── */
function track(name, params) {
  if (typeof gtag === 'function') gtag('event', name, params || {});
}

function initAnalyticsEvents() {
  const ep = currentEpisodeNumber();
  const placement = ep ? 'episode' : (document.body.classList.contains('history-page') ? 'history' : 'home');

  const platformOf = (href) => {
    if (/open\.spotify\.com/.test(href)) return 'spotify';
    if (/podcasts\.apple\.com/.test(href)) return 'apple';
    if (/music\.amazon/.test(href)) return 'amazon';
    if (/youtube\.com|youtu\.be/.test(href)) return 'youtube';
    if (/listen\.style/.test(href)) return 'listen';
    return '';
  };

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';

    // 応援(メンバーシップ)
    if (/note\.com\/[^/]+\/membership/.test(href)) {
      track('membership_click', { placement, ep_number: ep });
      return;
    }
    // note（記事・マガジン・プロフィール）
    if (/note\.com/.test(href)) {
      track('note_click', { placement, ep_number: ep });
      return;
    }
    // お便り・お問い合わせフォーム
    if (/docs\.google\.com\/forms/.test(href)) {
      track('contact_click', { placement });
      return;
    }
    // シェアボタン
    const shareBtn = a.closest('.share-btn');
    if (shareBtn) {
      const cls = [...shareBtn.classList].find(c => c.startsWith('share-btn--'));
      track('share_click', { platform: cls ? cls.replace('share-btn--', '') : '', placement });
      return;
    }
    // 配信プラットフォーム
    const p = platformOf(href);
    if (p) {
      track('platform_click', { platform: p, placement, ep_number: ep });
    }
  });

  // サイト内プレイヤーで実際に再生が始まったら計測（「その場で聴く」の核指標）
  document.querySelectorAll('.ep-audio').forEach((audio) => {
    audio.addEventListener('play', () => {
      track('audio_play', { ep_number: ep });
    }, { once: true });
  });
}
