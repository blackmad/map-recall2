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
    const box = ({ x0, x1, z0, z1, out0 = 0, out1, hex: hex2 }) => {
      quad([x0, z0, out1], [x1, z0, out1], [x1, z1, out1], [x0, z1, out1], hex2, [0, 0, 1]);
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
    hoppe: CAFE_HOPPE
  };
  var FRONT_LIST = Object.values(FRONTS);
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
  var name = q.get("name") ?? "waag";
  var setup = SETUPS[name];
  var front = FRONTS[name];
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
    const meta = await (await fetch(`/data/landmark-facades/${name}.json`)).json();
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
      const inFront = (pts) => pts.some(([x, y]) => {
        const out = (x - mx) * ox + (y - my) * oy, along2 = (x - mx) * ux + (y - my) * uy;
        return out > 1 && out < 70 && Math.abs(along2) < half;
      });
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
        for (const p of unused) scene.add(prism(p.ring, p.minHeightM, p.heightM, front?.hex ?? "#9a5240"));
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
          const tris = frontTriangles(front, (along2, up, out) => [fax + ux * along2 + ox * out, fay + uy * along2 + oy * out, up]);
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
    const cam = new THREE.PerspectiveCamera(32, W / 3 / H, 1, 2e3), a = bearing + az, focusY = buildingH * 0.42;
    cam.position.set(mid[0] + Math.sin(a) * Math.cos(el) * dist, focusY + Math.sin(el) * dist, -(mid[1] + Math.cos(a) * Math.cos(el) * dist));
    cam.lookAt(mid[0], focusY, -mid[1]);
    ["plain", "kit"].forEach((variant, i) => {
      renderer.setViewport(i * W / 3, 0, W / 3, H);
      renderer.setScissor(i * W / 3, 0, W / 3, H);
      renderer.render(sceneFor(variant), cam);
    });
    const ref = document.createElement("img");
    Object.assign(ref.style, { position: "fixed", left: `${2 * W / 3}px`, top: "0", width: `${W / 3}px`, height: `${H}px`, objectFit: "contain", background: "#e9e4d4" });
    ref.src = `/data/landmark-facades/${meta.image}`;
    document.body.appendChild(ref);
    await ref.decode().catch(() => {
    });
    window.__info = { parts: parts.size };
    document.title = "ready";
  })();
})();
