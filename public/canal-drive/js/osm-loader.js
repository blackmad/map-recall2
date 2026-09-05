// ============================================================
// OSM LOADER — Overpass API client + data processing
// ============================================================
// Projection, simplification, recentring, snapping and the tile grid all live
// in src/canalRecall/osm/roadProjection.ts, bundled as road-projection.bundle.js.
const PROJECT = window.CanalRecallRoadProjection;

class OSMLoader {

  // Overpass API endpoints to try (multiple mirrors for reliability)
  static OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
  ];

  // Load the curated Amsterdam waterways shipped with Map Recall. The return
  // shape intentionally matches Smokey's Overpass road loader so the original
  // game engine can remain unchanged.
  async fetchRoads(lat, lng, radiusMeters, travelMode = 'boat', cityId = 'amsterdam') {
    const Prefs = window.CanalRecallPreferences;
    const city = Prefs && Prefs.cityById ? Prefs.cityById(cityId) : { id: cityId || 'amsterdam', extractPath: `../data/extracts/${cityId || 'amsterdam'}`, name: cityId || 'amsterdam' };
    try {
      // Quiz partitions stay deliberately compact. Driving needs the complete
      // connected street component or visible bridge approaches can have no
      // underlying centerline and the road guard will correctly refuse them.
      // Transit loads a GTFS-derived network object and adapts it to ways.
      if (travelMode === 'transit') {
        return this._fetchTransitWays(city);
      }
      const dataset = travelMode === 'car' ? 'streets-routing' : 'water';
      const dataUrl = new URL(`${city.extractPath}/${dataset}.json`, window.location.href);
      const response = await fetch(dataUrl);
      if (!response.ok) throw new Error(`${city.name} ${dataset}: HTTP ${response.status}`);
      const features = await response.json();
      const ways = [];
      // Stable per-name identity for the spaced-repetition store. The review
      // key hashes the feature's centre, so it has to come from the extract
      // rather than from wherever the player happens to be standing.
      this.featureMeta = this.featureMeta || new Map();
      this.cityId = city.id;
      this.transitLoad = null;
      for (const feature of features) {
        if (feature.name && feature.center && !this.featureMeta.has(feature.name)) {
          this.featureMeta.set(feature.name, {
            name: feature.name,
            type: feature.type || (travelMode === 'car' ? 'street' : 'canal'),
            cityId: feature.cityId || city.id,
            center: feature.center,
          });
        }
      }
      for (const feature of features) {
        const paths = feature.paths || (feature.path ? [feature.path] : []);
        for (let pathIndex = 0; pathIndex < paths.length; pathIndex++) {
          const path = paths[pathIndex];
          if (!path || path.length < 2) continue;
          // The extract retains named polygons for map context, but a closed
          // ring is an area outline, not a navigable centreline. For water
          // these are shore rings that loop around docks and islands. For
          // streets they are bridge decks and squares mapped as areas — a
          // bridge like Raampoort ships both its spans and a ring around the
          // deck, and driving onto the ring traps the car in a closed loop
          // with no through connection. 374 of 29,806 street paths (1.3%).
          const first = path[0], last = path[path.length - 1];
          const closedAreaRing = path.length > 3
            && first[0] === last[0] && first[1] === last[1];
          if (closedAreaRing) continue;
          const highway = travelMode === 'car'
            ? (feature.highway || (feature.type === 'avenue' ? 'secondary' : 'residential'))
            : (feature.type === 'canal' ? 'canal' : 'river');
          ways.push({
            id: `${feature.id}:${pathIndex}`,
            nodes: path.map(([pathLat, pathLon]) => ({ lat: pathLat, lon: pathLon })),
            tags: { name: feature.name, [travelMode === 'car' ? 'highway' : 'waterway']: highway },
            highway
          });
        }
      }
      console.log(`Loaded ${ways.length} curated ${city.name} ${dataset} paths`);
      return ways;
    } catch (localError) {
      console.warn('Curated water data unavailable; falling back to Overpass:', localError);
    }

    const latOffset = radiusMeters / 111320;
    const lngOffset = radiusMeters / (111320 * Math.cos(lat * Math.PI / 180));
    const south = lat - latOffset, north = lat + latOffset;
    const west = lng - lngOffset, east = lng + lngOffset;

    const selector = travelMode === 'car'
      ? 'way["highway"~"^(primary|secondary|tertiary|residential|living_street|unclassified|cycleway|pedestrian)$"]["name"]'
      : 'way["waterway"~"^(canal|river|dock)$"]["name"]';
    const query = `
      [out:json][timeout:60];
      ${selector}
        (${south},${west},${north},${east});
      out body geom;
    `;

    const body = 'data=' + encodeURIComponent(query);
    let lastError = null;

    // Try each endpoint, with one retry each
    for (const endpoint of OSMLoader.OVERPASS_ENDPOINTS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`Trying ${endpoint} (attempt ${attempt + 1})...`);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), OSM_FETCH_TIMEOUT);

          const resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body,
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (resp.status === 429 || resp.status === 504 || resp.status === 503) {
            lastError = new Error(`${endpoint}: HTTP ${resp.status}`);
            console.warn(lastError.message);
            // Wait a moment before retry/next server
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          if (!resp.ok) {
            lastError = new Error(`${endpoint}: HTTP ${resp.status}`);
            console.warn(lastError.message);
            break; // skip retries for other errors, try next endpoint
          }

          const data = await resp.json();

          const ways = [];
          for (const el of data.elements) {
            if (el.type !== 'way' || !el.geometry) continue;
            ways.push({
              id: el.id,
              nodes: el.geometry,
              tags: el.tags || {},
            highway: (el.tags && (el.tags.highway || el.tags.waterway)) || (travelMode === 'car' ? 'residential' : 'canal')
            });
          }
          console.log(`Loaded ${ways.length} waterways from ${endpoint}`);
          return ways;

        } catch (e) {
          lastError = e;
          console.warn(`${endpoint} attempt ${attempt + 1} failed:`, e.message);
          if (e.name === 'AbortError') {
            console.warn('Request timed out');
          }
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }

    throw new Error('All Overpass servers failed. ' + (lastError ? lastError.message : 'Try again later.'));
  }

  // Fetch OSM raster map tiles covering the area
  async fetchTiles(lat, lng, radiusMeters, centerLat, centerLng, offsetX, offsetY) {
    const z = 15; // zoom level — each tile ~770m at mid latitudes, good balance
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);

    // Bounding box in lat/lng
    const latOff = radiusMeters / 111320;
    const lngOff = radiusMeters / (111320 * Math.cos(lat * Math.PI / 180));
    const south = lat - latOff, north = lat + latOff;
    const west = lng - lngOff, east = lng + lngOff;

    // Convert bbox to tile coordinates
    const txMin = this._lngToTileX(west, z);
    const txMax = this._lngToTileX(east, z);
    const tyMin = this._latToTileY(north, z); // note: north has smaller Y
    const tyMax = this._latToTileY(south, z);

    // Cap tile count to avoid excessive requests
    const tileCount = (txMax - txMin + 1) * (tyMax - tyMin + 1);
    if (tileCount > MAX_TILES) {
      console.warn(`Too many tiles (${tileCount}), skipping tile background`);
      return [];
    }

    // Fetch all tiles in parallel
    const promises = [];
    for (let ty = tyMin; ty <= tyMax; ty++) {
      for (let tx = txMin; tx <= txMax; tx++) {
        promises.push(this._loadTile(tx, ty, z, centerLat, centerLng, metersPerDegreeLat, metersPerDegreeLng, offsetX, offsetY));
      }
    }

    const results = await Promise.all(promises);
    return results.filter(t => t !== null);
  }

  _loadTile(tx, ty, z, centerLat, centerLng, mPerDegLat, mPerDegLng, offsetX, offsetY) {
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      // Timeout to prevent hanging on slow tile CDN
      const timeoutId = setTimeout(() => {
        img.src = ''; // cancel load
        resolve(null);
      }, TILE_FETCH_TIMEOUT);
      img.onload = () => {
        clearTimeout(timeoutId);
        // Convert tile bounds to game coordinates
        const tileLngLeft = this._tileXToLng(tx, z);
        const tileLngRight = this._tileXToLng(tx + 1, z);
        const tileLatTop = this._tileYToLat(ty, z);
        const tileLatBottom = this._tileYToLat(ty + 1, z);

        const gameX = (tileLngLeft - centerLng) * mPerDegLng * PIXELS_PER_METER + offsetX;
        const gameY = -(tileLatTop - centerLat) * mPerDegLat * PIXELS_PER_METER + offsetY;
        const gameRight = (tileLngRight - centerLng) * mPerDegLng * PIXELS_PER_METER + offsetX;
        const gameBottom = -(tileLatBottom - centerLat) * mPerDegLat * PIXELS_PER_METER + offsetY;

        resolve({ img, gameX, gameY, gameW: gameRight - gameX, gameH: gameBottom - gameY });
      };
      img.onerror = () => { clearTimeout(timeoutId); resolve(null); };
      img.src = `https://a.basemaps.cartocdn.com/rastertiles/light_nolabels/${z}/${tx}/${ty}.png`;
    });
  }

  // Slippy map tile math. The typed helpers are fractional so they round-trip;
  // a tile *index* is the floor of that, which is this caller's need, not the
  // projection's.
  _lngToTileX(lng, z) { return Math.floor(PROJECT.lngToTileX(lng, z)); }
  _latToTileY(lat, z) { return Math.floor(PROJECT.latToTileY(lat, z)); }
  _tileXToLng(x, z) { return PROJECT.tileXToLng(x, z); }
  _tileYToLat(y, z) { return PROJECT.tileYToLat(y, z); }

  async _fetchTransitWays(city) {
    const Transit = window.CanalRecallTransit;
    if (!Transit || typeof Transit.adaptTransitNetwork !== 'function') {
      throw new Error('Transit adapter not loaded');
    }
    if (city.id !== 'amsterdam') {
      throw new Error('Transit mode is Amsterdam-only for now');
    }
    const dataUrl = new URL(`${city.extractPath}/transit-network.json`, window.location.href);
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error(`${city.name} transit-network: HTTP ${response.status}`);
    const network = await response.json();
    const load = Transit.adaptTransitNetwork(network, {
      playableRefs: Transit.TRANSIT_THIN_SLICE_REFS,
      cityId: city.id,
    });
    this.featureMeta = new Map(load.featureMeta);
    this.cityId = city.id;
    this.transitLoad = load;
    console.log(`Loaded ${load.ways.length} transit corridors (${load.stops.length} stops) for ${city.name}`);
    return load.ways;
  }

  // Convert ways to game-coordinate road segments. The arithmetic — projection,
  // simplification, widths, recentring — lives in `roadProjection.ts`; what
  // stays here is remembering the transform, because every later projection has
  // to be given the same one.
  buildRoadSegments(ways, centerLat, centerLng) {
    this._lastCenterLat = centerLat;
    this._lastCenterLng = centerLng;
    const built = PROJECT.buildRoadSegments(ways, { lat: centerLat, lon: centerLng }, {
      simplificationToleranceDegrees: SIMPLIFICATION_TOLERANCE,
      roadWidths: ROAD_WIDTHS,
      defaultRoadWidth: DEFAULT_ROAD_WIDTH,
    });
    this._lastOffsetX = built.offset.x;
    this._lastOffsetY = built.offset.y;
    return built.segments;
  }

  // Convert a lat/lng to the nearest road point in game coordinates
  latLngToGamePoint(lat, lng, centerLat, centerLng, segments, maxSnapDist = MAX_SNAP_DIST) {
    return PROJECT.snapToRoad(
      { lat, lon: lng }, { lat: centerLat, lon: centerLng },
      { x: this._lastOffsetX, y: this._lastOffsetY }, segments, maxSnapDist);
  }

  _closestOnSeg(px, py, a, b) {
    const closest = PROJECT.closestPointOnSegment({ x: px, y: py }, a, b);
    return { x: closest.x, y: closest.y, dist: closest.distance };
  }

  findStartFinish(segments) {
    return PROJECT.findStartFinish(segments) || { start: null, finish: null, distance: 0 };
  }

  simplify(points, tolerance) {
    return PROJECT.simplifyPath(points, tolerance);
  }

  haversine(lat1, lon1, lat2, lon2) {
    return PROJECT.haversineMetres({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 });
  }
}
