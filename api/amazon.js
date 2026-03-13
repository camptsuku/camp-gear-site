const CLIENT_ID = process.env.AMAZON_CLIENT_ID || '';
const CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET || '';
const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG || 'campjoutsuk0a-22';

const TOKEN_ENDPOINT = 'https://api.amazon.co.jp/auth/o2/token';
const API_ENDPOINT = 'https://creatorsapi.amazon/catalog/v1/searchItems';

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60000) return cachedToken;
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'creatorsapi::default',
    }),
  });
  if (!res.ok) throw new Error(`Token fetch failed: ${res.status} - ${await res.text()}`);
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

const CATEGORY_MAP = {
  tent:         { keywords: 'テント キャンプ' },
  sleeping_bag: { keywords: '寝袋 シュラフ' },
  chair:        { keywords: 'アウトドアチェア' },
  table:        { keywords: 'アウトドアテーブル' },
  cooker:       { keywords: 'クッカー バーナー キャンプ' },
  lantern:      { keywords: 'ランタン LED キャンプ' },
  fireplace:    { keywords: '焚き火台' },
  all:          { keywords: 'キャンプ アウトドア' },
};

async function searchAmazonProducts({ keyword, category = 'tent', maxResults = 6 }) {
  const token = await getAccessToken();
  const config = CATEGORY_MAP[category] || CATEGORY_MAP['tent'];
  const payload = JSON.stringify({
    keywords: keyword || config.keywords,
    resources: [
      'images.primary.medium',
      'itemInfo.title',
      'itemInfo.byLineInfo',
      'offersV2.listings.price',
      'customerReviews.count',
      'customerReviews.starRating',
    ],
    partnerTag: PARTNER_TAG,
    partnerType: 'Associates',
    marketplace: 'www.amazon.co.jp',
    searchIndex: 'SportingGoods',
    itemCount: maxResults,
  });
  const res = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-marketplace': 'www.amazon.co.jp',
    },
    body: payload,
  });
  if (!res.ok) throw new Error(`API error: ${res.status} - ${await res.text()}`);
  return formatProducts(await res.json());
}

function formatProducts(data) {
  const items = data.searchResult?.items || data.itemsResult?.items || [];
  return items.map((item) => {
    const title = item.itemInfo?.title?.displayValue || '商品名不明';
    const price = item.offersV2?.listings?.[0]?.price?.displayAmount || null;
    return {
      id: item.asin,
      title: title.length > 60 ? title.slice(0, 60) + '...' : title,
      brand: item.itemInfo?.byLineInfo?.brand?.displayValue || null,
      imageUrl: item.images?.primary?.medium?.url || null,
      price,
      rating: item.customerReviews?.starRating?.value ? parseFloat(item.customerReviews.starRating.value) : null,
      reviewCount: item.customerReviews?.count || null,
      affiliateUrl: item.detailPageURL || `https://www.amazon.co.jp/dp/${item.asin}?tag=${PARTNER_TAG}`,
      source: 'amazon',
    };
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { keyword, category, maxResults } = req.query;
  try {
    const products = await searchAmazonProducts({
      keyword, category: category || 'tent', maxResults: parseInt(maxResults) || 6,
    });
    return res.status(200).json({ products, source: 'amazon', count: products.length });
  } catch (error) {
    console.error('Amazon handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}
