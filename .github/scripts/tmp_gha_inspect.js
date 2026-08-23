const { chromium } = require('playwright');

function stripLargeFields(obj) {
  if (Array.isArray(obj)) return obj.map(stripLargeFields);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.toLowerCase().includes('photo')) {
        out[k] = typeof v === 'string' ? `<omitted base64, len=${v.length}>` : v;
      } else {
        out[k] = stripLargeFields(v);
      }
    }
    return out;
  }
  return obj;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  const apiCalls = [];

  page.on('response', async (response) => {
    const req = response.request();
    const url = response.url();
    const type = req.resourceType();
    if ((type === 'xhr' || type === 'fetch') && url.includes('easyvisit.com.au')) {
      let bodySnippet = null;
      try {
        const ct = response.headers()['content-type'] || '';
        if (ct.includes('json')) {
          const json = await response.json();
          bodySnippet = JSON.stringify(stripLargeFields(json)).slice(0, 6000);
        } else if (ct.includes('text')) {
          bodySnippet = (await response.text()).slice(0, 2000);
        }
      } catch (e) {
        bodySnippet = `<error reading body: ${e.message}>`;
      }
      apiCalls.push({
        url,
        method: req.method(),
        status: response.status(),
        requestHeaders: req.headers(),
        postData: req.postData(),
        bodySnippet,
      });
    }
  });

  try {
    console.log('=== NAVIGATING ===');
    await page.goto('https://web.easyvisit.com.au/booking/103/760', {
      waitUntil: 'networkidle',
      timeout: 45000,
    });
  } catch (e) {
    console.log('goto error:', e.message);
  }

  await page.waitForTimeout(3000);

  console.log('=== CLICKING "View Availability" for first doctor ===');
  try {
    const btn = page.getByText('View Availability').first();
    await btn.click({ timeout: 10000 });
    console.log('clicked ok');
  } catch (e) {
    console.log('click error:', e.message);
  }

  await page.waitForTimeout(6000);

  console.log('=== URL AFTER CLICK ===');
  console.log(page.url());

  console.log('=== BODY TEXT SNIPPET AFTER CLICK ===');
  console.log(await page.evaluate(() => document.body.innerText.slice(0, 3000)));

  // Try clicking a day/date in a calendar if present, to trigger slot-time fetch
  try {
    const dayCandidates = await page.locator('[class*="day" i], button, td').all();
    console.log(`found ${dayCandidates.length} possible day/button elements (not clicking all)`);
  } catch (e) {}

  console.log('=== API CALLS (easyvisit.com.au xhr/fetch) ===');
  console.log(`Captured ${apiCalls.length} calls`);
  for (const call of apiCalls) {
    console.log('----- CALL -----');
    console.log(JSON.stringify({ url: call.url, method: call.method, status: call.status, postData: call.postData }, null, 2));
    console.log('BODY:', call.bodySnippet);
  }

  await page.screenshot({ path: 'screenshot2.png', fullPage: true });

  await browser.close();
  console.log('=== DONE ===');
})();
