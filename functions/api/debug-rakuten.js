export async function onRequestGet(context) {
  const { env } = context;
  const RAKUTEN_APP_ID = (env.RAKUTEN_APP_ID || 'ef16f377-c183-4449-8808-da74cd5622e1').trim();
  const RAKUTEN_ACCESS_KEY = (env.RAKUTEN_ACCESS_KEY || '').trim();
  const RAKUTEN_AFFILIATE_ID = (env.RAKUTEN_AFFILIATE_ID || '51b76b74.e928f44c.51b76b75.f3fe3626').trim();

  const params = new URLSearchParams({
    applicationId: RAKUTEN_APP_ID,
    accessKey: RAKUTEN_ACCESS_KEY,
    affiliateId: RAKUTEN_AFFILIATE_ID,
    keyword: 'テント',
    hits: '1',
    sort: '-reviewCount',
    imageFlag: '1',
    minPrice: '1',
    format: 'json',
  });

  const url = `https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601?${params}`;

  let status, rakutenResponse;
  try {
    const r = await fetch(url, {
      headers: { 'Origin': 'https://camp-gear-site.pages.dev' },
    });
    status = r.status;
    try { rakutenResponse = await r.json(); } catch { rakutenResponse = await r.text(); }
  } catch (e) {
    rakutenResponse = { fetchError: e.message };
  }

  return new Response(JSON.stringify({
    usedAppId: RAKUTEN_APP_ID,
    usedAccessKey: RAKUTEN_ACCESS_KEY ? '(set, length=' + RAKUTEN_ACCESS_KEY.length + ')' : '(not set)',
    usedAffiliateId: RAKUTEN_AFFILIATE_ID,
    httpStatus: status,
    rakutenResponse,
  }, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
