import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { openTopPrism, upwardRoofPlane } from "../../../scripts/landmarks/house-geometry";
const warehouse = new URLSearchParams(location.search).get("building") === "warehouse";
const BUILDING_ID = warehouse ? "0363100012118320" : "0363100012139498";
const DATA = new URL("ordinary-building-pilot-data/", document.baseURI).href;
const container = document.querySelector("#scene");
const renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor("#e5eced");
container.append(renderer.domElement);
const scene = new T.Scene();
const camera = new T.PerspectiveCamera(38, 1, 0.1, 1500);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new T.HemisphereLight(16777215, 11184032, 2.6));
const sun = new T.DirectionalLight(16777215, 2);
sun.position.set(40, 70, -50);
scene.add(sun);
const grid = new T.GridHelper(150, 15, 12042432, 13753050);
scene.add(grid);
const feature = await fetch(DATA + "NL.IMBAG.Pand." + BUILDING_ID + ".json").then((r) => r.json());
const ring = feature.geometry.coordinates[0].slice(0, -1);
const origin = warehouse ? [4.927738, 52.3757945] : [4.9263945, 52.3760035];
const points = ring.map(([lng, lat]) => new T.Vector2((lng - origin[0]) * 111320 * Math.cos(origin[1] * Math.PI / 180), -(lat - origin[1]) * 111320));
const height = Number(feature.properties.height);
const shape = new T.Shape(points);
const baseColour = new T.MeshStandardMaterial({ color: "#92877e", roughness: 1 });
const roofMaterial = new T.MeshStandardMaterial({ color: "#747b7d", roughness: 1 });
const shell = openTopPrism(shape, 0, height);
const roof = upwardRoofPlane(shape, height);
const root = new T.Group();
scene.add(root);
let current;
let mode = "atlas";
// Shared atlas coordinates keep balcony geometry aligned with the four normal
// residential floors above the source-supported double-height ground bays.
const modernRows = [280, 405, 530, 655];
function facadeAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const c = canvas.getContext("2d");
  c.fillStyle = "#a49e91";
  c.fillRect(0, 0, 2048, 1024);
  const top = 245, brickEnd = 1620;
  c.fillStyle = "#a26f55";
  c.fillRect(brickEnd, top, 428, 1024 - top);
  // Three glazed upper tiers: fine dark window frames sit within a wider pale
  // structural grid. The 2020 and 2025 views both show this hierarchy.
  c.fillStyle = "#566965";
  c.fillRect(0, 18, 2048, top - 18);
  c.fillStyle = "#849b96";
  for (const y of [24, 100, 176]) for (let x = 8; x < 2048; x += 65) {
    c.fillRect(x, y, 52, 56);
    c.fillStyle = "#384c48";
    c.fillRect(x + 24, y, 3, 56);
    c.fillRect(x, y + 17, 52, 3);
    c.fillStyle = "#849b96";
  }
  c.fillStyle = "#e4e3d8";
  for (let x = 0; x <= 2048; x += 408) c.fillRect(x, 16, 13, top - 16);
  for (const y of [16, 87, 163, 239]) c.fillRect(0, y, 2048, 12);
  c.fillStyle = "#deded3";
  c.fillRect(0, top, 2048, 14);
  for (const y of modernRows) {
    for (let bay = 0; bay < 15; bay++) {
      const x = 35 + bay * 136;
      c.fillStyle = "#3e4643";
      c.fillRect(x, y, 76, 83);
      c.fillStyle = "#74908a";
      c.fillRect(x + 7, y + 5, 29, 70);
      c.fillRect(x + 42, y + 5, 27, 70);
      c.fillStyle = "#445952";
      c.fillRect(x + 7, y + 27, 62, 4);
      if (bay < 12) {
        c.fillStyle = "#767e78";
        c.fillRect(x - 5, y + 73, 87, 13);
        c.strokeStyle = "#3e4541";
        c.lineWidth = 3;
        for (let k = 0; k < 8; k++) c.strokeRect(x - 3 + k * 11, y + 59, 1, 24);
      }
    }
  }
  // Tall entrances occupy the whole lower two-storey zone. No generic window
  // row crosses their transoms. Keep the same vertical bay rhythm as above.
  for (let bay = 0; bay < 15; bay++) {
    const x = 35 + bay * 136, y = 814;
    c.fillStyle = "#3b4742";
    c.fillRect(x, y, 76, 210);
    const screened = bay >= 12 ? bay !== 13 : bay % 4 === 1;
    c.fillStyle = screened ? "#303d35" : "#657e74";
    c.fillRect(x + 6, y + 7, 28, 80);
    c.fillRect(x + 42, y + 7, 28, 80);
    c.fillRect(x + 6, y + 96, 28, 107);
    c.fillRect(x + 42, y + 96, 28, 107);
    c.fillStyle = "#a2aca5";
    c.fillRect(x + 35, y + 4, 5, 204);
    c.fillRect(x + 4, y + 88, 68, 6);
    if (screened) {
      // Dark louvred/security screens are visible beside glazed entrances in
      // the 2025 reference, especially on the brick end's ground frontage.
      c.fillStyle = "#52604c";
      for (let sy = y + 10; sy < 1020; sy += 8) c.fillRect(x + 6, sy, 64, 2);
      c.fillStyle = "#252f29";
      for (let sx = x + 12; sx < x + 70; sx += 10) c.fillRect(sx, y + 7, 2, 196);
    }
  }
  const texture2 = new T.CanvasTexture(canvas);
  texture2.colorSpace = T.SRGBColorSpace;
  texture2.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture2;
}
// Segmental heads are part of each opening outline, rather than an arch painted
// above a rectangular pane. Rise is measured downward from the crown in atlas px.
function segmentalPath(c, x, y, w, h, rise) {
  c.beginPath();
  c.moveTo(x, y + h);
  c.lineTo(x, y + rise);
  c.quadraticCurveTo(x + w / 2, y - rise, x + w, y + rise);
  c.lineTo(x + w, y + h);
  c.closePath();
}
function archedWindow(c, x, y, w, h, rise) {
  segmentalPath(c, x, y, w, h, rise);
  c.fillStyle = "#45564f";
  c.fill();
  segmentalPath(c, x + 5, y + 5, w - 10, h - 11, rise - 2);
  c.fillStyle = "#78908a";
  c.fill();
  c.save();
  c.clip();
  c.fillStyle = "#a1a896";
  c.fillRect(x + w / 2 - 2, y, 4, h);
  c.fillRect(x, y + h * 0.36, w, 3);
  c.restore();
}
function brickArch(c, x, y, w, rise, band = 14) {
  c.beginPath();
  c.moveTo(x, y + rise);
  c.quadraticCurveTo(x + w / 2, y - rise, x + w, y + rise);
  c.strokeStyle = "#a57751";
  c.lineWidth = band;
  c.stroke();
  // Restrained radial mortar joints make the curved band read as brickwork.
  c.strokeStyle = "#8b704f";
  c.lineWidth = 1.5;
  for (let i = 1; i < 18; i++) {
    const t = i / 18, px = x + w * t, py = y + rise * (1 - 4 * t * (1 - t));
    const slope = (8 * rise * t - 4 * rise) / w;
    const nx = -slope / Math.hypot(1, slope), ny = 1 / Math.hypot(1, slope);
    c.beginPath();
    c.moveTo(px - nx * band / 2, py - ny * band / 2);
    c.lineTo(px + nx * band / 2, py + ny * band / 2);
    c.stroke();
  }
}
function warehouseAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const c = canvas.getContext("2d");
  c.fillStyle = "#8c7b62";
  c.fillRect(0, 0, 2048, 1024);
  c.fillStyle = "#815b48";
  c.fillRect(0, 0, 2048, 365);
  for (let row = 0; row < 3; row++) for (let bay = 0; bay < 20; bay++) {
    const x = 25 + bay * 102, y = 25 + row * 103;
    c.fillStyle = "#697a77";
    c.fillRect(x, y, 34, 70);
    c.strokeStyle = "#3f4743";
    c.lineWidth = 4;
    c.strokeRect(x, y, 34, 70);
  }
  c.fillStyle = "#303a36";
  c.fillRect(650, 0, 748, 365);
  c.fillStyle = "#788379";
  for (const y of [70, 175, 280]) c.fillRect(650, y, 748, 10);
  for (let x = 660; x < 1400; x += 120) c.fillRect(x, 0, 8, 365);
  c.fillStyle = "#ddd5b9";
  c.fillRect(0, 367, 2048, 27);
  c.fillStyle = "#b2ab93";
  c.fillRect(0, 397, 2048, 15);
  for (let bay = 0; bay < 16; bay++) {
    const x = bay * 128 + 22, wide = bay % 2 === 0;
    // A broad relieving arch belongs to the whole pier-to-pier bay, including
    // the paired-window bays. Small opening crowns sit distinctly below it.
    brickArch(c, bay * 128 + 3, 433, 122, 24);
    for (let row = 0; row < 2; row++) {
      const y = 466 + row * 170;
      if (wide) {
        if (row === 0) archedWindow(c, x, y, 83, 123, 12);
        else {
          c.fillStyle = "#45564f";
          c.fillRect(x, y, 83, 123);
          c.fillStyle = "#78908a";
          c.fillRect(x + 7, y + 8, 69, 100);
          c.fillStyle = "#a1a896";
          c.fillRect(x + 39, y + 6, 4, 108);
        }
        c.fillStyle = "#626f68";
        c.fillRect(x - 2, y + 101, 87, 16);
        c.strokeStyle = "#3d4d43";
        c.lineWidth = 2;
        for (let k = 0; k < 10; k++) c.strokeRect(x + k * 9, y + 86, 1, 29);
      } else {
        // The narrow pier groups contain two separately arched windows.
        for (const offset of [2, 48]) {
          brickArch(c, x + offset - 2, y - 2, 35, 8, 5);
          archedWindow(c, x + offset, y + 7, 31, 116, 7);
        }
      }
    }
    const screened = bay % 4 === 3;
    c.fillStyle = screened ? "#283b32" : "#354640";
    c.fillRect(x + 1, 826, 80, 127);
    c.fillStyle = "#91a69d";
    c.fillRect(x + 38, 833, 4, 111);
    if (screened) {
      c.fillStyle = "#516251";
      for (let gx = x + 5; gx < x + 79; gx += 7) c.fillRect(gx, 830, 2, 118);
    } else {
      c.fillStyle = "#617c70";
      c.fillRect(x + 7, 833, 27, 109);
      c.fillRect(x + 47, 833, 27, 109);
    }
  }
  c.fillStyle = "#b4ae98";
  c.fillRect(0, 954, 2048, 14);
  c.fillStyle = "#59675f";
  for (let x = 50; x < 2048; x += 256) c.fillRect(x, 970, 95, 54);
  const texture2 = new T.CanvasTexture(canvas);
  texture2.colorSpace = T.SRGBColorSpace;
  texture2.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture2;
}
const texture = warehouse ? warehouseAtlas() : facadeAtlas();
const faceMaterial = new T.MeshStandardMaterial({ map: texture, roughness: 1 });
function wallFaces(low = 0, high = height, selectedEdges = warehouse ? [5, 6] : [0, 11]) {
  const p = [], uv = [];
  for (const edge of selectedEdges) {
    const a = points[edge], b = points[(edge + 1) % points.length];
    const u0 = warehouse ? edge === 5 ? 1 : 0.5 : edge === 0 ? 1 : 0.79, u1 = warehouse ? edge === 5 ? 0.5 : 0 : edge === 0 ? 0 : 1;
    const vertices = [[a.x, low, a.y], [b.x, low, b.y], [b.x, high, b.y], [a.x, high, a.y]], coords = [[u0, low / height], [u1, low / height], [u1, high / height], [u0, high / height]];
    for (const i of [0, 1, 2, 0, 2, 3]) {
      p.push(...vertices[i]);
      uv.push(...coords[i]);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const m = faceMaterial.clone();
  m.side = T.DoubleSide;
  m.polygonOffset = true;
  m.polygonOffsetFactor = -1;
  m.polygonOffsetUnits = -1;
  const mesh = new T.Mesh(g, m);
  mesh.renderOrder = 1;
  return mesh;
}
function balconies() {
  const group = new T.Group(), a = points[0], b = points[1], delta = b.clone().sub(a), tangent = delta.clone().normalize(), outward = new T.Vector2(-tangent.y, tangent.x);
  const slabs = new T.InstancedMesh(new T.BoxGeometry(2.8, 0.2, 1.1), new T.MeshStandardMaterial({ color: "#777d78", roughness: 1 }), 48);
  const railCanvas = document.createElement("canvas");
  railCanvas.width = 128;
  railCanvas.height = 64;
  const ink = railCanvas.getContext("2d");
  ink.fillStyle = "#404943";
  ink.fillRect(0, 0, 128, 4);
  ink.fillRect(0, 59, 128, 3);
  for (let x = 0; x < 128; x += 16) ink.fillRect(x, 0, 3, 64);
  const railTexture = new T.CanvasTexture(railCanvas);
  railTexture.colorSpace = T.SRGBColorSpace;
  const rails = new T.InstancedMesh(new T.PlaneGeometry(2.8, 0.9), new T.MeshStandardMaterial({ map: railTexture, alphaTest: 0.5, side: T.DoubleSide, roughness: 1 }), 48);
  const dummy = new T.Object3D();
  let count = 0;
  for (const rowY of modernRows) for (let bay = 3; bay < 15; bay++) {
    const t = (bay + 0.5) / 15, c = a.clone().addScaledVector(delta, t), y = height * (1 - (rowY + 83) / 1024), yaw = -Math.atan2(tangent.y, tangent.x);
    dummy.position.set(c.x + outward.x * 0.54, y, c.y + outward.y * 0.54);
    dummy.rotation.set(0, yaw, 0);
    dummy.updateMatrix();
    slabs.setMatrixAt(count, dummy.matrix);
    dummy.position.set(c.x + outward.x * 1.05, y + 0.45, c.y + outward.y * 1.05);
    dummy.updateMatrix();
    rails.setMatrixAt(count++, dummy.matrix);
  }
  group.add(slabs, rails);
  return group;
}
function warehouseUpper() {
  const group = new T.Group();
  const low = height * 0.62;
  const a = points[5], b = points[7], d = b.clone().sub(a), tangent = d.clone().normalize();
  const total = d.length(), normal = new T.Vector2(-tangent.y, tangent.x);
  function clip(poly, limit, greater) {
    const output = [];
    for (let i = 0; i < poly.length; i++) {
      const x = poly[i], y = poly[(i + 1) % poly.length], dx = x.clone().sub(a).dot(tangent) - limit, dy = y.clone().sub(a).dot(tangent) - limit;
      const inX = greater ? dx >= 0 : dx <= 0, inY = greater ? dy >= 0 : dy <= 0;
      if (inX) output.push(x.clone());
      if (inX !== inY) output.push(x.clone().lerp(y, dx / (dx - dy)));
    }
    return output;
  }
  const wings = [clip(points, total * 0.32, false), clip(points, total * 0.68, true)];
  for (const polygon of wings) {
    const part = new T.Shape(polygon);
    group.add(new T.Mesh(openTopPrism(part, low, height), baseColour), new T.Mesh(upwardRoofPlane(part, height), roofMaterial));
    const p = [], uv = [];
    for (let i = 0; i < polygon.length; i++) {
      const v = polygon[i], w = polygon[(i + 1) % polygon.length];
      if (Math.abs(v.clone().sub(a).dot(normal)) > 0.1 || Math.abs(w.clone().sub(a).dot(normal)) > 0.1) continue;
      const u0 = 1 - v.clone().sub(a).dot(tangent) / total, u1 = 1 - w.clone().sub(a).dot(tangent) / total;
      const verts = [[v.x, low, v.y], [w.x, low, w.y], [w.x, height, w.y], [v.x, height, v.y]], coords = [[u0, 0.62], [u1, 0.62], [u1, 1], [u0, 1]];
      for (const j of [0, 1, 2, 0, 2, 3]) {
        p.push(...verts[j]);
        uv.push(...coords[j]);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const material2 = faceMaterial.clone();
    material2.side = T.DoubleSide;
    material2.polygonOffset = true;
    material2.polygonOffsetFactor = -1;
    material2.polygonOffsetUnits = -1;
    group.add(new T.Mesh(g, material2));
  }
  const material = new T.MeshStandardMaterial({ color: "#536158", roughness: 1 });
  const dummy = new T.Object3D(), platforms = new T.InstancedMesh(new T.BoxGeometry(total * 0.36, 0.25, 2), material, 4), columns = new T.InstancedMesh(new T.BoxGeometry(0.18, height - low, 0.18), material, 6);
  const mid = a.clone().addScaledVector(d, 0.5).addScaledVector(normal, -0.9);
  for (let i = 0; i < 4; i++) {
    dummy.position.set(mid.x, low + i * (height - low) / 3, mid.y);
    dummy.rotation.y = -Math.atan2(tangent.y, tangent.x);
    dummy.updateMatrix();
    platforms.setMatrixAt(i, dummy.matrix);
  }
  for (let i = 0; i < 6; i++) {
    const p = a.clone().addScaledVector(d, 0.32 + i / 5 * 0.36).addScaledVector(normal, -0.1);
    dummy.position.set(p.x, (low + height) / 2, p.y);
    dummy.updateMatrix();
    columns.setMatrixAt(i, dummy.matrix);
  }
  group.add(platforms, columns);
  return group;
}
function setMode(value) {
  mode = value;
  if (current) {
    root.remove(current);
    current.traverse((o) => {
      if (o instanceof T.Mesh && o.geometry !== shell && o.geometry !== roof) o.geometry.dispose();
    });
  }
  current = new T.Group();
  if (warehouse && mode === "relief") {
    current.add(new T.Mesh(openTopPrism(shape, 0, height * 0.62), baseColour), new T.Mesh(upwardRoofPlane(shape, height * 0.62), roofMaterial), wallFaces(0, height * 0.62), warehouseUpper());
  } else {
    current.add(new T.Mesh(shell, baseColour), new T.Mesh(roof, roofMaterial));
    if (mode !== "bare") current.add(wallFaces());
    if (mode === "relief") current.add(balconies());
  }
  root.add(current);
  document.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
}
function view(wide = false) {
  const d = wide ? 1.75 : 1;
  camera.position.set(90 * d, 65 * d, -112 * d);
  controls.target.set(0, height / 2, 0);
  controls.update();
}
document.querySelectorAll("[data-mode]").forEach((b) => b.onclick = () => setMode(b.dataset.mode));
document.querySelector("#wide").onclick = () => view(true);
document.querySelector("#near").onclick = () => view();
document.querySelector("#export").onclick = async () => {
  const result = await new GLTFExporter().parseAsync(current, { binary: true });
  const a = document.createElement("a");
  const url = URL.createObjectURL(new Blob([result], { type: "model/gltf-binary" }));
  a.href = url;
  a.download = "ordinary-" + BUILDING_ID + "-" + mode + ".glb";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
};
function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(container);
document.querySelectorAll(".references img").forEach((img, i) => img.src = DATA + `reference-${BUILDING_ID}-${i === 0 ? "2025" : "2020"}.jpg`);
const views = await fetch(DATA + 'references.json').then(r => r.json());
const sourceView = views.find(v => v.id === BUILDING_ID && v.year === '2025');
if (sourceView) {
  const [lng, lat] = sourceView.panorama.geometry.coordinates;
  const url = new URL('https://data.amsterdam.nl/data/geozoek');
  for (const [key, value] of Object.entries({ locatie: `${lat},${lng}`, heading: sourceView.projection.heading, pitch: -23, fov: 73.739795, lagen: 'pano-pano2025bi', zoom: 16 })) url.searchParams.set(key, String(value));
  document.querySelector('.references a').href = url.href;
}
document.querySelector("#identity").textContent = `Native footprint: BAG ${BUILDING_ID} \xB7 published height ${height} m.`;
if (warehouse) {
  document.querySelector("#feature-caption").textContent = "Historic warehouse trial: alternating wide/narrow window groups, brick arches, pale cornice and an open newer upper gallery.";
  document.querySelector("#limitations").textContent = "Draft only. The texture trial preserves the full mapped shell, so its painted upper gallery remains opaque. The geometry trial splits the upper level into two wings and an open gallery: heights, wing widths and gallery depth are source-informed estimates, not surveyed assemblies. Rear appearance remains unresolved. Neither draft is an accepted game replacement.";
}
setMode(new URLSearchParams(location.search).get("mode") ?? "atlas");
view(new URLSearchParams(location.search).get("wide") === "1");
resize();
let frames = 0, last = performance.now();
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  if (++frames % 30 === 0) {
    const now = performance.now();
    const fps = Math.round(3e4 / (now - last));
    last = now;
    document.querySelector("#stats").textContent = `${mode} \xB7 ${renderer.info.render.calls} draw calls \xB7 ${renderer.info.render.triangles.toLocaleString()} triangles \xB7 ${fps} fps in this viewer`;
  }
});
