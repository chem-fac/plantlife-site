"""
プラントライフ Podcast サイト ビルドスクリプト
================================================
podcast_urls.csv + LISTEN RSSフィードから
episodes.json と 各エピソード詳細ページを自動生成する。

使い方:
  python build_episodes.py
"""

import argparse
import csv
import json
import os
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from html import escape

import requests

# ── パス設定 ──
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# CI時はSITE_DIR環境変数で公開リポジトリのパスを指定
SITE_DIR = os.environ.get('SITE_DIR', SCRIPT_DIR)
if not os.path.isabs(SITE_DIR):
    SITE_DIR = os.path.join(SCRIPT_DIR, SITE_DIR)
CSV_PATH = os.path.join(os.path.dirname(SCRIPT_DIR), "PodcastURL取得", "podcast_urls.csv")
OUTPUT_JSON = os.path.join(SITE_DIR, "episodes.json")
EPISODES_DIR = os.path.join(SITE_DIR, "episodes")
RSS_URL = "https://rss.listen.style/p/14rlng1w/rss"

# ── RSSフィードから追加情報を取得 ──
def fetch_rss_data():
    """RSSフィードからエピソードの概要・公開日・サムネイルを取得"""
    print("📡 RSSフィードを取得中...")
    try:
        resp = requests.get(RSS_URL, timeout=30, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PlantLifeSiteBuilder/1.0'
        })
        resp.raise_for_status()
    except Exception as e:
        print(f"⚠️ RSS取得失敗: {e}")
        return {}

    root = ET.fromstring(resp.content)

    # iTunes namespace
    ns = {
        'itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd',
        'content': 'http://purl.org/rss/1.0/modules/content/'
    }

    # チャンネルレベルのサムネイル
    channel = root.find('.//channel')
    channel_image = ""
    img_elem = channel.find('itunes:image', ns) if channel is not None else None
    if img_elem is not None:
        channel_image = img_elem.get('href', '')

    rss_data = {}
    for item in root.findall('.//item'):
        title_elem = item.find('title')
        title = title_elem.text if title_elem is not None and title_elem.text else ""

        # エピソード番号を抽出
        ep_match = re.match(r'#(\d+)', title.strip())
        if not ep_match:
            continue
        ep_num = ep_match.group(1)

        # 概要
        desc_elem = item.find('description')
        description = desc_elem.text if desc_elem is not None and desc_elem.text else ""
        # HTMLタグを簡易除去
        description = re.sub(r'<[^>]+>', '', description)
        # 最初の200文字に制限（表示用）
        description_short = description[:300] + "..." if len(description) > 300 else description

        # 公開日
        pub_elem = item.find('pubDate')
        pub_raw = pub_elem.text if pub_elem is not None and pub_elem.text else ""
        try:
            pub_date = datetime.strptime(pub_raw, '%a, %d %b %Y %H:%M:%S %z')
            pub_date_str = pub_date.strftime('%Y-%m-%d')
        except:
            pub_date_str = ""

        # サムネイル
        img = item.find('itunes:image', ns)
        thumbnail = img.get('href', '') if img is not None else ''

        # 再生時間
        duration_elem = item.find('itunes:duration', ns)
        duration = duration_elem.text if duration_elem is not None and duration_elem.text else ""

        # Validate thumbnail URL (catch dead CDN links)
        thumb_ok = False
        if thumbnail and thumbnail != channel_image:
            try:
                head_req = requests.head(thumbnail, timeout=5, headers={
                    'User-Agent': 'Mozilla/5.0 PlantLifeSiteBuilder/1.0'
                }, allow_redirects=True)
                thumb_ok = head_req.status_code == 200
            except:
                thumb_ok = False
            if not thumb_ok:
                print(f"⚠️ #{ep_num} サムネイルURL無効 (404): {thumbnail[:60]}...")

        rss_data[ep_num] = {
            'title_full': title,
            'description': description_short,
            'pub_date': pub_date_str,
            'thumbnail': thumbnail,
            'duration': duration,
            'needs_ogp': (not thumb_ok or thumbnail == '' or thumbnail == channel_image or 'LwUUIF_resized' in thumbnail)
        }

    print(f"✅ RSS: {len(rss_data)}件のエピソード情報を取得")
    return rss_data


# ── CSVからURLデータを読み込む ──
def load_csv_data():
    """podcast_urls.csv からエピソードURL情報を読み込む"""
    print(f"📂 CSV読み込み中: {CSV_PATH}")

    episodes = {}
    # Shift_JIS エンコーディング
    with open(CSV_PATH, encoding='shift_jis', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            ep_num_raw = row.get('エピソード番号', '').strip()
            ep_match = re.match(r'#?(\d+)', ep_num_raw)
            if not ep_match:
                continue
            ep_num = ep_match.group(1)

            episodes[ep_num] = {
                'number': ep_num,
                'title': row.get('タイトル', '').strip(),
                'pub_date': row.get('公開日', '').strip(),
                'urls': {
                    'listen': row.get('LISTEN', '').strip(),
                    'spotify': row.get('Spotify', '').strip(),
                    'apple': row.get('Apple Podcasts', '').strip(),
                    'amazon': row.get('Amazon Music', '').strip(),
                    'youtube': row.get('YouTube', '').strip(),
                }
            }

    print(f"✅ CSV: {len(episodes)}件のエピソード")
    return episodes


# ── 既存のepisodes.jsonからURLデータを読み込む（CIモード用） ──
def load_existing_json_data():
    """既存の episodes.json からエピソードURL情報を読み込む"""
    if not os.path.exists(OUTPUT_JSON):
        print("⚠️ 既存の episodes.json が見つかりません")
        return {}

    print(f"📂 既存JSON読み込み中: {OUTPUT_JSON}")
    with open(OUTPUT_JSON, encoding='utf-8') as f:
        data = json.load(f)

    episodes = {}
    for ep in data:
        ep_num = str(ep.get('number', ''))
        if not ep_num:
            continue
        episodes[ep_num] = {
            'number': ep_num,
            'title': ep.get('title', ''),
            'pub_date': ep.get('pub_date', ''),
            'urls': ep.get('urls', {}),
        }

    print(f"✅ 既存JSON: {len(episodes)}件のエピソード")
    return episodes


# ── RSSに含まれないエピソードをCSVから補完 ──
def is_numbered_episode(title):
    """タイトルが #数字 で始まる正規エピソードかどうか"""
    return bool(re.match(r'#\d+', title.strip()))


# ── LISTENの個別ページから正しいOGP画像をスクレイピングする ──
def fetch_listen_og_image(listen_url):
    """LISTENの個別ページURLからog:image（最新アートワーク）を取得する"""
    if not listen_url:
        return ""
    try:
        resp = requests.get(listen_url, timeout=10, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PlantLifeSiteBuilder/1.0'
        })
        resp.raise_for_status()
        og_match = re.search(r'<meta property="og:image" content="([^"]+)"', resp.text)
        if og_match:
            return og_match.group(1).replace('&amp;', '&')
    except Exception as e:
        print(f"⚠️ LISTEN OGP取得失敗 ({listen_url}): {e}")
    return ""


# ── エピソード詳細HTMLを生成 ──
def generate_episode_html(ep):
    """1エピソード分のHTMLページを生成"""
    num = ep['number']
    title = escape(ep['title'])
    pub_date = ep.get('pub_date', '')
    description = escape(ep.get('description', ''))
    thumbnail = ep.get('thumbnail', 'images/podcast-artwork.png')
    duration = ep.get('duration', '')
    urls = ep.get('urls', {})

    # 前後ナビゲーション
    prev_num = str(int(num) - 1) if int(num) > 1 else ""
    next_num = str(int(num) + 1)

    # プラットフォームリンクの生成（ロゴ画像を使用）
    platform_links = ""
    platforms = [
        ('listen', 'LISTENで聴く', 'LISTEN_logo_h.svg', '26px'),
        ('spotify', 'Spotifyで聴く', 'Spotify_Full_Logo_RGB_Green.png', '30px'),
        ('apple', 'Apple Podcastsで聴く', 'Apple_Podcast_Listen_on_Lockup_RGB_Blk_USGB-EN_CI_111825.svg', '32px'),
        ('amazon', 'Amazon Musicで聴く', 'Amazon_Music_Logo_Horizontal_RGB_Entertainment_Dark_MASTER.svg', '30px'),
        ('youtube', 'YouTubeで聴く', 'YouTube_logo_fullcolor_almostblack_digital.png', '44px'),
    ]

    for key, alt_text, logo_file, logo_height in platforms:
        url = urls.get(key, '')
        if url:
            platform_links += f'''
          <a href="{escape(url)}" target="_blank" rel="noopener" class="ep-detail-platform" style="--logo-height: {logo_height};">
            <img src="../images/platforms/{logo_file}" alt="{alt_text}" loading="lazy">
          </a>'''

    nav_html = '<div class="ep-detail-nav">'
    if prev_num:
        nav_html += f'<a href="{prev_num}.html" class="ep-nav-link ep-nav-prev">← #{prev_num}</a>'
    else:
        nav_html += '<span></span>'
    nav_html += f'<a href="../episodes/index.html" class="ep-nav-link ep-nav-home">エピソード一覧</a>'
    nav_html += f'<a href="{next_num}.html" class="ep-nav-link ep-nav-next">#{next_num} →</a>'
    nav_html += '</div>'

    return f'''<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} | プラントライフ</title>
  <meta name="description" content="{description[:150]}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../styles.css">
  <link rel="stylesheet" href="../episode.css">
  <link rel="icon" href="../images/favicon.png" type="image/png">
</head>
<body class="episode-page">
  <!-- Header -->
  <header class="header scrolled" id="header">
    <div class="header-inner">
      <a href="../index.html" class="header-logo">
        <img src="../images/plantlife_logo_nameonly.png" alt="プラントライフ" class="header-logo-img">
      </a>
      <nav class="header-nav" id="header-nav">
        <a href="../index.html" class="nav-link">ホーム</a>
        <a href="../index.html#platforms" class="nav-link">聴き方</a>
        <a href="../index.html#episodes" class="nav-link active">エピソード</a>
        <a href="../index.html#about" class="nav-link">番組について</a>
        <a href="../index.html#contact" class="nav-link">お問い合わせ</a>
      </nav>
      <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="メニュー">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>

  <main class="ep-detail-main">
    <div class="container">
      {nav_html}

      <article class="ep-detail-article">
        <div class="ep-detail-hero">
          <div class="ep-detail-artwork">
            <img src="{escape(thumbnail)}" alt="{title}" loading="lazy">
          </div>
          <div class="ep-detail-info">
            <div class="ep-detail-meta">
              <span class="ep-detail-number">#{num}</span>
              <time class="ep-detail-date">{pub_date}</time>
              {"<span class='ep-detail-duration'>⏱ " + escape(duration) + "</span>" if duration else ""}
            </div>
            <h1 class="ep-detail-title">{title}</h1>
            <p class="ep-detail-desc">{description}</p>
          </div>
        </div>

        <div class="ep-detail-platforms">
          <h2 class="ep-detail-platforms-heading">この回を聴く</h2>
          <div class="ep-detail-platforms-grid">
            {platform_links}
          </div>
          
          <div class="ep-detail-note" style="margin-top: 2rem;">
            <a href="https://note.com/chem_fac" target="_blank" rel="noopener" class="note-promo-card-mini">
              <div class="note-icon-mini"><img src="../images/note_icon.png" alt="note transcripts" loading="lazy"></div>
              <div class="note-text-mini">
                <strong>📝 文字起こし記事を読む</strong>
                <span>noteで配信内容のテキスト版をチェック</span>
              </div>
            </a>
          </div>
        </div>
      </article>

      {nav_html}
    </div>
  </main>

  <footer class="footer">
    <div class="container">
      <div class="footer-top">
        <div class="footer-brand">
          <img src="../images/logo-footer.png" alt="PLANT LIFE" class="footer-logo-img">
        </div>
        <div class="footer-nav-group">
          <h4>つながる</h4>
          <a href="https://note.com/chem_fac" target="_blank" rel="noopener">note</a>
          <a href="https://x.com/chem_fac" target="_blank" rel="noopener">X (Twitter)</a>
          <a href="../index.html#contact">お問い合わせ</a>
        </div>
        <div class="footer-nav-group">
          <h4>聴く</h4>
          <a href="https://open.spotify.com/show/4YLUGddgxbE2ipMBHFYIIX" target="_blank">Spotify</a>
          <a href="https://podcasts.apple.com/us/podcast/%E6%8A%80%E8%A1%93%E8%80%85%E3%81%8B%E3%81%AD%E3%81%BE%E3%82%8B%E3%81%AE-%E3%83%97%E3%83%A9%E3%83%B3%E3%83%88%E3%83%A9%E3%82%A4%E3%83%95/id1789911793"
            target="_blank">Apple Podcasts</a>
          <a href="https://listen.style/p/14rlng1w" target="_blank">LISTEN</a>
        </div>
        <div class="footer-nav-group">
          <h4>&nbsp;</h4>
          <a href="https://music.amazon.co.jp/podcasts/1e2240a9-b053-46b3-b0a9-62b321a6eeb4" target="_blank">Amazon
            Music</a>
          <a href="https://www.youtube.com/@chem_fac" target="_blank">YouTube</a>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; 2026 技術者かねまるの「プラントライフ」</p>
        <div class="footer-socials">
          <a href="https://x.com/chem_fac" target="_blank">X</a>
          <a href="https://note.com/chem_fac" target="_blank">note</a>
          <a href="https://www.youtube.com/@chem_fac" target="_blank">YouTube</a>
        </div>
      </div>
    </div>
  </footer>

  <script src="../script.js"></script>
</body>
</html>'''


# ── メイン処理 ──
def main():
    parser = argparse.ArgumentParser(description='プラントライフ Podcast サイト ビルドスクリプト')
    parser.add_argument('--ci', action='store_true',
                        help='CIモード: CSVの代わりに既存のepisodes.jsonからURL情報を読み込む')
    args = parser.parse_args()

    os.makedirs(EPISODES_DIR, exist_ok=True)

    # 1. URLデータ読み込み（CIモード or CSVモード）
    if args.ci:
        print("🔄 CIモードで実行中...")
        url_data = load_existing_json_data()
    else:
        url_data = load_csv_data()
        if not url_data:
            print("❌ CSVデータが見つかりません")
            return

    # 2. RSSデータ取得
    rss_data = fetch_rss_data()

    # 3. マージ（RSSを主データソースとし、URLデータを補完）
    episodes = []
    all_nums = set(rss_data.keys()) | set(url_data.keys())
    for ep_num in sorted(all_nums, key=lambda x: int(x)):
        rss = rss_data.get(ep_num, {})
        existing_ep = url_data.get(ep_num, {})

        # URLデータにしかないエピソードで、タイトルが#始まりでない場合はスキップ（紹介音源など）
        if not rss and existing_ep:
            ep_title = existing_ep.get('title', '')
            if not is_numbered_episode(ep_title):
                print(f"⏭️ スキップ（紹介音源）: {ep_title}")
                continue

        thumbnail = rss.get('thumbnail', '')
        if rss.get('needs_ogp'):
            listen_url = existing_ep.get('urls', {}).get('listen', '')
            if listen_url:
                ogp_img = fetch_listen_og_image(listen_url)
                if ogp_img:
                    thumbnail = ogp_img
                    print(f"🖼️ #{ep_num} のOGP画像を取得: {thumbnail[:40]}...")

        ep = {
            'number': ep_num,
            'title': rss.get('title_full', existing_ep.get('title', f'#{ep_num}')),
            'pub_date': rss.get('pub_date', existing_ep.get('pub_date', '')),
            'description': rss.get('description', ''),
            'thumbnail': thumbnail,
            'duration': rss.get('duration', ''),
            'urls': existing_ep.get('urls', {}),
        }
        episodes.append(ep)

    # 4. JSON出力
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(episodes, f, ensure_ascii=False, indent=2)
    print(f"📄 {OUTPUT_JSON} に {len(episodes)}件を出力")

    # 5. エピソード詳細ページ生成
    generated = 0
    for ep in episodes:
        html = generate_episode_html(ep)
        filepath = os.path.join(EPISODES_DIR, f"{ep['number']}.html")
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html)
        generated += 1

    print(f"📝 {generated}件のエピソード詳細ページを生成")
    print("✅ ビルド完了！")


if __name__ == "__main__":
    main()
