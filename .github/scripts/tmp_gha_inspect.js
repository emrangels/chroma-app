const { chromium } = require('playwright');

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
    if (type === 'xhr' || type === 'fetch') {
      let bodySnippet = null;
      try {
        const ct = response.headers()['content-type'] || '';
        if (ct.includes('json') || ct.includes('text')) {
          const text = await response.text();
          bodySnippet = text.slice(0, 4000);
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
        responseHeaders: response.headers(),
        bodySnippet,
      });
    }
  });

  page.on('requestfailed', (req) => {
    console.log('[requestfailed]', req.url(), req.failure()?.errorText);
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

  await page.waitForTimeout(6000);

  console.log('=== PAGE TITLE ===');
  console.log(await page.title());

  console.log('=== BODY TEXT SNIPPET ===');
  console.log(await page.evaluate(() => document.body.innerText.slice(0, 3000)));

  console.log('=== API CALLS (xhr/fetch) ===');
  console.log(`Captured ${apiCalls.length} calls`);
  for (const call of apiCalls) {
    console.log('----- CALL -----');
    console.log(JSON.stringify(call, null, 2));
  }

  await page.screenshot({ path: 'screenshot.png', fullPage: true });
  require('fs').writeFileSync('api_calls.json', JSON.stringify(apiCalls, null, 2));

  await browser.close();
  console.log('=== DONE ===');
})();
