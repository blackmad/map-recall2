// ============================================================
// ROAD NETWORK — replaces Track for OSM open-road mode
// ============================================================
//
// This file is the adapter half. Every decision it used to make inline — the
// surface bands, which road the player is on at a junction, which same-name
// ways are one feature, and the whole routing graph — lives in
// src/canalRecall/routing/, is typed, and is tested by `npm run
// test:road-surface`, `test:road-graph` and `test:reachability`. What is left
// here is caching, canvas work, and the shape the rest of the game calls.
//
// Both bundles are loaded unconditionally by index.html. Reaching this file
// without them is a build error, not a runtime condition to fall back from:
// the fallbacks that used to be here were dead code that could silently
// diverge from the tested versions.
const SURFACE = window.CanalRecallRoadSurface;
const GRAPH = window.CanalRecallRoadGraph;
if (!SURFACE || !GRAPH) {
  throw new Error('road-network.js needs road-surface.bundle.js and road-graph.bundle.js');
}

class RoadNetwork {
  constructor(segments, startPoint, finishPoint, tiles) {
    this.isOpenTrack = true;
    this.segments = segments; // [{points, width, type, normals, leftBound, rightBound}]
    this.tiles = tiles || []; // [{img, gameX, gameY, gameW, gameH}]
    this.startPoint = { ...startPoint };
    this.finishPoint = { ...finishPoint };
    this.roadIndex = null;
    this.numCheckpoints = 10;
    this._frameCache = new Map();

    this._computeSegmentGeometry();
    this._buildGrid();
    this._computeBounds();
    this._buildLabels();

    // Total "as the crow flies" distance from start to finish
    this.totalLength = dist(
      this.startPoint.x, this.startPoint.y,
      this.finishPoint.x, this.finishPoint.y
    );

    // Compute start/finish angles from nearest road tangent
    this._computeEndpointAngles();

    // Pre-render the track canvas
    this.trackCanvas = null;
    this.trackBounds = null;
    // Open waterways are rendered live at screen resolution by Renderer so
    // zooming never magnifies a cached bitmap.
  }

  _computeSegmentGeometry() {
    for (const seg of this.segments) {
      seg.normals = [];
      seg.leftBound = [];
      seg.rightBound = [];
      seg.bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

      for (let i = 0; i < seg.points.length; i++) {
        const prev = i > 0 ? seg.points[i - 1] : seg.points[i];
        const next = i < seg.points.length - 1 ? seg.points[i + 1] : seg.points[i];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len, ny = dx / len;
        seg.normals.push({ x: nx, y: ny });
        seg.leftBound.push({ x: seg.points[i].x + nx * seg.width, y: seg.points[i].y + ny * seg.width });
        seg.rightBound.push({ x: seg.points[i].x - nx * seg.width, y: seg.points[i].y - ny * seg.width });
        seg.bounds.minX = Math.min(seg.bounds.minX, seg.points[i].x - seg.width);
        seg.bounds.minY = Math.min(seg.bounds.minY, seg.points[i].y - seg.width);
        seg.bounds.maxX = Math.max(seg.bounds.maxX, seg.points[i].x + seg.width);
        seg.bounds.maxY = Math.max(seg.bounds.maxY, seg.points[i].y + seg.width);
      }
    }
  }

  _buildGrid() {
    this.roadIndex = SURFACE.buildRoadSpatialIndex(this.segments, ROAD_GRID_CELL);
  }

  _computeBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const seg of this.segments) {
      for (const p of seg.points) {
        if (p.x - seg.width < minX) minX = p.x - seg.width;
        if (p.y - seg.width < minY) minY = p.y - seg.width;
        if (p.x + seg.width > maxX) maxX = p.x + seg.width;
        if (p.y + seg.width > maxY) maxY = p.y + seg.width;
      }
    }
    this._bounds = { minX: minX - 100, minY: minY - 100, maxX: maxX + 100, maxY: maxY + 100 };
  }

  _computeEndpointAngles() {
    // Find the road segment closest to start/finish and get its tangent
    const startInfo = this.getNearestRoad(this.startPoint.x, this.startPoint.y);
    const finishInfo = this.getNearestRoad(this.finishPoint.x, this.finishPoint.y);
    this.startPoint.angle = startInfo ? startInfo.angle : 0;
    this.finishPoint.angle = finishInfo ? finishInfo.angle : 0;
  }

  getBounds() {
    return this._bounds;
  }

  // Surface detection — is (x,y) on a road?
  getSurface(x, y) {
    const surfaceKey = `surface:${Math.round(x / 4)},${Math.round(y / 4)}`;
    if (this._frameCache.has(surfaceKey)) return this._frameCache.get(surfaceKey);
    if (this.waterTest && this.waterTest(x, y)) {
      this._frameCache.set(surfaceKey, 'asphalt');
      return 'asphalt';
    }
    let minDist = Infinity;
    let nearestWidth = DEFAULT_ROAD_WIDTH;
    for (const road of SURFACE.roadsNear(this.roadIndex, x, y)) {
      const d = this._pointToSegDist(x, y, road.a, road.b);
      if (d < minDist) { minDist = d; nearestWidth = road.width; }
    }
    const surface = SURFACE.classifySurface(minDist, nearestWidth);
    this._frameCache.set(surfaceKey, surface);
    return surface;
  }

  // Clear per-frame result cache (call at start of each game frame)
  clearFrameCache() {
    this._frameCache.clear();
  }

  // Find nearest road point + tangent angle (with per-frame caching)
  getNearestRoad(x, y, preferredAngle = null) {
    // Quantize position to nearest 5px for cache key
    const qx = Math.round(x / 5) * 5;
    const qy = Math.round(y / 5) * 5;
    const headingKey = preferredAngle == null ? '' : `:${Math.round(preferredAngle * 12)}`;
    const cacheKey = `${qx},${qy}${headingKey}`;
    const cached = this._frameCache.get(cacheKey);
    if (cached !== undefined) return cached;

    // A 5x5 ring rather than the 3x3 the surface check uses: this one has to
    // see the *cross* street at a junction, not only the one underfoot, so the
    // heading rule has something to choose between.
    const contacts = SURFACE.contactsAt(SURFACE.roadsNear(this.roadIndex, x, y, 2), x, y);
    const best = SURFACE.pickRoadContact(contacts, preferredAngle);

    this._frameCache.set(cacheKey, best);
    return best;
  }

  // Get the name of the road nearest to (x,y)
  getRoadName(x, y) {
    return SURFACE.roadNameAt(this.segments, this.getNearestRoad(x, y));
  }

  // Return the connected run of same-name OSM ways containing the triggering
  // segment. OSM commonly splits one canal at bridges and tag boundaries, so
  // one visible feature is often several source paths.
  getConnectedNamedSegments(seedIndex) {
    return SURFACE.connectedNamedSegments(this.segments, seedIndex);
  }

  // Distance from (x,y) to the finish point
  getDistanceToFinish(x, y) {
    return dist(x, y, this.finishPoint.x, this.finishPoint.y);
  }

  // Get race progress as 0..1
  getRaceProgress(x, y) {
    const dToFinish = this.getDistanceToFinish(x, y);
    return clamp(1 - dToFinish / this.totalLength, 0, 1);
  }

  // Interface compatibility with Track — these are used by the car for getNearestT
  getNearestT(x, y) {
    return this.getRaceProgress(x, y);
  }

  // Stub methods for interface compatibility
  getPointAt(t) {
    // Lerp between start and finish
    return {
      x: lerp(this.startPoint.x, this.finishPoint.x, clamp(t, 0, 1)),
      y: lerp(this.startPoint.y, this.finishPoint.y, clamp(t, 0, 1))
    };
  }

  getTangentAt(t) {
    const dx = this.finishPoint.x - this.startPoint.x;
    const dy = this.finishPoint.y - this.startPoint.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  getNormalAt(t) {
    const tan = this.getTangentAt(t);
    return { x: -tan.y, y: tan.x };
  }

  getWidthAt(t) {
    return DEFAULT_ROAD_WIDTH;
  }

  getCurvatureAt(t) {
    return 0;
  }

  // Build a lightweight topology from waterway polyline points and run
  // Dijkstra. Nearby endpoints are merged so separately mapped OSM ways can
  // form one playable route through a junction.
  // The routing graph is identical for every query against this network, so
  // build it once. Retargeting an unreachable destination would otherwise
  // rebuild it for each candidate it tries.
  // Sharing a vertex is not enough on its own. OSM models a side street
  // meeting a through street as a node *inside* the through way, and both the
  // extract builder and the loader run Douglas-Peucker, which is free to drop
  // exactly that vertex — 10% of shared junction vertices disappear. The
  // through street then runs straight past the side street with no shared
  // point, and the side street becomes its own island: drivable, but with no
  // route in or out. Stitching every way's endpoint onto any centreline that
  // passes within a few metres puts those T-junctions back. It cuts the
  // Amsterdam street graph from 1679 components to 469 and lifts the largest
  // component from 56% of the network to 75%. See scripts/check-road-reachability.ts.
  // Build a lightweight topology from the polyline points and run Dijkstra.
  // Nearby endpoints are merged so separately mapped OSM ways can form one
  // playable route through a junction.
  //
  // Sharing a vertex is not enough on its own. OSM models a side street meeting
  // a through street as a node *inside* the through way, and both the extract
  // builder and the loader run Douglas-Peucker, which is free to drop exactly
  // that vertex — 10% of shared junction vertices disappear. The through street
  // then runs straight past the side street with no shared point, and the side
  // street becomes its own island: drivable, but with no route in or out.
  // Stitching every way's endpoint onto any centreline that passes within a few
  // metres puts those T-junctions back. It cuts the Amsterdam street graph from
  // 1679 components to 469 and lifts the largest component from 56% of the
  // network to 75%. See scripts/check-road-reachability.ts.
  //
  // The graph is identical for every query against this network, so it is built
  // once. Retargeting an unreachable destination would otherwise rebuild it for
  // each candidate it tries.
  _routingGraph() {
    if (this._graphCache) return this._graphCache;
    this._graphCache = GRAPH.buildRoadGraph(
      this.segments.map((segment, segmentIndex) => ({
        points: segment.points,
        width: segment.width || 0,
        metadata: { segmentIndex, name: segment.name || '', wayId: segment.wayId || '' },
      })),
      { mergeSize: 18, junctionStitchRadius: JUNCTION_STITCH_RADIUS }
    );
    return this._graphCache;
  }

  _nearestGraphNode(point) {
    return GRAPH.nearestRoadGraphNode(this._routingGraph(), point);
  }

  // Dijkstra from `startPoint` over the whole graph. `stopAt` short-circuits
  // once that node is settled; omit it to settle everything reachable.
  _shortestPaths(startPoint, stopAt = null) {
    return GRAPH.shortestRoadPaths(this._routingGraph(), startPoint, { stopAt });
  }

  findRoute(startPoint, finishPoint) {
    return GRAPH.findRoadRoute(this._routingGraph(), startPoint, finishPoint);
  }

  // One Dijkstra pass, then pick the first candidate that is actually
  // reachable. Candidates should already be ordered by preference.
  findRouteToFirstReachable(startPoint, candidatePoints) {
    return GRAPH.findRoadRouteToFirstReachable(this._routingGraph(), startPoint, candidatePoints);
  }

  // ---- Internal helpers ----

  _pointToSegDist(px, py, a, b) {
    return this._closestPointOnSeg(px, py, a, b).dist;
  }

  _closestPointOnSeg(px, py, a, b) {
    const abx = b.x - a.x, aby = b.y - a.y;
    const apx = px - a.x, apy = py - a.y;
    const lenSq = abx * abx + aby * aby;
    if (lenSq === 0) return { x: a.x, y: a.y, dist: dist(px, py, a.x, a.y) };
    const t = clamp((apx * abx + apy * aby) / lenSq, 0, 1);
    const cx = a.x + abx * t, cy = a.y + aby * t;
    return { x: cx, y: cy, dist: dist(px, py, cx, cy) };
  }

  // ---- Pre-rendering ----

  preRender() {
    const bounds = this.getBounds();
    this.trackBounds = bounds;
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;

    // Cap canvas size to avoid memory issues
    let scale = 1;
    if (w > MAX_CANVAS_DIM || h > MAX_CANVAS_DIM) {
      scale = MAX_CANVAS_DIM / Math.max(w, h);
    }

    this.trackCanvas = document.createElement('canvas');
    this.trackCanvas.width = Math.ceil(w * scale);
    this.trackCanvas.height = Math.ceil(h * scale);
    this.renderScale = scale;
    const tc = this.trackCanvas.getContext('2d');
    tc.scale(scale, scale);
    tc.translate(-bounds.minX, -bounds.minY);

    // Keep the game layer transparent; MapLibre renders a live vector map
    // underneath it. Only the highlighted navigable waterways are baked here.

    // Draw all road surfaces (wider roads first for proper layering)
    const sortedSegs = [...this.segments].sort((a, b) => b.width - a.width);

    // Pass 1: Road surface (no curbs for road network — clean look)
    for (const seg of sortedSegs) {
      if (seg.points.length < 2) continue;

      // Road surface — color by road type
      const roadCol = ROAD_COLORS[seg.type] || { fill: COLORS.road, light: COLORS.roadLight };
      tc.beginPath();
      tc.moveTo(seg.leftBound[0].x, seg.leftBound[0].y);
      for (let i = 1; i < seg.leftBound.length; i++) {
        tc.lineTo(seg.leftBound[i].x, seg.leftBound[i].y);
      }
      for (let i = seg.rightBound.length - 1; i >= 0; i--) {
        tc.lineTo(seg.rightBound[i].x, seg.rightBound[i].y);
      }
      tc.closePath();
      tc.fillStyle = roadCol.fill;
      tc.fill();

      // Lighter center
      tc.beginPath();
      const innerFrac = 0.7;
      tc.moveTo(
        seg.points[0].x + seg.normals[0].x * seg.width * innerFrac,
        seg.points[0].y + seg.normals[0].y * seg.width * innerFrac
      );
      for (let i = 1; i < seg.points.length; i++) {
        tc.lineTo(
          seg.points[i].x + seg.normals[i].x * seg.width * innerFrac,
          seg.points[i].y + seg.normals[i].y * seg.width * innerFrac
        );
      }
      for (let i = seg.points.length - 1; i >= 0; i--) {
        tc.lineTo(
          seg.points[i].x - seg.normals[i].x * seg.width * innerFrac,
          seg.points[i].y - seg.normals[i].y * seg.width * innerFrac
        );
      }
      tc.closePath();
      tc.fillStyle = roadCol.light;
      tc.fill();
    }

    // Pass 2: Center dashed lines
    tc.strokeStyle = 'rgba(255,255,255,0.3)';
    tc.lineWidth = 2;
    tc.setLineDash([15, 15]);
    for (const seg of this.segments) {
      if (seg.points.length < 2) continue;
      tc.beginPath();
      tc.moveTo(seg.points[0].x, seg.points[0].y);
      for (let i = 1; i < seg.points.length; i++) {
        tc.lineTo(seg.points[i].x, seg.points[i].y);
      }
      tc.stroke();
    }
    tc.setLineDash([]);

    // Pass 3: Edge lines
    tc.strokeStyle = 'rgba(255,255,255,0.4)';
    tc.lineWidth = 1.5;
    for (const seg of this.segments) {
      if (seg.points.length < 2) continue;
      // Left edge
      tc.beginPath();
      tc.moveTo(seg.leftBound[0].x, seg.leftBound[0].y);
      for (let i = 1; i < seg.leftBound.length; i++) tc.lineTo(seg.leftBound[i].x, seg.leftBound[i].y);
      tc.stroke();
      // Right edge
      tc.beginPath();
      tc.moveTo(seg.rightBound[0].x, seg.rightBound[0].y);
      for (let i = 1; i < seg.rightBound.length; i++) tc.lineTo(seg.rightBound[i].x, seg.rightBound[i].y);
      tc.stroke();
    }

    // Road names are drawn in real-time (see drawLabels) to avoid blur from pre-render scaling

    // Start marker (green checkered)
    this._drawCheckered(tc, this.startPoint, '#4CAF50');

    // Finish marker (gold checkered)
    this._drawCheckered(tc, this.finishPoint, '#FFD700');

    // Note: START/FINISH text labels are drawn in real-time via drawLabels()
  }

  // Pre-compute road name label positions (called once at construction)
  _buildLabels() {
    this.labels = [];

    for (const seg of this.segments) {
      if (!seg.name || seg.points.length < 2) continue;

      let totalLen = 0;
      for (let i = 0; i < seg.points.length - 1; i++) {
        totalLen += dist(seg.points[i].x, seg.points[i].y, seg.points[i + 1].x, seg.points[i + 1].y);
      }

      if (totalLen < 120) continue; // skip very short segments

      // Place labels every ~1500px along the segment
      const spacing = 1500;
      let nextLabel = Math.min(totalLen / 2, spacing * 0.4);
      let cumDist = 0;

      for (let i = 0; i < seg.points.length - 1 && nextLabel < totalLen; i++) {
        const a = seg.points[i], b = seg.points[i + 1];
        const segLen = dist(a.x, a.y, b.x, b.y);

        while (nextLabel >= cumDist && nextLabel < cumDist + segLen) {
          const t = (nextLabel - cumDist) / segLen;
          const lx = a.x + (b.x - a.x) * t;
          const ly = a.y + (b.y - a.y) * t;
          let angle = Math.atan2(b.y - a.y, b.x - a.x);
          if (angle > Math.PI / 2) angle -= Math.PI;
          if (angle < -Math.PI / 2) angle += Math.PI;

          this.labels.push({ text: seg.name, x: lx, y: ly, angle });
          nextLabel += spacing;
        }
        cumDist += segLen;
      }
    }
  }

  // Draw road names + endpoint labels at screen resolution (called each frame from renderer)
  // `hiddenName` is the street currently being asked about: its label would
  // otherwise sit on the map spelling out the answer.
  // `isLabelled(text, worldX, worldY)` rather than a name set: a long street can
  // be known at one end and unlearned at the other, and writing the name across
  // the unlearned end would hand the player the answer before the question.
  drawLabels(ctx, camera, isLabelled, hiddenName = '', player = null) {
    const z = camera.zoom || 1;
    const fontSize = Math.max(8, Math.round(9 * z));
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Only draw labels visible in the viewport (expand bounds for zoom-out)
    const halfW = (CANVAS_W / 2 + 150) / z;
    const halfH = (CANVAS_H / 2 + 150) / z;

    // Road name labels — with screen-space overlap + same-name proximity rejection
    const drawnRects = []; // [{x, y, w, h, text}] in screen space

    if (this.labels && this.labels.length > 0) {
      for (const lbl of this.labels) {
        if (isLabelled && !isLabelled(lbl.text, lbl.x, lbl.y)) continue;
        if (hiddenName && lbl.text === hiddenName) continue;
        const screen = camera.worldToScreen(lbl.x, lbl.y);
        const screenX = screen.x;
        const screenY = screen.y;
        if (screenX < -150 || screenX > CANVAS_W + 150 || screenY < -150 || screenY > CANVAS_H + 150) continue;
        if (player && Math.hypot(lbl.x - player.x, lbl.y - player.y) * z < 145) continue;

        // Estimate label bounding box in screen space for overlap check
        const tw = ctx.measureText(lbl.text).width;
        const pad = 5;
        const rectW = tw + pad * 2 + 10; // margin
        const rectH = fontSize + 10;

        // Check overlap with any drawn label AND same-name proximity
        let skip = false;
        const minNameDist = 520; // one readable label per nearby connected run
        for (const r of drawnRects) {
          const dx = Math.abs(screenX - r.x), dy = Math.abs(screenY - r.y);
          // Axis-aligned overlap
          if (dx < (rectW + r.w) / 2 && dy < (rectH + r.h) / 2) {
            skip = true;
            break;
          }
          // Same road name too close
          if (r.text === lbl.text && dx * dx + dy * dy < minNameDist * minNameDist) {
            skip = true;
            break;
          }
        }
        if (skip) continue;

        drawnRects.push({ x: screenX, y: screenY, w: rectW, h: rectH, text: lbl.text });

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(lbl.angle - (camera.rotation || 0));

        // Match the basemap rather than laying black UI capsules over roads.
        // A quiet paper halo remains readable above route geometry and roofs.
        ctx.strokeStyle = 'rgba(250,249,244,.92)';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.strokeText(lbl.text, 0, 0);
        ctx.fillStyle = 'rgba(38,56,59,.78)';
        ctx.fillText(lbl.text, 0, 0);
        ctx.restore();
      }
    }

    this._drawScreenLabel(ctx, camera, this.startPoint, 'START', '#4CAF50', halfW, halfH);
  }

  _drawScreenLabel(ctx, camera, point, text, color, halfW, halfH) {
    const z = camera.zoom || 1;
    const screen = camera.worldToScreen(point.x, point.y);
    const screenX = screen.x;
    const screenY = screen.y;
    if (screenX < -150 || screenX > CANVAS_W + 150 || screenY < -150 || screenY > CANVAS_H + 150) return;

    ctx.save();
    const fs = Math.max(9, Math.round(12 * z));
    ctx.font = `bold ${fs}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const info = this.getNearestRoad(point.x, point.y);
    const w = info ? info.width : DEFAULT_ROAD_WIDTH;
    const labelY = screenY - (w + 20) * z;

    // Background pill
    const tw = ctx.measureText(text).width;
    const pw = tw + 16, ph = fs + 8;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    roundRect(ctx, screenX - pw / 2, labelY - ph / 2, pw, ph, 5);
    ctx.fill();

    // Colored text
    ctx.fillStyle = color;
    ctx.fillText(text, screenX, labelY);
    ctx.restore();
  }

  _drawCheckered(tc, point, color) {
    const info = this.getNearestRoad(point.x, point.y);
    if (!info) return;
    const w = info.width || DEFAULT_ROAD_WIDTH;
    tc.save();
    tc.translate(point.x, point.y);
    tc.rotate(info.angle + Math.PI / 2);
    const sz = 12;
    for (let row = -Math.floor(w / sz); row <= Math.floor(w / sz); row++) {
      for (let col = -2; col <= 2; col++) {
        tc.fillStyle = (row + col) % 2 === 0 ? color : '#222';
        tc.fillRect(col * sz, row * sz, sz, sz);
      }
    }
    tc.restore();
  }

}
