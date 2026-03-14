/**
 * Cloudflare Pages Functions
 * POST /api/recommend
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: CORS_HEADERS });
}

// OPTIONS プリフライト
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

const EXCLUDE_WORDS = [
  // ふるさと納税系
  'ふるさと納税', '寄付', '返礼品',
  // 付属品・アクセサリー・パーツ系
  'ポール', 'スタンド', 'ペグ', 'ロープ', '収納', 'ケース', 'バッグ', 'カバー',
  '交換', '補修', 'パーツ', '部品', '替え', '延長', 'アダプター',
  'グランドシート', 'インナーマット', 'フレーム', '継ぎ', 'ガイライン',
  '自在', 'フック', 'リング', '補強',
];

// カテゴリごとにタイトルに含まれるべきキーワード（いずれか1つ以上）
const CATEGORY_KEYWORDS = {
  'テント':   ['テント', 'シェルター', 'ティピー', 'ツェルト'],
  'タープ':   ['タープ'],
  '寝袋':     ['寝袋', 'シュラフ', 'スリーピングバッグ'],
  'チェア':   ['チェア', 'チェアー', '椅子', 'いす', 'ロッキング'],
  'テーブル': ['テーブル', '折りたたみ台', 'ロールテーブル'],
  'クッカー': ['クッカー', 'バーナー', 'コンロ', 'ストーブ', 'クックウェア', '鍋', 'フライパン', 'メスティン'],
  'ランタン': ['ランタン', 'ライト', '灯', 'ランプ'],
  '焚き火台': ['焚き火台', '焚火台', 'ファイアグリル', 'グリル', 'ファイヤーピット'],
};

function isExcluded(name) {
  return EXCLUDE_WORDS.some(w => name.includes(w));
}

function matchesCategory(name, category) {
  const keywords = CATEGORY_KEYWORDS[category];
  if (!keywords) return true; // 未定義カテゴリはスルー
  return keywords.some(kw => name.includes(kw));
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const GEMINI_API_KEY       = (env.GEMINI_API_KEY || '').trim();
  const RAKUTEN_APP_ID       = (env.RAKUTEN_APP_ID || 'ef16f377-c183-4449-8808-da74cd5622e1').trim();
  const RAKUTEN_ACCESS_KEY   = (env.RAKUTEN_ACCESS_KEY || '').trim();
  const RAKUTEN_AFFILIATE_ID = (env.RAKUTEN_AFFILIATE_ID || '51b76b74.e928f44c.51b76b75.f3fe3626').trim();
  const AMAZON_TAG           = (env.AMAZON_ASSOCIATE_TAG || 'campjoutsukur-22').trim();

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { campStyle, style, season, goal, categories } = body;
  const categoryList = categories?.join('、') || 'テント、焚き火台、寝袋、チェア、テーブル、クッカー、ランタン';

  // ── Step 1: Gemini で人気商品名を特定 ──────────────────────────────
  const prompt = `あなたはキャンプギアの専門家です。以下の条件のキャンパーに最適なギアを、日本のキャンプ系ブログ・レビューサイト・口コミを検索して調査し、実際に高評価で人気の具体的な商品名・ブランドを特定してください。

シーン: ${campStyle || 'ファミリーキャンプ'}
スタイル: ${style || 'こだわらない'}
季節: ${season || '春秋'}
目的・悩み: ${goal || 'こだわらない'}
必要なカテゴリ: ${categoryList}

各カテゴリについて30商品を調査して特定してください。
【重要】各商品は必ず指定されたカテゴリの本体製品のみを提案してください。アクセサリー・パーツ・付属品・収納ケース・替えパーツ等は絶対に含めないでください。例えばテントカテゴリにはテント本体のみ、寝袋カテゴリには寝袋本体のみを提案してください。
必ずJSON形式のみで返してください（前置きや説明文は一切不要）。形式：
{
  "recommendations": [
    {
      "category": "テント",
      "reason": "選定理由（日本語100字以内）",
      "products": [
        {
          "productName": "スノーピーク アメニティドームM",
          "brand": "スノーピーク",
          "searchKeyword": "スノーピーク アメニティドームM"
        }
      ]
    }
  ]
}`;

  let recommendations;
  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          tools: [{ googleSearch: {} }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      console.error('Gemini error:', geminiRes.status, err);
      return json({ error: `Gemini API error (${geminiRes.status})`, detail: err }, 500);
    }

    const geminiData = await geminiRes.json();
    const parts = geminiData.candidates?.[0]?.content?.parts || [];
    const rawText = parts.filter(p => p.text).map(p => p.text).join('');

    if (!rawText) {
      return json({ error: 'No text response from Gemini' }, 500);
    }

    const clean = rawText.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in Gemini response');
    recommendations = JSON.parse(jsonMatch[0]).recommendations;
    if (!Array.isArray(recommendations)) throw new Error('recommendations is not array');
  } catch (e) {
    console.error('Gemini/parse error:', e.message);
    return json({ error: 'Gemini error', detail: e.message }, 500);
  }

  // ── Step 2: 楽天 API で商品画像・価格・URLを取得 ───────────────────
  const RAKUTEN_ENDPOINT = 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601';
  const RAKUTEN_ORIGIN = 'https://camp-gear-site.pages.dev';
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  async function fetchRakuten(keyword) {
    const params = new URLSearchParams({
      applicationId: RAKUTEN_APP_ID,
      accessKey:     RAKUTEN_ACCESS_KEY,
      affiliateId:   RAKUTEN_AFFILIATE_ID,
      keyword,
      hits:     '30',
      sort:     '-reviewCount',
      imageFlag:'1',
      minPrice: '1',
      format:   'json',
    });
    const res = await fetch(`${RAKUTEN_ENDPOINT}?${params}`, {
      headers: { 'Origin': RAKUTEN_ORIGIN },
    });
    const d = await res.json();
    if (d.statusCode === 429) {
      await sleep(1200);
      const res2 = await fetch(`${RAKUTEN_ENDPOINT}?${params}`, {
        headers: { 'Origin': RAKUTEN_ORIGIN },
      });
      return res2.json();
    }
    return d;
  }

  // 除外ワードに引っかからず、カテゴリキーワードを含む最初のアイテムを返す
  function findGoodItem(d, category) {
    const items = d.Items || [];
    for (const item of items) {
      const name = item.Item?.itemName || '';
      if (!isExcluded(name) && matchesCategory(name, category)) return item.Item;
    }
    return null;
  }

  // 楽天検索キーワードにカテゴリキーワードを付加する
  function buildSearchKeyword(searchKeyword, category) {
    const catKw = CATEGORY_KEYWORDS[category]?.[0] || category;
    if (searchKeyword.includes(catKw)) return searchKeyword;
    return `${searchKeyword} ${catKw}`;
  }

  const results = [];
  for (const rec of recommendations) {
    const products = [];
    for (const p of (rec.products || []).slice(0, 30)) {
      let rakutenItem = null;
      try {
        const keyword = buildSearchKeyword(p.searchKeyword, rec.category);
        const d = await fetchRakuten(keyword);
        rakutenItem = findGoodItem(d, rec.category);

        // フォールバック: ブランド名 + カテゴリで再検索
        if (!rakutenItem && p.brand) {
          await sleep(300);
          const d2 = await fetchRakuten(p.brand + ' ' + rec.category);
          rakutenItem = findGoodItem(d2, rec.category);
        }
      } catch (_) {
        // 楽天失敗時はAmazonのみで表示
      }
      // 連続リクエストのレートリミット回避（300ms待機）
      await sleep(300);

      const amazonUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(p.searchKeyword)}&tag=${AMAZON_TAG}`;

      if (rakutenItem) {
        // 楽天の画像URL: ?_ex=128x128 を除去して元サイズを使う
        const rawImg = rakutenItem.mediumImageUrls?.[0]?.imageUrl || null;
        const imageUrl = rawImg ? rawImg.replace(/\?.*$/, '') : null;

        products.push({
          title:         rakutenItem.itemName.replace(/【[^】]*】|★[^★]*★|\[[^\]]*\]/g, '').trim().slice(0, 60),
          brand:         p.brand || null,
          price:         `¥${Number(rakutenItem.itemPrice).toLocaleString()}（税込）`,
          imageUrl,
          affiliateUrl:  rakutenItem.affiliateUrl || rakutenItem.itemUrl,
          amazonUrl,
          reviewCount:   rakutenItem.reviewCount   || 0,
          reviewAverage: rakutenItem.reviewAverage || 0,
        });
      } else {
        products.push({
          title:         p.productName,
          brand:         p.brand || null,
          price:         null,
          imageUrl:      null,
          affiliateUrl:  null,
          amazonUrl,
          reviewCount:   0,
          reviewAverage: 0,
        });
      }
    }
    results.push({ category: rec.category, reason: rec.reason, products });
  }

  return json({ results });
}
