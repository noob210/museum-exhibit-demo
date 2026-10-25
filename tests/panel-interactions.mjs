/**
 * Panel Interaction Tests
 * 
 * Tests for:
 * - Bug 5: Panel link should work on first click
 * - Bug 6: Panel should be sticky (not reset on mouse leave)
 * - Keyboard focus should not switch panel when tabbing through hotspots
 * - Correct hotspot URL opens in all interaction modes
 * 
 * Usage: node tests/panel-interactions.mjs
 */

import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const BASE_PATH = '/museum-exhibit-demo';

// Hotspot data for verification (must match data/hotspots.js)
const HOTSPOT_INFO = {
  front: {
    first: { id: 'corbett-face', urlContains: 'wikipedia.org/wiki/James_J._Corbett' },
    middle: { id: 'boxing-stance', urlContains: 'britannica.com/sports/boxing' },
    last: { id: 'cabinet-mount', urlContains: 'wikipedia.org/wiki/Cabinet_card' }
  },
  reverse: {
    first: { id: 'chickering-studio', urlContains: 'loc.gov/pictures' },
    middle: { id: 'olympic-club', urlContains: 'wikipedia.org/wiki/Olympic_Club' },
    last: { id: 'copyright-notice', urlContains: 'wikipedia.org/wiki/Burrow-Giles' }
  }
};

function createServer() {
  return new Promise((resolve) => {
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.woff2': 'font/woff2',
      '.jpg': 'image/jpeg',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.txt': 'text/plain'
    };

    const server = http.createServer((req, res) => {
      let urlPath = req.url.split('?')[0];
      
      if (urlPath.startsWith(BASE_PATH)) {
        urlPath = urlPath.slice(BASE_PATH.length) || '/';
      }
      
      let filePath = path.join(ROOT_DIR, urlPath === '/' ? 'index.html' : urlPath);
      
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      
      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

async function setupPage(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  
  // Block all external network requests at context level (affects all pages including popups)
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(baseUrl.replace(/\/$/, '')) || url.startsWith('http://127.0.0.1')) {
      route.continue();
    } else {
      route.abort();
    }
  });
  
  const page = await context.newPage();
  
  // Track popup intent URLs (captured before blocking)
  let lastPopupUrl = null;
  let popupOpened = false;
  page.on('popup', async (popup) => {
    // Capture the URL the popup was trying to load (before blocking)
    lastPopupUrl = popup.url();
    popupOpened = true;
    await popup.close().catch(() => {});
  });
  
  return { context, page, getLastPopupUrl: () => lastPopupUrl, wasPopupOpened: () => popupOpened };
}

async function flipToSide(page, side) {
  if (side === 'reverse') {
    await page.click('#flip-button');
    await page.waitForTimeout(1000);
  }
}

async function getHotspotElement(page, hotspotId) {
  return page.$(`[data-hotspot-id="${hotspotId}"]`);
}

async function clickHotspot(page, hotspotId) {
  const hotspot = await page.$(`[data-hotspot-id="${hotspotId}"]`);
  if (!hotspot) return false;
  const box = await hotspot.boundingBox();
  if (!box) return false;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  return true;
}

async function tabToHotspot(page, hotspotId, maxTabs = 30) {
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(50);
    
    const focusedId = await page.evaluate(() => 
      document.activeElement?.getAttribute('data-hotspot-id')
    );
    
    if (focusedId === hotspotId) {
      return true;
    }
  }
  return false;
}

async function getPanelLinkUrl(page) {
  return page.evaluate(() => {
    const link = document.querySelector('.hotspot-link');
    return link ? link.href : null;
  });
}

async function getPanelHotspotId(page) {
  return page.evaluate(() => {
    const detail = document.querySelector('.hotspot-detail');
    return detail ? detail.getAttribute('data-hotspot-id') : null;
  });
}

async function runTests() {
  console.log('Panel Interaction Tests');
  console.log('='.repeat(70));
  
  const { server, port } = await createServer();
  const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}/`;
  console.log(`Server running at ${baseUrl}\n`);
  
  const browser = await chromium.launch({ headless: true });
  const results = [];
  
  // Test both sides
  for (const side of ['front', 'reverse']) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`Testing ${side} side`);
    console.log('─'.repeat(70));
    
    const hotspotData = HOTSPOT_INFO[side];
    
    // =========================================================================
    // Test 1: Mouse click on first, middle, last hotspot - verify correct URL
    // =========================================================================
    for (const position of ['first', 'middle', 'last']) {
      const testName = `Mouse click ${side}/${position}: correct URL opens`;
      const { id: hotspotId, urlContains } = hotspotData[position];
      
      const { context, page, wasPopupOpened } = await setupPage(browser, baseUrl);
      
      try {
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await flipToSide(page, side);
        
        // Click the hotspot to pin it
        const clicked = await clickHotspot(page, hotspotId);
        if (!clicked) {
          results.push({ test: testName, status: 'FAIL', reason: `Hotspot ${hotspotId} not found` });
          console.log(`  ${testName}: ✗ FAIL (hotspot not found)`);
          await context.close();
          continue;
        }
        await page.waitForTimeout(200);
        
        // Verify panel shows correct hotspot (check link href)
        const panelUrl = await getPanelLinkUrl(page);
        if (!panelUrl) {
          results.push({ test: testName, status: 'FAIL', reason: 'Panel link not found' });
          console.log(`  ${testName}: ✗ FAIL (no panel link)`);
          await context.close();
          continue;
        }
        
        if (!panelUrl.includes(urlContains)) {
          results.push({ test: testName, status: 'FAIL', reason: `Wrong link URL: ${panelUrl}` });
          console.log(`  ${testName}: ✗ FAIL (wrong URL)`);
          await context.close();
          continue;
        }
        
        // Click the panel link to verify it opens (popup will be blocked but should trigger)
        const panelLink = await page.$('.hotspot-link');
        await panelLink.click();
        await page.waitForTimeout(300);
        
        const popupOpened = wasPopupOpened();
        if (!popupOpened) {
          results.push({ test: testName, status: 'FAIL', reason: 'Link click did not trigger popup' });
          console.log(`  ${testName}: ✗ FAIL (no popup)`);
        } else {
          results.push({ test: testName, status: 'PASS' });
          console.log(`  ${testName}: ✓ PASS`);
        }
      } finally {
        await context.close();
      }
    }
    
    // =========================================================================
    // Test 2: Keyboard - Tab to hotspot, Enter, Tab to link, Enter - verify URL
    // =========================================================================
    for (const position of ['first', 'middle', 'last']) {
      const testName = `Keyboard ${side}/${position}: correct URL opens`;
      const { id: hotspotId, urlContains } = hotspotData[position];
      
      const { context, page, wasPopupOpened } = await setupPage(browser, baseUrl);
      
      try {
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await flipToSide(page, side);
        
        // Tab to the specific hotspot
        const foundHotspot = await tabToHotspot(page, hotspotId);
        if (!foundHotspot) {
          results.push({ test: testName, status: 'FAIL', reason: `Could not Tab to ${hotspotId}` });
          console.log(`  ${testName}: ✗ FAIL (could not tab to hotspot)`);
          await context.close();
          continue;
        }
        
        // Press Enter to pin and move focus to link
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        
        // Verify focus moved to link, try a few times if needed
        let focusOnLink = await page.evaluate(() => 
          document.activeElement?.classList.contains('hotspot-link')
        );
        
        if (!focusOnLink) {
          // Try Tab to get to link
          for (let attempt = 0; attempt < 3 && !focusOnLink; attempt++) {
            await page.keyboard.press('Tab');
            await page.waitForTimeout(100);
            focusOnLink = await page.evaluate(() => 
              document.activeElement?.classList.contains('hotspot-link')
            );
          }
        }
        
        // Verify panel shows correct hotspot before pressing Enter
        const panelUrl = await getPanelLinkUrl(page);
        if (!panelUrl || !panelUrl.includes(urlContains)) {
          results.push({ test: testName, status: 'FAIL', reason: `Panel shows wrong hotspot: ${panelUrl}` });
          console.log(`  ${testName}: ✗ FAIL (panel shows wrong hotspot)`);
          await context.close();
          continue;
        }
        
        if (!focusOnLink) {
          results.push({ test: testName, status: 'FAIL', reason: 'Could not focus panel link' });
          console.log(`  ${testName}: ✗ FAIL (could not focus link)`);
          await context.close();
          continue;
        }
        
        // Press Enter to activate link
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        
        if (!wasPopupOpened()) {
          results.push({ test: testName, status: 'FAIL', reason: 'Link did not trigger popup' });
          console.log(`  ${testName}: ✗ FAIL (no popup)`);
        } else {
          results.push({ test: testName, status: 'PASS' });
          console.log(`  ${testName}: ✓ PASS`);
        }
      } finally {
        await context.close();
      }
    }
    
    // =========================================================================
    // Test 3: Mouse pin A, sweep across B to panel, click link - A's URL opens
    // =========================================================================
    {
      const testName = `Mouse sweep ${side}: pinned hotspot survives sweep`;
      const { id: hotspotA, urlContains: urlA } = hotspotData.first;
      const { id: hotspotB } = hotspotData.middle;
      
      const { context, page, wasPopupOpened } = await setupPage(browser, baseUrl);
      
      try {
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await flipToSide(page, side);
        
        // Click hotspot A to pin it
        const elA = await getHotspotElement(page, hotspotA);
        const boxA = await elA.boundingBox();
        await page.mouse.click(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2);
        await page.waitForTimeout(200);
        
        // Get hotspot B position
        const elB = await getHotspotElement(page, hotspotB);
        const boxB = await elB.boundingBox();
        
        // Get panel link position
        const panelLink = await page.$('.hotspot-link');
        const linkBox = await panelLink.boundingBox();
        
        // Sweep mouse: from A through B to the panel link
        await page.mouse.move(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2);
        await page.waitForTimeout(50);
        await page.mouse.move(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2);
        await page.waitForTimeout(50); // Quick sweep, less than hover-intent delay
        await page.mouse.move(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2);
        await page.waitForTimeout(100);
        
        // Verify panel still shows hotspot A (not B) by checking link href
        const panelUrl = await getPanelLinkUrl(page);
        if (!panelUrl || !panelUrl.includes(urlA)) {
          results.push({ test: testName, status: 'FAIL', reason: `Panel switched to wrong hotspot: ${panelUrl}` });
          console.log(`  ${testName}: ✗ FAIL (panel switched)`);
          await context.close();
          continue;
        }
        
        // Click the link
        await page.mouse.click(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2);
        await page.waitForTimeout(300);
        
        if (!wasPopupOpened()) {
          results.push({ test: testName, status: 'FAIL', reason: 'Link did not trigger popup' });
          console.log(`  ${testName}: ✗ FAIL (no popup)`);
        } else {
          results.push({ test: testName, status: 'PASS' });
          console.log(`  ${testName}: ✓ PASS`);
        }
      } finally {
        await context.close();
      }
    }
    
    // =========================================================================
    // Test 4: Hover sticky behavior (no pin, just hover)
    // =========================================================================
    {
      const testName = `Hover sticky ${side}: panel persists after leave`;
      const { id: hotspotId, urlContains } = hotspotData.first;
      
      const { context, page, wasPopupOpened } = await setupPage(browser, baseUrl);
      
      try {
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await flipToSide(page, side);
        
        // Hover over hotspot (without clicking)
        const hotspot = await getHotspotElement(page, hotspotId);
        const hotspotBox = await hotspot.boundingBox();
        
        await page.mouse.move(hotspotBox.x + hotspotBox.width / 2, hotspotBox.y + hotspotBox.height / 2);
        await page.waitForTimeout(200); // Wait for hover-intent delay
        
        // Move mouse to blank area
        await page.mouse.move(50, 50);
        await page.waitForTimeout(200);
        
        // Panel should still show the hotspot (sticky) - check link href
        const panelUrl = await getPanelLinkUrl(page);
        if (!panelUrl || !panelUrl.includes(urlContains)) {
          results.push({ test: testName, status: 'FAIL', reason: 'Panel did not persist' });
          console.log(`  ${testName}: ✗ FAIL (panel reset)`);
          await context.close();
          continue;
        }
        
        // Move to panel and click link
        const panelLink = await page.$('.hotspot-link');
        const linkBox = await panelLink.boundingBox();
        await page.mouse.move(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2);
        await page.waitForTimeout(100);
        await page.mouse.click(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2);
        await page.waitForTimeout(300);
        
        if (!wasPopupOpened()) {
          results.push({ test: testName, status: 'FAIL', reason: 'Link did not trigger popup' });
          console.log(`  ${testName}: ✗ FAIL (no popup)`);
        } else {
          results.push({ test: testName, status: 'PASS' });
          console.log(`  ${testName}: ✓ PASS`);
        }
      } finally {
        await context.close();
      }
    }
    
    // =========================================================================
    // Test 5: Keyboard Tab through multiple hotspots - pinned one stays
    // =========================================================================
    {
      const testName = `Keyboard tab-through ${side}: pinned survives tabbing`;
      const { id: hotspotA, urlContains: urlA } = hotspotData.first;
      
      const { context, page, wasPopupOpened } = await setupPage(browser, baseUrl);
      
      try {
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await flipToSide(page, side);
        
        // Tab to first hotspot and pin it
        const foundHotspot = await tabToHotspot(page, hotspotA);
        if (!foundHotspot) {
          results.push({ test: testName, status: 'FAIL', reason: `Could not Tab to ${hotspotA}` });
          console.log(`  ${testName}: ✗ FAIL (could not tab to first hotspot)`);
          await context.close();
          continue;
        }
        
        // Press Enter to pin
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
        
        // Focus should be on link now; Tab through more elements (will pass through other hotspots)
        // We need to go backwards to re-enter the hotspot area
        await page.keyboard.press('Escape'); // Return to hotspot
        await page.waitForTimeout(100);
        
        // Now Tab forward through remaining hotspots
        for (let i = 0; i < 5; i++) {
          await page.keyboard.press('Tab');
          await page.waitForTimeout(50);
        }
        
        // Panel should still show hotspot A (pinned) - check link href
        const panelUrl = await getPanelLinkUrl(page);
        if (!panelUrl || !panelUrl.includes(urlA)) {
          results.push({ test: testName, status: 'FAIL', reason: `Panel switched: ${panelUrl}` });
          console.log(`  ${testName}: ✗ FAIL (panel switched while tabbing)`);
          await context.close();
          continue;
        }
        
        // Tab back to the link and press Enter
        let foundLink = false;
        for (let i = 0; i < 20; i++) {
          await page.keyboard.press('Tab');
          await page.waitForTimeout(50);
          const isOnLink = await page.evaluate(() => 
            document.activeElement?.classList.contains('hotspot-link')
          );
          if (isOnLink) {
            foundLink = true;
            break;
          }
        }
        
        if (!foundLink) {
          // Try Shift+Tab
          for (let i = 0; i < 20; i++) {
            await page.keyboard.press('Shift+Tab');
            await page.waitForTimeout(50);
            const isOnLink = await page.evaluate(() => 
              document.activeElement?.classList.contains('hotspot-link')
            );
            if (isOnLink) {
              foundLink = true;
              break;
            }
          }
        }
        
        if (!foundLink) {
          results.push({ test: testName, status: 'FAIL', reason: 'Could not find panel link' });
          console.log(`  ${testName}: ✗ FAIL (could not find link)`);
          await context.close();
          continue;
        }
        
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        
        if (!wasPopupOpened()) {
          results.push({ test: testName, status: 'FAIL', reason: 'Link did not trigger popup' });
          console.log(`  ${testName}: ✗ FAIL (no popup)`);
        } else {
          results.push({ test: testName, status: 'PASS' });
          console.log(`  ${testName}: ✓ PASS`);
        }
      } finally {
        await context.close();
      }
    }
    
    // =========================================================================
    // Test 6: Pin A, hover B for 300ms - panel previews B, on leave shows A
    // =========================================================================
    {
      const testName = `Hover preview ${side}: pinned A, hover B previews, leave reverts`;
      const { id: hotspotA, urlContains: urlA } = hotspotData.first;
      const { id: hotspotB, urlContains: urlB } = hotspotData.middle;
      
      const { context, page } = await setupPage(browser, baseUrl);
      
      try {
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await flipToSide(page, side);
        
        // Click hotspot A to pin it
        await clickHotspot(page, hotspotA);
        await page.waitForTimeout(200);
        
        // Verify panel shows A
        let panelUrl = await getPanelLinkUrl(page);
        if (!panelUrl || !panelUrl.includes(urlA)) {
          results.push({ test: testName, status: 'FAIL', reason: 'Panel did not show A after pin' });
          console.log(`  ${testName}: ✗ FAIL (A not shown)`);
          await context.close();
          continue;
        }
        
        // Hover over hotspot B for 300ms (longer than hover-intent delay)
        const elB = await getHotspotElement(page, hotspotB);
        const boxB = await elB.boundingBox();
        await page.mouse.move(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2);
        await page.waitForTimeout(300);
        
        // Panel should now preview B
        panelUrl = await getPanelLinkUrl(page);
        if (!panelUrl || !panelUrl.includes(urlB)) {
          results.push({ test: testName, status: 'FAIL', reason: `Panel did not preview B: ${panelUrl}` });
          console.log(`  ${testName}: ✗ FAIL (B not previewed)`);
          await context.close();
          continue;
        }
        
        // Move mouse away to blank area
        await page.mouse.move(50, 50);
        await page.waitForTimeout(200);
        
        // Panel should revert to A
        panelUrl = await getPanelLinkUrl(page);
        if (!panelUrl || !panelUrl.includes(urlA)) {
          results.push({ test: testName, status: 'FAIL', reason: `Panel did not revert to A: ${panelUrl}` });
          console.log(`  ${testName}: ✗ FAIL (did not revert to A)`);
        } else {
          results.push({ test: testName, status: 'PASS' });
          console.log(`  ${testName}: ✓ PASS`);
        }
      } finally {
        await context.close();
      }
    }
    
    // =========================================================================
    // Test 7: Unpin via blank card area click
    // =========================================================================
    {
      const testName = `Unpin ${side}: click blank area unpins`;
      const { id: hotspotA } = hotspotData.first;
      
      const { context, page } = await setupPage(browser, baseUrl);
      
      try {
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await flipToSide(page, side);
        
        // Click hotspot A to pin it
        await clickHotspot(page, hotspotA);
        await page.waitForTimeout(200);
        
        // Verify pinned style is present
        const hasPinnedBefore = await page.evaluate((id) => {
          const el = document.querySelector(`[data-hotspot-id="${id}"]`);
          return el?.classList.contains('pinned');
        }, hotspotA);
        
        if (!hasPinnedBefore) {
          results.push({ test: testName, status: 'FAIL', reason: 'Pinned style not applied after pin' });
          console.log(`  ${testName}: ✗ FAIL (no pinned style)`);
          await context.close();
          continue;
        }
        
        // Click on blank card area (coordinates away from hotspots)
        const cardSelector = side === 'front' ? '.card-front' : '.card-back';
        const card = await page.$(cardSelector);
        const cardBox = await card.boundingBox();
        // Click near bottom corner of card (away from hotspots)
        await page.mouse.click(cardBox.x + 50, cardBox.y + cardBox.height - 50);
        await page.waitForTimeout(200);
        
        // Verify pinned style is removed
        const hasPinnedAfter = await page.evaluate((id) => {
          const el = document.querySelector(`[data-hotspot-id="${id}"]`);
          return el?.classList.contains('pinned');
        }, hotspotA);
        
        if (hasPinnedAfter) {
          results.push({ test: testName, status: 'FAIL', reason: 'Pinned style still present after blank click' });
          console.log(`  ${testName}: ✗ FAIL (still pinned)`);
        } else {
          results.push({ test: testName, status: 'PASS' });
          console.log(`  ${testName}: ✓ PASS`);
        }
      } finally {
        await context.close();
      }
    }
    
    // =========================================================================
    // Test 8: Unpin via × button
    // =========================================================================
    {
      const testName = `Unpin ${side}: click × button unpins`;
      const { id: hotspotA } = hotspotData.first;
      
      const { context, page } = await setupPage(browser, baseUrl);
      
      try {
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await flipToSide(page, side);
        
        // Click hotspot A to pin it
        await clickHotspot(page, hotspotA);
        await page.waitForTimeout(200);
        
        // Verify pinned indicator and × button exist
        const unpinBtn = await page.$('.unpin-button');
        if (!unpinBtn) {
          results.push({ test: testName, status: 'FAIL', reason: 'Unpin button not found' });
          console.log(`  ${testName}: ✗ FAIL (no unpin button)`);
          await context.close();
          continue;
        }
        
        // Verify pinned style is present
        const hasPinnedBefore = await page.evaluate((id) => {
          const el = document.querySelector(`[data-hotspot-id="${id}"]`);
          return el?.classList.contains('pinned');
        }, hotspotA);
        
        if (!hasPinnedBefore) {
          results.push({ test: testName, status: 'FAIL', reason: 'Pinned style not applied' });
          console.log(`  ${testName}: ✗ FAIL (no pinned style)`);
          await context.close();
          continue;
        }
        
        // Click the × button
        await unpinBtn.click();
        await page.waitForTimeout(200);
        
        // Verify pinned style is removed
        const hasPinnedAfter = await page.evaluate((id) => {
          const el = document.querySelector(`[data-hotspot-id="${id}"]`);
          return el?.classList.contains('pinned');
        }, hotspotA);
        
        // Verify × button is gone (no longer pinned)
        const unpinBtnAfter = await page.$('.unpin-button');
        
        if (hasPinnedAfter || unpinBtnAfter) {
          results.push({ test: testName, status: 'FAIL', reason: 'Still pinned after × click' });
          console.log(`  ${testName}: ✗ FAIL (still pinned)`);
        } else {
          results.push({ test: testName, status: 'PASS' });
          console.log(`  ${testName}: ✓ PASS`);
        }
      } finally {
        await context.close();
      }
    }
    
    // =========================================================================
    // Test 9: Pinned style presence check
    // =========================================================================
    {
      const testName = `Pinned style ${side}: present when pinned, absent when not`;
      const { id: hotspotA } = hotspotData.first;
      
      const { context, page } = await setupPage(browser, baseUrl);
      
      try {
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await flipToSide(page, side);
        
        // Initially, no pinned style
        const hasPinnedInitial = await page.evaluate((id) => {
          const el = document.querySelector(`[data-hotspot-id="${id}"]`);
          return el?.classList.contains('pinned');
        }, hotspotA);
        
        if (hasPinnedInitial) {
          results.push({ test: testName, status: 'FAIL', reason: 'Pinned style present initially' });
          console.log(`  ${testName}: ✗ FAIL (pinned initially)`);
          await context.close();
          continue;
        }
        
        // Pin hotspot
        await clickHotspot(page, hotspotA);
        await page.waitForTimeout(200);
        
        // Should have pinned style
        const hasPinnedAfterPin = await page.evaluate((id) => {
          const el = document.querySelector(`[data-hotspot-id="${id}"]`);
          return el?.classList.contains('pinned');
        }, hotspotA);
        
        if (!hasPinnedAfterPin) {
          results.push({ test: testName, status: 'FAIL', reason: 'Pinned style not present after pin' });
          console.log(`  ${testName}: ✗ FAIL (no pinned style)`);
          await context.close();
          continue;
        }
        
        // Click again to unpin
        await clickHotspot(page, hotspotA);
        await page.waitForTimeout(200);
        
        // Should not have pinned style
        const hasPinnedAfterUnpin = await page.evaluate((id) => {
          const el = document.querySelector(`[data-hotspot-id="${id}"]`);
          return el?.classList.contains('pinned');
        }, hotspotA);
        
        if (hasPinnedAfterUnpin) {
          results.push({ test: testName, status: 'FAIL', reason: 'Pinned style still present after unpin' });
          console.log(`  ${testName}: ✗ FAIL (still pinned)`);
        } else {
          results.push({ test: testName, status: 'PASS' });
          console.log(`  ${testName}: ✓ PASS`);
        }
      } finally {
        await context.close();
      }
    }
    
    // =========================================================================
    // Test 10: Focus after × unpin - must not be on body
    // =========================================================================
    {
      const testName = `Focus after × unpin ${side}: not on body`;
      const { id: hotspotA } = hotspotData.first;
      
      const { context, page } = await setupPage(browser, baseUrl);
      
      try {
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await flipToSide(page, side);
        
        // Click hotspot A to pin it
        await clickHotspot(page, hotspotA);
        await page.waitForTimeout(200);
        
        // Click the × button
        const unpinBtn = await page.$('.unpin-button');
        if (!unpinBtn) {
          results.push({ test: testName, status: 'FAIL', reason: 'Unpin button not found' });
          console.log(`  ${testName}: ✗ FAIL (no unpin button)`);
          await context.close();
          continue;
        }
        
        await unpinBtn.click();
        await page.waitForTimeout(200);
        
        // Check focus is not on body
        const focusedTag = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase());
        if (focusedTag === 'body') {
          results.push({ test: testName, status: 'FAIL', reason: 'Focus is on body after unpin' });
          console.log(`  ${testName}: ✗ FAIL (focus on body)`);
        } else {
          results.push({ test: testName, status: 'PASS' });
          console.log(`  ${testName}: ✓ PASS (focus on ${focusedTag})`);
        }
      } finally {
        await context.close();
      }
    }
    
    // =========================================================================
    // Test 11: × button size at least 32px
    // =========================================================================
    {
      const testName = `× button size ${side}: at least 32px`;
      const { id: hotspotA } = hotspotData.first;
      
      const { context, page } = await setupPage(browser, baseUrl);
      
      try {
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await flipToSide(page, side);
        
        // Click hotspot A to pin it
        await clickHotspot(page, hotspotA);
        await page.waitForTimeout(200);
        
        // Get × button size
        const buttonSize = await page.evaluate(() => {
          const btn = document.querySelector('.unpin-button');
          if (!btn) return null;
          const rect = btn.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        });
        
        if (!buttonSize) {
          results.push({ test: testName, status: 'FAIL', reason: 'Unpin button not found' });
          console.log(`  ${testName}: ✗ FAIL (no button)`);
        } else if (buttonSize.width < 32 || buttonSize.height < 32) {
          results.push({ test: testName, status: 'FAIL', reason: `Button too small: ${buttonSize.width}x${buttonSize.height}px` });
          console.log(`  ${testName}: ✗ FAIL (${buttonSize.width}x${buttonSize.height}px)`);
        } else {
          results.push({ test: testName, status: 'PASS' });
          console.log(`  ${testName}: ✓ PASS (${buttonSize.width}x${buttonSize.height}px)`);
        }
      } finally {
        await context.close();
      }
    }
    
    // =========================================================================
    // Test 12: Badge contrast at least 4.5:1
    // =========================================================================
    {
      const testName = `Badge contrast ${side}: at least 4.5:1`;
      const { id: hotspotA } = hotspotData.first;
      
      const { context, page } = await setupPage(browser, baseUrl);
      
      try {
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await flipToSide(page, side);
        
        // Click hotspot A to pin it
        await clickHotspot(page, hotspotA);
        await page.waitForTimeout(200);
        
        // Get computed colors and calculate contrast
        const contrastRatio = await page.evaluate(() => {
          const badge = document.querySelector('.pinned-indicator');
          if (!badge) return null;
          
          const style = getComputedStyle(badge);
          const bgColor = style.backgroundColor;
          const textColor = style.color;
          
          // Parse RGB values
          function parseRgb(color) {
            const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (!match) return null;
            return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
          }
          
          // Calculate relative luminance
          function luminance(rgb) {
            const sRGB = [rgb.r, rgb.g, rgb.b].map(v => {
              v /= 255;
              return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
            });
            return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
          }
          
          // Calculate contrast ratio
          function contrast(rgb1, rgb2) {
            const l1 = luminance(rgb1);
            const l2 = luminance(rgb2);
            const lighter = Math.max(l1, l2);
            const darker = Math.min(l1, l2);
            return (lighter + 0.05) / (darker + 0.05);
          }
          
          const bg = parseRgb(bgColor);
          const text = parseRgb(textColor);
          if (!bg || !text) return null;
          
          return contrast(bg, text);
        });
        
        if (contrastRatio === null) {
          results.push({ test: testName, status: 'FAIL', reason: 'Could not compute contrast' });
          console.log(`  ${testName}: ✗ FAIL (no contrast data)`);
        } else if (contrastRatio < 4.5) {
          results.push({ test: testName, status: 'FAIL', reason: `Contrast ${contrastRatio.toFixed(2)}:1 < 4.5:1` });
          console.log(`  ${testName}: ✗ FAIL (${contrastRatio.toFixed(2)}:1)`);
        } else {
          results.push({ test: testName, status: 'PASS' });
          console.log(`  ${testName}: ✓ PASS (${contrastRatio.toFixed(2)}:1)`);
        }
      } finally {
        await context.close();
      }
    }
  }
  
  await browser.close();
  server.close();
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\nFailures:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.test}: ${r.reason}`);
    });
  }
  
  console.log(failed === 0 ? '\n✓ All panel interaction tests passed' : '\n✗ Some tests failed');
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
