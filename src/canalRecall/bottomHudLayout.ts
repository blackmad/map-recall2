export type Rect = { x: number; y: number; width: number; height: number };
export type BottomHudLayout = {
  trip: Rect; postcard: Rect; landmark: Rect;
  minimap: Rect; zoomBadge: Rect; controlsHint: Rect;
};

export function bottomHudLayout({
  canvasWidth = 1280, canvasHeight = 720, tripWidth,
  postcardVisible = false, landmarkWidth = 480, landmarkHeight = 130,
  zoomVisible = false, controlsVisible = false,
}: {
  canvasWidth?: number; canvasHeight?: number; tripWidth: number;
  postcardVisible?: boolean; landmarkWidth?: number; landmarkHeight?: number;
  zoomVisible?: boolean; controlsVisible?: boolean;
}): BottomHudLayout {
  const trip = { x: canvasWidth - tripWidth - 16, y: canvasHeight - 98, width: tripWidth, height: 26 };
  const postcard = { x: canvasWidth - 410, y: trip.y - 118, width: 390, height: 104 };
  const minimap = { x: 15, y: canvasHeight - 155, width: 180, height: 140 };
  const zoomBadge = { x: canvasWidth / 2 - 35, y: canvasHeight - 35, width: 70, height: 22 };
  const controlsHint = { x: canvasWidth / 2 - 177, y: zoomVisible ? zoomBadge.y - 26 : canvasHeight - 32, width: 354, height: 12 };
  const centeredLandmarkX = canvasWidth / 2 - landmarkWidth / 2;
  const footerTop = controlsVisible ? controlsHint.y : zoomVisible ? zoomBadge.y : canvasHeight;
  const landmark = {
    x: postcardVisible ? Math.min(centeredLandmarkX, postcard.x - 14 - landmarkWidth) : centeredLandmarkX,
    y: Math.min(canvasHeight - landmarkHeight - 30, footerTop - 14 - landmarkHeight),
    width: landmarkWidth,
    height: landmarkHeight,
  };
  return { trip, postcard, landmark, minimap, zoomBadge, controlsHint };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}
