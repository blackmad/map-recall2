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
    const { cx: cx2, cy, ux, uy, len: L, wid: W } = rect;
    const world = (u, v, z) => [cx2 + u * ux - v * uy, cy + u * uy + v * ux, h0 + z];
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
      for (const e of [-1, 1]) for (let i = 0; i < prof.length; i++) {
        const a = prof[i], b = prof[(i + 1) % prof.length];
        tri(
          world(e * L / 2, a[0], a[1]),
          world(e * L / 2, b[0], b[1]),
          world(e * L / 2, 0, R * 0.4),
          wallUv(a[0], a[1]),
          wallUv(b[0], b[1]),
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
      ]
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
    }
  ];
  var KIT_PART_IDS = new Set(KITS.flatMap((k) => [...k.tiers.map((t) => t.id), ...k.stacks.map((s) => s.onId), ...k.roofs.map((r) => r.id), ...k.hides ?? []]));
  var KIT_HIDE_IDS = [...new Set(KITS.flatMap((k) => [...k.tiers.map((t) => t.id), ...k.stacks.map((s) => s.onId), ...k.hides ?? []]))];
  var KIT_ROOF = new Map(KITS.flatMap((k) => k.roofs.map((r) => [r.id, { roof: r, wall: k.wall }])));
  var KIT_BODY = new Map(KITS.flatMap((k) => k.wall ? (k.body ?? []).map((id) => [id, k.wall]) : []));
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
  function stage(sink, cx2, cy, ang, shape, w0, w1, z0, z1, mat) {
    const n = shape === "square" ? 4 : 8;
    const radius = (w) => shape === "square" ? w / 2 * Math.SQRT2 : w / 2 / Math.cos(Math.PI / 8);
    const off = shape === "square" ? Math.PI / 4 : Math.PI / 8;
    const ring = (w, z) => Array.from({ length: n }, (_, k) => {
      const a = ang + off + k * 2 * Math.PI / n;
      return [cx2 + Math.cos(a) * radius(w), cy + Math.sin(a) * radius(w), z];
    });
    const bottom = ring(w0, z0), top = w1 > 0 ? ring(w1, z1) : null, apex = [cx2, cy, z1];
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

  // src/canalRecall/facadeExtras.ts
  function hash012(text) {
    let h = 2166136261;
    for (const c of text) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
  }
  var STONE2 = "#cfc6b4";
  var IRON = "#26282b";
  var WOOD = "#5a4030";
  var GREEN = "#3f7a3a";
  var DARKGREEN = "#2c4f33";
  var CONCRETE = "#b9b5ac";
  var GLASS = "#5d6f7c";
  var FLOWERS = ["#e84a7f", "#f2b92e", "#ffffff", "#c04fd0", "#ff7a45", "#e8573d"];
  var SHUTTERS = ["#2c4f33", "#1f3550", "#7a1f2b", "#2a2a2a", "#3f6f5a"];
  var pickOf = (list, r) => list[Math.floor(r * list.length) % list.length];
  var bayCentre = (l, i) => (i + 0.5) * l.bayWidthM;
  function windowXs(c) {
    const l = c.layout, per = c.style === "canal" && l.bayWidthM > 4 ? 2 : 1, out = [];
    for (let i = 0; i < l.bays; i++) for (let k = 0; k < per; k++) out.push(i * l.bayWidthM + (k + 0.5) / per * l.bayWidthM);
    return out;
  }
  var doorX = (c) => c.layout.doorBays.length ? bayCentre(c.layout, c.layout.doorBays[0]) - c.layout.bayWidthM * 0.3 : null;
  var storeyZ = (c, s) => c.base + c.layout.groundM + s * c.layout.storeyM;
  var ALL = ["canal", "c19", "school", "postwar", "modern", "tower"];
  function roofBox(c, s, u0, u1, v0, v1, z0, z1, hex2) {
    const { cx: cx2, cy, ux, uy } = c.rect, vx = -uy, vy = ux;
    return s.box({ x0: cx2 + vx * v0, y0: cy + vy * v0, ux, uy, nx: vx, ny: vy, len: 0 }, u0, u1, 0, v1 - v0, z0, z1, hex2, false);
  }
  var WALL_COMPONENTS = [
    // --- Canal houses --------------------------------------------------------------
    { id: "hoist-beam", styles: ["canal"], p: 0.55, build: (c, s) => {
      const x = c.f.len / 2;
      s.box(c.f, x - 0.1, x + 0.1, 0, 0.95, c.top - 0.55, c.top - 0.35, WOOD, true);
      s.box(c.f, x - 0.02, x + 0.02, 0.85, 0.9, c.top - 0.9, c.top - 0.55, IRON);
    } },
    { id: "hoist-hood", styles: ["canal"], p: 0.2, build: (c, s) => {
      const x = c.f.len / 2;
      s.box(c.f, x - 0.1, x + 0.1, 0, 1, c.top - 0.6, c.top - 0.42, WOOD, true);
      s.slope(c.f, x - 0.35, x + 0.35, 0, 1.1, c.top - 0.05, c.top - 0.4, WOOD);
    } },
    { id: "stoop", styles: ["canal"], p: 0.5, build: (c, s) => {
      const x = doorX(c);
      if (x == null || !c.groundLevel) return;
      for (let k = 0; k < 3; k++) s.box(c.f, x - 0.75, x + 0.75, 0, 1.2 - k * 0.35, c.base + k * 0.18, c.base + (k + 1) * 0.18, STONE2);
    } },
    { id: "stoop-railing", styles: ["canal"], p: 0.35, build: (c, s) => {
      const x = doorX(c);
      if (x == null || !c.groundLevel) return;
      for (const dx of [-0.75, 0.73]) s.box(c.f, x + dx, x + dx + 0.03, 0.1, 1.2, c.base + 0.5, c.base + 0.55, IRON);
    } },
    { id: "double-stoop", styles: ["canal"], p: 0.08, build: (c, s) => {
      const x = doorX(c);
      if (x == null || !c.groundLevel) return;
      s.box(c.f, x - 0.7, x + 0.7, 0, 1, c.base, c.base + 0.75, STONE2);
      for (const side of [-1, 1]) for (let k = 0; k < 3; k++) s.box(c.f, x + side * (0.7 + k * 0.3) - (side > 0 ? 0 : 0.3), x + side * (0.7 + k * 0.3) + (side > 0 ? 0.3 : 0), 0.1, 0.95, c.base, c.base + 0.75 - k * 0.25, STONE2);
    } },
    { id: "basement-well", styles: ["canal", "c19"], p: 0.25, build: (c, s) => {
      if (!c.groundLevel) return;
      const xs = windowXs(c);
      const x = xs[xs.length - 1];
      s.box(c.f, x - 0.6, x + 0.6, 0.6, 0.65, c.base, c.base + 0.75, IRON);
    } },
    { id: "wall-anchors", styles: ["canal"], p: 0.5, build: (c, s) => {
      for (let k = 0; k < Math.min(3, c.layout.storeys); k++) for (const x of [0.5, c.f.len - 0.5]) {
        const z = storeyZ(c, k) - 0.1;
        s.box(c.f, x - 0.25, x + 0.25, 0, 0.05, z - 0.03, z + 0.03, IRON);
        s.box(c.f, x - 0.03, x + 0.03, 0, 0.05, z - 0.25, z + 0.25, IRON);
      }
    } },
    { id: "gable-stone", styles: ["canal"], p: 0.15, build: (c, s) => {
      const x = doorX(c);
      if (x == null) return;
      const z = c.base + c.layout.groundM + 0.25;
      s.box(c.f, x - 0.35, x + 0.35, 0, 0.06, z, z + 0.5, STONE2);
      s.box(c.f, x - 0.25, x + 0.25, 0.06, 0.08, z + 0.08, z + 0.42, pickOf(["#3f6f8a", "#a8442c", "#c9a227"], hash012(c.id)));
    } },
    { id: "door-pediment", styles: ["canal"], p: 0.3, build: (c, s) => {
      const x = doorX(c);
      if (x == null) return;
      const z = c.base + Math.min(2.7, c.layout.groundM - 0.2);
      s.box(c.f, x - 0.65, x + 0.65, 0, 0.18, z, z + 0.14, STONE2, true);
      s.slope(c.f, x - 0.6, x + 0.6, 0, 0.16, z + 0.45, z + 0.14, STONE2);
    } },
    { id: "shutters-3d", styles: ["canal"], p: 0.3, build: (c, s, r) => {
      const hex2 = pickOf(SHUTTERS, r), z0 = c.base + 0.9, z1 = z0 + 1.5;
      for (const x of windowXs(c).slice(0, 3)) for (const side of [-1, 1]) s.box(c.f, x + side * 0.62 - 0.22, x + side * 0.62 + 0.22, 0, 0.06, z0, z1, hex2);
    } },
    // --- Flowers and green --------------------------------------------------------
    { id: "flower-boxes", styles: ALL, p: 0.25, build: (c, s, r) => {
      const z = c.base + c.layout.groundM + 0.85;
      if (!c.layout.storeys) return;
      for (const [i, x] of windowXs(c).slice(0, 4).entries()) {
        s.box(c.f, x - 0.5, x + 0.5, 0, 0.3, z - 0.25, z, WOOD, true);
        s.box(c.f, x - 0.48, x + 0.48, 0.05, 0.32, z, z + 0.2, pickOf(FLOWERS, r + i * 0.17));
      }
    } },
    { id: "ground-flower-boxes", styles: ["canal", "c19"], p: 0.2, build: (c, s, r) => {
      const z = c.base + 0.95;
      for (const [i, x] of windowXs(c).slice(0, 3).entries()) {
        if (doorX(c) != null && Math.abs(x - doorX(c)) < 0.8) continue;
        s.box(c.f, x - 0.5, x + 0.5, 0, 0.28, z - 0.22, z, "#3a3f45", true);
        s.box(c.f, x - 0.48, x + 0.48, 0.04, 0.3, z, z + 0.22, pickOf(FLOWERS, r * 3 + i * 0.29));
      }
    } },
    { id: "geveltuin", styles: ["canal", "c19", "school"], p: 0.3, build: (c, s, r) => {
      if (!c.groundLevel) return;
      const d = doorX(c);
      for (let x = 0.3; x < Math.min(c.f.len - 0.3, 8); x += 0.55) {
        if (d != null && Math.abs(x - d) < 0.7) continue;
        const h = 0.8 + hash012(`${c.id}:${x}`) * 1.4;
        s.box(c.f, x - 0.08, x + 0.08, 0.05, 0.3, c.base, c.base + h, GREEN);
        if (hash012(`${c.id}:f${x}`) < 0.5) s.box(c.f, x - 0.12, x + 0.12, 0.05, 0.33, c.base + h - 0.4, c.base + h, pickOf(["#e84a7f", "#f2b92e", "#c04fd0", "#ffffff"], r + x));
      }
    } },
    { id: "climbing-ivy", styles: ALL, p: 0.08, build: (c, s) => {
      const x0 = hash012(c.wallKey) * Math.max(0, c.f.len - 3), h = Math.min(c.top - c.base, 4 + hash012(`${c.wallKey}:h`) * 6);
      s.box(c.f, x0, x0 + 2.2, 0, 0.12, c.base, c.base + h, DARKGREEN);
      s.box(c.f, x0 + 0.4, x0 + 1.6, 0, 0.14, c.base + h, c.base + h + 1.2, GREEN);
    } },
    // --- 19th century -----------------------------------------------------------------
    { id: "juliet-balcony", styles: ["c19", "school"], p: 0.3, build: (c, s) => {
      if (c.layout.storeys < 2) return;
      const z = storeyZ(c, 1) + 0.05;
      for (const x of windowXs(c).slice(0, 4)) {
        s.box(c.f, x - 0.6, x + 0.6, 0, 0.35, z, z + 0.06, STONE2, true);
        s.box(c.f, x - 0.6, x + 0.6, 0.32, 0.36, z + 0.06, z + 0.95, IRON);
      }
    } },
    { id: "bay-window", styles: ["c19", "school"], p: 0.2, build: (c, s) => {
      if (c.layout.storeys < 1 || c.f.len < 5) return;
      const x = c.f.len / 2, z0 = storeyZ(c, 0), z1 = z0 + c.layout.storeyM * Math.min(2, c.layout.storeys) - 0.2;
      s.box(c.f, x - 1.3, x + 1.3, 0, 0.8, z0, z1, c.wallHex, true);
      s.box(c.f, x - 1.1, x + 1.1, 0.8, 0.82, z0 + 0.5, z1 - 0.4, GLASS);
      s.box(c.f, x - 1.4, x + 1.4, 0, 0.9, z1, z1 + 0.15, STONE2);
    } },
    { id: "cornice-brackets", styles: ["c19", "canal"], p: 0.35, build: (c, s) => {
      const z = c.top - 0.15;
      s.box(c.f, 0, c.f.len, 0, 0.45, z - 0.15, z + 0.1, STONE2, true);
      for (let x = 0.4; x < c.f.len - 0.2; x += 1.1) s.box(c.f, x - 0.08, x + 0.08, 0, 0.35, z - 0.55, z - 0.15, STONE2);
    } },
    { id: "door-canopy", styles: ["c19", "school", "postwar"], p: 0.25, build: (c, s) => {
      const x = doorX(c);
      if (x == null) return;
      const z = c.base + Math.min(2.6, c.layout.groundM - 0.25);
      s.box(c.f, x - 0.8, x + 0.8, 0, 0.9, z, z + 0.1, c.style === "c19" ? IRON : CONCRETE, true);
    } },
    { id: "downpipe", styles: ALL, p: 0.4, build: (c, s) => {
      const x = hash012(`${c.wallKey}:dp`) < 0.5 ? 0.15 : c.f.len - 0.15;
      s.box(c.f, x - 0.05, x + 0.05, 0, 0.1, c.base, c.top - 0.2, "#4a4d50");
      s.box(c.f, x - 0.15, x + 0.15, 0, 0.2, c.top - 0.45, c.top - 0.2, "#4a4d50");
    } },
    { id: "gutter", styles: ["canal", "c19", "school"], p: 0.3, build: (c, s) => {
      s.box(c.f, 0, c.f.len, 0, 0.16, c.top - 0.12, c.top, "#3a3d40", true);
    } },
    // --- Amsterdam School ------------------------------------------------------------
    { id: "brick-balcony", styles: ["school"], p: 0.3, build: (c, s) => {
      for (let k = 1; k < Math.min(4, c.layout.storeys + 1); k++) {
        const x = c.f.len / 2, z = storeyZ(c, k - 1) + 0.05;
        s.box(c.f, x - 1.4, x + 1.4, 0, 1, z, z + 0.15, c.wallHex, true);
        s.box(c.f, x - 1.4, x + 1.4, 0.85, 1, z + 0.15, z + 1, c.wallHex);
      }
    } },
    { id: "brick-bands", styles: ["school"], p: 0.35, build: (c, s) => {
      for (let k = 0; k < c.layout.storeys; k++) s.box(c.f, 0, c.f.len, 0, 0.05, storeyZ(c, k) - 0.15, storeyZ(c, k), "#6b3a2c");
    } },
    { id: "stair-glass", styles: ["school", "postwar", "modern"], p: 0.3, build: (c, s) => {
      const x = doorX(c) ?? c.f.len / 2;
      s.box(c.f, x - 0.5, x + 0.5, 0, 0.06, c.base + c.layout.groundM + 0.3, c.top - 0.6, GLASS);
    } },
    { id: "window-grilles", styles: ["school", "c19"], p: 0.15, build: (c, s) => {
      const d = doorX(c);
      for (const x of windowXs(c).slice(0, 4)) {
        if (d != null && Math.abs(x - d) < 0.8) continue;
        for (let k = -2; k <= 2; k++) s.box(c.f, x + k * 0.22 - 0.02, x + k * 0.22 + 0.02, 0.04, 0.08, c.base + 0.8, c.base + 2.4, IRON);
      }
    } },
    // --- Postwar / modern ------------------------------------------------------------------
    { id: "balcony-slabs", styles: ["postwar"], p: 0.5, build: (c, s) => {
      for (let k = 0; k < Math.min(6, c.layout.storeys); k++) for (let i = 0; i < c.layout.bays; i += 2) {
        const x = bayCentre(c.layout, i), z = storeyZ(c, k) + 0.02;
        s.box(c.f, x - 1.4, x + 1.4, 0, 1.2, z, z + 0.15, CONCRETE, true);
        s.box(c.f, x - 1.4, x + 1.4, 1.15, 1.2, z + 0.15, z + 1, k % 2 ? "#d9d4c7" : "#c84b3c");
      }
    } },
    { id: "gallery-walkway", styles: ["postwar"], p: 0.18, build: (c, s) => {
      for (let k = 0; k < Math.min(8, c.layout.storeys); k++) {
        const z = storeyZ(c, k) + 0.02;
        s.box(c.f, 0, c.f.len, 0, 1.5, z, z + 0.18, CONCRETE, true);
        s.box(c.f, 0, c.f.len, 1.45, 1.5, z + 0.18, z + 1.05, "#e6e2d8");
      }
    } },
    { id: "satellite-dishes", styles: ["postwar"], p: 0.3, build: (c, s) => {
      for (let k = 0; k < 3; k++) {
        const x = hash012(`${c.wallKey}:sd${k}`) * c.f.len, z = storeyZ(c, Math.floor(hash012(`${c.wallKey}:sz${k}`) * Math.max(1, c.layout.storeys))) + 1.3;
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
        const z = storeyZ(c, k) + 0.02, x = c.f.len * (0.25 + 0.5 * (k % 2));
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
    { id: "plinth", styles: ["canal", "c19", "school"], p: 0.35, build: (c, s) => {
      if (c.groundLevel) s.box(c.f, 0, c.f.len, 0, 0.06, c.base, c.base + 0.5, "#3a3530");
    } },
    // --- Street life ------------------------------------------------------------------
    { id: "parked-bikes", styles: ALL, p: 0.3, build: (c, s, r) => {
      if (!c.groundLevel) return;
      const n = 1 + Math.floor(r * 4), x0 = hash012(`${c.wallKey}:bx`) * Math.max(0, c.f.len - n * 0.7);
      for (let k = 0; k < n; k++) {
        const x = x0 + k * 0.7, hex2 = pickOf(["#1d1d1f", "#2f5d8a", "#7a1f2b", "#3f6f5a", "#c9a227"], hash012(`${c.wallKey}:bc${k}`));
        s.box(c.f, x - 0.03, x + 0.03, 0.15, 1.9, c.base + 0.3, c.base + 0.6, hex2);
        s.box(c.f, x - 0.02, x + 0.02, 0.15, 0.25, c.base, c.base + 0.95, hex2);
        s.box(c.f, x - 0.02, x + 0.02, 1.75, 1.85, c.base, c.base + 0.9, hex2);
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
      s.box(c.f, x + 0.6, x + 0.64, 0, 0.3, z + 0.3, z + 0.34, IRON);
      s.box(c.f, x + 0.52, x + 0.72, 0.2, 0.4, z, z + 0.3, "#f3d58a");
    } },
    { id: "house-flag", styles: ["canal", "c19"], p: 0.06, build: (c, s, r) => {
      const z = storeyZ(c, 0) + 0.5;
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
      roofBox(c, s, -1, 1, -1, 1, c.z + 2, c.z + 2.1, pickOf(["#e85a3c", "#f2b92e", "#ffffff", "#2a9d8f"], r));
    } },
    { id: "roof-extension", styles: ["c19", "school", "postwar"], p: 0.15, build: (c, s) => {
      const { len, wid } = c.rect;
      if (len < 8 || wid < 6) return;
      roofBox(c, s, -len * 0.3, len * 0.3, -wid * 0.1, wid * 0.35, c.z, c.z + 2.6, "#5d6064");
      roofBox(c, s, -len * 0.3, len * 0.3, -wid * 0.12, -wid * 0.1, c.z + 0.3, c.z + 2.2, GLASS);
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
        roofBox(c, s, u - 0.6, u + 0.6, -0.5, 0.5, c.z, c.z + 0.35, GLASS);
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
      for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) roofBox(c, s, u - 0.06, u + 0.06, v - 0.06, v + 0.06, c.z, c.z + 1.6, IRON);
    } }
  ];
  var COMPONENT_COUNT = WALL_COMPONENTS.length + ROOF_COMPONENTS.length;

  // src/canalRecall/threeBuildingMesh.ts
  var parseHex = (hex2) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex2);
    if (!m) return [200, 190, 175];
    const v = parseInt(m[1], 16);
    return [v >> 16 & 255, v >> 8 & 255, v & 255];
  };
  var LID_SHADE = 0.58 + 0.42 * 0.8;
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
    const slab = (o, o0, o1, hex2) => {
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
    slab(front2.outline, 0, d, front2.hex);
    for (const extra of front2.slabs ?? []) slab(extra.outline, extra.out0 + d, extra.out1 + d, extra.hex);
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
  var WHITE2 = "#f2f0ea";
  var INK = "#1d1d1f";
  var CHAIR = "#6b5444";
  var LAMP = "#f3d58a";
  var contrast = (hex2) => luma(hex2) < 120 ? WHITE2 : INK;
  var BAY_W = { D: 1.05, C: 1.8, d: 1, P: 0.35 };
  function layoutBays(tokens, x0, x1) {
    const parsed = tokens.map((t) => {
      const [k, w] = t.split(":");
      return { k, w: w ? Number(w) : BAY_W[k] };
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
    const GLASS2 = spec.glass ?? DARK_GLASS;
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
    const fascia = spec.fascia === false ? null : spec.fascia ?? frame;
    const signText = spec.text ?? spec.name, letters = spec.letters ?? contrast(fascia ?? wallHex);
    const pad = 0.15;
    if (fascia) boxes.push({ x0: x0 + 0.05, x1: x1 - 0.05, z0: fz0, z1: h - 0.05, out0: WALL, out1: OUT + 0.06, hex: fascia });
    const signOut = fascia ? OUT + 0.06 : WALL;
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
      faces.push(disc(cx2, cz, logoR, signOut + 0.01, spec.logo.ring ?? WHITE2), disc(cx2, cz, logoR * 0.78, signOut + 0.02, spec.logo.hex));
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
    const REC = OUT - 0.045, SHEEN = mixHex(GLASS2, "#c8d4de", 0.3);
    const glassPane = (g0, g1, z0, z1, out) => {
      boxes.push({ x0: g0, x1: g1, z0, z1, out0: WALL, out1: out, hex: GLASS2 });
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
            faces.push({ points: [[g0, glassTop - 0.35], ...arch(g1, g0, glassTop - 0.35, 0.3, 6).map(([x, z]) => [x, z])], out: OUT + 5e-3, hex: GLASS2 });
          } else glassPane(g0, g1, gBot, glassTop, REC);
          const [cols, rows] = spec.grid ?? (style === "big" || style === "arched" ? [1, 1] : style === "split" ? [Math.max(1, Math.round(w / 1.4)), 1] : [Math.max(2, Math.round(w / 0.7)), 2]);
          paneGrid(g0, g1, gBot, style === "arched" ? glassTop - 0.35 : glassTop, cols, rows, REC);
          if (spec.transom) {
            const n = Math.max(2, Math.round(w / 0.55)), pw = (g1 - g0) / n;
            for (let i = 0; i < n; i++) boxes.push({ x0: g0 + i * pw + 0.04, x1: g0 + (i + 1) * pw - 0.04, z0: glassTop + 0.08, z1: openTop - 0.08, out0: WALL, out1: REC, hex: GLASS2 });
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
          if (top < openTop - 0.3) boxes.push({ x0: a + 0.12, x1: b - 0.12, z0: top + 0.08, z1: (shop ? openTop : top + 0.5) - 0.08, out0: shop ? OUT : WALL, out1: (shop ? OUT : WALL) + 0.01, hex: GLASS2 });
          break;
        }
        case "C": {
          const top = Math.min(2.6, openTop - 0.1), mid = (a + b) / 2;
          boxes.push({ x0: a, x1: b, z0: 0, z1: openTop, out0: WALL, out1: OUT, hex: doorHex });
          for (const [l0, l1] of [[a + 0.1, mid - 0.04], [mid + 0.04, b - 0.1]]) {
            boxes.push({ x0: l0 + 0.1, x1: l1 - 0.1, z0: 0.9, z1: top - 0.12, out0: OUT, out1: OUT + 0.01, hex: GLASS2 });
            paneGrid(l0 + 0.1, l1 - 0.1, 0.9, top - 0.12, 2, 4, OUT + 0.01);
            boxes.push({ x0: l0 + 0.1, x1: l1 - 0.1, z0: 0.15, z1: 0.75, out0: OUT, out1: OUT + 0.03, hex: doorHex });
          }
          boxes.push({ x0: a + 0.12, x1: b - 0.12, z0: top + 0.06, z1: openTop - 0.06, out0: OUT, out1: OUT + 0.01, hex: GLASS2 });
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
      if (fascia && on !== "plinth") bands.push([fz0, h - 0.05, OUT + 0.061]);
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
          boxes.push(...stripedAwning(ax0, ax1, aZ, 1.4, aHex, spec.awningHex2 ?? WHITE2).map((b) => ({ ...b, out0: OUT })));
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
    const sAt = (spec.signAt ?? (door === "right" ? "left" : "right")) === "left" ? x0 + 0.25 : x1 - 0.25, sHex = spec.signHex ?? (fascia ?? frame);
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
      return { ...base, hex: f.hex, outline, bodyTopM: f.topM, slabs: (f.slabs ?? []).map((sl) => ({ ...sl, outline: reg(sl.outline) })), boxes: [...ribs, ...spec.bays === "none" ? kept.slice(1) : kept], windows: (f.windows ?? []).map((w) => ({ ...w, xs: w.xs.map((x) => x + sh), hex: GLASS2 })) };
    }
    return { ...base, storefront: true, carrierHex: spec.buildingHex, hex: wallHex, outline: [[x0, 0.01], [x1, 0.01]], boxes: kept, windows: [] };
  }

  // src/canalRecall/storefrontSpecs.ts
  var WHITE3 = "#ece8de";
  var RED = "#c8321f";
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
    "hunkar-restaurant-16023": { name: "Hunkar", frame: "#2a2c2e", fascia: "#2a2c2e", awning: "canopy", awningHex: "#3a3d40", windows: "split", door: "centre", terrace: true, plants: true },
    "ibericus-amsterdam-79660": { name: "Ibericus", frame: "#a0602a", fascia: "#1f1f1f", windows: "panes", door: "left" },
    "il-delfino-blu-36816": null,
    "il-primo-68332": { name: "Il Primo", frame: "#e8e6e0", fascia: "#2a2c2e", windows: "split", door: "centre" },
    "il-sogno-08857": null,
    "il-tramezzino-68426": { name: "Il Tramezzino", frame: "#4a2a1c", fascia: "#4a2a1c", windows: "big", door: "right" },
    "impero-romano-52924": { name: "Impero Romano", frame: "#2a2420", fascia: "#3a2a22", windows: "panes", door: "centre", terrace: true },
    "incanto-79461": null,
    "indrapura-78846": { name: "Indrapura", frame: "#1f1f1f", fascia: "#1f4d3a", windows: "panes", door: "centre", transom: true, sign: "round", signHex: "#c9a227" },
    "insieme-71619": { name: "Insieme", frame: "#e8e6e0", fascia: "#3a3d40", windows: "panes", door: "left", plants: true },
    "instock-amsterdam-69762": null,
    "isshin-59354": { name: "Isshin", frame: "#2a2420", fascia: false, windows: "big", door: "left", sign: "square", signHex: RED },
    "italia-oggi-71755": { name: "Italia Oggi", frame: "#1f1f1f", fascia: false, windows: "arched", door: "left", plants: true },
    // Sheet 11.
    "jen-s-bing-81194": { name: "Jen's Bing", frame: "#e8e2d4", fascia: false, awning: "flat", awningHex: "#b8b4aa", windows: "big", door: "right", plants: true },
    "jinso-07340": { name: "Jinso", frame: "#2a2c2e", fascia: false, windows: "split", door: "centre", terrace: true, heightM: 4.4 },
    "joselito-tapas-79619": { name: "Joselito", frame: "#1f2a24", fascia: false, windows: "panes", door: "centre" },
    "jun-93249": { name: "Jun", frame: "#6b1f1a", fascia: "#6b1f1a", windows: "panes", door: "centre", plants: true },
    "kaagman-kortekaas-69080": null,
    "kafe-kontrast-36508": { name: "Kontrast", frame: "#1f1f1f", fascia: "#1f1f1f", windows: "big", door: "centre", terrace: true },
    "kamasutra-78550": { name: "Kamasutra", frame: "#e8e6e0", fascia: false, windows: "arched", door: "left", sign: "round", signHex: RED },
    "kathmandu-kitchen-15728": { name: "Intisari", frame: "#e8e6e0", fascia: false, windows: "big", door: "centre" },
    "kebaphan-69641": { name: "Kebaphan", frame: "#1f4d3a", wall: "#2a2c2e", fascia: "#1f4d3a", fasciaH: 0.7, text: "KEBAPHAN", letters: "#f2efe8", span: [0, 5.4], bays: "W D:1.0 W", heightM: 3.9 },
    "kebec-corner-13694": null,
    "kerkzicht-29775": { name: "Kerkzicht", frame: "#2a2420", doorHex: "#e8e2d4", wall: "#8a4a3a", plinth: "#e8e4dc", fascia: false, text: "", span: [0, 8.2], bays: "B:0.8 W:1.0 B:0.4 W:1.0 B:0.9 C:1.2 B:0.6 W:1.1 B", rollers: "#2f4a38", awning: "scalloped", awningHex: "#ece6d6", terrace: true, heightM: 4.3, facade: { outline: [[0, 4.3], [8.2, 4.3]], hex: "#8a4a3a", topM: 4.3, slabs: [{ outline: [[0, 4.3], [2.6, 5.6], [5.9, 5.6], [8.2, 4.5], [8.2, 4.3]], hex: "#4a2e2c", out0: -1.2, out1: -0.8 }, { outline: [[2.6, 4.3], [2.6, 6.6], [4.25, 7.1], [5.9, 6.6], [5.9, 4.3]], hex: "#8a4a3a", out0: -0.6, out1: -0.2 }], windows: [{ xs: [3.6, 4.85], rows: [[5, 6]], w: 0.45, frameHex: "#e8e2d4" }] } },
    "kilimanjaro-37317": { name: "Kilimanjaro", frame: "#e8e6e0", fascia: "#e3c020", windows: "big", door: "right" },
    "kim-s-so-18480": { name: "Kim's So", frame: "#2a2c2e", fascia: "#2a2c2e", windows: "split", door: "centre" },
    "klein-breda-78942": { name: "Klein Breda", frame: "#1f2a2a", fascia: false, windows: "panes", door: "right", terrace: true },
    "koeah-75819": { name: "Koeah", frame: "#3a3634", fascia: false, windows: "split", door: "centre", plants: true },
    "kokohili-01213": { name: "Kokohili", frame: "#e8e6e0", fascia: "#2a2c2e", awning: "flat", awningHex: "#9a2a3a", windows: "split", door: "centre" },
    // Sheet 12.
    "kreeftenbar-12628": { name: "Kreeftenbar", frame: "#2a2c2e", wall: "#8a6a5a", fascia: "#b85a8a", fasciaH: 0.6, text: "KREEFTENBAR", letters: "#f2efe8", span: [3.2, 12.8], bays: "W P:0.6 W W", grid: [2, 1], banner: { hex: "#5a3a7a" }, heightM: 4.2 },
    "kruabuppha-87294": { name: "Kruabuppha", frame: "#e8e6e0", fascia: "#2a2c2e", windows: "big", door: "left" },
    "kyo-82963": { name: "Kyo", frame: "#6b1f22", fascia: false, windows: "panes", transom: true, door: "centre" },
    "la-brasa-67816": { name: "La Brasa", frame: "#2a2c2e", fascia: false, windows: "arched", door: "right", plants: true },
    "la-bruschetta-87323": null,
    "la-cacerola-71888": { name: "La Cacerola", frame: "#1f1f1f", fascia: false, windows: "panes", door: "left", plants: true },
    "la-cantina-79571": null,
    "la-fucina-81789": { name: "La Fucina", frame: "#2a2c2e", fascia: "#2a2c2e", windows: "split", door: "right", terrace: true },
    "la-maschera-68857": { name: "La Maschera", frame: "#2a2a28", fascia: false, windows: "big", door: "right" },
    "la-oliva-pintxos-y-vinos-72953": { name: "La Oliva", frame: "#e8e2d4", fascia: false, windows: "split", door: "centre", sign: "square", signHex: "#1f5a32" },
    "la-paella-78816": { name: "La Paella", frame: "#2a2420", fascia: false, windows: "split", door: "left" },
    "la-perla-72878": { name: "La Perla", frame: "#3d4652", fascia: false, awning: "flat", awningHex: "#8a8070", windows: "split", door: "right", plants: true },
    "la-piazza-65128": { name: "La Piazza", frame: "#2a2420", fascia: "#3a2a22", letters: "#c8282a", windows: "big", door: "left", heightM: 4.4 },
    "la-polpetta-31526": { name: "La Polpetta", frame: "#2a2c2e", fascia: "#2a2c2e", windows: "split", door: "centre", plants: true },
    "la-reinita-empanadas-73572": { name: "La Reinita", frame: "#2a2a28", fascia: false, awning: "flat", awningHex: "#1f4d3a", windows: "big", door: "left" },
    "la-roma-81243": { name: "La Roma", frame: "#ecebe6", doorHex: "#2a2c2e", wall: "#8a8a86", plinth: "#ecebe6", fascia: "#ecebe6", fasciaH: 0.6, text: "", span: [0.2, 4.8], bays: "d:0.8 B:0.3 W:2.4 B:0.2 d:0.6", signs: [{ text: "TAKE AWAY AFHALEN", x: [1.9, 3.6], z: [1.9, 2.3], letters: "#c8282a", board: "#ecebe6" }], heightM: 4 },
    // Sheet 13.
    "la-ruelle-54949": { name: "La Ruelle", frame: "#2a2c2e", doorHex: "#2a2c2e", wall: "#ece6d6", buildingHex: "#7a4a38", fascia: "#ece6d6", fasciaH: 0.5, text: "O'TOOLE", textH: 0.18, letters: "#6a6a66", span: [0.3, 4.8], bays: "W C:1.2 W", grid: [3, 3], plants: true, heightM: 4.6 },
    "ladybird-fried-chicken-54143": { name: "Ladybird", frame: "#7a2a1c", fascia: false, awning: "flat", awningHex: "#e8e6e0", windows: "big", door: "right", terrace: true },
    "le-4-stagioni-57247": { name: "Le 4 Stagioni", frame: "#3a3d40", fascia: false, windows: "split", door: "centre", terrace: true },
    "le-sud-76570": null,
    "lemoene-33308": null,
    "leonardo-s-ravioli-bar-59331": { name: "Leonardo's", frame: "#1d1d1f", wall: "#1d1d1f", fascia: "#1d1d1f", fasciaH: 0.3, text: "", span: [2.7, 10.7], bays: "B:1.3 W B:0.9", rollers: "#c8ccd0", graffiti: ["#e8a030", "#1d1d1f", "#f2efe8", "#d87820"], heightM: 3.6 },
    "les-zazous-79884": null,
    "leziz-71219": { name: "Leziz", frame: "#2a2c2e", fascia: "#2a2c2e", windows: "split", door: "centre", plants: true },
    "little-chinatown-asian-cuisine-19312": null,
    "little-saigon-68107": { name: "Little Saigon", frame: "#1f1f1f", fascia: "#e8e6e0", letters: "#2a2a2c", windows: "big", door: "centre", heightM: 4.2 },
    "lloyd-hotel-18149": null,
    "lokaal-van-de-stad-40908": { name: "Lokaal van de Stad", frame: "#2a2420", fascia: false, awning: "flat", awningHex: "#3a3634", windows: "split", door: "centre", terrace: true, plants: true },
    "lombardo-s-77099": { name: "Lombardo's", frame: "#2a2c2e", fascia: false, awning: "flat", awningHex: "#1f1f1f", windows: "panes", door: "right" },
    "long-pura-70087": { name: "Long Pura", frame: "#2a2c2e", doorHex: "#7a2a20", wall: "#2a2c2e", fascia: "#2a2c2e", fasciaH: 0.8, text: "LONG PURA", letters: "#d8a030", text2: "RESTAURANT", span: [0, 4.1], bays: "W:2.2 B:0.3 d:0.8 B", glass: "#5a4a38", heightM: 4.4 },
    "loulou-pizzabar-57281": { name: "Loulou", frame: "#2a2420", fascia: false, windows: "arched", door: "centre", plants: true },
    "lucca-due-80345": { name: "Lucca Due", frame: "#5a1a14", fascia: "#5a1a14", windows: "panes", transom: true, door: "left", sign: "lamp" },
    // Sheet 14.
    "lucius-75671": { name: "Lucius", frame: "#1f2a2a", fascia: false, awning: "flat", awningHex: "#1f2a2a", windows: "panes", door: "centre" },
    "lucky-house-73005": { name: "Lucky House", frame: "#e8e6e0", fascia: false, windows: "panes", door: "left" },
    "luna-73311": { name: "Luna", frame: "#6b1f22", fascia: "#3a2a22", windows: "panes", door: "right" },
    "lupe-72083": { name: "Lupe", frame: "#2a2c2e", fascia: "#2a2c2e", windows: "split", door: "centre", terrace: true },
    "made-s-warung-26789": { name: "Made's Warung", frame: "#9a5a22", fascia: "#3a2a22", windows: "panes", transom: true, door: "right", plants: true },
    "maenaam-thai-75826": { name: "Maenaam", frame: "#1f1f1f", fascia: false, windows: "panes", door: "centre", shutters: "#b8282a" },
    "makachi-64043": { name: "Mercer", frame: "#e8e6e0", fascia: false, awning: "flat", awningHex: "#2a2a2c", windows: "big", door: "centre" },
    "mama-makan-43487": { name: "Mama Makan", frame: "#e3d8a0", fascia: false, windows: "split", door: "centre", heightM: 4.2 },
    "mamas-tapas-63129": { name: "Viswinkel Tol", frame: WHITE3, fascia: "#c8282a", awning: "flat", awningHex: "#c8282a", windows: "big", door: "left" },
    "mangia-pizza-centrum-75482": { name: "Mangia", frame: "#3a3a3a", fascia: false, windows: "big", door: "right", terrace: true },
    "mangiancora-65866": { name: "Mangiancora", frame: "#2f4a40", fascia: false, windows: "split", door: "centre", sign: "square", signHex: RED },
    "maris-piper-brasserie-36608": { name: "Maris Piper", frame: "#1f1f1f", fascia: false, awning: "canopy", awningHex: "#3a3d40", windows: "panes", door: "centre" },
    "marmaris-grill-pizza-73393": null,
    "maydanoz-56807": { name: "Maydanoz", frame: "#2a2c2e", fascia: "#2a2c2e", letters: "#5fa58a", awning: "striped", awningHex: "#3a3a3a", windows: "big", door: "left" },
    "mchi-42337": null,
    "meghna-78969": { name: "Meghna", frame: "#3a1a1a", fascia: false, windows: "panes", door: "right" },
    // Sheet 15.
    "men-impossible-69882": { name: "Men Impossible", frame: "#2a2420", fascia: false, windows: "panes", door: "left" },
    "merza-45331": { name: "Merza", frame: "#2a2c2e", wall: "#c8c4b8", fascia: false, text: "", span: [0, 3.9], bays: "W", awning: "flat", awningHex: "#2a3a7a", terrace: true, heightM: 3.4 },
    "mesken-56710": { name: "Mesken", frame: "#2a2420", fascia: "#7a1f2b", windows: "split", door: "centre", terrace: true },
    "middl-eat-67960": { name: "Middl'Eat", frame: "#e8e2d4", fascia: "#1f4d3a", windows: "split", door: "right" },
    "miko-s-28387": null,
    "mima-09184": { name: "Mima", frame: "#3a3d40", fascia: false, windows: "split", door: "centre", heightM: 4.6 },
    "mirchi-63270": { name: "Mirchi", frame: "#e8e6e0", fascia: "#2a2c2e", windows: "big", door: "right" },
    "miri-mary-83742": { name: "Miri Mary", frame: "#2a3a5a", fascia: "#8a8a88", windows: "split", door: "centre" },
    "moak-pancakes-19677": { name: "Moak", frame: "#e8e6e0", fascia: "#2a4a8a", windows: "big", door: "left" },
    "moche-67178": { name: "Moche", frame: "#5a3a22", fascia: false, windows: "arched", door: "left" },
    "mogu-amsterdam-89620": { name: "Loving Hut", frame: "#e8e2d4", fascia: "#e8e2d4", letters: "#3a7a3a", windows: "big", door: "right", plants: true },
    "momo-tibet-57116": { name: "Momo Tibet", frame: "#c9a227", fascia: "#c8282a", windows: "split", door: "right" },
    "mont-blanc-66374": { name: "Mont Blanc", frame: "#e8e2d4", fascia: false, windows: "panes", door: "right" },
    "moon-68473": null,
    "moshik-06274": { name: "&samhoud", frame: "#a89a80", wall: "#4a4440", fascia: false, text: "&SAMHOUD", textAt: [10.5, 13.6], letters: "#f2f0ea", logo: { hex: "#2a5a9a" }, span: [0, 20.2], bays: "W:3.8 B:0.8 W:2.4 W:2.4 B:1.0 D:2.0 W:1.6 B:0.9 W W", grid: [1, 1], heightM: 4.6 },
    "mount-everest-05308": { name: "Mount Everest", frame: "#e8e6e0", fascia: "#c86a2a", windows: "big", door: "left" },
    // Sheet 16.
    "mr-gyoza-61236": { name: "Mr Gyoza", frame: "#e8e2d4", fascia: false, windows: "big", door: "left" },
    "mr-sushi-54293": { name: "Mr. Sushi", frame: "#1d1d1f", wall: "#1d1d1f", fascia: "#1d1d1f", fasciaH: 0.5, text: "MR. SUSHI", letters: "#f2efe8", span: [0, 4.5], bays: "W D:0.9 W", glass: "#3a2a2a", heightM: 3.6 },
    "muang-thai-66837": { name: "Muang Thai", frame: "#d8ccb0", fascia: false, windows: "split", door: "none" },
    "mudavim-58188": null,
    "my-surinaamse-broodjes-36700": { name: "Surinaamse", frame: "#c8ccd0", wall: "#c8ccd0", fascia: "#2f8a4a", fasciaH: 1.2, text: "SURINAAMSE", letters: "#f2f0ea", span: [0, 4], bays: "W", rollers: "#c8ccd0", plants: true, heightM: 4.3 },
    "mythos-69645": { name: "Mythos", frame: WHITE3, fascia: "#2a4a8a", windows: "panes", door: "centre", sign: "round", signHex: "#2a4a8a" },
    "naa-thai-63810": { name: "Naa Thai", frame: "#2a2420", fascia: false, awning: "flat", awningHex: "#b8282a", windows: "big", door: "left" },
    "nap-amsterdam-83408": null,
    "nara-nara-81960": { name: "Nara Nara", frame: "#8fc8b0", fascia: false, awning: "striped", awningHex: "#1f1f1f", windows: "big", door: "centre", heightM: 4.2 },
    "nefis-etli-ekmek-59658": { name: "Nefis", frame: "#e8e6e0", fascia: false, awning: "canopy", awningHex: "#9a1f2a", windows: "big", door: "right", terrace: true },
    "nikotin-19058": { name: "Nikotin", frame: "#1f1f1f", fascia: false, windows: "panes", door: "centre", terrace: true, heightM: 4.2 },
    "nk-thai-noodles-68178": { name: "Thai Corner", frame: "#e8e6e0", fascia: "#e8e6e0", windows: "big", door: "right", plants: true },
    "nnea-pizza-66802": { name: "NNea", frame: "#1f3a8a", fascia: "#1f3a8a", windows: "big", door: "right" },
    "no-man-s-art-gallery-94050": { name: "No Man's Art", frame: "#e8e6e0", fascia: false, awning: "flat", awningHex: "#c8282a", windows: "panes", door: "centre" },
    "noemi-37240": null,
    "nom-nom-vietnamese-foodshop-73355": null,
    // Sheet 17.
    "nonna-06423": { name: "Nonna", frame: "#1f2a3a", fascia: "#1f2a3a", windows: "split", door: "centre" },
    "northeast-kitchen-67017": { name: "Northeast Kitchen", frame: "#2a2c2e", fascia: false, awning: "striped", awningHex: "#2a3a5a", awningHex2: "#d8d4ca", windows: "split", door: "centre" },
    "nyonya-78393": { name: "Coffeeshop", frame: "#1f1f1f", fascia: "#1f1f1f", windows: "big", door: "right" },
    "o-bistro-68625": { name: "O Bistro", frame: "#ecebe6", doorHex: "#ecebe6", wall: "#ecebe6", fascia: "#2f5a3a", fasciaH: 0.3, text: "BISTRO", textH: 0.18, letters: "#d8d4cc", span: [0, 5.7], bays: "W:0.8 d:0.8 W W:1.0 B:0.3 d:0.9 B", transom: true, heightM: 3.8 },
    "o-mai-vietnamees-restaurant-78850": { name: "O'Mai", frame: "#e8e6e0", fascia: false, windows: "big", door: "centre" },
    "o-sole-mio-68570": { name: "O Sole Mio", frame: "#e8e6e0", fascia: "#1f3a6a", windows: "big", door: "right", transom: true },
    "obalade-suya-55235": { name: "Obalade", frame: "#3a2a22", fascia: false, awning: "flat", awningHex: "#3a2a22", windows: "split", door: "centre", plants: true },
    "oceania-40557": { name: "Oceania", frame: "#1f2a24", fascia: "#3a2420", awning: "flat", awningHex: "#2a2c2e", windows: "split", door: "centre", plants: true },
    "ode-aan-de-amstel-40353": { name: "Ode aan de Amstel", frame: "#8a8478", fascia: false, windows: "split", door: "none" },
    "olijfje-65616": null,
    "omahe-72216": { name: "Omahe", frame: "#e8e6e0", fascia: false, awning: "flat", awningHex: "#e8e6e0", windows: "big", door: "left" },
    "omg-burger-79311": { name: "OMG!", frame: "#e8e6e0", fascia: "#e8e6e0", letters: "#2f7a3a", windows: "split", door: "centre", terrace: true, plants: true },
    "ons-dorpje-21431": null,
    "oresti-s-taverna-62627": { name: "Oresti's", frame: "#e8e2d4", fascia: "#7a1f2b", windows: "arched", door: "centre", terrace: true, plants: true },
    "oriental-city-78751": { name: "Oriental City", frame: "#e8e6e0", fascia: "#3a3d40", windows: "split", door: "left", sign: "round", signHex: "#e3a020" },
    "osteria-bella-ciao-73586": null,
    // Sheet 18.
    "otaru-91498": { name: "Otaru", frame: "#e8e2d4", fascia: "#e8e2d4", windows: "panes", door: "centre", shutters: "#8a6a4a" },
    "otemba-61722": { name: "Otemba", frame: "#2a2420", fascia: false, awning: "flat", awningHex: "#1f1f1f", windows: "split", door: "centre", terrace: true },
    "otemba-ramen-36441": { name: "Otemba Ramen", frame: "#e8e6e0", fascia: false, windows: "arched", door: "left" },
    "pad-thai-72000": { name: "Pad Thai", frame: "#e8e2d4", fascia: "#1f4d3a", windows: "big", door: "right" },
    "paik-s-noodle-75231": null,
    "palladio-70190": { name: "Palladio", frame: "#2a2a28", fascia: false, awning: "flat", awningHex: "#2a2a28", windows: "panes", door: "centre", sign: "lamp" },
    "paloma-blanca-60566": { name: "Coffee Roastery", frame: "#2a2c2e", fascia: false, awning: "flat", awningHex: "#2a2c2e", windows: "split", door: "centre", plants: true },
    "pancakes-amsterdam-aan-t-ij-77894": null,
    "pannenkoekerij-gansi-87577": null,
    "papa-ali-mix-grill-82440": { name: "Papa Ali", frame: WHITE3, fascia: "#c8282a", windows: "big", door: "left", terrace: true },
    "pasta-e-pizza-62433": { name: "Pasta e Pizza", frame: "#9ad8b0", fascia: "#1f4d3a", windows: "split", door: "right" },
    "pasta-paradijs-52857": { name: "Pasta Paradijs", frame: "#2a2a2c", fascia: "#e8e6e0", letters: "#c8282a", windows: "big", door: "left" },
    "pastai-60962": { name: "Pastai", frame: "#1f3a3a", fascia: false, windows: "big", door: "left" },
    "pastini-72218": { name: "Pastini", frame: "#e8e6e0", fascia: "#3a3d40", windows: "panes", door: "right", transom: true },
    "pata-negra-71777": { name: "Pata Negra", frame: "#4a3a1c", fascia: false, windows: "split", door: "centre", terrace: true },
    "pepenero-64223": { name: "Pepenero", frame: "#e8e2d4", fascia: false, awning: "flat", awningHex: "#2a2a2c", windows: "arched", door: "right", sign: "lamp", plants: true },
    // Sheet 19.
    "pepenero-cucina-pizza-99914": { name: "PepeNero", frame: "#5a5c5e", wall: "#e8e2cc", buildingHex: "#e8e2cc", fascia: false, text: "", span: [1.1, 9.7], bays: "W W B:1.3 W W", grid: [2, 2], signs: [{ text: "PEPENERO", x: [4.6, 6], z: [3.3, 3.8], letters: "#f2efe8", board: "#1d1d1f" }], heightM: 4.2 },
    "peperoncino-84094": { name: "Peperoncino", frame: "#e8e6e0", fascia: false, awning: "flat", awningHex: "#b8282a", windows: "big", door: "left", terrace: true },
    "perla-di-roma-48686": { name: "Perla di Roma", frame: "#5a2a24", wall: "#e8e2cc", buildingHex: "#8a3a2a", fascia: "#ecebe6", fasciaH: 0.6, text: "PERLA DI ROMA", textAt: [5, 12.6], letters: "#a8231c", span: [0.9, 13.6], bays: "W W D:1.2 W W W", grid: [2, 1], awning: "dutch", awningHex: "#a8231c", awningOver: [2, 3], plants: true, heightM: 4 },
    "petit-caron-73912": { name: "Petit Caron", frame: "#e8e6e0", fascia: "#1f1f1f", awning: "flat", awningHex: "#b8282a", windows: "big", door: "right", terrace: true },
    "pho-viet-76172": { name: "Pho Viet", frame: "#8a3b12", fascia: false, windows: "big", transom: true, door: "right" },
    "pica-pica-90102": { name: "Pica Pica", frame: "#3a2a22", wall: "#3a2a22", fascia: "#1d1d1f", fasciaH: 0.4, text: "", span: [0.6, 14.4], bays: "W W W W D:1.0 W W W W", grid: [2, 2], glass: "#5a4a38", plants: true, terrace: true, heightM: 3.9 },
    "picchino-53915": { name: "Picchino", frame: "#1f1f1f", fascia: false, windows: "big", door: "right" },
    "pide-dunyas-78723": { name: "Pide Dunyas", frame: "#2a2c2e", fascia: "#e8e6e0", letters: "#c8282a", windows: "big", door: "left" },
    "piet-de-leeuw-80082": { name: "Piet de Leeuw", frame: "#1f1f1f", fascia: false, windows: "panes", door: "centre", sign: "lamp" },
    "pizza-project-64561": { name: "Pizza Project", frame: "#2a2c2e", wall: "#8a5a44", fascia: false, text: "", span: [0, 9.9], bays: "W:2.6 B:2.1 W", awning: "dutch", awningHex: "#c8282a", awningSegments: [{ x: [0, 2.6] }, { x: [4.5, 9.9] }], signs: [{ text: "PIZZA PROJECT", x: [7.4, 9.9], z: [3.9, 4.4], letters: "#f2efe8" }], plants: true, heightM: 4 },
    "pizza-project-bar-69760": { name: "De Nieuwe Vaart", frame: "#3a3d40", fascia: false, awning: "flat", awningHex: "#a89a6a", windows: "split", door: "centre", terrace: true },
    "pizza-taxi-da-paolo-seba-66100": { name: "Da Paolo", frame: "#e8e2d4", fascia: "#e8e2d4", windows: "big", transom: true, door: "left" },
    "pizzeria-steakhouse-ijburg-80574": { name: "Steakhouse IJburg", frame: "#2a2c2e", fascia: "#2a2c2e", windows: "big", door: "centre" },
    "plato-loco-19305": { name: "Plato Loco", frame: "#3a3d40", fascia: false, windows: "big", door: "none" },
    "proper-indofood-75795": { name: "Proper Indofood", frame: "#2a2a2c", fascia: false, windows: "panes", door: "centre", sign: "lamp" },
    "rainbowls-35465": { name: "Rainbowls", frame: "#2a2a2c", fascia: false, awning: "flat", awningHex: "#1f1f1f", windows: "big", door: "left", plants: true },
    // Sheet 20.
    "ramen-city-37023": null,
    "ramen-ism-78019": { name: "Ramen-ism", frame: "#e8e2d4", fascia: false, windows: "panes", transom: true, door: "right" },
    "rangla-punjab-61813": { name: "Rangla Punjab", frame: "#e8e6e0", fascia: "#3a2a5a", windows: "big", door: "right" },
    "rasoi-74500": { name: "Rasoi", frame: "#e8e2d4", fascia: false, awning: "flat", awningHex: "#d8d4ca", windows: "big", door: "right" },
    "reijnders-68746": { name: "Reijnders", frame: "#4a2014", wall: "#4a2014", fascia: "#2a1410", fasciaH: 0.6, text: "", span: [0, 6.1], bays: "W:1.7 P:0.4 B:0.2 D:0.9 B:0.3 P:0.4 W", grid: [1, 2], transom: true, signs: [{ text: "CAFE", x: [0.2, 1.5], z: [4.85, 5.25], letters: "#c8282a", board: "#ecebe6" }, { text: "TAPPERIJ", x: [2.1, 3.6], z: [4.85, 5.25], letters: "#c8282a", board: "#ecebe6" }, { text: "REYNDERS", x: [4.3, 5.9], z: [4.85, 5.25], letters: "#c8282a", board: "#ecebe6" }], lanterns: true, terrace: true, heightM: 5.4 },
    "renato-s-osteria-32916": { name: "Renato's", frame: "#2a4a8a", fascia: false, windows: "panes", door: "centre", plants: true },
    "restaurant-212-71575": null,
    "restaurant-asian-fantasy-14927": null,
    "restaurant-ja-36832": { name: "Ja", frame: "#e8e2d4", fascia: false, windows: "arched", door: "none", plants: true },
    "restaurant-klaproos-35403": { name: "Uku", frame: "#2f6f7a", fascia: false, windows: "big", door: "centre", heightM: 4.4 },
    "restaurant-lastage-82260": { name: "Lastage", frame: "#e8e6e0", wall: "#2c3036", fascia: "#e8e6e0", fasciaH: 0.25, text: "", span: [0.9, 4.1], bays: "W D:0.9", grid: [2, 1], transom: true, plants: true, heightM: 4.6 },
    "restaurant-sallora-51279": null,
    "restaurant-shiva-79404": { name: "Shiva", frame: "#1f1f1f", fascia: "#1f1f1f", windows: "panes", transom: true, door: "left" },
    "ricardo-s-63107": { name: "Rongsen", frame: "#e8e6e0", fascia: "#2a3a5a", windows: "split", door: "centre" },
    "rijnbar-80338": { name: "Rijnbar", frame: "#e8e6e0", wall: "#6a4a3a", plinth: "#4a3a32", fascia: "#e8e6e0", fasciaH: 0.2, text: "", span: [1, 12.4], bays: "d:0.8 B:1.4 W:3.0 B:0.9 D:0.8 B:0.7 W:2.8 B", grid: [1, 1], transom: true, sign: "round", signHex: "#2f7a3a", heightM: 3.6 },
    "rijsel-36544": null,
    // Sheet 21.
    "ristorante-papa-carlo-82585": { name: "Papa Carlo", frame: "#3a2a22", fascia: false, awning: "flat", awningHex: "#3a2a22", windows: "panes", door: "centre" },
    "ristorante-pizzeria-monte-verde-65953": { name: "Monte Verde", frame: "#4a2414", fascia: "#1f4d3a", windows: "panes", door: "centre", transom: true },
    "ron-gastrobar-32011": { name: "Ron Gastrobar", frame: "#e8e6e0", wall: "#e8e6e0", fascia: "#e8e6e0", fasciaH: 0.3, text: "", span: [0, 16.9], bays: "W W W W W W W", grid: [2, 1], awning: "canopy", awningHex: "#ecebe6", terrace: true, plants: true, heightM: 4.2 },
    "roopram-roti-55550": { name: "Roopram", frame: "#e8e6e0", fascia: false, windows: "panes", door: "centre" },
    "rossi-sandwiches-31005": { name: "Rossi", frame: "#e8e6e0", fascia: false, windows: "split", door: "left" },
    "roum-cafe-61185": { name: "Roum", frame: "#e8e2d4", fascia: false, awning: "flat", awningHex: "#1f1f1f", windows: "big", door: "right", terrace: true },
    "royal-fook-long-42162": { name: "Royal Fook Long", frame: "#3a3d40", fascia: "#9a1f22", windows: "split", door: "centre" },
    "royal98-53823": { name: "Royal98", frame: "#1f1f1f", fascia: false, windows: "big", door: "left" },
    "royalvis-traiteur-18311": { name: "Royal Med", frame: "#3a3d40", fascia: "#2a3a5a", windows: "big", door: "centre", rollers: "#2a3a6a" },
    "rue-la-bastille-77670": { name: "Rue la Bastille", frame: "#3a3a36", doorHex: "#1d1d1f", wall: "#3a3a36", fascia: "#3a3a36", fasciaH: 0.3, text: "", span: [0, 4.5], bays: "W:2.3 B:0.2 d:0.8 B", transom: true, glass: "#5a4a38", heightM: 4 },
    "rufus-restaurant-57012": { name: "Rufus", frame: "#1f1f1f", fascia: "#1f1f1f", windows: "big", door: "right", terrace: true },
    "sab-s-deli-36070": { name: "Sab's", frame: "#3a2a22", fascia: false, awning: "flat", awningHex: "#1f4d3a", windows: "split", door: "centre", terrace: true, plants: true },
    "sababa-58581": { name: "Sababa", frame: "#6a6c6a", pilaster: "#e8dfc8", doorHex: "#6a6c6a", wall: "#e8dfc8", plinth: "#e8dfc8", buildingHex: "#e8dfc8", fascia: false, text: "", shift: -1.1, span: [1.1, 9.1], bays: "P:0.4 W:0.8 C:0.9 W:0.8 P:0.6 d:1.3 P:0.6 O:2.2 P:0.4", signs: [{ text: "TABAKSHOP BELL", x: [1.5, 3.4], z: [3, 3.3], letters: "#f2f0ea", board: "#5a5a58" }, { text: "BELL & BEL", x: [3.4, 4.4], z: [2.9, 3.6], letters: "#f2f0ea", board: "#c8282a" }], heightM: 3.9 },
    "saeed-s-curry-house-54207": { name: "Saeed's", frame: "#5a1a14", fascia: false, awning: "striped", awningHex: "#c8282a", windows: "big", door: "right" },
    "sagardi-72053": { name: "Sagardi", frame: "#2a2c2e", wall: "#3a3634", fascia: "#3a3634", fasciaH: 0.4, text: "SAGARDI", letters: "#d8d4cc", span: [0, 4.9], bays: "W D:0.9 W", grid: [2, 2], heightM: 3.6 },
    "sahan-92837": { name: "Sahan", frame: "#2a2c2e", fascia: "#e8e6e0", letters: "#2a2c2e", awning: "canopy", awningHex: "#3a3d40", windows: "split", door: "centre", terrace: true, plants: true },
    // Sheet 22.
    "salento-latino-78584": { name: "Salento Latino", frame: "#3a3d40", fascia: false, awning: "flat", awningHex: "#b8282a", windows: "split", door: "centre" },
    "salvatorica-74729": { name: "Salvatorica", frame: "#2a2c2e", fascia: false, windows: "split", door: "centre" },
    "sama-sebo-65990": { name: "Sama Sebo", frame: "#e8e2d4", fascia: "#3a2a22", windows: "panes", door: "right" },
    "samba-kitchen-59252": { name: "Samba Kitchen", frame: "#e8e6e0", fascia: "#e8e6e0", windows: "big", door: "left", terrace: true },
    "sapporo-ramen-sora-35936": { name: "Sora", frame: "#ecebe6", wall: "#ecebe6", fascia: false, text: "", span: [2, 3.9], bays: "W", windows: "arched", grid: [2, 2], heightM: 3.4 },
    "scheltema-67522": { name: "Scheltema", frame: "#2a2c2e", wall: "#2a2c2e", fascia: "#2a2c2e", fasciaH: 0.4, text: "CAFE SCHELTEMA RESTAURANT", letters: "#c87a5a", span: [0, 6.4], bays: "W", rollers: "#e8e6e0", awning: "canopy", awningHex: "#8a8c8e", heightM: 4.4 },
    "schiller-78854": { name: "NH Schiller", frame: "#3a3d40", wall: "#e3dcc8", fascia: "#2a3550", text: "", span: [0, 32.5], bays: "W W W W B:0.6 D:4.6 B:0.8 W W W W W", grid: [2, 1], awning: "flat", awningHex: "#3a4560", signs: [{ text: "NH SCHILLER", x: [13.3, 20.8], z: [4.75, 5.5], letters: "#6a6a6a", board: "#e3dcc8" }], terrace: true, heightM: 5.4 },
    "seafood-bistro-78815": { name: "Seafood Bistro", frame: "#e8e6e0", fascia: false, windows: "big", door: "left", sign: "square", signHex: "#e3c020" },
    "seasons-restaurant-75049": { name: "Seasons", frame: "#e8e2d4", fascia: false, windows: "big", door: "right", transom: true },
    "semai-52074": { name: "Semai", frame: "#e8e6e0", fascia: "#3a3d40", windows: "split", door: "centre" },
    "semhar-74838": { name: "Semhar", frame: "#7a1f1a", fascia: "#7a1f1a", letters: "#e3c020", windows: "split", door: "right" },
    "senayan-73612": { name: "Senayan", frame: "#e8e2d4", fascia: "#2a2c2e", windows: "split", door: "centre" },
    "seth-takeout-76929": { name: "Seth", frame: "#e8e6e0", fascia: false, windows: "big", door: "right" },
    "sham-87688": { name: "Sham", frame: "#1f1f1f", fascia: "#1f1f1f", letters: "#c9a227", windows: "arched", door: "centre", terrace: true },
    "sham-maza-80856": { name: "Sham Maza", frame: "#2a2a28", fascia: "#2a2a28", windows: "big", door: "centre" },
    "sherpa-39376": { name: "Sherpa", frame: "#2a2c2e", fascia: "#2a2c2e", windows: "big", door: "right", terrace: true },
    // Sheet 23.
    "shiki-79220": null,
    "sichuan-food-68478": { name: "Sichuan Food", frame: "#2a2420", wall: "#2a2420", fascia: false, text: "", span: [0, 5.1], bays: "W:1.0 D W W", grid: [1, 2], awning: "flat", awningHex: "#b8a860", awningText: { text: "SICHUAN FOOD", letters: "#6a5a2a" }, terrace: true, heightM: 3.4 },
    "silk-road-kebab-house-80959": { name: "Silk Road", frame: "#2a2c2e", fascia: "#2a2c2e", windows: "big", door: "centre" },
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
