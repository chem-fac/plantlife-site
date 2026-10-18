/**
 * プラントライフ Podcast サイト — Script
 * ======================================
 * Sticky header, mobile menu, dynamic episode loading, and smooth scrolling.
 * スクロールに合わせて要素を出す演出は使わない（2026-10-18。中身は読み込んだ時点で全部見えている）。
 */

document.addEventListener('DOMContentLoaded', () => {
  initStickyHeader();
  initMobileMenu();
  initSmoothScroll();
  initHashOnLoad();
  initActiveNav();
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

/* ── 最新エピソード（予備） ──
   ふだんはビルド時（build_episodes.py の update_home_latest）に、最新の1回（大きく）と続く5回（罫線リスト）が
   書き込まれている。書き込みが無いときだけ、episodes.json から同じ形で並べる */
function initLatestEpisodes() {
  const grid = document.getElementById('ep-latest-grid');
  const counts = document.querySelectorAll('[data-ep-count]');
  if (!grid && !counts.length) return;
  // 読み込み後に並べると、出た瞬間に下の段が押し下げられるため、書き込みがあればそのまま使う
  if (grid && grid.querySelector('.ep-latest-feature, .ep-latest-row')) return;

  fetch('episodes.json')
    .then(r => r.json())
    .then(data => {
      const valid = data.filter(ep => ep.number && parseInt(ep.number) > 0);

      // 導入文と「エピソード一覧（全N回）」の話数を実データで更新（話数増加でも自動追従）
      counts.forEach(el => { el.textContent = valid.length; });
      if (!grid) return;

      const latest = valid
        .sort((a, b) => parseInt(b.number) - parseInt(a.number))
        .slice(0, 6);
      const titleOf = ep => {
        const m = String(ep.title || '').match(/^#?\d+\s+(.+)/);
        return m ? m[1] : (ep.title || '');
      };

      let html = '';
      const top = latest[0];
      if (top) {
        const desc = cleanDescription(top.description);
        const thumb = top.thumb_s || top.thumbnail || 'images/podcast-artwork.png';
        html += `
          <article class="ep-latest-feature">
            <a href="episodes/${top.number}/" class="ep-latest-feature-thumb" tabindex="-1" aria-hidden="true"><img src="${escapeHtml(thumb)}" alt="" width="400" height="400" loading="lazy" decoding="async"></a>
            <div class="ep-latest-feature-body">
              <p class="ep-latest-meta"><span class="ep-latest-number">#${top.number}</span><time>${escapeHtml(top.pub_date || '')}</time>${top.duration ? `<span>長さ ${escapeHtml(top.duration)}</span>` : ''}</p>
              <h3 class="ep-latest-feature-title"><a href="episodes/${top.number}/">${escapeHtml(titleOf(top))}</a></h3>
              ${desc ? `<p class="ep-latest-feature-desc">${escapeHtml(desc.slice(0, 140))}${desc.length > 140 ? '…' : ''}</p>` : ''}
              <a href="episodes/${top.number}/" class="text-link">#${top.number} を聴く・文字起こしを読む</a>
            </div>
          </article>`;
      }
      const rows = latest.slice(1).map(ep => `
            <li><a href="episodes/${ep.number}/" class="ep-latest-row"><span class="ep-latest-number">#${ep.number}</span><time>${escapeHtml(ep.pub_date || '')}</time><span class="ep-latest-dur">${escapeHtml(ep.duration || '')}</span><span class="ep-latest-row-title">${escapeHtml(titleOf(ep))}</span></a></li>`).join('');
      if (rows) html += `<ol class="ep-latest-list" aria-label="続く回">${rows}</ol>`;
      grid.innerHTML = html;
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
  // セクション配下の新しいページにも同じハッシュタグを付ける。
  const sectionHashtag = new Map([
    ['nobel-chemistry', 'ノーベル化学賞'],
    ['elements', '周期表'],
    ['everyday-chemical-engineering', '身近な化学工学'],
    ['companies', '企業研究'],
  ]).get(window.location.pathname.split('/')[1]);
  const hashtags = encodeURIComponent(
    ['プラントライフ', sectionHashtag].filter(Boolean).join(',')
  );

  const shareContainer = document.createElement('div');
  shareContainer.className = 'share-buttons';
  shareContainer.id = 'share-buttons';

  shareContainer.innerHTML = `
    <span class="share-buttons__label">共有</span>
    <a href="https://x.com/intent/tweet?url=${pageUrl}&text=${pageTitle}&hashtags=${hashtags}&via=chem_fac"
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
  title.textContent = 'この回の目次';
  toc.appendChild(title);
  toc.appendChild(list);

  // 本文と目次を .transcript-layout で包む（PCでは目次が本文の右に残る。episode.css）
  const layout = document.createElement('div');
  layout.className = 'transcript-layout';
  body.parentNode.insertBefore(layout, body);
  layout.appendChild(toc);
  layout.appendChild(body);

  // いま読んでいる話（画面の上から1/4より上にある最後の見出し）を目次で示す
  const links = [...list.querySelectorAll('a')];
  let ticking = false;
  const mark = () => {
    ticking = false;
    const line = window.innerHeight * 0.25;
    let current = -1;
    headings.forEach((h, i) => {
      if (h.getBoundingClientRect().top <= line) current = i;
    });
    links.forEach((a, i) => {
      if (i === current) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(mark);
    }
  }, { passive: true });
  mark();
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
  initMiniPlayer(audio);
}

/* ── 再生中の小さなプレイヤー（エピソードページ） ──
   文字起こしを読みながら聴くとき、「この回を聴く」のプレイヤーが画面の外に出ても一時停止・再開できるようにする。
   一度再生を始めたあと、プレイヤーが画面の外にある間だけ画面の下に出す（表示の切り替えだけで、動かさない）。 */
function initMiniPlayer(audio) {
  const player = document.querySelector('.ep-detail-player') || audio;
  const titleEl = document.querySelector('.ep-detail-title');
  const bar = document.createElement('div');
  bar.className = 'ep-mini-player';
  bar.hidden = true;
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', '再生中のエピソード');
  bar.innerHTML = `
    <button type="button" class="ep-mini-btn"><svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><path class="ep-mini-icon" d="M3 1.5h2.6v11H3zM8.4 1.5H11v11H8.4z" fill="currentColor"/></svg><span class="ep-mini-label">一時停止</span></button>
    <span class="ep-mini-text"><span class="ep-mini-title"></span><span class="ep-mini-time"></span></span>
    <a href="#ep-listen" class="ep-mini-link" data-ep-mini>プレイヤーへ</a>`;
  bar.querySelector('.ep-mini-title').textContent = titleEl ? titleEl.textContent : '';
  document.body.appendChild(bar);

  const btn = bar.querySelector('.ep-mini-btn');
  const label = bar.querySelector('.ep-mini-label');
  const icon = bar.querySelector('.ep-mini-icon');
  const timeEl = bar.querySelector('.ep-mini-time');
  const PLAY = 'M3 1.6v10.8a.6.6 0 0 0 .9.5l8.6-5.4a.6.6 0 0 0 0-1L3.9 1.1a.6.6 0 0 0-.9.5z';
  const PAUSE = 'M3 1.5h2.6v11H3zM8.4 1.5H11v11H8.4z';
  let started = false;
  let playerVisible = true;

  const fmt = (sec) => {
    if (!isFinite(sec)) return '';
    const t = Math.floor(sec);
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), x = t % 60;
    const pad = n => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`;
  };
  const update = () => {
    const playing = !audio.paused && !audio.ended;
    label.textContent = playing ? '一時停止' : '再生する';
    icon.setAttribute('d', playing ? PAUSE : PLAY);
    timeEl.textContent = audio.duration ? `${fmt(audio.currentTime)} / ${fmt(audio.duration)}` : fmt(audio.currentTime);
    const show = started && !playerVisible;
    bar.hidden = !show;
    document.body.classList.toggle('has-mini-player', show);
  };

  audio.addEventListener('play', () => { started = true; update(); });
  ['pause', 'ended', 'timeupdate', 'loadedmetadata'].forEach(ev => audio.addEventListener(ev, update));
  btn.addEventListener('click', () => {
    if (audio.paused || audio.ended) {
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(update);
    } else {
      audio.pause();
    }
  });

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { playerVisible = e.isIntersecting; });
    update();
  });
  io.observe(player);
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
    if (/stand\.fm/.test(href)) return 'standfm';
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
