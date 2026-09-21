# God's Eye View · 1939–1945

A 3D globe for exploring the Second World War. It starts on the European theatre and lets you
switch the whole map between five moments of the war, with the countries named as they were
then: Czechoslovakia is the Protectorate of Bohemia and Moravia, Austria is the Ostmark, France
is split into Occupied France and Vichy France, Siam is Thailand, and Burma is under Japanese
occupation.

This is a fork of [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view) by Bilawal
Sidhu (MIT). It keeps the globe, the label and HUD machinery, and the share-link and voice
plumbing, and replaces the present-day content with 1939–1945 data.

## What is on the globe

| Layer | What it shows |
|-------|---------------|
| **WW2 Country Labels** | 153 label points with era-correct names and a short political status. Five snapshot chips on the layer row: **Aug 1939, Jun 1941, Nov 1942, Jun 1944, May 1945**. |
| **WW2 Naval Battles** | 25 major naval engagements, 1939–1945, across the Atlantic, Mediterranean, Arctic and Pacific. |

The whole interface is set in Baskerville (the web font is Libre Baskerville) for a printed-atlas look.
Around them: a war-atlas HUD (position and altitude only), Normal and Noir visual styles, scope,
bloom and sharpen controls, share links that remember the era, and optional voice control.

Labels are points, not borders. Where a fact could not be confirmed against a source it is listed in
[`src/data/local_data/ww2Countries/README.md`](src/data/local_data/ww2Countries/README.md).

## Run it

Node 24.14.x or 26.x.

```bash
npm install
npm run dev      # http://localhost:4173, no API keys required
npm test         # unit tests
npm run build    # production bundle
npm run doctor   # readiness report
```

Keys are optional. The in-app **POWER UP** chip offers the three that still matter: Google Maps
(photoreal 3D tiles), Cesium ion, and OpenAI (voice). Without them the globe uses keyless Esri
satellite imagery.

The basemap is today's imagery of the Earth; there is no global 1939–1945 imagery to swap in.

## What this build leaves out

Everything the original draws from the present day (live aircraft and ships, satellites, rocket
launches, earthquakes, fires, street traffic, CCTV, bike-share, internet radio, datacenters, dams,
submarine cables, cockpit view, spy-satellite HUD text, thermal/anime/snow/CRT filters, live weather
and headlines) is switched **off**, not deleted. The modules stay on disk so upstream fixes can still
merge. One flag, `WW2_ONLY` in [`src/period.js`](src/period.js), controls it; the file lists every
place it is read. (The HUD copy was rewritten in place, so it does not return with the flag.)

## Where to look

- [`CLAUDE.md`](CLAUDE.md): architecture, conventions and how this fork differs.
- [`DATA_SOURCES.md`](DATA_SOURCES.md): licences and attribution.
- [`docs/adm-173-199-research-guide.md`](docs/adm-173-199-research-guide.md): a research guide to
  the Royal Navy archive records (reference only; the archive's API terms forbid bundling its data).
- [`docs/UPSTREAM-README.md`](docs/UPSTREAM-README.md): the original project's README.

## Licence

Code is [MIT](LICENSE), copyright Bilawal Sidhu; this fork's additions are under the same terms. The
MIT grant covers code only. Every data source keeps its own licence (see `DATA_SOURCES.md`).
