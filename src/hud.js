/**
 * @module hud
 * @description War-atlas HUD overlay.
 *
 * Draws a map-sheet readout over the Cesium canvas: a 1939-1945 banner, the
 * camera's latitude/longitude, altitude above mean sea level, and a one-line
 * summary of the view (band, sector, region, altitude, window size).
 *
 * The period build carries no spy-satellite telemetry (no classification
 * banners, grid references, imagery-quality metrics or orbit counters), no
 * wall-clock time and no remote summary of what the basemap shows today:
 * everything on it comes from the camera itself. Three layout variants
 * (tactical, operator, minimal) and a per-style color theme are driven by CSS
 * custom properties.
 */

import * as Cesium from 'cesium';
import { composeLocalityTag } from './hudLocality.js';
import { ellipsoidalToMslDisplayM, ensureGeoidReady, geoidHeight } from './data/geoid.js';
import { PERIOD } from './period.js';

/** Color palettes keyed by shader mode; applied as CSS custom properties. */
const HUD_COLORS = {
  surveillance: { main: 'rgba(51, 255, 51, 0.8)',  glow: 'rgba(51, 255, 51, 0.5)',  border: 'rgba(51, 255, 51, 0.2)' },
  thermal:      { main: 'rgba(255, 255, 255, 0.7)', glow: 'rgba(255, 255, 255, 0.4)', border: 'rgba(255, 255, 255, 0.15)' },
  retro:        { main: 'rgba(255, 170, 0, 0.8)',   glow: 'rgba(255, 170, 0, 0.5)',   border: 'rgba(255, 170, 0, 0.2)' },
  _default:     { main: 'rgba(0, 255, 255, 0.6)',   glow: 'rgba(0, 255, 255, 0.4)',   border: 'rgba(0, 255, 255, 0.15)' },
};

/** Shader modes that automatically show the HUD overlay. */
const MILITARY_STYLES = new Set(['retro', 'surveillance', 'thermal']);

/** Allowed HUD layout variants. */
const HUD_VARIANTS = new Set(['tactical', 'operator', 'minimal']);

/**
 * How often the summary line is recomposed. It used to wait on camera-settle
 * events and a slow remote refresh; with a local line the cheap answer is to
 * repaint it every second, so it can never lag a long flight.
 */
const HUD_SUMMARY_INTERVAL_MS = 1000;

/** Period-appropriate banner text (replaces the spy-satellite classification lines). */
const HUD_BANNER = `WAR ATLAS // ${PERIOD.label}`;
const HUD_SHEET = 'SITUATION MAP';
const HUD_SYSTEM = 'GLOBAL THEATRE MAP';

/**
 * Cell size (degrees) for the ALT readout's geoid-undulation cache. N changes
 * by well under a metre across 0.01° (~1.1 km), so one lookup per cell keeps
 * the 4 Hz telemetry tick off the EGM96 grid without a visible step.
 */
const HUD_GEOID_CELL_DEG = 0.01;

/**
 * Full-screen war-atlas HUD overlay rendered on top of the Cesium canvas.
 *
 * Displays a map-sheet banner, latitude/longitude and altitude readouts, and
 * a one-line summary of the view. All values derive from the camera position
 * and update on independent timer cadences.
 */
export class IntelHUD {
  /**
   * @param {Cesium.Viewer} viewer - The Cesium Viewer instance used for
   *   camera telemetry and coordinate derivation.
   */
  constructor(viewer) {
    this.viewer = viewer;
    this._visible = false;
    this._autoMode = true; // auto show/hide based on style
    this._currentStyle = 'normal';
    this._el = null;
    this._variant = 'tactical';
    this._recBlinkState = true;
    this._updateInterval = null;
    this._recBlinkInterval = null;
    this._summaryInterval = null;
    this._summaryTypingInterval = null;
    this._latestMetrics = null;
    this._dataManager = null;
    this._dataManagerUnsubscribe = null;
    this._summaryDirty = true;
    this._summaryRevision = 0;
    // One-shot guard so the very first summary lands immediately instead of
    // showing "Awaiting telemetry..." until the next tick.
    this._firstMetricsShown = false;
    // ALT readout datum: the camera height Cesium reports is ELLIPSOIDAL, the
    // number a viewer reads is MSL. N comes from the same lazy ~2.7 MB EGM96
    // chunk the flight layers use — requested on the first telemetry tick of a
    // VISIBLE HUD, never at construction, so a hidden HUD costs nothing — and
    // cached per coarse cell. Until it resolves, or if it never does,
    // `ellipsoidalToMslDisplayM` passes the raw height straight through.
    this._geoidRequested = false;
    this._geoidReady = false;
    this._geoidCellKey = null;
    this._geoidN = null;
    // Whether the LAST painted tick actually had N. The grid resolves mid-
    // session, so this flips once — and both altitude readouts have to move
    // together when it does (see the repaint in _updateCameraData).
    this._geoidCorrectionApplied = false;
    this._onCameraMoveEnd = () => {
      this._markSummaryDirty();
      // The 250 ms telemetry timer must not leave the previous view on screen
      // after a long flight: refresh the camera context synchronously on settle.
      if (this._visible) {
        this._updateCameraData();
        this._setSummaryText(this._composeSummary(), false);
      }
    };

    this._buildDOM();
    this.viewer.camera.moveEnd.addEventListener(this._onCameraMoveEnd);
    this._startTimers();
  }

  /**
   * Construct the HUD DOM structure inside the existing `#intel-hud` element.
   * Populates corner brackets, the map-sheet banner, position and altitude
   * readouts, and the bottom summary bar.
   */
  _buildDOM() {
    this._el = document.getElementById('intel-hud');
    if (!this._el) return;

    this._el.innerHTML = `
      <div class="hud-top-bar">
        <span class="hud-top-bar-left">${HUD_BANNER}</span>
        <span class="hud-top-bar-center">${HUD_SHEET}</span>
        <span class="hud-top-bar-right">PAGE 1/1</span>
      </div>

      <div class="hud-corner hud-top-left">
        <div class="hud-bracket">┌</div>
        <div class="hud-content">
          <div class="hud-classification">${HUD_BANNER}</div>
          <div class="hud-system">${HUD_SYSTEM}</div>
          <div class="hud-mode" id="hud-mode">NORMAL</div>
          <div class="hud-summary-wrap">
            <div class="hud-summary-label">SUMMARY</div>
            <div class="hud-summary" id="hud-summary">Awaiting position...</div>
          </div>
        </div>
      </div>

      <div class="hud-corner hud-top-right">
        <div class="hud-content" style="text-align:right">
          <div class="hud-rec"><span id="hud-rec-dot">●</span> <span id="hud-timestamp">${PERIOD.label}</span></div>
        </div>
        <div class="hud-bracket">┐</div>
      </div>

      <div class="hud-corner hud-bottom-left">
        <div class="hud-bracket">└</div>
        <div class="hud-content">
          <div id="hud-latlon">--°--'--"N ---°--'--"W</div>
        </div>
      </div>

      <div class="hud-corner hud-bottom-right">
        <div class="hud-content" style="text-align:right">
          <div id="hud-alt">ALT: --m</div>
        </div>
        <div class="hud-bracket">┘</div>
      </div>

      <div class="hud-bottom-bar">
        <span id="hud-bottom-line">LAT: --  LON: --</span>
      </div>
    `;
    this._el.dataset.variant = this._variant;
  }

  /**
   * Start the periodic update timers (REC-dot blink and camera telemetry).
   * Timers run independently at different cadences and are cleaned up in
   * {@link destroy}.
   */
  _startTimers() {
    // Marker blink — every 800ms
    this._recBlinkInterval = setInterval(() => {
      this._recBlinkState = !this._recBlinkState;
      const dot = document.getElementById('hud-rec-dot');
      if (dot) dot.style.visibility = this._recBlinkState ? 'visible' : 'hidden';
    }, 800);

    // Camera-derived data — 4 updates/second (250ms)
    this._updateInterval = setInterval(() => {
      if (!this._visible) return;
      this._updateCameraData();
    }, 250);

    // Summary line — once a second, repainted only when the camera has moved.
    this._summaryInterval = setInterval(() => {
      if (!this._visible || !this._latestMetrics) return;
      this._setSummaryText(this._composeSummary(), false);
    }, HUD_SUMMARY_INTERVAL_MS);
  }

  /**
   * Geoid undulation N at the camera subpoint, memoized per coarse cell.
   * @param {number} latDeg - Camera latitude in decimal degrees.
   * @param {number} lonDeg - Camera longitude in decimal degrees.
   * @returns {number|null} N in metres, or null while the grid is unavailable.
   */
  _geoidUndulationM(latDeg, lonDeg) {
    if (!this._geoidReady) {
      if (!this._geoidRequested) {
        this._geoidRequested = true;
        ensureGeoidReady()
          .then(() => { this._geoidReady = true; })
          .catch(() => { /* readout falls back to the uncorrected height */ });
      }
      return null;
    }
    const key = `${Math.round(latDeg / HUD_GEOID_CELL_DEG)}:${Math.round(lonDeg / HUD_GEOID_CELL_DEG)}`;
    if (key !== this._geoidCellKey) {
      try {
        this._geoidN = geoidHeight(latDeg, lonDeg);
      } catch {
        this._geoidN = null;
      }
      this._geoidCellKey = key;
    }
    return Number.isFinite(this._geoidN) ? this._geoidN : null;
  }

  /**
   * Derive the camera-based readouts and push them to the DOM. Reads the
   * viewer camera's cartographic position and computes lat/lon in degrees,
   * minutes and seconds plus altitude above mean sea level. Stores results in
   * {@link _latestMetrics}.
   */
  _updateCameraData() {
    const camera = this.viewer.camera;
    const cartographic = camera.positionCartographic;
    if (!cartographic) return;

    const lonDeg = Cesium.Math.toDegrees(cartographic.longitude);
    const latDeg = Cesium.Math.toDegrees(cartographic.latitude);
    const altM = cartographic.height;
    const latDMS = this._toDMS(latDeg, 'lat');
    const lonDMS = this._toDMS(lonDeg, 'lon');

    // Lat/Lon DMS
    const llEl = document.getElementById('hud-latlon');
    if (llEl) llEl.textContent = `${latDMS} ${lonDMS}`;
    const bottomEl = document.getElementById('hud-bottom-line');
    if (bottomEl) {
      bottomEl.textContent = `LAT: ${latDMS}  LON: ${lonDMS}`;
    }

    // Altitude — reported as height above MEAN SEA LEVEL. `altM` is the raw
    // ellipsoidal camera height, which reads far below zero wherever the geoid
    // sits under the ellipsoid: a cockpit parked on the SFO deck (N ≈ -32 m)
    // showed "ALT: -15m", and JFK "ALT: -18m". Subtracting N restores the
    // number a viewer expects without touching the camera or any render path.
    const altEl = document.getElementById('hud-alt');
    const geoidN = this._geoidUndulationM(latDeg, lonDeg);
    const altMslM = ellipsoidalToMslDisplayM(altM, geoidN);
    if (altEl) altEl.textContent = `ALT: ${Math.round(altMslM)}m`;

    // `altM` stays the raw ellipsoidal camera height (the view band's
    // thresholds were tuned against it). `altMslM` is the ADDITIVE display
    // datum — the only one any readout string should print.
    this._latestMetrics = {
      latDeg,
      lonDeg,
      altM,
      altMslM,
    };

    // First time we have real telemetry: replace the "Awaiting position..."
    // placeholder with the summary line instantly, so there is always
    // meaningful context on screen.
    if (!this._firstMetricsShown) {
      this._firstMetricsShown = true;
      this._setSummaryText(this._composeSummary(), false);
    }

    // The EGM96 grid lands mid-session, and the corner readout picks it up on
    // the very next telemetry tick. The summary line has no such cadence — it
    // repaints on camera settle — so without this the corner reads `ALT: 17m`
    // beside a summary still reading `ALT -15M`. Repaint the line in the SAME
    // tick the correction turns on (or off, if a lookup starts failing).
    const geoidCorrectionApplied = Number.isFinite(geoidN);
    if (geoidCorrectionApplied !== this._geoidCorrectionApplied) {
      this._geoidCorrectionApplied = geoidCorrectionApplied;
      this._markSummaryDirty();
      this._setSummaryText(this._composeSummary(), false);
    }
  }

  /**
   * Convert a decimal-degree value to a degrees-minutes-seconds string.
   * @param {number} decimal - Coordinate in decimal degrees.
   * @param {'lat'|'lon'} type - Axis selector; controls hemisphere letter
   *   and zero-padding width (2 digits for lat, 3 for lon).
   * @returns {string} Formatted DMS string, e.g. `"38°53'23.10"N"`.
   */
  _toDMS(decimal, type) {
    const abs = Math.abs(decimal);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = ((minFloat - min) * 60).toFixed(2);

    let dir;
    if (type === 'lat') dir = decimal >= 0 ? 'N' : 'S';
    else dir = decimal >= 0 ? 'E' : 'W';

    const degStr = type === 'lon' ? String(deg).padStart(3, '0') : String(deg).padStart(2, '0');
    return `${degStr}°${String(min).padStart(2, '0')}'${String(sec).padStart(5, '0')}"${dir}`;
  }

  /**
   * Classify the camera altitude into a named observation band.
   * @param {number} altM - Camera altitude in meters.
   * @returns {'STREET'|'CITY'|'METRO'|'REGIONAL'|'GLOBAL'} Band label.
   */
  _viewBand(altM) {
    if (altM < 1200) return 'STREET';
    if (altM < 5000) return 'CITY';
    if (altM < 30000) return 'METRO';
    if (altM < 250000) return 'REGIONAL';
    return 'GLOBAL';
  }

  /**
   * Return a coarse geographic region label based on lat/lon bounding boxes.
   * @param {number} lat - Latitude in decimal degrees.
   * @param {number} lon - Longitude in decimal degrees.
   * @returns {string} Region name (e.g. `"EUROPE"`, `"NORTHERN OCEANIC GRID"`).
   */
  _regionLabel(lat, lon) {
    if (lat > 72) return 'ARCTIC';
    if (lat < -60) return 'ANTARCTIC';
    if (lat >= 5 && lat <= 83 && lon >= -170 && lon <= -50) return 'NORTH AMERICA';
    if (lat >= -60 && lat <= 15 && lon >= -90 && lon <= -30) return 'SOUTH AMERICA';
    if (lat >= 34 && lat <= 72 && lon >= -25 && lon <= 45) return 'EUROPE';
    if (lat >= -35 && lat <= 38 && lon >= -20 && lon <= 55) return 'AFRICA';
    if (lat >= 5 && lat <= 80 && lon >= 45 && lon <= 180) return 'ASIA';
    if (lat >= -50 && lat <= 5 && lon >= 110 && lon <= 180) return 'OCEANIA';
    return lat >= 0 ? 'NORTHERN OCEANIC GRID' : 'SOUTHERN OCEANIC GRID';
  }

  /**
   * Compute the approximate width and height (in km) of the camera's
   * current view rectangle on the ground.
   * @param {number} latDeg - Center latitude in decimal degrees (for
   *   longitude-to-km cosine correction).
   * @returns {{ widthKm: number, heightKm: number }|null} View window
   *   dimensions, or null if the view rectangle cannot be computed.
   */
  _viewWindowKm(latDeg) {
    const rect = this.viewer.camera.computeViewRectangle();
    if (!rect) return null;
    const north = Cesium.Math.toDegrees(rect.north);
    const south = Cesium.Math.toDegrees(rect.south);
    let east = Cesium.Math.toDegrees(rect.east);
    let west = Cesium.Math.toDegrees(rect.west);
    let lonSpan = Math.abs(east - west);
    // Handle antimeridian wrap: if span exceeds 180 deg, take the shorter arc
    if (lonSpan > 180) lonSpan = 360 - lonSpan;
    const latSpan = Math.abs(north - south);
    // 111 km/deg is the approximate surface distance per degree of latitude;
    // longitude distance is scaled by cos(lat) to account for meridian convergence.
    const widthKm = Math.max(0, lonSpan * 111 * Math.cos(Cesium.Math.toRadians(latDeg)));
    const heightKm = Math.max(0, latSpan * 111);
    return { widthKm, heightKm };
  }

  /**
   * Build the one-line summary string from the latest camera metrics.
   * Includes mode, observation band, lat/lon sector, region, altitude, view
   * window dimensions, and local timezone. Nothing here names a present-day
   * landmark: the sector is coordinates only.
   * @returns {string} Formatted summary line for the HUD summary readout.
   */
  _composeSummary() {
    const m = this._latestMetrics;
    if (!m) return 'Awaiting position...';

    const modeEl = document.getElementById('hud-mode');
    const modeLabel = modeEl?.textContent || 'NORMAL';
    const region = this._regionLabel(m.latDeg, m.lonDeg);
    const band = this._viewBand(m.altM);
    const window = this._viewWindowKm(m.latDeg);
    // Rough local timezone from longitude (15 deg per hour)
    const utcOffset = Math.round(m.lonDeg / 15);
    const localTag = `UTC${utcOffset >= 0 ? '+' : ''}${utcOffset}`;
    // Same MSL datum as the corner ALT readout — the two are on screen
    // together, so they must never disagree. The view band above deliberately
    // keeps the ellipsoidal height: its thresholds were tuned against it.
    const altDisplayM = Number.isFinite(m.altMslM) ? m.altMslM : m.altM;
    const altTag = altDisplayM >= 1000
      ? `${(altDisplayM / 1000).toFixed(1)}KM`
      : `${Math.round(altDisplayM)}M`;
    const winTag = window
      ? `${Math.max(1, Math.round(window.widthKm))}x${Math.max(1, Math.round(window.heightKm))}KM`
      : 'N/A';
    // No catalogue of present-day landmarks in this build: the sector tag is
    // always the lat/lon fallback.
    const localityTag = composeLocalityTag(null, m.latDeg, m.lonDeg);

    return `${modeLabel} ${band} ${localityTag} | ${region} | ALT ${altTag} | WINDOW ${winTag} | ${localTag}`;
  }

  /**
   * Animate the summary text into the DOM using a typewriter effect
   * (2 characters every 24ms).
   * @param {string} text - Full summary string to type out.
   */
  _typeSummary(text) {
    const el = document.getElementById('hud-summary');
    if (!el) return;
    clearInterval(this._summaryTypingInterval);
    let index = 0;
    el.textContent = '';
    this._summaryTypingInterval = setInterval(() => {
      index += 2;
      if (index >= text.length) {
        el.textContent = text;
        clearInterval(this._summaryTypingInterval);
        this._summaryTypingInterval = null;
        return;
      }
      el.textContent = text.slice(0, index);
    }, 24);
  }

  /**
   * Refresh the summary readout. Optionally animates the text via typewriter.
   * The line is composed from the camera alone: the period build makes no
   * remote request, because a summary of what today's basemap shows (modern
   * place names, streets, points of interest) has no place in a 1939-1945 atlas.
   * @param {boolean} [animate=false] - If true, types the summary character
   *   by character; otherwise sets it instantly.
   * @param {boolean} [force=false] - Repaint even when nothing changed.
   */
  _updateSummary(animate = false, force = false) {
    if (this._latestMetrics && !force && !this._summaryDirty) return;
    this._summaryDirty = false;
    this._setSummaryText(this._composeSummary(), animate);
  }

  _setSummaryText(text, animate) {
    if (animate) {
      this._typeSummary(text);
      return;
    }
    const el = document.getElementById('hud-summary');
    if (el) el.textContent = text;
  }

  _markSummaryDirty() {
    this._summaryDirty = true;
    this._summaryRevision++;
  }

  // ── Public API ──────────────────────────

  /**
   * React to a shader-style change. Updates the mode label, HUD color
   * scheme (via CSS custom properties), and auto-shows/hides the overlay
   * when in auto mode.
   * @param {string} styleName - Active style key (e.g. `'surveillance'`,
   *   `'thermal'`, `'retro'`, `'normal'`).
   */
  onStyleChange(styleName) {
    this._currentStyle = styleName;

    // Update mode label
    const modeEl = document.getElementById('hud-mode');
    if (modeEl) {
      const modeNames = { surveillance: 'NVG', thermal: 'FLIR', retro: 'CRT' };
      modeEl.textContent = modeNames[styleName] || styleName.toUpperCase();
    }
    // Update color scheme
    const colors = HUD_COLORS[styleName] || HUD_COLORS._default;
    if (this._el) {
      this._el.style.setProperty('--hud-color', colors.main);
      this._el.style.setProperty('--hud-glow', colors.glow);
      this._el.style.setProperty('--hud-border', colors.border);
    }

    // Auto show/hide
    if (this._autoMode) {
      if (MILITARY_STYLES.has(styleName)) {
        this.show();
      } else {
        this.hide();
      }
    }
  }

  /** Make the HUD visible and immediately refresh all readouts. */
  show() {
    this._visible = true;
    if (this._el) this._el.classList.add('active');
    this._updateCameraData(); // immediate update
    this._markSummaryDirty();
    void this._updateSummary(false, true);
  }

  /** Hide the HUD overlay. */
  hide() {
    this._visible = false;
    if (this._el) this._el.classList.remove('active');
  }

  /** Toggle HUD visibility and disable auto-mode (user override). */
  toggle() {
    if (this._visible) {
      this._autoMode = false; // user override
      this.hide();
    } else {
      this._autoMode = false;
      this.show();
    }
  }

  /**
   * Explicit HUD mode control for scene/recording playback.
   * @param {'auto'|'on'|'off'} mode - `'auto'` re-enables style-driven
   *   show/hide; `'on'`/`'off'` force visibility and disable auto-mode.
   */
  setMode(mode) {
    if (mode === 'auto') {
      this._autoMode = true;
      this.onStyleChange(this._currentStyle);
      return;
    }

    this._autoMode = false;
    if (mode === 'on') this.show();
    else this.hide();
  }

  /**
   * Switch the HUD layout variant. Falls back to `'tactical'` if the
   * name is unrecognized.
   * @param {string} variantName - One of `'tactical'`, `'operator'`, `'minimal'`.
   */
  setVariant(variantName) {
    const normalized = String(variantName || '').toLowerCase();
    this._variant = HUD_VARIANTS.has(normalized) ? normalized : 'tactical';
    if (this._el) {
      this._el.dataset.variant = this._variant;
    }
  }

  /**
   * @returns {string} The current HUD layout variant name.
   */
  getVariant() {
    return this._variant;
  }

  /**
   * @returns {'auto'|'on'|'off'} Current HUD mode — `'auto'` when style-driven
   *   show/hide is active, otherwise the explicit visibility override.
   */
  getMode() {
    if (this._autoMode) return 'auto';
    return this._visible ? 'on' : 'off';
  }

  /** @returns {boolean} Whether the HUD is currently visible. */
  get visible() {
    return this._visible;
  }

  attachDataManager(dataManager) {
    if (this._dataManagerUnsubscribe) {
      this._dataManagerUnsubscribe();
      this._dataManagerUnsubscribe = null;
    }
    this._dataManager = dataManager || null;
    if (typeof this._dataManager?.subscribe === 'function') {
      this._dataManagerUnsubscribe = this._dataManager.subscribe((change) => {
        if (change?.type === 'visibility') this._markSummaryDirty();
      });
    }
    this._markSummaryDirty();
  }

  /** Tear down all running intervals. Call when discarding the HUD instance. */
  destroy() {
    clearInterval(this._updateInterval);
    clearInterval(this._recBlinkInterval);
    clearInterval(this._summaryInterval);
    clearInterval(this._summaryTypingInterval);
    this.viewer.camera.moveEnd.removeEventListener(this._onCameraMoveEnd);
    this._dataManagerUnsubscribe?.();
  }
}
