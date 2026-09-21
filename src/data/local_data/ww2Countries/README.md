# WW2 Country Labels

Era-correct country and territory names for 1939-1945, drawn as labels on the
globe. 153 hand-placed label points (136 to 146 visible on any one snapshot), each
with a list of dated periods giving the name and short political status that
applied at the time (Czechoslovakia becomes the Protectorate of Bohemia and
Moravia, Siam is Thailand, Austria is the Ostmark, France splits into Occupied
France and Vichy France, and so on).

Runtime module: `labels.js` (dataset) and `../../ww2CountryLabels.js` (layer).

License: original compilation of historical facts, no additional restriction.
Facts are not copyrightable and no article text is reproduced. Wikipedia is
credited as a courtesy source (see `DATA_SOURCES.md`).

## How it behaves

The layer's panel row shows five snapshot chips. Choosing one relabels the
whole globe as it stood on that date:

| Chip | Date | Why this date |
|------|------|---------------|
| AUG 1939 | 31 Aug 1939 | Eve of the invasion of Poland; Danzig still a Free City |
| JUN 1941 | 22 Jun 1941 | Eve of Barbarossa; Yugoslavia and Greece already fallen |
| NOV 1942 | 15 Nov 1942 | Axis at its greatest extent, just after Case Anton and Torch |
| JUN 1944 | 6 Jun 1944 | D-Day; Italy split between the Kingdom and the Salo republic |
| MAY 1945 | 8 May 1945 | VE Day; Asia still at war |

The data itself is date-ranged (`from` inclusive, `to` exclusive), so the same
records could later drive a continuous date slider. Only the five chip dates are
checked by tests against fixed expectations; transition dates in between are the
best-known dates but are not individually pinned.

## Rules the data follows

- **Effective control, not legal survival.** A label reflects who actually held
  the place on that date. Vichy France is labelled until its regime left in
  August 1944; the Baltic states are labelled German-occupied in 1942 even though
  the Allies never recognised their annexation.
- **English names of the time.** `modern` adds "now X" when the present-day name
  differs from the name shown.
- **Labels are points, not borders.** Modern border data would be wrong for the
  period and historical border sets vary in licence and precision.
- **Coverage stops at 15 August 1945.** Later renamings (Siam again, Indonesia,
  the Vietnamese republic, Korea's division) are not modelled.
- **Partial occupations are not modelled** unless the main population centres or
  the administration fell (so Hong Kong and Singapore change, New Guinea does not).

## Editorial choices worth knowing

- The Independent State of Croatia ends on 8 May 1945 (fall of Zagreb), although
  Wikipedia dates its final surrender to 15 May.
- Reichskommissariat Ukraine is shown until 1 Apr 1944, when the Wehrmacht had
  lost effectively all of it; its formal dissolution was 10 Nov 1944.
- The Baltic and Belarusian occupation start dates use the fall of each capital
  (Vilnius 24 Jun, Riga 1 Jul, Minsk 28 Jun, Tallinn 28 Aug 1941).
- Poland reappears on 17 Jan 1945 (Warsaw liberated), not 31 Dec 1944 when the
  Provisional Government was formed, because the labels follow control on the
  ground.
- "Wang Jingwei Regime" is the common English name for the Reorganized National
  Government of China.
- Syria and Lebanon are labelled "Republic (French Mandate ending)" from their
  1943 elections/independence declarations; French troops stayed until 1946.

## Sourcing and confidence

Checked against fetched Wikipedia pages while building this: the lists of
sovereign states in the 1930s and 1940s; Independent State of Croatia; Italian
Social Republic; State of Burma; Second Philippine Republic; Empire of Vietnam;
French Indochina; Tuvan People's Republic; Mengjiang; Reorganized National
Government of China; Reichskommissariat Ostland and Ukraine; Slovak Republic
(1939-1945); Protectorate of Bohemia and Moravia; French West Africa; Ostmark
(Austria). Many statuses (Vichy, Iceland, Thailand's renaming, Vichy France's
zones) were confirmed against the sovereign-state lists.

Compiled from general historical knowledge and **not confirmed against a fetched
page** - worth a second look before relying on the exact day:

- Kingdom of Kampuchea (13 Mar 1945) and Kingdom of Luang Prabang (8 Apr 1945)
  proclamation dates (the pages fetched gave none).
- Lebanon's independence date (22 Nov 1943) and Syria's (17 Aug 1943).
- Madagascar's armistice (6 Nov 1942), French Guiana's rally (16 Mar 1943), New
  Caledonia's rally (19 Sep 1940), French Equatorial Africa's rally (26 Aug 1940).
- Hong Kong (25 Dec 1941), Guam (10 Dec 1941 / 21 Jul 1944), Gilbert Islands
  (10 Dec 1941 / 23 Nov 1943), Singapore (15 Feb 1942), Netherlands East Indies
  (9 Mar 1942), Portuguese Timor (20 Feb 1942) occupation dates.
- Italian East Africa's collapse into Ethiopia, Eritrea and Somaliland (Feb-May 1941).
- Anchor coordinates: hand-placed to sit over each territory; accurate to a degree
  or two, which is all a globe-scale label needs.
