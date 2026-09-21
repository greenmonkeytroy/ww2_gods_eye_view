import assert from 'node:assert/strict';
import test from 'node:test';

import { DataLayerManager } from './manager.js';
import {
  decodeLayerStateParams,
  encodeLayerStateParams,
  layerOptionsForRestore,
  normalizeLayerState,
} from './layerState.js';
import {
  COUNTRY_LABELS,
  DATA_RANGE,
  DEFAULT_ERA_ID,
  ERAS,
} from './local_data/ww2Countries/labels.js';
import {
  COUNTRY_LABEL_COHORT_LIMIT,
  COUNTRY_LABEL_COLLISION_CAPACITY,
  COUNTRY_LABEL_MIN_ALTITUDE_M,
  COUNTRY_LABEL_OVERLAY_SOURCE_ID,
  countryLabelsAtDate,
  createCountryLabelOverlayEntry,
  createWw2CountryLabelsLayer,
  labelDetail,
  normalizeEraId,
  periodAt,
  resolveCountryLabel,
} from './ww2CountryLabels.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fakeHost() {
  const calls = [];
  return {
    calls,
    setEntries: (sourceId, entries, options) => calls.push(['entries', sourceId, entries, options]),
    setVisible: (sourceId, visible) => calls.push(['visible', sourceId, visible]),
    clearSource: (sourceId) => calls.push(['clear', sourceId]),
  };
}

function byId(id) {
  const label = COUNTRY_LABELS.find((candidate) => candidate.id === id);
  assert.ok(label, `${id} exists in the dataset`);
  return label;
}

// ---- dataset integrity ---------------------------------------------------

test('every label is well formed', () => {
  const ids = new Set();
  for (const label of COUNTRY_LABELS) {
    assert.match(label.id, /^[a-z][a-z0-9-]*$/, `${label.id} is kebab-case`);
    assert.ok(!ids.has(label.id), `${label.id} is unique`);
    ids.add(label.id);
    assert.ok(Number.isInteger(label.rank) && label.rank >= 1 && label.rank <= 5, `${label.id} rank`);
    assert.ok(label.lat >= -90 && label.lat <= 90, `${label.id} latitude`);
    assert.ok(label.lon >= -180 && label.lon <= 180, `${label.id} longitude`);
    assert.ok(label.periods.length >= 1, `${label.id} has a period`);
    for (const period of label.periods) {
      assert.ok(period.name.trim().length > 0, `${label.id} names every period`);
      assert.ok(period.name.length <= 36, `${label.id} name fits a label: ${period.name}`);
    }
  }
});

test('periods are ordered, non-overlapping, and inside the covered date range', () => {
  for (const label of COUNTRY_LABELS) {
    label.periods.forEach((period, index) => {
      for (const edge of [period.from, period.to]) {
        if (edge === null) continue;
        assert.match(edge, ISO_DATE, `${label.id} uses ISO dates`);
        assert.ok(!Number.isNaN(Date.parse(edge)), `${label.id} ${edge} is a real date`);
        assert.ok(edge <= DATA_RANGE.to, `${label.id} ${edge} stays inside the covered range`);
      }
      if (period.from !== null && period.to !== null) {
        assert.ok(period.from < period.to, `${label.id} period runs forward`);
      }
      if (index > 0) {
        const previous = label.periods[index - 1];
        assert.notEqual(previous.to, null, `${label.id} only the last period may be open-ended`);
        assert.notEqual(period.from, null, `${label.id} only the first period may be open at the start`);
        assert.ok(previous.to <= period.from, `${label.id} periods do not overlap`);
      }
    });
  }
});

test('detail lines fit a label', () => {
  for (const era of ERAS) {
    for (const record of countryLabelsAtDate(COUNTRY_LABELS, era.date)) {
      assert.ok(record.detail.length <= 52, `${record.id} @ ${era.id}: "${record.detail}"`);
    }
  }
});

test('eras are ordered snapshot dates inside the covered range', () => {
  assert.equal(ERAS.length, 5);
  assert.equal(new Set(ERAS.map((era) => era.id)).size, ERAS.length);
  assert.equal(new Set(ERAS.map((era) => era.label)).size, ERAS.length);
  ERAS.forEach((era, index) => {
    assert.match(era.date, ISO_DATE);
    assert.ok(era.date >= DATA_RANGE.from && era.date <= DATA_RANGE.to);
    if (index > 0) assert.ok(ERAS[index - 1].date < era.date, 'eras ascend');
  });
  assert.equal(DEFAULT_ERA_ID, ERAS[0].id);
});

test('every era draws a substantial, collision-safe set of labels', () => {
  for (const era of ERAS) {
    const records = countryLabelsAtDate(COUNTRY_LABELS, era.date);
    assert.ok(records.length >= 100, `${era.id} has ${records.length} labels`);
    assert.ok(records.length <= COUNTRY_LABEL_COHORT_LIMIT, `${era.id} fits the cohort limit`);
    assert.equal(new Set(records.map((record) => record.id)).size, records.length);
  }
});

// ---- the historical facts the layer exists to get right -------------------

/**
 * [name, status] on the five era dates, in ERAS order; null where the label
 * does not exist. This is the accuracy contract for the timeline.
 */
const GOLDEN = {
  germany: [
    ['Germany', 'German Reich (Third Reich)'],
    ['Germany', 'German Reich (Third Reich)'],
    ['Germany', 'German Reich (Third Reich)'],
    ['Germany', 'Greater German Reich'],
    ['Germany', 'Allied-occupied'],
  ],
  austria: [
    ['Ostmark', 'Annexed by Germany'],
    ['Ostmark', 'Annexed by Germany'],
    ['Alpine & Danube Reichsgaue', 'Annexed by Germany'],
    ['Alpine & Danube Reichsgaue', 'Annexed by Germany'],
    ['Austria', 'Provisional government · Allied-occupied'],
  ],
  czechoslovakia: [
    ['Protectorate of Bohemia and Moravia', 'German protectorate'],
    ['Protectorate of Bohemia and Moravia', 'German protectorate'],
    ['Protectorate of Bohemia and Moravia', 'German protectorate'],
    ['Protectorate of Bohemia and Moravia', 'German protectorate'],
    ['Czechoslovakia', 'Restored'],
  ],
  slovakia: [
    ['Slovak Republic', 'German client state'],
    ['Slovak Republic', 'German client state'],
    ['Slovak Republic', 'German client state'],
    ['Slovak Republic', 'German client state'],
    null,
  ],
  poland: [['Poland', 'Second Republic'], null, null, null, ['Poland', 'Provisional Government (Soviet-backed)']],
  'general-government': [
    null,
    ['General Government', 'German-occupied Poland'],
    ['General Government', 'German-occupied Poland'],
    ['General Government', 'German-occupied Poland'],
    null,
  ],
  wartheland: [
    null,
    ['Reichsgau Wartheland', 'Polish land annexed by Germany'],
    ['Reichsgau Wartheland', 'Polish land annexed by Germany'],
    ['Reichsgau Wartheland', 'Polish land annexed by Germany'],
    null,
  ],
  danzig: [
    ['Free City of Danzig', 'League of Nations protection'],
    ['Danzig-West Prussia', 'Annexed by Germany'],
    ['Danzig-West Prussia', 'Annexed by Germany'],
    ['Danzig-West Prussia', 'Annexed by Germany'],
    null,
  ],
  france: [['France', null], null, null, null, ['France', 'Provisional Government']],
  'occupied-france': [
    null,
    ['Occupied France', 'German military administration'],
    ['Occupied France', 'German military administration'],
    ['Occupied France', 'German military administration'],
    null,
  ],
  'vichy-france': [
    null,
    ['Vichy France', 'French State · unoccupied zone'],
    ['Vichy France', 'French State · German-occupied'],
    ['Vichy France', 'French State · German-occupied'],
    null,
  ],
  italy: [['Italy', 'Kingdom'], ['Italy', 'Kingdom'], ['Italy', 'Kingdom'], null, ['Italy', 'Allied-occupied']],
  'italy-south': [null, null, null, ['Kingdom of Italy', 'Allied co-belligerent (south)'], null],
  'italian-social-republic': [null, null, null, ['Italian Social Republic', 'German client state (Salò)'], null],
  yugoslavia: [
    ['Yugoslavia', 'Kingdom of Yugoslavia'],
    null,
    null,
    null,
    ['Yugoslavia', 'Partisan-led provisional government'],
  ],
  croatia: [
    null,
    ['Independent State of Croatia', 'Axis client state (Ustaše)'],
    ['Independent State of Croatia', 'Axis client state (Ustaše)'],
    ['Independent State of Croatia', 'Axis client state (Ustaše)'],
    null,
  ],
  serbia: [null, ['Serbia', 'German-occupied'], ['Serbia', 'German-occupied'], ['Serbia', 'German-occupied'], null],
  montenegro: [null, ['Montenegro', 'Italian-occupied'], ['Montenegro', 'Italian-occupied'], ['Montenegro', 'German-occupied'], null],
  albania: [
    ['Albania', 'Italian-occupied'],
    ['Albania', 'Italian-occupied'],
    ['Albania', 'Italian-occupied'],
    ['Albania', 'German-occupied'],
    ['Albania', 'Democratic Government'],
  ],
  greece: [['Greece', null], ['Greece', 'Axis-occupied'], ['Greece', 'Axis-occupied'], ['Greece', 'Axis-occupied'], ['Greece', null]],
  hungary: [['Hungary', null], ['Hungary', null], ['Hungary', null], ['Hungary', 'German-occupied'], ['Hungary', 'Soviet-occupied']],
  estonia: [
    ['Estonia', null],
    ['Estonian SSR', 'Annexed by USSR'],
    ['Estonia', 'German-occupied (Ostland)'],
    ['Estonia', 'German-occupied (Ostland)'],
    ['Estonian SSR', 'Annexed by USSR'],
  ],
  latvia: [
    ['Latvia', null],
    ['Latvian SSR', 'Annexed by USSR'],
    ['Latvia', 'German-occupied (Ostland)'],
    ['Latvia', 'German-occupied (Ostland)'],
    ['Latvian SSR', 'Annexed by USSR'],
  ],
  lithuania: [
    ['Lithuania', null],
    ['Lithuanian SSR', 'Annexed by USSR'],
    ['Lithuania', 'German-occupied (Ostland)'],
    ['Lithuania', 'German-occupied (Ostland)'],
    ['Lithuanian SSR', 'Annexed by USSR'],
  ],
  ukraine: [
    ['Ukrainian SSR', null],
    ['Ukrainian SSR', null],
    ['Ukraine', 'German-occupied (Reichskommissariat)'],
    ['Ukrainian SSR', null],
    ['Ukrainian SSR', null],
  ],
  byelorussia: [
    ['Byelorussian SSR', null],
    ['Byelorussian SSR', null],
    ['Byelorussia', 'German-occupied (Ostland)'],
    ['Byelorussia', 'German-occupied (Ostland)'],
    ['Byelorussian SSR', null],
  ],
  bessarabia: [
    null,
    ['Moldavian SSR', 'Annexed by USSR'],
    ['Bessarabia', 'Romanian-annexed (Axis)'],
    ['Bessarabia', 'Romanian-annexed (Axis)'],
    ['Moldavian SSR', 'Annexed by USSR'],
  ],
  'tannu-tuva': [
    ['Tannu Tuva', 'Tuvan People’s Republic'],
    ['Tannu Tuva', 'Tuvan People’s Republic'],
    ['Tannu Tuva', 'Tuvan People’s Republic'],
    ['Tannu Tuva', 'Tuvan People’s Republic'],
    null,
  ],
  denmark: [['Denmark', null], ['Denmark', 'German-occupied'], ['Denmark', 'German-occupied'], ['Denmark', 'German-occupied'], ['Denmark', null]],
  norway: [['Norway', null], ['Norway', 'German-occupied'], ['Norway', 'German-occupied'], ['Norway', 'German-occupied'], ['Norway', null]],
  netherlands: [
    ['Netherlands', null],
    ['Netherlands', 'German-occupied'],
    ['Netherlands', 'German-occupied'],
    ['Netherlands', 'German-occupied'],
    ['Netherlands', null],
  ],
  belgium: [['Belgium', null], ['Belgium', 'German-occupied'], ['Belgium', 'German-occupied'], ['Belgium', 'German-occupied'], ['Belgium', null]],
  luxembourg: [
    ['Luxembourg', null],
    ['Luxembourg', 'German-occupied'],
    ['Luxembourg', 'German-occupied'],
    ['Luxembourg', 'German-occupied'],
    ['Luxembourg', null],
  ],
  iceland: [
    ['Iceland', 'Kingdom in union with Denmark'],
    ['Iceland', 'Kingdom · Allied-occupied'],
    ['Iceland', 'Kingdom · Allied-occupied'],
    ['Iceland', 'Kingdom · Allied-occupied'],
    ['Iceland', 'Republic'],
  ],
  ireland: [['Éire', null], ['Éire', null], ['Éire', null], ['Éire', null], ['Éire', null]],
  iran: [
    ['Iran (Persia)', null],
    ['Iran (Persia)', null],
    ['Iran (Persia)', 'Anglo-Soviet occupation'],
    ['Iran (Persia)', 'Anglo-Soviet occupation'],
    ['Iran (Persia)', 'Anglo-Soviet occupation'],
  ],
  iraq: [['Iraq', null], ['Iraq', 'British-occupied'], ['Iraq', 'British-occupied'], ['Iraq', 'British-occupied'], ['Iraq', 'British-occupied']],
  syria: [
    ['Syria', 'French Mandate'],
    ['Syria', 'Vichy-controlled French Mandate'],
    ['Syria', 'Free French-controlled Mandate'],
    ['Syria', 'Republic (French Mandate ending)'],
    ['Syria', 'Republic (French Mandate ending)'],
  ],
  libya: [
    ['Italian Libya', 'Italian colony'],
    ['Italian Libya', 'Italian colony'],
    ['Italian Libya', 'Italian colony'],
    ['Libya', 'Allied military administration'],
    ['Libya', 'Allied military administration'],
  ],
  tunisia: [
    ['Tunisia', 'French protectorate'],
    ['Tunisia', 'French protectorate'],
    ['Tunisia', 'French protectorate · Axis-occupied'],
    ['Tunisia', 'French protectorate'],
    ['Tunisia', 'French protectorate'],
  ],
  algeria: [
    ['French Algeria', 'French departments'],
    ['French Algeria', 'French departments'],
    ['French Algeria', 'Allied-held after Operation Torch'],
    ['French Algeria', 'Allied-held after Operation Torch'],
    ['French Algeria', 'Allied-held after Operation Torch'],
  ],
  'french-west-africa': [
    ['French West Africa', 'French colonial federation'],
    ['French West Africa', 'Vichy-controlled'],
    ['French West Africa', 'Vichy-controlled'],
    ['French West Africa', 'Rallied to the Allies'],
    ['French West Africa', 'Rallied to the Allies'],
  ],
  madagascar: [
    ['Madagascar', 'French colony'],
    ['Madagascar', 'Vichy-controlled'],
    ['Madagascar', 'Free French / British-held'],
    ['Madagascar', 'Free French / British-held'],
    ['Madagascar', 'Free French / British-held'],
  ],
  ethiopia: [
    ['Italian East Africa', 'Italian colony'],
    ['Ethiopia', 'Empire restored (May 1941)'],
    ['Ethiopia', 'Empire restored (May 1941)'],
    ['Ethiopia', 'Empire restored (May 1941)'],
    ['Ethiopia', 'Empire restored (May 1941)'],
  ],
  thailand: [['Thailand', null], ['Thailand', null], ['Thailand', null], ['Thailand', null], ['Thailand', null]],
  burma: [
    ['Burma', 'British colony'],
    ['Burma', 'British colony'],
    ['Burma', 'Japanese-occupied'],
    ['State of Burma', 'Japanese-sponsored'],
    ['Burma', 'Allied reconquest'],
  ],
  malaya: [
    ['British Malaya', null],
    ['British Malaya', null],
    ['Malaya', 'Japanese-occupied'],
    ['Malaya', 'Japanese-occupied'],
    ['Malaya', 'Japanese-occupied'],
  ],
  singapore: [
    ['Singapore', 'British naval base'],
    ['Singapore', 'British naval base'],
    ['Syonan-to', 'Japanese-occupied'],
    ['Syonan-to', 'Japanese-occupied'],
    ['Syonan-to', 'Japanese-occupied'],
  ],
  'netherlands-east-indies': [
    ['Netherlands East Indies', 'Dutch colony'],
    ['Netherlands East Indies', 'Dutch colony'],
    ['Netherlands East Indies', 'Japanese-occupied'],
    ['Netherlands East Indies', 'Japanese-occupied'],
    ['Netherlands East Indies', 'Japanese-occupied'],
  ],
  philippines: [
    ['Philippines', 'US Commonwealth'],
    ['Philippines', 'US Commonwealth'],
    ['Philippines', 'Japanese-occupied'],
    ['Second Philippine Republic', 'Japanese-sponsored'],
    ['Philippines', 'Commonwealth restored'],
  ],
  'french-indochina': [
    ['French Indochina', 'French colony'],
    ['French Indochina', 'Vichy French rule · Japanese troops'],
    ['French Indochina', 'Vichy French rule · Japanese troops'],
    ['French Indochina', 'Vichy French rule · Japanese troops'],
    null,
  ],
  vietnam: [null, null, null, null, ['Empire of Vietnam', 'Japanese-sponsored']],
  cambodia: [null, null, null, null, ['Kingdom of Kampuchea', 'Japanese-sponsored']],
  laos: [null, null, null, null, ['Kingdom of Luang Prabang', 'Japanese-sponsored']],
  'hong-kong': [
    ['Hong Kong', 'British colony'],
    ['Hong Kong', 'British colony'],
    ['Hong Kong', 'Japanese-occupied'],
    ['Hong Kong', 'Japanese-occupied'],
    ['Hong Kong', 'Japanese-occupied'],
  ],
  guam: [
    ['Guam', 'US territory'],
    ['Guam', 'US territory'],
    ['Guam', 'Japanese-occupied'],
    ['Guam', 'Japanese-occupied'],
    ['Guam', 'US territory'],
  ],
  'gilbert-ellice': [
    ['Gilbert and Ellice Islands', 'British colony'],
    ['Gilbert and Ellice Islands', 'British colony'],
    ['Gilbert and Ellice Islands', 'Japanese-occupied (Gilberts)'],
    ['Gilbert and Ellice Islands', 'British colony'],
    ['Gilbert and Ellice Islands', 'British colony'],
  ],
  'new-caledonia': [
    ['New Caledonia', 'French colony'],
    ['New Caledonia', 'Free French'],
    ['New Caledonia', 'Free French'],
    ['New Caledonia', 'Free French'],
    ['New Caledonia', 'Free French'],
  ],
  'french-guiana': [
    ['French Guiana', 'French colony'],
    ['French Guiana', 'Vichy-controlled'],
    ['French Guiana', 'Vichy-controlled'],
    ['French Guiana', 'Free French'],
    ['French Guiana', 'Free French'],
  ],
  'wang-jingwei-regime': [
    null,
    ['Wang Jingwei Regime', 'Japanese-sponsored (Nanjing)'],
    ['Wang Jingwei Regime', 'Japanese-sponsored (Nanjing)'],
    ['Wang Jingwei Regime', 'Japanese-sponsored (Nanjing)'],
    ['Wang Jingwei Regime', 'Japanese-sponsored (Nanjing)'],
  ],
};

test('names and statuses are era-correct on every snapshot date', () => {
  for (const [id, expected] of Object.entries(GOLDEN)) {
    assert.equal(expected.length, ERAS.length, `${id} covers every era`);
    ERAS.forEach((era, index) => {
      const record = resolveCountryLabel(byId(id), era.date);
      const want = expected[index];
      if (want === null) {
        assert.equal(record, null, `${id} does not exist on ${era.dateText}`);
        return;
      }
      assert.ok(record, `${id} exists on ${era.dateText}`);
      assert.deepEqual([record.name, record.status], want, `${id} on ${era.dateText}`);
    });
  }
});

test('names that changed inside the war change on the right day', () => {
  const at = (id, date) => resolveCountryLabel(byId(id), date)?.name ?? null;
  // Siam became Thailand on 24 June 1939.
  assert.equal(at('thailand', '1939-06-23'), 'Siam');
  assert.equal(at('thailand', '1939-06-24'), 'Thailand');
  // The Protectorate replaced Czecho-Slovakia the day after the German entry.
  assert.equal(at('czechoslovakia', '1939-03-14'), 'Czecho-Slovakia');
  assert.equal(at('czechoslovakia', '1939-03-15'), 'Protectorate of Bohemia and Moravia');
  // "Ostmark" was dropped as an official name on 8 April 1942.
  assert.equal(at('austria', '1942-04-07'), 'Ostmark');
  assert.equal(at('austria', '1942-04-08'), 'Alpine & Danube Reichsgaue');
  // Vichy's free zone was occupied on 11 November 1942.
  assert.equal(resolveCountryLabel(byId('vichy-france'), '1942-11-10').status, 'French State · unoccupied zone');
  assert.equal(resolveCountryLabel(byId('vichy-france'), '1942-11-11').status, 'French State · German-occupied');
  // The Republic of Iceland was proclaimed on 17 June 1944.
  assert.equal(resolveCountryLabel(byId('iceland'), '1944-06-16').status, 'Kingdom · Allied-occupied');
  assert.equal(resolveCountryLabel(byId('iceland'), '1944-06-17').status, 'Republic');
  // Italy split at the September 1943 armistice, and the RSI began on the 23rd.
  assert.equal(at('italy', '1943-09-07'), 'Italy');
  assert.equal(at('italy', '1943-09-08'), null);
  assert.equal(at('italian-social-republic', '1943-09-22'), null);
  assert.equal(at('italian-social-republic', '1943-09-23'), 'Italian Social Republic');
});

test('a label with no period on a date simply does not exist then', () => {
  assert.equal(periodAt(byId('poland'), '1942-01-01'), null);
  assert.equal(resolveCountryLabel(byId('poland'), '1942-01-01'), null);
});

// ---- presentation helpers --------------------------------------------------

test('labelDetail joins status and the present-day name, skipping redundancy', () => {
  assert.equal(labelDetail('Ceylon', 'British colony', 'Sri Lanka'), 'British colony · now Sri Lanka');
  assert.equal(labelDetail('Ceylon', null, 'Sri Lanka'), 'now Sri Lanka');
  assert.equal(labelDetail('Estonia', 'German-occupied', 'Estonia'), 'German-occupied');
  assert.equal(labelDetail('ESTONIA', null, 'Estonia'), '');
  assert.equal(labelDetail('Sweden', null, null), '');
});

test('the present-day note follows the period, not just the label', () => {
  const protectorate = resolveCountryLabel(byId('czechoslovakia'), '1941-01-01');
  assert.equal(protectorate.detail, 'German protectorate · now Czechia');
  const restored = resolveCountryLabel(byId('czechoslovakia'), '1945-05-08');
  assert.equal(restored.detail, 'Restored');
  const libya = resolveCountryLabel(byId('libya'), '1940-01-01');
  assert.equal(libya.detail, 'Italian colony · now Libya');
  const burma = resolveCountryLabel(byId('burma'), '1944-01-01');
  assert.equal(burma.detail, 'Japanese-sponsored · now Myanmar');
});

test('a period may move its own anchor', () => {
  const label = {
    id: 'mover', rank: 3, lat: 10, lon: 20, modern: null,
    periods: [
      { from: null, to: '1941-01-01', name: 'Here', status: null },
      { from: '1941-01-01', to: null, name: 'There', status: null, lat: 11, lon: 21 },
    ],
  };
  assert.deepEqual(
    [resolveCountryLabel(label, '1940-01-01').lat, resolveCountryLabel(label, '1940-01-01').lon],
    [10, 20],
  );
  assert.deepEqual(
    [resolveCountryLabel(label, '1942-01-01').lat, resolveCountryLabel(label, '1942-01-01').lon],
    [11, 21],
  );
});

test('overlay entries are upper-cased ambient cards ranked by importance', () => {
  const position = { x: 1, y: 2, z: 3 };
  const major = createCountryLabelOverlayEntry(resolveCountryLabel(byId('germany'), '1941-01-01'), position);
  const minor = createCountryLabelOverlayEntry(resolveCountryLabel(byId('luxembourg'), '1945-05-08'), position);
  assert.equal(major.id, 'germany');
  assert.equal(major.title, 'GERMANY');
  assert.deepEqual(major.details, ['German Reich (Third Reich)']);
  // `label` measures details without painting them; only `card` shows the status line.
  assert.equal(major.variant, 'card');
  assert.equal(major.collisionGroup, 'ambient-card');
  assert.equal(major.interactive, false);
  assert.equal(major.horizonCull, true);
  assert.equal(major.minAltitude, COUNTRY_LABEL_MIN_ALTITUDE_M);
  assert.equal(major.position, position);
  assert.deepEqual(minor.details, []);
  assert.ok(major.priority > minor.priority, 'rank 1 outranks rank 5');
});

test('era ids are matched strictly and case-insensitively', () => {
  assert.equal(normalizeEraId('jun-1944'), 'jun-1944');
  assert.equal(normalizeEraId('  JUN-1944 '), 'jun-1944');
  assert.equal(normalizeEraId('1944'), null);
  assert.equal(normalizeEraId(1944), null);
  assert.equal(normalizeEraId(null), null);
});

// ---- the layer -------------------------------------------------------------

test('enabling publishes the default era; disabling clears it', () => {
  const host = fakeHost();
  const layer = createWw2CountryLabelsLayer({ overlayHost: host, now: () => 1234 });
  layer.init();
  assert.deepEqual(host.calls, [['visible', COUNTRY_LABEL_OVERLAY_SOURCE_ID, false]]);

  layer.enable();
  const entriesCall = host.calls.find((call) => call[0] === 'entries');
  assert.ok(entriesCall, 'entries published on enable');
  const expected = countryLabelsAtDate(COUNTRY_LABELS, ERAS[0].date);
  assert.equal(entriesCall[2].length, expected.length);
  assert.deepEqual(entriesCall[3], {
    cohortLimit: COUNTRY_LABEL_COHORT_LIMIT,
    collisionCapacity: COUNTRY_LABEL_COLLISION_CAPACITY,
    moving: false,
  });
  assert.ok(entriesCall[2].some((entry) => entry.title === 'FREE CITY OF DANZIG'));
  assert.ok(!entriesCall[2].some((entry) => entry.title === 'VICHY FRANCE'));
  for (const entry of entriesCall[2]) {
    assert.ok(Number.isFinite(entry.position.x + entry.position.y + entry.position.z));
  }

  layer.disable();
  assert.deepEqual(host.calls.slice(-2), [
    ['clear', COUNTRY_LABEL_OVERLAY_SOURCE_ID],
    ['visible', COUNTRY_LABEL_OVERLAY_SOURCE_ID, false],
  ]);
});

test('changing the era while enabled republishes that era’s names', () => {
  const host = fakeHost();
  const layer = createWw2CountryLabelsLayer({ overlayHost: host });
  layer.enable();
  host.calls.length = 0;

  assert.equal(layer.setParams({ era: 'may-1945' }), true);
  const published = host.calls.filter((call) => call[0] === 'entries');
  assert.equal(published.length, 1);
  const titles = new Set(published[0][2].map((entry) => entry.title));
  assert.ok(titles.has('CZECHOSLOVAKIA'));
  assert.ok(titles.has('EMPIRE OF VIETNAM'));
  assert.ok(!titles.has('PROTECTORATE OF BOHEMIA AND MORAVIA'));
  assert.ok(!titles.has('FREE CITY OF DANZIG'));
  assert.deepEqual(layer.getParams(), { era: 'may-1945' });

  // Choosing the era already shown does not churn the overlay.
  assert.equal(layer.setParams({ era: 'may-1945' }), true);
  assert.equal(host.calls.filter((call) => call[0] === 'entries').length, 1);
});

test('an unknown era is rejected and leaves the layer unchanged', () => {
  const host = fakeHost();
  const layer = createWw2CountryLabelsLayer({ overlayHost: host });
  layer.enable();
  host.calls.length = 0;
  assert.equal(layer.setParams({ era: 'dec-1999' }), false);
  assert.deepEqual(layer.getParams(), { era: DEFAULT_ERA_ID });
  assert.equal(host.calls.length, 0);
});

test('a restored era applies before the layer is enabled and publishes only on enable', () => {
  const host = fakeHost();
  const layer = createWw2CountryLabelsLayer({ overlayHost: host });
  assert.equal(layer.setParams({ era: 'jun-1944' }), true);
  assert.equal(host.calls.length, 0, 'nothing is drawn for a layer that is off');
  assert.deepEqual(layer.getParams(), { era: 'jun-1944' });
  assert.equal(layer.getStats().loadingLabel, '6 Jun 1944');

  layer.enable();
  const titles = host.calls.find((call) => call[0] === 'entries')[2].map((entry) => entry.title);
  assert.ok(titles.includes('ITALIAN SOCIAL REPUBLIC'));
  assert.ok(titles.includes('KINGDOM OF ITALY'));
  assert.ok(!titles.includes('ITALY'));
});

test('params without an era are accepted and ignored', () => {
  const layer = createWw2CountryLabelsLayer({ overlayHost: fakeHost() });
  assert.equal(layer.setParams({}), true);
  assert.equal(layer.setParams(), true);
  assert.deepEqual(layer.getParams(), { era: DEFAULT_ERA_ID });
});

test('the row offers one chip per era and marks the active one', () => {
  const layer = createWw2CountryLabelsLayer({ overlayHost: fakeHost() });
  layer.setParams({ era: 'nov-1942' });
  const { chips, legend } = layer.getRowControls();
  assert.deepEqual(legend, []);
  assert.deepEqual(chips.map((chip) => chip.label), ERAS.map((era) => era.label));
  assert.deepEqual(chips.filter((chip) => chip.active).map((chip) => chip.params.era), ['nov-1942']);
  for (const chip of chips) {
    assert.ok(chip.title.length > 0);
    assert.equal(chip.state, chip.active ? 'active' : 'idle');
    assert.deepEqual(Object.keys(chip.params), ['era']);
  }
});

test('stats report the labels drawn and the era date', () => {
  const layer = createWw2CountryLabelsLayer({ overlayHost: fakeHost(), now: () => 99 });
  assert.equal(layer.getStats().count, countryLabelsAtDate(COUNTRY_LABELS, ERAS[0].date).length);
  assert.equal(layer.getStats().error, null);
  assert.equal(layer.getStats().loadingLabel, '31 Aug 1939');
  layer.enable();
  assert.equal(layer.getStats().lastUpdate, 99);
});

test('the manager drives the era through the same params path as a chip click', async () => {
  const host = fakeHost();
  const layer = createWw2CountryLabelsLayer({ overlayHost: host });
  const manager = new DataLayerManager({});
  manager.register(layer);
  manager.finalizeRegistrations([{ id: layer.id, disposition: 'enabled+options' }]);

  assert.equal(await manager.setEnabled(layer.id, true, { origin: 'user' }), true);
  assert.equal(manager.setLayerParams(layer.id, { era: 'nov-1942' }, { origin: 'user' }), true);
  assert.deepEqual(manager.getLayerParams(layer.id), { era: 'nov-1942' });
  assert.equal(manager.setLayerParams(layer.id, { era: 'nope' }, { origin: 'user' }), false);
  assert.deepEqual(manager.getLayerParams(layer.id), { era: 'nov-1942' });

  const chip = manager._rowControlsFor(layer.id).chips.find((entry) => entry.params.era === 'jun-1941');
  assert.equal(manager.setLayerParams(layer.id, chip.params, { origin: 'user' }), true);
  assert.deepEqual(manager.getLayerParams(layer.id), { era: 'jun-1941' });
  await manager.destroyLayer(layer.id);
});

// ---- share links -----------------------------------------------------------

test('the era survives a share-link round trip and the default stays out of the URL', () => {
  // `lo` also carries other layers' options (flights' 3D models default ON is
  // written explicitly), so look for this layer's own assignment.
  const assignments = (params) => (params.get('lo') || '').split('_').filter(Boolean);
  const enabledOnly = normalizeLayerState({ enabledLayerIds: ['ww2-country-labels'] });
  const defaultParams = new URLSearchParams([['v', '2']]);
  encodeLayerStateParams(defaultParams, enabledOnly);
  assert.equal(defaultParams.get('l'), 'l');
  assert.ok(!assignments(defaultParams).some((entry) => entry.startsWith('l.')), 'the default era is implied');

  ERAS.forEach((era, index) => {
    const state = normalizeLayerState({
      enabledLayerIds: ['ww2-country-labels'],
      options: { 'ww2-country-labels': { era: era.id } },
    });
    const params = new URLSearchParams([['v', '2']]);
    encodeLayerStateParams(params, state);
    if (era.id === DEFAULT_ERA_ID) {
      assert.ok(!assignments(params).some((entry) => entry.startsWith('l.')));
    } else {
      assert.ok(assignments(params).includes(`l.e.${index + 1}`), `${era.id} encodes as l.e.${index + 1}`);
    }
    const decoded = decodeLayerStateParams(new URLSearchParams(params.toString()));
    assert.deepEqual(decoded.enabledLayerIds, ['ww2-country-labels']);
    assert.equal(decoded.options['ww2-country-labels'].era, era.id);
  });
});

test('a hostile era value in a link falls back to the default', () => {
  const decoded = decodeLayerStateParams(new URLSearchParams('v=2&l=l&lo=l.e.9'));
  assert.equal(decoded.options['ww2-country-labels'].era, DEFAULT_ERA_ID);
  const restored = layerOptionsForRestore(decoded, 'ww2-country-labels');
  assert.deepEqual(restored, { era: DEFAULT_ERA_ID });
});
