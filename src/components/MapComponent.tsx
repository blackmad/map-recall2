import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Loader2 } from 'lucide-react';
import { GameMode, StreetFeature, TileStyle, SearchBoundary } from '../types';
import { calculateClosestPointOnFeature } from '../utils/geo';

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
  tileStyle: TileStyle;
  allRoundResults?: Array<{
    feature: StreetFeature;
    userCoordinates?: [number, number];
    distanceErrorMeters?: number;
    isCorrect?: boolean;
    gameMode: GameMode;
  }>;
  isGameOver?: boolean;
  userLocation?: [number, number] | null;
  onLocateUser?: () => void;
  isLocating?: boolean;
  fetchingBoundary?: SearchBoundary | null;
  searchBoundary?: SearchBoundary | null;
  showSearchBoundary?: boolean;
}

function getFeatureColors(type: string) {
  switch (type) {
    case 'canal':
    case 'water':
      return { core: '#0284c7', glow: '#38bdf8', fill: '#0ea5e9' }; // Azure/Cyan water
    case 'bridge':
      return { core: '#d97706', glow: '#f59e0b', fill: '#fbbf24' }; // Amber/Orange
    case 'park':
      return { core: '#059669', glow: '#10b981', fill: '#34d399' }; // Emerald
    case 'square':
    case 'monument':
    case 'museum':
    case 'landmark':
      return { core: '#7c3aed', glow: '#a855f7', fill: '#c084fc' }; // Purple
    case 'street':
    case 'avenue':
    case 'boulevard':
    default:
      return { core: '#2563eb', glow: '#3b82f6', fill: '#60a5fa' }; // Royal Blue
  }
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
  tileStyle,
  allRoundResults,
  isGameOver,
  userLocation,
  onLocateUser,
  isLocating,
  fetchingBoundary,
  searchBoundary,
  showSearchBoundary,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);
  const boundaryGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map and Resize Observer
  useEffect(() => {
    if (!mapContainerRef.current) return;

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

      // Ensure dimensions are synced immediately
      setTimeout(() => {
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
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
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
    }).addTo(mapInstanceRef.current);
  }, [tileStyle, blindMapMode, BASEMAP_CONFIG_VERSION]);

  // Handle map click for pinpoint mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (gameMode === 'pinpoint' && !isRoundComplete && !isGameOver) {
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
          color: '#7c3aed', weight: fetchingBoundary ? 2.5 : 1.5, dashArray: '8, 8',
          fillColor: '#8b5cf6', fillOpacity: fetchingBoundary ? 0.08 : 0.025,
        })
      : activeBoundary.bounds
      ? L.rectangle(activeBoundary.bounds, {
          color: '#7c3aed',
          weight: fetchingBoundary ? 2.5 : 1.5,
          dashArray: '8, 8',
          fillColor: '#8b5cf6',
          fillOpacity: fetchingBoundary ? 0.08 : 0.025,
        })
      : L.circle(activeBoundary.center, {
      radius: activeBoundary.radiusMeters,
      color: '#0284c7',
      weight: fetchingBoundary ? 2.5 : 1.5,
      dashArray: '8, 8',
      fillColor: '#38bdf8',
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

    // User GPS location dot
    if (userLocation) {
      const userGpsIcon = L.divIcon({
        className: 'custom-map-icon',
        html: `
          <div class="relative flex items-center justify-center w-7 h-7 transform -translate-x-1/2 -translate-y-1/2">
            <span class="absolute w-7 h-7 rounded-full bg-blue-500/30 animate-ping"></span>
            <span class="relative w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-lg shadow-blue-500/50"></span>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const marker = L.marker(userLocation, { icon: userGpsIcon });
      group.addLayer(marker);
    }

    // 1. GAME OVER SUMMARY: Render all round traces
    if (isGameOver && allRoundResults && allRoundResults.length > 0) {
      const bounds = L.latLngBounds([]);

      allRoundResults.forEach((res, i) => {
        const feat = res.feature;

        // Actual target marker
        const targetIcon = L.divIcon({
          className: 'custom-map-icon',
          html: `
            <div class="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs shadow-lg border-2 border-white ring-2 ring-emerald-300 transform -translate-x-1/2 -translate-y-1/2">
              #${i + 1}
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        const marker = L.marker(feat.center, { icon: targetIcon });
        marker.bindPopup(`<b>#${i + 1}: ${feat.name}</b>`);
        group.addLayer(marker);
        bounds.extend(feat.center);

        // Path (handles multi-paths without fake connecting bridges)
        const polyLines = (feat.paths && feat.paths.length > 0)
          ? feat.paths
          : (feat.path && feat.path.length > 1 ? [feat.path] : null);

        if (polyLines) {
          const poly = L.polyline(polyLines, {
            color: '#059669',
            weight: 5,
            opacity: 0.85,
            lineCap: 'round',
            lineJoin: 'round',
          });
          group.addLayer(poly);
          bounds.extend(poly.getBounds());
        }

        // Pinpoint User guess
        if (res.userCoordinates) {
          const userIcon = L.divIcon({
            className: 'custom-map-icon',
            html: `
              <div class="flex items-center justify-center w-6 h-6 rounded-full bg-rose-500 text-white font-bold text-[10px] shadow border-2 border-white transform -translate-x-1/2 -translate-y-1/2">
                P${i + 1}
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });
          const userMarker = L.marker(res.userCoordinates, { icon: userIcon });
          group.addLayer(userMarker);
          bounds.extend(res.userCoordinates);

          // Connecting line
          const line = L.polyline([res.userCoordinates, feat.center], {
            color: '#e11d48',
            weight: 2,
            dashArray: '5, 8',
            opacity: 0.7,
          });
          group.addLayer(line);
        }
      });

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      }
      return;
    }

    if (!currentFeature) return;

    // Multi-polyline / segment paths
    const polylinesToRender = (currentFeature.paths && currentFeature.paths.length > 0)
      ? currentFeature.paths
      : (currentFeature.path && currentFeature.path.length > 1 ? [currentFeature.path] : null);

    // 2. GUESS THE NAME MODE
    if (gameMode === 'guess_name') {
      const colors = getFeatureColors(currentFeature.type);

      // Highlight the target feature prominently
      if (polylinesToRender) {
        const casingLine = L.polyline(polylinesToRender, {
          color: '#0f172a',
          weight: 14,
          opacity: 0.82,
          lineCap: 'round',
          lineJoin: 'round',
        });
        group.addLayer(casingLine);

        // Glowing outline
        const glowLine = L.polyline(polylinesToRender, {
          color: colors.glow,
          weight: 12,
          opacity: 0.4,
          lineCap: 'round',
          lineJoin: 'round',
        });
        group.addLayer(glowLine);

        // Core line
        const coreLine = L.polyline(polylinesToRender, {
          color: colors.core,
          weight: 6,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        });
        group.addLayer(coreLine);

        if (!isRoundComplete) {
          map.fitBounds(coreLine.getBounds(), { padding: [80, 80], maxZoom: 16 });
        }
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

        if (!isRoundComplete) {
          map.setView(currentFeature.center, 16);
        }
      }

      // If round complete, show name label marker
      if (isRoundComplete) {
        const revealIcon = L.divIcon({
          className: 'custom-map-icon',
          html: `
            <div class="inline-flex px-3 py-1.5 rounded-lg bg-slate-950 text-white font-bold text-xs shadow-2xl border-2 border-cyan-400 items-center gap-1.5 whitespace-nowrap">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>${currentFeature.name}</span>
            </div>
          `,
          iconSize: [180, 32],
          iconAnchor: [90, 42],
        });
        const marker = L.marker(currentFeature.center, { icon: revealIcon });
        group.addLayer(marker);

        const revealBounds = polylinesToRender
          ? L.polyline(polylinesToRender).getBounds()
          : L.latLngBounds([currentFeature.center]);
        const resultCardPadding = Math.min(440, Math.max(240, Math.round(map.getSize().y * 0.42)));
        map.fitBounds(revealBounds, {
          paddingTopLeft: [70, 90],
          paddingBottomRight: [70, resultCardPadding],
          maxZoom: 16,
          animate: true,
        });
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
                <path d="M16 0C7.16344 0 0 7.16344 0 16C0 26.5 14.5 39.5 15.35 40.25C15.73 40.58 16.27 40.58 16.65 40.25C17.5 39.5 32 26.5 32 16C32 7.16344 24.8366 0 16 0Z" fill="#E11D48" />
                <path d="M16 1C7.71573 1 1 7.71573 1 16C1 25.8 14.8 38.3 16 39.35C17.2 38.3 31 25.8 31 16C31 7.71573 24.2843 1 16 1Z" stroke="#FFFFFF" stroke-width="1.5" />
                <!-- Center Target Dot -->
                <circle cx="16" cy="15" r="5.5" fill="#FFFFFF" />
                <circle cx="16" cy="15" r="2.5" fill="#E11D48" />
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
        // single target point, so only point features receive a dot marker.
        const trueTargetIcon = L.divIcon({
          className: 'custom-true-target-icon',
          html: `
            <div style="display:flex;align-items:center;gap:7px;transform:translate(8px,-46px);white-space:nowrap;filter:drop-shadow(0 4px 8px rgb(0 0 0 / .65));">
              ${polylinesToRender ? '' : '<span style="display:block;width:22px;height:22px;flex:none;border-radius:999px;background:transparent;border:4px solid #10b981;box-shadow:0 0 0 3px #f8fafc;"></span>'}
              <span style="display:block;border:2px solid #67e8f9;border-radius:8px;background:#020617;padding:5px 9px;color:#fff;font:800 13px/1.1 'Plus Jakarta Sans',sans-serif;letter-spacing:.01em;text-shadow:0 1px 2px #000;">${currentFeature.name}</span>
            </div>
          `,
          iconSize: [240, 40],
          iconAnchor: [20, 20],
        });
        const trueMarker = L.marker(currentFeature.center, { icon: trueTargetIcon, zIndexOffset: -100 });
        group.addLayer(trueMarker);

        // Draw street path / feature polyline (multi-polyline safe)
        if (polylinesToRender) {
          const streetCasing = L.polyline(polylinesToRender, {
            color: '#020617',
            weight: 14,
            opacity: 0.92,
            lineCap: 'round',
            lineJoin: 'round',
          });
          group.addLayer(streetCasing);
          const streetPath = L.polyline(polylinesToRender, {
            color: '#10b981',
            weight: 7,
            opacity: 1,
            lineCap: 'round',
            lineJoin: 'round',
          });
          group.addLayer(streetPath);
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
            color: '#f43f5e',
            weight: 3,
            dashArray: '6, 8',
            opacity: 0.85,
          });
          group.addLayer(connectingLine);

        }

        // Fit revealed geometry into the part of the map that is not covered by
        // the result card. This also handles skipped rounds with no user pin.
        const revealBounds = polylinesToRender
          ? L.polyline(polylinesToRender).getBounds()
          : L.latLngBounds([currentFeature.center]);
        revealBounds.extend(currentFeature.center);
        if (userPinnedLocation) revealBounds.extend(userPinnedLocation);
        const viewportHeight = map.getSize().y;
        const resultCardPadding = Math.min(440, Math.max(240, Math.round(viewportHeight * 0.42)));
        map.fitBounds(revealBounds, {
          paddingTopLeft: [70, 90],
          paddingBottomRight: [70, resultCardPadding],
          maxZoom: 16,
          animate: true,
        });
      }
    }
  }, [gameMode, currentFeature, userPinnedLocation, isRoundComplete, distanceErrorMeters, isGameOver, allRoundResults, userLocation]);

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
      className={`w-full h-full relative overflow-hidden select-none ${
        (gameMode === 'pinpoint' || gameMode === 'guess_neighborhood') && !isRoundComplete && !isGameOver ? 'cursor-crosshair' : 'cursor-grab'
      }`}
    >
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Locate Me Button (Positioned above Zoom controls) */}
      <button
        id="map-locate-me-btn"
        onClick={handleLocateClick}
        title="Center on My Location"
        className="absolute bottom-20 right-2.5 z-[900] p-2.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white shadow-md border border-slate-700/80 transition-all hover:scale-105 active:scale-95 flex items-center justify-center backdrop-blur-sm cursor-pointer"
      >
        {isLocating ? (
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
        ) : (
          <LocateFixed className="w-4 h-4 text-blue-400 hover:text-blue-300" />
        )}
      </button>
    </div>
  );
};
