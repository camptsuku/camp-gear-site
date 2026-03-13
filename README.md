# Camp Gear Finder — Cloudflare Pages 版

## ファイル構成

```
camp-gear-site/
├── index.html                  ← 診断フロント（変更なし）
├── functions/
│   └── api/
│       └── recommend.js        ← Cloudflare Pages Functions（旧 api/recommend.js）
├── wrangler.toml               ← Cloudflare設定
├── .dev.vars.example           ← 環境変数テンプレート
└── .gitignore
```

## Vercel → Cloudflare Pages 変更点まとめ

| 項目 | Vercel (旧) | Cloudflare Pages (新) |
|------|-------------|----------------------|
| Functionsパス | `api/recommend.js` | `functions/api/recommend.js` |
| エクスポート形式 | `export default async function handler(req, res)` | `export async function onRequestPost(context)` |
| 環境変数アクセス | `process.env.KEY` | `context.env.KEY` |
| レスポンス | `res.status(200).json(obj)` | `new Response(JSON.stringify(obj), {...})` |
| 設定ファイル | `vercel.json` | `wrangler.toml` |
| OPTIONSハンドラ | reqメソッド分岐 | `export async function onRequestOptions()` |

## デプロイ手順

### 1. GitHubリポジトリを作成・プッシュ

```bash
cd ~/Desktop/camp-gear-site
git init
git add .
git commit -m "Migrate to Cloudflare Pages"
git remote add origin https://github.com/あなたのユーザー名/camp-gear-site.git
git push -u origin main
```

### 2. Cloudflare Pages でプロジェクト作成

1. https://dash.cloudflare.com → Pages → 「Create a project」
2. 「Connect to Git」でGitHubリポジトリを選択
3. ビルド設定:
   - **Framework preset**: `None`
   - **Build command**: （空欄のまま）
   - **Build output directory**: `/` または `.`
4. 「Save and Deploy」

### 3. 環境変数を設定

Cloudflare Dashboard → Pages → プロジェクト → Settings → Environment variables

| 変数名 | 値 |
|--------|-----|
| `GEMINI_API_KEY` | GeminiのAPIキー |
| `RAKUTEN_APP_ID` | `ef16f377-c183-4449-8808-da74cd5622e1` |
| `RAKUTEN_AFFILIATE_ID` | `51b76b74.e928f44c.51b76b75.f3fe3626` |
| `AMAZON_ASSOCIATE_TAG` | `campjoutsukur-22` |

### 4. 再デプロイ

環境変数設定後、Deployments → 最新のデプロイ右クリック → 「Retry deployment」

## ローカル開発

```bash
# .dev.vars を作成（.gitignore済み）
cp .dev.vars.example .dev.vars
# GEMINI_API_KEY を記入

# Wrangler でローカル起動
npx wrangler pages dev . --port 3000
# → http://localhost:3000 でアクセス
```

## 商品画像が表示されない問題（修正済み）

楽天APIの `mediumImageUrls[0].imageUrl` には末尾に `?_ex=128x128` が付く場合があり、
Cloudflareのキャッシュや一部ブラウザで画像が壊れることがある。
本バージョンでは `?` 以降を除去した元URL（200x200px相当）を使用するよう修正済み。
