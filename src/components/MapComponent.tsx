import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Loader2 } from 'lucide-react';
import { GameMode, StreetFeature, TileStyle, SearchBoundary } from '../types';
import { calculateClosestPointOnFeature } from '../utils/geo';
import { polygonLabelPoint } from '../mapRecall/polygonLabel';
import { roundColor } from '../mapRecall/roundPalette';

// Bump when provider URLs or authentication change so Vite HMR replaces an
// already-mounted Leaflet tile layer even if the user's style toggles did not.
const BASEMAP_CONFIG_VERSION = 'carto-rastertiles-v1';

interface MapComponentProps {
  cityCenter: [number, number];
  defaultZoom: number;
  minZoom: number;
  maxZoom: number;
  gameMode: GameMode;
  currentFeature: StreetFeature | null;
  userPinnedLocation: [number, number] | null;
  onMapClick: (latlng: [number, number]) => void;
  isRoundComplete: boolean;
  distanceErrorMeters?: number;
  blindMapMode: boolean;
  /** Landmark and shop clues inside a neighbourhood (easy and medium only). */
  showPlaceClues?: boolean;
  tileStyle: TileStyle;
  allRoundResults?: Array<{
    feature: StreetFeature;
    userCoordinates?: [number, number];
    distanceErrorMeters?: number;
    isCorrect?: boolean;
    pointsEarned?: number;
    gameMode: GameMode;
  }>;
  isGameOver?: boolean;
  userLocation?: [number, number] | null;
  onLocateUser?: () => void;
  isLocating?: boolean;
  fetchingBoundary?: SearchBoundary | null;
  searchBoundary?: SearchBoundary | null;
  showSearchBoundary?: boolean;
  showLocate?: boolean;
  /** Question forms (wave 2): a relation question's second candidate, drawn like the highlight and unnamed until the answer. */
  relationPair?: { other: StreetFeature } | null;
}

function getFeatureColors(type: string) {
  switch (type) {
    case 'canal':
    case 'water':
      return { core: '#397080', glow: '#a8c8cf', fill: '#6f9eaa' };
    case 'bridge':
      return { core: '#a66d2f', glow: '#dcc6a3', fill: '#c7914f' };
    case 'park':
      return { core: '#47735b', glow: '#b7cdbc', fill: '#6f967d' };
    case 'square':
    case 'monument':
    case 'museum':
    case 'landmark':
      return { core: '#765f6f', glow: '#d5c7d1', fill: '#9c8295' };
    case 'street':
    case 'avenue':
    case 'boulevard':
    default:
      return { core: '#4e6c77', glow: '#c3d0d3', fill: '#78939c' };
  }
}

const RESULT_CARD = '[data-result-card]';
const GUESS_QUESTION_CARD = '#guess-bottom-card';
const PINPOINT_QUESTION_CARD = '#pinpoint-bottom-card';
/** Copper used for a neighbourhood's outline and wash, before and after the answer. */
const AREA_COLOR = '#b4682c';
/** Short features get at least this much map around them so water, parks and blocks give context. */
const MIN_FRAME_METRES = 1200;
const METRES_PER_DEGREE = 111_320;

/**
 * Fit bounds into the part of the map a bottom card does not cover. The card is in the DOM by the
 * time the effects run; a fixed estimate remains for when it is not.
 */
function fitAboveCard(map: L.Map, bounds: L.LatLngBounds, selector: string = RESULT_CARD, maxZoom = 16) {
  fitWhenIdle(map, () => {
    const size = map.getSize();
    const side = Math.round(Math.min(70, size.x * 0.06));
    // Phones keep room for the floating top controls; on a wide map they sit to the side.
    const top = size.x >= 640 ? 60 : 90;
    type Frame = { topLeft: [number, number]; bottomRight: [number, number] };
    // Docked on a wide screen the card is a full-height right-hand column: pad on the right by its width.
    const dock = dockWidthPx(map, selector);
    if (dock > 0) {
      map.fitBounds(bounds, { paddingTopLeft: [side, top], paddingBottomRight: [dock + 24, 40], maxZoom, animate: true });
      return;
    }
    const frames: Frame[] = [{ topLeft: [side, top], bottomRight: [side, cardPaddingPx(map, selector)] }];
    // On a wide map the card is a centred column with open map either side of it. A tall shape (the
    // Grachtengordel) can get a whole zoom level more there than squeezed above the card.
    const holder = cardHolder(selector);
    if (holder) {
      const mapBox = map.getContainer().getBoundingClientRect();
      const box = holder.getBoundingClientRect();
      const leftRoom = box.left - mapBox.left;
      const rightRoom = mapBox.right - box.right;
      if (leftRoom >= 260) frames.push({ topLeft: [side, top], bottomRight: [mapBox.right - box.left + 16, 60] });
      if (rightRoom >= 260) frames.push({ topLeft: [box.right - mapBox.left + 16, top], bottomRight: [side + 50, 60] });
    }
    // Leaflet floors fit zooms, so the first (above the card) wins any tie.
    let best = frames[0];
    let bestZoom = -Infinity;
    for (const frame of frames) {
      const zoom = Math.min(maxZoom, map.getBoundsZoom(bounds, false, L.point(frame.topLeft).add(frame.bottomRight)));
      if (zoom > bestZoom) { bestZoom = zoom; best = frame; }
    }
    map.fitBounds(bounds, {
      paddingTopLeft: best.topLeft,
      paddingBottomRight: best.bottomRight,
      maxZoom,
      animate: true,
    });
  });
}

/**
 * Width of the map the docked quiz card covers, or 0 when the card sits at the bottom (phones,
 * windows under 1100 px). Detected by the holder's box: a dock hugs the map's right edge and spans
 * most of its height, a bottom card does not.
 */
function dockWidthPx(map: L.Map, selector: string): number {
  const holder = cardHolder(selector);
  const dock = holder?.closest<HTMLElement>('[data-quiz-dock]');
  if (!dock) return 0;
  const mapBox = map.getContainer().getBoundingClientRect();
  const box = dock.getBoundingClientRect();
  const docked = box.left > mapBox.left + mapBox.width * 0.4 && box.height >= mapBox.height * 0.9;
  return docked ? Math.round(mapBox.right - box.left) : 0;
}

function cardHolder(selector: string): HTMLElement | null {
  const card = document.querySelector<HTMLElement>(selector);
  if (!card?.offsetHeight) return null;
  return card.parentElement ?? card;
}

const pendingFits = new WeakMap<L.Map, () => void>();
/**
 * Leaflet silently drops a zoom requested while a zoom animation is running (`_tryAnimatedZoom`
 * returns early), so a re-fit for a card that grew 120 ms after the reveal, or a reveal right after
 * the next question's fit, was lost. Run the latest request once the running animation ends.
 */
function fitWhenIdle(map: L.Map, fit: () => void) {
  if (!(map as unknown as { _animatingZoom?: boolean })._animatingZoom) {
    pendingFits.delete(map);
    fit();
    return;
  }
  const alreadyWaiting = pendingFits.has(map);
  pendingFits.set(map, fit);
  if (alreadyWaiting) return;
  map.once('zoomend', () => {
    const latest = pendingFits.get(map);
    pendingFits.delete(map);
    if (latest) setTimeout(() => fitWhenIdle(map, latest), 0);
  });
}

function fitAboveResultCard(map: L.Map, bounds: L.LatLngBounds) {
  fitAboveCard(map, bounds, RESULT_CARD);
}

function cardPaddingPx(map: L.Map, selector: string): number {
  const mapHeight = map.getSize().y;
  const holder = cardHolder(selector);
  if (!holder) {
    return selector === RESULT_CARD
      ? Math.min(440, Math.max(240, Math.round(mapHeight * 0.42)))
      : Math.round(mapHeight * 0.3);
  }
  // The card scrolls inside a height-capped holder; what covers the map is the holder (the card's own
  // box is transformed while it slides in, the holder's is not).
  const covered = map.getContainer().getBoundingClientRect().bottom - holder.getBoundingClientRect().top;
  return Math.round(Math.min(mapHeight * 0.6, Math.max(40, covered + 12)));
}

/** Grow bounds smaller than the minimum frame on both axes to that frame, centred on them. */
function withMinimumFrame(bounds: L.LatLngBounds, metres = MIN_FRAME_METRES): L.LatLngBounds {
  const centre = bounds.getCenter();
  const cosLat = Math.cos((centre.lat * Math.PI) / 180);
  const heightM = (bounds.getNorth() - bounds.getSouth()) * METRES_PER_DEGREE;
  const widthM = (bounds.getEast() - bounds.getWest()) * METRES_PER_DEGREE * cosLat;
  if (heightM >= metres || widthM >= metres) return bounds;
  const halfLat = metres / 2 / METRES_PER_DEGREE;
  const halfLon = halfLat / cosLat;
  return L.latLngBounds([centre.lat - halfLat, centre.lng - halfLon], [centre.lat + halfLat, centre.lng + halfLon]).extend(bounds);
}

function boundaryBounds(boundary: SearchBoundary): L.LatLngBounds {
  if (boundary.geometry?.length) return L.polygon(boundary.geometry).getBounds();
  if (boundary.bounds) return L.latLngBounds(boundary.bounds);
  return L.latLng(boundary.center).toBounds(boundary.radiusMeters * 2);
}

function areaGeometryOf(feature: StreetFeature): [number, number][][][] | null {
  return feature.type === 'neighborhood' && feature.areaGeometry?.length ? feature.areaGeometry : null;
}

const labelPointCache = new WeakMap<object, [number, number]>();
/** Where an area's name goes: its pole of inaccessibility, which a horseshoe's bbox centre is not. */
function areaLabelPoint(feature: StreetFeature): [number, number] {
  const geometry = areaGeometryOf(feature);
  if (!geometry) return feature.center;
  let point = labelPointCache.get(geometry);
  if (!point) {
    point = polygonLabelPoint(geometry, 2) ?? feature.center;
    labelPointCache.set(geometry, point);
  }
  return point;
}

function featureLines(feature: StreetFeature): [number, number][][] | null {
  return feature.paths && feature.paths.length > 0
    ? feature.paths
    : feature.path && feature.path.length > 1 ? [feature.path] : null;
}

/** Halfway along the longest piece of a line feature. */
function lineMidpoint(lines: [number, number][][]): [number, number] {
  let longest = lines[0];
  let longestLength = -1;
  const lengths = lines.map((line) => {
    let length = 0;
    for (let i = 1; i < line.length; i++) length += L.latLng(line[i - 1]).distanceTo(line[i]);
    return length;
  });
  lengths.forEach((length, index) => { if (length > longestLength) { longestLength = length; longest = lines[index]; } });
  let remaining = longestLength / 2;
  for (let i = 1; i < longest.length; i++) {
    const step = L.latLng(longest[i - 1]).distanceTo(longest[i]);
    if (step >= remaining && step > 0) {
      const t = remaining / step;
      return [longest[i - 1][0] + (longest[i][0] - longest[i - 1][0]) * t, longest[i - 1][1] + (longest[i][1] - longest[i - 1][1]) * t];
    }
    remaining -= step;
  }
  return longest[Math.floor(longest.length / 2)];
}

function reviewAnchor(feature: StreetFeature): [number, number] {
  if (areaGeometryOf(feature)) return areaLabelPoint(feature);
  const lines = featureLines(feature);
  return lines ? lineMidpoint(lines) : feature.center;
}

/** A neighbourhood drawn as a filled polygon (holes kept) over a dark casing. */
function addAreaLayers(group: L.LayerGroup, geometry: [number, number][][][], options: { color?: string; fillOpacity?: number; dashed?: boolean } = {}) {
  const color = options.color ?? AREA_COLOR;
  group.addLayer(L.polygon(geometry, { color: '#26372f', weight: 6, opacity: 0.45, fill: false, lineJoin: 'round', interactive: false }));
  const polygon = L.polygon(geometry, {
    color,
    weight: 2.5,
    opacity: 1,
    fillColor: color,
    fillOpacity: options.fillOpacity ?? 0.14,
    lineJoin: 'round',
    dashArray: options.dashed ? '7, 7' : undefined,
    interactive: false,
  });
  group.addLayer(polygon);
  return polygon;
}

/** The reveal's enamel name plaque for an area, centred on its anchor (see `.area-plaque`). */
function areaPlaqueIcon(name: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-true-target-icon',
    html: `<div class="area-plaque"><span>${escapeHtml(name)}</span></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/**
 * An area's plaque sits on its pole of inaccessibility while the area is big enough on screen to
 * hold it; a small area (or a far zoom) would vanish under it, so the plaque then stands just
 * above the area's top edge instead. Returns the updater, for re-running after a zoom.
 */
function keepPlaqueClearOfArea(map: L.Map, marker: L.Marker, labelPoint: [number, number], area: L.LatLngBounds, selector: string) {
  return () => {
    const element = marker.getElement()?.querySelector<HTMLElement>(selector);
    if (!element) return;
    const nw = map.latLngToContainerPoint(area.getNorthWest());
    const se = map.latLngToContainerPoint(area.getSouthEast());
    const fits = se.x - nw.x >= element.offsetWidth + 24 && se.y - nw.y >= element.offsetHeight * 2.5;
    element.classList.toggle('is-above', !fits);
    marker.setLatLng(fits ? labelPoint : [area.getNorth(), labelPoint[1]]);
  };
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

export const MapComponent: React.FC<MapComponentProps> = ({
  cityCenter,
  defaultZoom,
  minZoom,
  maxZoom,
  gameMode,
  currentFeature,
  userPinnedLocation,
  onMapClick,
  isRoundComplete,
  distanceErrorMeters,
  blindMapMode,
  showPlaceClues = true,
  tileStyle,
  allRoundResults,
  isGameOver,
  userLocation,
  onLocateUser,
  isLocating,
  fetchingBoundary,
  searchBoundary,
  showSearchBoundary,
  showLocate = true,
  relationPair,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);
  const boundaryGroupRef = useRef<L.LayerGroup | null>(null);
  /** What the reveal fitted, so it can be fitted again when the answer card grows or shrinks. */
  const revealBoundsRef = useRef<L.LatLngBounds | null>(null);
  /** Which bottom card `revealBoundsRef` was fitted above. */
  const fitSelectorRef = useRef<string>(RESULT_CARD);

  // Initialize Map and Resize Observer
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let invalidateSizeTimer: ReturnType<typeof setTimeout> | undefined;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: cityCenter,
        zoom: defaultZoom,
        minZoom: minZoom,
        maxZoom: maxZoom,
        zoomControl: false,
        attributionControl: false,
      });

      // Add custom zoom control in bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Attribution
      L.control
        .attribution({
          position: 'bottomleft',
          prefix: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a> &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
        })
        .addTo(map);

      mapInstanceRef.current = map;
      boundaryGroupRef.current = L.layerGroup().addTo(map);
      layersGroupRef.current = L.layerGroup().addTo(map);

      // Ensure dimensions are synced immediately. The timer is cleared on
      // teardown so it can never fire against a map that has been removed.
      invalidateSizeTimer = setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }

    // Use ResizeObserver to ensure click coordinates never drift on container changes
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      if (invalidateSizeTimer) clearTimeout(invalidateSizeTimer);
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      tileLayerRef.current = null;
      layersGroupRef.current = null;
      boundaryGroupRef.current = null;
    };
  }, []);

  // Update Base Tile Layer
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    const cartoKey = import.meta.env.VITE_CARTO_API_KEY;
    const cartoAuth = cartoKey ? `?key=${encodeURIComponent(cartoKey)}` : '';
    let tileUrl = '';
    let subdomains: string[] = ['a', 'b', 'c', 'd'];

    if (blindMapMode) {
      // Blind mode (label-less base map)
      if (tileStyle === 'dark') {
        tileUrl = `https://{s}.basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}{r}.png${cartoAuth}`;
      } else {
        tileUrl = `https://{s}.basemaps.cartocdn.com/rastertiles/light_nolabels/{z}/{x}/{y}{r}.png${cartoAuth}`;
      }
      subdomains = ['a', 'b', 'c', 'd'];
    } else {
      // Standard labeled mode
      switch (tileStyle) {
        case 'dark':
          tileUrl = `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png${cartoAuth}`;
          break;
        case 'light_nolabels':
          tileUrl = `https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png${cartoAuth}`;
          break;
        case 'voyager':
          tileUrl = `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png${cartoAuth}`;
          break;
        case 'osm':
        default:
          tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
          subdomains = ['a', 'b', 'c'];
          break;
      }
    }

    tileLayerRef.current = L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: tileUrl.includes('{s}') ? subdomains : [],
      className: 'paper-tiles',
    }).addTo(mapInstanceRef.current);
  }, [tileStyle, blindMapMode, BASEMAP_CONFIG_VERSION]);

  // After a guess, lay the place names over the blind map so the player can
  // get their bearings around the answer; they go again with the next
  // question (user request 2026-10-01). Labels-only tiles keep the base map,
  // and its cache, as it was.
  const revealLabelsRef = useRef<L.TileLayer | null>(null);
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const showLabels = blindMapMode && isRoundComplete && !isGameOver;
    if (showLabels && !revealLabelsRef.current) {
      const cartoKey = import.meta.env.VITE_CARTO_API_KEY;
      const cartoAuth = cartoKey ? `?key=${encodeURIComponent(cartoKey)}` : '';
      const flavour = tileStyle === 'dark' ? 'dark_only_labels' : 'light_only_labels';
      revealLabelsRef.current = L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/${flavour}/{z}/{x}/{y}{r}.png${cartoAuth}`, {
        maxZoom: 19, subdomains: ['a', 'b', 'c', 'd'], className: 'reveal-labels', zIndex: 5,
      }).addTo(map);
    } else if (!showLabels && revealLabelsRef.current) {
      map.removeLayer(revealLabelsRef.current);
      revealLabelsRef.current = null;
    }
  }, [blindMapMode, isRoundComplete, isGameOver, tileStyle]);

  // A neighbourhood's best-known places (user request 2026-10-02): clues while
  // naming it, since they sit inside the drawn area; in Pinpoint only after the
  // guess, because before it they would show where the area is.
  const notablePlacesRef = useRef<L.LayerGroup | null>(null);
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    notablePlacesRef.current?.remove();
    notablePlacesRef.current = null;
    const places = currentFeature?.type === 'neighborhood' ? currentFeature.notablePlaces : undefined;
    if (!showPlaceClues || !places?.length || isGameOver || (gameMode !== 'guess_name' && !isRoundComplete)) return;
    const group = L.layerGroup();
    const markers = places.map((place) => L.circleMarker(place.center, { radius: 5, color: '#fff', weight: 2, fillColor: '#8a4a18', fillOpacity: 1, className: 'notable-place' })
      .bindTooltip(place.name, { permanent: true, direction: 'top', offset: [0, -6], className: 'notable-place-label' })
      .addTo(group));
    notablePlacesRef.current = group.addTo(map);
    // Places arrive best first; a label that would overlap a better one waits
    // until the player zooms in far enough to separate them.
    const declutter = () => {
      // The answer's own plaque wins over clue labels.
      const kept: DOMRect[] = Array.from(map.getContainer().querySelectorAll<HTMLElement>('.area-plaque')).map((plaque) => plaque.getBoundingClientRect());
      for (const marker of markers) {
        const element = marker.getTooltip()?.getElement();
        if (!element) continue;
        element.style.visibility = 'visible';
        const box = element.getBoundingClientRect();
        const overlaps = kept.some((other) => box.left < other.right + 2 && box.right > other.left - 2 && box.top < other.bottom + 2 && box.bottom > other.top - 2);
        if (overlaps) element.style.visibility = 'hidden';
        else kept.push(box);
      }
    };
    // Two frames: after the answer plaque has been placed for this zoom.
    let frame = 0;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { frame = requestAnimationFrame(declutter); }); };
    schedule();
    map.on('zoomend', schedule);
    return () => { cancelAnimationFrame(frame); map.off('zoomend', schedule); };
  }, [currentFeature, gameMode, isRoundComplete, isGameOver, showPlaceClues]);

  // Question forms (wave-2 lane, 2026-10-13), self-contained: its own layer group. A relation
  // question's second candidate is drawn exactly like the Guess Name highlight (in the target's
  // colours, so the style never tells them apart) and named only after the answer; it re-fits, after
  // the reveal effect's own fit, to include the extra candidate.
  const questionFormsRef = useRef<L.LayerGroup | null>(null);
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    questionFormsRef.current?.remove();
    questionFormsRef.current = null;
    if (isGameOver || !currentFeature || !relationPair) return;
    const group = L.layerGroup().addTo(map);
    questionFormsRef.current = group;
    const extend: L.LatLngBounds[] = [];

    if (relationPair) {
      const other = relationPair.other;
      const colors = getFeatureColors(currentFeature.type);
      const lines = featureLines(other);
      if (lines) {
        group.addLayer(L.polyline(lines, { color: '#26372f', weight: 14, opacity: 0.82, lineCap: 'round', lineJoin: 'round', className: 'qf-relation-other' }));
        group.addLayer(L.polyline(lines, { color: colors.glow, weight: 12, opacity: 0.4, lineCap: 'round', lineJoin: 'round' }));
        const core = L.polyline(lines, { color: colors.core, weight: 6, opacity: 0.95, lineCap: 'round', lineJoin: 'round' });
        group.addLayer(core);
        extend.push(core.getBounds());
      } else {
        group.addLayer(L.circle(other.center, { radius: other.radius || 90, color: colors.core, fillColor: colors.fill, fillOpacity: 0.3, weight: 3, className: 'qf-relation-other' }));
        extend.push(L.latLngBounds([other.center]));
      }
      const targetLines = featureLines(currentFeature);
      extend.push(targetLines ? L.polyline(targetLines).getBounds() : L.latLngBounds([currentFeature.center]));
      if (isRoundComplete) {
        // Halfway along the line; below it when it lies south of the target, whose label stands above.
        const anchor = reviewAnchor(other);
        const below = anchor[0] < currentFeature.center[0];
        group.addLayer(L.marker(anchor, {
          icon: L.divIcon({
            className: 'custom-map-icon qf-relation-label',
            html: `<div class="inline-flex px-3 py-1.5 rounded-lg bg-[#0b3a8c] text-white font-bold text-xs shadow-lg border border-white/35 items-center gap-1.5 whitespace-nowrap" style="font-family:'Barlow Condensed',sans-serif;letter-spacing:.04em;text-transform:uppercase"><span class="w-2 h-2 rounded-full bg-[#c4a35a]"></span><span>${escapeHtml(other.name)}</span></div>`,
            iconSize: [180, 32],
            iconAnchor: [90, below ? -10 : 42],
          }),
        }));
      }
    }

    // After the reveal effect's fit (it runs later in this commit): fit what this effect added too.
    let frame = 0;
    if (extend.length) {
      frame = requestAnimationFrame(() => {
        const bounds = L.latLngBounds([]);
        if (revealBoundsRef.current) bounds.extend(revealBoundsRef.current);
        extend.forEach((part) => bounds.extend(part));
        if (!bounds.isValid()) return;
        const framed = withMinimumFrame(bounds);
        revealBoundsRef.current = framed;
        fitAboveCard(map, framed, isRoundComplete ? RESULT_CARD : GUESS_QUESTION_CARD);
      });
    }
    return () => {
      cancelAnimationFrame(frame);
      group.remove();
      if (questionFormsRef.current === group) questionFormsRef.current = null;
    };
  }, [currentFeature, relationPair, isRoundComplete, isGameOver]);

  // Both location-based modes use a dropped pin. Keep this list in sync with
  // the crosshair cursor below so a map that looks clickable is clickable.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      if ((gameMode === 'pinpoint' || gameMode === 'guess_neighborhood') && !isRoundComplete && !isGameOver) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [gameMode, isRoundComplete, isGameOver, onMapClick]);

  // Update map center when city changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setView([cityCenter[0], cityCenter[1]], defaultZoom, { animate: false });
  }, [cityCenter[0], cityCenter[1], defaultZoom]);

  // Render Search Boundary Circle (both during fetching and when toggled persistently)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = boundaryGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const activeBoundary = fetchingBoundary || (showSearchBoundary && searchBoundary ? searchBoundary : null);
    if (!activeBoundary) return;

    const boundaryShape = activeBoundary.geometry
      ? L.polygon(activeBoundary.geometry, {
          color: '#6d796f', weight: fetchingBoundary ? 2.5 : 1.5, dashArray: '8, 8',
          fillColor: '#7d8d81', fillOpacity: fetchingBoundary ? 0.08 : 0.025,
        })
      : activeBoundary.bounds
      ? L.rectangle(activeBoundary.bounds, {
          color: '#6d796f',
          weight: fetchingBoundary ? 2.5 : 1.5,
          dashArray: '8, 8',
          fillColor: '#7d8d81',
          fillOpacity: fetchingBoundary ? 0.08 : 0.025,
        })
      : L.circle(activeBoundary.center, {
      radius: activeBoundary.radiusMeters,
      color: '#5d7f72',
      weight: fetchingBoundary ? 2.5 : 1.5,
      dashArray: '8, 8',
      fillColor: '#91aa9e',
      fillOpacity: fetchingBoundary ? 0.1 : 0.035,
    });
    group.addLayer(boundaryShape);

    if (fetchingBoundary) {
      map.fitBounds(boundaryShape.getBounds(), { padding: [40, 40], maxZoom: 14, animate: false });
    }
  }, [fetchingBoundary, searchBoundary, showSearchBoundary]);

  // Redraw layers when state changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    revealBoundsRef.current = null;
    fitSelectorRef.current = RESULT_CARD;

    // 1. GAME OVER SUMMARY: every round in its own colour, named where it is.
    if (isGameOver && allRoundResults && allRoundResults.length > 0) {
      const bounds = L.latLngBounds([]);
      const plaques: L.Marker[] = [];
      const placeAreaPlaques: Array<() => void> = [];

      allRoundResults.forEach((res, i) => {
        const feat = res.feature;
        const color = roundColor(i);
        const missed = res.pointsEarned === 0 || res.isCorrect === false;
        const area = areaGeometryOf(feat);
        const polyLines = featureLines(feat);

        let areaBounds: L.LatLngBounds | null = null;
        if (area) {
          const polygon = addAreaLayers(group, area, { color, fillOpacity: 0.16, dashed: missed });
          areaBounds = polygon.getBounds();
          bounds.extend(areaBounds);
        } else if (polyLines) {
          group.addLayer(L.polyline(polyLines, { color: '#ffffff', weight: 9, opacity: 0.85, lineCap: 'round', lineJoin: 'round', interactive: false }));
          const poly = L.polyline(polyLines, {
            color,
            weight: 5,
            opacity: 0.95,
            lineCap: missed ? 'butt' : 'round',
            lineJoin: 'round',
            dashArray: missed ? '8, 8' : undefined,
          });
          group.addLayer(poly);
          bounds.extend(poly.getBounds());
        } else {
          const circle = L.circle(feat.center, {
            radius: feat.radius || 90, color, weight: 3, fillColor: color, fillOpacity: 0.2, dashArray: missed ? '6, 6' : undefined,
          });
          group.addLayer(circle);
          bounds.extend(circle.getBounds());
        }

        // Pinpoint guess, in the round's colour, tied to the nearest part of the answer.
        if (res.userCoordinates) {
          const nearest = calculateClosestPointOnFeature(res.userCoordinates, feat.center, feat.path, feat.paths);
          if (L.latLng(nearest).distanceTo(res.userCoordinates) > 30) {
            group.addLayer(L.polyline([res.userCoordinates, nearest], { color, weight: 2.5, dashArray: '4, 7', opacity: 0.9, interactive: false }));
          }
          const userIcon = L.divIcon({
            className: 'custom-map-icon',
            html: `<div class="review-guess-pin" style="--round:${color}">${i + 1}</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });
          group.addLayer(L.marker(res.userCoordinates, { icon: userIcon, title: `Your guess for round ${i + 1}` }));
          bounds.extend(res.userCoordinates);
        }

        const name = escapeHtml(feat.name);
        const plaqueIcon = L.divIcon({
          className: 'custom-map-icon',
          html: `<div class="review-plaque${missed ? ' is-missed' : ''}" style="--round:${color}" title="${name}"><span class="review-plaque-number">${i + 1}</span><span class="review-plaque-name">${name}</span></div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        const anchor = reviewAnchor(feat);
        const plaque = L.marker(anchor, { icon: plaqueIcon, zIndexOffset: 1000 + allRoundResults.length - i });
        plaque.bindPopup(`<b>#${i + 1}: ${name}</b>`);
        group.addLayer(plaque);
        plaques.push(plaque);
        if (areaBounds) placeAreaPlaques.push(keepPlaqueClearOfArea(map, plaque, anchor, areaBounds, '.review-plaque'));
      });

      // Small areas get their plaque above them, not over them. Then a name that would cover an
      // earlier round's plaque folds to its number, and a number that still collides steps down,
      // until the player zooms in far enough to separate them.
      const declutter = () => {
        placeAreaPlaques.forEach((place) => place());
        const kept: DOMRect[] = [];
        const hits = (rect: DOMRect) => kept.some((other) => rect.left < other.right + 3 && rect.right > other.left - 3 && rect.top < other.bottom + 3 && rect.bottom > other.top - 3);
        for (const plaque of plaques) {
          const element = plaque.getElement()?.querySelector<HTMLElement>('.review-plaque');
          if (!element) continue;
          element.classList.remove('is-folded');
          element.style.removeProperty('--nudge');
          let box = element.getBoundingClientRect();
          if (hits(box)) {
            element.classList.add('is-folded');
            box = element.getBoundingClientRect();
          }
          for (let step = 1; step <= 4 && hits(box); step++) {
            element.style.setProperty('--nudge', `${step * (box.height + 4)}px`);
            box = element.getBoundingClientRect();
          }
          kept.push(box);
        }
      };

      if (bounds.isValid()) {
        fitWhenIdle(map, () => map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 }));
      }
      const frame = requestAnimationFrame(declutter);
      map.on('zoomend', declutter);
      return () => { cancelAnimationFrame(frame); map.off('zoomend', declutter); };
    }

    if (!currentFeature) return;

    const polylinesToRender = featureLines(currentFeature);
    const areaGeometry = areaGeometryOf(currentFeature);
    const labelPoint = areaLabelPoint(currentFeature);
    /** Plaque placements that depend on the zoom, re-run after every zoom. */
    const placeOnZoom: Array<() => void> = [];

    // 2. GUESS THE NAME MODE
    if (gameMode === 'guess_name') {
      const colors = getFeatureColors(currentFeature.type);
      let highlightBounds: L.LatLngBounds;

      if (areaGeometry) {
        highlightBounds = addAreaLayers(group, areaGeometry).getBounds();
      } else if (polylinesToRender) {
        // Highlight the target feature prominently
        group.addLayer(L.polyline(polylinesToRender, {
          color: '#26372f',
          weight: 14,
          opacity: 0.82,
          lineCap: 'round',
          lineJoin: 'round',
        }));
        // Glowing outline
        group.addLayer(L.polyline(polylinesToRender, {
          color: colors.glow,
          weight: 12,
          opacity: 0.4,
          lineCap: 'round',
          lineJoin: 'round',
        }));
        // Core line
        const coreLine = L.polyline(polylinesToRender, {
          color: colors.core,
          weight: 6,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        });
        group.addLayer(coreLine);
        highlightBounds = coreLine.getBounds();
      } else {
        // Square or landmark point
        const radius = currentFeature.radius || 90;
        const circle = L.circle(currentFeature.center, {
          radius: radius,
          color: colors.core,
          fillColor: colors.fill,
          fillOpacity: 0.3,
          weight: 3,
        });
        group.addLayer(circle);
        highlightBounds = L.latLngBounds([currentFeature.center]);
      }

      if (!isRoundComplete) {
        // Above the question card, with enough surroundings to reason from.
        const questionBounds = withMinimumFrame(highlightBounds);
        revealBoundsRef.current = questionBounds;
        fitSelectorRef.current = GUESS_QUESTION_CARD;
        fitAboveCard(map, questionBounds, GUESS_QUESTION_CARD);
      }

      // If round complete, show name label marker
      if (isRoundComplete) {
        const revealIcon = areaGeometry ? areaPlaqueIcon(currentFeature.name) : L.divIcon({
          className: 'custom-map-icon',
          html: `
            <div class="inline-flex px-3 py-1.5 rounded-lg bg-[#0b3a8c] text-white font-bold text-xs shadow-lg border border-white/35 items-center gap-1.5 whitespace-nowrap" style="font-family:'Barlow Condensed',sans-serif;letter-spacing:.04em;text-transform:uppercase">
              <span class="w-2 h-2 rounded-full bg-[#c4a35a]"></span>
              <span>${escapeHtml(currentFeature.name)}</span>
            </div>
          `,
          iconSize: [180, 32],
          iconAnchor: [90, 42],
        });
        const marker = L.marker(labelPoint, { icon: revealIcon });
        group.addLayer(marker);
        if (areaGeometry) placeOnZoom.push(keepPlaqueClearOfArea(map, marker, labelPoint, highlightBounds, '.area-plaque'));

        const revealBounds = withMinimumFrame(highlightBounds);
        revealBoundsRef.current = revealBounds;
        fitAboveResultCard(map, revealBounds);
      }
    }

    // 3. PINPOINT LOCATION MODE
    if (gameMode === 'pinpoint' || gameMode === 'guess_neighborhood') {
      // If user has dropped a temporary pin (prior to or after round completion)
      if (userPinnedLocation) {
        const pinIcon = L.divIcon({
          className: 'custom-pinpoint-needle-icon',
          html: `
            <div class="w-8 h-[42px] pointer-events-none relative flex flex-col items-center justify-start filter drop-shadow-md">
              <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- Drop shadow ring -->
                <ellipse cx="16" cy="40" rx="4" ry="2" fill="rgba(15, 23, 42, 0.35)" />
                <!-- Pin Body with Needle Tip -->
                <path d="M16 0C7.16344 0 0 7.16344 0 16C0 26.5 14.5 39.5 15.35 40.25C15.73 40.58 16.27 40.58 16.65 40.25C17.5 39.5 32 26.5 32 16C32 7.16344 24.8366 0 16 0Z" fill="#C75F43" />
                <path d="M16 1C7.71573 1 1 7.71573 1 16C1 25.8 14.8 38.3 16 39.35C17.2 38.3 31 25.8 31 16C31 7.71573 24.2843 1 16 1Z" stroke="#FFFFFF" stroke-width="1.5" />
                <!-- Center Target Dot -->
                <circle cx="16" cy="15" r="5.5" fill="#FFFFFF" />
                <circle cx="16" cy="15" r="2.5" fill="#C75F43" />
              </svg>
            </div>
          `,
          iconSize: [32, 42],
          iconAnchor: [16, 40],
        });

        const userMarker = L.marker(userPinnedLocation, { icon: pinIcon });
        group.addLayer(userMarker);
      }

      // REVEALED STATE (Round complete)
      if (isRoundComplete) {
        // Label the revealed geometry. Line features do not have a meaningful
        // single target point, so only point features receive a dot marker;
        // an area's plaque sits centred on its pole of inaccessibility.
        const trueTargetIcon = areaGeometry
          ? areaPlaqueIcon(currentFeature.name)
          : L.divIcon({
              className: 'custom-true-target-icon',
              html: `
            <div style="display:flex;align-items:center;gap:7px;transform:translate(8px,-46px);white-space:nowrap;filter:drop-shadow(0 4px 8px rgb(0 0 0 / .65));">
              ${polylinesToRender ? '' : '<span style="display:block;width:18px;height:18px;flex:none;border-radius:999px;background:#0b3a8c;border:4px solid #c4a35a;box-shadow:0 1px 4px rgb(0 0 0 / .35);"></span>'}
              <span style="display:block;border:1px solid rgba(255,255,255,.35);border-radius:8px;background:#0b3a8c;padding:6px 10px;color:#fff;font:800 14px/1.1 'Barlow Condensed',sans-serif;letter-spacing:.04em;text-transform:uppercase;box-shadow:0 4px 12px rgb(0 0 0 / .35);">${escapeHtml(currentFeature.name)}</span>
            </div>
          `,
              iconSize: [240, 40],
              iconAnchor: [20, 20],
            });
        const trueMarker = L.marker(labelPoint, { icon: trueTargetIcon, zIndexOffset: -100 });
        group.addLayer(trueMarker);

        // Draw the area, or the street path / feature polyline (multi-polyline safe)
        let shapeBounds: L.LatLngBounds | null = null;
        if (areaGeometry) {
          shapeBounds = addAreaLayers(group, areaGeometry).getBounds();
          placeOnZoom.push(keepPlaqueClearOfArea(map, trueMarker, labelPoint, shapeBounds, '.area-plaque'));
        } else if (polylinesToRender) {
          const streetCasing = L.polyline(polylinesToRender, {
            color: '#26372f',
            weight: 14,
            opacity: 0.92,
            lineCap: 'round',
            lineJoin: 'round',
          });
          group.addLayer(streetCasing);
          const streetPath = L.polyline(polylinesToRender, {
            color: '#5a9a78',
            weight: 7,
            opacity: 1,
            lineCap: 'round',
            lineJoin: 'round',
          });
          group.addLayer(streetPath);
          shapeBounds = streetPath.getBounds();
        }

        // Distance connecting ray and distance pill
        if (userPinnedLocation && (distanceErrorMeters === undefined || distanceErrorMeters > 30)) {
          const nearestTargetPoint = calculateClosestPointOnFeature(
            userPinnedLocation,
            currentFeature.center,
            currentFeature.path,
            currentFeature.paths
          );
          const connectingLine = L.polyline([userPinnedLocation, nearestTargetPoint], {
            color: '#c4a35a',
            weight: 3,
            dashArray: '6, 8',
            opacity: 0.85,
          });
          group.addLayer(connectingLine);

        }

        // Fit revealed geometry into the part of the map that is not covered by
        // the result card. This also handles skipped rounds with no user pin.
        const revealBounds = withMinimumFrame(shapeBounds ?? L.latLngBounds([currentFeature.center]));
        revealBounds.extend(labelPoint);
        if (userPinnedLocation) revealBounds.extend(userPinnedLocation);
        revealBoundsRef.current = revealBounds;
        fitAboveResultCard(map, revealBounds);
      }
    }

    if (!placeOnZoom.length) return;
    const place = () => placeOnZoom.forEach((update) => update());
    const frame = requestAnimationFrame(place);
    map.on('zoomend', place);
    return () => { cancelAnimationFrame(frame); map.off('zoomend', place); };
  }, [gameMode, currentFeature, userPinnedLocation, isRoundComplete, distanceErrorMeters, isGameOver, allRoundResults, userLocation]);

  // A new Pinpoint question opens on the whole search area, never on the answer (that would give it
  // away) and never left at the last reveal's zoom. Pins being placed do not re-fit.
  const searchBoundaryRef = useRef(searchBoundary);
  searchBoundaryRef.current = searchBoundary;
  const cityViewRef = useRef({ center: cityCenter, zoom: defaultZoom });
  cityViewRef.current = { center: cityCenter, zoom: defaultZoom };
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !currentFeature || isRoundComplete || isGameOver) return;
    if (gameMode !== 'pinpoint' && gameMode !== 'guess_neighborhood') return;
    const boundary = searchBoundaryRef.current;
    if (boundary) fitAboveCard(map, boundaryBounds(boundary), PINPOINT_QUESTION_CARD, 15);
    else map.setView(cityViewRef.current.center, cityViewRef.current.zoom, { animate: true });
  }, [currentFeature?.id, isRoundComplete, isGameOver, gameMode]);

  // Opening or folding a bottom card changes how much map it covers: keep the answer (or the Guess
  // Name highlight) in view above it.
  useEffect(() => {
    const map = mapInstanceRef.current;
    const selector = fitSelectorRef.current;
    if (!map || isGameOver || typeof ResizeObserver === 'undefined') return;
    if (!isRoundComplete && selector !== GUESS_QUESTION_CARD) return;
    const card = document.querySelector<HTMLElement>(selector);
    if (!card) return;
    const holder = card.parentElement ?? card;
    let lastHeight = holder.offsetHeight;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      if (Math.abs(holder.offsetHeight - lastHeight) < 24) return;
      lastHeight = holder.offsetHeight;
      clearTimeout(timer);
      timer = setTimeout(() => { if (revealBoundsRef.current) fitAboveCard(map, revealBoundsRef.current, fitSelectorRef.current); }, 120);
    });
    observer.observe(holder);
    // A window resize can cross the dock breakpoint (or move the dock's edge): fit again.
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (revealBoundsRef.current) fitAboveCard(map, revealBoundsRef.current, fitSelectorRef.current); }, 200);
    };
    window.addEventListener('resize', onResize);
    return () => { observer.disconnect(); clearTimeout(timer); window.removeEventListener('resize', onResize); };
  }, [isRoundComplete, isGameOver, currentFeature, gameMode]);

  const handleLocateClick = () => {
    if (onLocateUser) {
      onLocateUser();
    } else if (userLocation && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(userLocation, 14, { duration: 1.2 });
    }
  };

  return (
    <div
      id="map-viewport-container"
      className={`w-full h-full relative isolate overflow-hidden select-none ${
        (gameMode === 'pinpoint' || gameMode === 'guess_neighborhood') && !isRoundComplete && !isGameOver ? 'cursor-crosshair' : 'cursor-grab'
      }`}
    >
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Locate Me Button (Positioned above Zoom controls) */}
      {showLocate && (
      <button
        id="map-locate-me-btn"
        onClick={handleLocateClick}
        title="Center on My Location"
        className="enamel-float absolute bottom-20 right-2.5 z-[900] p-2.5 flex items-center justify-center cursor-pointer transition hover:scale-105 active:scale-95"
      >
        {isLocating ? (
          <Loader2 className="w-4 h-4 text-[#8a4a18] animate-spin" />
        ) : (
          <LocateFixed className="w-4 h-4 text-[#8a4a18]" />
        )}
      </button>
      )}
    </div>
  );
};
