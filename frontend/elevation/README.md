# Elevation drop folder

Put a USGS elevation GeoTIFF (`.tif`) here and the dashboard turns it into contour lines for the GPS map's **contours** background. There's no script to run: `./start.sh`, `npm run dev` and `npm run build` all convert anything new or changed, and a running dev server picks up a file within seconds of it landing here.

Output: `src/telemetry-v2/contours/<name>.geojson`. Commit that. The `.tif` files here are git-ignored because they can be hundreds of MB.

## Get the file

1. Open the USGS National Map Downloader: https://apps.nationalmap.gov/downloader
2. Zoom to the venue. Draw a box around it, or use the map extent.
3. Under **Data**, tick **Elevation Products (3DEP)**, then one of:
   - **1 meter DEM**: lidar, sharpest, covers most of the US
   - **1/3 arc-second DEM**: about 10 m, covers all of the US
4. **Search Products**, then download a **GeoTIFF** whose footprint covers the venue.
5. Drop it in this folder.

USGS 3DEP data is public domain (credit: "U.S. Geological Survey, 3D Elevation Program"). The map's "USGS" corner credit covers it.

## What happens to it

`plugins/contours.ts`:
- Reads the file and its coordinate system. Supported: NAD83 or WGS84 latitude/longitude (the 1/3 arc-second files), UTM zones in NAD83, NAD83(2011) or WGS84 (the 1 m files), and web mercator. Anything else is skipped, with a message in the dev server log.
- If the file covers a venue in `config/venues.ts` (its `bounds`), it cuts out just that area at full resolution and writes `contours/<venue id>.geojson`. A 1° tile of hundreds of MB still only reads the few MB around the venue. A file that covers no venue is converted whole as `contours/<file name>.geojson`.
- Smooths the heights over about 10 m, so furrows and lidar noise don't draw lines.
- Picks the contour spacing from the terrain: the smallest of 0.25, 0.5, 1, 2, 5, 10, 20 m… that gives at most 25 levels. Every 5th line is brighter. Marana (577–591 m) gets 1 m lines.
- Drops pieces shorter than 40 m and simplifies lines to about 1 m.

Two files covering the same venue: the one converted last wins. To force a full redo, run `node --experimental-strip-types plugins/contours.ts` from `frontend/`.
