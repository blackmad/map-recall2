"use strict";
(() => {
  // src/canalRecall/roofMesh.ts
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
  function gableProfile(shape, widthM, roofRiseM) {
    const half = widthM / 2, pts = [];
    const slope = (x) => roofRiseM * (1 - Math.abs(x) / half);
    const add = (x, y) => pts.push([x, Math.max(y, slope(x) + 0.04)]);
    const N = 24;
    if (shape === "plain") {
      add(-half, 0);
      add(0, roofRiseM);
      add(half, 0);
      pts[0][1] = 0;
      pts[2][1] = 0;
      return pts;
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
      for (let i = 1; i <= 8; i++) {
        const t = i / 8, x = -half + (half - neck) * t;
        add(x, 0.15 + (shoulder - 0.15) * Math.pow(t, 1.7));
      }
      add(-neck, top2);
      add(neck, top2);
      for (let i = 8; i >= 1; i--) {
        const t = i / 8, x = half - (half - neck) * t;
        add(x, 0.15 + (shoulder - 0.15) * Math.pow(t, 1.7));
      }
      add(half, 0);
      pts[0][1] = 0;
      pts[pts.length - 1][1] = 0;
      return dedupe(pts);
    }
    const bell = shape === "bell", top = roofRiseM * (bell ? 1.3 : 1.55) + (bell ? 0.6 : 0.9);
    for (let i = 0; i <= N; i++) {
      const x = -half + widthM * i / N, t = Math.abs(x) / half;
      let f;
      if (bell) f = t < 0.18 ? 1 : 0.12 + 0.88 * (0.5 + 0.5 * Math.cos(Math.PI * Math.pow((t - 0.18) / 0.82, 0.85)));
      else {
        const tt = t < 0.26 ? 0 : (t - 0.26) / 0.74;
        f = t < 0.26 ? 1 : 0.1 + 0.9 * (1 - Math.pow(tt, 0.6)) * (1 - 0 * tt);
      }
      add(x, top * f);
    }
    pts[0][1] = 0;
    pts[pts.length - 1][1] = 0;
    return dedupe(pts);
  }
  var dedupe = (pts) => pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
  var sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  var cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  var dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function roofTriangles(rect, plan, h0, dims) {
    const out = [];
    const { cx, cy, ux, uy, len: L, wid: W } = rect;
    const world = (u, v, z) => [cx + u * ux - v * uy, cy + u * uy + v * ux, h0 + z];
    const dir = (u, v, z) => [u * ux - v * uy, u * uy + v * ux, z];
    const tri = (a, b, c, ua, ub, uc, part, hint) => {
      let n = cross(sub(b, a), sub(c, a));
      let B = b, C = c, UB = ub, UC = uc;
      if (dot(n, hint) < 0) {
        B = c;
        C = b;
        UB = uc;
        UC = ub;
        n = [-n[0], -n[1], -n[2]];
      }
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      out.push({ p: [a, B, C], uv: [ua, UB, UC], part, n: [n[0] / l, n[1] / l, n[2] / l] });
    };
    const quad = (a, b, c, d, ua, ub, uc, ud, part, hint) => {
      tri(a, b, c, ua, ub, uc, part, hint);
      tri(a, c, d, ua, uc, ud, part, hint);
    };
    const R = plan.riseM, cell = dims.cellM;
    const wallUv = (v, y) => [v / dims.bayM, y / dims.storeyM];
    if (plan.kind === "mansard") {
      const k = Math.min(1, W * 0.16), h1 = R * 0.88, top = R - h1;
      const prof = [[-W / 2, 0], [-W / 2 + k, h1], [0, h1 + top], [W / 2 - k, h1], [W / 2, 0]];
      for (let i = 0; i < prof.length - 1; i++) {
        const [v0, z0] = prof[i], [v1, z1] = prof[i + 1], sl2 = Math.hypot(v1 - v0, z1 - z0);
        quad(
          world(-L / 2, v0, z0),
          world(L / 2, v0, z0),
          world(L / 2, v1, z1),
          world(-L / 2, v1, z1),
          [0, 0],
          [L / cell, 0],
          [L / cell, sl2 / cell],
          [0, sl2 / cell],
          "slope",
          dir(0, (v0 + v1) / 2, (z0 + z1) / 2 - R * 0.4)
        );
      }
      for (const e of [-1, 1]) for (let i = 0; i < prof.length - 1; i++) {
        tri(
          world(e * L / 2, prof[i][0], prof[i][1]),
          world(e * L / 2, prof[i + 1][0], prof[i + 1][1]),
          world(e * L / 2, 0, R * 0.4),
          wallUv(prof[i][0], prof[i][1]),
          wallUv(prof[i + 1][0], prof[i + 1][1]),
          wallUv(0, R * 0.4),
          "plate",
          dir(e, 0, 0)
        );
      }
      for (const sgn of [-1, 1]) quad(world(-L / 2, sgn * W / 2, 0), world(L / 2, sgn * W / 2, 0), world(L / 2, sgn * (W / 2 + 0.28), -0.1), world(-L / 2, sgn * (W / 2 + 0.28), -0.1), [0, 0], [L / cell, 0], [L / cell, 0.3 / cell], [0, 0.3 / cell], "slope", dir(0, sgn * 0.3, 1));
      if (plan.dormers) {
        const n = Math.min(4, Math.floor((L - 2) / 3.2));
        for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
          const uc = -L / 2 + (i + 0.5) * L / n, dw = 1.05, u0 = uc - dw / 2, u1 = uc + dw / 2;
          const vf = s * (W / 2 - k * 0.5), vb = s * (W / 2 - k), zb = h1 * 0.5 - 0.1, zt = zb + 1.35;
          quad(world(u0, vf, zb), world(u1, vf, zb), world(u1, vf, zt), world(u0, vf, zt), [0, 0], [1, 0], [1, 1], [0, 1], "dormerFace", dir(0, s, 0));
          for (const [u, sgn] of [[u0, -1], [u1, 1]]) quad(world(u, vf, zb), world(u, vb, zb), world(u, vb, zt), world(u, vf, zt), [0, 0], [1, 0], [1, 1], [0, 1], "dormerSide", dir(sgn, 0, 0));
          quad(world(u0, vf, zt), world(u1, vf, zt), world(u1, vb, zt + 0.28), world(u0, vb, zt + 0.28), [0, 0], [1, 0], [1, 1], [0, 1], "dormerSide", dir(0, 0, 1));
        }
      }
      return out;
    }
    const ov = 0.3, drop = ov * (R / (W / 2)), sl = Math.hypot(W / 2 + ov, R + drop);
    for (const s of [-1, 1]) {
      quad(
        world(-L / 2, s * (W / 2 + ov), -drop),
        world(L / 2, s * (W / 2 + ov), -drop),
        world(L / 2, 0, R),
        world(-L / 2, 0, R),
        [0, 0],
        [L / cell, 0],
        [L / cell, sl / cell],
        [0, sl / cell],
        "slope",
        dir(0, s * R, W / 2)
      );
    }
    if (plan.chimney !== false && hash01(`${plan.seed}:chim`) < 0.62) {
      const side = hash01(`${plan.seed}:chimside`) < 0.5 ? -1 : 1, cu = side * (L / 2 - 1.2), cv = (hash01(`${plan.seed}:chimv`) - 0.5) * W * 0.25;
      const cw = 0.42, top = R + 1.15 + hash01(`${plan.seed}:chimh`) * 0.5, base = Math.max(0, R * (1 - Math.abs(cv) / (W / 2)) - 0.4);
      const c = [[cu - cw, cv - cw], [cu + cw, cv - cw], [cu + cw, cv + cw], [cu - cw, cv + cw]];
      for (let i = 0; i < 4; i++) {
        const [a, b] = [c[i], c[(i + 1) % 4]], mid = [(a[0] + b[0]) / 2 - cu, (a[1] + b[1]) / 2 - cv];
        quad(world(a[0], a[1], base), world(b[0], b[1], base), world(b[0], b[1], top), world(a[0], a[1], top), [0, 0], [0.5, 0], [0.5, 1.2 / dims.storeyM * 2], [0, 1.2 / dims.storeyM * 2], "plate", dir(mid[0], mid[1], 0));
      }
      quad(world(c[0][0], c[0][1], top), world(c[1][0], c[1][1], top), world(c[2][0], c[2][1], top), world(c[3][0], c[3][1], top), [0, 0], [1, 0], [1, 1], [0, 1], "slope", dir(0, 0, 1));
    }
    for (const e of [-1, 1]) {
      if (plan.kind === "pitched") {
        tri(world(e * L / 2, -W / 2, 0), world(e * L / 2, W / 2, 0), world(e * L / 2, 0, R), wallUv(-W / 2, 0), wallUv(W / 2, 0), wallUv(0, R), "plate", dir(e, 0, 0));
        continue;
      }
      const prof = gableProfile(plan.gable, W, R), t = 0.32, f = e * L / 2, b = e * (L / 2 - t);
      for (let i = 0; i < prof.length - 1; i++) {
        const [x0, y0] = prof[i], [x1, y1] = prof[i + 1];
        if (Math.abs(x1 - x0) > 1e-4) {
          quad(world(f, x0, 0), world(f, x1, 0), world(f, x1, y1), world(f, x0, y0), wallUv(x0, 0), wallUv(x1, 0), wallUv(x1, y1), wallUv(x0, y0), "plate", dir(e, 0, 0));
          quad(world(b, x0, 0), world(b, x1, 0), world(b, x1, y1), world(b, x0, y0), wallUv(x0, 0), wallUv(x1, 0), wallUv(x1, y1), wallUv(x0, y0), "plate", dir(-e, 0, 0));
          quad(world(f, x0, y0), world(f, x1, y1), world(b, x1, y1), world(b, x0, y0), [0, 0], [1, 0], [1, 1], [0, 1], "plate", dir(0, 0, 1));
        } else {
          const hi = Math.max(y0, y1), lo = Math.min(y0, y1), faceV = y1 > y0 ? -1 : 1;
          quad(world(f, x0, lo), world(b, x0, lo), world(b, x0, hi), world(f, x0, hi), [0, lo / dims.storeyM], [0.1, lo / dims.storeyM], [0.1, hi / dims.storeyM], [0, hi / dims.storeyM], "plate", dir(0, faceV, 0));
        }
      }
    }
    if (plan.dormers) {
      const n = Math.min(3, Math.floor((L - 2) / 3.4));
      for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
        const uc = -L / 2 + (i + 0.5) * L / n, dw = 1.05, u0 = uc - dw / 2, u1 = uc + dw / 2;
        const vf = s * W * 0.27, slopeAt = R * (1 - 0.54), zb = slopeAt - 0.2, zt = zb + 1.35, vb = s * W * 0.05;
        quad(world(u0, vf, zb), world(u1, vf, zb), world(u1, vf, zt), world(u0, vf, zt), [0, 0], [1, 0], [1, 1], [0, 1], "dormerFace", dir(0, s, 0));
        for (const [u, sgn] of [[u0, -1], [u1, 1]]) quad(world(u, vf, zb), world(u, vb, zb), world(u, vb, zt), world(u, vf, zt), [0, 0], [1, 0], [1, 1], [0, 1], "dormerSide", dir(sgn, 0, 0));
        quad(world(u0, vf, zt), world(u1, vf, zt), world(u1, vb, zt + 0.3), world(u0, vb, zt + 0.3), [0, 0], [1, 0], [1, 1], [0, 1], "dormerSide", dir(0, 0, 1));
      }
    }
    return out;
  }

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
  var KITS = [
    {
      // Tower 87 m: brick base, stone clock stage, octagonal stone and lead stages, lantern, crown.
      name: "Westerkerk",
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
      ]
    },
    {
      // The tower is 80 m; OSM stops at 30, so the octagonal stage, lantern and needle spire are stacked on.
      name: "Zuiderkerk",
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
    }
  ];
  var KIT_PART_IDS = new Set(KITS.flatMap((k) => [...k.tiers.map((t) => t.id), ...k.stacks.map((s) => s.onId), ...k.roofs.map((r) => r.id)]));
  var KIT_HIDE_IDS = [...new Set(KITS.flatMap((k) => [...k.tiers.map((t) => t.id), ...k.stacks.map((s) => s.onId)]))];
  var KIT_ROOF = new Map(KITS.flatMap((k) => k.roofs.map((r) => [r.id, r])));
  var sub2 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  var cross2 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  var dot2 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  var layerFor = (mat) => mat === "brick" ? "plain" : "flat";
  var TriSink = class {
    out = [];
    tri(a, b, c, ua, ub, uc, layer, hex2, hint) {
      let n = cross2(sub2(b, a), sub2(c, a)), B = b, C = c, UB = ub, UC = uc;
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
  function stage(sink, cx, cy, ang, shape, w0, w1, z0, z1, mat) {
    const n = shape === "square" ? 4 : 8;
    const radius = (w) => shape === "square" ? w / 2 * Math.SQRT2 : w / 2 / Math.cos(Math.PI / 8);
    const off = shape === "square" ? Math.PI / 4 : Math.PI / 8;
    const ring = (w, z) => Array.from({ length: n }, (_, k) => {
      const a = ang + off + k * 2 * Math.PI / n;
      return [cx + Math.cos(a) * radius(w), cy + Math.sin(a) * radius(w), z];
    });
    const bottom = ring(w0, z0), top = w1 > 0 ? ring(w1, z1) : null, apex = [cx, cy, z1];
    const layer = layerFor(mat), hex2 = MAT_HEX[mat];
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
    return [...out].map(([id, sink]) => ({ id, tris: sink.out }));
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

  // src/canalRecall/threeBuildingMesh.ts
  var parseHex = (hex2) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex2);
    if (!m) return [200, 190, 175];
    const v = parseInt(m[1], 16);
    return [v >> 16 & 255, v >> 8 & 255, v & 255];
  };
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
