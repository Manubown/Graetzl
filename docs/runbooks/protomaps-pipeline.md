# Runbook: Protomaps Vienna PMTiles

> **Owner:** devops (Manu, run-it-yourself)
> **Output:** `public/data/vienna.pmtiles` — single self-hosted vector-tile
> file. MapLibre fetches range requests against it via the `pmtiles://`
> protocol registered in `src/components/map/vienna-map.tsx`.
> **Target size:** 5–30 MB at maxzoom 18. Verify before committing.

---

## Why Protomaps

Cleanest GDPR posture: the user's browser fetches map tiles from
*your* origin only (no `tile.openstreetmap.org`, no `api.maptiler.com`,
no `tiles.stadiamaps.com`). The PMTiles file is a single static asset
on Vercel — no tile-server infra, no API keys, no quotas.

Trade-off: you regenerate the file when you want fresh OSM data
(realistically once or twice a year for Vienna). The pipeline below
takes about 5 minutes end-to-end.

---

## Prerequisites

- **PowerShell** (built into Windows 10+).
- **go-pmtiles** binary on your PATH. Download from
  <https://github.com/protomaps/go-pmtiles/releases/latest>:
  - File: `go-pmtiles_<version>_Windows_x86_64.zip`
  - Extract `pmtiles.exe` to a folder on your PATH, e.g.
    `C:\Users\Manubown\bin\pmtiles.exe`, then verify:
    ```powershell
    pmtiles version
    ```
  - Alternatively, run it via a full path each time (avoids touching PATH).

No Docker, no Go, no Python required.

---

## Pipeline

### 1. Find the latest planet build

Protomaps publishes daily planet PMTiles at `https://build.protomaps.com/`.
List recent dates:

```powershell
$listing = Invoke-WebRequest -Uri "https://build.protomaps.com/" -UseBasicParsing
$listing.Content | Select-String -Pattern '(\d{8})\.pmtiles' -AllMatches |
  ForEach-Object { $_.Matches } | ForEach-Object { $_.Value } |
  Sort-Object -Unique -Descending | Select-Object -First 5
```

Pick the most recent. Below we use `20260515.pmtiles` as a placeholder —
substitute the date you see.

### 2. Extract Vienna's bbox

```powershell
pmtiles extract `
  https://build.protomaps.com/20260515.pmtiles `
  public/data/vienna.pmtiles `
  --bbox=16.18,48.10,16.58,48.33 `
  --maxzoom=18
```

This range-requests *only* the tiles inside Vienna's bbox at zoom levels
0–18 — total download is a small fraction of the 130 GB planet file
(typically 30–80 MB transferred to produce a 5–30 MB output).

**Bbox source:** matches `MAX_BOUNDS` in
`src/components/map/layers/style.ts`. If those bounds ever change, keep
this command in sync.

**Maxzoom note:** the app's `MAX_ZOOM = 19` (style.ts) but Protomaps'
planet builds top out at zoom 15 by default and detail zooms are
expensive to ship. Zoom 18 is plenty for the use-case (street level)
and keeps the file small. If you ever need 19, expect a larger file
and a slower extract.

### 3. Verify size + content

```powershell
$f = Get-Item public/data/vienna.pmtiles
"raw: $([math]::Round($f.Length / 1MB, 1)) MB"

# Inspect the header — confirms it's a valid PMTiles archive.
pmtiles show public/data/vienna.pmtiles
```

Pass criteria:
- Raw size between 5 MB and 50 MB. If >50 MB, drop maxzoom to 17.
- `pmtiles show` reports `bounds`, `center`, and a tile count >0.

### 4. Test locally

```powershell
pnpm dev
```

Open <http://localhost:3000>. The map should now show Protomaps'
"light" basemap (or "dark" if your system / `/me` toggle is set to
dark). District polygons + pins render on top as before. If the map
canvas is blank or shows checkered tiles, see Troubleshooting below.

---

## Outputs

After step 2 you should have:

```
public/data/vienna.pmtiles            5–30 MB  (committed to git)
```

**Committing to git:** the file is binary; on a 10 MB file `git diff`
will be unhelpful, but that's fine. We keep the runbook + the file
together so a fresh clone produces a working map without a build-time
fetch step. If the file ever exceeds 50 MB, switch to Git LFS or move
to a Vercel build step that fetches at deploy time.

---

## Theme + Flavour

`style.ts` exports `getProtomapsStyle("light" | "dark")` and the map
listens for changes to `<html data-theme>` (the value the `/me` toggle
writes). On toggle, MapLibre's `setStyle` swaps the layer JSON to the
matching flavour; the overlay re-attach in `vienna-map.tsx` restores
pin clusters, district polygons, and the active-Bezirk highlight.

The PMTiles file itself is theme-agnostic — only the layer JSON
changes. One file covers both modes.

---

## Self-hosting glyphs + sprites (optional, GDPR-stricter)

By default the style fetches fonts from
`https://protomaps.github.io/basemaps-assets/...`. These are small
(~50 KB total for the fonts used by Protomaps' standard styles) but
they are third-party GETs.

To eliminate that hop:

```powershell
git clone https://github.com/protomaps/basemaps-assets temp/basemaps-assets
Copy-Item -Recurse temp/basemaps-assets/fonts public/data/protomaps/
Copy-Item -Recurse temp/basemaps-assets/sprites public/data/protomaps/
Remove-Item -Recurse temp/basemaps-assets
```

Then in `src/components/map/layers/style.ts`, change:

```ts
const GLYPHS_URL = "/data/protomaps/fonts/{fontstack}/{range}.pbf";
const SPRITE_BASE = "/data/protomaps/sprites/v4";
```

This adds ~2 MB to the repo. Skip until you actually need the
strictest posture; the github.io fetch is cache-busting friendly and
GDPR-defensible (no PII transmitted, just font glyph data).

---

## Re-running

This pipeline is fully idempotent — re-running step 2 overwrites the
file. We re-run when:
- We want fresher OSM data (typically yearly).
- The Vienna bbox in `style.ts` changes.
- The `maxzoom` needs to change for size reasons.

No DB-side work involved; pins, districts, and triggers are entirely
independent of the base map style.

---

## Troubleshooting

**Map renders blank / checkered tiles.**
- `public/data/vienna.pmtiles` is missing or 404s. Check
  `pnpm dev` console for `Failed to fetch /data/vienna.pmtiles`.
- The pmtiles protocol isn't registered. Check the browser console for
  errors from MapLibre. The `addProtocol` call lives at the top of
  `src/components/map/vienna-map.tsx`.

**Tiles load but glyphs/labels are missing.**
- `protomaps.github.io` blocked (corporate proxy, VPN). Self-host the
  basemaps-assets per the section above.

**`pmtiles extract` reports "context deadline exceeded".**
- The planet build URL is slow that day. Retry, or pick an older
  build date (e.g. `20260501.pmtiles`).

**File is >50 MB.**
- Drop `--maxzoom` to 17 (or 16 if still too big). Vienna at z17 is
  about 8–15 MB; z18 is about 20–35 MB; z19 is 50+ MB.

---

## Attribution

The Protomaps source carries
`Protomaps © OpenStreetMap` (rendered via the style spec's
`source.attribution`). The Bezirksgrenzen source separately carries
`Bezirksgrenzen © Stadt Wien – data.wien.gv.at` (via
`districts-layer.ts`). MapLibre's attribution control merges both
strings into a single compact pill at the bottom of the map.

Both attributions are obligatory under the respective licences
(ODbL / CC-BY).
