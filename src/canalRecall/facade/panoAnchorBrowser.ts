/** Control-point marker for the Amsterdam panorama camera model.
 *
 * Shows predicted world->pixel positions of known 3DBAG building corners on
 * the raw equirectangular panorama. Pressing Enter accepts the prediction;
 * dragging or arrow keys correct it. The saved pixel is the independent
 * correspondence, so this tool never invents a measurement: it records the
 * reviewer's judgement and the residual against the current model.
 */

type Status = 'pending' | 'accepted' | 'corrected' | 'skipped';

interface World { x: number; y: number; z: number; datum: string }
interface Marker {
  id: string;
  label: string;
  kind: string;
  buildingId: string;
  address: string;
  wallElevationId: string;
  world: World;
  predicted: [number, number];
  standoffM: number;
  obliquityDeg: number;
  pixel: [number, number];
  status: Status;
  footprint: number[][];
  wall: number[][];
}
interface Pano {
  panoramaId: string;
  usedFor: string;
  date: string;
  mission: string;
  imageUrl: string;
  width: number;
  height: number;
  pose: { x: number; y: number; z: number; headingDeg: number; pitchDeg: number; rollDeg: number };
  datum: string;
  camera: { x: number; y: number };
  cameraModelId: string;
  markers: Marker[];
}
interface Task { version: number; kind: string; cameraModelId: string; instruction: string; panos: Pano[] }
interface SavedAnchor {
  panoramaId: string; markerId: string; pixel: [number, number]; status: Status; residualPx: number;
}
interface Snapshot { panoIndex: number; markerIndex: number; pixel: [number, number]; status: Status }

const STYLE = `
.pa-root{position:fixed;inset:0;display:flex;flex-direction:column;background:#101418;color:#e8ecef;font:14px/1.4 system-ui,-apple-system,Segoe UI,sans-serif}
.pa-bar{display:flex;align-items:center;gap:12px;padding:9px 14px;background:#161c22;border-bottom:1px solid #2a333c;flex-wrap:wrap}
.pa-title{font-weight:700;letter-spacing:.01em}
.pa-progress{color:#9fb0bd}
.pa-spacer{flex:1}
.pa-btn{background:#22303a;color:#e8ecef;border:1px solid #37474f;border-radius:6px;padding:6px 12px;cursor:pointer;font:inherit}
.pa-btn:hover{background:#2c3d49}
.pa-btn:disabled{opacity:.4;cursor:default}
.pa-btn.pa-primary{background:#1d6f4a;border-color:#2a8f61}
.pa-btn.pa-primary:hover{background:#22855a}
.pa-status{font-size:12px;color:#8ea0ad;min-width:120px}
.pa-stage{position:relative;flex:1;min-height:0;overflow:hidden;cursor:grab}
.pa-stage.pa-panning{cursor:grabbing}
.pa-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.pa-loupe{position:absolute;right:14px;bottom:14px;width:190px;height:190px;border:2px solid #d7e2ea;border-radius:8px;background:#000;box-shadow:0 6px 24px rgba(0,0,0,.5)}
.pa-map{position:absolute;right:14px;top:14px;width:190px;height:190px;border:2px solid #d7e2ea;border-radius:8px;background:#0b0f12;box-shadow:0 6px 24px rgba(0,0,0,.5)}
.pa-readout{position:absolute;left:14px;bottom:14px;background:rgba(16,20,24,.9);border:1px solid #2a333c;border-radius:8px;padding:12px 14px;max-width:min(600px,62vw)}
.pa-readout .pa-q{color:#ffd25a;font-weight:600;margin-bottom:4px}
.pa-res{color:#7fd4a0}.pa-res.pa-warn{color:#f0b46b}
.pa-status-line{font-size:12px;color:#8ea0ad}
.pa-help{position:absolute;inset:auto 14px 14px 14px;top:64px;background:#161c22;border:1px solid #2a333c;border-radius:10px;padding:16px 20px;max-width:720px;margin:0 auto;box-shadow:0 12px 40px rgba(0,0,0,.6);overflow:auto;line-height:1.55}
.pa-help h2{margin:0 0 8px;font-size:16px}
.pa-help p{margin:8px 0}
.pa-help kbd{display:inline-block;border:1px solid #37474f;border-radius:4px;padding:0 6px;color:#cfd9e0;font-size:12px;background:#1c242b}
.pa-help ul{margin:8px 0;padding-left:20px}
.pa-help li{margin:5px 0}
.pa-modal{position:fixed;inset:0;background:rgba(6,9,12,.82);display:flex;align-items:center;justify-content:center;z-index:20;padding:20px}
.pa-modal .pa-card{background:#161c22;border:1px solid #2a333c;border-radius:12px;padding:22px 26px;max-width:620px;box-shadow:0 20px 60px rgba(0,0,0,.7)}
.pa-modal h2{margin:0 0 10px;font-size:19px}
.pa-modal p{margin:9px 0;line-height:1.55}
.pa-modal .pa-row{display:flex;gap:12px;justify-content:flex-end;margin-top:16px}
.pa-key{display:inline-block;border:1px solid #37474f;border-radius:4px;padding:0 5px;color:#cfd9e0;font-size:11px;background:#1c242b}
.pa-root [hidden]{display:none !important}
`;

const HELP_HTML = `
  <h2>What am I doing?</h2>
  <p>We are teaching the app where each 360° street camera is pointing, so we can line
  photographs up with the real buildings. It already knows where every building
  <em>should</em> be; this checks that it is looking at the right spot.</p>
  <p><b>The yellow ring is the app's guess</b> for where a known building corner appears
  in the photo. <b>The green dot is your answer.</b> The <b>map (top-right)</b> shows the
  building from above: the <b>yellow line</b> is the photographed street-facing wall, the
  <b>yellow dot</b> is the wall end this marker wants, and the green dot is the camera.
  You only ever align to a corner on that street-facing wall.</p>
  <ul>
    <li>If the yellow ring is already sitting on the corner, press <kbd>Enter</kbd> (or <b>Accept</b>).</li>
    <li>If it is not, drag the <b>green dot</b> onto the corner — the vertical edge where
    two walls meet. Arrow keys nudge it; <kbd>Shift</kbd>+arrows move 10×.</li>
    <li>Can't tell (hidden by a car, tree, etc.)? Press <kbd>S</kbd> to skip.</li>
    <li>Mistake? Press <kbd>Ctrl</kbd>+<kbd>Z</kbd> or <b>Undo</b>.</li>
  </ul>
  <p>Use the mouse wheel to zoom, drag the background to look around. The loupe (bottom
  right) is a magnified view of the current marker. The corner does not have to be
  perfect — a few pixels is fine.</p>
  <p>You have a handful of markers across three streets. The last street is a
  <b>holdout</b>: mark it exactly the same way, we just won't tune on it.</p>`;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function mountPanoAnchor(root: HTMLElement): void {
  root.innerHTML = `
    <style>${STYLE}</style>
    <div class="pa-root">
      <div class="pa-bar">
        <span class="pa-title">Pano anchors</span>
        <span class="pa-progress" data-progress>loading…</span>
        <span class="pa-spacer"></span>
        <span class="pa-status" data-status></span>
        <button class="pa-btn" data-undo title="Ctrl/Cmd+Z">↶ Undo</button>
        <button class="pa-btn" data-prev>◀ Prev</button>
        <button class="pa-btn pa-primary" data-accept>Accept ⏎</button>
        <button class="pa-btn" data-skip>Skip (S)</button>
        <button class="pa-btn" data-next>Next ▶</button>
        <button class="pa-btn" data-pano>Next pano (N)</button>
        <button class="pa-btn" data-help>? Help</button>
      </div>
      <div class="pa-stage" data-stage>
        <canvas class="pa-canvas" data-canvas></canvas>
        <canvas class="pa-map" data-map width="190" height="190"></canvas>
        <canvas class="pa-loupe" data-loupe width="190" height="190"></canvas>
        <div class="pa-readout" data-readout></div>
      </div>
      <div class="pa-help" data-help-panel hidden>${HELP_HTML}</div>
      <div class="pa-modal" data-intro>
        <div class="pa-card">
          <h2>Mark the building corners</h2>
          <p>The <b>yellow ring</b> is where the app guesses a known building corner is.
          Drag the <b>green dot</b> onto the real corner, or press <b>Enter</b> if it's
          already right. Press <b>S</b> if you can't tell. <b>Undo</b> fixes mistakes.</p>
          <p style="color:#8ea0ad">You'll do this for a few markers on three streets. It takes a couple of minutes.</p>
          <div class="pa-row"><button class="pa-btn" data-help-from-intro>More detail</button><button class="pa-btn pa-primary" data-start>Start</button></div>
        </div>
      </div>
    </div>`;

  const $ = <T extends Element>(selector: string) => root.querySelector(selector) as T;
  const stage = $<HTMLElement>('[data-stage]');
  const canvas = $<HTMLCanvasElement>('[data-canvas]');
  const loupe = $<HTMLCanvasElement>('[data-loupe]');
  const progressEl = $<HTMLElement>('[data-progress]');
  const statusEl = $<HTMLElement>('[data-status]');
  const readout = $<HTMLElement>('[data-readout]');
  const undoBtn = $<HTMLButtonElement>('[data-undo]');
  const helpPanel = $<HTMLElement>('[data-help-panel]');
  const intro = $<HTMLElement>('[data-intro]');
  const ctx = canvas.getContext('2d')!;
  const lctx = loupe.getContext('2d')!;
  const mapCanvas = $<HTMLCanvasElement>('[data-map]');
  const mctx = mapCanvas.getContext('2d')!;

  let task: Task | null = null;
  let panoIndex = 0;
  let markerIndex = 0;
  let scale = 0.35;
  let cx = 0;
  let cy = 0;
  let image: HTMLImageElement | null = null;
  let imageReady = false;
  let dragging: { marker: Marker; pointerId: number } | null = null;
  let panning: { pointerId: number; x: number; y: number; cx: number; cy: number } | null = null;
  const history: Snapshot[] = [];
  const saved = new Map<string, SavedAnchor>();
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  const pano = (): Pano => task!.panos[panoIndex];
  const active = (): Marker => pano().markers[markerIndex];

  function snapshot(): void {
    const marker = active();
    history.push({ panoIndex, markerIndex, pixel: [...marker.pixel], status: marker.status });
    if (history.length > 200) history.shift();
    undoBtn.disabled = history.length === 0;
  }

  function undo(): void {
    const state = history.pop();
    undoBtn.disabled = history.length === 0;
    if (!state) return;
    panoIndex = state.panoIndex;
    markerIndex = state.markerIndex;
    const marker = active();
    marker.pixel = [...state.pixel];
    marker.status = state.status;
    void persist();
    focusActive();
    render();
    setStatus('undone');
  }

  function resize(): void {
    const rect = stage.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    render();
  }

  const cssW = () => canvas.width / dpr;
  const cssH = () => canvas.height / dpr;
  const toScreen = (ix: number, iy: number): [number, number] => [
    (ix - cx) * scale + cssW() / 2,
    (iy - cy) * scale + cssH() / 2,
  ];
  const toImage = (sx: number, sy: number): [number, number] => [
    (sx - cssW() / 2) / scale + cx,
    (sy - cssH() / 2) / scale + cy,
  ];

  function focusActive(): void {
    const marker = active();
    cx = clamp(marker.pixel[0], 0, pano().width);
    cy = clamp(marker.pixel[1], 0, pano().height);
  }

  function render(): void {
    const w = cssW();
    const h = cssH();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0f12';
    ctx.fillRect(0, 0, w, h);
    if (image && imageReady) {
      const sx = cx - w / (2 * scale);
      const sy = cy - h / (2 * scale);
      ctx.imageSmoothingEnabled = scale < 1;
      ctx.drawImage(image, sx, sy, w / scale, h / scale, 0, 0, w, h);
    }
    if (image && imageReady) {
      const [, hy] = toScreen(0, pano().height / 2);
      ctx.strokeStyle = 'rgba(120,200,255,.35)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(0, hy);
      ctx.lineTo(w, hy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const marker of pano().markers) {
      const isActive = marker === active();
      const [px, py] = toScreen(marker.predicted[0], marker.predicted[1]);
      const [mx, my] = toScreen(marker.pixel[0], marker.pixel[1]);
      if (marker.status === 'skipped') {
        ctx.strokeStyle = 'rgba(150,160,170,.5)';
        ctx.beginPath();
        ctx.moveTo(px - 6, py - 6);
        ctx.lineTo(px + 6, py + 6);
        ctx.moveTo(px + 6, py - 6);
        ctx.lineTo(px - 6, py + 6);
        ctx.stroke();
        continue;
      }
      ctx.strokeStyle = 'rgba(255,210,90,.9)';
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.beginPath();
      ctx.arc(px, py, isActive ? 11 : 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = marker.status === 'pending' ? 'rgba(255,210,90,.35)' : 'rgba(255,210,90,.9)';
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
      if (marker.pixel[0] !== marker.predicted[0] || marker.pixel[1] !== marker.predicted[1]) {
        ctx.strokeStyle = 'rgba(255,210,90,.6)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(mx, my);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = isActive ? '#7fe0a8' : '#ffd25a';
      ctx.beginPath();
      ctx.arc(mx, my, isActive ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    renderLoupe();
    renderMap();
    renderReadout();
  }
  function renderLoupe(): void {
    const marker = active();
    const size = 190;
    const zoom = 7;
    lctx.fillStyle = '#000';
    lctx.fillRect(0, 0, size, size);
    if (image && imageReady) {
      const half = size / (2 * zoom);
      lctx.imageSmoothingEnabled = true;
      lctx.drawImage(image, marker.pixel[0] - half, marker.pixel[1] - half, half * 2, half * 2, 0, 0, size, size);
    }
    lctx.strokeStyle = 'rgba(127,224,168,.9)';
    lctx.lineWidth = 1;
    lctx.beginPath();
    lctx.moveTo(size / 2, size / 2 - 14);
    lctx.lineTo(size / 2, size / 2 + 14);
    lctx.moveTo(size / 2 - 14, size / 2);
    lctx.lineTo(size / 2 + 14, size / 2);
    lctx.stroke();
  }

  function renderMap(): void {
    const marker = active();
    const size = 190;
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, size, size);
    mctx.fillStyle = '#0b0f12';
    mctx.fillRect(0, 0, size, size);
    const ring = marker.footprint;
    const camera = pano().camera;
    if (!ring?.length || !camera) {
      mctx.fillStyle = '#8ea0ad';
      mctx.font = '12px system-ui';
      mctx.fillText('no footprint', 10, 22);
      return;
    }
    const points = [...ring, [marker.world.x, marker.world.y]];
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 24;
    const scaleMap = Math.min((size - 2 * pad) / Math.max(1, maxX - minX), (size - 2 * pad) / Math.max(1, maxY - minY));
    const centreX = (minX + maxX) / 2, centreY = (minY + maxY) / 2;
    const X = (x: number) => (x - centreX) * scaleMap + size / 2;
    const Y = (y: number) => -(y - centreY) * scaleMap + size / 2;
    const camX = clamp(X(camera.x), 9, size - 9);
    const camY = clamp(Y(camera.y), 9, size - 9);
    mctx.beginPath();
    ring.forEach((point, index) => { const px = X(point[0]), py = Y(point[1]); if (index) mctx.lineTo(px, py); else mctx.moveTo(px, py); });
    mctx.closePath();
    mctx.fillStyle = 'rgba(120,200,255,.15)';
    mctx.fill();
    mctx.strokeStyle = 'rgba(150,190,220,.9)';
    mctx.lineWidth = 1.5;
    mctx.stroke();
    // The photographed frontage wall: the marker sits at one of its two ends.
    if (marker.wall?.length === 2) {
      mctx.strokeStyle = '#ffd25a';
      mctx.lineWidth = 3;
      mctx.beginPath();
      mctx.moveTo(X(marker.wall[0][0]), Y(marker.wall[0][1]));
      mctx.lineTo(X(marker.wall[1][0]), Y(marker.wall[1][1]));
      mctx.stroke();
    }
    mctx.setLineDash([4, 3]);
    mctx.strokeStyle = 'rgba(255,210,90,.75)';
    mctx.beginPath();
    mctx.moveTo(camX, camY);
    mctx.lineTo(X(marker.world.x), Y(marker.world.y));
    mctx.stroke();
    mctx.setLineDash([]);
    mctx.fillStyle = '#7fd4a0';
    mctx.beginPath();
    mctx.arc(camX, camY, 4, 0, Math.PI * 2);
    mctx.fill();
    mctx.fillStyle = '#9fb0bd';
    mctx.font = '10px system-ui';
    mctx.fillText('camera', camX + 7, camY + 3);
    mctx.strokeStyle = '#ffd25a';
    mctx.lineWidth = 2.5;
    mctx.beginPath();
    mctx.arc(X(marker.world.x), Y(marker.world.y), 7, 0, Math.PI * 2);
    mctx.stroke();
    mctx.fillStyle = '#ffd25a';
    mctx.beginPath();
    mctx.arc(X(marker.world.x), Y(marker.world.y), 3, 0, Math.PI * 2);
    mctx.fill();
    mctx.fillStyle = '#cfd9e0';
    mctx.font = 'bold 11px system-ui';
    mctx.fillText('N ↑', 8, 16);
  }

  function renderReadout(): void {    const marker = active();
    const residual = Math.hypot(marker.pixel[0] - marker.predicted[0], marker.pixel[1] - marker.predicted[1]);
    const decided = pano().markers.filter((m) => m.status !== 'pending').length;
    readout.innerHTML = `<div class="pa-q">Put the green dot on the end of the yellow wall shown on the map (top-right).</div>
      <b>${marker.label}</b> · <span class="pa-status-line">${marker.address}</span><br>
      <span class="pa-status-line">street-facing wall · obliquity ${marker.obliquityDeg}° · standoff ${marker.standoffM} m</span><br>
      predicted ${marker.predicted[0].toFixed(0)}, ${marker.predicted[1].toFixed(0)} · your pixel ${marker.pixel[0].toFixed(0)}, ${marker.pixel[1].toFixed(0)} · residual <span class="pa-res${residual > 60 ? ' pa-warn' : ''}">${residual.toFixed(1)} px</span>`;
    progressEl.textContent = `pano ${panoIndex + 1}/${task!.panos.length} · marker ${markerIndex + 1}/${pano().markers.length} · ${decided}/${pano().markers.length} decided${pano().usedFor === 'holdout' ? ' · HOLDOUT' : ''}`;
  }

  function setStatus(message: string): void {
    statusEl.textContent = message;
    if (message) window.setTimeout(() => { if (statusEl.textContent === message) statusEl.textContent = ''; }, 2500);
  }

  async function persist(): Promise<void> {
    const markers = pano().markers;
    try {
      const response = await fetch('/api/pano-anchor/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          panoramaId: pano().panoramaId,
          cameraModelId: task!.cameraModelId,
          markers: markers.map((m) => ({
            markerId: m.id, kind: m.kind, buildingId: m.buildingId, address: m.address,
            world: m.world, predicted: m.predicted, pixel: m.pixel, status: m.status,
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'save failed');
      setStatus(`saved ✓ (${result.decided} decided)`);
    } catch (error) {
      setStatus(`save failed: ${String(error)}`);
    }
  }

  function decide(status: Status): void {
    const marker = active();
    snapshot();
    marker.status = status;
    if (status === 'accepted' || status === 'skipped') marker.pixel = [...marker.predicted];
    if (status === 'corrected') {
      const moved = Math.hypot(marker.pixel[0] - marker.predicted[0], marker.pixel[1] - marker.predicted[1]);
      if (moved < 0.5) marker.status = 'accepted';
    }
    void persist();
    nextMarker(1);
  }

  function nextMarker(delta: number): void {
    markerIndex = clamp(markerIndex + delta, 0, pano().markers.length - 1);
    focusActive();
    render();
  }

  function loadPano(index: number): void {
    panoIndex = clamp(index, 0, task!.panos.length - 1);
    markerIndex = 0;
    imageReady = false;
    const next = new Image();
    next.onload = () => { image = next; imageReady = true; focusActive(); render(); };
    next.onerror = () => setStatus('failed to load panorama');
    next.src = pano().imageUrl;
    for (const marker of pano().markers) {
      const record = saved.get(`${pano().panoramaId}|${marker.id}`);
      if (record) { marker.pixel = [...record.pixel]; marker.status = record.status; }
    }
    focusActive();
    render();
  }

  function localPoint(event: PointerEvent | WheelEvent): [number, number] {
    const rect = canvas.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }

  canvas.addEventListener('pointerdown', (event) => {
    const [sx, sy] = localPoint(event);
    let best: Marker | null = null;
    let bestDistance = 14;
    for (const marker of pano().markers) {
      const [mx, my] = toScreen(marker.pixel[0], marker.pixel[1]);
      const distance = Math.hypot(mx - sx, my - sy);
      if (distance < bestDistance) { best = marker; bestDistance = distance; }
    }
    if (best) {
      markerIndex = pano().markers.indexOf(best);
      snapshot();
      dragging = { marker: best, pointerId: event.pointerId };
      canvas.setPointerCapture(event.pointerId);
      render();
    } else {
      panning = { pointerId: event.pointerId, x: sx, y: sy, cx, cy };
      stage.classList.add('pa-panning');
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    if (dragging) {
      const [sx, sy] = localPoint(event);
      const [ix, iy] = toImage(sx, sy);
      dragging.marker.pixel = [ix, iy];
      render();
    } else if (panning) {
      const [sx, sy] = localPoint(event);
      cx = clamp(panning.cx - (sx - panning.x) / scale, 0, pano().width);
      cy = clamp(panning.cy - (sy - panning.y) / scale, 0, pano().height);
      render();
    }
  });

  function endPointer(event: PointerEvent): void {
    if (dragging) {
      const marker = dragging.marker;
      const moved = Math.hypot(marker.pixel[0] - marker.predicted[0], marker.pixel[1] - marker.predicted[1]);
      marker.status = moved < 0.5 ? 'accepted' : 'corrected';
      dragging = null;
      void persist();
      render();
    }
    if (panning) { panning = null; stage.classList.remove('pa-panning'); }
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const [sx, sy] = localPoint(event);
    const [beforeX, beforeY] = toImage(sx, sy);
    scale = clamp(scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15), 0.05, 8);
    cx = clamp(beforeX - (sx - cssW() / 2) / scale, 0, pano().width);
    cy = clamp(beforeY - (sy - cssH() / 2) / scale, 0, pano().height);
    render();
  }, { passive: false });

  window.addEventListener('keydown', (event) => {
    if (!task) return;
    if ((event.ctrlKey || event.metaKey) && (event.key === 'z' || event.key === 'Z')) { event.preventDefault(); undo(); return; }
    if (event.key === 'Escape') { intro.hidden = true; helpPanel.hidden = true; return; }
    const marker = active();
    const step = event.shiftKey ? 10 : 1;
    const nudge = (dx: number, dy: number) => {
      snapshot();
      marker.pixel = [marker.pixel[0] + dx, marker.pixel[1] + dy];
      marker.status = Math.hypot(marker.pixel[0] - marker.predicted[0], marker.pixel[1] - marker.predicted[1]) < 0.5 ? 'accepted' : 'corrected';
      render();
    };
    switch (event.key) {
      case 'Enter': event.preventDefault(); decide('accepted'); break;
      case 's': case 'S': decide('skipped'); break;
      case 'Tab': event.preventDefault(); nextMarker(event.shiftKey ? -1 : 1); break;
      case 'n': case 'N': event.preventDefault(); loadPano(panoIndex + 1); break;
      case 'p': case 'P': event.preventDefault(); loadPano(panoIndex - 1); break;
      case 'r': case 'R': snapshot(); marker.pixel = [...marker.predicted]; marker.status = 'pending'; void persist(); render(); break;
      case 'ArrowUp': event.preventDefault(); nudge(0, -step); break;
      case 'ArrowDown': event.preventDefault(); nudge(0, step); break;
      case 'ArrowLeft': event.preventDefault(); nudge(-step, 0); break;
      case 'ArrowRight': event.preventDefault(); nudge(step, 0); break;
      default: break;
    }
  });

  $<HTMLButtonElement>('[data-accept]').addEventListener('click', () => decide('accepted'));
  $<HTMLButtonElement>('[data-skip]').addEventListener('click', () => decide('skipped'));
  $<HTMLButtonElement>('[data-prev]').addEventListener('click', () => nextMarker(-1));
  $<HTMLButtonElement>('[data-next]').addEventListener('click', () => nextMarker(1));
  $<HTMLButtonElement>('[data-pano]').addEventListener('click', () => loadPano(panoIndex + 1));
  undoBtn.addEventListener('click', undo);
  $<HTMLButtonElement>('[data-help]').addEventListener('click', () => { helpPanel.hidden = !helpPanel.hidden; });
  $<HTMLButtonElement>('[data-start]').addEventListener('click', () => { intro.hidden = true; });
  $<HTMLButtonElement>('[data-help-from-intro]').addEventListener('click', () => { intro.hidden = true; helpPanel.hidden = false; });

  window.addEventListener('resize', resize);

  void (async () => {
    const taskName = new URLSearchParams(window.location.search).get('task');
    const taskUrl = taskName && /^[a-z0-9-]+$/.test(taskName) ? `/api/pano-anchor/task/${taskName}` : '/api/pano-anchor/task';
    const [taskResponse, anchorsResponse] = await Promise.all([
      fetch(taskUrl),
      fetch('/api/pano-anchor/anchors').catch(() => null),
    ]);
    if (!taskResponse.ok) { root.innerHTML = '<p style="padding:24px;color:#fff">No anchor task. Run: npx tsx scripts/review/build-pano-anchor-task.ts</p>'; return; }
    task = await taskResponse.json() as Task;
    for (const entry of task.panos) for (const marker of entry.markers) { marker.pixel = [...marker.predicted]; marker.status = 'pending'; }
    if (anchorsResponse?.ok) {
      const data = await anchorsResponse.json() as { anchors: SavedAnchor[] };
      for (const anchor of data.anchors ?? []) saved.set(`${anchor.panoramaId}|${anchor.markerId}`, anchor);
    }
    if (!task.panos.length) { root.innerHTML = '<p style="padding:24px;color:#fff">Task has no panos.</p>'; return; }
    undoBtn.disabled = true;
    loadPano(0);
    resize();
    if (window.localStorage?.getItem('pano-anchor-intro-seen')) intro.hidden = true;
    else $<HTMLButtonElement>('[data-start]').addEventListener('click', () => window.localStorage?.setItem('pano-anchor-intro-seen', '1'));
  })();
}

if (typeof document !== 'undefined') {
  const mount = () => {
    const root = document.getElementById('pano-anchor');
    if (root) mountPanoAnchor(root);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
}
