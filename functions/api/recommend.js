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
  // バッグ・バックパック類
  'バックパック', 'リュック', 'ザック', 'パック',
  // 家電・屋内調理器具
  'レンジ', '電子レンジ', 'IH', '電気', '炊飯器', 'ホットプレート', 'たこ焼き', '電動',
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

  const { campStyle, style, season, goal, categories, budget } = body;
  const categoryList = categories?.join('、') || 'テント、焚き火台、寝袋、チェア、テーブル、クッカー、ランタン';

  // ── Step 1: Gemini で人気商品名を特定 ──────────────────────────────
  // 旧プロンプト（詳細版）は git 履歴 a646992 を参照
  const conditionText = [campStyle, budget ? `予算${budget}` : ''].filter(Boolean).join('、') || 'こだわらない';
  const prompt = `キャンプギア専門家として、以下の条件に合う日本で人気・高評価の${categoryList}本体製品を5件特定してください。
ユーザー条件: ${conditionText}
必ずアウトドア・キャンプで使用する道具のみ提案すること。家電・食品・衣類は絶対に含めないこと。本体製品のみ（アクセサリー・パーツ・収納ケース除く）。JSONのみ:
{"recommendations":[{"category":"テント","reason":"選定理由100字以内","products":[{"productName":"スノーピーク アメニティドームM","brand":"スノーピーク","searchKeyword":"スノーピーク アメニティドームM テント"}]}]}`;

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
          generationConfig: { temperature: 0.7, maxOutputTokens: 65536 },
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

  // 予算文字列を楽天API価格パラメータに動的変換
  // 対応フォーマット: 「〜N円」「N〜M円」「N円以上」（カンマ区切り数字も可）
  function getBudgetParams(b) {
    if (!b) return { minPrice: '1' };
    const n = (s) => s.replace(/,/g, '');
    const maxOnly = b.match(/^〜([\d,]+)円$/);
    if (maxOnly) return { minPrice: '1', maxPrice: n(maxOnly[1]) };
    const range = b.match(/^([\d,]+)〜([\d,]+)円$/);
    if (range) return { minPrice: String(Number(n(range[1])) + 1), maxPrice: n(range[2]) };
    const minOnly = b.match(/^([\d,]+)円以上$/);
    if (minOnly) return { minPrice: String(Number(n(minOnly[1])) + 1) };
    return { minPrice: '1' };
  }
  const bp = getBudgetParams(budget);

  async function fetchRakuten(keyword) {
    const params = new URLSearchParams({
      applicationId: RAKUTEN_APP_ID,
      accessKey:     RAKUTEN_ACCESS_KEY,
      affiliateId:   RAKUTEN_AFFILIATE_ID,
      keyword,
      hits:     '10',
      sort:     '-reviewCount',
      imageFlag:'1',
      minPrice: bp.minPrice,
      format:   'json',
    });
    if (bp.maxPrice) params.set('maxPrice', bp.maxPrice);
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

  // 除外ワードに引っかからず、カテゴリキーワードを含むアイテムを最大n件返す
  function findGoodItems(d, category, n = 4) {
    const items = d.Items || [];
    const found = [];
    for (const item of items) {
      if (found.length >= n) break;
      const name = item.Item?.itemName || '';
      if (!isExcluded(name) && matchesCategory(name, category)) found.push(item.Item);
    }
    return found;
  }

  // 楽天検索キーワードにカテゴリキーワードを付加する
  function buildSearchKeyword(searchKeyword, category) {
    const catKw = CATEGORY_KEYWORDS[category]?.[0] || category;
    if (searchKeyword.includes(catKw)) return searchKeyword;
    return `${searchKeyword} ${catKw}`;
  }

  // ── Gemini はカテゴリを重複して返すことがある → カテゴリ単位でグループ化 ──
  const categoryGroups = new Map();
  for (const rec of recommendations) {
    const cat = rec.category;
    if (!categoryGroups.has(cat)) {
      categoryGroups.set(cat, { reason: rec.reason, geminiProducts: [] });
    }
    for (const p of (rec.products || [])) {
      categoryGroups.get(cat).geminiProducts.push(p);
    }
  }

  // ── 重複判定ヘルパー ──
  // 条件1: タイトル先頭20文字が同じ / 条件2: 価格＋画像URLが両方一致
  function isDuplicate(cleanTitle, price, imageUrl, seenTitles, seenSignatures) {
    if (seenTitles.has(cleanTitle.slice(0, 20))) return true;
    if (price && imageUrl && seenSignatures.has(`${price}|${imageUrl}`)) return true;
    return false;
  }
  function recordSeen(cleanTitle, price, imageUrl, seenTitles, seenSignatures) {
    seenTitles.add(cleanTitle.slice(0, 20));
    if (price && imageUrl) seenSignatures.add(`${price}|${imageUrl}`);
  }

  // ── 楽天アイテムを products 配列に追加する共通処理 ──
  function addRakutenItem(rakutenItem, brand, amazonUrl, products, seenTitles, seenSignatures) {
    if (products.length >= 30) return false;
    const rawImg = rakutenItem.mediumImageUrls?.[0]?.imageUrl || null;
    const imageUrl = rawImg ? rawImg.replace(/\?.*$/, '') : null;
    const cleanTitle = rakutenItem.itemName.replace(/【[^】]*】|★[^★]*★|\[[^\]]*\]/g, '').trim().slice(0, 60);
    const price = `¥${Number(rakutenItem.itemPrice).toLocaleString()}（税込）`;
    if (isDuplicate(cleanTitle, price, imageUrl, seenTitles, seenSignatures)) return false;
    recordSeen(cleanTitle, price, imageUrl, seenTitles, seenSignatures);
    products.push({
      title:         cleanTitle,
      brand:         brand || null,
      price,
      imageUrl,
      affiliateUrl:  rakutenItem.affiliateUrl || rakutenItem.itemUrl,
      amazonUrl,
      reviewCount:   rakutenItem.reviewCount   || 0,
      reviewAverage: rakutenItem.reviewAverage || 0,
    });
    return true;
  }

  // ── カテゴリごとに楽天検索して商品を最大30件収集 ──
  const results = [];
  for (const [category, group] of categoryGroups) {
    const products = [];
    const seenTitles = new Set();
    const seenSignatures = new Set();

    // メイン検索: Geminiの商品キーワードで順番に検索
    for (const p of group.geminiProducts.slice(0, 5)) {
      if (products.length >= 10) break;
      try {
        const keyword = buildSearchKeyword(p.searchKeyword, category);
        const d = await fetchRakuten(keyword);
        const items = findGoodItems(d, category, 3);
        const amazonUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(p.searchKeyword)}&tag=${AMAZON_TAG}`;
        for (const item of items) addRakutenItem(item, p.brand, amazonUrl, products, seenTitles, seenSignatures);
      } catch (_) {}
      await sleep(300);
    }

    // フォールバック検索: 10件未満の場合はカテゴリキーワードを変えて追加検索
    if (products.length < 10) {
      const catKw = CATEGORY_KEYWORDS[category]?.[0] || category;
      const fallbacks = [
        `${catKw} おすすめ`,
        `${catKw} 人気`,
      ];
      for (const kw of fallbacks) {
        if (products.length >= 10) break;
        try {
          const d = await fetchRakuten(kw);
          const need = 10 - products.length;
          const items = findGoodItems(d, category, need);
          const amazonUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(kw)}&tag=${AMAZON_TAG}`;
          for (const item of items) addRakutenItem(item, null, amazonUrl, products, seenTitles, seenSignatures);
        } catch (_) {}
        await sleep(300);
      }
    }

    results.push({ category, reason: group.reason, products });
  }

  return json({ results });
}
