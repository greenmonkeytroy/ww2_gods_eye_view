import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { DATA_CREDITS } from './data/dataCredits.js';
import { DataLayerManager } from './data/manager.js';
import {
  LAYER_STATE_REGISTRY,
  LayerStateCoordinator,
  REGISTERED_LAYER_IDS,
} from './data/layerState.js';
import { createWw2CountryLabelsLayer } from './data/ww2CountryLabels.js';
import {
  CCTV_THUMBNAIL_STYLE,
  DETECTION_STYLE,
  WORLD_OVERLAY_STYLE,
} from './overlays/worldOverlayTokens.js';
import { KEY_SETUP_KEYS } from './keySetupCore.mjs';
import {
  PERIOD_CLASS,
  PERIOD_CREDIT_KEYS,
  PERIOD_FONT_FACES,
  PERIOD_FONT_FAMILY,
  PERIOD_KEY_IDS,
  PERIOD_LAYER_IDS,
  PERIOD_STYLE_IDS,
  WW2_ONLY,
  applyPeriodMode,
  creditsForPeriod,
  filterRegistryForPeriod,
  layerInPeriod,
  loadPeriodFonts,
  periodKeyStatus,
  styleInPeriod,
  uiFontFamily,
} from './period.js';

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

test('the period build is on', () => {
  assert.equal(WW2_ONLY, true);
});

// ---- layers ---------------------------------------------------------------

test('only the two 1939-1945 layers belong to the period', () => {
  assert.deepEqual([...PERIOD_LAYER_IDS].sort(), ['local-ww2-naval', 'ww2-country-labels']);
  for (const id of PERIOD_LAYER_IDS) assert.equal(layerInPeriod(id), true, id);
  for (const id of REGISTERED_LAYER_IDS.filter((candidate) => !PERIOD_LAYER_IDS.includes(candidate))) {
    assert.equal(layerInPeriod(id), false, `${id} is a modern layer`);
  }
  assert.equal(layerInPeriod('flights'), false);
  assert.equal(layerInPeriod('made-up-layer'), false);
});

test('the period layers are real entries in the share-link codec', () => {
  for (const id of PERIOD_LAYER_IDS) {
    assert.ok(REGISTERED_LAYER_IDS.includes(id), `${id} has a codec token`);
  }
});

test('with the flag off every layer is allowed again', () => {
  assert.equal(layerInPeriod('flights', { enforce: false }), true);
  assert.equal(filterRegistryForPeriod(LAYER_STATE_REGISTRY, { enforce: false }).length, LAYER_STATE_REGISTRY.length);
});

test('the registry handed to finalizeRegistrations holds exactly the period layers', () => {
  const filtered = filterRegistryForPeriod(LAYER_STATE_REGISTRY);
  assert.deepEqual(filtered.map((entry) => entry.id).sort(), [...PERIOD_LAYER_IDS].sort());
});

// ---- styles ---------------------------------------------------------------

test('only the plain globe and film noir are selectable', () => {
  assert.deepEqual([...PERIOD_STYLE_IDS], ['normal', 'noir']);
  assert.equal(styleInPeriod('normal'), true);
  assert.equal(styleInPeriod('noir'), true);
  for (const modern of ['retro', 'surveillance', 'thermal', 'anime', 'snow']) {
    assert.equal(styleInPeriod(modern), false, modern);
    assert.equal(styleInPeriod(modern, { enforce: false }), true, `${modern} returns with the flag off`);
  }
});

test('every style button the markup ships is either allowed or hidden by the stylesheet', () => {
  const html = read('../index.html');
  const css = read('../style.css');
  const styles = [...html.matchAll(/class="style-btn[^"]*"\s+data-style="([a-z-]+)"/g)].map((match) => match[1]);
  assert.ok(styles.length >= 7, `found the style buttons (${styles.join(', ')})`);
  for (const style of styles) {
    if (PERIOD_STYLE_IDS.includes(style)) {
      assert.ok(
        !css.includes(`html.${PERIOD_CLASS} .style-btn[data-style="${style}"]`),
        `${style} must stay visible`,
      );
    } else {
      assert.ok(
        css.includes(`html.${PERIOD_CLASS} .style-btn[data-style="${style}"]`),
        `${style} needs a hide rule in style.css`,
      );
    }
  }
});

// ---- credits --------------------------------------------------------------

test('only credits for data the period build draws are listed', () => {
  const keys = new Set(DATA_CREDITS.map((credit) => credit.key));
  for (const key of PERIOD_CREDIT_KEYS) assert.ok(keys.has(key), `${key} is a real credit`);
  const listed = creditsForPeriod(DATA_CREDITS).map((credit) => credit.key);
  assert.deepEqual([...listed].sort(), [...PERIOD_CREDIT_KEYS].sort());
  assert.ok(!listed.includes('opensky'));
  assert.ok(!listed.includes('gdelt'));
  assert.equal(creditsForPeriod(DATA_CREDITS, { enforce: false }).length, DATA_CREDITS.length);
});

// ---- provider keys --------------------------------------------------------

test('the period key list names real keys', () => {
  const known = new Set(KEY_SETUP_KEYS.map((key) => key.id));
  for (const id of PERIOD_KEY_IDS) assert.ok(known.has(id), `${id} is a real provider key`);
});

test('the key dialog offers only basemap and voice keys and recounts the chip totals', () => {
  const status = {
    total: 8,
    setCount: 3,
    keys: [
      { id: 'google-maps', set: true },
      { id: 'openai', set: false },
      { id: 'aisstream', set: true },
      { id: 'firms', set: true },
      { id: 'tomtom', set: false },
      { id: 'cesium-ion', set: false },
      { id: 'opensky', set: false },
      { id: 'launch-library', set: false },
    ],
    extra: 'kept',
  };
  const period = periodKeyStatus(status);
  assert.deepEqual(period.keys.map((key) => key.id), ['google-maps', 'openai', 'cesium-ion']);
  assert.equal(period.total, 3);
  assert.equal(period.setCount, 1);
  assert.equal(period.extra, 'kept');
  assert.equal(status.keys.length, 8, 'the input is not mutated');
  assert.equal(periodKeyStatus(status, { enforce: false }), status);
  assert.equal(periodKeyStatus(null), null);
});

// ---- document class -------------------------------------------------------

test('applyPeriodMode marks the document and tolerates no document', () => {
  const calls = [];
  applyPeriodMode({ classList: { toggle: (name, on) => calls.push([name, on]) } });
  assert.deepEqual(calls, [[PERIOD_CLASS, true]]);
  applyPeriodMode({ classList: { toggle: (name, on) => calls.push([name, on]) } }, { enforce: false });
  assert.deepEqual(calls.at(-1), [PERIOD_CLASS, false]);
  assert.doesNotThrow(() => applyPeriodMode(null));
});

test('the stylesheet hides the modern panels only under the period class', () => {
  const css = read('../style.css');
  const block = css.slice(css.indexOf('1939-1945 period build'));
  for (const selector of [
    '#cctv-panel', '#global-context-panel', '#radio-panel', '#cockpit-hud', '#first-run-launcher',
    '#traffic-sync-chip', '#cctv-sync-chip', '#view-switcher',
  ]) {
    assert.ok(block.includes(`html.${PERIOD_CLASS} ${selector}`), `${selector} is hidden in period mode`);
  }
  // ui.js moves the DISPLAY panel (#pp-toggles) into #right-context-rail at
  // runtime, so hiding the rail would take the HUD, scope and bloom controls with it.
  assert.ok(
    !block.includes(`html.${PERIOD_CLASS} #right-context-rail`),
    'the right rail must stay: it carries the DISPLAY panel',
  );
  assert.ok(!/^#cctv-panel/m.test(block), 'no unscoped hide rule leaks into the modern build');
});

// ---- type -----------------------------------------------------------------

test('the period type is Baskerville with sensible fallbacks', () => {
  assert.match(PERIOD_FONT_FAMILY, /^"Libre Baskerville", Baskerville, /);
  assert.match(PERIOD_FONT_FAMILY, /"Baskerville Old Face"/);
  assert.match(PERIOD_FONT_FAMILY, /serif$/);
  assert.ok(PERIOD_FONT_FACES.every((face) => face.includes('"Libre Baskerville"')));
  assert.equal(PERIOD_FONT_FACES.length, 3, 'regular, bold and italic');
});

test('uiFontFamily swaps only in the period build', () => {
  const original = '"JetBrains Mono", monospace';
  assert.equal(uiFontFamily(original), PERIOD_FONT_FAMILY);
  assert.equal(uiFontFamily(original, { enforce: false }), original);
});

test('the stylesheet retypes the interface through the two font variables, inside the period block only', () => {
  const css = read('../style.css');
  const start = css.indexOf('1939-1945 period build');
  assert.ok(start > 0);
  // Upstream's own rules never mention the period face, so flipping the flag
  // off (which drops the html.period-ww2 class) restores JetBrains Mono and Inter.
  assert.ok(css.indexOf('Libre Baskerville') > start, 'the period type is defined only after the period marker');
  const rule = css.match(/html\.period-ww2 \{([^}]*)\}/);
  assert.ok(rule, 'there is an html.period-ww2 variable block');
  assert.ok(rule[1].includes(`--font-mono: ${PERIOD_FONT_FAMILY};`), '--font-mono matches PERIOD_FONT_FAMILY');
  assert.ok(rule[1].includes(`--font-sans: ${PERIOD_FONT_FAMILY};`), '--font-sans matches PERIOD_FONT_FAMILY');
  assert.doesNotMatch(rule[1], /(^|[;\s])font-family:/, 'variables only, so icon fonts are untouched');
});

test('the page requests the web font in every face the app draws', () => {
  const html = read('../index.html');
  assert.match(html, /family=Libre\+Baskerville:ital,wght@0,400;0,700;1,400/);
  assert.match(html, /family=Material\+Symbols\+Outlined/, 'the icon font is still loaded');
});

test('canvas cards and labels are drawn in the period type', () => {
  const styles = {
    ...WORLD_OVERLAY_STYLE,
    cctvTitle: CCTV_THUMBNAIL_STYLE.titleFont,
    detection: DETECTION_STYLE.font,
    detectionMicro: DETECTION_STYLE.microFont,
  };
  const fonts = Object.entries(styles).filter(([key]) => /font|Font|detection|cctvTitle/.test(key));
  assert.ok(fonts.length >= 10, 'found the font tokens');
  for (const [key, value] of fonts) {
    assert.ok(String(value).endsWith(PERIOD_FONT_FAMILY), `${key} uses the period stack: ${value}`);
    assert.doesNotMatch(String(value), /JetBrains|Inter/, `${key} keeps no upstream face`);
  }
});

test('the annotation renderers take their type from the gate', () => {
  assert.match(read('./annotations/screenAnnotationRenderer.js'), /uiFontFamily\('"JetBrains Mono"/);
  assert.match(read('./annotations/worldAnnotationRenderer.js'), /uiFontFamily\('"Inter"/);
});

test('loadPeriodFonts requests every face, tolerates a failing one, and is inert with the flag off', async () => {
  const requested = [];
  const fonts = {
    load(face) {
      requested.push(face);
      return face.startsWith('italic') ? Promise.reject(new Error('offline')) : Promise.resolve([{}]);
    },
  };
  const results = await loadPeriodFonts(fonts);
  assert.deepEqual(requested, [...PERIOD_FONT_FACES]);
  assert.equal(results.length, PERIOD_FONT_FACES.length, 'a failed face does not reject the whole load');

  requested.length = 0;
  assert.deepEqual(await loadPeriodFonts(fonts, { enforce: false }), []);
  assert.equal(requested.length, 0);
  assert.deepEqual(await loadPeriodFonts(null), [], 'no font set (non-browser host) is fine');
});

// ---- wiring guards --------------------------------------------------------
// The gate only works if every consumer reads it. These pin the call sites.

test('main.js registers layers and seals the codec through the gate', () => {
  const main = read('./main.js');
  assert.match(main, /applyPeriodMode\(\)/);
  assert.match(main, /layerInPeriod\(layer\.id\)/);
  assert.match(main, /finalizeRegistrations\(filterRegistryForPeriod\(LAYER_STATE_REGISTRY\)\)/);
  assert.doesNotMatch(main, /dataManager\.register\(flightsLayer\)/, 'no layer bypasses the gate');
  assert.match(main, /if \(WW2_ONLY\) return;/, 'the first-run launcher is skipped');
  assert.match(main, /const periodFontsLoaded = loadPeriodFonts\(\);/, 'the period type is requested at startup');
  assert.match(main, /governorRequestRender\('period-fonts'\)/, 'the map repaints once the type has arrived');
});

test('credits, keys and styles all read the gate', () => {
  assert.match(read('./data/dataCredits.js'), /creditsForPeriod\(DATA_CREDITS\)/);
  assert.match(read('./keySetup.js'), /periodKeyStatus\(nextStatus\)/);
  assert.match(read('./ui.js'), /if \(!styleInPeriod\(styleName\)\) return;/);
});

test('the HUD carries no spy-satellite copy or wall-clock readouts', () => {
  const hud = read('./hud.js');
  for (const term of ['KH11', 'NOFORN', 'SI-TK', 'NIIRS', 'toMGRS', 'PASS: DESC', '_formatUTC', '/api/openai/hud-summary']) {
    assert.ok(!hud.includes(term), `hud.js must not contain ${term}`);
  }
});

// ---- restoring with the gate on -------------------------------------------

function fakeHost() {
  return { setEntries() {}, setVisible() {}, clearSource() {} };
}

test('a share link that names modern layers restores only what this build registers', async () => {
  const navalCalls = [];
  const naval = {
    id: 'local-ww2-naval',
    name: 'WW2 Naval Battles',
    async init() { return true; },
    async enable() { navalCalls.push('enable'); return true; },
    async update() { return true; },
    async disable() { return true; },
  };
  const countries = createWw2CountryLabelsLayer({ overlayHost: fakeHost() });
  const manager = new DataLayerManager({});
  manager.register(naval);
  manager.register(countries);
  manager.finalizeRegistrations(filterRegistryForPeriod(LAYER_STATE_REGISTRY));

  const coordinator = new LayerStateCoordinator(manager, null, { storage: null });
  const results = await coordinator.start({
    shareLayerState: {
      enabledLayerIds: ['flights', 'satellites', 'local-ww2-naval'],
      options: { 'ww2-country-labels': { era: 'jun-1944' } },
    },
  });

  assert.deepEqual(results.map((result) => result.layerId).sort(), [...PERIOD_LAYER_IDS].sort());
  assert.ok(results.every((result) => result.succeeded), JSON.stringify(results));
  assert.deepEqual(navalCalls, ['enable'], 'the period layer named in the link came on');
  assert.deepEqual(countries.getParams(), { era: 'jun-1944' }, 'the saved era was restored');
  assert.ok(!manager.layers.has('flights'), 'the modern layer was never registered');
  coordinator.destroy();
});

test('a default session restores cleanly with only the period layers registered', async () => {
  const countries = createWw2CountryLabelsLayer({ overlayHost: fakeHost() });
  const naval = {
    id: 'local-ww2-naval',
    name: 'WW2 Naval Battles',
    async init() { return true; },
    async enable() { return true; },
    async update() { return true; },
    async disable() { return true; },
  };
  const manager = new DataLayerManager({});
  manager.register(naval);
  manager.register(countries);
  manager.finalizeRegistrations(filterRegistryForPeriod(LAYER_STATE_REGISTRY));
  const coordinator = new LayerStateCoordinator(manager, null, { storage: null });
  const results = await coordinator.start({ shareLayerState: null, allowLocalState: false });
  assert.deepEqual(results ?? [], [], 'nothing was saved, so nothing needs restoring');
  assert.equal(coordinator.lastRestoreResults.length, 0);
  coordinator.destroy();
});
