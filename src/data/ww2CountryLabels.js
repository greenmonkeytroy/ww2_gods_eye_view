import * as Cesium from 'cesium';
import {
  clearOverlaySource,
  setOverlayEntries,
  setOverlaySourceVisible,
} from '../overlays/worldOverlay.js';
import {
  COUNTRY_LABELS,
  DEFAULT_ERA_ID,
  ERAS,
} from './local_data/ww2Countries/labels.js';

/**
 * WW2 country labels — era-correct names for 1939-1945.
 *
 * A static, dated label set (see local_data/ww2Countries/README.md) drawn
 * through the shared world-overlay host as ambient labels. The visitor picks
 * one of a handful of snapshot dates from chips on the layer's panel row; the
 * layer resolves every label's name and status for that date and republishes.
 * No network, no per-frame work: entries change only on enable or era change.
 */

export const WW2_COUNTRY_LABELS_LAYER_ID = 'ww2-country-labels';
export const COUNTRY_LABEL_OVERLAY_SOURCE_ID = 'ww2-country-labels';
export const COUNTRY_LABEL_COHORT_LIMIT = 200;
export const COUNTRY_LABEL_COLLISION_CAPACITY = 64;
/** Country names stop being useful once the camera is street-level close. */
export const COUNTRY_LABEL_MIN_ALTITUDE_M = 150_000;

const LABEL_ACCENT = '#e8dcc0';
const MAX_RANK = 5;

const DEFAULT_OVERLAY_HOST = Object.freeze({
  setEntries: setOverlayEntries,
  setVisible: setOverlaySourceVisible,
  clearSource: clearOverlaySource,
});

/**
 * Find the period of a label in force on an ISO date (YYYY-MM-DD).
 * `from` is inclusive and `to` is exclusive; ISO dates compare as strings.
 * @param {{periods: Array<{from: string|null, to: string|null}>}} label
 * @param {string} isoDate
 * @returns {object|null} The matching period, or null when the label does not exist then.
 */
export function periodAt(label, isoDate) {
  for (const period of label.periods) {
    if ((period.from === null || isoDate >= period.from)
      && (period.to === null || isoDate < period.to)) {
      return period;
    }
  }
  return null;
}

/**
 * Compose the single detail line shown under a label's name: the political
 * status, then "now X" when the present-day name differs from the era name.
 * @param {string} name Era name shown as the title.
 * @param {string|null} status Short political status.
 * @param {string|null} modern Present-day name.
 * @returns {string}
 */
export function labelDetail(name, status, modern) {
  const parts = [];
  if (status) parts.push(status);
  if (modern && modern.toLocaleLowerCase() !== String(name).toLocaleLowerCase()) {
    parts.push(`now ${modern}`);
  }
  return parts.join(' · ');
}

/**
 * Resolve one label to what it reads on a date.
 * @param {object} label Dataset label.
 * @param {string} isoDate ISO date.
 * @returns {{id: string, rank: number, name: string, status: string|null,
 *   modern: string|null, detail: string, lat: number, lon: number}|null}
 */
export function resolveCountryLabel(label, isoDate) {
  const period = periodAt(label, isoDate);
  if (!period) return null;
  const modern = Object.hasOwn(period, 'modern') ? period.modern : label.modern;
  return {
    id: label.id,
    rank: label.rank,
    name: period.name,
    status: period.status,
    modern: modern ?? null,
    detail: labelDetail(period.name, period.status, modern),
    lat: Number.isFinite(period.lat) ? period.lat : label.lat,
    lon: Number.isFinite(period.lon) ? period.lon : label.lon,
  };
}

/**
 * Every label that exists on a date, resolved for display.
 * @param {Array<object>} labels Dataset labels.
 * @param {string} isoDate ISO date.
 * @returns {Array<object>} Resolved labels, dataset order preserved.
 */
export function countryLabelsAtDate(labels, isoDate) {
  const resolved = [];
  for (const label of labels) {
    const record = resolveCountryLabel(label, isoDate);
    if (record) resolved.push(record);
  }
  return resolved;
}

/**
 * @param {unknown} value Candidate era id.
 * @param {Array<{id: string}>} [eras] Known eras.
 * @returns {string|null} The canonical era id, or null when unknown.
 */
export function normalizeEraId(value, eras = ERAS) {
  const candidate = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return eras.some((era) => era.id === candidate) ? candidate : null;
}

/**
 * Build the world-overlay entry for one resolved label. Higher-ranked
 * countries win screen-space collisions; sub-150 km camera altitudes hide
 * the whole set.
 *
 * This is a `card`, not a `label`: the compact label variant measures its
 * detail lines but never paints them, and the status line is half the point.
 * Local infrastructure layers use the same variant for name-plus-detail.
 * @param {object} record Resolved label from `resolveCountryLabel`.
 * @param {Cesium.Cartesian3} position Ground anchor.
 * @returns {object}
 */
export function createCountryLabelOverlayEntry(record, position) {
  return {
    id: record.id,
    position,
    variant: 'card',
    title: record.name.toLocaleUpperCase(),
    details: record.detail ? [record.detail] : [],
    accent: LABEL_ACCENT,
    priority: (MAX_RANK + 1 - record.rank) * 1000,
    collisionGroup: 'ambient-card',
    interactive: false,
    edgeFade: 'keyhole',
    horizonCull: true,
    terrainOcclusion: false,
    minAltitude: COUNTRY_LABEL_MIN_ALTITUDE_M,
    distanceScale: {
      near: 500_000,
      nearValue: 1.1,
      far: 20_000_000,
      farValue: 0.8,
    },
    gapPx: 6,
    placement: 'above',
  };
}

/**
 * Create the layer. Dependencies are injectable so tests can pass a fake
 * overlay host and a small hand-built dataset.
 * @param {object} [options]
 * @param {object} [options.overlayHost] `{ setEntries, setVisible, clearSource }`.
 * @param {Array<object>} [options.labels] Dataset labels.
 * @param {Array<object>} [options.eras] Snapshot eras.
 * @param {string} [options.defaultEraId] Era used until one is chosen.
 * @param {function(): number} [options.now] Clock, for `lastUpdate`.
 * @returns {object} A data-layer module.
 */
export function createWw2CountryLabelsLayer({
  overlayHost = DEFAULT_OVERLAY_HOST,
  labels = COUNTRY_LABELS,
  eras = ERAS,
  defaultEraId = DEFAULT_ERA_ID,
  now = () => Date.now(),
} = {}) {
  let _eraId = normalizeEraId(defaultEraId, eras) || eras[0].id;
  let _records = [];
  let _enabled = false;
  let _lastUpdate = null;

  const currentEra = () => eras.find((era) => era.id === _eraId);

  function resolveRecords() {
    _records = countryLabelsAtDate(labels, currentEra().date);
  }

  function publish() {
    resolveRecords();
    _lastUpdate = now();
    if (!_enabled) return;
    overlayHost.setEntries(
      COUNTRY_LABEL_OVERLAY_SOURCE_ID,
      _records.map((record) => createCountryLabelOverlayEntry(
        record,
        Cesium.Cartesian3.fromDegrees(record.lon, record.lat),
      )),
      {
        cohortLimit: COUNTRY_LABEL_COHORT_LIMIT,
        collisionCapacity: COUNTRY_LABEL_COLLISION_CAPACITY,
        moving: false,
      },
    );
  }

  resolveRecords();

  return {
    id: WW2_COUNTRY_LABELS_LAYER_ID,
    name: 'WW2 Country Labels',
    icon: '⚑',
    source: 'Historical',
    updateInterval: 0,

    init() {
      overlayHost.setVisible(COUNTRY_LABEL_OVERLAY_SOURCE_ID, false);
    },

    enable() {
      _enabled = true;
      overlayHost.setVisible(COUNTRY_LABEL_OVERLAY_SOURCE_ID, true);
      publish();
    },

    disable() {
      _enabled = false;
      overlayHost.clearSource(COUNTRY_LABEL_OVERLAY_SOURCE_ID);
      overlayHost.setVisible(COUNTRY_LABEL_OVERLAY_SOURCE_ID, false);
    },

    update() {
      return true;
    },

    destroy() {
      _enabled = false;
      overlayHost.clearSource(COUNTRY_LABEL_OVERLAY_SOURCE_ID);
      overlayHost.setVisible(COUNTRY_LABEL_OVERLAY_SOURCE_ID, false);
    },

    /**
     * Apply runtime parameters. Also called before init/enable when a saved or
     * shared era is restored, so it must work without a viewer.
     * @param {{era?: string}} params Requested parameters.
     * @returns {boolean} False when the requested era is unknown.
     */
    setParams(params = {}) {
      if (!Object.hasOwn(params, 'era')) return true;
      const requested = normalizeEraId(params.era, eras);
      if (!requested) return false;
      if (requested !== _eraId) {
        _eraId = requested;
        publish();
      }
      return true;
    },

    /** @returns {{era: string}} Current runtime parameters. */
    getParams() {
      return { era: _eraId };
    },

    /**
     * Panel-row era chips (DataLayerManager row-controls contract). Each chip
     * declares the params to apply; the manager owns the write.
     * @returns {{chips: Array<object>, legend: Array<object>}}
     */
    getRowControls() {
      return {
        chips: eras.map((era) => ({
          id: `era-${era.id}`,
          label: era.label,
          active: era.id === _eraId,
          state: era.id === _eraId ? 'active' : 'idle',
          title: era.caption,
          params: { era: era.id },
        })),
        legend: [],
      };
    },

    getStats() {
      const era = currentEra();
      return {
        count: _records.length,
        lastUpdate: _lastUpdate,
        error: null,
        loadingLabel: era.dateText,
      };
    },
  };
}

const ww2CountryLabelsLayer = createWw2CountryLabelsLayer();

export default ww2CountryLabelsLayer;
