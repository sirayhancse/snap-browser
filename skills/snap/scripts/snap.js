#!/usr/bin/env node
/**
 * snap.js — Headless browser element screenshot (never captures the system screen)
 *
 * Usage:
 *   node snap.js "<element description>" [page-url] [--full-page]
 *   node snap.js --full-page [page-url]
 *
 * Works on macOS, Linux, and Windows from any terminal:
 *   Terminal.app, iTerm2, VS Code, IntelliJ IDEA, PyCharm, WebStorm, Hyper, etc.
 *
 * URL resolution order:
 *   1. Explicit URL argument
 *   2. Active browser tab (AppleScript on macOS, PowerShell on Windows)
 *   3. Running dev server port scan (3000, 5173, 8080, …)
 *
 * Output JSON:
 *   { success: true,  path, contextPath?, mode, strategy?, expanded?, pageUrl, urlSource?, boundingBox? }
 *   { success: false, error, hint? }
 */

'use strict';

const { chromium }     = require('playwright-core');
const { execFileSync } = require('child_process');
const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ─── Args ─────────────────────────────────────────────────────────────────────

const args        = process.argv.slice(2);
const fullPage    = args.includes('--full-page');
const explicitUrl = args.find(a => a.startsWith('http')) || null;
const description = args.find(a => !a.startsWith('--') && !a.startsWith('http')) || null;

if (!fullPage && !description) {
  console.error(JSON.stringify({
    success: false,
    error: 'Usage: node snap.js "element description" [page-url] [--full-page]',
  }));
  process.exit(1);
}

// ─── URL detection ────────────────────────────────────────────────────────────

function getFrontmostBrowserUrl() {
  if (process.platform === 'darwin') {
    const chromeLike = ['Google Chrome', 'Chromium', 'Brave Browser', 'Microsoft Edge', 'Arc', 'Vivaldi', 'Opera'];
    for (const app of chromeLike) {
      try {
        const url = execFileSync(
          '/usr/bin/osascript',
          ['-e', `tell application "${app}" to return URL of active tab of front window`],
          { timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }
        ).toString().trim();
        if (url.startsWith('http')) return { url, source: app };
      } catch {}
    }
    try {
      const url = execFileSync(
        '/usr/bin/osascript',
        ['-e', 'tell application "Safari" to return URL of front document'],
        { timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }
      ).toString().trim();
      if (url.startsWith('http')) return { url, source: 'Safari' };
    } catch {}
    return null;
  }

  if (process.platform === 'win32') {
    // PowerShell UI Automation reads the address bar of the frontmost browser
    const ps = [
      '$ErrorActionPreference = "SilentlyContinue"',
      'Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes',
      '$root = [System.Windows.Automation.AutomationElement]::RootElement',
      'foreach ($cls in @("Chrome_WidgetWin_1","MozillaWindowClass","BrowserFrameGlass")) {',
      '  $c = New-Object System.Windows.Automation.PropertyCondition(',
      '    [System.Windows.Automation.AutomationElement]::ClassNameProperty, $cls)',
      '  $win = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $c)',
      '  if (-not $win) { continue }',
      '  foreach ($n in @("Address and search bar","Search or enter address","Address bar")) {',
      '    $bc = New-Object System.Windows.Automation.PropertyCondition(',
      '      [System.Windows.Automation.AutomationElement]::NameProperty, $n)',
      '    $bar = $win.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $bc)',
      '    if ($bar) {',
      '      $url = $bar.GetCurrentPropertyValue(',
      '        [System.Windows.Automation.AutomationElement]::NameProperty)',
      '      if ($url -match "^https?://") { $url; exit }',
      '    }',
      '  }',
      '}',
    ].join('\n');
    try {
      const result = execFileSync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', ps],
        { timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }
      ).toString().trim();
      if (result.startsWith('http')) return { url: result, source: 'Browser (Windows)' };
    } catch {}
    return null;
  }

  // Linux: no reliable cross-distro method — fall through to port scan
  return null;
}

function checkPort(port) {
  return new Promise(resolve => {
    const req = http.get({ hostname: 'localhost', port, path: '/', timeout: 600 }, res => {
      res.destroy();
      resolve(res.statusCode < 500 ? `http://localhost:${port}` : null);
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

async function detectDevServer() {
  const ports = [5173, 3000, 3001, 4200, 8080, 8000, 4000, 5000, 5174, 8888, 9000, 3003, 4321, 6006];
  const results = await Promise.all(ports.map(p => checkPort(p)));
  const found = results.find(Boolean);
  return found ? { url: found, source: found.replace('http://', '') } : null;
}

// ─── Chrome discovery ─────────────────────────────────────────────────────────

function findSystemChrome() {
  if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];
    return candidates.find(p => fs.existsSync(p)) || null;
  }

  if (process.platform === 'win32') {
    const lad  = process.env.LOCALAPPDATA          || '';
    const pf   = process.env.PROGRAMFILES          || 'C:\\Program Files';
    const pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const candidates = [
      path.join(lad,  'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(pf,   'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(pf,   'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(lad,  'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(lad,  'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      path.join(pf,   'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    ];
    return candidates.find(p => fs.existsSync(p)) || null;
  }

  // Linux
  for (const bin of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'brave-browser', 'microsoft-edge']) {
    try {
      const p = execFileSync('/usr/bin/env', ['which', bin],
        { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      if (p && fs.existsSync(p)) return p;
    } catch {}
  }
  return null;
}

// ─── Element locator ladder ───────────────────────────────────────────────────

const ROLE_MAP = [
  { keywords: ['button', 'btn', 'submit', 'cancel', 'ok', 'close', 'save', 'delete',
               'login', 'sign in', 'sign up', 'register', 'search', 'reset', 'back',
               'next', 'previous', 'continue', 'confirm', 'upload', 'create', 'add'], role: 'button' },
  { keywords: ['link', 'anchor', 'href', 'nav link'], role: 'link' },
  { keywords: ['textbox', 'text field', 'text box', 'input', 'entry', 'field'], role: 'textbox' },
  { keywords: ['checkbox', 'check box'], role: 'checkbox' },
  { keywords: ['radio', 'radio button'], role: 'radio' },
  { keywords: ['select', 'dropdown', 'drop down', 'combo', 'combobox'], role: 'combobox' },
  { keywords: ['heading', 'title', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'], role: 'heading' },
  { keywords: ['navigation', 'nav', 'navbar', 'nav bar', 'menu bar'], role: 'navigation' },
  { keywords: ['menuitem', 'menu item'], role: 'menuitem' },
  { keywords: ['menu'], role: 'menu' },
  { keywords: ['tab'], role: 'tab' },
  { keywords: ['dialog', 'modal', 'popup', 'pop up', 'pop-up'], role: 'dialog' },
  { keywords: ['alert', 'toast', 'notification', 'banner'], role: 'alert' },
  { keywords: ['form'], role: 'form' },
  { keywords: ['image', 'img', 'photo', 'picture', 'icon'], role: 'img' },
  { keywords: ['switch', 'toggle'], role: 'switch' },
  { keywords: ['slider', 'range'], role: 'slider' },
  { keywords: ['table'], role: 'table' },
  { keywords: ['list'], role: 'list' },
  { keywords: ['card'], role: 'article' },
  { keywords: ['section', 'region', 'area', 'panel'], role: 'region' },
];

function parseDescription(desc) {
  const lower = desc.toLowerCase();
  let role = null;
  for (const { keywords, role: r } of ROLE_MAP) {
    if (keywords.some(k => lower.includes(k))) { role = r; break; }
  }
  const allKeywords = ROLE_MAP.flatMap(r => r.keywords);
  let nameHint = lower;
  for (const kw of allKeywords) {
    nameHint = nameHint.replace(new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '');
  }
  return { role, nameHint: nameHint.replace(/\s+/g, ' ').trim() || null };
}

async function findElement(page, desc) {
  const { role, nameHint } = parseDescription(desc);
  const strategies = [];

  if (role && nameHint) strategies.push({ label: `role(${role})+name("${nameHint}")`, locate: () => page.getByRole(role, { name: new RegExp(nameHint, 'i') }).first() });
  if (role)             strategies.push({ label: `role(${role})`,                     locate: () => page.getByRole(role).first() });
  if (nameHint)         strategies.push({ label: `label("${nameHint}")`,              locate: () => page.getByLabel(new RegExp(nameHint, 'i')).first() });
                        strategies.push({ label: `label("${desc}")`,                  locate: () => page.getByLabel(new RegExp(desc, 'i')).first() });
  if (nameHint)         strategies.push({ label: `text("${nameHint}")`,               locate: () => page.getByText(new RegExp(nameHint, 'i'), { exact: false }).first() });
                        strategies.push({ label: `text("${desc}")`,                   locate: () => page.getByText(new RegExp(desc, 'i'), { exact: false }).first() });
  if (nameHint)         strategies.push({ label: `placeholder("${nameHint}")`,        locate: () => page.getByPlaceholder(new RegExp(nameHint, 'i')).first() });

  for (const s of strategies) {
    try {
      const locator = s.locate();
      await locator.waitFor({ state: 'visible', timeout: 1500 });
      return { locator, strategy: s.label };
    } catch {}
  }
  return null;
}

// ─── Smart component boundary ─────────────────────────────────────────────────
//
// Returns BOTH coordinate systems:
//   - viewport coords  (left, top)   → used for position:fixed highlight overlay
//   - page coords      (pageX, pageY) → used for page.screenshot({ clip }) [Playwright uses page coords]
//
// The smart expansion walks up the DOM from small/text nodes to find the
// nearest meaningful component wrapper (section, card, panel, etc.).

async function getComponentBox(page, locator) {
  await locator.scrollIntoViewIfNeeded();

  return locator.evaluate(el => {
    const scrollX = window.pageXOffset;
    const scrollY = window.pageYOffset;

    function toBox(r, expanded) {
      return {
        // Viewport-relative (for position:fixed highlight)
        left:  r.left,
        top:   r.top,
        // Page-relative (for page.screenshot clip — Playwright uses page coords)
        pageX: r.left + scrollX,
        pageY: r.top  + scrollY,
        width:  r.width,
        height: r.height,
        expanded,
      };
    }

    const tag  = el.tagName.toLowerCase();
    const rect = el.getBoundingClientRect();

    // Atomic elements — complete by themselves, never expand to parent
    const atomic = ['button', 'input', 'select', 'textarea', 'img', 'video', 'audio', 'svg', 'canvas', 'iframe'];
    if (atomic.includes(tag)) return toBox(rect, false);

    // Already a semantic/large container
    const semanticTags    = ['section', 'article', 'aside', 'main', 'nav', 'header', 'footer', 'form', 'fieldset', 'dialog', 'details'];
    const containerRoleRe = /^(region|article|complementary|main|navigation|form|grid|listbox|group|tabpanel|dialog|banner|contentinfo|feed|log|status|timer)$/;
    const role            = (el.getAttribute('role') || '').toLowerCase();

    if (semanticTags.includes(tag) || containerRoleRe.test(role)) return toBox(rect, false);
    if (rect.height > 150 && rect.width > 200) return toBox(rect, false);

    // Walk up to find the component wrapper
    const componentKw = /\b(card|panel|section|module|widget|block|component|box|group|tile|item|entry|skill|tag|badge|chip|feature|experience|education|project|portfolio|certificate|achievement|about|contact|hero|gallery|timeline|testimonial|review|stat|metric|kpi)\b/i;

    let node  = el.parentElement;
    let best  = null;
    let prevH = rect.height;

    for (let depth = 0; depth < 10 && node; depth++) {
      if (node === document.body || node === document.documentElement) break;

      const nTag   = node.tagName.toLowerCase();
      const nRect  = node.getBoundingClientRect();
      const nRole  = (node.getAttribute('role') || '').toLowerCase();
      const nAttrs = ((node.className || '') + ' ' + (node.id || '')).toString();

      // Definitive containers — stop here
      if (semanticTags.includes(nTag) || containerRoleRe.test(nRole)) { best = nRect; break; }

      // Named component class/ID — good candidate, keep walking for a better one
      if (componentKw.test(nAttrs)) best = nRect;

      // Jumped past the boundary: > 3× taller than previous level
      if (nRect.height > prevH * 3 && best) break;

      // Full-viewport-width layout container — stop
      if (nRect.width >= window.innerWidth * 0.98 && best) break;

      prevH = nRect.height;
      node  = node.parentElement;
    }

    return best ? toBox(best, true) : toBox(rect, false);
  });
}

// ─── Red rectangle highlight (position:fixed = viewport-relative) ─────────────

async function addHighlight(page, box) {
  // box.left/top are viewport coordinates → position:fixed places it correctly
  await page.evaluate(({ left, top, width, height }) => {
    const old = document.getElementById('__snap_hl__');
    if (old) old.remove();
    const hl = document.createElement('div');
    hl.id = '__snap_hl__';
    Object.assign(hl.style, {
      position:      'fixed',
      left:          `${left}px`,
      top:           `${top}px`,
      width:         `${width}px`,
      height:        `${height}px`,
      border:        '3px solid red',
      borderRadius:  '3px',
      boxSizing:     'border-box',
      background:    'rgba(255, 0, 0, 0.10)',
      pointerEvents: 'none',
      zIndex:        '2147483647',
      // White glow makes the box visible on both dark and light backgrounds
      boxShadow:     '0 0 0 2px rgba(255,255,255,0.7), 0 0 8px rgba(255,0,0,0.4)',
    });
    document.documentElement.appendChild(hl);
  }, box);
}

// Absolute-positioned variant for full-page screenshots.
// position:fixed is pinned to the viewport and would only render correctly at
// the initial scroll position when Playwright stitches a full-page image — so
// for full-page mode we anchor the highlight to page (pageX/pageY) coordinates.
async function addHighlightAbsolute(page, box) {
  await page.evaluate(({ pageX, pageY, width, height }) => {
    const old = document.getElementById('__snap_hl__');
    if (old) old.remove();
    const hl = document.createElement('div');
    hl.id = '__snap_hl__';
    Object.assign(hl.style, {
      position:      'absolute',
      left:          `${pageX}px`,
      top:           `${pageY}px`,
      width:         `${width}px`,
      height:        `${height}px`,
      border:        '3px solid red',
      borderRadius:  '3px',
      boxSizing:     'border-box',
      background:    'rgba(255, 0, 0, 0.10)',
      pointerEvents: 'none',
      zIndex:        '2147483647',
      boxShadow:     '0 0 0 2px rgba(255,255,255,0.7), 0 0 8px rgba(255,0,0,0.4)',
    });
    document.body.appendChild(hl);
  }, box);
}

async function removeHighlight(page) {
  await page.evaluate(() => {
    const el = document.getElementById('__snap_hl__');
    if (el) el.remove();
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Resolve URL
  let pageUrl, urlSource;

  if (explicitUrl) {
    pageUrl = explicitUrl; urlSource = 'argument';
  } else {
    const bi = getFrontmostBrowserUrl();
    if (bi) { pageUrl = bi.url; urlSource = bi.source; }
    else {
      const si = await detectDevServer();
      if (si) { pageUrl = si.url; urlSource = si.source; }
    }
  }

  if (!pageUrl) {
    console.error(JSON.stringify({
      success: false,
      error: 'No page URL found.',
      hint: [
        'Do one of the following:',
        '  1. Pass the URL:  node snap.js "element" "http://localhost:3000/page"',
        '  2. Open your app in Chrome, Brave, Edge, Arc, or Safari',
        '  3. Start your dev server (3000, 5173, 8080, … are scanned automatically)',
      ].join('\n'),
    }));
    process.exit(1);
  }

  // 2. Launch headless browser
  const chromePath = findSystemChrome();
  let pw;
  try {
    pw = await chromium.launch({ headless: true, ...(chromePath ? { executablePath: chromePath } : {}) });
  } catch (err) {
    console.error(JSON.stringify({
      success: false,
      error: `Could not launch headless browser: ${err.message}`,
      hint: 'Install Google Chrome or Chromium, or run: npx playwright install chromium',
    }));
    process.exit(1);
  }

  try {
    const page = await pw.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });

    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 20000 });
    } catch {
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1500);
    }

    const ts     = Date.now();
    const tmpDir = os.tmpdir();

    // ── Full-page mode ──────────────────────────────────────────────────────
    if (fullPage) {
      const outPath = path.join(tmpDir, `snap-fullpage-${ts}.png`);

      // With a description: try to locate and highlight the element on the full page.
      if (description) {
        const found = await findElement(page, description);
        if (found) {
          const box = await getComponentBox(page, found.locator);
          await addHighlightAbsolute(page, box);
          await page.screenshot({ path: outPath, fullPage: true });
          await removeHighlight(page);
          console.log(JSON.stringify({
            success:     true,
            path:        outPath,
            mode:        'fullpage',
            expanded:    box.expanded,
            strategy:    found.strategy,
            pageUrl,
            urlSource,
            boundingBox: { x: box.pageX, y: box.pageY, width: box.width, height: box.height },
          }));
          return;
        }
        // Element not found — still return the full page, but flag it.
        await page.screenshot({ path: outPath, fullPage: true });
        console.log(JSON.stringify({
          success: true,
          path:    outPath,
          mode:    'fullpage',
          pageUrl,
          urlSource,
          message: `"${description}" not found via locators. Captured full page without highlight.`,
        }));
        return;
      }

      // No description — plain full-page capture.
      await page.screenshot({ path: outPath, fullPage: true });
      console.log(JSON.stringify({ success: true, path: outPath, mode: 'fullpage', pageUrl, urlSource }));
      return;
    }

    // ── Element mode ────────────────────────────────────────────────────────
    const found = await findElement(page, description);

    if (found) {
      const cropPath    = path.join(tmpDir, `snap-crop-${ts}.png`);
      const contextPath = path.join(tmpDir, `snap-context-${ts}.png`);

      // Smart container expansion — may walk up from text node to parent component
      const box = await getComponentBox(page, found.locator);

      // Crop: Playwright clip uses PAGE coordinates (not viewport coords)
      await page.screenshot({
        path: cropPath,
        clip: { x: box.pageX, y: box.pageY, width: box.width, height: box.height },
      });

      // Context: red rectangle uses VIEWPORT coordinates (position:fixed)
      await addHighlight(page, box);
      await page.screenshot({ path: contextPath, fullPage: false });
      await removeHighlight(page);

      console.log(JSON.stringify({
        success:     true,
        path:        cropPath,
        contextPath: contextPath,
        mode:        'element',
        expanded:    box.expanded,
        strategy:    found.strategy,
        pageUrl,
        urlSource,
        boundingBox: { x: box.pageX, y: box.pageY, width: box.width, height: box.height },
      }));
      return;
    }

    // ── Not found — visible viewport only (not full page) ──────────────────
    const viewportPath = path.join(tmpDir, `snap-viewport-${ts}.png`);
    await page.screenshot({ path: viewportPath, fullPage: false });
    console.log(JSON.stringify({
      success: true,
      path:    viewportPath,
      mode:    'viewport',
      pageUrl,
      urlSource,
      message: `"${description}" not found via locators. Captured the visible viewport. Re-run with --full-page if the element is below the fold.`,
    }));

  } catch (err) {
    console.error(JSON.stringify({ success: false, error: err.message, pageUrl }));
    process.exit(1);
  } finally {
    await pw.close();
  }
}

main();
