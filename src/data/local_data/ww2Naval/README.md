# WW2 Naval Battles

Curated snapshot of 25 major World War II naval engagements spanning the
Atlantic, Mediterranean, Arctic, and Pacific theaters, 1939-1945.

Dates and coordinates were compiled from each battle's English Wikipedia
infobox (checked individually against the live articles). Descriptions are
original summaries written for this dataset, not copied from Wikipedia text.
Facts (dates, locations, outcomes) are not copyrightable; Wikipedia content
itself is CC BY-SA 4.0 for anyone reusing article text verbatim, which this
dataset does not do.

Feature count: 25

Runtime output: `ww2-naval-battles.geojsonl`

License: Public domain / no additional restriction — this is an original
compilation of historical facts. Retain the Wikipedia attribution in
`DATA_SOURCES.md` as a courtesy source credit.

## Coordinate precision

Most entries use the precise coordinates given in each battle's Wikipedia
infobox. A `coordinates_approximate: true` property flags entries where no
single infobox coordinate exists for a battle that was fought across a wide
area or convoy route (e.g. Battle of the Coral Sea, Convoy PQ 17, Convoy
ONS 5, the Channel Dash, the two Narvik actions) — for these, the point is a
representative location within the engagement area, not an exact position.

## Scope notes for follow-up work

This is a first pass covering major fleet actions only. Deliberately out of
scope for this dataset (candidates for a future layer or a second pass):

- Land campaigns, air campaigns (the Blitz, strategic bombing), and ground
  battles — this dataset is naval-only.
- U-boat/convoy *routes* as lines (this dataset is points only; convoy
  battles are represented by a single representative point).
- Sub-phases of multi-day battles (e.g. Leyte Gulf's four separate actions
  at Sibuyan Sea, Surigao Strait, Cape Engaño, and off Samar) are described
  in the parent battle's `description` field rather than broken into
  separate features, since Wikipedia's infobox does not give each phase its
  own coordinates.
- A front-line/territorial-control layer and a time-scrubber UI were
  explicitly deferred at scope time in favor of this static point layer.
