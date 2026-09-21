/**
 * 1939-1945 period gate.
 *
 * This build explores the Second World War only. Everything the upstream app
 * draws from the present day (live flights, ships, satellites, CCTV, traffic,
 * radio, spy-satellite telemetry, ...) is switched OFF here rather than
 * deleted: the modules, proxies and tests stay on disk, dormant, so upstream
 * fixes can still be merged and the change is reversible. Set `WW2_ONLY` to
 * false to get the full modern app back, with one exception: the HUD's
 * spy-satellite copy (classification banners, MGRS, GSD/NIIRS, the live clock,
 * the remote place summary) was rewritten in place in hud.js and is not gated.
 * The original is in git history at commit 7596522.
 *
 * One switch, read by:
 *  - main.js          which data layers register with the manager
 *  - layerState.js    (through main.js) which layers the share-link codec restores
 *  - dataCredits.js   which attribution credits are listed
 *  - keySetup.js      which provider keys the POWER UP dialog offers
 *  - ui.js            which visual styles can be selected
 *  - style.css        via the `period-ww2` class on <html>, which hides the
 *                     modern panels, chips and controls
 */

export const WW2_ONLY = true;

/** Class added to <html>; style.css scopes every hide rule to it. */
export const PERIOD_CLASS = 'period-ww2';

export const PERIOD = Object.freeze({
  from: '1939-01-01',
  to: '1945-12-31',
  label: '1939–1945',
});

/** Data layers that belong to the period. */
export const PERIOD_LAYER_IDS = Object.freeze([
  'local-ww2-naval',
  'ww2-country-labels',
]);

/** Visual styles that fit the period: the plain globe and film-noir grading. */
export const PERIOD_STYLE_IDS = Object.freeze(['normal', 'noir']);

/**
 * Provider keys still worth offering: the basemap (Google 3D Tiles, Cesium ion)
 * and the voice agent. Every key for a live modern feed is dropped.
 */
export const PERIOD_KEY_IDS = Object.freeze(['google-maps', 'cesium-ion', 'openai']);

/** Attribution credits for what the period build still draws. */
export const PERIOD_CREDIT_KEYS = Object.freeze([
  'reearth-terrain',
  'ww2-naval',
  'ww2-country-labels',
]);

/**
 * @param {string} layerId Data layer id.
 * @param {{enforce?: boolean}} [options] Test seam; defaults to the build flag.
 * @returns {boolean} Whether the layer belongs in this build.
 */
export function layerInPeriod(layerId, { enforce = WW2_ONLY } = {}) {
  return !enforce || PERIOD_LAYER_IDS.includes(layerId);
}

/**
 * Trim the share-link layer registry to the layers this build registers, so
 * `DataLayerManager.finalizeRegistrations` sees exactly what exists.
 * @param {Array<{id: string}>} registry Full layer-state registry.
 * @param {{enforce?: boolean}} [options]
 * @returns {Array<{id: string}>}
 */
export function filterRegistryForPeriod(registry, { enforce = WW2_ONLY } = {}) {
  return registry.filter((entry) => layerInPeriod(entry.id, { enforce }));
}

/**
 * @param {string} styleName Visual style key.
 * @param {{enforce?: boolean}} [options]
 * @returns {boolean} Whether the style may be selected.
 */
export function styleInPeriod(styleName, { enforce = WW2_ONLY } = {}) {
  return !enforce || PERIOD_STYLE_IDS.includes(styleName);
}

/**
 * @param {Array<{key: string}>} credits Attribution entries.
 * @param {{enforce?: boolean}} [options]
 * @returns {Array<{key: string}>} The credits for data this build draws.
 */
export function creditsForPeriod(credits, { enforce = WW2_ONLY } = {}) {
  return enforce ? credits.filter((credit) => PERIOD_CREDIT_KEYS.includes(credit.key)) : credits;
}

/**
 * Restrict a provider-key status payload (from /api/setup/status) to the keys
 * the period build offers, recounting the totals the chip label is built from.
 * @param {{keys?: Array<{id: string, set?: boolean}>, total?: number, setCount?: number}} status
 * @param {{enforce?: boolean}} [options]
 * @returns {object} A status with only in-period keys and consistent counts.
 */
export function periodKeyStatus(status, { enforce = WW2_ONLY } = {}) {
  if (!enforce || !status) return status;
  const keys = (status.keys || []).filter((key) => PERIOD_KEY_IDS.includes(key.id));
  return {
    ...status,
    keys,
    total: keys.length,
    setCount: keys.filter((key) => key.set).length,
  };
}

/**
 * Mark the document so style.css can hide the modern UI. Safe to call with no
 * element (tests, non-browser hosts).
 * @param {{classList?: {toggle: function(string, boolean): void}}|null} [root]
 * @param {{enforce?: boolean}} [options]
 */
export function applyPeriodMode(
  root = typeof document === 'undefined' ? null : document.documentElement,
  { enforce = WW2_ONLY } = {},
) {
  root?.classList?.toggle(PERIOD_CLASS, enforce);
}
