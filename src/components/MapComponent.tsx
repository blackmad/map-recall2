import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Loader2 } from 'lucide-react';
import { GameMode, StreetFeature, TileStyle, SearchBoundary } from '../types';
import { formatDistance } from '../utils/geo';

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
  fetchingBoundary?: {
    center: [number, number];
    radiusMeters: number;
    label?: string;
    scope?: string;
  } | null;
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
          prefix: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a> &copy; <a href="https://www.esri.com/" target="_blank">Esri</a> / <a href="https://carto.com/" target="_blank">CARTO</a>',
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

    const cartoKey = import.meta.env.VITE_CARTO_API_KEY ? `?api_key=${encodeURIComponent(import.meta.env.VITE_CARTO_API_KEY)}` : '';
    const hasCartoKey = Boolean(import.meta.env.VITE_CARTO_API_KEY);

    let tileUrl = '';
    let subdomains: string[] = ['a', 'b', 'c', 'd'];

    if (blindMapMode) {
      // Blind mode (label-less base map)
      if (tileStyle === 'dark') {
        tileUrl = hasCartoKey 
          ? `https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png${cartoKey}`
          : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
      } else {
        // Light label-less basemap (clean, high-resolution, no label watermarks)
        tileUrl = hasCartoKey
          ? `https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png${cartoKey}`
          : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
      }
      subdomains = ['a', 'b', 'c', 'd'];
    } else {
      // Standard labeled mode
      switch (tileStyle) {
        case 'dark':
          tileUrl = hasCartoKey
            ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png${cartoKey}`
            : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
          break;
        case 'light_nolabels':
          tileUrl = hasCartoKey
            ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png${cartoKey}`
            : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
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
  }, [tileStyle, blindMapMode]);

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
    map.flyTo([cityCenter[0], cityCenter[1]], defaultZoom, { duration: 1.2 });
  }, [cityCenter[0], cityCenter[1], defaultZoom]);

  // Render Search Boundary Circle (both during fetching and when toggled persistently)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = boundaryGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const activeBoundary = fetchingBoundary || (showSearchBoundary && searchBoundary ? searchBoundary : null);
    if (!activeBoundary) return;

    const boundaryCircle = L.circle(activeBoundary.center, {
      radius: activeBoundary.radiusMeters,
      color: '#0284c7',
      weight: 2.5,
      dashArray: '8, 8',
      fillColor: '#38bdf8',
      fillOpacity: 0.12,
    });
    group.addLayer(boundaryCircle);

    const innerRadar = L.circle(activeBoundary.center, {
      radius: activeBoundary.radiusMeters * 0.4,
      color: '#38bdf8',
      weight: 1.5,
      dashArray: '4, 6',
      fillColor: '#0ea5e9',
      fillOpacity: 0.06,
    });
    group.addLayer(innerRadar);

    const boundaryIcon = L.divIcon({
      className: 'custom-map-icon',
      html: `
        <div class="px-3 py-1.5 rounded-xl bg-slate-900/95 text-cyan-300 font-bold text-xs shadow-2xl border border-cyan-500/50 backdrop-blur-md flex items-center gap-2 transform -translate-x-1/2 -translate-y-1/2 whitespace-nowrap">
          <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping inline-block"></span>
          <span>🛰️ Overpass Search Boundary: ${(activeBoundary.radiusMeters / 1000).toFixed(1)} km (${activeBoundary.label || 'Search Zone'})</span>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    const labelMarker = L.marker(activeBoundary.center, { icon: boundaryIcon });
    group.addLayer(labelMarker);

    if (fetchingBoundary) {
      const circleBounds = boundaryCircle.getBounds();
      map.fitBounds(circleBounds, { padding: [40, 40], maxZoom: 14, animate: true });
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
        marker.bindPopup(`<b>#${i + 1}: ${feat.name}</b><br/>${feat.funFact}`);
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
            <div class="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-semibold text-xs shadow-2xl border border-blue-400/50 flex items-center gap-1.5 transform -translate-x-1/2 -translate-y-full whitespace-nowrap">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>${currentFeature.name}</span>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        const marker = L.marker(currentFeature.center, { icon: revealIcon });
        group.addLayer(marker);
      }
    }

    // 3. PINPOINT LOCATION MODE
    if (gameMode === 'pinpoint') {
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
        // True target marker
        const trueTargetIcon = L.divIcon({
          className: 'custom-true-target-icon',
          html: `
            <div class="px-3 py-1 bg-emerald-600 text-white rounded-full text-xs font-bold shadow-xl border-2 border-white flex items-center gap-1.5 ring-4 ring-emerald-400/40 whitespace-nowrap transform -translate-x-1/2 -translate-y-1/2">
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
              </svg>
              <span>${currentFeature.name}</span>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        const trueMarker = L.marker(currentFeature.center, { icon: trueTargetIcon });
        group.addLayer(trueMarker);

        // Draw street path / feature polyline (multi-polyline safe)
        if (polylinesToRender) {
          const streetPath = L.polyline(polylinesToRender, {
            color: '#10b981',
            weight: 6,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round',
          });
          group.addLayer(streetPath);
        } else {
          const radius = currentFeature.radius || 75;
          const targetCircle = L.circle(currentFeature.center, {
            radius: radius,
            color: '#10b981',
            fillColor: '#34d399',
            fillOpacity: 0.25,
            weight: 3,
          });
          group.addLayer(targetCircle);
        }

        // Bullseye Rings around true target
        const ring1 = L.circle(currentFeature.center, {
          radius: 80,
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.1,
          weight: 1.5,
          dashArray: '3, 6',
        });
        const ring2 = L.circle(currentFeature.center, {
          radius: 300,
          color: '#3b82f6',
          fillOpacity: 0.05,
          weight: 1,
          dashArray: '4, 8',
        });
        group.addLayer(ring1);
        group.addLayer(ring2);

        // Distance connecting ray and distance pill
        if (userPinnedLocation) {
          const connectingLine = L.polyline([userPinnedLocation, currentFeature.center], {
            color: '#f43f5e',
            weight: 3,
            dashArray: '6, 8',
            opacity: 0.85,
          });
          group.addLayer(connectingLine);

          // Distance midpoint badge
          if (distanceErrorMeters !== undefined) {
            const midLat = (userPinnedLocation[0] + currentFeature.center[0]) / 2;
            const midLng = (userPinnedLocation[1] + currentFeature.center[1]) / 2;

            const distBadgeIcon = L.divIcon({
              className: 'custom-map-icon',
              html: `
                <div class="px-2.5 py-1 rounded-lg bg-slate-900/90 text-amber-300 font-mono font-bold text-xs shadow-md border border-amber-500/40 transform -translate-x-1/2 -translate-y-1/2 whitespace-nowrap">
                  📏 ${formatDistance(distanceErrorMeters)}
                </div>
              `,
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            });
            const distMarker = L.marker([midLat, midLng], { icon: distBadgeIcon });
            group.addLayer(distMarker);
          }

          // Smoothly fit view to show both points with comfortable padding
          const bounds = L.latLngBounds([userPinnedLocation, currentFeature.center]);
          map.fitBounds(bounds, { padding: [90, 90], maxZoom: 16 });
        }
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
        gameMode === 'pinpoint' && !isRoundComplete && !isGameOver ? 'cursor-crosshair' : 'cursor-grab'
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
