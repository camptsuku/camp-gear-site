export async function onRequestGet(context) {
  const { env } = context;
  const RAKUTEN_APP_ID = (env.RAKUTEN_APP_ID || 'ef16f377-c183-4449-8808-da74cd5622e1').trim();
  const RAKUTEN_ACCESS_KEY = (env.RAKUTEN_ACCESS_KEY || '').trim();

  const keywords = ['ナンガ オーロラライト 600DX', 'モンベル バロウバッグ', 'コールマン 寝袋'];
  const results = [];

  for (const keyword of keywords) {
    // sort なし
    const params1 = new URLSearchParams({
      applicationId: RAKUTEN_APP_ID,
      accessKey: RAKUTEN_ACCESS_KEY,
      keyword,
      hits: '1',
      imageFlag: '1',
      minPrice: '1',
      format: 'json',
    });
    // sort あり
    const params2 = new URLSearchParams({
      applicationId: RAKUTEN_APP_ID,
      accessKey: RAKUTEN_ACCESS_KEY,
      keyword,
      hits: '1',
      sort: '-reviewCount',
      imageFlag: '1',
      minPrice: '1',
      format: 'json',
    });

    const BASE = 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601';
    const HEADERS = { 'Origin': 'https://camp-gear-site.pages.dev' };

    const [r1, r2] = await Promise.all([
      fetch(`${BASE}?${params1}`, { headers: HEADERS }).then(r => r.json()).catch(e => ({ fetchError: e.message })),
      fetch(`${BASE}?${params2}`, { headers: HEADERS }).then(r => r.json()).catch(e => ({ fetchError: e.message })),
    ]);

    results.push({
      keyword,
      withoutSort: r1.Items ? `${r1.count} hits, first: ${r1.Items[0]?.Item?.itemName?.slice(0, 40)}` : JSON.stringify(r1).slice(0, 100),
      withSort: r2.Items ? `${r2.count} hits, first: ${r2.Items[0]?.Item?.itemName?.slice(0, 40)}` : JSON.stringify(r2).slice(0, 100),
    });
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
