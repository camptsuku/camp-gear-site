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
  'スチーマー', '低温調理', '炊飯', 'トースター', 'オーブン', 'ミキサー', 'ブレンダー',
  'ジューサー', 'ヨーグルト', 'ホームベーカリー',
  'ゆで卵', 'ゆでたまご', '卵メーカー', '目玉焼き', '家庭用', '業務用',
  '食洗機', '冷蔵', '冷凍', '圧力鍋', '土鍋', 'フライパン',
  // 介護・福祉・医療用品
  'ステッキ', '杖', '歩行', '介護', 'シルバー', '福祉', '医療', '車椅子', '補助',
  // 防災・衛生用品
  'トイレ', '便器', '簡易トイレ', '防災', '避難', '非常用', '災害', '緊急', '救急',
  // 靴・フットウェア
  'シューズ', 'ブーツ', 'スニーカー', 'サンダル', '靴', 'フットウェア', 'インソール', 'ソール',
  // 扇風機・冷却・空調
  '扇風機', 'ミストファン', 'ミスト扇風機', 'サーキュレーター', 'スポットクーラー', '冷風機', 'エアコン',
  // 充電器・バッテリー・電源
  'ポータブル電源', '充電器', 'バッテリー', 'モバイルバッテリー', 'ソーラーパネル',
  // テーブルウェア・食器（単体商品のみ、クッカーセットは除外しない）
  '食器セット', 'カトラリーセット', 'ディッシュセット',
  // 室内寝具・家具
  'こたつ', 'コタツ', '布団', 'ふとん', 'ベッド', '毛布', 'ブランケット', 'クッション', '枕', 'まくら',
  // 衣類・ウェア
  'ジャケット', 'パンツ', 'ウェア', 'レインウェア', 'グローブ', '手袋', '帽子', 'キャップ',
  // 家庭用カセットコンロ・ガス器具
  'カセットコンロ', 'カセットガス', 'カセットフー', 'CB缶', 'CB-', 'イワタニ', 'テーブルコンロ', '鍋セット',
  // イベント・業務用テント
  'イージーアップ', 'ワンタッチテント', 'イベントテント', 'タープテント', 'ワンタッチタープ',
  '運動会', '学校', 'パーティー', 'マーケット', 'EZ UP', 'EZUP',
  // 室内チェア・家具チェア
  'ゲーミングチェア', 'オフィスチェア', 'デスクチェア', 'マッサージチェア', 'ダイニングチェア',
  'バーチェア', 'リクライニングソファ', 'ソファ', 'パーソナルチェア',
  // 室内テーブル・家具
  'ダイニングテーブル', '学習机', 'パソコンデスク', 'ワークデスク', 'オフィスデスク',
  'システムデスク', 'ローデスク', 'センターテーブル', 'リビングテーブル', 'こたつテーブル',
  // 室内照明
  'シーリングライト', 'シーリング', '蛍光灯', 'LED電球', 'ペンダントライト',
  'デスクライト', 'スタンドライト', 'フロアライト', '電球色', '昼白色',
  // ペット・子供用テント
  'ペットテント', '犬用テント', '猫用テント', 'キッズテント', '砂場テント',
  // 園芸・ガーデン家具（室内向き）
  'ガーデニング', '植木', '鉢植え', 'プランター',
];

// カテゴリごとにタイトルに含まれるべきキーワード（いずれか1つ以上）
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

// ブランド表記ゆれ対応（英語名 → 楽天で使われる表記バリエーション）
const BRAND_ALIASES = {
  'snow peak':         ['スノーピーク', 'snow peak', 'snowpeak'],
  'Coleman':           ['コールマン', 'Coleman'],
  'DOD':               ['DOD', 'ディーオーディー'],
  'Nordisk':           ['ノルディスク', 'Nordisk'],
  'ogawa':             ['ogawa', 'オガワ', '小川テント'],
  'HILLEBERG':         ['ヒルバーグ', 'HILLEBERG'],
  'tent-Mark DESIGNS': ['テンマクデザイン', 'tent-Mark', 'テンマク'],
  'mont-bell':         ['モンベル', 'mont-bell', 'montbell'],
  'NANGA':             ['ナンガ', 'NANGA'],
  'ISUKA':             ['イスカ', 'ISUKA'],
  'Helinox':           ['ヘリノックス', 'Helinox'],
  'CAPTAIN STAG':      ['キャプテンスタッグ', 'CAPTAIN STAG'],
  'LOGOS':             ['ロゴス', 'LOGOS'],
  'UNIFLAME':          ['ユニフレーム', 'UNIFLAME'],
  'PRIMUS':            ['プリムス', 'PRIMUS'],
  'trangia':           ['トランギア', 'trangia'],
  'GOAL ZERO':         ['ゴールゼロ', 'GOAL ZERO', 'goalzero'],
  'GENTOS':            ['ジェントス', 'GENTOS'],
};

function isExcluded(name) {
  return EXCLUDE_WORDS.some(w => name.includes(w));
}

// カテゴリ別の追加除外ワード（CATEGORY_KEYWORDS にマッチしても弾く）
const CATEGORY_EXCLUDES = {
  'テント':   ['イージーアップ', 'タープテント', 'ワンタッチタープ', 'イベント', '運動会',
               'ペットテント', 'キッズテント', '砂場テント'],
  'チェア':   ['ゲーミング', 'オフィス', 'デスクチェア', 'マッサージ', 'ダイニングチェア',
               'バーチェア', 'ソファ', 'リクライニングソファ', 'パーソナルチェア'],
  'テーブル': ['ダイニングテーブル', '学習机', 'パソコンデスク', 'ワークデスク', 'オフィスデスク',
               'システムデスク', 'センターテーブル', 'リビングテーブル', 'こたつテーブル'],
  'ランタン': ['シーリング', '蛍光灯', 'LED電球', 'ペンダントライト', 'デスクライト',
               'スタンドライト', 'フロアライト', '電球色', '昼白色'],
};

function matchesCategory(name, category) {
  const keywords = CATEGORY_KEYWORDS[category];
  if (!keywords) {
    return Object.values(CATEGORY_KEYWORDS).some(kws => kws.some(kw => name.includes(kw)));
  }
  const excludes = CATEGORY_EXCLUDES[category] || [];
  if (excludes.some(w => name.includes(w))) return false;
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
  const conditionText = [
    campStyle,
    budget ? `予算${budget}` : '',
  ].filter(Boolean).join('、') || 'こだわらない';
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

  // 楽天検索キーワードにカテゴリキーワード＋アウトドア修飾を付加する
  function buildSearchKeyword(searchKeyword, category) {
    const catKw = CATEGORY_KEYWORDS[category]?.[0] || category;
    let kw = searchKeyword;
    // カテゴリキーワードが含まれていなければ追加
    if (!kw.includes(catKw)) kw = `${kw} ${catKw}`;
    // 「キャンプ」「アウトドア」のどちらも含まれていなければ「アウトドア」を先頭に追加
    if (!kw.includes('キャンプ') && !kw.includes('アウトドア')) kw = `アウトドア ${kw}`;
    return kw;
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

  // ── タイトルからブランド名を抽出 ──
  function extractBrandFromTitle(itemName) {
    // 先頭の英数字ブランド名（例: BALMUDA、Coleman、LOGOS）
    const ascii = itemName.match(/^([A-Za-z][A-Za-z0-9]*(?:[ \-][A-Z][A-Za-z0-9]*)?)/);
    if (ascii) return ascii[1].trim();
    // 先頭のカタカナ語（例: コールマン、スノーピーク）
    const kana = itemName.match(/^([\u30A0-\u30FF]+)/);
    if (kana) return kana[1];
    return null;
  }

  // ── 型番抽出（英数字+数字パターン、大文字小文字問わず） ──
  function extractModelNumbers(title) {
    // 例: STP-381, CS-520, 170T, SDX-001 など
    return (title.match(/[A-Za-z]{1,5}-?[0-9]{2,6}[A-Za-z0-9-]*/g) || [])
      .map(m => m.toUpperCase());
  }

  // ── 商品名を正規化（バナー・記号・空白を除去して比較用文字列を作る） ──
  function normalizeTitle(title) {
    return title
      // 【】★[]《》内の装飾を除去
      .replace(/【[^】]*】|★[^★]*★|\[[^\]]*\]|《[^》]*》/g, '')
      // 先頭の販促ワード（送料無料・期間限定等）を繰り返し除去
      .replace(/^(送料無料|在庫[^\s　]*|期間限定|数量限定|クーポン対象|ポイント[^\s　]*|レビュー[^\s　]*|セール|SALE|sale)[　\s]*/g, '')
      .replace(/^(送料無料|在庫[^\s　]*|期間限定|数量限定|クーポン対象|ポイント[^\s　]*|レビュー[^\s　]*|セール|SALE|sale)[　\s]*/g, '')
      // 記号・空白・区切り文字を除去
      .replace(/[　\s\-・\/\\|＿_~～。、！!？?◆◇■□▼△▲]/g, '')
      // 全角英数を半角に変換
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .toLowerCase()
      .trim();
  }

  // ── 全候補を収集したあとまとめて重複除去 ──
  // 条件a: itemCode が同じ
  // 条件b: 画像URL が同じ（同一商品を別店舗が出品）
  // 条件c: 型番が一致（型番あり商品のみ）
  // 条件d: 正規化した商品名の先頭30文字が一致
  function deduplicateCandidates(candidates) {
    const seenCodes    = new Set();
    const seenImages   = new Set();
    const seenModels   = new Set();
    const seenPrefixes = new Set();
    const result = [];
    for (const c of candidates) {
      if (result.length >= 20) break;
      // 条件a: itemCode重複
      if (c.itemCode && seenCodes.has(c.itemCode)) continue;
      // 条件b: 画像URL重複（同一商品の別出品を確実に検出）
      if (c.imageUrl && seenImages.has(c.imageUrl)) continue;
      // 条件c: 型番重複（型番が存在する場合のみチェック）
      const models = extractModelNumbers(c.rawTitle);
      if (models.length > 0 && models.some(m => seenModels.has(m))) continue;
      // 条件d: 正規化タイトルの先頭30文字が一致
      const normalizedPrefix = normalizeTitle(c.rawTitle).slice(0, 30);
      if (normalizedPrefix && seenPrefixes.has(normalizedPrefix)) continue;
      // 重複なし → 記録して追加
      if (c.itemCode) seenCodes.add(c.itemCode);
      if (c.imageUrl) seenImages.add(c.imageUrl);
      models.forEach(m => seenModels.add(m));
      if (normalizedPrefix) seenPrefixes.add(normalizedPrefix);
      const { rawTitle, itemCode, ...product } = c;
      result.push(product);
    }
    return result;
  }

  // ── 楽天アイテムを候補配列に追加（重複チェックなし）──
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
    });
  }

  // ── カテゴリごとに楽天検索して商品を収集・重複除去 ──
  const results = [];
  for (const [category, group] of categoryGroups) {
    const candidates = [];

    // ── Stage 1: Gemini キーワード並列検索 ──
    const mainFetches = group.geminiProducts.slice(0, 10).map(p => {
      const keyword = buildSearchKeyword(p.searchKeyword, category);
      const amazonUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(p.searchKeyword)}&tag=${AMAZON_TAG}`;
      return fetchRakuten(keyword)
        .then(d => ({ p, d, amazonUrl }))
        .catch(() => null);
    });
    const mainResults = await Promise.all(mainFetches);
    for (const r of mainResults) {
      if (!r) continue;
      const items = findGoodItems(r.d, category, 4);
      for (const item of items) addRakutenItem(item, r.p.brand, r.amazonUrl, candidates);
    }

    // ── Stage 2: 補完検索 ──
    const catKw = CATEGORY_KEYWORDS[category]?.[0] || category;
    const fillFetches = [
      `アウトドア ${catKw} おすすめ`,
      `キャンプ ${catKw} 人気`,
    ].map(kw => {
      const amazonUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(kw)}&tag=${AMAZON_TAG}`;
      return fetchRakuten(kw)
        .then(d => ({ d, amazonUrl }))
        .catch(() => null);
    });
    const fillResults = await Promise.all(fillFetches);
    for (const r of fillResults) {
      if (!r) continue;
      const items = findGoodItems(r.d, category, 10);
      for (const item of items) addRakutenItem(item, null, r.amazonUrl, candidates);
    }

    // 全候補を収集後にまとめて重複除去して最大20件
    const products = deduplicateCandidates(candidates);
    results.push({ category, reason: group.reason, products });
  }

  return json({ results });
}
