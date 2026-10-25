/**
 * Panel Interaction Tests
 * 
 * Tests for:
 * - Bug 5: Panel link should work on first click
 * - Bug 6: Panel should be sticky (not reset on mouse leave)
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

// Simple static file server
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
    
    // Test (a): Click hotspot, then click panel link - should open on FIRST click
    {
      const testName = `(a) ${side}: Panel link opens on first click`;
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      
      let popupOpened = false;
      
      // Intercept popup/new tab
      context.on('page', (newPage) => {
        popupOpened = true;
        newPage.close();
      });
      
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      
      // Flip to reverse if needed
      if (side === 'reverse') {
        await page.click('#flip-button');
        await page.waitForTimeout(1000);
      }
      
      // Get first hotspot for this side
      const hotspotSelector = side === 'front' 
        ? '[data-hotspot-side="front"]' 
        : '[data-hotspot-side="reverse"]';
      
      // Click the hotspot
      await page.click(hotspotSelector);
      await page.waitForTimeout(300);
      
      // Verify panel shows hotspot content
      const panelHasLink = await page.$('.hotspot-link');
      if (!panelHasLink) {
        results.push({ test: testName, status: 'FAIL', reason: 'Panel link not found after hotspot click' });
        console.log(`  ${testName}: ✗ FAIL (no link in panel)`);
        await context.close();
        continue;
      }
      
      // Click the link once
      await page.click('.hotspot-link');
      await page.waitForTimeout(500);
      
      if (popupOpened) {
        results.push({ test: testName, status: 'PASS' });
        console.log(`  ${testName}: ✓ PASS`);
      } else {
        results.push({ test: testName, status: 'FAIL', reason: 'Popup did not open on first click' });
        console.log(`  ${testName}: ✗ FAIL (popup not opened)`);
      }
      
      await context.close();
    }
    
    // Test (b): Hover hotspot, move to blank area, then to panel link - panel should still show hotspot
    {
      const testName = `(b) ${side}: Panel is sticky on hover`;
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      
      let popupOpened = false;
      context.on('page', (newPage) => {
        popupOpened = true;
        newPage.close();
      });
      
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      
      if (side === 'reverse') {
        await page.click('#flip-button');
        await page.waitForTimeout(1000);
      }
      
      const hotspotSelector = side === 'front' 
        ? '[data-hotspot-side="front"]' 
        : '[data-hotspot-side="reverse"]';
      
      // Hover over the hotspot
      const hotspot = await page.$(hotspotSelector);
      const hotspotBox = await hotspot.boundingBox();
      
      await page.mouse.move(hotspotBox.x + hotspotBox.width / 2, hotspotBox.y + hotspotBox.height / 2);
      await page.waitForTimeout(300);
      
      // Verify panel shows hotspot content
      const panelHasLinkBefore = await page.$('.hotspot-link');
      if (!panelHasLinkBefore) {
        results.push({ test: testName, status: 'FAIL', reason: 'Panel link not found after hover' });
        console.log(`  ${testName}: ✗ FAIL (no link after hover)`);
        await context.close();
        continue;
      }
      
      // Move mouse to a blank area (outside hotspot and panel)
      await page.mouse.move(50, 50);
      await page.waitForTimeout(300);
      
      // Panel should still show the hotspot (sticky behavior)
      const panelHasLinkAfterBlank = await page.$('.hotspot-link');
      if (!panelHasLinkAfterBlank) {
        results.push({ test: testName, status: 'FAIL', reason: 'Panel reset to placeholder after moving to blank area' });
        console.log(`  ${testName}: ✗ FAIL (panel reset on leave)`);
        await context.close();
        continue;
      }
      
      // Move to panel link and click it
      const panelLink = await page.$('.hotspot-link');
      const linkBox = await panelLink.boundingBox();
      
      await page.mouse.move(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2);
      await page.waitForTimeout(200);
      await page.mouse.click(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2);
      await page.waitForTimeout(500);
      
      if (popupOpened) {
        results.push({ test: testName, status: 'PASS' });
        console.log(`  ${testName}: ✓ PASS`);
      } else {
        results.push({ test: testName, status: 'FAIL', reason: 'Link click after hover did not open popup' });
        console.log(`  ${testName}: ✗ FAIL (popup not opened)`);
      }
      
      await context.close();
    }
    
    // Test (c): Keyboard navigation - Tab to hotspot, Tab to panel link, Enter to open
    {
      const testName = `(c) ${side}: Keyboard navigation to panel link`;
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      
      let popupOpened = false;
      context.on('page', (newPage) => {
        popupOpened = true;
        newPage.close();
      });
      
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      
      if (side === 'reverse') {
        await page.click('#flip-button');
        await page.waitForTimeout(1000);
      }
      
      // Tab through the page to find a hotspot for the current side
      let foundHotspot = false;
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);
        
        const focusedOnHotspot = await page.evaluate((expectedSide) => {
          const el = document.activeElement;
          return el?.classList.contains('hotspot-polygon') && 
                 el?.getAttribute('data-hotspot-side') === expectedSide;
        }, side);
        
        if (focusedOnHotspot) {
          foundHotspot = true;
          break;
        }
      }
      
      if (!foundHotspot) {
        results.push({ test: testName, status: 'FAIL', reason: `Could not Tab to ${side} hotspot` });
        console.log(`  ${testName}: ✗ FAIL (could not tab to hotspot)`);
        await context.close();
        continue;
      }
      
      // Press Enter to activate the hotspot
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      
      // Check if panel has link
      const panelHasLink = await page.$('.hotspot-link');
      if (!panelHasLink) {
        results.push({ test: testName, status: 'FAIL', reason: 'Panel link not found after Enter on hotspot' });
        console.log(`  ${testName}: ✗ FAIL (no link after activating hotspot)`);
        await context.close();
        continue;
      }
      
      // Tab to the panel link
      let foundLink = false;
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);
        
        const isOnLink = await page.evaluate(() => document.activeElement?.classList.contains('hotspot-link'));
        if (isOnLink) {
          foundLink = true;
          break;
        }
      }
      
      if (!foundLink) {
        results.push({ test: testName, status: 'FAIL', reason: 'Could not Tab to panel link' });
        console.log(`  ${testName}: ✗ FAIL (could not tab to link)`);
        await context.close();
        continue;
      }
      
      // Press Enter to activate the link
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      if (popupOpened) {
        results.push({ test: testName, status: 'PASS' });
        console.log(`  ${testName}: ✓ PASS`);
      } else {
        results.push({ test: testName, status: 'FAIL', reason: 'Enter on focused link did not open popup' });
        console.log(`  ${testName}: ✗ FAIL (popup not opened)`);
      }
      
      await context.close();
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
