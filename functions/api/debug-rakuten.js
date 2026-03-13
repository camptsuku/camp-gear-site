export async function onRequestGet(context) {
  const { env } = context;
  const RAKUTEN_APP_ID = (env.RAKUTEN_APP_ID || 'ef16f377-c183-4449-8808-da74cd5622e1').trim();
  const RAKUTEN_AFFILIATE_ID = (env.RAKUTEN_AFFILIATE_ID || '51b76b74.e928f44c.51b76b75.f3fe3626').trim();

  const params = new URLSearchParams({
    applicationId: RAKUTEN_APP_ID,
    affiliateId: RAKUTEN_AFFILIATE_ID,
    keyword: 'スノーピーク テント',
    hits: '1',
    sort: '-reviewCount',
    imageFlag: '1',
    minPrice: '1',
  });

  const url = `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20170706?${params}`;

  let rakutenResponse;
  try {
    const r = await fetch(url);
    rakutenResponse = await r.json();
  } catch (e) {
    rakutenResponse = { fetchError: e.message };
  }

  return new Response(JSON.stringify({
    usedAppId: RAKUTEN_APP_ID,
    usedAffiliateId: RAKUTEN_AFFILIATE_ID,
    requestUrl: url,
    rakutenResponse,
  }, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
