"use strict";
(() => {
  // src/canalRecall/roofSink.ts
  var sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  var cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  var dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  var RoofSink = class {
    constructor(rect, h0, dims) {
      this.rect = rect;
      this.h0 = h0;
      this.dims = dims;
    }
    out = [];
    world(p) {
      const { cx, cy, ux, uy } = this.rect;
      return [cx + p[0] * ux - p[1] * uy, cy + p[0] * uy + p[1] * ux, this.h0 + p[2]];
    }
    dir(p) {
      const { ux, uy } = this.rect;
      return [p[0] * ux - p[1] * uy, p[0] * uy + p[1] * ux, p[2]];
    }
    /** One triangle from local points, wound so its normal agrees with `hint` (local). Degenerate ones are dropped. */
    tri(a, b, c, ua, ub, uc, part, hint, hex2) {
      let n = cross(sub(b, a), sub(c, a));
      const l = Math.hypot(n[0], n[1], n[2]);
      if (l < 1e-7) return;
      let B = b, C = c, UB = ub, UC = uc;
      if (dot(n, hint) < 0) {
        B = c;
        C = b;
        UB = uc;
        UC = ub;
        n = [-n[0], -n[1], -n[2]];
      }
      const w = this.dir([n[0] / l, n[1] / l, n[2] / l]);
      const t = { p: [this.world(a), this.world(B), this.world(C)], uv: [ua, UB, UC], part, n: w };
      if (hex2) t.hex = hex2;
      this.out.push(t);
    }
    quad(a, b, c, d, ua, ub, uc, ud, part, hint, hex2) {
      this.tri(a, b, c, ua, ub, uc, part, hint, hex2);
      this.tri(a, c, d, ua, uc, ud, part, hint, hex2);
    }
    /** Texture coordinates for a roof face: courses run level, one cell per `cellM` up the slope. */
    slopeUv(p, n) {
      const h = Math.hypot(n[0], n[1]), cell = this.dims.cellM;
      if (h < 0.05) return [p[0] / cell, p[1] / cell];
      const ax = -n[1] / h, ay = n[0] / h;
      return [(p[0] * ax + p[1] * ay) / cell, p[2] / h / cell];
    }
    /** A roof face triangle (tiles, slates) with automatic coordinates. */
    slopeTri(a, b, c, hint, part = "slope", hex2) {
      let n = cross(sub(b, a), sub(c, a));
      if (dot(n, hint) < 0) n = [-n[0], -n[1], -n[2]];
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      n = [n[0] / l, n[1] / l, n[2] / l];
      this.tri(a, b, c, this.slopeUv(a, n), this.slopeUv(b, n), this.slopeUv(c, n), part, hint, hex2);
    }
    /** A convex planar polygon as a fan of slope triangles. */
    slopePoly(pts, hint, part = "slope", hex2) {
      for (let i = 1; i < pts.length - 1; i++) this.slopeTri(pts[0], pts[i], pts[i + 1], hint, part, hex2);
    }
    /** A wall-coloured face (plain layer): coordinates in bays along `along` and storeys up. */
    wallUv(along, z) {
      return [along / this.dims.bayM, z / this.dims.storeyM];
    }
    /** A flat-colour polygon fan (trim, decal): no texture. */
    flatPoly(pts, part, hint, hex2) {
      for (let i = 1; i < pts.length - 1; i++) this.tri(pts[0], pts[i], pts[i + 1], [0, 0], [0, 0], [0, 0], part, hint, hex2);
    }
    /** An axis-aligned box in local coordinates, all six faces unless `open` names some (e.g. 'bottom'). */
    box(u0, u1, v0, v1, z0, z1, part, hex2, open = []) {
      const P = (u, v, z) => [u, v, z];
      const f = (name, a, b, c, d, hint) => {
        if (!open.includes(name)) this.quad(a, b, c, d, [0, 0], [1, 0], [1, 1], [0, 1], part, hint, hex2);
      };
      f("bottom", P(u0, v0, z0), P(u1, v0, z0), P(u1, v1, z0), P(u0, v1, z0), [0, 0, -1]);
      f("top", P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1), [0, 0, 1]);
      f("u0", P(u0, v0, z0), P(u0, v1, z0), P(u0, v1, z1), P(u0, v0, z1), [-1, 0, 0]);
      f("u1", P(u1, v0, z0), P(u1, v1, z0), P(u1, v1, z1), P(u1, v0, z1), [1, 0, 0]);
      f("v0", P(u0, v0, z0), P(u1, v0, z0), P(u1, v0, z1), P(u0, v0, z1), [0, -1, 0]);
      f("v1", P(u0, v1, z0), P(u1, v1, z0), P(u1, v1, z1), P(u0, v1, z1), [0, 1, 0]);
    }
  };

  // src/canalRecall/gableTrim.ts
  var PROUD = 0.012;
  var PROUD_HI = 0.022;
  function profileSpan(prof, y) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < prof.length - 1; i++) {
      const [x0, y0] = prof[i], [x1, y1] = prof[i + 1];
      if (y0 <= y && y1 >= y || y1 <= y && y0 >= y) {
        if (Math.abs(y1 - y0) < 1e-9) {
          lo = Math.min(lo, x0, x1);
          hi = Math.max(hi, x0, x1);
          continue;
        }
        const x = x0 + (y - y0) / (y1 - y0) * (x1 - x0);
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
    }
    return hi > lo ? [lo, hi] : null;
  }
  function rectDecal(s, f, e, v0, v1, z0, z1, hex2, proud = PROUD) {
    const u = f + e * proud;
    s.quad([u, v0, z0], [u, v1, z0], [u, v1, z1], [u, v0, z1], [0, 0], [0, 0], [0, 0], [0, 0], "decal", [e, 0, 0], hex2);
  }
  function outlineBand(s, prof, f, e, bw, hex2, from = 0, to = Infinity) {
    const u = f + e * PROUD;
    for (let i = 0; i < prof.length - 1; i++) {
      const [x0, y0] = prof[i], [x1, y1] = prof[i + 1];
      if (Math.max(y0, y1) < from || Math.min(y0, y1) > to) continue;
      if (y0 < 0.02 && y1 < 0.02) continue;
      const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
      if (l < 1e-4) continue;
      const nx = dy / l, ny = -dx / l;
      const a = [u, x0, y0], b = [u, x1, y1], c = [u, x1 + nx * bw, Math.max(0, y1 + ny * bw)], d = [u, x0 + nx * bw, Math.max(0, y0 + ny * bw)];
      s.quad(a, b, c, d, [0, 0], [0, 0], [0, 0], [0, 0], "decal", [e, 0, 0], hex2);
    }
  }
  function fanDecal(s, f, e, centre, rim, hex2, proud = PROUD_HI) {
    const u = f + e * proud;
    for (let i = 0; i < rim.length - 1; i++) s.tri([u, centre[0], centre[1]], [u, rim[i][0], rim[i][1]], [u, rim[i + 1][0], rim[i + 1][1]], [0, 0], [0, 0], [0, 0], "decal", [e, 0, 0], hex2);
  }
  function gableAccents(s, g) {
    const { shape, prof, f, e, W, trimHex } = g, half = W / 2;
    const top = Math.max(...prof.map((p) => p[1]));
    if (shape === "plain") {
      outlineBand(s, prof, f, e, 0.2, trimHex);
      return;
    }
    if (shape === "cornice") {
      corniceFront(s, g, top);
      return;
    }
    if (shape === "step") {
      for (let i = 0; i < prof.length - 1; i++) {
        const [x0, y0] = prof[i], [x1, y1] = prof[i + 1];
        if (Math.abs(x1 - x0) > 1e-4 || Math.abs(y1 - y0) < 0.3) continue;
        const hi = Math.max(y0, y1), lo = Math.min(y0, y1), inward = x0 < 0 ? 1 : -1;
        for (let k = 0, z = hi - 0.02; z - 0.24 > lo + 0.02 && k < 2; k++, z -= 0.27) {
          const w = k % 2 === 0 ? 0.36 : 0.22;
          rectDecal(s, f, e, inward > 0 ? x0 : x0 - w, inward > 0 ? x0 + w : x0, z - 0.24, z, trimHex);
        }
      }
      speklagen(s, prof, f, e, top, trimHex, [0.3, 0.62]);
      return;
    }
    if (shape === "raisedNeck" || shape === "clock" || shape === "neck" || shape === "bell") outlineBand(s, prof, f, e, shape === "clock" ? 0.22 : 0.16, trimHex);
    if (shape === "neck") speklagen(s, prof, f, e, top, trimHex, [0.45]);
    if (shape === "raisedNeck") {
      for (const side of [-1, 1]) {
        const arc = g.claws?.[side < 0 ? 0 : 1];
        if (!arc || arc.length < 2) continue;
        const cx = side * Math.min(...arc.map((p) => Math.abs(p[0]))), cy = Math.min(...arc.map((p) => p[1]));
        fanDecal(s, f, e, [cx, cy], arc, trimHex);
      }
      crown(s, prof, f, e, top, trimHex, g.crownBase ?? top - 0.6);
      speklagen(s, prof, f, e, top, trimHex, [0.62]);
    }
    if (shape === "clock") crown(s, prof, f, e, top, trimHex, g.crownBase ?? top - 0.6);
    if (shape === "bell") {
      const span = profileSpan(prof, top - 0.5);
      if (span) rectDecal(s, f, e, span[0] + 0.05, span[1] - 0.05, top - 0.5, top - 0.34, trimHex);
    }
    if (shape === "spout" && g.shutters) spoutShutters(s, prof, f, e, half, top, trimHex, g.shutterHex);
  }
  function crown(s, prof, f, e, top, hex2, base) {
    const rim = prof.filter((p) => p[1] >= base - 1e-6);
    if (rim.length < 3 || top - base < 0.15) return;
    fanDecal(s, f, e, [(rim[0][0] + rim[rim.length - 1][0]) / 2, base], rim, hex2);
  }
  function speklagen(s, prof, f, e, top, hex2, at) {
    for (const t of at) {
      const y = top * t, a = profileSpan(prof, y), b = profileSpan(prof, y + 0.15);
      if (!a || !b) continue;
      const v0 = Math.max(a[0], b[0]) + 0.02, v1 = Math.min(a[1], b[1]) - 0.02;
      if (v1 - v0 > 0.5) rectDecal(s, f, e, v0, v1, y, y + 0.15, hex2);
    }
  }
  function spoutShutters(s, prof, f, e, half, top, trimHex, shutterHex) {
    const y0 = 0.3, h = Math.min(1.5, top * 0.45), span = profileSpan(prof, y0 + h + 0.1);
    if (!span) return;
    const w = Math.min(1, half * 0.4, span[1] - span[0] - 0.35);
    if (w < 0.5 || h < 0.8) return;
    rectDecal(s, f, e, -w / 2 - 0.08, w / 2 + 0.08, y0 - 0.08, y0 + h + 0.08, trimHex);
    rectDecal(s, f, e, -w / 2, -0.025, y0, y0 + h, shutterHex, PROUD_HI);
    rectDecal(s, f, e, 0.025, w / 2, y0, y0 + h, shutterHex, PROUD_HI);
  }
  function corniceFront(s, g, top) {
    const { f, e, W, trimHex } = g, depth = 0.42, h = 0.48, over = 0.08;
    const u0 = Math.min(f, f + e * depth), u1 = Math.max(f, f + e * depth);
    s.box(u0, u1, -W / 2 - over, W / 2 + over, top - h, top + 0.05, "trim", trimHex);
    rectDecal(s, f, e, -W / 2, W / 2, top - h - 0.34, top - h - 0.06, trimHex);
    for (const side of [-1, 1]) rectDecal(s, f, e, side < 0 ? -W / 2 : W / 2 - 0.3, side < 0 ? -W / 2 + 0.3 : W / 2, -1.6, top - h - 0.06, trimHex);
  }
  function vergeBoards(s, f, e, edges, hex2, bw = 0.22) {
    for (const [a, b] of edges) outlineBand(s, [a, b], f, e, bw, hex2);
  }

  // src/canalRecall/roofMesh.ts
  var TRIM_WHITE = "#efebe2";
  function hash01(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= h >>> 15;
    h = Math.imul(h, 2246822519);
    h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }
  function fitRect(points, maxVertices = 14) {
    const pts = points.length > 1 && points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1] ? points.slice(0, -1) : points;
    if (pts.length < 4 || pts.length > maxVertices) return null;
    let area2 = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) area2 += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    const polyArea = Math.abs(area2) / 2;
    let best = null;
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
      if (l < 0.5) continue;
      const ux2 = dx / l, uy2 = dy / l;
      let minU2 = Infinity, maxU2 = -Infinity, minV2 = Infinity, maxV2 = -Infinity;
      for (const [x, y] of pts) {
        const u = x * ux2 + y * uy2, v = -x * uy2 + y * ux2;
        if (u < minU2) minU2 = u;
        if (u > maxU2) maxU2 = u;
        if (v < minV2) minV2 = v;
        if (v > maxV2) maxV2 = v;
      }
      const area = (maxU2 - minU2) * (maxV2 - minV2);
      if (!best || area < best.area) best = { area, ux: ux2, uy: uy2, minU: minU2, maxU: maxU2, minV: minV2, maxV: maxV2 };
    }
    if (!best || best.area <= 0) return null;
    let { ux, uy, minU, maxU, minV, maxV } = best;
    let len = maxU - minU, wid = maxV - minV;
    let cu = (minU + maxU) / 2, cv = (minV + maxV) / 2;
    if (wid > len) {
      [ux, uy] = [-uy, ux];
      [len, wid] = [wid, len];
      [cu, cv] = [cv, -cu];
    }
    const U = [ux, uy], V = [-uy, ux];
    let maxDev = 0;
    for (const [x, y] of pts) {
      const du = x * U[0] + y * U[1] - cu, dv = x * V[0] + y * V[1] - cv;
      maxDev = Math.max(maxDev, Math.min(len / 2 - Math.abs(du), wid / 2 - Math.abs(dv)) < 0 ? 0 : Math.min(len / 2 - Math.abs(du), wid / 2 - Math.abs(dv)));
    }
    return { cx: cu * ux - cv * uy, cy: cu * uy + cv * ux, ux, uy, len, wid, coverage: polyArea / (len * wid), maxDev };
  }
  var corniceHeight = (roofRiseM) => roofRiseM * 0.5 + 0.3;
  function raisedNeckDims(widthM, R) {
    const half = widthM / 2, neck = half * 0.4, s0 = Math.max(0.9, R * 0.6 + 0.2), topN = R * 1.45 + 0.9, top = topN + neck * 0.6;
    let rc = Math.min(half - neck - 0.12, (topN - s0) * 0.45);
    if (rc < 0.3) rc = 0;
    const arc = [];
    for (let i = 0; i <= 3 && rc > 0; i++) {
      const t = i / 3 * Math.PI / 2;
      arc.push([-neck - rc * Math.cos(t), s0 + rc * Math.sin(t)]);
    }
    return { half, neck, s0, topN, top, rc, arc };
  }
  function clawArcs(widthM, roofRiseM) {
    const { arc } = raisedNeckDims(widthM, roofRiseM);
    return arc.length ? [arc, arc.map(([x, y]) => [-x, y]).reverse()] : [];
  }
  function crownBaseOf(shape, widthM, R) {
    if (shape === "raisedNeck") return raisedNeckDims(widthM, R).topN;
    if (shape === "clock") return clockDims(widthM, R).nt;
    return void 0;
  }
  function clockDims(widthM, R) {
    const half = widthM / 2, neck = half * 0.46, slopeAtNeck = R * (1 - 0.46);
    const sh = Math.max(slopeAtNeck + 0.3, R * 0.75), nt = Math.max(sh + 0.5, R * 1.35 + 0.7);
    return { neck, sh, nt, top: nt + neck * 0.6 };
  }
  function gableProfile(shape, widthM, roofRiseM) {
    const half = widthM / 2, pts = [];
    const slope = (x) => roofRiseM * (1 - Math.abs(x) / half);
    const add = (x, y) => pts.push([x, Math.max(y, slope(x) + 0.04)]);
    const mirror = (left) => {
      const right = left.slice(0, -1).reverse().map(([x, y]) => [-x, y]);
      const all = [...left, ...right];
      all[0] = [all[0][0], 0];
      all[all.length - 1] = [all[all.length - 1][0], 0];
      return dedupe(all);
    };
    const N = 10;
    if (shape === "plain") {
      add(-half, 0);
      add(0, roofRiseM);
      add(half, 0);
      pts[0][1] = 0;
      pts[2][1] = 0;
      return pts;
    }
    if (shape === "cornice") {
      const hc = corniceHeight(roofRiseM);
      return [[-half, 0], [-half, hc], [half, hc], [half, 0]];
    }
    if (shape === "step") {
      const top2 = roofRiseM * 1.18 + 0.55, steps = 3, w = half / (steps + 0.6);
      const left = [[-half, 0]];
      let prev = 0;
      for (let j = 0; j <= steps; j++) {
        const x0 = -half + j * w, x1 = j === steps ? 0 : -half + (j + 1) * w;
        const h = Math.max(top2 * (j + 1) / (steps + 1), slope(x1) + 0.12);
        if (h > prev) {
          left.push([x0, h]);
          prev = h;
        } else left.push([x0, prev]);
        left.push([x1, prev]);
      }
      const right = left.slice(0, -1).reverse().map(([x, y]) => [-x, y]);
      return dedupe([...left, ...right].map(([x, y], i, all) => [x, i === 0 || i === all.length - 1 ? 0 : y]));
    }
    if (shape === "neck") {
      const top2 = roofRiseM * 1.45 + 0.7, neck = half * 0.42, shoulder = roofRiseM * 0.62;
      add(-half, 0);
      for (let i = 1; i <= 4; i++) {
        const t = i / 4, x = -half + (half - neck) * t;
        add(x, 0.15 + (shoulder - 0.15) * Math.pow(t, 1.7));
      }
      add(-neck, top2);
      add(neck, top2);
      for (let i = 4; i >= 1; i--) {
        const t = i / 4, x = half - (half - neck) * t;
        add(x, 0.15 + (shoulder - 0.15) * Math.pow(t, 1.7));
      }
      add(half, 0);
      pts[0][1] = 0;
      pts[pts.length - 1][1] = 0;
      return dedupe(pts);
    }
    if (shape === "raisedNeck") {
      const d = raisedNeckDims(widthM, roofRiseM);
      add(-half, 0);
      add(-half, d.s0);
      if (d.arc.length) {
        if (d.arc[0][0] > -half + 0.01) add(d.arc[0][0], d.s0);
        for (const [x, y] of d.arc) add(x, y);
      } else add(-d.neck, d.s0);
      add(-d.neck, d.topN);
      add(0, d.top);
      return mirror(pts);
    }
    if (shape === "clock") {
      const { neck, sh, nt, top: top2 } = clockDims(widthM, roofRiseM);
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        add(-half + (half - neck) * t, sh * (3 * t * t - 2 * t * t * t));
      }
      for (let i = 0; i <= 3; i++) {
        const a = Math.PI - i / 3 * (Math.PI / 2);
        add(neck * Math.cos(a), nt + (top2 - nt) * Math.sin(a));
      }
      return mirror(pts);
    }
    const bell = shape === "bell", top = roofRiseM * (bell ? 1.3 : 1.55) + (bell ? 0.6 : 0.9);
    for (let i = 0; i <= N; i++) {
      const x = -half + widthM * i / N, t = Math.abs(x) / half;
      let f;
      if (bell) f = t < 0.18 ? 1 : 0.12 + 0.88 * (0.5 + 0.5 * Math.cos(Math.PI * Math.pow((t - 0.18) / 0.82, 0.85)));
      else {
        const tt = t < 0.26 ? 0 : (t - 0.26) / 0.74;
        f = t < 0.26 ? 1 : 0.1 + 0.9 * (1 - Math.pow(tt, 0.6));
      }
      add(x, top * f);
    }
    pts[0][1] = 0;
    pts[pts.length - 1][1] = 0;
    return dedupe(pts);
  }
  var dedupe = (pts) => pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
  function gableSlab(s, prof, e, L, topPart, topHex, t = 0.32) {
    const f = e * L / 2, b = e * (L / 2 - t), st = s.dims.storeyM;
    for (let i = 0; i < prof.length - 1; i++) {
      const [x0, y0] = prof[i], [x1, y1] = prof[i + 1];
      if (Math.abs(x1 - x0) > 1e-4) {
        s.quad([f, x0, 0], [f, x1, 0], [f, x1, y1], [f, x0, y0], s.wallUv(x0, 0), s.wallUv(x1, 0), s.wallUv(x1, y1), s.wallUv(x0, y0), "plate", [e, 0, 0]);
        s.quad([b, x0, 0], [b, x1, 0], [b, x1, y1], [b, x0, y0], s.wallUv(x0, 0), s.wallUv(x1, 0), s.wallUv(x1, y1), s.wallUv(x0, y0), "plate", [-e, 0, 0]);
        s.quad([f, x0, y0], [f, x1, y1], [b, x1, y1], [b, x0, y0], [0, 0], [1, 0], [1, 1], [0, 1], topPart, [0, 0, 1], topPart === "trim" ? topHex : void 0);
      } else {
        const hi = Math.max(y0, y1), lo = Math.min(y0, y1), faceV = y1 > y0 ? -1 : 1;
        s.quad([f, x0, lo], [b, x0, lo], [b, x0, hi], [f, x0, hi], [0, lo / st], [0.1, lo / st], [0.1, hi / st], [0, hi / st], "plate", [0, faceV, 0]);
      }
    }
  }
  function dormer(s, d, plan) {
    const P = (a, b, z) => d.axis === "v" ? [b, d.side * a, z] : [d.side * a, b, z];
    const n = d.axis === "v" ? [0, d.side, 0] : [d.side, 0, 0];
    const tan = (sg) => d.axis === "v" ? [sg, 0, 0] : [0, sg, 0];
    const zf = d.surf(d.pf), zb = zf - 0.15, ph = d.band ? 0 : Math.min(0.5, d.dw * 0.4);
    let hd = d.hd, pb = -1;
    for (; hd >= 0.75; hd -= 0.1) {
      const need = zb + hd + ph + 0.06;
      for (let a = d.pf - 0.2; a >= 0; a -= 0.05) if (d.surf(a) >= need) {
        pb = a;
        break;
      }
      if (pb >= 0) break;
    }
    if (pb < 0) return false;
    const zt = zb + hd, b0 = d.c - d.dw / 2, b1 = d.c + d.dw / 2, accents = !!plan.accents, trim = plan.trimHex ?? TRIM_WHITE;
    const rep = d.band ? Math.max(1, Math.round(d.dw / 1.5)) : 1;
    s.quad(P(d.pf, b0, zb), P(d.pf, b1, zb), P(d.pf, b1, zt), P(d.pf, b0, zt), [0, 0], [rep, 0], [rep, 1], [0, 1], "dormerFace", n);
    for (const [b, sg] of [[b0, -1], [b1, 1]]) s.quad(P(d.pf, b, zb), P(pb, b, zb), P(pb, b, zt), P(d.pf, b, zt), [0, 0], [1, 0], [1, 1], [0, 1], accents ? "trim" : "dormerSide", tan(sg), accents ? trim : void 0);
    if (d.band) {
      s.quad(P(d.pf, b0, zt), P(d.pf, b1, zt), P(pb, b1, zt), P(pb, b0, zt), [0, 0], [1, 0], [1, 1], [0, 1], "dormerSide", [0, 0, 1]);
      if (accents) s.quad(P(d.pf + 0.012, b0, zt - 0.14), P(d.pf + 0.012, b1, zt - 0.14), P(d.pf + 0.012, b1, zt), P(d.pf + 0.012, b0, zt), [0, 0], [0, 0], [0, 0], [0, 0], "decal", n, trim);
    } else {
      s.tri(P(d.pf, b0, zt), P(d.pf, b1, zt), P(d.pf, d.c, zt + ph), [0, 0], [0, 0], [0, 0], accents ? "trim" : "plate", n, accents ? trim : void 0);
      for (const sg of [-1, 1]) {
        const b = sg < 0 ? b0 : b1;
        s.slopeTri(P(d.pf, b, zt), P(pb, b, zt), P(pb, d.c, zt + ph), [...tan(sg).slice(0, 2), 0.8], "dormerSide");
        s.slopeTri(P(d.pf, b, zt), P(pb, d.c, zt + ph), P(d.pf, d.c, zt + ph), [...tan(sg).slice(0, 2), 0.8], "dormerSide");
      }
    }
    return true;
  }
  function chimney(s, plan, L, W, R, surf) {
    if (plan.chimney === false || hash01(`${plan.seed}:chim`) >= 0.62) return;
    const side = hash01(`${plan.seed}:chimside`) < 0.5 ? -1 : 1, cu = side * (L / 2 - 1.2), cv = (hash01(`${plan.seed}:chimv`) - 0.5) * W * 0.25;
    const cw = 0.42, top = R + 1.15 + hash01(`${plan.seed}:chimh`) * 0.5;
    const c = [[cu - cw, cv - cw], [cu + cw, cv - cw], [cu + cw, cv + cw], [cu - cw, cv + cw]];
    const base = Math.max(-0.3, Math.min(...c.map(([u, v]) => surf(u, v))) - 0.4), st = s.dims.storeyM;
    for (let i = 0; i < 4; i++) {
      const [a, b] = [c[i], c[(i + 1) % 4]];
      s.quad([a[0], a[1], base], [b[0], b[1], base], [b[0], b[1], top], [a[0], a[1], top], [0, 0], [0.5, 0], [0.5, 1.2 / st * 2], [0, 1.2 / st * 2], "plate", [(a[0] + b[0]) / 2 - cu, (a[1] + b[1]) / 2 - cv, 0]);
    }
    s.quad([c[0][0], c[0][1], top], [c[1][0], c[1][1], top], [c[2][0], c[2][1], top], [c[3][0], c[3][1], top], [0, 0], [1, 0], [1, 1], [0, 1], "slope", [0, 0, 1]);
  }
  function fascia(s, a, b, out, hex2, h = 0.16) {
    s.quad(a, b, [b[0], b[1], b[2] - h], [a[0], a[1], a[2] - h], [0, 0], [0, 0], [0, 0], [0, 0], "decal", out, hex2);
  }
  function buildMansard(s, plan, L, W, R) {
    const k = Math.min(1, W * 0.16), h1 = R * 0.88, trim = plan.trimHex ?? TRIM_WHITE;
    const prof = [[-W / 2, 0], [-W / 2 + k, h1], [0, R], [W / 2 - k, h1], [W / 2, 0]];
    for (let i = 0; i < prof.length - 1; i++) {
      const [v0, z0] = prof[i], [v1, z1] = prof[i + 1];
      s.slopePoly([[-L / 2, v0, z0], [L / 2, v0, z0], [L / 2, v1, z1], [-L / 2, v1, z1]], [0, (v0 + v1) / 2, (z0 + z1) / 2 - R * 0.4]);
    }
    for (const e of [-1, 1]) for (let i = 0; i < prof.length; i++) {
      const a = prof[i], b = prof[(i + 1) % prof.length];
      s.tri([e * L / 2, a[0], a[1]], [e * L / 2, b[0], b[1]], [e * L / 2, 0, R * 0.4], s.wallUv(a[0], a[1]), s.wallUv(b[0], b[1]), s.wallUv(0, R * 0.4), "plate", [e, 0, 0]);
    }
    for (const sg of [-1, 1]) {
      s.quad([-L / 2, sg * W / 2, 0], [L / 2, sg * W / 2, 0], [L / 2, sg * (W / 2 + 0.28), -0.1], [-L / 2, sg * (W / 2 + 0.28), -0.1], [0, 0], [L / s.dims.cellM, 0], [L / s.dims.cellM, 0.25], [0, 0.25], plan.accents ? "trim" : "slope", [0, sg * 0.3, 1], plan.accents ? trim : void 0);
      if (plan.accents) fascia(s, [-L / 2, sg * (W / 2 + 0.28), -0.1], [L / 2, sg * (W / 2 + 0.28), -0.1], [0, sg, 0], trim, 0.22);
    }
    if (plan.dormers) {
      const n = Math.min(3, Math.floor((L - 2) / 3.6));
      const surf = (a) => a >= W / 2 - k ? h1 * (W / 2 - a) / k : h1 + (R - h1) * (1 - a / (W / 2 - k));
      for (const sd of [-1, 1]) for (let i = 0; i < n; i++) dormer(s, { axis: "v", side: sd, c: -L / 2 + (i + 0.5) * L / n, pf: W / 2 - k * 0.5, dw: 1.05, hd: 1.25, surf }, plan);
    }
  }
  function buildMansardHip(s, plan, L, W, R) {
    const k = Math.min(1.1, W * 0.17), trim = plan.trimHex ?? TRIM_WHITE, ov = 0.3, lip = -0.12;
    const o = [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]];
    const inn = [[-L / 2 + k, -W / 2 + k], [L / 2 - k, -W / 2 + k], [L / 2 - k, W / 2 - k], [-L / 2 + k, W / 2 - k]];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, mid = [(o[i][0] + o[j][0]) / 2, (o[i][1] + o[j][1]) / 2, 0];
      s.slopePoly([[o[i][0], o[i][1], 0], [o[j][0], o[j][1], 0], [inn[j][0], inn[j][1], R], [inn[i][0], inn[i][1], R]], [mid[0], mid[1], 0.5]);
    }
    s.slopePoly(inn.map(([u, v]) => [u, v, R]), [0, 0, 1]);
    const ex = [[-L / 2 - ov, -W / 2 - ov], [L / 2 + ov, -W / 2 - ov], [L / 2 + ov, W / 2 + ov], [-L / 2 - ov, W / 2 + ov]];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, out = [(ex[i][0] + ex[j][0]) / 2, (ex[i][1] + ex[j][1]) / 2, 0];
      const part = plan.accents ? "trim" : "slope", hex2 = plan.accents ? trim : void 0;
      s.quad([o[i][0], o[i][1], 0], [o[j][0], o[j][1], 0], [ex[j][0], ex[j][1], lip], [ex[i][0], ex[i][1], lip], [0, 0], [1, 0], [1, 0.25], [0, 0.25], part, [out[0] * 0.05, out[1] * 0.05, 1], hex2);
      if (plan.accents) fascia(s, [ex[i][0], ex[i][1], lip], [ex[j][0], ex[j][1], lip], [out[0], out[1], 0], trim, 0.26);
    }
    if (!plan.dormers) return;
    const nE = W >= 7.5 ? 2 : 1, dwE = Math.min(1.3, (W - 2 * k) / nE - 0.5);
    const surfU = (a) => a >= L / 2 - k ? R * (L / 2 - a) / k : R;
    if (dwE >= 0.7) for (const e of [-1, 1]) for (let i = 0; i < nE; i++) dormer(s, { axis: "u", side: e, c: nE === 1 ? 0 : (i - 0.5) * (W / 2), pf: L / 2 - k * 0.35, dw: dwE, hd: 1.2, surf: surfU }, plan);
    const narrow = W <= 8.5 && L >= 1.25 * W;
    if (!narrow) {
      const n = Math.min(4, Math.floor((L - 2 * k - 1) / 3));
      const surfV = (a) => a >= W / 2 - k ? R * (W / 2 - a) / k : R;
      for (const sd of [-1, 1]) for (let i = 0; i < n; i++) dormer(s, { axis: "v", side: sd, c: -(L / 2 - k) + (i + 0.5) * (L - 2 * k) / n, pf: W / 2 - k * 0.35, dw: 1.2, hd: 1.2, surf: surfV }, plan);
    }
  }
  function buildHipped(s, plan, L, W, R, ov, rc) {
    const drop = ov * (R / (W / 2)), E = W / 2 + ov, Ue = L / 2 + ov, a = Math.max(0, L / 2 - W / 2);
    const apex = (su) => [su * a, 0, R], trim = plan.trimHex ?? TRIM_WHITE;
    rc = Math.min(rc, ov * 2.2);
    for (const sv of [-1, 1]) s.slopePoly([[-Ue + rc, sv * E, -drop], [Ue - rc, sv * E, -drop], apex(1), apex(-1)], [0, sv, 1]);
    for (const su of [-1, 1]) {
      s.slopeTri([su * Ue, -E + rc, -drop], [su * Ue, E - rc, -drop], apex(su), [su, 0, 1]);
      if (rc > 0) for (const sv of [-1, 1]) {
        const cu = su * (Ue - rc), cv = sv * (E - rc), arc = [];
        for (let i = 0; i <= 3; i++) {
          const f = i / 3 * Math.PI / 2;
          arc.push([cu + su * rc * Math.sin(f), cv + sv * rc * Math.cos(f), -drop]);
        }
        for (let i = 0; i < 3; i++) s.slopeTri(arc[i], arc[i + 1], apex(su), [su, sv, 1.4]);
      }
    }
    if (plan.accents) {
      for (const sv of [-1, 1]) fascia(s, [-Ue + rc, sv * E, -drop], [Ue - rc, sv * E, -drop], [0, sv, 0], trim);
      for (const su of [-1, 1]) fascia(s, [su * Ue, -E + rc, -drop], [su * Ue, E - rc, -drop], [su, 0, 0], trim);
    }
    const surfV = (v) => R * (1 - Math.abs(v) / (W / 2));
    const surf = (u, v) => Math.min(surfV(v), Math.abs(u) > a ? R * (1 - (Math.abs(u) - a) / (W / 2)) : R);
    if (plan.kind === "school") {
      const pf = W / 2 * 0.7, need = surfV(pf) - 0.15 + 1.3 + 0.06, reach = a + W / 2 * (1 - need / R) - 0.4;
      const dw = Math.min(L * 0.7, 2 * reach);
      if (dw >= 2) for (const sd of [-1, 1]) dormer(s, { axis: "v", side: sd, c: 0, pf, dw, hd: 1.3, surf: (q2) => surfV(q2), band: true }, plan);
    } else if (plan.dormers) {
      const n = Math.min(3, Math.floor((2 * a + 1) / 3.2));
      for (const sd of [-1, 1]) for (let i = 0; i < n; i++) dormer(s, { axis: "v", side: sd, c: n === 1 ? 0 : -a + (i + 0.5) * 2 * a / n, pf: W / 2 * 0.72, dw: 1.05, hd: 1.3, surf: (q2) => surfV(q2) }, plan);
    }
    chimney(s, plan, L, W, R, surf);
  }
  function halfHipSlopes(s, L, W, R, zc, ov) {
    const drop = ov * (R / (W / 2)), E = W / 2 + ov, vc = W / 2 * (1 - zc / R), d = vc;
    for (const sv of [-1, 1]) s.slopePoly([[-L / 2, sv * E, -drop], [L / 2, sv * E, -drop], [L / 2, sv * vc, zc], [L / 2 - d, 0, R], [-L / 2 + d, 0, R], [-L / 2, sv * vc, zc]], [0, sv, 1]);
    for (const su of [-1, 1]) s.slopeTri([su * L / 2, -vc, zc], [su * L / 2, vc, zc], [su * (L / 2 - d), 0, R], [su, 0, 1]);
  }
  function buildSawtooth(s, plan, L, W, R) {
    const n = Math.max(2, Math.round(L / 7)), p = L / n;
    for (let k = 0; k < n; k++) {
      const u0 = -L / 2 + k * p, u1 = u0 + p;
      s.slopePoly([[u0, -W / 2, 0], [u0, W / 2, 0], [u1, W / 2, R], [u1, -W / 2, R]], [-R, 0, p]);
      const rep = Math.max(1, Math.round(W / 1.6));
      s.quad([u1, -W / 2, 0], [u1, W / 2, 0], [u1, W / 2, R], [u1, -W / 2, R], [0, 0], [rep, 0], [rep, 1], [0, 1], "dormerFace", [1, 0, 0]);
      for (const sv of [-1, 1]) s.tri([u0, sv * W / 2, 0], [u1, sv * W / 2, 0], [u1, sv * W / 2, R], s.wallUv(u0, 0), s.wallUv(u1, 0), s.wallUv(u1, R), "plate", [0, sv, 0]);
    }
    void plan;
  }
  function roofTriangles(rect, plan, h0, dims) {
    const s = new RoofSink(rect, h0, dims);
    const { len: L, wid: W } = rect, R = plan.riseM, trim = plan.trimHex ?? TRIM_WHITE, accents = !!plan.accents;
    if (plan.kind === "mansard") {
      buildMansard(s, plan, L, W, R);
      return s.out;
    }
    if (plan.kind === "mansardHip") {
      buildMansardHip(s, plan, L, W, R);
      chimney(s, plan, L, W, R, () => R);
      return s.out;
    }
    if (plan.kind === "hipped") {
      buildHipped(s, plan, L, W, R, 0.3, 0);
      return s.out;
    }
    if (plan.kind === "school") {
      buildHipped(s, plan, L, W, R, 0.45, Math.min(0.9, W * 0.12));
      return s.out;
    }
    if (plan.kind === "sawtooth") {
      buildSawtooth(s, plan, L, W, R);
      return s.out;
    }
    if (plan.kind === "parapet") return s.out;
    const ov = 0.3, drop = ov * (R / (W / 2));
    const surfV = (v) => R * (1 - Math.abs(v) / (W / 2));
    const cornice = plan.kind === "gable" && plan.gable === "cornice";
    if (plan.kind === "halfHipped" || cornice) {
      const zc = cornice ? corniceHeight(R) : R * 0.55, vc = W / 2 * (1 - zc / R);
      halfHipSlopes(s, L, W, R, zc, ov);
      for (const e of [-1, 1]) {
        const f = e * L / 2;
        if (cornice) {
          const prof = gableProfile("cornice", W, R);
          gableSlab(s, prof, e, L, accents ? "trim" : "plate", trim);
          if (accents) gableAccents(s, { shape: "cornice", prof, f, e, W, R, trimHex: trim, shutterHex: "", shutters: false });
        } else {
          s.quad([f, -W / 2, 0], [f, W / 2, 0], [f, vc, zc], [f, -vc, zc], s.wallUv(-W / 2, 0), s.wallUv(W / 2, 0), s.wallUv(vc, zc), s.wallUv(-vc, zc), "plate", [e, 0, 0]);
          if (accents) vergeBoards(s, f, e, [[[-W / 2, 0], [-vc, zc]], [[vc, zc], [W / 2, 0]]], trim);
        }
      }
      const d = vc;
      chimney(s, plan, L, W, R, (u, v) => Math.min(surfV(v), Math.abs(u) > L / 2 - d ? zc + (R - zc) * (L / 2 - Math.abs(u)) / d : R));
      if (accents) for (const sv of [-1, 1]) fascia(s, [-L / 2, sv * (W / 2 + ov), -drop], [L / 2, sv * (W / 2 + ov), -drop], [0, sv, 0], trim);
      return s.out;
    }
    for (const sv of [-1, 1]) s.slopePoly([[-L / 2, sv * (W / 2 + ov), -drop], [L / 2, sv * (W / 2 + ov), -drop], [L / 2, 0, R], [-L / 2, 0, R]], [0, sv * R, W / 2]);
    if (accents) for (const sv of [-1, 1]) fascia(s, [-L / 2, sv * (W / 2 + ov), -drop], [L / 2, sv * (W / 2 + ov), -drop], [0, sv, 0], trim);
    chimney(s, plan, L, W, R, (_u, v) => surfV(v));
    for (const e of [-1, 1]) {
      const f = e * L / 2;
      if (plan.kind === "pitched") {
        s.tri([f, -W / 2, 0], [f, W / 2, 0], [f, 0, R], s.wallUv(-W / 2, 0), s.wallUv(W / 2, 0), s.wallUv(0, R), "plate", [e, 0, 0]);
        if (accents) vergeBoards(s, f, e, [[[-W / 2, 0], [0, R]], [[0, R], [W / 2, 0]]], trim);
        continue;
      }
      const prof = gableProfile(plan.gable, W, R);
      gableSlab(s, prof, e, L, accents && plan.gable !== "plain" ? "trim" : "plate", trim);
      if (accents) gableAccents(s, { shape: plan.gable, prof, f, e, W, R, trimHex: trim, shutterHex: plan.shutterHex ?? "#2f4a3a", shutters: !!plan.shutters, claws: plan.gable === "raisedNeck" ? clawArcs(W, R) : void 0, crownBase: crownBaseOf(plan.gable, W, R) });
    }
    if (plan.dormers) {
      const n = Math.min(3, Math.floor((L - 2) / 3.4));
      for (const sd of [-1, 1]) for (let i = 0; i < n; i++) dormer(s, { axis: "v", side: sd, c: -L / 2 + (i + 0.5) * L / n, pf: W / 2 * 0.72, dw: 1.05, hd: 1.35, surf: surfV }, plan);
    }
    return s.out;
  }

  // src/canalRecall/landmarkForms.ts
  var closed = (ring) => ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  var signedArea2 = (pts) => {
    let a = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    return a / 2;
  };
  function cleanRing(ring) {
    const raw = closed(ring) ? ring.slice(0, -1) : ring.slice();
    const pts = [];
    for (const p of raw) if (!pts.length || Math.hypot(p[0] - pts[pts.length - 1][0], p[1] - pts[pts.length - 1][1]) > 0.05) pts.push([p[0], p[1]]);
    while (pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) <= 0.05) pts.pop();
    return signedArea2(pts) < 0 ? pts.reverse() : pts;
  }
  function clipHalf(pts, p, dir) {
    const side = (q2) => (q2[0] - p[0]) * dir[0] + (q2[1] - p[1]) * dir[1];
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], sa = side(a), sb = side(b);
      if (sa >= 0) out.push(a);
      if (sa >= 0 !== sb >= 0) {
        const t = sa / (sa - sb);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return out;
  }
  function offsetRing(pts, d) {
    if (!d) return pts.slice();
    const n = pts.length;
    return pts.map((p, i) => {
      const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
      const e0 = [p[0] - a[0], p[1] - a[1]], e1 = [b[0] - p[0], b[1] - p[1]];
      const l0 = Math.hypot(e0[0], e0[1]) || 1, l1 = Math.hypot(e1[0], e1[1]) || 1;
      const n0 = [e0[1] / l0, -e0[0] / l0], n1 = [e1[1] / l1, -e1[0] / l1];
      const mx = n0[0] + n1[0], my = n0[1] + n1[1], dotN = 1 + n0[0] * n1[0] + n0[1] * n1[1];
      if (dotN < 1e-6) return [p[0] + n0[0] * d, p[1] + n0[1] * d];
      let k = d / dotN;
      const len = Math.hypot(mx * k, my * k);
      if (len > Math.abs(d) * 2.5) k *= Math.abs(d) * 2.5 / len;
      return [p[0] + mx * k, p[1] + my * k];
    });
  }
  function earcut(pts) {
    const idx = pts.map((_, i) => i), tris = [];
    const cross3 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const inside = (p, a, b, c) => cross3(a, b, p) > 1e-9 && cross3(b, c, p) > 1e-9 && cross3(c, a, p) > 1e-9;
    let guard = pts.length * pts.length + 10;
    while (idx.length > 3 && guard-- > 0) {
      let clipped = false;
      for (let k = 0; k < idx.length; k++) {
        const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length];
        const a = pts[i0], b = pts[i1], c = pts[i2];
        const turn = cross3(a, b, c);
        if (turn <= 1e-9) {
          if (Math.abs(turn) <= 1e-9) {
            idx.splice(k, 1);
            clipped = true;
            break;
          }
          continue;
        }
        if (idx.some((j) => j !== i0 && j !== i1 && j !== i2 && inside(pts[j], a, b, c))) continue;
        tris.push([i0, i1, i2]);
        idx.splice(k, 1);
        clipped = true;
        break;
      }
      if (!clipped) break;
    }
    for (let k = 1; k + 1 < idx.length; k++) tris.push([idx[0], idx[k], idx[k + 1]]);
    return tris;
  }
  var sub2 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  var crossV = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  function tri(out, a, b, c, ua, ub, uc, layer, hex2, hint) {
    let n = crossV(sub2(b, a), sub2(c, a)), B = b, C = c, UB = ub, UC = uc;
    if (n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0) {
      B = c;
      C = b;
      UB = uc;
      UC = ub;
      n = [-n[0], -n[1], -n[2]];
    }
    const l = Math.hypot(n[0], n[1], n[2]);
    if (l < 1e-9) return;
    out.push({ p: [a, B, C], uv: [ua, UB, UC], layer, hex: hex2, n: [n[0] / l, n[1] / l, n[2] / l] });
  }
  function formTriangles(form, ring, toLocal2) {
    let pts = cleanRing(ring);
    if (form.half) {
      const b = form.half.keepBearingDeg * Math.PI / 180;
      pts = cleanRing(clipHalf(pts, toLocal2(form.half.through), [Math.cos(b), Math.sin(b)]));
    }
    if (pts.length < 3 || Math.abs(signedArea2(pts)) < 1) return [];
    pts = offsetRing(pts, form.outsetM ?? 0);
    const out = [], layer = form.plain ? "plain" : "flat";
    let zAt = (_p) => form.z1;
    if (form.z1High !== void 0) {
      const hb = (form.highBearingDeg ?? 0) * Math.PI / 180, hx = Math.cos(hb), hy = Math.sin(hb);
      const s = pts.map((p) => p[0] * hx + p[1] * hy), lo = Math.min(...s), span = Math.max(...s) - lo || 1, zHigh = form.z1High;
      zAt = (p) => form.z1 + (zHigh - form.z1) * (p[0] * hx + p[1] * hy - lo) / span;
    }
    const zLow = (p) => form.tiltBottom ? form.z0 + zAt(p) - form.z1 : form.z0;
    let run = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], side = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const u0 = run / 5, u1 = (run + side) / 5;
      run += side;
      const za = zAt(a), zb = zAt(b);
      const hint = [b[1] - a[1], -(b[0] - a[0]), 0];
      if (!(hint[0] || hint[1])) continue;
      const fa = zLow(a), fb = zLow(b);
      tri(out, [a[0], a[1], fa], [b[0], b[1], fb], [b[0], b[1], zb], [u0, fa / 3.1], [u1, fb / 3.1], [u1, zb / 3.1], layer, form.hex, hint);
      tri(out, [a[0], a[1], fa], [b[0], b[1], zb], [a[0], a[1], za], [u0, fa / 3.1], [u1, zb / 3.1], [u0, za / 3.1], layer, form.hex, hint);
    }
    const lid = form.lidHex ?? form.hex;
    for (const [i, j, k] of earcut(pts)) {
      tri(out, [pts[i][0], pts[i][1], zAt(pts[i])], [pts[j][0], pts[j][1], zAt(pts[j])], [pts[k][0], pts[k][1], zAt(pts[k])], [0, 0], [1, 0], [1, 1], "flat", lid, [0, 0, 1]);
      if (form.z0 > 0.5) tri(out, [pts[i][0], pts[i][1], zLow(pts[i])], [pts[j][0], pts[j][1], zLow(pts[j])], [pts[k][0], pts[k][1], zLow(pts[k])], [0, 0], [1, 0], [1, 1], "flat", form.hex, [0, 0, -1]);
    }
    return out;
  }

  // src/canalRecall/museumKits.ts
  var VGM_STONE = "#c3bcae";
  var NEMO_COPPER = "#4f9a82";
  var STEDELIJK_WHITE = "#efeee9";
  var EYE_WHITE = "#f1f1ee";
  var GLASS = "#5d6c74";
  var MUSEUM_KITS = [
    {
      // Van Gogh Museum, Rietveld building (1973): light grey stone blocks on a glazed ground floor,
      // the black-framed glass stair tower towards Museumplein and a green glass block beside it
      // (Commons "Van Gogh Museum Amsterdam.jpg", "Van Gogh Museum, Kurokawa wing.jpg"). OSM's
      // part heights sit about 3 m under the 3D BAG roofs (main block 21 m, stair tower 24 m, green
      // block 19.5 m above the street; its ground there is the sunken court, 2.4 m lower), so the
      // three tall parts are drawn at the measured heights and the low wings keep their own.
      //
      // Kurokawa wing (1999): an ellipse cut in half. The southern half is the exhibition drum, a
      // granite wall under a titanium roof whose brim tilts up to the south (3D BAG: roof 12 m at
      // the cut, 15 m at the rim); the northern half, once the sunken court, is the 2015 glass
      // entrance hall (roof 4-10 m).
      name: "Van Gogh Museum",
      wall: { plain: true, hex: VGM_STONE, flat: true },
      tiers: [],
      stacks: [],
      roofs: [],
      body: ["w754324679", "w754324680", "w754324681", "w754324682"],
      hides: ["w754324683", "w754324684", "w754324685", "w1230401241", "w1230401242"],
      forms: [
        { on: "w754324684", z0: 0, z1: 21, hex: VGM_STONE },
        { on: "w754324685", z0: 0, z1: 24, hex: "#40464c" },
        { on: "w754324683", z0: 0, z1: 19.5, hex: "#7d9a92" },
        // The drum and its brim, both tilted up to the south (the cut runs at 22 degrees).
        { on: "w1230401242", z0: 0, z1: 12, z1High: 14.2, highBearingDeg: -68, hex: "#a9a8a2" },
        { on: "w1230401242", z0: 11.4, z1: 12.2, z1High: 14.9, highBearingDeg: -68, outsetM: 1.4, hex: "#cdd1d5", tiltBottom: true },
        { on: "w1230401241", z0: 0, z1: 5, z1High: 9.5, highBearingDeg: 112, hex: "#8ea7b1" }
      ]
    },
    {
      // Stedelijk Museum: A.W. Weissman's 1895 building in red brick with stone bands, steep slate
      // roofs, four corner pavilions with pointed roofs and the front tower with its lantern
      // (Commons "Amsterdam - Paulus Potterstraat 13 Stedelijk.JPG"). OSM stops the walls at 14 m;
      // 3D BAG has the roofs climbing from 16 to 25 m and the tower lantern at 31 m.
      //
      // The 2012 Benthem Crouwel wing ("de badkuip", Commons "Amsterdam - Stedelijk Museum -
      // Benthem Crouwel Wing 2012 - ICE Perspective.jpg", "Stedelijk Museum Amsterdam 2017.jpg"):
      // a smooth white tub lifted on a glass ground floor, under a thin flat roof that runs out as a
      // canopy over the Museumplein entrance. OSM maps the tub (w754299890, 92 x 19 m) inside the
      // canopy's outline (w754299892, 100 x 41 m); 3D BAG puts the roof at 17.6 m. Behind the tub,
      // up to the old building, a 15 m block.
      name: "Stedelijk",
      wall: { plain: false, style: "school", hex: "#a0503c" },
      tiers: [
        { id: "w754299889", shape: "square", mat: "brick", z1: 21 },
        ...["w754299894", "w754299895", "w754299896", "w754299897"].map((id) => ({ id, shape: "square", mat: "brick", z1: 14 }))
      ],
      stacks: [
        { onId: "w754299889", startZ: 21, stages: [
          { shape: "square", w0: 14.2, w1: 14.2, h: 0.8, mat: "stone" },
          { shape: "square", w0: 13.6, w1: 3.2, h: 4.6, mat: "slate" },
          { shape: "octagon", w0: 2.8, w1: 2.6, h: 1.8, mat: "white" },
          { shape: "octagon", w0: 2.8, w1: 0, h: 1.9, mat: "lead" }
        ] },
        ...["w754299894", "w754299895", "w754299896", "w754299897"].map((onId) => ({ onId, startZ: 14, stages: [
          { shape: "square", w0: 11.8, w1: 11.8, h: 0.6, mat: "stone" },
          { shape: "square", w0: 11.4, w1: 0.8, h: 8.4, mat: "slate" },
          { shape: "octagon", w0: 0.6, w1: 0, h: 1, mat: "gold" }
        ] }))
      ],
      roofs: [],
      halls: [
        {
          id: "w754299893",
          widthM: 0,
          anchor: [4.879729, 52.35806],
          eavesM: 14,
          riseM: 9,
          mat: "slate",
          wings: [{ at: [4.879729, 52.35806], lenM: 95.5, widM: 33.7, bearingDeg: 23.5, riseM: 9, roof: "hipped" }]
        },
        {
          id: "w754299898",
          widthM: 0,
          anchor: [4.879741, 52.358045],
          eavesM: 14,
          riseM: 9,
          mat: "slate",
          wings: [{ at: [4.879741, 52.358045], lenM: 50, widM: 30.4, bearingDeg: 113.5, riseM: 9, roof: "hipped" }]
        }
      ],
      body: ["w754299888"],
      hides: ["w754299890", "w754299892"],
      forms: [
        // Glass ground floor, the white tub on it, the block behind it, and the canopy over all.
        { on: "w754299890", z0: 0, z1: 4.6, outsetM: -0.8, hex: GLASS },
        { on: "w754299890", z0: 4.6, z1: 16.8, hex: STEDELIJK_WHITE },
        { on: "w754299892", z0: 0, z1: 15, hex: "#d9d6cf", half: { through: [4.879802, 52.357814], keepBearingDeg: 113.7 } },
        { on: "w754299892", z0: 16.8, z1: 17.6, hex: STEDELIJK_WHITE }
      ]
    },
    {
      // Eye Filmmuseum (Delugan Meissl, 2012): a white faceted wedge that climbs from the west to a
      // flat-topped prow over the IJ, over a long glazed band (Commons "Amsterdam Eye filmmuseum at
      // the IJ - panoramio.jpg"). 3D BAG: the prow's roof 24.5 m, the western facets 3-19 m.
      name: "Eye Filmmuseum",
      tiers: [],
      stacks: [],
      roofs: [],
      hides: ["NL.IMBAG.Pand.0363100012237838"],
      forms: [
        { on: "NL.IMBAG.Pand.0363100012237838", z0: 0, z1: 4.2, outsetM: -2, hex: GLASS },
        { on: "NL.IMBAG.Pand.0363100012237838", z0: 4.2, z1: 5, z1High: 21, highBearingDeg: 0, hex: EYE_WHITE, half: { through: [4.90123, 52.38428], keepBearingDeg: 180 } },
        { on: "NL.IMBAG.Pand.0363100012237838", z0: 4.2, z1: 24.5, hex: EYE_WHITE, half: { through: [4.90123, 52.38428], keepBearingDeg: 0 } }
      ]
    },
    {
      // NEMO's roof (Renzo Piano, 1997): the copper-green ship's deck is a public square that climbs
      // north from the Oosterdok end towards the prow over the IJ tunnel (3D BAG: the hall's roof
      // rises 12-22 m, the prow's 24-31.5 m). OSM gives the hall and its side strips one flat height
      // each, so the deck stood as a flat box between 24 m fins; these forms tilt them. The walls
      // keep the NEMO kit's patinated copper.
      name: "NEMO deck",
      tiers: [],
      stacks: [],
      roofs: [],
      hides: ["w1390692772", "w1390692771", "w1390692768", "w1390692765"],
      forms: [
        { on: "w1390692772", z0: 0, z1: 12, z1High: 22, highBearingDeg: 90, hex: NEMO_COPPER },
        { on: "w1390692771", z0: 0, z1: 13, z1High: 23.7, highBearingDeg: 90, hex: NEMO_COPPER },
        { on: "w1390692768", z0: 0, z1: 13, z1High: 23.8, highBearingDeg: 90, hex: NEMO_COPPER },
        { on: "w1390692765", z0: 0, z1: 24, z1High: 31.5, highBearingDeg: 90, hex: NEMO_COPPER }
      ]
    },
    {
      // Pathé Tuschinski (Hijman Louis de Jong, 1921): a grey-brown glazed-stone front between two
      // square towers, each under a green copper dome with a lantern (Commons "Tuschinski
      // front.jpg", "Amsterdam - Reguliersbreestraat - View West on Tuschinski Theatre 1921.jpg").
      // One BAG footprint: 3D BAG puts the flat roofs at 19 m, the auditorium and foyer roofs at
      // 22 m, the stage house at the back at 25 m, and the domes from 23.5 m to their lanterns at
      // 33.5 m (the west tower; the east one reads 38 m, its finial). The towers stand inside the
      // corners of the 14.6 m street front.
      name: "Tuschinski",
      wall: { plain: true, hex: "#6d665e" },
      tiers: [],
      stacks: [],
      roofs: [],
      halls: [{
        id: "NL.IMBAG.Pand.0363100012168188",
        widthM: 0,
        anchor: [4.894841, 52.366302],
        eavesM: 19,
        riseM: 3,
        mat: "slate",
        wings: [
          { at: [4.894505, 52.366213], lenM: 30, widM: 26, bearingDeg: 63.4, riseM: 3, roof: "hipped" },
          { at: [4.894657, 52.36646], lenM: 16, widM: 14, bearingDeg: 63.4, riseM: 3, roof: "hipped" }
        ],
        towers: [
          // The street front (landmarkFrontData.ts TUSCHINSKI) draws the towers and their stepped
          // crowns to 28.4 m; the domes rise out of those crowns, 1.2 m behind the front's face.
          { at: [4.894772, 52.3665], widthM: 3, z1: 26.8, capM: 5.1, cap: "copper", capShape: "dome", capHex: "#4f8a76", bearingDeg: 63.4 },
          { at: [4.894643, 52.366536], widthM: 3, z1: 26.8, capM: 5.1, cap: "copper", capShape: "dome", capHex: "#4f8a76", bearingDeg: 63.4 },
          // The stage house across the back.
          { at: [4.894405, 52.366062], widthM: 26, lenM: 10, z1: 24.2, capM: 0.8, cap: "slate", capShape: "slant", highBearingDeg: 153.4, bearingDeg: 153.4 }
        ]
      }]
    },
    {
      // Het Scheepvaartmuseum, 's Lands Zeemagazijn (Daniel Stalpaert, 1656): a square block of pale
      // sandstone round a courtyard, rows of windows, hipped slate roofs with dormers on all four
      // wings (Commons "Het Scheepvaartmuseum, Amsterdam.jpg"). 3D BAG: eaves 17 m, ridges 22.8 m.
      // The courtyard (OSM w269078550, a 9 m box) is roofed in glass at the eaves since 2011.
      name: "Scheepvaartmuseum",
      wall: { plain: false, style: "canal", hex: "#d8d2c2" },
      tiers: [],
      stacks: [],
      roofs: [],
      halls: [{
        id: "r3604837",
        widthM: 0,
        anchor: [4.914188, 52.371798],
        eavesM: 17,
        riseM: 5.8,
        mat: "slate",
        wings: [
          { at: [4.91467, 52.371864], lenM: 64.7, widM: 17.9, bearingDeg: 28.1, riseM: 5.8, roof: "hipped" },
          { at: [4.914969, 52.37152], lenM: 64.7, widM: 10.4, bearingDeg: 28.1, riseM: 5.8, roof: "hipped" },
          { at: [4.914502, 52.371607], lenM: 57.3, widM: 17.8, bearingDeg: 118.1, riseM: 5.8, roof: "hipped" },
          { at: [4.91511, 52.371807], lenM: 57.3, widM: 17.9, bearingDeg: 118.1, riseM: 5.8, roof: "hipped" },
          // The pedimented centre bay on each side (the footprint's 2.6-3.1 m projections): a gable
          // facing out of the main roof.
          { at: [4.914627, 52.371911], lenM: 12.2, widM: 15.2, bearingDeg: 118.1, riseM: 4.5 },
          { at: [4.914981, 52.371504], lenM: 12.2, widM: 17.1, bearingDeg: 118.1, riseM: 4.5 },
          { at: [4.914433, 52.371583], lenM: 12.2, widM: 12.6, bearingDeg: 28.1, riseM: 4.5 },
          { at: [4.915182, 52.371828], lenM: 12.2, widM: 12.5, bearingDeg: 28.1, riseM: 4.5 }
        ]
      }],
      hides: ["w269078550"],
      forms: [{ on: "w269078550", z0: 16.6, z1: 17.4, hex: "#9fb3bc" }]
    },
    {
      // H'ART Museum, the Amstelhof (1683): a severe dark brown brick block of three storeys round a
      // large courtyard, its 102 m front on the Amstel, steep slate hipped roofs with chimneys
      // (Commons "Amsterdam Amstelhof seen from Blauwbrug.jpg"). 3D BAG: eaves 10 m, roofs to 14.5 m.
      // The Amstel and back wings are 9.3 m deep, the north and south wings 23 m (two piles), and a
      // lower 8 m annex stands on the east side.
      name: "H'ART Museum",
      wall: { plain: false, style: "canal", hex: "#6e4535" },
      tiers: [],
      stacks: [],
      roofs: [],
      halls: [{
        id: "NL.IMBAG.Pand.0363100012165553",
        widthM: 0,
        anchor: [4.902126, 52.365736],
        eavesM: 10,
        riseM: 4.5,
        mat: "slate",
        wings: [
          { at: [4.902414, 52.365307], lenM: 102.1, widM: 9.3, bearingDeg: 107.2, riseM: 4.5, roof: "hipped" },
          { at: [4.90325, 52.365466], lenM: 102.1, widM: 9.3, bearingDeg: 107.2, riseM: 4.5, roof: "hipped" },
          { at: [4.90266, 52.365729], lenM: 68.8, widM: 22.9, bearingDeg: 17.2, riseM: 4.5, roof: "hipped" },
          { at: [4.903004, 52.365044], lenM: 68.8, widM: 22.8, bearingDeg: 17.2, riseM: 4.5, roof: "hipped" },
          { at: [4.903374, 52.365489], lenM: 38.8, widM: 8.1, bearingDeg: 107.2, riseM: 3, roof: "hipped" }
        ]
      }]
    }
  ];

  // src/canalRecall/worshipKits.ts
  var ESNOGA_BRICK = "#7a4a3a";
  var ESNOGA_STONE = "#e6dfcf";
  var WORSHIP_KITS = [
    {
      // Portuguese Synagogue (Esnoga), Mr. Visserplein: Elias Bouman's 1675 brick box. Commons
      // "EsnogaAmsterdam.jpg" and "De Portuguese Synagoge te Amsterdam - Amsterdam - 20013903 -
      // RCE.jpg": dark brick walls between giant pilaster-buttresses, a lower row of tall
      // round-headed windows and an upper row of square ones, a white stone cornice and balustrade,
      // and the roof hidden behind it. The low ring of service buildings around it are separate
      // footprints. One BAG footprint (1675, 21.9 m tile height) carries the box with its 1.1 m
      // buttresses, 37 x 27.9 m on an axis of 151 degrees, and two small 8 m annexes on the east.
      // 3D BAG: roof slopes from 18.7 to 23.7 m (hipped, behind the balustrade), a few flat bits at
      // 21 m. Scaled off the RCE photo (cornice 19 m): arched windows 6.2-13.2 m, square ones
      // 14.6-17.6 m, two between each pair of buttresses; balustrade to 20.2 m.
      name: "Portuguese Synagogue",
      wall: { plain: true, hex: ESNOGA_BRICK },
      tiers: [],
      stacks: [],
      roofs: [],
      halls: [{
        id: "NL.IMBAG.Pand.0363100012170255",
        widthM: 0,
        anchor: [4.905322, 52.367546],
        eavesM: 19.2,
        riseM: 4.4,
        mat: "slate",
        wings: [{ at: [4.905322, 52.367546], lenM: 37, widM: 27.9, bearingDeg: 151, riseM: 4.4, roof: "hipped" }],
        windows: {
          glassHex: "#3c454d",
          rows: [
            { z0: 6.2, z1: 13.2, widthM: 2.1, bayM: 4.9, head: "round" },
            { z0: 14.6, z1: 17.6, widthM: 1.9, bayM: 4.9, head: "flat" }
          ]
        }
      }],
      // The stone cornice and balustrade round the top of the walls.
      forms: [{ on: "NL.IMBAG.Pand.0363100012170255", z0: 18.7, z1: 20.2, outsetM: 0.35, hex: ESNOGA_STONE }]
    },
    {
      // Hofkerk (H.H. Martelaren van Gorcumkerk), Linnaeusstraat: J.T.J. Cuypers and Jan Stuyt's
      // 1927-29 brick church. Commons "Overzicht westgevel met ingangsportaal - Amsterdam - 20409083 -
      // RCE.jpg" (the west front), "H.H. Martelaren van Gorcum kerk.JPG" (the south side) and
      // "... kerk 3.JPG" (the tower): a square west tower with paired belfry arches and a narrow
      // tiled pyramid, the nave's big gable between three pointed portals, a small clock turret,
      // one sweeping glazed-tile roof over nave and aisles, a square crossing tower under a tiled
      // pyramid, and a lower transept and choir. No dome. One BAG footprint (1929, tile height
      // 32.1 m: the whole church stood as a 32 m box). 3D BAG: nave slopes 5.4-19.8 m, transept
      // 6-13.9 m, choir 8-15 m, crossing tower pyramid 22.3-29.3 m, the west tower's flat top
      // 25.7-26.1 m (ridge 32.1 m with its cap and cross), the clock turret's pyramid 11.2-16.7 m.
      name: "Hofkerk",
      wall: { plain: true, hex: "#8f5038" },
      tiers: [],
      stacks: [],
      roofs: [],
      halls: [{
        id: "NL.IMBAG.Pand.0363100012123068",
        widthM: 0,
        anchor: [4.933645, 52.353062],
        eavesM: 8,
        riseM: 11.8,
        mat: "tile",
        roofHex: "#9a8150",
        wings: [
          { at: [4.933645, 52.353062], lenM: 37.4, widM: 21, bearingDeg: 0, riseM: 11.8 },
          { at: [4.93399, 52.353055], lenM: 43, widM: 12, bearingDeg: 90, riseM: 5.9 },
          { at: [4.93412, 52.35306], lenM: 10, widM: 12, bearingDeg: 0, riseM: 7, roof: "hipped" }
        ],
        towers: [
          // West tower: walls to the 26 m flat top, a narrow tiled pyramid and cross (32.1 m).
          { at: [4.933435, 52.353172], widthM: 8.5, z1: 26, capM: 4.5, capWidthM: 4.2, cap: "tile", bearingDeg: 0 },
          // Crossing tower under its tiled pyramid (29.3 m, cross 30.9 m).
          { at: [4.93397, 52.353062], widthM: 10, z1: 21.5, capM: 7.8, cap: "tile", bearingDeg: 0 },
          // Clock turret at the south west, turned with the angled block it stands in.
          { at: [4.933603, 52.352865], widthM: 5, z1: 11.2, capM: 5.5, cap: "tile", bearingDeg: 44 }
        ],
        windows: {
          glassHex: "#3a434c",
          rows: [
            // The west front's three pointed portals, the middle one widest (photo: 3 m and 2.4 m).
            { z0: 0.3, z1: 5.6, widthM: 2.8, bayM: 6.2, head: "pointed", at: [4.93337, 52.35305], count: 3 },
            // Aisle windows: small pointed lights in a row under the eaves.
            { z0: 2.6, z1: 5.8, widthM: 0.8, bayM: 2.2, head: "pointed" }
          ],
          // Paired belfry arches near the west tower's top.
          towerRows: [{ z0: 21.4, z1: 24.6, widthM: 1.4, bayM: 1.9, head: "round", count: 2 }]
        }
      }]
    },
    {
      // Gerardus Majellakerk, Amsterdam-Oost (OSM way 45037862): a 1926 central church. Commons "Gerardus Majellakerk -
      // Amsterdam - 20307934 - RCE.jpg", "2022 Gerardus Majellakerk, Asd.jpg" and "Gerardus
      // Majellakerk Amsterdam (Oostzijde).jpg": dark brown brick, a broad octagonal drum ringed with
      // round-arched windows under a steep slate cone with a gilt ball and cross, four short arms with
      // slate gable roofs, round chapels with conical caps in the angles, and a narthex with a round
      // window at the west end. One BAG footprint (tile height 41.5 m: the whole church stood as a
      // 41 m block of flats with house windows). 3D BAG: the cone's facets rise from 23-28 m to
      // 41.3 m round (4.938523, 52.359805); the arms' slopes run 13.3 to 18.8-19.8 m (long arm,
      // axis 13 degrees) and 13.3 to 19.1-21.2 m (cross arm); chapels 10.5-13.9 m, apses 8-11.4 m.
      // The footprint is 69 m along the axis and 40 m across at the drum.
      name: "Gerardus Majellakerk",
      wall: { plain: true, hex: "#6e4a3c" },
      tiers: [],
      stacks: [],
      roofs: [],
      halls: [{
        id: "NL.IMBAG.Pand.0363100012136492",
        widthM: 0,
        anchor: [4.938523, 52.359805],
        eavesM: 13.3,
        riseM: 6,
        mat: "slate",
        wings: [
          { at: [4.938523, 52.359805], lenM: 56, widM: 20, bearingDeg: 13.3, riseM: 6 },
          { at: [4.938523, 52.359805], lenM: 40, widM: 14, bearingDeg: 103.3, riseM: 6 }
        ],
        towers: [
          // The drum (24 m across, walls to 25.5 m) under its slate cone to 41.3 m.
          { at: [4.938523, 52.359805], widthM: 24, z1: 25.5, capM: 15.8, cap: "slate", shape: "octagon", bearingDeg: 13.3 }
        ],
        windows: {
          glassHex: "#3a434c",
          frameHex: "#e3dccb",
          rows: [{ z0: 4, z1: 10.5, widthM: 1.5, bayM: 4.2, head: "round" }],
          // The narthex's round window over the west porch.
          roses: [{ at: [4.93802, 52.359705], z: 9.5, radiusM: 2 }]
        }
      }]
    },
    {
      // Westermoskee (Ayasofya Camii), Piri Reisplein: Marc Breitman and Nada Breitman-Jakov's 2015
      // mosque in the Ottoman manner (before this kit it stood as a glass-fronted
      // box). Commons "Westermoskee Aya Sofya (Amsterdam, The Netherlands 2017).jpg" and
      // "Westermoskee - Amsterdam (26579109769).jpg": a two-storey body of banded brown and buff
      // brick with round-headed upper windows, a chamfered square drum with a ring of arched windows,
      // a big zinc dome with a gilt finial, half-domes and a white colonnade, and one slender brick
      // minaret with two white balconies and a silver spike. One BAG footprint (2015, tile 21.5 m).
      // 3D BAG: the dome's facets reach 26.4 m round (4.86064, 52.36620); lower roofs and half-domes
      // 10.5-24 m; the minaret is the small polygon at the east corner (4.86094, 52.366252), where the
      // point cloud catches only 26.5-32.6 m of it. Its height, about 40 m, is read off the second
      // photo against the 26 m dome, not measured.
      name: "Westermoskee",
      wall: { plain: true, hex: "#7b4636" },
      tiers: [],
      stacks: [],
      roofs: [],
      halls: [{
        id: "NL.IMBAG.Pand.0363100012241498",
        widthM: 0,
        anchor: [4.86064, 52.3662],
        eavesM: 10.6,
        riseM: 0,
        mat: "lead",
        towers: [
          // The drum (22 m across, walls to 18 m) under the zinc dome to 26.4 m.
          { at: [4.86064, 52.3662], widthM: 22, z1: 18, capM: 8.4, cap: "lead", capShape: "dome", capHex: "#9aa3a8", shape: "octagon", bearingDeg: -37.5 },
          // The minaret: brick shaft, two white balconies, a silver spike.
          { at: [4.86094, 52.366252], widthM: 3, z1: 34, capM: 7, cap: "lead", capShape: "spire", capHex: "#c9ced2", shape: "octagon", bearingDeg: -37.5, wallHex: "#6b3a30" },
          ...[20.5, 30].map((z) => ({ at: [4.86094, 52.366252], widthM: 4.4, z0: z, z1: z + 1.3, capM: 0.3, cap: "white", capShape: "dome", shape: "octagon", mat: "white", wallHex: "#ece8de", bearingDeg: -37.5, finial: false }))
        ],
        windows: {
          glassHex: "#3a434c",
          frameHex: "#ece8de",
          rows: [
            { z0: 0.6, z1: 3.6, widthM: 1.2, bayM: 3, head: "flat" },
            { z0: 5.2, z1: 8.6, widthM: 1.3, bayM: 3, head: "round" }
          ]
        }
      }]
    },
    {
      // Dominicuskerk (Sint-Dominicus), Spuistraat 12: P.J.H. Cuypers' 1884-86 neo-Gothic basilica
      // (it stood as two beige boxes, 28 and 15 m). Commons "Overzicht van de zuidgevel in de
      // spuistraat - Amsterdam - 20424399 - RCE.jpg" and "WLM - andrevanb - amsterdam, dominicuskerk
      // (1).jpg": grey-brown brick with buff bands, tall pointed traceried windows in the aisles and
      // the clerestory, balustrades and pinnacles along both, a steep roof behind, and at the front
      // corner a slender stair turret with an octagonal belfry and a slate spire. OSM maps the nave
      // (w749287654, 28 m), the whole church as the aisles' part (w749287651, 15 m) and the turret
      // (w749287652). 3D BAG (pand 0363100012171033): nave roof 20.5-25.6 m, aisle roofs 10.4-12.7
      // m, the turret's belfry top flat at 28.5 m; the spire above it (8 m) is scaled off the photo.
      name: "Dominicuskerk",
      wall: { plain: true, hex: "#6f5e52" },
      tiers: [{ id: "w749287652", shape: "octagon", mat: "brick", z1: 28.5 }],
      stacks: [{ onId: "w749287652", startZ: 28.5, stages: [
        { shape: "octagon", w0: 5.4, w1: 5.4, h: 0.5, mat: "stone" },
        { shape: "octagon", w0: 4.4, w1: 0.3, h: 8, mat: "slate" },
        { shape: "octagon", w0: 0.4, w1: 0, h: 1.4, mat: "gold" }
      ] }],
      roofs: [],
      halls: [
        {
          id: "w749287654",
          widthM: 0,
          anchor: [4.893274, 52.376958],
          fit: true,
          eavesM: 20.6,
          riseM: 5,
          mat: "slate",
          windows: { glassHex: "#3a434c", frameHex: "#cbb98f", rows: [{ z0: 13, z1: 19.4, widthM: 1.6, bayM: 5, head: "pointed" }] }
        },
        {
          id: "w749287651",
          widthM: 0,
          anchor: [4.893274, 52.376958],
          fit: true,
          eavesM: 10.4,
          riseM: 2.3,
          mat: "slate",
          windows: { glassHex: "#3a434c", frameHex: "#cbb98f", rows: [{ z0: 2.8, z1: 9.4, widthM: 1.8, bayM: 5, head: "pointed" }] }
        }
      ]
    }
  ];

  // src/canalRecall/worshipBuildingData.ts
  var WORSHIP_BUILDINGS = [
    ["NL.IMBAG.Pand.0305100000001042", "c", "w", 6.1, 0, "e"],
    // Anna s Hoeve, 1910, 6.1 m, 501 m2
    ["NL.IMBAG.Pand.0358100021571530", "c", "h", 5.8, 6.7, "o"],
    // Petrus en Pauluskerk, 1860, 10.5 m, 244 m2
    ["NL.IMBAG.Pand.0362100001054286", "c", "w", 25.8, 0, "e"],
    // Kruiskerk, 1950, 25.8 m, 822 m2
    ["NL.IMBAG.Pand.0362100001055799", "c", "w", 15.5, 0, "o"],
    // Sint Urbanuskerk, 1875, 15.5 m, 1418 m2
    ["NL.IMBAG.Pand.0362100001056666", "c", "w", 11.8, 0, "e"],
    // Dorpskerk, 1920, 11.8 m, 414 m2
    ["NL.IMBAG.Pand.0362100001056682", "c", "w", 20.9, 0, "e"],
    // Sint-Annakerk, 1928, 20.9 m, 867 m2
    ["NL.IMBAG.Pand.0362100001059417", "c", "b", 4.5, 0, "m"],
    // Nieuw Apostolische Kerk, 1966, 4.5 m, 203 m2
    ["NL.IMBAG.Pand.0362100001059917", "s", "b", 7.2, 0, "m"],
    // Sjoel Amstelveen, 1971, 7.2 m, 1091 m2
    ["NL.IMBAG.Pand.0362100001060156", "c", "b", 8.2, 0, "m"],
    // Titus Brandsmakerk, 1969, 8.2 m, 1231 m2
    ["NL.IMBAG.Pand.0362100001077847", "c", "w", 13.8, 0, "e"],
    // Pauluskerk, 1939, 13.8 m, 927 m2
    ["NL.IMBAG.Pand.0362100001082159", "c", "b", 12.6, 0, "m"],
    // (unnamed), 1963, 12.6 m, 501 m2
    ["NL.IMBAG.Pand.0363100012062993", "c", "w", 11.1, 0, "e"],
    // (unnamed), 1955, 11.1 m, 1209 m2
    ["NL.IMBAG.Pand.0363100012066059", "c", "w", 11.2, 0, "e"],
    // Mor Sharbil, 1958, 11.2 m, 1050 m2
    ["NL.IMBAG.Pand.0363100012067458", "c", "w", 10.1, 0, "e"],
    // De Nieuwe Augustinus, 1934, 10.1 m, 882 m2
    ["NL.IMBAG.Pand.0363100012069508", "c", "b", 17.9, 0, "m"],
    // (unnamed), 1997, 17.9 m, 451 m2
    ["NL.IMBAG.Pand.0363100012072736", "c", "w", 11.1, 0, "e"],
    // Bethelkerk, 1958, 11.1 m, 423 m2
    ["NL.IMBAG.Pand.0363100012073895", "s", "b", 3.9, 0, "m"],
    // (unnamed), 1992, 3.9 m, 381 m2
    ["NL.IMBAG.Pand.0363100012074574", "s", "w", 17.1, 0, "e"],
    // Raw Aron Schuster Synagoge, 1928, 17.1 m, 588 m2
    ["NL.IMBAG.Pand.0363100012078085", "c", "b", 16.1, 0, "m"],
    // De Ontmoeting, 1964, 16.1 m, 629 m2
    ["NL.IMBAG.Pand.0363100012080392", "m", "b", 6.2, 0, "m"],
    // Rabitha Al Islamia, 1965, 6.2 m, 1342 m2
    ["NL.IMBAG.Pand.0363100012082170", "c", "h", 10.4, 14, "e"],
    // Parkkerk, 1924, 20.2 m, 744 m2
    ["NL.IMBAG.Pand.0363100012083695", "t", "w", 9.6, 0, "e"],
    // (unnamed), 1927, 9.6 m, 239 m2
    ["NL.IMBAG.Pand.0363100012088135", "c", "w", 9.9, 0, "e"],
    // Christus Koningkerk, 1958, 9.9 m, 2465 m2
    ["NL.IMBAG.Pand.0363100012089044", "c", "w", 13.3, 0, "e"],
    // Maranathakerk, 1955, 13.3 m, 824 m2
    ["NL.IMBAG.Pand.0363100012097084", "c", "h", 10, 9, "e"],
    // Elthetokerk, 1914, 16.3 m, 323 m2
    ["NL.IMBAG.Pand.0363100012097194", "c", "h", 6.7, 4.7, "o"],
    // Schellingwouderkerk, 1866, 10 m, 148 m2
    ["NL.IMBAG.Pand.0363100012097854", "c", "w", 13, 0, "e"],
    // (unnamed), 1914, 13 m, 498 m2
    ["NL.IMBAG.Pand.0363100012097989", "m", "w", 8.5, 0, "e"],
    // Haci Bayram Camii Osdorp, 1931, 8.5 m, 560 m2
    ["NL.IMBAG.Pand.0363100012098124", "c", "b", 6.9, 0, "m"],
    // (unnamed), 1969, 6.9 m, 500 m2
    ["NL.IMBAG.Pand.0363100012098251", "c", "w", 16.4, 0, "e"],
    // De Bron, 1939, 16.4 m, 943 m2
    ["NL.IMBAG.Pand.0363100012098714", "c", "h", 6.1, 13.5, "e"],
    // Willem de Zwijgerkerk, 1931, 15.6 m, 739 m2
    ["NL.IMBAG.Pand.0363100012099552", "c", "b", 9, 0, "m"],
    // (unnamed), 1966, 9 m, 1399 m2
    ["NL.IMBAG.Pand.0363100012100328", "t", "b", 4.2, 0, "m"],
    // (unnamed), 1985, 4.2 m, 318 m2
    ["NL.IMBAG.Pand.0363100012101255", "c", "b", 5.7, 0, "m"],
    // (unnamed), 2001, 5.7 m, 1593 m2
    ["NL.IMBAG.Pand.0363100012102877", "c", "b", 9.5, 0, "m"],
    // Herdenkingskerk, 1964, 9.5 m, 575 m2
    ["NL.IMBAG.Pand.0363100012103534", "c", "w", 20.5, 0, "e"],
    // Augustinuskerk, 1935, 20.5 m, 1359 m2
    ["NL.IMBAG.Pand.0363100012108972", "m", "w", 11.3, 0, "e"],
    // Moskee an-Nour, 1921, 11.3 m, 280 m2
    ["NL.IMBAG.Pand.0363100012109328", "c", "b", 5.4, 0, "m"],
    // Gunung Batu, 1972, 5.4 m, 243 m2
    ["NL.IMBAG.Pand.0363100012117241", "c", "h", 5, 7.1, "e"],
    // (unnamed), 1914, 10 m, 748 m2
    ["NL.IMBAG.Pand.0363100012117919", "c", "w", 15.4, 0, "e"],
    // (unnamed), 1927, 15.4 m, 1706 m2
    ["NL.IMBAG.Pand.0363100012119483", "m", "b", 3.9, 0, "m"],
    // Emir Sultan Moskee, 1968, 3.9 m, 510 m2
    ["NL.IMBAG.Pand.0363100012119680", "c", "b", 19.8, 0, "e"],
    // Boomkerk, 1911, 19.8 m, 1256 m2
    ["NL.IMBAG.Pand.0363100012120748", "c", "b", 8.6, 0, "m"],
    // (unnamed), 1971, 8.6 m, 746 m2
    ["NL.IMBAG.Pand.0363100012120986", "c", "h", 8.5, 10.3, "o"],
    // Augustinuskerk, 1888, 15.7 m, 626 m2
    ["NL.IMBAG.Pand.0363100012123194", "c", "b", 9.1, 0, "m"],
    // CGK & NGK - De Bron, 1967, 9.1 m, 623 m2
    ["NL.IMBAG.Pand.0363100012124248", "c", "b", 5, 0, "m"],
    // Vergadering van Gelovigen, 1968, 5 m, 244 m2
    ["NL.IMBAG.Pand.0363100012124586", "t", "b", 7.9, 0, "m"],
    // Ikeda Centrum voor Vriendschap en Vrede, 1965, 7.9 m, 1269 m2
    ["NL.IMBAG.Pand.0363100012125533", "m", "b", 9.5, 0, "m"],
    // Djame Masdjied Taibah, 1984, 9.5 m, 1268 m2
    ["NL.IMBAG.Pand.0363100012126000", "c", "b", 12.4, 0, "m"],
    // (unnamed), 1985, 12.4 m, 612 m2
    ["NL.IMBAG.Pand.0363100012128901", "m", "b", 7.4, 0, "m"],
    // Islamitisch Centrum Quba, 1990, 7.4 m, 1140 m2
    ["NL.IMBAG.Pand.0363100012128930", "m", "b", 3.8, 0, "m"],
    // Al Houda Moskee, 1974, 3.8 m, 651 m2
    ["NL.IMBAG.Pand.0363100012129592", "c", "w", 14.7, 0, "e"],
    // Sint-Josephkerk, 1953, 14.7 m, 1406 m2
    ["NL.IMBAG.Pand.0363100012130941", "m", "h", 6, 6.5, "e"],
    // Kuba Camii Moskee, 1955, 10.5 m, 199 m2
    ["NL.IMBAG.Pand.0363100012132809", "c", "w", 16.5, 0, "e"],
    // (unnamed), 1923, 16.5 m, 1567 m2
    ["NL.IMBAG.Pand.0363100012134386", "c", "b", 4.6, 0, "m"],
    // Weerenkapel, 1969, 4.6 m, 406 m2
    ["NL.IMBAG.Pand.0363100012135926", "c", "w", 14.4, 0, "e"],
    // Maarten Lutherkerk, 1937, 14.4 m, 458 m2
    ["NL.IMBAG.Pand.0363100012136224", "m", "b", 10.6, 0, "m"],
    // El Ouma, 1992, 10.6 m, 833 m2
    ["NL.IMBAG.Pand.0363100012137097", "m", "w", 6.4, 0, "e"],
    // El Tawheed, 1914, 6.4 m, 595 m2
    ["NL.IMBAG.Pand.0363100012137751", "c", "w", 10.2, 0, "e"],
    // (unnamed), 1952, 10.2 m, 670 m2
    ["NL.IMBAG.Pand.0363100012137946", "c", "h", 8.2, 6.8, "o"],
    // Sloterkerk, 1861, 13 m, 333 m2
    ["NL.IMBAG.Pand.0363100012140916", "s", "h", 8.2, 6.8, "o"],
    // Gerard Dou Synagogue, 1892, 12.9 m, 208 m2
    ["NL.IMBAG.Pand.0363100012142532", "m", "h", 8.4, 6, "o"],
    // (unnamed), 1896, 12.6 m, 149 m2
    ["NL.IMBAG.Pand.0363100012143236", "m", "w", 11.3, 0, "e"],
    // Moskee El-Hijra, 1956, 11.3 m, 786 m2
    ["NL.IMBAG.Pand.0363100012144206", "c", "h", 6.5, 6.5, "o"],
    // Nieuwendammerkerk, 1849, 11 m, 246 m2
    ["NL.IMBAG.Pand.0363100012146056", "s", "b", 7.6, 0, "m"],
    // Joods Cultureel Centrum, 1967, 7.6 m, 1255 m2
    ["NL.IMBAG.Pand.0363100012148521", "c", "w", 17.7, 0, "e"],
    // (unnamed), 1927, 17.7 m, 405 m2
    ["NL.IMBAG.Pand.0363100012153991", "t", "b", 5.9, 0, "m"],
    // (unnamed), 2003, 5.9 m, 103 m2
    ["NL.IMBAG.Pand.0363100012155663", "c", "b", 10.5, 0, "m"],
    // (unnamed), 2010, 10.5 m, 362 m2
    ["NL.IMBAG.Pand.0363100012160472", "c", "w", 14.5, 0, "o"],
    // (unnamed), 1609, 14.5 m, 387 m2
    ["NL.IMBAG.Pand.0363100012161518", "c", "h", 7.2, 6.7, "o"],
    // Sint-Gertrudiskerk, 1894, 11.9 m, 289 m2
    ["NL.IMBAG.Pand.0363100012161733", "c", "b", 11.8, 0, "m"],
    // (unnamed), 1975, 11.8 m, 262 m2
    ["NL.IMBAG.Pand.0363100012162454", "c", "h", 6.3, 6.3, "e"],
    // (unnamed), 1927, 10.7 m, 208 m2
    ["NL.IMBAG.Pand.0363100012162810", "c", "h", 5, 2.7, "e"],
    // Meerpadkerk, 1924, 6.9 m, 99 m2
    ["NL.IMBAG.Pand.0363100012163298", "c", "h", 6.2, 7.6, "o"],
    // Petruskerk, 1850, 11.6 m, 311 m2
    ["NL.IMBAG.Pand.0363100012163469", "c", "h", 5, 6.7, "e"],
    // Sacramentskerk, 1939, 9.7 m, 904 m2
    ["NL.IMBAG.Pand.0363100012165085", "c", "w", 16.5, 0, "o"],
    // Oude Lutherse Kerk, 1885, 16.5 m, 1434 m2
    ["NL.IMBAG.Pand.0363100012165936", "c", "h", 8.8, 9.1, "e"],
    // Pancratiuskerk, 1901, 15.2 m, 486 m2
    ["NL.IMBAG.Pand.0363100012166358", "c", "h", 10.1, 14, "e"],
    // Sint-Agneskerk, 1914, 19.9 m, 1377 m2
    ["NL.IMBAG.Pand.0363100012167089", "c", "h", 5, 4.6, "e"],
    // Witte Kerk, 1933, 8.2 m, 126 m2
    ["NL.IMBAG.Pand.0363100012167695", "c", "w", 13.4, 0, "o"],
    // (unnamed), 1630, 13.4 m, 915 m2
    ["NL.IMBAG.Pand.0363100012167890", "c", "h", 5, 3.1, "o"],
    // Simon de Looier, 1894, 7.2 m, 322 m2
    ["NL.IMBAG.Pand.0363100012168060", "c", "w", 13.3, 0, "o"],
    // Begijnhofkapel, 1671, 13.3 m, 524 m2
    ["NL.IMBAG.Pand.0363100012168141", "c", "w", 11.6, 0, "o"],
    // Engelse kerk, 1665, 11.6 m, 477 m2
    ["NL.IMBAG.Pand.0363100012169397", "c", "w", 15.2, 0, "e"],
    // Heilige Nikolaas van Myrakerk, 1912, 15.2 m, 977 m2
    ["NL.IMBAG.Pand.0363100012171741", "c", "w", 14.3, 0, "o"],
    // Singelkerk, 1639, 14.3 m, 786 m2
    ["NL.IMBAG.Pand.0363100012171989", "c", "b", 13.9, 0, "m"],
    // (unnamed), 1969, 13.9 m, 488 m2
    ["NL.IMBAG.Pand.0363100012176840", "c", "w", 11.7, 0, "e"],
    // (unnamed), 1907, 11.7 m, 102 m2
    ["NL.IMBAG.Pand.0363100012177272", "c", "h", 13, 8.1, "o"],
    // Keizersgrachtkerk, 1888, 18.7 m, 416 m2
    ["NL.IMBAG.Pand.0363100012177887", "c", "h", 7.2, 13.4, "o"],
    // Sint Olofskapel, 1440, 16.6 m, 555 m2
    ["NL.IMBAG.Pand.0363100012177921", "t", "b", 12.5, 0, "m"],
    // Fo Guang Shan He Hua Tempel, 2000, 12.5 m, 326 m2
    ["NL.IMBAG.Pand.0363100012179330", "c", "h", 13.8, 8.2, "o"],
    // Nieuwe Waalse Kerk, 1856, 19.6 m, 423 m2
    ["NL.IMBAG.Pand.0363100012180211", "c", "h", 10.1, 6.4, "o"],
    // Agnietenkapel (UvA), 1470, 14.6 m, 249 m2
    ["NL.IMBAG.Pand.0363100012181889", "s", "h", 10.2, 6.4, "o"],
    // Uilenburger Synagoge, 1766, 14.6 m, 253 m2
    ["NL.IMBAG.Pand.0363100012208081", "c", "h", 7.8, 9.5, "e"],
    // (unnamed), 1921, 14.5 m, 347 m2
    ["NL.IMBAG.Pand.0363100012233557", "c", "b", 18.5, 0, "m"],
    // Vincentiuskerk, 1990, 18.5 m, 1744 m2
    ["NL.IMBAG.Pand.0363100012235970", "c", "h", 5, 7.1, "o"],
    // (unnamed), 1899, 10 m, 382 m2
    ["NL.IMBAG.Pand.0363100012237290", "m", "h", 7.8, 10.8, "e"],
    // Masjid Al-Karam, 1904, 15.3 m, 364 m2
    ["NL.IMBAG.Pand.0363100012237328", "c", "w", 15.4, 0, "e"],
    // (unnamed), 1926, 15.4 m, 931 m2
    ["NL.IMBAG.Pand.0363100012237810", "m", "w", 18.2, 0, "o"],
    // Blauwe Moskee, 18.2 m, 1352 m2
    ["NL.IMBAG.Pand.0363100012239394", "c", "b", 4.7, 0, "m"],
    // Koninkrijkszaal, 2010, 4.7 m, 308 m2
    ["NL.IMBAG.Pand.0363100012240297", "c", "b", 8, 0, "m"],
    // Wi Eegi Kerki, 2013, 8 m, 910 m2
    ["NL.IMBAG.Pand.0363100012241744", "s", "b", 16.7, 0, "m"],
    // LJG, 2010, 16.7 m, 978 m2
    ["NL.IMBAG.Pand.0363100012241807", "m", "b", 7.4, 0, "m"],
    // Moskee Taqwa, 2014, 7.4 m, 483 m2
    ["NL.IMBAG.Pand.0363100012246231", "c", "h", 9.8, 7.8, "o"],
    // Gerardus Majellakerk, 15.3 m, 241 m2
    ["NL.IMBAG.Pand.0363100012253747", "c", "w", 17.2, 0, "o"],
    // De Papegaai, 17.2 m, 667 m2
    ["NL.IMBAG.Pand.0384100000004250", "c", "w", 13.6, 0, "e"],
    // Sint-Petrus -Bandenkerk, 1910, 13.6 m, 581 m2
    ["NL.IMBAG.Pand.0384100000004631", "c", "w", 8.8, 0, "e"],
    // (unnamed), 1937, 8.8 m, 714 m2
    ["NL.IMBAG.Pand.0393100000000191", "c", "w", 8.8, 0, "e"],
    // (unnamed), 1924, 8.8 m, 379 m2
    ["NL.IMBAG.Pand.0394100000209235", "c", "w", 11.3, 0, "e"],
    // Pelgrimskerk, 1950, 11.3 m, 1122 m2
    ["NL.IMBAG.Pand.0394100000209852", "c", "w", 10.8, 0, "e"],
    // HH. Engelbewaarders, 1958, 10.8 m, 856 m2
    ["NL.IMBAG.Pand.0394100001031599", "c", "w", 17.4, 0, "e"],
    // Onze Lieve Vrouw Geboorte, 1929, 17.4 m, 480 m2
    ["NL.IMBAG.Pand.0437100000001261", "c", "w", 16.8, 0, "o"],
    // Amstelkerk, 1774, 16.8 m, 449 m2
    ["NL.IMBAG.Pand.0437100000002950", "c", "b", 11.5, 0, "m"],
    // Elimkerk, 1970, 11.5 m, 508 m2
    ["NL.IMBAG.Pand.0437100000004199", "c", "h", 6.2, 7.3, "e"],
    // De Kleine Kerk, 1925, 11.3 m, 252 m2
    ["NL.IMBAG.Pand.0437100000004530", "c", "b", 6.6, 0, "m"],
    // El Ministerio El Encuentro, 1982, 6.6 m, 1495 m2
    ["NL.IMBAG.Pand.0457100000054845", "c", "w", 21.9, 0, "o"],
    // Laurenskerk, 1462, 21.9 m, 1320 m2
    ["NL.IMBAG.Pand.0457100000054855", "s", "h", 5.5, 5.9, "o"],
    // Synagoge Masorti Nederland, 1840, 9.7 m, 111 m2
    ["NL.IMBAG.Pand.0457100000059177", "c", "w", 12.4, 0, "e"],
    // Van Houtenkerk, 1905, 12.4 m, 468 m2
    ["NL.IMBAG.Pand.0457100000065023", "m", "b", 8, 0, "m"],
    // Assoenat Moskee, 2017, 8 m, 553 m2
    ["NL.IMBAG.Pand.0479100000005285", "m", "b", 5.5, 0, "m"],
    // Essalam Moskee, 1980, 5.5 m, 119 m2
    ["w1428145947", "c", "b", 3, 0, "m"],
    // Koninkrijkszaal van Jehovah s Getuigen, 1998, 3 m, 106 m2
    ["w1428145953", "c", "b", 9, 0, "m"],
    // Koninkrijkszaal van Jehovah s Getuigen, 1998, 9 m, 328 m2
    ["w1435276700", "c", "b", 3, 0, "m"],
    // De Nieuwe Stad, 1992, 3 m, 520 m2
    ["w1435276702", "c", "b", 3, 0, "m"],
    // De Nieuwe Stad, 1992, 3 m, 193 m2
    ["w1435276703", "c", "b", 9, 0, "m"],
    // De Nieuwe Stad, 1992, 9 m, 592 m2
    ["w1465800049", "c", "h", 10.3, 4.7, "o"],
    // Sint Urbanus, 1820, 15 m, 81 m2
    ["w1465800050", "c", "w", 6, 0, "o"],
    // Sint Urbanus, 1820, 6 m, 80 m2
    ["w1465800052", "c", "w", 6, 0, "o"],
    // Sint Urbanus, 1820, 6 m, 63 m2
    ["w1465800053", "c", "h", 10.3, 4.7, "o"],
    // Sint Urbanus, 1820, 15 m, 295 m2
    ["w1465800056", "c", "b", 3, 0, "o"],
    // Sint Urbanus, 1820, 3 m, 35 m2
    ["w1465800058", "c", "h", 10.2, 4.8, "o"],
    // Sint Urbanus, 1820, 15 m, 227 m2
    ["w174987150", "c", "w", 15, 0, "o"],
    // (unnamed), 1380, 15 m, 596 m2
    ["w276686506", "c", "h", 5.1, 3.9, "o"],
    // Avontuur, 9 m, 182 m2
    ["w282293967", "c", "w", 3, 0, "o"],
    // Koninkrijkszaal van Jehovah s Getuigen, 3 m, 112 m2
    ["w282293972", "c", "b", 11.9, 0, "m"],
    // Koninkrijkszaal van Jehovah s Getuigen, 1998, 11.9 m, 337 m2
    ["w314261187", "c", "w", 9, 0, "o"],
    // Augustanahof, 9 m, 475 m2
    ["w330159868", "c", "h", 5, 4, "o"],
    // Calvariekerk, 9 m, 497 m2
    ["w57858486", "c", "h", 5, 7.7, "e"],
    // (unnamed), 1957, 12.7 m, 659 m2
    ["w57860431", "c", "b", 35, 0, "m"],
    // Kerk van Ransdorp, 1985, 35 m, 349 m2
    ["w747868957", "c", "b", 7, 0, "o"],
    // Old Church, 1300, 7 m, 13 m2
    ["w747868958", "c", "b", 10, 0, "o"],
    // Old Church, 1300, 10 m, 13 m2
    ["w747868959", "c", "b", 9, 0, "o"],
    // Old Church, 1300, 9 m, 28 m2
    ["w747868960", "c", "b", 10, 0, "o"],
    // Oude Kerk, 1300, 10 m, 39 m2
    ["w747868962", "c", "b", 15, 0, "o"],
    // Oude Kerk, 1300, 15 m, 38 m2
    ["w747868963", "c", "b", 15, 0, "o"],
    // Oude Kerk, 1300, 15 m, 38 m2
    ["w747868964", "c", "b", 15, 0, "o"],
    // Oude Kerk, 1300, 15 m, 37 m2
    ["w747868965", "c", "b", 15, 0, "o"],
    // Oude Kerk, 1300, 15 m, 37 m2
    ["w747868966", "c", "b", 15, 0, "o"],
    // Oude Kerk, 1300, 15 m, 38 m2
    ["w747868968", "c", "b", 17, 0, "o"],
    // Old Church, 1300, 17 m, 13 m2
    ["w747868969", "c", "b", 17, 0, "o"],
    // Old Church, 1300, 17 m, 15 m2
    ["w747868985", "c", "b", 23, 0, "o"],
    // Oude Kerk, 1300, 23 m, 60 m2
    ["w747868986", "c", "b", 23, 0, "o"],
    // Oude Kerk, 1300, 23 m, 59 m2
    ["w747868987", "c", "h", 15, 8, "o"],
    // Oude Kerk, 1300, 23 m, 220 m2
    ["w747868988", "c", "h", 15, 8, "o"],
    // Oude Kerk, 1300, 23 m, 199 m2
    ["w747868989", "c", "h", 15, 8, "o"],
    // Oude Kerk, 1300, 23 m, 116 m2
    ["w747868990", "c", "b", 23, 0, "o"],
    // Oude Kerk, 1300, 23 m, 105 m2
    ["w747868991", "c", "b", 23, 0, "o"],
    // Oude Kerk, 1300, 23 m, 105 m2
    ["w747868992", "c", "b", 23, 0, "o"],
    // Oude Kerk, 1300, 23 m, 62 m2
    ["w747868993", "c", "b", 23, 0, "o"],
    // Oude Kerk, 1300, 23 m, 63 m2
    ["w747868994", "c", "b", 23, 0, "o"],
    // Oude Kerk, 1300, 23 m, 100 m2
    ["w747868995", "c", "h", 15, 8, "o"],
    // Oude Kerk, 1300, 23 m, 697 m2
    ["w747911435", "c", "h", 14.6, 4.4, "o"],
    // (unnamed), 1380, 19 m, 102 m2
    ["w747911440", "c", "b", 34, 0, "o"],
    // (unnamed), 1380, 34 m, 151 m2
    ["w747924617", "c", "b", 19, 0, "o"],
    // (unnamed), 1380, 19 m, 39 m2
    ["w747924618", "c", "b", 19, 0, "o"],
    // (unnamed), 1380, 19 m, 36 m2
    ["w747924619", "c", "b", 19, 0, "o"],
    // (unnamed), 1380, 19 m, 34 m2
    ["w747924621", "c", "b", 19, 0, "o"],
    // (unnamed), 1380, 19 m, 46 m2
    ["w747924622", "c", "b", 19, 0, "o"],
    // (unnamed), 1380, 19 m, 49 m2
    ["w747924623", "c", "b", 19, 0, "o"],
    // (unnamed), 1380, 19 m, 44 m2
    ["w747924624", "c", "b", 19, 0, "o"],
    // (unnamed), 1380, 19 m, 48 m2
    ["w747924625", "c", "b", 19, 0, "o"],
    // (unnamed), 1380, 19 m, 52 m2
    ["w748997142", "c", "h", 6.4, 3.6, "o"],
    // (unnamed), 10 m, 118 m2
    ["w748997143", "c", "b", 34, 0, "o"],
    // New Church, 1380, 34 m, 5 m2
    ["w748997144", "c", "b", 34, 0, "o"],
    // New Church, 1380, 34 m, 5 m2
    ["w749242499", "c", "b", 6, 0, "o"],
    // Old Church, 1300, 6 m, 7 m2
    ["w749242500", "c", "b", 7, 0, "o"],
    // Old Church, 1300, 7 m, 19 m2
    ["w749242501", "c", "b", 7, 0, "o"],
    // Oude Kerk, 1300, 7 m, 32 m2
    ["w749287964", "c", "w", 5, 0, "o"],
    // Westerkerk, 5 m, 295 m2
    ["w749356521", "c", "b", 19, 0, "o"],
    // Waalse kerk, 1496, 19 m, 73 m2
    ["w749356522", "c", "h", 9.3, 3.7, "o"],
    // Waalse kerk, 1496, 13 m, 232 m2
    ["w749356523", "c", "h", 13.4, 5.6, "o"],
    // Waalse kerk, 1496, 19 m, 401 m2
    ["w749386975", "c", "b", 4.5, 0, "o"],
    // Walloon Church, 1496, 4.5 m, 13 m2
    ["w749386976", "c", "h", 9.7, 3.3, "o"],
    // Waalse kerk, 1496, 13 m, 206 m2
    ["w749871267", "c", "w", 4, 0, "o"],
    // Noorderkerk, 1622, 4 m, 93 m2
    ["w750036045", "c", "h", 8.1, 9.9, "o"],
    // Posthoornkerk, 1673, 18 m, 390 m2
    ["w750036046", "c", "b", 26, 0, "o"],
    // Posthoornkerk, 1673, 26 m, 49 m2
    ["w750036047", "c", "b", 54, 0, "o"],
    // Posthoornkerk, 1673, 54 m, 32 m2
    ["w750036048", "c", "b", 54, 0, "o"],
    // Posthoornkerk, 1673, 54 m, 33 m2
    ["w750036049", "c", "b", 26, 0, "o"],
    // Posthoornkerk, 1673, 26 m, 136 m2
    ["w750036050", "c", "b", 26, 0, "o"],
    // Posthoornkerk, 1673, 26 m, 117 m2
    ["w750036051", "c", "h", 21.5, 4.5, "o"],
    // Posthoornkerk, 1673, 26 m, 297 m2
    ["w750093275", "c", "h", 11.9, 4.1, "o"],
    // Posthoornkerk, 1673, 16 m, 186 m2
    ["w750093276", "c", "b", 23, 0, "o"],
    // Posthoornkerk, 1673, 23 m, 47 m2
    ["w750093277", "c", "b", 23, 0, "o"],
    // Posthoornkerk, 1673, 23 m, 47 m2
    ["w750093278", "c", "b", 26, 0, "o"],
    // Posthoornkerk, 1673, 26 m, 68 m2
    ["w995323510", "c", "b", 49, 0, "e"],
    // Vredeskerk, 1925, 49 m, 48 m2
    ["w995323511", "c", "b", 40, 0, "e"],
    // Vredeskerk, 1925, 40 m, 45 m2
    ["w995323512", "c", "b", 40, 0, "e"]
    // Vredeskerk, 1925, 40 m, 45 m2
  ];

  // src/canalRecall/worshipBuildings.ts
  var WORSHIP_WALL = { o: "#7a4535", e: "#83503d", m: "#9b7a62" };
  var FIT_COVERAGE = 0.78;
  var FIT_MAX_DEV_M = 6;
  var round1 = (v) => Math.round(v * 10) / 10;
  function worshipWindows(eavesM) {
    const z0 = Math.max(1.5, eavesM * 0.22), z1 = Math.min(eavesM - 1, z0 + 9);
    if (z1 - z0 < 2.5) return [];
    const widthM = Math.min(1.8, Math.max(0.9, (z1 - z0) / 3.2));
    return [{ z0: round1(z0), z1: round1(z1), widthM: round1(widthM), bayM: round1(Math.max(3.2, widthM * 2.6)), head: "round" }];
  }
  var KIND_NAME = { c: "church", m: "mosque", s: "synagogue", t: "temple" };
  function worshipKit([id, kind, mode, eavesM, riseM, era]) {
    const name = `Generic ${KIND_NAME[kind]} ${id}`, hex2 = WORSHIP_WALL[era];
    const rows = worshipWindows(eavesM);
    if (mode === "b" || mode === "w" && !rows.length) return { name, wall: { plain: true, hex: hex2 }, tiers: [], stacks: [], roofs: [], body: [id] };
    return {
      name,
      wall: { plain: true, hex: hex2 },
      tiers: [],
      stacks: [],
      roofs: [],
      halls: [{ id, widthM: 0, anchor: [0, 0], fit: mode === "h", eavesM, riseM, mat: era === "o" ? "slate" : "tile", windows: rows.length ? { rows, glassHex: "#3a434c" } : void 0 }]
    };
  }
  var GENERIC_WORSHIP_KITS = WORSHIP_BUILDINGS.map(worshipKit);

  // src/canalRecall/landmarkKits.ts
  var MAT_HEX = {
    brick: "#9a5240",
    blue: "#3f5f9a",
    stone: "#cfc2a6",
    lead: "#4d535c",
    gold: "#d9b24c",
    copper: "#6aa896",
    slate: "#4a525d",
    white: "#efe9db",
    tile: "#b5543a"
  };
  var CROWN = [
    { shape: "octagon", w0: 5, w1: 4.5, h: 1.2, mat: "gold" },
    { shape: "octagon", w0: 4.5, w1: 4.5, h: 1.1, mat: "blue" },
    { shape: "octagon", w0: 4.5, w1: 2, h: 2.4, mat: "gold" },
    { shape: "octagon", w0: 1.6, w1: 1.6, h: 1, mat: "gold" },
    { shape: "octagon", w0: 0.9, w1: 0, h: 1.8, mat: "gold" }
  ];
  var HAND_KITS = [
    {
      // Tower 87 m: brick base, stone clock stage, octagonal stone and lead stages, lantern, crown.
      name: "Westerkerk",
      wall: { plain: true, hex: "#8a4b38" },
      tiers: [
        { id: "w751083599", shape: "square", mat: "brick" },
        { id: "w751083598", shape: "square", mat: "stone", clocks: true },
        { id: "w751083596", shape: "octagon", mat: "stone" },
        { id: "w751083597", shape: "octagon", mat: "lead" },
        { id: "w751083595", shape: "octagon", mat: "lead" }
      ],
      stacks: [{ onId: "w751083595", stages: CROWN }],
      roofs: [
        { id: "w749268118", riseM: 8, mat: "slate" },
        { id: "w749268117", riseM: 7, mat: "slate" },
        { id: "w749268116", riseM: 7, mat: "slate" },
        { id: "w749268115", riseM: 4, mat: "slate" }
      ],
      // BAG's own record for the church's east end (NL.IMBAG.Pand.0363100012164998, BAG year 1990): a 1.8 x 10 m sliver 35 m tall that stood as a bare beige slab beside
      // the OSM nave parts. Walled in the kit's brick to the nave's 27 m eaves under a slim slate ridge.
      halls: [{ id: "NL.IMBAG.Pand.0363100012164998", widthM: 1.9, anchor: [4.884358, 52.374554], eavesM: 27, riseM: 1.5, mat: "slate" }]
    },
    {
      // The tower is 80 m; OSM stops at 30, so the octagonal stage, lantern and needle spire are stacked on.
      name: "Zuiderkerk",
      wall: { plain: true, hex: "#8a4b38" },
      tiers: [{ id: "w749385556", shape: "square", mat: "brick" }],
      stacks: [{ onId: "w749385556", stages: [
        { shape: "octagon", w0: 9, w1: 7.4, h: 14, mat: "stone" },
        { shape: "octagon", w0: 6.6, w1: 6.6, h: 8, mat: "lead" },
        { shape: "octagon", w0: 6.2, w1: 0.5, h: 26, mat: "lead" },
        { shape: "octagon", w0: 0.8, w1: 0, h: 3, mat: "gold" }
      ] }],
      roofs: [{ id: "w749385558", riseM: 6, mat: "slate" }, { id: "w749385557", riseM: 4, mat: "tile" }]
    },
    {
      // 47 m: brick base, white octagonal stages with clocks, a lead lantern and a spire.
      name: "Montelbaanstoren",
      tiers: [
        { id: "w751647820", shape: "square", mat: "brick" },
        { id: "w751647819", shape: "octagon", mat: "white", clocks: true },
        { id: "w751647818", shape: "octagon", mat: "white" },
        { id: "w751647817", shape: "octagon", mat: "lead" }
      ],
      stacks: [{ onId: "w751647817", stages: [
        { shape: "octagon", w0: 3.4, w1: 0.5, h: 7.5, mat: "lead" },
        { shape: "octagon", w0: 1.1, w1: 1.1, h: 0.9, mat: "gold" },
        { shape: "octagon", w0: 0.8, w1: 0, h: 1.2, mat: "gold" }
      ] }],
      roofs: []
    },
    {
      // A Greek cross: two naves crossing, a small turret and spire above the crossing.
      name: "Noorderkerk",
      wall: { plain: true, hex: "#8f5a40" },
      tiers: [
        { id: "w749871263", shape: "octagon", mat: "white" },
        { id: "w749871262", shape: "octagon", mat: "lead" }
      ],
      stacks: [{ onId: "w749871262", stages: [{ shape: "octagon", w0: 2.2, w1: 0, h: 6.5, mat: "lead" }] }],
      roofs: [{ id: "w749269858", riseM: 8, mat: "slate" }, { id: "w749269859", riseM: 8, mat: "slate" }]
    },
    {
      // The cupola 51 m up: stone drum, copper dome, lantern, gilt ship weathervane.
      name: "Royal Palace",
      wall: { plain: false, style: "canal", hex: "#cdc2a8" },
      tiers: [{ id: "w748659171", shape: "octagon", mat: "white", z1: 40, columns: 8 }],
      stacks: [{ onId: "w748659171", startZ: 40, stages: [
        { shape: "octagon", w0: 9.6, w1: 8.8, h: 1.4, mat: "copper" },
        { shape: "octagon", w0: 8.8, w1: 6.6, h: 1.6, mat: "copper" },
        { shape: "octagon", w0: 6.6, w1: 3.4, h: 1.6, mat: "copper" },
        { shape: "octagon", w0: 3.4, w1: 1.7, h: 1.2, mat: "copper" },
        { shape: "octagon", w0: 1.7, w1: 1.7, h: 3, mat: "white" },
        { shape: "octagon", w0: 1.9, w1: 0, h: 3.4, mat: "gold" }
      ] }],
      roofs: ["w748659181", "w748659182", "w748659172", "w748659173", "w748659174", "w748659175", "w748659183", "w748659170", "w748659180"].map((id) => ({ id, riseM: 5, mat: "lead" }))
    },
    {
      // Two round corner towers with conical roofs, two turrets, and steep roofs on the main body.
      name: "Waag",
      tiers: ["w749066949", "w749066950", "w749066946", "w749066947"].map((id) => ({ id, shape: "octagon", mat: "brick" })),
      stacks: [
        ...["w749066949", "w749066950"].map((onId) => ({ onId, stages: [{ shape: "octagon", w0: 9, w1: 0.8, h: 10, mat: "slate" }] })),
        ...["w749066946", "w749066947"].map((onId) => ({ onId, stages: [{ shape: "octagon", w0: 5.2, w1: 0.5, h: 5.5, mat: "slate" }] }))
      ],
      roofs: ["w749066938", "w749066939", "w749066942", "w749066948", "w749066940"].map((id) => ({ id, riseM: 6, mat: "slate" }))
    },
    {
      // Berlage's Beurs: a brick clock tower with a pyramid cap, and long steep-roofed halls.
      // The Beursplein hall's eaves sit on its gable row at 15.5 m (front in landmarkFrontData.ts), so its roof rises 11.5 m.
      name: "Beurs van Berlage",
      wall: { plain: true, hex: "#9a5240" },
      tiers: [{ id: "w749918639", shape: "square", mat: "brick" }],
      stacks: [{ onId: "w749918639", stages: [{ shape: "square", w0: 12.5, w1: 0.6, h: 11, mat: "slate" }] }],
      // The hall roofs start on the gable row at 15.5 m: rise = part height - 15.5 (641 in the raw extract, 642/645 in the game tiles).
      roofs: [
        ...["w749918651", "w749918653", "w749918637", "w749918638"].map((id) => ({ id, riseM: 7, mat: "slate" })),
        { id: "w749918641", riseM: 11.5, mat: "slate" },
        { id: "w749918642", riseM: 9.5, mat: "slate" },
        { id: "w749918645", riseM: 8.5, mat: "slate" }
      ]
    },
    {
      // Centraal's twin towers: square brick shafts with gilt dials (the west one a clock, the
      // east one a wind dial), a stone band, an open lead lantern and a slim spire each.
      name: "Centraal",
      wall: { plain: true, hex: "#9a5a45" },
      tiers: ["w752653568", "w752653567"].map((id) => ({ id, shape: "square", mat: "brick", z1: 27, clocks: true })),
      stacks: ["w752653568", "w752653567"].map((onId) => ({ onId, startZ: 27, stages: [
        { shape: "square", w0: 7.6, w1: 7.6, h: 1.2, mat: "stone" },
        { shape: "octagon", w0: 5.2, w1: 4.8, h: 4.2, mat: "lead" },
        { shape: "octagon", w0: 5.6, w1: 0.6, h: 4.6, mat: "lead" },
        { shape: "octagon", w0: 0.6, w1: 0, h: 1.6, mat: "gold" }
      ] })),
      roofs: [],
      body: ["w451533147", "w451533145", "w1239767708", "w424523117", "w451533149", "w506192827", "w752653562", "w752653565", "w752653571", "w752653572", "w752738611", "w1239767712", "w1239767716", "w1239767717", "w1239767718", "w1239767719", "w1239767720", "w1239767721", "w1239767722", "w1239767723", "w1239767724", "w1239767725", "w1239767726", "w1240155430", "w1240155433", "w1240155434", "w752286896", "w752286897", "w752286898", "w752328419", "w752328422", "w752653574", "w1239767701", "w1239767703", "w1239767706", "w1239767709", "w589499178", "w752328416", "w752328417", "w752328418", "w752328420", "w752653566", "w752653570", "w752653573", "w752738610", "w1239767711", "w1239767713", "w1239767714", "w1239767715", "w1240155431", "w1240155435", "w1240314141", "w1240314142", "w752328423", "w752328424", "w752328425", "w752328426", "w752653575", "w1239767702"]
    },
    {
      // Rijksmuseum: two central towers with steep slate spires over the gate, four corner
      // turrets with spires, steep roofs on the main wings. Cuypers' red brick.
      name: "Rijksmuseum",
      wall: { plain: false, style: "school", hex: "#9a4f3c" },
      tiers: [
        ...["w749429998", "w749429999"].map((id) => ({ id, shape: "square", mat: "brick", z1: 38 })),
        ...["w749805757", "w749805758", "w749805760", "w749805761"].map((id) => ({ id, shape: "square", mat: "brick", z1: 33 }))
      ],
      stacks: [
        ...["w749429998", "w749429999"].map((onId) => ({ onId, startZ: 38, stages: [
          { shape: "square", w0: 13.4, w1: 13.4, h: 1.1, mat: "stone" },
          { shape: "square", w0: 12.4, w1: 0.6, h: 14, mat: "slate" },
          { shape: "octagon", w0: 0.6, w1: 0, h: 1.4, mat: "gold" }
        ] })),
        ...["w749805757", "w749805758", "w749805760", "w749805761"].map((onId) => ({ onId, startZ: 33, stages: [
          { shape: "square", w0: 7.4, w1: 7.4, h: 0.8, mat: "stone" },
          { shape: "square", w0: 6.8, w1: 0.4, h: 8.4, mat: "slate" },
          { shape: "octagon", w0: 0.4, w1: 0, h: 1, mat: "gold" }
        ] }))
      ],
      roofs: ["w749430000", "w749430001", "w749429988"].map((id) => ({ id, riseM: 8, mat: "slate" })),
      body: ["NL.IMBAG.Pand.0363100012235882", "w431070791", "w431070942", "w517791046", "w749429987", "w749429989", "w749429991", "w749429992", "w749429993", "w749429994", "w749429995", "w749429996", "w749429997", "w749805753", "w749805756", "w749805759", "w749805762", "w749429990", "w749805754", "w749805755", "w749805763", "w749805764", "NL.IMBAG.Pand.0363100012229949", "NL.IMBAG.Pand.0363100012157857", "NL.IMBAG.Pand.0363100012194197", "NL.IMBAG.Pand.0363100012236686"]
    },
    {
      // Sint-Nicolaasbasiliek: twin west towers with octagonal lanterns and small domes, and the
      // crossing dome on its drum with a lantern. Dark brick, lead and copper.
      name: "Sint-Nicolaas",
      wall: { plain: true, hex: "#7a4636" },
      tiers: [
        ...["w645534930", "w645534931"].map((id) => ({ id, shape: "square", mat: "brick", z1: 43 })),
        { id: "w749289632", shape: "octagon", mat: "brick", z0: 24, z1: 39, columns: 8 }
      ],
      stacks: [
        ...["w645534930", "w645534931"].map((onId) => ({ onId, startZ: 43, stages: [
          { shape: "octagon", w0: 5.6, w1: 5.4, h: 6, mat: "brick" },
          { shape: "octagon", w0: 6.2, w1: 2.2, h: 3.4, mat: "copper" },
          { shape: "octagon", w0: 1.4, w1: 0, h: 2.2, mat: "copper" },
          { shape: "octagon", w0: 0.4, w1: 0, h: 1.2, mat: "gold" }
        ] })),
        { onId: "w749289632", startZ: 39, stages: [
          { shape: "octagon", w0: 13.6, w1: 11.4, h: 4, mat: "copper" },
          { shape: "octagon", w0: 11.4, w1: 6.4, h: 4.4, mat: "copper" },
          { shape: "octagon", w0: 6.4, w1: 2.6, h: 2.6, mat: "copper" },
          { shape: "octagon", w0: 2.4, w1: 2.2, h: 3.4, mat: "white" },
          { shape: "octagon", w0: 2.8, w1: 0, h: 2.4, mat: "copper" },
          { shape: "octagon", w0: 0.5, w1: 0, h: 1, mat: "gold" }
        ] }
      ],
      roofs: [{ id: "w749289633", riseM: 8, mat: "slate" }, { id: "w749289634", riseM: 8, mat: "slate" }],
      hides: ["w750217062", "w750591090"],
      body: ["w750217059", "w750217060", "w750217061", "w750217063", "w750217064", "w750591088"]
    },
    {
      // Munttoren: an octagonal brick and stone tower with clocks on the old Regulierspoort
      // base, an open lantern and Hendrick de Keyser's spire.
      name: "Munttoren",
      tiers: [
        { id: "w751698384", shape: "octagon", mat: "brick", z1: 14, clocks: true },
        { id: "w751698383", shape: "octagon", mat: "white", z0: 14, z1: 19 },
        { id: "w751698382", shape: "octagon", mat: "lead", z0: 19, z1: 23 }
      ],
      stacks: [{ onId: "w751698382", stages: [
        { shape: "octagon", w0: 3.8, w1: 3.4, h: 3, mat: "white" },
        { shape: "octagon", w0: 3.6, w1: 0.3, h: 7.5, mat: "lead" },
        { shape: "octagon", w0: 0.5, w1: 0, h: 1.2, mat: "gold" }
      ] }],
      roofs: []
    },
    {
      // De Krijtberg (Sint-Franciscus Xaveriuskerk): two slender neo-Gothic towers with tall
      // slate spires on the Singel front, a steep nave roof behind.
      name: "Krijtberg",
      wall: { plain: true, hex: "#7a4a3a" },
      tiers: ["w751905304", "w751905305"].map((id) => ({ id, shape: "octagon", mat: "brick", z1: 33 })),
      stacks: ["w751905304", "w751905305"].map((onId) => ({ onId, startZ: 33, stages: [
        { shape: "octagon", w0: 4.6, w1: 4.6, h: 0.8, mat: "stone" },
        { shape: "octagon", w0: 4.2, w1: 0.3, h: 15, mat: "slate" },
        { shape: "octagon", w0: 0.4, w1: 0, h: 1.8, mat: "gold" }
      ] })),
      roofs: [{ id: "w751713223", riseM: 10, mat: "slate" }, { id: "w751713221", riseM: 10, mat: "slate" }],
      body: ["w751713218", "w751713219", "w751713220", "w751713222", "w751905303", "w751979070"]
    },
    {
      // Oude Kerk: the brick tower base with clocks, then octagonal lead stages, an open
      // lantern and the spire; steep roofs over the hall church and its chapels.
      name: "Oude Kerk",
      wall: { plain: true, hex: "#8a5a44" },
      tiers: [
        { id: "w747868982", shape: "square", mat: "brick", clocks: true },
        { id: "w747868971", shape: "octagon", mat: "lead" }
      ],
      stacks: [{ onId: "w747868971", stages: [
        { shape: "octagon", w0: 6, w1: 5.4, h: 5, mat: "lead" },
        { shape: "octagon", w0: 4.6, w1: 4.2, h: 4, mat: "white" },
        { shape: "octagon", w0: 4.4, w1: 0.3, h: 8.5, mat: "lead" },
        { shape: "octagon", w0: 0.5, w1: 0, h: 1.2, mat: "gold" }
      ] }],
      roofs: [
        ...["w747868974", "w747868975"].map((id) => ({ id, riseM: 9, mat: "slate" })),
        ...["w747868972", "w747868973", "w747868976", "w747868977", "w747868978", "w747868979", "w747868980", "w747868981", "w747868984"].map((id) => ({ id, riseM: 5.5, mat: "slate" }))
      ],
      hides: ["w747868970"]
    },
    {
      // Nieuwe Kerk on the Dam: towering nave and transept roofs (the tower was never built)
      // with a slim lead flèche over the crossing; lower aisle and chapel roofs.
      name: "Nieuwe Kerk",
      wall: { plain: true, hex: "#8f5d48" },
      tiers: [],
      stacks: [{ onId: "w747911439", startZ: 34, stages: [
        { shape: "octagon", w0: 2.6, w1: 2.2, h: 3.2, mat: "lead" },
        { shape: "octagon", w0: 2.4, w1: 0, h: 8, mat: "lead" },
        { shape: "octagon", w0: 0.4, w1: 0, h: 1, mat: "gold" }
      ] }],
      roofs: [
        { id: "w747911441", riseM: 14, mat: "slate" },
        { id: "w747911439", riseM: 14, mat: "slate" },
        { id: "w747911438", riseM: 5, mat: "slate" },
        ...["w747911436", "w747911437", "w747924626"].map((id) => ({ id, riseM: 6, mat: "slate" }))
      ]
    },
    {
      // NEMO: Renzo Piano's copper-green ship rising out of the IJ tunnel mouth; its colour is
      // the recognisable part, so the whole building is walled in patinated copper.
      name: "NEMO",
      wall: { plain: true, hex: "#4f9a82", flat: true },
      tiers: [],
      stacks: [],
      roofs: [],
      body: ["w1390692763", "w1390692767", "w1390692768", "w1390692769", "w1390692770", "w1390692771", "w1390692772", "w1390692766", "w1390692764", "w1390692765"]
    },
    // Museums and cinemas: the Van Gogh Museum, the Stedelijk, Eye, Tuschinski, the Maritime Museum, H'ART (museumKits.ts).
    ...MUSEUM_KITS,
    // Places of worship modelled by hand (worshipKits.ts), and the generic treatment for the rest (worshipBuildings.ts).
    ...WORSHIP_KITS,
    {
      // De Hallen, the 1902-05 Tollensstraat tram depot (user report 2026-10-02: one bare tan
      // block). One BAG footprint over a row of brick sheds about 9.6 m wide, whose gable ends
      // step back 6 m each along the Bellamyplein side (the footprint's 9.6 m / 6 m step edges).
      name: "De Hallen",
      wall: { plain: false, style: "school", hex: "#9a5844" },
      tiers: [],
      stacks: [],
      roofs: [],
      halls: [{ id: "NL.IMBAG.Pand.0363100012236693", widthM: 9.62, anchor: [4.868004, 52.367613], eavesM: 7.2, riseM: 3.4, mat: "slate" }]
    },
    {
      // Fatih mosque, Rozengracht 150: H.W. Valk's 1929 Sint-Ignatiuskerk (user report 2026-10-02:
      // a 37 m green box). One BAG footprint whose BAG height is the towers', so the whole block
      // stood at tower height in a hash-picked colour. Dark brown brick nave with its gable to the
      // street between twin square towers, 40 m with their slate pyramid caps (Commons photo
      // "Fatihmosquewesterkerkamsterdam.jpg"; nl.wikipedia: "dubbeltorenfront van 40 meter").
      // The towers stand inside the front corners (Rozengracht runs along the footprint's 30.6 m
      // south front, bearing 68 degrees).
      name: "Fatih",
      wall: { plain: true, hex: "#6a3a2e" },
      tiers: [],
      stacks: [],
      roofs: [],
      halls: [{
        id: "NL.IMBAG.Pand.0363100012167944",
        widthM: 30.6,
        anchor: [4.878429, 52.372973],
        eavesM: 16,
        riseM: 9,
        mat: "slate",
        towers: [
          { at: [4.878461, 52.373017], widthM: 7.5, z1: 31, capM: 8.5, cap: "slate" },
          { at: [4.878772, 52.373095], widthM: 7.5, z1: 31, capM: 8.5, cap: "slate" }
        ],
        // Openings read off Commons "Fatih moskee, Amsterdam 69.jpg" (the front, scaled by its 4.5 m
        // door arches) and "Fatihmosquewesterkerkamsterdam.jpg" (the towers): three pointed door
        // arches, four round-headed windows over them, a 3.6 m rose with star tracery in the gable,
        // paired windows up each tower and a row of five belfry arches under the cornice. The photos
        // show round heads, not pointed ones, everywhere but the doors. The nave's long walls stand
        // behind 10-16 m neighbours; their tall windows are a guess from the plan, not a photo.
        windows: {
          glassHex: "#46505a",
          frameHex: "#c9bda4",
          // `at` points sit on the front wall: its middle, and in front of each tower.
          rows: [
            { z0: 0.3, z1: 4.6, widthM: 2.6, bayM: 3.1, head: "pointed", at: [4.8786371, 52.3730248], count: 3 },
            { z0: 7.7, z1: 10.9, widthM: 1, bayM: 1.9, head: "round", at: [4.8786371, 52.3730248], count: 4 },
            ...[[4.8784814, 52.372986], [4.8787927, 52.3730635]].flatMap((at) => [
              { z0: 5.6, z1: 8.4, widthM: 0.85, bayM: 1.3, head: "flat", at, count: 2 },
              { z0: 9.6, z1: 12.2, widthM: 0.85, bayM: 1.3, head: "flat", at, count: 2 },
              { z0: 13.6, z1: 15.6, widthM: 0.85, bayM: 1.3, head: "round", at, count: 2 }
            ]),
            { z0: 6, z1: 13.5, widthM: 1.5, bayM: 4.5, head: "round" }
          ],
          roses: [{ at: [4.8786371, 52.3730248], z: 16, radiusM: 1.8 }],
          towerRows: [
            { z0: 18, z1: 20.8, widthM: 0.85, bayM: 1.3, head: "round", count: 2 },
            { z0: 27.4, z1: 29.8, widthM: 0.75, bayM: 1.3, head: "round", count: 5 }
          ]
        }
      }]
    },
    {
      // Obrechtkerk, Jacob Obrechtstraat: Jos Cuypers and Jan Stuyt's 1908-11 neo-Romanesque cross
      // basilica (BAG height 36.3 m is the twin towers', carried by the whole 2075 m2 footprint).
      // Commons "Obrechtkerk.jpg" (RCE view of the front): two square brown-grey brick towers with
      // arched belfries and a steep banded cap each, red-tile roofs behind; nl.wikipedia: "een front
      // ... geflankeerd door twee rijzige torens, en met een lagere vieringtoren aan de westkant".
      // The footprint is a Latin cross on an axis of 24 degrees with the front to the east: a 24 m
      // wide nave, a 30 m wide transept block, a choir block with the apse, and a 15 m annex at the
      // south east corner. The towers fill the two front corners (7 m wide, an 11 m porch between);
      // the crossing tower (10 m, tiled pyramid) stands over the transept, lower than the front.
      name: "Obrechtkerk",
      wall: { plain: true, hex: "#7d6858" },
      tiers: [],
      stacks: [],
      roofs: [],
      halls: [{
        id: "NL.IMBAG.Pand.0363100012124153",
        widthM: 0,
        anchor: [4.874498, 52.35549],
        eavesM: 15,
        riseM: 8,
        mat: "tile",
        wings: [
          { at: [4.87496, 52.355863], lenM: 30.3, widM: 24.4, bearingDeg: 24, riseM: 8 },
          { at: [4.874639, 52.355771], lenM: 37.9, widM: 17.9, bearingDeg: 114, riseM: 6 },
          { at: [4.874436, 52.355718], lenM: 42.1, widM: 12, bearingDeg: 114, riseM: 4.3 },
          { at: [4.875291, 52.35577], lenM: 15.1, widM: 12.5, bearingDeg: 24, riseM: 4.2 }
        ],
        towers: [
          // Front towers: walls to 27 m, a banded spire cap 7.7 m with its cross (36.3 m in all).
          { at: [4.875065, 52.355978], widthM: 7, z1: 27, capM: 7.7, cap: "slate", capShape: "spire", capHex: "#665a50", bearingDeg: 24 },
          { at: [4.875169, 52.355834], widthM: 7, z1: 27, capM: 7.7, cap: "slate", capShape: "spire", capHex: "#665a50", bearingDeg: 24 },
          { at: [4.874637, 52.355775], widthM: 10, z1: 22, capM: 6.5, cap: "tile", bearingDeg: 24 }
        ]
      }]
    },
    {
      // Oosterkerk, Wittenburgergracht: Daniel Stalpaert's 1669-71 Greek-cross church (BAG height
      // 26.9 m is the lantern with its weathervane). Commons "Oosterkerk-amsterdam-wittenburg.jpg":
      // brown brick, tall slate hipped roofs on four arms meeting at the crossing, and a lead-clad
      // wooden lantern with an open belfry and a dome; nl.wikipedia: "gelijkarmig kruis ... Op de
      // kruising van de hoge schilddaken staat een met lood beklede houten koepeltoren". The
      // footprint is a 29 m square (corners filled in) with arms 14 m wide running out 5 m
      // beyond it on a 45 degree axis. Eaves at 14 m and ridges at 19 m read off the photo
      // (the hipped end reaches 4.5 m above the cornice); the lantern runs from the ridges to 25 m.
      name: "Oosterkerk",
      wall: { plain: true, hex: "#8c5b46" },
      tiers: [],
      stacks: [],
      roofs: [],
      halls: [{
        id: "NL.IMBAG.Pand.0363100012170274",
        widthM: 0,
        anchor: [4.919276, 52.369762],
        eavesM: 14,
        riseM: 5,
        mat: "slate",
        wings: [
          { at: [4.91931, 52.369991], lenM: 39.1, widM: 13.9, bearingDeg: 45, riseM: 5, roof: "hipped" },
          { at: [4.91931, 52.369991], lenM: 32.5, widM: 14.5, bearingDeg: 135, riseM: 5, roof: "hipped" }
        ],
        towers: [
          // The belfry (lead grey, octagonal, from the ridge up) and its dome with a small lantern: 26.8 m.
          { at: [4.91931, 52.369991], widthM: 5.4, z0: 17.5, z1: 22.5, capM: 2.7, cap: "lead", shape: "octagon", mat: "lead", wallHex: "#5f6670", capShape: "dome", capHex: "#8d939b", bearingDeg: 45 }
        ]
      }]
    },
    {
      // Mozes en Aäronkerk, Waterlooplein: Suys' 1837-41 neoclassical church. Commons
      // "Mozes_en_Aaronkerk_1.jpg": a cream stuccoed front with a four-column portico between two
      // open timber towers, brown brick flanks under a very low roof; nl.wikipedia: "facade met
      // twee torens", "driebeukige hallenkerk", "bakstenen zijgevels". BAG height 24.4 m is a blend.
      // The footprint is 23 x 44.6 m (front at the south west end, where two 6.5 m blocks flank
      // the portico recess). Walls 15 m, ridge 18.5 m; towers 31.4 m of cream stucco with a slate
      // cap and cross, 33 m in all (photo: columns 10 m against a 33 m cross).
      name: "Mozes en A\xE4ronkerk",
      wall: { plain: true, hex: "#7c5a4a" },
      tiers: [],
      stacks: [],
      roofs: [],
      halls: [{
        id: "NL.IMBAG.Pand.0363100012253765",
        widthM: 0,
        anchor: [4.902946, 52.368211],
        eavesM: 15,
        riseM: 3.5,
        mat: "slate",
        wings: [{ at: [4.903287, 52.368335], lenM: 40.6, widM: 23, bearingDeg: 56, riseM: 3.5 }],
        towers: [
          { at: [4.903024, 52.368228], widthM: 6.5, z1: 29.5, capM: 2, cap: "slate", wallHex: "#e3d6a6", bearingDeg: -34 },
          { at: [4.903229, 52.368143], widthM: 6.5, z1: 29.5, capM: 2, cap: "slate", wallHex: "#e3d6a6", bearingDeg: -34 }
        ]
      }]
    },
    {
      // De Duif (Sint-Willibrorduskerk), Prinsengracht 756: Theo Molkenboer's 1857 neoclassical
      // church with a neo-baroque front (user report: one bare box). Commons "De Duif (Amsterdam,
      // Q2050495).jpg": grey stuccoed front with pilasters and an arched window under a pediment
      // with a cross, no tower; nl.wikipedia: "neoclassicistische stijl ... neobarokke voorgevel".
      // BAG height 24.5 m is the pediment. The footprint is a plain 46 x 18.6 m nave (the street
      // front is the jagged pilastered short end) under a long pitched roof; walls at 16 m, ridge 22 m.
      name: "De Duif",
      wall: { plain: true, hex: "#a99e8c", flat: true },
      tiers: [],
      stacks: [],
      roofs: [],
      halls: [{
        id: "NL.IMBAG.Pand.0363100012171729",
        widthM: 0,
        anchor: [4.897017, 52.361124],
        eavesM: 16,
        riseM: 6,
        mat: "slate",
        wings: [{ at: [4.896787, 52.361299], lenM: 46.1, widM: 18.6, bearingDeg: 107, riseM: 6 }]
      }]
    },
    {
      // Opstandingskerk, Bos en Lommerplein: Marius Duintjer's 1955-56 church, nicknamed "Kolenkit"
      // for its bell tower. Commons "Overzicht westgevel met kerktoren - Amsterdam - 20357071 -
      // RCE.jpg" (rijksmonument photo): pink-red brick, a low nave under a very shallow gable, and
      // a slab tower 7 m wide whose top is cut on a long slant, high edge up; nl.wikipedia: "48 meter
      // hoge klokkentoren" and "rode baksteen". BAG height (35.2 m) is a blend of the two. The tower
      // is the 7 x 12.5 m strip at the footprint's south end; its top rises 10.5 m from the low
      // (west) edge at 37.5 m to 48 m along the photo's long slope. The nave (11 m walls, a
      // 15 degree roof) roofs the rounded hall; the saw-tooth north wall stays as mapped.
      name: "Opstandingskerk",
      wall: { plain: true, hex: "#b07a63" },
      tiers: [],
      stacks: [],
      roofs: [],
      halls: [{
        id: "NL.IMBAG.Pand.0363100012133302",
        widthM: 0,
        anchor: [4.842514, 52.377448],
        eavesM: 11,
        riseM: 3,
        mat: "lead",
        wings: [{ at: [4.842772, 52.377707], lenM: 31, widM: 22, bearingDeg: 2, riseM: 3 }],
        towers: [
          { at: [4.842958, 52.377514], widthM: 7, lenM: 12.5, z1: 37.5, capM: 10.5, cap: "slate", capShape: "slant", highBearingDeg: 2, bearingDeg: 2 }
        ]
      }]
    },
    {
      // Koninklijk Theater Carré, Amstel 115-125: the 1887 circus building (user 2026-10-03:
      // "Carre looks awful in that shot", one bare 28 m brick slab). One BAG footprint, 58 x 37 m on
      // an axis of 17 degrees, its 37 m front on the Amstel at the west end with an 8 m central
      // risalit standing 1.9 m proud. Commons "Carre_Theatre_2038.jpg" and "Overzicht op Carré gezien
      // vanaf de overzijde van de Amstel - 20408841 - RCE.jpg" (straight on, scaled by the 37 m
      // front): a cream stuccoed neo-Renaissance front, a grey stone ground storey of round arches
      // to 4.5 m, three rows of windows (5-8 m, 9-11.5 m, 14.5-16.5 m), the cornice at 19 m and a
      // pediment over the risalit to 21.5 m. Behind it the whole block sits under one pale zinc
      // cloister dome (Commons "Theater Carre - Amsterdam - 20015613 - RCE.jpg" and "Amsterdam - Amstel -
      // Hoge Sluis - View North towards Carré Theatre.jpg" show its curved sides from the south west)
      // with a flat top and the CARRÉ sign box; BAG 28.3 m is the box's top. The front's
      // ends are pilastered bays, not raised pavilions. The 8.7 m strip on the north (Bridge Hotel)
      // side and its round stair turret keep the eaves under low hipped roofs and the flat lid.
      name: "Carr\xE9",
      wall: { plain: true, hex: "#e2d8c2", flat: true },
      tiers: [],
      stacks: [],
      roofs: [],
      halls: [{
        id: "NL.IMBAG.Pand.0363100012165489",
        widthM: 0,
        anchor: [4.903937, 52.362186],
        eavesM: 19,
        riseM: 8,
        mat: "lead",
        roofHex: "#98a299",
        wings: [
          { at: [4.904268, 52.362423], lenM: 58.3, widM: 37.1, bearingDeg: 17, riseM: 8, roof: "dome", insetM: 13 },
          { at: [4.903873, 52.362349], lenM: 6, widM: 8, bearingDeg: 17, riseM: 2.5 },
          { at: [4.904316, 52.362648], lenM: 31.4, widM: 8.7, bearingDeg: 17, riseM: 1.5, roof: "hipped" },
          { at: [4.904043, 52.362572], lenM: 9.1, widM: 3.4, bearingDeg: 17, riseM: 1, roof: "hipped" }
        ],
        towers: [
          // The CARRÉ sign box on the dome's flat top, behind the pediment: 8.4 m across the front.
          { at: [4.904079, 52.362387], widthM: 3.5, lenM: 8.4, z0: 26.6, z1: 28, capM: 0.3, cap: "lead", capShape: "slant", highBearingDeg: 17, bearingDeg: 17, mat: "white", wallHex: "#ece6da" },
          // The round stair turret at the back (south east) corner: a low zinc cap, a guess (no photo shows it).
          { at: [4.904677, 52.362304], widthM: 7.6, shape: "octagon", z0: 18.4, z1: 19, capM: 1.6, cap: "lead", capShape: "dome", capHex: "#98a299", mat: "white", wallHex: "#e2d8c2", bearingDeg: 17 }
        ],
        windows: {
          glassHex: "#3b4148",
          plinth: { z1: 4.6, hex: "#8c877d" },
          rows: [
            { z0: 0.4, z1: 3.9, widthM: 2.2, bayM: 3.7, head: "round" },
            { z0: 5.2, z1: 8, widthM: 1.4, bayM: 3.7, head: "flat" },
            { z0: 9.3, z1: 11.6, widthM: 1.4, bayM: 3.7, head: "flat" },
            { z0: 14.6, z1: 16.3, widthM: 1.4, bayM: 3.7, head: "flat" }
          ]
        }
      }]
    }
  ];
  var kitIds = (k) => [...k.tiers.map((t) => t.id), ...k.stacks.map((s) => s.onId), ...k.roofs.map((r) => r.id), ...(k.halls ?? []).map((h) => h.id), ...k.hides ?? [], ...(k.forms ?? []).map((f) => f.on), ...k.body ?? []];
  var HAND_KIT_IDS = new Set(HAND_KITS.flatMap(kitIds));
  var HAND_IDS = HAND_KIT_IDS;
  var KITS = [...HAND_KITS, ...GENERIC_WORSHIP_KITS.filter((k) => kitIds(k).every((id) => !HAND_IDS.has(id)))];
  var KIT_PART_IDS = new Set(KITS.flatMap((k) => [...k.tiers.map((t) => t.id), ...k.stacks.map((s) => s.onId), ...k.roofs.map((r) => r.id), ...(k.halls ?? []).map((h) => h.id), ...k.hides ?? [], ...(k.forms ?? []).map((f) => f.on)]));
  var KIT_HIDE_IDS = [...new Set(KITS.flatMap((k) => [...k.tiers.map((t) => t.id), ...k.stacks.map((s) => s.onId), ...k.hides ?? []]))];
  var KIT_MODELLED_IDS = /* @__PURE__ */ new Set([...KIT_PART_IDS, ...KITS.flatMap((k) => k.body ?? [])]);
  var KIT_ROOF = new Map(KITS.flatMap((k) => k.roofs.map((r) => [r.id, { roof: r, wall: k.wall }])));
  var KIT_HALLS = new Map(KITS.flatMap((k) => (k.halls ?? []).map((h) => [h.id, { halls: h, wall: k.wall }])));
  var KIT_BODY = new Map(KITS.flatMap((k) => k.wall ? (k.body ?? []).map((id) => [id, k.wall]) : []));
  var sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  var cross2 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  var dot2 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  var layerFor = (mat) => mat === "brick" ? "plain" : "flat";
  var TriSink = class {
    out = [];
    tri(a, b, c, ua, ub, uc, layer, hex2, hint) {
      let n = cross2(sub3(b, a), sub3(c, a)), B = b, C = c, UB = ub, UC = uc;
      if (dot2(n, hint) < 0) {
        B = c;
        C = b;
        UB = uc;
        UC = ub;
        n = [-n[0], -n[1], -n[2]];
      }
      const l = Math.hypot(n[0], n[1], n[2]);
      if (l < 1e-9) return;
      this.out.push({ p: [a, B, C], uv: [ua, UB, UC], layer, hex: hex2, n: [n[0] / l, n[1] / l, n[2] / l] });
    }
  };
  function stage(sink, cx, cy, ang, shape, w0, w1, z0, z1, mat, hexOverride) {
    const n = shape === "square" ? 4 : 8;
    const radius = (w) => shape === "square" ? w / 2 * Math.SQRT2 : w / 2 / Math.cos(Math.PI / 8);
    const off = shape === "square" ? Math.PI / 4 : Math.PI / 8;
    const ring = (w, z) => Array.from({ length: n }, (_, k) => {
      const a = ang + off + k * 2 * Math.PI / n;
      return [cx + Math.cos(a) * radius(w), cy + Math.sin(a) * radius(w), z];
    });
    const bottom = ring(w0, z0), top = w1 > 0 ? ring(w1, z1) : null, apex = [cx, cy, z1];
    const layer = layerFor(mat), hex2 = hexOverride ?? MAT_HEX[mat];
    let run = 0;
    for (let k = 0; k < n; k++) {
      const b0 = bottom[k], b1 = bottom[(k + 1) % n];
      const side = Math.hypot(b1[0] - b0[0], b1[1] - b0[1]);
      const u0 = run / 5, u1 = (run + side) / 5;
      run += side;
      const midA = ang + off + (k + 0.5) * 2 * Math.PI / n, hint = [Math.cos(midA), Math.sin(midA), 0.2];
      if (top) {
        const t0 = top[k], t1 = top[(k + 1) % n];
        sink.tri(b0, b1, t1, [u0, z0 / 3.1], [u1, z0 / 3.1], [u1, z1 / 3.1], layer, hex2, hint);
        sink.tri(b0, t1, t0, [u0, z0 / 3.1], [u1, z1 / 3.1], [u0, z1 / 3.1], layer, hex2, hint);
      } else sink.tri(b0, b1, apex, [u0, z0 / 3.1], [u1, z0 / 3.1], [(u0 + u1) / 2, z1 / 3.1], layer, hex2, hint);
    }
    if (top) for (let k = 1; k < n - 1; k++) sink.tri(top[0], top[k], top[k + 1], [0, 0], [1, 0], [1, 1], "flat", hex2, [0, 0, 1]);
  }
  function clocks(sink, cx, cy, ang, width, zc) {
    const r = Math.min(width * 0.3, 2.3);
    for (let k = 0; k < 4; k++) {
      const a = ang + k * Math.PI / 2, dx = Math.cos(a), dy = Math.sin(a), tx = -dy, ty = dx;
      const mx = cx + dx * (width / 2 + 0.55 + 0.06), my = cy + dy * (width / 2 + 0.55 + 0.06);
      for (const [rad, mat, lift] of [[r, "gold", 0], [r * 0.8, "white", 0.04]]) {
        const pts = Array.from({ length: 8 }, (_, i) => {
          const t = i * Math.PI / 4 + Math.PI / 8;
          return [mx + dx * lift + tx * Math.cos(t) * rad, my + dy * lift + ty * Math.cos(t) * rad, zc + Math.sin(t) * rad];
        });
        for (let i = 1; i < 7; i++) sink.tri(pts[0], pts[i], pts[i + 1], [0, 0], [1, 0], [1, 1], "flat", MAT_HEX[mat], [dx, dy, 0]);
      }
    }
  }
  function columns(sink, cx, cy, ang, width, z0, z1, n) {
    for (let k = 0; k < n; k++) {
      const a = ang + k * 2 * Math.PI / n + Math.PI / n, rad = width / 2 + 0.1;
      stage(sink, cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, a, "square", 0.7, 0.7, z0, z1, "white");
    }
  }
  function slab(sink, cx, cy, ang, w, l, z0, zLow, zHigh, high, mat, hexOverride) {
    const ax = Math.cos(ang), ay = Math.sin(ang), bx = -ay, by = ax, hx = Math.cos(high), hy = Math.sin(high);
    const layer = layerFor(mat), hex2 = hexOverride ?? MAT_HEX[mat];
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => [cx + ax * (i * w) / 2 + bx * (j * l) / 2, cy + ay * (i * w) / 2 + by * (j * l) / 2]);
    const reach = Math.abs(hx * ax + hy * ay) * (w / 2) + Math.abs(hx * bx + hy * by) * (l / 2);
    const zAt = (p) => zLow + (zHigh - zLow) * (((p[0] - cx) * hx + (p[1] - cy) * hy) / reach + 1) / 2;
    const tops = pts.map((p) => [p[0], p[1], zAt(p)]), feet = pts.map((p) => [p[0], p[1], z0]);
    let run = 0;
    for (let k = 0; k < 4; k++) {
      const k1 = (k + 1) % 4, side = Math.hypot(pts[k1][0] - pts[k][0], pts[k1][1] - pts[k][1]);
      const u0 = run / 5, u1 = (run + side) / 5;
      run += side;
      const mx = (pts[k][0] + pts[k1][0]) / 2 - cx, my = (pts[k][1] + pts[k1][1]) / 2 - cy, hint = [mx, my, 0];
      sink.tri(feet[k], feet[k1], tops[k1], [u0, z0 / 3.1], [u1, z0 / 3.1], [u1, tops[k1][2] / 3.1], layer, hex2, hint);
      sink.tri(feet[k], tops[k1], tops[k], [u0, z0 / 3.1], [u1, tops[k1][2] / 3.1], [u0, tops[k][2] / 3.1], layer, hex2, hint);
    }
    sink.tri(tops[0], tops[1], tops[2], [0, 0], [1, 0], [1, 1], "flat", hex2, [0, 0, 1]);
    sink.tri(tops[0], tops[2], tops[3], [0, 0], [1, 0], [1, 1], "flat", hex2, [0, 0, 1]);
  }
  var CAP_PROFILES = {
    // A hemisphere in four steps: radius cos and height sin of 0, 30, 55, 75, 90 degrees.
    dome: [[1, 0.87, 0.5], [0.87, 0.57, 0.32], [0.57, 0.26, 0.17], [0.26, 0, 0.01]],
    // A steep bulged point, the Obrechtkerk's banded tower caps: fat low down, a long thin tip.
    spire: [[1, 0.9, 0.2], [0.9, 0.62, 0.28], [0.62, 0.32, 0.27], [0.32, 0.1, 0.2], [0.1, 0, 0.05]]
  };
  function towerParts(sink, t, [cx, cy], ang, baseZ, gable) {
    const w = t.widthM, z0 = t.z0 ?? baseZ, shape = t.shape ?? "square", body = t.mat ?? "brick";
    const hex2 = t.wallHex ?? (body === "brick" ? gable : void 0), capShape = t.capShape ?? "pyramid";
    if (capShape === "slant") {
      slab(sink, cx, cy, ang, w, t.lenM ?? w, z0, t.z1, t.z1 + t.capM, (t.highBearingDeg ?? 0) * Math.PI / 180, body, hex2);
      return;
    }
    stage(sink, cx, cy, ang, shape, w, w, z0, t.z1, body, hex2);
    if (shape === "square") stage(sink, cx, cy, ang, "square", w + 0.8, w + 0.8, t.z1 - 0.6, t.z1, "stone");
    if (capShape === "pyramid") stage(sink, cx, cy, ang, shape, t.capWidthM ?? w + 1.2, 0, t.z1, t.z1 + t.capM, t.cap, t.capHex);
    else {
      let z = t.z1;
      const base = shape === "square" ? w + 0.5 : w;
      for (const [r0, r1, h] of CAP_PROFILES[capShape]) {
        stage(sink, cx, cy, ang, "octagon", base * r0, base * r1, z, z + h * t.capM, t.cap, t.capHex);
        z += h * t.capM;
      }
    }
    if (t.finial !== false) stage(sink, cx, cy, ang, "octagon", 0.35, 0, t.z1 + t.capM, t.z1 + t.capM + 1.6, "gold");
  }
  function cloisterDome(sink, rect, z0, rise, inset, hex2) {
    const { cx, cy, ux, uy } = rect, vx = -uy, vy = ux;
    const ring = (d, z) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => [cx + ux * i * (rect.len / 2 - d) + vx * j * (rect.wid / 2 - d), cy + uy * i * (rect.len / 2 - d) + vy * j * (rect.wid / 2 - d), z]);
    const steps = [0, 22, 45, 67, 90].map((deg) => deg * Math.PI / 180);
    let lower = ring(0, z0);
    for (let s = 1; s < steps.length; s++) {
      const upper = ring(inset * (1 - Math.cos(steps[s])), z0 + rise * Math.sin(steps[s]));
      for (let k = 0; k < 4; k++) {
        const k1 = (k + 1) % 4, mx = (lower[k][0] + lower[k1][0]) / 2 - cx, my = (lower[k][1] + lower[k1][1]) / 2 - cy;
        const hint = [mx, my, Math.hypot(mx, my) * 0.3];
        const side = Math.hypot(lower[k1][0] - lower[k][0], lower[k1][1] - lower[k][1]);
        const v0 = (s - 1) * 1.6, v1 = s * 1.6;
        sink.tri(lower[k], lower[k1], upper[k1], [0, v0], [side / 5, v0], [side / 5, v1], "slope", hex2, hint);
        sink.tri(lower[k], upper[k1], upper[k], [0, v0], [side / 5, v1], [0, v1], "slope", hex2, hint);
      }
      lower = upper;
    }
    sink.tri(lower[0], lower[1], lower[2], [0, 0], [1, 0], [1, 1], "slope", hex2, [0, 0, 1]);
    sink.tri(lower[0], lower[2], lower[3], [0, 0], [1, 1], [0, 1], "slope", hex2, [0, 0, 1]);
  }
  var GLASS_HEX = "#2c333b";
  var OFF = { plinth: 0.04, frame: 0.07, glass: 0.1, tracery: 0.13 };
  function openingOutline(s0, s1, z0, z1, head) {
    const w = s1 - s0, mid = (s0 + s1) / 2;
    if (head === "flat" || z1 - z0 < w) return [[s0, z0], [s1, z0], [s1, z1], [s0, z1]];
    if (head === "round") {
      const r = w / 2, zb2 = z1 - r, arc = [];
      for (let k = 0; k <= 4; k++) {
        const a = k * Math.PI / 4;
        arc.push([mid + Math.cos(a) * r, zb2 + Math.sin(a) * r]);
      }
      return [[s0, z0], [s1, z0], ...arc];
    }
    const zb = z1 - 0.8 * w, shoulder = zb + 0.5 * (z1 - zb);
    return [[s0, z0], [s1, z0], [s1, zb], [s1 - 0.12 * w, shoulder], [mid, z1], [s0 + 0.12 * w, shoulder], [s0, zb]];
  }
  function wallPolygon(sink, o, t, n, off, pts, hex2) {
    const at = ([s, z]) => [o[0] + t[0] * s + n[0] * off, o[1] + t[1] * s + n[1] * off, z];
    const hint = [n[0], n[1], 0];
    for (let k = 1; k + 1 < pts.length; k++) sink.tri(at(pts[0]), at(pts[k]), at(pts[k + 1]), [0, 0], [1, 0], [1, 1], "flat", hex2, hint);
  }
  function opening(sink, o, t, n, s, row, glass, frame) {
    const head = row.head ?? "round", w = row.widthM;
    if (frame) wallPolygon(sink, o, t, n, OFF.frame, openingOutline(s - w / 2 - 0.18, s + w / 2 + 0.18, row.z0 - 0.15, row.z1 + 0.18, head), frame);
    wallPolygon(sink, o, t, n, OFF.glass, openingOutline(s - w / 2, s + w / 2, row.z0, row.z1, head), glass);
  }
  function roseWindow(sink, o, t, n, s, rose, glass, stone) {
    const disc = (r2, k = 12) => Array.from({ length: k }, (_, i) => [s + Math.cos(i * 2 * Math.PI / k) * r2, rose.z + Math.sin(i * 2 * Math.PI / k) * r2]);
    const r = rose.radiusM;
    wallPolygon(sink, o, t, n, OFF.frame, disc(r + 0.3), stone);
    wallPolygon(sink, o, t, n, OFF.glass, disc(r), glass);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI / 3, ca = Math.cos(a), sa = Math.sin(a), px = -sa * 0.09, pz = ca * 0.09;
      wallPolygon(sink, o, t, n, OFF.tracery, [[s - ca * r + px, rose.z - sa * r + pz], [s - ca * r - px, rose.z - sa * r - pz], [s + ca * r - px, rose.z + sa * r - pz], [s + ca * r + px, rose.z + sa * r + pz]], stone);
    }
    wallPolygon(sink, o, t, n, OFF.tracery, disc(r * 0.26, 8), stone);
  }
  function wallEdges(ring) {
    const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring.slice();
    let area2 = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) area2 += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    const sign = area2 >= 0 ? 1 : -1;
    return pts.map((a, i) => {
      const b = pts[(i + 1) % pts.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]), t = len ? [(b[0] - a[0]) / len, (b[1] - a[1]) / len] : [1, 0];
      return { o: a, t, n: [t[1] * sign, -t[0] * sign], len };
    });
  }
  function nearestEdge(edges, p) {
    let best = { edge: 0, s: 0, d: Infinity };
    edges.forEach((e, i) => {
      const s = (p[0] - e.o[0]) * e.t[0] + (p[1] - e.o[1]) * e.t[1], c = Math.max(0, Math.min(e.len, s));
      const d = Math.hypot(e.o[0] + e.t[0] * c - p[0], e.o[1] + e.t[1] * c - p[1]);
      if (d < best.d) best = { edge: i, s, d };
    });
    return best;
  }
  function kitWindows(sink, ring, spec, win, towerAng) {
    const edges = wallEdges(ring), glass = win.glassHex ?? GLASS_HEX, stone = win.frameHex ?? MAT_HEX.stone;
    if (win.plinth) {
      for (const e of edges) if (e.len >= 0.2) wallPolygon(sink, e.o, e.t, e.n, OFF.plinth, [[0, 0], [e.len, 0], [e.len, win.plinth.z1], [0, win.plinth.z1]], win.plinth.hex);
    }
    const inTower = (p) => (spec.towers ?? []).some((t) => {
      const [cx, cy] = toLocal(t.at), a = towerAng(t), dx = p[0] - cx, dy = p[1] - cy;
      return Math.abs(dx * Math.cos(a) + dy * Math.sin(a)) < t.widthM / 2 + 0.4 && Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)) < (t.lenM ?? t.widthM) / 2 + 0.4;
    });
    const placed = win.rows.filter((r) => r.at).map((r) => ({ row: r, ...nearestEdge(edges, toLocal(r.at)) }));
    const claimed = /* @__PURE__ */ new Set();
    const plane = (edge) => {
      const a = edges[edge];
      let out = 0;
      edges.forEach((e, i) => {
        const along = e.t[0] * a.t[0] + e.t[1] * a.t[1], off = (e.o[0] - a.o[0]) * a.n[0] + (e.o[1] - a.o[1]) * a.n[1];
        if (along > 0.995 && Math.abs(off) < 0.4) {
          claimed.add(i);
          out = Math.max(out, off);
        }
      });
      return { ...a, o: [a.o[0] + a.n[0] * out, a.o[1] + a.n[1] * out] };
    };
    for (const { row, edge, s } of placed) {
      const e = plane(edge), n = row.count ?? 1;
      for (let k = 0; k < n; k++) opening(sink, e.o, e.t, e.n, s + (k - (n - 1) / 2) * row.bayM, row, glass, win.frameHex);
    }
    for (const row of win.rows) {
      if (row.at || row.z1 > spec.eavesM) continue;
      edges.forEach((e, i) => {
        if (claimed.has(i) || e.len < row.widthM + 1) return;
        const n = Math.max(1, Math.floor(e.len / row.bayM));
        for (let k = 0; k < n; k++) {
          const s = (k + 0.5) * e.len / n;
          if (!inTower([e.o[0] + e.t[0] * s + e.n[0] * 0.5, e.o[1] + e.t[1] * s + e.n[1] * 0.5])) opening(sink, e.o, e.t, e.n, s, row, glass, win.frameHex);
        }
      });
    }
    for (const rose of win.roses ?? []) {
      const { edge, s } = nearestEdge(edges, toLocal(rose.at)), e = plane(edge);
      roseWindow(sink, e.o, e.t, e.n, s, rose, glass, stone);
    }
    for (const t of spec.towers ?? []) {
      if ((t.shape ?? "square") !== "square" || t.lenM !== void 0 || t.capShape === "slant") continue;
      const [cx, cy] = toLocal(t.at), a = towerAng(t), half = t.widthM / 2;
      for (let f = 0; f < 4; f++) {
        const na = a + f * Math.PI / 2, n = [Math.cos(na), Math.sin(na)], tt = [-n[1], n[0]];
        const o = [cx + n[0] * half - tt[0] * half, cy + n[1] * half - tt[1] * half];
        for (const row of win.towerRows ?? []) {
          if (row.z1 > t.z1 - 0.6 || row.z0 < (t.z0 ?? 0)) continue;
          const count = row.count ?? Math.max(1, Math.floor(t.widthM / row.bayM));
          for (let k = 0; k < count; k++) opening(sink, o, tt, n, half + (k - (count - 1) / 2) * row.bayM, row, glass, win.frameHex);
        }
      }
    }
  }
  function kitGeometry(kit, parts) {
    const out = /* @__PURE__ */ new Map();
    const sinkFor = (id) => {
      let s = out.get(id);
      if (!s) out.set(id, s = new TriSink());
      return s;
    };
    const rectOf = (part) => fitRect(part.ring, 200);
    for (const tier of kit.tiers) {
      const part = parts.get(tier.id), rect = part && rectOf(part);
      if (!part || !rect) continue;
      const width = Math.max(rect.len, rect.wid), ang = Math.atan2(rect.uy, rect.ux);
      const z0 = tier.z0 ?? part.minHeightM, z1 = tier.z1 ?? part.heightM;
      const sink = sinkFor(tier.id);
      stage(sink, rect.cx, rect.cy, ang, tier.shape, width, width, z0, z1, tier.mat);
      if (tier.z1 === void 0) stage(sink, rect.cx, rect.cy, ang, tier.shape, width + 0.9, width + 0.9, z1 - 0.55, z1, tier.mat === "brick" ? "stone" : tier.mat);
      if (tier.clocks) clocks(sink, rect.cx, rect.cy, ang, width, (z0 + z1) / 2 - 0.4);
      if (tier.columns) columns(sink, rect.cx, rect.cy, ang, width, z0 + 1, z1 - 0.8, tier.columns);
    }
    for (const stack of kit.stacks) {
      const part = parts.get(stack.onId), rect = part && rectOf(part);
      if (!part || !rect) continue;
      const ang = Math.atan2(rect.uy, rect.ux);
      let z = stack.startZ ?? part.heightM;
      for (const s of stack.stages) {
        stage(sinkFor(stack.onId), rect.cx, rect.cy, ang, s.shape, s.w0, s.w1, z, z + s.h, s.mat);
        z += s.h;
      }
    }
    for (const roof of kit.roofs) {
      const part = parts.get(roof.id), rect = part && rectOf(part);
      if (!part || !rect || rect.coverage < 0.7) continue;
      const eaves = part.heightM - roof.riseM;
      if (eaves < 4) continue;
      const plan = { kind: "pitched", gable: "plain", riseM: roof.riseM, dormers: false, material: "slate", tone: 0, seed: roof.id, chimney: false };
      const sink = sinkFor(roof.id);
      const hex2 = MAT_HEX[roof.mat === "tile" ? "tile" : roof.mat === "lead" ? "lead" : "slate"];
      for (const t of roofTriangles(rect, plan, eaves, { bayM: 5, storeyM: 3.1, cellM: 1.2 })) {
        const slope = t.part === "slope";
        sink.out.push({ p: t.p, uv: t.uv, layer: slope ? "slope" : "plain", hex: slope ? hex2 : MAT_HEX.stone, n: t.n });
      }
    }
    for (const spec of kit.halls ?? []) {
      const part = parts.get(spec.id);
      if (!part) continue;
      const sink = sinkFor(spec.id), hex2 = spec.roofHex ?? MAT_HEX[spec.mat === "tile" ? "tile" : spec.mat === "lead" ? "lead" : "slate"], gable = kit.wall?.hex ?? MAT_HEX.brick;
      const plan = { kind: "pitched", gable: "plain", riseM: spec.riseM, dormers: false, material: "slate", tone: 0, seed: spec.id, chimney: false };
      for (const rect of hallRects(part.ring, spec.widthM, toLocal(spec.anchor))) {
        for (const t of roofTriangles(rect, plan, spec.eavesM, { bayM: 5, storeyM: 3.1, cellM: 1.2 })) {
          const slope = t.part === "slope";
          sink.out.push({ p: t.p, uv: t.uv, layer: slope ? "slope" : "plain", hex: slope ? hex2 : gable, n: t.n });
        }
      }
      if (spec.fit) {
        const rect = fitRect(part.ring, 200);
        if (rect && rect.coverage >= FIT_COVERAGE && rect.maxDev <= FIT_MAX_DEV_M && spec.riseM > 0) {
          for (const t of roofTriangles(rect, plan, spec.eavesM, { bayM: 5, storeyM: 3.1, cellM: 1.2 })) {
            const slope = t.part === "slope";
            sink.out.push({ p: t.p, uv: t.uv, layer: slope ? "slope" : "plain", hex: slope ? hex2 : gable, n: t.n });
          }
        }
      }
      for (const wing of spec.wings ?? []) {
        const [cx, cy] = toLocal(wing.at), b = wing.bearingDeg * Math.PI / 180;
        const rect = { cx, cy, ux: Math.cos(b), uy: Math.sin(b), len: wing.lenM, wid: wing.widM, coverage: 1, maxDev: 0 };
        if (wing.roof === "dome") {
          cloisterDome(sink, rect, spec.eavesM, wing.riseM, wing.insetM ?? Math.min(wing.lenM, wing.widM) * 0.35, hex2);
          continue;
        }
        const wingPlan = { ...plan, kind: wing.roof === "hipped" ? "hipped" : "pitched", riseM: wing.riseM };
        for (const t of roofTriangles(rect, wingPlan, spec.eavesM, { bayM: 5, storeyM: 3.1, cellM: 1.2 })) {
          const slope = t.part === "slope";
          sink.out.push({ p: t.p, uv: t.uv, layer: slope ? "slope" : "plain", hex: slope ? hex2 : gable, n: t.n });
        }
      }
      const axis = hallRects(part.ring, spec.widthM, toLocal(spec.anchor))[0], ang = axis ? Math.atan2(axis.uy, axis.ux) : 0;
      const towerAng = (tower) => tower.bearingDeg === void 0 ? ang : tower.bearingDeg * Math.PI / 180;
      for (const tower of spec.towers ?? []) towerParts(sink, tower, toLocal(tower.at), towerAng(tower), part.minHeightM, gable);
      if (spec.windows) kitWindows(sink, part.ring, spec, spec.windows, towerAng);
    }
    for (const form of kit.forms ?? []) {
      const part = parts.get(form.on);
      if (part) sinkFor(form.on).out.push(...formTriangles(form, part.ring, toLocal));
    }
    return [...out].map(([id, sink]) => ({ id, tris: sink.out }));
  }
  var KIT_ORIGIN = { lng: 4.9, lat: 52.37 };
  var toLocal = ([lng, lat]) => [(lng - KIT_ORIGIN.lng) * 111320 * Math.cos(KIT_ORIGIN.lat * Math.PI / 180), (lat - KIT_ORIGIN.lat) * 110540];
  function hallRects(ring, widthM, anchor) {
    const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring.slice();
    if (pts.length < 3 || !(widthM > 1)) return [];
    let ux = 1, uy = 0, best = 0;
    for (let i = 0; i < pts.length; i++) {
      const [a, b] = [pts[i], pts[(i + 1) % pts.length]], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len > best) {
        best = len;
        ux = (b[0] - a[0]) / len;
        uy = (b[1] - a[1]) / len;
      }
    }
    const vx = -uy, vy = ux;
    const local = pts.map(([x, y]) => [(x - anchor[0]) * ux + (y - anchor[1]) * uy, (x - anchor[0]) * vx + (y - anchor[1]) * vy]);
    const vMin = Math.min(...local.map((p) => p[1])), vMax = Math.max(...local.map((p) => p[1]));
    const out = [];
    for (let k = Math.floor(vMin / widthM); k * widthM < vMax; k++) {
      const v0 = Math.max(vMin, k * widthM), v1 = Math.min(vMax, (k + 1) * widthM), vc = (v0 + v1) / 2;
      if (v1 - v0 < widthM * 0.4) continue;
      const xs = [];
      for (let i = 0; i < local.length; i++) {
        const [a, b] = [local[i], local[(i + 1) % local.length]];
        if (a[1] > vc !== b[1] > vc) xs.push(a[0] + (vc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort((p, q2) => p - q2);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const u0 = xs[i], u1 = xs[i + 1];
        if (u1 - u0 < 4) continue;
        const cu = (u0 + u1) / 2;
        out.push({ cx: anchor[0] + ux * cu + vx * vc, cy: anchor[1] + uy * cu + vy * vc, ux, uy, len: u1 - u0, wid: v1 - v0, coverage: 1, maxDev: 0 });
      }
    }
    return out;
  }

  // src/canalRecall/genericFacades.ts
  var FACADE_STYLES = ["canal", "c19", "school", "postwar", "modern", "tower"];
  var FACADE_PIXELS_PER_M = 8;
  var FACADE_MAX_TILE_ZOOM = 16 + Math.log2(FACADE_PIXELS_PER_M);

  // src/canalRecall/facadeCells.ts
  var CELL_KINDS = ["upper", "ground", "door", "plain", "shop"];
  var CELL_VARIANTS = 2;
  var CELL_LAYER_COUNT = FACADE_STYLES.length * CELL_VARIANTS * CELL_KINDS.length;
  var hex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
  var GLASS_TOP = hex("#7d93a0");
  var GLASS_BOTTOM = hex("#1f2a33");
  var STONE = hex("#b8ad98");
  var STONE_LIGHT = hex("#cfc6b4");
  var WHITE = hex("#ece8dd");
  var CREAM = hex("#e2d9c2");
  var DOOR_COLOURS = [hex("#2c4a3d"), hex("#3a2a22"), hex("#1f3b57"), hex("#5a2a24")];
  var SHUTTER_COLOURS = [hex("#2f4a3a"), hex("#7a2f27"), hex("#27384f")];

  // src/canalRecall/facadeExtraCore.ts
  function hash012(text) {
    let h = 2166136261;
    for (const c of text) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
  }

  // src/canalRecall/wallBays.ts
  function hashSeed(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  // src/canalRecall/bayTextures.ts
  var SHOP_KINDS = ["groundShop", "shopCafe", "shopWindow", "shopBar", "shopDeli", "shopFlorist", "shopBike"];

  // src/canalRecall/bayLook.ts
  var BAY_KINDS = ["upper", "ground", "groundDoor", ...SHOP_KINDS, "plain"];
  var isShopKind = (kind) => SHOP_KINDS.includes(kind);
  var BAY_STYLES = {
    // Canal houses: tall white-framed sashes under flat lintels; shutters only beside ground-floor windows.
    canal: [
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false },
      { windows: 2, shape: "rect", shutters: true, paintedFrames: false },
      { windows: 3, shape: "rect", shutters: false, paintedFrames: true },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: true }
    ],
    // 1860-1914: segmental-arched windows under stucco hoods, string courses at every floor.
    c19: [
      { windows: 2, shape: "arch", shutters: false, paintedFrames: false },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false }
    ],
    school: [
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: true }
    ],
    modern: [
      { windows: 1, shape: "rect", shutters: false, paintedFrames: false },
      { windows: 1, shape: "rect", shutters: false, paintedFrames: true }
    ]
  };
  var ARCHETYPES = Object.keys(BAY_STYLES);
  var BAY_ENTRIES = ARCHETYPES.flatMap((archetype) => BAY_STYLES[archetype].flatMap((_, style) => BAY_KINDS.filter((kind) => !isShopKind(kind) || style === 0).map((kind) => ({ archetype, style, kind, layer: 0 })))).map((e, layer) => ({ ...e, layer }));
  var BAY_LAYER_COUNT = BAY_ENTRIES.length;

  // src/canalRecall/facadeOpenings.ts
  var BAY_W = 520;
  var STOREY_H = 310;
  var GROUND_H = 340;
  var rowPx = (n, y, h, H, widthPx) => ({
    axes: Array.from({ length: n }, (_, i) => (i + 0.5) / n),
    width: widthPx / BAY_W,
    sill: (H - y - h) / H,
    head: (H - y) / H
  });
  var bayWidthPx = (n) => n === 1 ? 150 : n === 2 ? 112 : 82;
  var BAY_DOOR = { axis: (0.14 * BAY_W + 59) / BAY_W, width: 118 / BAY_W, bottom: 24 / GROUND_H, top: (24 + 226) / GROUND_H, fanlight: true };
  function bayLookOpenings(id, style) {
    if (style === "modern" || style === "postwar" || style === "tower") {
      return {
        upper: { axes: [0.5], width: 0.9, sill: (STOREY_H - 210) / STOREY_H, head: (STOREY_H - 70) / STOREY_H },
        ground: rowPx(1, 80, 140, GROUND_H, 140),
        doorWindow: null,
        door: { axis: (0.62 * BAY_W + 59) / BAY_W, width: 118 / BAY_W, bottom: BAY_DOOR.bottom, top: BAY_DOOR.top, fanlight: true },
        ribbon: true
      };
    }
    const archetype = style === "school" ? "school" : "canal";
    const styles = BAY_STYLES[archetype], v = styles[(hashSeed(id) >>> 4) % styles.length];
    const upper = archetype === "school" ? { axes: [0.3, 0.7], width: 76 / BAY_W, sill: (STOREY_H - 248) / STOREY_H, head: (STOREY_H - 68) / STOREY_H } : { ...rowPx(v.windows, 62, 188, STOREY_H, bayWidthPx(v.windows)), arch: v.shape === "arch" };
    const doorWindow = { axes: [0.64], width: 150 / BAY_W, sill: (GROUND_H - 226) / GROUND_H, head: (GROUND_H - 76) / GROUND_H };
    return { upper, ground: rowPx(v.windows, 70, 150, GROUND_H, bayWidthPx(v.windows)), doorWindow, door: BAY_DOOR };
  }
  var PROCEDURAL = {
    canal: {
      upper: { axes: [0.3, 0.7], width: 1.1 / 5, sill: 0.42 / 3.1, head: 2.47 / 3.1 },
      ground: { axes: [0.3, 0.7], width: 1 / 5, sill: 0.95 / 3.3, head: 2.85 / 3.3 },
      doorWindow: { axes: [0.7], width: 1 / 5, sill: 0.95 / 3.3, head: 2.85 / 3.3 },
      door: { axis: 0.3, width: 1.12 / 5, bottom: 0, top: 2.35 / 3.3, fanlight: true }
    },
    c19: {
      upper: { axes: [0.5], width: 1.35 / 4.4, sill: 0.6 / 3, head: 2.45 / 3 },
      ground: { axes: [0.5], width: 1.4 / 4.4, sill: 1.3 / 3.6, head: 3.15 / 3.6 },
      doorWindow: null,
      door: { axis: 0.5, width: 1.2 / 4.4, bottom: 0, top: 2.3 / 3.6, fanlight: false }
    },
    school: {
      upper: { axes: [0.5], width: 3.52 / 4.8, sill: 0.95 / 3, head: 2.3 / 3 },
      ground: null,
      doorWindow: null,
      door: { axis: 0.5, width: 1.1 / 4.8, bottom: 0, top: 2.2 / 3, fanlight: false },
      ribbon: true
    },
    postwar: {
      upper: { axes: [0.5], width: 3 / 3.6, sill: 0.95 / 2.85, head: 2.35 / 2.85 },
      ground: null,
      doorWindow: null,
      door: { axis: 0.95 / 3.6, width: 1.1 / 3.6, bottom: 0, top: 2.2 / 2.9, fanlight: false },
      ribbon: true
    },
    modern: {
      upper: { axes: [1.4 / 4.2], width: 2 / 4.2, sill: 0.5 / 3, head: 2.5 / 3 },
      ground: null,
      doorWindow: null,
      door: { axis: 3.5 / 4.2, width: 1 / 4.2, bottom: 0, top: 2.3 / 3.8, fanlight: false },
      ribbon: true
    },
    tower: {
      upper: { axes: [0.5], width: 2.4 / 3, sill: 0.6 / 3.2, head: 2.5 / 3.2 },
      ground: null,
      doorWindow: null,
      door: { axis: 0.5, width: 1.1 / 3, bottom: 0, top: 2.3 / 3.2, fanlight: false },
      ribbon: true
    }
  };
  var proceduralOpenings = (style) => PROCEDURAL[style];

  // src/canalRecall/facadeOrnaments.ts
  var WHITE2 = "#efece4";
  var CREAM2 = "#e4d9bf";
  var STONE2 = "#cfc6b4";
  var SANDSTONE = "#cdbb98";
  var BLUESTONE = "#5b6066";
  var GLAZED_TILE = ["#3d5a4c", "#2f3f52", "#6b3f2e"];
  var SCHOOL_FRAMES = [WHITE2, WHITE2, "#d9772e", "#e8e0c8"];
  var IRON = "#1f2124";
  var LUIKEN = ["#2c4f33", "#7a1f2b", "#1f2a2a", "#2c4f33"];
  var pickOf = (list, r) => list[Math.floor(r * list.length) % list.length];
  function shadeHex(hex2, k) {
    const v = [1, 3, 5].map((i) => parseInt(hex2.slice(i, i + 2), 16));
    const out = v.map((c) => Math.max(0, Math.min(255, Math.round(k <= 1 ? c * k : c + (255 - c) * (k - 1)))));
    return `#${out.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  }
  var BAY_LOOK_STYLES = ["canal", "school", "modern"];
  var openingsOf = (c) => c.openings ?? (BAY_LOOK_STYLES.includes(c.style) ? bayLookOpenings(c.id, c.style) : proceduralOpenings(c.style));
  var storeyZ = (c, s) => c.base + c.layout.groundM + s * c.layout.storeyM;
  function windowSpans(c, s) {
    const o = openingsOf(c), l = c.layout, bw = l.bayWidthM, out = [];
    const doors = new Set(l.doorBays);
    for (let i = 0; i < l.bays; i++) {
      const row = s >= 0 ? o.upper : doors.has(i) ? o.doorWindow : c.shopfront ? null : o.ground;
      if (!row) continue;
      const z = s >= 0 ? storeyZ(c, s) : c.base, h = s >= 0 ? l.storeyM : l.groundM;
      for (const axis of row.axes) out.push({ x: (i + axis) * bw, hw: row.width * bw / 2, z0: z + row.sill * h, z1: z + row.head * h });
    }
    return out;
  }
  function doorSpan(c) {
    if (!c.layout.doorBays.length || !c.groundLevel) return null;
    const d = openingsOf(c).door, bw = c.layout.bayWidthM, g = c.layout.groundM;
    return { x: (c.layout.doorBays[0] + d.axis) * bw, hw: d.width * bw / 2, z0: c.base + d.bottom * g, z1: c.base + d.top * g };
  }
  function pierXs(c) {
    const xs = windowSpans(c, 0).map((w) => w.x).sort((a, b) => a - b), out = [Math.min(0.2, c.f.len / 4)];
    for (let i = 1; i < xs.length; i++) out.push((xs[i - 1] + xs[i]) / 2);
    out.push(c.f.len - Math.min(0.2, c.f.len / 4));
    return out;
  }
  function aroundDoor(c, a0, a1, margin = 0.12) {
    const d = doorSpan(c);
    if (!d) return [[a0, a1]];
    const out = [], l = d.x - d.hw - margin, r = d.x + d.hw + margin;
    if (l > a0 + 0.05) out.push([a0, Math.min(a1, l)]);
    if (r < a1 - 0.05) out.push([Math.max(a0, r), a1]);
    return out;
  }
  function storeysThatFit(c, s, perWindow, max) {
    const per = Math.max(1, windowSpans(c, 0).length) * perWindow;
    return Math.max(1, Math.min(max, c.layout.storeys, Math.floor(s.room() / per)));
  }
  var CANAL = ["canal", "c19"];
  var ORNAMENT_COMPONENTS = [
    // --- Crowns: one per wall, the strongest line on a facade --------------------------------
    { id: "kroonlijst", styles: CANAL, p: { canal: 0.6, c19: 0.15 }, wide: true, street: true, group: "crown", build: (c, s, r) => {
      if (c.roofKind === "gable") return;
      const t = c.top, hex2 = r < 0.75 ? WHITE2 : CREAM2;
      s.box(c.f, 0, c.f.len, 0, 0.16, t - 0.4, t - 0.28, hex2, true);
      s.box(c.f, 0, c.f.len, 0, 0.3, t - 0.28, t - 0.1, hex2, true);
      s.box(c.f, 0, c.f.len, 0, 0.4, t - 0.1, t, hex2, true);
      for (const x of pierXs(c).slice(0, 6)) s.box(c.f, Math.max(0, x - 0.09), Math.min(c.f.len, x + 0.09), 0.04, 0.26, t - 0.7, t - 0.4, hex2);
    } },
    { id: "console-cornice", styles: ["c19", "canal"], p: { c19: 0.4, canal: 0.12 }, wide: true, street: true, group: "crown", build: (c, s) => {
      if (c.roofKind === "gable") return;
      const t = c.top;
      s.strip(c.f, 0, c.f.len, 0.04, t - 0.52, t - 0.26, CREAM2);
      s.box(c.f, 0, c.f.len, 0, 0.28, t - 0.26, t - 0.1, CREAM2, true);
      s.box(c.f, 0, c.f.len, 0, 0.38, t - 0.1, t, WHITE2, true);
      const piers = pierXs(c), ends = piers.length > 2 ? [piers[0], piers[Math.floor(piers.length / 2)], piers[piers.length - 1]] : piers;
      for (const x of ends) for (const dx of [-0.14, 0.07]) s.box(c.f, Math.max(0, x + dx), Math.min(c.f.len, x + dx + 0.07), 0.04, 0.26, t - 0.52, t - 0.26, CREAM2);
    } },
    { id: "corbel-roofline", styles: ["school"], p: 0.45, wide: true, street: true, group: "crown", build: (c, s) => {
      const t = c.top, brick = shadeHex(c.wallHex, 0.82);
      s.box(c.f, 0, c.f.len, 0, 0.08, t - 0.62, t - 0.46, brick, true);
      s.box(c.f, 0, c.f.len, 0, 0.17, t - 0.46, t - 0.3, brick, true);
      s.box(c.f, 0, c.f.len, 0, 0.27, t - 0.3, t - 0.06, brick, true);
      s.box(c.f, 0, c.f.len, 0, 0.33, t - 0.06, t + 0.06, CREAM2, true);
    } },
    { id: "stepped-parapet", styles: ["school"], p: 0.2, wide: true, street: true, group: "crown", rise: 1.25, build: (c, s) => {
      if (c.f.len < 6) return;
      const t = c.top, L = c.f.len, brick = shadeHex(c.wallHex, 0.9);
      const steps = [[0, L, 0.35], [L * 0.22, L * 0.78, 0.75], [L * 0.38, L * 0.62, 1.1]];
      let z = t;
      for (const [a0, a1, h] of steps) {
        s.box(c.f, a0, a1, 0, 0.3, z, t + h, brick, false, true);
        s.box(c.f, a0 - 0.04, a1 + 0.04, -0.02, 0.36, t + h, t + h + 0.08, CREAM2, true, true);
        z = t + h;
      }
    } },
    { id: "white-fascia", styles: ["postwar", "modern", "tower"], p: { postwar: 0.5, modern: 0.35, tower: 0.25 }, wide: true, group: "crown", build: (c, s) => {
      s.box(c.f, 0, c.f.len, 0, 0.22, c.top - 0.42, c.top, WHITE2, true);
    } },
    // --- Doors ------------------------------------------------------------------------------------
    { id: "door-surround", styles: CANAL, p: { canal: 0.5, c19: 0.4 }, street: true, group: "door-frame", build: (c, s, r) => {
      const d = doorSpan(c);
      if (!d) return;
      const l = d.x - d.hw, rr = d.x + d.hw, top = d.z1 + 0.04;
      s.box(c.f, l - 0.2, l, 0, 0.1, d.z0, top, WHITE2);
      s.box(c.f, rr, rr + 0.2, 0, 0.1, d.z0, top, WHITE2);
      s.box(c.f, l - 0.3, rr + 0.3, 0, 0.2, top, top + 0.22, WHITE2, true);
      if (r < 0.5) s.box(c.f, l - 0.36, rr + 0.36, 0, 0.26, top + 0.22, top + 0.3, WHITE2, true);
      if (openingsOf(c).door.fanlight) {
        const fz0 = d.z1 - (d.z1 - d.z0) * 0.28;
        s.strip(c.f, l, rr, 0.05, fz0 - 0.04, fz0, WHITE2);
        for (const k of [-0.5, 0, 0.5]) s.strip(c.f, d.x + k * d.hw * 0.7 - 0.02, d.x + k * d.hw * 0.7 + 0.02, 0.05, fz0, d.z1 - 0.04, WHITE2);
      }
    } },
    { id: "portiek", styles: CANAL, p: { c19: 0.35, canal: 0.06 }, street: true, group: "door-frame", build: (c, s) => {
      const d = doorSpan(c);
      if (!d || !c.groundLevel) return;
      const l = d.x - d.hw - 0.05, rr = d.x + d.hw + 0.05, top = c.base + c.layout.groundM - 0.15;
      s.strip(c.f, l, rr, 0.02, c.base, top - 0.25, "#5b4c42");
      s.strip(c.f, d.x - d.hw + 0.12, d.x + d.hw - 0.12, 0.03, c.base + 0.8, top - 0.45, ["#2c4f33", "#1f3550", "#7a1f2b", "#3a3f45"][Math.floor(hash012(`${c.id}:pd`) * 4)]);
      s.box(c.f, l - 0.22, l, 0, 0.14, c.base, top, STONE2);
      s.box(c.f, rr, rr + 0.22, 0, 0.14, c.base, top, STONE2);
      s.box(c.f, l - 0.26, rr + 0.26, 0, 0.18, top - 0.3, top + 0.12, STONE2, true);
      s.box(c.f, d.x - 0.12, d.x + 0.12, 0, 0.22, top - 0.32, top + 0.16, WHITE2, true);
      for (let k = 0; k < 4; k++) s.box(c.f, l + 0.02, rr - 0.02, 0, 0.75 - k * 0.18, c.base + k * 0.2, c.base + (k + 1) * 0.2, STONE2);
    } },
    { id: "brick-door-arch", styles: ["school"], p: 0.4, street: true, group: "door-frame", build: (c, s) => {
      const d = doorSpan(c);
      if (!d) return;
      const l = d.x - d.hw, rr = d.x + d.hw, brick = shadeHex(c.wallHex, 0.78), top = d.z1 + 0.05;
      for (const [w, o, up] of [[0.16, 0.14, 0.18], [0.32, 0.07, 0.4]]) {
        s.box(c.f, l - w, l - w + 0.16, 0, o, d.z0, top + up, brick);
        s.box(c.f, rr + w - 0.16, rr + w, 0, o, d.z0, top + up, brick);
        s.box(c.f, l - w, rr + w, 0, o, top + up - 0.18, top + up, brick, true);
      }
      s.box(c.f, d.x - 0.22, d.x + 0.22, 0, 0.18, top + 0.2, top + 0.5, SANDSTONE, true);
    } },
    { id: "iron-balconies", styles: CANAL, p: { c19: 0.6, canal: 0.12 }, wide: true, street: true, group: "balcony", build: (c, s, r) => {
      if (c.layout.storeys < 1) return;
      const per = openingsOf(c).upper.axes.length, all = r < 0.25, pick = per === 3 ? 1 : Math.floor(r * 7) % per;
      const spans = (k) => windowSpans(c, k).filter((_, i) => all || i % per === pick);
      const n = all ? 1 : Math.max(1, Math.min(3, c.layout.storeys, Math.floor(s.room() / Math.max(1, spans(0).length * 44))));
      for (let k = 0; k < n; k++) for (const w of spans(k)) {
        const a0 = w.x - w.hw - 0.12, a1 = w.x + w.hw + 0.12, z = w.z0 - 0.02;
        s.box(c.f, a0, a1, 0, 0.42, z - 0.1, z, STONE2, true);
        for (const x of [a0 + 0.14, a1 - 0.14]) s.strip(c.f, x - 0.07, x + 0.07, 0.3, z - 0.32, z - 0.1, STONE2);
        s.strip(c.f, a0, a1, 0.4, z + 0.86, z + 0.92, IRON, 0.04);
        s.strip(c.f, a0, a1, 0.4, z + 0.1, z + 0.14, IRON, 0.03);
        for (let i = 0; i < 4; i++) {
          const x = a0 + 0.1 + (a1 - a0 - 0.2) * i / 3;
          s.strip(c.f, x - 0.02, x + 0.02, 0.4, z, z + 0.9, IRON, 0.03);
        }
      }
    } },
    // --- Windows ---------------------------------------------------------------------------------
    { id: "window-sills", styles: ["canal", "c19", "school"], p: { canal: 0.6, c19: 0.5, school: 0.35 }, wide: true, build: (c, s, r) => {
      const hex2 = c.style === "school" || r < 0.25 ? STONE2 : WHITE2, n = storeysThatFit(c, s, 4, 6);
      for (let k = -1; k < n; k++) for (const w of windowSpans(c, k)) s.strip(c.f, w.x - w.hw - 0.07, w.x + w.hw + 0.07, 0.11, w.z0 - 0.08, w.z0, hex2);
    } },
    { id: "white-lintels", styles: CANAL, p: { canal: 0.4, c19: 0.12 }, wide: true, group: "window-head", build: (c, s, r) => {
      const o = openingsOf(c);
      if (o.ribbon) return;
      const key = r < 0.55, n = storeysThatFit(c, s, key ? 8 : 4, 5);
      for (let k = 0; k < n; k++) for (const w of windowSpans(c, k)) {
        if (o.upper.arch) {
          s.strip(c.f, w.x - 0.1, w.x + 0.1, 0.07, w.z1 + 0.02, w.z1 + 0.26, WHITE2);
          continue;
        }
        s.strip(c.f, w.x - w.hw - 0.1, w.x + w.hw + 0.1, 0.05, w.z1 + 0.03, w.z1 + 0.2, WHITE2);
        if (key) s.strip(c.f, w.x - 0.09, w.x + 0.09, 0.09, w.z1 + 0.01, w.z1 + 0.27, WHITE2);
      }
    } },
    { id: "stucco-hoods", styles: CANAL, p: { c19: 0.5, canal: 0.12 }, wide: true, group: "window-head", build: (c, s, r) => {
      if (openingsOf(c).ribbon) return;
      const hex2 = r < 0.6 ? WHITE2 : CREAM2, n = storeysThatFit(c, s, 6, 5);
      for (let k = 0; k < n; k++) for (const w of windowSpans(c, k)) {
        const a0 = w.x - w.hw - 0.14, a1 = w.x + w.hw + 0.14;
        s.strip(c.f, a0, a1, 0.14, w.z1 + 0.06, w.z1 + 0.2, hex2);
        s.slope(c.f, a0, a1, 0, 0.14, w.z1 + 0.3, w.z1 + 0.2, hex2);
      }
    } },
    { id: "white-window-frames", styles: CANAL, p: { canal: 0.3, c19: 0.35 }, wide: true, build: (c, s) => {
      if (openingsOf(c).ribbon) return;
      const n = storeysThatFit(c, s, 12, 5);
      for (let k = -1; k < n; k++) for (const w of windowSpans(c, k)) {
        s.strip(c.f, w.x - w.hw - 0.07, w.x - w.hw + 0.01, 0.05, w.z0, w.z1 + 0.04, WHITE2);
        s.strip(c.f, w.x + w.hw - 0.01, w.x + w.hw + 0.07, 0.05, w.z0, w.z1 + 0.04, WHITE2);
        s.strip(c.f, w.x - w.hw - 0.07, w.x + w.hw + 0.07, 0.05, w.z1 - 0.02, w.z1 + 0.05, WHITE2);
      }
    } },
    { id: "school-window-bars", styles: ["school"], p: 0.4, wide: true, build: (c, s, r) => {
      const hex2 = pickOf(SCHOOL_FRAMES, r), n = storeysThatFit(c, s, 12, 4);
      for (let k = 0; k < n; k++) for (const w of windowSpans(c, k)) {
        const zt = w.z1 - (w.z1 - w.z0) * 0.3;
        s.strip(c.f, w.x - w.hw, w.x + w.hw, 0.04, zt - 0.03, zt + 0.03, hex2);
        for (const f of [-1 / 3, 1 / 3]) s.strip(c.f, w.x + f * w.hw * 2 - 0.025, w.x + f * w.hw * 2 + 0.025, 0.04, w.z0, w.z1, hex2);
      }
    } },
    // --- Bands and courses ---------------------------------------------------------------------
    { id: "floor-cornices", styles: CANAL, p: { canal: 0.3, c19: 0.2 }, wide: true, build: (c, s, r) => {
      const hex2 = r < 0.7 ? WHITE2 : STONE2;
      for (let k = 0; k < Math.min(6, c.layout.storeys); k++) {
        const z = storeyZ(c, k);
        s.strip(c.f, 0, c.f.len, 0.08, z - 0.03, z + 0.04, hex2);
      }
    } },
    { id: "string-courses", styles: CANAL, p: { c19: 0.45, canal: 0.1 }, wide: true, build: (c, s) => {
      const o = openingsOf(c);
      for (let k = 0; k < Math.min(6, c.layout.storeys); k++) {
        const z = storeyZ(c, k) + o.upper.sill * c.layout.storeyM;
        s.strip(c.f, 0, c.f.len, 0.06, z - 0.1, z - 0.04, CREAM2);
      }
    } },
    { id: "ribbon-bands", styles: ["school"], p: 0.35, wide: true, build: (c, s, r) => {
      const hex2 = r < 0.6 ? CREAM2 : WHITE2;
      for (let k = 0; k < Math.min(5, c.layout.storeys); k++) {
        const w = windowSpans(c, k)[0];
        if (!w) continue;
        s.strip(c.f, 0, c.f.len, 0.06, w.z0 - 0.14, w.z0 - 0.02, hex2);
        s.strip(c.f, 0, c.f.len, 0.06, w.z1 + 0.04, w.z1 + 0.14, hex2);
      }
    } },
    { id: "floor-slab-edges", styles: ["postwar", "modern", "tower"], p: { postwar: 0.4, modern: 0.25, tower: 0.3 }, wide: true, build: (c, s) => {
      for (let k = 0; k < Math.min(10, c.layout.storeys); k++) {
        const z = storeyZ(c, k);
        s.strip(c.f, 0, c.f.len, 0.1, z - 0.12, z + 0.1, WHITE2);
      }
    } },
    // --- Piers, pilasters, fins ------------------------------------------------------------------
    { id: "corner-pilasters", styles: CANAL, p: { canal: 0.22, c19: 0.3 }, wide: true, street: true, build: (c, s, r) => {
      if (c.layout.storeys < 1) return;
      const hex2 = r < 0.6 ? WHITE2 : STONE2, z0 = storeyZ(c, 0) - 0.15, z1 = c.top - 0.45;
      const xs = c.f.len >= 9 && r < 0.3 ? pierXs(c) : [0, c.f.len];
      for (const x of xs.slice(0, 6)) {
        const a0 = Math.max(0, Math.min(c.f.len - 0.42, x - 0.21)), a1 = a0 + 0.42;
        s.box(c.f, a0, a1, 0, 0.1, z0, z1, hex2, true);
        s.box(c.f, a0 - 0.05, a1 + 0.05, 0, 0.16, z1, z1 + 0.18, hex2, true);
      }
    } },
    { id: "brick-fins", styles: ["school"], p: 0.35, wide: true, street: true, build: (c, s) => {
      if (c.layout.storeys < 1) return;
      const brick = shadeHex(c.wallHex, 0.8), z0 = storeyZ(c, 0) - 0.3;
      for (const x of pierXs(c).slice(1, -1).slice(0, 8)) s.box(c.f, x - 0.11, x + 0.11, 0, 0.32, z0, c.top - 0.05, brick, true);
    } },
    // --- Projections --------------------------------------------------------------------------
    { id: "oriel", styles: ["school", "c19"], p: { school: 0.25, c19: 0.08 }, street: true, group: "oriel", build: (c, s, r) => {
      if (c.layout.storeys < 2 || c.f.len < 5.5) return;
      const x = c.f.len * (r < 0.5 ? 0.5 : 0.3), z0 = storeyZ(c, 0) + 0.1, z1 = storeyZ(c, Math.min(2, c.layout.storeys - 1)) - 0.1;
      const glassZ0 = z0 + 0.7, glassZ1 = z1 - 0.35, frame = c.style === "school" ? pickOf(SCHOOL_FRAMES, r) : WHITE2;
      s.box(c.f, x - 0.75, x + 0.75, 0, 0.6, z0 - 0.45, z0, SANDSTONE, true);
      const body = shadeHex(c.wallHex, 0.88);
      for (const [hw, o] of [[1.3, 0.35], [1.05, 0.65], [0.7, 0.85]]) s.box(c.f, x - hw, x + hw, 0, o, z0, z1, body, true);
      for (const [a0, a1, o] of [[x - 1.22, x - 1.1, 0.35], [x - 0.95, x - 0.8, 0.65], [x - 0.62, x + 0.62, 0.85], [x + 0.8, x + 0.95, 0.65], [x + 1.1, x + 1.22, 0.35]]) s.strip(c.f, a0, a1, o + 0.01, glassZ0, glassZ1, "#4d5f6b", 0.01);
      s.strip(c.f, x - 0.6, x + 0.6, 0.88, glassZ0 + (glassZ1 - glassZ0) * 0.68, glassZ0 + (glassZ1 - glassZ0) * 0.72, frame, 0.03);
      s.box(c.f, x - 1.38, x + 1.38, 0, 0.95, z1, z1 + 0.14, c.style === "school" ? "#4f7a6a" : STONE2, true);
    } },
    // --- Ground floor -------------------------------------------------------------------------
    { id: "rusticated-plinth", styles: CANAL, p: { c19: 0.4, canal: 0.12 }, wide: true, street: true, group: "plinth", build: (c, s) => {
      if (!c.groundLevel || c.shopfront) return;
      const top = Math.min(c.base + 1.15, (windowSpans(c, -1)[0]?.z0 ?? c.base + 1.2) - 0.05);
      for (let z = c.base; z < top - 0.12; z += 0.27) for (const [a0, a1] of aroundDoor(c, 0, c.f.len)) s.strip(c.f, a0, a1, 0.05, z, Math.min(top, z + 0.22), CREAM2);
      for (const [a0, a1] of aroundDoor(c, 0, c.f.len, 0.05)) s.strip(c.f, a0, a1, 0.08, top, top + 0.08, WHITE2);
    } },
    { id: "stone-plinth-band", styles: ["school"], p: 0.45, wide: true, group: "plinth", build: (c, s, r) => {
      if (!c.groundLevel) return;
      const hex2 = r < 0.5 ? BLUESTONE : pickOf(GLAZED_TILE, r * 2);
      for (const [a0, a1] of aroundDoor(c, 0, c.f.len, 0.02)) {
        s.strip(c.f, a0, a1, 0.05, c.base, c.base + 0.85, hex2);
        s.strip(c.f, a0, a1, 0.08, c.base + 0.85, c.base + 0.95, CREAM2);
      }
    } },
    // --- Canal-house specials -----------------------------------------------------------------
    { id: "warehouse-shutters", styles: ["canal"], p: 0.1, wide: true, street: true, group: "axis", build: (c, s, r) => {
      if (c.layout.storeys < 2 || c.f.len < 4.5) return;
      const x = c.f.len / 2, hex2 = pickOf(LUIKEN, r), hw = Math.min(0.62, c.layout.bayWidthM * 0.13);
      for (let k = 0; k < Math.min(4, c.layout.storeys); k++) {
        const z0 = storeyZ(c, k) + 0.25, z1 = storeyZ(c, k) + c.layout.storeyM * 0.82;
        s.strip(c.f, x - hw - 0.08, x + hw + 0.08, 0.03, z0 - 0.08, z1 + 0.08, WHITE2);
        s.box(c.f, x - hw, x + hw, 0, 0.08, z0, z1, hex2);
      }
    } },
    { id: "cornice-vases", styles: CANAL, p: { canal: 0.25, c19: 0.1 }, wide: true, street: true, atomic: true, rise: 1, build: (c, s) => {
      if (c.roofKind === "gable" || c.roofKind === "mansard") return;
      const xs = c.f.len >= 7 ? [0.3, c.f.len / 2, c.f.len - 0.3] : [0.3, c.f.len - 0.3];
      for (const x of xs) {
        s.box(c.f, x - 0.17, x + 0.17, 0.12, 0.46, c.top, c.top + 0.22, WHITE2);
        s.box(c.f, x - 0.12, x + 0.12, 0.17, 0.41, c.top + 0.22, c.top + 0.62, STONE2);
        s.box(c.f, x - 0.05, x + 0.05, 0.24, 0.34, c.top + 0.62, c.top + 0.78, STONE2);
      }
    } },
    // --- Amsterdam School specials ------------------------------------------------------------
    { id: "corner-sculpture", styles: ["school"], p: 0.2, street: true, build: (c, s, r) => {
      if (c.layout.storeys < 1) return;
      const right = r < 0.5, z = storeyZ(c, 0) - 0.2, L = c.f.len;
      const at = (a0, a1) => right ? [L - a1, L - a0] : [a0, a1];
      for (const [a0, a1, o, z0, z1] of [[0, 0.7, 0.3, z - 0.35, z], [0, 0.55, 0.48, z, z + 0.45], [0, 0.4, 0.58, z + 0.45, z + 0.95], [0.08, 0.32, 0.5, z + 0.95, z + 1.2]]) {
        const [p, q2] = at(a0, a1);
        s.box(c.f, p, q2, 0, o, z0, z1, SANDSTONE, true);
      }
    } },
    { id: "school-tower", styles: ["school"], p: 0.1, wide: true, street: true, rise: 2.3, build: (c, s, r) => {
      if (c.f.len < 8 || c.layout.storeys < 2) return;
      const L = c.f.len, w = 1.6, a0 = r < 0.5 ? 0 : L - w, brick = shadeHex(c.wallHex, 0.86);
      s.box(c.f, a0, a0 + w, 0, 0.4, storeyZ(c, 0), c.top + 2, brick, true, true);
      s.box(c.f, a0 - 0.05, a0 + w + 0.05, -0.05, 0.48, c.top + 2, c.top + 2.15, CREAM2, true, true);
      s.strip(c.f, a0 + w / 2 - 0.2, a0 + w / 2 + 0.2, 0.42, storeyZ(c, 1), c.top + 1.6, "#4d5f6b", 0.02);
    } }
  ];

  // src/canalRecall/facadeExtras.ts
  var STONE3 = "#cfc6b4";
  var IRON2 = "#26282b";
  var WOOD = "#5a4030";
  var GREEN = "#3f7a3a";
  var DARKGREEN = "#2c4f33";
  var CONCRETE = "#b9b5ac";
  var GLASS2 = "#5d6f7c";
  var FLOWERS = ["#e84a7f", "#f2b92e", "#ffffff", "#c04fd0", "#ff7a45", "#e8573d"];
  var SHUTTERS = ["#2c4f33", "#1f3550", "#7a1f2b", "#2a2a2a", "#3f6f5a"];
  var pickOf2 = (list, r) => list[Math.floor(r * list.length) % list.length];
  var bayCentre = (l, i) => (i + 0.5) * l.bayWidthM;
  function windowXs(c) {
    const xs = windowSpans(c, 0).map((w) => w.x);
    return xs.length ? xs : Array.from({ length: c.layout.bays }, (_, i) => bayCentre(c.layout, i));
  }
  var doorX = (c) => c.layout.doorBays.length ? (c.layout.doorBays[0] + openingsOf(c).door.axis) * c.layout.bayWidthM : null;
  var storeyZ2 = (c, s) => c.base + c.layout.groundM + s * c.layout.storeyM;
  var ALL = ["canal", "c19", "school", "postwar", "modern", "tower"];
  function roofBox(c, s, u0, u1, v0, v1, z0, z1, hex2) {
    const { cx, cy, ux, uy } = c.rect, vx = -uy, vy = ux;
    return s.box({ x0: cx + vx * v0, y0: cy + vy * v0, ux, uy, nx: vx, ny: vy, len: 0 }, u0, u1, 0, v1 - v0, z0, z1, hex2, false);
  }
  var STREET_FURNITURE = [
    // --- Canal houses --------------------------------------------------------------
    { id: "hoist-beam", group: "hoist", street: true, styles: ["canal"], p: 0.55, build: (c, s) => {
      const x = c.f.len / 2;
      s.box(c.f, x - 0.1, x + 0.1, 0, 0.95, c.top - 0.55, c.top - 0.35, WOOD, true);
      s.box(c.f, x - 0.02, x + 0.02, 0.85, 0.9, c.top - 0.9, c.top - 0.55, IRON2);
    } },
    { id: "hoist-hood", group: "hoist", street: true, styles: ["canal"], p: 0.2, build: (c, s) => {
      const x = c.f.len / 2;
      s.box(c.f, x - 0.1, x + 0.1, 0, 1, c.top - 0.6, c.top - 0.42, WOOD, true);
      s.slope(c.f, x - 0.35, x + 0.35, 0, 1.1, c.top - 0.05, c.top - 0.4, WOOD);
    } },
    { id: "stoop", group: "stoop", styles: ["canal"], p: 0.5, build: (c, s) => {
      const x = doorX(c);
      if (x == null || !c.groundLevel) return;
      for (let k = 0; k < 3; k++) s.box(c.f, x - 0.75, x + 0.75, 0, 1.2 - k * 0.35, c.base + k * 0.18, c.base + (k + 1) * 0.18, STONE3);
    } },
    { id: "stoop-railing", styles: ["canal"], p: 0.35, build: (c, s) => {
      const x = doorX(c);
      if (x == null || !c.groundLevel) return;
      for (const dx of [-0.75, 0.73]) s.box(c.f, x + dx, x + dx + 0.03, 0.1, 1.2, c.base + 0.5, c.base + 0.55, IRON2);
    } },
    { id: "double-stoop", group: "stoop", styles: ["canal"], p: 0.08, build: (c, s) => {
      const x = doorX(c);
      if (x == null || !c.groundLevel) return;
      s.box(c.f, x - 0.7, x + 0.7, 0, 1, c.base, c.base + 0.75, STONE3);
      for (const side of [-1, 1]) for (let k = 0; k < 3; k++) s.box(c.f, x + side * (0.7 + k * 0.3) - (side > 0 ? 0 : 0.3), x + side * (0.7 + k * 0.3) + (side > 0 ? 0.3 : 0), 0.1, 0.95, c.base, c.base + 0.75 - k * 0.25, STONE3);
    } },
    { id: "basement-well", styles: ["canal", "c19"], p: 0.25, build: (c, s) => {
      if (!c.groundLevel) return;
      const xs = windowXs(c);
      const x = xs[xs.length - 1];
      s.strip(c.f, x - 0.6, x + 0.6, 0.62, c.base + 0.72, c.base + 0.76, IRON2, 0.03);
      for (const dx of [-0.6, -0.3, 0, 0.3, 0.6]) s.strip(c.f, x + dx - 0.015, x + dx + 0.015, 0.62, c.base, c.base + 0.74, IRON2, 0.03);
    } },
    { id: "wall-anchors", styles: ["canal"], p: 0.5, build: (c, s) => {
      for (let k = 0; k < Math.min(3, c.layout.storeys); k++) for (const x of [0.5, c.f.len - 0.5]) {
        const z = storeyZ2(c, k) - 0.1;
        s.box(c.f, x - 0.25, x + 0.25, 0, 0.05, z - 0.03, z + 0.03, IRON2);
        s.box(c.f, x - 0.03, x + 0.03, 0, 0.05, z - 0.25, z + 0.25, IRON2);
      }
    } },
    { id: "gable-stone", styles: ["canal"], p: 0.15, build: (c, s) => {
      const x = doorX(c);
      if (x == null) return;
      const z = c.base + c.layout.groundM + 0.25;
      s.box(c.f, x - 0.35, x + 0.35, 0, 0.06, z, z + 0.5, STONE3);
      s.box(c.f, x - 0.25, x + 0.25, 0.06, 0.08, z + 0.08, z + 0.42, pickOf2(["#3f6f8a", "#a8442c", "#c9a227"], hash012(c.id)));
    } },
    { id: "door-pediment", group: "door-frame", styles: ["canal"], p: 0.3, build: (c, s) => {
      const x = doorX(c);
      if (x == null) return;
      const z = c.base + Math.min(2.7, c.layout.groundM - 0.2);
      s.box(c.f, x - 0.65, x + 0.65, 0, 0.18, z, z + 0.14, STONE3, true);
      s.slope(c.f, x - 0.6, x + 0.6, 0, 0.16, z + 0.45, z + 0.14, STONE3);
    } },
    { id: "shutters-3d", styles: ["canal"], p: 0.3, build: (c, s, r) => {
      const hex2 = pickOf2(SHUTTERS, r), z0 = c.base + 0.9, z1 = z0 + 1.5;
      for (const x of windowXs(c).slice(0, 3)) for (const side of [-1, 1]) s.box(c.f, x + side * 0.62 - 0.22, x + side * 0.62 + 0.22, 0, 0.06, z0, z1, hex2);
    } },
    // --- Flowers and green --------------------------------------------------------
    { id: "flower-boxes", styles: ALL, p: 0.25, build: (c, s, r) => {
      const z = c.base + c.layout.groundM + 0.85;
      if (!c.layout.storeys) return;
      for (const [i, x] of windowXs(c).slice(0, 4).entries()) {
        s.box(c.f, x - 0.5, x + 0.5, 0, 0.3, z - 0.25, z, WOOD, true);
        s.box(c.f, x - 0.48, x + 0.48, 0.05, 0.32, z, z + 0.2, pickOf2(FLOWERS, r + i * 0.17));
      }
    } },
    { id: "ground-flower-boxes", styles: ["canal", "c19"], p: 0.2, build: (c, s, r) => {
      const z = c.base + 0.95;
      for (const [i, x] of windowXs(c).slice(0, 3).entries()) {
        if (doorX(c) != null && Math.abs(x - doorX(c)) < 0.8) continue;
        s.box(c.f, x - 0.5, x + 0.5, 0, 0.28, z - 0.22, z, "#3a3f45", true);
        s.box(c.f, x - 0.48, x + 0.48, 0.04, 0.3, z, z + 0.22, pickOf2(FLOWERS, r * 3 + i * 0.29));
      }
    } },
    { id: "geveltuin", styles: ["canal", "c19", "school"], p: 0.3, build: (c, s, r) => {
      if (!c.groundLevel || c.shopfront) return;
      const d = doorX(c);
      for (let x = 0.45; x < Math.min(c.f.len - 0.45, 6); x += 0.9) {
        if (d != null && Math.abs(x - d) < 0.9) continue;
        const h = 0.4 + hash012(`${c.id}:${x}`) * 0.6;
        s.box(c.f, x - 0.32, x + 0.32, 0.02, 0.28, c.base, c.base + h, hash012(`${c.id}:g${x}`) < 0.5 ? GREEN : DARKGREEN);
        if (hash012(`${c.id}:f${x}`) < 0.4) s.box(c.f, x - 0.2, x + 0.2, 0.05, 0.3, c.base + h, c.base + h + 0.12, pickOf2(["#e84a7f", "#f2b92e", "#c04fd0", "#ffffff"], r + x));
      }
    } },
    { id: "climbing-ivy", styles: ALL, p: 0.08, build: (c, s) => {
      const x0 = hash012(c.wallKey) * Math.max(0, c.f.len - 3), h = Math.min(c.top - c.base, 4 + hash012(`${c.wallKey}:h`) * 6);
      s.box(c.f, x0, x0 + 2.2, 0, 0.12, c.base, c.base + h, DARKGREEN);
      s.box(c.f, x0 + 0.4, x0 + 1.6, 0, 0.14, c.base + h, c.base + h + 1.2, GREEN);
    } },
    // --- 19th century -----------------------------------------------------------------
    { id: "juliet-balcony", group: "balcony", styles: ["c19", "school"], p: 0.3, build: (c, s) => {
      if (c.layout.storeys < 2) return;
      const z = storeyZ2(c, 1) + 0.05;
      for (const x of windowXs(c).slice(0, 4)) {
        s.box(c.f, x - 0.6, x + 0.6, 0, 0.35, z, z + 0.06, STONE3, true);
        s.strip(c.f, x - 0.6, x + 0.6, 0.34, z + 0.88, z + 0.94, IRON2, 0.04);
        s.strip(c.f, x - 0.6, x + 0.6, 0.34, z + 0.14, z + 0.18, IRON2, 0.03);
        for (const dx of [-0.5, -0.17, 0.17, 0.5]) s.strip(c.f, x + dx - 0.02, x + dx + 0.02, 0.34, z + 0.06, z + 0.9, IRON2, 0.03);
      }
    } },
    { id: "bay-window", group: "oriel", styles: ["c19", "school"], p: 0.2, build: (c, s) => {
      if (c.layout.storeys < 1 || c.f.len < 5) return;
      const x = c.f.len / 2, z0 = storeyZ2(c, 0), z1 = z0 + c.layout.storeyM * Math.min(2, c.layout.storeys) - 0.2;
      s.box(c.f, x - 1.3, x + 1.3, 0, 0.8, z0, z1, c.wallHex, true);
      s.box(c.f, x - 1.1, x + 1.1, 0.8, 0.82, z0 + 0.5, z1 - 0.4, GLASS2);
      s.box(c.f, x - 1.4, x + 1.4, 0, 0.9, z1, z1 + 0.15, STONE3);
    } },
    { id: "cornice-brackets", group: "crown", styles: ["c19", "canal"], p: 0.35, build: (c, s) => {
      const z = c.top - 0.15;
      s.box(c.f, 0, c.f.len, 0, 0.3, z - 0.1, z + 0.1, STONE3, true);
      for (let x = 0.4; x < c.f.len - 0.2; x += 1.1) s.box(c.f, x - 0.06, x + 0.06, 0, 0.24, z - 0.42, z - 0.1, STONE3);
    } },
    { id: "door-canopy", group: "door-frame", styles: ["c19", "school", "postwar"], p: 0.25, build: (c, s) => {
      const x = doorX(c);
      if (x == null) return;
      const z = c.base + Math.min(2.6, c.layout.groundM - 0.25);
      s.box(c.f, x - 0.8, x + 0.8, 0, 0.9, z, z + 0.1, c.style === "c19" ? IRON2 : CONCRETE, true);
    } },
    { id: "downpipe", styles: ALL, p: 0.4, build: (c, s) => {
      const x = hash012(`${c.wallKey}:dp`) < 0.5 ? 0.15 : c.f.len - 0.15;
      s.box(c.f, x - 0.05, x + 0.05, 0, 0.1, c.base, c.top - 0.2, "#4a4d50");
      s.box(c.f, x - 0.15, x + 0.15, 0, 0.2, c.top - 0.45, c.top - 0.2, "#4a4d50");
    } },
    { id: "gutter", group: "crown", styles: ["canal", "c19", "school"], p: 0.3, build: (c, s) => {
      s.box(c.f, 0, c.f.len, 0, 0.16, c.top - 0.12, c.top, "#3a3d40", true);
    } },
    // --- Amsterdam School ------------------------------------------------------------
    { id: "brick-balcony", styles: ["school"], p: 0.3, build: (c, s) => {
      for (let k = 1; k < Math.min(4, c.layout.storeys + 1); k++) {
        const x = c.f.len / 2, z = storeyZ2(c, k - 1) + 0.05;
        s.box(c.f, x - 1.4, x + 1.4, 0, 1, z, z + 0.15, c.wallHex, true);
        s.box(c.f, x - 1.4, x + 1.4, 0.85, 1, z + 0.15, z + 1, c.wallHex);
      }
    } },
    { id: "brick-bands", styles: ["school"], p: 0.35, build: (c, s) => {
      for (let k = 0; k < c.layout.storeys; k++) s.box(c.f, 0, c.f.len, 0, 0.05, storeyZ2(c, k) - 0.15, storeyZ2(c, k), "#6b3a2c");
    } },
    { id: "stair-glass", styles: ["school", "postwar", "modern"], p: 0.3, build: (c, s) => {
      const x = doorX(c) ?? c.f.len / 2;
      s.box(c.f, x - 0.5, x + 0.5, 0, 0.06, c.base + c.layout.groundM + 0.3, c.top - 0.6, GLASS2);
    } },
    { id: "window-grilles", styles: ["school", "c19"], p: 0.15, build: (c, s) => {
      const d = doorX(c);
      for (const x of windowXs(c).slice(0, 4)) {
        if (d != null && Math.abs(x - d) < 0.8) continue;
        for (let k = -2; k <= 2; k++) s.box(c.f, x + k * 0.22 - 0.02, x + k * 0.22 + 0.02, 0.04, 0.08, c.base + 0.8, c.base + 2.4, IRON2);
      }
    } },
    // --- Postwar / modern ------------------------------------------------------------------
    { id: "balcony-slabs", styles: ["postwar"], p: 0.5, build: (c, s) => {
      for (let k = 0; k < Math.min(6, c.layout.storeys); k++) for (let i = 0; i < c.layout.bays; i += 2) {
        const x = bayCentre(c.layout, i), z = storeyZ2(c, k) + 0.02;
        s.box(c.f, x - 1.4, x + 1.4, 0, 1.2, z, z + 0.15, CONCRETE, true);
        s.box(c.f, x - 1.4, x + 1.4, 1.15, 1.2, z + 0.15, z + 1, k % 2 ? "#d9d4c7" : "#c84b3c");
      }
    } },
    { id: "gallery-walkway", styles: ["postwar"], p: 0.18, build: (c, s) => {
      for (let k = 0; k < Math.min(8, c.layout.storeys); k++) {
        const z = storeyZ2(c, k) + 0.02;
        s.box(c.f, 0, c.f.len, 0, 1.5, z, z + 0.18, CONCRETE, true);
        s.box(c.f, 0, c.f.len, 1.45, 1.5, z + 0.18, z + 1.05, "#e6e2d8");
      }
    } },
    { id: "satellite-dishes", styles: ["postwar"], p: 0.3, build: (c, s) => {
      for (let k = 0; k < 3; k++) {
        const x = hash012(`${c.wallKey}:sd${k}`) * c.f.len, z = storeyZ2(c, Math.floor(hash012(`${c.wallKey}:sz${k}`) * Math.max(1, c.layout.storeys))) + 1.3;
        s.box(c.f, x - 0.3, x + 0.3, 0.9, 0.95, z - 0.3, z + 0.3, "#e9e7e2");
      }
    } },
    { id: "entrance-slab", styles: ["postwar", "modern", "tower"], p: 0.4, build: (c, s) => {
      const x = doorX(c);
      if (x == null) return;
      s.box(c.f, x - 1.6, x + 1.6, 0, 1.8, c.base + 2.55, c.base + 2.8, CONCRETE, true);
    } },
    { id: "glass-balconies", styles: ["modern", "tower"], p: 0.45, build: (c, s) => {
      for (let k = 0; k < Math.min(8, c.layout.storeys); k++) {
        const z = storeyZ2(c, k) + 0.02, x = c.f.len * (0.25 + 0.5 * (k % 2));
        s.box(c.f, x - 1.6, x + 1.6, 0, 1.3, z, z + 0.12, CONCRETE, true);
        s.box(c.f, x - 1.6, x + 1.6, 1.26, 1.3, z + 0.12, z + 1.05, "#a9c4cf");
      }
    } },
    { id: "vertical-fins", styles: ["modern", "tower"], p: 0.25, build: (c, s) => {
      for (let x = 0.6; x < c.f.len - 0.3; x += 1.5) s.box(c.f, x - 0.06, x + 0.06, 0, 0.45, c.base + c.layout.groundM, c.top - 0.3, "#d6d2c8");
    } },
    { id: "garage-door", styles: ["postwar"], p: 0.12, build: (c, s) => {
      if (!c.groundLevel || c.f.len < 4) return;
      const x = c.f.len - 2;
      s.box(c.f, x - 1.25, x + 1.25, 0, 0.04, c.base, c.base + 2.3, "#9aa0a6");
    } },
    { id: "plinth", group: "plinth", styles: ["canal", "c19", "school"], p: 0.35, build: (c, s) => {
      if (c.groundLevel) s.box(c.f, 0, c.f.len, 0, 0.06, c.base, c.base + 0.5, "#3a3530");
    } },
    // --- Street life ------------------------------------------------------------------
    { id: "parked-bikes", styles: ALL, p: 0.3, build: (c, s, r) => {
      if (!c.groundLevel) return;
      const n = 1 + Math.floor(r * 4), x0 = hash012(`${c.wallKey}:bx`) * Math.max(0, c.f.len - n * 0.7);
      for (let k = 0; k < n; k++) {
        const x = x0 + k * 0.7, hex2 = pickOf2(["#1d1d1f", "#2f3d4a", "#4a1f25", "#2c3f36"], hash012(`${c.wallKey}:bc${k}`));
        for (const v of [0.2, 1.25]) s.box(c.f, x - 0.015, x + 0.015, v, v + 0.62, c.base + 0.02, c.base + 0.64, "#202224");
        s.box(c.f, x - 0.025, x + 0.025, 0.5, 1, c.base + 0.55, c.base + 0.6, hex2);
        s.box(c.f, x - 0.025, x + 0.025, 0.95, 1.02, c.base + 0.3, c.base + 0.95, hex2);
        s.box(c.f, x - 0.06, x + 0.06, 0.42, 0.62, c.base + 0.88, c.base + 0.94, "#141414");
        s.box(c.f, x - 0.25, x + 0.25, 1.05, 1.1, c.base + 0.98, c.base + 1.02, hex2);
      }
    } },
    { id: "bike-racks", styles: ["school", "postwar", "modern"], p: 0.2, build: (c, s) => {
      if (!c.groundLevel) return;
      for (let x = 1; x < Math.min(c.f.len - 0.5, 9); x += 0.8) s.box(c.f, x - 0.03, x + 0.03, 1.2, 1.9, c.base, c.base + 0.8, "#8a8f94");
    } },
    { id: "bench", styles: ["canal", "c19"], p: 0.1, build: (c, s) => {
      if (!c.groundLevel) return;
      const x = c.f.len * 0.3;
      s.box(c.f, x - 0.8, x + 0.8, 0.1, 0.5, c.base, c.base + 0.45, WOOD);
      s.box(c.f, x - 0.8, x + 0.8, 0.05, 0.12, c.base + 0.45, c.base + 0.9, WOOD);
    } },
    { id: "door-lantern", styles: ["canal", "c19"], p: 0.3, build: (c, s) => {
      const x = doorX(c);
      if (x == null) return;
      const z = c.base + 2.3;
      s.box(c.f, x + 0.6, x + 0.63, 0, 0.22, z + 0.26, z + 0.29, IRON2);
      s.box(c.f, x + 0.56, x + 0.67, 0.14, 0.25, z, z + 0.24, IRON2);
      s.box(c.f, x + 0.575, x + 0.655, 0.13, 0.26, z + 0.04, z + 0.2, "#e8c878");
    } },
    { id: "house-flag", styles: ["canal", "c19"], p: 0.06, build: (c, s, r) => {
      const z = storeyZ2(c, 0) + 0.5;
      s.box(c.f, 0.5, 0.54, 0, 1.6, z, z + 0.04, "#d9d4c7");
      const colours = r < 0.4 ? ["#ae1c28", "#ffffff", "#21468b"] : r < 0.7 ? ["#ec0000", "#000000", "#ec0000"] : ["#e40303", "#ff8c00", "#008026"];
      colours.forEach((hex2, i) => s.box(c.f, 0.52, 0.55, 0.6, 1.55, z - 0.15 - i * 0.2, z - i * 0.2, hex2));
    } },
    { id: "scaffolding", styles: ALL, p: 0.025, build: (c, s) => {
      const h = c.top - c.base, L = Math.min(c.f.len, 10);
      for (let x = 0; x <= L; x += 2.5) s.box(c.f, x - 0.03, x + 0.03, 0.9, 0.96, c.base, c.base + h, "#9aa0a6");
      for (let z = 2; z < h; z += 2) s.box(c.f, 0, L, 0.3, 1, c.base + z, c.base + z + 0.05, "#c9a76a", true);
    } }
  ];
  var ROOF_COMPONENTS = [
    { id: "roof-terrace", styles: ["canal", "c19", "school", "postwar"], p: 0.18, build: (c, s, r) => {
      const { len, wid } = c.rect, u = len * 0.25, v = wid * 0.25;
      for (const [a, b, p, q2] of [[-u, u, -v, -v + 0.04], [-u, u, v - 0.04, v], [-u, -u + 0.04, -v, v], [u - 0.04, u, -v, v]]) roofBox(c, s, a, b, p, q2, c.z, c.z + 1, "#9a9fa3");
      roofBox(c, s, -0.03, 0.03, -0.03, 0.03, c.z, c.z + 2, "#e9e6de");
      roofBox(c, s, -1, 1, -1, 1, c.z + 2, c.z + 2.1, pickOf2(["#e85a3c", "#f2b92e", "#ffffff", "#2a9d8f"], r));
    } },
    { id: "roof-extension", styles: ["c19", "school", "postwar"], p: 0.15, build: (c, s) => {
      const { len, wid } = c.rect;
      if (len < 8 || wid < 6) return;
      roofBox(c, s, -len * 0.3, len * 0.3, -wid * 0.1, wid * 0.35, c.z, c.z + 2.6, "#5d6064");
      roofBox(c, s, -len * 0.3, len * 0.3, -wid * 0.12, -wid * 0.1, c.z + 0.3, c.z + 2.2, GLASS2);
    } },
    { id: "ac-units", styles: ["postwar", "modern", "tower", "school"], p: 0.35, build: (c, s) => {
      for (let k = 0; k < 3; k++) {
        const u = (hash012(`${c.id}:ac${k}`) - 0.5) * c.rect.len * 0.7, v = (hash012(`${c.id}:av${k}`) - 0.5) * c.rect.wid * 0.7;
        roofBox(c, s, u - 0.5, u + 0.5, v - 0.4, v + 0.4, c.z, c.z + 0.9, "#c9cbcd");
      }
    } },
    { id: "skylights", styles: ALL, p: 0.3, build: (c, s) => {
      for (let k = 0; k < 2; k++) {
        const u = (hash012(`${c.id}:sk${k}`) - 0.5) * c.rect.len * 0.6;
        roofBox(c, s, u - 0.6, u + 0.6, -0.5, 0.5, c.z, c.z + 0.35, GLASS2);
      }
    } },
    { id: "solar-panels", styles: ["c19", "school", "postwar", "modern"], p: 0.25, build: (c, s) => {
      const { len, wid } = c.rect;
      for (let k = 0; k < Math.min(5, Math.floor(len / 2.2)); k++) {
        const u = -len * 0.35 + k * 2.2;
        roofBox(c, s, u, u + 1.7, -wid * 0.3, -wid * 0.3 + 1, c.z + 0.2, c.z + 0.45, "#2b3a55");
      }
    } },
    { id: "antenna", styles: ["canal", "c19", "school", "postwar"], p: 0.15, build: (c, s) => {
      roofBox(c, s, -0.03, 0.03, 0.3, 0.36, c.z, c.z + 3.2, "#8a8f94");
      roofBox(c, s, -0.6, 0.6, 0.31, 0.35, c.z + 2.8, c.z + 2.84, "#8a8f94");
    } },
    { id: "roof-garden", styles: ["postwar", "modern", "school"], p: 0.15, build: (c, s) => {
      const { len, wid } = c.rect;
      roofBox(c, s, -len * 0.35, len * 0.35, -wid * 0.35, wid * 0.35, c.z, c.z + 0.08, "#5f8a4a");
      roofBox(c, s, -0.6, 0.6, -0.6, 0.6, c.z + 0.08, c.z + 1.4, GREEN);
    } },
    { id: "lift-housing", styles: ["postwar", "modern", "tower"], p: 0.4, build: (c, s) => {
      const u = c.rect.len * 0.2;
      roofBox(c, s, u - 1.2, u + 1.2, -1.2, 1.2, c.z, c.z + 2.4, "#a7a49c");
    } },
    { id: "vent-stacks", styles: ["canal", "c19", "school", "postwar"], p: 0.3, build: (c, s) => {
      for (let k = 0; k < 3; k++) {
        const u = (hash012(`${c.id}:vs${k}`) - 0.5) * c.rect.len * 0.7;
        roofBox(c, s, u - 0.1, u + 0.1, -0.1 + k * 0.4, 0.1 + k * 0.4, c.z, c.z + 0.9, "#6a6d70");
      }
    } },
    { id: "water-tank", styles: ["school", "postwar"], p: 0.06, build: (c, s) => {
      roofBox(c, s, -1.2, 1.2, -1.2, 1.2, c.z + 1.6, c.z + 3.6, "#7c6a58");
      for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) roofBox(c, s, u - 0.06, u + 0.06, v - 0.06, v + 0.06, c.z, c.z + 1.6, IRON2);
    } }
  ];
  var FIRST = [
    "kroonlijst",
    "console-cornice",
    "corbel-roofline",
    "stepped-parapet",
    "white-fascia",
    "door-surround",
    "portiek",
    "brick-door-arch",
    "stoop",
    "double-stoop",
    "hoist-beam",
    "hoist-hood",
    "window-sills",
    "iron-balconies",
    "brick-fins"
  ];
  var ALL_WALL = [...ORNAMENT_COMPONENTS, ...STREET_FURNITURE];
  var WALL_COMPONENTS = [...FIRST.map((id) => ALL_WALL.find((c) => c.id === id)), ...ALL_WALL.filter((c) => !FIRST.includes(c.id))];
  var ATOMIC = new Set(ORNAMENT_COMPONENTS.map((c) => c.id));
  var COMPONENT_COUNT = WALL_COMPONENTS.length + ROOF_COMPONENTS.length;

  // src/canalRecall/threeBuildingMesh.ts
  var parseHex = (hex2) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex2);
    if (!m) return [200, 190, 175];
    const v = parseInt(m[1], 16);
    return [v >> 16 & 255, v >> 8 & 255, v & 255];
  };
  var LID_SHADE = 0.58 + 0.42 * 0.8;
  var RUN_TURN_DEG = 25;
  var COS_RUN = Math.cos(RUN_TURN_DEG * Math.PI / 180);
  function buildKitChunk(parts, layers) {
    let tris = 0;
    for (const part of parts) tris += part.tris.length;
    const vertexCount = tris * 3;
    const positions = new Float32Array(vertexCount * 3), uvs = new Float32Array(vertexCount * 2);
    const layerArr = new Uint8Array(vertexCount), tints = new Uint8Array(vertexCount * 4), accents = new Uint8Array(vertexCount * 4).fill(255);
    const indices = new Uint32Array(vertexCount);
    const ranges = [];
    let v = 0;
    for (const part of parts) {
      if (!part.tris.length) continue;
      const start = v;
      for (const t of part.tris) {
        const [r, g, b] = parseHex(t.hex);
        const shade = Math.max(0.5, Math.min(1, 0.58 + 0.42 * Math.max(0, t.n[0] * -0.35 + t.n[1] * 0.5 + t.n[2] * 0.8)));
        for (let k = 0; k < 3; k++) {
          positions[v * 3] = t.p[k][0];
          positions[v * 3 + 1] = t.p[k][1];
          positions[v * 3 + 2] = t.p[k][2];
          uvs[v * 2] = t.uv[k][0];
          uvs[v * 2 + 1] = t.uv[k][1];
          layerArr[v] = layers[t.layer];
          tints[v * 4] = r;
          tints[v * 4 + 1] = g;
          tints[v * 4 + 2] = b;
          tints[v * 4 + 3] = shade * 255;
          indices[v] = v;
          v++;
        }
      }
      ranges.push({ id: part.id, start, count: v - start });
    }
    return { positions, uvs, layers: layerArr, tints, accents, indices, ranges, vertexCount, quadCount: Math.ceil(tris / 2), wallCount: 0, buildingCount: ranges.length };
  }

  // src/canalRecall/landmarkKitsViewer.ts
  var CENTRES = {
    Westerkerk: [4.88361, 52.37439],
    Zuiderkerk: [4.89955, 52.3702],
    Montelbaanstoren: [4.90557, 52.37205],
    Noorderkerk: [4.88619, 52.37956],
    "Royal Palace": [4.89182, 52.37326]
  };
  var q = new URLSearchParams(location.search);
  var kitName = q.get("kit") ?? "Westerkerk";
  var az = Number(q.get("az") ?? 30);
  var el = Number(q.get("el") ?? 18);
  var zoom = Number(q.get("d") ?? 1);
  var [clng, clat] = CENTRES[kitName];
  var kx = 111320 * Math.cos(clat * Math.PI / 180);
  var ky = 110540;
  var tileOf = (lng, lat) => {
    const n = 2 ** 14, r = lat * Math.PI / 180;
    return [Math.floor((lng + 180) / 360 * n), Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)];
  };
  async function loadTile(x, y) {
    const response = await fetch(`/data/extracts/amsterdam/building-tiles/14/${x}/${y}.geojson.gz`);
    if (!response.ok) return [];
    const bytes = new Uint8Array(await response.arrayBuffer());
    const text = bytes[0] === 31 && bytes[1] === 139 ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text() : new TextDecoder().decode(bytes);
    return JSON.parse(text).features ?? [];
  }
  (async () => {
    const THREE = window.CanalRecallThree.THREE;
    const [tx, ty] = tileOf(clng, clat);
    const features = (await Promise.all([-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => loadTile(tx + dx, ty + dy))))).flat();
    const local = (ring) => ring.map(([lng, lat]) => [(lng - clng) * kx, (lat - clat) * ky]);
    const kit = KITS.find((k) => k.name === kitName);
    const mine = /* @__PURE__ */ new Set([...kit.tiers.map((t) => t.id), ...kit.stacks.map((s) => s.onId), ...kit.roofs.map((r) => r.id)]);
    const parts = /* @__PURE__ */ new Map(), context = [];
    for (const f of features) {
      const g = f.geometry, ring = g.type === "Polygon" ? g.coordinates[0] : g.coordinates[0][0], id = String(f.properties.id);
      const pts = local(ring);
      if (mine.has(id)) parts.set(id, { id, ring: pts, minHeightM: Number(f.properties.minHeight) || 0, heightM: Number(f.properties.height) });
      else if (Math.hypot(pts[0][0], pts[0][1]) < 70) context.push({ pts, h: Number(f.properties.height) || 8, min: Number(f.properties.minHeight) || 0 });
    }
    const chunk = buildKitChunk(kitGeometry(kit, parts), { plain: 0, flat: 0, slope: 0 });
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e9e4d4");
    scene.add(new THREE.HemisphereLight(16777215, 10063744, 1.6));
    const sun = new THREE.DirectionalLight(16773853, 1.8);
    sun.position.set(-40, 80, 60);
    scene.add(sun);
    const geometry = new THREE.BufferGeometry();
    const pos = new Float32Array(chunk.vertexCount * 3), col = new Float32Array(chunk.vertexCount * 3);
    for (let i = 0; i < chunk.vertexCount; i++) {
      pos[i * 3] = chunk.positions[i * 3];
      pos[i * 3 + 1] = chunk.positions[i * 3 + 2];
      pos[i * 3 + 2] = -chunk.positions[i * 3 + 1];
      const s = chunk.tints[i * 4 + 3] / 255;
      for (let c = 0; c < 3; c++) col[i * 3 + c] = chunk.tints[i * 4 + c] / 255 * s;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    scene.add(mesh);
    for (const c of context) {
      const shape = new THREE.Shape(c.pts.map(([x, y]) => new THREE.Vector2(x, y)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(1, c.h - c.min), bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      g.translate(0, c.min, 0);
      scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: "#b9b2a4" })));
    }
    for (const roof of kit.roofs) {
      const part = parts.get(roof.id);
      if (!part) continue;
      const shape = new THREE.Shape(part.ring.map(([x, y]) => new THREE.Vector2(x, y)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.5, part.heightM - roof.riseM - part.minHeightM), bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      g.translate(0, part.minHeightM, 0);
      scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: kit.wall?.hex ?? "#9a5240" })));
    }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: "#ddd7c6" }));
    ground.position.y = -0.05;
    scene.add(ground);
    let top = 0;
    for (const p of parts.values()) top = Math.max(top, p.heightM);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(innerWidth, innerHeight);
    document.body.style.margin = "0";
    document.body.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 1, 2e3);
    const [cx, cz] = [...parts.values()].reduce((a2, p) => [a2[0] + p.ring[0][0] / parts.size, a2[1] - p.ring[0][1] / parts.size], [0, 0]);
    const dist = (Number(q.get("r") ?? 0) || Math.max(60, top * 1.7)) / zoom, a = az * Math.PI / 180, e = el * Math.PI / 180;
    const focusY = Number(q.get("y") ?? top * 0.45);
    camera.position.set(cx + Math.sin(a) * Math.cos(e) * dist, focusY + Math.sin(e) * dist, cz - Math.cos(a) * Math.cos(e) * dist);
    camera.lookAt(cx, focusY, cz);
    renderer.render(scene, camera);
    window.__kitInfo = { parts: parts.size, tris: chunk.vertexCount / 3, top };
    document.title = "ready";
  })();
})();
