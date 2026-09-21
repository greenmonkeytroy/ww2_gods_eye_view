/**
 * Era-correct country labels for 1939-1945.
 *
 * Every label is a point plus a list of dated periods. A period gives the name
 * (and, where useful, a short political status) that applied to that place while
 * it was in force. `from` is inclusive, `to` is exclusive, `null` is open-ended,
 * and a date with no matching period means the label does not exist then (for
 * example Czechoslovakia between March 1939 and May 1945).
 *
 * Rules the data follows (see README.md in this folder):
 *  - Labels track EFFECTIVE control on the date, not formal legal survival:
 *    Vichy France is labelled until its regime left in August 1944, but the
 *    Baltic states are labelled as German-occupied even though the Allies never
 *    recognised their annexation.
 *  - Names are the English names in use at the time; `modern` is appended as
 *    "now X" whenever it differs from the name shown.
 *  - Coverage stops at 15 August 1945 (Japanese surrender). Nothing after that
 *    date is modelled.
 *  - Points are hand-placed label anchors, not borders.
 */

export const DATA_RANGE = Object.freeze({ from: '1939-01-01', to: '1945-08-15' });

/** The five snapshot dates offered as chips in the layer's panel row. */
export const ERAS = Object.freeze([
  Object.freeze({
    id: 'aug-1939',
    date: '1939-08-31',
    label: 'AUG 1939',
    dateText: '31 Aug 1939',
    caption: '31 Aug 1939 — eve of the invasion of Poland',
  }),
  Object.freeze({
    id: 'jun-1941',
    date: '1941-06-22',
    label: 'JUN 1941',
    dateText: '22 Jun 1941',
    caption: '22 Jun 1941 — eve of Operation Barbarossa',
  }),
  Object.freeze({
    id: 'nov-1942',
    date: '1942-11-15',
    label: 'NOV 1942',
    dateText: '15 Nov 1942',
    caption: '15 Nov 1942 — Axis at its greatest extent',
  }),
  Object.freeze({
    id: 'jun-1944',
    date: '1944-06-06',
    label: 'JUN 1944',
    dateText: '6 Jun 1944',
    caption: '6 Jun 1944 — D-Day',
  }),
  Object.freeze({
    id: 'may-1945',
    date: '1945-05-08',
    label: 'MAY 1945',
    dateText: '8 May 1945',
    caption: '8 May 1945 — VE Day',
  }),
]);

export const DEFAULT_ERA_ID = ERAS[0].id;

/**
 * @param {string|null} from Inclusive ISO start date, or null for open.
 * @param {string|null} to Exclusive ISO end date, or null for open.
 * @param {string} name English name in use during the period.
 * @param {string|null} [status] Short political status shown under the name.
 * @param {{modern?: string|null, lat?: number, lon?: number}} [extra]
 */
const P = (from, to, name, status = null, extra = null) => Object.freeze({
  from,
  to,
  name,
  status,
  ...(extra || {}),
});

/**
 * @param {string} id Stable label id.
 * @param {1|2|3|4|5} rank 1 wins label collisions; 5 yields to everything else.
 * @param {number} lat Label anchor latitude.
 * @param {number} lon Label anchor longitude.
 * @param {Array<object>} periods Dated names, sorted, non-overlapping.
 * @param {string|null} [modern] Present-day name, shown as "now X" when different.
 */
const L = (id, rank, lat, lon, periods, modern = null) => Object.freeze({
  id,
  rank,
  lat,
  lon,
  modern,
  periods: Object.freeze(periods),
});

const VICHY = '1940-06-22';
const CASE_ANTON = '1942-11-11';
const ITALIAN_ARMISTICE = '1943-09-08';
const TORCH = '1942-11-08';
const YUGOSLAV_COLLAPSE = '1941-04-17';

export const COUNTRY_LABELS = Object.freeze([
  // ---- Western and northern Europe ------------------------------------
  L('united-kingdom', 1, 53.4, -1.9, [P(null, null, 'United Kingdom')]),
  L('ireland', 3, 53.1, -7.9, [P(null, null, 'Éire')], 'Ireland'),
  L('iceland', 3, 64.9, -18.5, [
    P(null, '1940-05-10', 'Iceland', 'Kingdom in union with Denmark'),
    P('1940-05-10', '1944-06-17', 'Iceland', 'Kingdom · Allied-occupied'),
    P('1944-06-17', null, 'Iceland', 'Republic'),
  ]),
  L('denmark', 3, 56.0, 9.5, [
    P(null, '1940-04-09', 'Denmark'),
    P('1940-04-09', '1945-05-05', 'Denmark', 'German-occupied'),
    P('1945-05-05', null, 'Denmark'),
  ]),
  L('greenland', 4, 72.0, -40.0, [
    P(null, '1941-04-09', 'Greenland', 'Danish colony'),
    P('1941-04-09', null, 'Greenland', 'Danish colony · US-protected'),
  ]),
  L('norway', 2, 64.5, 12.5, [
    P(null, '1940-04-09', 'Norway'),
    P('1940-04-09', '1945-05-08', 'Norway', 'German-occupied'),
    P('1945-05-08', null, 'Norway'),
  ]),
  L('sweden', 2, 62.0, 15.5, [P(null, null, 'Sweden')]),
  L('finland', 2, 63.5, 26.5, [P(null, null, 'Finland')]),
  L('netherlands', 3, 52.2, 5.6, [
    P(null, '1940-05-15', 'Netherlands'),
    P('1940-05-15', '1945-05-05', 'Netherlands', 'German-occupied'),
    P('1945-05-05', null, 'Netherlands'),
  ]),
  L('belgium', 3, 50.6, 4.6, [
    P(null, '1940-05-28', 'Belgium'),
    P('1940-05-28', '1944-09-04', 'Belgium', 'German-occupied'),
    P('1944-09-04', null, 'Belgium'),
  ]),
  L('luxembourg', 5, 49.8, 6.1, [
    P(null, '1940-05-10', 'Luxembourg'),
    P('1940-05-10', '1944-09-11', 'Luxembourg', 'German-occupied'),
    P('1944-09-11', null, 'Luxembourg'),
  ]),
  L('france', 1, 46.6, 2.4, [
    P(null, VICHY, 'France'),
    P('1944-08-20', null, 'France', 'Provisional Government'),
  ]),
  L('occupied-france', 1, 48.6, 2.2, [
    P(VICHY, '1944-08-20', 'Occupied France', 'German military administration'),
  ]),
  L('vichy-france', 1, 44.4, 2.9, [
    P(VICHY, CASE_ANTON, 'Vichy France', 'French State · unoccupied zone'),
    P(CASE_ANTON, '1944-08-20', 'Vichy France', 'French State · German-occupied'),
  ]),
  L('spain', 2, 40.2, -3.7, [P(null, null, 'Spain')]),
  L('portugal', 3, 39.6, -8.0, [P(null, null, 'Portugal')]),
  L('switzerland', 4, 46.8, 8.2, [P(null, null, 'Switzerland')]),
  L('italy', 1, 42.8, 12.5, [
    P(null, ITALIAN_ARMISTICE, 'Italy', 'Kingdom'),
    P('1945-04-25', null, 'Italy', 'Allied-occupied'),
  ]),
  L('italy-south', 2, 40.6, 15.8, [
    P(ITALIAN_ARMISTICE, '1945-04-25', 'Kingdom of Italy', 'Allied co-belligerent (south)'),
  ]),
  L('italian-social-republic', 2, 45.0, 10.6, [
    P('1943-09-23', '1945-04-25', 'Italian Social Republic', 'German client state (Salò)'),
  ]),
  L('malta', 5, 35.9, 14.4, [P(null, null, 'Malta', 'British colony')]),
  L('cyprus', 5, 35.0, 33.2, [P(null, null, 'Cyprus', 'British colony')]),

  // ---- Germany and its annexations ------------------------------------
  L('germany', 1, 51.2, 10.4, [
    P(null, '1943-06-26', 'Germany', 'German Reich (Third Reich)'),
    P('1943-06-26', '1945-05-08', 'Germany', 'Greater German Reich'),
    P('1945-05-08', null, 'Germany', 'Allied-occupied'),
  ]),
  L('austria', 3, 47.4, 14.0, [
    P(null, '1942-04-08', 'Ostmark', 'Annexed by Germany'),
    P('1942-04-08', '1945-04-27', 'Alpine & Danube Reichsgaue', 'Annexed by Germany'),
    P('1945-04-27', null, 'Austria', 'Provisional government · Allied-occupied'),
  ], 'Austria'),
  L('czechoslovakia', 3, 49.7, 16.0, [
    P(null, '1939-03-15', 'Czecho-Slovakia', 'Second Republic'),
    P('1939-03-15', '1945-05-08', 'Protectorate of Bohemia and Moravia', 'German protectorate', { modern: 'Czechia' }),
    P('1945-05-08', null, 'Czechoslovakia', 'Restored'),
  ]),
  L('slovakia', 3, 48.7, 19.7, [
    P('1939-03-14', '1945-04-04', 'Slovak Republic', 'German client state'),
  ], 'Slovakia'),
  L('poland', 1, 52.0, 19.4, [
    P(null, '1939-09-01', 'Poland', 'Second Republic'),
    P('1945-01-17', null, 'Poland', 'Provisional Government (Soviet-backed)'),
  ]),
  L('general-government', 2, 51.2, 21.0, [
    P('1939-10-26', '1945-01-17', 'General Government', 'German-occupied Poland'),
  ]),
  L('wartheland', 3, 52.3, 17.6, [
    P('1939-10-26', '1940-01-29', 'Reichsgau Posen', 'Polish land annexed by Germany'),
    P('1940-01-29', '1945-01-19', 'Reichsgau Wartheland', 'Polish land annexed by Germany'),
  ]),
  L('danzig', 4, 54.4, 18.6, [
    P(null, '1939-09-01', 'Free City of Danzig', 'League of Nations protection', { modern: 'Gdańsk' }),
    P('1939-09-01', '1945-03-30', 'Danzig-West Prussia', 'Annexed by Germany', { modern: 'northern Poland' }),
  ]),

  // ---- Baltic states and the Soviet west -------------------------------
  L('estonia', 4, 58.7, 25.5, [
    P(null, '1940-08-06', 'Estonia'),
    P('1940-08-06', '1941-08-28', 'Estonian SSR', 'Annexed by USSR'),
    P('1941-08-28', '1944-09-22', 'Estonia', 'German-occupied (Ostland)'),
    P('1944-09-22', null, 'Estonian SSR', 'Annexed by USSR'),
  ], 'Estonia'),
  L('latvia', 4, 56.9, 24.9, [
    P(null, '1940-08-05', 'Latvia'),
    P('1940-08-05', '1941-07-01', 'Latvian SSR', 'Annexed by USSR'),
    P('1941-07-01', '1944-10-13', 'Latvia', 'German-occupied (Ostland)'),
    P('1944-10-13', null, 'Latvian SSR', 'Annexed by USSR'),
  ], 'Latvia'),
  L('lithuania', 4, 55.3, 23.9, [
    P(null, '1940-08-03', 'Lithuania'),
    P('1940-08-03', '1941-06-24', 'Lithuanian SSR', 'Annexed by USSR'),
    P('1941-06-24', '1944-07-13', 'Lithuania', 'German-occupied (Ostland)'),
    P('1944-07-13', null, 'Lithuanian SSR', 'Annexed by USSR'),
  ], 'Lithuania'),
  L('soviet-union', 1, 61.0, 85.0, [P(null, null, 'Soviet Union')]),
  L('ukraine', 2, 49.0, 31.3, [
    P(null, '1941-09-01', 'Ukrainian SSR'),
    P('1941-09-01', '1944-04-01', 'Ukraine', 'German-occupied (Reichskommissariat)'),
    P('1944-04-01', null, 'Ukrainian SSR'),
  ], 'Ukraine'),
  L('byelorussia', 3, 53.6, 27.8, [
    P(null, '1941-06-28', 'Byelorussian SSR'),
    P('1941-06-28', '1944-07-03', 'Byelorussia', 'German-occupied (Ostland)'),
    P('1944-07-03', null, 'Byelorussian SSR'),
  ], 'Belarus'),
  L('bessarabia', 5, 47.0, 28.6, [
    P('1940-08-02', '1941-07-16', 'Moldavian SSR', 'Annexed by USSR'),
    P('1941-07-16', '1944-08-24', 'Bessarabia', 'Romanian-annexed (Axis)'),
    P('1944-08-24', null, 'Moldavian SSR', 'Annexed by USSR'),
  ], 'Moldova'),
  L('tannu-tuva', 5, 51.7, 94.5, [
    P(null, '1944-11-01', 'Tannu Tuva', 'Tuvan People’s Republic'),
  ], 'Tuva (Russia)'),

  // ---- Balkans, Danube and Turkey --------------------------------------
  L('yugoslavia', 2, 44.3, 18.0, [
    P(null, YUGOSLAV_COLLAPSE, 'Yugoslavia', 'Kingdom of Yugoslavia'),
    P('1944-10-20', null, 'Yugoslavia', 'Partisan-led provisional government'),
  ]),
  L('croatia', 3, 45.3, 16.3, [
    P('1941-04-10', '1945-05-08', 'Independent State of Croatia', 'Axis client state (Ustaše)'),
  ]),
  L('serbia', 3, 44.0, 20.9, [
    P(YUGOSLAV_COLLAPSE, '1944-10-20', 'Serbia', 'German-occupied'),
  ]),
  L('montenegro', 5, 42.8, 19.2, [
    P(YUGOSLAV_COLLAPSE, ITALIAN_ARMISTICE, 'Montenegro', 'Italian-occupied'),
    P(ITALIAN_ARMISTICE, '1944-12-19', 'Montenegro', 'German-occupied'),
  ]),
  L('slovenia', 5, 46.1, 14.8, [
    P(YUGOSLAV_COLLAPSE, ITALIAN_ARMISTICE, 'Slovenia', 'Partitioned: Germany, Italy, Hungary'),
    P(ITALIAN_ARMISTICE, '1945-05-09', 'Slovenia', 'German-occupied'),
  ]),
  L('albania', 4, 41.1, 20.0, [
    P(null, '1939-04-07', 'Albania', 'Kingdom'),
    P('1939-04-07', ITALIAN_ARMISTICE, 'Albania', 'Italian-occupied'),
    P(ITALIAN_ARMISTICE, '1944-11-29', 'Albania', 'German-occupied'),
    P('1944-11-29', null, 'Albania', 'Democratic Government'),
  ]),
  L('greece', 3, 39.4, 22.0, [
    P(null, '1941-04-27', 'Greece'),
    P('1941-04-27', '1944-10-13', 'Greece', 'Axis-occupied'),
    P('1944-10-13', null, 'Greece'),
  ]),
  L('bulgaria', 3, 42.7, 25.2, [P(null, null, 'Bulgaria')]),
  L('romania', 3, 45.9, 24.9, [P(null, null, 'Romania')]),
  L('hungary', 3, 47.1, 19.4, [
    P(null, '1944-03-19', 'Hungary'),
    P('1944-03-19', '1945-04-04', 'Hungary', 'German-occupied'),
    P('1945-04-04', null, 'Hungary', 'Soviet-occupied'),
  ]),
  L('turkey', 2, 39.0, 35.0, [P(null, null, 'Turkey')]),

  // ---- Middle East ------------------------------------------------------
  L('syria', 3, 35.0, 38.5, [
    P(null, VICHY, 'Syria', 'French Mandate'),
    P(VICHY, '1941-07-14', 'Syria', 'Vichy-controlled French Mandate'),
    P('1941-07-14', '1943-08-17', 'Syria', 'Free French-controlled Mandate'),
    P('1943-08-17', null, 'Syria', 'Republic (French Mandate ending)'),
  ]),
  L('lebanon', 5, 33.9, 35.9, [
    P(null, VICHY, 'Lebanon', 'French Mandate'),
    P(VICHY, '1941-07-14', 'Lebanon', 'Vichy-controlled French Mandate'),
    P('1941-07-14', '1943-11-22', 'Lebanon', 'Free French-controlled Mandate'),
    P('1943-11-22', null, 'Lebanon', 'Republic (French Mandate ending)'),
  ]),
  L('palestine', 4, 31.9, 35.0, [P(null, null, 'Palestine', 'British Mandate')]),
  L('transjordan', 5, 31.0, 36.5, [
    P(null, null, 'Transjordan', 'Emirate under British Mandate'),
  ], 'Jordan'),
  L('iraq', 3, 33.0, 43.7, [
    P(null, '1941-05-31', 'Iraq'),
    P('1941-05-31', null, 'Iraq', 'British-occupied'),
  ]),
  L('iran', 2, 32.5, 54.0, [
    P(null, '1941-08-25', 'Iran (Persia)'),
    P('1941-08-25', null, 'Iran (Persia)', 'Anglo-Soviet occupation'),
  ]),
  L('saudi-arabia', 3, 24.0, 44.5, [P(null, null, 'Saudi Arabia')]),
  L('yemen', 5, 15.5, 44.5, [P(null, null, 'Yemen')]),
  L('oman', 5, 21.0, 57.0, [P(null, null, 'Muscat and Oman')], 'Oman'),
  L('afghanistan', 3, 33.9, 66.0, [P(null, null, 'Afghanistan')]),
  L('egypt', 2, 26.8, 29.8, [P(null, null, 'Egypt')]),
  L('sudan', 2, 15.6, 30.0, [P(null, null, 'Anglo-Egyptian Sudan', 'Condominium')], 'Sudan'),

  // ---- North and East Africa ------------------------------------------
  L('libya', 2, 27.0, 17.0, [
    P(null, '1943-01-23', 'Italian Libya', 'Italian colony', { modern: 'Libya' }),
    P('1943-01-23', null, 'Libya', 'Allied military administration'),
  ]),
  L('algeria', 3, 28.0, 2.6, [
    P(null, TORCH, 'French Algeria', 'French departments'),
    P(TORCH, null, 'French Algeria', 'Allied-held after Operation Torch'),
  ], 'Algeria'),
  L('morocco', 3, 32.0, -6.0, [
    P(null, TORCH, 'Morocco', 'French & Spanish protectorates'),
    P(TORCH, null, 'Morocco', 'Protectorates · Allied-held'),
  ]),
  L('tunisia', 4, 34.0, 9.5, [
    P(null, '1942-11-09', 'Tunisia', 'French protectorate'),
    P('1942-11-09', '1943-05-13', 'Tunisia', 'French protectorate · Axis-occupied'),
    P('1943-05-13', null, 'Tunisia', 'French protectorate'),
  ]),
  L('ethiopia', 2, 9.0, 39.5, [
    P(null, '1941-05-05', 'Italian East Africa', 'Italian colony', { modern: 'Ethiopia, Eritrea, Somalia' }),
    P('1941-05-05', null, 'Ethiopia', 'Empire restored (May 1941)'),
  ]),
  L('eritrea', 5, 15.4, 38.9, [
    P('1941-04-01', null, 'Eritrea', 'British administration'),
  ]),
  L('italian-somaliland', 5, 3.0, 45.5, [
    P('1941-02-25', null, 'Italian Somaliland', 'British administration'),
  ], 'Somalia'),
  L('british-somaliland', 5, 9.8, 46.0, [
    P(null, '1940-08-19', 'British Somaliland', 'British protectorate'),
    P('1940-08-19', '1941-03-16', 'British Somaliland', 'Italian-occupied'),
    P('1941-03-16', null, 'British Somaliland', 'British protectorate'),
  ], 'Somaliland'),

  // ---- Sub-Saharan Africa ----------------------------------------------
  L('french-west-africa', 2, 15.0, -2.0, [
    P(null, VICHY, 'French West Africa', 'French colonial federation'),
    P(VICHY, '1942-11-23', 'French West Africa', 'Vichy-controlled'),
    P('1942-11-23', null, 'French West Africa', 'Rallied to the Allies'),
  ]),
  L('french-equatorial-africa', 2, 2.0, 17.0, [
    P(null, '1940-08-26', 'French Equatorial Africa', 'French colonial federation'),
    P('1940-08-26', null, 'French Equatorial Africa', 'Free French'),
  ]),
  L('belgian-congo', 2, -2.5, 23.5, [P(null, null, 'Belgian Congo', 'Belgian colony')], 'DR Congo'),
  L('nigeria', 3, 9.0, 8.0, [P(null, null, 'Nigeria', 'British colony')]),
  L('gold-coast', 5, 7.5, -1.2, [P(null, null, 'Gold Coast', 'British colony')], 'Ghana'),
  L('liberia', 5, 6.5, -9.3, [P(null, null, 'Liberia')]),
  L('kenya', 4, 0.5, 37.5, [P(null, null, 'Kenya', 'British colony')]),
  L('uganda', 5, 1.5, 32.5, [P(null, null, 'Uganda', 'British protectorate')]),
  L('tanganyika', 4, -6.3, 34.8, [P(null, null, 'Tanganyika', 'British mandate')], 'Tanzania'),
  L('northern-rhodesia', 5, -14.0, 27.5, [P(null, null, 'Northern Rhodesia', 'British protectorate')], 'Zambia'),
  L('southern-rhodesia', 5, -19.0, 30.0, [P(null, null, 'Southern Rhodesia', 'Self-governing colony')], 'Zimbabwe'),
  L('nyasaland', 5, -13.0, 34.0, [P(null, null, 'Nyasaland', 'British protectorate')], 'Malawi'),
  L('bechuanaland', 5, -22.0, 24.0, [P(null, null, 'Bechuanaland', 'British protectorate')], 'Botswana'),
  L('south-west-africa', 4, -22.0, 17.5, [P(null, null, 'South West Africa', 'South African mandate')], 'Namibia'),
  L('south-africa', 2, -29.0, 24.5, [P(null, null, 'Union of South Africa')]),
  L('angola', 3, -12.0, 17.5, [P(null, null, 'Portuguese West Africa', 'Portuguese colony')], 'Angola'),
  L('mozambique', 3, -17.5, 35.0, [P(null, null, 'Portuguese East Africa', 'Portuguese colony')], 'Mozambique'),
  L('madagascar', 3, -19.0, 46.7, [
    P(null, VICHY, 'Madagascar', 'French colony'),
    P(VICHY, '1942-11-06', 'Madagascar', 'Vichy-controlled'),
    P('1942-11-06', null, 'Madagascar', 'Free French / British-held'),
  ]),

  // ---- East and Southeast Asia -----------------------------------------
  L('japan', 1, 36.2, 138.3, [P(null, null, 'Japan', 'Empire of Japan')]),
  L('korea', 3, 37.0, 127.9, [P(null, null, 'Korea', 'Japanese colony (Chōsen)')]),
  L('formosa', 4, 23.7, 121.0, [P(null, null, 'Formosa', 'Japanese colony')], 'Taiwan'),
  L('manchukuo', 2, 44.0, 125.5, [P(null, null, 'Manchukuo', 'Japanese client state')], 'northeast China'),
  L('mengjiang', 4, 41.7, 112.0, [P(null, null, 'Mengjiang', 'Japanese client state')], 'Inner Mongolia'),
  L('china', 1, 34.0, 105.0, [P(null, null, 'China', 'Republic of China')]),
  L('wang-jingwei-regime', 4, 31.5, 118.5, [
    P('1940-03-30', null, 'Wang Jingwei Regime', 'Japanese-sponsored (Nanjing)'),
  ]),
  L('tibet', 4, 31.5, 88.0, [P(null, null, 'Tibet', 'De facto independent')]),
  L('mongolia', 2, 46.8, 103.0, [P(null, null, 'Mongolian People’s Republic')], 'Mongolia'),
  L('nepal', 5, 28.3, 84.0, [P(null, null, 'Nepal')]),
  L('british-india', 1, 22.0, 79.0, [P(null, null, 'British India')], 'India, Pakistan & Bangladesh'),
  L('ceylon', 5, 7.6, 80.7, [P(null, null, 'Ceylon', 'British colony')], 'Sri Lanka'),
  L('hong-kong', 5, 22.3, 114.2, [
    P(null, '1941-12-25', 'Hong Kong', 'British colony'),
    P('1941-12-25', null, 'Hong Kong', 'Japanese-occupied'),
  ]),
  L('french-indochina', 2, 16.0, 106.5, [
    P(null, VICHY, 'French Indochina', 'French colony'),
    P(VICHY, '1945-03-09', 'French Indochina', 'Vichy French rule · Japanese troops'),
  ]),
  L('vietnam', 3, 16.5, 107.3, [
    P('1945-03-11', null, 'Empire of Vietnam', 'Japanese-sponsored'),
  ], 'Vietnam'),
  L('cambodia', 4, 12.7, 104.9, [
    P('1945-03-13', null, 'Kingdom of Kampuchea', 'Japanese-sponsored'),
  ], 'Cambodia'),
  L('laos', 4, 19.5, 102.3, [
    P('1945-04-08', null, 'Kingdom of Luang Prabang', 'Japanese-sponsored'),
  ], 'Laos'),
  L('thailand', 2, 15.5, 101.0, [
    P(null, '1939-06-24', 'Siam'),
    P('1939-06-24', null, 'Thailand'),
  ], 'Thailand'),
  L('burma', 2, 21.0, 96.0, [
    P(null, '1942-05-01', 'Burma', 'British colony'),
    P('1942-05-01', '1943-08-01', 'Burma', 'Japanese-occupied'),
    P('1943-08-01', '1945-05-03', 'State of Burma', 'Japanese-sponsored'),
    P('1945-05-03', null, 'Burma', 'Allied reconquest'),
  ], 'Myanmar'),
  L('malaya', 3, 4.2, 102.0, [
    P(null, '1942-02-15', 'British Malaya'),
    P('1942-02-15', null, 'Malaya', 'Japanese-occupied'),
  ], 'Peninsular Malaysia'),
  L('singapore', 5, 1.35, 103.82, [
    P(null, '1942-02-15', 'Singapore', 'British naval base'),
    P('1942-02-15', null, 'Syonan-to', 'Japanese-occupied'),
  ], 'Singapore'),
  L('netherlands-east-indies', 2, -2.5, 113.5, [
    P(null, '1942-03-09', 'Netherlands East Indies', 'Dutch colony'),
    P('1942-03-09', null, 'Netherlands East Indies', 'Japanese-occupied'),
  ], 'Indonesia'),
  L('portuguese-timor', 5, -8.8, 125.7, [
    P(null, '1942-02-20', 'Portuguese Timor', 'Portuguese colony'),
    P('1942-02-20', null, 'Portuguese Timor', 'Japanese-occupied'),
  ], 'East Timor'),
  L('philippines', 2, 15.5, 121.0, [
    P(null, '1942-01-02', 'Philippines', 'US Commonwealth'),
    P('1942-01-02', '1943-10-14', 'Philippines', 'Japanese-occupied'),
    P('1943-10-14', '1945-02-27', 'Second Philippine Republic', 'Japanese-sponsored'),
    P('1945-02-27', null, 'Philippines', 'Commonwealth restored'),
  ]),

  // ---- Pacific and Oceania ----------------------------------------------
  L('australia', 1, -25.5, 134.0, [P(null, null, 'Australia')]),
  L('new-zealand', 3, -42.0, 172.0, [P(null, null, 'New Zealand')]),
  L('papua', 5, -7.0, 143.0, [P(null, null, 'Papua', 'Australian territory')], 'Papua New Guinea'),
  L('new-guinea', 5, -5.5, 145.0, [P(null, null, 'New Guinea', 'Australian mandate')], 'Papua New Guinea'),
  L('dutch-new-guinea', 5, -4.0, 138.0, [P(null, null, 'Dutch New Guinea', 'Dutch colony')], 'Western New Guinea'),
  L('solomon-islands', 5, -9.6, 160.1, [
    P(null, null, 'British Solomon Islands', 'British protectorate'),
  ], 'Solomon Islands'),
  L('new-caledonia', 5, -21.3, 165.5, [
    P(null, '1940-09-19', 'New Caledonia', 'French colony'),
    P('1940-09-19', null, 'New Caledonia', 'Free French'),
  ]),
  L('new-hebrides', 5, -16.0, 167.5, [
    P(null, null, 'New Hebrides', 'Anglo-French condominium'),
  ], 'Vanuatu'),
  L('fiji', 5, -17.8, 178.0, [P(null, null, 'Fiji', 'British colony')]),
  L('gilbert-ellice', 5, 1.4, 173.0, [
    P(null, '1941-12-10', 'Gilbert and Ellice Islands', 'British colony'),
    P('1941-12-10', '1943-11-23', 'Gilbert and Ellice Islands', 'Japanese-occupied (Gilberts)'),
    P('1943-11-23', null, 'Gilbert and Ellice Islands', 'British colony'),
  ], 'Kiribati & Tuvalu'),
  L('south-seas-mandate', 5, 7.4, 151.8, [
    P(null, null, 'South Seas Mandate', 'Japanese mandate'),
  ], 'Micronesia'),
  L('guam', 5, 13.45, 144.8, [
    P(null, '1941-12-10', 'Guam', 'US territory'),
    P('1941-12-10', '1944-07-21', 'Guam', 'Japanese-occupied'),
    P('1944-07-21', null, 'Guam', 'US territory'),
  ]),
  L('hawaii', 3, 19.6, -155.5, [P(null, null, 'Hawaii', 'US territory')]),

  // ---- The Americas ------------------------------------------------------
  L('united-states', 1, 39.5, -98.5, [P(null, null, 'United States')]),
  L('alaska', 3, 64.5, -152.0, [P(null, null, 'Alaska', 'US territory')]),
  L('canada', 1, 58.0, -100.0, [P(null, null, 'Canada')]),
  L('newfoundland', 4, 48.8, -56.5, [
    P(null, null, 'Newfoundland', 'Commission of Government'),
  ], 'part of Canada'),
  L('mexico', 2, 23.6, -102.5, [P(null, null, 'Mexico')]),
  L('cuba', 4, 21.8, -79.0, [P(null, null, 'Cuba')]),
  L('haiti', 5, 19.0, -72.5, [P(null, null, 'Haiti')]),
  L('dominican-republic', 5, 18.9, -70.5, [P(null, null, 'Dominican Republic')]),
  L('jamaica', 5, 18.1, -77.3, [P(null, null, 'Jamaica', 'British colony')]),
  L('guatemala', 5, 15.7, -90.3, [P(null, null, 'Guatemala')]),
  L('honduras', 5, 14.8, -86.6, [P(null, null, 'Honduras')]),
  L('british-honduras', 5, 17.2, -88.7, [P(null, null, 'British Honduras', 'British colony')], 'Belize'),
  L('el-salvador', 5, 13.7, -88.9, [P(null, null, 'El Salvador')]),
  L('nicaragua', 5, 12.9, -85.0, [P(null, null, 'Nicaragua')]),
  L('costa-rica', 5, 9.9, -84.2, [P(null, null, 'Costa Rica')]),
  L('panama', 5, 8.6, -80.1, [P(null, null, 'Panama')]),
  L('colombia', 4, 4.6, -74.1, [P(null, null, 'Colombia')]),
  L('venezuela', 4, 7.1, -66.2, [P(null, null, 'Venezuela')]),
  L('british-guiana', 5, 4.9, -58.9, [P(null, null, 'British Guiana', 'British colony')], 'Guyana'),
  L('surinam', 5, 4.0, -56.0, [P(null, null, 'Surinam', 'Dutch colony')], 'Suriname'),
  L('french-guiana', 5, 3.9, -53.0, [
    P(null, VICHY, 'French Guiana', 'French colony'),
    P(VICHY, '1943-03-16', 'French Guiana', 'Vichy-controlled'),
    P('1943-03-16', null, 'French Guiana', 'Free French'),
  ]),
  L('brazil', 1, -10.5, -52.5, [P(null, null, 'Brazil')]),
  L('ecuador', 5, -1.4, -78.4, [P(null, null, 'Ecuador')]),
  L('peru', 4, -9.2, -74.5, [P(null, null, 'Peru')]),
  L('bolivia', 4, -16.7, -64.7, [P(null, null, 'Bolivia')]),
  L('paraguay', 5, -23.2, -58.4, [P(null, null, 'Paraguay')]),
  L('chile', 4, -33.5, -70.7, [P(null, null, 'Chile')]),
  L('argentina', 2, -35.0, -65.0, [P(null, null, 'Argentina')]),
  L('uruguay', 5, -32.8, -56.0, [P(null, null, 'Uruguay')]),
]);
