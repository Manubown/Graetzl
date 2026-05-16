# Runbook: Bezirke GeoJSON Pipeline (B-1)

> **Owner:** devops (Manu, run-it-yourself)
> **Output:** two files committed to the repo —
> `public/data/bezirke.geojson` (simplified, client render) and
> `seed/districts-full.geojson` (full fidelity, DB seed).
> **Target sizes:** simplified ≤80 KB gzipped (≤300 KB raw); full-fidelity
> is whatever the source produces (typically ~1.5 MB raw).

---

## Source

City of Vienna's open-data Bezirksgrenzen layer, served via WFS:

- **Catalog page:** <https://www.data.gv.at/katalog/de/dataset/stadt-wien_bezirksgrenzenwien>
- **WFS endpoint:** `https://data.wien.gv.at/daten/geo`
- **Layer name:** `ogdwien:BEZIRKSGRENZEOGD`
- **License:** CC BY 4.0 (Stadt Wien – data.wien.gv.at) — attribution requirement is satisfied by the MapLibre attribution control's text appended in B-10.

The WFS speaks GeoJSON natively and can reproject to EPSG:4326 on the
server. That's the path we use — it removes the need for `ogr2ogr` and
GDAL, which is awkward on Windows.

---

## Prerequisites

- **PowerShell** (built into Windows 10+) — `Invoke-WebRequest` ships with it.
- **Node + pnpm** — already present in this repo.
- **mapshaper** — pure JS, installable via `pnpm dlx` per-invocation (no global install needed).

No GDAL, no Python, no `ogr2ogr`.

---

## Pipeline

### 1. Create the `seed/` directory (one time)

From the repo root in PowerShell:

```powershell
New-Item -ItemType Directory -Force -Path seed | Out-Null
New-Item -ItemType Directory -Force -Path public/data | Out-Null
```

### 2. Fetch the full-fidelity GeoJSON

```powershell
$wfs = "https://data.wien.gv.at/daten/geo?service=WFS&request=GetFeature&version=1.1.0&typeName=ogdwien:BEZIRKSGRENZEOGD&srsName=EPSG:4326&outputFormat=json"
Invoke-WebRequest -Uri $wfs -OutFile seed/districts-full.geojson
```

Sanity check:

```powershell
# Should be a JSON FeatureCollection with 23 features, all polygons.
$j = Get-Content seed/districts-full.geojson -Raw | ConvertFrom-Json
$j.features.Count   # expect 23
$j.features[0].properties | Format-List   # see the field names
$j.features[0].geometry.type   # expect "Polygon" or "MultiPolygon"
```

**→ Paste the `properties` block of the first feature back to Claude.**
The field names (`BEZNR`, `NAMEK`, etc.) tell us how to map source columns
to our `districts(id, name, slug)` schema in B-3.

### 3. Simplify for the client

```powershell
pnpm dlx mapshaper@latest seed/districts-full.geojson -simplify 8% keep-shapes -o public/data/bezirke.geojson
```

The `keep-shapes` flag prevents tiny polygons from being collapsed to a
point at high simplification ratios — important since Innere Stadt is
relatively small.

### 4. Verify size budget

```powershell
$raw = (Get-Item public/data/bezirke.geojson).Length
"raw: $raw bytes ($([math]::Round($raw/1KB,1)) KB)"

# Gzipped size estimate (rough, but good enough):
$tmp = New-TemporaryFile
$in  = [System.IO.File]::ReadAllBytes("public/data/bezirke.geojson")
$ms  = New-Object System.IO.MemoryStream
$gz  = New-Object System.IO.Compression.GZipStream($ms, [System.IO.Compression.CompressionLevel]::Optimal)
$gz.Write($in, 0, $in.Length); $gz.Close()
"gzipped: $($ms.Length) bytes ($([math]::Round($ms.Length/1KB,1)) KB)"
```

**Pass criteria:** raw ≤300 KB, gzipped ≤80 KB. If gzipped is over
budget, re-run step 3 with a stronger simplification (try `-simplify 5% keep-shapes`); spot-check after.

### 5. Spot-check accuracy (post-merge of B-3)

Once the simplified GeoJSON renders on the map and B-3..B-7 have shipped
so `district_id` association works, pick 10 locations across at least 6
Bezirke and verify each pin's resolved district matches wien.gv.at's
"Mein Bezirk" finder:

- <https://www.wien.gv.at/meinbezirk/>

Record the 10 spot-checks here under "Spot-Checks" (date + coords + expected + actual).

---

## Outputs

After step 4 you should have:

```
seed/districts-full.geojson           ~1.5 MB    (gitignored: see .gitignore)
public/data/bezirke.geojson           ≤300 KB raw, ≤80 KB gzipped (committed)
```

`seed/` is the staging area for DB-seed inputs. We commit the simplified
public-facing file but **NOT** the full-fidelity one (added to
`.gitignore` once it lands so the repo doesn't bloat). The DB seed
migration (B-3) embeds the full-fidelity polygons as literal SQL.

---

## Spot-Checks

> Fill this in once B-7 (createPin district association) ships.

| # | Coords (lat, lng) | Expected Bezirk | Actual `district_id` | Pass |
|---|-------------------|-----------------|----------------------|------|
| 1 |                   |                 |                      |      |
| 2 |                   |                 |                      |      |

---

## Re-running

This pipeline is fully idempotent — re-running steps 2 + 3 + 4 overwrites
the files. We re-run when:
- wien.gv.at publishes a Bezirksgrenzen update (rare — these change on
  political reorganisation only; last was the Floridsdorf merger in 1954).
- We need to adjust the simplification ratio.

The DB-side seed (B-3) is also idempotent (`on conflict (id) do update`),
so re-seeding is safe.
