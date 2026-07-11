// Server-rendered SEO landing pages for popular product searches.
// Runs on Vercel as a serverless function on each request — pulls real,
// current price data from the Twisti backend and renders full HTML, so
// Google (and anyone with JS off) sees actual content immediately.

const API = 'https://twisti-backend-production.up.railway.app';

const SLUG_MAP = {
  'airpods-pro-2':   { query: 'Apple AirPods Pro 2',   title: 'Apple AirPods Pro 2' },
  'sony-wh1000xm5':  { query: 'Sony WH-1000XM5',        title: 'Sony WH-1000XM5 Headphones' },
  'dyson-v15':       { query: 'Dyson V15 vacuum',       title: 'Dyson V15 Vacuum' },
  'samsung-65-tv':   { query: 'Samsung 65 inch TV',     title: 'Samsung 65" TV' },
  'macbook-air-m3':  { query: 'MacBook Air M3',         title: 'MacBook Air M3' },
  'iphone-16-pro':   { query: 'iPhone 16 Pro',          title: 'iPhone 16 Pro' },
  'ps5-slim':        { query: 'PlayStation 5 Slim',     title: 'PlayStation 5 Slim' },
  'iphone-15':       { query: 'Apple iPhone 15',        title: 'Apple iPhone 15' },
  'xbox-series-s':   { query: 'Xbox Series S',          title: 'Xbox Series S' },
  'ipad-10th-gen':   { query: 'iPad 10th Gen',          title: 'iPad 10th Gen' },
  'switch-oled':     { query: 'Nintendo Switch OLED',   title: 'Nintendo Switch OLED' },
  'apple-watch-se':  { query: 'Apple Watch SE',         title: 'Apple Watch SE' },
  'galaxy-s24':      { query: 'Samsung Galaxy S24',     title: 'Samsung Galaxy S24' },
  'lg-oled-c4':      { query: 'LG OLED C4',             title: 'LG OLED C4 TV' },
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderPriceRows(prices) {
  return prices.slice(0, 10).map((p, i) => `
    <div class="row${i === 0 ? ' best' : ''}">
      <div>
        <div class="store">${esc(p.store_name)}</div>
        ${i === 0 ? '<span class="tag">Cheapest</span>' : ''}
      </div>
      <div class="price-col">
        <div class="price">$${Number(p.price).toFixed(2)} NZD</div>
        <a href="${esc(p.affiliate_url)}" rel="nofollow sponsored" target="_blank">Visit store &rarr;</a>
      </div>
    </div>`).join('');
}

function renderVariantRows(variants) {
  return variants.slice(0, 8).map((v, i) => `
    <div class="row${i === 0 ? ' best' : ''}">
      <div>
        <div class="store">${esc(v.name)}</div>
        <span class="tag muted">${esc(v.source || '')}</span>
      </div>
      <div class="price-col">
        <div class="price">$${Number(v.lowest_price).toFixed(2)} NZD</div>
      </div>
    </div>`).join('');
}

module.exports = async (req, res) => {
  const slugParam = req.query.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  const entry = SLUG_MAP[slug];

  if (!entry) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!DOCTYPE html><html><body><h1>Page not found</h1><a href="/">Back to Twisti</a></body></html>');
    return;
  }

  let data = null;
  try {
    const r = await fetch(`${API}/api/search?q=${encodeURIComponent(entry.query)}&country=NZ`);
    data = await r.json();
  } catch (e) {
    data = null;
  }

  const result = data && Array.isArray(data.results) ? data.results[0] : null;
  const isDetailed = result && Array.isArray(result.prices) && result.prices.length > 0;
  const isVariants = !isDetailed && data && Array.isArray(data.results) && data.results.length > 0 && data.results[0].lowest_price != null;

  let cheapestPrice = null;
  let cheapestStore = null;
  let bodyHtml = '';

  if (isDetailed) {
    cheapestPrice = result.prices[0].price;
    cheapestStore = result.prices[0].store_name;
    bodyHtml = renderPriceRows(result.prices);
  } else if (isVariants) {
    const sorted = [...data.results].sort((a, b) => a.lowest_price - b.lowest_price);
    cheapestPrice = sorted[0].lowest_price;
    cheapestStore = sorted[0].source;
    bodyHtml = renderVariantRows(sorted);
  }

  const title = cheapestPrice
    ? `${entry.title} — Cheapest NZ Price $${Number(cheapestPrice).toFixed(0)} | Twisti`
    : `${entry.title} — Compare NZ Prices | Twisti`;

  const description = cheapestPrice
    ? `Compare ${entry.title} prices across JB Hi-Fi, Noel Leeming and PB Tech. Cheapest right now: $${Number(cheapestPrice).toFixed(2)} at ${cheapestStore}.`
    : `Compare ${entry.title} prices across JB Hi-Fi, Noel Leeming and PB Tech with Twisti, NZ's AI-powered price comparison site.`;

  const canonical = `https://twisti.org/deals/${slug}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${canonical}" />
<meta name="twitter:card" content="summary" />
<script type="application/ld+json">
${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Product",
  "name": entry.title,
  ...(cheapestPrice ? {
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "NZD",
      "lowPrice": cheapestPrice,
      "offerCount": isDetailed ? result.prices.length : data.results.length
    }
  } : {})
})}
</script>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Inter, system-ui, sans-serif; max-width: 680px; margin: 0 auto; padding: 32px 20px 60px; color: #16281f; background:#fbfbf9; }
  a { color: #1a6b4a; }
  .back { font-size: 14px; text-decoration: none; }
  h1 { font-size: 26px; margin: 20px 0 8px; }
  .sub { color: #52604f; margin-bottom: 24px; }
  .row { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border: 1px solid #e2e2e0; border-radius: 10px; margin-bottom: 8px; background:#fff; }
  .row.best { border-color: #1a6b4a; background: #f0faf5; }
  .store { font-weight: 600; }
  .tag { font-size: 11px; font-weight: 700; color: #1a6b4a; text-transform: uppercase; }
  .tag.muted { color: #8a948a; text-transform: none; font-weight: 500; }
  .price-col { text-align: right; }
  .price { font-size: 19px; font-weight: 700; }
  .row.best .price { color: #1a6b4a; }
  .row a { font-size: 12px; }
  .cta { display: inline-block; margin-top: 28px; background: #1a6b4a; color: #fff; padding: 13px 26px; border-radius: 8px; text-decoration: none; font-weight: 700; }
  .empty { padding: 20px; border: 1px dashed #cfd3cd; border-radius: 10px; color: #52604f; }
</style>
</head>
<body>
  <a class="back" href="/">&larr; Twisti — NZ price comparison</a>
  <h1>${esc(entry.title)} — Cheapest NZ Price</h1>
  <p class="sub">${cheapestPrice
    ? `Cheapest right now: <strong>$${Number(cheapestPrice).toFixed(2)} NZD</strong> at <strong>${esc(cheapestStore)}</strong>. Prices update automatically.`
    : `Live pricing is temporarily unavailable for this search — try the full comparison tool below.`}</p>
  ${bodyHtml || '<div class="empty">No live prices to show right now.</div>'}
  <a class="cta" href="/?q=${encodeURIComponent(entry.query)}">See full comparison + AI buy/wait verdict &rarr;</a>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.statusCode = 200;
  res.end(html);
};
