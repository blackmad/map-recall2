// Methods in this file are installed on Game.prototype by game.js.
// Keeping each subsystem in a class preserves private runtime state on the Game instance
// while making ownership and review boundaries explicit.
class GameLandmarkRuntime {
  _inspectBuildingAt(clientX, clientY) {
    if (!this.player || this.quizPromptName || this._utilityOpen) return;
    const rect = this.canvas.getBoundingClientRect();
    const screen = { x: (clientX - rect.left) * CANVAS_W / rect.width, y: (clientY - rect.top) * CANVAS_H / rect.height };
    const building = this.vectorMap.inspectBuilding(clientX - rect.left, clientY - rect.top, rect);
    let nearest = null, nearestDistance = 120;
    for (const landmark of this.landmarks) {
      const point = this.camera.worldToScreen(landmark.x, landmark.y);
      const distance = Math.hypot(point.x - screen.x, point.y - screen.y);
      if (distance < nearestDistance) { nearest = landmark; nearestDistance = distance; }
    }
    if (nearest && building && building.featureTarget) {
      // Keep the curated card identity, but highlight the actual extrusion
      // under the click rather than rebuilding its approximate OSM footprint.
      nearest = { ...nearest, featureTarget: building.featureTarget };
    }
    if (!nearest) {
      if (!building) return;
      const buildingName = building.name || '';
      const matchedLandmark = this._matchLandmarkToBuilding(building, buildingName);
      if (matchedLandmark) {
        nearest = { ...matchedLandmark, featureTarget: building.featureTarget };
      } else {
        // A nameless footprint cannot teach the player anything, but swallowing
        // the click makes the map look broken. Acknowledge it without inventing
        // a name or presenting it as encyclopedia content.
        nearest = buildingName ? {
          id: `clicked-${building.id || building.lngLat.join('-')}`,
          name: buildingName,
          detail: 'Mapped building — click nearby landmarks to learn more.',
          lngLat: building.lngLat,
          featureTarget: building.featureTarget,
        } : {
          id: `clicked-${building.id || building.lngLat.join('-')}`,
          name: 'No building details',
          detail: 'This building has no name in the map data.',
          lngLat: building.lngLat,
          featureTarget: building.featureTarget,
        };
      }
    }
    this._ensureLandmarkSummary(nearest);
    this._landmarkNotice = nearest;
    this._landmarkNoticeTimer = 8;
    this._landmarkNoticeDuration = 8;
    this.vectorMap.setActiveLandmark(nearest);
  }

  // Buildings were matched to landmarks by exact name equality, so anything
  // with different punctuation, casing, or a localised OSM name fell through
  // to the generic "Mapped building" card even when the extract had a full
  // Wikipedia entry for it. Compare normalised names, then fall back to the
  // nearest landmark to the clicked footprint.
  // The extract carries a Wikipedia URL for 236 of its 300 landmarks, which
  // the canvas card cannot make clickable — so offer it on a key instead.
  // Only 112 of the 300 landmarks ship an extract, so the rest showed a bare
  // name. Wikipedia's REST summary endpoint sends CORS headers, so the missing
  // text can be fetched on demand — no proxy, one request per landmark, cached
  // for the session.
  // The article OSM tags is nearly always the Dutch one ("nl:Blauwbrug"), so
  // fetching the summary it names filled the card with Dutch. The English
  // article is resolved through the feature's Wikidata id instead, and if
  // English has nothing to say about the place the card keeps its name rather
  // than showing a language the player did not ask for.

  _ensureLandmarkSummary(landmark) {
    if (!landmark || landmark.longDetail || landmark.detail) return;
    if (!landmark.wikidata && !this._englishTitle(landmark)) return;
    this._summaryRequests = this._summaryRequests || new Set();
    if (this._summaryRequests.has(landmark.id)) return;
    this._summaryRequests.add(landmark.id);
    this._fetchEnglishSummary(landmark).catch(() => { /* the card falls back to its name */ });
  }

  // `en:Title` on the feature itself, when the extract builder already found
  // one; otherwise nothing, and the Wikidata lookup does the work.

  _englishTitle(landmark) {
    if (!landmark.wikipedia) return '';
    const separator = landmark.wikipedia.indexOf(':');
    if (separator < 0) return '';
    return landmark.wikipedia.slice(0, separator) === 'en' ? landmark.wikipedia.slice(separator + 1) : '';
  }

  async _fetchEnglishSummary(landmark) {
    let title = this._englishTitle(landmark);
    if (!title && landmark.wikidata) {
      const entity = new URL('https://www.wikidata.org/w/api.php');
      entity.search = new URLSearchParams({
        action: 'wbgetentities', format: 'json', props: 'sitelinks',
        sitefilter: 'enwiki', ids: landmark.wikidata, origin: '*',
      }).toString();
      const response = await fetch(entity, { headers: { accept: 'application/json' } });
      if (!response.ok) return;
      const data = await response.json();
      title = data?.entities?.[landmark.wikidata]?.sitelinks?.enwiki?.title || '';
    }
    if (!title) return;
    const summary = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    const response = await fetch(summary, { headers: { accept: 'application/json' } });
    if (!response.ok) return;
    const data = await response.json();
    const extract = data && data.extract;
    if (!extract) return;
    const sentences = extract.split(/(?<=[.!?])\s/);
    landmark.detail = sentences[0].slice(0, 150);
    landmark.longDetail = sentences.slice(0, 3).join(' ').slice(0, 280);
    landmark.extractLang = 'en';
  }

  _openLandmarkArticle() {
    const url = this._landmarkNotice && this._landmarkNoticeTimer > 0 && this._landmarkNotice.wikipediaUrl;
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  }

  _showStreetKnowledge(name) {
    const entry = this.streetKnowledge.get(this._normaliseCanalName(name));
    if (!entry) return;
    const detail = entry.wikipediaExtract || '';
    this._landmarkNotice = {
      id: `street-knowledge:${this._normaliseCanalName(name)}`,
      name: entry.name || name,
      type: 'street',
      detail: detail.split(/(?<=[.!?])\s/)[0].slice(0, 150),
      longDetail: detail.split(/(?<=[.!?])\s/).slice(0, 3).join(' ').slice(0, 280),
      wikipediaUrl: entry.wikipediaUrl || '',
      extractLang: 'en',
    };
    this._landmarkNoticeTimer = 8;
    this._landmarkNoticeDuration = 8;
  }

  _matchLandmarkToBuilding(building, buildingName) {
    if (building.id) {
      const byId = this.landmarks.find(landmark => landmark.id === building.id);
      if (byId) return byId;
    }
    if (buildingName) {
      const wanted = this._normaliseCanalName(buildingName);
      const byName = this.landmarks.find(landmark => this._normaliseCanalName(landmark.name) === wanted);
      if (byName) return byName;
    }
    if (!building.lngLat) return null;
    // 60 m: close enough that the click almost certainly hit this landmark's
    // building, without silently relabelling a neighbour.
    let nearest = null, nearestKm = 0.06;
    for (const landmark of this.landmarks) {
      if (!landmark.lngLat) continue;
      const km = Game._kmBetween({ lat: building.lngLat[1], lng: building.lngLat[0] },
                                 { lat: landmark.lngLat[1], lng: landmark.lngLat[0] });
      if (km < nearestKm) { nearest = landmark; nearestKm = km; }
    }
    return nearest;
  }

  // Spaced repetition: the bundled store shares its schedule and Firestore
  // collections with the main Map Recall app, so progress is one body of
  // knowledge rather than two.

  async _loadLandmarks(centerLat, centerLng, segments) {
    try {
      const [landmarkResponse, boundaryResponse, neighborhoodEnrichedResponse, bridgeResponse, crossingResponse, streetKnowledgeResponse, brandedPoiResponse] = await Promise.all([
        fetch(new URL('../data/extracts/amsterdam/landmarks.json', window.location.href)),
        fetch(new URL('../data/extracts/amsterdam/boundaries.json', window.location.href)),
        fetch(new URL('../data/extracts/amsterdam/neighborhoods-enriched.json', window.location.href)),
        fetch(new URL('../data/extracts/amsterdam/bridges.json', window.location.href)),
        fetch(new URL('../data/extracts/amsterdam/bridge-crossings.json', window.location.href)),
        fetch(new URL('../data/extracts/amsterdam/street-knowledge.json', window.location.href)),
        fetch(new URL('../data/extracts/amsterdam/branded-pois.json', window.location.href))
      ]);
      if (!landmarkResponse.ok || !boundaryResponse.ok) throw new Error('Cached place data unavailable');
      const [features, boundaries, neighborhoodEnriched, bridgeFeatures, crossingIndex, streetKnowledge, brandedPois] = await Promise.all([
        landmarkResponse.json(), boundaryResponse.json(),
        neighborhoodEnrichedResponse.ok ? neighborhoodEnrichedResponse.json() : [],
        bridgeResponse.ok ? bridgeResponse.json() : [],
        crossingResponse.ok ? crossingResponse.json() : { bridges: {} },
        streetKnowledgeResponse.ok ? streetKnowledgeResponse.json() : [],
        brandedPoiResponse.ok ? brandedPoiResponse.json() : []
      ]);
      this.streetKnowledge = new Map(streetKnowledge.map(entry => [this._normaliseCanalName(entry.name), entry]));
      const neighborhoodData = new Map();
      for (const entry of neighborhoodEnriched) neighborhoodData.set(entry.name, entry);
      this.vectorMap.setPlaces(features, boundaries);
      this.vectorMap.setBrandedPois(brandedPois);
      this.landmarks = features.map(feature => {
        const center = feature.center || (feature.path && feature.path[0]);
        if (!center) return null;
        const point = this.osmLoader.latLngToGamePoint(center[0], center[1], centerLat, centerLng, segments, false);
        if (!point) return null;
        const detail = feature.funFact || feature.wikipediaExtract || '';
        const sourcePaths = feature.paths || (feature.path ? [feature.path] : []);
        const geometryFeatures = sourcePaths.filter(path => path && path.length > 1).map(path => {
          const coordinates = path.map(([lat, lng]) => [lng, lat]);
          const first = coordinates[0], last = coordinates[coordinates.length - 1];
          const closed = coordinates.length > 3 && first[0] === last[0] && first[1] === last[1];
          return { type: 'Feature', properties: {}, geometry: closed ? { type: 'Polygon', coordinates: [coordinates] } : { type: 'LineString', coordinates } };
        });
        if (!geometryFeatures.length) geometryFeatures.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [center[1], center[0]] } });
        const shortDetail = detail.split(/(?<=[.!?])\s/)[0].slice(0, 150);
        const longDetail = detail.split(/(?<=[.!?])\s/).slice(0, 3).join(' ').slice(0, 280);
        return { id: feature.id, name: feature.name, type: feature.type || '', imageUrl: feature.wikipediaImageUrl || '', x: point.x, y: point.y, lngLat: [center[1], center[0]], detail: shortDetail, longDetail, prominenceScore: feature.prominenceScore || 0, wikipediaUrl: feature.wikipediaUrl || '', wikidata: feature.wikidata || '', wikipedia: feature.wikipedia || '', extractLang: feature.wikipediaExtractLang || 'en', geojson: { type: 'FeatureCollection', features: geometryFeatures } };
      }).filter(Boolean);
      // Photos are fetched as the player approaches, not up front. Preloading
      // the 50 most prominent landmarks in the city meant 229 landmarks had a
      // Wikipedia photo and only the top 50 could ever show it: DeLaMar ranks
      // 89th and its card came up bare. It also spent bandwidth on the
      // Rijksmuseum for a route that never goes near it.
      this._landmarkImages = new Map();
      this._landmarkImageRequests = new Set();
      const metersPerDegreeLat = 111320;
      const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);
      const toWorld = ([lat, lng]) => ({
        x: (lng - centerLng) * metersPerDegreeLng * PIXELS_PER_METER + this.osmLoader._lastOffsetX,
        y: -(lat - centerLat) * metersPerDegreeLat * PIXELS_PER_METER + this.osmLoader._lastOffsetY
      });
      // Only 42 of the 91 mapped areas are tagged `neighbourhood`, and between
      // them they cover about a tenth of the drivable network — which is why
      // the postcards almost never appeared. Quarters (De Pijp, Grachtengordel)
      // and districts (Centrum, Noord) are places players name too, so they all
      // count; the finest area containing the vehicle wins, with the district
      // as the fallback that covers the rest of the city.
      this.neighborhoods = boundaries
        .filter(boundary => boundary.geometry && NEIGHBORHOOD_KIND_RANK[boundary.kind])
        .map(boundary => {
          const enriched = neighborhoodData.get(boundary.name) || {};
          return {
            name: boundary.name,
            kind: boundary.kind,
            rank: NEIGHBORHOOD_KIND_RANK[boundary.kind],
            rings: boundary.geometry.map(polygon => (polygon[0] || []).map(toWorld)).filter(ring => ring.length > 2),
            wikipediaExtract: enriched.wikipediaExtract || '',
            imageUrl: enriched.imageUrl || '',
            imageAttribution: enriched.imageAttribution || '',
          };
        })
        .filter(hood => hood.rings.length)
        .sort((a, b) => b.rank - a.rank);
      // Most fine-grained quarters do not have their own Wikimedia image yet.
      // Borrow the containing district's photograph rather than showing a flat
      // typographic card; it still depicts the part of Amsterdam being entered.
      for (const hood of this.neighborhoods) {
        if (hood.imageUrl) continue;
        const sample = hood.rings[0] && hood.rings[0][0];
        if (!sample) continue;
        const parent = this.neighborhoods.find(candidate =>
          candidate.rank < hood.rank && candidate.imageUrl
          && candidate.rings.some(ring => this._pointInPolygon(sample.x, sample.y, ring)));
        if (parent) {
          hood.imageUrl = parent.imageUrl;
          hood.imageAttribution = parent.imageAttribution;
          hood.imageArea = parent.name;
        }
      }
      // Bridges carry their own geometry and ready-made distractors, so they
      // can be quizzed the same way waterways and streets are.
      this.bridges = bridgeFeatures.map(feature => {
        const sourcePaths = feature.paths || (feature.path ? [feature.path] : []);
        const lines = sourcePaths.map(path => (path || []).map(toWorld)).filter(line => line.length > 1);
        // 43 of the 300 mapped bridges are called "Brug 117" or similar. That
        // is an asset register number, not a name a player can learn, so they
        // are dropped rather than offered as questions or answers.
        if (!feature.name || lines.length === 0 || GENERIC_BRIDGE_NAME.test(feature.name)) return null;
        // "Gooilijn" and "Westelijke Ringspoorbaan" are railway *lines*, and
        // their viaducts were each asked about separately — 17 questions for
        // the Westelijke Ringspoorbaan alone. Riding under a viaduct is not a
        // bridge you can name, so a rail-only crossing asks nothing. Bridges
        // that carry a road as well as rails keep their question.
        if (feature.carriesRailway && !feature.carriesRoad) return null;
        // Precomputed by scripts/build-bridge-crossings.ts: the physical
        // crossings this named feature is made of, and the water under each.
        // A bridge missing from the index still asks its one question, it just
        // has no water to gate on.
        const published = (crossingIndex.bridges || {})[feature.id];
        const crossings = (published && published.length ? published : [{
          index: 0, center: feature.center, waterway: null, waterwayType: null, waterDistractors: [], spans: lines.length,
        }]).map(crossing => ({ ...crossing, ...toWorld(crossing.center) }));
        return {
          id: feature.id, name: feature.name, lines, crossings,
          distractors: (feature.distractors || []).filter(name => !GENERIC_BRIDGE_NAME.test(name)),
          wikipediaUrl: feature.wikipediaUrl || '',
          detail: (feature.wikipediaExtract || '').split(/(?<=[.!?])\s/)[0].slice(0, 150),
        };
      }).filter(Boolean);

      // Postcard images load on demand — see _warmRouteNeighborhoodImages.
      // Preloading the whole city cost ~26 fetches per route for postcards
      // most trips never reach.
      this._neighborhoodImages = new Map();
      this._neighborhoodLetterArt = new Map();
      this._neighborhoodImageRequests = new Set();
    } catch (error) {
      console.warn('Landmark notes unavailable:', error);
      this.landmarks = [];
    }
  }

  _updateLandmarks(dt) {
    if (this._neighborhoodNoticeTimer > 0) this._neighborhoodNoticeTimer -= dt;
    if (this._landmarkNoticeTimer > 0) {
      this._landmarkNoticeTimer -= dt;
      if (this._landmarkNoticeTimer <= 0) this._landmarkNotice = null;
      if (this._landmarkNoticeTimer <= 0) this.vectorMap.setActiveLandmark(null);
    }
    if (!this.player) return;
    // The list is sorted finest-first, so the first hit is the most specific
    // area containing the vehicle.
    const detectedHood = this._neighborhoodAt(this.player.x, this.player.y);
    const detectedName = detectedHood ? detectedHood.name : '';
    const transition = CanalRecallNeighborhood.advanceNeighborhood({
      current: this.currentNeighborhood,
      candidate: this._neighborhoodCandidate,
      candidateSeconds: this._neighborhoodCandidateTimer,
    }, detectedName, dt);
    this.currentNeighborhood = transition.state.current;
    this._neighborhoodCandidate = transition.state.candidate;
    this._neighborhoodCandidateTimer = transition.state.candidateSeconds;
    const hood = this.neighborhoods.find(area => area.name === this.currentNeighborhood) || detectedHood;
    if (this.currentNeighborhood) this._visitedNeighborhoods.add(this.currentNeighborhood);
    // Arriving somewhere is worth a postcard the first time too. Previously an
    // empty `_previousNeighborhood` swallowed the opening entry, so the card
    // for the neighborhood the route starts in never appeared at all.
    if (this.currentNeighborhood && this.currentNeighborhood !== this._previousNeighborhood) {
      this._previousNeighborhood = this.currentNeighborhood;
      if (!this.quizPromptName && this.raceTime > NEIGHBORHOOD_NOTICE_GRACE) {
        if (hood) this._ensureNeighborhoodImage(hood);
        this._neighborhoodNotice = hood || { name: this.currentNeighborhood };
        this._neighborhoodNoticeTimer = NEIGHBORHOOD_NOTICE_SECONDS;
      }
    }
    let nearest = null;
    let nearestDistance = 300; // 100 m at the current world scale
    for (const landmark of this.landmarks) {
      const distance = Math.hypot(landmark.x - this.player.x, landmark.y - this.player.y);
      if (distance < LANDMARK_IMAGE_PREFETCH_RADIUS) this._ensureLandmarkImage(landmark);
      if (this._seenLandmarks.has(landmark.id)) continue;
      if (distance < nearestDistance) { nearest = landmark; nearestDistance = distance; }
    }
    if (this._landmarkNotice) return;
    if (nearest) {
      this._seenLandmarks.add(nearest.id);
      this._seenLandmarkNames.add(nearest.name);
      this._ensureLandmarkSummary(nearest);
      this._landmarkNotice = nearest;
      this._landmarkNoticeTimer = 6;
      this._landmarkNoticeDuration = 6;
      this.vectorMap.setActiveLandmark(nearest);
    }
  }

  // Finest first: a point inside De Pijp is in De Pijp, not in Zuid.

  _neighborhoodAt(x, y) {
    return this.neighborhoods.find(hood => hood.rings.some(ring => this._pointInPolygon(x, y, ring))) || null;
  }

  // The fallback body for a landmark with no encyclopedia text: what it is and
  // where it is, in a sentence.

  // Fetch a landmark photo once, on demand. Every landmark the extract has a
  // Wikipedia image for can show one; the card falls back to text until it
  // arrives, and a failure is remembered so it is not retried every frame.

  _ensureLandmarkImage(landmark) {
    if (!landmark || !landmark.imageUrl) return;
    if (!this._landmarkImageRequests) this._landmarkImageRequests = new Set();
    if (this._landmarkImageRequests.has(landmark.id)) return;
    this._landmarkImageRequests.add(landmark.id);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => this._landmarkImages.set(landmark.id, img);
    img.onerror = () => console.warn('Landmark image unavailable:', landmark.name, landmark.imageUrl);
    img.src = landmark.imageUrl;
  }

  // Fetch a neighborhood postcard image once, on demand. The postcard renderer
  // already falls back to its typographic composition until the image lands.

  _ensureNeighborhoodImage(hood) {
    if (!hood || !hood.imageUrl) return;
    if (!this._neighborhoodImageRequests) this._neighborhoodImageRequests = new Set();
    if (this._neighborhoodImageRequests.has(hood.name)) return;
    this._neighborhoodImageRequests.add(hood.name);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => this._neighborhoodImages.set(hood.name, img);
    img.onerror = () => console.warn('Neighborhood image unavailable:', hood.name, hood.imageUrl);
    img.src = hood.imageUrl;
  }

  _pointInPolygon(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if (((a.y > y) !== (b.y > y)) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  _renderLandmarkNotice() {
    if (!this._landmarkNotice) return;
    const ctx = this.ctx;
    const alpha = Math.min(1, this._landmarkNoticeTimer, this._landmarkNoticeDuration - this._landmarkNoticeTimer);
    if (alpha <= 0) return;

    const lm = this._landmarkNotice;
    const img = this._landmarkImages && this._landmarkImages.get(lm.id);
    const hasImage = !!(img && img.complete && img.naturalWidth > 0);
    const cards = window.CanalRecallCards;
    const props = {
      name: lm.name,
      body: lm.longDetail || lm.detail
        || cards.placeOnlyDetail(lm.type, this.currentNeighborhood),
      category: lm.type ? lm.type.toUpperCase() : '',
      extractLang: lm.extractLang,
      hasArticle: !!lm.wikipediaUrl,
      hasImage,
    };
    const measure = (text, font) => { ctx.font = font; return ctx.measureText(text).width; };
    const card = cards.measureLandmarkCard(props, measure);

    // Trivia belongs at the bottom of the screen. Across the top it sat exactly
    // where the player is looking to see what is coming, so a card about a
    // church already passed hid the junction ahead.
    const postcardShowing = !!(this._neighborhoodNotice && this._neighborhoodNoticeTimer > 0);
    const bottomLayout = window.CanalRecallBottomHud?.bottomHudLayout({
      tripWidth: 180, postcardVisible: postcardShowing,
      landmarkWidth: card.width, landmarkHeight: card.height,
      zoomVisible: this._zoomBadgeTimer > 0,
      controlsVisible: !this.input.isMobile && this.raceTime < CONTROLS_HINT_DURATION,
    });
    const cardX = bottomLayout ? bottomLayout.landmark.x : CANVAS_W / 2 - card.width / 2;
    const cardY = bottomLayout ? bottomLayout.landmark.y : CANVAS_H - card.height - 30;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    this.renderer.drawLandmarkCard(ctx, card, cardX, cardY, hasImage ? img : null);
    ctx.restore();
  }

  _renderNeighborhoodNotice() {
    if (!this._neighborhoodNotice || this._neighborhoodNoticeTimer <= 0) return;
    if (this.quizPromptName) return;
    const ctx = this.ctx;
    const duration = NEIGHBORHOOD_NOTICE_SECONDS;
    const alpha = Math.min(1, this._neighborhoodNoticeTimer * 2.5, (duration - this._neighborhoodNoticeTimer) * 2.5);
    if (alpha <= 0) return;

    const hood = this._neighborhoodNotice;
    const img = this._neighborhoodImages && this._neighborhoodImages.get(hood.name);
    const hasImage = !!(img && img.complete && img.naturalWidth > 0);
    const measure = (text, font) => { ctx.font = font; return ctx.measureText(text).width; };
    const card = window.CanalRecallCards.measurePostcard(
      { name: hood.name, kind: hood.kind, imageArea: hood.imageArea, hasImage }, measure);

    const bottomLayout = window.CanalRecallBottomHud?.bottomHudLayout({ tripWidth: 180 });
    const cardX = bottomLayout ? bottomLayout.postcard.x : CANVAS_W - card.width - 20;
    const baseCardY = bottomLayout ? bottomLayout.postcard.y : CANVAS_H - card.height - 76;
    // Slide up into place rather than appearing; the offset is animation, not
    // layout, so it is applied after the band has been arbitrated.
    const slideT = Math.min(1, (duration - this._neighborhoodNoticeTimer) / 0.3);
    const cardY = baseCardY + (1 - (1 - Math.pow(1 - slideT, 3))) * 50;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    this.renderer.drawPostcard(ctx, card, cardX, cardY, hasImage ? img : null);
    ctx.restore();
  }

  // ---- Leaderboard (localStorage) ----

  // ---- Route ribbons ----

  // Length of the graph route the game planned between start and finish, in
  // game pixels. Used as the "no wasted distance" reference for efficiency.
}

window.CanalRecallGameModules = window.CanalRecallGameModules || [];
window.CanalRecallGameModules.push(GameLandmarkRuntime);
