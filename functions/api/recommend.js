/**
 * Cloudflare Pages Functions
 * POST /api/recommend
 *
 * Vercel との差分:
 *  - export default async function(req, res) → export const onRequestPost
 *  - process.env → context.env
 *  - res.status(N).json(obj) → new Response(JSON.stringify(obj), { status: N, headers })
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

各カテゴリについて5商品を調査して特定してください。
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
  const results = [];
  for (const rec of recommendations) {
    const products = [];
    for (const p of (rec.products || []).slice(0, 5)) {
      let rakutenItem = null;
      try {
        const params = new URLSearchParams({
          applicationId: RAKUTEN_APP_ID,
          accessKey:     RAKUTEN_ACCESS_KEY,
          affiliateId:   RAKUTEN_AFFILIATE_ID,
          keyword:       p.searchKeyword,
          hits:          '1',
          sort:          '-reviewCount',
          imageFlag:     '1',
          minPrice:      '1',
          format:        'json',
        });
        const r = await fetch(
          `https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601?${params}`,
          { headers: { 'Origin': 'https://camp-gear-site.pages.dev' } }
        );
        const d = await r.json();
        if (!d.error && d.Items?.[0]?.Item) {
          rakutenItem = d.Items[0].Item;
        }
      } catch (_) {
        // 楽天失敗時はAmazonのみで表示
      }

      const amazonUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(p.searchKeyword)}&tag=${AMAZON_TAG}`;

      if (rakutenItem) {
        // 楽天の画像URL: mediumImageUrls は [{imageUrl: "https://..."}] の配列
        // imageUrl の末尾に ?_ex=128x128 が付いている場合は除去して元サイズを使う
        const rawImg = rakutenItem.mediumImageUrls?.[0]?.imageUrl || null;
        const imageUrl = rawImg ? rawImg.replace(/\?.*$/, '') : null;

        products.push({
          title:         rakutenItem.itemName.replace(/【[^】]*】|★[^★]*★|\[[^\]]*\]/g, '').trim().slice(0, 60),
          price:         `¥${Number(rakutenItem.itemPrice).toLocaleString()}`,
          imageUrl,
          affiliateUrl:  rakutenItem.affiliateUrl || rakutenItem.itemUrl,
          amazonUrl,
          reviewCount:   rakutenItem.reviewCount   || 0,
          reviewAverage: rakutenItem.reviewAverage || 0,
        });
      } else {
        products.push({
          title:         p.productName,
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
