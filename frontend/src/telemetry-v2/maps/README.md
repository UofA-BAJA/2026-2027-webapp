# maps/

One image per site, drawn under the GPS map. Everything here works offline: no tile servers, no internet at the pits.

Each site is two files with the same name:

- `marana-practice.jpg` (or `.png`, `.webp`): the image, north up.
- `marana-practice.json`: its name and corner bounds as `[latitude, longitude]`.

```json
{
  "name": "Marana practice",
  "topLeft": [32.48428, -111.3134766],
  "bottomRight": [32.4611085, -111.2832642],
  "source": "where the image came from",
  "license": "public domain"
}
```

The car dot and trail are placed by scaling lat/lon into those corners, so the corners must be exact: the latitude/longitude of the image's top-left pixel corner and its bottom-right one.

## Add a site

1. Get an aerial image of the site, north up, a bit bigger than the course and pits.
2. Write down the latitude/longitude of its top-left and bottom-right corners.
3. Save it here as `<site>.jpg` and `<site>.json` (lowercase, dashes). Nothing else to edit: the dashboard finds every pair when it builds.
4. GPS settings (gear on the GPS tile) → SITE lists it. Left alone, the map uses whichever site the car is in; with no match it draws on black.

Keep images under ~3000 px a side so the page stays light.

## Where to get imagery

USGS imagery is **public domain** (US government work), so it can be committed and shared freely. Credit: "Map services and data available from U.S. Geological Survey, National Geospatial Program."

- **USGS The National Map**, ImageryOnly (USDA NAIP aerial photos, about 0.6 m per pixel): https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer. `marana-practice.jpg` is 110 of its zoom-17 tiles stitched together; for web-map tiles, the corners are the top-left corner of the first tile and the bottom-right corner of the last.
- **USGS EarthExplorer** (https://earthexplorer.usgs.gov) has the same NAIP photos as GeoTIFF files with their corners in the metadata.

Avoid Google or Bing screenshots: their imagery isn't free to redistribute.
