// Browser regression checks for idle scrolling, media loading and 3D lifecycles.
// Run after npm run build, against npm run preview (or an explicit --url=...).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { mkdir, readdir, writeFile } from 'node:fs/promises';

const base = (process.argv.find(x => x.startsWith('--url='))?.slice(6) || 'http://127.0.0.1:4321/My-RM-Portfolio/').replace(/\/?$/, '/');
const out = resolve(process.argv.find(x => x.startsWith('--out='))?.slice(6) || 'tmp/performance/checks');
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
let executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
if (!executablePath && process.platform === 'win32') {
  const cache = join(homedir(), 'AppData/Local/ms-playwright');
  const versions = (await readdir(cache)).filter(x => /^chromium-\d+$/.test(x)).sort((a,b) => Number(a.slice(9)) - Number(b.slice(9)));
  executablePath = join(cache, versions.at(-1), 'chrome-win64/chrome.exe');
}
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });
const report = { base, checks: [], errors: [], metrics: [] };
const pass = name => { report.checks.push(name); console.log(`PASS ${name}`); };
const makePage = async options => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => report.errors.push(String(error)));
  page.on('response', response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(() => {
    window.__perf = { raf: 0, long: [], cls: 0 };
    const request = window.requestAnimationFrame;
    window.requestAnimationFrame = callback => request.call(window, time => { window.__perf.raf++; callback(time); });
    new PerformanceObserver(list => list.getEntries().forEach(e => window.__perf.long.push(e.duration))).observe({ type: 'longtask', buffered: true });
    new PerformanceObserver(list => list.getEntries().forEach(e => { if (!e.hadRecentInput) window.__perf.cls += e.value; })).observe({ type: 'layout-shift', buffered: true });
  });
  return { page, context, requests };
};
const scrollTo = async (page, selector) => {
  await page.locator(selector).first().evaluate(element => {
    const top = element.getBoundingClientRect().top + scrollY - 110;
    if (window.__lenis) window.__lenis.scrollTo(top, { immediate: true }); else window.scrollTo(0, top);
  });
};
const ready = (page, selector) => page.waitForFunction(selector => document.querySelector(selector)?.dataset.ready === 'true', selector);
const idle = async page => {
  await page.waitForTimeout(1200);
  const start = await page.evaluate(() => window.__perf.raf);
  await page.waitForTimeout(800);
  const state = await page.evaluate(() => ({ raf: window.__perf.raf, scrolling: window.__lenis?.isScrolling, y: scrollY, target: window.__lenis?.targetScroll, videos: [...document.querySelectorAll('video')].map(v => ({ paused: v.paused, time: v.currentTime })) }));
  assert.equal(state.raf, start, `Idle page should not request animation frames: ${JSON.stringify(state)}`);
};

try {
  const home = await makePage();
  await home.page.goto(base);
  await home.page.waitForFunction(() => Boolean(window.__lenis));
  await idle(home.page);
  assert.equal(home.requests.some(url => /\.mp4(?:\?|$)/.test(url)), false);
  await home.page.evaluate(() => window.__lenis.scrollTo(100));
  await home.page.waitForFunction(() => Math.abs(scrollY - 100) < 2);
  await home.page.evaluate(() => window.__lenis.scrollTo(0));
  await home.page.waitForFunction(() => scrollY < 2);
  await idle(home.page);
  pass('Home sleeps when idle; programmatic smooth scrolling wakes and settles; offscreen video is not fetched');
  await home.page.mouse.move(30, 300);
  await home.page.mouse.wheel(0, 50);
  await home.page.waitForFunction(() => scrollY > 30);
  await home.page.mouse.wheel(0, -50);
  await home.page.waitForFunction(() => scrollY < 2);
  await idle(home.page);
  pass('Wheel scrolling still works after idle');
  await home.page.emulateMedia({ reducedMotion: 'reduce' });
  await home.page.waitForFunction(() => !window.__lenis);
  await home.page.emulateMedia({ reducedMotion: 'no-preference' });
  await home.page.waitForFunction(() => Boolean(window.__lenis));
  pass('Changing motion preference destroys and restores smooth scrolling');
  await home.context.close();

  const desktop = await makePage();
  const { page } = desktop;
  await page.goto(base + 'engineer/');
  await ready(page, '[data-module-media]');
  assert.equal(desktop.requests.some(url => /\.mp4(?:\?|$)/.test(url)), false);
  assert.equal(desktop.requests.some(url => /picking[.-].*\.js/.test(url)), false, 'Picking code must not load before interaction');
  assert.ok(await page.locator('video').evaluateAll(videos => videos.every(v => v.poster.endsWith('.webp'))), 'Video posters must use optimized WebP copies');
  report.metrics.push(await page.evaluate(() => ({ name: 'engineer-initial', ...window.__perf })));
  await page.locator('[data-module-spin]').click();
  await idle(page);
  const still = page.locator('[data-module-view]');
  const before = await still.screenshot({ path: join(out, 'header-paused.png') });
  await page.waitForTimeout(700);
  assert.deepEqual(await still.screenshot(), before, 'Paused WebGL canvas must retain its composited frame');
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.waitForTimeout(2500);
  await page.locator('[data-module-reset]').click();
  await page.screenshot({ path: join(out, 'engineer-resized.png') });
  pass('Header loads without a video download; paused canvas persists; camera and HUD survive resize/reset');
  await scrollTo(page, '[data-official-film]');
  await page.waitForFunction(() => { const v = document.querySelector('[data-official-film] video'); return v.currentTime > .1 && !v.paused; });
  await scrollTo(page, '[data-mission-film]');
  await page.locator('[data-mission-time]').nth(1).click();
  const chapter = Number(await page.locator('[data-mission-time]').nth(1).getAttribute('data-mission-time'));
  await page.waitForFunction(time => document.querySelector('[data-mission-film] video').currentTime >= time, chapter);
  pass('Deferred official/mission videos play on entry; mission chapter seeking still works');

  await scrollTo(page, '[data-arm-explode]');
  await ready(page, '[data-arm-explode]');
  await page.locator('[data-arm-explode] [data-play]').click();
  await page.locator('[data-assembly]').click();
  await page.waitForFunction(() => document.querySelector('[data-arm-explode]').dataset.storyTime === '0.0000');
  assert.equal(await page.locator('[data-study-transition]').evaluate(e => Number(e.style.opacity)), 0, 'Restored/paused arm must not be covered by the opening fade');
  const pausedFrames = await page.locator('[data-arm-explode]').getAttribute('data-frames');
  await page.waitForTimeout(600);
  assert.equal(await page.locator('[data-arm-explode]').getAttribute('data-frames'), pausedFrames);
  await page.locator('[data-arm-explode]').screenshot({ path: join(out, 'arm-paused.png') });
  await page.locator('[data-story-step]').nth(2).click();
  await page.waitForTimeout(700);
  assert.equal(await page.locator('[data-arm-explode]').getAttribute('data-context'), 'active');
  await page.locator('[data-story-step]').last().click();
  await page.waitForFunction(() => Number(document.querySelector('[data-arm-explode]').dataset.contextOpacity) > .9);
  pass('Arm animation, pause, assembly and chapter selection remain available');

  await scrollTo(page, '[data-mechanism="swerve"]');
  await ready(page, '[data-mechanism="swerve"]');
  await page.locator('[data-mechanism="swerve"] [data-mechanism-play]').click();
  await page.locator('[data-explode-to="1"]').click();
  await page.waitForFunction(() => Number(document.querySelector('[data-mechanism="swerve"]').dataset.explode) > .999);
  await page.locator('[data-mechanism="swerve"] canvas').hover();
  await page.waitForFunction(() => document.querySelector('[data-mechanism="swerve"] canvas').dataset.picking === 'ready');
  assert.ok(await page.locator('[data-mechanism="swerve"]').evaluate(root => [...root.querySelectorAll('[data-mechanism-annotation]:not([hidden])')].every(label => {
    const r = label.getBoundingClientRect(), frame = root.querySelector('[data-mechanism-view]').getBoundingClientRect();
    return r.left >= frame.left - 1 && r.right <= frame.right + 1 && r.top >= frame.top && r.bottom <= frame.bottom;
  })), 'Moved annotations must stay within the viewport');
  await page.locator('[data-mechanism="swerve"]').screenshot({ path: join(out, 'swerve-exploded.png') });
  await page.locator('[data-explode-to="0"]').click();
  await page.waitForFunction(() => Number(document.querySelector('[data-mechanism="swerve"]').dataset.explode) < .001);
  await scrollTo(page, '[data-mechanism="pump"]');
  await ready(page, '[data-mechanism="pump"]');
  const crank = await page.locator('[data-mechanism="pump"]').getAttribute('data-crank-angle');
  await page.waitForFunction(value => document.querySelector('[data-mechanism="pump"]').dataset.crankAngle !== value, crank);
  await page.locator('[data-mechanism="pump"] [data-mechanism-play]').click();
  await page.locator('[data-mechanism="pump"]').screenshot({ path: join(out, 'pump-paused.png') });
  pass('Swerve explosion/reassembly and pump motion/pause work');
  await scrollTo(page, '.footer');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-context]')].every(e => e.dataset.context === 'released'));
  await scrollTo(page, '[data-engineer-header]');
  await ready(page, '[data-module-media]');
  pass('Offscreen 3D contexts release and can load again');
  await desktop.context.close();

  const aborting = await makePage();
  await aborting.page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    window.__liveWorkers = new Set();
    window.Worker = class extends OriginalWorker {
      constructor(url, options) { super(url, options); this.url = String(url); window.__liveWorkers.add(this); }
      terminate() { window.__liveWorkers.delete(this); super.terminate(); }
    };
  });
  await aborting.page.goto(base + 'engineer/', { waitUntil: 'domcontentloaded' });
  await aborting.page.waitForFunction(() => [...window.__liveWorkers].some(w => w.url.includes('scan-edges.worker')));
  await scrollTo(aborting.page, '.footer');
  await aborting.page.waitForFunction(() => window.__liveWorkers.size === 0 && document.querySelector('[data-module-media]').dataset.context === 'released');
  await scrollTo(aborting.page, '[data-engineer-header]');
  await ready(aborting.page, '[data-module-media]');
  assert.equal(await aborting.page.evaluate(() => window.__liveWorkers.size), 0);
  pass('Leaving during edge computation terminates workers; returning still loads the header');
  await scrollTo(aborting.page, '[data-mechanism="pump"]');
  await ready(aborting.page, '[data-mechanism="pump"]');
  await aborting.page.route('**/picking.worker-*.js', async route => {
    await new Promise(resolve => setTimeout(resolve, 300));
    await route.continue().catch(() => {});
  });
  await aborting.page.locator('[data-mechanism="pump"] canvas').hover();
  await aborting.page.waitForFunction(() => [...window.__liveWorkers].some(w => w.url.includes('picking.worker')));
  await scrollTo(aborting.page, '.footer');
  await aborting.page.waitForFunction(() => window.__liveWorkers.size === 0);
  await aborting.page.unroute('**/picking.worker-*.js');
  await scrollTo(aborting.page, '[data-mechanism="pump"]');
  await ready(aborting.page, '[data-mechanism="pump"]');
  await aborting.page.locator('[data-mechanism="pump"] canvas').hover();
  await aborting.page.waitForFunction(() => document.querySelector('[data-mechanism="pump"] canvas').dataset.picking === 'ready');
  assert.equal(await aborting.page.evaluate(() => window.__liveWorkers.size), 0);
  pass('Picking loads on demand, cancels when leaving, and works after returning');
  await aborting.context.close();

  for (const [name, options] of [
    ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
    ['reduced', { reducedMotion: 'reduce' }],
  ]) {
    const view = await makePage(options);
    await view.page.goto(base + 'engineer/');
    await scrollTo(view.page, '[data-arm-explode]');
    await view.page.locator('[data-static-select]').selectOption('6');
    await view.page.waitForFunction(() => document.querySelector('[data-static-image]').complete);
    await view.page.locator('[data-static-select]').selectOption('overview');
    assert.ok(await view.page.locator('[data-static-image]').getAttribute('srcset'));
    await view.page.locator('[data-arm-explode]').screenshot({ path: join(out, `${name}-arm-fallback.png`) });
    await scrollTo(view.page, '[data-mechanism="swerve"]');
    await view.page.waitForTimeout(600);
    assert.equal(view.requests.some(url => /\.glb(?:\?|$)/.test(url)), false);
    assert.equal(await view.page.locator('canvas').evaluateAll(nodes => nodes.some(n => n.width > 300)), false);
    assert.ok(await view.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    if (name === 'reduced') assert.equal(view.requests.some(url => /\.mp4(?:\?|$)/.test(url)), false);
    pass(`${name}: responsive static arm details, no GLB download, no horizontal overflow`);
    await view.context.close();
  }

  for (const slug of ['', 'hero/', 'research/', 'en/', 'en/engineer/', 'en/hero/', 'en/research/']) {
    const view = await makePage({ reducedMotion: 'reduce' });
    await view.page.goto(base + slug);
    assert.equal(await view.page.locator('h1').count(), 1);
    assert.ok(await view.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await view.context.close();
  }
  pass('All Chinese/English page routes render without overflow');
  assert.deepEqual(report.errors, []);
  pass('No page errors or HTTP 4xx/5xx responses');
} catch (error) {
  report.failure = String(error);
  throw error;
} finally {
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
