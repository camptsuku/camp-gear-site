const APP_ID = process.env.RAKUTEN_APP_ID || 'ef16f377-c183-4449-8808-da74cd5622e1';
const AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID || '51b76b74.e928f44c.51b76b75.f3fe3626';

const CATEGORY_MAP = {
  tent: 'テント キャンプ',
  sleeping_bag: '寝袋 シュラフ',
  chair: 'アウトドアチェア',
  table: 'アウトドアテーブル',
  cooker: 'クッカー バーナー キャンプ',
  lantern: 'ランタン LED キャンプ',
  fireplace: '焚き火台',
  all: 'キャンプ アウトドア',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { keyword, category, maxResults } = req.query;
  const searchKeyword = keyword || CATEGORY_MAP[category] || 'キャンプ アウトドア';

  try {
    const params = new URLSearchParams({
      applicationId: APP_ID,
      affiliateId: AFFILIATE_ID,
      keyword: searchKeyword,
      hits: String(parseInt(maxResults) || 6),
      sort: 'standard',
      imageFlag: '1',
      availability: '1',
    });

    const url = `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20170706?${params}`;
    const response = await fetch(url);

    if (!response.ok) throw new Error(`Rakuten API error: ${response.status}`);

    const data = await response.json();
    if (data.error) throw new Error(data.error_description || data.error);

    const products = (data.Items || []).map(({ Item: p }) => ({
      id: p.itemCode,
      title: (p.itemName || '').replace(/[★【】≪≫◆]/g, '').replace(/楽天\S+/g, '').trim().slice(0, 60),
      brand: p.shopName || null,
      imageUrl: p.mediumImageUrls?.[0]?.imageUrl || null,
      price: p.itemPrice ? `¥${p.itemPrice.toLocaleString()}` : null,
      rating: p.reviewAverage ? parseFloat(p.reviewAverage) : null,
      reviewCount: p.reviewCount || null,
      affiliateUrl: p.affiliateUrl || p.itemUrl,
      source: 'rakuten',
    }));

    return res.status(200).json({ products, source: 'rakuten', count: products.length });
  } catch (error) {
    console.error('Rakuten handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}
