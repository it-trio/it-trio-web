# ITトリオWebサイト

Astroを使って作成している、[ITトリオ Webサイト](https://it-trio-no.com)のレポジトリです。

pnpmを使用しています。


## 起動方法

```bash
pnpm install
pnpm start
```

## エピソードリンクの管理

各エピソードページには、Spotify、Apple Podcast、Amazon Music、YouTubeなどのプラットフォームへのリンクがあります。

### 自動取得（推奨）

APIを使用してエピソードリンクを自動的に取得できます：

```bash
# Puppeteerをインストール（Amazon Music用）
pnpm add -D puppeteer

# .envファイルを設定（.env.exampleを参照）
cp .env.example .env
# APIキーを.envに追加（Spotify、YouTube用）

# すべてのエピソードのリンクを取得
pnpm fetch-episode-links --all

# 特定のエピソードのリンクを取得
pnpm fetch-episode-links 1 2 3

# 取得したリンクを適用
pnpm update-episode-links episode-links-fetched.json
```

対応プラットフォーム：
- **Spotify**: API認証が必要
- **Apple Podcasts**: 認証不要（公開API）
- **Amazon Music**: Puppeteer（ブラウザ自動化）を使用
- **YouTube**: API認証が必要

詳細は [EPISODE_LINKS.md](./EPISODE_LINKS.md) を参照してください。
