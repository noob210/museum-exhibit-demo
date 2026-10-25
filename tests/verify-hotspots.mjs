/**
 * Hotspot Verification Script
 * 
 * Tests that all 11 reverse-side hotspots achieve ≥90% coverage and ≤5px edge offset
 * across multiple viewports and font conditions.
 * 
 * Usage: node tests/verify-hotspots.mjs
 * 
 * Font conditions tested:
 * 1. Self-hosted (default) - loads fonts/crimson-pro-latin.woff2
 * 2. Fonts blocked - blocks all font loading, uses system fallback
 * 3. Times forced - forces font-family to Times New Roman
 * 4. DejaVu Serif forced - forces font-family to DejaVu Serif (installed in test env)
 * 
 * Viewports tested: 1440px, 1024px, 768px, 390px, plus 720px at 200% zoom (deviceScaleFactor 2)
 * 
 * All offset measurements are in viewBox units (807x1024 coordinate space).
 */

import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const BASE_PATH = '/museum-exhibit-demo';

// Hotspot IDs to verify (reverse side only)
const HOTSPOT_IDS = [
  'chickering-studio',
  'chickering-name',
  'boston-address',
  'sullivan-defeat',
  'queensberry-rules',
  'billy-brady',
  'olympic-club',
  'walter-watson',
  'joe-corbett',
  'baltimore-orioles',
  'copyright-notice'
];

// Test configurations
const VIEWPORTS = [
  { width: 1440, height: 900, deviceScaleFactor: 1, name: '1440px' },
  { width: 1024, height: 768, deviceScaleFactor: 1, name: '1024px' },
  { width: 768, height: 1024, deviceScaleFactor: 1, name: '768px' },
  { width: 390, height: 844, deviceScaleFactor: 1, name: '390px' },
  { width: 720, height: 450, deviceScaleFactor: 2, name: '720px@200%' }
];

const FONT_CONDITIONS = [
  { name: 'self-hosted', blockFonts: false, forcedFont: null },
  { name: 'fonts-blocked', blockFonts: true, forcedFont: null },
  { name: 'times-forced', blockFonts: false, forcedFont: 'Times New Roman' },
  { name: 'dejavu-forced', blockFonts: false, forcedFont: 'DejaVu Serif' }
];

// Thresholds
const MIN_COVERAGE = 90;
const MAX_OFFSET = 5;

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
      
      // Strip base path
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

async function measureHotspot(page, hotspotId) {
  return page.evaluate(({ id }) => {
    const span = document.querySelector(`[data-hotspot="${id}"]`);
    const polygon = document.querySelector(`[data-hotspot-id="${id}"]`);
    
    if (!span || !polygon) {
      return { error: `Element not found: ${id}` };
    }
    
    // Get text position using Range for accurate measurement
    const range = document.createRange();
    range.selectNodeContents(span);
    const textRects = range.getClientRects();
    
    if (textRects.length === 0) {
      return { error: `No text rects for: ${id}` };
    }
    
    // Get the reverse content container for coordinate conversion
    const container = document.querySelector('.card-reverse-content');
    if (!container) {
      return { error: 'Container not found' };
    }
    
    const containerRect = container.getBoundingClientRect();
    
    // Get scale factor
    const transform = getComputedStyle(container).transform;
    let scale = 1;
    if (transform && transform !== 'none') {
      const match = transform.match(/matrix\(([^,]+)/);
      if (match) scale = parseFloat(match[1]);
    }
    
    // Convert text rects to viewBox coordinates (807x1024)
    const textBounds = Array.from(textRects).map(rect => ({
      left: (rect.left - containerRect.left) / scale,
      right: (rect.right - containerRect.left) / scale,
      top: (rect.top - containerRect.top) / scale,
      bottom: (rect.bottom - containerRect.top) / scale
    }));
    
    // Get overall text bounding box
    const textLeft = Math.min(...textBounds.map(b => b.left));
    const textRight = Math.max(...textBounds.map(b => b.right));
    const textTop = Math.min(...textBounds.map(b => b.top));
    const textBottom = Math.max(...textBounds.map(b => b.bottom));
    
    // Get polygon bounds from SVG points attribute
    const pointsAttr = polygon.getAttribute('points');
    const points = pointsAttr.split(' ').map(p => {
      const [x, y] = p.split(',').map(Number);
      return { x, y };
    });
    
    const polyLeft = Math.min(...points.map(p => p.x));
    const polyRight = Math.max(...points.map(p => p.x));
    const polyTop = Math.min(...points.map(p => p.y));
    const polyBottom = Math.max(...points.map(p => p.y));
    
    // Calculate intersection area
    const intLeft = Math.max(textLeft, polyLeft);
    const intRight = Math.min(textRight, polyRight);
    const intTop = Math.max(textTop, polyTop);
    const intBottom = Math.min(textBottom, polyBottom);
    
    const intWidth = Math.max(0, intRight - intLeft);
    const intHeight = Math.max(0, intBottom - intTop);
    const intersectionArea = intWidth * intHeight;
    
    // Calculate text area
    const textArea = (textRight - textLeft) * (textBottom - textTop);
    
    // Calculate coverage (intersection / text area)
    const coverage = textArea > 0 ? (intersectionArea / textArea) * 100 : 0;
    
    // Calculate edge offsets (in viewBox units)
    const leftOffset = Math.abs(textLeft - polyLeft);
    const rightOffset = Math.abs(textRight - polyRight);
    const topOffset = Math.abs(textTop - polyTop);
    const bottomOffset = Math.abs(textBottom - polyBottom);
    const maxOffset = Math.max(leftOffset, rightOffset, topOffset, bottomOffset);
    
    return {
      coverage: Math.round(coverage * 10) / 10,
      maxOffset: Math.round(maxOffset * 10) / 10,
      offsets: {
        left: Math.round(leftOffset * 10) / 10,
        right: Math.round(rightOffset * 10) / 10,
        top: Math.round(topOffset * 10) / 10,
        bottom: Math.round(bottomOffset * 10) / 10
      }
    };
  }, { id: hotspotId });
}

async function runTest(browser, baseUrl, viewport, fontCondition) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor
  });
  
  const page = await context.newPage();
  
  // Track errors - attach listeners BEFORE navigation
  const errors = [];
  const failedRequests = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore font loading errors when we're intentionally blocking fonts
      if (fontCondition.blockFonts && text.includes('Failed to load resource')) {
        return;
      }
      errors.push(text);
    }
  });
  
  page.on('pageerror', err => {
    errors.push(err.message);
  });
  
  page.on('requestfailed', request => {
    const url = request.url();
    // Ignore font request failures when we're intentionally blocking fonts
    if (fontCondition.blockFonts && (url.endsWith('.woff2') || url.endsWith('.woff') || url.endsWith('.ttf'))) {
      return;
    }
    failedRequests.push(`${request.method()} ${url}: ${request.failure()?.errorText || 'unknown'}`);
  });
  
  // Block fonts if needed
  if (fontCondition.blockFonts) {
    await page.route('**/*.woff2', route => route.abort());
    await page.route('**/*.woff', route => route.abort());
    await page.route('**/*.ttf', route => route.abort());
  }
  
  // Navigate to page
  await page.goto(`${baseUrl}${BASE_PATH}/`, { waitUntil: 'networkidle' });
  
  // Force font if needed
  if (fontCondition.forcedFont) {
    await page.addStyleTag({
      content: `
        .card-reverse-content, .card-reverse-content * {
          font-family: '${fontCondition.forcedFont}', serif !important;
        }
      `
    });
  }
  
  // Wait for fonts to load (or fail)
  await page.waitForTimeout(300);
  
  // Click flip button to show reverse side
  await page.click('#flip-button');
  await page.waitForTimeout(1000);
  
  // Wait for dynamic polygons to compute
  await page.waitForTimeout(200);
  
  // Measure each hotspot
  const results = [];
  for (const id of HOTSPOT_IDS) {
    const result = await measureHotspot(page, id);
    results.push({
      id,
      ...result
    });
  }
  
  await context.close();
  
  return { results, errors, failedRequests };
}

async function main() {
  console.log('Hotspot Verification Test');
  console.log('='.repeat(80));
  console.log(`Testing ${HOTSPOT_IDS.length} hotspots × ${VIEWPORTS.length} viewports × ${FONT_CONDITIONS.length} font conditions`);
  console.log(`Thresholds: ≥${MIN_COVERAGE}% coverage, ≤${MAX_OFFSET} viewBox units max offset\n`);
  
  // Start HTTP server
  const { server, port } = await createServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Server running at ${baseUrl}${BASE_PATH}/\n`);
  
  const browser = await chromium.launch({ headless: true });
  
  const allResults = [];
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let hasErrors = false;
  
  for (const fontCondition of FONT_CONDITIONS) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`Font condition: ${fontCondition.name}`);
    console.log('─'.repeat(80));
    
    for (const viewport of VIEWPORTS) {
      console.log(`\n  Viewport: ${viewport.name}`);
      
      const { results, errors, failedRequests } = await runTest(browser, baseUrl, viewport, fontCondition);
      
      // Check for errors
      if (errors.length > 0 || failedRequests.length > 0) {
        hasErrors = true;
        if (errors.length > 0) {
          console.log(`  ⚠ Console errors: ${errors.join(', ')}`);
        }
        if (failedRequests.length > 0) {
          console.log(`  ⚠ Failed requests: ${failedRequests.join(', ')}`);
        }
      }
      
      console.log('  ' + '─'.repeat(76));
      console.log('  | Hotspot ID         | Coverage | Max Offset (vb) | Status |');
      console.log('  |' + '─'.repeat(20) + '|' + '─'.repeat(10) + '|' + '─'.repeat(17) + '|' + '─'.repeat(8) + '|');
      
      for (const result of results) {
        totalTests++;
        
        if (result.error) {
          failedTests++;
          console.log(`  | ${result.id.padEnd(18)} | ERROR    | ${result.error}`);
          allResults.push({
            font: fontCondition.name,
            viewport: viewport.name,
            hotspot: result.id,
            status: 'ERROR',
            error: result.error
          });
          continue;
        }
        
        const coverageOk = result.coverage >= MIN_COVERAGE;
        const offsetOk = result.maxOffset <= MAX_OFFSET;
        const passed = coverageOk && offsetOk;
        
        if (passed) {
          passedTests++;
        } else {
          failedTests++;
        }
        
        const status = passed ? '✓ PASS' : '✗ FAIL';
        console.log(`  | ${result.id.padEnd(18)} | ${String(result.coverage).padStart(6)}% | ${String(result.maxOffset).padStart(13)} vb | ${status} |`);
        
        allResults.push({
          font: fontCondition.name,
          viewport: viewport.name,
          hotspot: result.id,
          coverage: result.coverage,
          maxOffset: result.maxOffset,
          offsets: result.offsets,
          status: passed ? 'PASS' : 'FAIL'
        });
      }
    }
  }
  
  await browser.close();
  server.close();
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Pass rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  // List failures
  const failures = allResults.filter(r => r.status !== 'PASS');
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      if (f.error) {
        console.log(`  - ${f.font} / ${f.viewport} / ${f.hotspot}: ${f.error}`);
      } else {
        console.log(`  - ${f.font} / ${f.viewport} / ${f.hotspot}: ${f.coverage}% coverage, ${f.maxOffset} vb offset`);
      }
    }
  }
  
  // Detailed table by hotspot (worst case across all conditions)
  console.log('\n' + '─'.repeat(80));
  console.log('Per-hotspot worst case (across all viewports and font conditions):');
  console.log('─'.repeat(80));
  console.log('| Hotspot ID         | Min Coverage | Max Offset (vb) | Status |');
  console.log('|' + '─'.repeat(20) + '|' + '─'.repeat(14) + '|' + '─'.repeat(17) + '|' + '─'.repeat(8) + '|');
  
  for (const id of HOTSPOT_IDS) {
    const hotspotResults = allResults.filter(r => r.hotspot === id && !r.error);
    if (hotspotResults.length === 0) {
      console.log(`| ${id.padEnd(18)} | ERROR        |                 |        |`);
      continue;
    }
    
    const minCoverage = Math.min(...hotspotResults.map(r => r.coverage));
    const maxOffset = Math.max(...hotspotResults.map(r => r.maxOffset));
    const passed = minCoverage >= MIN_COVERAGE && maxOffset <= MAX_OFFSET;
    const status = passed ? '✓ PASS' : '✗ FAIL';
    
    console.log(`| ${id.padEnd(18)} | ${String(minCoverage).padStart(10)}% | ${String(maxOffset).padStart(13)} vb | ${status} |`);
  }
  
  // Exit with error if any test failed or had errors
  if (failedTests > 0 || hasErrors) {
    console.log('\n⚠ Test suite completed with failures or errors');
    process.exit(1);
  }
  
  console.log('\n✓ All tests passed');
  process.exit(0);
}

main().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
