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
      const { cx: cx2, cy, ux, uy } = this.rect;
      return [cx2 + p[0] * ux - p[1] * uy, cy + p[0] * uy + p[1] * ux, this.h0 + p[2]];
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
    wallUv(along2, z) {
      return [along2 / this.dims.bayM, z / this.dims.storeyM];
    }
    /** A flat-colour polygon fan (trim, decal): no texture. */
    flatPoly(pts, part, hint, hex2) {
      for (let i = 1; i < pts.length - 1; i++) this.tri(pts[0], pts[i], pts[i + 1], [0, 0], [0, 0], [0, 0], part, hint, hex2);
    }
    /** An axis-aligned box in local coordinates, all six faces unless `open` names some (e.g. 'bottom'). */
    box(u0, u1, v0, v1, z0, z1, part, hex2, open = []) {
      const P = (u, v, z) => [u, v, z];
      const f = (name2, a, b, c, d, hint) => {
        if (!open.includes(name2)) this.quad(a, b, c, d, [0, 0], [1, 0], [1, 1], [0, 1], part, hint, hex2);
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
        const cx2 = side * Math.min(...arc.map((p) => Math.abs(p[0]))), cy = Math.min(...arc.map((p) => p[1]));
        fanDecal(s, f, e, [cx2, cy], arc, trimHex);
      }
      crown(s, prof, f, e, top, trimHex, g.crownBase ?? top - 0.6);
      speklagen(s, prof, f, e, top, trimHex, [0.62]);
    }
    if (shape === "clock") crown(s, prof, f, e, top, trimHex, g.crownBase ?? top - 0.6);
    if (shape === "bell") {
      const span2 = profileSpan(prof, top - 0.5);
      if (span2) rectDecal(s, f, e, span2[0] + 0.05, span2[1] - 0.05, top - 0.5, top - 0.34, trimHex);
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
    const y0 = 0.3, h = Math.min(1.5, top * 0.45), span2 = profileSpan(prof, y0 + h + 0.1);
    if (!span2) return;
    const w = Math.min(1, half * 0.4, span2[1] - span2[0] - 0.35);
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
        if (cornice && plan.gableEnds?.[e < 0 ? 0 : 1] !== false) {
          const prof = gableProfile("cornice", W, R);
          gableSlab(s, prof, e, L, accents ? "trim" : "plate", trim);
          if (accents) gableAccents(s, { shape: "cornice", prof, f, e, W, R, trimHex: trim, shutterHex: "", shutters: false });
        } else {
          s.quad([f, -W / 2, 0], [f, W / 2, 0], [f, vc, zc], [f, -vc, zc], s.wallUv(-W / 2, 0), s.wallUv(W / 2, 0), s.wallUv(vc, zc), s.wallUv(-vc, zc), "plate", [e, 0, 0]);
          if (accents && plan.gableEnds?.[e < 0 ? 0 : 1] !== false) vergeBoards(s, f, e, [[[-W / 2, 0], [-vc, zc]], [[vc, zc], [W / 2, 0]]], trim);
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
      const exterior = plan.gableEnds?.[e < 0 ? 0 : 1] !== false;
      if (plan.kind === "pitched" || !exterior) {
        s.tri([f, -W / 2, 0], [f, W / 2, 0], [f, 0, R], s.wallUv(-W / 2, 0), s.wallUv(W / 2, 0), s.wallUv(0, R), "plate", [e, 0, 0]);
        if (accents && exterior) vergeBoards(s, f, e, [[[-W / 2, 0], [0, R]], [[0, R], [W / 2, 0]]], trim);
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
      const s = pts.map((p) => p[0] * hx + p[1] * hy), lo = Math.min(...s), span2 = Math.max(...s) - lo || 1, zHigh = form.z1High;
      zAt = (p) => form.z1 + (zHigh - form.z1) * (p[0] * hx + p[1] * hy - lo) / span2;
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
    const name2 = `Generic ${KIND_NAME[kind]} ${id}`, hex2 = WORSHIP_WALL[era];
    const rows = worshipWindows(eavesM);
    if (mode === "b" || mode === "w" && !rows.length) return { name: name2, wall: { plain: true, hex: hex2 }, tiers: [], stacks: [], roofs: [], body: [id] };
    return {
      name: name2,
      wall: { plain: true, hex: hex2 },
      tiers: [],
      stacks: [],
      roofs: [],
      halls: [{ id, widthM: 0, anchor: [0, 0], fit: mode === "h", eavesM, riseM, mat: era === "o" ? "slate" : "tile", windows: rows.length ? { rows, glassHex: "#3a434c" } : void 0 }]
    };
  }
  var GENERIC_WORSHIP_KITS = WORSHIP_BUILDINGS.map(worshipKit);

  // src/canalRecall/publicBuildingData.ts
  var PUBLIC_BUILDINGS = [
    ["NL.IMBAG.Pand.0305100000000252", "s", "f", 3.7, 0, "m"],
    // (unnamed), 1981, 3.7 m, 1248 m2
    ["NL.IMBAG.Pand.0305100000001060", "s", "f", 5.6, 0, "e"],
    // (unnamed), 1955, 5.6 m, 1248 m2
    ["NL.IMBAG.Pand.0305100000001188", "s", "f", 6.2, 0, "m"],
    // (unnamed), 1985, 6.2 m, 964 m2
    ["NL.IMBAG.Pand.0358100019106022", "s", "f", 4.3, 0, "m"],
    // (unnamed), 1960, 4.3 m, 2840 m2
    ["NL.IMBAG.Pand.0358100020880018", "s", "f", 3.8, 0, "m"],
    // (unnamed), 1990, 3.8 m, 981 m2
    ["NL.IMBAG.Pand.0358100020881991", "s", "f", 8.3, 0, "m"],
    // (unnamed), 1974, 8.3 m, 886 m2
    ["NL.IMBAG.Pand.0358100021235050", "s", "f", 7.8, 0, "e"],
    // (unnamed), 1933, 7.8 m, 1940 m2
    ["NL.IMBAG.Pand.0358100021569571", "s", "f", 4.5, 0, "m"],
    // (unnamed), 1971, 4.5 m, 1267 m2
    ["NL.IMBAG.Pand.0362100001054252", "s", "f", 12.6, 0, "e"],
    // Amity International School Amsterdam, 1958, 12.6 m, 3221 m2
    ["NL.IMBAG.Pand.0362100001054264", "s", "f", 5.7, 0, "m"],
    // De Cirkel, 1981, 5.7 m, 5948 m2
    ["NL.IMBAG.Pand.0362100001054502", "s", "f", 7.7, 0, "m"],
    // De Bloeiwijzer, 1974, 7.7 m, 1802 m2
    ["NL.IMBAG.Pand.0362100001056681", "s", "f", 10.3, 0, "e"],
    // (unnamed), 1955, 10.3 m, 341 m2
    ["NL.IMBAG.Pand.0362100001056689", "s", "f", 9.8, 0, "e"],
    // Amsteltaal, 1940, 9.8 m, 604 m2
    ["NL.IMBAG.Pand.0362100001056925", "s", "f", 7.3, 0, "o"],
    // S.A.K.B. Kunstlokaal, 1926, 7.3 m, 514 m2
    ["NL.IMBAG.Pand.0362100001057631", "s", "f", 9.3, 0, "e"],
    // Het Palet, 1955, 9.3 m, 984 m2
    ["NL.IMBAG.Pand.0362100001060286", "s", "f", 6, 0, "m"],
    // (unnamed), 1972, 6 m, 1036 m2
    ["NL.IMBAG.Pand.0362100001060288", "s", "f", 8.1, 0, "m"],
    // Omnibus, 1974, 8.1 m, 924 m2
    ["NL.IMBAG.Pand.0362100001063786", "s", "f", 6.8, 0, "m"],
    // De Triangel, 1993, 6.8 m, 1867 m2
    ["NL.IMBAG.Pand.0362100001071115", "s", "f", 4.5, 0, "m"],
    // Tulip Gakuen, 1988, 4.5 m, 713 m2
    ["NL.IMBAG.Pand.0362100001077423", "s", "f", 9.7, 0, "e"],
    // Piet Heinschool, 1952, 9.7 m, 952 m2
    ["NL.IMBAG.Pand.0362100001079502", "s", "f", 3.7, 0, "e"],
    // Het Palet, 1956, 3.7 m, 351 m2
    ["NL.IMBAG.Pand.0362100001081052", "s", "f", 3.5, 0, "e"],
    // (unnamed), 1954, 3.5 m, 348 m2
    ["NL.IMBAG.Pand.0362100001091554", "s", "f", 14, 0, "m"],
    // NOVA College - De Parelvisserslaan, 1989, 14 m, 1227 m2
    ["NL.IMBAG.Pand.0362100001094331", "s", "f", 6.8, 0, "m"],
    // (unnamed), 1973, 6.8 m, 466 m2
    ["NL.IMBAG.Pand.0362100001110286", "s", "f", 11.3, 0, "m"],
    // Keizer Karel College, 1968, 11.3 m, 6891 m2
    ["NL.IMBAG.Pand.0362100001111443", "c", "p", 16.6, 0, "m"],
    // Cinema Amstelveen, 2002, 16.6 m, 2501 m2
    ["NL.IMBAG.Pand.0362100001111444", "c", "p", 13.2, 0, "m"],
    // Schouwburg Amstelveen, 1975, 13.2 m, 2157 m2
    ["NL.IMBAG.Pand.0363100012061252", "s", "h", 10, 5, "o"],
    // Nicolaas Maesschool, 1916, 13.5 m, 624 m2
    ["NL.IMBAG.Pand.0363100012061926", "s", "h", 14.1, 5, "o"],
    // (unnamed), 1924, 17.6 m, 568 m2
    ["NL.IMBAG.Pand.0363100012061961", "s", "f", 16.3, 0, "m"],
    // Op de Kade, 1994, 16.3 m, 3222 m2
    ["NL.IMBAG.Pand.0363100012062340", "s", "f", 11.6, 0, "o"],
    // Azalea I, 1928, 11.6 m, 446 m2
    ["NL.IMBAG.Pand.0363100012063764", "s", "f", 3.9, 0, "m"],
    // (unnamed), 1983, 3.9 m, 2499 m2
    ["NL.IMBAG.Pand.0363100012064693", "s", "f", 12.7, 0, "e"],
    // (unnamed), 1931, 12.7 m, 547 m2
    ["NL.IMBAG.Pand.0363100012065279", "s", "f", 4.2, 0, "m"],
    // Alexander Roozendaalschool, 1982, 4.2 m, 2951 m2
    ["NL.IMBAG.Pand.0363100012065903", "s", "f", 15, 0, "m"],
    // Obs De Waterkant, 1985, 15 m, 1078 m2
    ["NL.IMBAG.Pand.0363100012066710", "s", "f", 4.2, 0, "m"],
    // Wereldwijs, 1976, 4.2 m, 1339 m2
    ["NL.IMBAG.Pand.0363100012067061", "s", "f", 7.5, 0, "m"],
    // Waldorf aan de Werf, 1991, 7.5 m, 944 m2
    ["NL.IMBAG.Pand.0363100012068181", "s", "f", 4.7, 0, "m"],
    // Kentalis Signis SO/TOS Amsterdam/Assendelft, 1977, 4.7 m, 2299 m2
    ["NL.IMBAG.Pand.0363100012068345", "s", "f", 11.9, 0, "m"],
    // (unnamed), 1971, 11.9 m, 1216 m2
    ["NL.IMBAG.Pand.0363100012068581", "s", "f", 4.3, 0, "m"],
    // Het Gein, 1990, 4.3 m, 2010 m2
    ["NL.IMBAG.Pand.0363100012068625", "s", "f", 12, 0, "e"],
    // (unnamed), 1932, 12 m, 1025 m2
    ["NL.IMBAG.Pand.0363100012069994", "s", "f", 9.2, 0, "e"],
    // Lidwinaschool, 1956, 9.2 m, 1233 m2
    ["NL.IMBAG.Pand.0363100012070769", "s", "f", 11.1, 0, "m"],
    // 2e Daltonschool, 1983, 11.1 m, 914 m2
    ["NL.IMBAG.Pand.0363100012071822", "s", "f", 15.6, 0, "o"],
    // 1e Montessorischool de Wielewaal, 1926, 15.6 m, 746 m2
    ["NL.IMBAG.Pand.0363100012072950", "s", "f", 13.7, 0, "e"],
    // (unnamed), 1933, 13.7 m, 400 m2
    ["NL.IMBAG.Pand.0363100012073434", "s", "f", 8.5, 0, "o"],
    // De Apollo, 1900, 8.5 m, 1658 m2
    ["NL.IMBAG.Pand.0363100012074274", "s", "h", 9.7, 5, "o"],
    // Taalschool, 1922, 13.2 m, 638 m2
    ["NL.IMBAG.Pand.0363100012074804", "s", "f", 5.3, 0, "m"],
    // Holendrechtschool, 1977, 5.3 m, 2399 m2
    ["NL.IMBAG.Pand.0363100012074914", "s", "f", 12.7, 0, "e"],
    // IBS Elif Amsterdam Zuid, 1954, 12.7 m, 457 m2
    ["NL.IMBAG.Pand.0363100012075047", "s", "f", 7.5, 0, "m"],
    // De Boomgaard, 1983, 7.5 m, 1146 m2
    ["NL.IMBAG.Pand.0363100012075161", "s", "f", 4, 0, "m"],
    // (unnamed), 1975, 4 m, 1536 m2
    ["NL.IMBAG.Pand.0363100012075686", "s", "f", 6.6, 0, "m"],
    // De Botteloef, 1976, 6.6 m, 2114 m2
    ["NL.IMBAG.Pand.0363100012075737", "s", "h", 12.9, 5, "o"],
    // (unnamed), 1927, 16.4 m, 601 m2
    ["NL.IMBAG.Pand.0363100012076543", "s", "f", 19.1, 0, "o"],
    // Fons Vitae Lyceum, 1926, 19.1 m, 2863 m2
    ["NL.IMBAG.Pand.0363100012077054", "s", "f", 6.9, 0, "e"],
    // Immanuelschool, 1956, 6.9 m, 534 m2
    ["NL.IMBAG.Pand.0363100012077177", "s", "f", 7, 0, "m"],
    // Kiem Montessori, 1986, 7 m, 1143 m2
    ["NL.IMBAG.Pand.0363100012078294", "s", "f", 4.5, 0, "m"],
    // Huibersschool, 1965, 4.5 m, 1877 m2
    ["NL.IMBAG.Pand.0363100012079617", "s", "f", 9, 0, "m"],
    // (unnamed), 1987, 9 m, 684 m2
    ["NL.IMBAG.Pand.0363100012079921", "s", "f", 3.9, 0, "m"],
    // (unnamed), 1967, 3.9 m, 1195 m2
    ["NL.IMBAG.Pand.0363100012079924", "s", "f", 4.5, 0, "m"],
    // De Bonkelaar, 1973, 4.5 m, 1656 m2
    ["NL.IMBAG.Pand.0363100012080098", "s", "f", 7.2, 0, "m"],
    // Metis Montessori Lyceum, 1991, 7.2 m, 723 m2
    ["NL.IMBAG.Pand.0363100012080150", "s", "f", 7.3, 0, "m"],
    // 7ᵉ Montessorischool, 1982, 7.3 m, 2118 m2
    ["NL.IMBAG.Pand.0363100012080302", "s", "f", 6.8, 0, "m"],
    // De Amsterdamse Plus, 1974, 6.8 m, 2363 m2
    ["NL.IMBAG.Pand.0363100012080308", "s", "f", 13.6, 0, "o"],
    // Basisschool Corantijn, 1924, 13.6 m, 689 m2
    ["NL.IMBAG.Pand.0363100012080630", "s", "f", 17.2, 0, "e"],
    // Montessori Lyceum Oostpoort, 1932, 17.2 m, 357 m2
    ["NL.IMBAG.Pand.0363100012081651", "s", "f", 6.7, 0, "e"],
    // De Roos, 1932, 6.7 m, 1027 m2
    ["NL.IMBAG.Pand.0363100012082745", "s", "f", 8.5, 0, "e"],
    // Twiskeschool, 1959, 8.5 m, 1235 m2
    ["NL.IMBAG.Pand.0363100012083302", "s", "f", 12.4, 0, "m"],
    // De Amsterdamse Montessori School, 1983, 12.4 m, 444 m2
    ["NL.IMBAG.Pand.0363100012083832", "s", "f", 8.1, 0, "e"],
    // IBS El Amien, 1953, 8.1 m, 1461 m2
    ["NL.IMBAG.Pand.0363100012084484", "c", "p", 5.5, 0, "m"],
    // Stichting Theaterstraat, 1981, 5.5 m, 835 m2
    ["NL.IMBAG.Pand.0363100012085252", "s", "f", 11.1, 0, "m"],
    // College De Meer, 1962, 11.1 m, 1572 m2
    ["NL.IMBAG.Pand.0363100012085366", "s", "f", 18.3, 0, "m"],
    // (unnamed), 1969, 18.3 m, 7454 m2
    ["NL.IMBAG.Pand.0363100012085435", "c", "p", 12.4, 0, "m"],
    // Meervaart Theater, 1999, 12.4 m, 4686 m2
    ["NL.IMBAG.Pand.0363100012085618", "c", "p", 13.2, 0, "m"],
    // Bijlmerparktheater, 2009, 13.2 m, 921 m2
    ["NL.IMBAG.Pand.0363100012086684", "s", "f", 12.6, 0, "e"],
    // De Weidevogel, 1931, 12.6 m, 491 m2
    ["NL.IMBAG.Pand.0363100012087388", "s", "f", 17.1, 0, "e"],
    // Gerrit van der Veen College, 1931, 17.1 m, 1284 m2
    ["NL.IMBAG.Pand.0363100012087482", "c", "p", 17.7, 0, "o"],
    // Het Veem Theater, 1900, 17.7 m, 1519 m2
    ["NL.IMBAG.Pand.0363100012087825", "s", "h", 16.5, 5, "o"],
    // Montessori Lyceum Amsterdam, 1912, 20 m, 906 m2
    ["NL.IMBAG.Pand.0363100012088641", "s", "f", 13.5, 0, "o"],
    // (unnamed), 1927, 13.5 m, 345 m2
    ["NL.IMBAG.Pand.0363100012089331", "s", "f", 6.4, 0, "m"],
    // (unnamed), 1984, 6.4 m, 451 m2
    ["NL.IMBAG.Pand.0363100012089596", "s", "f", 4.1, 0, "m"],
    // Wereldwijs, 1980, 4.1 m, 1621 m2
    ["NL.IMBAG.Pand.0363100012089744", "s", "f", 8.6, 0, "m"],
    // Kindcentrum de Vindplaats, 1989, 8.6 m, 1648 m2
    ["NL.IMBAG.Pand.0363100012090063", "s", "f", 12, 0, "m"],
    // SOB, 1976, 12 m, 2010 m2
    ["NL.IMBAG.Pand.0363100012090993", "s", "f", 15.6, 0, "e"],
    // Eerste Openluchtschool, 1932, 15.6 m, 367 m2
    ["NL.IMBAG.Pand.0363100012091041", "s", "f", 7.3, 0, "m"],
    // Van Detschool, 1978, 7.3 m, 1768 m2
    ["NL.IMBAG.Pand.0363100012091321", "s", "f", 12.4, 0, "m"],
    // ROC van Amsterdam, 1971, 12.4 m, 1587 m2
    ["NL.IMBAG.Pand.0363100012091522", "s", "f", 14.3, 0, "e"],
    // As-Siddieq, 1931, 14.3 m, 652 m2
    ["NL.IMBAG.Pand.0363100012091856", "s", "f", 16.4, 0, "e"],
    // St. Ignatiusgymnasium, 1956, 16.4 m, 1992 m2
    ["NL.IMBAG.Pand.0363100012092742", "c", "p", 11.2, 0, "e"],
    // Zonnehuis, 1932, 11.2 m, 972 m2
    ["NL.IMBAG.Pand.0363100012093296", "s", "f", 4.2, 0, "m"],
    // De Zijderoute, 1987, 4.2 m, 1276 m2
    ["NL.IMBAG.Pand.0363100012093382", "s", "f", 14.3, 0, "o"],
    // Philadelphia, 1925, 14.3 m, 621 m2
    ["NL.IMBAG.Pand.0363100012093415", "s", "f", 11.4, 0, "m"],
    // 4e Montessorischool De Pinksterbloem, 1982, 11.4 m, 1807 m2
    ["NL.IMBAG.Pand.0363100012094306", "s", "f", 8, 0, "m"],
    // Universum, 1971, 8 m, 1287 m2
    ["NL.IMBAG.Pand.0363100012094391", "c", "p", 14.7, 0, "e"],
    // Amsterdams Theaterhuis, 1936, 14.7 m, 2333 m2
    ["NL.IMBAG.Pand.0363100012095378", "s", "f", 11.7, 0, "e"],
    // Hervormd Lyceum Zuid, 1930, 11.7 m, 606 m2
    ["NL.IMBAG.Pand.0363100012095474", "s", "f", 10, 0, "m"],
    // Thula, 1986, 10 m, 1219 m2
    ["NL.IMBAG.Pand.0363100012097095", "s", "f", 8.9, 0, "m"],
    // (unnamed), 1982, 8.9 m, 1073 m2
    ["NL.IMBAG.Pand.0363100012097934", "s", "f", 11.1, 0, "e"],
    // El Kadisia, 1957, 11.1 m, 922 m2
    ["NL.IMBAG.Pand.0363100012098037", "s", "f", 10.1, 0, "e"],
    // (unnamed), 1959, 10.1 m, 2131 m2
    ["NL.IMBAG.Pand.0363100012098213", "s", "f", 4.9, 0, "m"],
    // ROC Op Maat West, 1960, 4.9 m, 1622 m2
    ["NL.IMBAG.Pand.0363100012100092", "c", "p", 19.9, 0, "m"],
    // Pathé Arena, 2000, 19.9 m, 3938 m2
    ["NL.IMBAG.Pand.0363100012100220", "s", "f", 8.2, 0, "m"],
    // Buitenveldertse Montessori School, 1974, 8.2 m, 1401 m2
    ["NL.IMBAG.Pand.0363100012100351", "s", "h", 16.5, 5, "o"],
    // Lucia Marthas Institute for Performing Arts, 1912, 20 m, 302 m2
    ["NL.IMBAG.Pand.0363100012100376", "s", "f", 16.2, 0, "e"],
    // Montessori Lyceum Oostpoort, 1930, 16.2 m, 537 m2
    ["NL.IMBAG.Pand.0363100012101375", "s", "f", 10.6, 0, "m"],
    // Dr. Rijk Kramerschool, 1988, 10.6 m, 494 m2
    ["NL.IMBAG.Pand.0363100012101771", "s", "f", 27.5, 0, "e"],
    // Metropolis lyceum, 1936, 27.5 m, 3966 m2
    ["NL.IMBAG.Pand.0363100012102419", "s", "f", 14.3, 0, "o"],
    // De Kleine Nicolaas, 1922, 14.3 m, 409 m2
    ["NL.IMBAG.Pand.0363100012102814", "s", "f", 10.9, 0, "m"],
    // (unnamed), 1983, 10.9 m, 4766 m2
    ["NL.IMBAG.Pand.0363100012104151", "s", "f", 11.5, 0, "e"],
    // (unnamed), 1959, 11.5 m, 514 m2
    ["NL.IMBAG.Pand.0363100012104990", "s", "h", 11.8, 4.8, "o"],
    // College ZUYD, 1924, 15.2 m, 718 m2
    ["NL.IMBAG.Pand.0363100012105242", "s", "f", 11.3, 0, "m"],
    // Bataviaschool, 1988, 11.3 m, 796 m2
    ["NL.IMBAG.Pand.0363100012105310", "s", "f", 7.7, 0, "m"],
    // Damstede 2 - Agora, 1972, 7.7 m, 1986 m2
    ["NL.IMBAG.Pand.0363100012106094", "s", "f", 4, 0, "m"],
    // De Tamboerijn, 1981, 4 m, 2501 m2
    ["NL.IMBAG.Pand.0363100012108191", "s", "f", 8, 0, "m"],
    // Ingenieur Lely Lyceum, 1983, 8 m, 7394 m2
    ["NL.IMBAG.Pand.0363100012108564", "s", "f", 16.4, 0, "e"],
    // 6e Montessorischool Anne Frank, 1935, 16.4 m, 750 m2
    ["NL.IMBAG.Pand.0363100012108636", "s", "h", 9.2, 3.7, "o"],
    // Azalea I, 1928, 11.8 m, 294 m2
    ["NL.IMBAG.Pand.0363100012109215", "s", "h", 10.8, 5, "o"],
    // Europaschool, 1924, 14.3 m, 803 m2
    ["NL.IMBAG.Pand.0363100012109431", "s", "f", 7.3, 0, "m"],
    // Bassischool Frankendael, 1985, 7.3 m, 1386 m2
    ["NL.IMBAG.Pand.0363100012110771", "s", "f", 4.8, 0, "m"],
    // Openbare Daltonschool Nellestein, 1979, 4.8 m, 4347 m2
    ["NL.IMBAG.Pand.0363100012111095", "s", "f", 3.3, 0, "m"],
    // (unnamed), 1992, 3.3 m, 606 m2
    ["NL.IMBAG.Pand.0363100012111133", "s", "h", 8.4, 5, "o"],
    // De Visserschool, 1929, 11.9 m, 880 m2
    ["NL.IMBAG.Pand.0363100012112062", "s", "f", 12.4, 0, "m"],
    // De Dapper, 1985, 12.4 m, 1619 m2
    ["NL.IMBAG.Pand.0363100012112226", "s", "f", 12.7, 0, "m"],
    // Willemsparkschool, 1983, 12.7 m, 448 m2
    ["NL.IMBAG.Pand.0363100012112291", "s", "f", 8.4, 0, "m"],
    // De Buikslotermeer, 1968, 8.4 m, 1493 m2
    ["NL.IMBAG.Pand.0363100012112357", "s", "f", 8.4, 0, "e"],
    // Slotermeerschool, 1955, 8.4 m, 2401 m2
    ["NL.IMBAG.Pand.0363100012112403", "s", "f", 10.7, 0, "e"],
    // (unnamed), 1933, 10.7 m, 888 m2
    ["NL.IMBAG.Pand.0363100012113048", "s", "f", 14.1, 0, "e"],
    // Olympiaschool, 1937, 14.1 m, 679 m2
    ["NL.IMBAG.Pand.0363100012113669", "s", "f", 10.3, 0, "o"],
    // Bassischool Frankendael (locatie Hogeweg), 1921, 10.3 m, 928 m2
    ["NL.IMBAG.Pand.0363100012115235", "s", "f", 27.8, 0, "m"],
    // Merkelbachschool, 1992, 27.8 m, 6227 m2
    ["NL.IMBAG.Pand.0363100012115402", "s", "f", 5.5, 0, "e"],
    // (unnamed), 1933, 5.5 m, 494 m2
    ["NL.IMBAG.Pand.0363100012115532", "s", "f", 10.3, 0, "m"],
    // (unnamed), 1994, 10.3 m, 1670 m2
    ["NL.IMBAG.Pand.0363100012116143", "s", "f", 4.1, 0, "m"],
    // Mobiel, 1983, 4.1 m, 2719 m2
    ["NL.IMBAG.Pand.0363100012116155", "c", "p", 12.2, 0, "m"],
    // Cinema De Vlugt, 1967, 12.2 m, 1258 m2
    ["NL.IMBAG.Pand.0363100012116483", "s", "f", 7.3, 0, "m"],
    // (unnamed), 1978, 7.3 m, 2055 m2
    ["NL.IMBAG.Pand.0363100012116722", "s", "f", 5.5, 0, "e"],
    // De Jaargetijden, 1955, 5.5 m, 1013 m2
    ["NL.IMBAG.Pand.0363100012116795", "s", "f", 8.5, 0, "m"],
    // De Mijlpaal, 1992, 8.5 m, 987 m2
    ["NL.IMBAG.Pand.0363100012117108", "s", "f", 15.5, 0, "o"],
    // International French School, 1913, 15.5 m, 522 m2
    ["NL.IMBAG.Pand.0363100012117415", "s", "f", 7.5, 0, "m"],
    // Kentalis Signis, 1976, 7.5 m, 1561 m2
    ["NL.IMBAG.Pand.0363100012117753", "s", "f", 8.3, 0, "m"],
    // Over Y College, 1980, 8.3 m, 2922 m2
    ["NL.IMBAG.Pand.0363100012117953", "s", "f", 11, 0, "m"],
    // VierTaal College, 1991, 11 m, 1047 m2
    ["NL.IMBAG.Pand.0363100012118525", "s", "f", 13.3, 0, "o"],
    // (unnamed), 1927, 13.3 m, 359 m2
    ["NL.IMBAG.Pand.0363100012118764", "s", "f", 20.6, 0, "m"],
    // Lumion Amsterdam, 1973, 20.6 m, 3178 m2
    ["NL.IMBAG.Pand.0363100012120896", "s", "f", 15, 0, "o"],
    // (unnamed), 1928, 15 m, 2385 m2
    ["NL.IMBAG.Pand.0363100012121569", "s", "f", 16.9, 0, "e"],
    // Olympiaschool, 1931, 16.9 m, 568 m2
    ["NL.IMBAG.Pand.0363100012122517", "s", "f", 9.1, 0, "m"],
    // (unnamed), 1964, 9.1 m, 1405 m2
    ["NL.IMBAG.Pand.0363100012122803", "c", "p", 10.2, 0, "e"],
    // Podium Mozaïek, 1954, 10.2 m, 964 m2
    ["NL.IMBAG.Pand.0363100012123040", "s", "f", 13.2, 0, "e"],
    // (unnamed), 1939, 13.2 m, 1495 m2
    ["NL.IMBAG.Pand.0363100012123240", "c", "p", 19.8, 0, "m"],
    // AFAS Live, 2001, 19.8 m, 6732 m2
    ["NL.IMBAG.Pand.0363100012125752", "s", "f", 3.8, 0, "m"],
    // Boven  t IJ, 1975, 3.8 m, 2067 m2
    ["NL.IMBAG.Pand.0363100012126767", "s", "f", 15.2, 0, "m"],
    // Denise, 1960, 15.2 m, 2844 m2
    ["NL.IMBAG.Pand.0363100012126872", "s", "f", 4.9, 0, "m"],
    // Driemaster, 1976, 4.9 m, 3106 m2
    ["NL.IMBAG.Pand.0363100012127997", "s", "f", 16.1, 0, "o"],
    // Berlage Lyceum, 1924, 16.1 m, 1384 m2
    ["NL.IMBAG.Pand.0363100012128730", "s", "f", 7.4, 0, "m"],
    // Azalea II, 1991, 7.4 m, 1272 m2
    ["NL.IMBAG.Pand.0363100012129398", "s", "f", 14.8, 0, "e"],
    // Spinoza Lyceum, 1957, 14.8 m, 2812 m2
    ["NL.IMBAG.Pand.0363100012131629", "s", "f", 8.1, 0, "m"],
    // Multatulischool, 1988, 8.1 m, 2016 m2
    ["NL.IMBAG.Pand.0363100012132628", "s", "f", 8.3, 0, "e"],
    // Kentalis Signis CMB, 1955, 8.3 m, 2013 m2
    ["NL.IMBAG.Pand.0363100012133077", "s", "f", 14.6, 0, "m"],
    // Huygens College, 1990, 14.6 m, 1420 m2
    ["NL.IMBAG.Pand.0363100012133123", "s", "f", 4.9, 0, "m"],
    // Clusius College, 1985, 4.9 m, 2648 m2
    ["NL.IMBAG.Pand.0363100012133297", "s", "f", 14.6, 0, "e"],
    // Hervormd Lyceum Zuid, 1935, 14.6 m, 1739 m2
    ["NL.IMBAG.Pand.0363100012134381", "s", "f", 16, 0, "o"],
    // Berlage Lyceum, 1924, 16 m, 1362 m2
    ["NL.IMBAG.Pand.0363100012134530", "s", "f", 6.2, 0, "m"],
    // (unnamed), 1977, 6.2 m, 487 m2
    ["NL.IMBAG.Pand.0363100012134770", "s", "f", 9, 0, "m"],
    // IJpleinschool, 1986, 9 m, 531 m2
    ["NL.IMBAG.Pand.0363100012137219", "s", "f", 8.4, 0, "e"],
    // Al Wafa, 1956, 8.4 m, 556 m2
    ["NL.IMBAG.Pand.0363100012137446", "s", "f", 8.2, 0, "m"],
    // Louis Bouwmeesterschool, 1960, 8.2 m, 2044 m2
    ["NL.IMBAG.Pand.0363100012137724", "s", "f", 8.3, 0, "e"],
    // PI-school Professor Waterink West, 1956, 8.3 m, 563 m2
    ["NL.IMBAG.Pand.0363100012138092", "s", "f", 12.2, 0, "e"],
    // Tobiasschool, 1954, 12.2 m, 2073 m2
    ["NL.IMBAG.Pand.0363100012139793", "s", "f", 6.9, 0, "m"],
    // Praktijkcollege De Atlant, 1992, 6.9 m, 1490 m2
    ["NL.IMBAG.Pand.0363100012142124", "s", "f", 6.7, 0, "m"],
    // (unnamed), 1978, 6.7 m, 460 m2
    ["NL.IMBAG.Pand.0363100012143192", "s", "f", 7.6, 0, "m"],
    // De Wereldburger, 1965, 7.6 m, 350 m2
    ["NL.IMBAG.Pand.0363100012143384", "s", "f", 12.5, 0, "m"],
    // Hervormd Lyceum West, 1962, 12.5 m, 3031 m2
    ["NL.IMBAG.Pand.0363100012143434", "s", "f", 7.8, 0, "m"],
    // De Indische Buurtschool, 1988, 7.8 m, 1093 m2
    ["NL.IMBAG.Pand.0363100012143602", "s", "f", 8.3, 0, "e"],
    // (unnamed), 1956, 8.3 m, 560 m2
    ["NL.IMBAG.Pand.0363100012143874", "s", "f", 4, 0, "m"],
    // De Brink, 1980, 4 m, 2254 m2
    ["NL.IMBAG.Pand.0363100012143944", "s", "f", 7.2, 0, "m"],
    // Het Spectrum, 1973, 7.2 m, 935 m2
    ["NL.IMBAG.Pand.0363100012144879", "s", "f", 9.5, 0, "m"],
    // Al Wafa, 1964, 9.5 m, 1028 m2
    ["NL.IMBAG.Pand.0363100012145699", "s", "f", 10, 0, "o"],
    // Kairos, 1927, 10 m, 711 m2
    ["NL.IMBAG.Pand.0363100012147735", "s", "f", 8.4, 0, "m"],
    // De Indische Buurtschool, 1987, 8.4 m, 1176 m2
    ["NL.IMBAG.Pand.0363100012148474", "s", "f", 8.1, 0, "m"],
    // School van Maas en Waal, 1987, 8.1 m, 907 m2
    ["NL.IMBAG.Pand.0363100012148715", "s", "f", 15.6, 0, "m"],
    // (unnamed), 1961, 15.6 m, 1432 m2
    ["NL.IMBAG.Pand.0363100012148948", "s", "f", 4, 0, "m"],
    // Tweede Openluchtschool, 1992, 4 m, 1391 m2
    ["NL.IMBAG.Pand.0363100012149675", "s", "f", 7.6, 0, "m"],
    // De Vlaamse Reus, 1993, 7.6 m, 1376 m2
    ["NL.IMBAG.Pand.0363100012149878", "s", "f", 17.7, 0, "o"],
    // Amsterdams Lyceum, 1920, 17.7 m, 1486 m2
    ["NL.IMBAG.Pand.0363100012150241", "s", "f", 4.9, 0, "m"],
    // (unnamed), 1985, 4.9 m, 537 m2
    ["NL.IMBAG.Pand.0363100012151320", "s", "f", 4.4, 0, "m"],
    // Prof. Dr. I.C. Van Houteschool, 1980, 4.4 m, 1774 m2
    ["NL.IMBAG.Pand.0363100012152606", "s", "f", 14.9, 0, "o"],
    // (unnamed), 1909, 14.9 m, 334 m2
    ["NL.IMBAG.Pand.0363100012152781", "s", "h", 7.7, 4.3, "o"],
    // Aldoende, 1917, 10.7 m, 536 m2
    ["NL.IMBAG.Pand.0363100012154481", "s", "f", 9.9, 0, "m"],
    // Westerparkschool, 1984, 9.9 m, 1229 m2
    ["NL.IMBAG.Pand.0363100012154521", "s", "f", 17.6, 0, "m"],
    // Geert Groote School Roeske, 1987, 17.6 m, 3446 m2
    ["NL.IMBAG.Pand.0363100012154937", "s", "f", 6.1, 0, "m"],
    // De Zevensprong, 1994, 6.1 m, 1828 m2
    ["NL.IMBAG.Pand.0363100012155572", "s", "f", 11.2, 0, "m"],
    // Rosa Boekdrukker, 1994, 11.2 m, 900 m2
    ["NL.IMBAG.Pand.0363100012155611", "s", "f", 20.2, 0, "o"],
    // Metis Montessori Lyceum, 1904, 20.2 m, 981 m2
    ["NL.IMBAG.Pand.0363100012155763", "s", "f", 14.1, 0, "o"],
    // (unnamed), 1888, 14.1 m, 515 m2
    ["NL.IMBAG.Pand.0363100012156533", "s", "f", 15.9, 0, "o"],
    // Joke Smit, 1925, 15.9 m, 1235 m2
    ["NL.IMBAG.Pand.0363100012156882", "s", "f", 13.4, 0, "e"],
    // WSV, 1930, 13.4 m, 630 m2
    ["NL.IMBAG.Pand.0363100012157107", "s", "f", 11.3, 0, "o"],
    // 5e Montessorischool Watergraafsmeer, 1929, 11.3 m, 624 m2
    ["NL.IMBAG.Pand.0363100012158248", "s", "f", 12.7, 0, "o"],
    // 5e Montessorischool Watergraafsmeer, 1929, 12.7 m, 344 m2
    ["NL.IMBAG.Pand.0363100012158405", "s", "f", 17.6, 0, "o"],
    // (unnamed), 1925, 17.6 m, 930 m2
    ["NL.IMBAG.Pand.0363100012158651", "s", "f", 15.4, 0, "o"],
    // 9e Montessorischool De Scholekster, 1921, 15.4 m, 783 m2
    ["NL.IMBAG.Pand.0363100012160100", "s", "h", 11.6, 5, "o"],
    // Oscar Carré, 1890, 15.1 m, 787 m2
    ["NL.IMBAG.Pand.0363100012163070", "s", "f", 3.6, 0, "m"],
    // IJpleinschool, 1986, 3.6 m, 436 m2
    ["NL.IMBAG.Pand.0363100012163079", "s", "f", 16.6, 0, "e"],
    // Geert Groote School Plein, 1934, 16.6 m, 836 m2
    ["NL.IMBAG.Pand.0363100012163104", "s", "f", 13.6, 0, "o"],
    // Cartesius Lyceum, 1899, 13.6 m, 1350 m2
    ["NL.IMBAG.Pand.0363100012163664", "s", "f", 10.4, 0, "o"],
    // Brede School Annie M.G. Schmidt, 1911, 10.4 m, 311 m2
    ["NL.IMBAG.Pand.0363100012163802", "s", "f", 12.6, 0, "e"],
    // LUCA, 1935, 12.6 m, 825 m2
    ["NL.IMBAG.Pand.0363100012164511", "s", "f", 15.1, 0, "o"],
    // 5e Montessorischool Watergraafsmeer, 1929, 15.1 m, 895 m2
    ["NL.IMBAG.Pand.0363100012164683", "s", "f", 14.1, 0, "o"],
    // Kindcentrum Sarphati, 1905, 14.1 m, 738 m2
    ["NL.IMBAG.Pand.0363100012164714", "s", "f", 19.4, 0, "o"],
    // Pax, 1888, 19.4 m, 929 m2
    ["NL.IMBAG.Pand.0363100012164850", "s", "f", 18.2, 0, "o"],
    // Lycée français Vincent van Gogh, 1903, 18.2 m, 500 m2
    ["NL.IMBAG.Pand.0363100012164940", "s", "f", 10.6, 0, "m"],
    // Boekmanschool, 1992, 10.6 m, 1219 m2
    ["NL.IMBAG.Pand.0363100012165625", "s", "f", 15.1, 0, "o"],
    // De Witte Olifant, 1921, 15.1 m, 768 m2
    ["NL.IMBAG.Pand.0363100012167253", "s", "f", 12.5, 0, "o"],
    // WSV, 1929, 12.5 m, 875 m2
    ["NL.IMBAG.Pand.0363100012167313", "s", "h", 11.3, 4.8, "o"],
    // Cartesius Lyceum, 1892, 14.6 m, 521 m2
    ["NL.IMBAG.Pand.0363100012168139", "s", "f", 14.8, 0, "m"],
    // De Burght, 1968, 14.8 m, 467 m2
    ["NL.IMBAG.Pand.0363100012168547", "c", "p", 12.7, 0, "o"],
    // De Toneelmakerij, 12.7 m, 2725 m2
    ["NL.IMBAG.Pand.0363100012168684", "c", "p", 16.3, 0, "e"],
    // De Balie, 1936, 16.3 m, 1105 m2
    ["NL.IMBAG.Pand.0363100012168735", "c", "p", 21.3, 0, "o"],
    // Melkweg, 1905, 21.3 m, 1837 m2
    ["NL.IMBAG.Pand.0363100012168811", "s", "f", 14.7, 0, "o"],
    // Theo Thijssenschool, 1874, 14.7 m, 498 m2
    ["NL.IMBAG.Pand.0363100012169564", "s", "f", 22.6, 0, "o"],
    // Barlaeus Gymnasium, 1866, 22.6 m, 479 m2
    ["NL.IMBAG.Pand.0363100012169565", "s", "h", 18.3, 5, "o"],
    // Barlaeus Gymnasium, 1885, 21.8 m, 864 m2
    ["NL.IMBAG.Pand.0363100012169852", "c", "p", 14.6, 0, "m"],
    // Bellevue, 2010, 14.6 m, 1106 m2
    ["NL.IMBAG.Pand.0363100012169888", "s", "f", 11.4, 0, "m"],
    // 14e Montessorischool De Jordaan, 1993, 11.4 m, 442 m2
    ["NL.IMBAG.Pand.0363100012170167", "s", "f", 9.2, 0, "o"],
    // Theo Thijssenschool, 1892, 9.2 m, 581 m2
    ["NL.IMBAG.Pand.0363100012170259", "c", "p", 19.5, 0, "m"],
    // Nederlandse Film en Televisie Academie, 1999, 19.5 m, 2146 m2
    ["NL.IMBAG.Pand.0363100012170328", "s", "f", 9.8, 0, "m"],
    // Alan Turing School, 1982, 9.8 m, 1847 m2
    ["NL.IMBAG.Pand.0363100012170573", "s", "f", 8.7, 0, "m"],
    // Basisschool Oostelijke Eilanden, 1994, 8.7 m, 1193 m2
    ["NL.IMBAG.Pand.0363100012171200", "c", "p", 17.9, 0, "o"],
    // Compagnietheater, 1793, 17.9 m, 1055 m2
    ["NL.IMBAG.Pand.0363100012171760", "s", "f", 12.9, 0, "m"],
    // De Witte Olifant, 1988, 12.9 m, 517 m2
    ["NL.IMBAG.Pand.0363100012172090", "s", "h", 6, 4.6, "o"],
    // Vinseschool, 1905, 9.2 m, 723 m2
    ["NL.IMBAG.Pand.0363100012172975", "s", "f", 11.1, 0, "m"],
    // Theo Thijssenschool, 1988, 11.1 m, 460 m2
    ["NL.IMBAG.Pand.0363100012173113", "s", "f", 15.2, 0, "o"],
    // Theo Thijssen School, 1890, 15.2 m, 348 m2
    ["NL.IMBAG.Pand.0363100012174390", "c", "p", 24.3, 0, "e"],
    // Pathé City, 1935, 24.3 m, 1222 m2
    ["NL.IMBAG.Pand.0363100012179384", "c", "p", 22.1, 0, "m"],
    // Pathé de Munt, 2001, 22.1 m, 1099 m2
    ["NL.IMBAG.Pand.0363100012180412", "c", "p", 15.8, 0, "o"],
    // Universiteitstheater, 15.8 m, 819 m2
    ["NL.IMBAG.Pand.0363100012180757", "s", "f", 12.2, 0, "o"],
    // (unnamed), 1898, 12.2 m, 957 m2
    ["NL.IMBAG.Pand.0363100012180835", "s", "f", 14.8, 0, "o"],
    // (unnamed), 1882, 14.8 m, 969 m2
    ["NL.IMBAG.Pand.0363100012182486", "s", "f", 20.6, 0, "m"],
    // Asvo, 1990, 20.6 m, 538 m2
    ["NL.IMBAG.Pand.0363100012183194", "s", "f", 10.3, 0, "o"],
    // Brede School Annie M.G. Schmidt, 1911, 10.3 m, 327 m2
    ["NL.IMBAG.Pand.0363100012185844", "c", "p", 27.3, 0, "m"],
    // Academie voor Theater en Dans, 1996, 27.3 m, 3041 m2
    ["NL.IMBAG.Pand.0363100012186868", "s", "f", 10.3, 0, "m"],
    // IJpleinschool, 1986, 10.3 m, 354 m2
    ["NL.IMBAG.Pand.0363100012191081", "s", "f", 8.2, 0, "m"],
    // Open Schoolgemeenschap Bijlmer, 1973, 8.2 m, 988 m2
    ["NL.IMBAG.Pand.0363100012208464", "s", "f", 7.5, 0, "m"],
    // Japanese School Amsterdam, 1960, 7.5 m, 1818 m2
    ["NL.IMBAG.Pand.0363100012212122", "s", "f", 4.2, 0, "o"],
    // Amsterdams Lyceum, 1925, 4.2 m, 1356 m2
    ["NL.IMBAG.Pand.0363100012233517", "s", "f", 15.5, 0, "o"],
    // Muziekpakhuis, 1924, 15.5 m, 290 m2
    ["NL.IMBAG.Pand.0363100012233590", "s", "f", 15, 0, "o"],
    // (unnamed), 1892, 15 m, 1502 m2
    ["NL.IMBAG.Pand.0363100012235989", "c", "p", 13.3, 0, "o"],
    // De Krakeling, 1885, 13.3 m, 1387 m2
    ["NL.IMBAG.Pand.0363100012236544", "c", "p", 19.8, 0, "o"],
    // Marci Panis, 1896, 19.8 m, 1814 m2
    ["NL.IMBAG.Pand.0363100012236586", "s", "f", 18.5, 0, "o"],
    // Aldoende, 1899, 18.5 m, 1037 m2
    ["NL.IMBAG.Pand.0363100012236656", "s", "f", 14.5, 0, "o"],
    // The British School, 1890, 14.5 m, 4667 m2
    ["NL.IMBAG.Pand.0363100012236816", "s", "f", 14.8, 0, "o"],
    // De Kaap, 1916, 14.8 m, 860 m2
    ["NL.IMBAG.Pand.0363100012236840", "s", "h", 14.5, 5, "o"],
    // Montessori Lyceum Amsterdam, 1900, 18 m, 604 m2
    ["NL.IMBAG.Pand.0363100012236988", "c", "p", 10.3, 0, "o"],
    // Clifford Studio, 1909, 10.3 m, 842 m2
    ["NL.IMBAG.Pand.0363100012237030", "s", "f", 15.6, 0, "o"],
    // Vrijeschool Amsterdam West, 1896, 15.6 m, 920 m2
    ["NL.IMBAG.Pand.0363100012237077", "c", "p", 16.7, 0, "o"],
    // LAB111, 1928, 16.7 m, 1280 m2
    ["NL.IMBAG.Pand.0363100012237203", "s", "f", 22, 0, "o"],
    // Montessori Lyceum Amsterdam, 1912, 22 m, 1916 m2
    ["NL.IMBAG.Pand.0363100012237336", "s", "f", 15.1, 0, "o"],
    // Brede School Annie M.G. Schmidt, 1911, 15.1 m, 725 m2
    ["NL.IMBAG.Pand.0363100012238475", "c", "p", 18.8, 0, "m"],
    // Studio H67, 2013, 18.8 m, 1451 m2
    ["NL.IMBAG.Pand.0363100012240368", "c", "p", 25.8, 0, "m"],
    // DeLaMar (West), 2014, 25.8 m, 4492 m2
    ["NL.IMBAG.Pand.0363100012246190", "c", "p", 17.5, 0, "m"],
    // CC Amstel, 2018, 17.5 m, 1268 m2
    ["NL.IMBAG.Pand.0363100012249726", "c", "p", 23.5, 0, "m"],
    // Pathé Amsterdam Noord, 2020, 23.5 m, 5980 m2
    ["NL.IMBAG.Pand.0363100012254404", "c", "p", 6.4, 0, "m"],
    // Vue, 2021, 6.4 m, 3707 m2
    ["NL.IMBAG.Pand.0363100012571556", "c", "p", 20.4, 0, "o"],
    // DeLaMar, 20.4 m, 1457 m2
    ["NL.IMBAG.Pand.0384100000005587", "s", "f", 8.7, 0, "m"],
    // Gymzaal Schoolstraat, 1960, 8.7 m, 503 m2
    ["NL.IMBAG.Pand.0384100000005599", "s", "f", 5.3, 0, "m"],
    // De Octopus, 1990, 5.3 m, 2272 m2
    ["NL.IMBAG.Pand.0384100000005895", "c", "p", 11, 0, "m"],
    // De Omval, 1996, 11 m, 1190 m2
    ["NL.IMBAG.Pand.0384100000006041", "s", "f", 6.1, 0, "m"],
    // Sint Petrusschool, 1981, 6.1 m, 605 m2
    ["NL.IMBAG.Pand.0393100000000125", "s", "f", 5.4, 0, "m"],
    // Jong Geleerd, 1994, 5.4 m, 866 m2
    ["NL.IMBAG.Pand.0393100000000414", "s", "f", 5.1, 0, "m"],
    // Jong Geleerd, 1981, 5.1 m, 742 m2
    ["NL.IMBAG.Pand.0394100000207281", "s", "f", 5.7, 0, "e"],
    // (unnamed), 1955, 5.7 m, 908 m2
    ["NL.IMBAG.Pand.0394100000208189", "s", "f", 8.1, 0, "m"],
    // Rietveldschool, 1963, 8.1 m, 2595 m2
    ["NL.IMBAG.Pand.0394100000208246", "s", "f", 8.2, 0, "e"],
    // Oranje Nassau School, 1931, 8.2 m, 1595 m2
    ["NL.IMBAG.Pand.0394100000209255", "s", "f", 6.7, 0, "m"],
    // (unnamed), 1973, 6.7 m, 455 m2
    ["NL.IMBAG.Pand.0394100000209553", "s", "f", 3.7, 0, "m"],
    // (unnamed), 1970, 3.7 m, 1085 m2
    ["NL.IMBAG.Pand.0394100000209846", "s", "f", 6.9, 0, "m"],
    // Doctor Plesmanschool, 1962, 6.9 m, 452 m2
    ["NL.IMBAG.Pand.0394100000217330", "s", "f", 4.3, 0, "m"],
    // (unnamed), 1971, 4.3 m, 1122 m2
    ["NL.IMBAG.Pand.0394100000226772", "s", "f", 9.1, 0, "e"],
    // (unnamed), 1931, 9.1 m, 1388 m2
    ["NL.IMBAG.Pand.0394100000242779", "s", "f", 4.6, 0, "m"],
    // (unnamed), 1971, 4.6 m, 1223 m2
    ["NL.IMBAG.Pand.0394100000242783", "s", "f", 4.3, 0, "m"],
    // (unnamed), 1971, 4.3 m, 1230 m2
    ["NL.IMBAG.Pand.0394100000258704", "s", "f", 4.4, 0, "m"],
    // (unnamed), 1975, 4.4 m, 1302 m2
    ["NL.IMBAG.Pand.0415100000002681", "s", "f", 4, 0, "m"],
    // OBS De Stap, 1984, 4 m, 1510 m2
    ["NL.IMBAG.Pand.0415100000002748", "s", "f", 5.7, 0, "m"],
    // OBS Ds JL de Wagemakerschool, 1979, 5.7 m, 1160 m2
    ["NL.IMBAG.Pand.0424100000001256", "s", "f", 5.2, 0, "m"],
    // (unnamed), 1980, 5.2 m, 1428 m2
    ["NL.IMBAG.Pand.0424100000004412", "s", "f", 6, 0, "m"],
    // (unnamed), 1981, 6 m, 833 m2
    ["NL.IMBAG.Pand.0437100000003305", "s", "f", 4, 0, "m"],
    // Het Kofschip, 1977, 4 m, 1334 m2
    ["NL.IMBAG.Pand.0437100000003427", "s", "f", 8.8, 0, "e"],
    // Het Kofschip, 1959, 8.8 m, 576 m2
    ["NL.IMBAG.Pand.0437100000006427", "s", "f", 3.6, 0, "m"],
    // (unnamed), 1977, 3.6 m, 298 m2
    ["NL.IMBAG.Pand.0437100000007315", "s", "f", 7.5, 0, "m"],
    // Amstelschool, 1974, 7.5 m, 715 m2
    ["NL.IMBAG.Pand.0457100000054413", "s", "f", 11.2, 0, "e"],
    // Jozefschool Weesp, 1933, 11.2 m, 534 m2
    ["NL.IMBAG.Pand.0457100000062574", "s", "f", 4.9, 0, "e"],
    // De Triangel, 1956, 4.9 m, 2620 m2
    ["NL.IMBAG.Pand.0457100000063604", "s", "f", 4.7, 0, "e"],
    // Van der Muelen-Vastwijkschool, 1956, 4.7 m, 1694 m2
    ["NL.IMBAG.Pand.0479100000000190", "c", "p", 6.4, 0, "m"],
    // Podium De Flux, 1960, 6.4 m, 3469 m2
    ["NL.IMBAG.Pand.0479100000001512", "s", "f", 3.9, 0, "m"],
    // (unnamed), 1984, 3.9 m, 583 m2
    ["NL.IMBAG.Pand.0852100000007043", "s", "f", 4.5, 0, "m"],
    // (unnamed), 1974, 4.5 m, 1673 m2
    ["NL.IMBAG.Pand.1696100000004556", "s", "f", 4, 0, "m"],
    // (unnamed), 1976, 4 m, 1327 m2
    ["r3699016", "c", "p", 12, 0, "o"],
    // Studio/K, 1910, 12 m, 3494 m2
    ["w1362284226", "s", "f", 9, 0, "m"],
    // (unnamed), 1963, 9 m, 620 m2
    ["w1362284227", "s", "f", 12, 0, "m"],
    // (unnamed), 1963, 12 m, 1294 m2
    ["w1362309458", "s", "f", 6, 0, "m"],
    // (unnamed), 1963, 6 m, 462 m2
    ["w1362309461", "s", "f", 6, 0, "m"],
    // (unnamed), 1963, 6 m, 596 m2
    ["w1387551669", "s", "f", 6, 0, "m"],
    // (unnamed), 1973, 6 m, 353 m2
    ["w1421415124", "s", "f", 6, 0, "m"],
    // DE Brede School, 1973, 6 m, 749 m2
    ["w1421415126", "s", "f", 6, 0, "m"],
    // (unnamed), 1973, 6 m, 349 m2
    ["w1423983489", "s", "f", 6, 0, "m"],
    // (unnamed), 1973, 6 m, 744 m2
    ["w1423983494", "s", "f", 6, 0, "m"],
    // As-Soeffah, 1973, 6 m, 847 m2
    ["w1488019247", "c", "p", 21, 0, "m"],
    // Bijlmerbios film(t)huis, 1987, 21 m, 127 m2
    ["w1488019248", "c", "p", 21, 0, "m"],
    // Bijlmerbios film(t)huis, 1987, 21 m, 200 m2
    ["w1488019252", "c", "p", 21, 0, "m"],
    // Bijlmerbios film(t)huis, 1987, 21 m, 80 m2
    ["w1488019253", "c", "p", 21, 0, "m"],
    // Bijlmerbios film(t)huis, 1987, 21 m, 198 m2
    ["w1488019254", "c", "p", 24, 0, "m"],
    // Bijlmerbios film(t)huis, 1987, 24 m, 131 m2
    ["w1488019255", "c", "p", 24, 0, "m"],
    // Bijlmerbios film(t)huis, 1987, 24 m, 206 m2
    ["w1488019256", "c", "p", 30, 0, "m"],
    // Bijlmerbios film(t)huis, 1987, 30 m, 20 m2
    ["w1488019257", "c", "p", 18, 0, "m"],
    // Bijlmerbios film(t)huis, 1987, 18 m, 843 m2
    ["w1488019266", "c", "p", 21, 0, "m"],
    // Bijlmerbios film(t)huis, 1987, 21 m, 845 m2
    ["w1488019269", "c", "p", 6, 0, "m"],
    // Bijlmerbios film(t)huis, 1987, 6 m, 815 m2
    ["w1488019297", "s", "f", 24, 0, "m"],
    // (unnamed), 1987, 24 m, 828 m2
    ["w1488019298", "s", "f", 24, 0, "m"],
    // (unnamed), 1987, 24 m, 725 m2
    ["w1488019299", "s", "f", 21, 0, "m"],
    // (unnamed), 1987, 21 m, 873 m2
    ["w1488019300", "s", "f", 18, 0, "m"],
    // (unnamed), 1987, 18 m, 622 m2
    ["w1488019301", "s", "f", 15, 0, "m"],
    // Amsterdam International Community School, 1987, 15 m, 881 m2
    ["w1488019303", "s", "f", 6, 0, "m"],
    // (unnamed), 1987, 6 m, 1579 m2
    ["w1488019306", "s", "f", 6, 0, "m"],
    // (unnamed), 1987, 6 m, 744 m2
    ["w1488019307", "s", "f", 9, 0, "m"],
    // (unnamed), 1987, 9 m, 319 m2
    ["w1488019308", "s", "f", 6, 0, "m"],
    // (unnamed), 1987, 6 m, 750 m2
    ["w265853828", "c", "p", 19.1, 0, "m"],
    // Theater Amsterdam, 2014, 19.1 m, 5205 m2
    ["w267883763", "s", "f", 9, 0, "m"],
    // (unnamed), 1964, 9 m, 611 m2
    ["w280657731", "s", "f", 13.6, 0, "e"],
    // Oranje Nassauschool, 1930, 13.6 m, 798 m2
    ["w283332324", "s", "f", 9, 0, "e"],
    // (unnamed), 1935, 9 m, 803 m2
    ["w285287131", "s", "f", 9, 0, "m"],
    // (unnamed), 1962, 9 m, 1565 m2
    ["w44828165", "s", "f", 12.7, 0, "m"],
    // Damstede Lyceum, 1984, 12.7 m, 4119 m2
    ["w52296553", "s", "f", 9, 0, "m"]
    // (unnamed), 1974, 9 m, 1689 m2
  ];

  // src/canalRecall/publicBuildings.ts
  var PUBLIC_WALL = {
    c: { o: "#8a6350", e: "#8f6b58", m: "#a8a6a0" },
    s: { o: "#8a4a38", e: "#955a45", m: "#b5a68e" }
  };
  var round12 = (v) => Math.round(v * 10) / 10;
  function schoolWindows(eavesM, era) {
    const floorH = era === "o" ? 4 : era === "e" ? 3.6 : 3.4;
    const floors = Math.max(1, Math.min(5, Math.round(eavesM / floorH)));
    const step = eavesM / floors, rows = [];
    const winH = era === "o" ? 2.5 : era === "e" ? 2.2 : 1.7, sill = era === "o" ? 0.9 : 0.8;
    const widthM = era === "o" ? 2 : era === "e" ? 2.2 : 3, bayM = era === "o" ? 3.1 : era === "e" ? 3.3 : 3.5;
    for (let i = 0; i < floors; i++) {
      const z0 = i * step + sill, z1 = Math.min(z0 + winH, (i + 1) * step - 0.3);
      if (z1 - z0 < 1.2) continue;
      rows.push({ z0: round12(z0), z1: round12(z1), widthM, bayM, head: "flat" });
    }
    return rows;
  }
  var KIND_NAME2 = { c: "cinema", s: "school", f: "fire station", p: "police station", h: "hospital", o: "civic office" };
  function publicKit([id, kind, mode, eavesM, riseM, era]) {
    const name2 = `Generic ${KIND_NAME2[kind]} ${id}`;
    if (kind === "c" || mode === "p") {
      return { name: name2, wall: { plain: true, hex: PUBLIC_WALL.c[era] }, tiers: [], stacks: [], roofs: [], body: [id] };
    }
    const rows = schoolWindows(eavesM, era);
    const windows = { rows, glassHex: "#3a4650", frameHex: era === "m" ? void 0 : "#d8d2c4", plinth: era === "m" ? void 0 : { z1: 0.8, hex: "#8c877d" } };
    return {
      name: name2,
      wall: { plain: true, hex: PUBLIC_WALL.s[era] },
      tiers: [],
      stacks: [],
      roofs: [],
      halls: [{ id, widthM: 0, anchor: [0, 0], fit: mode === "h", eavesM, riseM, mat: "tile", windows }]
    };
  }
  var GENERIC_PUBLIC_KITS = PUBLIC_BUILDINGS.map(publicKit);

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
  var KITS = [...HAND_KITS, ...[...GENERIC_WORSHIP_KITS, ...GENERIC_PUBLIC_KITS].filter((k) => kitIds(k).every((id) => !HAND_IDS.has(id)))];
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
  function stage(sink, cx2, cy, ang, shape, w0, w1, z0, z1, mat, hexOverride) {
    const n = shape === "square" ? 4 : 8;
    const radius = (w) => shape === "square" ? w / 2 * Math.SQRT2 : w / 2 / Math.cos(Math.PI / 8);
    const off = shape === "square" ? Math.PI / 4 : Math.PI / 8;
    const ring = (w, z) => Array.from({ length: n }, (_, k) => {
      const a = ang + off + k * 2 * Math.PI / n;
      return [cx2 + Math.cos(a) * radius(w), cy + Math.sin(a) * radius(w), z];
    });
    const bottom = ring(w0, z0), top = w1 > 0 ? ring(w1, z1) : null, apex = [cx2, cy, z1];
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
  function clocks(sink, cx2, cy, ang, width, zc) {
    const r = Math.min(width * 0.3, 2.3);
    for (let k = 0; k < 4; k++) {
      const a = ang + k * Math.PI / 2, dx = Math.cos(a), dy = Math.sin(a), tx = -dy, ty = dx;
      const mx = cx2 + dx * (width / 2 + 0.55 + 0.06), my = cy + dy * (width / 2 + 0.55 + 0.06);
      for (const [rad, mat, lift] of [[r, "gold", 0], [r * 0.8, "white", 0.04]]) {
        const pts = Array.from({ length: 8 }, (_, i) => {
          const t = i * Math.PI / 4 + Math.PI / 8;
          return [mx + dx * lift + tx * Math.cos(t) * rad, my + dy * lift + ty * Math.cos(t) * rad, zc + Math.sin(t) * rad];
        });
        for (let i = 1; i < 7; i++) sink.tri(pts[0], pts[i], pts[i + 1], [0, 0], [1, 0], [1, 1], "flat", MAT_HEX[mat], [dx, dy, 0]);
      }
    }
  }
  function columns(sink, cx2, cy, ang, width, z0, z1, n) {
    for (let k = 0; k < n; k++) {
      const a = ang + k * 2 * Math.PI / n + Math.PI / n, rad = width / 2 + 0.1;
      stage(sink, cx2 + Math.cos(a) * rad, cy + Math.sin(a) * rad, a, "square", 0.7, 0.7, z0, z1, "white");
    }
  }
  function slab(sink, cx2, cy, ang, w, l, z0, zLow, zHigh, high, mat, hexOverride) {
    const ax = Math.cos(ang), ay = Math.sin(ang), bx = -ay, by = ax, hx = Math.cos(high), hy = Math.sin(high);
    const layer = layerFor(mat), hex2 = hexOverride ?? MAT_HEX[mat];
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => [cx2 + ax * (i * w) / 2 + bx * (j * l) / 2, cy + ay * (i * w) / 2 + by * (j * l) / 2]);
    const reach = Math.abs(hx * ax + hy * ay) * (w / 2) + Math.abs(hx * bx + hy * by) * (l / 2);
    const zAt = (p) => zLow + (zHigh - zLow) * (((p[0] - cx2) * hx + (p[1] - cy) * hy) / reach + 1) / 2;
    const tops = pts.map((p) => [p[0], p[1], zAt(p)]), feet = pts.map((p) => [p[0], p[1], z0]);
    let run = 0;
    for (let k = 0; k < 4; k++) {
      const k1 = (k + 1) % 4, side = Math.hypot(pts[k1][0] - pts[k][0], pts[k1][1] - pts[k][1]);
      const u0 = run / 5, u1 = (run + side) / 5;
      run += side;
      const mx = (pts[k][0] + pts[k1][0]) / 2 - cx2, my = (pts[k][1] + pts[k1][1]) / 2 - cy, hint = [mx, my, 0];
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
  function towerParts(sink, t, [cx2, cy], ang, baseZ, gable) {
    const w = t.widthM, z0 = t.z0 ?? baseZ, shape = t.shape ?? "square", body = t.mat ?? "brick";
    const hex2 = t.wallHex ?? (body === "brick" ? gable : void 0), capShape = t.capShape ?? "pyramid";
    if (capShape === "slant") {
      slab(sink, cx2, cy, ang, w, t.lenM ?? w, z0, t.z1, t.z1 + t.capM, (t.highBearingDeg ?? 0) * Math.PI / 180, body, hex2);
      return;
    }
    stage(sink, cx2, cy, ang, shape, w, w, z0, t.z1, body, hex2);
    if (shape === "square") stage(sink, cx2, cy, ang, "square", w + 0.8, w + 0.8, t.z1 - 0.6, t.z1, "stone");
    if (capShape === "pyramid") stage(sink, cx2, cy, ang, shape, t.capWidthM ?? w + 1.2, 0, t.z1, t.z1 + t.capM, t.cap, t.capHex);
    else {
      let z = t.z1;
      const base = shape === "square" ? w + 0.5 : w;
      for (const [r0, r1, h] of CAP_PROFILES[capShape]) {
        stage(sink, cx2, cy, ang, "octagon", base * r0, base * r1, z, z + h * t.capM, t.cap, t.capHex);
        z += h * t.capM;
      }
    }
    if (t.finial !== false) stage(sink, cx2, cy, ang, "octagon", 0.35, 0, t.z1 + t.capM, t.z1 + t.capM + 1.6, "gold");
  }
  function cloisterDome(sink, rect, z0, rise, inset, hex2) {
    const { cx: cx2, cy, ux, uy } = rect, vx = -uy, vy = ux;
    const ring = (d, z) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => [cx2 + ux * i * (rect.len / 2 - d) + vx * j * (rect.wid / 2 - d), cy + uy * i * (rect.len / 2 - d) + vy * j * (rect.wid / 2 - d), z]);
    const steps = [0, 22, 45, 67, 90].map((deg) => deg * Math.PI / 180);
    let lower = ring(0, z0);
    for (let s = 1; s < steps.length; s++) {
      const upper = ring(inset * (1 - Math.cos(steps[s])), z0 + rise * Math.sin(steps[s]));
      for (let k = 0; k < 4; k++) {
        const k1 = (k + 1) % 4, mx = (lower[k][0] + lower[k1][0]) / 2 - cx2, my = (lower[k][1] + lower[k1][1]) / 2 - cy;
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
    const disc2 = (r2, k = 12) => Array.from({ length: k }, (_, i) => [s + Math.cos(i * 2 * Math.PI / k) * r2, rose.z + Math.sin(i * 2 * Math.PI / k) * r2]);
    const r = rose.radiusM;
    wallPolygon(sink, o, t, n, OFF.frame, disc2(r + 0.3), stone);
    wallPolygon(sink, o, t, n, OFF.glass, disc2(r), glass);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI / 3, ca = Math.cos(a), sa = Math.sin(a), px = -sa * 0.09, pz = ca * 0.09;
      wallPolygon(sink, o, t, n, OFF.tracery, [[s - ca * r + px, rose.z - sa * r + pz], [s - ca * r - px, rose.z - sa * r - pz], [s + ca * r - px, rose.z + sa * r - pz], [s + ca * r + px, rose.z + sa * r + pz]], stone);
    }
    wallPolygon(sink, o, t, n, OFF.tracery, disc2(r * 0.26, 8), stone);
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
      const [cx2, cy] = toLocal(t.at), a = towerAng(t), dx = p[0] - cx2, dy = p[1] - cy;
      return Math.abs(dx * Math.cos(a) + dy * Math.sin(a)) < t.widthM / 2 + 0.4 && Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)) < (t.lenM ?? t.widthM) / 2 + 0.4;
    });
    const placed = win.rows.filter((r) => r.at).map((r) => ({ row: r, ...nearestEdge(edges, toLocal(r.at)) }));
    const claimed = /* @__PURE__ */ new Set();
    const plane = (edge) => {
      const a = edges[edge];
      let out = 0;
      edges.forEach((e, i) => {
        const along2 = e.t[0] * a.t[0] + e.t[1] * a.t[1], off = (e.o[0] - a.o[0]) * a.n[0] + (e.o[1] - a.o[1]) * a.n[1];
        if (along2 > 0.995 && Math.abs(off) < 0.4) {
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
      const [cx2, cy] = toLocal(t.at), a = towerAng(t), half = t.widthM / 2;
      for (let f = 0; f < 4; f++) {
        const na = a + f * Math.PI / 2, n = [Math.cos(na), Math.sin(na)], tt = [-n[1], n[0]];
        const o = [cx2 + n[0] * half - tt[0] * half, cy + n[1] * half - tt[1] * half];
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
        const [cx2, cy] = toLocal(wing.at), b = wing.bearingDeg * Math.PI / 180;
        const rect = { cx: cx2, cy, ux: Math.cos(b), uy: Math.sin(b), len: wing.lenM, wid: wing.widM, coverage: 1, maxDev: 0 };
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
  var BAY_PX = 520;
  var STOREY_PX = 310;
  var GROUND_PX = 340;
  var SHOP_KINDS = ["groundShop", "shopCafe", "shopWindow", "shopBar", "shopDeli", "shopFlorist", "shopBike"];
  function bayDoorGeometry(v) {
    const quiet = v.trimDensity === "restrained";
    if (v.entranceAssembly === "raised-plain") return { x: BAY_PX * 0.71, width: BAY_PX * 0.18, height: 222, bottom: 70, fanlight: false };
    if (v.entranceAssembly === "raised-pilaster") return { x: BAY_PX * 0.115, width: BAY_PX * 0.18, height: 222, bottom: 52, fanlight: true };
    if (v.facadeAssembly === "stacked-open-balcony") return { x: BAY_PX * (0.5 - 0.14), width: BAY_PX * 0.28, height: 274, bottom: 24, fanlight: false };
    return { x: BAY_PX * 0.14, width: quiet ? 98 : 118, height: quiet ? 214 : 226, bottom: 24, fanlight: !quiet };
  }
  function bayDoorWindowGeometry(v, look = "photo") {
    const quiet = v.trimDensity === "restrained";
    if (v.entranceAssembly === "raised-plain") return { axis: 0.335, width: BAY_PX * 0.205, y: 78, height: 166 };
    if (v.entranceAssembly === "raised-pilaster") return { axis: 0.68, width: BAY_PX * 0.205, y: 78, height: 166 };
    if (quiet) return { axis: 0.66, width: v.family === "punched" ? 160 : 170, y: 88, height: 166 };
    const g = bayWindowGeometry({ ...v, windows: 1 }, 76, 150, look);
    return { axis: 0.64, ...g };
  }
  function bayWindowGeometry(v, y, h, look) {
    const width = v.openingOccupancy !== void 0 ? BAY_PX * v.openingOccupancy / v.windows : (v.windows === 1 ? 150 : v.windows === 2 ? 112 : 82) * (v.proportions === "wide" ? 1.35 : v.proportions === "balanced" ? 1.12 : 1) * (look === "cartoon" ? 1.12 : 1);
    const height = v.openingHeight !== void 0 ? Math.min((y === 70 || y === 76 ? GROUND_PX : STOREY_PX) * v.openingHeight, h * 1.18) : h * (v.proportions === "wide" ? 0.76 : v.proportions === "balanced" ? 0.88 : 1);
    return { width, y: y + (h - height) / 2, height };
  }

  // src/canalRecall/landmarkFronts.ts
  function arch(x0, x1, z, rise, segments = 8) {
    const r = ((x1 - x0) ** 2 / 4 + rise ** 2) / (2 * rise), cx2 = (x0 + x1) / 2, cz = z + rise - r;
    const half = Math.asin((x1 - x0) / 2 / r);
    return Array.from({ length: segments + 1 }, (_, i) => {
      const a = -half + 2 * half * i / segments;
      return [cx2 + r * Math.sin(a), cz + r * Math.cos(a)];
    });
  }
  function frontTriangles(front2, toWorld) {
    const tris = [];
    const quad = (a, b, c, d2, hex2, hint) => {
      const [pa, pb, pc, pd] = [a, b, c, d2].map(([x, z, y]) => toWorld(x, z, y));
      tris.push({ p: [pa, pb, pc], hex: hex2, hint }, { p: [pa, pc, pd], hex: hex2, hint });
    };
    const box = ({ x0, x1, z0, z1, out0 = 0, out1, hex: hex2, face }) => {
      quad([x0, z0, out1], [x1, z0, out1], [x1, z1, out1], [x0, z1, out1], hex2, [0, 0, 1]);
      if (face) return;
      quad([x0, z0, out0], [x0, z0, out1], [x0, z1, out1], [x0, z1, out0], hex2, [-1, 0, 0]);
      quad([x1, z0, out1], [x1, z0, out0], [x1, z1, out0], [x1, z1, out1], hex2, [1, 0, 0]);
      quad([x0, z1, out1], [x1, z1, out1], [x1, z1, out0], [x0, z1, out0], hex2, [0, 1, 0]);
      quad([x0, z0, out0], [x1, z0, out0], [x1, z0, out1], [x0, z0, out1], hex2, [0, -1, 0]);
    };
    const slab2 = (o, o0, o1, hex2) => {
      for (let i = 1; i < o.length; i++) {
        const [xa, za] = o[i - 1], [xb, zb] = o[i];
        if (xb <= xa) continue;
        quad([xa, 0, o1], [xb, 0, o1], [xb, zb, o1], [xa, za, o1], hex2, [0, 0, 1]);
        quad([xa, za, o1], [xb, zb, o1], [xb, zb, o0], [xa, za, o0], hex2, [-(zb - za), xb - xa, 0]);
      }
      const [xs, zs] = o[0], [xe, ze] = o[o.length - 1];
      quad([xs, 0, o0], [xs, 0, o1], [xs, zs, o1], [xs, zs, o0], hex2, [-1, 0, 0]);
      quad([xe, 0, o1], [xe, 0, o0], [xe, ze, o0], [xe, ze, o1], hex2, [1, 0, 0]);
    };
    const d = front2.depthM;
    slab2(front2.outline, 0, d, front2.hex);
    for (const extra of front2.slabs ?? []) slab2(extra.outline, extra.out0 + d, extra.out1 + d, extra.hex);
    for (const b of front2.boxes) box({ ...b, out0: (b.out0 ?? 0) + d, out1: b.out1 + d });
    for (const e of front2.extrusions ?? []) {
      const pr = e.profile;
      for (let i = 1; i < pr.length; i++) {
        const [oa, za] = pr[i - 1], [ob, zb] = pr[i];
        quad([e.x0, za, oa + d], [e.x1, za, oa + d], [e.x1, zb, ob + d], [e.x0, zb, ob + d], e.hex, [0, ob - oa, -(zb - za)]);
        quad([e.x0, za, oa + d], [e.x0, zb, ob + d], [e.x1, zb, ob + d], [e.x1, za, oa + d], e.hex, [0, -(ob - oa), zb - za]);
      }
      for (const [x, sgn] of [[e.x0, -1], [e.x1, 1]]) for (let i = 2; i < pr.length; i++) {
        const [a, b, c] = [pr[0], pr[i - 1], pr[i]].map(([o, z]) => toWorld(x, z, o + d));
        tris.push({ p: [a, b, c], hex: e.hex, hint: [sgn, 0, 0] });
      }
    }
    for (const f of front2.faces ?? []) for (let i = 2; i < f.points.length; i++) {
      const [a, b, c] = [f.points[0], f.points[i - 1], f.points[i]].map(([x, z]) => toWorld(x, z, f.out + d));
      tris.push({ p: [a, b, c], hex: f.hex, hint: [0, 0, 1] });
    }
    for (const grid of front2.windows) for (const cx2 of grid.xs) for (const [z0, z1] of grid.rows) {
      const x0 = cx2 - grid.w / 2, x1 = cx2 + grid.w / 2;
      box({ x0: x0 - 0.12, x1: x1 + 0.12, z0: z0 - 0.12, z1: z1 + 0.12, out0: d, out1: d + 0.04, hex: grid.frameHex ?? "#d8d0c0" });
      box({ x0, x1, z0, z1, out0: d, out1: d + 0.07, hex: grid.hex });
      box({ x0: x0 - 0.2, x1: x1 + 0.2, z0: z0 - 0.3, z1: z0 - 0.12, out0: d, out1: d + 0.25, hex: front2.hex });
    }
    return tris;
  }
  function lettering(x0, x1, z0, z1, out, hex2, n) {
    const step = (x1 - x0) / n;
    return Array.from({ length: n }, (_, i) => ({ x0: x0 + i * step + step * 0.12, x1: x0 + (i + 1) * step - step * 0.12, z0, z1, out0: out, out1: out + 0.04, hex: hex2 }));
  }
  function stripedAwning(x0, x1, z, depth, a, b, stripeM = 0.45) {
    const out = [];
    for (let x = x0, i = 0; x < x1 - 1e-6; x += stripeM, i++) out.push({ x0: x, x1: Math.min(x1, x + stripeM), z0: z - 0.35, z1: z, out0: 0, out1: depth, hex: i % 2 ? b : a });
    return out;
  }
  function along(start, end, lengthM, t) {
    const k = t / lengthM;
    return [start[0] + (end[0] - start[0]) * k, start[1] + (end[1] - start[1]) * k];
  }

  // src/canalRecall/bayLook.ts
  var BAY_KINDS = ["upper", "ground", "groundDoor", ...SHOP_KINDS, "plain"];
  var isShopKind = (kind) => SHOP_KINDS.includes(kind);
  var BAY_STYLES = {
    // Canal houses: tall white-framed sashes under flat lintels; shutters only beside ground-floor windows.
    canal: [
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "masonry", openingOccupancy: 0.55, openingHeight: 0.62, sash: "plain", trimDensity: "restrained", lintel: "none" },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "masonry", openingOccupancy: 0.55, openingHeight: 0.62, sash: "transom", trimDensity: "restrained", lintel: "none" },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "masonry", openingOccupancy: 0.55, openingHeight: 0.62, sash: "transom", trimDensity: "restrained", lintel: "none", frameTone: "dark" },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false },
      { windows: 2, shape: "rect", shutters: true, paintedFrames: false },
      { windows: 3, shape: "rect", shutters: false, paintedFrames: true },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: true },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "masonry", proportions: "tall", frameTone: "dark", lintel: "flat" },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "masonry", proportions: "tall", paleAccents: true, lintel: "flat" },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "masonry", openingOccupancy: 0.55, openingHeight: 0.68, sash: "paired-transom", trimDensity: "restrained", lintel: "none" }
    ],
    // 1860-1914: rectangular sashes under flat or segmental masonry heads.
    c19: [
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "masonry", openingOccupancy: 0.55, openingHeight: 0.7, sash: "plain", trimDensity: "restrained", lintel: "flat" },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "masonry", openingOccupancy: 0.55, openingHeight: 0.7, sash: "transom", trimDensity: "restrained", lintel: "flat" },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "masonry", openingOccupancy: 0.55, openingHeight: 0.7, sash: "transom", trimDensity: "restrained", lintel: "flat", paleAccents: true },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "masonry", openingOccupancy: 0.55, openingHeight: 0.7, sash: "transom", trimDensity: "restrained", lintel: "arch", paleAccents: true },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "masonry", openingOccupancy: 0.55, openingHeight: 0.7, sash: "transom", trimDensity: "restrained", lintel: "none", frameTone: "dark" },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, lintel: "arch" },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "masonry", proportions: "tall", paleAccents: true, lintel: "arch" },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "masonry", proportions: "balanced", paleAccents: true, lintel: "flat" },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "masonry", proportions: "tall", frameTone: "dark", lintel: "flat" },
      { windows: 3, shape: "rect", shutters: false, paintedFrames: false, family: "masonry", openingOccupancy: 0.615, openingHeight: 0.7, sash: "transom", trimDensity: "restrained", lintel: "arch", paleAccents: true, frameTone: "dark", entranceAssembly: "raised-pilaster" },
      { windows: 3, shape: "rect", shutters: false, paintedFrames: false, family: "masonry", openingOccupancy: 0.615, openingHeight: 0.7, sash: "transom", trimDensity: "restrained", lintel: "flat", paleAccents: false, frameTone: "dark", entranceAssembly: "raised-plain" },
      { windows: 1, shape: "rect", shutters: false, paintedFrames: false, family: "masonry", openingOccupancy: 0.32, openingHeight: 0.78, sash: "paired-transom", trimDensity: "restrained", lintel: "flat", paleAccents: false, facadeAssembly: "stacked-iron-balcony" }
    ],
    school: [
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: true }
    ],
    modern: [
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "punched", openingOccupancy: 0.65, openingHeight: 0.52, sash: "plain", trimDensity: "restrained", lintel: "none", wallMaterial: "brick" },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "punched", openingOccupancy: 0.65, openingHeight: 0.52, sash: "plain", trimDensity: "restrained", lintel: "none", frameTone: "dark", wallMaterial: "brick" },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "punched", openingOccupancy: 0.65, openingHeight: 0.52, sash: "plain", trimDensity: "restrained", lintel: "none" },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "punched", openingOccupancy: 0.65, openingHeight: 0.52, sash: "plain", trimDensity: "restrained", lintel: "none", frameTone: "dark" },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "punched", proportions: "balanced", lintel: "none" },
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "punched", proportions: "wide", lintel: "none", frameTone: "dark" },
      { windows: 1, shape: "rect", shutters: false, paintedFrames: false, family: "ribbon" },
      { windows: 1, shape: "rect", shutters: false, paintedFrames: false, family: "curtain" },
      { windows: 3, shape: "rect", shutters: false, paintedFrames: false, family: "punched", openingOccupancy: 0.57, openingHeight: 0.7, sash: "paired-transom", trimDensity: "restrained", lintel: "none", wallMaterial: "smooth", facadeAssembly: "stacked-open-balcony" }
    ]
  };
  var ARCHETYPES = Object.keys(BAY_STYLES);
  var entries = ARCHETYPES.flatMap((archetype) => BAY_STYLES[archetype].flatMap((_, style) => BAY_KINDS.filter((kind) => !isShopKind(kind) || style === 0).map((kind) => ({ archetype, style, kind }))));
  entries.push(...ARCHETYPES.flatMap((archetype) => SHOP_KINDS.map((kind) => ({ archetype, style: 0, kind, restrainedShop: true }))));
  var BAY_ENTRIES = entries.map((e, layer) => ({ ...e, layer }));
  var BAY_LAYER_COUNT = BAY_ENTRIES.length;
  var DEFAULT_STYLE_INDICES = Object.fromEntries(ARCHETYPES.map((archetype) => [archetype, BAY_STYLES[archetype].flatMap((v, i) => v.openingOccupancy === void 0 && (!v.family || v.family === "masonry" || v.family === "punched") ? [i] : [])]));
  var recipeStyles = /* @__PURE__ */ new Map();
  function bayStyleForRecipe(id, archetype, recipe) {
    const styles = BAY_STYLES[archetype], h = hashSeed(id);
    if (!recipe) {
      const candidates = DEFAULT_STYLE_INDICES[archetype];
      return candidates[(h >>> 4) % candidates.length];
    }
    const proportion = recipe.windowProportions ?? (recipe.windowWidth && recipe.windowWidth > 0.3 ? "wide" : recipe.windowHeight && recipe.windowHeight < 0.5 ? "balanced" : "tall");
    const dark = recipe.frameColor === "dark" || !!recipe.frameHex && parseInt(recipe.frameHex.slice(1, 3), 16) < 100;
    const pale = recipe.paleAccents ?? ((recipe.trim?.lintels ?? 0) > 0.65 || (recipe.trim?.quoins ?? 0) > 0.5);
    const lintel = recipe.lintel ?? ((recipe.trim?.arches ?? 0) > 0.5 ? "arch" : "flat");
    const sash = recipe.sash ?? (recipe.family === "punched" ? "plain" : "transom"), trim = recipe.trimDensity ?? "restrained";
    const material = recipe.wallMaterial ?? (archetype === "modern" ? "smooth" : "brick");
    const key = `${archetype}|${recipe.facadeAssembly ?? "none"}|${recipe.entranceAssembly ?? "none"}|${material}|${recipe.family}|${proportion}|${dark}|${pale}|${lintel}|${sash}|${trim}`;
    const cached = recipeStyles.get(key);
    if (cached) return cached[(h >>> 4) % cached.length];
    const scored = styles.map((v, i) => ({ i, score: ((v.entranceAssembly ?? "none") === (recipe.entranceAssembly ?? "none") ? 1e3 : 0) + ((v.facadeAssembly ?? "none") === (recipe.facadeAssembly ?? "none") ? 1e3 : 0) + ((v.wallMaterial ?? (archetype === "modern" ? "smooth" : "brick")) === material ? 25 : 0) + ((v.sash ?? "six-over-six") === sash ? 50 : 0) + (v.trimDensity === trim ? 40 : 0) + ((v.family ?? "masonry") === recipe.family ? 100 : 0) + ((v.proportions ?? "tall") === proportion ? 8 : 0) + (!!v.paleAccents === pale ? 12 : 0) + (v.frameTone === "dark" === dark ? 10 : 0) + ((v.lintel ?? "flat") === lintel ? 6 : 0) }));
    const max = Math.max(...scored.map((v) => v.score)), ties = scored.filter((v) => v.score === max);
    const indices = ties.map((v) => v.i);
    recipeStyles.set(key, indices);
    return indices[(h >>> 4) % indices.length];
  }

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
  var BAY_DOOR = { axis: (0.14 * BAY_W + 59) / BAY_W, width: 118 / BAY_W, bottom: 24 / GROUND_H, top: (24 + 226) / GROUND_H, fanlight: true };
  function bayVariantOpenings(v, look = "photo") {
    if (v.family === "ribbon" || v.family === "curtain") {
      const curtain = v.family === "curtain";
      return {
        upper: { axes: [0.5], width: 0.9, sill: curtain ? 16 / STOREY_H : 100 / STOREY_H, head: curtain ? 302 / STOREY_H : 240 / STOREY_H },
        ground: rowPx(1, 80, 140, GROUND_H, 140),
        doorWindow: null,
        door: { ...BAY_DOOR, axis: (0.62 * BAY_W + 59) / BAY_W },
        ribbon: true
      };
    }
    const row = (n, y, h, H) => {
      const g = bayWindowGeometry({ ...v, windows: n }, y, h, look);
      return { ...rowPx(n, g.y, g.height, H, g.width), arch: v.shape === "arch" };
    };
    const upper = v.archetype === "school" && !v.proportions ? { axes: [0.3, 0.7], width: 76 / BAY_W, sill: (STOREY_H - 248) / STOREY_H, head: (STOREY_H - 68) / STOREY_H } : row(v.windows, 62, 188, STOREY_H);
    const dw = bayDoorWindowGeometry(v, look), dg = bayDoorGeometry(v);
    const doorWindow = { ...rowPx(1, dw.y, dw.height, GROUND_H, dw.width), axes: [dw.axis] };
    const door = { axis: (dg.x + dg.width / 2) / BAY_W, width: dg.width / BAY_W, bottom: dg.bottom / GROUND_H, top: (dg.bottom + dg.height) / GROUND_H, fanlight: dg.fanlight };
    if (v.entranceAssembly === "raised-plain") {
      const ground = { axes: [0.2, 0.47, 0.8], width: dw.width / BAY_W, sill: (GROUND_H - dw.y - dw.height) / GROUND_H, head: (GROUND_H - dw.y) / GROUND_H };
      return { upper: { ...upper, axes: [0.2, 0.47, 0.8] }, ground, doorWindow: { ...ground, axes: [0.2, 0.47] }, door };
    }
    if (v.entranceAssembly === "raised-pilaster") {
      const ground = { axes: [0.53, 0.8], width: dw.width / BAY_W, sill: (GROUND_H - dw.y - dw.height) / GROUND_H, head: (GROUND_H - dw.y) / GROUND_H };
      return { upper: { ...upper, axes: [0.205, 0.53, 0.8] }, ground: row(v.windows, 70, 150, GROUND_H), doorWindow: ground, door };
    }
    if (v.facadeAssembly === "stacked-open-balcony") {
      const group = { axes: [0.17, 0.5, 0.83], width: 0.145, widths: [0.145, 0.28, 0.145] };
      const ground = { ...row(v.windows, 70, 240, GROUND_H), ...group };
      return { upper: { ...upper, ...group }, ground, doorWindow: { ...ground, axes: [0.17, 0.83], widths: [0.145, 0.145] }, door };
    }
    return { upper, ground: row(v.windows, 70, 150, GROUND_H), doorWindow, door };
  }
  function bayLookOpenings(id, style, look = "photo") {
    const archetype = style === "school" ? "school" : style === "c19" ? "c19" : style === "modern" || style === "postwar" || style === "tower" ? "modern" : "canal";
    const v = BAY_STYLES[archetype][bayStyleForRecipe(id, archetype)];
    return bayVariantOpenings({ archetype, kind: "upper", ...v }, look);
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

  // src/canalRecall/streetFacadeRendering.ts
  var PROCEDURAL_RECIPE_LAYER_OFFSET = CELL_LAYER_COUNT + 4;

  // src/canalRecall/facadeExtraCore.ts
  function hash012(text) {
    let h = 2166136261;
    for (const c of text) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
  }

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
      for (const [index, axis] of row.axes.entries()) out.push({ x: (i + axis) * bw, hw: (row.widths?.[index] ?? row.width) * bw / 2, z0: z + row.sill * h, z1: z + row.head * h });
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
  function restrainedDoorSurround(c, s, r) {
    const d = doorSpan(c);
    if (!d || c.shopfront || !c.recipe || c.recipe.family !== "masonry") return;
    const pale = c.recipe.frameHex ?? WHITE2;
    const l = d.x - d.hw, right = d.x + d.hw, top = d.z1 + 0.025;
    const cap = Math.min(c.base + c.layout.groundM - 0.04, top + 0.1);
    if (l < 0.12 || right > c.f.len - 0.12 || cap <= top) return;
    s.strip(c.f, l - 0.11, l - 5e-3, 0.04, d.z0, cap, pale);
    s.strip(c.f, right + 5e-3, right + 0.11, 0.04, d.z0, cap, pale);
    s.strip(c.f, l - 0.11, right + 0.11, 0.04, top, cap, pale);
    s.strip(c.f, l - 0.12, right + 0.12, 0.06, d.z0 - 0.035, d.z0 + 0.015, pale);
    if (c.recipe.period === "c19" && r < (c.recipe.trim?.arches ?? 0) * 0.7 && cap + 0.06 < c.base + c.layout.groundM) {
      s.strip(c.f, d.x - 0.045, d.x + 0.045, 0.065, top - 0.025, cap + 0.06, pale);
    }
  }
  var ORNAMENT_COMPONENTS = [
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
      if (c.recipe && c.recipe.trimDensity !== "ornate") {
        restrainedDoorSurround(c, s, r);
        return;
      }
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
      const l = d.x - d.hw - 0.05, rr = d.x + d.hw + 0.05, top = d.z1 + 0.3;
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
      const restrained = !!c.recipe && c.recipe.trimDensity !== "ornate";
      const key = !restrained && r < 0.55, n = storeysThatFit(c, s, key ? 8 : 4, 5);
      for (let k = 0; k < n; k++) for (const w of windowSpans(c, k)) {
        if (o.upper.arch) {
          s.strip(c.f, w.x - 0.1, w.x + 0.1, 0.07, w.z1 + 0.02, w.z1 + 0.26, WHITE2);
          continue;
        }
        s.strip(c.f, w.x - w.hw - (restrained ? 0.03 : 0.1), w.x + w.hw + (restrained ? 0.03 : 0.1), restrained ? 0.025 : 0.05, w.z1 + 0.02, w.z1 + (restrained ? 0.07 : 0.2), WHITE2);
        if (key) s.strip(c.f, w.x - 0.09, w.x + 0.09, 0.09, w.z1 + 0.01, w.z1 + 0.27, WHITE2);
      }
    } },
    { id: "stucco-hoods", styles: CANAL, p: { c19: 0.5, canal: 0.12 }, wide: true, group: "window-head", build: (c, s, r) => {
      if (openingsOf(c).ribbon) return;
      const restrained = !!c.recipe && c.recipe.trimDensity !== "ornate";
      const hex2 = r < 0.6 ? WHITE2 : CREAM2, n = storeysThatFit(c, s, 6, 5);
      for (let k = 0; k < n; k++) for (const w of windowSpans(c, k)) {
        const a0 = w.x - w.hw - (restrained ? 0.04 : 0.14), a1 = w.x + w.hw + (restrained ? 0.04 : 0.14);
        s.strip(c.f, a0, a1, restrained ? 0.04 : 0.14, w.z1 + 0.03, w.z1 + (restrained ? 0.09 : 0.2), hex2);
        s.slope(c.f, a0, a1, 0, restrained ? 0.04 : 0.14, w.z1 + (restrained ? 0.12 : 0.3), w.z1 + (restrained ? 0.09 : 0.2), hex2);
      }
    } },
    { id: "white-window-frames", styles: CANAL, p: { canal: 0.3, c19: 0.35 }, wide: true, build: (c, s) => {
      if (openingsOf(c).ribbon) return;
      const groundCost = windowSpans(c, -1).length * 12;
      const n = Math.max(0, Math.min(5, c.layout.storeys, Math.floor((s.room() - groundCost) / Math.max(12, windowSpans(c, 0).length * 12))));
      for (let k = -1; k < n; k++) for (const w of windowSpans(c, k)) {
        const colour = c.recipe?.frameHex ?? WHITE2;
        const restrained = !!c.recipe && c.recipe.trimDensity !== "ornate", frame = restrained ? 0.025 : 0.07, out = restrained ? 0.025 : 0.05;
        s.strip(c.f, Math.max(0, w.x - w.hw - frame), w.x - w.hw + 0.01, out, w.z0, Math.min(c.top, w.z1 + 0.04), colour);
        s.strip(c.f, w.x + w.hw - 0.01, Math.min(c.f.len, w.x + w.hw + frame), out, w.z0, Math.min(c.top, w.z1 + 0.04), colour);
        s.strip(c.f, Math.max(0, w.x - w.hw - frame), Math.min(c.f.len, w.x + w.hw + frame), out, w.z1 - 0.02, Math.min(c.top, w.z1 + 0.05), colour);
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
      s.box(c.f, x - 0.75, x + 0.75, 0, 0.4, z0 - 0.4, z0, SANDSTONE, true);
      const body = shadeHex(c.wallHex, 0.88);
      for (const [hw, o] of [[1.3, 0.2], [1.05, 0.38], [0.7, 0.5]]) s.box(c.f, x - hw, x + hw, 0, o, z0, z1, body, true);
      for (const [a0, a1, o] of [[x - 1.22, x - 1.1, 0.2], [x - 0.95, x - 0.8, 0.38], [x - 0.62, x + 0.62, 0.5], [x + 0.8, x + 0.95, 0.38], [x + 1.1, x + 1.22, 0.2]]) s.strip(c.f, a0, a1, o + 0.01, glassZ0, glassZ1, "#8ea6b4", 0.01);
      s.strip(c.f, x - 0.6, x + 0.6, 0.53, glassZ0 + (glassZ1 - glassZ0) * 0.68, glassZ0 + (glassZ1 - glassZ0) * 0.72, frame, 0.03);
      s.box(c.f, x - 1.38, x + 1.38, 0, 0.56, z1, z1 + 0.14, c.style === "school" ? "#4f7a6a" : STONE2, true);
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
  function openBalconyStack(c, s, depth = 0.85) {
    if (!c.layout.storeys || c.recipe?.facadeAssembly && c.assemblyOwner === false) return;
    const joint = c.recipe?.facadeAssembly === "stacked-open-balcony";
    const historic = c.recipe?.facadeAssembly === "stacked-iron-balcony";
    let candidates = windowSpans(c, 0).filter((w) => w.x - Math.max(0.6, w.hw + 0.08) >= 0.04 && w.x + Math.max(0.6, w.hw + 0.08) <= c.f.len - 0.04);
    if (!candidates.length) return;
    let preferred = c.f.len / 2;
    if (joint) {
      const widest = Math.max(...candidates.map((w) => w.hw)), narrowest = Math.min(...candidates.map((w) => w.hw));
      if (widest > narrowest * 1.05) {
        candidates = candidates.filter((w) => Math.abs(w.hw - widest) < 1e-3);
      } else {
        const row = openingsOf(c), axis = row.upper.axes.reduce((best, value) => Math.abs(value - row.door.axis) < Math.abs(best - row.door.axis) ? value : best, row.upper.axes[0]);
        candidates = candidates.filter((w) => Math.abs(w.x / c.layout.bayWidthM - Math.floor(w.x / c.layout.bayWidthM) - axis) < 1e-3);
      }
      if (!candidates.length) return;
      const doorBay = c.layout.doorBays.find((i) => candidates.some((w) => Math.floor(w.x / c.layout.bayWidthM) === i));
      if (doorBay !== void 0) {
        candidates = candidates.filter((w) => Math.floor(w.x / c.layout.bayWidthM) === doorBay);
        preferred = (doorBay + openingsOf(c).door.axis) * c.layout.bayWidthM;
      }
    }
    candidates.sort((a, b) => Math.abs(a.x - preferred) - Math.abs(b.x - preferred) || a.x - b.x);
    const target = candidates[0];
    const width = Math.min(2.6, c.layout.bayWidthM * 0.9, Math.max(1.2, target.hw * 2 + 0.16));
    const a0 = target.x - width / 2, a1 = target.x + width / 2;
    depth = Math.max(0.4, Math.min(1.2, depth));
    const divided = historic || c.recipe?.sash === "paired-transom";
    const railHex = joint ? c.recipe?.frameHex ?? WHITE3 : IRON2;
    const sideBands = joint && a0 >= 0.11 && a1 <= c.f.len - 0.11;
    const levels = Math.min(historic ? 3 : 8, c.layout.storeys, Math.floor((s.room() - (sideBands ? 8 : 0)) / (divided ? 56 : 52)));
    if (levels < 1) return;
    if (sideBands) {
      const bottom = c.base + c.layout.groundM, top = c.top - 0.04;
      for (const x of [a0 - 0.055, a1 + 0.055]) s.strip(c.f, x - 0.045, x + 0.045, 0.035, bottom, top, railHex, 0.02);
    }
    for (let k = 0; k < levels; k++) {
      const opening2 = windowSpans(c, k).find((w) => Math.abs(w.x - target.x) < 1e-3);
      if (!opening2) continue;
      const deck = storeyZ2(c, k) + 0.04, rail = deck + 0.9;
      if (deck < c.base + c.layout.groundM || rail + 0.04 > c.top) continue;
      s.begin();
      s.box(c.f, a0, a1, 0, depth, deck - 0.08, deck, CONCRETE, true);
      const glass = Math.min(opening2.z0 + 8e-3, opening2.z1 - 0.04);
      if (glass > deck + 0.05) {
        const l = opening2.x - opening2.hw, right = opening2.x + opening2.hw, frame = c.recipe?.frameHex ?? WHITE3;
        s.strip(c.f, l + 0.015, right - 0.015, 0.012, deck + 0.035, glass, GLASS2, 6e-3);
        s.strip(c.f, l - 0.015, l + 0.015, 0.018, deck + 0.025, glass, frame, 0.01);
        s.strip(c.f, right - 0.015, right + 0.015, 0.018, deck + 0.025, glass, frame, 0.01);
        if (divided) s.strip(c.f, opening2.x - 0.015, opening2.x + 0.015, 0.02, deck + 0.035, glass, frame, 0.01);
      }
      s.strip(c.f, a0, a1, depth - 0.02, rail, rail + 0.04, railHex, 0.025);
      for (let i = 0; i < 8; i++) {
        const x = a0 + 0.035 + (a1 - a0 - 0.07) * i / 7;
        s.slope(c.f, x - 0.01, x + 0.01, depth - 0.02, depth - 0.02, rail + 0.02, deck, railHex);
      }
      for (const [x, sign] of [[a0, -1], [a1, 1]]) {
        const side = { x0: c.f.x0 + c.f.ux * x, y0: c.f.y0 + c.f.uy * x, ux: c.f.nx, uy: c.f.ny, nx: c.f.ux * sign, ny: c.f.uy * sign, len: depth };
        s.strip(side, 0.02, depth - 0.02, 0.015, rail, rail + 0.04, railHex, 0.025);
      }
      s.commit();
    }
  }
  var STONE3 = "#cfc6b4";
  var IRON2 = "#26282b";
  var WOOD = "#5a4030";
  var WHITE3 = "#efece4";
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
    const { cx: cx2, cy, ux, uy } = c.rect, vx = -uy, vy = ux;
    return s.box({ x0: cx2 + vx * v0, y0: cy + vy * v0, ux, uy, nx: vx, ny: vy, len: 0 }, u0, u1, 0, v1 - v0, z0, z1, hex2, false);
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
      if (hash012(`${c.id}:rail`) < 0.6) for (const dx of [-0.75, 0.72]) {
        s.box(c.f, x + dx, x + dx + 0.03, 0.1, 1.2, c.base + 0.75, c.base + 0.79, IRON2);
        s.box(c.f, x + dx, x + dx + 0.03, 1.12, 1.16, c.base, c.base + 0.79, IRON2);
      }
    } },
    { id: "double-stoop", group: "stoop", styles: ["canal"], p: 0.08, build: (c, s) => {
      const x = doorX(c);
      if (x == null || !c.groundLevel) return;
      s.box(c.f, x - 0.7, x + 0.7, 0, 1, c.base, c.base + 0.75, STONE3);
      for (const side of [-1, 1]) for (let k = 0; k < 3; k++) s.box(c.f, x + side * (0.7 + k * 0.3) - (side > 0 ? 0 : 0.3), x + side * (0.7 + k * 0.3) + (side > 0 ? 0.3 : 0), 0.1, 0.95, c.base, c.base + 0.75 - k * 0.25, STONE3);
    } },
    { id: "basement-well", styles: ["canal", "c19"], p: 0.25, build: (c, s) => {
      if (!c.groundLevel || c.shopfront) return;
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
    // Ivy as a thin climber hugging the wall to the first floor, in a few ragged fingers: a 2.2 m
    // dark slab up to 10 m read as a black-green box (user 2026-10-03: "awful imposing extrusions on our canal house grammar").
    { id: "climbing-ivy", styles: ["school", "postwar", "modern"], p: 0.05, build: (c, s) => {
      const x0 = hash012(c.wallKey) * Math.max(0, c.f.len - 2), top = Math.min(c.top - c.base, c.layout.groundM + 1.5);
      for (let k = 0; k < 4; k++) {
        const x = x0 + 0.15 + k * 0.4, h = top * (0.55 + 0.45 * hash012(`${c.wallKey}:iv${k}`));
        s.box(c.f, x, x + 0.32, 0, 0.04, c.base, c.base + h, k % 2 ? GREEN : "#4f7a45");
      }
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
      const zz1 = z0 + c.layout.storeyM - 0.25;
      void z1;
      s.box(c.f, x - 1.1, x + 1.1, 0, 0.45, z0 + 0.15, zz1, c.wallHex, true);
      for (const [a, b] of [[-0.95, -0.35], [-0.3, 0.3], [0.35, 0.95]]) s.box(c.f, x + a, x + b, 0.45, 0.47, z0 + 0.6, zz1 - 0.35, "#9fb6c4");
      s.box(c.f, x - 1.18, x + 1.18, 0, 0.52, zz1, zz1 + 0.12, WHITE3, true);
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
      s.box(c.f, x - 0.65, x + 0.65, 0, 0.5, z, z + 0.06, c.style === "c19" ? "#3a3f45" : CONCRETE, true);
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
      for (let k = 1; k < Math.min(3, c.layout.storeys + 1); k++) {
        const x = c.f.len / 2, z = storeyZ2(c, k - 1) + 0.05;
        s.box(c.f, x - 1.2, x + 1.2, 0, 0.5, z, z + 0.12, c.wallHex, true);
        s.box(c.f, x - 1.2, x + 1.2, 0.4, 0.5, z + 0.12, z + 0.8, c.wallHex);
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
    { id: "balcony-slabs", styles: ["postwar"], p: 0.5, street: true, group: "balcony", build: (c, s) => {
      openBalconyStack(c, s, 1.1);
    } },
    { id: "gallery-walkway", styles: ["postwar"], p: 0.18, group: "balcony", build: (c, s) => {
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
      s.box(c.f, x - 1.3, x + 1.3, 0, 1, c.base + 2.6, c.base + 2.75, CONCRETE, true);
    } },
    { id: "historic-balcony-stack", styles: ["c19", "canal"], p: 0, street: true, group: "balcony", build: (c, s) => {
      if (c.recipe?.facadeAssembly === "stacked-iron-balcony") openBalconyStack(c, s, 0.5);
    } },
    { id: "glass-balconies", styles: ["modern", "tower"], p: 0.45, street: true, group: "balcony", build: (c, s) => {
      openBalconyStack(c, s, 0.85);
    } },
    { id: "vertical-fins", styles: ["modern", "tower"], p: 0.25, build: (c, s) => {
      for (let x = 0.6; x < c.f.len - 0.3; x += 1.5) s.box(c.f, x - 0.05, x + 0.05, 0, 0.22, c.base + c.layout.groundM, c.top - 0.3, "#d6d2c8");
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
    // Parked bikes and racks were removed 2026-10-03: drawn per facade they stood out from the
    // wall as dark pickets on the pavement (user: "bunch of weird artifacts here too").
    { id: "bench", styles: ["canal", "c19"], p: 0.1, build: (c, s) => {
      if (!c.groundLevel || c.shopfront) return;
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
  var DEFINING_TRIM = /* @__PURE__ */ new Set(["white-window-frames", "white-lintels", "string-courses"]);
  var PROFILE_COMPONENTS = [...WALL_COMPONENTS.filter((comp) => comp.id === "door-surround"), ...WALL_COMPONENTS.filter((comp) => DEFINING_TRIM.has(comp.id)), ...WALL_COMPONENTS.filter((comp) => comp.id !== "door-surround" && !DEFINING_TRIM.has(comp.id))];
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

  // src/canalRecall/pixelFont.ts
  var G = {
    A: ".###.|#...#|#...#|#####|#...#|#...#|#...#",
    B: "####.|#...#|#...#|####.|#...#|#...#|####.",
    C: ".###.|#...#|#....|#....|#....|#...#|.###.",
    D: "####.|#...#|#...#|#...#|#...#|#...#|####.",
    E: "#####|#....|#....|####.|#....|#....|#####",
    F: "#####|#....|#....|####.|#....|#....|#....",
    G: ".###.|#...#|#....|#.###|#...#|#...#|.####",
    H: "#...#|#...#|#...#|#####|#...#|#...#|#...#",
    I: "###|.#.|.#.|.#.|.#.|.#.|###",
    J: "..###|...#.|...#.|...#.|#..#.|#..#.|.##..",
    K: "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#",
    L: "#....|#....|#....|#....|#....|#....|#####",
    M: "#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#",
    N: "#...#|##..#|#.#.#|#..##|#...#|#...#|#...#",
    O: ".###.|#...#|#...#|#...#|#...#|#...#|.###.",
    P: "####.|#...#|#...#|####.|#....|#....|#....",
    Q: ".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#",
    R: "####.|#...#|#...#|####.|#.#..|#..#.|#...#",
    S: ".####|#....|#....|.###.|....#|....#|####.",
    T: "#####|..#..|..#..|..#..|..#..|..#..|..#..",
    U: "#...#|#...#|#...#|#...#|#...#|#...#|.###.",
    V: "#...#|#...#|#...#|#...#|#...#|.#.#.|..#..",
    W: "#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.",
    X: "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#",
    Y: "#...#|#...#|.#.#.|..#..|..#..|..#..|..#..",
    Z: "#####|....#|...#.|..#..|.#...|#....|#####",
    0: ".###.|#...#|#..##|#.#.#|##..#|#...#|.###.",
    1: ".#.|##.|.#.|.#.|.#.|.#.|###",
    2: ".###.|#...#|....#|...#.|..#..|.#...|#####",
    3: "####.|....#|....#|.###.|....#|....#|####.",
    4: "...#.|..##.|.#.#.|#..#.|#####|...#.|...#.",
    5: "#####|#....|####.|....#|....#|#...#|.###.",
    6: ".###.|#....|#....|####.|#...#|#...#|.###.",
    7: "#####|....#|...#.|..#..|.#...|.#...|.#...",
    8: ".###.|#...#|#...#|.###.|#...#|#...#|.###.",
    9: ".###.|#...#|#...#|.####|....#|....#|.###.",
    "&": ".##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#",
    "'": "#|#|.|.|.|.|.",
    "!": "#|#|#|#|#|.|#",
    ".": ".|.|.|.|.|.|#",
    "-": "...|...|...|###|...|...|...",
    ":": ".|.|#|.|#|.|.",
    "#": ".#.#.|#####|.#.#.|.#.#.|#####|.#.#.|.....",
    "\xD6": "#...#|.###.|#...#|#...#|#...#|#...#|.###.",
    "\xC9": "..#..|#####|#....|####.|#....|#....|#####"
  };
  var ACCENTS = { "\xC0": "A", "\xC1": "A", "\xC2": "A", "\xC4": "A", "\xC8": "E", "\xCA": "E", "\xCB": "E", "\xCC": "I", "\xCD": "I", "\xCF": "I", "\xD2": "O", "\xD3": "O", "\xD4": "O", "\xD9": "U", "\xDA": "U", "\xDC": "U", "\xC7": "C", "\xD1": "N" };
  var glyph = (c) => (G[c] ?? G[ACCENTS[c] ?? ""] ?? null)?.split("|") ?? null;
  function textPixels(text) {
    const runs = [];
    let x = 0;
    for (const ch of text.toUpperCase()) {
      const g = ch === " " ? null : glyph(ch);
      if (!g) {
        x += 3;
        continue;
      }
      g.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
          if (row[c] !== "#") continue;
          let e = c;
          while (e < row.length && row[e] === "#") e++;
          runs.push({ c0: x + c, c1: x + e, r });
          c = e;
        }
      });
      x += g[0].length + 1;
    }
    return { runs, width: Math.max(0, x - 1) };
  }
  function textRects(text, x0, x1, z0, z1, align = "centre") {
    const { runs, width } = textPixels(text);
    if (!width) return [];
    const px = Math.min((z1 - z0) / 7, (x1 - x0) / width), w = width * px;
    const left = align === "left" ? x0 : align === "right" ? x1 - w : (x0 + x1) / 2 - w / 2, top = (z0 + z1) / 2 + 3.5 * px;
    return runs.map(({ c0, c1, r }) => ({ x0: left + c0 * px, x1: left + c1 * px, z0: top - (r + 1) * px, z1: top - r * px }));
  }

  // src/canalRecall/storefronts.ts
  var mixHex = (a, b, t) => "#" + [0, 2, 4].map((i) => Math.round(parseInt(a.slice(1 + i, 3 + i), 16) * (1 - t) + parseInt(b.slice(1 + i, 3 + i), 16) * t).toString(16).padStart(2, "0")).join("");
  var luma = (hex2) => {
    const n = parseInt(hex2.slice(1), 16);
    return 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255);
  };
  var DARK_GLASS = "#3c4854";
  var WHITE4 = "#f2f0ea";
  var INK = "#1d1d1f";
  var CHAIR = "#6b5444";
  var LAMP = "#f3d58a";
  var contrast = (hex2) => luma(hex2) < 120 ? WHITE4 : INK;
  var BAY_W2 = { D: 1.05, C: 1.8, d: 1, P: 0.35 };
  function layoutBays(tokens, x0, x1) {
    const parsed = tokens.map((t) => {
      const [k, w] = t.split(":");
      return { k, w: w ? Number(w) : BAY_W2[k] };
    });
    const fixed = parsed.reduce((s, t) => s + (t.w ?? 0), 0), flex = parsed.filter((t) => t.w == null).length;
    const scale = fixed > x1 - x0 - 0.4 * flex || !flex && fixed > 0 ? (x1 - x0 - 0.4 * flex) / fixed : 1, share = flex ? (x1 - x0 - fixed * scale) / flex : 0;
    let x = x0;
    return parsed.map((t) => {
      const w = t.w != null ? t.w * scale : share, b = { kind: t.k, x0: x, x1: x + w };
      x += w;
      return b;
    });
  }
  var disc = (cx2, cz, r, out, hex2, n = 14) => ({ points: Array.from({ length: n }, (_, i) => [cx2 + r * Math.cos(2 * Math.PI * i / n), cz + r * Math.sin(2 * Math.PI * i / n)]), out, hex: hex2 });
  function compileStorefront(_slug, spec, wall) {
    const GLASS3 = spec.glass ?? DARK_GLASS;
    const L = wall.lengthM, h = spec.heightM ?? 3.6;
    const half = Math.min(3.5, L / 2);
    const sh = spec.shift ?? 0, SNAP = 0.6;
    const [px0, px1] = spec.span ? [spec.span[0] + sh, spec.span[1] + sh] : [Math.max(0, Math.min(L - 2 * half, wall.alongM - half)), Math.min(L, Math.max(2 * half, wall.alongM + half))];
    const x0 = Math.max(0, px0) < SNAP ? 0 : Math.max(0, px0), x1 = L - Math.min(L, px1) < SNAP ? L : Math.min(L, px1);
    const frame = spec.frame, wallHex = spec.wall ?? frame, plinth = spec.plinth ?? frame;
    const boxes = [], extrusions = [], faces = [];
    const text = (s, a, b, z0, z1, out, hex2, align) => boxes.push(...textRects(s, a, b, z0, z1, align).map((r) => ({ ...r, out0: out, out1: out + 0.015, hex: hex2, face: true })));
    const WALL = 0.06, OUT = 0.12;
    boxes.push({ x0, x1, z0: 0, z1: h, out1: WALL, hex: wallHex });
    const fasciaH = spec.fasciaH ?? (spec.text2 ? 0.85 : 0.7), fz0 = h - fasciaH - 0.05;
    const fascia2 = spec.fascia === false ? null : spec.fascia ?? frame;
    const signText = spec.text ?? spec.name, letters = spec.letters ?? contrast(fascia2 ?? wallHex);
    const pad = 0.15;
    if (fascia2) boxes.push({ x0: x0 + 0.05, x1: x1 - 0.05, z0: fz0, z1: h - 0.05, out0: WALL, out1: OUT + 0.06, hex: fascia2 });
    const signOut = fascia2 ? OUT + 0.06 : WALL;
    const logoR = spec.logo ? fasciaH * 0.48 : 0, logoAt = spec.logo?.at ?? "left";
    const [tx0, tx1] = spec.textAt ? [Math.max(x0, spec.textAt[0] + sh), Math.min(x1, spec.textAt[1] + sh)] : [x0, x1];
    const bladeAt = spec.sign && spec.sign !== "none" ? spec.signAt ?? ((spec.door ?? "left") === "right" ? "left" : "right") : null;
    const ta = tx0 + pad + (spec.logo && logoAt === "left" ? 2 * logoR + 0.15 : 0) + (bladeAt === "left" && tx0 <= x0 + 0.4 ? 0.35 : 0);
    const tb = tx1 - pad - (spec.logo && logoAt === "right" ? 2 * logoR + 0.15 : 0) - (bladeAt === "right" && tx1 >= x1 - 0.4 ? 0.35 : 0);
    const m = Math.min(0.15, (h - 0.05 - fz0) * 0.18);
    if (!signText) {
    } else if (spec.text2) {
      text(signText, ta, tb, fz0 + 0.38, h - 0.13, signOut, letters);
      text(spec.text2, ta, tb, fz0 + 0.1, fz0 + 0.3, signOut, letters);
    } else {
      const mid = (fz0 + h - 0.05) / 2, half2 = spec.textH ? Math.min(spec.textH / 2, (h - 0.05 - fz0) / 2 - m) : (h - 0.05 - fz0) / 2 - m;
      text(signText, ta, tb, mid - half2, mid + half2, signOut, letters);
    }
    if (spec.logo) {
      const cx2 = logoAt === "left" ? tx0 + pad + logoR : tx1 - pad - logoR, cz = (fz0 + h - 0.05) / 2;
      faces.push(disc(cx2, cz, logoR, signOut + 0.01, spec.logo.ring ?? WHITE4), disc(cx2, cz, logoR * 0.78, signOut + 0.02, spec.logo.hex));
    }
    let openTop = fz0 - 0.08;
    if (spec.banner) {
      const bz0 = fz0 - 0.32;
      boxes.push({ x0: x0 + 0.05, x1: x1 - 0.05, z0: bz0, z1: fz0, out0: WALL, out1: OUT + 0.03, hex: spec.banner.hex });
      if (spec.banner.text) text(spec.banner.text, x0 + pad, x1 - pad, bz0 + 0.06, fz0 - 0.06, OUT + 0.03, spec.banner.letters ?? contrast(spec.banner.hex));
      openTop = bz0 - 0.06;
    }
    const door = spec.door ?? "left";
    const tokens = (spec.bays === "none" ? "" : spec.bays ?? (door === "left" ? "D W" : door === "right" ? "W D" : door === "centre" ? "W D W" : "W")).trim().split(/\s+/).filter(Boolean);
    const bays = layoutBays(tokens, x0 + 0.1, x1 - 0.1);
    const style = spec.windows ?? "big", gBot = 0.5, doorTop = Math.min(2.45, openTop - 0.1);
    const glassTop = spec.transom ? openTop - 0.5 : openTop;
    const doorHex = spec.doorHex ?? frame;
    const glazed = [];
    const REC = OUT - 0.045, SHEEN = mixHex(GLASS3, "#c8d4de", 0.3);
    const glassPane = (g0, g1, z0, z1, out) => {
      boxes.push({ x0: g0, x1: g1, z0, z1, out0: WALL, out1: out, hex: GLASS3 });
      const w = g1 - g0, hh = z1 - z0;
      if (w > 0.4 && hh > 0.6) faces.push({ points: [[g0 + 0.55 * w, z1 - 0.04], [g0 + 0.8 * w, z1 - 0.04], [g0 + 0.38 * w, z0 + 0.3 * hh], [g0 + 0.13 * w, z0 + 0.3 * hh]], out: out + 2e-3, hex: SHEEN });
    };
    const paneGrid = (a, b, z0, z1, cols, rows, out) => {
      for (let i = 1; i < cols; i++) {
        const x = a + (b - a) * i / cols;
        boxes.push({ x0: x - 0.035, x1: x + 0.035, z0, z1, out0: out, out1: out + 0.03, hex: frame });
      }
      for (let j = 1; j < rows; j++) {
        const z = z0 + (z1 - z0) * j / rows;
        boxes.push({ x0: a, x1: b, z0: z - 0.035, z1: z + 0.035, out0: out, out1: out + 0.03, hex: frame });
      }
    };
    for (const bay of bays) {
      const { x0: a, x1: b } = bay, w = b - a;
      switch (bay.kind) {
        case "O":
          boxes.push({ x0: a, x1: b, z0: 0, z1: openTop, out0: WALL, out1: WALL + 4e-3, hex: "#26272a", face: true });
          break;
        case "P":
          boxes.push({ x0: a, x1: b, z0: 0, z1: openTop, out0: WALL, out1: OUT + 0.08, hex: spec.pilaster ?? frame });
          break;
        case "W": {
          const g0 = a + 0.1, g1 = b - 0.1;
          boxes.push({ x0: a, x1: g0, z0: 0, z1: openTop, out0: WALL, out1: OUT, hex: frame }, { x0: g1, x1: b, z0: 0, z1: openTop, out0: WALL, out1: OUT, hex: frame });
          boxes.push({ x0: g0, x1: g1, z0: 0, z1: gBot, out0: WALL, out1: OUT, hex: frame }, { x0: g0, x1: g1, z0: glassTop, z1: Math.min(openTop, glassTop + 0.08), out0: WALL, out1: OUT, hex: frame });
          if (openTop - glassTop > 0.1) boxes.push({ x0: g0, x1: g1, z0: openTop - 0.08, z1: openTop, out0: WALL, out1: OUT, hex: frame });
          boxes.push({ x0: a + 0.08, x1: b - 0.08, z0: 0.06, z1: gBot - 0.06, out0: OUT, out1: OUT + 0.03, hex: plinth });
          if (style === "arched") {
            glassPane(g0, g1, gBot, glassTop - 0.35, REC);
            boxes.push({ x0: g0, x1: g1, z0: glassTop - 0.35, z1: glassTop, out0: WALL, out1: OUT, hex: frame });
            faces.push({ points: [[g0, glassTop - 0.35], ...arch(g1, g0, glassTop - 0.35, 0.3, 6).map(([x, z]) => [x, z])], out: OUT + 5e-3, hex: GLASS3 });
          } else glassPane(g0, g1, gBot, glassTop, REC);
          const [cols, rows] = spec.grid ?? (style === "big" || style === "arched" ? [1, 1] : style === "split" ? [Math.max(1, Math.round(w / 1.4)), 1] : [Math.max(2, Math.round(w / 0.7)), 2]);
          paneGrid(g0, g1, gBot, style === "arched" ? glassTop - 0.35 : glassTop, cols, rows, REC);
          if (spec.transom) {
            const n = Math.max(2, Math.round(w / 0.55)), pw = (g1 - g0) / n;
            for (let i = 0; i < n; i++) boxes.push({ x0: g0 + i * pw + 0.04, x1: g0 + (i + 1) * pw - 0.04, z0: glassTop + 0.08, z1: openTop - 0.08, out0: WALL, out1: REC, hex: GLASS3 });
            for (let i = 1; i < n; i++) boxes.push({ x0: g0 + i * pw - 0.04, x1: g0 + i * pw + 0.04, z0: glassTop + 0.08, z1: openTop - 0.08, out0: WALL, out1: OUT, hex: frame });
          }
          glazed.push([g0, g1]);
          break;
        }
        case "D":
        case "d": {
          const shop = bay.kind === "D", top = shop ? doorTop : Math.min(doorTop, 2.3);
          if (shop) boxes.push({ x0: a, x1: b, z0: 0, z1: openTop, out0: WALL, out1: OUT, hex: frame });
          boxes.push({ x0: a + 0.08, x1: b - 0.08, z0: 0, z1: top, out0: shop ? OUT - 0.04 : WALL - 0.02, out1: shop ? OUT + 0.01 : WALL + 0.03, hex: shop ? doorHex : spec.doorHex ?? INK });
          if (shop) glassPane(a + 0.22, b - 0.22, 1, top - 0.18, OUT + 0.02);
          if (top < openTop - 0.3) boxes.push({ x0: a + 0.12, x1: b - 0.12, z0: top + 0.08, z1: (shop ? openTop : top + 0.5) - 0.08, out0: shop ? OUT : WALL, out1: (shop ? OUT : WALL) + 0.01, hex: GLASS3 });
          break;
        }
        case "C": {
          const top = Math.min(2.6, openTop - 0.1), mid = (a + b) / 2;
          boxes.push({ x0: a, x1: b, z0: 0, z1: openTop, out0: WALL, out1: OUT, hex: doorHex });
          for (const [l0, l1] of [[a + 0.1, mid - 0.04], [mid + 0.04, b - 0.1]]) {
            boxes.push({ x0: l0 + 0.1, x1: l1 - 0.1, z0: 0.9, z1: top - 0.12, out0: OUT, out1: OUT + 0.01, hex: GLASS3 });
            paneGrid(l0 + 0.1, l1 - 0.1, 0.9, top - 0.12, 2, 4, OUT + 0.01);
            boxes.push({ x0: l0 + 0.1, x1: l1 - 0.1, z0: 0.15, z1: 0.75, out0: OUT, out1: OUT + 0.03, hex: doorHex });
          }
          boxes.push({ x0: a + 0.12, x1: b - 0.12, z0: top + 0.06, z1: openTop - 0.06, out0: OUT, out1: OUT + 0.01, hex: GLASS3 });
          break;
        }
      }
    }
    const firstDoor = bays.find((b) => b.kind === "C" || b.kind === "D");
    if (spec.archSign && firstDoor) {
      const { x0: a, x1: b } = firstDoor, z = openTop + 0.02;
      faces.push({ points: [[a - 0.05, z], ...arch(b + 0.05, a - 0.05, z, 0.45, 8)], out: OUT + 0.05, hex: spec.archSign.hex });
      text(spec.archSign.text, a + 0.15, b - 0.15, z + 0.05, z + 0.3, OUT + 0.06, spec.archSign.letters ?? contrast(spec.archSign.hex));
    }
    if (spec.lanterns && firstDoor) for (const x of [firstDoor.x0 - 0.2, firstDoor.x1 + 0.2]) {
      boxes.push({ x0: x - 0.03, x1: x + 0.03, z0: 2.1, z1: 2.16, out0: OUT, out1: 0.4, hex: INK }, { x0: x - 0.11, x1: x + 0.11, z0: 1.75, z1: 2.1, out0: 0.25, out1: 0.47, hex: LAMP }, { x0: x - 0.13, x1: x + 0.13, z0: 2.1, z1: 2.18, out0: 0.23, out1: 0.49, hex: INK });
    }
    for (const sg of spec.signs ?? []) {
      const [a, b] = [sg.x[0] + sh, sg.x[1] + sh], [z0, z1] = sg.z;
      const so = OUT + 0.1;
      if (sg.board) boxes.push({ x0: a, x1: b, z0, z1, out0: WALL, out1: so, hex: sg.board });
      if (sg.tiles) {
        const chars = [...sg.text], step = (b - a) / chars.length, side = Math.min(step * 0.9, z1 - z0);
        chars.forEach((c, i) => {
          if (c === " ") return;
          const cx2 = a + step * (i + 0.5), cz = (z0 + z1) / 2;
          boxes.push({ x0: cx2 - side / 2, x1: cx2 + side / 2, z0: cz - side / 2, z1: cz + side / 2, out0: WALL, out1: so, hex: sg.tiles });
          text(c, cx2 - side * 0.38, cx2 + side * 0.38, cz - side * 0.38, cz + side * 0.38, so, sg.letters);
        });
      } else text(sg.text, a + 0.05, b - 0.05, z0 + 0.04, z1 - 0.04, so, sg.letters);
    }
    for (const pattern of [spec.pattern ?? []].flat()) {
      const { kind, a: pa, b: pb, on = "both" } = pattern;
      const bands = [];
      if (fascia2 && on !== "plinth") bands.push([fz0, h - 0.05, OUT + 0.061]);
      if (on !== "fascia") bands.push([0.06, gBot - 0.06, OUT + 0.031]);
      for (const [z0, z1, out] of bands) {
        boxes.push({ x0: x0 + 0.05, x1: x1 - 0.05, z0, z1, out0: out - 1e-3, out1: out, hex: pa, face: true });
        if (kind === "zebra") for (let x = x0 + 0.1, i = 0; x < x1 - 0.2; i++) {
          const w = 0.12 + i * 37 % 5 * 0.04, tilt = (i * 53 % 7 - 3) * 0.04;
          faces.push({ points: [[x, z0], [x + w, z0], [x + w + tilt, z1], [x + tilt, z1]], out: out + 2e-3, hex: pb });
          x += w * 2.2;
        }
        else for (let x = x0 + 0.05, i = 0; x < x1 - 0.05; x += 0.2, i++) for (let z = z0, j = 0; z < z1 - 0.01; z += 0.2, j++) if ((i + j) % 2) boxes.push({ x0: x, x1: Math.min(x1 - 0.05, x + 0.2), z0: z, z1: Math.min(z1, z + 0.2), out0: out, out1: out + 2e-3, hex: pb, face: true });
      }
    }
    if (spec.shutters) for (const [a, b] of glazed) for (const sx of [a - 0.34, b + 0.02]) boxes.push({ x0: sx, x1: sx + 0.32, z0: gBot, z1: glassTop, out0: OUT + 0.03, out1: OUT + 0.07, hex: spec.shutters });
    if (spec.rollers) for (const [a, b] of glazed) {
      const rHex = typeof spec.rollers === "string" ? spec.rollers : "#5a6270";
      boxes.push({ x0: a - 0.05, x1: b + 0.05, z0: glassTop - 0.3, z1: glassTop, out0: OUT, out1: OUT + 0.22, hex: "#8a8c8e" }, { x0: a, x1: b, z0: gBot, z1: glassTop - 0.3, out0: OUT + 0.1, out1: OUT + 0.12, hex: rHex });
      for (let z = gBot + 0.25; z < glassTop - 0.35; z += 0.25) boxes.push({ x0: a, x1: b, z0: z, z1: z + 0.04, out0: OUT + 0.12, out1: OUT + 0.14, hex: "#3a3f48" });
      if (spec.graffiti?.length) {
        let seed = 0;
        for (const c of spec.name) seed = seed * 31 + c.charCodeAt(0) >>> 0;
        const rnd = () => (seed = seed * 1103515245 + 12345 >>> 0) / 2 ** 32;
        const top = glassTop - 0.35, n = Math.max(4, Math.round((b - a) * 1.6));
        for (let i = 0; i < n; i++) {
          const cx2 = a + 0.2 + rnd() * (b - a - 0.4), cz = gBot + 0.2 + rnd() * (top - gBot - 0.4), rx2 = 0.25 + rnd() * 0.6, rz = 0.15 + rnd() * 0.4, k = rnd() * 0.3;
          const pts = [[cx2 - rx2, cz - rz * 0.6], [cx2 + rx2 * 0.7, cz - rz], [cx2 + rx2, cz + rz * 0.5], [cx2 - rx2 * 0.6 + k, cz + rz]];
          faces.push({ points: pts.map(([x, z]) => [Math.min(b, Math.max(a, x)), Math.min(top, Math.max(gBot, z))]), out: OUT + 0.141 + i * 1e-3, hex: spec.graffiti[i % spec.graffiti.length] });
        }
      }
    }
    const aHex = spec.awningHex ?? frame, aZ = openTop + 0.05, aLetters = spec.awningText?.letters ?? contrast(aHex);
    const awningAt = (ax0, ax1, label) => {
      switch (spec.awning ?? "none") {
        case "flat":
          extrusions.push({ x0: ax0, x1: ax1, profile: [[OUT, aZ], [1.5, aZ - 0.5], [1.5, aZ - 0.75]], hex: aHex });
          if (label) boxes.push(...textRects(label, ax0 + 0.2, ax1 - 0.2, aZ - 0.72, aZ - 0.53).map((r) => ({ ...r, out0: 1.5, out1: 1.515, hex: aLetters, face: true })));
          break;
        case "box":
          extrusions.push({ x0: ax0, x1: ax1, profile: [[OUT, aZ + 0.3], [1, aZ + 0.3], [1, aZ - 0.05], [OUT, aZ - 0.05]], hex: aHex });
          if (label) boxes.push(...textRects(label, ax0 + 0.25, ax1 - 0.25, aZ + 0.02, aZ + 0.23).map((r) => ({ ...r, out0: 1, out1: 1.015, hex: aLetters, face: true })));
          break;
        case "striped":
          boxes.push(...stripedAwning(ax0, ax1, aZ, 1.4, aHex, spec.awningHex2 ?? WHITE4).map((b) => ({ ...b, out0: OUT })));
          break;
        case "scalloped": {
          extrusions.push({ x0: ax0, x1: ax1, profile: [[OUT, aZ], [1.3, aZ - 0.35]], hex: aHex });
          for (let x = ax0; x < ax1 - 0.35; x += 0.5) faces.push({ points: [[x + 0.02, aZ - 0.35], [x + 0.48, aZ - 0.35], [x + 0.25, aZ - 0.6]], out: 1.3, hex: aHex });
          break;
        }
        case "canopy":
          extrusions.push({ x0: ax0 - 0.2, x1: ax1 + 0.2, profile: [[OUT, aZ], [2.2, aZ - 0.05], [2.2, aZ - 0.2], [OUT, aZ - 0.15]], hex: aHex });
          break;
        case "dutch": {
          const R = 1, prof = [];
          for (let i = 0; i <= 6; i++) {
            const t = Math.PI / 2 * (i / 6);
            prof.push([OUT + R * Math.sin(t), aZ - 0.02 - R * (1 - Math.cos(t))]);
          }
          extrusions.push({ x0: ax0, x1: ax1, profile: prof, hex: aHex });
          break;
        }
        case "tiled": {
          for (let k = 0; k < 3; k++) boxes.push({ x0: ax0 - 0.15, x1: ax1 + 0.15, z0: aZ - 0.2 - k * 0.18, z1: aZ - k * 0.18, out0: OUT + k * 0.35, out1: OUT + (k + 1) * 0.35, hex: aHex });
          boxes.push({ x0: ax0 - 0.25, x1: ax1 + 0.25, z0: aZ - 0.72, z1: aZ - 0.6, out0: 1.1, out1: 1.2, hex: "#9a1f22" });
          break;
        }
      }
    };
    if (spec.awningSegments) for (const seg of spec.awningSegments) awningAt(Math.max(x0, seg.x[0] + sh), Math.min(x1, seg.x[1] + sh), seg.text);
    else awningAt(...spec.awningOver ? [bays[spec.awningOver[0]].x0 - 0.05, bays[spec.awningOver[1]].x1 + 0.05] : [x0 + 0.1, x1 - 0.1], spec.awningText?.text);
    const sAt = (spec.signAt ?? (door === "right" ? "left" : "right")) === "left" ? x0 + 0.25 : x1 - 0.25, sHex = spec.signHex ?? (fascia2 ?? frame);
    switch (spec.sign ?? "none") {
      case "round":
        boxes.push({ x0: sAt - 0.03, x1: sAt + 0.03, z0: h - 0.15, z1: h - 0.1, out0: OUT, out1: 0.8, hex: INK }, { x0: sAt - 0.06, x1: sAt + 0.06, z0: h - 0.75, z1: h - 0.15, out0: 0.2, out1: 0.8, hex: sHex });
        break;
      case "square":
        boxes.push({ x0: sAt - 0.03, x1: sAt + 0.03, z0: h + 0.35, z1: h + 0.4, out0: OUT, out1: 0.95, hex: INK }, { x0: sAt - 0.06, x1: sAt + 0.06, z0: h - 0.45, z1: h + 0.35, out0: 0.2, out1: 0.95, hex: sHex });
        break;
      case "lamp":
        boxes.push({ x0: sAt - 0.03, x1: sAt + 0.03, z0: h + 0.2, z1: h + 0.25, out0: OUT, out1: 0.7, hex: INK }, { x0: sAt - 0.12, x1: sAt + 0.12, z0: h - 0.25, z1: h + 0.2, out0: 0.5, out1: 0.74, hex: LAMP });
        break;
    }
    if (spec.terrace) for (let x = x0 + 0.8; x < x1 - 0.5; x += 1.6) {
      boxes.push({ x0: x - 0.03, x1: x + 0.03, z0: 0, z1: 0.72, out0: 1.55, out1: 1.61, hex: INK }, { x0: x - 0.3, x1: x + 0.3, z0: 0.72, z1: 0.76, out0: 1.28, out1: 1.88, hex: aHex });
      for (const dx of [-0.5, 0.5]) boxes.push({ x0: x + dx - 0.16, x1: x + dx + 0.16, z0: 0.4, z1: 0.45, out0: 1.42, out1: 1.74, hex: CHAIR }, { x0: x + dx - 0.14, x1: x + dx - 0.1, z0: 0, z1: 0.4, out0: 1.5, out1: 1.66, hex: CHAIR }, { x0: x + dx + 0.1, x1: x + dx + 0.14, z0: 0, z1: 0.4, out0: 1.5, out1: 1.66, hex: CHAIR }, { x0: x + dx - 0.16, x1: x + dx + 0.16, z0: 0.45, z1: 0.8, out0: 1.7, out1: 1.74, hex: CHAIR });
    }
    if (spec.plants) for (let x = x0 + 0.3; x < x1 - 0.6; x += 2.2) boxes.push({ x0: x, x1: x + 0.5, z0: 0, z1: 0.5, out0: 0.25, out1: 0.75, hex: "#4a3b30" }, { x0: x - 0.05, x1: x + 0.55, z0: 0.5, z1: 1.05, out0: 0.2, out1: 0.8, hex: "#3f7a3a" });
    const kept = boxes.filter((b) => b.z1 - b.z0 > 0.02 && b.x1 - b.x0 > 0.02);
    const base = { name: spec.name, roofline: "unmeasured", ids: [wall.pand], start: wall.start, end: wall.end, depthM: 0.05 + (wall.outM ?? 0), extrusions, faces };
    if (spec.facade) {
      const f = spec.facade, outline = f.outline.map(([x, z]) => [Math.min(L, Math.max(0, x + sh)), z]);
      const ribs = [];
      if (f.ribs) for (let x = outline[0][0] + 0.15; x < outline[outline.length - 1][0] - 0.1; x += 0.35) {
        let top = 0;
        for (let i = 1; i < outline.length; i++) {
          const [xa, za] = outline[i - 1], [xb, zb] = outline[i];
          if (x >= xa && x <= xb && xb > xa) top = za + (zb - za) * (x - xa) / (xb - xa);
        }
        if (top > 0.3) ribs.push({ x0: x, x1: x + 0.06, z0: 0.05, z1: top - 0.05, out0: 0, out1: 0.04, hex: f.ribs });
      }
      const reg = (o) => o.map(([x, z]) => [Math.min(L, Math.max(0, x + sh)), z]);
      return { ...base, hex: f.hex, outline, bodyTopM: f.topM, slabs: (f.slabs ?? []).map((sl) => ({ ...sl, outline: reg(sl.outline) })), boxes: [...ribs, ...spec.bays === "none" ? kept.slice(1) : kept], windows: (f.windows ?? []).map((w) => ({ ...w, xs: w.xs.map((x) => x + sh), hex: GLASS3 })) };
    }
    return { ...base, storefront: true, carrierHex: spec.buildingHex, hex: wallHex, outline: [[x0, 0.01], [x1, 0.01]], boxes: kept, windows: [] };
  }

  // src/canalRecall/storefrontSpecs.ts
  var STOREFRONT_SPECS = {
    // --- Sheet 00 ---
    "a-fushion-42477": { name: "A-Fusion", frame: "#3a3d40", wall: "#c8c4b8", fascia: "#c8c4b8", fasciaH: 0.4, text: "", span: [5.2, 13], bays: "W D:1.6 W", grid: [2, 1], signs: [{ text: "A-FUSION", x: [10.9, 12.9], z: [0.9, 1.4], letters: "#f2f0ea" }], heightM: 4.2 },
    "a-sentimento-pizza-33537": null,
    "a-tavola-81149": { name: "A Tavola", frame: "#2a2c2e", wall: "#ece6d6", buildingHex: "#ece6d6", fascia: false, text: "", span: [0, 10.8], bays: "B:0.3 W:5.8 B:0.9 W", awning: "flat", awningHex: "#8a1f22", awningSegments: [{ x: [0.4, 6.2] }, { x: [7.1, 10.8] }], plants: true, heightM: 4.3 },
    "a-volo-72841": { name: "A Volo", frame: "#e8e6e0", wall: "#e8e6e0", fascia: "#e8e6e0", fasciaH: 0.35, text: "", span: [0, 4.1], bays: "D:1.0 W", transom: true, terrace: true, heightM: 4 },
    "aaltje-54926": { name: "Aaltje", frame: "#2f4a36", wall: "#8a5a44", plinth: "#8a5a44", fascia: false, text: "", span: [0.5, 7.7], bays: "D:0.9 B:1.3 C:2.0 B:1.4 d:1.0", doorHex: "#2f4a36", signs: [{ text: "", x: [1.6, 2.8], z: [0.05, 2.5], letters: "#3f6a4a", board: "#3f6a4a" }, { text: "", x: [4.9, 6.2], z: [0.05, 2.5], letters: "#3f6a4a", board: "#3f6a4a" }], plants: true, heightM: 3.4 },
    "abyssinia-49625": { name: "Abyssinia", frame: "#3a2a22", wall: "#3a2a22", plinth: "#1d1d1f", fascia: "#e9dcc4", fasciaH: 0.85, text: "ABYSSINIA", textAt: [0.6, 4.2], letters: "#4a3020", pattern: [{ kind: "zebra", a: "#e9dcc4", b: "#6a4a30", on: "fascia" }, { kind: "zebra", a: "#1d1d1f", b: "#f2efe8", on: "plinth" }], span: [0.3, 9], bays: "W:3.4 P W W:1.6 B:0.4 D:0.8", banner: { hex: "#2a1f1a", text: "AFRIKAANS ART-CAFE", letters: "#f2efe8" }, sign: "square", signHex: "#f2efe8", plants: true, heightM: 4.5 },
    "afhaalcentrum-terang-boelan-65034": { name: "Terang Boelan", frame: "#4a2a1c", wall: "#4a2a1c", doorHex: "#7a3a24", fascia: "#3a2a22", fasciaH: 0.35, text: "", span: [1.8, 6.6], bays: "W D:0.9", transom: true, awning: "flat", awningHex: "#6a6a68", signs: [{ text: "TERANG BOELAN", x: [2.3, 5], z: [1, 1.4], letters: "#f2f0ea" }], sign: "square", signHex: "#e3b020", signAt: "right", heightM: 4.2 },
    "akitsu-69827": { name: "Akitsu", frame: "#ecebe6", wall: "#ecebe6", fascia: "#ecebe6", fasciaH: 0.5, text: "", span: [0, 4.8], bays: "P:0.3 W P:0.3 W P:0.3", grid: [2, 2], heightM: 4 },
    "al-argentino-65689": { name: "Al Argentino", frame: "#2a2c2e", wall: "#3a3c40", fascia: "#2a2c2e", fasciaH: 0.35, text: "AL ARGENTINO", letters: "#c8282a", shift: -1.3, span: [1.3, 6.3], bays: "W D:0.6 d:0.6", sign: "round", signHex: "#c8282a", signAt: "left", heightM: 2.9 },
    "al-basha-47236": { name: "Al Basha", frame: "#2a2c2e", wall: "#ecebe6", fascia: "#ecebe6", fasciaH: 0.6, text: "", span: [3, 15.2], bays: "W:1.5 B:0.35 W:2.6 B:0.35 D:1.6 B:0.35 W:2.6 B:0.35 W", grid: [2, 1], signs: [{ text: "AL BASHA", x: [8, 9.9], z: [3.15, 3.5], letters: "#c8282a", board: "#f2efe8" }], plants: true, heightM: 4 },
    "alberto-pozzetto-private-dining-56811": null,
    "albina-10961": { name: "Albina", frame: "#3d454c", wall: "#3d454c", fascia: "#3d454c", fasciaH: 0.8, text: "", span: [0, 10.8], bays: "W:2.0 D:0.8 W:1.4 B:0.4 d:0.7 B:0.4 D:0.7 W:1.6 W", transom: true, grid: [2, 1], plants: true, heightM: 4.4 },
    "ali-ocakbas-78972": { name: "Ali Ocakbasi", frame: "#e8e2cc", wall: "#e8e2cc", plinth: "#e8e2cc", fascia: "#e8e2cc", fasciaH: 0.5, text: "", span: [5.8, 9.4], bays: "P:0.4 W P:0.4", windows: "arched", sign: "square", signHex: "#c8282a", signAt: "left", lanterns: false, heightM: 5.2 },
    "ama-sushi-ramen-35932": { name: "Coffeedate", frame: "#ecebe6", doorHex: "#ecebe6", wall: "#ecebe6", fascia: "#d8d8d4", text: "#COFFEEDATE", letters: "#c8282a", span: [0, 5], bays: "W:0.9 C:1.8 W:1.0 d:0.9", transom: true, terrace: true, heightM: 4.9 },
    "amra-74506": { name: "Amra", frame: "#2a3550", doorHex: "#2a3550", wall: "#6a7076", plinth: "#6a7076", fascia: "#6a7076", fasciaH: 0.6, text: "", span: [0, 7.4], bays: "B:0.4 W:1.4 D:0.8 B:0.4 W:1.1 B:0.8 W:1.1 B:0.5 d:0.6", grid: [1, 2], awning: "flat", awningHex: "#4a4c4e", sign: "round", signHex: "#2f7a3a", signAt: "right", heightM: 4.4 },
    "aneka-rasa-71504": { name: "Aneka Rasa", frame: "#e8e2cc", wall: "#b8b4ac", fascia: false, text: "", span: [0.3, 9.5], bays: "B:0.6 d:0.9 B:0.3 W:2.2 B:0.6 W:0.8 B:0.3 D:0.9 B:0.3 W:0.9 B", transom: true, signs: [{ text: "ANEKA RASA", x: [4.9, 9.4], z: [4.4, 5.1], letters: "#2f6a3a", board: "#e3e0d8" }], heightM: 4.6 },
    // Sheet 01.
    "anjappar-65520": { name: "Anjappar", frame: "#2a2c2e", wall: "#8a8a86", plinth: "#8a8a86", fascia: "#6a6c6e", fasciaH: 0.3, text: "", span: [15.9, 20.6], bays: "P:0.3 W P:0.3", transom: true, grid: [2, 1], awning: "canopy", awningHex: "#5a5c5e", heightM: 5.8 },
    "any-thaim-delivery-23690": { name: "Any Thaim", frame: "#ecebe6", wall: "#ecebe6", plinth: "#2a2c2e", fascia: "#ecebe6", fasciaH: 0.3, text: "", span: [1.9, 5.2], bays: "W", transom: true, heightM: 3.5 },
    "argentalia-78811": { name: "Argentalia", frame: "#e8e2cc", doorHex: "#1d1d1f", wall: "#e8e2cc", fascia: "#e8e2cc", fasciaH: 0.5, text: "", span: [0, 2.9], bays: "P:0.3 C:2.0 P:0.3", heightM: 4.6 },
    "arles-60398": { name: "Arles", frame: "#8a5a2a", doorHex: "#1d1d1f", wall: "#8a5a2a", plinth: "#2a2c2e", fascia: false, text: "", span: [0.3, 5.1], bays: "W D:0.9", transom: true, awning: "flat", awningHex: "#5a5c5e", signs: [{ text: "ARLES", x: [1.7, 2.9], z: [2.2, 2.7], letters: "#f2f0ea" }], heightM: 4.6 },
    "attila-turkish-food-78174": null,
    "auberge-36577": { name: "Auberge", frame: "#6a4020", doorHex: "#8a5a30", wall: "#6a4020", fascia: "#4a2e1a", fasciaH: 0.35, text: "", span: [0.9, 6.6], bays: "B:0.3 D:0.9 B:0.3 W", transom: true, grid: [2, 1], plants: true, terrace: true, heightM: 4.2 },
    "baibua-75627": { name: "Baibua", frame: "#1d1d1f", wall: "#1d1d1f", fascia: false, text: "", span: [14.6, 17.7], bays: "W", awning: "striped", awningHex: "#1d1d1f", awningHex2: "#ecebe6", signs: [{ text: "VEGAN JUNK FOOD", x: [14.8, 17.5], z: [1.9, 2.3], letters: "#d8282a" }], heightM: 4.2 },
    "baires-40662": { name: "Baires", frame: "#e6dfcf", wall: "#e6dfcf", plinth: "#1d1d1f", fascia: false, text: "", span: [0, 4.2], bays: "d:1.1 B:0.3 W", grid: [3, 1], awning: "dutch", awningHex: "#c41f2e", awningOver: [2, 2], plants: true },
    "baires-60490": { name: "Baires", frame: "#2a2c2e", wall: "#ece6d6", fascia: false, text: "", span: [0, 5.2], bays: "W:3.2 B:0.2 d:0.7 B", rollers: "#8a8c8e", awning: "box", awningHex: "#c41f2e", awningText: { text: "EMPANADAS Y PASTELERIA", letters: "#f2efe8" }, heightM: 4 },
    "baked-59205": null,
    "bakers-roasters-33622": { name: "Bakers & Roasters", frame: "#2f4f78", doorHex: "#2f4f78", wall: "#2f4f78", fascia: "#2a4570", fasciaH: 0.35, text: "", span: [1.2, 5.2], bays: "W:1.3 C:1.5 W", grid: [2, 2], sign: "round", signHex: "#c8a8b0", signAt: "left", terrace: true, heightM: 3.7 },
    "balraj-67821": { name: "Balraj", frame: "#ecebe6", wall: "#ecebe6", fascia: "#f1ece2", text: "BALRAJ INDIAN RESTAURANT", letters: "#a8231c", span: [4.1, 7.7], bays: "W D W D", grid: [1, 1], transom: true, sign: "square", signHex: "#c8282a", signAt: "left", textAt: [4.4, 7.7] },
    "banh-mi-ba-my-68914": { name: "Banh Mi Ba My", frame: "#1d1d1f", wall: "#1d1d1f", fascia: false, text: "", span: [0.3, 5.4], bays: "D:0.9 B:0.7 W", grid: [3, 2], glass: "#6a5438", awning: "flat", awningHex: "#2a2c2e", heightM: 4.6 },
    "bar-bistro-river-68038": { name: "River", frame: "#4a5048", doorHex: "#4a5048", wall: "#3a3e3a", fascia: "#2a2c2e", fasciaH: 0.25, text: "", span: [0, 9.4], bays: "W W C:1.6 W W:3.0", grid: [2, 2], plants: true, heightM: 3.6 },
    "bar-dancing-multipla-74176": null,
    "bar-karma-78156": { name: "Karma", frame: "#2a2c2e", wall: "#2a2c2e", fascia: false, text: "", span: [0, 17.3], bays: "W W W W W D:1.2 W W W", grid: [2, 2], heightM: 6 },
    // Sheet 02.
    "bar-ristorante-gallizia-64155": { name: "Gallizia", frame: "#1d1d1f", wall: "#1d1d1f", fascia: "#1d1d1f", fasciaH: 0.8, text: "GALLIZIA", letters: "#e8e6e0", text2: "BAR RISTORANTE", span: [0, 5.3], bays: "W D:0.9 W", terrace: true, heightM: 4.6 },
    "barada-54271": { name: "Barada", frame: "#2a2c2e", doorHex: "#4a7aa8", wall: "#7a4a38", plinth: "#7a4a38", fascia: false, text: "", span: [0, 5.9], bays: "W:1.4 B:0.6 C:1.6 B:0.6 W:1.5", grid: [2, 3], archSign: { text: "", hex: "#4b5a68" }, heightM: 5 },
    "bella-storia-trattoria-italiana-64646": { name: "Bella Storia", frame: "#ecebe6", doorHex: "#1d1d1f", wall: "#6a3a30", fascia: false, text: "", span: [0.4, 4.4], bays: "W:2.2 B:0.3 d:0.6 B:0.2 d:0.6", transom: true, sign: "square", signHex: "#c8282a", signAt: "right", heightM: 3.6 },
    "beyoglu-26283": { name: "Beyoglu", frame: "#5a5c5e", wall: "#3a3c3e", fascia: "#8a8c8a", fasciaH: 0.25, text: "", span: [9.8, 18], bays: "W W W B", grid: [2, 1], plants: true, terrace: true, heightM: 3.2 },
    "beyrouth-36814": { name: "Beyrouth", frame: "#6a4a2a", doorHex: "#9a6a3a", wall: "#2a2c2e", fascia: false, text: "", span: [0, 7.8], bays: "W:2.3 B:0.4 d:0.7 B:0.3 D:0.7 W", awning: "striped", awningHex: "#c8282a", signs: [{ text: "BEYROUTH", x: [0.3, 2], z: [1.7, 1.95], letters: "#c8282a" }, { text: "BEYROUTH", x: [5, 7.2], z: [1.7, 1.95], letters: "#c8282a" }], heightM: 4 },
    "billy-s-thai-restaurant-73820": { name: "Billy's Thai", frame: "#ece6d6", doorHex: "#2a2c2e", wall: "#ece6d6", plinth: "#6a6c6e", fascia: "#ece6d6", fasciaH: 0.4, text: "", span: [0, 5.6], bays: "d:0.8 B:0.3 W:1.0 W:1.1 B:0.3 d:0.8 B", transom: true, signs: [{ text: "BILLY'S THAI", x: [2.2, 3], z: [2.2, 2.6], letters: "#2a2c2e", board: "#ece6d6" }], heightM: 3.6 },
    "bir-tat-37903": { name: "Bir Tat", frame: "#ecebe6", wall: "#ecebe6", plinth: "#d8282a", fascia: "#d8282a", fasciaH: 0.5, text: "", span: [0, 9.7], bays: "B:0.8 W W W W W:1.8 B:0.4", transom: true, signs: [{ text: "GRILLROOM", x: [0.4, 2.9], z: [4.25, 4.55], letters: "#f2f0ea" }, { text: "BIR TAT", x: [3.2, 5.6], z: [4.12, 4.68], letters: "#f2f0ea", board: "#3a5aa8" }, { text: "PIDE SALONU", x: [6, 9.3], z: [4.25, 4.55], letters: "#f2f0ea" }], heightM: 4.7 },
    "bisous-52622": { name: "Bisous", frame: "#e8e2d4", doorHex: "#e8e2d4", wall: "#2a2c30", plinth: "#2a2c30", fascia: "#2a2c30", fasciaH: 0.3, text: "", span: [0, 4.7], bays: "d:0.8 B:0.3 W:1.9 B:0.2 d:1.0", grid: [3, 2], glass: "#5a4a38", plants: true, heightM: 4.2 },
    "bistro-amsterdam-74130": { name: "Bistro Amsterdam", frame: "#e8e6e0", doorHex: "#1d1d1f", wall: "#2a2a2c", fascia: false, text: "", span: [0, 5], bays: "d:1.0 B C B:0.6", archSign: { text: "BISTRO AMSTERDAM", hex: "#1d1d1f", letters: "#e8e2d4" }, lanterns: true, plants: true, heightM: 4 },
    "bistro-de-la-mer-77684": { name: "Bistro de la Mer", frame: "#1d1d1f", wall: "#2a2c2e", fascia: "#ece6d6", fasciaH: 0.3, text: "", span: [0, 5], bays: "W:3.0 B:0.3 d:0.8 B", grid: [3, 2], glass: "#5a4a38", heightM: 4.1 },
    "bistrot-des-alpes-82275": { name: "Bistrot des Alpes", frame: "#2a2a2c", wall: "#3a3a3c", pilaster: "#4a4a4c", fascia: "#3a3a3c", fasciaH: 0.3, text: "", span: [0, 9.4], bays: "P:0.4 W:1.5 P:0.3 d:0.7 P:0.6 W:0.6 C:1.4 P:0.4 d:0.7 P:0.5 W:1.7 P:0.5", grid: [1, 2], heightM: 3.2 },
    "bistrot-neuf-71114": { name: "Bistrot Neuf", frame: "#e8e2d4", wall: "#e8e2d4", doorHex: "#7a2a24", fascia: "#ece6d8", text: "BISTROT NEUF", letters: "#b8282a", textH: 0.22, span: [5.8, 11.3], bays: "W:1.6 B:0.2 D:0.8 B:0.6 W:1.5 B:0.1 d:0.7", windows: "arched", terrace: true, heightM: 4 },
    "blauw-56113": { name: "Blauw", frame: "#ece6d8", wall: "#ece6d8", fascia: false, text: "", span: [0.4, 5.1], bays: "d:0.6 B:0.2 W:2.7 B:0.2 d:0.5", transom: true, awning: "flat", awningHex: "#4a4c4e", signs: [{ text: "BLAUW", x: [2, 3.4], z: [1.6, 2.2], letters: "#c8282a" }], heightM: 4.2 },
    "blin-queen-78949": { name: "Blin Queen", frame: "#e8e2d4", wall: "#e8e2d4", doorHex: "#2a2c2e", fascia: "#e8e2d4", fasciaH: 0.4, text: "BLIN QUEEN", letters: "#2a2a2c", span: [0, 5.1], bays: "B:0.3 W:2.2 B:0.1 W:0.8 d:1.0", grid: [3, 2], transom: true, glass: "#5a4a38", plants: true, heightM: 4.4 },
    "bloem-op-ijburg-06701": null,
    "blue-dragon-82246": { name: "Blue Dragon", frame: "#ecebe6", wall: "#8a4a38", fascia: false, text: "", span: [9.2, 12.6], bays: "W W", grid: [2, 1], glass: "#5a4a38", signs: [{ text: "INDIAN RESTAURANT", x: [9.3, 12.6], z: [4.3, 5], letters: "#f2efe8", board: "#8a2a34" }], heightM: 3.2 },
    // Sheet 03.
    "blue-pepper-56684": { name: "Blue Pepper", frame: "#e8e6e0", wall: "#8a3a2a", fascia: false, text: "", span: [0.6, 5.6], bays: "B:0.6 d:0.9 B:0.5 W:0.8 B:0.5 W:0.9 B", windows: "arched", plants: true, heightM: 3.6 },
    "boeuf-53646": { name: "Boeuf", frame: "#2a2c2e", wall: "#3a3a3c", fascia: "#2a2c2e", fasciaH: 0.3, text: "", span: [1.7, 10.6], bays: "W W W W", grid: [2, 2], glass: "#5a4a38", plants: true, terrace: true, heightM: 3.8 },
    "bojo-68561": { name: "Bojo", frame: "#2e2420", wall: "#2e2420", fascia: "#3a2c26", text: "INDONESIAN KITCHEN", letters: "#f2efe8", banner: { hex: "#e8c020", text: "INDONESISCHE SPECIALITEITEN", letters: "#2e2420" }, shift: -1, span: [1, 5.3], bays: "D W", sign: "round", signHex: "#c8282a", signAt: "left", heightM: 3.9 },
    "bougainville-65129": null,
    "bouillon-d-amsterdam-75580": { name: "Bouillon", frame: "#9a4a22", wall: "#7a7470", pilaster: "#8a8480", plinth: "#6a6460", fascia: false, text: "", span: [0, 11.1], bays: "W:2.9 P:0.8 W:2.6 P:1.1 W:2.5 P:1.2", windows: "arched", grid: [3, 4], glass: "#4a3a30", heightM: 7 },
    "brandon-76429": { name: "Brandon", frame: "#2a2c2e", wall: "#e8e2d4", buildingHex: "#e8e2d4", fascia: false, text: "", span: [0.6, 10], bays: "B:0.8 W:1.6 B:1.4 d:0.9 B:1.3 W:2.4 B", signs: [{ text: "CAFE BRANDON", x: [1.5, 2.9], z: [2.9, 3.2], letters: "#f2efe8" }, { text: "BRANDON", x: [4.3, 5.4], z: [2.55, 2.8], letters: "#f2efe8", board: "#2a5aa8" }], awning: "canopy", awningHex: "#3a3c3e", heightM: 4.2 },
    "brasserie-nenette-86764": { name: "Nenette", frame: "#3a3a3a", wall: "#e8e2d4", fascia: false, text: "", span: [0.5, 12.9], bays: "W:4.0 B:1.0 W:2.7 B:1.0 W:3.0 B", awning: "flat", awningHex: "#d8c06a", awningText: { text: "", letters: "#4a3e2a" }, awningSegments: [{ x: [1.1, 4.9] }, { x: [5.9, 8.6], text: "LUNCH" }, { x: [9.6, 12.6], text: "COFFEE" }], terrace: true, heightM: 3.5 },
    "bret-43513": { name: "Bret", frame: "#c8282a", wall: "#b82a24", fascia: false, text: "", span: [2.2, 9.5], bays: "W W W W W", grid: [1, 3], facade: { outline: [[0, 7], [12.1, 7]], hex: "#b82a24", ribs: "#9a2020" }, terrace: true, plants: true, heightM: 6.8 },
    "bridges-50983": { name: "Bridges", frame: "#5a3a28", wall: "#7a4a38", plinth: "#8a8480", fascia: "#8a8480", fasciaH: 0.3, text: "", span: [1.8, 11], bays: "W:3.3 B:0.4 P:1.5 B:0.3 W", grid: [5, 2], glass: "#5a4a38", plants: true, heightM: 3.4 },
    "bromo-indah-70189": { name: "Bromo Indah", frame: "#ece6d6", doorHex: "#2a2c2e", wall: "#ece6d6", buildingHex: "#3a3634", fascia: false, text: "", span: [0.2, 4.8], bays: "W:0.8 d:0.8 B:0.5 W:1.6 B", signs: [{ text: "INDONESISCH", x: [2.4, 3.6], z: [2.6, 2.9], letters: "#2a2c2e", board: "#ece6d6" }], heightM: 3.6 },
    "brouwerij-t-ij-69757": { name: "Brouwerij 't IJ", frame: "#1f3a30", doorHex: "#2f5a48", wall: "#7a5a48", plinth: "#7a5a48", fascia: false, text: "", span: [0, 12.4], bays: "W:1.2 B:1.6 W:0.8 B:0.5 W:0.8 B:0.4 D:0.9 B:0.6 D:0.9 B:0.7 W:0.8 B:0.4 W:0.7 B:0.3 W:0.7", grid: [1, 2], awning: "flat", awningHex: "#2a2c2e", signs: [{ text: "VROUWEN", x: [5.6, 6.6], z: [2.75, 3], letters: "#f2f0ea", board: "#1f3a30" }, { text: "MANNEN", x: [7, 8], z: [2.75, 3], letters: "#f2f0ea", board: "#1f3a30" }], lanterns: true, terrace: true, heightM: 4.3 },
    "brouwerij-troost-26831": { name: "Brouwerij Troost", frame: "#3a3a3a", wall: "#6a3a2c", plinth: "#4a3e3a", fascia: "#b8282a", fasciaH: 0.3, text: "", span: [5.8, 27.3], bays: "B:0.9 W:1.0 B:0.6 W:0.9 B:1.5 W:2.1 D:2.5 B:0.6 W:2.8 B:0.9 W:0.9 B:0.9 W:1.1 B:0.5 W:0.8 B", grid: [3, 1], signs: [{ text: "TROOST", x: [14, 17.4], z: [4.1, 4.75], letters: "#1d1d1f", tiles: "#ecebe6" }, { text: "BROUWERIJ", x: [14.6, 16.8], z: [4.85, 5.1], letters: "#ecebe6" }], terrace: true, heightM: 3.4 },
    "brunchdale-51598": { name: "Brunchdale", frame: "#2a2c2e", wall: "#ddd5c4", pilaster: "#ddd5c4", buildingHex: "#ddd5c4", fascia: false, text: "", span: [0, 22.5], bays: "P:0.5 W:4.6 P:0.6 W:1.3 C:1.4 W:2.1 P:0.6 W:4.8 P:0.6 O:4.9 P:0.6 B", grid: [4, 2], heightM: 7 },
    "brunchie-71533": { name: "Brunchie", frame: "#2a2c2e", doorHex: "#e8e6e0", wall: "#4a4c4e", fascia: "#d8d4cc", fasciaH: 0.3, text: "", span: [0.6, 4.6], bays: "W:2.7 B:0.2 d:0.8", signs: [{ text: "BRUNCHIE", x: [1.4, 2.6], z: [2.1, 2.4], letters: "#d8d4cc" }], transom: true, heightM: 3.9 },
    "brut-de-mer-57580": { name: "Brut de Mer", frame: "#ece8de", doorHex: "#ece8de", wall: "#e8e2d4", buildingHex: "#e8e2d4", fascia: "#2b3a55", fasciaH: 0.35, text: "BRUT DE MER", letters: "#e8e2d4", span: [0.7, 5.4], bays: "W:0.5 D:0.9 B:0.2 C:2.0 B", transom: true, plants: true, heightM: 4 },
    "buffet-van-odette-76062": { name: "Buffet van Odette", frame: "#2a2c2e", wall: "#7a4a38", plinth: "#6a6c6e", fascia: false, text: "", span: [0.5, 11.2], bays: "W:1.1 B:0.6 W:1.0 B:3.0 W:4.0 B", awning: "canopy", awningHex: "#ecebe6", awningOver: [4, 4], terrace: true, plants: true, heightM: 4.2 },
    // Sheet 04.
    "buiten-amsterdam-48608": { name: "Buiten", frame: "#2f6464", fascia: false, text: "", span: [0, 14.7], bays: "none", facade: { outline: [[0, 5.1], [2.3, 5.1], [2.3, 5.3], [8.4, 6.9], [14.2, 5.3], [14.7, 5.3]], hex: "#3f7f80", ribs: "#356c6d", windows: [{ xs: [5.65, 7.4, 9.2, 10.9], rows: [[1.2, 1.9], [2, 2.7], [3.1, 3.75], [3.8, 4.45], [4.5, 5.1]], w: 1.5, frameHex: "#2f6464" }] }, plants: true },
    "bullewijck-par-hasard-01986": { name: "Bullewijck", frame: "#2a2c2e", wall: "#8a8580", plinth: "#8a8580", fascia: false, text: "", span: [0, 19.8], bays: "W:4.0 C:2.6 W W W", grid: [3, 1], awning: "box", awningHex: "#b8282a", awningText: { text: "", letters: "#f2f0ea" }, awningSegments: [{ x: [0, 1.4] }, { x: [6.7, 11.6], text: "KOFFIE LUNCH BORREL" }, { x: [11.7, 16.6], text: "BULLEWIJCK" }, { x: [16.7, 19.8], text: "EEN BEETJE" }], signs: [{ text: "BULLEWIJCK", x: [2.4, 7.9], z: [4.15, 4.85], letters: "#7a4a32" }], facade: { outline: [[0, 7.4], [19.8, 7.4]], hex: "#8a8580", windows: [{ xs: [1.7, 5.3, 8.9, 12.6, 16.2], rows: [[5.4, 6.6]], w: 3, frameHex: "#5a5c5e" }] }, terrace: true, plants: true, heightM: 4.2 },
    "buurman-buurman-eetwinkel-de-with-02216": { name: "Buurman & Buurman", frame: "#eeece6", wall: "#3a3f45", plinth: "#3a3f45", fascia: "#e6e3dc", fasciaH: 0.22, text: "", span: [0, 9], bays: "W:1.4 B:0.8 D:0.9 B:0.65 W:2.25 B:0.6 W:2.3", grid: [1, 1], transom: true, heightM: 4 },
    "cabron-59249": { name: "Cabron", frame: "#5fa58a", doorHex: "#2a2c2e", wall: "#5fa58a", fascia: "#6ab095", fasciaH: 0.6, text: "", span: [0.5, 5.7], bays: "d:0.8 W:1.2 D:0.6 W:0.9 W:0.9", grid: [2, 2], glass: "#5a4a38", heightM: 4.2 },
    "cafe-carbon-72095": { name: "Carbon", frame: "#3a2a22", wall: "#3a2a22", fascia: "#2a1f1a", fasciaH: 0.5, text: "", span: [2.3, 12.7], bays: "W W W D:1.0 W W", grid: [2, 1], awning: "box", awningHex: "#1d1d1f", awningText: { text: "", letters: "#f2efe8" }, awningSegments: [{ x: [2.3, 5.3], text: "CAFE CARBON" }, { x: [5.4, 9], text: "CAFE CARBON" }, { x: [9.2, 12.6], text: "CAFE CARBON" }], signs: [{ text: "GULPENER", x: [4.5, 6.6], z: [3.95, 4.35], letters: "#2f9a4a" }], terrace: true, heightM: 4.4 },
    "cafe-caron-05340": { name: "Caron", frame: "#9ab0ac", wall: "#9ab0ac", fascia: "#9ab0ac", fasciaH: 0.2, text: "", span: [0, 10.4], bays: "W W W W W W", grid: [2, 2], glass: "#5a4a38", plants: true, heightM: 3.2 },
    "cafe-de-klos-72453": { name: "De Klos", frame: "#1d1d1f", wall: "#2a2a2c", buildingHex: "#3a3a3c", fascia: false, text: "", span: [0.3, 6.3], bays: "W:1.3 B:0.4 d:0.7 B:0.4 W:1.6 B:0.2 W:1.3", grid: [2, 2], glass: "#4a3a30", sign: "square", signHex: "#e3c020", signAt: "left", heightM: 4 },
    "cafe-diner-t-weesperplein-54930": { name: "'t Weesperplein", frame: "#1d1d1f", doorHex: "#1d1d1f", wall: "#1d1d1f", buildingHex: "#d8d4cc", fascia: "#1d1d1f", text: "'T WEESPERPLEIN", textAt: [1.9, 4.6], letters: "#e8e6e0", span: [0.2, 6.1], bays: "W:1.5 C:1.5 W:1.1 B:0.5 d:0.9 B", grid: [2, 3], glass: "#5a4a38", plants: true, heightM: 4.6 },
    "cafe-kadijk-70737": { name: "Kadijk", frame: "#5a2a1a", doorHex: "#6a3420", wall: "#5a2a1a", fascia: false, text: "", span: [0, 5.4], bays: "B:0.5 W:1.5 B:0.4 D:0.8 B:0.6 W", transom: true, glass: "#4a3a30", awning: "flat", awningHex: "#b8282a", plants: true, terrace: true, heightM: 5.4 },
    "cafe-luxembourg-71813": { name: "Luxembourg", frame: "#3a3634", wall: "#3a3634", fascia: "#5a5c58", fasciaH: 0.3, text: "", span: [0, 11.4], bays: "W W W W W W W", grid: [2, 1], awning: "canopy", awningHex: "#6a6c68", terrace: true, heightM: 3.4 },
    "cafe-maurits-18332": { name: "Maurits", frame: "#1d1d1f", wall: "#1d1d1f", fascia: "#1d1d1f", fasciaH: 0.7, text: "PAR HASARD", letters: "#d8d4cc", span: [9.9, 14], bays: "W W", grid: [2, 1], awning: "flat", awningHex: "#2a2c2e", terrace: true, heightM: 4.4 },
    "cafe-modern-00305": { name: "Modern", frame: "#e8e2d4", wall: "#c8bfa8", pilaster: "#c8bfa8", plinth: "#7a4a38", fascia: "#c8bfa8", fasciaH: 0.25, text: "", span: [4.9, 16.6], bays: "P:0.3 W P:0.5 W P:0.5 W P:0.5 W P:0.5 W P:0.5 W P:0.5 W P:0.3", grid: [1, 2], glass: "#5a4a38", plants: true, heightM: 4.5 },
    "cafe-parlotte-69678": { name: "Parlotte", frame: "#d8ccb0", doorHex: "#d8ccb0", wall: "#5a3a30", fascia: false, text: "", span: [0, 5.6], bays: "B:0.4 C:1.8 C:1.8 B", awning: "flat", awningHex: "#3a3836", glass: "#4a3a30", terrace: true, heightM: 4.6 },
    "cafe-piazza-82586": { name: "Piazza", frame: "#6b1f1a", wall: "#2a1f1c", fascia: false, text: "", shift: -2, span: [2, 6.7], bays: "W", grid: [1, 2], glass: "#5a4a38", awning: "dutch", awningHex: "#b8282a", signs: [{ text: "PIAZZA", x: [2.5, 3.5], z: [2, 2.3], letters: "#d8b860" }], heightM: 3.8 },
    "cafe-warung-pas-22965": null,
    "cai-cai-15768": { name: "Cai Cai", frame: "#5a1f22", wall: "#3a1a1a", fascia: false, text: "", span: [1, 18], bays: "d:0.6 W:1.3 D:0.6 W:1.0 B:0.3 W:4.0 B:0.5 W:4.1 B:0.3 W:3.1 B:0.3 d:0.6", grid: [4, 1], glass: "#5a4a38", signs: [{ text: "MITO", x: [1.7, 4.2], z: [3.25, 3.75], letters: "#2a2c2e", board: "#ece8e0" }], awning: "flat", awningHex: "#2f5a40", awningSegments: [{ x: [5, 9] }, { x: [9.5, 13.6] }, { x: [13.9, 17] }], heightM: 3.9 },
    // Sheet 05.
    "calisto-76282": { name: "Calisto", frame: "#2a2c2e", wall: "#ecebe6", buildingHex: "#ecebe6", fascia: false, text: "", span: [0.8, 11.6], bays: "B:0.5 W:1.1 B:3.5 d:0.7 B:1.3 W:1.1 B:0.8 W:1.1 B", grid: [2, 3], plants: true, heightM: 3.6 },
    "calle-ocho-59713": { name: "Calle Ocho", frame: "#3a3a36", wall: "#3a3a36", fascia: false, text: "", span: [0, 6.3], bays: "W W W", awning: "canopy", awningHex: "#e8e4dc", terrace: true, heightM: 3.6 },
    "camino-taqueria-36027": { name: "Camino", frame: "#2a2420", wall: "#2a2420", fascia: "#2a2c2e", fasciaH: 0.3, text: "", span: [0, 8.8], bays: "B:0.7 d:0.7 B:0.3 W:1.5 C:1.3 W:1.2 W:1.4 B", transom: true, signs: [{ text: "BISCUIT BABE", x: [2, 3.3], z: [1.6, 2], letters: "#ece8e0" }, { text: "BISCUIT BABE", x: [5.5, 6.7], z: [1.6, 2], letters: "#ece8e0" }], heightM: 4.2 },
    "cannibale-royale-52862": { name: "Cannibale Royale", frame: "#4a525e", wall: "#5a6270", fascia: false, text: "", span: [0, 13.6], bays: "W:5.2 B:0.6 C:2.2 B:0.4 W:3.3 B:0.6 d:0.7", grid: [2, 2], awning: "box", awningHex: "#1d1d1f", awningSegments: [{ x: [1.3, 4.3] }, { x: [5, 7.3] }, { x: [7.5, 10.9] }], heightM: 4.6 },
    "cannibale-royale-handboogstraat-75878": null,
    "cantina-caliente-70417": { name: "Cantina Caliente", frame: "#ecebe6", wall: "#ecebe6", plinth: "#8a5a48", buildingHex: "#d8b888", fascia: false, text: "", span: [0.6, 7.2], bays: "W W W W", grid: [3, 3], awning: "box", awningHex: "#3a8a96", awningText: { text: "", letters: "#f2efe8" }, awningSegments: [{ x: [0.8, 3.9], text: "CANTINA CALIENTE" }, { x: [3.9, 7.1], text: "CANTINA CALIENTE" }], heightM: 5 },
    "cantine-de-caron-52471": null,
    "carletto-67455": { name: "Carletto", frame: "#1d1d1f", doorHex: "#1d1d1f", wall: "#1d1d1f", fascia: "#1d1d1f", fasciaH: 0.6, text: "", span: [0, 6], bays: "B:0.4 W:1.0 C:1.1 W:0.7 B:0.6 W:1.1 B", grid: [2, 2], plants: true, heightM: 4.3 },
    "cartagena-62560": { name: "Cartagena", frame: "#ecebe6", wall: "#ecebe6", fascia: "#ecebe6", fasciaH: 0.4, text: "", span: [0, 3.6], bays: "W", grid: [3, 3], transom: true, signs: [{ text: "CARTAGENA", x: [1.2, 2.3], z: [2.2, 2.55], letters: "#f2efe8", board: "#d8501f" }], heightM: 4.3 },
    "casa-nostra-52357": { name: "Casa Nostra", frame: "#ecebe6", pilaster: "#ecebe6", doorHex: "#1d1d1f", wall: "#2a2a2c", fascia: false, text: "", span: [1.6, 6.7], bays: "P:0.8 B:0.4 C:2.1 B:0.3 P:1.5", heightM: 4.6 },
    "casa-peru-68820": null,
    "cascada-40347": null,
    "castillo-79394": { name: "Castillo", frame: "#2a2420", wall: "#5a2a20", fascia: false, text: "", span: [1.2, 3.8], bays: "B:0.5 C:1.2 B", awning: "dutch", awningHex: "#1f5a40", plants: true, heightM: 3.4 },
    "cavataria-14248": { name: "Cavataria", frame: "#4a2a1a", wall: "#4a2a1a", pilaster: "#6a3a2a", fascia: false, text: "", span: [0.4, 8.1], bays: "W W:1.5 P:0.7 W W", transom: true, awning: "box", awningHex: "#1f4d3a", awningText: { text: "", letters: "#f2efe8" }, awningSegments: [{ x: [0.4, 3.9], text: "CAVATARIA" }, { x: [4.6, 8.1], text: "CAVATARIA" }], signs: [{ text: "CAVATARIA", x: [1.3, 3], z: [1.3, 1.6], letters: "#c8d0d0" }, { text: "CAVATARIA", x: [5.4, 7.4], z: [1.3, 1.6], letters: "#c8d0d0" }], terrace: true, heightM: 4.4 },
    "cedars-05128": { name: "Cedars", frame: "#c8ccd0", wall: "#c8ccd0", fascia: false, text: "", span: [0, 9.7], bays: "W W W W W W", grid: [1, 3], glass: "#5a6a74", heightM: 6.4 },
    "chadni-chowk-17679": { name: "Chadni Chowk", frame: "#e8e2cc", wall: "#7a4a38", fascia: false, text: "", span: [0.5, 7.4], bays: "B:1.9 d:1.4 B:1.0 W:2.1 B", grid: [3, 1], transom: true, heightM: 3.2 },
    // Sheet 06.
    "cham-so-good-58473": { name: "Cham So Good", frame: "#2a2c2e", wall: "#e8e6e0", fascia: false, text: "", span: [0, 4.7], bays: "W", awning: "box", awningHex: "#1f2f50", signs: [{ text: "BESTELLEN & AFHALEN", x: [0.3, 2.4], z: [1, 1.6], letters: "#2a2c2e", board: "#e8e6e0" }], heightM: 4.6 },
    "chateau-amsterdam-13565": { name: "Chateau", frame: "#2a2c2e", wall: "#3c3e40", buildingHex: "#3c3e40", fascia: false, text: "", span: [0, 20.4], bays: "B:4.3 W:1.0 B:0.3 W:0.9 B:1.6 C:3.3 B", awning: "canopy", awningHex: "#2a2c2e", awningOver: [5, 5], heightM: 5 },
    "chhiwat-bladi-lunch-grill-62478": { name: "Chhiwat Bladi", frame: "#2a2c2e", doorHex: "#a06a2a", wall: "#2a2c2e", fascia: false, text: "", span: [0.6, 11.5], bays: "W W W W:1.7 C:2.3 B:0.2 D:1.2", archSign: { text: "", hex: "#3a4a6a" }, signs: [{ text: "CHHIWAT BLADI", x: [2, 7.4], z: [3.2, 3.7], letters: "#d8d4cc", board: "#2a2c2e" }], heightM: 3.9 },
    "china-supreme-99001": null,
    "chuzo-king-77947": null,
    "cinq-oriental-bistro-47188": { name: "Cinq", frame: "#3a3a3a", wall: "#3a3a3a", buildingHex: "#5a4a40", fascia: false, text: "", span: [1.9, 22], bays: "B:2.1 W:3.0 B:0.8 W:5.8 B:0.8 W:4.2 B", grid: [3, 2], signs: [{ text: "RESTAURANT", x: [5.7, 11.3], z: [4.75, 5.3], letters: "#e8e4dc" }], heightM: 3.9 },
    "city-noord-eethuis-84998": { name: "City Noord", frame: "#ecebe6", wall: "#ecebe6", plinth: "#7a3a30", fascia: false, text: "", span: [0, 4.4], bays: "W", grid: [3, 1], signs: [{ text: "CITY NOORD", x: [0.5, 3], z: [2.75, 3.15], letters: "#c8282a", board: "#f2efe8" }], heightM: 3.3 },
    "classico-37221": { name: "Classico", frame: "#e3e0d8", doorHex: "#e3e0d8", wall: "#e3e0d8", fascia: "#8a8a86", fasciaH: 0.35, text: "RISTORANTE CLASSICO CUCINA ITALIANA", letters: "#f2efe8", span: [0, 6.7], bays: "B:0.6 C:1.6 B:0.3 W:3.3 B", signs: [{ text: "CLASSICO", x: [3.3, 5.1], z: [2, 2.4], letters: "#f2efe8" }], heightM: 3.8 },
    "colima-71772": { name: "Colima", frame: "#2a2420", wall: "#c8a040", pilaster: "#c8a040", fascia: false, text: "", span: [0, 9.9], bays: "P:1.0 W:2.0 B:0.4 C:2.5 B:0.4 W:2.6 P:1.0", grid: [2, 2], signs: [{ text: "RESTAURANTE-BAR", x: [3.4, 7.8], z: [4.7, 5.1], letters: "#3a2a1a", board: "#e8dcc0" }, { text: "PATA NEGRA", x: [3.8, 7.4], z: [4.15, 4.65], letters: "#3a2a1a", board: "#e8dcc0" }], heightM: 6 },
    "couscous-bar-61747": { name: "Couscous Bar", frame: "#e8e2d4", wall: "#e8e2d4", fascia: false, text: "", span: [0, 4.6], bays: "W W", awning: "flat", awningHex: "#1f4d3a", awningText: { text: "VEDETT EXTRA", letters: "#f2efe8" }, plants: true, terrace: true, heightM: 6.4 },
    "couscous-club-53618": { name: "Couscous Club", frame: "#5a3a28", wall: "#5a3a28", plinth: "#c8a060", fascia: "#7a5a3a", fasciaH: 0.6, text: "COUSCOUS CLUB", letters: "#d8b860", span: [0.5, 4.3], bays: "D:0.8 B:0.3 W", awning: "striped", awningHex: "#e8e4dc", awningHex2: "#8a6a4a", heightM: 4.3 },
    "ctaste-77277": { name: "Ctaste", frame: "#232a4a", wall: "#232a4a", buildingHex: "#e8e6e0", fascia: "#232a4a", fasciaH: 0.3, text: "", span: [0, 6.4], bays: "W W W W", grid: [3, 3], windows: "arched", signs: [{ text: "CTASTE", x: [1, 2.6], z: [0.12, 0.42], letters: "#e84a8a" }], heightM: 3.4 },
    "cucina-casalinga-34703": { name: "Kledingreparatie", frame: "#e8e6e0", wall: "#e8e6e0", fascia: "#e3c020", fasciaH: 0.6, text: "KLEDINGREPARATIE", letters: "#2a2c2e", span: [0.2, 5.6], bays: "W W W", grid: [2, 1], heightM: 4.3 },
    "de-aardige-pers-58278": { name: "De Aardige Pers", frame: "#6a3a22", doorHex: "#6a3a22", wall: "#6a3a22", fascia: "#5a2e1c", fasciaH: 0.9, text: "", span: [0.8, 10.6], bays: "W:2.8 W:0.8 B:0.5 C:1.1 B:0.6 W W", grid: [2, 1], signs: [{ text: "ODIN", x: [1.1, 1.9], z: [2.3, 2.6], letters: "#f2efe8", board: "#c8282a" }], heightM: 4.4 },
    "de-italiaan-66559": { name: "De Italiaan", frame: "#2a2420", wall: "#3a3c40", buildingHex: "#3a3c40", fascia: false, text: "", span: [0.4, 10], bays: "W W D:0.9 W B:0.4 W W", grid: [2, 2], awning: "box", awningHex: "#b8282a", awningText: { text: "", letters: "#f2efe8" }, awningSegments: [{ x: [0.5, 6.8], text: "DE ITALIAAN" }, { x: [6.8, 9.8], text: "DE ITALIAAN" }], terrace: true, plants: true, heightM: 3.6 },
    "de-juwelier-77678": { name: "De Juwelier", frame: "#5a3420", wall: "#5a3420", plinth: "#2a3550", fascia: "#4a2a18", fasciaH: 0.9, text: "", span: [0, 5.4], bays: "P:0.5 B:0.5 D:0.9 W:2.6 P:0.7", heightM: 5.6, plants: true },
    // Sheet 07.
    "de-nieuwe-khl-80851": null,
    "de-nieuwe-rai-93538": { name: "De Nieuwe Rai", frame: "#3a2a22", wall: "#ecebe6", fascia: "#ecebe6", fasciaH: 0.5, text: "", span: [0, 15.5], bays: "W W W D:0.9 W W W W", grid: [2, 1], awning: "flat", awningHex: "#c8282a", signs: [{ text: "LUNCHROOM", x: [6.1, 8.1], z: [3.75, 4.05], letters: "#3a2a22", board: "#ecebe6" }], terrace: true, heightM: 4 },
    "de-palmboom-71180": { name: "De Palmboom", frame: "#ecebe6", doorHex: "#1d1d1f", wall: "#e8e2cc", buildingHex: "#3a3c40", fascia: "#e8e2cc", fasciaH: 0.3, text: "", span: [0, 5.9], bays: "W:2.4 B:0.3 d:0.8 B:0.3 W", grid: [3, 4], heightM: 4.2 },
    "de-patchka-56486": { name: "De Patchka", frame: "#2a2c2e", wall: "#e8e6e0", fascia: "#e8e6e0", fasciaH: 0.8, text: "DE PATCHKA", textAt: [0.8, 3.9], letters: "#1d1d1f", span: [0, 4.6], bays: "W", awning: "flat", awningHex: "#e8e6e0", heightM: 4.6 },
    "de-pizzakamer-30670": { name: "De Pizzakamer", frame: "#3a3a2a", doorHex: "#3a3a2a", wall: "#3a4a6a", fascia: "#2a2c2e", fasciaH: 0.3, text: "DE PIZZAKAMER", textH: 0.15, letters: "#e8e6e0", span: [1.4, 12.4], bays: "W:1.9 B:0.6 C:1.5 B:0.7 W:1.9 B:0.6 W:2.4 B", grid: [2, 2], terrace: true, heightM: 3.6 },
    "desa-61346": { name: "Desa", frame: "#ece6d6", wall: "#ece6d6", fascia: "#ece6d6", fasciaH: 1, text: "DESA", textAt: [1.5, 4.3], letters: "#8a6a4a", text2: "AUTENTIEK INDONESISCH RESTAURANT", awning: "flat", awningHex: "#ece6d6", span: [0, 5.8], bays: "W D:1.2 W", terrace: true, plants: true, heightM: 4.6 },
    "di-luca-43829": { name: "Di Luca", frame: "#7a4a28", doorHex: "#7a4a28", wall: "#4a2e1c", fascia: "#3a2414", fasciaH: 0.3, text: "DI LUCA", textH: 0.18, letters: "#d8c8a8", span: [0, 32.1], bays: "B:1.5 W W W W C:1.8 W W W W W W W W W", grid: [3, 1], glass: "#5a4a38", plants: true, terrace: true, heightM: 3.9, facade: { outline: [[0, 6.8], [32.1, 6.8]], hex: "#5a3a24", ribs: "#4a2e1c" } },
    "dignita-93370": { name: "Dignita", frame: "#ecebe6", doorHex: "#7a3a24", wall: "#7a4a38", plinth: "#6a6c6e", fascia: false, text: "", span: [0.9, 7.7], bays: "C:1.4 B:0.5 W:3.1 B:0.5 d:0.6 B", transom: true, awning: "canopy", awningHex: "#ecebe6", awningOver: [2, 2], plants: true, heightM: 4.3 },
    "dionysos-taverna-36240": { name: "Dionysos Taverna", frame: "#ecebe6", wall: "#ecebe6", fascia: "#ecebe6", fasciaH: 1, text: "", span: [0, 5], bays: "d:0.8 W:1.4 B:0.2 W:1.4 B", awning: "box", awningHex: "#b8282a", awningText: { text: "DIONYSOS TAVERNA", letters: "#f2efe8" }, plants: true, heightM: 4.7 },
    "domenica-67762": { name: "Domenica", frame: "#2a2c30", wall: "#2a2c30", fascia: false, text: "", span: [1.4, 6.8], bays: "W D:0.8 W", plants: true, heightM: 3.4 },
    "dong-son-takeaway-restaurant-72773": { name: "Dong Son", frame: "#e3c020", wall: "#e3c020", fascia: "#e3c020", fasciaH: 0.3, text: "", span: [1.9, 5.5], bays: "W W W", grid: [1, 2], heightM: 3.2 },
    "dos-73278": { name: "Dos", frame: "#ecebe6", wall: "#7a4a38", fascia: false, text: "", span: [0.6, 15.3], bays: "W:4.0 B:0.6 W:1.5 B:0.6 W:1.8 B:0.4 W:3.4 B", transom: true, grid: [3, 2], awning: "flat", awningHex: "#3a3c3e", terrace: true, heightM: 4.6 },
    "eatmosfera-82121": { name: "Eatmosfera", frame: "#2a2c2e", wall: "#ecebe6", buildingHex: "#8a5a44", fascia: false, text: "", span: [0.6, 4.9], bays: "W", grid: [3, 2], heightM: 3.3 },
    "eetcafe-koevoet-72933": { name: "Koevoet", frame: "#1d1d1f", doorHex: "#1d1d1f", wall: "#ece6d6", plinth: "#ece6d6", fascia: false, text: "", span: [0.9, 5.1], bays: "W:1.4 B:0.1 D:0.8 B:0.1 W:1.0 d:0.8", grid: [2, 3], sign: "lamp", signAt: "left", plants: true, heightM: 4 },
    "eetcafe-t-pakhuis-75883": { name: "'t Pakhuis", frame: "#2a2a28", wall: "#2a2a28", fascia: false, text: "", span: [0.8, 9.4], bays: "d:1.1 W W W", grid: [2, 1], awning: "striped", awningHex: "#1f1f1f", awningHex2: "#e8e4dc", sign: "lamp", signAt: "left", heightM: 4.4 },
    "eetcafe-van-beeren-82699": { name: "Van Beeren", frame: "#1f2a24", wall: "#7a5a48", plinth: "#8a8480", pilaster: "#8a8480", fascia: false, text: "", span: [0.4, 7.4], bays: "W:2.3 B:0.3 P:0.9 B:0.3 W:2.9 B", grid: [3, 2], signs: [{ text: "EETCAFE VAN BEEREN", x: [4.6, 7], z: [3.6, 3.85], letters: "#e8e2d4", board: "#1f2a24" }], awning: "flat", awningHex: "#2a2c2e", awningOver: [0, 0], heightM: 4.3 },
    // Sheet 08.
    "eggs-benaddicted-72390": { name: "Eggs Benaddicted", frame: "#2a2c2e", wall: "#e8e2d4", fascia: false, text: "", span: [4.4, 8.8], bays: "W", grid: [2, 1], awning: "canopy", awningHex: "#e8e4dc", terrace: true, heightM: 3.6 },
    "el-torado-grill-68110": { name: "El Torado", frame: "#1d1d1f", doorHex: "#1d1d1f", wall: "#1d1d1f", fascia: "#1d1d1f", fasciaH: 0.6, text: "ARGENTINA EL TORADO GRILL", letters: "#d8d4cc", span: [0, 5.5], bays: "W D:0.9 W D:0.9 W", grid: [1, 2], banner: { hex: "#b8282a", text: "GRILL STEAKHOUSE", letters: "#f2efe8" }, heightM: 4.6 },
    "ethiopisch-restaurant-addis-ababa-66610": null,
    "fabian-78620": { name: "Fabian", frame: "#ecebe6", wall: "#3a3c40", fascia: "#3a3c40", fasciaH: 0.6, text: "STEAKHOUSE", letters: "#ece6d6", sign: "round", signHex: "#c8282a", span: [0.9, 5], bays: "B:0.4 W:2.4 B:0.2 d:0.6 B", heightM: 4 },
    "feduzzi-85026": { name: "Feduzzi", frame: "#4a2a1c", wall: "#5a3a2c", fascia: false, text: "", span: [0, 9.2], bays: "W:4.4 B:0.4 D:0.9 W", grid: [3, 1], glass: "#5a4a38", awning: "flat", awningHex: "#9a1f22", awningText: { text: "", letters: "#f2efe8" }, awningSegments: [{ x: [0.2, 4.6], text: "ITALIAANSE DELICATESSEN" }, { x: [4.8, 9.2], text: "TRAITEUR" }], signs: [{ text: "FEDUZZI", x: [2.5, 4.9], z: [4.7, 5.2], letters: "#d8d4cc" }], heightM: 4.2 },
    "fiaschetteria-pistoia-59698": { name: "Fiaschetteria Pistoia", frame: "#ecebe6", doorHex: "#ecebe6", wall: "#ecebe6", fascia: false, text: "", span: [0, 4.4], bays: "B:0.6 d:1.1 B:0.2 W", transom: true, grid: [3, 3], sign: "lamp", signAt: "left", heightM: 4 },
    "fiaschetteria-pistoia-73112": { name: "Fiaschetteria Pistoia", frame: "#1d1d1f", wall: "#d8d8d4", buildingHex: "#d8d8d4", fascia: false, text: "", span: [1.9, 8], bays: "W", grid: [2, 1], rollers: "#4a4a48", heightM: 4 },
    "fiko-80855": null,
    "flore-68170": { name: "Flore", frame: "#f2f0ea", wall: "#ece8de", fascia: false, text: "", span: [4.6, 16.4], bays: "W W W W W", grid: [2, 1], awning: "scalloped", awningHex: "#f2f0ea", terrace: true, plants: true, heightM: 4 },
    "florentin-st-81813": null,
    "flow-62418": { name: "Striphon", frame: "#ece6d6", doorHex: "#b8282a", wall: "#ece6d6", fascia: "#ece6d6", fasciaH: 0.5, text: "STRIPHON", letters: "#8a2a20", span: [0.9, 4.6], bays: "W:2.4 B:0.2 d:0.8", grid: [3, 2], plants: true, heightM: 4.3 },
    "fondue-fondue-53352": null,
    "food-brothers-83027": { name: "Food Brothers", frame: "#3a3d40", wall: "#7a4a38", fascia: "#3a8aa8", fasciaH: 0.45, text: "FOOD BROTHERS", letters: "#e8f0f2", span: [0.6, 4.2], bays: "d:0.6 W:1.6 B:0.2 W:0.9", heightM: 3.6 },
    "franggo-63278": null,
    "fujitora-61426": { name: "Kaze", frame: "#ecebe6", wall: "#ecebe6", doorHex: "#b8282a", fascia: "#ecebe6", fasciaH: 0.5, text: "KAZE RAMEN HOUSE", textAt: [1.4, 4.4], letters: "#2a2420", pattern: { kind: "tiles", a: "#ecebe6", b: "#c8282a", on: "fascia" }, span: [0.3, 5.5], bays: "W W:1.6 W d:0.6", grid: [1, 2], heightM: 3.8 },
    "fuku-ramen-63449": { name: "Fuku Ramen", frame: "#ecebe6", wall: "#9a5a44", plinth: "#c8c4bc", fascia: "#ecebe6", fasciaH: 0.3, text: "", span: [3.5, 5.9], bays: "W", signs: [{ text: "FUKU", x: [4, 5.2], z: [1.8, 2.2], letters: "#d8a040" }], heightM: 3.6 },
    // Sheet 09.
    "full-moon-garden-74474": { name: "Full Moon Garden", frame: "#3a3634", wall: "#d8d4cc", fascia: "#3a3634", fasciaH: 0.6, text: "FULL MOON GARDEN", letters: "#e8f0f2", span: [0.4, 2.8], bays: "D:0.9 W", sign: "round", signHex: "#e8e4dc", signAt: "right", heightM: 4.6 },
    "gaja-korean-bbq-bar-67636": { name: "Gaja", frame: "#2a2c2e", wall: "#c8bfa8", buildingHex: "#c8bfa8", fascia: false, text: "", span: [2.2, 6.7], bays: "W W W", grid: [1, 3], heightM: 5.4 },
    "gartine-75728": null,
    "gebr-hartering-82661": { name: "Gebr. Hartering", frame: "#ecebe6", doorHex: "#2a2c2e", wall: "#ecebe6", fascia: "#ecebe6", fasciaH: 0.3, text: "", span: [0.3, 6.1], bays: "W:1.4 B:0.2 d:0.8 B:0.2 W:1.8 B:0.3 d:0.7", transom: true, signs: [{ text: "TAKE AWAY", x: [0.6, 1.6], z: [2, 2.3], letters: "#f2efe8" }], heightM: 4 },
    "golden-thali-50442": { name: "Golden Thali", frame: "#ecebe6", wall: "#ecebe6", pilaster: "#ecebe6", buildingHex: "#c8805a", fascia: "#e8e2cc", fasciaH: 0.25, text: "", span: [0, 8], bays: "W:4.2 P:0.9 W", transom: true, heightM: 3.9 },
    "grieks-restaurant-plato-38635": { name: "Plato", frame: "#d8d8d4", wall: "#d8d8d4", fascia: "#ecebe6", fasciaH: 0.6, text: "PLATO", letters: "#2a5a9a", span: [5, 11], bays: "W W W", grid: [2, 2], awning: "canopy", awningHex: "#ecebe6", heightM: 4.6 },
    "hakata-senpachi-00201": { name: "Hakata Senpachi", frame: "#ecebe6", doorHex: "#2a2c2e", wall: "#ecebe6", fascia: "#2a2c2e", fasciaH: 0.25, text: "", span: [1.2, 9.2], bays: "W:1.7 B:0.4 W:3.6 B:0.4 D:1.5", grid: [3, 1], glass: "#5a4a38", awning: "canopy", awningHex: "#3a4a3a", heightM: 3.7 },
    "hannekes-boom-38899": null,
    "hanoi-old-quarter-restaurant-65114": null,
    "hans-im-gluck-51814": { name: "Hans im Gl\xFCck", frame: "#1f2a24", wall: "#1f2a24", fascia: "#1f2a24", fasciaH: 0.4, text: "", span: [0, 8.4], bays: "W W W W W", windows: "arched", glass: "#4a3a30", terrace: true, heightM: 3.6 },
    "hap-hmm-63575": null,
    "hap-li-90676": { name: "Hap Li", frame: "#ecebe6", wall: "#c8c4bc", fascia: "#c8c4bc", fasciaH: 0.3, text: "", span: [2.9, 6.8], bays: "W", grid: [2, 1], glass: "#5a4a38", sign: "square", signHex: "#e8e6e0", signAt: "left", heightM: 3.4 },
    "harmani-63659": { name: "Harmani", frame: "#2a2c2e", doorHex: "#2a2c2e", wall: "#2a2c2e", pilaster: "#5a5c5e", fascia: "#2a2c2e", fasciaH: 0.4, text: "", span: [3.3, 10.1], bays: "P:0.3 W:1.3 P:0.3 W:1.4 P:0.3 D:0.9 P:0.3 W:1.5 P:0.3", grid: [1, 2], heightM: 4 },
    "havzan-37053": { name: "Havzan", frame: "#ecebe6", wall: "#2a2c2e", fascia: "#2a2c2e", fasciaH: 0.7, text: "CAFE    ETLIEK", letters: "#ecebe6", logo: { hex: "#b8282a", ring: "#7a1a1a" }, span: [0, 7], bays: "W W W W", grid: [2, 2], heightM: 6 },
    "hawaiian-poke-bowl-37272": null,
    "hayran-61341": { name: "Hayran", frame: "#6a6c6a", wall: "#7a4a38", pilaster: "#8a8480", fascia: false, text: "", span: [0, 7.6], bays: "W P:0.4 W P:0.4 W", grid: [2, 1], awning: "flat", awningHex: "#3f4a32", awningSegments: [{ x: [0, 2.3] }, { x: [2.7, 5] }, { x: [5.4, 7.6] }], heightM: 4.8 },
    // Sheet 10.
    "hinata-72121": null,
    "hoi-tin-77906": { name: "Hoi Tin", frame: "#5a1f1a", doorHex: "#ecebe6", wall: "#4a2a20", plinth: "#b8282a", buildingHex: "#d8ccb0", fascia: "#5a1f1a", fasciaH: 0.5, text: "HOI TIN", letters: "#e8c040", span: [2.6, 10.1], bays: "B:0.3 W:2.2 B:0.4 d:1.0 B:0.4 W:2.2 B", grid: [2, 2], awning: "tiled", awningHex: "#b8602a", sign: "lamp", signAt: "left", heightM: 4.5 },
    "hummus-bistro-d-a-73434": { name: "Hummus d'A", frame: "#3a3634", wall: "#3a3634", fascia: "#3a3634", fasciaH: 0.4, text: "HUMMUS BISTRO", letters: "#d8c8a8", span: [0.3, 3.6], bays: "W D:0.8", glass: "#5a4a38", awning: "flat", awningHex: "#3a3634", heightM: 3.8 },
    "hunkar-restaurant-16023": { name: "Hunkar", frame: "#2a2c2e", wall: "#2a2c2e", fascia: false, text: "", span: [0, 9.2], bays: "W W W D:1.2 W W", grid: [2, 1], signs: [{ text: "HUNKAR RESTAURANT", x: [2.9, 7.2], z: [3.9, 4.3], letters: "#e8e6e0", board: "#b8282a" }], awning: "canopy", awningHex: "#3a3d40", terrace: true, plants: true, heightM: 3.6 },
    "ibericus-amsterdam-79660": { name: "Ibericus", frame: "#a0602a", wall: "#a0602a", fascia: "#e8e6e0", fasciaH: 0.7, text: "IBERICUS", letters: "#2a2c2e", span: [7.9, 12.3], bays: "P:0.4 W P:0.4", transom: true, heightM: 5 },
    "il-delfino-blu-36816": null,
    "il-primo-68332": { name: "Il Primo", frame: "#ecebe6", doorHex: "#2a2c2e", wall: "#ecebe6", buildingHex: "#4a3a34", fascia: false, text: "", span: [4.9, 16.5], bays: "d:0.8 B:0.5 C:1.8 B:0.4 W:1.0 d:0.8 B:0.5 W W:1.2 d:0.6 B", awning: "flat", awningHex: "#ecebe6", awningText: { text: "PIZZERIA   IL PRIMO", letters: "#2a2c2e" }, signs: [{ text: "IL PRIMO PIZZERIA RISTORANTE", x: [6.5, 13], z: [4.1, 4.6], letters: "#e8e6e0" }], heightM: 4 },
    "il-sogno-08857": null,
    "il-tramezzino-68426": { name: "Il Tramezzino", frame: "#4a2a1c", wall: "#4a2a1c", fascia: "#5a3020", fasciaH: 0.7, text: "IL TRAMEZZINO", letters: "#e8e2d4", span: [0, 4.3], bays: "W:2.9 D:0.9", glass: "#6a5438", heightM: 4.6 },
    "impero-romano-52924": { name: "Impero Romano", frame: "#2a2420", doorHex: "#2a2420", wall: "#ecebe6", fascia: "#2a2420", fasciaH: 0.35, text: "IMPERO ROMANO", textAt: [5, 7.5], letters: "#d8c8a0", span: [0, 8.9], bays: "W W W B:0.6 C:1.8 B", grid: [2, 2], terrace: true, heightM: 4.6 },
    "incanto-79461": null,
    "indrapura-78846": { name: "Indrapura", frame: "#1d1d1f", wall: "#1d1d1f", fascia: "#1f4d3a", fasciaH: 0.9, text: "RESTAURANT INDRAPURA", letters: "#e8e2d4", span: [0, 8.7], bays: "W W W W W", grid: [1, 2], transom: true, glass: "#d8d0c0", heightM: 5 },
    "insieme-71619": { name: "Insieme", frame: "#ecebe6", wall: "#7a4a38", fascia: false, text: "", span: [6.9, 12.4], bays: "W:2.4 W:1.2 d:0.6 W", transom: true, grid: [3, 1], signs: [{ text: "INSIEME", x: [7.6, 10.6], z: [4, 4.5], letters: "#ecebe6" }], awning: "canopy", awningHex: "#2a2c2e", heightM: 3.8 },
    "instock-amsterdam-69762": null,
    "isshin-59354": { name: "Isshin", frame: "#ecebe6", wall: "#ecebe6", plinth: "#2a2c2e", fascia: "#ecebe6", fasciaH: 0.3, text: "", span: [0, 4.8], bays: "d:0.7 B:0.6 W:2.6 B", signs: [{ text: "ISSHIN", x: [2.2, 3.2], z: [1.8, 2.2], letters: "#2a2c2e" }], sign: "square", signHex: "#ecebe6", signAt: "right", heightM: 3.5 },
    "italia-oggi-71755": { name: "Italia Oggi", frame: "#1d1d1f", doorHex: "#1d1d1f", wall: "#ecebe6", pilaster: "#ecebe6", fascia: "#ecebe6", fasciaH: 0.5, text: "", span: [0.8, 5.5], bays: "d:0.6 P:0.2 W:2.3 P:0.2 d:0.6", windows: "arched", signs: [{ text: "RISTORANTE", x: [1.7, 3.3], z: [2.4, 2.7], letters: "#d8d4cc" }], plants: true, heightM: 4.6 },
    // Sheet 11.
    "jen-s-bing-81194": { name: "Jen's Bing", frame: "#ece6d6", doorHex: "#ece6d6", wall: "#ece6d6", fascia: false, text: "", span: [0.6, 4.2], bays: "W:2.3 B:0.2 d:0.7 B", glass: "#6a5438", awning: "flat", awningHex: "#c8c4b8", heightM: 3.9 },
    "jinso-07340": { name: "Jinso", frame: "#2a2c2e", wall: "#2a2c2e", fascia: false, text: "", span: [0, 8.9], bays: "W W W W W W", grid: [2, 2], terrace: true, heightM: 4.4, facade: { outline: [[0, 6.5], [8.9, 6.5]], hex: "#3a3c40", windows: [{ xs: [1.5, 4.45, 7.4], rows: [[4.6, 6.2]], w: 2.6, frameHex: "#2a2c2e" }] } },
    "joselito-tapas-79619": { name: "Joselito", frame: "#1f2a24", wall: "#1f2a24", fascia: "#1f2a24", fasciaH: 0.4, text: "", span: [1, 4.8], bays: "W D:0.9 W", grid: [2, 2], signs: [{ text: "JOSELITO", x: [1.8, 3.4], z: [2.2, 2.6], letters: "#d8d4cc" }], plants: true, heightM: 3.8 },
    "jun-93249": { name: "Jun", frame: "#5a2a1c", doorHex: "#5a2a1c", wall: "#5a2a1c", fascia: "#ecebe6", fasciaH: 0.2, text: "", span: [1.9, 5.7], bays: "d:0.6 W W:1.6", transom: true, glass: "#5a4a38", heightM: 3.6 },
    "kaagman-kortekaas-69080": null,
    "kafe-kontrast-36508": { name: "Things I Like", frame: "#1d1d1f", wall: "#1d1d1f", fascia: "#1d1d1f", fasciaH: 0.7, text: "THINGS I LIKE THINGS I LOVE", letters: "#d8d4cc", span: [7.6, 13.8], bays: "W D:1.0 W", terrace: true, heightM: 4.4 },
    "kamasutra-78550": { name: "Kamasutra", frame: "#2a2c2e", wall: "#3a3634", fascia: false, text: "", span: [2.7, 4.9], bays: "W", sign: "square", signHex: "#c8282a", signAt: "left", heightM: 3.6 },
    "kathmandu-kitchen-15728": { name: "Intisari", frame: "#ecebe6", doorHex: "#ecebe6", wall: "#2a2c2e", fascia: "#2a2c2e", fasciaH: 0.5, text: "INTISARI", letters: "#e88a2a", span: [0, 2.8], bays: "C:1.6 W", heightM: 4.2 },
    "kebaphan-69641": { name: "Kebaphan", frame: "#1f4d3a", wall: "#2a2c2e", fascia: "#1f4d3a", fasciaH: 0.7, text: "KEBAPHAN", letters: "#f2efe8", span: [0, 5.4], bays: "W D:1.0 W", heightM: 3.9 },
    "kebec-corner-13694": null,
    "kerkzicht-29775": { name: "Kerkzicht", frame: "#2a2420", doorHex: "#e8e2d4", wall: "#8a4a3a", plinth: "#e8e4dc", fascia: false, text: "", span: [0, 8.2], bays: "B:0.8 W:1.0 B:0.4 W:1.0 B:0.9 C:1.2 B:0.6 W:1.1 B", rollers: "#2f4a38", awning: "scalloped", awningHex: "#ece6d6", terrace: true, heightM: 4.3, facade: { outline: [[0, 4.3], [8.2, 4.3]], hex: "#8a4a3a", topM: 4.3, slabs: [{ outline: [[0, 4.3], [2.6, 5.6], [5.9, 5.6], [8.2, 4.5], [8.2, 4.3]], hex: "#4a2e2c", out0: -1.2, out1: -0.8 }, { outline: [[2.6, 4.3], [2.6, 6.6], [4.25, 7.1], [5.9, 6.6], [5.9, 4.3]], hex: "#8a4a3a", out0: -0.6, out1: -0.2 }], windows: [{ xs: [3.6, 4.85], rows: [[5, 6]], w: 0.45, frameHex: "#e8e2d4" }] } },
    "kilimanjaro-37317": { name: "Kilimanjaro", frame: "#ecebe6", wall: "#ecebe6", plinth: "#e3c020", fascia: "#ecebe6", fasciaH: 0.5, text: "KILIMANJARO", letters: "#2a5aa8", span: [0, 4.3], bays: "W D:0.8", heightM: 3.6 },
    "kim-s-so-18480": { name: "Kim's So", frame: "#2a2c2e", wall: "#7a4a3c", fascia: false, text: "", span: [8.7, 26.2], bays: "W:2.6 B:0.7 W:2.6 B:0.8 W:2.6 B:0.8 W:2.6 B:0.8 W:2.6 B", grid: [2, 1], awning: "box", awningHex: "#1d1d1f", awningText: { text: "", letters: "#d8d4cc" }, awningSegments: [{ x: [8.7, 11.3], text: "BAKKERIJ" }, { x: [12, 14.6], text: "ONTBIJT LUNCH" }, { x: [15.4, 18], text: "COFFEE BEER WINE" }, { x: [18.8, 21.4], text: "BAKERY" }, { x: [22.2, 24.8], text: "BREAKFAST" }], heightM: 3.6 },
    "klein-breda-78942": { name: "Klein Breda", frame: "#1f2a2a", wall: "#1f2a2a", buildingHex: "#8a5a44", fascia: false, text: "", span: [0, 4.1], bays: "W W", grid: [3, 4], terrace: true, heightM: 6.2 },
    "koeah-75819": { name: "Koeah", frame: "#2a2c2e", wall: "#8a8480", buildingHex: "#8a5a44", fascia: false, text: "", span: [16.5, 21.9], bays: "W:1.4 B:0.4 D:0.9 B:0.4 W", grid: [2, 1], heightM: 4.6 },
    "kokohili-01213": { name: "Kokohili", frame: "#b8282a", wall: "#ecebe6", fascia: "#ecebe6", fasciaH: 0.5, text: "JAP. TEPPAN YAKI GRILL HOT POT  RESTAURANT KOKOHILI", letters: "#2a2c2e", span: [0.4, 12.2], bays: "W W W W W W B:0.3 D:1.0 B", grid: [2, 1], awning: "dutch", awningHex: "#9a2a3a", awningOver: [7, 7], heightM: 4.1 },
    // Sheet 12.
    "kreeftenbar-12628": { name: "Kreeftenbar", frame: "#2a2c2e", wall: "#8a6a5a", fascia: "#b85a8a", fasciaH: 0.6, text: "KREEFTENBAR", letters: "#f2efe8", span: [3.2, 12.8], bays: "W P:0.6 W W", grid: [2, 1], banner: { hex: "#5a3a7a" }, heightM: 4.2 },
    "kruabuppha-87294": { name: "Kruabuppha", frame: "#2a2c2e", wall: "#ecebe6", fascia: "#2a2c2e", fasciaH: 0.45, text: "THAIS RESTAURANT", textAt: [3.3, 7.1], letters: "#e8e2d4", span: [2.5, 7.1], bays: "D:0.9 W", grid: [2, 1], heightM: 4.6 },
    "kyo-82963": { name: "Kyo", frame: "#6b1f22", doorHex: "#6b1f22", wall: "#ece6d6", pilaster: "#ece6d6", fascia: "#ece6d6", fasciaH: 0.2, text: "", span: [0, 4.9], bays: "W:1.3 P:0.3 C:1.4 P:0.3 d:0.9", transom: true, heightM: 4 },
    "la-brasa-67816": null,
    "la-bruschetta-87323": null,
    "la-cacerola-71888": { name: "La Cacerola", frame: "#1d1d1f", wall: "#7a4a38", fascia: false, text: "", span: [0, 4.8], bays: "d:0.7 B:0.3 W:1.2 B:0.6 W:1.2 B", grid: [3, 3], plants: true, heightM: 4.4 },
    "la-cantina-79571": null,
    "la-fucina-81789": { name: "La Fucina", frame: "#3a3d40", wall: "#3a3d40", fascia: "#3a3d40", fasciaH: 0.45, text: "LA FUCINA", letters: "#d8d4cc", span: [0.2, 5.6], bays: "W:3.1 D:0.8 W:0.6 d:0.7", terrace: true, heightM: 3.7 },
    "la-maschera-68857": { name: "La Maschera", frame: "#2a2a28", wall: "#3a3a3a", fascia: false, text: "", span: [0, 3.3], bays: "W:1.8 D:0.9 B", grid: [2, 2], glass: "#5a4a38", heightM: 3.4 },
    "la-oliva-pintxos-y-vinos-72953": { name: "La Oliva", frame: "#1d1d1f", doorHex: "#1d1d1f", wall: "#2a2c2e", pilaster: "#e8e2d4", fascia: false, text: "", span: [9, 13.1], bays: "P:0.3 W P:0.3 B", grid: [2, 3], sign: "square", signHex: "#1f5a32", signAt: "left", heightM: 3.6 },
    "la-paella-78816": { name: "La Paella", frame: "#e8e2d4", wall: "#2a2c2e", fascia: "#2a2c2e", fasciaH: 0.4, text: "", span: [0.6, 4], bays: "W:1.0 W:1.0 B:0.3 d:0.6", signs: [{ text: "LA PAELLA", x: [1, 2.6], z: [2.1, 2.5], letters: "#d8a030" }], heightM: 3.5 },
    "la-perla-72878": { name: "La Perla", frame: "#3d4652", doorHex: "#3d4652", wall: "#3d4652", fascia: "#3d4652", fasciaH: 0.4, text: "", span: [0.6, 8.4], bays: "W:2.9 B:0.3 d:0.8 C:1.4 B:0.3 W:1.6", grid: [3, 2], awning: "scalloped", awningHex: "#8a8070", awningOver: [0, 0], plants: true, heightM: 4 },
    "la-piazza-65128": { name: "La Piazza", frame: "#2a2420", wall: "#8a8078", pilaster: "#8a8078", fascia: false, text: "", span: [0, 7.5], bays: "W:5.4 P:1.2 B", grid: [2, 2], glass: "#5a4a38", signs: [{ text: "PIZZERIA LA PIAZZA", x: [0.5, 5.4], z: [5, 5.5], letters: "#e84a3a" }, { text: "CAFE VINO", x: [1.5, 5], z: [4.1, 4.4], letters: "#d8d4cc", board: "#6a1f1a" }], heightM: 6.4 },
    "la-polpetta-31526": { name: "La Polpetta", frame: "#2a2c2e", wall: "#2a2c2e", fascia: "#2a2c2e", fasciaH: 0.5, text: "LA POLPETTA", letters: "#e8e6e0", logo: { hex: "#c8282a" }, span: [0.9, 6.2], bays: "W D:0.9 W", heightM: 3.4 },
    "la-reinita-empanadas-73572": null,
    "la-roma-81243": { name: "La Roma", frame: "#ecebe6", doorHex: "#2a2c2e", wall: "#8a8a86", plinth: "#ecebe6", fascia: "#ecebe6", fasciaH: 0.6, text: "", span: [0.2, 4.8], bays: "d:0.8 B:0.3 W:2.4 B:0.2 d:0.6", signs: [{ text: "TAKE AWAY AFHALEN", x: [1.9, 3.6], z: [1.9, 2.3], letters: "#c8282a", board: "#ecebe6" }], heightM: 4 },
    // Sheet 13.
    "la-ruelle-54949": { name: "La Ruelle", frame: "#2a2c2e", doorHex: "#2a2c2e", wall: "#ece6d6", buildingHex: "#7a4a38", fascia: "#ece6d6", fasciaH: 0.5, text: "O'TOOLE", textH: 0.18, letters: "#6a6a66", span: [0.3, 4.8], bays: "W C:1.2 W", grid: [3, 3], plants: true, heightM: 4.6 },
    "ladybird-fried-chicken-54143": { name: "Caf\xE9 Krull", frame: "#7a2a1c", wall: "#e8e2cc", buildingHex: "#e8e2cc", fascia: false, text: "", span: [2, 10.6], bays: "W W W", grid: [1, 2], signs: [{ text: "CAFE KRULL", x: [4, 7.6], z: [3, 3.8], letters: "#e8e6e0" }], awning: "flat", awningHex: "#e8e6e0", terrace: true, heightM: 5 },
    "le-4-stagioni-57247": null,
    "le-sud-76570": null,
    "lemoene-33308": null,
    "leonardo-s-ravioli-bar-59331": { name: "Leonardo's", frame: "#1d1d1f", wall: "#1d1d1f", fascia: "#1d1d1f", fasciaH: 0.3, text: "", span: [2.7, 10.7], bays: "B:1.3 W B:0.9", rollers: "#c8ccd0", graffiti: ["#e8a030", "#1d1d1f", "#f2efe8", "#d87820"], heightM: 3.6 },
    "les-zazous-79884": null,
    "leziz-71219": { name: "Leziz", frame: "#2a2c2e", wall: "#e8e6e0", fascia: "#e8e6e0", fasciaH: 0.6, text: "LEZIZ RESTAURANT", letters: "#2a2c2e", span: [18.4, 24.8], bays: "W", grid: [4, 1], glass: "#3a3a5a", plants: true, heightM: 4 },
    "little-chinatown-asian-cuisine-19312": null,
    "little-saigon-68107": { name: "Little Saigon", frame: "#1d1d1f", wall: "#a8acb0", buildingHex: "#a8acb0", fascia: false, text: "", span: [0.3, 5], bays: "W:2.4 C:0.9 B:0.2 d:0.8 B", grid: [3, 2], signs: [{ text: "LITTLE SAIGON", x: [0.5, 3], z: [4.1, 4.9], letters: "#5a2a1c", board: "#e8e4dc" }], heightM: 4.6 },
    "lloyd-hotel-18149": null,
    "lokaal-van-de-stad-40908": { name: "Lokaal van de Stad", frame: "#3a2a22", wall: "#6a3a2a", fascia: false, text: "", span: [0.6, 11.7], bays: "d:0.6 W W:1.2 B:0.3 W W W W", grid: [2, 1], awning: "flat", awningHex: "#3a4a32", awningSegments: [{ x: [0.6, 5.6] }, { x: [5.9, 11.7] }], terrace: true, plants: true, heightM: 3.8 },
    "lombardo-s-77099": { name: "Lombardo's", frame: "#2a2c2e", wall: "#2a2c2e", fascia: false, text: "", span: [4.3, 7.9], bays: "W", grid: [2, 2], awning: "flat", awningHex: "#1d1d1f", awningText: { text: "STACH", letters: "#f2efe8" }, heightM: 4 },
    "long-pura-70087": { name: "Long Pura", frame: "#2a2c2e", doorHex: "#7a2a20", wall: "#2a2c2e", fascia: "#2a2c2e", fasciaH: 0.8, text: "LONG PURA", letters: "#d8a030", text2: "RESTAURANT", span: [0, 4.1], bays: "W:2.2 B:0.3 d:0.8 B", glass: "#5a4a38", heightM: 4.4 },
    "loulou-pizzabar-57281": { name: "Loulou", frame: "#1d1d1f", doorHex: "#1d1d1f", wall: "#6a3a2a", fascia: false, text: "", span: [3, 17.5], bays: "B:0.9 C:1.8 B:4.4 W:1.7 B:0.5 W:1.7 B", windows: "arched", glass: "#3a3434", plants: true, heightM: 3.6 },
    "lucca-due-80345": { name: "Lucca Due", frame: "#4a1a14", doorHex: "#4a1a14", wall: "#4a1a14", fascia: "#4a1a14", fasciaH: 0.4, text: "", span: [0.3, 6.6], bays: "P:0.3 d:0.8 W W P:0.3 d:0.8", transom: true, glass: "#5a4a38", lanterns: true, heightM: 4.3 },
    // Sheet 14.
    "lucius-75671": { name: "Lucius", frame: "#1f2a2a", wall: "#1f2a2a", fascia: "#1f2a2a", fasciaH: 0.3, text: "", span: [0.8, 5.6], bays: "W D:0.9 W", grid: [2, 2], heightM: 3.6 },
    "lucky-house-73005": { name: "Lucky House", frame: "#ece6d6", doorHex: "#1f3a2a", wall: "#ece6d6", buildingHex: "#3a3634", fascia: "#ece6d6", fasciaH: 0.4, text: "", span: [0.2, 4.5], bays: "d:0.8 B:0.2 W:2.2 B:0.2 d:0.6", grid: [4, 3], heightM: 3.8 },
    "luna-73311": { name: "Luna", frame: "#6b1f22", doorHex: "#6b1f22", wall: "#5a2a24", fascia: "#3a2a22", fasciaH: 0.5, text: "LUNA", textH: 0.2, letters: "#d8d4cc", span: [0.6, 4], bays: "W:1.8 D:0.8 B", grid: [2, 2], sign: "round", signHex: "#2f7a3a", signAt: "right", heightM: 3.9 },
    "lupe-72083": { name: "Lupe", frame: "#e8e2cc", wall: "#2a2c2e", fascia: false, text: "", span: [0.5, 8.2], bays: "W:3.0 W:0.9 D:0.8 W W", grid: [2, 2], awning: "flat", awningHex: "#2a2c2e", awningText: { text: "EETCAFE LANDLUST", letters: "#d8d4cc" }, terrace: true, heightM: 3.6 },
    "made-s-warung-26789": { name: "Made's Warung", frame: "#9a5a22", doorHex: "#9a5a22", wall: "#3a2a22", fascia: "#3a2a22", fasciaH: 0.3, text: "", span: [0.5, 5.8], bays: "W:0.8 W:3.3 D:0.9", transom: true, glass: "#5a4a38", signs: [{ text: "MADE'S WARUNG", x: [2, 3.6], z: [2.2, 2.5], letters: "#e8c040", board: "#4a2a14" }], plants: true, heightM: 4 },
    "maenaam-thai-75826": { name: "Maenaam", frame: "#ece6d6", doorHex: "#1d1d1f", wall: "#3a3634", fascia: false, text: "", span: [0.5, 5.4], bays: "d:0.8 B:0.3 C:1.8 B:0.3 W:0.8 B", heightM: 3.5, facade: { outline: [[0, 7], [6, 7]], hex: "#3a3634", windows: [{ xs: [1, 2.6, 4.4], rows: [[4.6, 6]], w: 0.8, frameHex: "#ece6d6" }] }, shutters: "#b8282a" },
    "makachi-64043": { name: "Mercer", frame: "#2a2c2e", wall: "#ecebe6", buildingHex: "#ecebe6", pilaster: "#ecebe6", fascia: false, text: "", span: [0, 15.7], bays: "W:3.1 P:0.9 W:6.6 P:0.8 W", awning: "flat", awningHex: "#1d1d1f", awningText: { text: "", letters: "#f2efe8" }, awningSegments: [{ x: [0, 3.1], text: "MERCER" }, { x: [4, 10.6], text: "MERCER" }, { x: [11.4, 15.7], text: "MERCER" }], heightM: 3.8 },
    "mama-makan-43487": { name: "Mama Makan", frame: "#8a8a86", wall: "#e3d8a0", pilaster: "#e3d8a0", buildingHex: "#e3d8a0", fascia: false, text: "", span: [0.6, 22.4], bays: "P:1.0 W:2.6 P:1.5 W:2.6 P:1.5 W:2.6 P:1.5 W:2.6 P:1.5 W:2.6 P:1.5 W", glass: "#4a5a58", plants: true, heightM: 3.6 },
    "mamas-tapas-63129": { name: "Viswinkel Tol", frame: "#ecebe6", wall: "#ecebe6", buildingHex: "#ecebe6", fascia: false, text: "", span: [4.6, 12], bays: "W W W", glass: "#5a4a38", awning: "flat", awningHex: "#c8282a", awningText: { text: "VISWINKEL TOL", letters: "#f2efe8" }, sign: "square", signHex: "#c8282a", signAt: "left", heightM: 3.6 },
    "mangia-pizza-centrum-75482": null,
    "mangiancora-65866": { name: "Mangiancora", frame: "#2f4a40", doorHex: "#2f4a40", wall: "#2f4a40", fascia: "#2f4a40", fasciaH: 0.4, text: "", span: [0, 4.7], bays: "W:1.1 C:1.4 W:1.1 d:0.7", transom: true, signs: [{ text: "PIZZERIA", x: [2.7, 3.7], z: [2.1, 2.35], letters: "#ecebe6" }], sign: "square", signHex: "#2f4a40", signAt: "left", heightM: 4 },
    "maris-piper-brasserie-36608": { name: "Maris Piper", frame: "#1d1d1f", wall: "#1d1d1f", fascia: false, text: "", span: [0, 10.6], bays: "W W W W W W", grid: [2, 2], glass: "#5a4a38", awning: "canopy", awningHex: "#b8b8b4", heightM: 3.1 },
    "marmaris-grill-pizza-73393": null,
    "maydanoz-56807": { name: "Maydanoz", frame: "#2a2c2e", wall: "#2a2c2e", fascia: "#2a2c2e", fasciaH: 0.6, text: "MAYDANOZ", letters: "#5fa58a", span: [0, 6.1], bays: "W:1.2 D:0.9 W W", grid: [2, 2], awning: "striped", awningHex: "#3a3a3a", awningHex2: "#d8d4cc", heightM: 4 },
    "mchi-42337": null,
    "meghna-78969": { name: "Meghna", frame: "#3a1a1a", doorHex: "#3a1a1a", wall: "#3a1a1a", fascia: false, text: "", span: [0, 2.7], bays: "W:1.9 d:0.8", signs: [{ text: "MEGHNA", x: [0.4, 1.8], z: [2.4, 2.8], letters: "#d8d4cc" }], heightM: 3.6 },
    // Sheet 15.
    "men-impossible-69882": { name: "Men Impossible", frame: "#2a2420", doorHex: "#2a2420", wall: "#2a2c2e", fascia: "#2a2c2e", fasciaH: 0.3, text: "", span: [0.2, 4.9], bays: "d:1.1 B:0.4 W:2.3 B", transom: true, glass: "#5a4a38", heightM: 3.8 },
    "merza-45331": { name: "Merza", frame: "#2a2c2e", wall: "#c8c4b8", fascia: false, text: "", span: [0, 3.9], bays: "W", awning: "flat", awningHex: "#2a3a7a", terrace: true, heightM: 3.4 },
    "mesken-56710": { name: "Twenty-Seven", frame: "#2a2420", wall: "#e8e2d4", fascia: false, text: "", span: [0, 18.9], bays: "B:3.8 W:1.4 W:1.4 W:1.4 B:1.5 W W W", grid: [1, 2], awning: "box", awningHex: "#8a1f22", awningText: { text: "STREET FOOD  TWENTY-SEVEN  BAR COCKTAILS LONGDRINKS BEERS  MILKSHAKES", letters: "#f2efe8" }, terrace: true, heightM: 4 },
    "middl-eat-67960": { name: "Middl'Eat", frame: "#ece6d6", doorHex: "#ece6d6", wall: "#ece6d6", fascia: "#ece6d6", fasciaH: 0.4, text: "MIDDL'EAT", letters: "#c8282a", span: [0, 4.1], bays: "W:2.4 d:0.8 B", awning: "flat", awningHex: "#3a4a3a", heightM: 4 },
    "miko-s-28387": null,
    "mima-09184": { name: "Mima", frame: "#2a2c2e", wall: "#8a4a3c", pilaster: "#8a4a3c", buildingHex: "#8a4a3c", fascia: false, text: "", span: [1.7, 21.3], bays: "P:0.7 W:2.4 P:1.6 W:2.4 P:1.6 W:2.4 P:1.0 W:2.4 P:0.8 W:2.4 P:0.8 W:2.4 P:0.5", grid: [3, 3], heightM: 6.3 },
    "mirchi-63270": null,
    "miri-mary-83742": { name: "Renato's", frame: "#2a3a5a", wall: "#ece6d6", pilaster: "#ece6d6", fascia: "#ece6d6", fasciaH: 0.3, text: "", span: [0, 12.6], bays: "W:2.2 B:2.2 W:1.4 P:0.6 C:1.6 P:0.9 W", grid: [1, 2], rollers: "#3a4a6a", signs: [{ text: "RENATO'S", x: [8.4, 9.9], z: [3.75, 4.05], letters: "#2a2c2e", board: "#ece6d6" }], heightM: 4.6 },
    "moak-pancakes-19677": { name: "Moak", frame: "#ecebe6", doorHex: "#ecebe6", wall: "#ecebe6", fascia: "#ecebe6", fasciaH: 0.6, text: "", span: [0.8, 5.9], bays: "d:0.8 B:0.4 W W", transom: true, heightM: 4 },
    "moche-67178": { name: "Moche", frame: "#7a3a20", doorHex: "#7a3a20", wall: "#c89a5a", fascia: false, text: "", span: [0.4, 6.5], bays: "D:1.0 B:0.5 W:2.6 B:0.4 D:1.0", windows: "arched", signs: [{ text: "WATSON", x: [2.4, 3.8], z: [1.9, 2.3], letters: "#ecebe6" }], heightM: 4 },
    "mogu-amsterdam-89620": { name: "Loving Hut", frame: "#c8b860", doorHex: "#2f7a3a", wall: "#c8b890", fascia: "#ece6d6", fasciaH: 0.4, text: "LOVING HUT", letters: "#3a7a3a", span: [0.5, 5.6], bays: "W:2.4 B:0.2 d:0.6 B:0.4 W:1.0 B", heightM: 3.6 },
    "momo-tibet-57116": { name: "Momo Tibet", frame: "#c8a040", wall: "#c8a040", fascia: false, text: "", span: [0, 5.1], bays: "d:0.7 W:2.4 B:0.3 d:0.8", signs: [{ text: "SRANANG FOOD", x: [0.4, 3.6], z: [3.75, 4.3], letters: "#e8c040", board: "#b8282a" }], heightM: 4.4 },
    "mont-blanc-66374": { name: "Mont Blanc", frame: "#2a2c2e", wall: "#2a2c2e", pilaster: "#e8e2cc", fascia: "#e8e2cc", fasciaH: 0.3, text: "", span: [0.8, 5.6], bays: "P:0.3 W P:0.3 W P:0.3 W P:0.3", grid: [2, 2], heightM: 3.5 },
    "moon-68473": null,
    "moshik-06274": { name: "&samhoud", frame: "#a89a80", wall: "#4a4440", fascia: false, text: "&SAMHOUD", textAt: [10.5, 13.6], letters: "#f2f0ea", logo: { hex: "#2a5a9a" }, span: [0, 20.2], bays: "W:3.8 B:0.8 W:2.4 W:2.4 B:1.0 D:2.0 W:1.6 B:0.9 W W", grid: [1, 1], heightM: 4.6 },
    "mount-everest-05308": { name: "Hira", frame: "#6a6c6e", wall: "#ecebe6", buildingHex: "#8a5a44", fascia: "#e89a4a", fasciaH: 0.8, text: "HIRA", textAt: [12.1, 16.6], letters: "#c8282a", span: [11.8, 17], bays: "W D:1.3 W", heightM: 4.6 },
    // Sheet 16.
    "mr-gyoza-61236": { name: "Mr Gyoza", frame: "#ece6d6", wall: "#7a4a38", fascia: false, text: "", span: [8, 12.9], bays: "W", grid: [3, 2], transom: true, heightM: 4.1 },
    "mr-sushi-54293": { name: "Mr. Sushi", frame: "#1d1d1f", wall: "#1d1d1f", fascia: "#1d1d1f", fasciaH: 0.5, text: "MR. SUSHI", letters: "#f2efe8", span: [0, 4.5], bays: "W D:0.9 W", glass: "#3a2a2a", heightM: 3.6 },
    "muang-thai-66837": { name: "Muang Thai", frame: "#d8ccb0", wall: "#ecebe6", buildingHex: "#ecebe6", fascia: false, text: "", span: [0.3, 8.1], bays: "B:0.9 W:2.6 B:1.3 W:2.6 B", windows: "arched", grid: [2, 2], heightM: 5.4 },
    "mudavim-58188": null,
    "my-surinaamse-broodjes-36700": { name: "Surinaamse", frame: "#c8ccd0", wall: "#c8ccd0", fascia: "#2f8a4a", fasciaH: 1.2, text: "SURINAAMSE", letters: "#f2f0ea", span: [0, 4], bays: "W", rollers: "#c8ccd0", plants: true, heightM: 4.3 },
    "mythos-69645": { name: "Mythos", frame: "#ecebe6", doorHex: "#ecebe6", wall: "#ecebe6", fascia: "#ecebe6", fasciaH: 0.3, text: "MYTHOS", textH: 0.2, letters: "#2a5aa8", span: [1, 4], bays: "d:0.9 B:0.2 W", grid: [2, 2], sign: "round", signHex: "#2a4a8a", signAt: "right", heightM: 3.4 },
    "naa-thai-63810": { name: "Naa Thai", frame: "#e8e6e0", wall: "#e8e6e0", fascia: "#e8e6e0", fasciaH: 0.5, text: "", span: [6.9, 12], bays: "W", rollers: "#8a8c8e", awning: "flat", awningHex: "#9a2a24", heightM: 4.6 },
    "nap-amsterdam-83408": null,
    "nara-nara-81960": { name: "Nara Nara", frame: "#8fc8b0", wall: "#8fc8b0", fascia: "#ecebe6", fasciaH: 0.9, pattern: { kind: "zebra", a: "#ecebe6", b: "#1d1d1f", on: "fascia" }, text: "", span: [0, 15.5], bays: "W:2.7 P:0.6 W:6.9 B:2.1 W", grid: [2, 1], signs: [{ text: "LOCAL", x: [4, 6], z: [1.9, 2.4], letters: "#ecebe6" }], heightM: 4.6 },
    "nefis-etli-ekmek-59658": { name: "Nefis", frame: "#ecebe6", doorHex: "#ecebe6", wall: "#2a2c2e", fascia: false, text: "", span: [0, 5.2], bays: "W:1.9 C:1.4 W", grid: [2, 2], awning: "canopy", awningHex: "#9a1f2a", terrace: true, heightM: 4 },
    "nikotin-19058": { name: "Mok", frame: "#1d1d1f", wall: "#c8c4bc", pilaster: "#c8c4bc", buildingHex: "#c8c4bc", fascia: false, text: "", span: [0.6, 16.4], bays: "W:4.4 P:0.9 W:4.4 P:0.8 W", windows: "arched", grid: [5, 2], signs: [{ text: "MOK", x: [7.6, 8.8], z: [2, 2.4], letters: "#e8e6e0" }], terrace: true, heightM: 3.6, facade: { outline: [[0, 6.8], [16.4, 6.8]], hex: "#c8c4bc", windows: [{ xs: [3, 8.4, 13.7], rows: [[4.2, 6.2]], w: 4.2, frameHex: "#1d1d1f" }] } },
    "nk-thai-noodles-68178": { name: "Thai Corner", frame: "#ecebe6", doorHex: "#8a4a28", wall: "#ecebe6", fascia: false, text: "", span: [1.5, 5.9], bays: "W:3.4 D:0.9", awning: "flat", awningHex: "#ecebe6", signs: [{ text: "THAI CORNER", x: [2.2, 4], z: [1.9, 2.3], letters: "#f2efe8" }], heightM: 3.6 },
    "nnea-pizza-66802": { name: "NNea", frame: "#1f3a8a", doorHex: "#1f3a8a", wall: "#1f3a8a", fascia: "#1f3a8a", fasciaH: 0.6, text: "", span: [0.3, 4.8], bays: "W:2.6 B:0.2 W:0.6 D:0.9", signs: [{ text: "NNEA", x: [0.6, 2.2], z: [1.4, 1.9], letters: "#ecebe6" }], heightM: 4 },
    "no-man-s-art-gallery-94050": { name: "No Man's Art", frame: "#ecebe6", doorHex: "#c8282a", wall: "#ecebe6", fascia: false, text: "", span: [0.4, 5], bays: "W:1.6 D:0.8 W", transom: true, grid: [2, 1], awning: "flat", awningHex: "#c8282a", heightM: 4.6 },
    "noemi-37240": null,
    "nom-nom-vietnamese-foodshop-73355": null,
    // Sheet 17.
    "nonna-06423": { name: "Nonna", frame: "#1f2a3a", doorHex: "#1f3a5a", wall: "#1f2a3a", fascia: "#1f2a3a", fasciaH: 0.6, text: "MARE STELLA MARIA", textH: 0.2, letters: "#d8d4cc", span: [0, 12.8], bays: "W:1.8 B:0.5 W:1.8 B:0.5 W:1.8 B:0.6 C:1.4 B:0.4 W:2.4 B:0.4 d:0.6", grid: [2, 2], sign: "lamp", signAt: "right", heightM: 4 },
    "northeast-kitchen-67017": { name: "Arie", frame: "#2a2c2e", wall: "#e8e6e0", buildingHex: "#e8e6e0", fascia: false, text: "", span: [16.6, 24.1], bays: "W B:0.8 W B:0.8 W", grid: [1, 2], heightM: 4.4 },
    "nyonya-78393": { name: "Coffeeshop Goa", frame: "#1d1d1f", wall: "#1d1d1f", fascia: "#1d1d1f", fasciaH: 1.2, text: "COFFEESHOP", letters: "#e8e6e0", span: [0, 11.3], bays: "W W D:1.0 W", glass: "#2a2c2e", heightM: 5.4 },
    "o-bistro-68625": { name: "O Bistro", frame: "#ecebe6", doorHex: "#ecebe6", wall: "#ecebe6", fascia: "#2f5a3a", fasciaH: 0.3, text: "BISTRO", textH: 0.18, letters: "#d8d4cc", span: [0, 5.7], bays: "W:0.8 d:0.8 W W:1.0 B:0.3 d:0.9 B", transom: true, heightM: 3.8 },
    "o-mai-vietnamees-restaurant-78850": { name: "O'Mai", frame: "#1d1d1f", wall: "#ece6d6", buildingHex: "#ece6d6", fascia: "#ece6d6", fasciaH: 0.5, text: "", span: [0, 9], bays: "W:2.4 B:0.3 W:3.3 B:0.6 d:0.7 B", lanterns: false, sign: "lamp", signAt: "right", heightM: 4.6 },
    "o-sole-mio-68570": { name: "O Sole Mio", frame: "#ecebe6", doorHex: "#2a2c2e", wall: "#ecebe6", fascia: "#1f3a6a", fasciaH: 0.35, text: "O SOLE MIO", textH: 0.18, letters: "#ecebe6", span: [1.5, 5.3], bays: "d:0.8 W:2.0 d:0.7", transom: true, glass: "#5a4a38", heightM: 3.9 },
    "obalade-suya-55235": { name: "In t Vierde Baarsje", frame: "#2a2c2e", wall: "#6a3a2a", fascia: false, text: "", span: [0.6, 15.3], bays: "W:2.8 B:1.0 W:2.8 B:1.1 W:2.8 B:1.2 W", grid: [2, 1], signs: [{ text: "RESTAURANT", x: [0.7, 3.2], z: [3.2, 3.6], letters: "#ecebe6", board: "#2a2c2e" }, { text: "RESTAURANT", x: [4.3, 6.9], z: [3.2, 3.6], letters: "#ecebe6", board: "#2a2c2e" }, { text: "INDIAN DINNER", x: [8.2, 10.6], z: [3.2, 3.6], letters: "#1d1d1f", board: "#d8b030" }, { text: "INDIAN DINNER", x: [12.2, 14.7], z: [3.2, 3.6], letters: "#1d1d1f", board: "#d8b030" }], plants: true, heightM: 3.7 },
    "oceania-40557": { name: "Oceania", frame: "#2a2420", wall: "#2a2420", fascia: "#2a2420", fasciaH: 0.8, text: "OCEANIA", letters: "#c8602a", span: [1.3, 9.7], bays: "W W D:1.0 W W", grid: [2, 2], awning: "canopy", awningHex: "#3a3c40", awningText: { text: "OCEANIA FINE DINING SEAFOOD & WINE", letters: "#c89a40" }, plants: true, heightM: 4.6 },
    "ode-aan-de-amstel-40353": { name: "Ode aan de Amstel", frame: "#8a8478", wall: "#c8bfa8", fascia: false, text: "", span: [3.7, 19.7], bays: "W W W W W W W W", grid: [2, 1], heightM: 3.6, facade: { outline: [[0, 7], [21.6, 7]], hex: "#c8bfa8", ribs: "#b8af98", windows: [{ xs: [4.6, 6.8, 9, 11.2, 13.4, 15.6, 17.8], rows: [[5.4, 6.8]], w: 2, frameHex: "#8a8478" }] } },
    "olijfje-65616": null,
    "omahe-72216": { name: "Omahe", frame: "#2a2c2e", wall: "#e8e2d4", fascia: false, text: "", span: [2.6, 7.6], bays: "W", grid: [4, 1], awning: "flat", awningHex: "#e8e2d4", heightM: 3.6 },
    "omg-burger-79311": { name: "OMG!", frame: "#2a2c2e", doorHex: "#2a2c2e", wall: "#ece6d6", fascia: "#ece6d6", fasciaH: 0.6, text: "OMG!   OMG!", letters: "#2f8a6a", span: [0, 8.1], bays: "W:2.6 d:0.8 B:0.3 d:0.7 W", glass: "#5a4a38", terrace: true, plants: true, heightM: 4.2 },
    "ons-dorpje-21431": null,
    "oresti-s-taverna-62627": { name: "Oresti's", frame: "#ecebe6", wall: "#3a3c40", buildingHex: "#3a3c40", fascia: "#3a3c40", fasciaH: 0.4, text: "", span: [0.3, 7.8], bays: "W:1.5 W:2.1 B:0.3 W:2.1 W:1.5", windows: "arched", glass: "#5a4a38", awning: "flat", awningHex: "#9a1f22", awningText: { text: "AMSTEL BIER   ORESTI'S", letters: "#ecebe6" }, terrace: true, heightM: 4.4 },
    "oriental-city-78751": { name: "Golden Chopsticks", frame: "#2a2c2e", wall: "#ece6d6", buildingHex: "#ece6d6", fascia: "#ece6d6", fasciaH: 0.3, text: "", span: [0, 19.3], bays: "W W W W W W W W", grid: [2, 2], awning: "flat", awningHex: "#b8282a", signs: [{ text: "RESTAURANT GOLDEN CHOPSTICKS", x: [9.9, 14], z: [3.1, 3.4], letters: "#2a2c2e" }], plants: true, terrace: true, heightM: 3.7 },
    "osteria-bella-ciao-73586": null,
    // Sheet 18.
    "otaru-91498": { name: "Otaru", frame: "#e8e2d4", doorHex: "#e8e2d4", wall: "#e8e2d4", fascia: false, text: "", span: [6.2, 13], bays: "C:2.2 B:1.4 W:1.0 B:0.6 W:1.0 B", shutters: "#8a6a4a", signs: [{ text: "OTARU", x: [9.8, 12.6], z: [3.5, 3.9], letters: "#2a2c2e", board: "#ecebe6" }], heightM: 4 },
    "otemba-61722": { name: "Gerijpt", frame: "#2a2c2e", wall: "#ecebe6", pilaster: "#ecebe6", fascia: "#ecebe6", fasciaH: 0.6, text: "GERIJPT", textAt: [4.8, 7.2], textH: 0.25, letters: "#2a2c2e", span: [0.3, 12.2], bays: "P:0.3 W P:0.3 W P:0.3 W P:0.3 W P:0.3 W P:0.3", awning: "flat", awningHex: "#2a2c2e", awningSegments: [{ x: [0.6, 2.6] }, { x: [2.8, 5.2] }, { x: [5.5, 7.6] }, { x: [7.8, 9.8] }, { x: [10.1, 12] }], terrace: true, heightM: 4 },
    "otemba-ramen-36441": { name: "Otemba", frame: "#ecebe6", doorHex: "#1d1d1f", wall: "#7a4a38", fascia: "#2a2c2e", fasciaH: 0.25, text: "OTEMBA", textAt: [3, 6], textH: 0.15, letters: "#ecebe6", span: [1.2, 13.8], bays: "W:0.9 B:0.9 d:0.8 B:0.8 W:0.8 B:0.9 W:0.8 B:0.9 W:0.8 B:0.9 W:0.8 B:0.9 d:0.8 B", heightM: 3.6 },
    "pad-thai-72000": { name: "Pad Thai", frame: "#3a5a3a", wall: "#ece6d6", fascia: "#2f4a3a", fasciaH: 0.35, text: "PAD THAI", letters: "#ecebe6", span: [0.2, 2.9], bays: "W:2.0 d:0.6", banner: { hex: "#b8282a" }, heightM: 3.4 },
    "paik-s-noodle-75231": null,
    "palladio-70190": { name: "Palladio", frame: "#1d1d1f", doorHex: "#1d1d1f", wall: "#4a4c4e", fascia: false, text: "", span: [0.6, 5.4], bays: "W:2.9 B:0.3 d:0.7 B", grid: [3, 2], awning: "flat", awningHex: "#1d1d1f", lanterns: true, heightM: 3.8 },
    "paloma-blanca-60566": { name: "CoffeeRoastery", frame: "#2a2c2e", wall: "#2a2c2e", fascia: false, text: "", span: [3.2, 10], bays: "W D:1.0 W", grid: [2, 1], awning: "box", awningHex: "#1d1d1f", awningText: { text: "COFFEE ROASTERY", letters: "#ecebe6" }, plants: true, heightM: 4 },
    "pancakes-amsterdam-aan-t-ij-77894": null,
    "pannenkoekerij-gansi-87577": null,
    "papa-ali-mix-grill-82440": { name: "Papa Ali", frame: "#2a2c2e", doorHex: "#2a2c2e", wall: "#ecebe6", fascia: "#ecebe6", fasciaH: 0.7, text: "PAPA MIX GRILL", letters: "#c8282a", span: [0.4, 4.9], bays: "B:0.3 d:0.8 B:0.2 W", grid: [2, 2], terrace: true, heightM: 4.4 },
    "pasta-e-pizza-62433": { name: "Pasta e Pizza", frame: "#2f4a3a", doorHex: "#2f4a3a", wall: "#9ad8b0", buildingHex: "#9ad8b0", fascia: "#9ad8b0", fasciaH: 0.8, text: "PASTA E PIZZA", letters: "#c8282a", span: [0.9, 6], bays: "W:2.8 B:0.2 d:0.6 B:0.2 d:0.6", awning: "flat", awningHex: "#2a3a30", awningOver: [0, 0], heightM: 5 },
    "pasta-paradijs-52857": { name: "Pasta Paradijs", frame: "#2a2a2c", doorHex: "#8a3a20", wall: "#2a2a2c", fascia: "#ecebe6", fasciaH: 0.6, text: "PASTA PARADIJS", letters: "#c8282a", span: [0, 5.1], bays: "d:0.9 W:2.6 d:0.8", heightM: 3.9 },
    "pastai-60962": null,
    "pastini-72218": { name: "Pastini", frame: "#ecebe6", wall: "#ecebe6", fascia: "#2a2c2e", fasciaH: 0.5, text: "PASTINI", letters: "#d8d4cc", span: [0.4, 3.7], bays: "W", grid: [3, 3], heightM: 3.4, facade: { outline: [[0.4, 6.2], [3.7, 6.2]], hex: "#ecebe6", windows: [{ xs: [2], rows: [[4, 5.8]], w: 2.4, frameHex: "#ecebe6" }] } },
    "pata-negra-71777": { name: "Pata Negra", frame: "#4a3a1c", wall: "#c8a040", pilaster: "#c8a040", fascia: false, text: "", span: [0, 10.5], bays: "P:0.6 W P:0.4 W P:0.4 C:1.6 P:0.4 W P:0.6", grid: [2, 2], awning: "flat", awningHex: "#2a2c2e", pattern: { kind: "tiles", a: "#c8a040", b: "#9a5a2a", on: "plinth" }, terrace: true, heightM: 4.6 },
    "pepenero-64223": { name: "Pepenero", frame: "#2a2c2e", wall: "#ece6d6", fascia: false, text: "", span: [0, 7.4], bays: "W:5.2 B:0.3 d:1.0 B", windows: "big", awning: "flat", awningHex: "#2a2a2c", awningText: { text: "RISTORANTE", letters: "#ecebe6" }, awningOver: [0, 0], lanterns: true, plants: true, heightM: 3.8 },
    // Sheet 19.
    "pepenero-cucina-pizza-99914": { name: "PepeNero", frame: "#5a5c5e", wall: "#e8e2cc", buildingHex: "#e8e2cc", fascia: false, text: "", span: [1.1, 9.7], bays: "W W B:1.3 W W", grid: [2, 2], signs: [{ text: "PEPENERO", x: [4.6, 6], z: [3.3, 3.8], letters: "#f2efe8", board: "#1d1d1f" }], heightM: 4.2 },
    "peperoncino-84094": { name: "Peperoncino", frame: "#2a2c2e", wall: "#e8e6e0", fascia: false, text: "", span: [1.2, 6.8], bays: "W:3.6 B:0.4 D:0.8 B", awning: "flat", awningHex: "#b8282a", awningOver: [0, 0], signs: [{ text: "PEPERONCINO", x: [1.8, 3.7], z: [3.3, 3.6], letters: "#9a2a24", board: "#ecebe6" }], terrace: true, heightM: 4 },
    "perla-di-roma-48686": { name: "Perla di Roma", frame: "#5a2a24", wall: "#e8e2cc", buildingHex: "#8a3a2a", fascia: "#ecebe6", fasciaH: 0.6, text: "PERLA DI ROMA", textAt: [5, 12.6], letters: "#a8231c", span: [0.9, 13.6], bays: "W W D:1.2 W W W", grid: [2, 1], awning: "dutch", awningHex: "#a8231c", awningOver: [2, 3], plants: true, heightM: 4 },
    "petit-caron-73912": { name: "Petit Caron", frame: "#2a2c2e", doorHex: "#2a2c2e", wall: "#e8e6e0", fascia: "#1d1d1f", fasciaH: 0.6, text: "LE RESTAURANT", letters: "#ecebe6", span: [0, 5.3], bays: "W:2.4 W:0.6 D:0.9 B", awning: "flat", awningHex: "#b8282a", terrace: true, heightM: 4.4 },
    "pho-viet-76172": { name: "I Love Sushi", frame: "#8a3b12", wall: "#8a3b12", fascia: "#8a3b12", fasciaH: 0.5, text: "", span: [0.8, 9.4], bays: "W W D:1.1 W:1.6", transom: true, glass: "#5a4a38", awning: "scalloped", awningHex: "#8a3b12", signs: [{ text: "I LOVE SUSHI", x: [3.6, 5.1], z: [2.6, 2.9], letters: "#ecebe6" }], heightM: 4.6 },
    "pica-pica-90102": { name: "Pica Pica", frame: "#3a2a22", wall: "#3a2a22", fascia: "#1d1d1f", fasciaH: 0.4, text: "", span: [0.6, 14.4], bays: "W W W W D:1.0 W W W W", grid: [2, 2], glass: "#5a4a38", plants: true, terrace: true, heightM: 3.9 },
    "picchino-53915": null,
    "pide-dunyas-78723": { name: "Dean's Kitchen", frame: "#2a2c2e", doorHex: "#2a2c2e", wall: "#ecebe6", fascia: "#8a3a2a", fasciaH: 0.7, text: "DEAN'S KITCHEN", letters: "#ecebe6", span: [4.9, 10.8], bays: "d:0.7 B:0.4 W:3.2 B:0.4 d:0.6", heightM: 4.2 },
    "piet-de-leeuw-80082": { name: "Piet de Leeuw", frame: "#1d1d1f", doorHex: "#1d1d1f", wall: "#e8e6e0", pilaster: "#e8e6e0", buildingHex: "#3a3a3c", fascia: "#1d1d1f", fasciaH: 0.4, text: "", span: [0.5, 5.6], bays: "P:0.3 W P:0.3 d:0.8 P:0.3 W P:0.3", grid: [2, 2], glass: "#5a4a38", sign: "lamp", signAt: "left", heightM: 4 },
    "pizza-project-64561": { name: "Pizza Project", frame: "#2a2c2e", wall: "#8a5a44", fascia: false, text: "", span: [0, 9.9], bays: "W:2.6 B:2.1 W", awning: "dutch", awningHex: "#c8282a", awningSegments: [{ x: [0, 2.6] }, { x: [4.5, 9.9] }], signs: [{ text: "PIZZA PROJECT", x: [7.4, 9.9], z: [3.9, 4.4], letters: "#f2efe8" }], plants: true, heightM: 4 },
    "pizza-project-bar-69760": { name: "d&a Hummus Bistro", frame: "#2a2c2e", wall: "#3a3a36", fascia: false, text: "", span: [0, 8], bays: "W W W W", grid: [2, 1], awning: "flat", awningHex: "#a89a6a", awningText: { text: "D&A HUMMUS BISTRO", letters: "#ecebe6" }, terrace: true, heightM: 3.8 },
    "pizza-taxi-da-paolo-seba-66100": { name: "Paolo & Seba", frame: "#ece6d6", doorHex: "#7a3a20", wall: "#ece6d6", fascia: "#ece6d6", fasciaH: 0.5, text: "", span: [0, 5.3], bays: "D:0.9 B:0.2 W:2.8 B:0.2 d:0.6", transom: true, signs: [{ text: "PAOLO & SEBA", x: [2.6, 4], z: [3.5, 3.85], letters: "#ecebe6", board: "#2a2c2e" }], heightM: 4.6 },
    "pizzeria-steakhouse-ijburg-80574": null,
    "plato-loco-19305": { name: "Plato Loco", frame: "#1d1d1f", wall: "#8a8c8e", pilaster: "#8a8c8e", fascia: false, text: "", span: [1.6, 6.1], bays: "P:0.4 W P:0.4", glass: "#2a3a3a", plants: true, heightM: 3.8 },
    "proper-indofood-75795": null,
    "rainbowls-35465": { name: "Rainbowls", frame: "#2a2a2c", wall: "#e8e2d4", fascia: false, text: "", span: [6.6, 11], bays: "B:0.3 W:3.0 B", glass: "#5a4a38", awning: "flat", awningHex: "#1f1f1f", heightM: 3.8 },
    // Sheet 20.
    "ramen-city-37023": null,
    "ramen-ism-78019": { name: "Ramen-ism", frame: "#2a2c2e", wall: "#e8e2d4", pilaster: "#e8e2d4", fascia: false, text: "", span: [0.3, 5.1], bays: "P:0.3 d:0.7 P:0.3 W P:0.3 W P:0.3", transom: true, heightM: 4.6 },
    "rangla-punjab-61813": { name: "Rangla Punjab", frame: "#ece6d6", wall: "#3a3a5a", fascia: "#3a3a5a", fasciaH: 0.4, text: "RANGLA PUNJAB", letters: "#ecebe6", span: [0, 2.6], bays: "W", heightM: 3.6 },
    "rasoi-74500": { name: "Rasoi", frame: "#ece6d6", doorHex: "#7a3a24", wall: "#ece6d6", fascia: false, text: "", span: [0.5, 6.5], bays: "W:3.6 B:1.3 d:0.7 B", rollers: "#c8ccd0", awning: "flat", awningHex: "#d8d4ca", awningOver: [0, 0], heightM: 3.6 },
    "reijnders-68746": { name: "Reijnders", frame: "#4a2014", wall: "#4a2014", fascia: "#2a1410", fasciaH: 0.6, text: "", span: [0, 6.1], bays: "W:1.7 P:0.4 B:0.2 D:0.9 B:0.3 P:0.4 W", grid: [1, 2], transom: true, signs: [{ text: "CAFE", x: [0.2, 1.5], z: [4.85, 5.25], letters: "#c8282a", board: "#ecebe6" }, { text: "TAPPERIJ", x: [2.1, 3.6], z: [4.85, 5.25], letters: "#c8282a", board: "#ecebe6" }, { text: "REYNDERS", x: [4.3, 5.9], z: [4.85, 5.25], letters: "#c8282a", board: "#ecebe6" }], lanterns: true, terrace: true, heightM: 5.4 },
    "renato-s-osteria-32916": { name: "Renato's", frame: "#2a4a8a", doorHex: "#2a4a8a", wall: "#ecebe6", pilaster: "#ecebe6", fascia: "#2a4a8a", fasciaH: 0.3, text: "", span: [2, 12], bays: "W:1.6 P:0.7 W:0.8 P:0.6 C:1.6 B:0.6 W:2.0 B:0.5 d:0.8 B", grid: [2, 2], heightM: 3.6 },
    "restaurant-212-71575": null,
    "restaurant-asian-fantasy-14927": null,
    "restaurant-ja-36832": null,
    "restaurant-klaproos-35403": { name: "Uku", frame: "#2f6f7a", wall: "#2f6f7a", fascia: false, text: "", span: [0, 9.6], bays: "B:2.3 C:3.4 B", signs: [{ text: "UKU", x: [7.3, 8.6], z: [3.6, 4.4], letters: "#ecebe6", board: "#7a4a2a" }], heightM: 3.8, facade: { outline: [[0, 6], [9.6, 6]], hex: "#2f6f7a", ribs: "#2a5f6a", windows: [{ xs: [1.4, 3.5, 5.6, 7.7], rows: [[4.6, 5.6]], w: 1.6, frameHex: "#2a4a50" }] } },
    "restaurant-lastage-82260": { name: "Lastage", frame: "#e8e6e0", wall: "#2c3036", fascia: "#e8e6e0", fasciaH: 0.25, text: "", span: [0.9, 4.1], bays: "W D:0.9", grid: [2, 1], transom: true, plants: true, heightM: 4.6 },
    "restaurant-sallora-51279": null,
    "restaurant-shiva-79404": { name: "Shiva", frame: "#1d1d1f", doorHex: "#1d1d1f", wall: "#1d1d1f", fascia: "#1d1d1f", fasciaH: 0.4, text: "", span: [0, 5], bays: "d:0.8 W:2.6 d:0.8 B", transom: true, grid: [3, 2], glass: "#3a3434", heightM: 4.4 },
    "ricardo-s-63107": { name: "Rongsen", frame: "#ecebe6", doorHex: "#ecebe6", wall: "#ecebe6", buildingHex: "#ecebe6", fascia: false, text: "", span: [7.5, 14.4], bays: "W:2.1 B:0.4 C:1.6 B:0.2 W:2.0", grid: [5, 4], signs: [{ text: "RONGSEN", x: [7.6, 14.4], z: [3.5, 4.3], letters: "#ecebe6", board: "#3a4a6a" }], heightM: 4.6 },
    "rijnbar-80338": { name: "Rijnbar", frame: "#e8e6e0", wall: "#6a4a3a", plinth: "#4a3a32", fascia: "#e8e6e0", fasciaH: 0.2, text: "", span: [1, 12.4], bays: "d:0.8 B:1.4 W:3.0 B:0.9 D:0.8 B:0.7 W:2.8 B", grid: [1, 1], transom: true, sign: "round", signHex: "#2f7a3a", heightM: 3.6 },
    "rijsel-36544": null,
    // Sheet 21.
    "ristorante-papa-carlo-82585": { name: "Papa Carlo", frame: "#3a2a22", doorHex: "#3a2a22", wall: "#5a2a24", fascia: false, text: "", span: [1.9, 4.4], bays: "W:0.6 C:1.3 W:0.6", transom: true, heightM: 4 },
    "ristorante-pizzeria-monte-verde-65953": { name: "Caf\xE9 Buiten", frame: "#4a2414", doorHex: "#4a2414", wall: "#4a2414", fascia: "#1f4d3a", fasciaH: 0.4, text: "DRINKEN & ETEN       CAFE BUITEN", letters: "#ecebe6", span: [0, 13.3], bays: "W:2.0 C:1.6 W:1.0 C:1.8 W:1.0 B:0.3 W:3.4 B", transom: true, grid: [1, 2], glass: "#5a4a38", heightM: 4.6 },
    "ron-gastrobar-32011": { name: "Ron Gastrobar", frame: "#e8e6e0", wall: "#e8e6e0", fascia: "#e8e6e0", fasciaH: 0.3, text: "", span: [0, 16.9], bays: "W W W W W W W", grid: [2, 1], awning: "canopy", awningHex: "#ecebe6", terrace: true, plants: true, heightM: 4.2 },
    "roopram-roti-55550": { name: "Roopram", frame: "#ecebe6", doorHex: "#2a2c2e", wall: "#c8ccd0", fascia: "#c8ccd0", fasciaH: 0.6, text: "", span: [0.8, 6.6], bays: "d:0.8 B:0.4 W:1.0 W:1.6 W:1.0 B", transom: true, heightM: 4.4 },
    "rossi-sandwiches-31005": null,
    "roum-cafe-61185": { name: "Roum", frame: "#ecebe6", doorHex: "#1d1d1f", wall: "#ecebe6", fascia: false, text: "", span: [0, 6.2], bays: "W:2.6 B:0.4 d:0.8 B:0.4 W", grid: [2, 2], awning: "flat", awningHex: "#1d1d1f", awningOver: [0, 0], terrace: true, heightM: 4.2 },
    "royal-fook-long-42162": { name: "Royal Fook Long", frame: "#3a3d40", wall: "#3a3d40", fascia: false, text: "", span: [0, 25.3], bays: "W W W W W D:1.6 W W", grid: [3, 1], glass: "#5a3a38", awning: "canopy", awningHex: "#c8c4bc", signs: [{ text: "ROYAL FOOK LONG", x: [17.4, 20], z: [3, 3.3], letters: "#ecebe6" }], heightM: 3.6 },
    "royal98-53823": null,
    "royalvis-traiteur-18311": { name: "Royal Med", frame: "#2a2c2e", wall: "#7a4a38", fascia: "#3a4a7a", fasciaH: 0.5, text: "ROYAL MED.", letters: "#ecebe6", span: [2.3, 10.6], bays: "W:3.0 B:0.3 D:1.0 B:0.3 W:3.0", rollers: "#2a3a6a", awning: "flat", awningHex: "#1d1d1f", heightM: 4.6 },
    "rue-la-bastille-77670": { name: "Rue la Bastille", frame: "#3a3a36", doorHex: "#1d1d1f", wall: "#3a3a36", fascia: "#3a3a36", fasciaH: 0.3, text: "", span: [0, 4.5], bays: "W:2.3 B:0.2 d:0.8 B", transom: true, glass: "#5a4a38", heightM: 4 },
    "rufus-restaurant-57012": { name: "Rufus", frame: "#1d1d1f", wall: "#1d1d1f", fascia: "#1d1d1f", fasciaH: 0.6, text: "", span: [5.6, 10.6], bays: "d:0.8 B:0.4 W W", glass: "#5a4a38", terrace: true, heightM: 4.4 },
    "sab-s-deli-36070": { name: "Sab's", frame: "#3a2a22", doorHex: "#7a3a24", wall: "#7a4a38", fascia: false, text: "", span: [2, 9], bays: "W:3.2 B:0.4 D:1.0 W", grid: [1, 2], awning: "flat", awningHex: "#2f5a40", awningText: { text: "DELI  PRIVATE DINING  CATERING", letters: "#ecebe6" }, terrace: true, plants: true, heightM: 3.8 },
    "sababa-58581": { name: "Sababa", frame: "#6a6c6a", pilaster: "#e8dfc8", doorHex: "#6a6c6a", wall: "#e8dfc8", plinth: "#e8dfc8", buildingHex: "#e8dfc8", fascia: false, text: "", shift: -1.1, span: [1.1, 9.1], bays: "P:0.4 W:0.8 C:0.9 W:0.8 P:0.6 d:1.3 P:0.6 O:2.2 P:0.4", signs: [{ text: "TABAKSHOP BELL", x: [1.5, 3.4], z: [3, 3.3], letters: "#f2f0ea", board: "#5a5a58" }, { text: "BELL & BEL", x: [3.4, 4.4], z: [2.9, 3.6], letters: "#f2f0ea", board: "#c8282a" }], heightM: 3.9 },
    "saeed-s-curry-house-54207": null,
    "sagardi-72053": { name: "Sagardi", frame: "#2a2c2e", wall: "#3a3634", fascia: "#3a3634", fasciaH: 0.4, text: "SAGARDI", letters: "#d8d4cc", span: [0, 4.9], bays: "W D:0.9 W", grid: [2, 2], heightM: 3.6 },
    "sahan-92837": { name: "Sahan", frame: "#2a2c2e", wall: "#2a2c2e", fascia: "#b8482a", fasciaH: 0.9, text: "SAHAN", textAt: [1, 6], letters: "#ecebe6", span: [0, 11.2], bays: "W W W W W W", grid: [2, 2], glass: "#5a4a38", terrace: true, plants: true, heightM: 4.4 },
    // Sheet 22.
    "salento-latino-78584": { name: "Tropico", frame: "#3a3d40", wall: "#3a3d40", fascia: false, text: "", span: [0, 7.6], bays: "W:3.6 B:0.4 W", grid: [3, 2], awning: "flat", awningHex: "#b8282a", awningOver: [0, 0], signs: [{ text: "TROPICO", x: [1.5, 4.4], z: [4, 4.6], letters: "#2a2c2e", board: "#ecebe6" }], heightM: 4.6 },
    "salvatorica-74729": { name: "Salvatorica", frame: "#2a2c2e", wall: "#7a5a48", pilaster: "#8a8480", fascia: "#8a8480", fasciaH: 0.3, text: "", span: [1.6, 19.4], bays: "W:4.0 P:0.4 W:4.4 P:0.4 W:4.6 P:0.4 W", grid: [3, 2], heightM: 4.4 },
    "sama-sebo-65990": { name: "Sama Sebo", frame: "#ecebe6", wall: "#7a4a38", fascia: "#3a2a22", fasciaH: 0.3, text: "", span: [0, 15], bays: "W:1.8 B:1.1 W:1.8 B:0.4 W:2.4 B:2.1 W:1.6 B", grid: [2, 2], signs: [{ text: "INDONESISCH RESTAURANT", x: [3.7, 5.5], z: [2, 2.4], letters: "#ecebe6" }, { text: "TAKE AWAY", x: [11, 12.6], z: [2.3, 2.6], letters: "#2a2c2e", board: "#ecebe6" }], lanterns: false, heightM: 3.6 },
    "samba-kitchen-59252": { name: "Samba Kitchen", frame: "#ecebe6", wall: "#ecebe6", fascia: "#ecebe6", fasciaH: 0.4, text: "SAMBA KITCHEN", letters: "#3a7a3a", span: [0, 5], bays: "d:0.7 B:0.3 W", rollers: "#5a7a9a", graffiti: ["#ecebe6", "#2a5a9a", "#3a8a4a"], terrace: true, heightM: 3.6 },
    "sapporo-ramen-sora-35936": { name: "Sora", frame: "#ecebe6", wall: "#ecebe6", fascia: false, text: "", span: [2, 3.9], bays: "W", windows: "arched", grid: [2, 2], heightM: 3.4 },
    "scheltema-67522": { name: "Scheltema", frame: "#2a2c2e", wall: "#2a2c2e", fascia: "#2a2c2e", fasciaH: 0.4, text: "CAFE SCHELTEMA RESTAURANT", letters: "#c87a5a", span: [0, 6.4], bays: "W", rollers: "#e8e6e0", awning: "canopy", awningHex: "#8a8c8e", heightM: 4.4 },
    "schiller-78854": { name: "NH Schiller", frame: "#3a3d40", wall: "#e3dcc8", fascia: "#2a3550", text: "", span: [0, 32.5], bays: "W W W W B:0.6 D:4.6 B:0.8 W W W W W", grid: [2, 1], awning: "flat", awningHex: "#3a4560", signs: [{ text: "NH SCHILLER", x: [13.3, 20.8], z: [4.75, 5.5], letters: "#6a6a6a", board: "#e3dcc8" }], terrace: true, heightM: 5.4 },
    "seafood-bistro-78815": { name: "Seafood Bistro", frame: "#ecebe6", wall: "#ecebe6", fascia: false, text: "", span: [0, 4], bays: "W", rollers: "#d8d8d4", signs: [{ text: "WE ARE OPEN", x: [0.2, 2.6], z: [1.3, 1.7], letters: "#2a2c2e" }], sign: "square", signHex: "#e3c020", signAt: "right", heightM: 4 },
    "seasons-restaurant-75049": { name: "Seasons", frame: "#ece6d6", doorHex: "#7a1f22", wall: "#3a3a3c", pilaster: "#ece6d6", fascia: false, text: "", span: [0, 6], bays: "d:0.9 P:0.3 W:2.6 P:0.3 d:0.9 B", transom: true, glass: "#4a3a30", heightM: 4.6 },
    "semai-52074": { name: "Semai", frame: "#ecebe6", doorHex: "#ecebe6", wall: "#5a3a2c", fascia: "#2a2c2e", fasciaH: 0.6, text: "ERITREAN ETHIOPIAN   SEMAI", letters: "#ecebe6", span: [0.8, 9], bays: "W:2.0 B:0.6 C:1.0 W:2.6 B", grid: [3, 2], heightM: 4.6, facade: { outline: [[0, 6], [19.8, 6]], hex: "#6a9a9a", ribs: "#5a8a8a", windows: [{ xs: [4.6, 8, 12, 16], rows: [[4.8, 5.8]], w: 3, frameHex: "#2a2c2e" }] } },
    "semhar-74838": { name: "Semhar", frame: "#2a2c2e", wall: "#7a1f1a", fascia: "#7a1f1a", fasciaH: 0.6, text: "ERITREAN ETHIOPIAN RESTAURANT", textAt: [5, 9.8], textH: 0.25, letters: "#d8b040", span: [0, 9.8], bays: "W W W W W", grid: [3, 2], heightM: 4.4 },
    "senayan-73612": { name: "Senayan", frame: "#ecebe6", doorHex: "#2a2c2e", wall: "#3a3634", pilaster: "#ecebe6", fascia: "#ecebe6", fasciaH: 0.4, text: "", span: [0.4, 5.5], bays: "P:0.3 W P:0.3 W P:0.3 d:0.7 P:0.3", heightM: 4 },
    "seth-takeout-76929": { name: "Seth", frame: "#ecebe6", doorHex: "#2a2c2e", wall: "#ecebe6", buildingHex: "#3a3634", fascia: false, text: "", span: [0, 2.4], bays: "W:1.4 d:0.8 B", grid: [2, 2], heightM: 3.6 },
    "sham-87688": { name: "Sham", frame: "#1d1d1f", wall: "#1d1d1f", fascia: "#1d1d1f", fasciaH: 1, text: "SHAM", textAt: [1.5, 4.5], letters: "#c9a227", pattern: { kind: "tiles", a: "#1d1d1f", b: "#4a3a1c", on: "fascia" }, span: [0, 7], bays: "W W W W W", windows: "arched", glass: "#5a4a38", terrace: true, heightM: 5 },
    "sham-maza-80856": { name: "Sham Maza", frame: "#2a2a28", wall: "#2a2a28", fascia: "#2a2a28", fasciaH: 0.5, text: "", span: [0, 6], bays: "W W", grid: [2, 1], awning: "canopy", awningHex: "#3a3a36", heightM: 4 },
    "sherpa-39376": { name: "Sherpa", frame: "#2a2c2e", wall: "#2a2c2e", fascia: "#2a2c2e", fasciaH: 0.5, text: "NEPALESE - TIBETAN - INDIAN", letters: "#ecebe6", span: [7.3, 12.5], bays: "W D:1.0 W", grid: [1, 2], glass: "#5a4a38", heightM: 4 },
    // Sheet 23.
    "shiki-79220": null,
    "sichuan-food-68478": { name: "Sichuan Food", frame: "#2a2420", wall: "#2a2420", fascia: false, text: "", span: [0, 5.1], bays: "W:1.0 D W W", grid: [1, 2], awning: "flat", awningHex: "#b8a860", awningText: { text: "SICHUAN FOOD", letters: "#6a5a2a" }, terrace: true, heightM: 3.4 },
    "silk-road-kebab-house-80959": { name: "Silk Road", frame: "#2a2c2e", wall: "#2a2c2e", fascia: "#1d1d1f", fasciaH: 0.6, text: "SILK ROAD KEBAB HOUSE", letters: "#ecebe6", span: [13.6, 18], bays: "W D:1.0 W", heightM: 3.6 },
    "sinne-35937": { name: "Sinne", frame: "#3a3d40", wall: "#2a2c2e", fascia: "#2a2c2e", text: "", span: [0, 5], bays: "D W", grid: [2, 1], awning: "flat", awningHex: "#5a5d60", heightM: 4.6 },
    "t-vliegertje-36397": { name: "'t Vliegertje", frame: "#2a1f1a", wall: "#1d1d1f", fascia: "#1d1d1f", fasciaH: 0.9, text: "BAVARIA", textAt: [1.4, 7], letters: "#f2f0ea", logo: { hex: "#2a5a9a" }, banner: { hex: "#1d1d1f", text: "CAFE-RESTAURANT 'T VLIEGERTJE", letters: "#ecebe6" }, span: [0, 9.7], bays: "W W W D:0.8 W W", grid: [1, 2], terrace: true, heightM: 4.9 },
    "vermeer-82718": { name: "Vermeer", frame: "#1d1d1f", wall: "#8a8a86", plinth: "#8a8a86", fascia: "#8a8a86", fasciaH: 0.3, text: "", span: [0.2, 4.4], bays: "B:0.3 W:0.8 B:0.4 W:0.8 B:0.4 W:0.8 B", grid: [1, 2], heightM: 3.6 },
    "vinkeles-74123": null
  };

  // src/canalRecall/storefrontWalls.generated.ts
  var STOREFRONT_WALLS = { "a-fushion-42477": { "pand": "NL.IMBAG.Pand.0363100012242477", "start": [4.87742, 52.394882], "end": [4.877239, 52.394788], "lengthM": 16.16, "alongM": 9.21 }, "a-sentimento-pizza-33537": { "pand": "NL.IMBAG.Pand.0363100012233537", "start": [4.878281, 52.382555], "end": [4.878786, 52.382256], "lengthM": 47.84, "alongM": 3.44 }, "a-tavola-81149": { "pand": "NL.IMBAG.Pand.0363100012181149", "start": [4.912421, 52.370212], "end": [4.912282, 52.370259], "lengthM": 10.81, "alongM": 5.407466607409624 }, "a-volo-72841": { "pand": "NL.IMBAG.Pand.0363100012172841", "start": [4.884505, 52.384252], "end": [4.884549, 52.384227], "lengthM": 4.09, "alongM": 2.18 }, "aaltje-54926": { "pand": "NL.IMBAG.Pand.0457100000054926", "start": [5.038447, 52.30882], "end": [5.038561, 52.308802], "lengthM": 8.03, "alongM": 3.97 }, "abyssinia-49625": { "pand": "NL.IMBAG.Pand.0363100012149625", "start": [4.865334, 52.360411], "end": [4.865277, 52.3605], "lengthM": 10.64, "alongM": 3.49 }, "afhaalcentrum-terang-boelan-65034": { "pand": "NL.IMBAG.Pand.0363100012165034", "start": [4.882712, 52.379703], "end": [4.882739, 52.379638], "lengthM": 7.46, "alongM": 3.72 }, "akitsu-69827": { "pand": "NL.IMBAG.Pand.0363100012169827", "start": [4.875213, 52.372192], "end": [4.875279, 52.372207], "lengthM": 4.79, "alongM": 1.2 }, "al-argentino-65689": { "pand": "NL.IMBAG.Pand.0363100012165689", "start": [4.900874, 52.375669], "end": [4.900916, 52.375632], "lengthM": 5.01, "alongM": 1.45 }, "al-basha-47236": { "pand": "NL.IMBAG.Pand.0363100012147236", "start": [4.819684, 52.378038], "end": [4.819739, 52.37817], "lengthM": 15.16, "alongM": 4.25 }, "alberto-pozzetto-private-dining-56811": { "pand": "NL.IMBAG.Pand.0363100012156811", "start": [4.892798, 52.355527], "end": [4.892722, 52.355672], "lengthM": 16.94, "alongM": 2.5 }, "albina-10961": { "pand": "NL.IMBAG.Pand.0363100012110961", "start": [4.889607, 52.354928], "end": [4.889759, 52.354957], "lengthM": 10.85, "alongM": 3.61 }, "ali-ocakbas-78972": { "pand": "NL.IMBAG.Pand.0363100012178972", "start": [4.89783, 52.364823], "end": [4.897797, 52.364909], "lengthM": 9.83, "alongM": 7.14 }, "ama-sushi-ramen-35932": { "pand": "NL.IMBAG.Pand.0363100012235932", "start": [4.90157, 52.355077], "end": [4.901645, 52.3551], "lengthM": 5.71, "alongM": 2.22 }, "amra-74506": { "pand": "NL.IMBAG.Pand.0363100012174506", "start": [4.883395, 52.378092], "end": [4.883353, 52.378171], "lengthM": 9.24, "alongM": 1.49 }, "aneka-rasa-71504": { "pand": "NL.IMBAG.Pand.0363100012171504", "start": [4.898846, 52.375779], "end": [4.89875, 52.375711], "lengthM": 10, "alongM": 3.36 }, "anjappar-65520": { "pand": "NL.IMBAG.Pand.0363100012165520", "start": [4.880389, 52.354725], "end": [4.8807, 52.354795], "lengthM": 22.57, "alongM": 18.38 }, "any-thaim-delivery-23690": { "pand": "NL.IMBAG.Pand.0363100012123690", "start": [4.912787, 52.383599], "end": [4.912691, 52.383611], "lengthM": 6.67, "alongM": 3.8 }, "argentalia-78811": { "pand": "NL.IMBAG.Pand.0363100012178811", "start": [4.898599, 52.375603], "end": [4.898482, 52.375524], "lengthM": 11.86, "alongM": 0.5 }, "arles-60398": { "pand": "NL.IMBAG.Pand.0363100012160398", "start": [4.898084, 52.35627], "end": [4.898156, 52.356292], "lengthM": 5.48, "alongM": 2.65 }, "attila-turkish-food-78174": { "pand": "NL.IMBAG.Pand.0363100012078174", "start": [4.841104, 52.378141], "end": [4.840559, 52.378235], "lengthM": 38.56, "alongM": 27.29, "outM": 0.65 }, "auberge-36577": { "pand": "NL.IMBAG.Pand.0363100012236577", "start": [4.889261, 52.354671], "end": [4.889028, 52.354624], "lengthM": 16.71, "alongM": 0.73 }, "baibua-75627": { "pand": "NL.IMBAG.Pand.0363100012175627", "start": [4.891275, 52.366524], "end": [4.891524, 52.366479], "lengthM": 17.68, "alongM": 15.13 }, "baires-40662": { "pand": "NL.IMBAG.Pand.0363100012140662", "start": [4.869785, 52.368952], "end": [4.869809, 52.368917], "lengthM": 4.22, "alongM": 2.7 }, "baires-60490": { "pand": "NL.IMBAG.Pand.0363100012160490", "start": [4.925295, 52.359727], "end": [4.925268, 52.359771], "lengthM": 5.23, "alongM": 2.614883746460885 }, "baked-59205": { "pand": "NL.IMBAG.Pand.0363100012159205", "start": [4.87234, 52.375037], "end": [4.872411, 52.374943], "lengthM": 11.52, "alongM": 7.91 }, "bakers-roasters-33622": { "pand": "NL.IMBAG.Pand.0363100012233622", "start": [4.889911, 52.357355], "end": [4.889724, 52.357365], "lengthM": 12.79, "alongM": 3.27 }, "balraj-67821": { "pand": "NL.IMBAG.Pand.0363100012167821", "start": [4.888448, 52.382039], "end": [4.888531, 52.381992], "lengthM": 7.7, "alongM": 6.78 }, "banh-mi-ba-my-68914": { "pand": "NL.IMBAG.Pand.0363100012168914", "start": [4.875499, 52.371974], "end": [4.875424, 52.371957], "lengthM": 5.45, "alongM": 3.31 }, "bar-bistro-river-68038": { "pand": "NL.IMBAG.Pand.0363100012068038", "start": [4.902385, 52.342741], "end": [4.902248, 52.342747], "lengthM": 9.36, "alongM": 9.16 }, "bar-dancing-multipla-74176": { "pand": "NL.IMBAG.Pand.0363100012074176", "start": [4.844557, 52.342083], "end": [4.843604, 52.342077], "lengthM": 64.95, "alongM": 56.87 }, "bar-karma-78156": { "pand": "w717278156", "start": [4.8915152, 52.4015942], "end": [4.8917218, 52.4014969], "lengthM": 17.75, "alongM": 9.32 }, "bar-ristorante-gallizia-64155": { "pand": "NL.IMBAG.Pand.0363100012164155", "start": [4.9342, 52.363828], "end": [4.934278, 52.363832], "lengthM": 5.33, "alongM": 2.6657651799029543 }, "barada-54271": { "pand": "NL.IMBAG.Pand.0457100000054271", "start": [5.043215, 52.30803], "end": [5.043173, 52.308085], "lengthM": 6.76, "alongM": 3.41 }, "bella-storia-trattoria-italiana-64646": { "pand": "NL.IMBAG.Pand.0363100012164646", "start": [4.874124, 52.383766], "end": [4.874175, 52.383798], "lengthM": 4.97, "alongM": 3.16 }, "beyoglu-26283": { "pand": "NL.IMBAG.Pand.0363100012126283", "start": [4.913566, 52.35716], "end": [4.913851, 52.357231], "lengthM": 20.96, "alongM": 14.45 }, "beyrouth-36814": { "pand": "NL.IMBAG.Pand.0363100012236814", "start": [4.875233, 52.368191], "end": [4.875338, 52.368218], "lengthM": 7.76, "alongM": 3.45 }, "billy-s-thai-restaurant-73820": { "pand": "NL.IMBAG.Pand.0363100012173820", "start": [4.882197, 52.367894], "end": [4.882199, 52.367944], "lengthM": 5.56, "alongM": 2.7824730907633204 }, "bir-tat-37903": { "pand": "NL.IMBAG.Pand.0363100012137903", "start": [4.848265, 52.378608], "end": [4.848401, 52.378635], "lengthM": 9.74, "alongM": 3.17 }, "bisous-52622": { "pand": "NL.IMBAG.Pand.0363100012152622", "start": [4.887778, 52.354699], "end": [4.887847, 52.354695], "lengthM": 4.72, "alongM": 2.48 }, "bistro-amsterdam-74130": { "pand": "NL.IMBAG.Pand.0363100012174130", "start": [4.883377, 52.373823], "end": [4.883373, 52.373778], "lengthM": 5.01, "alongM": 2.82 }, "bistro-de-la-mer-77684": { "pand": "NL.IMBAG.Pand.0363100012177684", "start": [4.898262, 52.364154], "end": [4.898277, 52.36411], "lengthM": 5, "alongM": 2.5005782797240212 }, "bistrot-des-alpes-82275": { "pand": "NL.IMBAG.Pand.0363100012182275", "start": [4.901355, 52.361944], "end": [4.901487, 52.361969], "lengthM": 9.41, "alongM": 4.43 }, "bistrot-neuf-71114": { "pand": "NL.IMBAG.Pand.0363100012171114", "start": [4.893878, 52.379346], "end": [4.893753, 52.379413], "lengthM": 11.31, "alongM": 7.82 }, "blauw-56113": { "pand": "NL.IMBAG.Pand.0363100012156113", "start": [4.855755, 52.353414], "end": [4.855721, 52.35351], "lengthM": 10.93, "alongM": 4.8 }, "blin-queen-78949": { "pand": "NL.IMBAG.Pand.0363100012178949", "start": [4.896885, 52.366995], "end": [4.896811, 52.366991], "lengthM": 5.06, "alongM": 2.37 }, "bloem-op-ijburg-06701": { "pand": "NL.IMBAG.Pand.0363100012106701", "start": [4.9963438, 52.3549166], "end": [4.9975492, 52.354275], "lengthM": 108.81, "alongM": 70.36 }, "blue-dragon-82246": { "pand": "NL.IMBAG.Pand.0363100012082246", "start": [4.891045, 52.357495], "end": [4.8911, 52.357387], "lengthM": 12.59, "alongM": 11.77 }, "blue-pepper-56684": { "pand": "NL.IMBAG.Pand.0363100012156684", "start": [4.878063, 52.365814], "end": [4.877857, 52.365755], "lengthM": 15.49, "alongM": 1.85 }, "boeuf-53646": { "pand": "NL.IMBAG.Pand.0363100012153646", "start": [4.888544, 52.356128], "end": [4.888562, 52.356236], "lengthM": 12.08, "alongM": 7.33 }, "bojo-68561": { "pand": "NL.IMBAG.Pand.0363100012168561", "start": [4.884739, 52.363929], "end": [4.884781, 52.3639], "lengthM": 4.31, "alongM": 2.13 }, "bougainville-65129": { "pand": "NL.IMBAG.Pand.0363100012165129", "start": [4.893659, 52.372478], "end": [4.893141, 52.372584], "lengthM": 37.2, "alongM": 27.42 }, "bouillon-d-amsterdam-75580": { "pand": "NL.IMBAG.Pand.0363100012175580", "start": [4.890709, 52.373996], "end": [4.890784, 52.374085], "lengthM": 11.14, "alongM": 5.49 }, "brandon-76429": { "pand": "NL.IMBAG.Pand.0363100012176429", "start": [4.886387, 52.375397], "end": [4.886524, 52.375351], "lengthM": 10.64, "alongM": 1.46 }, "brasserie-nenette-86764": { "pand": "NL.IMBAG.Pand.0363100012086764", "start": [4.892765, 52.342418], "end": [4.892869, 52.342311], "lengthM": 13.86, "alongM": 2.24 }, "bret-43513": { "pand": "NL.IMBAG.Pand.0363100012243513", "start": [4.836683, 52.389792], "end": [4.836861, 52.389793], "lengthM": 12.12, "alongM": 5.58 }, "bridges-50983": { "pand": "NL.IMBAG.Pand.0363100012250983", "start": [4.895155, 52.370906], "end": [4.895088, 52.370816], "lengthM": 11, "alongM": 5.502243726745871 }, "bromo-indah-70189": { "pand": "NL.IMBAG.Pand.0363100012170189", "start": [4.880342, 52.369649], "end": [4.880407, 52.36967], "lengthM": 5.01, "alongM": 2.5028324488753726 }, "brouwerij-t-ij-69757": { "pand": "NL.IMBAG.Pand.0363100012169757", "start": [4.926348, 52.366613], "end": [4.926568, 52.366752], "lengthM": 21.53, "alongM": 6.73 }, "brouwerij-troost-26831": { "pand": "NL.IMBAG.Pand.0363100012126831", "start": [4.89129, 52.350536], "end": [4.89077, 52.350561], "lengthM": 35.54, "alongM": 15.99, "outM": 0.45 }, "brunchdale-51598": { "pand": "NL.IMBAG.Pand.0363100012251598", "start": [4.904222, 52.396246], "end": [4.904398, 52.396417], "lengthM": 22.48, "alongM": 13.93 }, "brunchie-71533": { "pand": "NL.IMBAG.Pand.0363100012571533", "start": [4.88557, 52.36526], "end": [4.885521, 52.365291], "lengthM": 4.8, "alongM": 3.64 }, "brut-de-mer-57580": { "pand": "NL.IMBAG.Pand.0363100012157580", "start": [4.89258, 52.355807], "end": [4.892505, 52.355792], "lengthM": 5.38, "alongM": 2.79 }, "buffet-van-odette-76062": { "pand": "NL.IMBAG.Pand.0363100012176062", "start": [4.889031, 52.362229], "end": [4.889069, 52.362334], "lengthM": 11.97, "alongM": 5.52 }, "buiten-amsterdam-48608": { "pand": "NL.IMBAG.Pand.0363100012248608", "start": [4.821366, 52.371482], "end": [4.821151, 52.371466], "lengthM": 14.75, "alongM": 8.12 }, "bullewijck-par-hasard-01986": { "pand": "NL.IMBAG.Pand.0363100012101986", "start": [4.948241, 52.306935], "end": [4.948383, 52.30678], "lengthM": 19.78, "alongM": 8.56 }, "buurman-buurman-eetwinkel-de-with-02216": { "pand": "NL.IMBAG.Pand.0363100012102216", "start": [4.859269, 52.368757], "end": [4.859474, 52.368767], "lengthM": 14.01, "alongM": 2.36 }, "cabron-59249": { "pand": "NL.IMBAG.Pand.0363100012159249", "start": [4.894911, 52.355763], "end": [4.894828, 52.355744], "lengthM": 6.04, "alongM": 3.24 }, "cafe-carbon-72095": { "pand": "NL.IMBAG.Pand.0363100012072095", "start": [4.857287, 52.346223], "end": [4.856893, 52.34617], "lengthM": 27.49, "alongM": 5.86 }, "cafe-caron-05340": { "pand": "NL.IMBAG.Pand.0363100012105340", "start": [4.888785, 52.357295], "end": [4.888803, 52.357403], "lengthM": 12.08, "alongM": 9.35 }, "cafe-de-klos-72453": { "pand": "NL.IMBAG.Pand.0363100012172453", "start": [4.885611, 52.365373], "end": [4.885699, 52.365319], "lengthM": 8.49, "alongM": 4.14 }, "cafe-diner-t-weesperplein-54930": { "pand": "NL.IMBAG.Pand.0457100000054930", "start": [5.04094, 52.308278], "end": [5.040831, 52.308283], "lengthM": 7.45, "alongM": 3.81 }, "cafe-kadijk-70737": { "pand": "NL.IMBAG.Pand.0363100012170737", "start": [4.91211, 52.370146], "end": [4.912056, 52.37011], "lengthM": 5.44, "alongM": 2.718899673429219 }, "cafe-luxembourg-71813": { "pand": "NL.IMBAG.Pand.0363100012171813", "start": [4.8887741, 52.368654], "end": [4.8886931, 52.3687436], "lengthM": 11.39, "alongM": 3 }, "cafe-maurits-18332": { "pand": "NL.IMBAG.Pand.0363100012118332", "start": [4.850374, 52.350791], "end": [4.850372, 52.350917], "lengthM": 14.02, "alongM": 11.21 }, "cafe-modern-00305": { "pand": "NL.IMBAG.Pand.0363100012100305", "start": [4.908969, 52.386474], "end": [4.909101, 52.386332], "lengthM": 18.18, "alongM": 2.4 }, "cafe-parlotte-69678": { "pand": "NL.IMBAG.Pand.0363100012169678", "start": [4.88172, 52.378234], "end": [4.881799, 52.378249], "lengthM": 5.63, "alongM": 2.816129261325904 }, "cafe-piazza-82586": { "pand": "NL.IMBAG.Pand.0363100012182586", "start": [4.900026, 52.371962], "end": [4.899993, 52.371925], "lengthM": 4.69, "alongM": 2.48 }, "cafe-warung-pas-22965": { "pand": "NL.IMBAG.Pand.0363100012122965", "start": [4.912899, 52.381153], "end": [4.912739, 52.381138], "lengthM": 11.02, "alongM": 5.75, "outM": 0.25 }, "caffe-italia-77743": { "pand": "NL.IMBAG.Pand.0363100012177743", "start": [4.897114, 52.37459], "end": [4.897067, 52.374556], "lengthM": 4.96, "alongM": 2.13 }, "cai-cai-15768": { "pand": "NL.IMBAG.Pand.0363100012115768", "start": [4.940142, 52.371344], "end": [4.940194, 52.371172], "lengthM": 19.46, "alongM": 3.33 }, "calisto-76282": { "pand": "NL.IMBAG.Pand.0363100012176282", "start": [4.887495, 52.382428], "end": [4.887351, 52.382333], "lengthM": 14.42, "alongM": 3.38 }, "calle-ocho-59713": { "pand": "NL.IMBAG.Pand.0363100012159713", "start": [4.897022, 52.356325], "end": [4.896939, 52.3563], "lengthM": 6.3, "alongM": 3.35 }, "camino-taqueria-36027": { "pand": "NL.IMBAG.Pand.0363100012236027", "start": [4.871182, 52.367059], "end": [4.871299, 52.367093], "lengthM": 8.82, "alongM": 6.62 }, "cannibale-royale-52862": { "pand": "NL.IMBAG.Pand.0363100012152862", "start": [4.887182, 52.353586], "end": [4.887391, 52.353619], "lengthM": 14.7, "alongM": 2.97 }, "cannibale-royale-handboogstraat-75878": { "pand": "NL.IMBAG.Pand.0363100012175878", "start": [4.890318, 52.367927], "end": [4.890531, 52.367988], "lengthM": 16.02, "alongM": 3.63 }, "cantina-caliente-70417": { "pand": "NL.IMBAG.Pand.0363100012170417", "start": [4.910894, 52.362327], "end": [4.910805, 52.362492], "lengthM": 19.33, "alongM": 3.88 }, "cantine-de-caron-52471": { "pand": "NL.IMBAG.Pand.0363100012152471", "start": [4.872627, 52.386263], "end": [4.873004, 52.38627], "lengthM": 25.68, "alongM": 13.05 }, "carletto-67455": { "pand": "NL.IMBAG.Pand.0363100012167455", "start": [4.891797, 52.355654], "end": [4.891714, 52.355637], "lengthM": 5.96, "alongM": 3.18 }, "cartagena-62560": { "pand": "NL.IMBAG.Pand.0363100012162560", "start": [4.86592, 52.36568], "end": [4.865975, 52.365693], "lengthM": 4.02, "alongM": 1.97 }, "casa-nostra-52357": { "pand": "NL.IMBAG.Pand.0363100012152357", "start": [4.903099, 52.355559], "end": [4.903012, 52.355662], "lengthM": 12.9, "alongM": 2.66 }, "casa-peru-68820": { "pand": "NL.IMBAG.Pand.0363100012168820", "start": [4.882894, 52.366487], "end": [4.882952, 52.366424], "lengthM": 8.05, "alongM": 8.08 }, "cascada-40347": { "pand": "NL.IMBAG.Pand.0363100012240347", "start": [4.948087, 52.311175], "end": [4.948586, 52.31135], "lengthM": 39.21, "alongM": 35.73 }, "castillo-79394": { "pand": "NL.IMBAG.Pand.0363100012179394", "start": [4.893577, 52.366078], "end": [4.893668, 52.366066], "lengthM": 6.34, "alongM": 3.8 }, "cavataria-14248": { "pand": "NL.IMBAG.Pand.0363100012114248", "start": [4.86317, 52.35116], "end": [4.863232, 52.351059], "lengthM": 12.01, "alongM": 2.4 }, "cedars-05128": { "pand": "NL.IMBAG.Pand.0363100012105128", "start": [4.844335, 52.351993], "end": [4.844204, 52.351958], "lengthM": 9.74, "alongM": -3.57 }, "chadni-chowk-17679": { "pand": "NL.IMBAG.Pand.0363100012117679", "start": [4.847862, 52.384403], "end": [4.847789, 52.384337], "lengthM": 8.87, "alongM": 1.16 }, "cham-so-good-58473": { "pand": "NL.IMBAG.Pand.0363100012158473", "start": [4.861511, 52.359486], "end": [4.861381, 52.359673], "lengthM": 22.61, "alongM": 5.87 }, "chateau-amsterdam-13565": { "pand": "NL.IMBAG.Pand.0363100012113565", "start": [4.92663, 52.386213], "end": [4.926564, 52.386392], "lengthM": 20.42, "alongM": 7.21 }, "chhiwat-bladi-lunch-grill-62478": { "pand": "NL.IMBAG.Pand.0363100012062478", "start": [4.799974, 52.351856], "end": [4.799722, 52.351805], "lengthM": 18.08, "alongM": 4.85 }, "china-supreme-99001": { "pand": "NL.IMBAG.Pand.0363100012099001", "start": [4.868437, 52.326135], "end": [4.868404, 52.326767], "lengthM": 70.36, "alongM": 28.9 }, "chuzo-king-77947": { "pand": "NL.IMBAG.Pand.0363100012077947", "start": [4.910862, 52.399101], "end": [4.910464, 52.399178], "lengthM": 28.41, "alongM": 19.79 }, "cinq-oriental-bistro-47188": { "pand": "NL.IMBAG.Pand.0363100012247188", "start": [4.853349, 52.34135], "end": [4.853279, 52.341575], "lengthM": 25.49, "alongM": 4.93, "outM": 0.35 }, "city-noord-eethuis-84998": { "pand": "NL.IMBAG.Pand.0363100012084998", "start": [4.905802, 52.417219], "end": [4.905742, 52.417233], "lengthM": 4.37, "alongM": 2.13 }, "classico-37221": { "pand": "NL.IMBAG.Pand.0363100012237221", "start": [4.874356, 52.35691], "end": [4.874267, 52.356885], "lengthM": 6.67, "alongM": 3.64 }, "colima-71772": { "pand": "NL.IMBAG.Pand.0363100012171772", "start": [4.899181, 52.36135], "end": [4.898893, 52.361307], "lengthM": 20.19, "alongM": 2.11 }, "couscous-bar-61747": { "pand": "NL.IMBAG.Pand.0363100012161747", "start": [4.871283, 52.366891], "end": [4.871361, 52.366779], "lengthM": 13.55, "alongM": 2.83 }, "couscous-club-53618": { "pand": "NL.IMBAG.Pand.0363100012153618", "start": [4.894243, 52.35307], "end": [4.894167, 52.35306], "lengthM": 5.3, "alongM": 3.06 }, "ctaste-77277": { "pand": "NL.IMBAG.Pand.0363100012077277", "start": [4.906374, 52.354181], "end": [4.90633, 52.354241], "lengthM": 7.32, "alongM": 4.16 }, "cucina-casalinga-34703": { "pand": "NL.IMBAG.Pand.0363100012134703", "start": [4.858988, 52.344891], "end": [4.859026, 52.344784], "lengthM": 12.18, "alongM": 1.53 }, "cuddle-pub-79234": { "pand": "NL.IMBAG.Pand.0363100012179234", "start": [4.893911, 52.375353], "end": [4.894006, 52.375354], "lengthM": 6.47, "alongM": 2.34 }, "de-aardige-pers-58278": { "pand": "NL.IMBAG.Pand.0363100012158278", "start": [4.874416, 52.374178], "end": [4.874265, 52.374214], "lengthM": 11.04, "alongM": 7.82 }, "de-italiaan-66559": { "pand": "NL.IMBAG.Pand.0363100012166559", "start": [4.876494, 52.365453], "end": [4.87642, 52.365548], "lengthM": 11.71, "alongM": 7.34 }, "de-juwelier-77678": { "pand": "NL.IMBAG.Pand.0363100012177678", "start": [4.898217, 52.364268], "end": [4.898235, 52.364221], "lengthM": 5.37, "alongM": 2.2 }, "de-nieuwe-khl-80851": { "pand": "NL.IMBAG.Pand.0363100012080851", "start": [4.936355, 52.373872], "end": [4.936438, 52.374053], "lengthM": 20.92, "alongM": 13.57 }, "de-nieuwe-rai-93538": { "pand": "NL.IMBAG.Pand.0363100012093538", "start": [4.891307, 52.343924], "end": [4.891423, 52.343804], "lengthM": 15.52, "alongM": 3.02 }, "de-palmboom-71180": { "pand": "NL.IMBAG.Pand.0363100012171180", "start": [4.896727, 52.370106], "end": [4.89681, 52.370091], "lengthM": 5.89, "alongM": -1.36 }, "de-patchka-56486": { "pand": "NL.IMBAG.Pand.0363100012156486", "start": [4.891088, 52.355208], "end": [4.891152, 52.35522], "lengthM": 4.56, "alongM": 2.34 }, "de-pizzakamer-30670": { "pand": "NL.IMBAG.Pand.0363100012130670", "start": [4.894722, 52.352482], "end": [4.894517, 52.352455], "lengthM": 14.29, "alongM": 6.2 }, "desa-61346": { "pand": "NL.IMBAG.Pand.0363100012161346", "start": [4.89181, 52.35302], "end": [4.891893, 52.353032], "lengthM": 5.81, "alongM": 2.905182777983011 }, "di-luca-43829": { "pand": "NL.IMBAG.Pand.0363100012243829", "start": [4.921454, 52.384701], "end": [4.921543, 52.384418], "lengthM": 32.07, "alongM": 4.84 }, "dignita-93370": { "pand": "NL.IMBAG.Pand.0363100012093370", "start": [4.857231, 52.35179], "end": [4.85735, 52.351821], "lengthM": 8.81, "alongM": 4.6 }, "dionysos-taverna-36240": { "pand": "NL.IMBAG.Pand.0363100012136240", "start": [4.872385, 52.362157], "end": [4.87246, 52.362178], "lengthM": 5.62, "alongM": 4.02 }, "domenica-67762": { "pand": "NL.IMBAG.Pand.0363100012167762", "start": [4.887385, 52.380103], "end": [4.887511, 52.380126], "lengthM": 8.95, "alongM": 4.476409497402692 }, "dong-son-takeaway-restaurant-72773": { "pand": "NL.IMBAG.Pand.0363100012172773", "start": [4.881978, 52.373851], "end": [4.88221, 52.373913], "lengthM": 17.24, "alongM": 1.85 }, "dos-73278": { "pand": "NL.IMBAG.Pand.0363100012173278", "start": [4.881019, 52.380779], "end": [4.880805, 52.380829], "lengthM": 15.6, "alongM": 8.35 }, "eatmosfera-82121": { "pand": "NL.IMBAG.Pand.0363100012082121", "start": [4.935894, 52.363227], "end": [4.936031, 52.363229], "lengthM": 9.33, "alongM": 2.6 }, "eetcafe-koevoet-72933": { "pand": "NL.IMBAG.Pand.0363100012172933", "start": [4.885329, 52.379651], "end": [4.885252, 52.379636], "lengthM": 5.5, "alongM": 2.35 }, "eetcafe-t-pakhuis-75883": { "pand": "NL.IMBAG.Pand.0363100012175883", "start": [4.890693, 52.368168], "end": [4.890653, 52.368249], "lengthM": 9.42, "alongM": 5.73 }, "eetcafe-van-beeren-82699": { "pand": "NL.IMBAG.Pand.0363100012182699", "start": [4.90235, 52.372056], "end": [4.90226, 52.372107], "lengthM": 8.35, "alongM": 7.62 }, "eggs-benaddicted-72390": { "pand": "NL.IMBAG.Pand.0363100012172390", "start": [4.885071, 52.364332], "end": [4.884948, 52.364413], "lengthM": 12.31, "alongM": 9.83 }, "el-torado-grill-68110": { "pand": "NL.IMBAG.Pand.0363100012168110", "start": [4.89467, 52.366681], "end": [4.894742, 52.366659], "lengthM": 5.48, "alongM": 2.31 }, "ethiopisch-restaurant-addis-ababa-66610": { "pand": "NL.IMBAG.Pand.0363100012166610", "start": [4.864185, 52.359838], "end": [4.864281, 52.359675], "lengthM": 19.28, "alongM": 1.78 }, "fabian-78620": { "pand": "NL.IMBAG.Pand.0363100012178620", "start": [4.898717, 52.375002], "end": [4.898808, 52.374968], "lengthM": 7.26, "alongM": 1.11 }, "feduzzi-85026": { "pand": "NL.IMBAG.Pand.0363100012085026", "start": [4.891164, 52.345742], "end": [4.891152, 52.34566], "lengthM": 9.16, "alongM": 3.53 }, "fiaschetteria-pistoia-59698": { "pand": "NL.IMBAG.Pand.0363100012159698", "start": [4.893683, 52.355695], "end": [4.893745, 52.355706], "lengthM": 4.4, "alongM": 2.198809617172158 }, "fiaschetteria-pistoia-73112": { "pand": "NL.IMBAG.Pand.0363100012173112", "start": [4.884538, 52.380075], "end": [4.8846, 52.37992], "lengthM": 17.76, "alongM": 2.09 }, "fiko-80855": { "pand": "NL.IMBAG.Pand.0363100012080855", "start": [4.874267, 52.363885], "end": [4.873996, 52.364274], "lengthM": 47.05, "alongM": 18.51 }, "flore-68170": { "pand": "NL.IMBAG.Pand.0363100012168170", "start": [4.894053, 52.367579], "end": [4.894204, 52.367441], "lengthM": 18.48, "alongM": 21.02 }, "florentin-st-81813": { "pand": "NL.IMBAG.Pand.0363100012081813", "start": [4.897322, 52.356047], "end": [4.897559, 52.356118], "lengthM": 17.97, "alongM": 14.36 }, "flow-62418": { "pand": "NL.IMBAG.Pand.0363100012162418", "start": [4.889826, 52.357493], "end": [4.889914, 52.357488], "lengthM": 6.02, "alongM": 2.74 }, "fondue-fondue-53352": { "pand": "NL.IMBAG.Pand.0363100012153352", "start": [4.861302, 52.35905], "end": [4.861257, 52.359117], "lengthM": 8.06, "alongM": 5.36 }, "food-brothers-83027": { "pand": "NL.IMBAG.Pand.0363100012083027", "start": [4.912659, 52.350077], "end": [4.912776, 52.350129], "lengthM": 9.85, "alongM": 2.1 }, "fou-fow-ramen-73890": { "pand": "NL.IMBAG.Pand.0363100012173890", "start": [4.882302, 52.370297], "end": [4.882196, 52.370417], "lengthM": 15.18, "alongM": 1.86 }, "franggo-63278": { "pand": "NL.IMBAG.Pand.0363100012163278", "start": [4.897718, 52.356227], "end": [4.897881, 52.356276], "lengthM": 12.37, "alongM": 2.4 }, "fujitora-61426": { "pand": "NL.IMBAG.Pand.0363100012161426", "start": [4.896268, 52.356101], "end": [4.896189, 52.356079], "lengthM": 5.91, "alongM": 3.15 }, "fuku-ramen-63449": { "pand": "NL.IMBAG.Pand.0363100012063449", "start": [4.925761, 52.355172], "end": [4.925856, 52.355225], "lengthM": 8.76, "alongM": 4.38 }, "full-moon-garden-74474": { "pand": "NL.IMBAG.Pand.0363100012174474", "start": [4.8838897, 52.3646816], "end": [4.8837478, 52.3646165], "lengthM": 12.08, "alongM": 5.21 }, "gaja-korean-bbq-bar-67636": { "pand": "w240467636", "start": [4.9086458, 52.3757343], "end": [4.9086156, 52.3759372], "lengthM": 22.67, "alongM": 7.65 }, "gartine-75728": { "pand": "NL.IMBAG.Pand.0363100012175728", "start": [4.891419, 52.369219], "end": [4.89142, 52.369065], "lengthM": 17.14, "alongM": 1.81 }, "gebr-hartering-82661": { "pand": "NL.IMBAG.Pand.0363100012182661", "start": [4.907482, 52.37162], "end": [4.907566, 52.371655], "lengthM": 6.92, "alongM": 1.17 }, "golden-thali-50442": { "pand": "NL.IMBAG.Pand.0363100012150442", "start": [4.865717, 52.34681], "end": [4.865691, 52.34688], "lengthM": 7.99, "alongM": 2.56 }, "grieks-restaurant-plato-38635": { "pand": "NL.IMBAG.Pand.0363100012138635", "start": [4.813182, 52.374489], "end": [4.813022, 52.374504], "lengthM": 11.02, "alongM": 5.511401980029875 }, "hakata-senpachi-00201": { "pand": "NL.IMBAG.Pand.0363100012100201", "start": [4.889222, 52.344463], "end": [4.88937, 52.344455], "lengthM": 10.12, "alongM": 6.74, "outM": 0.75 }, "hannekes-boom-38899": { "pand": "NL.IMBAG.Pand.0363100012238899", "start": [4.911693, 52.376243], "end": [4.911666, 52.376341], "lengthM": 11.06, "alongM": 6.4 }, "hanoi-old-quarter-restaurant-65114": { "pand": "NL.IMBAG.Pand.0363100012165114", "start": [4.889693, 52.370349], "end": [4.889388, 52.37029], "lengthM": 21.78, "alongM": 4.45 }, "hans-im-gluck-51814": { "pand": "NL.IMBAG.Pand.0363100012251814", "start": [4.897472, 52.366377], "end": [4.897594, 52.366388], "lengthM": 8.4, "alongM": 0.39 }, "hap-hmm-63575": { "pand": "NL.IMBAG.Pand.0363100012163575", "start": [4.87624, 52.363702], "end": [4.876155, 52.363679], "lengthM": 6.33, "alongM": 2.53 }, "hap-li-90676": { "pand": "NL.IMBAG.Pand.0363100012090676", "start": [4.848256, 52.384048], "end": [4.848338, 52.384013], "lengthM": 6.81, "alongM": 2.84 }, "harmani-63659": { "pand": "NL.IMBAG.Pand.0363100012163659", "start": [4.888577, 52.354971], "end": [4.888561, 52.354881], "lengthM": 10.07, "alongM": 7.17 }, "havzan-37053": { "pand": "NL.IMBAG.Pand.0363100012137053", "start": [4.829837, 52.379916], "end": [4.829713, 52.379935], "lengthM": 8.7, "alongM": 3.76 }, "hawaiian-poke-bowl-37272": { "pand": "NL.IMBAG.Pand.0363100012237272", "start": [4.890505, 52.355099], "end": [4.890764, 52.355148], "lengthM": 18.47, "alongM": 3.65 }, "hayran-61341": { "pand": "NL.IMBAG.Pand.0363100012161341", "start": [4.894542, 52.352648], "end": [4.894721, 52.352673], "lengthM": 12.51, "alongM": 11.09 }, "hinata-72121": { "pand": "NL.IMBAG.Pand.0363100012172121", "start": [4.885007, 52.378941], "end": [4.885055, 52.378842], "lengthM": 11.49, "alongM": 10.48 }, "hoi-tin-77906": { "pand": "NL.IMBAG.Pand.0363100012177906", "start": [4.900167, 52.373361], "end": [4.900165, 52.373464], "lengthM": 11.46, "alongM": 7.37 }, "hummus-bistro-d-a-73434": { "pand": "NL.IMBAG.Pand.0363100012173434", "start": [4.882639, 52.378401], "end": [4.882704, 52.378413], "lengthM": 4.62, "alongM": 2.37 }, "hunkar-restaurant-16023": { "pand": "NL.IMBAG.Pand.0363100012116023", "start": [4.800949, 52.378357], "end": [4.801082, 52.378373], "lengthM": 9.23, "alongM": 3.62 }, "ibericus-amsterdam-79660": { "pand": "NL.IMBAG.Pand.0363100012179660", "start": [4.890813, 52.380408], "end": [4.890913, 52.380516], "lengthM": 13.81, "alongM": 12.15 }, "il-delfino-blu-36816": { "pand": "NL.IMBAG.Pand.0363100012136816", "start": [4.797224, 52.351666], "end": [4.798126, 52.351849], "lengthM": 64.74, "alongM": 4.83 }, "il-primo-68332": { "pand": "NL.IMBAG.Pand.0363100012168332", "start": [4.889578, 52.366761], "end": [4.889782, 52.366681], "lengthM": 16.5, "alongM": 12.8 }, "il-sogno-08857": { "pand": "NL.IMBAG.Pand.0363100012108857", "start": [4.993877, 52.356233], "end": [4.994441, 52.355931], "lengthM": 51.04, "alongM": 6.43 }, "il-tramezzino-68426": { "pand": "NL.IMBAG.Pand.0363100012168426", "start": [4.891551, 52.380324], "end": [4.891474, 52.380344], "lengthM": 5.7, "alongM": 3.67 }, "impero-romano-52924": { "pand": "NL.IMBAG.Pand.0363100012152924", "start": [4.904512, 52.35678], "end": [4.904467, 52.356869], "lengthM": 10.37, "alongM": 2.8 }, "incanto-79461": { "pand": "NL.IMBAG.Pand.0363100012179461", "start": [4.893759, 52.366996], "end": [4.89393, 52.36695], "lengthM": 12.72, "alongM": 5.37 }, "indrapura-78846": { "pand": "NL.IMBAG.Pand.0363100012178846", "start": [4.897084, 52.365778], "end": [4.89696, 52.365761], "lengthM": 8.66, "alongM": 2.27 }, "insieme-71619": { "pand": "NL.IMBAG.Pand.0363100012071619", "start": [4.891314, 52.346855], "end": [4.891298, 52.346736], "lengthM": 13.29, "alongM": 4.05, "outM": 0.55 }, "instock-amsterdam-69762": { "pand": "NL.IMBAG.Pand.0363100012169762", "start": [4.926264, 52.368471], "end": [4.926478, 52.368603], "lengthM": 20.69, "alongM": 24.12 }, "isshin-59354": { "pand": "NL.IMBAG.Pand.0363100012159354", "start": [4.888691, 52.357015], "end": [4.8887, 52.357068], "lengthM": 5.93, "alongM": 3.35 }, "italia-oggi-71755": { "pand": "NL.IMBAG.Pand.0363100012171755", "start": [4.90221, 52.37385], "end": [4.90228, 52.37382], "lengthM": 5.82, "alongM": 3.31 }, "jen-s-bing-81194": { "pand": "NL.IMBAG.Pand.0363100012181194", "start": [4.910655, 52.363879], "end": [4.910669, 52.36393], "lengthM": 5.75, "alongM": 2.25 }, "jinso-07340": { "pand": "NL.IMBAG.Pand.0363100012107340", "start": [4.944653, 52.312709], "end": [4.944772, 52.312676], "lengthM": 8.91, "alongM": 5.18, "outM": 0.25 }, "john-dory-68453": { "pand": "NL.IMBAG.Pand.0363100012168453", "start": [4.89381, 52.362101], "end": [4.893898, 52.362089], "lengthM": 6.14, "alongM": 2.93 }, "joselito-tapas-79619": { "pand": "NL.IMBAG.Pand.0363100012179619", "start": [4.89471, 52.3788], "end": [4.894662, 52.378842], "lengthM": 5.7, "alongM": 1.62 }, "jun-93249": { "pand": "NL.IMBAG.Pand.0363100012093249", "start": [4.873286, 52.375834], "end": [4.873319, 52.375884], "lengthM": 6, "alongM": 1.93 }, "kaagman-kortekaas-69080": { "pand": "NL.IMBAG.Pand.0363100012169080", "start": [4.89257, 52.374701], "end": [4.892533, 52.374855], "lengthM": 17.32, "alongM": 13.21 }, "kafe-kontrast-36508": { "pand": "NL.IMBAG.Pand.0363100012236508", "start": [4.889831, 52.352887], "end": [4.889889, 52.352741], "lengthM": 16.72, "alongM": 11.32, "outM": 0.25 }, "kamasutra-78550": { "pand": "NL.IMBAG.Pand.0363100012178550", "start": [4.898437, 52.375102], "end": [4.8985, 52.375081], "lengthM": 4.89, "alongM": 2.74 }, "kathmandu-kitchen-15728": { "pand": "NL.IMBAG.Pand.0363100012115728", "start": [4.854537, 52.369192], "end": [4.854728, 52.369219], "lengthM": 13.35, "alongM": 12.15 }, "kebaphan-69641": { "pand": "NL.IMBAG.Pand.0363100012069641", "start": [4.801549, 52.36257], "end": [4.801624, 52.362585], "lengthM": 5.37, "alongM": 2.687227603568641 }, "kebec-corner-13694": { "pand": "NL.IMBAG.Pand.0363100012113694", "start": [4.891612, 52.403731], "end": [4.891999, 52.403549], "lengthM": 33.22, "alongM": 29.22 }, "kerkzicht-29775": { "pand": "NL.IMBAG.Pand.0363100012129775", "start": [4.799742, 52.341403], "end": [4.799622, 52.34141], "lengthM": 8.21, "alongM": 3.97 }, "kilimanjaro-37317": { "pand": "NL.IMBAG.Pand.0363100012237317", "start": [4.918386, 52.356509], "end": [4.918325, 52.356591], "lengthM": 10.03, "alongM": 2.68 }, "kim-s-so-18480": { "pand": "NL.IMBAG.Pand.0363100012118480", "start": [4.924752, 52.361969], "end": [4.92438, 52.361889], "lengthM": 26.86, "alongM": 12.08 }, "klein-breda-78942": { "pand": "NL.IMBAG.Pand.0363100012178942", "start": [4.897516, 52.365626], "end": [4.897501, 52.365667], "lengthM": 4.67, "alongM": 3.06 }, "koeah-75819": { "pand": "NL.IMBAG.Pand.0363100012175819", "start": [4.890616, 52.374859], "end": [4.890821, 52.375028], "lengthM": 23.42, "alongM": 18.21 }, "kokohili-01213": { "pand": "NL.IMBAG.Pand.0363100012101213", "start": [4.884611, 52.324583], "end": [4.884617, 52.32447], "lengthM": 12.58, "alongM": 5.53 }, "kreeftenbar-12628": { "pand": "w460712628", "start": [4.892813, 52.3398224], "end": [4.8927946, 52.339674], "lengthM": 16.56, "alongM": 8.279631105808447 }, "kruabuppha-87294": { "pand": "NL.IMBAG.Pand.0363100012087294", "start": [4.904232, 52.349573], "end": [4.904255, 52.349509], "lengthM": 7.29, "alongM": 4.67 }, "kyo-82963": { "pand": "NL.IMBAG.Pand.0363100012182963", "start": [4.901975, 52.372352], "end": [4.902026, 52.372321], "lengthM": 4.89, "alongM": 2.91 }, "la-brasa-67816": { "pand": "NL.IMBAG.Pand.0363100012167816", "start": [4.888877, 52.381969], "end": [4.888737, 52.381875], "lengthM": 14.15, "alongM": 13.21 }, "la-bruschetta-87323": { "pand": "NL.IMBAG.Pand.0363100012087323", "start": [4.994678, 52.359484], "end": [4.995056, 52.359286], "lengthM": 33.89, "alongM": 22.55 }, "la-cacerola-71888": { "pand": "NL.IMBAG.Pand.0363100012171888", "start": [4.888737, 52.361076], "end": [4.888722, 52.361034], "lengthM": 4.78, "alongM": 2.84 }, "la-cantina-79571": { "pand": "NL.IMBAG.Pand.0363100012079571", "start": [4.804113, 52.400301], "end": [4.804079, 52.400396], "lengthM": 10.82, "alongM": 8.58, "outM": 0.25 }, "la-fucina-81789": { "pand": "w278381789", "start": [4.9360337, 52.3638576], "end": [4.9361219, 52.3638585], "lengthM": 6.01, "alongM": 2.94 }, "la-maschera-68857": { "pand": "NL.IMBAG.Pand.0363100012168857", "start": [4.881429, 52.377797], "end": [4.881407, 52.377831], "lengthM": 4.07, "alongM": 2.21 }, "la-oliva-pintxos-y-vinos-72953": { "pand": "NL.IMBAG.Pand.0363100012172953", "start": [4.882137, 52.376774], "end": [4.8822, 52.376663], "lengthM": 13.07, "alongM": 10.52 }, "la-paella-78816": { "pand": "NL.IMBAG.Pand.0363100012178816", "start": [4.898482, 52.375524], "end": [4.898438, 52.375492], "lengthM": 4.65, "alongM": 2.42 }, "la-perla-72878": { "pand": "NL.IMBAG.Pand.0363100012172878", "start": [4.881905, 52.376991], "end": [4.881855, 52.377072], "lengthM": 9.63, "alongM": 8.04 }, "la-piazza-65128": { "pand": "NL.IMBAG.Pand.0363100012165128", "start": [4.8916104, 52.3726618], "end": [4.8914159, 52.3726557], "lengthM": 13.26, "alongM": 2.69 }, "la-polpetta-31526": { "pand": "NL.IMBAG.Pand.0363100012131526", "start": [4.853964, 52.358278], "end": [4.85418, 52.358212], "lengthM": 16.45, "alongM": 1.62 }, "la-reinita-empanadas-73572": { "pand": "NL.IMBAG.Pand.0363100012173572", "start": [4.883296, 52.37862], "end": [4.883341, 52.378531], "lengthM": 10.37, "alongM": 8.87 }, "la-roma-81243": { "pand": "NL.IMBAG.Pand.0363100012181243", "start": [4.911697, 52.36613], "end": [4.91166, 52.366091], "lengthM": 5.02, "alongM": 2.5090288532145038 }, "la-ruelle-54949": { "pand": "NL.IMBAG.Pand.0457100000054949", "start": [5.040445, 52.308291], "end": [5.040367, 52.308292], "lengthM": 5.32, "alongM": 2.6603617752035027 }, "ladybird-fried-chicken-54143": { "pand": "NL.IMBAG.Pand.0363100012154143", "start": [4.893653, 52.354386], "end": [4.893468, 52.354358], "lengthM": 12.98, "alongM": 3.45 }, "le-4-stagioni-57247": { "pand": "NL.IMBAG.Pand.0363100012157247", "start": [4.875434, 52.35545], "end": [4.875509, 52.355625], "lengthM": 20.13, "alongM": 7.89 }, "le-sud-76570": { "pand": "NL.IMBAG.Pand.0363100012176570", "start": [4.886384, 52.383407], "end": [4.886214, 52.383288], "lengthM": 17.59, "alongM": 15.38 }, "lemoene-33308": { "pand": "NL.IMBAG.Pand.0363100012133308", "start": [4.840784, 52.359637], "end": [4.84116, 52.359642], "lengthM": 25.62, "alongM": 10.35 }, "leonardo-s-ravioli-bar-59331": { "pand": "NL.IMBAG.Pand.0363100012159331", "start": [4.893284, 52.354584], "end": [4.89348, 52.354617], "lengthM": 13.85, "alongM": 10.15 }, "les-zazous-79884": { "pand": "r3679884", "start": [4.9410815, 52.3765629], "end": [4.9417458, 52.3764269], "lengthM": 47.7, "alongM": 30.43 }, "leziz-71219": { "pand": "NL.IMBAG.Pand.0363100012071219", "start": [4.798499, 52.351569], "end": [4.798021, 52.351473], "lengthM": 34.27, "alongM": 13.28 }, "little-chinatown-asian-cuisine-19312": { "pand": "w1488019312", "start": [4.9512959, 52.3135851], "end": [4.9503583, 52.3132631], "lengthM": 73.29, "alongM": 19.68 }, "little-saigon-68107": { "pand": "NL.IMBAG.Pand.0363100012068107", "start": [4.925412, 52.387153], "end": [4.925488, 52.387124], "lengthM": 6.1, "alongM": 4.04 }, "lloyd-hotel-18149": { "pand": "NL.IMBAG.Pand.0363100012118149", "start": [4.934333, 52.37419], "end": [4.934631, 52.374146], "lengthM": 20.88, "alongM": 27.89, "outM": 0.25 }, "lokaal-van-de-stad-40908": { "pand": "NL.IMBAG.Pand.0363100012140908", "start": [4.846136, 52.351807], "end": [4.846138, 52.351699], "lengthM": 12.02, "alongM": 11.09 }, "lombardo-s-77099": { "pand": "NL.IMBAG.Pand.0363100012177099", "start": [4.88861, 52.363568], "end": [4.888691, 52.363517], "lengthM": 7.91, "alongM": 6.06 }, "long-pura-70087": { "pand": "NL.IMBAG.Pand.0363100012170087", "start": [4.8811, 52.373639], "end": [4.881155, 52.373653], "lengthM": 4.06, "alongM": 2.028239166137245 }, "loulou-pizzabar-57281": { "pand": "NL.IMBAG.Pand.0363100012157281", "start": [4.907455, 52.355747], "end": [4.907725, 52.355808], "lengthM": 19.61, "alongM": 3.78 }, "lucca-due-80345": { "pand": "NL.IMBAG.Pand.0363100012180345", "start": [4.890056, 52.381133], "end": [4.890132, 52.381088], "lengthM": 7.2, "alongM": 1.95 }, "lucius-75671": { "pand": "NL.IMBAG.Pand.0363100012175671", "start": [4.889322, 52.370789], "end": [4.88931, 52.370727], "lengthM": 6.95, "alongM": 3.01 }, "lucky-house-73005": { "pand": "NL.IMBAG.Pand.0363100012173005", "start": [4.885253, 52.3814], "end": [4.885324, 52.381411], "lengthM": 4.99, "alongM": 2.17 }, "luna-73311": { "pand": "NL.IMBAG.Pand.0363100012173311", "start": [4.884449, 52.38032], "end": [4.884527, 52.380331], "lengthM": 5.45, "alongM": 2.65 }, "lupe-72083": { "pand": "NL.IMBAG.Pand.0363100012072083", "start": [4.857779, 52.381976], "end": [4.85767, 52.382038], "lengthM": 10.13, "alongM": 2.46 }, "made-s-warung-26789": { "pand": "NL.IMBAG.Pand.0363100012126789", "start": [4.863762, 52.351387], "end": [4.863666, 52.351362], "lengthM": 7.11, "alongM": 4.54 }, "maenaam-thai-75826": { "pand": "NL.IMBAG.Pand.0363100012175826", "start": [4.891103, 52.375235], "end": [4.891159, 52.375277], "lengthM": 6.03, "alongM": 1.77 }, "makachi-64043": { "pand": "NL.IMBAG.Pand.0363100012164043", "start": [4.890147, 52.355783], "end": [4.890377, 52.35577], "lengthM": 15.74, "alongM": 13.86 }, "mama-makan-43487": { "pand": "NL.IMBAG.Pand.0363100012243487", "start": [4.912115, 52.3616], "end": [4.912301, 52.361783], "lengthM": 23.98, "alongM": 21.33 }, "mamas-tapas-63129": { "pand": "NL.IMBAG.Pand.0363100012163129", "start": [4.873306, 52.374729], "end": [4.873468, 52.374772], "lengthM": 12.02, "alongM": 2.26 }, "mangia-pizza-centrum-75482": { "pand": "NL.IMBAG.Pand.0363100012175482", "start": [4.891505, 52.360974], "end": [4.891695, 52.360953], "lengthM": 13.15, "alongM": 3.02 }, "mangiancora-65866": { "pand": "NL.IMBAG.Pand.0363100012165866", "start": [4.891224, 52.351691], "end": [4.891227, 52.351744], "lengthM": 5.9, "alongM": 2.7 }, "maris-piper-brasserie-36608": { "pand": "NL.IMBAG.Pand.0363100012236608", "start": [4.888439, 52.355712], "end": [4.888274, 52.355722], "lengthM": 11.3, "alongM": 0.4 }, "marmaris-grill-pizza-73393": { "pand": "NL.IMBAG.Pand.0363100012073393", "start": [4.948723, 52.313194], "end": [4.948981, 52.312913], "lengthM": 35.88, "alongM": 22.58 }, "maydanoz-56807": { "pand": "NL.IMBAG.Pand.0363100012156807", "start": [4.887286, 52.352415], "end": [4.887374, 52.352427], "lengthM": 6.14, "alongM": 2.83 }, "mchi-42337": { "pand": "NL.IMBAG.Pand.0363100012142337", "start": [4.9977978, 52.3541433], "end": [4.9990139, 52.3534963], "lengthM": 109.76, "alongM": 9.31 }, "meghna-78969": { "pand": "NL.IMBAG.Pand.0363100012178969", "start": [4.897947, 52.364521], "end": [4.89793, 52.364567], "lengthM": 5.25, "alongM": 2.6 }, "men-impossible-69882": { "pand": "NL.IMBAG.Pand.0363100012169882", "start": [4.879929, 52.370712], "end": [4.879958, 52.37067], "lengthM": 5.07, "alongM": 2.94 }, "merza-45331": { "pand": "NL.IMBAG.Pand.0363100012145331", "start": [5.002333, 52.351734], "end": [5.002405, 52.351687], "lengthM": 7.17, "alongM": 3.5850985585667123 }, "mesken-56710": { "pand": "NL.IMBAG.Pand.0363100012156710", "start": [4.936041, 52.363528], "end": [4.935764, 52.363525], "lengthM": 18.87, "alongM": 13.55 }, "middl-eat-67960": { "pand": "NL.IMBAG.Pand.0363100012167960", "start": [4.889943, 52.36662], "end": [4.89, 52.366597], "lengthM": 4.65, "alongM": 1.68 }, "miko-s-28387": { "pand": "w464728387", "start": [4.9639846, 52.3736345], "end": [4.9643906, 52.3739205], "lengthM": 42.16, "alongM": 27.8 }, "mima-09184": { "pand": "NL.IMBAG.Pand.0363100012109184", "start": [4.871243, 52.33787], "end": [4.870911, 52.337857], "lengthM": 22.67, "alongM": 2.71 }, "mirchi-63270": { "pand": "NL.IMBAG.Pand.0363100012163270", "start": [4.935217, 52.363513], "end": [4.935209, 52.363626], "lengthM": 12.58, "alongM": 8.61 }, "miri-mary-83742": { "pand": "NL.IMBAG.Pand.0363100012083742", "start": [4.895163, 52.351539], "end": [4.895346, 52.351574], "lengthM": 13.06, "alongM": 1.94, "outM": 0.75 }, "moak-pancakes-19677": { "pand": "w277219677", "start": [4.8907204, 52.3565402], "end": [4.890712, 52.3564878], "lengthM": 5.86, "alongM": 4.26 }, "moche-67178": { "pand": "NL.IMBAG.Pand.0363100012167178", "start": [4.929092, 52.355285], "end": [4.929015, 52.355251], "lengthM": 6.47, "alongM": 3.68 }, "mogu-amsterdam-89620": { "pand": "NL.IMBAG.Pand.0363100012089620", "start": [4.854328, 52.381015], "end": [4.854412, 52.380967], "lengthM": 7.83, "alongM": 3.7 }, "momo-tibet-57116": { "pand": "NL.IMBAG.Pand.0363100012157116", "start": [4.902616, 52.355101], "end": [4.90255, 52.35508], "lengthM": 5.07, "alongM": 1.71 }, "mont-blanc-66374": { "pand": "NL.IMBAG.Pand.0363100012166374", "start": [4.898458, 52.35628], "end": [4.898379, 52.356257], "lengthM": 5.96, "alongM": 3.09 }, "moon-68473": { "pand": "w593068473", "start": [4.9018239, 52.3839369], "end": [4.9020599, 52.3837415], "lengthM": 27.03, "alongM": 16.87 }, "moshik-06274": { "pand": "w1487606274", "start": [4.9059951, 52.3764155], "end": [4.9060828, 52.3762416], "lengthM": 20.25, "alongM": 11.5, "outM": 0.55 }, "mount-everest-05308": { "pand": "NL.IMBAG.Pand.0363100012105308", "start": [4.912647, 52.383799], "end": [4.912935, 52.383765], "lengthM": 19.97, "alongM": 15.05 }, "mr-gyoza-61236": { "pand": "NL.IMBAG.Pand.0363100012161236", "start": [4.865239, 52.361177], "end": [4.865305, 52.361068], "lengthM": 12.93, "alongM": 9.5 }, "mr-sushi-54293": { "pand": "NL.IMBAG.Pand.0457100000054293", "start": [5.041926, 52.307533], "end": [5.041949, 52.307495], "lengthM": 4.51, "alongM": 2.2548142897107146 }, "muang-thai-66837": { "pand": "NL.IMBAG.Pand.0363100012166837", "start": [4.859084, 52.358549], "end": [4.859142, 52.358463], "lengthM": 10.35, "alongM": 2.42 }, "mudavim-58188": { "pand": "NL.IMBAG.Pand.0363100012158188", "start": [4.893363, 52.355227], "end": [4.893525, 52.355256], "lengthM": 11.5, "alongM": 2.8 }, "my-surinaamse-broodjes-36700": { "pand": "NL.IMBAG.Pand.0363100012236700", "start": [4.863338, 52.363518], "end": [4.863294, 52.363589], "lengthM": 8.45, "alongM": 2.22 }, "mythos-69645": { "pand": "NL.IMBAG.Pand.0363100012169645", "start": [4.884201, 52.36429], "end": [4.884244, 52.364261], "lengthM": 4.36, "alongM": 2.01 }, "naa-thai-63810": { "pand": "NL.IMBAG.Pand.0363100012163810", "start": [4.893745, 52.353977], "end": [4.89392, 52.354002], "lengthM": 12.24, "alongM": 8.2 }, "nap-amsterdam-83408": { "pand": "NL.IMBAG.Pand.0363100012083408", "start": [5.004378, 52.35237], "end": [5.003317, 52.352934], "lengthM": 95.73, "alongM": 91.77 }, "nara-nara-81960": { "pand": "NL.IMBAG.Pand.0363100012081960", "start": [4.928472, 52.362147], "end": [4.928259, 52.362099], "lengthM": 15.46, "alongM": 11.44 }, "nefis-etli-ekmek-59658": { "pand": "NL.IMBAG.Pand.0363100012159658", "start": [4.926301, 52.362294], "end": [4.926222, 52.362278], "lengthM": 5.67, "alongM": 3.16 }, "nikotin-19058": { "pand": "NL.IMBAG.Pand.0363100012119058", "start": [4.922388, 52.384015], "end": [4.922151, 52.383987], "lengthM": 16.43, "alongM": 13.96 }, "nk-thai-noodles-68178": { "pand": "NL.IMBAG.Pand.0363100012168178", "start": [4.893194, 52.359593], "end": [4.893301, 52.359586], "lengthM": 7.33, "alongM": 1.7 }, "nnea-pizza-66802": { "pand": "NL.IMBAG.Pand.0363100012166802", "start": [4.870444, 52.369415], "end": [4.870417, 52.369466], "lengthM": 5.97, "alongM": 3.95 }, "no-man-s-art-gallery-94050": { "pand": "NL.IMBAG.Pand.0363100012094050", "start": [4.855336, 52.382362], "end": [4.855331, 52.382472], "lengthM": 12.24, "alongM": 1.25 }, "noemi-37240": { "pand": "NL.IMBAG.Pand.0363100012237240", "start": [4.899659, 52.357308], "end": [4.899923, 52.357386], "lengthM": 19.97, "alongM": 16.76 }, "nom-nom-vietnamese-foodshop-73355": { "pand": "NL.IMBAG.Pand.0363100012073355", "start": [4.851124, 52.350744], "end": [4.85112, 52.350921], "lengthM": 19.7, "alongM": 18.48 }, "nonna-06423": { "pand": "NL.IMBAG.Pand.0363100012106423", "start": [4.863759, 52.362828], "end": [4.863585, 52.362785], "lengthM": 12.78, "alongM": -0.25 }, "northeast-kitchen-67017": { "pand": "NL.IMBAG.Pand.0363100012167017", "start": [4.890521, 52.356665], "end": [4.890169, 52.356684], "lengthM": 24.07, "alongM": 2.77 }, "nyonya-78393": { "pand": "NL.IMBAG.Pand.0363100012178393", "start": [4.898476, 52.371344], "end": [4.898659, 52.371293], "lengthM": 13.69, "alongM": 10.15 }, "o-bistro-68625": { "pand": "NL.IMBAG.Pand.0363100012168625", "start": [4.882656, 52.380052], "end": [4.882737, 52.380064], "lengthM": 5.67, "alongM": 2.8372855791686242 }, "o-mai-vietnamees-restaurant-78850": { "pand": "NL.IMBAG.Pand.0363100012178850", "start": [4.897349, 52.365474], "end": [4.897562, 52.365508], "lengthM": 14.99, "alongM": 9.32 }, "o-sole-mio-68570": { "pand": "NL.IMBAG.Pand.0363100012168570", "start": [4.884051, 52.364395], "end": [4.884107, 52.364357], "lengthM": 5.69, "alongM": 2.16 }, "obalade-suya-55235": { "pand": "NL.IMBAG.Pand.0363100012155235", "start": [4.854178, 52.358213], "end": [4.85438, 52.358152], "lengthM": 15.34, "alongM": 11.2 }, "oceania-40557": { "pand": "NL.IMBAG.Pand.0363100012140557", "start": [4.891128, 52.345485], "end": [4.891116, 52.345398], "lengthM": 9.71, "alongM": 7.69 }, "ode-aan-de-amstel-40353": { "pand": "NL.IMBAG.Pand.0363100012240353", "start": [4.915036, 52.343335], "end": [4.914927, 52.343517], "lengthM": 21.57, "alongM": 10.02, "outM": 0.35 }, "olijfje-65616": { "pand": "NL.IMBAG.Pand.0363100012165616", "start": [4.9061839, 52.3691185], "end": [4.905374, 52.368812], "lengthM": 64.85, "alongM": 54.74 }, "omahe-72216": { "pand": "NL.IMBAG.Pand.0363100012072216", "start": [4.886873, 52.349943], "end": [4.886873, 52.349875], "lengthM": 7.57, "alongM": 7.24 }, "omg-burger-79311": { "pand": "NL.IMBAG.Pand.0363100012179311", "start": [4.893786, 52.376135], "end": [4.893704, 52.376076], "lengthM": 8.62, "alongM": 6.83 }, "ons-dorpje-21431": { "pand": "NL.IMBAG.Pand.0363100012121431", "start": [4.8024, 52.358478], "end": [4.800629, 52.35812], "lengthM": 127.05, "alongM": 14.34 }, "oresti-s-taverna-62627": { "pand": "NL.IMBAG.Pand.0363100012162627", "start": [4.878418, 52.363483], "end": [4.878306, 52.363448], "lengthM": 8.57, "alongM": 4.22 }, "oriental-city-78751": { "pand": "NL.IMBAG.Pand.0363100012178751", "start": [4.896184, 52.37181], "end": [4.896428, 52.371721], "lengthM": 19.34, "alongM": 6.27 }, "osteria-bella-ciao-73586": { "pand": "NL.IMBAG.Pand.0363100012073586", "start": [4.8549627, 52.3451382], "end": [4.8561322, 52.3452935], "lengthM": 81.55, "alongM": 3.86 }, "otaru-91498": { "pand": "NL.IMBAG.Pand.0363100012091498", "start": [4.88891, 52.358358], "end": [4.888932, 52.358485], "lengthM": 14.21, "alongM": 4.1 }, "otemba-61722": { "pand": "NL.IMBAG.Pand.0363100012161722", "start": [4.899752, 52.357088], "end": [4.899815, 52.356947], "lengthM": 16.26, "alongM": 6.79 }, "otemba-ramen-36441": { "pand": "NL.IMBAG.Pand.0363100012236441", "start": [4.873108, 52.367615], "end": [4.873023, 52.367737], "lengthM": 14.76, "alongM": 0.66 }, "pad-thai-72000": { "pand": "NL.IMBAG.Pand.0363100012172000", "start": [4.900277, 52.373574], "end": [4.900277, 52.373534], "lengthM": 4.45, "alongM": 4.27 }, "paik-s-noodle-75231": { "pand": "NL.IMBAG.Pand.0363100012175231", "start": [4.892547, 52.368022], "end": [4.89236, 52.367938], "lengthM": 15.8, "alongM": 1.28 }, "palladio-70190": { "pand": "NL.IMBAG.Pand.0363100012170190", "start": [4.881135, 52.369909], "end": [4.88121, 52.369935], "lengthM": 5.87, "alongM": 2.62 }, "paloma-blanca-60566": { "pand": "NL.IMBAG.Pand.0363100012160566", "start": [4.865194, 52.361365], "end": [4.865058, 52.36133], "lengthM": 10.05, "alongM": 8.97 }, "pancakes-amsterdam-aan-t-ij-77894": { "pand": "NL.IMBAG.Pand.0363100012177894", "start": [4.900037, 52.380606], "end": [4.899934, 52.380507], "lengthM": 13.06, "alongM": 4.22 }, "pannenkoekerij-gansi-87577": { "pand": "NL.IMBAG.Pand.0363100012187577", "start": [4.971327, 52.323178], "end": [4.971423, 52.323194], "lengthM": 6.78, "alongM": 2.77 }, "papa-ali-mix-grill-82440": { "pand": "NL.IMBAG.Pand.0363100012182440", "start": [4.902957, 52.375628], "end": [4.902973, 52.375671], "lengthM": 4.91, "alongM": 2.53 }, "pasta-e-pizza-62433": { "pand": "NL.IMBAG.Pand.0363100012162433", "start": [4.89958, 52.357479], "end": [4.899604, 52.357425], "lengthM": 6.23, "alongM": 3.27 }, "pasta-paradijs-52857": { "pand": "NL.IMBAG.Pand.0363100012152857", "start": [4.85704, 52.351543], "end": [4.856964, 52.351525], "lengthM": 5.55, "alongM": 1.74 }, "pastai-60962": { "pand": "NL.IMBAG.Pand.0363100012160962", "start": [4.863883, 52.362666], "end": [4.863623, 52.362604], "lengthM": 19.01, "alongM": 1.89 }, "pastini-72218": { "pand": "NL.IMBAG.Pand.0363100012172218", "start": [4.884668, 52.366659], "end": [4.884595, 52.366633], "lengthM": 5.75, "alongM": 2.08 }, "pata-negra-71777": { "pand": "NL.IMBAG.Pand.0363100012171777", "start": [4.899147, 52.361443], "end": [4.898865, 52.361387], "lengthM": 20.19, "alongM": 3.96 }, "pepenero-64223": { "pand": "NL.IMBAG.Pand.0363100012064223", "start": [4.907721, 52.355706], "end": [4.907825, 52.355731], "lengthM": 7.61, "alongM": 7.52 }, "pepenero-cucina-pizza-99914": { "pand": "NL.IMBAG.Pand.0363100012099914", "start": [4.92569, 52.379517], "end": [4.925529, 52.379545], "lengthM": 11.4, "alongM": 5.698314320263723 }, "peperoncino-84094": { "pand": "NL.IMBAG.Pand.0363100012084094", "start": [4.894791, 52.345551], "end": [4.894764, 52.345634], "lengthM": 9.42, "alongM": 5.44 }, "perla-di-roma-48686": { "pand": "NL.IMBAG.Pand.0363100012148686", "start": [4.827607, 52.358419], "end": [4.827806, 52.358421], "lengthM": 13.56, "alongM": 6.779141516096965 }, "petit-caron-73912": { "pand": "NL.IMBAG.Pand.0363100012073912", "start": [4.88881, 52.35775], "end": [4.888819, 52.357806], "lengthM": 6.26, "alongM": 2.71 }, "pho-viet-76172": { "pand": "NL.IMBAG.Pand.0363100012176172", "start": [4.889008, 52.381723], "end": [4.889117, 52.381796], "lengthM": 11, "alongM": 0.79 }, "pica-pica-90102": { "pand": "NL.IMBAG.Pand.0363100012090102", "start": [4.913512, 52.357762], "end": [4.91343, 52.357886], "lengthM": 14.88, "alongM": 7.4424315332942985 }, "picchino-53915": { "pand": "NL.IMBAG.Pand.0363100012253915", "start": [4.885047, 52.363321], "end": [4.884868, 52.363218], "lengthM": 16.73, "alongM": 15.76 }, "pide-dunyas-78723": { "pand": "NL.IMBAG.Pand.0363100012078723", "start": [4.85344, 52.364434], "end": [4.853639, 52.364436], "lengthM": 13.56, "alongM": -0.17 }, "piet-de-leeuw-80082": { "pand": "NL.IMBAG.Pand.0363100012180082", "start": [4.892087, 52.361499], "end": [4.892176, 52.361487], "lengthM": 6.21, "alongM": 3.36 }, "pizza-project-64561": { "pand": "NL.IMBAG.Pand.0363100012164561", "start": [4.861111, 52.360996], "end": [4.861164, 52.360913], "lengthM": 9.92, "alongM": 4.957826436949626 }, "pizza-project-bar-69760": { "pand": "NL.IMBAG.Pand.0363100012169760", "start": [4.925362, 52.367869], "end": [4.925491, 52.367869], "lengthM": 8.79, "alongM": 1.01 }, "pizza-taxi-da-paolo-seba-66100": { "pand": "NL.IMBAG.Pand.0363100012166100", "start": [4.892543, 52.35312], "end": [4.892629, 52.353131], "lengthM": 5.99, "alongM": 2.94 }, "pizzeria-steakhouse-ijburg-80574": { "pand": "NL.IMBAG.Pand.0363100012080574", "start": [5.007227, 52.352156], "end": [5.007323, 52.352186], "lengthM": 7.34, "alongM": 3.19 }, "plato-loco-19305": { "pand": "NL.IMBAG.Pand.0363100012119305", "start": [4.874056, 52.378024], "end": [4.874242, 52.37798], "lengthM": 13.58, "alongM": 1.09 }, "proper-indofood-75795": { "pand": "NL.IMBAG.Pand.0363100012175795", "start": [4.890945, 52.360889], "end": [4.890781, 52.360907], "lengthM": 11.35, "alongM": 2.03 }, "rainbowls-35465": { "pand": "NL.IMBAG.Pand.0363100012135465", "start": [4.888509, 52.35697], "end": [4.888681, 52.356961], "lengthM": 11.76, "alongM": 8.94 }, "ramen-city-37023": { "pand": "NL.IMBAG.Pand.0363100012237023", "start": [4.890037, 52.355888], "end": [4.890393, 52.355868], "lengthM": 24.35, "alongM": 22.55 }, "ramen-ism-78019": { "pand": "NL.IMBAG.Pand.0363100012178019", "start": [4.898939, 52.374923], "end": [4.899002, 52.374899], "lengthM": 5.05, "alongM": 3.68 }, "rangla-punjab-61813": { "pand": "NL.IMBAG.Pand.0363100012161813", "start": [4.865929, 52.360527], "end": [4.866005, 52.360544], "lengthM": 5.51, "alongM": 2.52 }, "rasoi-74500": { "pand": "NL.IMBAG.Pand.0363100012074500", "start": [4.895, 52.347424], "end": [4.895008, 52.347486], "lengthM": 6.92, "alongM": 4.35 }, "reijnders-68746": { "pand": "NL.IMBAG.Pand.0363100012168746", "start": [4.882841, 52.364626], "end": [4.882901, 52.364585], "lengthM": 6.12, "alongM": 3.66 }, "renato-s-osteria-32916": { "pand": "NL.IMBAG.Pand.0363100012132916", "start": [4.895216, 52.351481], "end": [4.8954, 52.351507], "lengthM": 12.87, "alongM": -0.29 }, "restaurant-212-71575": { "pand": "NL.IMBAG.Pand.0363100012171575", "start": [4.900185, 52.365796], "end": [4.900336, 52.365825], "lengthM": 10.78, "alongM": 7.61 }, "restaurant-asian-fantasy-14927": { "pand": "r20314927", "start": [4.9544945, 52.3152335], "end": [4.9547859, 52.315331], "lengthM": 22.64, "alongM": 19.33 }, "restaurant-bonjour-78788": { "pand": "NL.IMBAG.Pand.0363100012178788", "start": [4.8988, 52.363669], "end": [4.898744, 52.363657], "lengthM": 4.04, "alongM": 2.21 }, "restaurant-ja-36832": { "pand": "NL.IMBAG.Pand.0363100012236832", "start": [4.898197, 52.355731], "end": [4.898284, 52.35562], "lengthM": 13.7, "alongM": 10.67 }, "restaurant-klaproos-35403": { "pand": "NL.IMBAG.Pand.0363100012135403", "start": [4.912104, 52.393629], "end": [4.91218, 52.393702], "lengthM": 9.63, "alongM": 3.99 }, "restaurant-lastage-82260": { "pand": "NL.IMBAG.Pand.0363100012182260", "start": [4.902362, 52.375449], "end": [4.902518, 52.375381], "lengthM": 13.04, "alongM": 1.59 }, "restaurant-sallora-51279": { "pand": "NL.IMBAG.Pand.0363100012251279", "start": [4.805527, 52.357823], "end": [4.804878, 52.357693], "lengthM": 46.52, "alongM": 6.89 }, "restaurant-shiva-79404": { "pand": "NL.IMBAG.Pand.0363100012179404", "start": [4.893568, 52.365981], "end": [4.893497, 52.365991], "lengthM": 4.96, "alongM": 2.83 }, "ricardo-s-63107": { "pand": "NL.IMBAG.Pand.0363100012163107", "start": [4.933347, 52.364001], "end": [4.933414, 52.36378], "lengthM": 25.01, "alongM": 21.78 }, "rijnbar-80338": { "pand": "NL.IMBAG.Pand.0363100012080338", "start": [4.904721, 52.348867], "end": [4.904536, 52.348841], "lengthM": 12.93, "alongM": 12.89 }, "rijsel-36544": { "pand": "NL.IMBAG.Pand.0363100012236544", "start": [4.912999, 52.351673], "end": [4.912425, 52.351462], "lengthM": 45.61, "alongM": 13.22 }, "ristorante-papa-carlo-82585": { "pand": "NL.IMBAG.Pand.0363100012182585", "start": [4.899993, 52.371925], "end": [4.899961, 52.371891], "lengthM": 4.37, "alongM": 2.24 }, "ristorante-pizzeria-monte-verde-65953": { "pand": "NL.IMBAG.Pand.0363100012165953", "start": [4.88722, 52.354848], "end": [4.887229, 52.354729], "lengthM": 13.25, "alongM": 12.33 }, "ron-gastrobar-32011": { "pand": "NL.IMBAG.Pand.0363100012132011", "start": [4.856618, 52.352212], "end": [4.856747, 52.352082], "lengthM": 16.93, "alongM": 14.34 }, "roopram-roti-55550": { "pand": "NL.IMBAG.Pand.0363100012155550", "start": [4.92486, 52.361991], "end": [4.924752, 52.361969], "lengthM": 7.75, "alongM": 3.47 }, "rossi-sandwiches-31005": { "pand": "NL.IMBAG.Pand.0363100012131005", "start": [4.895564, 52.34518], "end": [4.895722, 52.345202], "lengthM": 11.04, "alongM": 1.08 }, "roum-cafe-61185": { "pand": "NL.IMBAG.Pand.0363100012161185", "start": [4.890261, 52.354068], "end": [4.890375, 52.354085], "lengthM": 7.99, "alongM": 3.75 }, "royal-fook-long-42162": { "pand": "NL.IMBAG.Pand.0363100012142162", "start": [4.809835, 52.34524], "end": [4.810187, 52.345311], "lengthM": 25.25, "alongM": 16.32 }, "royal98-53823": { "pand": "NL.IMBAG.Pand.0363100012253823", "start": [4.893061, 52.373546], "end": [4.893206, 52.373477], "lengthM": 12.51, "alongM": 7.78 }, "royalvis-traiteur-18311": { "pand": "NL.IMBAG.Pand.0363100012118311", "start": [4.909942, 52.389572], "end": [4.910025, 52.389687], "lengthM": 13.99, "alongM": 2.94 }, "rue-la-bastille-77670": { "pand": "NL.IMBAG.Pand.0363100012177670", "start": [4.887414, 52.382616], "end": [4.887462, 52.382588], "lengthM": 4.52, "alongM": 2.2575729883242173 }, "rufus-restaurant-57012": { "pand": "NL.IMBAG.Pand.0363100012157012", "start": [4.883777, 52.352322], "end": [4.883628, 52.35235], "lengthM": 10.62, "alongM": 5.79 }, "sab-s-deli-36070": { "pand": "NL.IMBAG.Pand.0363100012136070", "start": [4.889835, 52.344436], "end": [4.889965, 52.344484], "lengthM": 10.34, "alongM": 4.99, "outM": 0.85 }, "sababa-58581": { "pand": "NL.IMBAG.Pand.0363100012158581", "start": [4.888471, 52.354515], "end": [4.888345, 52.354489], "lengthM": 9.06, "alongM": 12.43 }, "saeed-s-curry-house-54207": { "pand": "NL.IMBAG.Pand.0363100012154207", "start": [4.931923, 52.363744], "end": [4.93193, 52.363597], "lengthM": 16.36, "alongM": 11.51 }, "sagardi-72053": { "pand": "NL.IMBAG.Pand.0363100012172053", "start": [4.888676, 52.369394], "end": [4.888691, 52.369437], "lengthM": 4.89, "alongM": 2.4461357711788314 }, "sahan-92837": { "pand": "NL.IMBAG.Pand.0363100012092837", "start": [4.800224, 52.358386], "end": [4.800391, 52.35842], "lengthM": 11.99, "alongM": -3.01 }, "salento-latino-78584": { "pand": "NL.IMBAG.Pand.0363100012078584", "start": [4.8746862, 52.326071], "end": [4.8746989, 52.3258179], "lengthM": 28.17, "alongM": -3.42 }, "salvatorica-74729": { "pand": "NL.IMBAG.Pand.0363100012174729", "start": [4.878937, 52.377009], "end": [4.878835, 52.376842], "lengthM": 19.84, "alongM": 16.58 }, "sama-sebo-65990": { "pand": "NL.IMBAG.Pand.0363100012165990", "start": [4.883001, 52.360803], "end": [4.883131, 52.360624], "lengthM": 21.8, "alongM": 16.76 }, "samba-kitchen-59252": { "pand": "NL.IMBAG.Pand.0363100012159252", "start": [4.889562, 52.35272], "end": [4.889641, 52.35273], "lengthM": 5.5, "alongM": 2.56 }, "sapporo-ramen-sora-35936": { "pand": "NL.IMBAG.Pand.0363100012235936", "start": [4.888695, 52.352604], "end": [4.888754, 52.352611], "lengthM": 4.09, "alongM": 2.0472646369359233 }, "scheltema-67522": { "pand": "NL.IMBAG.Pand.0363100012167522", "start": [4.890406, 52.372066], "end": [4.8904, 52.372123], "lengthM": 6.36, "alongM": 3.1776455069771976 }, "schiller-78854": { "pand": "NL.IMBAG.Pand.0363100012178854", "start": [4.896907, 52.365753], "end": [4.89644, 52.365691], "lengthM": 32.55, "alongM": 23.16 }, "seafood-bistro-78815": { "pand": "NL.IMBAG.Pand.0363100012178815", "start": [4.898617, 52.375431], "end": [4.898438, 52.375492], "lengthM": 13.95, "alongM": 13.05 }, "seasons-restaurant-75049": { "pand": "NL.IMBAG.Pand.0363100012175049", "start": [4.88896, 52.377195], "end": [4.889036, 52.377168], "lengthM": 5.98, "alongM": 3.64 }, "semai-52074": { "pand": "NL.IMBAG.Pand.0363100012152074", "start": [4.911948, 52.393479], "end": [4.912104, 52.393629], "lengthM": 19.78, "alongM": 9.57 }, "semhar-74838": { "pand": "NL.IMBAG.Pand.0363100012174838", "start": [4.877361, 52.375502], "end": [4.87731, 52.37542], "lengthM": 9.76, "alongM": 8.39 }, "senayan-73612": { "pand": "NL.IMBAG.Pand.0363100012173612", "start": [4.884129, 52.372342], "end": [4.883966, 52.372346], "lengthM": 11.11, "alongM": 2.75 }, "seth-takeout-76929": { "pand": "NL.IMBAG.Pand.0363100012176929", "start": [4.888249, 52.369147], "end": [4.888241, 52.36911], "lengthM": 4.15, "alongM": 1.43 }, "sham-87688": { "pand": "NL.IMBAG.Pand.0363100012087688", "start": [4.9367736, 52.3697678], "end": [4.9368037, 52.3697064], "lengthM": 7.13, "alongM": 3.05 }, "sham-maza-80856": { "pand": "NL.IMBAG.Pand.0363100012080856", "start": [4.854844, 52.370685], "end": [4.854759, 52.370671], "lengthM": 5.99, "alongM": 3.45 }, "sherpa-39376": { "pand": "NL.IMBAG.Pand.0363100012239376", "start": [4.884895, 52.363084], "end": [4.884773, 52.363168], "lengthM": 12.51, "alongM": 10.86 }, "shiki-79220": { "pand": "NL.IMBAG.Pand.0363100012179220", "start": [4.893857, 52.374071], "end": [4.893889, 52.374134], "lengthM": 7.34, "alongM": 4.29 }, "sichuan-food-68478": { "pand": "NL.IMBAG.Pand.0363100012168478", "start": [4.890517, 52.366493], "end": [4.89059, 52.366483], "lengthM": 5.1, "alongM": 2.69 }, "silk-road-kebab-house-80959": { "pand": "NL.IMBAG.Pand.0363100012080959", "start": [4.939941, 52.361862], "end": [4.940272, 52.361909], "lengthM": 23.15, "alongM": 16.17 }, "sinne-35937": { "pand": "NL.IMBAG.Pand.0363100012235937", "start": [4.894089, 52.35305], "end": [4.894017, 52.35304], "lengthM": 5.03, "alongM": 3.01 }, "t-vliegertje-36397": { "pand": "NL.IMBAG.Pand.0363100012136397", "start": [4.891116, 52.345398], "end": [4.891104, 52.345311], "lengthM": 9.71, "alongM": 4.66 }, "vermeer-82718": { "pand": "NL.IMBAG.Pand.0363100012182718", "start": [4.900479, 52.376525], "end": [4.900418, 52.376507], "lengthM": 4.61, "alongM": 2.29 }, "vinkeles-74123": { "pand": "NL.IMBAG.Pand.0363100012174123", "start": [4.883347, 52.369328], "end": [4.883339, 52.369245], "lengthM": 9.25, "alongM": 6.79 } };

  // src/canalRecall/landmarkFrontData.ts
  var span = (xs, half) => xs.flatMap((x) => [x - half, x + half]);
  var BIJ = { stone: "#b39a88", pier: "#cbb6a3", cornice: "#c2ab98", glass: "#4b5561", iron: "#56625c", bronze: "#5a3a30" };
  var BIJ_BAYS = [3.1, 8.1, 13.2, 18.1, 22.9];
  var BIJ_SHOPS = [[1.1, 4.9], [6.25, 10], [11.4, 15], [16.4, 20], [21.3, 24.9]];
  var BIJENKORF = {
    name: "Bijenkorf",
    ids: ["w751235773", "w751235775", "w751235776", "w751128373"],
    start: [4.893856597014285, 52.37348990232792],
    end: [4.893608397018061, 52.37330680232445],
    depthM: 0.4,
    hex: BIJ.stone,
    bodyTopM: 23.6,
    outline: [[0, 23.6], [4.75, 23.6], [4.75, 29.3], ...arch(5.4, 21.1, 29.3, 3.2, 10), [21.25, 29.3], [21.25, 23.6], [26.45, 23.6]],
    boxes: [
      // The attic storey and pediment stand on the body as a block 8 m deep.
      { x0: 4.75, x1: 21.25, z0: 23.2, z1: 29.3, out0: -8.4, out1: 0, hex: BIJ.stone },
      // Ground floor: shopfronts between stone piers, a fascia above.
      ...BIJ_SHOPS.flatMap(([x0, x1]) => [
        { x0: x0 - 0.15, x1: x1 + 0.15, z0: 0.9, z1: 5.05, out0: -0.05, out1: 0.03, hex: BIJ.bronze },
        { x0, x1, z0: 1.05, z1: 4.9, out0: -0.05, out1: 0.06, hex: BIJ.glass }
      ]),
      { x0: 0, x1: 26.45, z0: 5.7, z1: 6.8, out1: 0.45, hex: BIJ.cornice },
      // Stone pilasters through the three main storeys.
      ...[0.55, 5.4, 10.6, 15.8, 20.9, 25.9].map((x) => ({ x0: x - 0.55, x1: x + 0.55, z0: 6.8, z1: 18.6, out1: 0.3, hex: BIJ.pier })),
      // Main cornice: frieze, corona, and the deep overhang over the centre.
      { x0: 0, x1: 26.45, z0: 18.6, z1: 19.6, out1: 0.4, hex: BIJ.cornice },
      { x0: 0, x1: 26.45, z0: 19.6, z1: 20.7, out1: 0.9, hex: BIJ.cornice },
      { x0: 3, x1: 23.3, z0: 20.7, z1: 22, out1: 1.5, hex: BIJ.pier },
      // Attic: piers between three bays, balustrades on the low wings.
      ...[5.3, 10.9, 15.6, 20.7].map((x) => ({ x0: x - 0.55, x1: x + 0.55, z0: 22, z1: 26.3, out1: 0.35, hex: BIJ.pier })),
      { x0: 0.2, x1: 4.75, z0: 22, z1: 23.3, out1: 0.25, hex: BIJ.pier },
      { x0: 21.25, x1: 26.2, z0: 22, z1: 23.3, out1: 0.25, hex: BIJ.pier },
      // Upper cornice under the pediment, flaring out.
      { x0: 4.1, x1: 22.3, z0: 26.3, z1: 27.6, out1: 0.6, hex: BIJ.cornice },
      { x0: 3.25, x1: 23.1, z0: 27.6, z1: 29.3, out1: 1.1, hex: BIJ.pier },
      { x0: 11.6, x1: 14.8, z0: 26.3, z1: 28.6, out1: 0.75, hex: BIJ.pier },
      // Balconies on the centre bay.
      { x0: 11.4, x1: 15, z0: 6.5, z1: 7.3, out1: 0.9, hex: BIJ.iron },
      { x0: 11.6, x1: 14.8, z0: 10.2, z1: 10.8, out1: 0.8, hex: BIJ.iron },
      { x0: 11.6, x1: 14.8, z0: 14.1, z1: 14.6, out1: 0.8, hex: BIJ.iron }
    ],
    windows: [
      { xs: span(BIJ_BAYS, 0.68), rows: [[7.4, 9.6], [10.9, 13.2], [14.7, 16.3]], w: 1.05, hex: BIJ.glass },
      { xs: span([8.1, 13.2, 18.1], 0.6), rows: [[22.6, 24]], w: 0.95, hex: BIJ.glass }
    ]
  };
  var BEURS = { brick: "#9a5240", stone: "#d4c8b2", glass: "#45474a" };
  var BEURS_COLS = Array.from({ length: 13 }, (_, i) => 1.3 + i * 3.47);
  var BEURS_GABLES = [2.7, 10.2, 17.5, 24.7, 31.7, 38.7];
  var BEURS_BEURSPLEIN = {
    name: "Beurs van Berlage",
    // The game tiles split the Beursplein hall into 642 and 645; the raw extract has it as 641.
    ids: ["w749918642", "w749918645", "w749918641"],
    start: [4.895897096981563, 52.37509780235795],
    end: [4.895497396988156, 52.37477130235189],
    depthM: 0.3,
    hex: BEURS.brick,
    outline: [[0, 15.4], ...BEURS_GABLES.flatMap((c) => [[c - 2.1, 15.4], [c - 0.5, 17.2], [c + 0.5, 17.2], [c + 2.1, 15.4]]), [45.4, 15.4]],
    boxes: [
      { x0: 0, x1: 45.4, z0: 14.6, z1: 15.5, out1: 0.3, hex: BEURS.stone },
      { x0: 0, x1: 45.4, z0: 2.9, z1: 3.2, out1: 0.15, hex: BEURS.stone },
      ...BEURS_GABLES.map((c) => ({ x0: c - 2.25, x1: c + 2.25, z0: 15.4, z1: 15.7, out1: 0.25, hex: BEURS.stone }))
    ],
    windows: [
      { xs: BEURS_COLS, rows: [[11, 13], [7.7, 9.7], [4.2, 5.8]], w: 1.9, hex: BEURS.glass, frameHex: BEURS.stone },
      { xs: BEURS_COLS, rows: [[0.8, 1.8]], w: 1.5, hex: BEURS.glass, frameHex: BEURS.stone },
      { xs: BEURS_GABLES, rows: [[15.9, 16.7]], w: 0.5, hex: BEURS.glass, frameHex: BEURS.stone }
    ]
  };
  var PAL = { stone: "#a39a8b", pier: "#b3aa9a", cornice: "#bdb4a3", glass: "#3e4248", frame: "#d6d1c4", dark: "#2c2a28" };
  var PAL_WING = [3.6, 8.2, 11.6, 15, 18.4, 52, 55.4, 58.6, 62, 66];
  var PAL_OUT = 5;
  var rx = (x) => 22 + (x - 21.8) * 25.2 / 29.8;
  var PAL_CENTRE = [24.8, 28.8, 32.8, 36.6, 40.6, 44.6, 48.4].map(rx);
  var ROYAL_PALACE_DAM = {
    name: "Royal Palace",
    ids: ["w748659172", "w748659181"],
    // The photo's skyline is the wings' slate roofs (the kit's) and the pediment, cut by the crop.
    roofline: "front-only",
    start: [4.891730097030566, 52.37283230231148],
    end: [4.891761497019604, 52.37344440232049],
    depthM: 0.4,
    hex: PAL.stone,
    outline: [[0, 26.9], [68.1, 26.9]],
    slabs: [{ outline: [[22, 30.7], [34.6, 36.2], [47.2, 30.7]], out0: 0, out1: PAL_OUT + 0.3, hex: PAL.stone }],
    boxes: [
      // Risalit: pilasters and its own cornices, on its front face.
      ...[21.8, 26, 30.2, 34.2, 38.2, 42.2, 46.4, 50.6].map((x) => ({ x0: rx(x) - 0.15, x1: rx(x) + 0.65, z0: 5.1, z1: 29.5, out0: PAL_OUT + 0.3, out1: PAL_OUT + 0.6, hex: PAL.pier })),
      { x0: 21.6, x1: 47.6, z0: 16.6, z1: 18.1, out0: PAL_OUT + 0.3, out1: PAL_OUT + 0.9, hex: PAL.cornice },
      { x0: 21.6, x1: 47.6, z0: 29.4, z1: 30.8, out0: PAL_OUT + 0.3, out1: PAL_OUT + 1.1, hex: PAL.cornice },
      { x0: 22, x1: 47.2, z0: 0, z1: 5.1, out0: PAL_OUT + 0.3, out1: PAL_OUT + 0.5, hex: PAL.pier },
      // The seven entrance arches (dark openings) in the risalit's ground floor.
      ...PAL_CENTRE.map((x) => ({ x0: x - 0.7, x1: x + 0.7, z0: 0, z1: 3.6, out0: PAL_OUT + 0.5, out1: PAL_OUT + 0.55, hex: PAL.dark })),
      // Wings: rusticated ground floor, cornices.
      { x0: 0, x1: 22, z0: 0, z1: 5.1, out1: 0.3, hex: PAL.pier },
      { x0: 47.2, x1: 68.1, z0: 0, z1: 5.1, out1: 0.3, hex: PAL.pier },
      { x0: 0, x1: 22, z0: 15.1, z1: 15.7, out1: 0.5, hex: PAL.cornice },
      { x0: 47.2, x1: 68.1, z0: 15.1, z1: 15.7, out1: 0.5, hex: PAL.cornice },
      { x0: 0, x1: 22, z0: 25.7, z1: 26.9, out1: 0.9, hex: PAL.cornice },
      { x0: 47.2, x1: 68.1, z0: 25.7, z1: 26.9, out1: 0.9, hex: PAL.cornice }
    ],
    windows: [
      { xs: PAL_WING, rows: [[1.7, 3.9], [5.9, 9.9], [12.1, 13.7], [16.1, 20], [21.1, 23.1]], w: 1.5, hex: PAL.glass, frameHex: PAL.frame }
    ]
  };
  ROYAL_PALACE_DAM.boxes.push(...PAL_CENTRE.flatMap((x) => [[5.9, 9.9], [12.1, 13.7], [18.7, 22.3], [24.3, 26.1]].flatMap(([z0, z1]) => [
    { x0: x - 0.75, x1: x + 0.75, z0: z0 - 0.12, z1: z1 + 0.12, out0: PAL_OUT + 0.3, out1: PAL_OUT + 0.34, hex: PAL.frame },
    { x0: x - 0.63, x1: x + 0.63, z0, z1, out0: PAL_OUT + 0.3, out1: PAL_OUT + 0.37, hex: PAL.glass }
  ])));
  var CG = { stone: "#e6dfcd", loggia: "#8f877a", brick: "#a85a45", glass: "#3f4650", gold: "#c9a54a", iron: "#3c3f42", slate: "#4d535c" };
  var CG_OUT = 4.3;
  var cx = (x) => 17.5 + (x - 17.6) * 17.1 / 24;
  var CONCERTGEBOUW = {
    name: "Concertgebouw",
    ids: ["w754269603", "w754269608", "w754269609", "w754269610"],
    // The portico is drawn at its OSM width, narrower than the photo shows it: only check the model is never taller.
    roofline: "front-only",
    start: [4.8796525973590095, 52.35617990203481],
    end: [4.879354197352111, 52.356617502039974],
    depthM: 0.4,
    hex: CG.stone,
    // Corner pavilions rise above the wings with small pediments; the wings are lower between.
    outline: [[0, 17.1], [5.4, 17.1], [5.8, 19.2], [8.6, 21], [11.4, 19.2], [11.8, 17.1], [42.2, 17.1], [42.6, 19.6], [45.6, 22.2], [48.6, 19.6], [49, 17.1], [52.5, 17.1]],
    slabs: [{ outline: [[17.5, 26.5], [34.6, 26.5]], out0: 0, out1: CG_OUT, hex: CG.stone }],
    boxes: [
      // Brick panels on the wings between stone bands.
      ...[[1, 16.8], [35.4, 51.6]].flatMap(([x0, x1]) => [
        { x0, x1, z0: 7.5, z1: 13.4, out0: -0.05, out1: 0.04, hex: CG.brick },
        { x0, x1, z0: 1.2, z1: 5.6, out0: -0.05, out1: 0.04, hex: CG.brick }
      ]),
      { x0: 0, x1: 17.5, z0: 14.7, z1: 17.1, out1: 0.7, hex: CG.stone },
      { x0: 34.6, x1: 52.5, z0: 14.7, z1: 17.1, out1: 0.7, hex: CG.stone },
      // Pavilion lanterns: small slate caps on the corner pavilions.
      { x0: 7.4, x1: 9.8, z0: 20, z1: 22.6, out0: -3, out1: -0.4, hex: CG.slate },
      { x0: 44.2, x1: 47, z0: 21.4, z1: 24.6, out0: -3, out1: -0.4, hex: CG.slate },
      // The portico face: a shaded loggia, columns in front of it, entablature with gilt lettering, canopy.
      { x0: cx(18), x1: cx(41.2), z0: 9.5, z1: 21.2, out0: CG_OUT - 0.05, out1: CG_OUT + 0.02, hex: CG.loggia },
      ...[18.6, 21.6, 24.6, 27.6, 30.6, 33.6, 36.6, 39.6].map((x) => ({ x0: cx(x) - 0.35, x1: cx(x) + 0.35, z0: 9.5, z1: 21.2, out0: CG_OUT, out1: CG_OUT + 0.9, hex: CG.stone })),
      { x0: 17.5, x1: 34.6, z0: 21.2, z1: 26.5, out0: CG_OUT, out1: CG_OUT + 1, hex: CG.stone },
      { x0: cx(22), x1: cx(37.2), z0: 22.2, z1: 23.1, out0: CG_OUT + 1, out1: CG_OUT + 1.06, hex: CG.gold },
      { x0: 16.9, x1: 35.2, z0: 6.9, z1: 7.6, out0: CG_OUT, out1: CG_OUT + 2.6, hex: CG.iron },
      ...[24.4, 28, 31.6, 35.2].map((x) => ({ x0: cx(x) - 0.95, x1: cx(x) + 0.95, z0: 0, z1: 5.3, out0: CG_OUT - 0.05, out1: CG_OUT + 0.05, hex: CG.glass }))
    ],
    windows: [
      { xs: [2.6, 8.6, 14.2, 38, 45.6, 50.6], rows: [[8.9, 12.6], [1.7, 4.9]], w: 1.3, hex: CG.glass, frameHex: CG.stone }
    ]
  };
  var TU = { stone: "#8a8188", dark: "#5f5961", gold: "#b08a4a", teal: "#4f6f73", glass: "#3b3f46", door: "#7a2c2a" };
  var TUSCHINSKI = {
    name: "Tuschinski",
    ids: ["NL.IMBAG.Pand.0363100012168188"],
    // The fused reference stops below the tower crowns and ghosts their edges.
    roofline: "unmeasured",
    start: [4.894810997136038, 52.366501002229796],
    end: [4.894616997135511, 52.36655500222995],
    depthM: 0.4,
    hex: TU.stone,
    outline: [[0, 20], [0.6, 23], [4.2, 23], [4.2, 21], [10.2, 21], [10.2, 23], [13.9, 23], [14.5, 20]],
    boxes: [
      // Towers stand forward, crowned with stepped merlons.
      { x0: 0.6, x1: 4.2, z0: 0, z1: 23, out1: 0.6, hex: TU.stone },
      { x0: 10.2, x1: 13.9, z0: 0, z1: 23, out1: 0.6, hex: TU.stone },
      ...[0.8, 2, 3.2, 10.4, 11.6, 12.8].map((x) => ({ x0: x, x1: x + 0.8, z0: 23, z1: 24.2, out1: 0.6, hex: TU.stone })),
      // Stepped crowns, each stage narrower, capped in copper green.
      ...[[0.6, 4.2], [10.2, 13.9]].flatMap(([x0, x1]) => [
        { x0: x0 + 0.4, x1: x1 - 0.4, z0: 24.2, z1: 25.6, out0: -2.5, out1: 0.3, hex: TU.stone },
        { x0: x0 + 0.8, x1: x1 - 0.8, z0: 25.6, z1: 26.8, out0: -2, out1: 0, hex: TU.gold },
        { x0: x0 + 1.2, x1: x1 - 1.2, z0: 26.8, z1: 28.4, out0: -1.6, out1: -0.3, hex: TU.teal }
      ]),
      // The ornamented band under the parapet and the recessed arch with its oriel.
      { x0: 4.2, x1: 10.2, z0: 16.2, z1: 19.6, out1: 0.3, hex: TU.teal },
      { x0: 4.2, x1: 10.2, z0: 19.6, z1: 21, out1: 0.4, hex: TU.gold },
      { x0: 5.4, x1: 9.4, z0: 5.4, z1: 15, out0: -0.3, out1: -0.29, hex: TU.dark },
      { x0: 6.2, x1: 8.6, z0: 7.4, z1: 14.2, out0: -0.3, out1: 0.5, hex: TU.stone },
      { x0: 4.6, x1: 9.8, z0: 4.2, z1: 5.2, out1: 1.6, hex: TU.gold },
      { x0: 5.2, x1: 9.4, z0: 0, z1: 4.2, out0: -0.05, out1: 0.05, hex: TU.door }
    ],
    windows: [
      { xs: [2.4, 12], rows: [[3, 6], [8, 11], [13, 16], [18, 21]], w: 0.6, hex: TU.glass, frameHex: TU.gold },
      { xs: [6.8, 8], rows: [[8.2, 10.4], [11, 13.4]], w: 0.9, hex: TU.glass, frameHex: TU.gold }
    ]
  };
  var KEMA = { red: "#c8321f", white: "#f4efe6", glassBlock: "#cfd6d4", rail: "#2b2b2b", glass: "#3f4650" };
  var KEMA_VLEES = {
    name: "Kema Vlees",
    storefront: true,
    roofline: "unmeasured",
    ids: ["NL.IMBAG.Pand.0363100012233470"],
    start: [4.867663997219131, 52.36610400213513],
    end: [4.867742997218478, 52.366125002135696],
    depthM: 0.25,
    hex: "#d9c9a8",
    outline: [[0, 5.9], [5.87, 5.9]],
    boxes: [
      { x0: 0, x1: 5.87, z0: 4.9, z1: 5.9, out1: 0.05, hex: KEMA.glassBlock },
      { x0: 0, x1: 5.87, z0: 4.55, z1: 4.9, out1: 0.4, hex: KEMA.rail },
      { x0: 0, x1: 5.87, z0: 3.9, z1: 4.55, out1: 0.3, hex: KEMA.red },
      ...lettering(1.4, 5.6, 4.05, 4.4, 0.3, KEMA.white, 10),
      { x0: 0.1, x1: 5.8, z0: 2.4, z1: 3.5, out0: 0, out1: 1.3, hex: KEMA.red },
      ...lettering(3.6, 5.6, 2.55, 2.8, 1.3, KEMA.white, 4),
      { x0: 0.2, x1: 5.7, z0: 0.2, z1: 2.4, out0: -0.05, out1: 0.05, hex: KEMA.glass }
    ],
    windows: []
  };
  var MAN = { brick: "#6b4535", stone: "#d8d2c4", lead: "#2c3134", glass: "#3e4248", door: "#2a2a2a" };
  var MAN_L = 3.96;
  var T_MANDJE = {
    name: "'t Mandje",
    roofline: "unmeasured",
    ids: ["NL.IMBAG.Pand.0363100012171642"],
    start: along([4.900973996976375, 52.37485000237052], [4.900941996977121, 52.374811002369846], 4.86, 0.9),
    end: [4.900941996977121, 52.374811002369846],
    depthM: 0.25,
    hex: MAN.brick,
    bodyTopM: 14.5,
    outline: [[0, 14.5], [MAN_L, 14.5]],
    boxes: [
      { x0: 0, x1: MAN_L, z0: 12.8, z1: 14.5, out1: 0.35, hex: MAN.stone },
      { x0: 0, x1: MAN_L, z0: 5.2, z1: 5.6, out1: 0.3, hex: MAN.stone },
      ...[0, 1.25, 2.6, 3.76].map((x) => ({ x0: x, x1: x + 0.2, z0: 0, z1: 5.2, out1: 0.2, hex: MAN.stone })),
      // Leaded transoms, a dark diamond grid read as a dark band, and the bar window and door below.
      { x0: 0.2, x1: 3.76, z0: 3.6, z1: 4.9, out0: -0.05, out1: 0.03, hex: MAN.lead },
      { x0: 1.45, x1: 3.76, z0: 1.2, z1: 3.4, out0: -0.05, out1: 0.04, hex: MAN.glass },
      { x0: 0.25, x1: 1.2, z0: 0, z1: 3.3, out0: -0.1, out1: 0, hex: MAN.door },
      { x0: 0, x1: MAN_L, z0: 0, z1: 0.35, out1: 0.25, hex: MAN.stone }
    ],
    windows: [{ xs: [1, 2.4, 3.6], rows: [[10.6, 11.7], [8.3, 9.7], [5.9, 7.5]], w: 0.95, hex: MAN.glass, frameHex: "#efeae0" }]
  };
  var JAR = { brick: "#5e3b33", stone: "#9a8f86", gold: "#d8c27a", cream: "#efe6c8", glass: "#3a3f45", door: "#2a2420" };
  var JAR_COLS = [6.9, 9.46, 12, 14.5];
  var DE_JAREN = {
    name: "Caf\xE9 de Jaren",
    roofline: "unmeasured",
    ids: ["NL.IMBAG.Pand.0363100012180413"],
    start: [4.8954409971059025, 52.368129002255245],
    end: [4.895224997107816, 52.36804700225337],
    depthM: 0.35,
    hex: JAR.brick,
    bodyTopM: 14.4,
    outline: [[0, 14.4], [1.8, 14.4], [1.8, 15.6], [3.6, 17.2], [5.4, 15.6], [5.4, 14.4], [16.8, 14.4], [16.8, 15.4], [17.31, 15.4]],
    boxes: [
      // The O&B mosaic in its arch.
      { x0: 2.2, x1: 5, z0: 12.9, z1: 14.8, out1: 0.08, hex: JAR.cream },
      { x0: 2.7, x1: 4.5, z0: 13.4, z1: 14.3, out0: 0.08, out1: 0.12, hex: JAR.gold },
      // Parapet panels and stone bands.
      ...[7.2, 9.7, 12.2, 14.7].map((x) => ({ x0: x - 0.9, x1: x + 0.9, z0: 12.8, z1: 14.1, out1: 0.12, hex: JAR.stone })),
      { x0: 0, x1: 17.31, z0: 12, z1: 12.3, out1: 0.2, hex: JAR.stone },
      { x0: 0, x1: 17.31, z0: 9.5, z1: 9.75, out1: 0.15, hex: JAR.stone },
      { x0: 0, x1: 17.31, z0: 5.6, z1: 5.9, out1: 0.25, hex: JAR.stone },
      // Café ground floor: two runs of tall windows under arches, the arched entrance, steps.
      { x0: 6.3, x1: 10.2, z0: 1, z1: 5.3, out0: -0.1, out1: 0.02, hex: JAR.glass },
      { x0: 11.3, x1: 15.4, z0: 1, z1: 5.3, out0: -0.1, out1: 0.02, hex: JAR.glass },
      ...[6.3, 7.6, 8.9, 10.2, 11.3, 12.7, 14.1, 15.4].map((x) => ({ x0: x - 0.12, x1: x + 0.12, z0: 1, z1: 5.3, out1: 0.08, hex: JAR.stone })),
      { x0: 2.2, x1: 4, z0: 0.6, z1: 4.6, out0: -0.3, out1: -0.29, hex: JAR.door },
      { x0: 1.6, x1: 4.6, z0: 0, z1: 0.6, out1: 0.9, hex: JAR.stone },
      { x0: 0, x1: 17.31, z0: 0, z1: 0.9, out1: 0.12, hex: "#4a4440" }
    ],
    windows: [
      { xs: [3.7], rows: [[9.6, 11.6], [6.4, 8.5]], w: 2.2, hex: JAR.glass, frameHex: "#e9e4da" },
      { xs: JAR_COLS, rows: [[9.6, 11.6], [6.4, 8.5]], w: 1.3, hex: JAR.glass, frameHex: "#e9e4da" }
    ]
  };
  var WIN = { grey: "#3c3d41", green: "#2f6b47", white: "#f1efe8", glass: "#3c4248", ledge: "#cfcac0" };
  var WINKEL_43 = {
    name: "Winkel 43",
    roofline: "unmeasured",
    ids: ["NL.IMBAG.Pand.0363100012176675"],
    start: [4.88628199693154, 52.37906400238474],
    end: [4.886261996930638, 52.379117002385456],
    depthM: 0.25,
    hex: WIN.grey,
    bodyTopM: 9.1,
    outline: [[0, 9.1], [0.35, 9.5], [1.7, 10.4], [2.05, 12.4], [4, 12.4], [4.35, 10.4], [5.7, 9.5], [6.05, 9.1]],
    boxes: [
      { x0: 0.6, x1: 5.45, z0: 8.7, z1: 9.1, out1: 0.45, hex: WIN.grey },
      { x0: 0, x1: 6.05, z0: 4.4, z1: 4.6, out1: 0.15, hex: WIN.ledge },
      ...stripedAwning(0, 6.05, 4.4, 1.6, WIN.green, WIN.white),
      { x0: 1.4, x1: 4.65, z0: 3.25, z1: 3.75, out0: 1.3, out1: 1.36, hex: WIN.green },
      ...lettering(2.1, 4, 3.38, 3.62, 1.36, WIN.white, 6),
      { x0: 0.4, x1: 2.2, z0: 0.6, z1: 3.2, out0: -0.05, out1: 0.04, hex: WIN.glass },
      { x0: 2.4, x1: 3.6, z0: 0, z1: 3.2, out0: -0.15, out1: -0.1, hex: "#262a2e" },
      { x0: 3.8, x1: 5.65, z0: 0.6, z1: 3.2, out0: -0.05, out1: 0.04, hex: WIN.glass },
      ...[0.3, 2.3, 3.7, 5.75].map((x) => ({ x0: x - 0.1, x1: x + 0.1, z0: 0, z1: 3.3, out1: 0.08, hex: WIN.white }))
    ],
    windows: [
      { xs: [3], rows: [[9.5, 10.5]], w: 0.9, hex: WIN.glass, frameHex: WIN.white },
      { xs: [1.75, 2.7, 3.65], rows: [[7.1, 8.4]], w: 0.85, hex: WIN.glass, frameHex: WIN.white },
      { xs: [1.1, 2.75, 4.4], rows: [[4.8, 6.4]], w: 1, hex: WIN.glass, frameHex: WIN.white }
    ]
  };
  var HOP = { dark: "#2f3034", green: "#3ccf7a", red: "#c8321f", cream: "#ece4cc", white: "#f2efe8", glass: "#3a3f45" };
  var HOP_L = 4.9;
  var CAFE_HOPPE = {
    name: "Caf\xE9 Hoppe",
    roofline: "unmeasured",
    ids: ["NL.IMBAG.Pand.0363100012177199"],
    start: [4.888688997110217, 52.36875300224259],
    end: along([4.888688997110217, 52.36875300224259], [4.888618997109015, 52.368830002243485], 9.8, HOP_L),
    depthM: 0.25,
    hex: HOP.dark,
    bodyTopM: 10.4,
    outline: [[0, 10.4], [0.5, 11.2], [1, 12.4], [1.5, 12.7], [3.4, 12.7], [3.9, 12.4], [4.4, 11.2], [4.9, 10.4]],
    boxes: [
      ...lettering(0.3, 4.6, 10, 10.6, 0.25, HOP.green, 9),
      ...lettering(0.8, 3.7, 5.1, 5.7, 0.25, HOP.red, 6),
      { x0: 0, x1: HOP_L, z0: 3.5, z1: 4.9, out1: 0.35, hex: HOP.cream },
      { x0: 0.2, x1: HOP_L - 0.2, z0: 3.7, z1: 4.3, out0: 0.35, out1: 0.38, hex: HOP.glass },
      ...stripedAwning(0, HOP_L, 3.4, 1.4, HOP.red, HOP.white, 0.35),
      { x0: 0.3, x1: 3.6, z0: 0.4, z1: 2.9, out0: -0.05, out1: 0.04, hex: HOP.glass },
      { x0: 3.8, x1: 4.6, z0: 0, z1: 2.9, out0: -0.1, out1: -0.05, hex: "#20262a" }
    ],
    windows: [{ xs: [0.64, 2.2, 3.8], rows: [[8.3, 9.9], [5.9, 7.5]], w: 1.1, hex: HOP.glass, frameHex: HOP.white }]
  };
  var MAS = { black: "#1c1d1f", white: "#f2f0ea", green: "#5a9a3a", cream: "#efe9d6", glass: "#3a4048" };
  function transoms(g0, g1) {
    const n = Math.max(4, Math.round((g1 - g0) / 0.55)), pw = (g1 - g0) / n;
    return Array.from({ length: n }, (_, i) => ({ x0: g0 + i * pw + 0.05, x1: g0 + (i + 1) * pw - 0.05, z0: 2.62, z1: 2.98, out0: 0.12, out1: 0.14, hex: MAS.glass }));
  }
  function massimoFront(base, x0, x1, door, signAt) {
    const w = x1 - x0, d0 = door === "left" ? x0 + 0.15 : x1 - 1.05, g0 = door === "left" ? x0 + 1.2 : x0 + 0.2, g1 = door === "left" ? x1 - 0.2 : x1 - 1.2;
    return {
      name: "Massimo Gelato",
      storefront: true,
      roofline: "unmeasured",
      ...base,
      depthM: 0.2,
      hex: "#7a4a3a",
      outline: [[x0, 3.7], [x1, 3.7]],
      boxes: [
        { x0, x1, z0: 0, z1: 3.7, out1: 0.12, hex: MAS.black },
        ...lettering(x0 + w * 0.18, x1 - w * 0.18, 3.18, 3.45, 0.12, MAS.white, 13),
        // The transom row of small panes, then the big window and the door.
        ...transoms(g0, g1),
        { x0: g0, x1: g1, z0: 0.45, z1: 2.52, out0: 0.12, out1: 0.14, hex: MAS.glass },
        ...lettering(g0 + (g1 - g0) * 0.36, g1 - (g1 - g0) * 0.36, 1.7, 1.85, 0.14, MAS.white, 4),
        { x0: d0, x1: d0 + 0.9, z0: 0, z1: 2.5, out0: 0.12, out1: 0.13, hex: "#101112" },
        // The round green sign on its bracket, sticking out from the frame.
        { x0: signAt - 0.03, x1: signAt + 0.03, z0: 3.05, z1: 3.1, out0: 0.12, out1: 0.75, hex: MAS.black },
        { x0: signAt - 0.06, x1: signAt + 0.06, z0: 2.55, z1: 3.05, out0: 0.25, out1: 0.75, hex: MAS.green },
        { x0: signAt - 0.07, x1: signAt + 0.07, z0: 2.72, z1: 2.88, out0: 0.33, out1: 0.67, hex: MAS.cream }
      ],
      windows: []
    };
  }
  var MASSIMO_PRETORIUS = massimoFront({ ids: ["w278207421"], start: [4.920966897299289, 52.35442420213683], end: [4.920863297299974, 52.354392402136085] }, 1.5, 7.3, "right", 1.55);
  var MASSIMO_JAN_HANZEN = massimoFront({ ids: ["NL.IMBAG.Pand.0363100012236819"], start: [4.866620997185709, 52.368139002160575], end: [4.866450997187039, 52.368098002159414] }, 2.56, 6.1, "left", 6.25);
  var MASSIMO_OSTADE = {
    name: "Massimo Gelato",
    storefront: true,
    roofline: "unmeasured",
    ids: ["NL.IMBAG.Pand.0363100012164859"],
    start: [4.894535997381415, 52.35259500203181],
    end: [4.894702997380635, 52.35261600203262],
    depthM: 0.2,
    hex: "#7a4a3a",
    outline: [[0.9, 3.9], [11.6, 3.9]],
    boxes: [
      { x0: 0.9, x1: 11.6, z0: 0, z1: 3.9, out1: 0.1, hex: MAS.cream },
      ...[[3.5, 5.4], [5.4, 7.2], [7.2, 9.1], [9.2, 11.4]].flatMap(([a, b]) => [
        { x0: a + 0.1, x1: b - 0.1, z0: 0.4, z1: 2.8, out0: 0.1, out1: 0.12, hex: MAS.glass },
        { x0: a, x1: b, z0: 2.9, z1: 3.75, out0: 0.1, out1: 1, hex: "#3f5a3a" }
      ]),
      { x0: 2.3, x1: 3.3, z0: 0, z1: 2.6, out0: 0.1, out1: 0.11, hex: MAS.cream },
      { x0: 2.77, x1: 2.83, z0: 3.35, z1: 4.1, out0: 0.25, out1: 0.85, hex: MAS.green }
    ],
    windows: []
  };
  var FRONTS = {
    bijenkorf: BIJENKORF,
    beurs: BEURS_BEURSPLEIN,
    "royal-palace": ROYAL_PALACE_DAM,
    concertgebouw: CONCERTGEBOUW,
    tuschinski: TUSCHINSKI,
    "kema-vlees": KEMA_VLEES,
    "t-mandje": T_MANDJE,
    "de-jaren": DE_JAREN,
    winkel43: WINKEL_43,
    hoppe: CAFE_HOPPE,
    "massimo-pretorius": MASSIMO_PRETORIUS,
    "massimo-janhanzen": MASSIMO_JAN_HANZEN,
    "massimo-ostade": MASSIMO_OSTADE
  };
  var STOREFRONT_BY_SLUG = new Map(Object.entries(STOREFRONT_SPECS).flatMap(([slug, spec]) => {
    const wall = STOREFRONT_WALLS[slug];
    return spec && wall ? [[slug, compileStorefront(slug, spec, wall)]] : [];
  }));
  var STOREFRONT_FRONTS = [...STOREFRONT_BY_SLUG.values()];
  var FRONT_LIST = [...Object.values(FRONTS), ...STOREFRONT_FRONTS];
  var FRONT_PART_IDS = new Set(FRONT_LIST.flatMap((f) => f.ids));
  var FRONT_OF = new Map(FRONT_LIST.flatMap((f) => f.ids.map((id) => [id, f])));

  // src/canalRecall/facadeCompareViewer.ts
  var SETUPS = {
    waag: {
      centre: [4.9003, 52.37264],
      ids: "w749066938,w749066939,w749066940,w749066942,w749066943,w749066944,w749066945,w749066946,w749066947,w749066948,w749066949,w749066950".split(","),
      // Two round corner towers with conical roofs, two turrets, and steep roofs on the main body.
      kit: KITS.find((k) => k.name === "Waag")
    },
    bijenkorf: {
      centre: [4.8939, 52.37335],
      ids: "w751128384,w751235773,w751235774,w751235775,w751235776,w751128373,NL.IMBAG.Pand.0363100012179183".split(","),
      // Plain prisms in the front's stone; the front (landmarkFrontData.ts) carries the detail.
      kit: { name: "Bijenkorf", tiers: [], stacks: [], roofs: [] }
    }
  };
  var KIT_PART_IDS_OF = (k) => [...k.tiers.map((t) => t.id), ...k.stacks.map((t) => t.onId), ...k.roofs.map((r) => r.id)];
  var BEURS_IDS = "w749918639,w749918641,w749918651,w749918653,w749918637,w749918638,w749931382,w749931383,w749918652".split(",");
  SETUPS.beurs = {
    centre: [4.8961, 52.37527],
    ids: BEURS_IDS,
    kit: KITS.find((k) => k.name === "Beurs van Berlage")
  };
  for (const [key, f] of Object.entries(FRONTS)) if (!SETUPS[key]) SETUPS[key] = {
    centre: [(f.start[0] + f.end[0]) / 2, (f.start[1] + f.end[1]) / 2],
    ids: [...f.ids, ...KITS.find((k) => k.name === f.name) ? KIT_PART_IDS_OF(KITS.find((k) => k.name === f.name)) : []],
    kit: KITS.find((k) => k.name === f.name) ?? { name: f.name, tiers: [], stacks: [], roofs: [] }
  };
  var q = new URLSearchParams(location.search);
  var storefront = q.get("storefront");
  if (storefront) {
    const f = STOREFRONT_BY_SLUG.get(storefront);
    SETUPS[storefront] = { centre: [(f.start[0] + f.end[0]) / 2, (f.start[1] + f.end[1]) / 2], ids: f.ids, kit: { name: f.name, tiers: [], stacks: [], roofs: [] } };
  }
  var name = storefront ?? q.get("name") ?? "waag";
  var setup = SETUPS[name];
  var front = storefront ? STOREFRONT_BY_SLUG.get(storefront) : FRONTS[name];
  var refBase = storefront ? "/tmp/storefronts/refs" : "/data/landmark-facades";
  var [clng, clat] = setup.centre;
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
    const meta = await (await fetch(`${refBase}/${name}.json`)).json();
    const [tx, ty] = tileOf(clng, clat);
    const features = (await Promise.all([-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => loadTile(tx + dx, ty + dy))))).flat();
    const local = (ring) => ring.map(([lng, lat]) => [(lng - clng) * kx, (lat - clat) * ky]);
    const mine = new Set(setup.ids), parts = /* @__PURE__ */ new Map(), context = [];
    for (const f of features) {
      const g = f.geometry, ring = g.type === "Polygon" ? g.coordinates[0] : g.coordinates[0][0], id = String(f.properties.id), pts = local(ring);
      if (mine.has(id)) parts.set(id, { id, ring: pts, minHeightM: Number(f.properties.minHeight) || 0, heightM: Number(f.properties.height) });
      else if (Math.hypot(pts[0][0], pts[0][1]) < 80) context.push({ pts, h: Number(f.properties.height) || 8, min: Number(f.properties.minHeight) || 0 });
    }
    const prism = (pts, z0, z1, color) => {
      const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.5, z1 - z0), bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      g.translate(0, z0, 0);
      return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color }));
    };
    {
      const [ax2, ay2] = local([meta.wall.startLngLat])[0], [bx2, by2] = local([meta.wall.endLngLat])[0];
      const b = meta.wall.outwardBearingDeg * Math.PI / 180, ox = Math.sin(b), oy = Math.cos(b), mx = (ax2 + bx2) / 2, my = (ay2 + by2) / 2;
      const len = Math.hypot(bx2 - ax2, by2 - ay2) || 1, half = len / 2 + 25, ux = (bx2 - ax2) / len, uy = (by2 - ay2) / len;
      const contains = (pts, x, y) => {
        let c = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
        }
        return c;
      };
      const corridor = [];
      for (let out = 3; out <= 70; out += 2) for (let al = -len / 2; al <= len / 2 + 1e-6; al += Math.max(1, len / 8)) corridor.push([mx + ox * out + ux * al, my + oy * out + uy * al]);
      const inFront = (pts) => corridor.some(([x, y]) => contains(pts, x, y));
      for (let i = context.length - 1; i >= 0; i--) if (inFront(context[i].pts)) context.splice(i, 1);
    }
    if (front?.bodyTopM != null) {
      const [ax2, ay2] = local([front.start])[0], [bx2, by2] = local([front.end])[0], len = Math.hypot(bx2 - ax2, by2 - ay2);
      const offLine = ([x, y]) => Math.abs((x - ax2) * (by2 - ay2) - (y - ay2) * (bx2 - ax2)) / len;
      for (const p of parts.values()) if (p.ring.filter((pt) => offLine(pt) < 0.5).length >= 2) p.heightM = Math.min(p.heightM, front.bodyTopM);
    }
    const lights = (scene) => {
      scene.background = new THREE.Color("#e9e4d4");
      scene.add(new THREE.HemisphereLight(16777215, 10063744, 1.6));
      const sun = new THREE.DirectionalLight(16773853, 1.8);
      sun.position.set(-40, 80, 60);
      scene.add(sun);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: "#ddd7c6" }));
      ground.position.y = -0.05;
      scene.add(ground);
      for (const c of context) scene.add(prism(c.pts, c.min, Math.max(c.min + 1, c.h), "#b9b2a4"));
    };
    const sceneFor = (variant) => {
      const scene = new THREE.Scene();
      lights(scene);
      if (variant === "plain") for (const p of parts.values()) scene.add(prism(p.ring, p.minHeightM, p.heightM, "#d9c24a"));
      if (variant === "kit") {
        for (const h of setup.kit.roofs) {
          const p = parts.get(h.id);
          if (p) scene.add(prism(p.ring, p.minHeightM, p.heightM - h.riseM, "#9a5240"));
        }
        const unused = [...parts.values()].filter((p) => !setup.kit.tiers.some((t) => t.id === p.id) && !setup.kit.roofs.some((h) => h.id === p.id));
        for (const p of unused) scene.add(prism(p.ring, p.minHeightM, p.heightM, storefront && front?.storefront ? front.carrierHex ?? "#8f5440" : front?.hex ?? "#9a5240"));
        const chunk = buildKitChunk(kitGeometry(setup.kit, parts), { plain: 0, flat: 0, slope: 0 });
        const geometry = new THREE.BufferGeometry(), pos = new Float32Array(chunk.vertexCount * 3), col = new Float32Array(chunk.vertexCount * 3);
        for (let i = 0; i < chunk.vertexCount; i++) {
          pos[i * 3] = chunk.positions[i * 3];
          pos[i * 3 + 1] = chunk.positions[i * 3 + 2];
          pos[i * 3 + 2] = -chunk.positions[i * 3 + 1];
          const s = chunk.tints[i * 4 + 3] / 255;
          for (let c = 0; c < 3; c++) col[i * 3 + c] = chunk.tints[i * 4 + c] / 255 * s;
        }
        geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(col, 3));
        scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
        if (front) {
          const [fax, fay] = local([front.start])[0], [fbx, fby] = local([front.end])[0], len = Math.hypot(fbx - fax, fby - fay);
          const ux = (fbx - fax) / len, uy = (fby - fay) / len, ox = uy, oy = -ux;
          const upper = [];
          if (storefront && front.storefront) for (let z = 4.4; z + 1.6 < meta.wall.heightM - 0.5; z += 3) for (let x = 0.9; x + 0.9 < len; x += 1.9) upper.push({ x0: x - 0.5, x1: x + 0.5, z0: z - 0.1, z1: z + 1.7, out1: 0.03, hex: "#e8e2d4" }, { x0: x - 0.4, x1: x + 0.4, z0: z, z1: z + 1.6, out1: 0.05, hex: "#3d4650" });
          const tris = frontTriangles(storefront ? { ...front, boxes: [...upper, ...front.boxes] } : front, (along2, up, out) => [fax + ux * along2 + ox * out, fay + uy * along2 + oy * out, up]);
          const fp = new Float32Array(tris.length * 9), fc = new Float32Array(tris.length * 9), c = new THREE.Color();
          tris.forEach((t, i) => t.p.forEach(([x, y, z], k) => {
            fp.set([x, z, -y], i * 9 + k * 3);
            c.set(t.hex);
            fc.set([c.r, c.g, c.b], i * 9 + k * 3);
          }));
          const fg = new THREE.BufferGeometry();
          fg.setAttribute("position", new THREE.BufferAttribute(fp, 3));
          fg.setAttribute("color", new THREE.BufferAttribute(fc, 3));
          fg.computeVertexNormals();
          scene.add(new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
        }
      }
      return scene;
    };
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    const W = innerWidth, H = innerHeight;
    renderer.setSize(W, H);
    renderer.setScissorTest(true);
    document.body.style.margin = "0";
    document.body.appendChild(renderer.domElement);
    const [ax, ay] = local([meta.wall.startLngLat])[0], [bx, by] = local([meta.wall.endLngLat])[0];
    const mid = [(ax + bx) / 2, (ay + by) / 2], bearing = meta.wall.outwardBearingDeg * Math.PI / 180, buildingH = meta.wall.heightM - 1.5;
    const dist = Number(q.get("r") ?? 0) || Math.max(55, buildingH * 2.2), az = Number(q.get("az") ?? 0) * Math.PI / 180, el = Number(q.get("el") ?? 12) * Math.PI / 180;
    const cam = new THREE.PerspectiveCamera(32, W / 3 / H, 0.5, 2e3), a = bearing + az;
    let focus = mid, focusY = buildingH * 0.42, d = dist;
    if (storefront && front) {
      const [fx0, fx1] = [front.outline[0][0], front.outline[front.outline.length - 1][0]], t = (fx0 + fx1) / 2 / Math.hypot(bx - ax, by - ay);
      focus = [ax + (bx - ax) * t, ay + (by - ay) * t];
      focusY = 3.2;
      d = Number(q.get("r") ?? 0) || Math.max(9, (fx1 - fx0 + 2.5) * 1.75, 7 * 1.75);
    }
    cam.position.set(focus[0] + Math.sin(a) * Math.cos(el) * d, focusY + Math.sin(el) * d, -(focus[1] + Math.cos(a) * Math.cos(el) * d));
    cam.lookAt(focus[0], focusY, -focus[1]);
    ["plain", "kit"].forEach((variant, i) => {
      renderer.setViewport(i * W / 3, 0, W / 3, H);
      renderer.setScissor(i * W / 3, 0, W / 3, H);
      renderer.render(sceneFor(variant), cam);
    });
    const ref = document.createElement("img");
    Object.assign(ref.style, { position: "fixed", left: `${2 * W / 3}px`, top: "0", width: `${W / 3}px`, height: `${H}px`, objectFit: "contain", background: "#e9e4d4" });
    ref.src = `${refBase}/${meta.image}`;
    document.body.appendChild(ref);
    await ref.decode().catch(() => {
    });
    window.__info = { parts: parts.size };
    document.title = "ready";
  })();
})();
