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

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

const EXCLUDE_WORDS = [
  'ふるさと納税', '寄付', '返礼品',
  'ポール', 'スタンド', 'ペグ', 'ロープ', '収納', 'ケース', 'バッグ', 'カバー',
  '交換', '補修', 'パーツ', '部品', '替え', '延長', 'アダプター',
  'グランドシート', 'インナーマット', 'フレーム', '継ぎ', 'ガイライン',
  '自在', 'フック', 'リング', '補強',
  'バックパック', 'リュック', 'ザック', 'パック',
  'レンジ', '電子レンジ', 'IH', '電気', '炊飯器', 'ホットプレート', 'たこ焼き', '電動',
  'スチーマー', '低温調理', '炊飯', 'トースター', 'オーブン', 'ミキサー', 'ブレンダー',
  'ジューサー', 'ヨーグルト', 'ホームベーカリー',
  'ゆで卵', 'ゆでたまご', '卵メーカー', '目玉焼き', '家庭用', '業務用',
  '食洗機', '冷蔵', '冷凍', '圧力鍋', '土鍋', 'フライパン',
  'ステッキ', '杖', '歩行', '介護', 'シルバー', '福祉', '医療', '車椅子', '補助',
  'トイレ', '便器', '簡易トイレ', '防災', '避難', '非常用', '災害', '緊急', '救急',
  'シューズ', 'ブーツ', 'スニーカー', 'サンダル', '靴', 'フットウェア', 'インソール', 'ソール',
  '扇風機', 'ミストファン', 'ミスト扇風機', 'サーキュレーター', 'スポットクーラー', '冷風機', 'エアコン',
  'ポータブル電源', '充電器', 'バッテリー', 'モバイルバッテリー', 'ソーラーパネル',
  '食器セット', 'カトラリーセット', 'ディッシュセット',
  'こたつ', 'コタツ', '布団', 'ふとん', 'ベッド', '毛布', 'ブランケット', 'クッション', '枕', 'まくら',
  'ジャケット', 'パンツ', 'ウェア', 'レインウェア', 'グローブ', '手袋', '帽子', 'キャップ',
  'カセットコンロ', 'カセットガス', 'カセットフー', 'CB缶', 'CB-', 'イワタニ', 'テーブルコンロ', '鍋セット',
  'イージーアップ', 'ワンタッチテント', 'イベントテント', 'タープテント', 'ワンタッチタープ',
  '運動会', '学校', 'パーティー', 'マーケット', 'EZ UP', 'EZUP',
  'ゲーミングチェア', 'オフィスチェア', 'デスクチェア', 'マッサージチェア', 'ダイニングチェア',
  'バーチェア', 'リクライニングソファ', 'ソファ', 'パーソナルチェア',
  'ダイニングテーブル', '学習机', 'パソコンデスク', 'ワークデスク', 'オフィスデスク',
  'システムデスク', 'ローデスク', 'センターテーブル', 'リビングテーブル', 'こたつテーブル',
  'シーリングライト', 'シーリング', '蛍光灯', 'LED電球', 'ペンダントライト',
  'デスクライト', 'スタンドライト', 'フロアライト', '電球色', '昼白色',
  'ペットテント', '犬用テント', '猫用テント', 'キッズテント', '砂場テント',
  'ガーデニング', '植木', '鉢植え', 'プランター',
];

const CATEGORY_KEYWORDS = {
  'テント':   ['キャンプテント', 'ドームテント', 'ツールーム', 'ワンポールテント', 'テント'],
  'タープ':   ['タープ'],
  '寝袋':     ['寝袋', 'シュラフ'],
  'チェア':   ['チェア', '椅子'],
  'テーブル': ['テーブル'],
  'クッカー': ['クッカー', 'バーナー', 'コンロ', 'メスティン'],
  'ランタン': ['ランタン'],
  '焚き火台': ['焚き火台', '焚火台'],
};

const CATEGORY_EXCLUDES = {
  'テント':   ['イージーアップ', 'タープテント', 'ワンタッチタープ', 'イベント', '運動会', 'ペットテント', 'キッズテント', '砂場テント'],
  'チェア':   ['ゲーミング', 'オフィス', 'デスクチェア', 'マッサージ', 'ダイニングチェア', 'バーチェア', 'ソファ', 'リクライニングソファ', 'パーソナルチェア'],
  'テーブル': ['ダイニングテーブル', '学習机', 'パソコンデスク', 'ワークデスク', 'オフィスデスク', 'システムデスク', 'センターテーブル', 'リビングテーブル', 'こたつテーブル'],
  'ランタン': ['シーリング', '蛍光灯', 'LED電球', 'ペンダントライト', 'デスクライト', 'スタンドライト', 'フロアライト', '電球色', '昼白色'],
};

function isExcluded(name) {
  return EXCLUDE_WORDS.some(w => name.includes(w));
}

function matchesCategory(name, category) {
  const keywords = CATEGORY_KEYWORDS[category];
  if (!keywords) {
    return Object.values(CATEGORY_KEYWORDS).some(kws => kws.some(kw => name.includes(kw)));
  }
  const excludes = CATEGORY_EXCLUDES[category] || [];
  if (excludes.some(w => name.includes(w))) return false;
  return keywords.some(kw => name.includes(kw));
}

// ── Amazon Creators API ──────────────────────────────────────────────
async function getAmazonToken(clientId, clientSecret) {
  const res = await fetch('https://api.amazon.co.jp/auth/o2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type:    'client_credentials',
      client_id:     clientId,
      client_secret: clientSecret,
      scope:         'creatorsapi::default',
    }),
  });
  if (!res.ok) throw new Error(`Amazon token error: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function searchAmazon(keyword, token, partnerTag) {
  const res = await fetch('https://creatorsapi.amazon/catalog/v1/searchItems', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
      'x-marketplace': 'www.amazon.co.jp',
    },
    body: JSON.stringify({
      keywords:    keyword,
      resources:   [
        'images.primary.medium',
        'itemInfo.title',
        'itemInfo.byLineInfo',
        'offersV2.listings.price',
        'customerReviews.count',
        'customerReviews.starRating',
      ],
      partnerTag:  partnerTag,
      partnerType: 'Associates',
      marketplace: 'www.amazon.co.jp',
      searchIndex: 'SportingGoods',
      itemCount:   3,
    }),
  });
  if (!res.ok) throw new Error(`Amazon search error: ${res.status}`);
  const data = await res.json();
  const items = data.searchResult?.items || data.itemsResult?.items || [];
  return items.map(item => ({
    title:       (item.itemInfo?.title?.displayValue || '').slice(0, 60),
    brand:       item.itemInfo?.byLineInfo?.brand?.displayValue || null,
    imageUrl:    item.images?.primary?.medium?.url || null,
    price:       item.offersV2?.listings?.[0]?.price?.displayAmount || null,
    amazonUrl:   item.detailPageURL || `https://www.amazon.co.jp/dp/${item.asin}?tag=${partnerTag}`,
    reviewCount: item.customerReviews?.count || 0,
    reviewAverage: item.customerReviews?.starRating?.value ? parseFloat(item.customerReviews.starRating.value) : 0,
    source:      'amazon',
  }));
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const GEMINI_API_KEY       = (env.GEMINI_API_KEY || '').trim();
  const RAKUTEN_APP_ID       = (env.RAKUTEN_APP_ID || 'ef16f377-c183-4449-8808-da74cd5622e1').trim();
  const RAKUTEN_ACCESS_KEY   = (env.RAKUTEN_ACCESS_KEY || '').trim();
  const RAKUTEN_AFFILIATE_ID = (env.RAKUTEN_AFFILIATE_ID || '51b76b74.e928f44c.51b76b75.f3fe3626').trim();
  const AMAZON_TAG           = (env.AMAZON_ASSOCIATE_TAG || 'campjoutsukur-22').trim();
  const AMAZON_CLIENT_ID     = (env.AMAZON_CLIENT_ID || '').trim();
  const AMAZON_CLIENT_SECRET = (env.AMAZON_CLIENT_SECRET || '').trim();

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { campStyle, style, season, goal, categories, budget } = body;
  const categoryList = categories?.join('、') || 'テント、焚き火台、寝袋、チェア、テーブル、クッカー、ランタン';

  const conditionText = [campStyle, budget ? `予算${budget}` : ''].filter(Boolean).join('、') || 'こだわらない';
  const prompt = `キャンプギア専門家として、以下の条件に合う日本で人気・高評価の${categoryList}本体製品を10件特定してください。
ユーザー条件: ${conditionText}
【絶対厳守】フィールドで使うキャンプ・アウトドア専用ギアのみ。以下は一切禁止：
・家電・調理家電（炊飯器・IH・電子レンジ・ホットプレート・低温調理器・ゆで卵メーカー等）
・室内家具（ゲーミングチェア・オフィスチェア・ダイニングテーブル・学習机等）
・室内照明（シーリングライト・LED電球・ペンダントライト等）
・衣類・靴・食品・日用品・防災用品・医療用品・介護用品
・イベント用テント・ガゼボ（キャンプ場で使うドームテント・ワンポールテント等のみ可）
・アクセサリー・パーツ・収納ケース（本体のみ）
JSONのみ:
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
      return json({ error: `Gemini API error (${geminiRes.status})`, detail: err }, 500);
    }
    const geminiData = await geminiRes.json();
    const parts = geminiData.candidates?.[0]?.content?.parts || [];
    const rawText = parts.filter(p => p.text).map(p => p.text).join('');
    if (!rawText) return json({ error: 'No text response from Gemini' }, 500);
    const clean = rawText.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in Gemini response');
    recommendations = JSON.parse(jsonMatch[0]).recommendations;
    if (!Array.isArray(recommendations)) throw new Error('recommendations is not array');
  } catch (e) {
    return json({ error: 'Gemini error', detail: e.message }, 500);
  }

  // ── Amazon トークンを事前取得（失敗してもフォールバック） ──
  let amazonToken = null;
  if (AMAZON_CLIENT_ID && AMAZON_CLIENT_SECRET) {
    try {
      amazonToken = await getAmazonToken(AMAZON_CLIENT_ID, AMAZON_CLIENT_SECRET);
    } catch (e) {
      console.error('Amazon token error:', e.message);
    }
  }

  const RAKUTEN_ENDPOINT = 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601';
  const RAKUTEN_ORIGIN = 'https://camp-gear-site.pages.dev';
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
      hits:     '20',
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
      const res2 = await fetch(`${RAKUTEN_ENDPOINT}?${params}`, { headers: { 'Origin': RAKUTEN_ORIGIN } });
      return res2.json();
    }
    return d;
  }

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

  function buildSearchKeyword(searchKeyword, category) {
    const catKw = CATEGORY_KEYWORDS[category]?.[0] || category;
    let kw = searchKeyword;
    if (!kw.includes(catKw)) kw = `${kw} ${catKw}`;
    if (!kw.includes('キャンプ') && !kw.includes('アウトドア')) kw = `アウトドア ${kw}`;
    return kw;
  }

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

  function extractBrandFromTitle(itemName) {
    const ascii = itemName.match(/^([A-Za-z][A-Za-z0-9]*(?:[ \-][A-Z][A-Za-z0-9]*)?)/);
    if (ascii) return ascii[1].trim();
    const kana = itemName.match(/^([\u30A0-\u30FF]+)/);
    if (kana) return kana[1];
    return null;
  }

  function extractModelNumbers(title) {
    return (title.match(/[A-Za-z]{1,5}-?[0-9]{2,6}[A-Za-z0-9-]*/g) || []).map(m => m.toUpperCase());
  }

  function normalizeTitle(title) {
    return title
      .replace(/【[^】]*】|★[^★]*★|\[[^\]]*\]|《[^》]*》/g, '')
      .replace(/^(送料無料|在庫[^\s　]*|期間限定|数量限定|クーポン対象|ポイント[^\s　]*|レビュー[^\s　]*|セール|SALE|sale)[　\s]*/g, '')
      .replace(/^(送料無料|在庫[^\s　]*|期間限定|数量限定|クーポン対象|ポイント[^\s　]*|レビュー[^\s　]*|セール|SALE|sale)[　\s]*/g, '')
      .replace(/[　\s\-・\/\\|＿_~～。、！!？?◆◇■□▼△▲]/g, '')
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .toLowerCase()
      .trim();
  }

  function deduplicateCandidates(candidates) {
    const seenCodes    = new Set();
    const seenImages   = new Set();
    const seenModels   = new Set();
    const seenPrefixes = new Set();
    const result = [];
    for (const c of candidates) {
      if (result.length >= 20) break;
      if (c.itemCode && seenCodes.has(c.itemCode)) continue;
      if (c.imageUrl && seenImages.has(c.imageUrl)) continue;
      const models = extractModelNumbers(c.rawTitle || c.title || '');
      if (models.length > 0 && models.some(m => seenModels.has(m))) continue;
      const normalizedPrefix = normalizeTitle(c.rawTitle || c.title || '').slice(0, 30);
      if (normalizedPrefix && seenPrefixes.has(normalizedPrefix)) continue;
      if (c.itemCode) seenCodes.add(c.itemCode);
      if (c.imageUrl) seenImages.add(c.imageUrl);
      models.forEach(m => seenModels.add(m));
      if (normalizedPrefix) seenPrefixes.add(normalizedPrefix);
      const { rawTitle, itemCode, ...product } = c;
      result.push(product);
    }
    return result;
  }

  function addRakutenItem(rakutenItem, geminiBrand, amazonUrl, candidates) {
    const rawImg = rakutenItem.mediumImageUrls?.[0]?.imageUrl || null;
    const imageUrl = rawImg ? rawImg.replace(/\?.*$/, '') : null;
    const rawTitle = rakutenItem.itemName;
    const cleanTitle = rawTitle.replace(/【[^】]*】|★[^★]*★|\[[^\]]*\]/g, '').trim().slice(0, 60);
    const price = `¥${Number(rakutenItem.itemPrice).toLocaleString()}（税込）`;
    const brand = (rakutenItem.brandName || rakutenItem.makerName || geminiBrand || extractBrandFromTitle(rawTitle)) || null;
    candidates.push({
      rawTitle,
      itemCode:      rakutenItem.itemCode || null,
      title:         cleanTitle,
      brand,
      price,
      imageUrl,
      affiliateUrl:  rakutenItem.affiliateUrl || rakutenItem.itemUrl,
      amazonUrl,
      reviewCount:   rakutenItem.reviewCount   || 0,
      reviewAverage: rakutenItem.reviewAverage || 0,
      source:        'rakuten',
    });
  }

  const results = [];
  for (const [category, group] of categoryGroups) {
    const candidates = [];

    // Stage 1: Gemini キーワードで楽天・Amazon並列検索
    const mainFetches = group.geminiProducts.slice(0, 10).map(p => {
      const keyword = buildSearchKeyword(p.searchKeyword, category);
      const amazonFallbackUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(p.searchKeyword)}&tag=${AMAZON_TAG}`;
      const rakutenPromise = fetchRakuten(keyword).then(d => ({ p, d, amazonFallbackUrl })).catch(() => null);
      const amazonPromise = amazonToken
        ? searchAmazon(p.searchKeyword, amazonToken, AMAZON_TAG).catch(() => [])
        : Promise.resolve([]);
      return Promise.all([rakutenPromise, amazonPromise]);
    });
    const mainResults = await Promise.all(mainFetches);
    for (const [rakutenResult, amazonItems] of mainResults) {
      // Amazon商品を先に追加（優先表示）
      for (const item of amazonItems) {
        candidates.push({ ...item, rawTitle: item.title, itemCode: null });
      }
      // 楽天商品を後から追加（補完）
      if (rakutenResult) {
        const items = findGoodItems(rakutenResult.d, category, 4);
        for (const item of items) addRakutenItem(item, rakutenResult.p.brand, rakutenResult.amazonFallbackUrl, candidates);
      }
    }

    // Stage 2: 補完検索（楽天のみ）
    const catKw = CATEGORY_KEYWORDS[category]?.[0] || category;
    const fillFetches = [
      `アウトドア ${catKw} おすすめ`,
      `キャンプ ${catKw} 人気`,
    ].map(kw => {
      const amazonFallbackUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(kw)}&tag=${AMAZON_TAG}`;
      return fetchRakuten(kw).then(d => ({ d, amazonFallbackUrl })).catch(() => null);
    });
    const fillResults = await Promise.all(fillFetches);
    for (const r of fillResults) {
      if (!r) continue;
      const items = findGoodItems(r.d, category, 10);
      for (const item of items) addRakutenItem(item, null, r.amazonFallbackUrl, candidates);
    }

    // Amazon商品を先頭に並べてからdedup（重複時はAmazon側を優先保持）
    candidates.sort((a, b) => {
      if (a.source === 'amazon' && b.source !== 'amazon') return -1;
      if (a.source !== 'amazon' && b.source === 'amazon') return 1;
      return 0;
    });
    const products = deduplicateCandidates(candidates);
    results.push({ category, reason: group.reason, products });
  }

  return json({ results });
}
