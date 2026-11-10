"use strict";
(() => {
  // src/canalRecall/blockBuilding/cladding.ts
  var CLADDING = {
    ribs: { pitch: 0.5, min: 0.25, max: 2, w: 0.09, out: 0.04 },
    boards: { pitch: 0.4, min: 0.15, max: 1.5, w: 0.05, out: 0.035 },
    louvres: { pitch: 0.35, min: 0.2, max: 1, w: 0.12, out: 0.12 },
    panels: { pitch: 1.2, min: 0.6, max: 6, w: 0.05, out: 0.035 }
  };

  // src/canalRecall/buildingRecipe/wallFamily.ts
  var RIB_PITCH = { min: 0.15, max: CLADDING.ribs.max };

  // src/canalRecall/facade/materials.ts
  function wallFamily(rgb) {
    const [r, g, b] = rgb;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const chroma = max - min;
    const light = (r + g + b) / 3;
    if (light < 52) return "paint";
    if (chroma < 16 && light > 155) return "paint";
    if (chroma < 24 && light > 180) return "stone";
    if (r > b + 6) return "brick";
    return chroma < 14 ? "paint" : "brick";
  }

  // src/canalRecall/look/brickTone.ts
  var lin = (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  var unlin = (c) => 255 * (c <= 31308e-7 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
  function rgbToLab(c) {
    const [r, g, b] = c.map(lin);
    const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    const f2 = (t) => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
    return [116 * f2(y) - 16, 500 * (f2(x) - f2(y)), 200 * (f2(y) - f2(z))];
  }
  function labToRgb([L, a, b]) {
    const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
    const inv = (t) => t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27);
    const x = inv(fx) * 0.95047, y = inv(fy), z = inv(fz) * 1.08883;
    const r = 3.2406 * x - 1.5372 * y - 0.4986 * z, g = -0.9689 * x + 1.8758 * y + 0.0415 * z, bb = 0.0557 * x - 0.204 * y + 1.057 * z;
    return [r, g, bb].map((v) => Math.round(Math.max(0, Math.min(255, unlin(Math.max(0, v))))));
  }

  // src/canalRecall/look/palette.ts
  var PHOTO_WALL_CELL_MEAN = 225;
  var PHOTO_CALM = { wallPull: 0.7, glassLift: 0.5, liftBrick: true };
  var DRAWN_CALM = { wallPull: 0.35, glassLift: 0.25, liftBrick: false };
  var LOOK_VARIANTS = {
    photo: { cells: "photo", shadeBands: 0, flatColour: false, ...PHOTO_CALM, cartoonRoofCells: false, outline: false, litWallGain: 255 / PHOTO_WALL_CELL_MEAN },
    procedural: { cells: "procedural", shadeBands: 0, flatColour: false, ...PHOTO_CALM, cartoonRoofCells: false, outline: false, litWallGain: 1 },
    untextured: { cells: "procedural", shadeBands: 0, flatColour: true, ...PHOTO_CALM, cartoonRoofCells: false, outline: false, litWallGain: 1 },
    // Storybook warms and lifts the natural palette a little, as an illustrator would.
    storybook: {
      cells: "storybook",
      shadeBands: 0,
      flatColour: false,
      ...DRAWN_CALM,
      cartoonRoofCells: false,
      outline: true,
      litWallGain: 1,
      tone: { hueShift: -4, satMul: 1.15, satAdd: 0, keepDarkBelow: 0, lightMul: 1, lightAdd: 0.03, lightMax: 0.9 }
    },
    // Cartoon: punchy but not neon; darks (glass, iron) stay dark so windows still read.
    cartoon: {
      cells: "cartoon",
      shadeBands: 3,
      flatColour: false,
      ...DRAWN_CALM,
      cartoonRoofCells: true,
      outline: true,
      litWallGain: 1,
      tone: { hueShift: 0, satMul: 1.7, satAdd: 0.08, keepDarkBelow: 0.35, lightMul: 1.08, lightAdd: 0, lightMax: 0.85 }
    }
  };
  var clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function hexToRgb(hex2) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex2.trim());
    if (!m) throw Error(`Bad colour ${hex2}`);
    const v = parseInt(m[1], 16);
    return [v >> 16 & 255, v >> 8 & 255, v & 255];
  }
  var rgbToHex = (c) => "#" + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("");
  function rgbToHsl([r, g, b]) {
    const R = r / 255, G = g / 255, B = b / 255, max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
    return [h * 60, s, l];
  }
  function hslToRgb([h, s, l]) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(h / 60 % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }
  var PERIOD_FROM = { canal: -Infinity, c19: 1860, school: 1915, modern: 1945 };
  function periodForYear(year) {
    return year < PERIOD_FROM.c19 ? "canal" : year < PERIOD_FROM.school ? "c19" : year < PERIOD_FROM.modern ? "school" : "modern";
  }
  var MEASURED_SLATE = ["#76808f", "#606b79", "#8c939c"];
  var ROOF_TONES = {
    procedural: { tile: ["#b5543a", "#a8482f", "#c0603f", "#9c4a35"], slate: MEASURED_SLATE },
    untextured: { tile: ["#b5543a", "#a8482f", "#c0603f", "#9c4a35"], slate: MEASURED_SLATE },
    photo: { tile: ["#b5543a", "#a8482f", "#c0603f", "#9c4a35"], slate: MEASURED_SLATE },
    storybook: { tile: ["#b9553a", "#a94a33", "#c46a45"], slate: ["#556070", "#4a5666", "#657282"] },
    cartoon: { tile: ["#e85a3c", "#f08a2b", "#d94a3a"], slate: ["#3f5f8f", "#2f4a78", "#4f7bb0"] }
  };
  var ROOF_SLOT_TONES = {
    "gravel": { hex: "#9e9281", luma: [112, 156], cell: "flat" },
    "bitumen-dark": { hex: "#56585e", luma: [62, 96], cell: "flat" },
    "bitumen-light": { hex: "#a99b84", luma: [150, 182], cell: "flat" },
    "white-membrane": { hex: "#d9d9d3", luma: [196, 228], cell: "flat" },
    "pantile-red": { hex: "#b5543a", luma: [84, 124], cell: "tile" },
    "pantile-dark": { hex: "#6a5248", luma: [64, 98], cell: "tile" },
    "slate": { hex: "#76808f", luma: [62, 140], cell: "slate" },
    "zinc": { hex: "#9aa1a6", luma: [138, 176], cell: "slate" },
    "sedum": { hex: "#7a8350", luma: [96, 132], cell: "flat" },
    "solar": { hex: "#2e3a52", luma: [44, 70], cell: "flat" },
    "terrace": { hex: "#a38d74", luma: [124, 162], cell: "flat" },
    "glass": { hex: "#8fa3ad", luma: [130, 170], cell: "flat" }
  };
  var FLAT_ROOF_TONES = { gravel: ROOF_SLOT_TONES.gravel.hex, membrane: ROOF_SLOT_TONES["white-membrane"].hex, bitumen: ROOF_SLOT_TONES["bitumen-dark"].hex, pebble: ROOF_SLOT_TONES["bitumen-light"].hex };
  var FLAT_ROOF_GREYS = [FLAT_ROOF_TONES.gravel, FLAT_ROOF_TONES.membrane, FLAT_ROOF_TONES.bitumen, FLAT_ROOF_TONES.pebble];
  var CITY_ROOF = { tile: ROOF_TONES.photo.tile, slate: ROOF_TONES.photo.slate, flat: FLAT_ROOF_GREYS };
  var PERIOD_WALLS = {
    photo: {
      canal: ["#7a3b2c", "#7a3b2c", "#6b3428", "#8c4632", "#9a5846", "#b05a40", "#4a2e26", "#2e2a27", "#3e4a40", "#5d605a", "#e4ddcd"],
      c19: ["#b05a40", "#b05a40", "#bd6a45", "#a24d38", "#c58b5e", "#d3b184", "#e2d5ba", "#e2d5ba", "#d9c5a4", "#9a5846"],
      school: ["#8c4a38", "#7a4535", "#9a5240", "#6e3d33", "#a85a3c", "#5e3a32", "#b0603f"],
      modern: ["#c9b79a", "#b9ad9a", "#a8a49c", "#d3c6ad", "#8f8a82", "#bfb3a0", "#9c7a62", "#b05a40"]
    },
    storybook: {
      canal: ["#b9583f", "#9a4a38", "#7a4a3c", "#4a5048", "#3f4a5a", "#ead9b0", "#c8664a"],
      c19: ["#c8664a", "#d98b5f", "#e0b36a", "#ead9b0", "#d9b995", "#c9a08c", "#c8664a"],
      school: ["#a8553f", "#9a5a48", "#b87a5c", "#c8664a", "#8a4e40"],
      modern: null
    },
    cartoon: {
      canal: ["#d9453d", "#a8433a", "#3b3b4a", "#2a9d8f", "#4672b0", "#fffaf0", "#e8573d"],
      c19: ["#e8573d", "#ee7f2c", "#f2b92e", "#f3e6c8", "#d96a4d", "#f2b92e"],
      school: ["#d96a4d", "#e8573d", "#b9583f", "#ee7f2c"],
      modern: null
    }
  };
  var PERIOD_PRIORS = {
    canal: { label: "canal-house centre (before 1860)", wall: PERIOD_WALLS.photo.canal[0], roof: ROOF_TONES.photo.tile[0] },
    c19: { label: "19th-century ring (1860-1914)", wall: PERIOD_WALLS.photo.c19[0], roof: ROOF_TONES.photo.tile[1] },
    school: { label: "Amsterdamse School (1915-1944)", wall: PERIOD_WALLS.photo.school[0], roof: ROOF_TONES.photo.slate[0] },
    modern: { label: "post-war and contemporary (1945+)", wall: PERIOD_WALLS.photo.modern[0], roof: FLAT_ROOF_GREYS[0] }
  };
  var CITY_BRICK_LIGHTNESS = [0.3, 0.6];
  var CITY_STONE = "#cfc8b8";
  function cityWallTint(hex2) {
    const [h, s, l] = rgbToHsl(hexToRgb(hex2));
    const lifted = clamp(0.12 + l * 0.9, CITY_BRICK_LIGHTNESS[0], CITY_BRICK_LIGHTNESS[1]);
    return rgbToHex(hslToRgb([h, clamp(s, 0.12, 0.5), lifted]));
  }
  function cityStuccoTint(hex2) {
    const [h, s, l] = rgbToHsl(hexToRgb(hex2));
    return rgbToHex(hslToRgb([h, clamp(s, 0, 0.55), clamp(l * 1.06 + 0.03, 0.4, 0.97)]));
  }
  var BRICK_CELL_MEAN = PHOTO_WALL_CELL_MEAN / 255;
  var GLASS_TINT_CELL_W = 32;
  var GLASS_TINT_CELL_H = 64;
  var PANE_LUMA = [157.19, 92.83, 69.17];
  var STREAK_LUMA = 240.95;
  var STREAK_ALPHA = 0.16;
  var PANE_SCALE = 255 / (PANE_LUMA[0] + (STREAK_LUMA - PANE_LUMA[0]) * STREAK_ALPHA);
  function glassTintCellValue(x, y) {
    const t = y / (GLASS_TINT_CELL_H - 1);
    const base = t < 0.5 ? PANE_LUMA[0] + (PANE_LUMA[1] - PANE_LUMA[0]) * (t / 0.5) : PANE_LUMA[1] + (PANE_LUMA[2] - PANE_LUMA[1]) * ((t - 0.5) / 0.5);
    const left = 5 - 15 * y / 35, right = 17 - 15 * y / 35, streak = y < 35 && x + 0.5 >= left && x + 0.5 < right;
    return Math.min(255, Math.round((streak ? base + (STREAK_LUMA - base) * STREAK_ALPHA : base) * PANE_SCALE));
  }
  var GLASS_TINT_CELL_MEAN = (() => {
    let sum = 0;
    for (let y = 0; y < GLASS_TINT_CELL_H; y++) for (let x = 0; x < GLASS_TINT_CELL_W; x++) sum += glassTintCellValue(x, y);
    return sum / (GLASS_TINT_CELL_W * GLASS_TINT_CELL_H);
  })();
  var STONE_CELL_MEAN = 228 / 255;
  var STREET_GROUND = {
    // Was [72, 74, 78]: under the rig it drew at luma 67 in sun and 59 in shade, "near-black" (user live play
    // 2026-10-14). Lifted to a sunlit-grey 88 (just under the klinker carriageway's 91, still cooler than it); with
    // ownGround/groundLight.ts it draws 88 in sun and 78 in cast shadow, above LOOK's road floor of 65–75.
    asphalt: { base: [86, 88, 93] },
    cycle: { base: [150, 66, 58] },
    // Was [128, 82, 66]: as saturated as the cycle red, so a brick quay read as one wide cycle path from the boat
    // (user 2026-10-14, Houtmankade). Brick-brown, less saturated; herringbone in mixed tones (ownGround/streetTextures.ts).
    klinker: { base: [122, 90, 80], joint: "#4b3d38" },
    pavement: { base: [174, 162, 152], joint: "#7f756b" },
    kerb: "#cfcac0",
    paint: "#f2f0ea",
    rail: "#6c6e72",
    bollard: "#5a2a26"
  };
  var GROUND_TONES = {
    land: { base: [168, 158, 142], joint: "#857b6d" },
    paving: { base: [184, 174, 158], joint: "#8f8577" },
    square: { base: [190, 179, 161], joint: "#958a7c" },
    // Klinker warm grey-rose, asphalt darker and cooler than it ("so much grey": they shared one band).
    klinker: { base: [158, 124, 114], joint: "#7a6660" },
    asphalt: [68, 72, 80],
    cycle: [156, 76, 66],
    gravel: [180, 166, 136],
    park: [96, 140, 70],
    wood: [70, 112, 58],
    parking: [102, 102, 105],
    kerb: "#aaa498",
    water: "#46707c",
    // Parks (parks-v1, ownGround/parks.ts, 2026-10-13): mown lawn fresher than the park fill under it, planting beds
    // as soil with green dabs, shrub planting darker and clumped, bark mulch, play sand, shell/half-paved paths lighter
    // than street gravel, park asphalt lighter than the road's, ponds the canal tone (a greener one read as a shadow).
    lawn: [110, 154, 74],
    bed: { soil: [98, 80, 60], leaf: [84, 122, 58] },
    shrub: { base: [56, 92, 46], leaf: [76, 116, 56] },
    bark: [118, 84, 58],
    sand: [212, 194, 150],
    parkGravel: [198, 184, 152],
    parkPath: [110, 110, 112],
    pond: "#46707c"
  };

  // src/canalRecall/look/measuredPeriodWalls.ts
  var MEASURED_PERIOD_WALL_LISTS = { "canal": ["#6e5352", "#8c7768", "#977f73", "#a79276", "#b8a17a", "#575245", "#60564b", "#62544d", "#61584c", "#655850", "#655b50", "#6a5454", "#6f6058", "#726359", "#726459", "#76615d", "#77685d", "#7a6c60", "#826c66", "#918174", "#9a887f", "#a89f8a", "#6b6163", "#dfdcd2"], "c19": ["#70564f", "#6f5b52", "#7a665c", "#86695b", "#886a5f", "#857266", "#8b746d", "#9b887e", "#a38e83", "#ad9585", "#61534a", "#63564e", "#685b52", "#6f6057", "#716259", "#75665c", "#7b6961", "#7c6962", "#7f6a64", "#7f7664", "#8e796f", "#9c9181", "#95787e", "#dad8cf"], "school": ["#665247", "#775744", "#735d52", "#786158", "#8c5957", "#896559", "#856f63", "#9d7f6d", "#ad997f", "#5c4f48", "#61564c", "#67564e", "#6b5554", "#6b5851", "#6b5b50", "#716057", "#745e5b", "#75655c", "#78665f", "#806d64", "#89706b", "#a19888", "#614a4e", "#a4a09f"], "modern": ["#715d53", "#7c6459", "#816b64", "#8f7265", "#9c8980", "#ac9a86", "#60594c", "#635c4e", "#6a5a50", "#6c5a54", "#6c5e55", "#6e6256", "#72675a", "#776a5d", "#7b6a61", "#7f6f64", "#807265", "#886f6b", "#8b7d6d", "#958b79", "#a29189", "#695256", "#a59b8d", "#c8c5ba"] };

  // src/canalRecall/look/measuredWhitePoints.ts
  var WALL_WHITE_POINTS = {
    "#4f4834": [215, 215, 215],
    "#463823": [216, 215, 215],
    "#5f5950": [215, 215, 215],
    "#a69873": [215, 215, 215],
    "#57423e": [215, 215, 215],
    "#473c3b": [215, 215, 215],
    "#5d5d5c": [214, 215, 215],
    "#7e573b": [215, 215, 215],
    "#705449": [215, 215, 215],
    "#7f8283": [215, 214, 215],
    "#796764": [215, 215, 215],
    "#5d534b": [215, 215, 215],
    "#7d6e52": [215, 215, 215],
    "#88735e": [215, 215, 215],
    "#88715f": [215, 215, 215],
    "#736352": [215, 215, 215],
    "#241d1c": [172, 172, 172],
    "#4b3f37": [215, 215, 215],
    "#615551": [215, 215, 215],
    "#595651": [214, 215, 214],
    "#423931": [215, 215, 215],
    "#7b6d6a": [215, 214, 216],
    "#382418": [215, 215, 215],
    "#866343": [215, 215, 215],
    "#6e6256": [215, 215, 215],
    "#625650": [205, 205, 205],
    "#252c24": [185, 185, 186],
    "#2d281b": [215, 214, 215],
    "#3b342b": [215, 215, 215],
    "#6f5c56": [215, 215, 215],
    "#393535": [215, 215, 215],
    "#786357": [215, 215, 215],
    "#383d43": [205, 215, 215],
    "#554e4a": [215, 216, 215],
    "#3d3432": [215, 215, 215],
    "#3d353c": [215, 215, 215],
    "#4e443f": [215, 215, 215],
    "#70574d": [207, 207, 207],
    "#d49662": [215, 215, 215],
    "#917b5c": [215, 215, 215],
    "#494341": [215, 215, 215],
    "#645f5f": [215, 215, 214],
    "#342a18": [215, 215, 215],
    "#825746": [215, 216, 215],
    "#99604e": [212, 215, 215],
    "#706868": [215, 215, 215],
    "#786b61": [215, 215, 214],
    "#5c5b57": [215, 215, 215],
    "#7a655b": [215, 215, 215],
    "#6f5b54": [215, 215, 215],
    "#4a3f3a": [215, 214, 215],
    "#614f44": [216, 215, 215],
    "#654e44": [215, 215, 215],
    "#6f5f53": [215, 215, 216],
    "#584d49": [215, 215, 215],
    "#d3c9b2": [215, 215, 215],
    "#544b46": [215, 215, 215],
    "#929289": [215, 215, 215],
    "#68584f": [215, 215, 216],
    "#574d47": [215, 215, 215],
    "#5e4e41": [215, 215, 215],
    "#6e605a": [215, 215, 215],
    "#605d5c": [215, 215, 215],
    "#8c7a6f": [215, 215, 215],
    "#4a3832": [165, 165, 166],
    "#81614f": [215, 215, 215],
    "#3d3533": [215, 215, 215],
    "#6d5351": [215, 215, 215],
    "#5c3d33": [214, 214, 215],
    "#906553": [215, 215, 215],
    "#65493d": [215, 215, 215],
    "#8e5f49": [215, 215, 215],
    "#8c6858": [215, 215, 215],
    "#8b5946": [215, 215, 215],
    "#665253": [209, 209, 209],
    "#3e3222": [215, 215, 215],
    "#000000": [197, 198, 197],
    "#7b081b": [215, 215, 215],
    "#383131": [215, 215, 215],
    "#3d3b37": [211, 215, 215],
    "#877d76": [214, 215, 215],
    "#191d0c": [215, 214, 213],
    "#bcab88": [215, 215, 215],
    "#656462": [215, 215, 215],
    "#3f3634": [174, 174, 175],
    "#463e3c": [197, 197, 198],
    "#453d3a": [177, 177, 176],
    "#1f1a1b": [156, 156, 157],
    "#615450": [214, 215, 215],
    "#5b4f4b": [215, 215, 215],
    "#574c4a": [215, 215, 215],
    "#413333": [215, 215, 215],
    "#7b5c53": [215, 215, 215],
    "#5f342b": [216, 215, 215],
    "#4e2422": [215, 215, 215],
    "#5b4b44": [209, 209, 209],
    "#493d32": [215, 215, 215],
    "#6a5048": [216, 216, 215],
    "#5e5855": [215, 215, 215],
    "#5e3f35": [215, 215, 215],
    "#68564f": [215, 215, 215],
    "#6b3e33": [215, 214, 215],
    "#5f3c30": [215, 214, 215],
    "#929191": [215, 215, 215],
    "#a2acb3": [215, 215, 215],
    "#8f7b65": [215, 215, 215],
    "#988e7d": [215, 215, 215],
    "#726d60": [215, 215, 215],
    "#584c45": [215, 214, 215],
    "#594643": [216, 215, 215],
    "#5e5750": [212, 215, 215],
    "#78645b": [215, 215, 215],
    "#484440": [215, 215, 215],
    "#73645e": [215, 215, 215],
    "#5c4f47": [215, 215, 215],
    "#3c3d39": [215, 215, 215],
    "#645451": [215, 215, 214],
    "#37333d": [179, 179, 178],
    "#a6856f": [215, 215, 215],
    "#574d4d": [205, 205, 205],
    "#393737": [215, 215, 215],
    "#6f4a3b": [215, 214, 215],
    "#ffa169": [212, 215, 215],
    "#576465": [216, 215, 216],
    "#71614a": [215, 215, 215],
    "#6c584f": [215, 215, 215],
    "#5b463e": [215, 216, 215],
    "#765e52": [214, 215, 215],
    "#4f4e4c": [215, 215, 215],
    "#544945": [215, 215, 215],
    "#504140": [194, 195, 194],
    "#51514f": [215, 215, 215],
    "#74665f": [215, 215, 215],
    "#735c59": [215, 215, 215],
    "#474d56": [215, 215, 215],
    "#7d6e5a": [215, 215, 215],
    "#514a43": [215, 215, 215],
    "#4e4e49": [215, 215, 215],
    "#745c51": [215, 215, 215],
    "#47403c": [215, 215, 215],
    "#4c3a37": [215, 215, 215],
    "#675d5a": [215, 215, 215],
    "#574e48": [215, 215, 215],
    "#686360": [215, 215, 215],
    "#4a413f": [215, 215, 215],
    "#423735": [215, 215, 215],
    "#756860": [215, 215, 215],
    "#5e5144": [215, 215, 215]
  };

  // src/canalRecall/ownGround/groundLook.ts
  var DEFAULT_PALETTE = { street: { ...STREET_GROUND, brick: STREET_GROUND.klinker }, tones: GROUND_TONES };

  // src/canalRecall/look/sunny.ts
  var srgbToLinear = (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  var linearToSrgb = (c) => 255 * (c <= 31308e-7 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
  var hexRgb = (hex2) => {
    const n = parseInt(hex2.replace("#", ""), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  };
  var rgbHex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
  var Y = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  var linY = (hex2) => Y(hexRgb(hex2).map(srgbToLinear));
  var SKY = { zenith: "#9ec3ed", horizon: "#a1c6e5" };
  function rigIrradiance(rig) {
    const el2 = rig.sunElevationDeg * Math.PI / 180, sun = linY(rig.sunColour) * rig.sunIntensity / Math.PI;
    const sky = linY(rig.skyColour) * rig.skyIntensity / Math.PI, ground = linY(rig.groundColour) * rig.skyIntensity / Math.PI;
    const hemiWall = (sky + ground) / 2;
    return { flat: sun * Math.sin(el2) + sky, sunWall: sun * Math.cos(el2) + hemiWall, shadeWall: hemiWall };
  }
  var SUNNY_SHADE_RATIO = 0.55;
  function sunnyBase(sunColour = "#ffe2bf", groundColour = "#aca497", ratio = SUNNY_SHADE_RATIO) {
    const el2 = 40 * Math.PI / 180;
    const build = (t) => {
      const skyColour = rgbHex(hexRgb(SKY.horizon).map((v) => v + (255 - v) * t));
      const sun = linY(sunColour) * 2.15 / Math.PI * Math.cos(el2), hemiPerUnit = (linY(skyColour) + linY(groundColour)) / 2 / Math.PI;
      const skyIntensity = ratio * sun / (1 - ratio) / hemiPerUnit;
      return { sunColour, sunIntensity: 2.15, skyColour, groundColour, skyIntensity, sunElevationDeg: 40 };
    };
    const flatRB = (t) => {
      const r = build(t), s = hexRgb(r.sunColour).map(srgbToLinear), k = hexRgb(r.skyColour).map(srgbToLinear);
      const c = [0, 2].map((i) => s[i] * r.sunIntensity * Math.sin(el2) + k[i] * r.skyIntensity);
      return c[0] / c[1];
    };
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      if (flatRB(m) < 1) lo = m;
      else hi = m;
    }
    return { ...build(hi), whiteMix: +hi.toFixed(3) };
  }
  var SUNNY_BASE = sunnyBase();
  var SUNNY_EXPOSURE = 1 / rigIrradiance(SUNNY_BASE).sunWall;
  var SUNNY_LIGHT = {
    sunColour: SUNNY_BASE.sunColour,
    sunIntensity: +(SUNNY_BASE.sunIntensity * SUNNY_EXPOSURE).toFixed(4),
    skyColour: SUNNY_BASE.skyColour,
    groundColour: SUNNY_BASE.groundColour,
    skyIntensity: +(SUNNY_BASE.skyIntensity * SUNNY_EXPOSURE).toFixed(4)
  };
  function scaleLinear(hex2, k) {
    const lin2 = hexRgb(hex2).map((v) => srgbToLinear(v) * k), over = Math.max(1, ...lin2);
    return rgbHex(lin2.map((c) => linearToSrgb(c / over)));
  }
  var MEDIAN_MEASURED_WALL = (() => {
    const walls2 = Object.keys(WALL_WHITE_POINTS).map(hexRgb), med = (a) => a.slice().sort((p, q2) => p - q2)[a.length >> 1];
    return rgbHex([0, 1, 2].map((i) => med(walls2.map((w) => w[i]))));
  })();

  // src/canalRecall/look/measuredWalls.ts
  var PERIOD_WALL_GAIN = 2;
  var PALE_L = 0.62;
  function sunlitPeriodWall(hex2, gain = PERIOD_WALL_GAIN) {
    const lit = scaleLinear(hex2, gain);
    if (rgbToHsl(hexToRgb(hex2))[2] >= PALE_L) return lit;
    const [h, s, l] = rgbToHsl(hexToRgb(lit));
    return l <= CITY_BRICK_LIGHTNESS[1] ? lit : rgbToHex(hslToRgb([h, s, CITY_BRICK_LIGHTNESS[1]]));
  }
  var sunlitLists = (lists) => Object.fromEntries(Object.entries(lists).map(([p, l]) => [p, l ? l.map((hex2) => sunlitPeriodWall(hex2)) : null]));
  var SUNLIT_PERIOD_WALL_LISTS = sunlitLists(MEASURED_PERIOD_WALL_LISTS);

  // src/canalRecall/buildingFacts.ts
  var NOTHING_KNOWN = {
    anonymous: "This building has no name or date in the map data.",
    named: "The map data has no date for this building.",
    place: "A mapped place; the map data has no date for its building."
  };
  var NOTHING_KNOWN_SET = new Set(Object.values(NOTHING_KNOWN));

  // src/canalRecall/genericFacades.ts
  var FACADE_STYLES = ["canal", "c19", "school", "postwar", "modern", "tower"];
  var FACADE_PIXELS_PER_M = 8;
  var FACADE_MAX_TILE_ZOOM = 16 + Math.log2(FACADE_PIXELS_PER_M);

  // src/canalRecall/roofSink.ts
  var sub2 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  var cross2 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  var dot2 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
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
      let n = cross2(sub2(b, a), sub2(c, a));
      const l = Math.hypot(n[0], n[1], n[2]);
      if (l < 1e-7) return;
      let B = b, C = c, UB = ub, UC = uc;
      if (dot2(n, hint) < 0) {
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
      let n = cross2(sub2(b, a), sub2(c, a));
      if (dot2(n, hint) < 0) n = [-n[0], -n[1], -n[2]];
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
      const P2 = (u, v, z) => [u, v, z];
      const f2 = (name, a, b, c, d, hint) => {
        if (!open.includes(name)) this.quad(a, b, c, d, [0, 0], [1, 0], [1, 1], [0, 1], part, hint, hex2);
      };
      f2("bottom", P2(u0, v0, z0), P2(u1, v0, z0), P2(u1, v1, z0), P2(u0, v1, z0), [0, 0, -1]);
      f2("top", P2(u0, v0, z1), P2(u1, v0, z1), P2(u1, v1, z1), P2(u0, v1, z1), [0, 0, 1]);
      f2("u0", P2(u0, v0, z0), P2(u0, v1, z0), P2(u0, v1, z1), P2(u0, v0, z1), [-1, 0, 0]);
      f2("u1", P2(u1, v0, z0), P2(u1, v1, z0), P2(u1, v1, z1), P2(u1, v0, z1), [1, 0, 0]);
      f2("v0", P2(u0, v0, z0), P2(u1, v0, z0), P2(u1, v0, z1), P2(u0, v0, z1), [0, -1, 0]);
      f2("v1", P2(u0, v1, z0), P2(u1, v1, z0), P2(u1, v1, z1), P2(u0, v1, z1), [0, 1, 0]);
    }
  };

  // src/canalRecall/roofFootprint.ts
  function openRing(points) {
    const pts = [];
    for (const p of points) if (!pts.length || Math.hypot(p[0] - pts[pts.length - 1][0], p[1] - pts[pts.length - 1][1]) > 0.05) pts.push([p[0], p[1]]);
    while (pts.length > 1 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) <= 0.05) pts.pop();
    return pts;
  }
  function signedArea(pts) {
    let a = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    return a / 2;
  }
  function insetRing(ring, t) {
    const pts = openRing(ring);
    if (pts.length < 3) return null;
    const ccw = signedArea(pts) > 0, n = pts.length, out = [];
    const normalIn = (a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
      return ccw ? [-dy / l, dx / l] : [dy / l, -dx / l];
    };
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n], cur = pts[i], next = pts[(i + 1) % n];
      const n0 = normalIn(prev, cur), n1 = normalIn(cur, next);
      const mx = n0[0] + n1[0], my = n0[1] + n1[1], ml = Math.hypot(mx, my);
      if (ml < 1e-6) return null;
      const cosHalf = (mx * n0[0] + my * n0[1]) / ml;
      if (cosHalf < 0.25) return null;
      const k = t / cosHalf;
      out.push([cur[0] + mx / ml * k, cur[1] + my / ml * k]);
    }
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n], a2 = out[i], b2 = out[(i + 1) % n];
      if ((b[0] - a[0]) * (b2[0] - a2[0]) + (b[1] - a[1]) * (b2[1] - a2[1]) <= 0) return null;
    }
    return out;
  }

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
  function rectDecal(s, f2, e, v0, v1, z0, z1, hex2, proud = PROUD) {
    const u = f2 + e * proud;
    s.quad([u, v0, z0], [u, v1, z0], [u, v1, z1], [u, v0, z1], [0, 0], [0, 0], [0, 0], [0, 0], "decal", [e, 0, 0], hex2);
  }
  function outlineBand(s, prof, f2, e, bw, hex2, from = 0, to = Infinity) {
    const u = f2 + e * PROUD;
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
  function fanDecal(s, f2, e, centre, rim, hex2, proud = PROUD_HI) {
    const u = f2 + e * proud;
    for (let i = 0; i < rim.length - 1; i++) s.tri([u, centre[0], centre[1]], [u, rim[i][0], rim[i][1]], [u, rim[i + 1][0], rim[i + 1][1]], [0, 0], [0, 0], [0, 0], "decal", [e, 0, 0], hex2);
  }
  function gableAccents(s, g) {
    const { shape, prof, f: f2, e, W, trimHex } = g, half = W / 2;
    const top = Math.max(...prof.map((p) => p[1]));
    if (shape === "plain") {
      outlineBand(s, prof, f2, e, 0.2, trimHex);
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
          rectDecal(s, f2, e, inward > 0 ? x0 : x0 - w, inward > 0 ? x0 + w : x0, z - 0.24, z, trimHex);
        }
      }
      speklagen(s, prof, f2, e, top, trimHex, [0.3, 0.62]);
      return;
    }
    if (shape === "raisedNeck" || shape === "clock" || shape === "neck" || shape === "bell") outlineBand(s, prof, f2, e, shape === "clock" ? 0.22 : 0.16, trimHex);
    if (shape === "neck") speklagen(s, prof, f2, e, top, trimHex, [0.45]);
    if (shape === "raisedNeck") {
      for (const side of [-1, 1]) {
        const arc = g.claws?.[side < 0 ? 0 : 1];
        if (!arc || arc.length < 2) continue;
        const cx = side * Math.min(...arc.map((p) => Math.abs(p[0]))), cy = Math.min(...arc.map((p) => p[1]));
        fanDecal(s, f2, e, [cx, cy], arc, trimHex);
      }
      crown(s, prof, f2, e, top, trimHex, g.crownBase ?? top - 0.6);
      speklagen(s, prof, f2, e, top, trimHex, [0.62]);
    }
    if (shape === "clock") crown(s, prof, f2, e, top, trimHex, g.crownBase ?? top - 0.6);
    if (shape === "bell") {
      const span = profileSpan(prof, top - 0.5);
      if (span) rectDecal(s, f2, e, span[0] + 0.05, span[1] - 0.05, top - 0.5, top - 0.34, trimHex);
    }
    if (shape === "spout" && g.shutters) spoutShutters(s, prof, f2, e, half, top, trimHex, g.shutterHex);
  }
  function crown(s, prof, f2, e, top, hex2, base) {
    const rim = prof.filter((p) => p[1] >= base - 1e-6);
    if (rim.length < 3 || top - base < 0.15) return;
    fanDecal(s, f2, e, [(rim[0][0] + rim[rim.length - 1][0]) / 2, base], rim, hex2);
  }
  function speklagen(s, prof, f2, e, top, hex2, at) {
    for (const t of at) {
      const y = top * t, a = profileSpan(prof, y), b = profileSpan(prof, y + 0.15);
      if (!a || !b) continue;
      const v0 = Math.max(a[0], b[0]) + 0.02, v1 = Math.min(a[1], b[1]) - 0.02;
      if (v1 - v0 > 0.5) rectDecal(s, f2, e, v0, v1, y, y + 0.15, hex2);
    }
  }
  function spoutShutters(s, prof, f2, e, half, top, trimHex, shutterHex) {
    const y0 = 0.3, h = Math.min(1.5, top * 0.45), span = profileSpan(prof, y0 + h + 0.1);
    if (!span) return;
    const w = Math.min(1, half * 0.4, span[1] - span[0] - 0.35);
    if (w < 0.5 || h < 0.8) return;
    rectDecal(s, f2, e, -w / 2 - 0.08, w / 2 + 0.08, y0 - 0.08, y0 + h + 0.08, trimHex);
    rectDecal(s, f2, e, -w / 2, -0.025, y0, y0 + h, shutterHex, PROUD_HI);
    rectDecal(s, f2, e, 0.025, w / 2, y0, y0 + h, shutterHex, PROUD_HI);
  }
  function corniceFront(s, g, top) {
    const { f: f2, e, W, trimHex } = g, depth = 0.42, h = 0.48, over = 0.08;
    const u0 = Math.min(f2, f2 + e * depth), u1 = Math.max(f2, f2 + e * depth);
    s.box(u0, u1, -W / 2 - over, W / 2 + over, top - h, top + 0.05, "trim", trimHex);
    rectDecal(s, f2, e, -W / 2, W / 2, top - h - 0.34, top - h - 0.06, trimHex);
    for (const side of [-1, 1]) rectDecal(s, f2, e, side < 0 ? -W / 2 : W / 2 - 0.3, side < 0 ? -W / 2 + 0.3 : W / 2, -1.6, top - h - 0.06, trimHex);
  }
  function vergeBoards(s, f2, e, edges, hex2, bw = 0.22) {
    for (const [a, b] of edges) outlineBand(s, [a, b], f2, e, bw, hex2);
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
    const add2 = (x, y) => pts.push([x, Math.max(y, slope(x) + 0.04)]);
    const mirror = (left) => {
      const right = left.slice(0, -1).reverse().map(([x, y]) => [-x, y]);
      const all = [...left, ...right];
      all[0] = [all[0][0], 0];
      all[all.length - 1] = [all[all.length - 1][0], 0];
      return dedupe(all);
    };
    const N = 10;
    if (shape === "plain") {
      add2(-half, 0);
      add2(0, roofRiseM);
      add2(half, 0);
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
      add2(-half, 0);
      for (let i = 1; i <= 4; i++) {
        const t = i / 4, x = -half + (half - neck) * t;
        add2(x, 0.15 + (shoulder - 0.15) * Math.pow(t, 1.7));
      }
      add2(-neck, top2);
      add2(neck, top2);
      for (let i = 4; i >= 1; i--) {
        const t = i / 4, x = half - (half - neck) * t;
        add2(x, 0.15 + (shoulder - 0.15) * Math.pow(t, 1.7));
      }
      add2(half, 0);
      pts[0][1] = 0;
      pts[pts.length - 1][1] = 0;
      return dedupe(pts);
    }
    if (shape === "raisedNeck") {
      const d = raisedNeckDims(widthM, roofRiseM);
      add2(-half, 0);
      add2(-half, d.s0);
      if (d.arc.length) {
        if (d.arc[0][0] > -half + 0.01) add2(d.arc[0][0], d.s0);
        for (const [x, y] of d.arc) add2(x, y);
      } else add2(-d.neck, d.s0);
      add2(-d.neck, d.topN);
      add2(0, d.top);
      return mirror(pts);
    }
    if (shape === "clock") {
      const { neck, sh, nt, top: top2 } = clockDims(widthM, roofRiseM);
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        add2(-half + (half - neck) * t, sh * (3 * t * t - 2 * t * t * t));
      }
      for (let i = 0; i <= 3; i++) {
        const a = Math.PI - i / 3 * (Math.PI / 2);
        add2(neck * Math.cos(a), nt + (top2 - nt) * Math.sin(a));
      }
      return mirror(pts);
    }
    const bell = shape === "bell", top = roofRiseM * (bell ? 1.3 : 1.55) + (bell ? 0.6 : 0.9);
    for (let i = 0; i <= N; i++) {
      const x = -half + widthM * i / N, t = Math.abs(x) / half;
      let f2;
      if (bell) f2 = t < 0.18 ? 1 : 0.12 + 0.88 * (0.5 + 0.5 * Math.cos(Math.PI * Math.pow((t - 0.18) / 0.82, 0.85)));
      else {
        const tt = t < 0.26 ? 0 : (t - 0.26) / 0.74;
        f2 = t < 0.26 ? 1 : 0.1 + 0.9 * (1 - Math.pow(tt, 0.6));
      }
      add2(x, top * f2);
    }
    pts[0][1] = 0;
    pts[pts.length - 1][1] = 0;
    return dedupe(pts);
  }
  var dedupe = (pts) => pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
  function gableSlab(s, prof, e, L, topPart, topHex, t = 0.32) {
    const f2 = e * L / 2, b = e * (L / 2 - t), st = s.dims.storeyM;
    for (let i = 0; i < prof.length - 1; i++) {
      const [x0, y0] = prof[i], [x1, y1] = prof[i + 1];
      if (Math.abs(x1 - x0) > 1e-4) {
        s.quad([f2, x0, 0], [f2, x1, 0], [f2, x1, y1], [f2, x0, y0], s.wallUv(x0, 0), s.wallUv(x1, 0), s.wallUv(x1, y1), s.wallUv(x0, y0), "plate", [e, 0, 0]);
        s.quad([b, x0, 0], [b, x1, 0], [b, x1, y1], [b, x0, y0], s.wallUv(x0, 0), s.wallUv(x1, 0), s.wallUv(x1, y1), s.wallUv(x0, y0), "plate", [-e, 0, 0]);
        s.quad([f2, x0, y0], [f2, x1, y1], [b, x1, y1], [b, x0, y0], [0, 0], [1, 0], [1, 1], [0, 1], topPart, [0, 0, 1], topPart === "trim" ? topHex : void 0);
      } else {
        const hi = Math.max(y0, y1), lo = Math.min(y0, y1), faceV = y1 > y0 ? -1 : 1;
        s.quad([f2, x0, lo], [b, x0, lo], [b, x0, hi], [f2, x0, hi], [0, lo / st], [0.1, lo / st], [0.1, hi / st], [0, hi / st], "plate", [0, faceV, 0]);
      }
    }
  }
  function dormer(s, d, plan) {
    const P2 = (a, b, z) => d.axis === "v" ? [b, d.side * a, z] : [d.side * a, b, z];
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
    s.quad(P2(d.pf, b0, zb), P2(d.pf, b1, zb), P2(d.pf, b1, zt), P2(d.pf, b0, zt), [0, 0], [rep, 0], [rep, 1], [0, 1], "dormerFace", n);
    for (const [b, sg] of [[b0, -1], [b1, 1]]) s.quad(P2(d.pf, b, zb), P2(pb, b, zb), P2(pb, b, zt), P2(d.pf, b, zt), [0, 0], [1, 0], [1, 1], [0, 1], accents ? "trim" : "dormerSide", tan(sg), accents ? trim : void 0);
    if (d.band) {
      s.quad(P2(d.pf, b0, zt), P2(d.pf, b1, zt), P2(pb, b1, zt), P2(pb, b0, zt), [0, 0], [1, 0], [1, 1], [0, 1], "dormerSide", [0, 0, 1]);
      if (accents) s.quad(P2(d.pf + 0.012, b0, zt - 0.14), P2(d.pf + 0.012, b1, zt - 0.14), P2(d.pf + 0.012, b1, zt), P2(d.pf + 0.012, b0, zt), [0, 0], [0, 0], [0, 0], [0, 0], "decal", n, trim);
    } else {
      s.tri(P2(d.pf, b0, zt), P2(d.pf, b1, zt), P2(d.pf, d.c, zt + ph), [0, 0], [0, 0], [0, 0], accents ? "trim" : "plate", n, accents ? trim : void 0);
      for (const sg of [-1, 1]) {
        const b = sg < 0 ? b0 : b1;
        s.slopeTri(P2(d.pf, b, zt), P2(pb, b, zt), P2(pb, d.c, zt + ph), [...tan(sg).slice(0, 2), 0.8], "dormerSide");
        s.slopeTri(P2(d.pf, b, zt), P2(pb, d.c, zt + ph), P2(d.pf, d.c, zt + ph), [...tan(sg).slice(0, 2), 0.8], "dormerSide");
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
          const f2 = i / 3 * Math.PI / 2;
          arc.push([cu + su * rc * Math.sin(f2), cv + sv * rc * Math.cos(f2), -drop]);
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
  function buildRoofTriangles(rect, plan, h0, dims) {
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
        const f2 = e * L / 2;
        if (cornice && plan.gableEnds?.[e < 0 ? 0 : 1] !== false && plan.streetEnds?.[e < 0 ? 0 : 1] !== false) {
          const prof = gableProfile("cornice", W, R);
          gableSlab(s, prof, e, L, accents ? "trim" : "plate", trim);
          if (accents) gableAccents(s, { shape: "cornice", prof, f: f2, e, W, R, trimHex: trim, shutterHex: "", shutters: false });
        } else {
          s.quad([f2, -W / 2, 0], [f2, W / 2, 0], [f2, vc, zc], [f2, -vc, zc], s.wallUv(-W / 2, 0), s.wallUv(W / 2, 0), s.wallUv(vc, zc), s.wallUv(-vc, zc), "plate", [e, 0, 0]);
          if (accents && plan.gableEnds?.[e < 0 ? 0 : 1] !== false && plan.streetEnds?.[e < 0 ? 0 : 1] !== false) vergeBoards(s, f2, e, [[[-W / 2, 0], [-vc, zc]], [[vc, zc], [W / 2, 0]]], trim);
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
      const f2 = e * L / 2;
      const exterior = plan.gableEnds?.[e < 0 ? 0 : 1] !== false;
      const rear = plan.kind === "gable" && plan.streetEnds?.[e < 0 ? 0 : 1] === false;
      if (plan.kind === "pitched" || !exterior || rear) {
        s.tri([f2, -W / 2, 0], [f2, W / 2, 0], [f2, 0, R], s.wallUv(-W / 2, 0), s.wallUv(W / 2, 0), s.wallUv(0, R), "plate", [e, 0, 0]);
        if (accents && exterior && !rear) vergeBoards(s, f2, e, [[[-W / 2, 0], [0, R]], [[0, R], [W / 2, 0]]], trim);
        continue;
      }
      const prof = gableProfile(plan.gable, W, R);
      gableSlab(s, prof, e, L, accents && plan.gable !== "plain" ? "trim" : "plate", trim);
      if (accents) gableAccents(s, { shape: plan.gable, prof, f: f2, e, W, R, trimHex: trim, shutterHex: plan.shutterHex ?? "#2f4a3a", shutters: !!plan.shutters, claws: plan.gable === "raisedNeck" ? clawArcs(W, R) : void 0, crownBase: crownBaseOf(plan.gable, W, R) });
    }
    if (plan.dormers) {
      const n = Math.min(3, Math.floor((L - 2) / 3.4));
      for (const sd of [-1, 1]) for (let i = 0; i < n; i++) dormer(s, { axis: "v", side: sd, c: -L / 2 + (i + 0.5) * L / n, pf: W / 2 * 0.72, dw: 1.05, hd: 1.35, surf: surfV }, plan);
    }
    return s.out;
  }
  function roofTriangles(rect, plan, h0, dims) {
    const triangles = buildRoofTriangles(rect, plan, h0, dims);
    if (!plan.nativeEnvelopeM || !triangles.length) return triangles;
    const top = Math.max(...triangles.flatMap((t) => t.p.map((p) => p[2] - h0)));
    if (top <= 0) return triangles;
    const scale2 = plan.nativeEnvelopeM / top;
    return triangles.map((t) => {
      const nz = t.n[2] / scale2, length = Math.hypot(t.n[0], t.n[1], nz);
      const endDot = t.n[0] * rect.ux + t.n[1] * rect.uy;
      const sourceCrownShape = plan.kind === "gable" && t.part === "plate" && Math.abs(endDot) > 0.9 && plan.gableEnds?.[endDot < 0 ? 0 : 1] !== false && plan.streetEnds?.[endDot < 0 ? 0 : 1] !== false ? plan.gable : void 0;
      return {
        ...t,
        sourceCrownShape,
        p: t.p.map(([x, y, z]) => [x, y, h0 + (z - h0) * scale2]),
        n: [t.n[0] / length, t.n[1] / length, nz / length]
      };
    });
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
    const cross4 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const inside = (p, a, b, c) => cross4(a, b, p) > 1e-9 && cross4(b, c, p) > 1e-9 && cross4(c, a, p) > 1e-9;
    let guard = pts.length * pts.length + 10;
    while (idx.length > 3 && guard-- > 0) {
      let clipped = false;
      for (let k = 0; k < idx.length; k++) {
        const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length];
        const a = pts[i0], b = pts[i1], c = pts[i2];
        const turn = cross4(a, b, c);
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
  var sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  var crossV = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  function tri(out, a, b, c, ua, ub, uc, layer, hex2, hint) {
    let n = crossV(sub3(b, a), sub3(c, a)), B = b, C = c, UB = ub, UC = uc;
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

  // src/canalRecall/kitTypeOverrides.ts
  var OVR = "NL.IMBAG.Pand.";
  var NOT_WORSHIP_FORM = {
    [`${OVR}0363100012237810`]: "Blauwe Moskee: the pand is the housing block round it (27 live VBOs, 68% living area); review row 51 photo a 4-5 storey brick block with balconies",
    [`${OVR}0363100012148521`]: "1927 block, 11 VBOs, 59% living area; review row 87 photo a 5-storey dark brick front with white-framed window rows",
    [`${OVR}0363100012083695`]: "1927 Betondorp house, office and living use; review row 113 photo dark brick and grey render with white-framed rectangular windows",
    [`${OVR}0363100012130941`]: "Kuba Camii Moskee in a 1955 building registered for education; review row 165 photo a house-type front with dormers",
    [`${OVR}0363100012108972`]: "Moskee an-Nour in a 1921 flat-roofed building; review row 172 photo yellow-grey brick with white rectangular windows",
    [`${OVR}0363100012233557`]: "Vincentiuskerk in a 1990 housing block (69 live VBOs, 94% living area); review row 175 photo a 6-storey residential block",
    [`${OVR}0363100012246231`]: "Gerardus Majellakerk OSM tag on a building registered as offices; review row 234 photo a 3-storey house-type front with an arcaded base",
    [`${OVR}0363100012142532`]: "1896 canal house (149 m2) holding a mosque; review row 293 photo a 4-storey house front with sash windows",
    [`${OVR}0363100012237290`]: "Masjid Al-Karam in a 1904 building registered for industry; review row 307 photo a residential block front with sash windows"
  };
  var NOT_PUBLIC_FORM = {
    [`${OVR}0363100012090063`]: "SOB school tag on a 1976 housing block (39 live VBOs, 63% living area); review row 284 photo a housing/shop front with balconies",
    // Kit review round 4 (GitHub #43, row 316): planPublic's height escape took a 20 m2 part of the Bijlmerbios complex as a
    // film house; publicBuildings.ts CINEMA_MIN_PART_AREA_M2 now refuses it, and this drops it until publicBuildingData.ts
    // is regenerated (the generator's other output has drifted, so it is not regenerated here).
    w1488019256: "Bijlmerbios cinema tag on a 20 m2, 30 m OSM building part (a core or pylon of pand 0363100012079990, 0 kit triangles); drawn as a free-standing windowless pillar in review row 316"
  };
  var PUBLIC_RETYPE = {
    // planPublic({kind: 's', heightM: 11.2, year: 1932, ...}) -> flat plan, era e; the 3DBAG roof (type 3, eaves 4.1,
    // ridge 15.9) gives the pre-1940 school hip (schoolHipRoof: eaves 6, rise 9.9), which hipAround fits on its footprint.
    [`${OVR}0363100012092742`]: {
      entry: [`${OVR}0363100012092742`, "s", "f", 11.2, 0, "e"],
      facts: { year: 1932, roof: 3, eavesM: 4.1, ridgeM: 15.9, wallHex: null, roofFits: true },
      why: "Zonnehuis (Noord): a 1932 school-type building under a tall hipped roof, tagged amenity=theatre for its current use; review asked for a school with a hipped roof, not a windowless theatre box"
    }
  };

  // src/canalRecall/kitFacades.ts
  var P = "NL.IMBAG.Pand.";
  var KIT_FACADES = {
    // AFAS Live (2001, 19.8 m): silver vertical-ribbed metal over a ground storey of grey panel doors (0.39 of the crop's
    // wall), one band of narrow windows at 0.69-0.84 of it. Ribs #a4a19a (upper crop), doors #575b5a.
    [`${P}0363100012123240`]: {
      why: "row 279 (kits-r5-70): grey vertical-ribbed metal hall with one continuous window band and large ground openings",
      wallHex: "#9f9c95",
      rows: [{ z0: 13.6, z1: 16.6, widthM: 1.2, bayM: 1.6, ribbon: true }],
      glassHex: "#3d4246",
      frameHex: "#8f8c86",
      cladding: [
        { kind: "panels", hex: "#6a6e6c", z0: 0, z1: 7.7, pitchM: 4.5, rowM: 7.7, lineHex: "#45494a" },
        { kind: "ribs", hex: "#a4a19a", z0: 7.7, pitchM: 0.45 }
      ]
    },
    // Cinema Amstelveen (2002, 16.6 m): dark grey horizontal louvres over the upper 0.42 of the wall; below, a grid of
    // dark panels and green-grey glass (#72746d / #87a897) over a covered passage.
    [`${P}0362100001111443`]: {
      why: "row 355 (kits-r5-89): dark grey horizontal louvre cladding over a fully glazed and panelled ground floor",
      wallHex: "#6f716c",
      rows: [],
      cladding: [
        { kind: "curtain", hex: "#5c6662", z0: 0, z1: 9.4, pitchM: 2.4, rowM: 2.3, lineHex: "#9a9c97" },
        { kind: "louvres", hex: "#8d8f8c", z0: 9.6, pitchM: 0.32, lineHex: "#3e4140" }
      ]
    },
    // Pathé Arena (2000, 19.9 m): grey-green metal cassette panels all over (#7a8184 shade, #8ea59f lit), about 1.5 m wide
    // and 1.1 m tall on the crop. The sloped dark glazed band over the entrance is not expressible (one edge only).
    [`${P}0363100012100092`]: {
      why: "row 278 (kits-r5-70): grey metal-panel cladding (the sloped glazed band over the entrance is left out)",
      wallHex: "#848d8e",
      rows: [],
      cladding: [{ kind: "panels", hex: "#848d8e", z0: 0, pitchM: 1.5, rowM: 1.1, lineHex: "#5f6668" }]
    },
    // Film and Television Academy (1999, 19.5 m): a green-grey curtain wall, glass #434f47, mullions #535e54 about 1.6 m
    // apart, transoms at each 1.3 m band of opaque glass.
    [`${P}0363100012170259`]: {
      why: "row 280 (kits-r5-70): full-height green-grey curtain-wall grid",
      wallHex: "#4d5a50",
      rows: [],
      cladding: [{ kind: "curtain", hex: "#47544b", z0: 0, pitchM: 1.6, rowM: 1.3, lineHex: "#6d7a6f" }]
    },
    // Islamitisch Centrum Quba (1990, 7.4 m): pale blue horizontal profiled metal (#7baad1) above a sign band at 0.47 of
    // the wall, brick below (#5a5e68 raw, #7d7d8d white-balanced on the sign band) with shop windows.
    [`${P}0363100012128901`]: {
      why: "row 258 (kits-r5-65): blue metal-clad upper band over a low brick plinth with a glazed shopfront",
      wallHex: "#7d7d8d",
      rows: [{ z0: 0.7, z1: 2.9, widthM: 2.4, bayM: 3.2, head: "flat" }],
      glassHex: "#3f4a52",
      frameHex: "#d9dcdc",
      cladding: [{ kind: "boards", hex: "#86b0d2", z0: 3.5, pitchM: 0.3 }]
    },
    // School (1959, 11.5 m): white-gridded curtain wall with blue spandrel bands (#5f7571 glass row).
    [`${P}0363100012104151`]: {
      why: "row 117 (kits-r5-30): near-fully glazed white-gridded curtain wall with blue spandrel panels",
      wallHex: "#dfe2df",
      rows: [],
      cladding: [{ kind: "curtain", hex: "#5a6d6c", z0: 0.3, pitchM: 1.3, rowM: 1.9, lineHex: "#eef0ee", spandrelM: 0.5, spandrelHex: "#5d7fa6" }]
    },
    // De Bonkelaar (1973, 4.5 m): light grey horizontal profiled metal (#8ba2a4 through leaves), one storey.
    [`${P}0363100012079924`]: {
      why: "row 137 (kits-r5-35): grey horizontal ribbed metal cladding",
      wallHex: "#a3abae",
      cladding: [{ kind: "boards", hex: "#a3abae", z0: 0, pitchM: 0.22 }]
    },
    // School (1971, 4.5 m): a low pavilion walled in blue-framed glazing and coloured panels (blue read by eye: the
    // posts are too thin on the crop to sample).
    [`${P}0358100021569571`]: {
      why: "row 367 (kits-r5-92): long wall almost entirely blue-framed glazing and coloured panels",
      wallHex: "#b1b6b8",
      rows: [],
      // ochre-panelled glazing between blue posts about 2.6 m apart, under a grey fascia from 0.75 of the wall
      cladding: [
        { kind: "curtain", hex: "#a68c62", z0: 0.3, z1: 3.3, pitchM: 2.6, rowM: 9, lineHex: "#3f6496" },
        { kind: "panels", hex: "#b1b6b8", z0: 3.45, pitchM: 3, rowM: 9 }
      ]
    },
    // De Dapper (1985, 12.4 m): pale grey metal-panel upper volume (#7e8790 shaded) raised over a glazed ground floor.
    [`${P}0363100012112062`]: {
      why: "row 196 (kits-r5-49): pale grey metal-panel clad upper volume on pilotis over a glazed ground floor",
      wallHex: "#aeb3b5",
      rows: [],
      cladding: [
        { kind: "curtain", hex: "#3f474c", z0: 0, z1: 4.2, pitchM: 2.4, rowM: 4.2, lineHex: "#d0d0c8" },
        { kind: "panels", hex: "#aeb3b5", z0: 4.6, pitchM: 2.4, rowM: 12, lineHex: "#868c8f" }
      ]
    }
  };
  function applyKitFacade(kit, id, eavesM, facade = KIT_FACADES[id]) {
    if (!facade) return kit;
    const wall = { plain: true, hex: facade.wallHex ?? kit.wall?.hex ?? "#a8a6a0" };
    const hall = kit.halls?.find((h) => h.id === id);
    const prior = hall?.windows;
    const windows = {
      ...prior ?? {},
      rows: facade.rows ?? prior?.rows ?? [],
      ...facade.glassHex ? { glassHex: facade.glassHex } : {},
      ...facade.frameHex ? { frameHex: facade.frameHex } : {},
      // the measured sash bars and top band belong to the brick front the facade replaces
      sash: void 0,
      topBand: void 0,
      cladding: facade.cladding
    };
    if (hall) return { ...kit, wall, halls: kit.halls.map((h) => h === hall ? { ...h, windows } : h) };
    const { body: _body, trim, ...rest } = kit;
    return { ...rest, wall, halls: [{ id, widthM: 0, anchor: [0, 0], eavesM, riseM: 0, mat: "slate", windows: { ...windows, ...trim?.plinth ? { plinth: trim.plinth } : {} } }] };
  }

  // src/canalRecall/publicBuildingFacts.ts
  var SCHOOL_PERIOD_WALLS = { "c19": ["#4d423c", "#56453f", "#64544d", "#68584e", "#736062", "#68655a", "#847465"], "school": ["#443a34", "#45413b", "#54463f", "#5d4b47", "#5b5049", "#645850", "#81766b"], "modern": ["#443d35", "#4c4640", "#5b4f45", "#60584c", "#645f5d", "#746d68", "#8f8781"] };
  var PUBLIC_FACTS = [
    ["NL.IMBAG.Pand.0305100000000252", 1981, 3, 35, 0, null, 1, 0, null, 1, 0, 0, "#6b6e76", null],
    ["NL.IMBAG.Pand.0305100000001042", 1910, 3, 29, 75, null, 1, 0, null, 3, 30, 75, "#676a69", null, null, 40.8],
    ["NL.IMBAG.Pand.0305100000001060", 1955, 3, 32, 73, null, 1, 0, null, 0, 0, 0, "#636a6d", null],
    ["NL.IMBAG.Pand.0305100000001188", 1985, 3, 31, 129, null, 1, 0, null, 0, 0, 0, "#514f53", null],
    ["NL.IMBAG.Pand.0358100019106022", 1960, 3, 36, 57, null, 1, 0, null, 0, 0, 0, null, null],
    ["NL.IMBAG.Pand.0358100020880018", 1990, 3, 35, 78, "#554a40", 1, 1, null, 0, 0, 0, "#6f7276", "#ebebd7"],
    ["NL.IMBAG.Pand.0358100020881991", 1974, 3, 44, 0, "#443d35", 1, 1, "#f5f6f5", 0, 0, 0, "#5a5c60", "#ebe3ca"],
    ["NL.IMBAG.Pand.0358100021235050", 1933, 3, 38, 87, null, 1, 0, null, 0, 0, 0, "#845f54", null],
    ["NL.IMBAG.Pand.0358100021569571", 1971, 3, 45, 0, "#615243", 1, 1, null, 0, 0, 0, "#5a5c60", null],
    ["NL.IMBAG.Pand.0358100021571530", 1860, 3, 28, 157, "#574942", 1, 3, null, 0, 0, 0, "#51585c", null],
    ["NL.IMBAG.Pand.0362100001054252", 1958, 3, 34, 139, null, 1, 0, null, 1, 36, 60, "#565858", null, null, 24.3],
    ["NL.IMBAG.Pand.0362100001054264", 1981, 3, 37, 83, "#806b54", 1, 0, null, 0, 0, 0, "#747b83", "#ebe6d8", "10-41"],
    ["NL.IMBAG.Pand.0362100001054286", 1950, 3, 38, 258, null, 1, 3, null, 3, 122, 186, "#444b4b", null, null, 37.3],
    ["NL.IMBAG.Pand.0362100001054502", 1974, 3, 35, 0, "#61574c", 1, 1, null, 1, 0, 0, "#636569", null],
    ["NL.IMBAG.Pand.0362100001055799", 1875, 3, 45, 205, "#4f4a42", 1, 3, null, 0, 0, 0, "#5e6164", "#ebdfc5"],
    ["NL.IMBAG.Pand.0362100001056666", 1920, 3, 56, 132, null, 1, 0, null, 0, 0, 0, "#56585c", null],
    ["NL.IMBAG.Pand.0362100001056681", 1955, 3, 52, 122, null, 1, 0, null, 0, 0, 0, "#5a5c60", null],
    ["NL.IMBAG.Pand.0362100001056682", 1928, 3, 56, 269, null, 1, 0, null, 0, 0, 0, "#5a5c60", null],
    ["NL.IMBAG.Pand.0362100001056689", 1940, 3, 35, 127, null, 1, 0, null, 0, 0, 0, "#4d4f53", null],
    ["NL.IMBAG.Pand.0362100001056925", 1926, 3, 41, 106, "#45413b", 1, 1, null, 0, 0, 0, "#5e6164", "#ebe9e9"],
    ["NL.IMBAG.Pand.0362100001057631", 1955, 3, 33, 113, null, 1, 0, null, 0, 0, 0, "#40434b", null],
    ["NL.IMBAG.Pand.0362100001059417", 1966, 3, 22, 50, "#48433b", 1, 1, null, 0, 0, 0, null, null],
    ["NL.IMBAG.Pand.0362100001059917", 1971, 3, 34, 0, "#6c6561", 1, 1, null, 0, 0, 0, "#565458", "#ebebea", "11-31"],
    ["NL.IMBAG.Pand.0362100001060156", 1969, 3, 33, 95, "#4d463f", 1, 3, null, 1, 88, 113, "#56585c", "#e2e7eb", null, 37.4],
    ["NL.IMBAG.Pand.0362100001060286", 1972, 3, 37, 70, "#534b4b", 1, 1, null, 0, 0, 0, "#44474f", null],
    ["NL.IMBAG.Pand.0362100001060288", 1974, 3, 43, 0, "#49423c", 1, 1, "#d6d8da", 0, 0, 0, "#636569", "#e3e7eb"],
    ["NL.IMBAG.Pand.0362100001063786", 1993, 2, 34, 0, "#443e39", 1, 1, null, 0, 0, 0, null, "#dde7eb"],
    ["NL.IMBAG.Pand.0362100001071115", 1988, 3, 39, 49, "#8b7c67", 1, 1, null, 1, 42, 49, null, null, null, 15.1],
    ["NL.IMBAG.Pand.0362100001077423", 1952, 3, 34, 109, null, 1, 0, null, 0, 0, 0, "#5e6164", null],
    ["NL.IMBAG.Pand.0362100001077847", 1939, 3, 18, 172, "#8b7f74", 1, 2, "#eaf6fd", 3, 50, 171, "#494b4f", null, "24-32,111-132", 59.1],
    ["NL.IMBAG.Pand.0362100001079502", 1956, 2, 36, 0, null, 1, 0, null, 0, 0, 0, null, null],
    ["NL.IMBAG.Pand.0362100001081052", 1954, 2, 27, 0, null, 1, 0, null, 0, 0, 0, null, null],
    ["NL.IMBAG.Pand.0362100001082159", 1963, 3, 80, 124, null, 1, 1, null, 0, 0, 0, "#5e6569", "#e2e7eb", "10-35,78-126"],
    ["NL.IMBAG.Pand.0362100001091554", 1989, 3, 44, 0, "#524c42", 1, 0, null, 0, 0, 0, "#5a5c60", "#ebe8e2"],
    ["NL.IMBAG.Pand.0362100001094331", 1973, 3, 40, 0, null, 1, 0, null, 0, 0, 0, "#76808f", null],
    ["NL.IMBAG.Pand.0362100001110286", 1968, 3, 33, 124, null, 1, 0, null, 0, 0, 0, "#5e6164", null],
    ["NL.IMBAG.Pand.0362100001111443", 2002, 3, 152, 0, null, 1, 0, null, 0, 0, 0, "#636a6d", null],
    ["NL.IMBAG.Pand.0362100001111444", 1975, 3, 90, 0, "#fdfadf", 1, 1, null, 0, 0, 0, "#5e6160", null, "10-49,63-73,96-132"],
    ["NL.IMBAG.Pand.0363100012061252", 1916, 3, 134, 115, null, 1, 0, null, 1, 106, 135, "#5e5c60", null, null, 38.1],
    ["NL.IMBAG.Pand.0363100012061926", 1924, 3, 32, 70, "#443a34", 1, 1, null, 2, 69, 78, "#51545c", "#ebead7", null, 50.4],
    ["NL.IMBAG.Pand.0363100012061961", 1994, 3, 68, 174, "#524542", 1, 1, null, 1, 69, 82, "#636569", "#bcd7eb", null, 29],
    ["NL.IMBAG.Pand.0363100012062340", 1928, 3, 48, 133, "#54463f", 1, 1, null, 3, 71, 133, "#7b564b", "#ebe9ea", null, 41.3],
    ["NL.IMBAG.Pand.0363100012062993", 1955, 3, 32, 0, "#605751", 1, 1, null, 1, 0, 0, "#636164", "#ced7eb"],
    ["NL.IMBAG.Pand.0363100012063764", 1983, 3, 37, 0, null, 1, 0, null, 1, 41, 54, "#56585c", null, null, 22.6],
    ["NL.IMBAG.Pand.0363100012064693", 1931, 3, 35, 169, "#5e462f", 1, 2, null, 3, 82, 151, "#956c5c", null, null, 57],
    ["NL.IMBAG.Pand.0363100012065279", 1982, 2, 28, 0, null, 1, 0, null, 1, 0, 0, null, null],
    ["NL.IMBAG.Pand.0363100012065903", 1985, 3, 92, 0, null, 1, 2, null, 1, 0, 0, "#676e71", null, "10-18,47-70,114-134"],
    ["NL.IMBAG.Pand.0363100012066059", 1958, 3, 36, 150, "#957f6a", 1, 2, null, 2, 104, 150, "#5a5c60", "#e8eaeb", "57-71,78-94", 34.2],
    ["NL.IMBAG.Pand.0363100012066710", 1976, 3, 39, 0, "#4c463b", 1, 1, null, 1, 43, 53, "#515458", "#ebe9e3", null, 17.5],
    ["NL.IMBAG.Pand.0363100012067061", 1991, 1, 75, 0, "#77574d", 1, 2, null, 1, 0, 0, null, "#cce9eb"],
    ["NL.IMBAG.Pand.0363100012067458", 1934, 3, 35, 125, "#5d514a", 1, 1, null, 3, 57, 125, "#515458", null, null, 29.9],
    ["NL.IMBAG.Pand.0363100012068181", 1977, 3, 37, 39, null, 1, 0, null, 1, 0, 0, "#5a5c64", null],
    ["NL.IMBAG.Pand.0363100012068345", 1971, 2, 31, 0, "#d6c3a9", 1, 2, null, 1, 0, 0, null, "#bce0eb", "10-108"],
    ["NL.IMBAG.Pand.0363100012068581", 1990, 3, 35, 0, "#7c6d67", 1, 1, null, 1, 35, 57, "#636a69", "#e3e3eb", "10-20", 17.2],
    ["NL.IMBAG.Pand.0363100012068625", 1932, 3, 29, 150, null, 1, 0, null, 3, 83, 150, "#885f54", null, null, 45.1],
    ["NL.IMBAG.Pand.0363100012069508", 1998, 3, 70, 0, null, 1, 0, null, 1, 76, 90, "#56585c", null, null, 26.6],
    ["NL.IMBAG.Pand.0363100012069994", 1956, 3, 54, 111, "#7d6b63", 1, 1, null, 2, 50, 111, "#5a5c60", "#eaeaeb", "15-23,52-78", 39],
    ["NL.IMBAG.Pand.0363100012070769", 1983, 3, 63, 118, null, 1, 0, null, 1, 38, 49, "#6b6e71", null, null, 35.3],
    ["NL.IMBAG.Pand.0363100012071822", 1928, 3, 28, 178, null, 1, 0, null, 3, 114, 178, null, null, null, 44.7],
    ["NL.IMBAG.Pand.0363100012072736", 1958, 3, 30, 115, null, 1, 0, null, 1, 0, 0, "#565c5c", null],
    ["NL.IMBAG.Pand.0363100012072950", 1933, 3, 136, 0, "#443a35", 1, 1, null, 1, 0, 0, "#636569", null],
    ["NL.IMBAG.Pand.0363100012073434", 1900, 3, 33, 0, null, 1, 1, null, 1, 0, 0, "#51585c", null, ""],
    ["NL.IMBAG.Pand.0363100012073895", 1992, 3, 31, 0, "#67635a", 1, 3, null, 1, 0, 0, "#515458", null],
    ["NL.IMBAG.Pand.0363100012074274", 1922, 3, 33, 166, "#544642", 1, 1, null, 3, 84, 166, "#996c5c", null, null, 50.4],
    ["NL.IMBAG.Pand.0363100012074574", 1928, 3, 55, 148, null, 1, 0, null, 1, 97, 141, "#676a6d", null, null, 54.5],
    ["NL.IMBAG.Pand.0363100012074804", 1977, 3, 33, 0, null, 1, 2, null, 1, 50, 86, "#56585c", null, "10-53", 19.1],
    ["NL.IMBAG.Pand.0363100012074914", 1954, 3, 33, 131, null, 1, 0, null, 3, 94, 131, "#636a6d", null, null, 16.3],
    ["NL.IMBAG.Pand.0363100012075047", 1983, 3, 33, 0, null, 1, 0, null, 1, 52, 66, "#636164", null, null, 44.6],
    ["NL.IMBAG.Pand.0363100012075161", 1975, 3, 38, 0, "#7c665e", 1, 1, null, 1, 42, 52, "#5e6164", null, null, 17.9],
    ["NL.IMBAG.Pand.0363100012075686", 1976, 3, 36, 53, "#73675f", 1, 0, null, 1, 0, 0, "#5e6569", "#ebe6e0", "10-26,47-61"],
    ["NL.IMBAG.Pand.0363100012075737", 1927, 3, 110, 191, "#5d4f4b", 1, 1, null, 2, 129, 191, "#636164", "#ebe9e3", null, 53.6],
    ["NL.IMBAG.Pand.0363100012076543", 1926, 3, 44, 191, "#4f4037", 1, 2, null, 2, 161, 215, "#565c60", "#cce0eb", null, 51.1],
    ["NL.IMBAG.Pand.0363100012077054", 1956, 3, 36, 113, null, 1, 0, null, 3, 31, 73, "#636164", null, null, 32.8],
    ["NL.IMBAG.Pand.0363100012077177", 1986, 3, 34, 112, null, 1, 0, null, 2, 68, 92, "#5e6164", null, null, 44.2],
    ["NL.IMBAG.Pand.0363100012078085", 1964, 3, 73, 167, "#685d52", 1, 1, null, 3, 151, 167, "#5e6164", "#ebeae2", null, 28.9],
    ["NL.IMBAG.Pand.0363100012078294", 1965, 3, 35, 0, "#615a53", 1, 1, null, 1, 43, 55, "#56585c", null, null, 18],
    ["NL.IMBAG.Pand.0363100012079617", 1987, 3, 71, 0, "#bbad90", 1, 1, "#fefdfa", 1, 0, 0, "#5e6164", null, ""],
    ["NL.IMBAG.Pand.0363100012079921", 1967, 3, 37, 0, null, 1, 0, null, 1, 0, 0, "#5a6164", null],
    ["NL.IMBAG.Pand.0363100012079924", 1973, 3, 33, 42, "#3b362f", 1, 1, null, 1, 0, 0, "#5a585c", null],
    ["NL.IMBAG.Pand.0363100012080098", 1991, 2, 71, 0, "#8e8780", 1, 1, null, 1, 0, 0, null, "#ebe8e0", ""],
    ["NL.IMBAG.Pand.0363100012080150", 1982, 3, 32, 0, "#585046", 1, 1, "#f0eee9", 0, 0, 0, "#5e6164", null],
    ["NL.IMBAG.Pand.0363100012080302", 1974, 3, 34, 0, null, 1, 0, null, 1, 0, 0, "#5e6164", null],
    ["NL.IMBAG.Pand.0363100012080308", 1924, 3, 50, 0, null, 1, 0, null, 1, 45, 61, "#6b6e71", null, null, 55.7],
    ["NL.IMBAG.Pand.0363100012080392", 1965, 3, 60, 0, null, 1, 0, null, 1, 0, 0, null, null],
    ["NL.IMBAG.Pand.0363100012080630", 1932, 3, 127, 186, "#4e433e", 1, 1, "#f8fefe", 3, 126, 186, "#734d42", "#eaebeb", null, 44.4],
    ["NL.IMBAG.Pand.0363100012081651", 1932, 2, 34, 0, "#ad7b6f", 1, 2, "#d9d7d5", 1, 0, 0, null, null, "10-40"],
    ["NL.IMBAG.Pand.0363100012082170", 1924, 3, 87, 207, "#635f57", 1, 1, null, 3, 127, 269, "#5e656d", "#e7ebe9", null, 43.2],
    ["NL.IMBAG.Pand.0363100012082745", 1959, 3, 34, 93, "#3a2f2a", 1, 1, null, 1, 0, 0, "#5e6164", null],
    ["NL.IMBAG.Pand.0363100012083302", 1983, 3, 92, 132, "#6a6156", 1, 1, null, 1, 123, 132, "#5e6569", null, null, 24.9],
    ["NL.IMBAG.Pand.0363100012083695", 1927, 3, 35, 45, null, 1, 0, null, 1, 0, 0, "#676a6d", null],
    ["NL.IMBAG.Pand.0363100012083832", 1953, 3, 44, 0, null, 1, 1, "#effdfe", 1, 0, 0, "#6f7276", null, "17-28"],
    ["NL.IMBAG.Pand.0363100012084484", 1981, 3, 40, 0, "#5d413e", 1, 1, null, 1, 53, 89, "#515458", "#e8ebdb", null, 27.1],
    ["NL.IMBAG.Pand.0363100012085252", 1962, 3, 36, 127, null, 0, 2, null, 3, 88, 122, "#494b4f", "#dbe8eb", null, 29.5],
    ["NL.IMBAG.Pand.0363100012085366", 1969, 3, 39, 190, "#50433b", 1, 1, null, 1, 56, 84, "#636569", "#ddebeb", null, 42.1],
    ["NL.IMBAG.Pand.0363100012085435", 1999, 3, 76, 0, "#79746e", 1, 1, null, 1, 126, 141, "#5a585c", "#e0e5eb", "10-77,96-123", 28.7],
    ["NL.IMBAG.Pand.0363100012085618", 2009, 3, 94, 0, null, 1, 1, null, 1, 0, 0, "#6b6e6d", null, "48-73,88-107"],
    ["NL.IMBAG.Pand.0363100012086684", 1931, 3, 56, 149, "#49423b", 1, 1, null, 3, 73, 149, null, "#dae6eb", null, 53.2],
    ["NL.IMBAG.Pand.0363100012087388", 1931, 3, 100, 194, "#52483a", 0, 1, null, 3, 129, 194, "#5a5c64", null, null, 39.3],
    ["NL.IMBAG.Pand.0363100012087482", 1900, 3, 161, 203, "#655740", 1, 1, null, 2, 173, 204, "#51585c", "#e3ebeb", null, 27.9],
    ["NL.IMBAG.Pand.0363100012087825", 1912, 3, 162, 233, null, 1, 0, null, 3, 161, 210, "#5e6569", null, null, 36.5],
    ["NL.IMBAG.Pand.0363100012088135", 1958, 3, 39, 148, "#5e5450", 1, 3, null, 1, 45, 68, "#5a5c60", null, null, 21.5],
    ["NL.IMBAG.Pand.0363100012088641", 1927, 3, 51, 0, "#645850", 1, 1, null, 1, 0, 0, "#676e71", "#ebe7de"],
    ["NL.IMBAG.Pand.0363100012089044", 1955, 3, 46, 161, "#5d403b", 1, 1, null, 2, 120, 160, null, "#ebebeb", null, 19],
    ["NL.IMBAG.Pand.0363100012089331", 1984, 3, 21, 0, null, 1, 0, null, 1, 0, 0, "#515458", null],
    ["NL.IMBAG.Pand.0363100012089596", 1980, 3, 39, 0, null, 1, 0, null, 1, 40, 57, "#5e6164", null, null, 18.7],
    ["NL.IMBAG.Pand.0363100012089744", 1989, 3, 68, 113, "#6e675f", 1, 0, null, 1, 76, 97, "#636569", "#eaebe8", "12-32,40-62", 36.4],
    ["NL.IMBAG.Pand.0363100012090063", 1976, 3, 33, 0, "#463c36", 1, 1, null, 1, 93, 117, "#6b6e6d", "#ebeae9", null, 57.9],
    ["NL.IMBAG.Pand.0363100012090993", 1932, 3, 36, 0, null, 1, 0, null, 1, 14, 19, "#636169", null, null, 46.3],
    ["NL.IMBAG.Pand.0363100012091041", 1978, 3, 36, 91, null, 1, 0, null, 1, 0, 0, "#676e71", null],
    ["NL.IMBAG.Pand.0363100012091321", 1971, 3, 67, 127, "#4e4440", 1, 1, null, 1, 0, 0, "#676a69", "#ebeae7"],
    ["NL.IMBAG.Pand.0363100012091522", 1931, 3, 32, 0, "#5f4534", 1, 1, null, 1, 22, 33, "#56585c", "#ebe9e4", null, 48.8],
    ["NL.IMBAG.Pand.0363100012091856", 1956, 3, 84, 222, null, 1, 0, null, 1, 155, 164, "#515458", null, null, 17.6],
    ["NL.IMBAG.Pand.0363100012092742", 1932, 3, 41, 159, null, 1, 0, null, 3, 78, 146, "#636569", null, null, 35.7],
    ["NL.IMBAG.Pand.0363100012093296", 1987, 3, 35, 0, "#4c4640", 1, 1, null, 1, 0, 0, "#676a71", null],
    ["NL.IMBAG.Pand.0363100012093382", 1925, 3, 49, 0, "#716758", 1, 1, null, 1, 124, 153, "#636569", "#ebe9d5", null, 58.7],
    ["NL.IMBAG.Pand.0363100012093415", 1982, 3, 37, 65, "#695a55", 1, 1, null, 1, 85, 114, "#51545c", "#eaebe4", null, 34.2],
    ["NL.IMBAG.Pand.0363100012094306", 1971, 3, 38, 0, null, 1, 0, null, 1, 0, 0, "#636164", null],
    ["NL.IMBAG.Pand.0363100012094391", 1936, 3, 35, 201, "#544a42", 1, 1, "#f7fafe", 2, 98, 160, "#636a6d", "#e9ebe3", null, 42.5],
    ["NL.IMBAG.Pand.0363100012095378", 1930, 3, 59, 130, null, 1, 0, null, 3, 88, 130, "#515458", null, null, 38.3],
    ["NL.IMBAG.Pand.0363100012095474", 1986, 3, 35, 0, "#aca793", 1, 2, null, 1, 35, 52, "#5e6569", "#d9ebeb", "10-34,39-83,89-96", 52.7],
    ["NL.IMBAG.Pand.0363100012097084", 1914, 3, 32, 38, "#b9b090", 1, 2, "#cee0eb", 1, 136, 163, "#636a6d", null, "10-41,45-136", 61.9],
    ["NL.IMBAG.Pand.0363100012097095", 1982, 3, 74, 35, "#564941", 1, 1, null, 1, 0, 0, "#676e71", "#e8ebe8"],
    ["NL.IMBAG.Pand.0363100012097194", 1866, 3, 71, 112, "#baad92", 1, 3, null, 3, 70, 114, "#676a6d", null, null, 45.8],
    ["NL.IMBAG.Pand.0363100012097854", 1914, 3, 53, 207, "#7c6a54", 1, 2, null, 3, 95, 158, "#906c60", "#ebeadf", "10-38,63-86", 44.6],
    ["NL.IMBAG.Pand.0363100012097934", 1957, 3, 93, 114, null, 1, 2, "#aeb8bd", 1, 0, 0, "#6b6e71", "#dde7eb", "10-38,42-66,75-103"],
    ["NL.IMBAG.Pand.0363100012097989", 1931, 3, 34, 105, null, 1, 2, null, 3, 44, 105, "#4d4f53", null, null, 44.8],
    ["NL.IMBAG.Pand.0363100012098037", 1959, 3, 30, 0, "#483f39", 1, 0, null, 1, 0, 0, "#6f7276", "#dfe4eb"],
    ["NL.IMBAG.Pand.0363100012098124", 1969, 3, 35, 0, null, 1, 0, null, 1, 0, 0, "#5e6164", null],
    ["NL.IMBAG.Pand.0363100012098213", 1960, 3, 31, 0, "#5d564d", 1, 1, null, 1, 0, 0, "#5a5860", null],
    ["NL.IMBAG.Pand.0363100012098251", 1939, 3, 53, 192, "#544d4d", 1, 1, null, 3, 116, 192, "#6f777a", null, null, 34.6],
    ["NL.IMBAG.Pand.0363100012098714", 1931, 3, 45, 208, "#473b35", 1, 3, null, 3, 103, 208, "#5a5c64", "#e3e2eb", null, 53.8],
    ["NL.IMBAG.Pand.0363100012099552", 1966, 3, 39, 75, null, 1, 3, null, 1, 62, 75, null, null, null, 20.4],
    ["NL.IMBAG.Pand.0363100012100092", 2e3, 3, 180, 76, null, 1, 2, null, 1, 189, 197, "#56585c", null, "10-73,161-182", 17.1],
    ["NL.IMBAG.Pand.0363100012100220", 1975, 3, 39, 0, "#4b4742", 1, 1, null, 1, 0, 0, "#51545c", "#d9e4eb"],
    ["NL.IMBAG.Pand.0363100012100328", 1985, 2, 32, 0, "#706c62", 1, 3, null, 1, 0, 0, null, null, ""],
    ["NL.IMBAG.Pand.0363100012100351", 1912, 3, 161, 192, null, 1, 0, null, 2, 159, 192, "#6b7276", null, null, 44.4],
    ["NL.IMBAG.Pand.0363100012100376", 1930, 3, 126, 205, "#524742", 1, 1, null, 2, 136, 198, "#636569", "#eaebe9", null, 59],
    ["NL.IMBAG.Pand.0363100012101255", 2001, 3, 42, 0, null, 1, 3, null, 1, 0, 0, "#5a585c", null],
    ["NL.IMBAG.Pand.0363100012101375", 1988, 3, 29, 0, null, 1, 0, null, 1, 0, 0, "#5e6169", null],
    ["NL.IMBAG.Pand.0363100012101771", 1936, 3, 35, 275, null, 1, 0, null, 2, 96, 165, "#636569", null, null, 43.5],
    ["NL.IMBAG.Pand.0363100012102419", 1922, 3, 101, 0, "#65645a", 1, 2, null, 1, 0, 0, "#5e6164", "#e0ebea"],
    ["NL.IMBAG.Pand.0363100012102814", 1983, 3, 40, 169, "#544f48", 1, 1, null, 1, 49, 54, "#676a71", "#ebe5cf", null, 32.1],
    ["NL.IMBAG.Pand.0363100012102877", 1964, 3, 32, 0, "#5d4d45", 1, 1, null, 1, 0, 0, "#5e6569", "#eaebeb"],
    ["NL.IMBAG.Pand.0363100012103534", 1935, 3, 80, 242, null, 1, 0, null, 3, 145, 242, "#444b4f", null, null, 37.5],
    ["NL.IMBAG.Pand.0363100012104151", 1959, 1, 113, 0, null, 1, 0, null, 1, 0, 0, null, null],
    ["NL.IMBAG.Pand.0363100012104990", 1924, 3, 133, 0, null, 1, 0, null, 1, 0, 0, "#5a5c60", null],
    ["NL.IMBAG.Pand.0363100012105242", 1988, 3, 111, 120, "#746d68", 1, 1, null, 1, 111, 124, "#5e6164", "#cae5eb", "10-48,62-72", 21.2],
    ["NL.IMBAG.Pand.0363100012105310", 1972, 3, 48, 0, null, 1, 0, null, 1, 77, 94, "#636564", null, null, 41.5],
    ["NL.IMBAG.Pand.0363100012106094", 1981, 3, 38, 83, "#747067", 1, 1, null, 1, 39, 83, "#5e6164", null, null, 45.6],
    ["NL.IMBAG.Pand.0363100012108191", 1983, 3, 42, 0, "#6f6054", 1, 1, null, 1, 0, 0, "#676a6d", "#deebeb", "19-34,56-68"],
    ["NL.IMBAG.Pand.0363100012108564", 1935, 3, 85, 186, null, 1, 0, null, 3, 125, 186, "#5a5c64", null, null, 47.5],
    ["NL.IMBAG.Pand.0363100012108636", 1928, 3, 82, 132, "#4c433b", 1, 1, null, 3, 70, 132, "#7b564b", null, null, 41.2],
    ["NL.IMBAG.Pand.0363100012108972", 1921, 3, 40, 86, null, 1, 1, null, 1, 179, 196, "#565c60", "#cbeaeb", "13-29,33-39", 28.1],
    ["NL.IMBAG.Pand.0363100012109215", 1924, 3, 28, 158, "#494134", 1, 1, null, 1, 22, 38, "#565860", "#e3e7eb", null, 41.1],
    ["NL.IMBAG.Pand.0363100012109328", 1972, 3, 25, 96, null, 0, 0, null, 3, 42, 96, "#76808f", null, null, 44.7],
    ["NL.IMBAG.Pand.0363100012109431", 1985, 3, 37, 0, null, 1, 0, null, 1, 0, 0, "#676a6d", null],
    ["NL.IMBAG.Pand.0363100012110771", 1979, 3, 34, 89, "#67655d", 1, 1, null, 1, 72, 89, null, null, null, 43],
    ["NL.IMBAG.Pand.0363100012111095", 1992, 3, 33, 60, "#534e4a", 1, 1, null, 1, 0, 0, "#5e6164", null],
    ["NL.IMBAG.Pand.0363100012111133", 1929, 3, 25, 148, "#5f4c42", 1, 1, null, 3, 82, 148, null, "#e6ebea", null, 57.3],
    ["NL.IMBAG.Pand.0363100012112062", 1985, 3, 65, 0, "#7c7971", 1, 2, null, 1, 107, 133, "#5e6569", "#c9d5eb", "10-64,110-118", 44.3],
    ["NL.IMBAG.Pand.0363100012112226", 1983, 3, 77, 0, null, 1, 0, null, 1, 112, 133, "#676a6d", null, null, 36],
    ["NL.IMBAG.Pand.0363100012112291", 1968, 3, 34, 0, null, 1, 0, null, 1, 0, 0, "#56585c", null],
    ["NL.IMBAG.Pand.0363100012112357", 1955, 3, 36, 97, "#705c4c", 1, 1, null, 3, 61, 80, "#636a6d", "#ebe7dc", null, 17.6],
    ["NL.IMBAG.Pand.0363100012112403", 1933, 3, 35, 119, "#62584e", 1, 1, "#f2f6f8", 3, 80, 119, "#636a6d", "#ebe6df", null, 30.4],
    ["NL.IMBAG.Pand.0363100012113048", 1937, 3, 36, 190, null, 1, 0, null, 2, 111, 190, null, null, null, 50.3],
    ["NL.IMBAG.Pand.0363100012113669", 1921, 3, 60, 83, "#5b5049", 1, 1, null, 1, 55, 84, "#676a6d", null, null, 29.5],
    ["NL.IMBAG.Pand.0363100012115235", 2004, 3, 47, 96, "#807a75", 1, 2, null, 1, 55, 83, "#6f7276", "#ebe8e5", "10-43,52-92,117-127,145-156,181-187,208-215,234-244,250-272", 45.9],
    ["NL.IMBAG.Pand.0363100012115402", 1933, 3, 45, 79, "#473d39", 1, 1, null, 1, 43, 116, "#5e6164", "#e9ebea", null, 58],
    ["NL.IMBAG.Pand.0363100012115532", 1994, 3, 39, 0, null, 1, 2, null, 1, 39, 62, "#5a5c60", null, "10-102", 47.4],
    ["NL.IMBAG.Pand.0363100012116143", 1983, 3, 30, 61, "#40383d", 1, 1, null, 1, 40, 72, "#56585c", null, null, 43],
    ["NL.IMBAG.Pand.0363100012116155", 1967, 3, 70, 0, "#4c4439", 1, 1, null, 1, 0, 0, "#5a5c60", null],
    ["NL.IMBAG.Pand.0363100012116483", 1978, 3, 37, 0, "#6b5c4a", 1, 0, null, 1, 0, 0, "#5e6569", "#ebeae3"],
    ["NL.IMBAG.Pand.0363100012116722", 1955, 3, 31, 79, "#4e3e39", 1, 1, null, 3, 31, 77, "#40434b", null, null, 44.6],
    ["NL.IMBAG.Pand.0363100012116795", 1992, 3, 65, 72, null, 1, 1, null, 1, 0, 0, "#636569", null],
    ["NL.IMBAG.Pand.0363100012117108", 1913, 3, 32, 0, "#fcf3d1", 1, 1, null, 1, 28, 35, "#5a5c60", null, "10-56,66-89,96-104,115-155", 20.8],
    ["NL.IMBAG.Pand.0363100012117241", 1914, 3, 29, 120, "#524d46", 1, 1, "#f0fafb", 3, 65, 120, "#4d4f58", "#bbd9eb", null, 35.6],
    ["NL.IMBAG.Pand.0363100012117415", 1976, 3, 31, 0, "#6d5b48", 1, 0, null, 1, 0, 0, "#8e8b89", "#eaebdd", "10-41,46-62"],
    ["NL.IMBAG.Pand.0363100012117753", 1980, 3, 45, 104, "#60584c", 1, 1, null, 1, 83, 99, "#56585c", "#e9ebe7", null, 39.5],
    ["NL.IMBAG.Pand.0363100012117919", 1927, 3, 47, 236, "#453d38", 1, 1, null, 2, 85, 212, "#56545c", "#c5deeb", null, 44.8],
    ["NL.IMBAG.Pand.0363100012117953", 1991, 3, 108, 0, null, 1, 0, null, 1, 0, 0, "#676a6d", null],
    ["NL.IMBAG.Pand.0363100012118525", 1927, 3, 49, 0, "#776965", 1, 1, "#babec4", 1, 0, 0, "#676e71", "#ebe9ea", ""],
    ["NL.IMBAG.Pand.0363100012118764", 1973, 3, 106, 0, null, 1, 0, null, 1, 125, 126, "#5a5c60", null, null, 15.7],
    ["NL.IMBAG.Pand.0363100012119483", 1968, 1, 38, 0, null, 1, 0, null, 1, 0, 0, null, null],
    ["NL.IMBAG.Pand.0363100012119680", 1911, 3, 43, 227, "#8a6c63", 1, 1, null, 3, 157, 227, "#636569", null, "11-35,115-125,174-198", 42.1],
    ["NL.IMBAG.Pand.0363100012120748", 1971, 3, 30, 117, null, 1, 0, null, 2, 62, 121, "#56585c", null, null, 31.5],
    ["NL.IMBAG.Pand.0363100012120896", 1928, 3, 41, 242, "#6e6158", 1, 2, null, 3, 100, 163, "#8c6358", "#deebe4", null, 41.6],
    ["NL.IMBAG.Pand.0363100012120986", 1888, 3, 63, 193, "#5b524e", 1, 2, null, 3, 104, 192, "#6b6e71", "#c6dfeb", null, 53.8],
    ["NL.IMBAG.Pand.0363100012121569", 1931, 3, 26, 190, "#544e45", 1, 2, null, 3, 112, 190, "#8c6358", "#ebebeb", null, 50],
    ["NL.IMBAG.Pand.0363100012122517", 1964, 3, 32, 96, "#43403a", 1, 1, null, 3, 64, 96, "#5a5c60", null, null, 30.2],
    ["NL.IMBAG.Pand.0363100012122803", 1954, 3, 77, 175, "#7d6d57", 1, 1, null, 2, 90, 108, "#676a6d", "#ebeae1", "10-35,43-63,85-92", 18.5],
    ["NL.IMBAG.Pand.0363100012123040", 1939, 3, 95, 153, null, 1, 0, null, 3, 103, 139, "#5a585c", null, null, 30],
    ["NL.IMBAG.Pand.0363100012123194", 1967, 3, 37, 109, "#958681", 1, 2, null, 2, 87, 109, "#676e71", "#cee4eb", "10-21,25-45,69-79", 15.9],
    ["NL.IMBAG.Pand.0363100012123240", 2001, 3, 112, 193, "#6e6a66", 1, 2, "#f6f8fa", 1, 176, 187, "#5e6164", "#e8eaeb", "10-72,100-123", 25.7],
    ["NL.IMBAG.Pand.0363100012124248", 1968, 3, 32, 0, "#4d4238", 1, 3, null, 1, 0, 0, "#515858", "#ebd7bb"],
    ["NL.IMBAG.Pand.0363100012124586", 1965, 3, 37, 131, "#a18058", 1, 3, null, 1, 79, 131, "#5a6164", null, null, 56.5],
    ["NL.IMBAG.Pand.0363100012125533", 1984, 3, 93, 179, null, 1, 3, null, 1, 141, 179, "#5a5c60", null, null, 46],
    ["NL.IMBAG.Pand.0363100012125752", 1975, 3, 37, 44, null, 1, 0, null, 1, 0, 0, "#56585c", null],
    ["NL.IMBAG.Pand.0363100012126000", 1985, 3, 35, 0, null, 1, 0, null, 1, 0, 0, "#676a69", null],
    ["NL.IMBAG.Pand.0363100012126767", 1960, 3, 97, 165, "#4e4a43", 1, 0, null, 1, 0, 0, "#56585c", "#d2deeb", "10-30,80-152"],
    ["NL.IMBAG.Pand.0363100012126872", 1976, 3, 36, 37, null, 1, 0, null, 1, 0, 0, "#5e6164", null],
    ["NL.IMBAG.Pand.0363100012127997", 1924, 3, 115, 0, "#fdfae0", 1, 2, null, 1, 162, 168, "#5e6164", null, "10-57,70-99,115-129,137-143", 31.2],
    ["NL.IMBAG.Pand.0363100012128730", 1991, 3, 33, 0, "#5b504c", 1, 1, null, 1, 78, 93, "#565c60", null, null, 23.2],
    ["NL.IMBAG.Pand.0363100012128901", 1990, 3, 72, 0, null, 1, 2, null, 1, 0, 0, "#5a5c60", null],
    ["NL.IMBAG.Pand.0363100012128930", 1974, 3, 37, 0, "#4b4840", 1, 1, null, 1, 0, 0, "#636569", null],
    ["NL.IMBAG.Pand.0363100012129398", 1957, 3, 94, 160, "#9a9189", 1, 2, "#f4f3f4", 1, 106, 115, "#5a6164", null, "10-104", 23.8],
    ["NL.IMBAG.Pand.0363100012129592", 1953, 3, 48, 0, "#958a77", 1, 3, null, 1, 182, 193, "#6b6e71", null, null, 57.2],
    ["NL.IMBAG.Pand.0363100012130941", 1955, 3, 73, 0, "#423731", 1, 1, null, 1, 68, 106, "#676a69", "#e7e9eb", null, 58.3],
    ["NL.IMBAG.Pand.0363100012131629", 1988, 3, 31, 92, null, 1, 0, null, 3, 56, 75, "#5a5c60", null, null, 17.6],
    ["NL.IMBAG.Pand.0363100012132628", 1957, 3, 32, 95, null, 1, 0, null, 3, 58, 77, "#676a71", null, null, 17.8],
    ["NL.IMBAG.Pand.0363100012132809", 1923, 3, 41, 205, "#3e3933", 1, 3, null, 3, 80, 205, "#885f4f", null, null, 46],
    ["NL.IMBAG.Pand.0363100012133077", 1990, 3, 87, 0, "#837d74", 1, 2, null, 1, 105, 116, "#5a5c64", "#e5e9eb", "10-66,79-99,110-142", 33.1],
    ["NL.IMBAG.Pand.0363100012133123", 1985, 3, 39, 54, null, 1, 0, null, 1, 40, 54, "#5a5c60", null, null, 30.2],
    ["NL.IMBAG.Pand.0363100012133297", 1935, 3, 55, 168, "#483f3a", 0, 1, null, 3, 105, 168, "#845a4f", null, null, 43],
    ["NL.IMBAG.Pand.0363100012134381", 1924, 3, 116, 188, null, 1, 2, "#edeff2", 1, 0, 0, "#565c60", "#cde6eb", "24-51,74-99,144-158"],
    ["NL.IMBAG.Pand.0363100012134386", 1969, 1, 45, 0, "#787774", 1, 2, null, 1, 0, 0, null, null, "31-46"],
    ["NL.IMBAG.Pand.0363100012134530", 1977, 2, 43, 0, null, 1, 0, null, 1, 0, 0, null, null],
    ["NL.IMBAG.Pand.0363100012134770", 1986, 3, 88, 0, "#67645b", 1, 0, null, 1, 0, 0, "#636a6d", null, "10-87"],
    ["NL.IMBAG.Pand.0363100012135926", 1937, 3, 67, 159, "#50473e", 1, 1, "#fbfefe", 3, 109, 158, "#51545c", "#cce7eb", "41-122", 30.1],
    ["NL.IMBAG.Pand.0363100012136224", 1992, 3, 55, 146, "#88584a", 1, 1, null, 1, 81, 95, "#40434b", "#deeaeb", "10-81,97-106", 37.1],
    ["NL.IMBAG.Pand.0363100012137097", 1914, 3, 33, 45, "#453f3b", 1, 3, null, 2, 41, 70, "#5e6164", null, null, 34.6],
    ["NL.IMBAG.Pand.0363100012137219", 1956, 3, 29, 90, "#48463e", 1, 2, null, 3, 61, 90, "#444b4f", "#d2ebeb", null, 17.6],
    ["NL.IMBAG.Pand.0363100012137446", 1960, 3, 44, 95, "#63574d", 1, 2, null, 3, 58, 83, "#56585c", "#e8ebe9", null, 17.8],
    ["NL.IMBAG.Pand.0363100012137724", 1956, 3, 27, 88, "#615039", 1, 1, null, 3, 62, 89, "#5a5c60", "#ebe7e0", null, 17.6],
    ["NL.IMBAG.Pand.0363100012137751", 1952, 3, 45, 119, null, 1, 0, null, 3, 73, 119, "#676569", null, null, 31.3],
    ["NL.IMBAG.Pand.0363100012137946", 1861, 3, 50, 145, "#4e4648", 1, 1, "#f5fcfd", 3, 95, 148, "#676569", null, null, 37.8],
    ["NL.IMBAG.Pand.0363100012138092", 1954, 3, 76, 134, null, 1, 0, null, 3, 108, 134, "#5a585c", null, null, 18.8],
    ["NL.IMBAG.Pand.0363100012139793", 1992, 3, 35, 0, "#685949", 1, 1, null, 1, 36, 54, "#5a5c60", "#ebe8dc", null, 42.2],
    ["NL.IMBAG.Pand.0363100012140916", 1892, 3, 42, 163, "#675652", 1, 1, null, 2, 95, 163, "#56585c", "#e5ebea", null, 57.6],
    ["NL.IMBAG.Pand.0363100012142124", 1978, 3, 33, 0, "#7e6e64", 1, 2, null, 1, 0, 0, "#636a69", null, "13-26,41-66"],
    ["NL.IMBAG.Pand.0363100012142532", 1896, 3, 37, 131, "#60544f", 1, 1, "#eae4e7", 2, 103, 131, "#5e6164", "#e6eaeb", null, 40.7],
    ["NL.IMBAG.Pand.0363100012143192", 1965, 2, 70, 0, "#945142", 1, 1, null, 1, 0, 0, null, "#eaebdf"],
    ["NL.IMBAG.Pand.0363100012143236", 1956, 3, 34, 130, "#3a3020", 1, 3, null, 1, 67, 93, "#636569", null, null, 20.1],
    ["NL.IMBAG.Pand.0363100012143384", 1962, 3, 70, 0, "#817e78", 1, 2, null, 1, 74, 79, "#6f7276", null, "18-43,55-67,71-78,107-114", 17.9],
    ["NL.IMBAG.Pand.0363100012143434", 1988, 3, 32, 0, "#56524e", 1, 2, null, 1, 31, 76, "#56585c", null, null, 44.6],
    ["NL.IMBAG.Pand.0363100012143602", 1956, 3, 28, 89, "#4d4740", 1, 1, null, 3, 62, 89, "#565c60", "#e8ebe9", null, 17.4],
    ["NL.IMBAG.Pand.0363100012143874", 1980, 3, 38, 82, null, 1, 0, null, 1, 40, 81, "#5e6569", null, null, 44.7],
    ["NL.IMBAG.Pand.0363100012143944", 1973, 3, 70, 0, "#5e5b52", 1, 1, null, 1, 0, 0, "#6b6e71", null],
    ["NL.IMBAG.Pand.0363100012144206", 1849, 3, 82, 119, null, 1, 0, null, 3, 81, 119, "#636164", null, null, 32.3],
    ["NL.IMBAG.Pand.0363100012144879", 1964, 3, 95, 0, "#666058", 1, 1, null, 1, 29, 61, "#6f6e71", "#e2e7eb", null, 38.7],
    ["NL.IMBAG.Pand.0363100012145699", 1927, 3, 49, 107, "#634c3f", 1, 1, null, 1, 0, 0, "#5a5c60", "#dce6eb"],
    ["NL.IMBAG.Pand.0363100012146056", 1967, 3, 35, 82, null, 1, 3, null, 1, 0, 0, "#565c60", null, ""],
    ["NL.IMBAG.Pand.0363100012147735", 1987, 3, 32, 0, "#5e544d", 1, 0, null, 1, 0, 0, "#515458", "#d6d8eb"],
    ["NL.IMBAG.Pand.0363100012148474", 1987, 3, 53, 0, null, 1, 0, null, 1, 0, 0, "#5e5c60", null],
    ["NL.IMBAG.Pand.0363100012148521", 1927, 3, 27, 0, "#54443c", 1, 1, null, 1, 0, 0, "#5a5c60", "#c9e5eb"],
    ["NL.IMBAG.Pand.0363100012148715", 1961, 3, 140, 0, "#655949", 1, 0, null, 1, 0, 0, "#636a6d", null, "17-24,70-92,112-120,145-156"],
    ["NL.IMBAG.Pand.0363100012148948", 1992, 3, 35, 0, "#483b2e", 1, 1, null, 1, 0, 0, "#5e6169", null],
    ["NL.IMBAG.Pand.0363100012149675", 1993, 3, 40, 0, "#6f5c53", 1, 2, null, 1, 0, 0, "#5e6569", "#ebe5df"],
    ["NL.IMBAG.Pand.0363100012149878", 1920, 3, 129, 183, "#413830", 1, 1, null, 1, 0, 0, "#4d4f53", "#dfe8eb"],
    ["NL.IMBAG.Pand.0363100012150241", 1985, 2, 38, 0, "#645f5d", 1, 1, null, 1, 0, 0, null, null],
    ["NL.IMBAG.Pand.0363100012151320", 1980, 3, 35, 50, "#4b443d", 1, 1, null, 1, 47, 64, "#676a6d", "#ebebdf", null, 27.5],
    ["NL.IMBAG.Pand.0363100012152606", 1909, 3, 101, 110, "#4d423c", 1, 1, null, 1, 0, 0, "#636564", null],
    ["NL.IMBAG.Pand.0363100012152781", 1917, 3, 81, 0, "#5a4e46", 1, 1, null, 1, 0, 0, "#636569", "#ebeadb"],
    ["NL.IMBAG.Pand.0363100012153991", 2003, 3, 31, 0, "#ac8e76", 1, 1, null, 1, 32, 51, "#515458", null, "10-30", 41.3],
    ["NL.IMBAG.Pand.0363100012154481", 1984, 3, 36, 0, "#6c6961", 1, 0, null, 1, 3, 5, "#5a5c60", null, "10-35", 23.3],
    ["NL.IMBAG.Pand.0363100012154521", 1987, 3, 32, 210, null, 1, 0, null, 3, 76, 127, "#636569", null, null, 40.3],
    ["NL.IMBAG.Pand.0363100012154937", 1994, 3, 28, 0, "#745042", 1, 2, null, 1, 0, 0, null, null],
    ["NL.IMBAG.Pand.0363100012155572", 1994, 3, 68, 0, "#594e4a", 1, 1, null, 1, 110, 136, "#5a5c64", "#dfe5eb", null, 40.7],
    ["NL.IMBAG.Pand.0363100012155611", 1904, 3, 156, 234, null, 1, 0, null, 3, 171, 218, "#4d5458", null, null, 50.2],
    ["NL.IMBAG.Pand.0363100012155663", 2010, 3, 32, 136, null, 1, 0, null, 3, 61, 101, "#56585c", null, null, 38.4],
    ["NL.IMBAG.Pand.0363100012155763", 1888, 3, 84, 159, "#4d413a", 1, 0, null, 3, 108, 159, "#4d4f58", "#ebe7d9", null, 49.9],
    ["NL.IMBAG.Pand.0363100012156533", 1925, 3, 58, 205, "#625750", 1, 0, null, 1, 60, 133, "#636569", "#e4ebe4", "10-145,149-159", 67.3],
    ["NL.IMBAG.Pand.0363100012156882", 1930, 3, 38, 74, null, 1, 2, "#c5c5c8", 1, 0, 0, "#5a5c64", null, "10-70,96-124"],
    ["NL.IMBAG.Pand.0363100012157107", 1929, 3, 34, 151, null, 1, 0, null, 3, 42, 151, "#494b4f", null, null, 52.5],
    ["NL.IMBAG.Pand.0363100012158248", 1929, 3, 31, 159, null, 1, 0, null, 3, 47, 159, "#51585c", null, null, 51.8],
    ["NL.IMBAG.Pand.0363100012158405", 1925, 3, 50, 197, "#5c5651", 1, 0, null, 2, 147, 193, "#51585c", null, null, 40],
    ["NL.IMBAG.Pand.0363100012158651", 1921, 3, 133, 158, "#433c36", 1, 1, null, 1, 0, 0, "#5e6164", null],
    ["NL.IMBAG.Pand.0363100012160100", 1890, 3, 62, 148, null, 1, 0, null, 2, 69, 149, "#676a6d", null, null, 51],
    ["NL.IMBAG.Pand.0363100012160472", 1609, 3, 84, 178, null, 1, 0, null, 3, 64, 178, "#444b4f", null, null, 53.9],
    ["NL.IMBAG.Pand.0363100012161518", 1894, 3, 80, 137, "#3e3632", 1, 1, null, 3, 74, 137, "#676e76", "#e4e9eb", null, 46.7],
    ["NL.IMBAG.Pand.0363100012161733", 1975, 3, 41, 144, "#5c564f", 1, 3, null, 3, 73, 144, "#444b4f", "#eaebe5", null, 52.4],
    ["NL.IMBAG.Pand.0363100012162454", 1927, 3, 59, 132, null, 1, 0, null, 3, 56, 132, "#40474b", null, null, 52.6],
    ["NL.IMBAG.Pand.0363100012162810", 1924, 3, 40, 76, "#5b504c", 1, 1, null, 3, 56, 76, "#636569", "#ebe8e2", null, 30.5],
    ["NL.IMBAG.Pand.0363100012163070", 1986, 2, 35, 0, null, 1, 0, null, 1, 0, 0, null, null],
    ["NL.IMBAG.Pand.0363100012163079", 1934, 3, 35, 173, "#5f5046", 1, 1, null, 1, 90, 173, "#636164", "#ebe1cf", null, 53.8],
    ["NL.IMBAG.Pand.0363100012163104", 1899, 3, 98, 152, "#68584e", 1, 1, null, 3, 104, 145, "#5a5c64", "#e9ebe8", null, 41.6],
    ["NL.IMBAG.Pand.0363100012163298", 1850, 3, 75, 0, null, 1, 0, null, 3, 60, 116, "#51545c", null, null, 50.5],
    ["NL.IMBAG.Pand.0363100012163469", 1939, 3, 42, 118, null, 1, 0, null, 3, 47, 118, "#56585c", null, null, 27.5],
    ["NL.IMBAG.Pand.0363100012163664", 1911, 2, 87, 0, null, 1, 0, null, 1, 0, 0, null, null],
    ["NL.IMBAG.Pand.0363100012163802", 1935, 3, 81, 0, "#81766b", 1, 1, null, 1, 122, 132, "#565c60", null, null, 33],
    ["NL.IMBAG.Pand.0363100012164511", 1929, 3, 41, 192, "#5d4b47", 1, 1, null, 3, 57, 192, "#44474b", "#ebeae9", null, 53.2],
    ["NL.IMBAG.Pand.0363100012164683", 1905, 3, 117, 196, null, 1, 2, null, 2, 152, 197, "#565860", null, "10-121", 47.5],
    ["NL.IMBAG.Pand.0363100012164714", 1888, 3, 59, 182, "#4d443d", 1, 2, null, 2, 147, 194, "#5a5c64", "#ebeae9", null, 54.4],
    ["NL.IMBAG.Pand.0363100012164850", 1903, 3, 139, 198, "#736062", 1, 1, null, 3, 159, 197, "#5e6164", "#e1eaeb", "68-94,113-132,153-181", 47.4],
    ["NL.IMBAG.Pand.0363100012164940", 1992, 3, 32, 0, null, 1, 0, null, 1, 0, 0, "#676e71", null],
    ["NL.IMBAG.Pand.0363100012165085", 1633, 3, 108, 219, null, 1, 0, null, 3, 116, 189, "#5a6164", null, null, 57],
    ["NL.IMBAG.Pand.0363100012165625", 1921, 3, 52, 161, "#605550", 1, 1, null, 1, 135, 161, "#56585c", "#dfebe8", null, 43.7],
    ["NL.IMBAG.Pand.0363100012165936", 1901, 3, 71, 181, null, 1, 0, null, 3, 83, 181, "#6b727a", null, null, 45.9],
    ["NL.IMBAG.Pand.0363100012166358", 1914, 3, 68, 215, null, 1, 0, null, 3, 167, 214, "#565458", null, null, 31.2],
    ["NL.IMBAG.Pand.0363100012167089", 1933, 3, 37, 94, null, 1, 2, null, 3, 63, 94, "#404746", "#afe2eb", null, 34],
    ["NL.IMBAG.Pand.0363100012167253", 1929, 3, 73, 157, "#503a33", 1, 1, null, 3, 104, 157, "#636569", "#ebe6d2", null, 35.7],
    ["NL.IMBAG.Pand.0363100012167313", 1892, 3, 101, 169, "#675a4f", 1, 1, null, 3, 116, 169, "#636569", "#eaebe7", null, 50.7],
    ["NL.IMBAG.Pand.0363100012167695", 1630, 3, 31, 167, "#7d6554", 1, 2, null, 3, 118, 148, null, "#ebe7dd", "18-58,62-133", 47.2],
    ["NL.IMBAG.Pand.0363100012167890", 1894, 3, 39, 94, "#827266", 1, 1, null, 2, 62, 85, "#4d4f53", "#ebe7da", "10-70", 39.9],
    ["NL.IMBAG.Pand.0363100012168060", 1671, 3, 86, 158, "#70543c", 1, 2, "#f6fbfc", 3, 109, 148, "#676a6d", null, null, 54.6],
    ["NL.IMBAG.Pand.0363100012168139", 1968, 3, 41, 151, null, 1, 0, null, 2, 128, 151, "#636569", null, null, 31.3],
    ["NL.IMBAG.Pand.0363100012168141", 1665, 3, 34, 155, null, 1, 1, null, 3, 67, 150, "#636160", null, null, 47.1],
    ["NL.IMBAG.Pand.0363100012168547", 1905, 3, 85, 173, "#5b4e48", 1, 1, null, 3, 88, 128, "#636569", "#e5ebe8", null, 50.6],
    ["NL.IMBAG.Pand.0363100012168684", 1936, 3, 33, 179, "#524642", 1, 2, null, 2, 121, 179, "#63656d", "#dae2eb", null, 45.2],
    ["NL.IMBAG.Pand.0363100012168735", 1905, 3, 39, 231, "#6a554d", 1, 1, null, 2, 101, 160, "#5e5c64", "#ebe2dd", null, 47.3],
    ["NL.IMBAG.Pand.0363100012168811", 1874, 3, 30, 162, "#5c5852", 1, 1, null, 3, 121, 157, "#565860", "#e7ebe7", null, 32.7],
    ["NL.IMBAG.Pand.0363100012169397", 1912, 3, 28, 204, "#3c3431", 1, 3, "#f6ede5", 2, 126, 204, "#636569", "#ebe7dd", null, 51.7],
    ["NL.IMBAG.Pand.0363100012169564", 1866, 3, 212, 221, "#70645e", 1, 0, null, 1, 224, 243, "#5e6160", "#e6ebe1", "10-50,71-89,114-125,172-197,214-222", 28.4],
    ["NL.IMBAG.Pand.0363100012169565", 1885, 3, 193, 218, null, 1, 2, null, 3, 189, 222, "#6f777f", null, "10-16,27-59,72-209", 25.1],
    ["NL.IMBAG.Pand.0363100012169852", 1894, 3, 63, 202, "#594d40", 1, 1, "#e3e4e6", 2, 111, 156, "#565860", null, null, 28.1],
    ["NL.IMBAG.Pand.0363100012169888", 1993, 1, 114, 0, null, 1, 0, null, 1, 0, 0, null, null],
    ["NL.IMBAG.Pand.0363100012170167", 1892, 3, 80, 0, "#5c534d", 1, 1, null, 1, 0, 0, "#56585c", "#e5e7eb"],
    ["NL.IMBAG.Pand.0363100012170259", 1999, 3, 148, 170, null, 1, 0, null, 1, 0, 0, "#5e6164", null],
    ["NL.IMBAG.Pand.0363100012170328", 1982, 3, 38, 0, "#736f69", 1, 0, null, 1, 0, 0, "#5a6164", null, "10-41"],
    ["NL.IMBAG.Pand.0363100012170573", 1994, 3, 65, 118, "#5b4f45", 1, 1, null, 3, 72, 93, "#5e6164", null, null, 17.9],
    ["NL.IMBAG.Pand.0363100012171200", 1793, 3, 147, 204, "#4a413d", 1, 3, null, 3, 145, 184, "#676a6d", "#ebe8e6", null, 45.4],
    ["NL.IMBAG.Pand.0363100012171741", 1639, 3, 37, 171, null, 1, 0, null, 2, 98, 173, "#5e6164", null, null, 45.4],
    ["NL.IMBAG.Pand.0363100012171760", 1988, 3, 87, 0, null, 1, 0, null, 1, 109, 129, "#5a6164", null, null, 42.1],
    ["NL.IMBAG.Pand.0363100012171989", 1969, 3, 42, 0, "#332e2f", 1, 1, null, 1, 85, 92, "#40434b", "#e4e9eb", "12-138", 25.1],
    ["NL.IMBAG.Pand.0363100012172090", 1905, 3, 64, 103, null, 1, 0, null, 1, 133, 140, "#5e6164", null, null, 46.6],
    ["NL.IMBAG.Pand.0363100012172975", 1988, 3, 73, 119, null, 1, 0, null, 2, 107, 119, "#56585c", null, null, 28.9],
    ["NL.IMBAG.Pand.0363100012173113", 1890, 3, 104, 0, "#56453f", 1, 1, null, 1, 0, 0, "#6b6e71", "#d6e1eb"],
    ["NL.IMBAG.Pand.0363100012174390", 1935, 3, 148, 222, "#d7cdb0", 1, 2, "#f9fefe", 1, 153, 241, "#5e6160", null, "10-43,119-141,153-174", 49.5],
    ["NL.IMBAG.Pand.0363100012176840", 1907, 3, 85, 0, null, 1, 0, null, 1, 0, 0, "#44474b", null],
    ["NL.IMBAG.Pand.0363100012177272", 1888, 3, 150, 229, "#655a54", 1, 1, null, 2, 155, 218, "#565c64", "#e9eaeb", null, 51.5],
    ["NL.IMBAG.Pand.0363100012177887", 1440, 3, 36, 174, "#413d3a", 1, 1, null, 3, 86, 173, "#5a5c64", null, null, 61.3],
    ["NL.IMBAG.Pand.0363100012177921", 2e3, 3, 56, 141, "#997a56", 1, 2, "#f2f3f2", 3, 114, 134, "#956c54", null, "10-63,74-116", 31.5],
    ["NL.IMBAG.Pand.0363100012179330", 1856, 3, 156, 215, null, 1, 0, null, 3, 155, 194, "#677276", null, null, 27.3],
    ["NL.IMBAG.Pand.0363100012179384", 2001, 3, 30, 214, null, 1, 1, null, 1, 150, 174, "#5e6569", "#e8ebd1", null, 32.5],
    ["NL.IMBAG.Pand.0363100012180211", 1470, 3, 96, 165, "#6b5d50", 1, 1, null, 3, 74, 169, "#565c60", null, null, 56.4],
    ["NL.IMBAG.Pand.0363100012180412", 1632, 3, 75, 153, "#9a7873", 1, 1, null, 1, 143, 159, "#6f6e71", "#dfe2eb", "34-41,45-51,69-112,142-157", 56.7],
    ["NL.IMBAG.Pand.0363100012180757", 1898, 3, 96, 143, "#4f4d47", 1, 1, null, 2, 108, 143, "#636a6d", "#e9ebdd", null, 39.1],
    ["NL.IMBAG.Pand.0363100012180835", 1882, 3, 94, 155, "#965758", 1, 2, null, 2, 94, 146, "#6f777f", "#ebebe0", null, 49.1],
    ["NL.IMBAG.Pand.0363100012181889", 1766, 3, 115, 170, null, 1, 0, null, 2, 111, 141, "#838d92", null, null, 58.5],
    ["NL.IMBAG.Pand.0363100012182486", 1990, 3, 142, 213, "#918e85", 1, 2, null, 1, 198, 214, null, "#e3ebeb", "10-52,67-206", 15.4],
    ["NL.IMBAG.Pand.0363100012183194", 1911, 3, 86, 0, null, 1, 0, null, 1, 86, 102, "#565c60", null, null, 59.9],
    ["NL.IMBAG.Pand.0363100012185844", 1996, 3, 205, 279, "#58453d", 1, 1, null, 2, 226, 273, "#6f777f", "#e0e9eb", null, 24.8],
    ["NL.IMBAG.Pand.0363100012186868", 1986, 3, 76, 0, "#8f8781", 1, 0, null, 1, 0, 0, "#56585c", null, "80-99"],
    ["NL.IMBAG.Pand.0363100012191081", 1973, 2, 80, 0, null, 1, 0, null, 1, 0, 0, null, null],
    ["NL.IMBAG.Pand.0363100012208081", 1921, 3, 71, 178, "#766760", 1, 2, null, 3, 57, 178, null, "#e7ebe5", null, 60.3],
    ["NL.IMBAG.Pand.0363100012208464", 1960, 3, 73, 85, "#524038", 1, 1, null, 1, 0, 0, "#56585c", null],
    ["NL.IMBAG.Pand.0363100012212122", 1925, 3, 31, 0, null, 1, 0, null, 1, 14, 28, "#5e5c5c", null, null, 19.3],
    ["NL.IMBAG.Pand.0363100012233517", 1924, 3, 35, 42, "#3f393a", 1, 1, null, 1, 33, 74, "#5e5c60", null, null, 15.8],
    ["NL.IMBAG.Pand.0363100012233557", 1990, 3, 23, 169, "#777064", 1, 1, null, 1, 154, 181, "#787b7f", "#e2e9eb", "10-43,63-79,91-110,118-174", 37.9],
    ["NL.IMBAG.Pand.0363100012233590", 1892, 3, 40, 165, "#847465", 1, 2, null, 2, 108, 165, "#56585c", "#ebe4e1", "20-57,70-82,106-149", 52],
    ["NL.IMBAG.Pand.0363100012235970", 1899, 3, 42, 114, "#5d504b", 1, 1, null, 3, 58, 114, "#565860", "#dfeaeb", null, 39.8],
    ["NL.IMBAG.Pand.0363100012235989", 1885, 3, 62, 175, "#6b5857", 1, 2, null, 3, 87, 175, "#5e6164", "#e2ebeb", "10-133", 39.9],
    ["NL.IMBAG.Pand.0363100012236544", 1896, 3, 31, 209, "#413c39", 1, 1, null, 1, 161, 188, "#4d4f53", "#e2ebeb", null, 41.7],
    ["NL.IMBAG.Pand.0363100012236586", 1899, 3, 56, 181, null, 1, 2, null, 1, 0, 0, "#5a6164", "#ebeae8", "12-55,67-104,137-157"],
    ["NL.IMBAG.Pand.0363100012236656", 1890, 3, 76, 208, "#68655a", 1, 1, "#ebf4f5", 1, 135, 159, "#676e71", null, null, 20.5],
    ["NL.IMBAG.Pand.0363100012236816", 1916, 3, 133, 0, "#81695c", 1, 0, null, 1, 0, 0, "#5a5c60", "#ebeae6", "10-44,53-116"],
    ["NL.IMBAG.Pand.0363100012236840", 1900, 3, 30, 199, "#64544d", 1, 2, null, 2, 155, 199, "#56585c", "#e6eaeb", null, 43.1],
    ["NL.IMBAG.Pand.0363100012236988", 1909, 3, 85, 147, "#63584f", 1, 1, null, 1, 102, 147, "#5e6164", "#e5e5eb", null, 49.4],
    ["NL.IMBAG.Pand.0363100012237030", 1896, 3, 38, 195, "#6d635a", 1, 1, null, 2, 102, 139, "#5e6164", "#ebe7dd", null, 42.2],
    ["NL.IMBAG.Pand.0363100012237077", 1928, 3, 79, 196, "#68594d", 1, 3, "#fcfeff", 2, 75, 101, "#565860", null, null, 26.6],
    ["NL.IMBAG.Pand.0363100012237203", 1912, 3, 151, 266, null, 1, 0, null, 3, 198, 239, "#5a6164", null, null, 44.7],
    ["NL.IMBAG.Pand.0363100012237290", 1904, 3, 27, 30, "#5e534c", 1, 1, null, 1, 127, 153, "#74777f", "#ebe8e8", null, 48.7],
    ["NL.IMBAG.Pand.0363100012237328", 1926, 3, 39, 253, "#706b66", 1, 1, null, 3, 89, 187, "#5a5c60", null, "10-61,115-137", 51.2],
    ["NL.IMBAG.Pand.0363100012237336", 1911, 3, 37, 0, null, 1, 0, null, 1, 34, 39, "#56585c", null, null, 16.2],
    ["NL.IMBAG.Pand.0363100012237810", 2012, 3, 41, 99, "#5a4d43", 1, 1, null, 1, 42, 51, "#6b6e6d", "#e0e8eb", null, 40.2],
    ["NL.IMBAG.Pand.0363100012238475", 2013, 3, 31, 164, "#4a3f38", 1, 2, null, 1, 105, 163, null, "#ebe9e2", null, 41],
    ["NL.IMBAG.Pand.0363100012239394", 2010, 2, 34, 0, null, 1, 0, null, 1, 0, 0, null, null],
    ["NL.IMBAG.Pand.0363100012240297", 2013, 3, 40, 101, "#878379", 1, 3, null, 1, 0, 0, "#868b8d", "#e1e7eb", ""],
    ["NL.IMBAG.Pand.0363100012240368", 2014, 3, 178, 0, "#61412e", 1, 2, null, 1, 259, 277, "#5e6160", "#dae6eb", null, 26.3],
    ["NL.IMBAG.Pand.0363100012241744", 2010, 3, 166, 0, null, 1, 0, null, 1, 0, 0, "#676e71", null],
    ["NL.IMBAG.Pand.0363100012241807", 2014, 3, 41, 0, null, 1, 0, null, 1, 94, 113, null, null, null, 37.7],
    ["NL.IMBAG.Pand.0363100012246190", 2018, 3, 78, 185, "#3a3031", 1, 1, null, 1, 157, 171, "#636160", "#ebebe5", null, 59.9],
    ["NL.IMBAG.Pand.0363100012246231", 1926, 3, 121, 0, "#585147", 1, 1, null, 3, 117, 162, "#63656d", null, null, 43.6],
    ["NL.IMBAG.Pand.0363100012249726", 2020, 3, 92, 252, null, 1, 2, null, 1, 0, 0, "#56585c", null, "12-218"],
    ["NL.IMBAG.Pand.0363100012253747", 1848, 3, 44, 189, null, 1, 0, null, 3, 143, 184, "#515458", null, null, 37.3],
    ["NL.IMBAG.Pand.0363100012254404", 2021, 3, 63, 31, null, 1, 0, null, 1, 0, 0, "#636569", null],
    ["NL.IMBAG.Pand.0363100012571556", 2010, 3, 157, 211, "#493e3c", 1, 1, null, 1, 187, 223, "#5e5c64", "#d4dbeb", null, 58.3],
    ["NL.IMBAG.Pand.0384100000004250", 1910, 3, 47, 165, null, 0, 0, null, 3, 80, 165, "#845a4f", null, null, 45.7],
    ["NL.IMBAG.Pand.0384100000004631", 1937, 3, 38, 163, null, 1, 0, null, 3, 49, 106, "#51545c", null, null, 45.6],
    ["NL.IMBAG.Pand.0384100000005587", 1960, 3, 36, 98, null, 1, 0, null, 3, 62, 99, "#6b6e71", null, null, 29.8],
    ["NL.IMBAG.Pand.0384100000005599", 1990, 3, 33, 65, null, 1, 0, null, 3, 34, 65, "#636164", null, null, 30.6],
    ["NL.IMBAG.Pand.0384100000005895", 1996, 3, 105, 0, null, 1, 0, null, 1, 0, 0, "#5e6164", null],
    ["NL.IMBAG.Pand.0384100000006041", 1981, 3, 33, 71, null, 1, 0, null, 2, 46, 71, "#5e6164", null, null, 31.9],
    ["NL.IMBAG.Pand.0393100000000125", 1994, 3, 34, 97, null, 1, 0, null, 3, 40, 70, null, null, null, 28.5],
    ["NL.IMBAG.Pand.0393100000000191", 1924, 3, 47, 184, null, 1, 0, null, 0, 0, 0, "#5a5c64", null],
    ["NL.IMBAG.Pand.0393100000000414", 1981, 3, 37, 0, null, 1, 0, null, 0, 0, 0, "#5e6569", null],
    ["NL.IMBAG.Pand.0394100000207281", 1955, 3, 33, 68, null, 1, 0, null, 3, 42, 68, "#565c60", null, null, 30.6],
    ["NL.IMBAG.Pand.0394100000208189", 1963, 3, 30, 84, null, 1, 0, null, 0, 0, 0, "#5e5c60", null],
    ["NL.IMBAG.Pand.0394100000208246", 1931, 3, 34, 90, null, 1, 0, null, 0, 0, 0, "#906358", null],
    ["NL.IMBAG.Pand.0394100000209235", 1950, 3, 34, 193, null, 1, 0, null, 0, 0, 0, "#565860", null],
    ["NL.IMBAG.Pand.0394100000209255", 1973, 2, 33, 0, null, 1, 0, null, 0, 0, 0, null, null],
    ["NL.IMBAG.Pand.0394100000209553", 1970, 3, 34, 0, null, 1, 0, null, 1, 0, 0, "#56585c", null],
    ["NL.IMBAG.Pand.0394100000209846", 1962, 3, 38, 77, null, 1, 0, null, 0, 0, 0, "#676e71", null],
    ["NL.IMBAG.Pand.0394100000209852", 1958, 3, 38, 198, null, 1, 0, null, 0, 0, 0, "#5e5c64", null],
    ["NL.IMBAG.Pand.0394100000217330", 1971, 2, 30, 0, null, 1, 0, null, 0, 0, 0, null, null],
    ["NL.IMBAG.Pand.0394100000226772", 1931, 3, 42, 118, null, 1, 0, null, 0, 0, 0, "#56585c", null],
    ["NL.IMBAG.Pand.0394100000242779", 1971, 3, 35, 50, null, 1, 0, null, 0, 0, 0, "#515458", null],
    ["NL.IMBAG.Pand.0394100000242783", 1971, 3, 34, 0, null, 1, 0, null, 0, 0, 0, "#515858", null],
    ["NL.IMBAG.Pand.0394100000258704", 1975, 3, 34, 0, null, 1, 0, null, 0, 0, 0, "#5e6564", null],
    ["NL.IMBAG.Pand.0394100001031599", 1929, 3, 41, 191, null, 1, 0, null, 0, 0, 0, "#8c6354", null],
    ["NL.IMBAG.Pand.0415100000002681", 1984, 3, 33, 47, "#58524c", 1, 1, null, 1, 39, 47, "#5e5c60", "#ebeade", null, 25.1],
    ["NL.IMBAG.Pand.0415100000002748", 1979, 3, 34, 69, "#6e6256", 1, 2, null, 3, 38, 65, "#5a5c60", null, null, 30.3],
    ["NL.IMBAG.Pand.0424100000001256", 1980, 3, 30, 63, null, 1, 0, null, 0, 0, 0, "#676a71", null],
    ["NL.IMBAG.Pand.0424100000004412", 1981, 3, 34, 0, null, 1, 0, null, 1, 34, 59, "#5e6164", null, null, 43.1],
    ["NL.IMBAG.Pand.0437100000001261", 1774, 3, 140, 178, null, 1, 0, null, 0, 0, 0, "#494b4f", null],
    ["NL.IMBAG.Pand.0437100000002950", 1970, 3, 65, 136, null, 1, 0, null, 3, 63, 137, "#676e71", null, null, 44.8],
    ["NL.IMBAG.Pand.0437100000003305", 1977, 3, 33, 78, null, 1, 0, null, 1, 46, 78, "#5e6569", null, null, 30.2],
    ["NL.IMBAG.Pand.0437100000003427", 1959, 3, 75, 0, null, 1, 0, null, 1, 0, 0, "#4d4f58", null],
    ["NL.IMBAG.Pand.0437100000004199", 1925, 3, 37, 142, null, 1, 0, null, 3, 60, 142, "#845a4f", null, null, 52.8],
    ["NL.IMBAG.Pand.0437100000004530", 1982, 2, 65, 0, null, 1, 0, null, 1, 0, 0, null, null],
    ["NL.IMBAG.Pand.0437100000006427", 1977, 3, 34, 0, null, 1, 0, null, 2, 39, 66, "#56585c", null, null, 15.5],
    ["NL.IMBAG.Pand.0437100000007315", 1974, 3, 35, 45, null, 1, 0, null, 2, 32, 71, "#5a5c60", null, null, 20.8],
    ["NL.IMBAG.Pand.0457100000054413", 1933, 3, 47, 128, null, 1, 0, null, 3, 95, 124, "#494b4f", null, null, 30],
    ["NL.IMBAG.Pand.0457100000054845", 1462, 3, 48, 311, "#544642", 0, 1, null, 3, 145, 269, "#676e71", "#ebe7eb", null, 51.5],
    ["NL.IMBAG.Pand.0457100000054855", 1840, 3, 72, 120, null, 1, 0, null, 3, 68, 120, "#676a6d", null, null, 55.7],
    ["NL.IMBAG.Pand.0457100000059177", 1905, 3, 57, 156, "#817368", 1, 1, null, 3, 67, 156, "#747b7f", null, "10-124", 48.5],
    ["NL.IMBAG.Pand.0457100000062574", 1956, 3, 31, 57, null, 1, 0, null, 1, 0, 0, "#5e6569", null],
    ["NL.IMBAG.Pand.0457100000063604", 1956, 3, 29, 57, null, 1, 0, null, 1, 0, 0, "#636a6d", null],
    ["NL.IMBAG.Pand.0457100000065023", 2017, 3, 46, 106, null, 1, 2, null, 1, 46, 52, "#5e6164", "#b0ddeb", null, 22.4],
    ["NL.IMBAG.Pand.0479100000000190", 1960, 3, 38, 86, null, 1, 0, null, 3, 31, 79, "#5a5c60", null, null, 17.4],
    ["NL.IMBAG.Pand.0479100000001512", 1984, 2, 32, 0, null, 1, 0, null, 0, 0, 0, null, null],
    ["NL.IMBAG.Pand.0479100000005285", 1980, 3, 34, 72, null, 1, 0, null, 3, 34, 57, "#676a6d", null, null, 29.8],
    ["NL.IMBAG.Pand.0852100000007043", 1974, 3, 36, 66, null, 1, 0, null, 0, 0, 0, "#51585c", null],
    ["NL.IMBAG.Pand.1696100000004556", 1976, 3, 28, 0, null, 1, 0, null, 0, 0, 0, "#565860", null],
    ["r3699016", 1910, 0, 0, 0, null, 1, 1, null, 1, 176, 214, null, "#d0e6eb", "15-50,65-97,107-120", 35.9],
    ["w1362284226", 1963, 0, 0, 0, null, 1, 0, null, 0, 0, 0, null, null],
    ["w1362284227", 1963, 0, 0, 0, null, 1, 0, null, 0, 0, 0, null, null],
    ["w1362309458", 1963, 0, 0, 0, null, 1, 0, null, 0, 0, 0, null, null],
    ["w1362309461", 1963, 0, 0, 0, null, 1, 0, null, 0, 0, 0, null, null],
    ["w1387551669", 1973, 0, 0, 0, null, 1, 0, null, 1, 0, 0, null, null],
    ["w1421415124", 1973, 0, 0, 0, null, 1, 0, null, 1, 0, 0, null, null],
    ["w1421415126", 1973, 0, 0, 0, null, 1, 0, null, 1, 0, 0, null, null],
    ["w1423983489", 1973, 0, 0, 0, null, 1, 0, null, 1, 80, 88, null, null, null, 24.3],
    ["w1423983494", 1973, 0, 0, 0, null, 1, 0, null, 1, 0, 0, null, null],
    ["w1428145947", 1998, 0, 0, 0, null, 1, 0, null, 1, 35, 52, null, null, null, 42.4],
    ["w1428145953", 1998, 0, 0, 0, "#464243", 1, 3, "#f0f3f5", 1, 0, 0, null, null],
    ["w1435276700", 1992, 0, 0, 0, "#4e463d", 1, 1, null, 1, 0, 0, null, null, "13-27"],
    ["w1435276702", 1992, 0, 0, 0, "#4e463d", 1, 1, null, 1, 70, 77, null, null, "13-27", 22],
    ["w1435276703", 1992, 0, 0, 0, "#4e463d", 1, 1, null, 1, 0, 0, null, null, "13-27"],
    ["w1465800049", 1820, 0, 0, 0, null, 1, 0, null, 0, 0, 0, null, null],
    ["w1465800050", 1820, 0, 0, 0, null, 1, 0, null, 0, 0, 0, null, null],
    ["w1465800052", 1820, 0, 0, 0, null, 1, 0, null, 0, 0, 0, null, null],
    ["w1465800053", 1820, 0, 0, 0, null, 1, 0, null, 0, 0, 0, null, null],
    ["w1465800056", 1820, 0, 0, 0, null, 1, 0, null, 0, 0, 0, null, null],
    ["w1465800058", 1820, 0, 0, 0, null, 1, 0, null, 0, 0, 0, null, null],
    ["w1488019247", 1987, 0, 0, 0, "#635a51", 1, 2, null, 2, 274, 298, null, null, null, 28.6],
    ["w1488019248", 1987, 0, 0, 0, "#635a51", 1, 2, null, 2, 261, 325, null, null, null, 37.7],
    ["w1488019252", 1987, 0, 0, 0, "#635a51", 1, 2, null, 1, 0, 0, null, null],
    ["w1488019253", 1987, 0, 0, 0, "#635a51", 1, 2, null, 2, 266, 324, null, null, null, 36.5],
    ["w1488019254", 1987, 0, 0, 0, "#635a51", 1, 2, null, 1, 310, 333, null, null, null, 28.6],
    ["w1488019255", 1987, 0, 0, 0, "#635a51", 1, 2, null, 2, 297, 360, null, null, null, 37.6],
    ["w1488019256", 1987, 0, 0, 0, "#635a51", 1, 2, null, 4, 433, 462, null, null, null, 25.2],
    ["w1488019257", 1987, 0, 0, 0, "#635a51", 1, 2, null, 2, 261, 323, null, null, null, 36.3],
    ["w1488019266", 1987, 0, 0, 0, "#635a51", 1, 2, null, 2, 297, 359, null, null, null, 35.6],
    ["w1488019269", 1987, 0, 0, 0, "#635a51", 1, 2, null, 4, 73, 110, null, null, null, 23],
    ["w1488019297", 1987, 0, 0, 0, "#b09881", 1, 2, null, 2, 335, 394, null, null, "39-46,83-189,199-240", 35.7],
    ["w1488019298", 1987, 0, 0, 0, "#b09881", 1, 2, null, 1, 335, 394, null, null, "39-46,83-189,199-240", 38.5],
    ["w1488019299", 1987, 0, 0, 0, "#b09881", 1, 2, null, 2, 292, 344, null, null, "39-46,83-189,199-240", 34.3],
    ["w1488019300", 1987, 0, 0, 0, "#b09881", 1, 2, null, 2, 266, 325, null, null, "39-46,83-189,199-240", 38.7],
    ["w1488019301", 1987, 0, 0, 0, "#b09881", 1, 2, null, 2, 234, 290, null, null, "39-46,83-189,199-240", 35.4],
    ["w1488019303", 1987, 0, 0, 0, "#b09881", 0, 2, null, 3, 85, 118, null, null, "39-46,83-189,199-240", 21.4],
    ["w1488019306", 1987, 0, 0, 0, "#b09881", 1, 2, null, 1, 134, 174, null, null, "39-46,83-189,199-240", 29.3],
    ["w1488019307", 1987, 0, 0, 0, "#b09881", 1, 2, null, 2, 113, 143, null, null, "39-46,83-189,199-240", 17.4],
    ["w1488019308", 1987, 0, 0, 0, "#b09881", 1, 2, null, 2, 113, 143, null, null, "39-46,83-189,199-240", 17.7],
    ["w174987150", 1380, 0, 0, 0, "#655c5a", 1, 2, null, 2, 179, 358, null, "#dae2eb", null, 56.7],
    ["w265853828", 2014, 0, 0, 0, null, 1, 2, "#d8fefe", 1, 0, 0, null, null, "10-39,178-189"],
    ["w267883763", 1964, 0, 0, 0, null, 1, 0, null, 0, 0, 0, null, null],
    ["w276686506", 0, 0, 0, 0, null, 1, 0, null, 0, 0, 0, null, null],
    ["w280657731", 1930, 0, 0, 0, null, 1, 0, null, 3, 50, 136, null, null, null, 44.5],
    ["w282293967", 0, 0, 0, 0, null, 1, 0, null, 1, 35, 52, null, null, null, 42.4],
    ["w282293972", 1998, 0, 0, 0, "#464243", 1, 3, "#f0f3f5", 1, 0, 0, null, null],
    ["w283332324", 1935, 0, 0, 0, null, 1, 0, null, 0, 0, 0, null, null],
    ["w285287131", 1962, 0, 0, 0, null, 1, 0, null, 0, 0, 0, null, null],
    ["w314261187", 0, 0, 0, 0, "#52493b", 1, 1, null, 1, 0, 0, null, "#c1e0eb"],
    ["w330159868", 0, 0, 0, 0, "#514639", 1, 1, null, 3, 101, 127, null, "#bbdeeb", null, 17],
    ["w44828165", 1984, 0, 0, 0, "#4e4b45", 1, 1, null, 1, 67, 82, null, "#ebe5db", null, 43.3],
    ["w52296553", 1974, 0, 0, 0, null, 1, 0, null, 0, 0, 0, null, null],
    ["w57858486", 1957, 0, 0, 0, "#514639", 1, 1, null, 3, 101, 127, null, "#bbdeeb", null, 17],
    ["w57860431", 1985, 0, 0, 0, null, 0, 0, null, 3, 79, 168, null, null, null, 53.3],
    ["w747868957", 1300, 0, 0, 0, "#504e49", 1, 3, null, 4, 52, 86, null, "#d8e4eb", null, 45.6],
    ["w747868958", 1300, 0, 0, 0, "#504e49", 1, 3, null, 3, 76, 109, null, "#d8e4eb", null, 57.8],
    ["w747868959", 1300, 0, 0, 0, "#504e49", 1, 3, null, 3, 34, 92, null, "#d8e4eb", null, 56.5],
    ["w747868960", 1300, 0, 0, 0, "#504e49", 1, 3, null, 3, 49, 109, null, "#d8e4eb", null, 58.9],
    ["w747868962", 1300, 0, 0, 0, "#504e49", 1, 3, null, 3, 119, 180, null, "#d8e4eb", null, 60.8],
    ["w747868963", 1300, 0, 0, 0, "#504e49", 1, 3, null, 3, 118, 178, null, "#d8e4eb", null, 58.3],
    ["w747868964", 1300, 0, 0, 0, "#504e49", 1, 3, null, 3, 128, 181, null, "#d8e4eb", null, 57],
    ["w747868965", 1300, 0, 0, 0, "#504e49", 1, 3, null, 3, 121, 179, null, "#d8e4eb", null, 59.2],
    ["w747868966", 1300, 0, 0, 0, "#504e49", 1, 3, null, 3, 129, 180, null, "#d8e4eb", null, 58.4],
    ["w747868968", 1300, 0, 0, 0, "#504e49", 0, 3, null, 3, 118, 168, null, "#d8e4eb", null, 61.3],
    ["w747868969", 1300, 0, 0, 0, "#504e49", 1, 3, null, 4, 118, 168, null, "#d8e4eb", null, 59.5],
    ["w747868985", 1300, 0, 0, 0, "#504e49", 1, 3, null, 3, 120, 272, null, "#d8e4eb", null, 57.3],
    ["w747868986", 1300, 0, 0, 0, "#504e49", 1, 3, null, 4, 130, 242, null, "#d8e4eb", null, 61.3],
    ["w747868987", 1300, 0, 0, 0, "#504e49", 1, 3, null, 3, 104, 226, null, "#d8e4eb", null, 59.7],
    ["w747868988", 1300, 0, 0, 0, "#504e49", 1, 3, null, 3, 107, 229, null, "#d8e4eb", null, 61.1],
    ["w747868989", 1300, 0, 0, 0, "#504e49", 1, 3, null, 3, 186, 263, null, "#d8e4eb", null, 57.2],
    ["w747868990", 1300, 0, 0, 0, "#504e49", 1, 3, null, 3, 186, 267, null, "#d8e4eb", null, 57.7],
    ["w747868991", 1300, 0, 0, 0, "#504e49", 1, 3, null, 3, 176, 260, null, "#d8e4eb", null, 57.6],
    ["w747868992", 1300, 0, 0, 0, "#504e49", 1, 3, null, 4, 193, 256, null, "#d8e4eb", null, 66.4],
    ["w747868993", 1300, 0, 0, 0, "#504e49", 1, 3, null, 4, 227, 438, null, "#d8e4eb", null, 65.2],
    ["w747868994", 1300, 0, 0, 0, "#504e49", 1, 3, null, 3, 170, 260, null, "#d8e4eb", null, 56.3],
    ["w747868995", 1300, 0, 0, 0, "#504e49", 1, 3, null, 3, 175, 264, null, "#d8e4eb", null, 57.9],
    ["w747911435", 1380, 0, 0, 0, "#655c5a", 1, 2, null, 3, 127, 222, null, "#dae2eb", null, 59.6],
    ["w747911440", 1380, 0, 0, 0, "#655c5a", 1, 0, null, 3, 231, 349, null, null, null, 56.5],
    ["w747924617", 1380, 0, 0, 0, "#655c5a", 1, 2, null, 3, 144, 171, null, "#dae2eb", null, 56.1],
    ["w747924618", 1380, 0, 0, 0, "#655c5a", 1, 2, null, 4, 137, 174, null, "#dae2eb", null, 31.7],
    ["w747924619", 1380, 0, 0, 0, "#655c5a", 1, 2, null, 3, 149, 171, null, "#dae2eb", null, 53.8],
    ["w747924621", 1380, 0, 0, 0, "#655c5a", 1, 2, null, 3, 142, 173, null, "#dae2eb", null, 47.8],
    ["w747924622", 1380, 0, 0, 0, "#655c5a", 1, 2, null, 3, 136, 174, null, "#dae2eb", null, 42.7],
    ["w747924623", 1380, 0, 0, 0, "#655c5a", 1, 2, null, 1, 139, 173, null, "#dae2eb", null, 44.3],
    ["w747924624", 1380, 0, 0, 0, "#655c5a", 1, 2, null, 3, 137, 189, null, "#dae2eb", null, 56],
    ["w747924625", 1380, 0, 0, 0, "#655c5a", 1, 2, null, 3, 125, 190, null, "#dae2eb", null, 54.2],
    ["w748997142", 0, 0, 0, 0, "#655c5a", 1, 2, null, 2, 213, 313, null, "#dae2eb", null, 60.8],
    ["w748997143", 1380, 0, 0, 0, "#655c5a", 1, 0, null, 4, 213, 313, null, null, null, 69.4],
    ["w748997144", 1380, 0, 0, 0, "#655c5a", 0, 0, null, 3, 284, 318, null, null, null, 66.3],
    ["w749242499", 1300, 0, 0, 0, "#504e49", 0, 3, null, 3, 38, 87, null, "#d8e4eb", null, 60.5],
    ["w749242500", 1300, 0, 0, 0, "#504e49", 1, 3, null, 3, 42, 90, null, "#d8e4eb", null, 51.9],
    ["w749242501", 1300, 0, 0, 0, "#504e49", 1, 3, null, 3, 51, 90, null, "#d8e4eb", null, 53.5],
    ["w749287964", 0, 0, 0, 0, "#453f38", 1, 2, null, 1, 0, 0, null, "#ebdfe4"],
    ["w749356521", 1496, 0, 0, 0, null, 1, 0, null, 3, 122, 196, null, null, null, 57],
    ["w749356522", 1496, 0, 0, 0, null, 1, 0, null, 4, 95, 142, null, null, null, 57.9],
    ["w749356523", 1496, 0, 0, 0, null, 1, 0, null, 3, 109, 200, null, null, null, 51.9],
    ["w749386975", 1496, 0, 0, 0, null, 1, 0, null, 1, 0, 0, null, null],
    ["w749386976", 1496, 0, 0, 0, null, 1, 0, null, 4, 86, 135, null, null, null, 49.5],
    ["w749871267", 1622, 0, 0, 0, "#7d736c", 1, 1, null, 1, 0, 0, null, "#ebe9e8", "13-37,256-319"],
    ["w750036045", 1673, 0, 0, 0, null, 1, 0, null, 3, 136, 166, null, null, null, 34.9],
    ["w750036046", 1673, 0, 0, 0, null, 1, 0, null, 3, 203, 271, null, null, null, 55.3],
    ["w750036047", 1673, 0, 0, 0, null, 1, 0, null, 4, 325, 565, null, null, null, 70.8],
    ["w750036048", 1673, 0, 0, 0, null, 1, 0, null, 0, 0, 0, null, null],
    ["w750036049", 1673, 0, 0, 0, null, 1, 0, null, 3, 204, 272, null, null, null, 56.4],
    ["w750036050", 1673, 0, 0, 0, null, 1, 0, null, 3, 183, 270, null, null, null, 55.7],
    ["w750036051", 1673, 0, 0, 0, null, 1, 0, null, 3, 199, 270, null, null, null, 56],
    ["w750093275", 1673, 0, 0, 0, null, 1, 0, null, 3, 141, 167, null, null, null, 30.6],
    ["w750093276", 1673, 0, 0, 0, null, 1, 0, null, 3, 184, 241, null, null, null, 43.3],
    ["w750093277", 1673, 0, 0, 0, null, 1, 0, null, 3, 201, 242, null, null, null, 47.5],
    ["w750093278", 1673, 0, 0, 0, null, 1, 0, null, 3, 220, 269, null, null, null, 57.6],
    ["w995323510", 1925, 0, 0, 0, "#594c47", 1, 0, null, 0, 0, 0, null, null],
    ["w995323511", 1925, 0, 0, 0, "#594c47", 1, 0, null, 3, 369, 409, null, null, null, 48.5],
    ["w995323512", 1925, 0, 0, 0, "#594c47", 1, 0, null, 3, 369, 409, null, null, null, 48.5]
  ];

  // src/canalRecall/kitFacts.ts
  var FORMS = [null, "flat", "mixed", "pitched", "mono"];
  var dm = (v) => v ? v / 10 : null;
  var parseSpans = (text) => text ? text.split(",").map((t) => t.split("-").map((v) => Number(v) / 10)) : [];
  var schoolFacts = ([, year, roof, eavesDm, ridgeDm, wallHex, roofFits, glazing, topBandHex, pitch, pitchEavesDm, pitchRidgeDm, roofHex, frameHex, windowSpans2, slopeDeg]) => ({
    year: year || null,
    roof,
    eavesM: eavesDm ? eavesDm / 10 : null,
    ridgeM: ridgeDm ? ridgeDm / 10 : null,
    wallHex,
    roofFits: roofFits === 1,
    glazing: glazing === 2 ? "ribbon" : glazing === 1 ? "punched" : null,
    topBandHex,
    ...glazing === 3 ? { blank: true } : {},
    ...pitch !== void 0 ? { pitch: FORMS[pitch] ?? null, pitchEavesM: dm(pitchEavesDm), pitchRidgeM: dm(pitchRidgeDm), roofHex: roofHex ?? null, frameHex: frameHex ?? null } : {},
    ...typeof windowSpans2 === "string" ? { windowSpans: parseSpans(windowSpans2) } : {},
    ...slopeDeg ? { pitchSlopeDeg: slopeDeg } : {}
  });
  var KIT_FACTS = new Map(PUBLIC_FACTS.map((e) => [e[0], schoolFacts(e)]));
  var PANORAMA_BRICK = { from: 50, keep: 0.4, maxL: 55, minC: 6 };
  function panoramaBrickHue(hex2) {
    const [L, a, b] = rgbToLab(hexToRgb(hex2)), C = Math.hypot(a, b), h = Math.atan2(b, a) * 180 / Math.PI;
    if (L >= PANORAMA_BRICK.maxL || C < PANORAMA_BRICK.minC || h <= PANORAMA_BRICK.from || h > 120) return hex2;
    const h2 = (PANORAMA_BRICK.from + (h - PANORAMA_BRICK.from) * PANORAMA_BRICK.keep) * Math.PI / 180;
    return rgbToHex(labToRgb([L, C * Math.cos(h2), C * Math.sin(h2)]));
  }
  function measuredWallDisplay(raw) {
    return wallFamily(hexToRgb(raw)) === "brick" && !paleRender(raw) ? cityWallTint(panoramaBrickHue(raw)) : cityStuccoTint(raw);
  }
  var paleRender = (raw) => {
    const [L, a, b] = rgbToLab(hexToRgb(raw)), C = Math.hypot(a, b), h = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
    return L >= 70 && (C < 8 || C < 18 && h >= 50 && h <= 105);
  };
  var PITCHED_MIN_RISE_M = 2.5;
  function pitchedHip(facts, heightM, minEavesM) {
    if (facts?.pitch !== "pitched" || facts.pitchEavesM == null || facts.pitchRidgeM == null) return null;
    const eaves = Math.min(Math.max(facts.pitchEavesM, minEavesM), heightM), rise = facts.pitchRidgeM - eaves;
    if (rise < PITCHED_MIN_RISE_M) return null;
    const low = facts.pitchSlopeDeg !== void 0 && facts.pitchSlopeDeg < LOW_PITCH_DEG;
    return { eavesM: Math.round(eaves * 10) / 10, riseM: Math.round(rise * 10) / 10, ...low ? { pitchDeg: facts.pitchSlopeDeg } : {} };
  }
  var LOW_PITCH_DEG = 25;
  function storeyWindows(eavesM, era) {
    const r1 = (v) => Math.round(v * 10) / 10;
    const floorH = era === "o" ? 4 : era === "e" ? 3.6 : 3.4;
    const floors = Math.max(1, Math.min(5, Math.round(eavesM / floorH)));
    const step = eavesM / floors, rows = [];
    const winH = era === "o" ? 2.5 : era === "e" ? 2.2 : 1.7, sill = era === "o" ? 0.9 : 0.8;
    const widthM = era === "o" ? 2 : era === "e" ? 2.2 : 3, bayM = era === "o" ? 3.1 : era === "e" ? 3.3 : 3.5;
    for (let i = 0; i < floors; i++) {
      const z0 = i * step + sill, z1 = Math.min(z0 + winH, (i + 1) * step - 0.3);
      if (z1 - z0 < 1.2) continue;
      rows.push({ z0: r1(z0), z1: r1(z1), widthM, bayM, head: "flat" });
    }
    return rows;
  }
  var MEASURED_ROW_OVERLAP = 0.4;
  function measuredRows(rows, facts) {
    const spans = facts?.windowSpans;
    if (!spans) return rows;
    return rows.filter((r) => spans.reduce((s, [a, b]) => s + Math.max(0, Math.min(b, r.z1) - Math.max(a, r.z0)), 0) >= MEASURED_ROW_OVERLAP * (r.z1 - r.z0));
  }
  var RIBBON_MULLION_M = 1.5;
  var RIBBON_FRAME = "#e4e0d6";
  var SASH = { cols: 2, rows: 2 };
  var measuredFrame = (facts) => facts?.frameHex ? cityStuccoTint(facts.frameHex) : null;
  function measuredOpenings(eavesM, era, facts, glassHex) {
    if (!facts?.glazing) return null;
    const frame = measuredFrame(facts), ribbon2 = facts.glazing === "ribbon";
    const rows = measuredRows(ribbon2 ? storeyWindows(eavesM, era).map((r) => ({ ...r, ribbon: true, bayM: RIBBON_MULLION_M })) : storeyWindows(eavesM, era), facts);
    if (!rows.length) return null;
    return { rows, glassHex, frameHex: ribbon2 ? frame ?? RIBBON_FRAME : frame ?? void 0, ...frame && !ribbon2 ? { sash: { hex: frame, ...SASH } } : {} };
  }

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
  function plainBodyTrim(era) {
    return era === "m" ? { coping: { m: 0.6, hex: "#4a4744" } } : { coping: { m: 0.4, hex: CITY_STONE }, plinth: { z1: 0.6, hex: "#8c877d" } };
  }
  var WORSHIP_PITCHED_MIN_EAVES_M = 3;
  function worshipKit([id, kind, mode, eavesM, riseM, era], facts = KIT_FACTS.get(id)) {
    const name = `Generic ${KIND_NAME[kind]} ${id}`, hex2 = facts?.wallHex ? measuredWallDisplay(facts.wallHex) : WORSHIP_WALL[era];
    const hip = mode !== "h" && facts?.roofFits !== false ? pitchedHip(facts, eavesM, WORSHIP_PITCHED_MIN_EAVES_M) : null;
    const eaves = hip?.eavesM ?? eavesM, rise = hip?.riseM ?? riseM;
    const rows = mode === "b" ? [] : worshipWindows(eaves);
    const measured = rows.length ? null : measuredOpenings(eaves, era, facts, "#3a434c");
    const windows = rows.length ? { rows, glassHex: "#3a434c" } : measured ?? void 0;
    const roofHex = facts?.roofHex && (hip || mode === "h") ? facts.roofHex : void 0;
    if (!hip && (mode === "b" || mode === "w" && !rows.length) && !measured) return { name, wall: { plain: true, hex: hex2 }, tiers: [], stacks: [], roofs: [], body: [id], trim: plainBodyTrim(era) };
    return {
      name,
      wall: { plain: true, hex: hex2 },
      tiers: [],
      stacks: [],
      roofs: [],
      halls: [{ id, widthM: 0, anchor: [0, 0], fit: mode === "h", ...hip ? { hip: true } : {}, ...hip?.pitchDeg ? { pitchDeg: hip.pitchDeg } : {}, eavesM: eaves, riseM: rise, mat: era === "o" ? "slate" : "tile", ...roofHex ? { roofHex } : {}, windows }]
    };
  }
  var GENERIC_WORSHIP_KITS = WORSHIP_BUILDINGS.filter((e) => !NOT_WORSHIP_FORM[e[0]]).map((e) => applyKitFacade(worshipKit(e), e[0], e[3]));

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
  var schoolWallDisplay = measuredWallDisplay;
  var PUBLIC_WALL = {
    c: { o: "#8a6350", e: "#8f6b58", m: "#a8a6a0" },
    s: { o: "#8a4a38", e: "#955a45", m: "#b5a68e" }
  };
  var round12 = (v) => Math.round(v * 10) / 10;
  var schoolWindows = storeyWindows;
  var KIND_NAME2 = { c: "cinema", s: "school", f: "fire station", p: "police station", h: "hospital", o: "civic office" };
  var stablePick = (id, values) => {
    let hash = 2166136261;
    for (const char of id) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return values[(hash >>> 0) % values.length];
  };
  function schoolWall(id, era, facts = KIT_FACTS.get(id)) {
    if (facts?.wallHex) return { hex: schoolWallDisplay(facts.wallHex), source: "measured" };
    const period = facts?.year ? periodForYear(facts.year) : null;
    const measured = period ? SCHOOL_PERIOD_WALLS[period] : void 0;
    if (measured?.length) return { hex: schoolWallDisplay(stablePick(id, measured)), source: "period" };
    const walls2 = period ? PERIOD_WALLS.photo[period] : null;
    if (walls2?.length) return { hex: stablePick(id, walls2), source: "period" };
    return { hex: PUBLIC_WALL.s[era], source: "era" };
  }
  var SCHOOL_HIP_BEFORE = 1940;
  var SCHOOL_HIP_MIN_RISE_M = 2.5;
  var SCHOOL_HIP_TILE = ROOF_TONES.photo.tile[3];
  var SCHOOL_HIP_MIN_EAVES_M = 6;
  function schoolHipRoof(facts, heightM) {
    if (!facts?.year || facts.year >= SCHOOL_HIP_BEFORE || facts.ridgeM === null || facts.eavesM === null) return null;
    const eaves = Math.max(facts.eavesM, (heightM - 0.7 * facts.ridgeM) / 0.3, SCHOOL_HIP_MIN_EAVES_M);
    const rise = facts.ridgeM - eaves;
    if (rise < SCHOOL_HIP_MIN_RISE_M) return null;
    return { eavesM: round12(eaves), riseM: round12(rise) };
  }
  var SCHOOL_RIBBON_MULLION_M = RIBBON_MULLION_M;
  var SCHOOL_RIBBON_FRAME = RIBBON_FRAME;
  var SCHOOL_TOP_BAND_M = { o: 1.2, m: 0.7 };
  function schoolRoof(facts, heightM) {
    if (facts?.pitch === void 0 || facts.pitch === null) return schoolHipRoof(facts, heightM);
    return pitchedHip(facts, heightM, (facts.year ?? 0) < SCHOOL_HIP_BEFORE ? SCHOOL_HIP_MIN_EAVES_M : SCHOOL_PITCHED_MIN_EAVES_M);
  }
  var SCHOOL_PITCHED_MIN_EAVES_M = 3;
  function cinemaKit(name, id, eavesM, era, facts) {
    const hex2 = facts?.wallHex ? measuredWallDisplay(facts.wallHex) : PUBLIC_WALL.c[era];
    const hip = era !== "m" && facts?.roofFits !== false ? pitchedHip(facts, eavesM, 4) : null;
    const eaves = hip?.eavesM ?? eavesM, windows = measuredOpenings(eaves, era, facts, "#3a434c");
    if (!hip && !windows) return { name, wall: { plain: true, hex: hex2 }, tiers: [], stacks: [], roofs: [], body: [id], trim: plainBodyTrim(era) };
    if (windows && era !== "m") windows.plinth = { z1: 0.6, hex: "#8c877d" };
    return {
      name,
      wall: { plain: true, hex: hex2 },
      tiers: [],
      stacks: [],
      roofs: [],
      halls: [{ id, widthM: 0, anchor: [0, 0], ...hip ? { hip: true, roofHex: facts?.roofHex ?? SCHOOL_HIP_TILE, ...hip.pitchDeg ? { pitchDeg: hip.pitchDeg } : {} } : {}, eavesM: eaves, riseM: hip?.riseM ?? 0, mat: "slate", ...windows ? { windows } : {} }]
    };
  }
  function publicKit([id, kind, mode, eavesM, riseM, era], facts = KIT_FACTS.get(id)) {
    const name = `Generic ${KIND_NAME2[kind]} ${id}`;
    if (kind === "c" || mode === "p") return cinemaKit(name, id, eavesM, era, facts);
    if (mode === "h" && (facts?.pitch === "flat" || facts?.pitch === "mixed")) {
      const share = /^w\d+$/.test(id) ? 1 : 0.7;
      return publicKit([id, kind, "f", round12(eavesM + share * riseM), 0, era], facts);
    }
    const hip = mode === "f" && facts?.roofFits !== false ? schoolRoof(facts, eavesM) : null;
    const eaves = hip?.eavesM ?? eavesM, rise = hip?.riseM ?? riseM;
    const ribbon2 = facts?.glazing === "ribbon", frame = measuredFrame(facts);
    const rows = measuredRows(ribbon2 ? schoolWindows(eaves, era).map((r) => ({ ...r, ribbon: true, bayM: SCHOOL_RIBBON_MULLION_M })) : schoolWindows(eaves, era), facts);
    const windows = { rows, glassHex: "#3a4650", frameHex: ribbon2 ? SCHOOL_RIBBON_FRAME : frame ?? (era === "m" ? void 0 : "#d8d2c4"), plinth: era === "m" ? void 0 : { z1: 0.8, hex: "#8c877d" } };
    if (frame && !ribbon2) windows.sash = { hex: frame, ...SASH };
    if (facts?.topBandHex && !hip && mode === "f") {
      const m = era === "o" ? SCHOOL_TOP_BAND_M.o : SCHOOL_TOP_BAND_M.m, top = round12(eaves - m - 0.2);
      windows.topBand = { m, hex: cityStuccoTint(facts.topBandHex) };
      windows.rows = rows.map((r) => r.z1 > top ? { ...r, z1: top } : r).filter((r) => r.z1 - r.z0 >= 1);
    }
    if (!windows.rows.length && !hip && mode === "f" && !windows.topBand) return { name, wall: { plain: true, hex: schoolWall(id, era, facts).hex }, tiers: [], stacks: [], roofs: [], body: [id], trim: plainBodyTrim(era) };
    const roofHex = hip || mode === "h" ? facts?.roofHex ?? (hip ? SCHOOL_HIP_TILE : void 0) : void 0;
    return {
      name,
      wall: { plain: true, hex: schoolWall(id, era, facts).hex },
      tiers: [],
      stacks: [],
      roofs: [],
      halls: [{ id, widthM: 0, anchor: [0, 0], fit: mode === "h", ...hip ? { hip: true } : {}, ...hip?.pitchDeg ? { pitchDeg: hip.pitchDeg } : {}, ...roofHex ? { roofHex } : {}, eavesM: eaves, riseM: rise, mat: "tile", windows }]
    };
  }
  var GENERIC_PUBLIC_KITS = PUBLIC_BUILDINGS.filter((e) => !NOT_PUBLIC_FORM[e[0]]).map((e) => {
    const r = PUBLIC_RETYPE[e[0]];
    return applyKitFacade(r ? publicKit(r.entry, r.facts) : publicKit(e), e[0], (r?.entry ?? e)[3]);
  });

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
      halls: [{ id: "NL.IMBAG.Pand.0363100012164998", widthM: 1.9, anchor: [4.884358, 52.374554], eavesM: 27, riseM: 1.5, mat: "slate" }],
      // The church's own lean-to shops between the buttresses (BAG 1990, 8-11 m², ~3.8 m): Westermarkt 66-74 on the
      // south wall, 60-62 on the north. Under the 14 m² facade minimum they fell back to random prior colours, so the
      // nave stood behind a row of teal/beige/tan boxes (user report 2026-10-10). They share the church's brick instead.
      body: [
        "NL.IMBAG.Pand.0363100012174406",
        "NL.IMBAG.Pand.0363100012174405",
        "NL.IMBAG.Pand.0363100012174404",
        "NL.IMBAG.Pand.0363100012174226",
        "NL.IMBAG.Pand.0363100012174225",
        "NL.IMBAG.Pand.0363100012174224",
        "NL.IMBAG.Pand.0363100012168591"
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
      body: ["w1390692763", "w1390692767", "w1390692768", "w1390692769", "w1390692770", "w1390692771", "w1390692772", "w1390692766", "w1390692764", "w1390692765"],
      // The copper skin's darker capping round each part's top edge (kit review 1: a body-only kit drew nothing of its own).
      trim: { coping: { m: 0.5, hex: "#3d7a66" } }
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
          // Amsterdam monument 200454: Bloemstraat elevation is nearly blind.
          blindWalls: [[4.87847, 52.373455]],
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
  var kitIds = (k) => [...k.tiers.map((t) => t.id), ...k.stacks.map((s) => s.onId), ...k.roofs.map((r) => r.id), ...(k.halls ?? []).map((h) => h.id), ...k.hides ?? [], ...(k.forms ?? []).map((f2) => f2.on), ...k.body ?? []];
  var HAND_KIT_IDS = new Set(HAND_KITS.flatMap(kitIds));
  var HAND_IDS = HAND_KIT_IDS;
  var KITS = [...HAND_KITS, ...[...GENERIC_WORSHIP_KITS, ...GENERIC_PUBLIC_KITS].filter((k) => kitIds(k).every((id) => !HAND_IDS.has(id)))];
  var KIT_PART_IDS = new Set(KITS.flatMap((k) => [...k.tiers.map((t) => t.id), ...k.stacks.map((s) => s.onId), ...k.roofs.map((r) => r.id), ...(k.halls ?? []).map((h) => h.id), ...k.hides ?? [], ...(k.forms ?? []).map((f2) => f2.on)]));
  var KIT_HIDE_IDS = [...new Set(KITS.flatMap((k) => [...k.tiers.map((t) => t.id), ...k.stacks.map((s) => s.onId), ...k.hides ?? []]))];
  var KIT_MODELLED_IDS = /* @__PURE__ */ new Set([...KIT_PART_IDS, ...KITS.flatMap((k) => k.body ?? [])]);
  var KIT_ROOF = new Map(KITS.flatMap((k) => k.roofs.map((r) => [r.id, { roof: r, wall: k.wall }])));
  var KIT_HALLS = new Map(KITS.flatMap((k) => (k.halls ?? []).map((h) => [h.id, { halls: h, wall: k.wall }])));
  var KIT_BODY = new Map(KITS.flatMap((k) => k.wall ? (k.body ?? []).map((id) => [id, k.wall]) : []));
  var sub4 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  var cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  var dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  var layerFor = (mat) => mat === "brick" ? "plain" : "flat";
  var TriSink = class {
    out = [];
    tri(a, b, c, ua, ub, uc, layer, hex2, hint) {
      let n = cross3(sub4(b, a), sub4(c, a)), B = b, C = c, UB = ub, UC = uc;
      if (dot3(n, hint) < 0) {
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
  function opening(sink, o, t, n, s, row, glass, frame, sash) {
    const head = row.head ?? "round", w = row.widthM;
    if (frame) wallPolygon(sink, o, t, n, OFF.frame, openingOutline(s - w / 2 - 0.18, s + w / 2 + 0.18, row.z0 - 0.15, row.z1 + 0.18, head), frame);
    wallPolygon(sink, o, t, n, OFF.glass, openingOutline(s - w / 2, s + w / 2, row.z0, row.z1, head), glass);
    if (sash) sashBars(sink, o, t, n, s - w / 2, s + w / 2, row.z0, head === "flat" ? row.z1 : Math.min(row.z1, row.z0 + Math.max(0, row.z1 - row.z0 - w / 2)), sash);
  }
  var SASH_BAR_M = 0.08;
  function sashBars(sink, o, t, n, s0, s1, z0, z1, sash) {
    if (z1 - z0 < 0.3 || s1 - s0 < 0.3) return;
    const b = SASH_BAR_M, bar = (a0, a1, b0, b1) => wallPolygon(sink, o, t, n, OFF.tracery, [[a0, b0], [a1, b0], [a1, b1], [a0, b1]], sash.hex);
    bar(s0, s1, z0, z0 + b);
    bar(s0, s1, z1 - b, z1);
    bar(s0, s0 + b, z0 + b, z1 - b);
    bar(s1 - b, s1, z0 + b, z1 - b);
    for (let k = 1; k < sash.cols; k++) {
      const s = s0 + (s1 - s0) * k / sash.cols;
      bar(s - b / 2, s + b / 2, z0 + b, z1 - b);
    }
    for (let k = 1; k < sash.rows; k++) {
      const z = z0 + (z1 - z0) * k / sash.rows;
      bar(s0 + b, s1 - b, z - b / 2, z + b / 2);
    }
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
  function ribbon(sink, e, row, glass, frame) {
    const inset = Math.min(0.6, e.len * 0.1), s0 = inset, s1 = e.len - inset, f2 = 0.1;
    wallPolygon(sink, e.o, e.t, e.n, OFF.frame, [[s0 - f2, row.z0 - f2], [s1 + f2, row.z0 - f2], [s1 + f2, row.z1 + f2], [s0 - f2, row.z1 + f2]], frame);
    wallPolygon(sink, e.o, e.t, e.n, OFF.glass, [[s0, row.z0], [s1, row.z0], [s1, row.z1], [s0, row.z1]], glass);
    const n = Math.max(1, Math.round((s1 - s0) / row.bayM));
    for (let k = 1; k < n; k++) {
      const s = s0 + (s1 - s0) * k / n;
      wallPolygon(sink, e.o, e.t, e.n, OFF.tracery, [[s - 0.05, row.z0], [s + 0.05, row.z0], [s + 0.05, row.z1], [s - 0.05, row.z1]], frame);
    }
  }
  var CLADDING_PITCH = { ribs: 0.5, boards: 0.35, louvres: 0.3, panels: 1.2, curtain: 1.5 };
  var CLADDING_ROW_M = { panels: 0.9, curtain: 3.3 };
  var CLADDING_LINE = { ribs: 0.08, boards: 0.06, louvres: 0.15, panels: 0.04, curtain: 0.1 };
  var CURTAIN_FRAME_HEX = "#c9cdd0";
  function shadeHex(hex2, k) {
    const v = parseInt(hex2.slice(1), 16), c = (x) => Math.max(0, Math.min(255, Math.round(x * k))).toString(16).padStart(2, "0");
    return `#${c(v >> 16 & 255)}${c(v >> 8 & 255)}${c(v & 255)}`;
  }
  function claddingZones(z0, z1, gaps, pad = 0.15, min = 0.3) {
    let zones = [[z0, z1]];
    for (const [a0, a1] of gaps) {
      const g0 = a0 - pad, g1 = a1 + pad;
      zones = zones.flatMap(([a, b]) => g1 <= a || g0 >= b ? [[a, b]] : [[a, g0], [g1, b]]);
    }
    return zones.filter(([a, b]) => b - a >= min);
  }
  function claddingOnEdge(sink, e, z0, z1, c) {
    if (e.len < 1 || z1 - z0 < 0.3) return;
    const rect = (s02, s12, a, b, off, hex2) => wallPolygon(sink, e.o, e.t, e.n, off, [[s02, a], [s12, a], [s12, b], [s02, b]], hex2);
    const pitch = c.pitchM ?? CLADDING_PITCH[c.kind], w = CLADDING_LINE[c.kind], inset = 0.1, s0 = inset, s1 = e.len - inset;
    const line = c.lineHex ?? (c.kind === "curtain" ? CURTAIN_FRAME_HEX : c.kind === "louvres" ? shadeHex(c.hex, 0.45) : shadeHex(c.hex, 0.78));
    rect(0, e.len, z0, z1, OFF.plinth, c.kind === "louvres" ? line : c.hex);
    const vertical = (step) => {
      const n = Math.max(1, Math.round((s1 - s0) / step));
      for (let k = 1; k < n; k++) {
        const s = s0 + (s1 - s0) * k / n;
        rect(s - w / 2, s + w / 2, z0, z1, OFF.frame, line);
      }
    };
    const horizontal = (step, hex2, wd, from = z0) => {
      for (let z = from + step; z < z1 - wd / 2; z += step) rect(s0, s1, z - wd / 2, z + wd / 2, OFF.frame, hex2);
    };
    switch (c.kind) {
      case "ribs":
        vertical(pitch);
        break;
      case "boards":
        horizontal(pitch, line, w);
        break;
      case "louvres":
        horizontal(pitch, c.hex, w, z0 - pitch / 2);
        break;
      case "panels":
        vertical(pitch);
        horizontal(c.rowM ?? CLADDING_ROW_M.panels, line, w);
        break;
      case "curtain": {
        const row = c.rowM ?? CLADDING_ROW_M.curtain, band = Math.max(w, c.spandrelM ?? 0), bands = [[z0, z0 + w, line], [z1 - w, z1, line]];
        for (let z = z0 + row; z < z1 - band / 2 - w; z += row) bands.push([z - band / 2, z + band / 2, c.spandrelHex ?? line]);
        bands.sort((a, b) => a[0] - b[0]);
        for (const [a, b, hex2] of bands) rect(0, e.len, a, b, OFF.frame, hex2);
        const n = Math.max(1, Math.round((s1 - s0) / pitch));
        for (let i = 0; i + 1 < bands.length; i++) {
          const a = bands[i][1], b = bands[i + 1][0];
          if (b - a > 0.05) for (let k = 1; k < n; k++) {
            const s = s0 + (s1 - s0) * k / n;
            rect(s - w / 2, s + w / 2, a, b, OFF.frame, line);
          }
        }
        break;
      }
    }
  }
  function claddingOnRing(sink, ring, list, floor, ceil, gaps) {
    const edges = wallEdges(ring);
    for (const c of list) {
      const z0 = Math.max(c.z0, floor), z1 = Math.min(c.z1 ?? ceil, ceil);
      for (const [a, b] of claddingZones(z0, z1, gaps)) for (const e of edges) claddingOnEdge(sink, e, a, b, c);
    }
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
    if (win.topBand) {
      const z1 = spec.eavesM, z0 = Math.max(0, z1 - win.topBand.m);
      for (const e of edges) if (e.len >= 0.2) wallPolygon(sink, e.o, e.t, e.n, OFF.plinth, [[0, z0], [e.len, z0], [e.len, z1], [0, z1]], win.topBand.hex);
    }
    if (win.cladding?.length) {
      const floor = win.plinth?.z1 ?? 0, ceil = spec.eavesM - (win.topBand?.m ?? 0);
      claddingOnRing(sink, ring, win.cladding, floor, ceil, win.rows.map((r) => [r.z0, r.z1]));
    }
    const inTower = (p) => (spec.towers ?? []).some((t) => {
      const [cx, cy] = toLocal(t.at), a = towerAng(t), dx = p[0] - cx, dy = p[1] - cy;
      return Math.abs(dx * Math.cos(a) + dy * Math.sin(a)) < t.widthM / 2 + 0.4 && Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)) < (t.lenM ?? t.widthM) / 2 + 0.4;
    });
    const placed = win.rows.filter((r) => r.at).map((r) => ({ row: r, ...nearestEdge(edges, toLocal(r.at)) }));
    const claimed = new Set((win.blindWalls ?? []).map((at) => nearestEdge(edges, toLocal(at)).edge));
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
      for (let k = 0; k < n; k++) opening(sink, e.o, e.t, e.n, s + (k - (n - 1) / 2) * row.bayM, row, glass, win.frameHex, win.sash);
    }
    for (const row of win.rows) {
      if (row.at || row.z1 > spec.eavesM) continue;
      edges.forEach((e, i) => {
        if (claimed.has(i) || e.len < row.widthM + 1) return;
        if (row.ribbon) {
          ribbon(sink, e, row, glass, win.frameHex ?? stone);
          return;
        }
        const n = Math.max(1, Math.floor(e.len / row.bayM));
        for (let k = 0; k < n; k++) {
          const s = (k + 0.5) * e.len / n;
          if (!inTower([e.o[0] + e.t[0] * s + e.n[0] * 0.5, e.o[1] + e.t[1] * s + e.n[1] * 0.5])) opening(sink, e.o, e.t, e.n, s, row, glass, win.frameHex, win.sash);
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
      for (let f2 = 0; f2 < 4; f2++) {
        const na = a + f2 * Math.PI / 2, n = [Math.cos(na), Math.sin(na)], tt = [-n[1], n[0]];
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
      if (spec.hip && spec.riseM > 0) {
        const tris = hipAround(part.ring, spec.eavesM, spec.riseM, spec.pitchDeg) ?? hipOverRect(part.ring, plan, spec.eavesM);
        for (const t of tris) {
          const slope = t.part === "slope";
          sink.out.push({ p: t.p, uv: t.uv, layer: slope ? "slope" : "plain", hex: slope ? hex2 : gable, n: t.n });
        }
      } else if (spec.fit) {
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
    if (kit.trim) for (const id of kit.body ?? []) {
      const part = parts.get(id);
      if (part) bodyTrim(sinkFor(id), part, kit.trim);
    }
    return [...out].map(([id, sink]) => ({ id, tris: sink.out }));
  }
  function bodyTrim(sink, part, trim) {
    const z0 = part.minHeightM, z1 = part.heightM;
    for (const e of wallEdges(part.ring)) {
      if (e.len < 0.2) continue;
      if (trim.plinth && trim.plinth.z1 < z1 - z0) wallPolygon(sink, e.o, e.t, e.n, OFF.plinth, [[0, z0], [e.len, z0], [e.len, z0 + trim.plinth.z1], [0, z0 + trim.plinth.z1]], trim.plinth.hex);
      if (trim.coping) {
        const c = Math.min(trim.coping.m, (z1 - z0) / 2);
        wallPolygon(sink, e.o, e.t, e.n, OFF.plinth, [[0, z1 - c], [e.len, z1 - c], [e.len, z1], [0, z1]], trim.coping.hex);
      }
    }
    if (trim.cladding?.length) {
      const floor = z0 + (trim.plinth && trim.plinth.z1 < z1 - z0 ? trim.plinth.z1 : 0), ceil = z1 - (trim.coping ? Math.min(trim.coping.m, (z1 - z0) / 2) : 0);
      claddingOnRing(sink, part.ring, trim.cladding.map((c) => ({ ...c, z0: z0 + c.z0, ...c.z1 !== void 0 ? { z1: z0 + c.z1 } : {} })), floor, ceil, []);
    }
  }
  var HIP_PITCH_DEG = 50;
  var HIP_MAX_PITCH_DEG = 65;
  var HIP_SIMPLIFY_M = 1;
  var HIP_MIN_INSET_M = 1.2;
  function simplifyRing(ring, tol) {
    const pts = openRing(ring);
    const off = (a, b, c) => {
      const l = Math.hypot(c[0] - a[0], c[1] - a[1]);
      return l < 1e-9 ? Math.hypot(b[0] - a[0], b[1] - a[1]) : Math.abs((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / l;
    };
    while (pts.length > 4) {
      let best = -1, bestD = tol;
      for (let i = 0; i < pts.length; i++) {
        const d = off(pts[(i + pts.length - 1) % pts.length], pts[i], pts[(i + 1) % pts.length]);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best < 0) break;
      pts.splice(best, 1);
    }
    return pts;
  }
  function hipAround(ring, eavesM, riseM, pitchDeg) {
    const pts = simplifyRing(ring, HIP_SIMPLIFY_M);
    if (pts.length < 3 || riseM <= 0) return null;
    const tanOf = (deg) => Math.tan(deg * Math.PI / 180), want = riseM / tanOf(pitchDeg ?? HIP_PITCH_DEG);
    const sign = Math.sign(signedArea(pts));
    for (let t = want; t >= HIP_MIN_INSET_M - 1e-9; t *= 0.92) {
      const inner = insetRing(pts, t);
      if (!inner || Math.sign(signedArea(inner)) !== sign || Math.abs(signedArea(inner)) < 1) continue;
      const rise = Math.min(riseM, t * tanOf(pitchDeg ?? HIP_MAX_PITCH_DEG));
      const out = [], z0 = eavesM, z1 = eavesM + rise;
      const tri2 = (a, b, c, part) => {
        const u = sub4(b, a), v = sub4(c, a);
        let n = cross3(u, v);
        if (n[2] < 0) {
          n = [-n[0], -n[1], -n[2]];
          [b, c] = [c, b];
        }
        const l = Math.hypot(n[0], n[1], n[2]);
        if (l < 1e-9) return;
        out.push({ p: [a, b, c], uv: [[a[0] / 1.2, a[1] / 1.2], [b[0] / 1.2, b[1] / 1.2], [c[0] / 1.2, c[1] / 1.2]], part, n: [n[0] / l, n[1] / l, n[2] / l] });
      };
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length, a = [...pts[i], z0], b = [...pts[j], z0], c = [...inner[j], z1], d = [...inner[i], z1];
        tri2(a, b, c, "slope");
        tri2(a, c, d, "slope");
      }
      for (const [a, b, c] of earClip(inner)) tri2([...a, z1], [...b, z1], [...c, z1], "slope");
      return out;
    }
    return null;
  }
  function hipOverRect(ring, plan, eavesM) {
    const rect = fitRect(ring, 200);
    if (!rect || rect.coverage < FIT_COVERAGE || rect.maxDev > FIT_MAX_DEV_M) return [];
    return roofTriangles(rect, { ...plan, kind: "hipped" }, eavesM, { bayM: 5, storeyM: 3.1, cellM: 1.2 });
  }
  function earClip(poly) {
    const idx = poly.map((_, i) => i), out = [], ccw = signedArea(poly) > 0;
    const turn = (a, b, c) => ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) * (ccw ? 1 : -1);
    const inside = (p, a, b, c) => turn(a, b, p) > 0 && turn(b, c, p) > 0 && turn(c, a, p) > 0;
    let guard = 0;
    while (idx.length > 3 && guard++ < 1e4) {
      let clipped = false;
      for (let k = 0; k < idx.length; k++) {
        const a = poly[idx[(k + idx.length - 1) % idx.length]], b = poly[idx[k]], c = poly[idx[(k + 1) % idx.length]];
        if (turn(a, b, c) <= 1e-9) continue;
        if (idx.some((i) => {
          const p = poly[i];
          return p !== a && p !== b && p !== c && inside(p, a, b, c);
        })) continue;
        out.push([a, b, c]);
        idx.splice(k, 1);
        clipped = true;
        break;
      }
      if (!clipped) break;
    }
    if (idx.length === 3) out.push([poly[idx[0]], poly[idx[1]], poly[idx[2]]]);
    return out;
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

  // src/canalRecall/rendererShared/lightRig.ts
  var SHADOW_FILL = 0.5;
  var DEFAULT_LIGHT_RIG = {
    // South-south-west afternoon sun: shadows fall north-north-east, so the
    // canal-side facades that face the street on the main belt stay mostly lit.
    sunAzimuthDeg: 215,
    sunElevationDeg: 40,
    // Mood pass (2026-10-13): a warmer afternoon sun (was #fff1dc), a less blue
    // sky and a lighter, warmer street bounce (were #dbe8ff over #8d8270), so
    // shade sides read as daylight rather than dusk. Bands: docs/LOOK.md §Parity.
    sunColour: "#ffe9cc",
    sunIntensity: 2.15,
    skyColour: "#e3ebf6",
    groundColour: "#998a72",
    skyIntensity: 1.75,
    shadows: true,
    shadowMapSize: 2048,
    shadowIntensity: 1 - SHADOW_FILL
  };
  var SUNNY_LIGHT_RIG = { ...DEFAULT_LIGHT_RIG, ...SUNNY_LIGHT };
  function sunDirection(azimuthDeg, elevationDeg) {
    const az2 = azimuthDeg * Math.PI / 180, el2 = elevationDeg * Math.PI / 180;
    return [Math.sin(az2) * Math.cos(el2), Math.cos(az2) * Math.cos(el2), Math.sin(el2)];
  }
  var SUN_DIRECTION = sunDirection(DEFAULT_LIGHT_RIG.sunAzimuthDeg, DEFAULT_LIGHT_RIG.sunElevationDeg);
  var SUN_HORIZONTAL = (() => {
    const a = DEFAULT_LIGHT_RIG.sunAzimuthDeg * Math.PI / 180;
    return [Math.sin(a), Math.cos(a)];
  })();
  var BAKED_FACE_LIGHT = [SUN_HORIZONTAL[0] * 0.6, SUN_HORIZONTAL[1] * 0.6, 0.8];
  var BAKED_WALL_MIN = 0.84;
  function bakedFaceShade(n) {
    const d = n[0] * BAKED_FACE_LIGHT[0] + n[1] * BAKED_FACE_LIGHT[1] + n[2] * BAKED_FACE_LIGHT[2];
    return Math.max(0.5, Math.min(1, 0.58 + 0.42 * Math.max(0, d)));
  }
  var BAKED_LID_SHADE = bakedFaceShade([0, 0, 1]);
  var glslFloat = (v) => Number.isInteger(v) ? v.toFixed(1) : String(+v.toFixed(6));
  var BAKED_SHADE_GLSL = `
  float shade;
  if (abs(n.z) < 0.5) { vec2 h = normalize(n.xy + vec2(1e-6, 0.0)); shade = ${glslFloat(BAKED_WALL_MIN)} + ${glslFloat(1 - BAKED_WALL_MIN)} * (0.5 + 0.5 * dot(h, vec2(${glslFloat(SUN_HORIZONTAL[0])}, ${glslFloat(SUN_HORIZONTAL[1])}))); }
  else if (n.z < 0.0) shade = 0.5;
  else shade = clamp(0.58 + 0.42 * max(0.0, dot(n, vec3(${BAKED_FACE_LIGHT.map(glslFloat).join(", ")}))), 0.5, 1.0);`;

  // src/canalRecall/streetFronts.ts
  var CELL_RANGE = 2 ** 20;

  // src/canalRecall/coplanarSurfaces.ts
  var NEAR_COS = Math.cos(2 * Math.PI / 180);

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
  function canalGroundGeometry(v) {
    const axes = Array.from({ length: v.windows }, (_, i) => (i + 0.5) / v.windows);
    return { axes, width: 0.66 / v.windows, sill: v.groundAssembly === "tall-side-entry" ? 0.14 : 0.06, head: 0.91, doorAxis: axes[axes.length - 1] };
  }
  function bayDoorGeometry(v) {
    const quiet = v.trimDensity === "restrained";
    if (v.groundAssembly) {
      const row = canalGroundGeometry(v);
      return { x: BAY_PX * (row.doorAxis - row.width / 2), width: BAY_PX * row.width, height: GROUND_PX * (row.head - row.sill), bottom: GROUND_PX * row.sill, fanlight: false };
    }
    if (v.entranceAssembly === "raised-plain") return { x: BAY_PX * 0.71, width: BAY_PX * 0.18, height: 222, bottom: 70, fanlight: false };
    if (v.entranceAssembly === "raised-pilaster") return { x: BAY_PX * 0.115, width: BAY_PX * 0.18, height: 222, bottom: 52, fanlight: true };
    if (v.facadeAssembly === "stacked-open-balcony") return { x: BAY_PX * (0.5 - 0.14), width: BAY_PX * 0.28, height: 274, bottom: 24, fanlight: false };
    return { x: BAY_PX * 0.14, width: quiet ? 98 : 118, height: quiet ? 214 : 226, bottom: 24, fanlight: !quiet };
  }
  function bayDoorWindowGeometry(v, look = "photo") {
    const quiet = v.trimDensity === "restrained";
    if (v.groundAssembly) {
      const row = canalGroundGeometry(v);
      return { axis: row.axes[0], width: BAY_PX * row.width, y: GROUND_PX * (1 - row.head), height: GROUND_PX * (row.head - row.sill) };
    }
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

  // src/canalRecall/buurtProfiles/modern-pand-walls.json
  var modern_pand_walls_default = { schemaVersion: 1, revision: "9d237f1b8d12c75f", licence: "measured from Gemeente Amsterdam panoramas, CC BY 4.0", walls: { "0363100012061174": "b593731", "0363100012061183": "b9a7765", "0363100012061191": "b926e5f", "0363100012061194": "b98827b", "0363100012061340": "pa09391", "0363100012061351": "p8a8b8b", "0363100012061397": "b302017", "0363100012061406": "b4f3427", "0363100012061421": "b70534f", "0363100012061423": "b613c37", "0363100012061425": "b795c58", "0363100012061426": "pb3acb5", "0363100012061476": "b2f201c", "0363100012061511": "pa49d9c", "0363100012061512": "b51312d", "0363100012061516": "p79797c", "0363100012061526": "b372722", "0363100012061572": "b573530", "0363100012061594": "b413531", "0363100012061601": "b402c27", "0363100012061662": "p8a8f91", "0363100012061674": "ba78471", "0363100012061693": "b433733", "0363100012061753": "bad817b", "0363100012061764": "b7f5751", "0363100012061766": "pe9e8e2", "0363100012061779": "b875e58", "0363100012061785": "b6d5650", "0363100012061789": "b58372e", "0363100012061817": "p928d8b", "0363100012061826": "p6f6f71", "0363100012061829": "b75635e", "0363100012061846": "b6b4e4a", "0363100012061854": "p777777", "0363100012061861": "b4e312d", "0363100012061868": "p808d90", "0363100012061873": "pe7e8e8", "0363100012061919": "b5f413d", "0363100012061941": "b6c5e59", "0363100012062013": "b472c25", "0363100012062024": "b644335", "0363100012062029": "pceccc5", "0363100012062065": "b856053", "0363100012062096": "b423532", "0363100012062103": "p989491", "0363100012062134": "p8e8f8e", "0363100012062137": "b4b3731", "0363100012062214": "b402723", "0363100012062237": "pe1d4d3", "0363100012062244": "b5e3e3a", "0363100012062268": "pdad8d8", "0363100012062299": "b6c5e5a", "0363100012062371": "b543929", "0363100012062421": "b8d655c", "0363100012062428": "pe1e4e3", "0363100012062465": "b68514a", "0363100012062493": "b2d221e", "0363100012062525": "p71706f", "0363100012062588": "pe7e8eb", "0363100012062590": "b9f8d88", "0363100012062733": "b452b23", "0363100012062781": "b9d7b68", "0363100012062783": "b6a463c", "0363100012062788": "b493c38", "0363100012062792": "b413431", "0363100012062814": "pe8e8e8", "0363100012062828": "pe1eaec", "0363100012062829": "p616467", "0363100012062904": "p7f8081", "0363100012062920": "b493224", "0363100012062921": "pe8d4cf", "0363100012062922": "b89605a", "0363100012062929": "pddd7d6", "0363100012062953": "pede7e1", "0363100012062954": "b745b54", "0363100012062969": "ba67e71", "0363100012063085": "p636568", "0363100012063090": "ba0786d", "0363100012063098": "b594b47", "0363100012063104": "b654736", "0363100012063223": "p797b7f", "0363100012063229": "pdddbd7", "0363100012063325": "b846e67", "0363100012063386": "pe8e8e7", "0363100012063392": "b795648", "0363100012063394": "pdedad6", "0363100012063418": "b7f5b4e", "0363100012063513": "b463935", "0363100012063521": "b2d211e", "0363100012063593": "p919191", "0363100012063604": "b865f56", "0363100012063608": "b5f524e", "0363100012063613": "pe8d8ce", "0363100012063619": "pe7d5d0", "0363100012063632": "b4c3933", "0363100012063637": "p898d90", "0363100012063640": "pe9e8e5", "0363100012063651": "b402a20", "0363100012063664": "b30201b", "0363100012063680": "b4e413d", "0363100012063682": "b463936", "0363100012063684": "b36241a", "0363100012063722": "b7b6c68", "0363100012063737": "p747475", "0363100012063924": "peee2cd", "0363100012063948": "b685752", "0363100012064015": "b714a45", "0363100012064029": "pe9e8e3", "0363100012064033": "pdfeaed", "0363100012064098": "p64666a", "0363100012064133": "b654736", "0363100012064146": "b886655", "0363100012064147": "bac8976", "0363100012064157": "baf8878", "0363100012064311": "pd3e1df", "0363100012064318": "bb1877d", "0363100012064332": "b6d5750", "0363100012064352": "b493c39", "0363100012064353": "b6c5852", "0363100012064374": "b623c37", "0363100012064385": "b715d57", "0363100012064491": "b856452", "0363100012064533": "p67686b", "0363100012064557": "b714e41", "0363100012064587": "p777878", "0363100012064595": "b9c8071", "0363100012064597": "pb08981", "0363100012064686": "b372622", "0363100012064713": "b4a2d29", "0363100012064740": "b997565", "0363100012064744": "b7e6659", "0363100012064793": "b453024", "0363100012064806": "b705b55", "0363100012064859": "b4b3e3b", "0363100012064888": "b886356", "0363100012064889": "b80706c", "0363100012064891": "b695955", "0363100012064915": "b835e51", "0363100012064954": "ba77c76", "0363100012064956": "ba67e79", "0363100012064959": "pe6d5d0", "0363100012064961": "b654e44", "0363100012064978": "pe4e9ec", "0363100012064987": "bac8976", "0363100012065080": "b5f514d", "0363100012065091": "b785947", "0363100012065096": "b4d3128", "0363100012065097": "b392c29", "0363100012065203": "pe0e0d7", "0363100012065216": "b4c3f3b", "0363100012065234": "p8a9496", "0363100012065271": "pe1dbd4", "0363100012065274": "b704a44", "0363100012065289": "b382c29", "0363100012065298": "pab8e83", "0363100012065310": "pdeeaee", "0363100012065315": "pe1dbd4", "0363100012065317": "b513b35", "0363100012065323": "p9e9ca4", "0363100012065332": "p717573", "0363100012065339": "b5c4944", "0363100012065340": "b40312c", "0363100012065343": "p7c7c7a", "0363100012065350": "b655854", "0363100012065352": "b765645", "0363100012065355": "b625450", "0363100012065358": "p908f8c", "0363100012065438": "pe7e8ea", "0363100012065462": "p9b989c", "0363100012065527": "p818486", "0363100012065550": "b754d48", "0363100012065571": "b685a56", "0363100012065625": "b3b2721", "0363100012065640": "b302017", "0363100012065661": "pece8df", "0363100012065727": "pe2e1d4", "0363100012065731": "b82624f", "0363100012065734": "pc9bdb0", "0363100012065775": "b331e1c", "0363100012065786": "b382c29", "0363100012065795": "b6e5751", "0363100012065800": "b836b64", "0363100012065811": "b714f41", "0363100012065841": "b694a39", "0363100012065847": "b473022", "0363100012065862": "b655550", "0363100012065900": "b553b38", "0363100012066021": "p66686d", "0363100012066022": "b574540", "0363100012066055": "b8b625c", "0363100012066070": "p5e6266", "0363100012066071": "b37251b", "0363100012066077": "b5a3d2c", "0363100012066079": "b3a2924", "0363100012066087": "p716f6a", "0363100012066095": "b6a5853", "0363100012066104": "b584a47", "0363100012066132": "p6c6f73", "0363100012066167": "b321f19", "0363100012066185": "bb1877d", "0363100012066304": "pebcdc2", "0363100012066306": "p757779", "0363100012066314": "b432b22", "0363100012066329": "b433633", "0363100012066364": "b735e58", "0363100012066381": "b3d291e", "0363100012066383": "p656b6b", "0363100012066396": "b5c4740", "0363100012066417": "pa99da1", "0363100012066465": "b473022", "0363100012066485": "b412c20", "0363100012066600": "pd9d9d9", "0363100012066605": "pe7e8ea", "0363100012066609": "p8b8b8a", "0363100012066619": "b624333", "0363100012066630": "b2d211e", "0363100012066649": "b6d493f", "0363100012066691": "b8a736c", "0363100012066702": "b55443e", "0363100012066704": "b6c5e5a", "0363100012066712": "b63423e", "0363100012066721": "b372b27", "0363100012066729": "b423632", "0363100012066770": "b463732", "0363100012066775": "b634339", "0363100012066779": "b523e38", "0363100012066804": "b402b1f", "0363100012066818": "pe6e8eb", "0363100012066835": "p7c7e82", "0363100012066873": "b3d2522", "0363100012066914": "b5a4640", "0363100012066962": "b685a56", "0363100012067063": "p939c9f", "0363100012067155": "b78504b", "0363100012067203": "b6a5448", "0363100012067285": "b4d403c", "0363100012067300": "pe0ddd4", "0363100012067304": "b2d211d", "0363100012067309": "b775846", "0363100012067317": "pa2a7ab", "0363100012067326": "b5b4944", "0363100012067359": "pecd7cc", "0363100012067448": "pece6ef", "0363100012067449": "b332723", "0363100012067455": "p8e8e8d", "0363100012067464": "p797c7e", "0363100012067480": "pe6e8ec", "0363100012067482": "p808083", "0363100012067490": "p939391", "0363100012067508": "b886059", "0363100012067550": "b79514b", "0363100012067558": "pe9dfdc", "0363100012067579": "b3a2d2a", "0363100012067621": "b7b5d59", "0363100012067629": "b452b24", "0363100012067630": "b2d211d", "0363100012067633": "b674538", "0363100012067639": "b6a4d41", "0363100012067677": "pede8df", "0363100012067683": "b473022", "0363100012067794": "b524541", "0363100012067862": "b4e413d", "0363100012067925": "b321f1a", "0363100012067960": "pe7e8e7", "0363100012068119": "b70534f", "0363100012068146": "p78797a", "0363100012068278": "p888889", "0363100012068320": "pdfd7d5", "0363100012068353": "pac8a7f", "0363100012068394": "b4a3d3a", "0363100012068412": "peee3df", "0363100012068417": "p67686b", "0363100012068418": "p696c6e", "0363100012068419": "pe0dbd4", "0363100012068421": "p7d7d7f", "0363100012068422": "b2f201c", "0363100012068423": "p727275", "0363100012068424": "b675854", "0363100012068425": "b7b6c68", "0363100012068432": "pe9e1d9", "0363100012068437": "p787879", "0363100012068439": "p6e6f71", "0363100012068442": "p83817f", "0363100012068444": "b967461", "0363100012068484": "pede2d0", "0363100012068494": "ba37a6f", "0363100012068505": "b875e58", "0363100012068548": "b795947", "0363100012068567": "b5c403c", "0363100012068606": "pe5e8ec", "0363100012068608": "p6c6e6d", "0363100012068644": "pdcdad6", "0363100012068649": "b6d4742", "0363100012068691": "pe9e8e9", "0363100012068830": "b402d28", "0363100012068832": "b6a5a56", "0363100012068868": "b3d312d", "0363100012068892": "b2d211e", "0363100012068934": "b3a2320", "0363100012068956": "b463935", "0363100012069004": "b7f6556", "0363100012069120": "b493c38", "0363100012069124": "b6b5d59", "0363100012069139": "pa59783", "0363100012069148": "b7b544e", "0363100012069229": "b7d554e", "0363100012069230": "b745c4f", "0363100012069232": "pe2dbd3", "0363100012069245": "bac8976", "0363100012069248": "b865e58", "0363100012069259": "p6c6d6d", "0363100012069280": "b635551", "0363100012069282": "b877772", "0363100012069294": "pebe7eb", "0363100012069299": "b766763", "0363100012069322": "b6a453c", "0363100012069353": "pe8e8e7", "0363100012069366": "b492c28", "0363100012069422": "pe0e1e2", "0363100012069452": "b55342f", "0363100012069453": "b392d29", "0363100012069469": "p676768", "0363100012069493": "b3c2721", "0363100012069501": "b432b22", "0363100012069502": "b2e221f", "0363100012069508": "pe4ded2", "0363100012069513": "b4a3630", "0363100012069519": "p646668", "0363100012069532": "b7d5550", "0363100012069536": "b5c3932", "0363100012069606": "b836656", "0363100012069652": "b6e5f5b", "0363100012069670": "b927a6d", "0363100012069743": "b806d68", "0363100012069760": "p858585", "0363100012069870": "b362a26", "0363100012069872": "b614c46", "0363100012069879": "b534642", "0363100012069883": "b6a433e", "0363100012069886": "b724e43", "0363100012069974": "b926b5f", "0363100012070075": "pebe0de", "0363100012070124": "pefd7b9", "0363100012070186": "b564844", "0363100012070208": "b514440", "0363100012070217": "b372823", "0363100012070271": "bac8976", "0363100012070325": "pe0dcd4", "0363100012070358": "b846351", "0363100012070530": "b766560", "0363100012070535": "p747474", "0363100012070537": "b3a2722", "0363100012070543": "p707274", "0363100012070544": "pe9e9dc", "0363100012070545": "pe7d3cf", "0363100012070546": "ba4826e", "0363100012070551": "b402f2a", "0363100012070557": "pb6b4b2", "0363100012070563": "b826250", "0363100012070566": "pe9e8e7", "0363100012070569": "b513b2e", "0363100012070670": "p858787", "0363100012070674": "p898b8a", "0363100012070726": "p9d9797", "0363100012070857": "b7e5c57", "0363100012070880": "pe6e8ea", "0363100012070884": "b423632", "0363100012070931": "b6f4a41", "0363100012070937": "b56342f", "0363100012070970": "b805c4f", "0363100012071008": "b865f55", "0363100012071041": "b5e3b37", "0363100012071161": "p9c969d", "0363100012071188": "b4e3f3a", "0363100012071226": "p6f7172", "0363100012071240": "b3f332f", "0363100012071280": "b3b2f2b", "0363100012071326": "b896756", "0363100012071366": "ba4826e", "0363100012071375": "pb2bbbe", "0363100012071392": "p818185", "0363100012071406": "pe0eaed", "0363100012071432": "p7d7d7d", "0363100012071487": "b34211c", "0363100012071534": "b805a51", "0363100012071632": "p676766", "0363100012071681": "pe7e8ea", "0363100012071682": "b785249", "0363100012071762": "b705342", "0363100012071780": "b4a3732", "0363100012071783": "b80675d", "0363100012071793": "pf2e6ca", "0363100012071794": "b433733", "0363100012071797": "b473a36", "0363100012071872": "b745f5a", "0363100012071883": "b5d402f", "0363100012071922": "b3b2e2b", "0363100012072014": "pefe1cb", "0363100012072076": "b402c27", "0363100012072094": "b574742", "0363100012072100": "pe7e8e9", "0363100012072104": "p6b6b6e", "0363100012072106": "pe8d5cf", "0363100012072124": "b331e1c", "0363100012072125": "b69554f", "0363100012072145": "p686a69", "0363100012072163": "p6b6c6f", "0363100012072169": "b7a534c", "0363100012072172": "b625551", "0363100012072211": "b72605b", "0363100012072300": "p777879", "0363100012072369": "p81807e", "0363100012072376": "b38241e", "0363100012072477": "b734f43", "0363100012072531": "ba37872", "0363100012072573": "p7c7e82", "0363100012072577": "b736460", "0363100012072628": "pdfeaed", "0363100012072634": "p838488", "0363100012072635": "p75787c", "0363100012072638": "b4a2f27", "0363100012072655": "b483b38", "0363100012072659": "b39251f", "0363100012072691": "b2d211e", "0363100012072698": "p7c7d80", "0363100012072705": "pf2e5d9", "0363100012072706": "pdcdcd7", "0363100012072718": "p6a6c6f", "0363100012072719": "b564641", "0363100012072755": "pe6e8ec", "0363100012072790": "b7a5b48", "0363100012072791": "b654039", "0363100012072793": "pa29c98", "0363100012072799": "pe6e3db", "0363100012072828": "pb9b9b9", "0363100012072838": "b947b73", "0363100012072844": "b805f4e", "0363100012072889": "b51312d", "0363100012072892": "b4e3e39", "0363100012072914": "pe6e8ec", "0363100012072941": "p87898b", "0363100012072985": "b594a45", "0363100012073014": "b79524b", "0363100012073031": "b453733", "0363100012073063": "p9b9ea0", "0363100012073078": "b745543", "0363100012073079": "b302017", "0363100012073108": "b7d5d4b", "0363100012073212": "b3e312e", "0363100012073248": "b7d5c4b", "0363100012073298": "b38211f", "0363100012073303": "b724e43", "0363100012073335": "b67413c", "0363100012073348": "pe9e8e2", "0363100012073352": "b643f38", "0363100012073353": "b524541", "0363100012073373": "p666767", "0363100012073448": "p78797a", "0363100012073479": "b6c5e5a", "0363100012073507": "bae8779", "0363100012073514": "b6b4e3d", "0363100012073515": "b856552", "0363100012073518": "b7c574b", "0363100012073519": "p696b6f", "0363100012073589": "p767675", "0363100012073607": "b312522", "0363100012073608": "b997365", "0363100012073612": "b7a5954", "0363100012073653": "b6c4641", "0363100012073712": "b483123", "0363100012073817": "b331e1c", "0363100012073869": "b786059", "0363100012073871": "bac8976", "0363100012073905": "b433633", "0363100012073997": "pf1dbbf", "0363100012074089": "b523e39", "0363100012074151": "b7b6153", "0363100012074177": "b704d41", "0363100012074341": "pa6a6ab", "0363100012074360": "b382b27", "0363100012074363": "b53322e", "0363100012074366": "b806b65", "0363100012074371": "pdfd9d5", "0363100012074393": "b3f322e", "0363100012074425": "pb6b6b5", "0363100012074433": "b6d4641", "0363100012074501": "p998d8a", "0363100012074535": "b7a544a", "0363100012074588": "p7f8386", "0363100012074590": "b4c3f3b", "0363100012074592": "b45322c", "0363100012074649": "b5a3833", "0363100012074665": "pe9e8e2", "0363100012074667": "b4e2f2b", "0363100012074672": "b573530", "0363100012074732": "pece7e9", "0363100012074774": "b39261b", "0363100012074800": "b473023", "0363100012074852": "b8b7468", "0363100012074972": "p5e6163", "0363100012075000": "pedddd0", "0363100012075012": "b987765", "0363100012075022": "b5e3b31", "0363100012075056": "pe9e8e2", "0363100012075106": "p878d90", "0363100012075108": "b5d4d49", "0363100012075109": "pe6e8eb", "0363100012075183": "pa49e9e", "0363100012075218": "pc2b3ac", "0363100012075219": "pd1dde0", "0363100012075229": "b4a3d3a", "0363100012075239": "b443834", "0363100012075315": "b342824", "0363100012075336": "b6f594d", "0363100012075340": "pd8ecef", "0363100012075398": "b836859", "0363100012075401": "pdfeaed", "0363100012075415": "b7e6861", "0363100012075418": "b3e312d", "0363100012075430": "b7c5f5b", "0363100012075441": "b4b3325", "0363100012075554": "bae827c", "0363100012075567": "pd5d1cc", "0363100012075608": "b704b42", "0363100012075717": "b4f423e", "0363100012075723": "b483b37", "0363100012075800": "pebe8e3", "0363100012075801": "p7e7d7e", "0363100012075806": "pa5a2a3", "0363100012075819": "b6f615d", "0363100012075864": "b81726e", "0363100012075897": "b4e3129", "0363100012075924": "pe9d6ce", "0363100012075946": "b755644", "0363100012075953": "p6d7073", "0363100012075967": "peae8e1", "0363100012075973": "b765f53", "0363100012075992": "pe7e8ea", "0363100012075996": "b3b2c28", "0363100012076109": "b684641", "0363100012076191": "p767576", "0363100012076200": "b8e6d5a", "0363100012076204": "p76787a", "0363100012076260": "b6e534f", "0363100012076275": "b614332", "0363100012076347": "b5f4130", "0363100012076365": "b403430", "0363100012076385": "b755344", "0363100012076484": "b574945", "0363100012076526": "p868584", "0363100012076535": "b413430", "0363100012076537": "b534541", "0363100012076561": "pa0a19f", "0363100012076564": "b865d58", "0363100012076582": "p6f6f70", "0363100012076623": "b7d594b", "0363100012076645": "b644736", "0363100012076773": "b5a4c49", "0363100012076780": "b5a4c48", "0363100012076789": "b4a2f26", "0363100012076885": "bb2867f", "0363100012076900": "b4d403c", "0363100012076903": "b80604d", "0363100012076908": "pdfddd5", "0363100012076914": "p88898a", "0363100012076916": "p7e7e7f", "0363100012076920": "pe6dbd0", "0363100012076963": "pe7ded4", "0363100012077055": "b32201b", "0363100012077068": "b7d645c", "0363100012077069": "b6b4a3b", "0363100012077074": "b6d5b56", "0363100012077078": "b6a443f", "0363100012077111": "b6d5954", "0363100012077120": "b8d645e", "0363100012077174": "bab8984", "0363100012077177": "pdbdad8", "0363100012077178": "b704944", "0363100012077199": "pe3e2da", "0363100012077229": "b675853", "0363100012077234": "pe0eaed", "0363100012077277": "b3b2b27", "0363100012077315": "p828587", "0363100012077318": "b5d4e4a", "0363100012077370": "b624b45", "0363100012077426": "b321f19", "0363100012077428": "pada5a1", "0363100012077514": "pdfdad5", "0363100012077535": "b503a30", "0363100012077570": "pddd8d6", "0363100012077581": "ba88172", "0363100012077582": "b5b453f", "0363100012077619": "pe6d8d0", "0363100012077623": "b866e67", "0363100012077638": "b6b4a3c", "0363100012077647": "b38251f", "0363100012077652": "baf8879", "0363100012077654": "pa7998d", "0363100012077691": "b3c302d", "0363100012077697": "b835a55", "0363100012077698": "b603b36", "0363100012077700": "b35241f", "0363100012077717": "pf3e2c8", "0363100012077732": "b422b21", "0363100012077989": "b69433d", "0363100012078005": "b3f332f", "0363100012078041": "b4c3f3b", "0363100012078061": "p868789", "0363100012078075": "p717579", "0363100012078077": "b2f201c", "0363100012078099": "b786155", "0363100012078103": "bb1877e", "0363100012078158": "p6f6f70", "0363100012078175": "pe9d7ce", "0363100012078218": "pe9e8e7", "0363100012078232": "b54443f", "0363100012078282": "p5c6063", "0363100012078322": "pe8dbcf", "0363100012078337": "bac8976", "0363100012078456": "b825d50", "0363100012078542": "b533d30", "0363100012078592": "b684e40", "0363100012078594": "p737575", "0363100012078614": "b5c3e2d", "0363100012078631": "pd0dfe1", "0363100012078693": "p6a6f71", "0363100012078714": "pe9e9e0", "0363100012078715": "b4d2f2b", "0363100012078729": "p797878", "0363100012078732": "b5b4437", "0363100012078736": "b6b4c3b", "0363100012078773": "b8e7263", "0363100012078790": "b392c28", "0363100012078863": "b372723", "0363100012078877": "peed5c3", "0363100012078896": "p727474", "0363100012078931": "pe9e8e3", "0363100012078936": "p7b7d7d", "0363100012078939": "pd6d7db", "0363100012079019": "p6f6f73", "0363100012079079": "p9c9897", "0363100012079124": "b775247", "0363100012079148": "b5e3a35", "0363100012079210": "p918c8a", "0363100012079282": "p7d7d7e", "0363100012079489": "p818385", "0363100012079510": "b30201b", "0363100012079539": "b7a5949", "0363100012079571": "b634534", "0363100012079596": "p5d5e62", "0363100012079627": "b856153", "0363100012079636": "pd1dee0", "0363100012079687": "pe9e8e2", "0363100012079698": "b6e4742", "0363100012079700": "pe9e8e6", "0363100012079712": "b5d4a45", "0363100012079713": "b7a534a", "0363100012079729": "b644541", "0363100012079788": "b745144", "0363100012079797": "b6b443f", "0363100012079847": "b6b544a", "0363100012079918": "b6c4a3c", "0363100012080137": "b653f3a", "0363100012080202": "b4b3e3a", "0363100012080301": "b6a433e", "0363100012080322": "p66676b", "0363100012080328": "pbbbcbd", "0363100012080355": "b7b534e", "0363100012080363": "b352925", "0363100012080414": "b5d4f4c", "0363100012080430": "b6e554b", "0363100012080460": "b533f39", "0363100012080486": "b4a3a36", "0363100012080487": "p797979", "0363100012080570": "pdfdfd5", "0363100012080605": "b321f1a", "0363100012080620": "pd4d8dc", "0363100012080657": "b7e5651", "0363100012080660": "b472e2a", "0363100012080685": "pae8679", "0363100012080744": "b3b2e2b", "0363100012080815": "b946f61", "0363100012080820": "b7c6862", "0363100012080868": "b3a2722", "0363100012080873": "p898888", "0363100012080952": "p7f8385", "0363100012081040": "p737373", "0363100012081044": "b4c3933", "0363100012081065": "pa0918b", "0363100012081071": "b4a3d39", "0363100012081083": "b734c46", "0363100012081097": "p6e7578", "0363100012081138": "pdddbd7", "0363100012081151": "b453935", "0363100012081168": "b795947", "0363100012081169": "b3d302d", "0363100012081178": "peee6ec", "0363100012081184": "pddd9d6", "0363100012081186": "b413430", "0363100012081205": "b321f19", "0363100012081264": "b3b2f2b", "0363100012081266": "b79594e", "0363100012081273": "pe0d9d4", "0363100012081297": "b392d29", "0363100012081310": "p8a8a87", "0363100012081313": "b332119", "0363100012081319": "p97979e", "0363100012081428": "p959699", "0363100012081432": "pdbdad8", "0363100012081434": "b442e21", "0363100012081463": "pdbebee", "0363100012081520": "b5a4a45", "0363100012081612": "pe0eaed", "0363100012081616": "p646362", "0363100012081629": "b5d3934", "0363100012081687": "b44342f", "0363100012081749": "b3a2320", "0363100012081793": "pe0dbd5", "0363100012081808": "p757577", "0363100012081813": "b2d211e", "0363100012081817": "b726460", "0363100012081836": "b7f6251", "0363100012081875": "b916c5e", "0363100012081921": "pdcdbd7", "0363100012081927": "b443834", "0363100012081933": "b9b7966", "0363100012081936": "p7b7d80", "0363100012081938": "b422922", "0363100012081941": "b352926", "0363100012081948": "b825d51", "0363100012081953": "b4f3328", "0363100012082081": "b7e665f", "0363100012082082": "b4c3c37", "0363100012082093": "b5d3834", "0363100012082095": "b4a3d39", "0363100012082096": "b81614f", "0363100012082097": "pe5d9d1", "0363100012082141": "pebe2e2", "0363100012082143": "b5a4944", "0363100012082151": "b765a54", "0363100012082153": "b4a3d39", "0363100012082159": "b34221a", "0363100012082160": "bb0887a", "0363100012082161": "b43302b", "0363100012082167": "b42322e", "0363100012082171": "b4b3229", "0363100012082221": "pe4dbd1", "0363100012082242": "b50433f", "0363100012082246": "b9a706a", "0363100012082270": "b341f1c", "0363100012082324": "b805852", "0363100012082383": "b9e7b68", "0363100012082469": "b6e605c", "0363100012082489": "b4e312d", "0363100012082563": "b836350", "0363100012082622": "b604c47", "0363100012082680": "b62433f", "0363100012082684": "b977562", "0363100012082699": "b4b3326", "0363100012082706": "b43302b", "0363100012082724": "b3c2d28", "0363100012082730": "b785f58", "0363100012082831": "pddd8d6", "0363100012082843": "p797d80", "0363100012082894": "pe7e9e7", "0363100012083034": "bb0857c", "0363100012083055": "b846c5f", "0363100012083169": "p9e9591", "0363100012083219": "p93908a", "0363100012083222": "p7b7d7f", "0363100012083230": "b3f2622", "0363100012083237": "b2f221e", "0363100012083316": "pe1ded4", "0363100012083320": "b503c36", "0363100012083333": "pdbcad7", "0363100012083335": "b493c38", "0363100012083337": "b433733", "0363100012083341": "ba68370", "0363100012083364": "b524541", "0363100012083370": "p6d6f6e", "0363100012083381": "b6f4843", "0363100012083398": "p958f8f", "0363100012083407": "p828283", "0363100012083408": "p686869", "0363100012083426": "pebe6ee", "0363100012083428": "b704d40", "0363100012083461": "pe0dbd5", "0363100012083502": "b795947", "0363100012083510": "b865e58", "0363100012083540": "p858482", "0363100012083568": "peae3e0", "0363100012083576": "p9c9998", "0363100012083621": "bae8979", "0363100012083627": "b6b5447", "0363100012083640": "b7a635c", "0363100012083641": "pdfd8e2", "0363100012083675": "pe3d8d2", "0363100012083691": "pe9e8e7", "0363100012083722": "b755d56", "0363100012083820": "b714a44", "0363100012083841": "b684f48", "0363100012083857": "pefd7ca", "0363100012083899": "pdedcd6", "0363100012083950": "p737575", "0363100012083975": "pe7e8e8", "0363100012084008": "p636669", "0363100012084065": "b2e211d", "0363100012084086": "b977d76", "0363100012084087": "p6c6b6b", "0363100012084088": "b735748", "0363100012084090": "b5b473b", "0363100012084091": "pe9d9ce", "0363100012084093": "b68433b", "0363100012084100": "b5a4030", "0363100012084111": "pe7e8eb", "0363100012084115": "b5b3832", "0363100012084133": "b98827b", "0363100012084136": "pdbdcd8", "0363100012084137": "b816758", "0363100012084167": "pe1e1d4", "0363100012084191": "b423632", "0363100012084197": "pe8e8e5", "0363100012084229": "b4d403c", "0363100012084235": "pe8e8e7", "0363100012084237": "p6b6d6f", "0363100012084248": "ba27d6d", "0363100012084293": "b633d38", "0363100012084305": "b331e1c", "0363100012084323": "b634135", "0363100012084381": "b53332c", "0363100012084392": "b2f201c", "0363100012084424": "b5c3a34", "0363100012084458": "b4c3c37", "0363100012084479": "pddddd7", "0363100012084523": "b574843", "0363100012084551": "p7a7b7e", "0363100012084581": "b3e2f2a", "0363100012084598": "pb0b7b9", "0363100012084787": "p848787", "0363100012084844": "b4d403c", "0363100012084886": "b544643", "0363100012084893": "p6f7476", "0363100012084896": "b554844", "0363100012084943": "b433632", "0363100012084945": "b3d312d", "0363100012084986": "pe0dad4", "0363100012085005": "p5c6164", "0363100012085021": "b704944", "0363100012085057": "pdfd9d5", "0363100012085096": "pdeddd6", "0363100012085145": "p616163", "0363100012085191": "b6e4f3d", "0363100012085245": "pada49f", "0363100012085279": "p777877", "0363100012085285": "b805d4e", "0363100012085294": "b352319", "0363100012085383": "b4c3f3b", "0363100012085397": "pe9e8e4", "0363100012085405": "pe1d5d3", "0363100012085440": "b4e413d", "0363100012085454": "b79615a", "0363100012085466": "b7a5d59", "0363100012085475": "b4d372a", "0363100012085480": "b553e30", "0363100012085503": "pb0bbbc", "0363100012085508": "b6c5047", "0363100012085509": "b4e3832", "0363100012085518": "p6e7476", "0363100012085552": "pe6e6e0", "0363100012085588": "p888989", "0363100012085591": "pe9e9de", "0363100012085619": "pe8e8e7", "0363100012085662": "b654837", "0363100012085726": "p6f706f", "0363100012085746": "b855f53", "0363100012085775": "pe7e8e7", "0363100012085783": "b93796a", "0363100012085794": "b5b4e4a", "0363100012085840": "p7b7b7c", "0363100012085883": "p5e6264", "0363100012085928": "b6a493b", "0363100012086015": "p75767a", "0363100012086021": "b4b3e3a", "0363100012086038": "pe6dad9", "0363100012086049": "peae8dc", "0363100012086073": "b786965", "0363100012086075": "b5f4340", "0363100012086090": "b675651", "0363100012086096": "pe6e8eb", "0363100012086113": "pd9d7d5", "0363100012086124": "b603b36", "0363100012086134": "p7d7d7e", "0363100012086161": "b5d3b37", "0363100012086173": "p848a8c", "0363100012086196": "p878787", "0363100012086323": "p707171", "0363100012086351": "pe8d4e8", "0363100012086358": "b855d57", "0363100012086384": "b4e413d", "0363100012086398": "pe2d8d3", "0363100012086460": "b3a2d29", "0363100012086476": "b714d42", "0363100012086497": "p626363", "0363100012086577": "b93715e", "0363100012086629": "b3d312d", "0363100012086661": "pa1a09f", "0363100012086705": "p848485", "0363100012086718": "p7a7979", "0363100012086773": "pe8dbcf", "0363100012086778": "b6c4b3d", "0363100012086812": "b473833", "0363100012086835": "p9b9d9b", "0363100012086843": "bab8a77", "0363100012086844": "b482d2a", "0363100012086854": "b573530", "0363100012086899": "b93725f", "0363100012086918": "b655753", "0363100012086924": "b68544f", "0363100012086926": "b332119", "0363100012086964": "b5d4f4b", "0363100012086976": "b473a36", "0363100012086985": "pdbebee", "0363100012086999": "bac8976", "0363100012087004": "b70615c", "0363100012087100": "bb1877d", "0363100012087123": "pe6e8ec", "0363100012087131": "b493c38", "0363100012087132": "b856452", "0363100012087133": "b906e5c", "0363100012087142": "b6c4640", "0363100012087146": "p939291", "0363100012087147": "b8d7a75", "0363100012087150": "pf1e7d8", "0363100012087205": "pece7e2", "0363100012087230": "b69453c", "0363100012087251": "b936963", "0363100012087266": "b6a5347", "0363100012087309": "b6d4b3d", "0363100012087332": "b422c20", "0363100012087338": "b473733", "0363100012087349": "pe3e9ec", "0363100012087358": "b533829", "0363100012087364": "pf4e3c2", "0363100012087369": "pe3dcd2", "0363100012087453": "b654b3d", "0363100012087472": "p686a6c", "0363100012087478": "b825a52", "0363100012087538": "p9b9b9a", "0363100012087545": "b4d2e2a", "0363100012087600": "p6e7074", "0363100012087653": "b423632", "0363100012087683": "pe9d6ce", "0363100012087733": "b806353", "0363100012087769": "pe8e9e2", "0363100012087884": "b7d6f6b", "0363100012087909": "b473a36", "0363100012087918": "pe7e8e8", "0363100012087921": "b685a56", "0363100012087967": "pe5d7d1", "0363100012087971": "b715d57", "0363100012088011": "b655652", "0363100012088083": "b7b534e", "0363100012088115": "b50433f", "0363100012088162": "pcac1c0", "0363100012088200": "pe6e8ec", "0363100012088312": "p7b7b7b", "0363100012088342": "b3a271c", "0363100012088365": "b4c3c38", "0363100012088440": "pede7e0", "0363100012088442": "b52332f", "0363100012088502": "b4e3526", "0363100012088525": "b564945", "0363100012088529": "b3c2f2c", "0363100012088555": "pe8e8ec", "0363100012088592": "b906660", "0363100012088605": "p646667", "0363100012088609": "b9a7565", "0363100012088742": "b30201b", "0363100012088744": "b3c271e", "0363100012088764": "pe7e8ea", "0363100012088780": "b382c28", "0363100012088844": "b3e2f2a", "0363100012088851": "pd8d9da", "0363100012088924": "b82625d", "0363100012088940": "p8b8a88", "0363100012088983": "b463834", "0363100012089012": "p5f6063", "0363100012089044": "b896357", "0363100012089062": "p818a8c", "0363100012089070": "b3b2c27", "0363100012089079": "b8a6558", "0363100012089149": "b63423d", "0363100012089150": "b725341", "0363100012089162": "b967461", "0363100012089166": "p888d90", "0363100012089167": "ba77c76", "0363100012089186": "b675853", "0363100012089232": "b5e4130", "0363100012089241": "b7e594e", "0363100012089244": "b321f1a", "0363100012089250": "ba98673", "0363100012089254": "bad827b", "0363100012089255": "b876c5e", "0363100012089258": "p767776", "0363100012089264": "b514440", "0363100012089278": "p878b8e", "0363100012089288": "b5d4335", "0363100012089289": "b514340", "0363100012089345": "b443834", "0363100012089363": "p767679", "0363100012089407": "b573531", "0363100012089515": "p626465", "0363100012089516": "pe7e8eb", "0363100012089547": "p707277", "0363100012089741": "pece7e4", "0363100012089765": "b33241f", "0363100012089770": "p6f797a", "0363100012089816": "b896661", "0363100012089848": "b472b27", "0363100012089903": "p7f8184", "0363100012089935": "pece7e0", "0363100012089994": "b805d4e", "0363100012090012": "b302421", "0363100012090018": "p878a8d", "0363100012090019": "b6b443f", "0363100012090048": "p6d6c6d", "0363100012090061": "pe6dcd1", "0363100012090062": "b7f5e4c", "0363100012090070": "b73605a", "0363100012090072": "p9a9899", "0363100012090077": "pe2e3e0", "0363100012090083": "pded7d5", "0363100012090151": "b6e4b3e", "0363100012090190": "b72514c", "0363100012090221": "b594b47", "0363100012090225": "b7a6761", "0363100012090247": "b6b4540", "0363100012090286": "p696b6c", "0363100012090297": "b7a5a48", "0363100012090312": "p787878", "0363100012090383": "pa09b96", "0363100012090384": "bac8976", "0363100012090393": "p939391", "0363100012090411": "b3b2b26", "0363100012090496": "b79514b", "0363100012090563": "p898a8a", "0363100012090568": "pdedad5", "0363100012090569": "p8d8e89", "0363100012090873": "pe8e9e0", "0363100012090900": "b513529", "0363100012090902": "b764f49", "0363100012090922": "b443430", "0363100012090923": "b785348", "0363100012090926": "b7b6258", "0363100012090929": "p767b79", "0363100012090952": "b704b41", "0363100012090957": "b785846", "0363100012090981": "pd6d8db", "0363100012090983": "b52433e", "0363100012090998": "b554541", "0363100012091015": "b997365", "0363100012091071": "b49302a", "0363100012091077": "b865e58", "0363100012091093": "ba47a73", "0363100012091135": "b4a3326", "0363100012091167": "b362a26", "0363100012091192": "b634036", "0363100012091237": "b39261b", "0363100012091240": "p767676", "0363100012091356": "b4f413d", "0363100012091393": "b63514c", "0363100012091397": "b32231f", "0363100012091445": "b856253", "0363100012091476": "pe6e8eb", "0363100012091500": "ba57a74", "0363100012091502": "p74797b", "0363100012091504": "p6c6c6d", "0363100012091506": "b2f201c", "0363100012091566": "b4c2e2a", "0363100012091569": "p757574", "0363100012091574": "b5b4741", "0363100012091584": "pc0ad9f", "0363100012091595": "p74787a", "0363100012091615": "b7d5d4b", "0363100012091622": "p747476", "0363100012091663": "b38261b", "0363100012091669": "b34211c", "0363100012091682": "p818487", "0363100012091699": "b524541", "0363100012091704": "b66403b", "0363100012091743": "b433633", "0363100012091764": "pece7e4", "0363100012091811": "b574a46", "0363100012091856": "b30201b", "0363100012091870": "ba68370", "0363100012091916": "pddebed", "0363100012091926": "b2d211e", "0363100012091928": "b906660", "0363100012091934": "b4c3833", "0363100012091943": "p737374", "0363100012092129": "b926961", "0363100012092141": "b6c534d", "0363100012092181": "b9e736d", "0363100012092190": "b331e1c", "0363100012092212": "b60514d", "0363100012092249": "pb29a89", "0363100012092274": "b634036", "0363100012092292": "b6d4a3e", "0363100012092336": "pe6d8d0", "0363100012092346": "p8b8c8b", "0363100012092347": "b755146", "0363100012092387": "b7a6b67", "0363100012092452": "b4f3e39", "0363100012092456": "b6e4841", "0363100012092459": "b302017", "0363100012092463": "pdfdcd5", "0363100012092464": "pdfdbd5", "0363100012092466": "p767675", "0363100012092468": "b493529", "0363100012092469": "ba4816e", "0363100012092479": "pe5e8ec", "0363100012092492": "b926961", "0363100012092508": "pdddad0", "0363100012092540": "ba37e6e", "0363100012092542": "b593632", "0363100012092586": "b4b2e2a", "0363100012092592": "b775b55", "0363100012092595": "b806556", "0363100012092758": "b685954", "0363100012092762": "pe8e8e3", "0363100012092785": "pa9a2a1", "0363100012092817": "b8b6757", "0363100012092840": "p737575", "0363100012092853": "p8e8c8b", "0363100012092886": "pe2dfda", "0363100012093087": "pcacac4", "0363100012093129": "p898887", "0363100012093144": "b7d564e", "0363100012093205": "paeaca8", "0363100012093267": "p978e82", "0363100012093273": "p77797c", "0363100012093323": "pe7e8eb", "0363100012093333": "b352925", "0363100012093334": "b443733", "0363100012093356": "b815c51", "0363100012093363": "b745544", "0363100012093394": "pbc898f", "0363100012093418": "pece7e9", "0363100012093428": "b2e201c", "0363100012093432": "b674b3b", "0363100012093458": "b907b75", "0363100012093534": "b56433e", "0363100012093535": "pdfd8d5", "0363100012093544": "b3c302c", "0363100012093576": "b584b47", "0363100012093587": "peedbcb", "0363100012093612": "b4b3a35", "0363100012093652": "b7b5b49", "0363100012093660": "pe5e9eb", "0363100012093680": "b4c362a", "0363100012093688": "b2d211d", "0363100012093696": "p777877", "0363100012093828": "ba07b6b", "0363100012093853": "p6d6d6d", "0363100012093892": "b3c291e", "0363100012093901": "b3a2823", "0363100012093931": "b6f503f", "0363100012093932": "pd0cdc8", "0363100012093937": "pd6d7db", "0363100012094001": "pe7e8ec", "0363100012094168": "p6e7272", "0363100012094217": "bac8976", "0363100012094236": "p616568", "0363100012094258": "b6f615d", "0363100012094263": "b906f5c", "0363100012094273": "p6b6f71", "0363100012094274": "pe4e2db", "0363100012094275": "bb2867f", "0363100012094277": "bb0877b", "0363100012094301": "b805c4e", "0363100012094401": "ba98673", "0363100012094409": "p7c7c7c", "0363100012094427": "pa7a7ad", "0363100012094436": "pebe7ef", "0363100012094438": "b422824", "0363100012094441": "b9e7c69", "0363100012094442": "b906c67", "0363100012094447": "pe8e8e6", "0363100012094454": "b50302c", "0363100012094483": "b403430", "0363100012094491": "b947e77", "0363100012094494": "p7b7a7b", "0363100012094498": "b331e1c", "0363100012094544": "b382b27", "0363100012094557": "pe1d9d4", "0363100012094562": "p878887", "0363100012094603": "p696a6c", "0363100012094683": "b6b453e", "0363100012094717": "b5e3a33", "0363100012094741": "pe8e8e7", "0363100012094753": "b5b3733", "0363100012094781": "b92715e", "0363100012094801": "pd1dde0", "0363100012094912": "b644236", "0363100012094931": "p818382", "0363100012095109": "bb28680", "0363100012095114": "b84625b", "0363100012095135": "p9c8c8c", "0363100012095154": "b77504b", "0363100012095172": "p5d6263", "0363100012095174": "b54352c", "0363100012095236": "b2f201c", "0363100012095279": "b815f4f", "0363100012095309": "b826050", "0363100012095355": "b937666", "0363100012095427": "b31201b", "0363100012095661": "p88888a", "0363100012095680": "bb2877e", "0363100012095694": "b7a5649", "0363100012095718": "p707170", "0363100012095727": "pdfddd5", "0363100012095775": "p8c8c8e", "0363100012095791": "b846c5f", "0363100012095800": "b846859", "0363100012095871": "b382c28", "0363100012095885": "pefdbcb", "0363100012095888": "pefe6e3", "0363100012095891": "b52322e", "0363100012095892": "b5d3934", "0363100012095893": "pddd9d6", "0363100012095911": "pefe8d7", "0363100012095935": "b3d302c", "0363100012095955": "bac8976", "0363100012096009": "b342825", "0363100012096014": "p767675", "0363100012096039": "p757b7d", "0363100012096044": "pe2e2dc", "0363100012096045": "pe8e8e8", "0363100012096077": "b554642", "0363100012096113": "p79797b", "0363100012096121": "pb0bbbd", "0363100012096169": "b7b564a", "0363100012096184": "b926c5f", "0363100012096198": "b443834", "0363100012096217": "b8a6b63", "0363100012096256": "b5f4e49", "0363100012096316": "b573530", "0363100012096352": "b46312b", "0363100012096361": "b6e4d3e", "0363100012096362": "b765545", "0363100012096427": "b6c4b3d", "0363100012096437": "b836b64", "0363100012096440": "b6f5851", "0363100012096510": "pebe8dc", "0363100012096610": "pdfdad5", "0363100012096654": "b2d211e", "0363100012096674": "b4e3427", "0363100012096708": "b8c6b58", "0363100012096712": "ba08d87", "0363100012096799": "pe0ddd4", "0363100012096802": "p8e8d8d", "0363100012096861": "b523935", "0363100012096871": "b7d6e6a", "0363100012096873": "b584a46", "0363100012096874": "pe6d8d0", "0363100012096880": "pbdbebf", "0363100012096971": "b765147", "0363100012097063": "pe8e8e8", "0363100012097075": "b665550", "0363100012097110": "pe5dad7", "0363100012097170": "b8d6c59", "0363100012097191": "b563c2c", "0363100012097247": "b785249", "0363100012097259": "pe8d6cf", "0363100012097356": "p707170", "0363100012097411": "p6a6c6f", "0363100012097419": "b524541", "0363100012097443": "bb1877d", "0363100012097445": "b3d2a1f", "0363100012097448": "pc3bbb2", "0363100012097452": "b583531", "0363100012097458": "pdcc7da", "0363100012097461": "b6d5f5b", "0363100012097468": "pdddbd6", "0363100012097470": "p848383", "0363100012097499": "p969594", "0363100012097506": "b5e3935", "0363100012097565": "b704e49", "0363100012097589": "b3b2b26", "0363100012097595": "b7a6b67", "0363100012097600": "b6e605c", "0363100012097623": "ba5826f", "0363100012097759": "b43322c", "0363100012097809": "b967461", "0363100012097812": "b694939", "0363100012097817": "p6b7073", "0363100012097818": "b674539", "0363100012097851": "b654736", "0363100012097865": "baa8474", "0363100012097872": "b745145", "0363100012097932": "b926862", "0363100012097943": "b754f46", "0363100012098018": "b432c21", "0363100012098051": "pd0dde0", "0363100012098078": "b493935", "0363100012098127": "p7c7c7b", "0363100012098143": "p8e9091", "0363100012098212": "b6d5d58", "0363100012098240": "b4d372a", "0363100012098250": "b3f2f2a", "0363100012098267": "bac8976", "0363100012098286": "b795548", "0363100012098287": "pa78d86", "0363100012098291": "paba49e", "0363100012098293": "b312522", "0363100012098294": "b73615c", "0363100012098315": "b4a3c38", "0363100012098401": "p7c7c7a", "0363100012098424": "b614a43", "0363100012098488": "b36231a", "0363100012098508": "b835f51", "0363100012098510": "b64504a", "0363100012098521": "b986e68", "0363100012098526": "pd6e3dd", "0363100012098529": "b3d312d", "0363100012098601": "b403330", "0363100012098602": "b342723", "0363100012098605": "b6e524e", "0363100012098639": "b574a46", "0363100012098672": "b866553", "0363100012098736": "b6d5f5b", "0363100012098738": "peee7df", "0363100012098763": "pe8d6cf", "0363100012098805": "bae837a", "0363100012098858": "p77797b", "0363100012098861": "b35211c", "0363100012098864": "b926963", "0363100012098903": "b9a7765", "0363100012098907": "p737578", "0363100012098912": "p6f6f71", "0363100012098917": "b453531", "0363100012098937": "p717275", "0363100012098941": "p878887", "0363100012098962": "b866e67", "0363100012098968": "b3d2f2b", "0363100012099136": "p626364", "0363100012099153": "b765146", "0363100012099154": "b5d4d48", "0363100012099206": "b70625e", "0363100012099207": "p918f8d", "0363100012099209": "b635551", "0363100012099264": "b331e1b", "0363100012099304": "pd3dcde", "0363100012099321": "b433632", "0363100012099330": "b513a2e", "0363100012099405": "p9a9b9c", "0363100012099413": "b423632", "0363100012099471": "b4d403c", "0363100012099476": "b574742", "0363100012099521": "b715240", "0363100012099552": "pe2e1d3", "0363100012099553": "b744d47", "0363100012099591": "pebddcd", "0363100012099619": "b54443f", "0363100012099680": "bae8978", "0363100012099682": "b62524e", "0363100012099683": "b7f6c66", "0363100012099686": "b4a3d3a", "0363100012099691": "p878787", "0363100012099711": "b463935", "0363100012099717": "b5c4e4a", "0363100012099730": "pe1d9d4", "0363100012099741": "b473a37", "0363100012099743": "b8d7060", "0363100012099755": "b3b2a25", "0363100012099767": "p818588", "0363100012099770": "b764f4a", "0363100012099815": "ba77c76", "0363100012099850": "b503a2e", "0363100012099852": "p5d6266", "0363100012099865": "b645652", "0363100012099876": "b6d5954", "0363100012099884": "b533c32", "0363100012099887": "peae7ed", "0363100012099909": "b7b5c57", "0363100012099958": "p626566", "0363100012099959": "b977562", "0363100012099966": "pe7e8eb", "0363100012100041": "b613b36", "0363100012100049": "p908e8c", "0363100012100103": "p888a8b", "0363100012100117": "p727372", "0363100012100258": "b8d635e", "0363100012100322": "p606669", "0363100012100342": "b533c35", "0363100012100354": "b766763", "0363100012100386": "b493935", "0363100012100406": "b73605a", "0363100012100415": "b604a43", "0363100012100418": "pb2a8a2", "0363100012100460": "pe7e8e8", "0363100012100468": "b443733", "0363100012100522": "b9c7f76", "0363100012100525": "b483934", "0363100012100527": "p8c8d8c", "0363100012100534": "pe7e8ea", "0363100012100554": "b815c50", "0363100012100610": "b4a3a36", "0363100012100613": "b3b2823", "0363100012100616": "b886157", "0363100012100635": "b724d43", "0363100012100677": "b362a27", "0363100012100680": "b554844", "0363100012100709": "b735043", "0363100012100853": "b785349", "0363100012100866": "b70524e", "0363100012100890": "bab877a", "0363100012100903": "b866055", "0363100012100957": "p979391", "0363100012100973": "b655753", "0363100012100994": "b836051", "0363100012101053": "b796059", "0363100012101096": "b7e5650", "0363100012101117": "pe6dcd3", "0363100012101141": "pd8d3d9", "0363100012101151": "b594b47", "0363100012101170": "b976d67", "0363100012101175": "b493c38", "0363100012101184": "p868788", "0363100012101185": "b493c38", "0363100012101188": "b6a524b", "0363100012101198": "p6f7375", "0363100012101208": "p636464", "0363100012101263": "b5a4c49", "0363100012101264": "b584a47", "0363100012101281": "pa0908a", "0363100012101289": "pdedbd6", "0363100012101301": "b3d2a1f", "0363100012101315": "pebe6ef", "0363100012101350": "b3c291e", "0363100012101376": "p757a7c", "0363100012101422": "b50413c", "0363100012101532": "b815953", "0363100012101656": "b6a443f", "0363100012101684": "b60504c", "0363100012101736": "b685a56", "0363100012101743": "p7d8285", "0363100012101750": "bab807a", "0363100012101754": "p747578", "0363100012101755": "p6b6d70", "0363100012101867": "p636465", "0363100012101949": "b947060", "0363100012101986": "b2f2320", "0363100012102028": "b725c55", "0363100012102046": "pe6dcd5", "0363100012102051": "b987663", "0363100012102052": "p606162", "0363100012102082": "b321f19", "0363100012102084": "b37241e", "0363100012102155": "bb28680", "0363100012102211": "p727474", "0363100012102238": "b896558", "0363100012102256": "p9a9593", "0363100012102283": "b331e1c", "0363100012102311": "pe1d8d3", "0363100012102314": "b92746f", "0363100012102317": "pd0dee1", "0363100012102321": "pe3eae6", "0363100012102371": "b42322e", "0363100012102380": "b412c20", "0363100012102381": "pb4b6b9", "0363100012102384": "b523731", "0363100012102410": "b553f33", "0363100012102442": "pe8e8e8", "0363100012102465": "b987663", "0363100012102476": "b3c2c28", "0363100012102518": "b4a3d3a", "0363100012102529": "b524541", "0363100012102565": "b3e312e", "0363100012102711": "bb28680", "0363100012102765": "b321f19", "0363100012102795": "b372723", "0363100012102904": "b695144", "0363100012102922": "b5d3834", "0363100012102929": "b634f4a", "0363100012102935": "b483124", "0363100012103004": "b2d211e", "0363100012103017": "b856a5b", "0363100012103094": "b594b48", "0363100012103124": "peed5c9", "0363100012103140": "pe9e8e3", "0363100012103144": "pe5dbd1", "0363100012103183": "b8a6957", "0363100012103197": "pe5e8ec", "0363100012103210": "b69433e", "0363100012103211": "b736460", "0363100012103219": "p78797c", "0363100012103269": "p606161", "0363100012103270": "p98a6a8", "0363100012103275": "pe5e8ec", "0363100012103289": "b755d56", "0363100012103292": "b9e7c68", "0363100012103297": "b4c2e2a", "0363100012103311": "b2f2320", "0363100012103313": "p67686b", "0363100012103361": "p6e6d6e", "0363100012103377": "pdeeaed", "0363100012103397": "b534642", "0363100012103414": "b685a56", "0363100012103436": "ba08983", "0363100012103513": "b936e5f", "0363100012103517": "b4c3f3c", "0363100012103520": "p65686b", "0363100012103521": "p92918b", "0363100012103537": "b6d5e5a", "0363100012103538": "bb28680", "0363100012103541": "b766864", "0363100012103545": "pf0ddca", "0363100012103546": "b402d23", "0363100012103610": "b413430", "0363100012103615": "b62433c", "0363100012103634": "p939494", "0363100012103636": "pc0ada0", "0363100012103638": "b413531", "0363100012103648": "b4e413d", "0363100012103666": "b50302c", "0363100012103695": "pbcbcbb", "0363100012103951": "b4c2e2a", "0363100012104031": "b7e5d4c", "0363100012104039": "p989493", "0363100012104183": "b463732", "0363100012104190": "pefd8c9", "0363100012104229": "p787977", "0363100012104236": "pedd6cb", "0363100012104288": "b643e39", "0363100012104332": "b766763", "0363100012104378": "b2d211e", "0363100012104394": "b4d403c", "0363100012104453": "b635551", "0363100012104459": "pb39383", "0363100012104472": "b665854", "0363100012104502": "b36241a", "0363100012104503": "b2f201c", "0363100012104519": "p8c8c8a", "0363100012104666": "b563f38", "0363100012104678": "b5b3c38", "0363100012104705": "pe6e8ea", "0363100012104715": "b65514c", "0363100012104716": "b7a6b67", "0363100012104725": "pe8e8e4", "0363100012104763": "p939393", "0363100012104765": "b594c48", "0363100012104767": "pe6dad0", "0363100012104781": "b6f5a54", "0363100012104798": "b423532", "0363100012104846": "pebe4dd", "0363100012104848": "b493935", "0363100012104853": "b93705f", "0363100012104870": "p8a898a", "0363100012104937": "p686a69", "0363100012104966": "b846762", "0363100012104980": "p76787a", "0363100012104986": "pe7e8e8", "0363100012105012": "b3c2924", "0363100012105016": "b623d38", "0363100012105017": "b493935", "0363100012105071": "b5c3834", "0363100012105094": "b423531", "0363100012105132": "b84726d", "0363100012105154": "pe9d5ce", "0363100012105200": "b493c38", "0363100012105201": "b563a2b", "0363100012105271": "p6e6f71", "0363100012105390": "b4d2f2b", "0363100012105495": "b896855", "0363100012105528": "b7b5e4e", "0363100012105615": "p96999d", "0363100012105617": "b4a322e", "0363100012105631": "b351f1d", "0363100012105635": "p767576", "0363100012105671": "b3a271c", "0363100012105703": "b745c4f", "0363100012105722": "b9b8b87", "0363100012105793": "b452a26", "0363100012105797": "p9b8c87", "0363100012105799": "b998073", "0363100012105826": "paeabae", "0363100012105890": "b5b3931", "0363100012105914": "b714a44", "0363100012106022": "p7e7f80", "0363100012106103": "b68433b", "0363100012106148": "b997564", "0363100012106159": "pe6e8ec", "0363100012106162": "b876155", "0363100012106174": "b846c5f", "0363100012106222": "p6c6f6f", "0363100012106284": "pdbdad8", "0363100012106327": "b58372f", "0363100012106412": "p797979", "0363100012106465": "b7c554d", "0363100012106467": "b342420", "0363100012106495": "b675753", "0363100012106512": "b413531", "0363100012106522": "b8e655f", "0363100012106553": "b6f4c40", "0363100012106582": "b7b6964", "0363100012106587": "p8b8f92", "0363100012106592": "b684641", "0363100012106596": "pe1dad3", "0363100012106633": "p5f6263", "0363100012106733": "b8a6956", "0363100012106759": "pb3ada6", "0363100012106780": "ba07d6a", "0363100012107021": "b7e665f", "0363100012107035": "b643f39", "0363100012107041": "p707171", "0363100012107131": "b634736", "0363100012107192": "b462c24", "0363100012107241": "pebcec5", "0363100012107275": "pb1a8a5", "0363100012107299": "b3e322e", "0363100012107316": "b43332f", "0363100012107349": "b442d21", "0363100012107360": "b4f302c", "0363100012107361": "b442925", "0363100012107362": "b6a443f", "0363100012107367": "b4a372c", "0363100012107370": "b302017", "0363100012107373": "b4e3729", "0363100012107421": "pede7e5", "0363100012107480": "b926962", "0363100012107488": "b875f58", "0363100012107503": "b664f48", "0363100012107511": "b825b52", "0363100012107517": "b52413c", "0363100012107518": "bac8976", "0363100012107572": "b684d41", "0363100012107589": "p7a7d82", "0363100012107592": "p797e80", "0363100012107597": "b573531", "0363100012107716": "pa3a4a8", "0363100012107783": "b916862", "0363100012107923": "p686767", "0363100012107926": "b705e59", "0363100012108017": "pb1b2b3", "0363100012108062": "p848486", "0363100012108071": "b4c372b", "0363100012108150": "pb98981", "0363100012108151": "b3a231e", "0363100012108216": "b4e2f2b", "0363100012108232": "b45322d", "0363100012108255": "b825b53", "0363100012108261": "b916761", "0363100012108294": "b8c6b59", "0363100012108321": "pe8e3dc", "0363100012108340": "p888888", "0363100012108345": "b443733", "0363100012108347": "b3a2e2a", "0363100012108359": "b2e201c", "0363100012108375": "p87898b", "0363100012108381": "b81604e", "0363100012108406": "p6c6b6c", "0363100012108411": "b2e211d", "0363100012108428": "b2d211e", "0363100012108473": "peae8e3", "0363100012108480": "p939699", "0363100012108514": "ba2806d", "0363100012108520": "p838280", "0363100012108522": "b604942", "0363100012108526": "b483024", "0363100012108536": "pd7d4d0", "0363100012108541": "b5a3b34", "0363100012108561": "b423532", "0363100012108568": "b856352", "0363100012108590": "p979696", "0363100012108861": "b70615d", "0363100012108928": "p858a8d", "0363100012108961": "pe3e2d3", "0363100012108979": "pefe7df", "0363100012109017": "b7e5650", "0363100012109057": "b796660", "0363100012109078": "p898888", "0363100012109100": "b734c46", "0363100012109101": "b704f3f", "0363100012109103": "b6e524c", "0363100012109105": "p5e6265", "0363100012109107": "b684839", "0363100012109109": "b352319", "0363100012109110": "b6f5b55", "0363100012109113": "ba37872", "0363100012109124": "b423632", "0363100012109145": "p969a9e", "0363100012109150": "p969697", "0363100012109153": "p6b6b6d", "0363100012109157": "bac8976", "0363100012109184": "b926f69", "0363100012109189": "p6b6c6e", "0363100012109246": "b997764", "0363100012109249": "b4b3630", "0363100012109265": "b483b37", "0363100012109300": "b976d66", "0363100012109308": "bac8976", "0363100012109315": "pefe7de", "0363100012109318": "b6a5852", "0363100012109360": "b645652", "0363100012109373": "p717172", "0363100012109513": "pc6bab6", "0363100012109528": "p676b6d", "0363100012109548": "b50433f", "0363100012109607": "b52332f", "0363100012109611": "ba58c7e", "0363100012109681": "b6f4c3f", "0363100012109737": "p838486", "0363100012109771": "p8b8a89", "0363100012109860": "p6c6c6d", "0363100012109866": "b846655", "0363100012109867": "b5a4d49", "0363100012109878": "b54332f", "0363100012109902": "b62493f", "0363100012109915": "b8f7871", "0363100012109917": "b997764", "0363100012109922": "b6e4e3d", "0363100012109924": "b523e38", "0363100012109932": "b493d39", "0363100012109933": "p87888b", "0363100012109935": "b7f5b4e", "0363100012109980": "b8e695b", "0363100012109985": "b2d211e", "0363100012109988": "p82817f", "0363100012110005": "b2e211d", "0363100012110024": "b2d211e", "0363100012110033": "pa7a2a0", "0363100012110056": "pd9d9d9", "0363100012110120": "b3a2e2a", "0363100012110173": "b432b21", "0363100012110202": "pe6e8e9", "0363100012110207": "p707478", "0363100012110224": "pe7d8d0", "0363100012110233": "b6b473d", "0363100012110237": "p6b6b6d", "0363100012110257": "b6b483c", "0363100012110259": "b61534f", "0363100012110353": "p727475", "0363100012110360": "b776763", "0363100012110380": "b443734", "0363100012110384": "p606366", "0363100012110403": "pa29e9a", "0363100012110453": "b463632", "0363100012110459": "p616264", "0363100012110502": "pe8e8eb", "0363100012110551": "b887165", "0363100012110565": "b4a3d39", "0363100012110593": "bad8977", "0363100012110623": "p6d7171", "0363100012110724": "b8f6660", "0363100012110789": "b2d211e", "0363100012110833": "b43302b", "0363100012110899": "pa89b94", "0363100012111003": "b3b2f2b", "0363100012111028": "p898a89", "0363100012111030": "p868686", "0363100012111081": "b493c38", "0363100012111092": "b6f4c3f", "0363100012111106": "b483b37", "0363100012111132": "b514340", "0363100012111165": "b7c594a", "0363100012111172": "b755245", "0363100012111177": "b533f39", "0363100012111188": "b7c544f", "0363100012111221": "b69463a", "0363100012111242": "p727374", "0363100012111290": "b362622", "0363100012111348": "b754e48", "0363100012111368": "pe2dad3", "0363100012111414": "pdfdad5", "0363100012111430": "b665854", "0363100012111453": "p676867", "0363100012111672": "b9e736d", "0363100012111773": "b4a3630", "0363100012111888": "pece6ef", "0363100012111896": "b443530", "0363100012111897": "b554744", "0363100012111978": "b4f423e", "0363100012112022": "b3a271c", "0363100012112064": "p77787c", "0363100012112067": "b754e48", "0363100012112091": "pe8e8e8", "0363100012112093": "p6e7073", "0363100012112102": "ba4816e", "0363100012112141": "b5b4742", "0363100012112143": "b392621", "0363100012112154": "b574a46", "0363100012112203": "b6e4f3d", "0363100012112224": "pe2dbd3", "0363100012112234": "b3f322f", "0363100012112238": "p8e9698", "0363100012112278": "pe3dbd7", "0363100012112292": "p7e8082", "0363100012112322": "b6b4c3a", "0363100012112391": "b51403b", "0363100012112452": "b896457", "0363100012112458": "pa1a5a8", "0363100012112487": "b4b3e3a", "0363100012112520": "b7f6252", "0363100012112532": "b53352a", "0363100012112588": "b3a271c", "0363100012112631": "p7c7c7e", "0363100012112638": "pe6e8eb", "0363100012112666": "b5e3a35", "0363100012112667": "p898a8c", "0363100012112709": "b685a56", "0363100012112767": "b583531", "0363100012112771": "b44302a", "0363100012112772": "b3d302d", "0363100012112776": "b926f5e", "0363100012112777": "b43332e", "0363100012112831": "pe7e8eb", "0363100012112936": "b6f4a41", "0363100012112943": "b745543", "0363100012113141": "b855c56", "0363100012113143": "b79534b", "0363100012113148": "pa1a1a0", "0363100012113190": "b845b55", "0363100012113222": "b302521", "0363100012113233": "b50433f", "0363100012113236": "b492f26", "0363100012113342": "pe0dad4", "0363100012113349": "p656668", "0363100012113358": "bac8976", "0363100012113391": "b483c38", "0363100012113405": "p858688", "0363100012113464": "b462f22", "0363100012113467": "b7b564a", "0363100012113505": "b835e52", "0363100012113525": "b9c7a67", "0363100012113535": "b352926", "0363100012113550": "pe8e9e3", "0363100012113584": "bb28680", "0363100012113603": "b584b47", "0363100012113604": "b482b28", "0363100012113605": "pe6e8eb", "0363100012113619": "b3e322e", "0363100012113676": "b604c47", "0363100012113733": "b6b443f", "0363100012113870": "p787875", "0363100012113901": "b483b37", "0363100012113917": "b352419", "0363100012113923": "pdfd8d5", "0363100012113953": "b4b3e3b", "0363100012113955": "b57403a", "0363100012113965": "p737679", "0363100012113972": "b876f62", "0363100012113984": "b4f423e", "0363100012114065": "pbab7b3", "0363100012114104": "b856d66", "0363100012114209": "b745044", "0363100012114234": "b5c453f", "0363100012114321": "p676c70", "0363100012114371": "b9e736d", "0363100012114399": "b312117", "0363100012114402": "b452a26", "0363100012114408": "bac8976", "0363100012114422": "b2d221e", "0363100012114427": "b79514c", "0363100012114434": "b593c38", "0363100012114437": "pe3e9ec", "0363100012114470": "p666866", "0363100012114472": "b523729", "0363100012114480": "p64666a", "0363100012114486": "p797a7b", "0363100012114493": "b6f584b", "0363100012114499": "b69473a", "0363100012114515": "b46312a", "0363100012114538": "b6e4842", "0363100012114546": "peae9dd", "0363100012114573": "b644d46", "0363100012114613": "p7a7b7a", "0363100012114716": "p606466", "0363100012114741": "b302017", "0363100012114742": "pe1e1db", "0363100012114782": "b443530", "0363100012114785": "b9a7865", "0363100012114787": "b79524c", "0363100012114791": "p8c8f92", "0363100012114813": "b403330", "0363100012114884": "p787978", "0363100012114895": "b331e1c", "0363100012114925": "b685a56", "0363100012114936": "b594842", "0363100012114996": "p6c7174", "0363100012115007": "b7a625b", "0363100012115061": "b5e3c32", "0363100012115101": "b997365", "0363100012115156": "pedd4c5", "0363100012115205": "b573530", "0363100012115215": "p5f6165", "0363100012115219": "b4a3b36", "0363100012115273": "b735551", "0363100012115275": "b4a3b36", "0363100012115305": "b3e2a1f", "0363100012115411": "b594b48", "0363100012115456": "b524541", "0363100012115471": "bb1877e", "0363100012115542": "b50433f", "0363100012115555": "b321f1a", "0363100012115574": "p636868", "0363100012115578": "pdddbd7", "0363100012115684": "p9ba1a4", "0363100012115728": "b826453", "0363100012115734": "b523629", "0363100012115756": "pe1d9d4", "0363100012115779": "pe2ded3", "0363100012115783": "b3d2a1e", "0363100012115820": "pe7d7cf", "0363100012115822": "b644a3b", "0363100012115838": "b72625e", "0363100012116067": "b6c5349", "0363100012116142": "b31221e", "0363100012116190": "b331e1c", "0363100012116200": "bb1877d", "0363100012116223": "pe7e8e8", "0363100012116372": "b644f43", "0363100012116382": "p7b7a7d", "0363100012116412": "pdeded6", "0363100012116501": "ba68171", "0363100012116531": "peddacc", "0363100012116533": "pe7d9cf", "0363100012116535": "baf8879", "0363100012116554": "p86898b", "0363100012116565": "p6b6e73", "0363100012116595": "b655753", "0363100012116611": "pe3ded2", "0363100012116631": "b6b443f", "0363100012116637": "bac8976", "0363100012116640": "bb2867f", "0363100012116641": "b48332d", "0363100012116648": "paeaaa6", "0363100012116649": "b9d7d78", "0363100012116707": "b957c75", "0363100012116714": "pebe2d9", "0363100012116728": "b665550", "0363100012116780": "pa09790", "0363100012116907": "b482c28", "0363100012116937": "b2d211d", "0363100012116974": "b302017", "0363100012117040": "b564641", "0363100012117080": "b473a36", "0363100012117081": "b493c38", "0363100012117085": "b58443e", "0363100012117100": "p6d6f71", "0363100012117102": "pe7e9e5", "0363100012117151": "p9a9895", "0363100012117152": "pe0e2e2", "0363100012117166": "b73615c", "0363100012117175": "b76504b", "0363100012117176": "pe5e9ea", "0363100012117346": "p7d7e7f", "0363100012117388": "p737476", "0363100012117450": "b352319", "0363100012117464": "p7c7e81", "0363100012117479": "b31221e", "0363100012117566": "b67413c", "0363100012117573": "p686b6d", "0363100012117588": "b51342a", "0363100012117622": "b6d5d59", "0363100012117629": "pe6e8ec", "0363100012117640": "b4f312a", "0363100012117677": "pded9d6", "0363100012117773": "b574945", "0363100012117864": "b9c726c", "0363100012117871": "p707173", "0363100012117894": "b674837", "0363100012118031": "pdfdcd5", "0363100012118038": "pe0dad4", "0363100012118039": "b735143", "0363100012118049": "b745045", "0363100012118059": "p7e8080", "0363100012118178": "b977363", "0363100012118181": "b63534f", "0363100012118226": "pe8e8e6", "0363100012118320": "b2d211d", "0363100012118351": "p605f5f", "0363100012118359": "b342825", "0363100012118370": "peee6e8", "0363100012118375": "b4d403c", "0363100012118389": "pa29189", "0363100012118445": "p616568", "0363100012118498": "p767677", "0363100012118512": "pe7e8e9", "0363100012118526": "p787879", "0363100012118652": "b9f8d87", "0363100012118654": "b73594a", "0363100012118677": "p7c7c7b", "0363100012118761": "p878887", "0363100012118773": "pe5dbd1", "0363100012118821": "b62403b", "0363100012118848": "pe0d9d4", "0363100012118855": "pe0dad4", "0363100012118933": "b493c39", "0363100012118980": "b4a3d39", "0363100012118994": "p636468", "0363100012119068": "p5b6062", "0363100012119074": "b6a4b3a", "0363100012119082": "p888a8d", "0363100012119099": "b3f322f", "0363100012119104": "b5c4f4b", "0363100012119116": "b634e48", "0363100012119117": "b9d726c", "0363100012119118": "b623e36", "0363100012119128": "b473a36", "0363100012119200": "b623f35", "0363100012119203": "b6a453e", "0363100012119219": "pf3e8bf", "0363100012119250": "pe6e8eb", "0363100012119261": "p968f8b", "0363100012119265": "b70625e", "0363100012119270": "p6e7375", "0363100012119271": "pe8e8e8", "0363100012119275": "b88605a", "0363100012119278": "p777877", "0363100012119330": "p5d6265", "0363100012119333": "b81695c", "0363100012119345": "p6d7375", "0363100012119366": "b725341", "0363100012119371": "b967462", "0363100012119376": "b66524d", "0363100012119378": "b403430", "0363100012119422": "b574743", "0363100012119428": "p7c7c7f", "0363100012119491": "b6b483b", "0363100012119523": "b49352f", "0363100012119526": "b2f2320", "0363100012119527": "p747476", "0363100012119554": "b583631", "0363100012119582": "b7f615c", "0363100012119593": "pb2a8a1", "0363100012119595": "p76797c", "0363100012119606": "p6e6e71", "0363100012119674": "b483b38", "0363100012119764": "b6d5548", "0363100012119791": "b7b5b49", "0363100012119826": "b6b4c3b", "0363100012119842": "b826e68", "0363100012119844": "p707070", "0363100012119883": "bb28680", "0363100012119893": "b382824", "0363100012119910": "b754e48", "0363100012119931": "b4f302a", "0363100012119975": "b966c66", "0363100012120016": "b5f504b", "0363100012120021": "b2f221e", "0363100012120061": "p737476", "0363100012120062": "p7c7d7e", "0363100012120075": "b473833", "0363100012120137": "b492c29", "0363100012120166": "pe1d6d3", "0363100012120192": "p929799", "0363100012120239": "p838486", "0363100012120246": "b70615c", "0363100012120247": "b7a6a65", "0363100012120281": "p848586", "0363100012120307": "p808c8e", "0363100012120328": "b59433d", "0363100012120345": "pebd3cc", "0363100012120348": "peedfd8", "0363100012120354": "pdfdfd6", "0363100012120377": "pe7e8e9", "0363100012120379": "pebe7ee", "0363100012120385": "pe0ded4", "0363100012120388": "pd0dee0", "0363100012120395": "p626262", "0363100012120398": "bae847a", "0363100012120429": "b8a6359", "0363100012120464": "p7e7f7e", "0363100012120471": "b56362d", "0363100012120509": "b85706a", "0363100012120518": "pe4d8d2", "0363100012120618": "b866353", "0363100012120646": "pe0eaed", "0363100012120653": "b6c4b3c", "0363100012120765": "b5a4c49", "0363100012120772": "p65686b", "0363100012120781": "b6f615d", "0363100012120789": "b2f201c", "0363100012120876": "b6c544d", "0363100012120899": "b3e312e", "0363100012120941": "b433632", "0363100012120987": "p717373", "0363100012120997": "p7b7b7a", "0363100012121019": "b7c564c", "0363100012121025": "b38231c", "0363100012121031": "p63676a", "0363100012121039": "pe6e8eb", "0363100012121043": "b8d6f5e", "0363100012121118": "b9f7a6a", "0363100012121203": "pd5c7c0", "0363100012121217": "b6a443f", "0363100012121271": "pd7dddb", "0363100012121307": "b6e554e", "0363100012121340": "b362a27", "0363100012121342": "b5f3f32", "0363100012121348": "b583631", "0363100012121365": "b7f5751", "0363100012121372": "b533829", "0363100012121403": "b6a4d49", "0363100012121435": "b5e514d", "0363100012121615": "b362723", "0363100012121646": "p6c6d6e", "0363100012121669": "b998079", "0363100012121693": "b675955", "0363100012121715": "b453227", "0363100012121733": "pa1a0a0", "0363100012121743": "b38251f", "0363100012121796": "peedfcb", "0363100012121807": "pebe8e2", "0363100012121817": "b916d5d", "0363100012121849": "pa9aeb0", "0363100012121911": "b623d37", "0363100012121968": "b9d7968", "0363100012122118": "b665752", "0363100012122168": "pdbd9d8", "0363100012122174": "b614332", "0363100012122189": "b462e23", "0363100012122198": "bac8976", "0363100012122202": "b82624f", "0363100012122214": "p73797b", "0363100012122258": "b513a2d", "0363100012122268": "b44312b", "0363100012122273": "b463732", "0363100012122277": "p7e7e81", "0363100012122295": "b382b27", "0363100012122303": "b5f524e", "0363100012122308": "b8a7b77", "0363100012122315": "b6d4e47", "0363100012122316": "b4d3e39", "0363100012122322": "pe6e8ec", "0363100012122335": "b413430", "0363100012122349": "b684839", "0363100012122368": "b3e312e", "0363100012122372": "b6d4641", "0363100012122426": "b392d2a", "0363100012122451": "b66413a", "0363100012122576": "b6f4a40", "0363100012122588": "b4b3e3a", "0363100012122664": "b875f58", "0363100012122692": "b70625e", "0363100012122707": "b583630", "0363100012122710": "b7f615d", "0363100012122771": "b866e67", "0363100012122775": "p979897", "0363100012122776": "ba08c87", "0363100012122779": "p6a6b6b", "0363100012122808": "b755145", "0363100012122816": "b352319", "0363100012122825": "pe3dad2", "0363100012122846": "b2d211e", "0363100012122870": "b513d38", "0363100012122895": "pe7e8e8", "0363100012122897": "b6f5d57", "0363100012122931": "p787878", "0363100012122939": "b564642", "0363100012122966": "pe3e9ec", "0363100012122979": "b654735", "0363100012122990": "b625450", "0363100012123027": "peae7ee", "0363100012123146": "p868787", "0363100012123204": "pe1eaec", "0363100012123219": "b5c4c47", "0363100012123299": "p7d7c7b", "0363100012123315": "b7b574a", "0363100012123324": "pdadadb", "0363100012123331": "b5b4a45", "0363100012123342": "p9b9fa2", "0363100012123346": "b846d66", "0363100012123412": "b674538", "0363100012123434": "b442b22", "0363100012123441": "b664437", "0363100012123442": "b6d5f5b", "0363100012123477": "pd7c7be", "0363100012123478": "b3a2721", "0363100012123499": "b3b2f2b", "0363100012123575": "peed9cb", "0363100012123577": "b835b55", "0363100012123592": "b583631", "0363100012123594": "b38261b", "0363100012123597": "pe7e8ec", "0363100012123680": "pa59a96", "0363100012123682": "b654f43", "0363100012123703": "b453834", "0363100012123756": "pe6e8eb", "0363100012123784": "b736561", "0363100012123847": "pe7dacf", "0363100012123853": "b734d44", "0363100012123871": "b362a27", "0363100012123872": "b896b5a", "0363100012124008": "b412d28", "0363100012124030": "pe8e8e8", "0363100012124035": "p7f807f", "0363100012124063": "pe9e8e9", "0363100012124083": "p6f7275", "0363100012124159": "pdedcd5", "0363100012124161": "b5f3e32", "0363100012124216": "pa6a5a3", "0363100012124271": "pe7e3d8", "0363100012124475": "b5f4231", "0363100012124484": "p8f9090", "0363100012124485": "b7a6357", "0363100012124535": "pa49ba1", "0363100012124607": "pe1d9d3", "0363100012124627": "b4e413d", "0363100012124643": "b69433e", "0363100012124670": "b7d6457", "0363100012124681": "b745443", "0363100012124697": "b563430", "0363100012124744": "p8a8886", "0363100012124747": "pe5d8d1", "0363100012124753": "b90695f", "0363100012124764": "b312117", "0363100012124768": "b67554f", "0363100012124769": "pecd4cc", "0363100012124796": "b624433", "0363100012124834": "p66686a", "0363100012124844": "b533f3a", "0363100012124851": "p6e7072", "0363100012124880": "b5e4a45", "0363100012124954": "b2f221e", "0363100012124963": "pede7de", "0363100012124993": "ba78471", "0363100012125215": "p696a6a", "0363100012125226": "b5b443d", "0363100012125243": "b6c5e5a", "0363100012125277": "b73514a", "0363100012125306": "b302017", "0363100012125314": "b40332f", "0363100012125336": "b654736", "0363100012125391": "b3c2e2a", "0363100012125394": "p5d5f5e", "0363100012125397": "ba48b84", "0363100012125402": "b302521", "0363100012125471": "b9b8c88", "0363100012125493": "peee7e4", "0363100012125607": "pe0d9d4", "0363100012125641": "b604942", "0363100012125657": "b5d3933", "0363100012125662": "p8f8d8a", "0363100012125669": "b563a2a", "0363100012125714": "b623d36", "0363100012125742": "b382c28", "0363100012125748": "b7a5851", "0363100012125749": "b674c46", "0363100012125758": "b2d211e", "0363100012125765": "pe1ddd4", "0363100012125774": "p838481", "0363100012125775": "pe5e8ec", "0363100012125777": "b775e57", "0363100012125779": "b584b47", "0363100012125780": "b584b47", "0363100012125783": "pe7e2e1", "0363100012125793": "pdfd7d5", "0363100012125832": "b7b5c49", "0363100012125838": "p707578", "0363100012125980": "pe2e9ed", "0363100012126035": "p696c70", "0363100012126039": "b5d4943", "0363100012126041": "b66534e", "0363100012126054": "b30201b", "0363100012126101": "b9e8273", "0363100012126110": "b3d2c27", "0363100012126112": "b52332b", "0363100012126113": "b534642", "0363100012126125": "b815e4f", "0363100012126136": "p636361", "0363100012126150": "b53403a", "0363100012126172": "p646869", "0363100012126175": "pede7e1", "0363100012126177": "b442e22", "0363100012126178": "b644a3a", "0363100012126188": "b906f5c", "0363100012126215": "pecd9dc", "0363100012126220": "b855d58", "0363100012126226": "pe7e9e7", "0363100012126247": "pcad8db", "0363100012126257": "b53332e", "0363100012126293": "b6c4540", "0363100012126364": "ba17f6c", "0363100012126384": "bac8976", "0363100012126552": "b321f1a", "0363100012126589": "pebd4cd", "0363100012126602": "b423430", "0363100012126608": "b4d403c", "0363100012126688": "b725d57", "0363100012126709": "b432c21", "0363100012126724": "pcabfc5", "0363100012126726": "b987663", "0363100012126730": "b40302c", "0363100012126866": "b302017", "0363100012126920": "pa0938c", "0363100012126929": "b8d645e", "0363100012126934": "p898f92", "0363100012126945": "pdedcd6", "0363100012126994": "bac8976", "0363100012127026": "b4c3b36", "0363100012127030": "bb28680", "0363100012127052": "b583c2b", "0363100012127076": "p8b8a87", "0363100012127087": "b6a4641", "0363100012127122": "pc6bcb4", "0363100012127138": "pe4dcd2", "0363100012127157": "b77625c", "0363100012127158": "p7e8082", "0363100012127192": "b9a7366", "0363100012127218": "b654237", "0363100012127233": "pe4e1d2", "0363100012127348": "pd0dee0", "0363100012127398": "b7d6963", "0363100012127405": "b643e39", "0363100012127406": "b453227", "0363100012127408": "b593731", "0363100012127413": "pebe5e2", "0363100012127414": "pe9d1ce", "0363100012127415": "b6f4843", "0363100012127429": "b534642", "0363100012127435": "b754d48", "0363100012127485": "pdeeaed", "0363100012127488": "b4a3d39", "0363100012127499": "b3f332f", "0363100012127529": "b65403b", "0363100012127543": "pebdbcd", "0363100012127591": "b745645", "0363100012127597": "b574a46", "0363100012127629": "b57382d", "0363100012127667": "bac8976", "0363100012127692": "b6b5751", "0363100012127697": "b654736", "0363100012127769": "paaa09e", "0363100012127780": "b926963", "0363100012127790": "b4f332f", "0363100012127887": "b5a3732", "0363100012128007": "pebded5", "0363100012128015": "p838483", "0363100012128060": "b816052", "0363100012128111": "b6d4b3e", "0363100012128127": "bb1877c", "0363100012128149": "b9a706a", "0363100012128196": "b67413c", "0363100012128198": "pabb2b1", "0363100012128218": "b8b615c", "0363100012128226": "b6c483f", "0363100012128235": "b4e413d", "0363100012128263": "pefe7de", "0363100012128280": "b3d2a1f", "0363100012128341": "b886058", "0363100012128348": "p6a6c6f", "0363100012128410": "p616365", "0363100012128412": "b5f3e32", "0363100012128445": "b5c4d48", "0363100012128488": "b38251b", "0363100012128509": "b9b7966", "0363100012128632": "b4b3e3a", "0363100012128651": "p9e928c", "0363100012128680": "b7b5b49", "0363100012128713": "b937971", "0363100012128745": "pe8e8e9", "0363100012128793": "pdfdbd5", "0363100012128795": "b453834", "0363100012128804": "p898b8b", "0363100012128864": "p868784", "0363100012128891": "b80604e", "0363100012128899": "b7f5850", "0363100012128960": "pdfdad5", "0363100012128968": "b5d3834", "0363100012128991": "p656a6c", "0363100012128992": "p8c8c8b", "0363100012129064": "b3b2923", "0363100012129069": "pd1dee0", "0363100012129085": "b836757", "0363100012129086": "pe4e9ec", "0363100012129107": "b46322c", "0363100012129137": "p777776", "0363100012129144": "b2e211d", "0363100012129157": "pc4d1d3", "0363100012129163": "pcfcbc4", "0363100012129200": "b816460", "0363100012129214": "pa49b98", "0363100012129239": "b68443b", "0363100012129312": "b896357", "0363100012129313": "b70625e", "0363100012129319": "p949c9e", "0363100012129320": "b6f4c3f", "0363100012129329": "p696b6a", "0363100012129331": "b584a46", "0363100012129335": "b70625e", "0363100012129336": "pe9e8e5", "0363100012129355": "b987663", "0363100012129364": "b805e4e", "0363100012129365": "b413430", "0363100012129559": "b745045", "0363100012129570": "b8c635d", "0363100012129661": "p656766", "0363100012129676": "b55392a", "0363100012129740": "b7c6e6a", "0363100012129808": "pe6e8ea", "0363100012129873": "p606060", "0363100012129882": "b9e7969", "0363100012129930": "b372b28", "0363100012129985": "p888784", "0363100012130018": "p626262", "0363100012130039": "b482b28", "0363100012130104": "b463a36", "0363100012130105": "pe9e8e4", "0363100012130120": "b746661", "0363100012130121": "b735c56", "0363100012130123": "b92705f", "0363100012130124": "b735546", "0363100012130127": "pece9cc", "0363100012130137": "p64676a", "0363100012130159": "baa7f79", "0363100012130184": "p70787a", "0363100012130185": "p5d6164", "0363100012130193": "b735043", "0363100012130196": "pd8d7da", "0363100012130217": "b6c5751", "0363100012130250": "b7f5e4d", "0363100012130306": "b5f514d", "0363100012130316": "b302017", "0363100012130365": "b715344", "0363100012130582": "b835c53", "0363100012130718": "b654736", "0363100012130732": "pe6d9d0", "0363100012130812": "peadbcd", "0363100012130876": "b53322e", "0363100012130878": "b403330", "0363100012130913": "b523d37", "0363100012130919": "b453835", "0363100012130945": "b392c29", "0363100012130961": "p757578", "0363100012130968": "b50423f", "0363100012130981": "b2f201c", "0363100012131006": "b9d726c", "0363100012131026": "p6d7174", "0363100012131039": "pe6e8eb", "0363100012131225": "pdeddd6", "0363100012131276": "b6f503e", "0363100012131282": "b423632", "0363100012131287": "b5c443d", "0363100012131288": "b5c4842", "0363100012131294": "b30201b", "0363100012131322": "p656a6d", "0363100012131324": "p7e7e7e", "0363100012131332": "b6b463e", "0363100012131333": "b3d2a24", "0363100012131345": "b8a6c5b", "0363100012131408": "p6f7477", "0363100012131451": "pe0eaed", "0363100012131467": "b322118", "0363100012131469": "b736561", "0363100012131521": "b4a3a36", "0363100012131526": "b623c37", "0363100012131533": "baa8674", "0363100012131535": "ba07e6b", "0363100012131539": "b321f19", "0363100012131541": "b3a2e2a", "0363100012131544": "p7b7a79", "0363100012131557": "b825954", "0363100012131558": "b574945", "0363100012131560": "b5a3c2d", "0363100012131561": "b7a524d", "0363100012131592": "b53342b", "0363100012131598": "pe1d4d3", "0363100012131633": "pdfd8d5", "0363100012131644": "p5f6465", "0363100012131647": "b563935", "0363100012131694": "pe8e8e8", "0363100012131737": "p868788", "0363100012131801": "b8a7a76", "0363100012131851": "pe7e8eb", "0363100012131886": "b9e736d", "0363100012132051": "b805951", "0363100012132052": "b5d3e3a", "0363100012132062": "pdcded7", "0363100012132073": "b876754", "0363100012132108": "b6a473b", "0363100012132138": "p6a6b6a", "0363100012132256": "b4a3731", "0363100012132264": "ba3806d", "0363100012132287": "p8b9093", "0363100012132306": "b6c483f", "0363100012132337": "b3d312d", "0363100012132403": "b665854", "0363100012132481": "b906761", "0363100012132487": "peee4e5", "0363100012132666": "pe9d6ce", "0363100012132673": "b6b5d59", "0363100012132729": "b4a3d3a", "0363100012132891": "b70524e", "0363100012132900": "b78625c", "0363100012132917": "b5b4d49", "0363100012132923": "pe7e8e9", "0363100012132944": "b846451", "0363100012132960": "p757b7d", "0363100012132967": "p9b9ea1", "0363100012132976": "pdbd8d7", "0363100012132977": "pe9e9dc", "0363100012133033": "p636b6e", "0363100012133175": "b593b2d", "0363100012133224": "b4d403c", "0363100012133225": "b645652", "0363100012133239": "b564642", "0363100012133246": "b5e4130", "0363100012133255": "b321f19", "0363100012133258": "b4c2e2a", "0363100012133347": "p808181", "0363100012133367": "pece0cd", "0363100012133418": "b2d211e", "0363100012133419": "bad8882", "0363100012133484": "b60514c", "0363100012133494": "b52352a", "0363100012133495": "pdcdcd7", "0363100012133505": "pddddd7", "0363100012133512": "b987563", "0363100012133516": "p727475", "0363100012133519": "b432825", "0363100012133527": "b352319", "0363100012133564": "peee5d9", "0363100012133664": "b866253", "0363100012133697": "pe5e9ec", "0363100012133750": "b785847", "0363100012133774": "p8c8b8a", "0363100012133782": "pe7e8eb", "0363100012133808": "b402b1f", "0363100012133812": "p787a7d", "0363100012133879": "b4d3425", "0363100012133903": "b7a524c", "0363100012133969": "p626363", "0363100012133996": "pe6dbd0", "0363100012134003": "b79534b", "0363100012134009": "p636464", "0363100012134033": "pece8e0", "0363100012134062": "pe9e8e8", "0363100012134065": "b50423f", "0363100012134066": "b55413b", "0363100012134069": "b4b2d29", "0363100012134088": "b896557", "0363100012134116": "b755955", "0363100012134131": "b926c5f", "0363100012134148": "p878685", "0363100012134250": "b5e3e34", "0363100012134263": "p797b7e", "0363100012134266": "p6c6e6d", "0363100012134277": "p898a89", "0363100012134278": "pe2ddd3", "0363100012134416": "b392d29", "0363100012134442": "b58443f", "0363100012134478": "b704e3f", "0363100012134485": "b3b2e2b", "0363100012134496": "b603f33", "0363100012134522": "b5f3a35", "0363100012134576": "pe3d5d3", "0363100012134702": "pa7a19c", "0363100012134707": "b43332f", "0363100012134722": "b382621", "0363100012134744": "b72635f", "0363100012134870": "b584a46", "0363100012134911": "b7f5d4d", "0363100012134912": "p7e7d7d", "0363100012134922": "b3b2c27", "0363100012134949": "b796661", "0363100012134955": "b7a534c", "0363100012134984": "bb0877b", "0363100012135088": "b44342f", "0363100012135194": "b50382b", "0363100012135252": "pe9c9c9", "0363100012135373": "b583630", "0363100012135433": "p98999d", "0363100012135450": "ba98672", "0363100012135485": "p868787", "0363100012135502": "b9e7a6d", "0363100012135513": "b45312b", "0363100012135519": "b584039", "0363100012135546": "p7a7978", "0363100012135566": "b6d5f5b", "0363100012135636": "ba98175", "0363100012135663": "pe8e8e8", "0363100012135681": "pdfdad5", "0363100012135688": "b775853", "0363100012135746": "p6e7275", "0363100012135846": "b6d554e", "0363100012135851": "b342521", "0363100012135856": "b69433e", "0363100012135903": "p8b8d8c", "0363100012135907": "p888887", "0363100012135991": "p6d7073", "0363100012136014": "b744d47", "0363100012136036": "b644943", "0363100012136056": "p999692", "0363100012136088": "p898987", "0363100012136141": "b5c3833", "0363100012136178": "p938d8a", "0363100012136201": "b31221e", "0363100012136206": "p848482", "0363100012136207": "pe1ded4", "0363100012136209": "b544743", "0363100012136224": "b524441", "0363100012136229": "b5e4130", "0363100012136233": "p988b85", "0363100012136235": "b724b45", "0363100012136238": "p919293", "0363100012136250": "pd1dee0", "0363100012136259": "b5b3833", "0363100012136270": "b44322c", "0363100012136284": "p686a6e", "0363100012136294": "b3b2f2c", "0363100012136295": "bb2867f", "0363100012136298": "pe7e8eb", "0363100012136306": "b473a36", "0363100012136319": "b7b544e", "0363100012136326": "p949596", "0363100012136392": "b3e2f2a", "0363100012136425": "b896855", "0363100012136447": "b664f48", "0363100012136494": "b7f5f4c", "0363100012136518": "p74767a", "0363100012136587": "pe6e8eb", "0363100012136588": "pe2dcd7", "0363100012136599": "pe8e8ea", "0363100012136603": "b633e38", "0363100012136606": "b9c8d88", "0363100012136690": "pe1d9d3", "0363100012136785": "pe4e9ec", "0363100012136796": "b3c2f2c", "0363100012136826": "p6d6d6d", "0363100012136858": "b60524e", "0363100012136891": "p727275", "0363100012136893": "p838384", "0363100012137016": "b6a493a", "0363100012137078": "p7c7d7e", "0363100012137115": "b3e322e", "0363100012137193": "b593833", "0363100012137197": "pb0a39d", "0363100012137280": "pb38988", "0363100012137357": "b57433d", "0363100012137358": "b7c6d69", "0363100012137368": "b5a392f", "0363100012137458": "pe8e8e4", "0363100012137509": "b875e59", "0363100012137555": "b342824", "0363100012137623": "p818184", "0363100012137625": "p8e8b8a", "0363100012137630": "pe9e8e2", "0363100012137651": "b7a645d", "0363100012137701": "b94837e", "0363100012137764": "paaa4a5", "0363100012137768": "b3b2b26", "0363100012137778": "b665854", "0363100012137779": "b8d645e", "0363100012137793": "b72625d", "0363100012137817": "b78524a", "0363100012137857": "pcee0e3", "0363100012137861": "p78787a", "0363100012137893": "p686a6d", "0363100012137921": "pa1adae", "0363100012137944": "b5d3934", "0363100012137970": "b5c3833", "0363100012137972": "bb0887b", "0363100012137993": "b9f766d", "0363100012138003": "b3f2622", "0363100012138012": "b825a54", "0363100012138099": "b655753", "0363100012138111": "b604c46", "0363100012138116": "p858684", "0363100012138139": "b68423d", "0363100012138166": "b6c4640", "0363100012138176": "b302017", "0363100012138181": "p797979", "0363100012138184": "pe6e8eb", "0363100012138197": "b644037", "0363100012138248": "b714e41", "0363100012138271": "pebe8e3", "0363100012138274": "b3a2d29", "0363100012138280": "b3b281d", "0363100012138304": "b50433f", "0363100012138345": "pede7e1", "0363100012138370": "b3b2b27", "0363100012138384": "p7c8284", "0363100012138431": "b9a7865", "0363100012138528": "ba18c86", "0363100012138648": "b503d38", "0363100012138688": "p6a6b6a", "0363100012138735": "b594b47", "0363100012138740": "b6f5a54", "0363100012138741": "b8e7871", "0363100012138744": "b643e39", "0363100012138747": "b655651", "0363100012138757": "p616366", "0363100012138758": "p908c8c", "0363100012138796": "p6f6f71", "0363100012138881": "b624034", "0363100012138887": "b3f322f", "0363100012138912": "pdfdad5", "0363100012138952": "p5d5f5f", "0363100012138967": "b5e4130", "0363100012138971": "b4c3629", "0363100012139028": "pe2e1e4", "0363100012139038": "b754e49", "0363100012139124": "p8a8b8c", "0363100012139204": "b88726b", "0363100012139228": "p74797b", "0363100012139268": "b6f5f5b", "0363100012139336": "p7b7c7b", "0363100012139340": "b835f51", "0363100012139345": "b362a26", "0363100012139373": "ba97e78", "0363100012139385": "b846a5d", "0363100012139402": "ba97f77", "0363100012139532": "b897164", "0363100012139536": "b6f503f", "0363100012139547": "b624333", "0363100012139598": "peae8e0", "0363100012139609": "p757575", "0363100012139613": "b998079", "0363100012139614": "b40332f", "0363100012139639": "pe6d8d0", "0363100012139646": "b7c6e69", "0363100012139666": "b543d30", "0363100012139686": "b9f7a6a", "0363100012139687": "b3a2d2a", "0363100012139717": "pe7e8ea", "0363100012139750": "p807f7f", "0363100012139825": "bac8976", "0363100012139855": "b775546", "0363100012139878": "b392823", "0363100012139957": "p8f8d85", "0363100012139963": "p9b8c86", "0363100012140008": "b4e413d", "0363100012140014": "b5b3a2e", "0363100012140019": "b5b3833", "0363100012140042": "b603b36", "0363100012140053": "p818386", "0363100012140067": "b6a493b", "0363100012140070": "p6a6c70", "0363100012140137": "p848587", "0363100012140139": "p9d9c97", "0363100012140144": "b7c6e6a", "0363100012140160": "b2d211e", "0363100012140258": "p7a7b7b", "0363100012140352": "p9ea9ab", "0363100012140474": "b4b3e3b", "0363100012140532": "p636468", "0363100012140540": "ba18c86", "0363100012140597": "b705140", "0363100012140609": "b6a5650", "0363100012140621": "b654a44", "0363100012140627": "pdfded5", "0363100012140657": "b81614f", "0363100012140787": "pe7e4e3", "0363100012140788": "b694e48", "0363100012140887": "b523b34", "0363100012140898": "b5d3f2e", "0363100012140956": "b4d403c", "0363100012141017": "b302017", "0363100012141053": "p81817f", "0363100012141107": "b5c4842", "0363100012141114": "pe1d6d3", "0363100012141189": "b493833", "0363100012141246": "b724e43", "0363100012141247": "b52392b", "0363100012141254": "b584b47", "0363100012141342": "b634945", "0363100012141347": "b815953", "0363100012141388": "ba67d72", "0363100012141429": "ba47973", "0363100012141489": "b6e584c", "0363100012141533": "pd7d7da", "0363100012141652": "b463834", "0363100012141655": "b6a5853", "0363100012141657": "p6e7275", "0363100012141734": "pe0dbd4", "0363100012141748": "b5c4437", "0363100012141767": "b362a27", "0363100012141772": "p5e5f5e", "0363100012141784": "p636260", "0363100012141794": "b68524c", "0363100012141796": "b613c37", "0363100012141797": "b5f3a35", "0363100012141802": "b5c3833", "0363100012141816": "b6e4b3f", "0363100012141832": "p676a6e", "0363100012141834": "b4c3f3b", "0363100012141837": "b3c2421", "0363100012141873": "b2d211e", "0363100012141874": "b5a4c48", "0363100012141878": "p85888b", "0363100012141898": "b5e504c", "0363100012141903": "b2d211e", "0363100012141922": "b936f5f", "0363100012141936": "b422f2a", "0363100012141967": "b8c7a75", "0363100012141998": "b53332e", "0363100012142035": "pe0eaed", "0363100012142046": "b49352f", "0363100012142089": "pa7a19c", "0363100012142120": "b735442", "0363100012142157": "b885f59", "0363100012142173": "b5a3732", "0363100012142208": "pe8e8ea", "0363100012142228": "bab8a78", "0363100012142254": "b483b38", "0363100012142315": "b43302b", "0363100012142390": "p696e71", "0363100012142400": "b442f29", "0363100012142402": "b6b4540", "0363100012142403": "b70513f", "0363100012142415": "b413431", "0363100012142416": "pdfdbd5", "0363100012142438": "b604d48", "0363100012142440": "b5b463a", "0363100012142448": "bb1867d", "0363100012142463": "pab9f98", "0363100012142549": "p9c8d86", "0363100012142560": "p757576", "0363100012142602": "pe3d7d2", "0363100012142630": "b50433f", "0363100012142672": "b3f2f2b", "0363100012142690": "p6b6b6b", "0363100012142721": "b7e574f", "0363100012142728": "b7b584a", "0363100012142737": "pece8e0", "0363100012142738": "b55352d", "0363100012142743": "p868585", "0363100012142773": "b3d312d", "0363100012142781": "ba47c6f", "0363100012142854": "b786a66", "0363100012142887": "b493327", "0363100012142908": "b967562", "0363100012142917": "b473a36", "0363100012142935": "bb28680", "0363100012142957": "pe6e8eb", "0363100012142959": "b9f766c", "0363100012142993": "b64544f", "0363100012143040": "b8d6c59", "0363100012143065": "b6b5954", "0363100012143079": "b322521", "0363100012143210": "b6b4e42", "0363100012143211": "b645551", "0363100012143232": "b5b4e4a", "0363100012143242": "b846451", "0363100012143244": "p828180", "0363100012143269": "b2d211e", "0363100012143286": "pe4e9ec", "0363100012143296": "p7c7d7f", "0363100012143324": "b81614e", "0363100012143369": "b9c7966", "0363100012143413": "b574a46", "0363100012143422": "b5d4f4b", "0363100012143428": "b4f302c", "0363100012143430": "pdbdbd8", "0363100012143431": "b5f4e49", "0363100012143440": "b6a443f", "0363100012143442": "b4c3f3b", "0363100012143521": "b453531", "0363100012143526": "pe0d9d4", "0363100012143561": "b61534f", "0363100012143587": "b5c3834", "0363100012143641": "pede6e9", "0363100012143664": "pe0eaed", "0363100012143669": "b946b63", "0363100012143700": "b6f615d", "0363100012143701": "pe6dbd0", "0363100012143703": "pe4e9ec", "0363100012143932": "b916f5d", "0363100012143935": "p787978", "0363100012143951": "b8a675d", "0363100012143957": "b362a27", "0363100012143992": "b5e3d30", "0363100012143995": "p797a7d", "0363100012144048": "b3a2e2a", "0363100012144166": "p6a6c6f", "0363100012144180": "b8b6a57", "0363100012144214": "b39261b", "0363100012144250": "p7a7a78", "0363100012144297": "b342825", "0363100012144300": "b7d6b66", "0363100012144307": "b574033", "0363100012144453": "b60514c", "0363100012144459": "b715240", "0363100012144571": "b766864", "0363100012144573": "p878a8a", "0363100012144645": "b8f685d", "0363100012144648": "p707376", "0363100012144674": "b3a2722", "0363100012144707": "b9c736b", "0363100012144746": "b6e605c", "0363100012144748": "p6c6d6e", "0363100012144749": "p6e6e70", "0363100012144759": "b755e57", "0363100012144761": "p596164", "0363100012144779": "b3d312d", "0363100012144835": "b2d211e", "0363100012144842": "b3d312d", "0363100012144845": "pccbebc", "0363100012144846": "b6a5550", "0363100012144854": "bac8976", "0363100012144855": "b92715e", "0363100012144863": "b70513f", "0363100012144869": "pe6ddd1", "0363100012144902": "b846655", "0363100012144903": "p727275", "0363100012144953": "pe8d3cf", "0363100012145050": "b3e2d28", "0363100012145067": "b3b291e", "0363100012145068": "p79797d", "0363100012145074": "b855c56", "0363100012145088": "b503627", "0363100012145089": "b5d3d30", "0363100012145094": "b2f201c", "0363100012145099": "p68686a", "0363100012145112": "pe5e8ec", "0363100012145238": "p757575", "0363100012145273": "b644736", "0363100012145298": "p6f7475", "0363100012145299": "b887975", "0363100012145339": "pdddbd6", "0363100012145348": "pe0eaed", "0363100012145350": "b856e67", "0363100012145351": "b382b28", "0363100012145524": "b936f5f", "0363100012145543": "b30231f", "0363100012145615": "b6e574d", "0363100012145624": "b2d211e", "0363100012145647": "b6d493e", "0363100012145654": "b54332f", "0363100012145681": "b6a5c58", "0363100012145735": "pe6e8e9", "0363100012145745": "p979794", "0363100012145763": "pe5e9eb", "0363100012145782": "b433632", "0363100012145804": "b916c5e", "0363100012145855": "ba27c77", "0363100012145921": "p6e7071", "0363100012145951": "b8b6958", "0363100012146025": "bac8976", "0363100012146034": "b69493a", "0363100012146061": "b715240", "0363100012146097": "pe9e8e3", "0363100012146117": "pcacac7", "0363100012146153": "b443530", "0363100012146169": "b583631", "0363100012146180": "b533c35", "0363100012146203": "b58382e", "0363100012146213": "p7f8082", "0363100012146248": "b796255", "0363100012146261": "bad8976", "0363100012146263": "b3e312d", "0363100012146268": "b635551", "0363100012146273": "b725341", "0363100012146276": "b736561", "0363100012146321": "b2f2420", "0363100012146328": "p696b6c", "0363100012146338": "b312522", "0363100012146342": "p78797a", "0363100012146344": "b41322d", "0363100012146346": "b715c57", "0363100012146350": "p64686b", "0363100012146357": "b7f5f4d", "0363100012146366": "b9c716b", "0363100012146367": "b4c362c", "0363100012146379": "pe6e8ec", "0363100012146381": "peee7de", "0363100012146384": "b603b36", "0363100012146386": "b523d31", "0363100012146404": "b776965", "0363100012146424": "b4f3c37", "0363100012146465": "b856053", "0363100012146520": "b4a3d39", "0363100012146523": "pe6e8eb", "0363100012146553": "b463935", "0363100012146598": "b6e605c", "0363100012146611": "peae8dd", "0363100012146632": "b8d6f5e", "0363100012146776": "p616363", "0363100012146786": "pe8e8e7", "0363100012146885": "p6b6b6c", "0363100012146920": "p939394", "0363100012146957": "b493327", "0363100012146995": "p78797c", "0363100012146999": "bab8376", "0363100012147018": "pdcd9d9", "0363100012147023": "b755644", "0363100012147044": "pb1988b", "0363100012147093": "b7b554c", "0363100012147096": "bac8976", "0363100012147109": "p81807e", "0363100012147202": "p787a7a", "0363100012147206": "pe9e8e5", "0363100012147327": "p898987", "0363100012147328": "bac8976", "0363100012147347": "p9d9e9b", "0363100012147348": "b39261b", "0363100012147350": "p9d9f9d", "0363100012147364": "pe7e8eb", "0363100012147398": "p5d5f62", "0363100012147496": "p7f8286", "0363100012147513": "b654642", "0363100012147556": "b422823", "0363100012147656": "b6b4d3b", "0363100012147701": "p63676b", "0363100012147717": "pb0b4b7", "0363100012147767": "pe7e8eb", "0363100012147787": "b825b51", "0363100012147800": "b6e4742", "0363100012147880": "pece9d5", "0363100012147902": "pb9b1aa", "0363100012147911": "b4a3d39", "0363100012147935": "b68423d", "0363100012147950": "b5e4842", "0363100012147963": "pdbd9d7", "0363100012148026": "b675752", "0363100012148089": "bac8976", "0363100012148099": "b9d7968", "0363100012148103": "b3f2c27", "0363100012148152": "b6f4c3f", "0363100012148158": "ba2796f", "0363100012148179": "b564845", "0363100012148192": "p7c7d81", "0363100012148211": "b795548", "0363100012148222": "p818080", "0363100012148224": "b3e322e", "0363100012148251": "pebe8e2", "0363100012148253": "pb8b2b3", "0363100012148261": "b735442", "0363100012148296": "p808688", "0363100012148298": "b725e59", "0363100012148353": "p8f8f8e", "0363100012148387": "p7f8789", "0363100012148388": "b6f514d", "0363100012148431": "b715e59", "0363100012148469": "b2d211e", "0363100012148558": "pb38e92", "0363100012148629": "p787879", "0363100012148680": "b412e23", "0363100012148690": "pe0d9d4", "0363100012148692": "b79625b", "0363100012148784": "b4f302c", "0363100012148824": "pe8c6c8", "0363100012148828": "b9e746e", "0363100012148831": "b493c38", "0363100012148888": "p8f8d87", "0363100012148898": "p999291", "0363100012148899": "pe4ded2", "0363100012148900": "b6a493a", "0363100012148930": "pdad8d8", "0363100012148978": "p666867", "0363100012149032": "b926963", "0363100012149042": "p77787a", "0363100012149070": "b2e211d", "0363100012149101": "p696a6a", "0363100012149175": "pece7ea", "0363100012149179": "pe6e8eb", "0363100012149250": "ba5836f", "0363100012149261": "b997067", "0363100012149268": "pe8e8e4", "0363100012149278": "b563430", "0363100012149378": "pead7cd", "0363100012149379": "p868686", "0363100012149380": "b432d20", "0363100012149381": "b665854", "0363100012149388": "pdcdbd7", "0363100012149389": "p636569", "0363100012149393": "b5c4b46", "0363100012149396": "pe7d7cf", "0363100012149397": "b534642", "0363100012149417": "pe6e8ec", "0363100012149422": "p7c7e81", "0363100012149425": "b5a4c48", "0363100012149428": "pe1d7d3", "0363100012149432": "b4f403b", "0363100012149451": "b926863", "0363100012149556": "b665550", "0363100012149577": "b685a56", "0363100012149580": "bb28680", "0363100012149601": "p686a6c", "0363100012149676": "b7b5e5a", "0363100012149807": "b3e2a1f", "0363100012149812": "pe2e9ec", "0363100012149918": "b634642", "0363100012149986": "b5e4f4a", "0363100012149987": "b7b544e", "0363100012149994": "b7b6660", "0363100012150082": "p848485", "0363100012150105": "b654f48", "0363100012150114": "ba98773", "0363100012150227": "b7a534c", "0363100012150238": "pddd8d6", "0363100012150279": "pdaebee", "0363100012150293": "bb1877e", "0363100012150298": "p7b7a79", "0363100012150400": "b674642", "0363100012150403": "b3e322e", "0363100012150463": "pe6ddd3", "0363100012150533": "pdee0d6", "0363100012150567": "p848484", "0363100012150649": "b6c4a45", "0363100012150650": "b67413c", "0363100012150692": "peddfdd", "0363100012150747": "b342825", "0363100012150754": "b8e665d", "0363100012150763": "b744d47", "0363100012150771": "bae837b", "0363100012150815": "b845c55", "0363100012150838": "pe6e8ec", "0363100012150865": "b967265", "0363100012150869": "pd8d3dd", "0363100012150870": "b4b3e3a", "0363100012150871": "b826e68", "0363100012150872": "b4d3933", "0363100012150876": "p696868", "0363100012150877": "p7a7c7b", "0363100012150885": "b88756f", "0363100012150893": "b5b3930", "0363100012150900": "b80685b", "0363100012150909": "b4a3d39", "0363100012150954": "b432a23", "0363100012150957": "p81807f", "0363100012150961": "b312117", "0363100012150966": "b4f3527", "0363100012150968": "b83716c", "0363100012150978": "b6a443f", "0363100012151017": "b896258", "0363100012151018": "ba0786c", "0363100012151043": "b87625d", "0363100012151114": "peed4c0", "0363100012151121": "pdcdbd7", "0363100012151137": "bac8976", "0363100012151187": "pe2d9d3", "0363100012151208": "p9c9899", "0363100012151222": "b977664", "0363100012151393": "pe1ded6", "0363100012151404": "p727476", "0363100012151406": "b554541", "0363100012151409": "pe6dad1", "0363100012151478": "pe8e8e7", "0363100012151534": "p82817f", "0363100012151588": "p74767a", "0363100012151605": "b514440", "0363100012151615": "p77787b", "0363100012151619": "p656669", "0363100012151668": "b493c39", "0363100012151674": "b785547", "0363100012151677": "b4b3e3b", "0363100012151718": "pf1e6e2", "0363100012151730": "p676e71", "0363100012151739": "pdfdbd5", "0363100012151769": "b423532", "0363100012151856": "p606466", "0363100012151861": "p6d6d6c", "0363100012151862": "p727272", "0363100012151873": "pdeddd6", "0363100012151875": "b84746f", "0363100012151877": "pece8dd", "0363100012151879": "b3c302c", "0363100012151906": "b372b28", "0363100012151910": "b382c28", "0363100012151935": "b91786b", "0363100012151941": "b5f3f3a", "0363100012151964": "bad8776", "0363100012151983": "b9c7a67", "0363100012152060": "b38251b", "0363100012152088": "pece4de", "0363100012152098": "b4a3a36", "0363100012152113": "b3f2a1e", "0363100012152158": "p8c8b8a", "0363100012152246": "pe9c9cb", "0363100012152277": "b755d56", "0363100012152283": "b4a3d39", "0363100012152309": "b987165", "0363100012152566": "b5a3f2f", "0363100012152611": "b3f302b", "0363100012152626": "pe0eaed", "0363100012152631": "b3d2923", "0363100012152658": "b4c382c", "0363100012152739": "peae9d9", "0363100012152771": "b6f4943", "0363100012152825": "p7c7c80", "0363100012152844": "p979394", "0363100012152868": "b866453", "0363100012152975": "b432f29", "0363100012153031": "p8e9093", "0363100012153044": "bac8976", "0363100012153207": "b675955", "0363100012153400": "b734e44", "0363100012153595": "pe6e8ec", "0363100012153667": "b966e64", "0363100012153726": "b734c47", "0363100012153791": "b574945", "0363100012153867": "p67686b", "0363100012153868": "b896855", "0363100012153870": "b534642", "0363100012153873": "pd7d8db", "0363100012153879": "b66403b", "0363100012153982": "p777675", "0363100012154012": "pe6e8ec", "0363100012154013": "pece6ef", "0363100012154025": "b846252", "0363100012154069": "b8b6a57", "0363100012154074": "b764e49", "0363100012154277": "b6d554e", "0363100012154305": "p78787a", "0363100012154314": "b5f4b46", "0363100012154335": "b604c47", "0363100012154449": "pc4c5c2", "0363100012154472": "p78787a", "0363100012154482": "pe9e8e3", "0363100012154486": "pa7aaad", "0363100012154501": "b433633", "0363100012154511": "b6e4f3e", "0363100012154515": "b866155", "0363100012154519": "b7c5c4a", "0363100012154574": "b574945", "0363100012154588": "b7f6150", "0363100012154589": "b473a36", "0363100012154604": "p596063", "0363100012154625": "b70625e", "0363100012154705": "pf0dac4", "0363100012154846": "pe8e8e7", "0363100012154854": "b645653", "0363100012154860": "pdddcd7", "0363100012154881": "b43332e", "0363100012154909": "b3b281d", "0363100012154913": "b9d7b68", "0363100012154919": "p777c7e", "0363100012155001": "pd8d9da", "0363100012155014": "p7c7c7f", "0363100012155019": "b412c1f", "0363100012155115": "p717272", "0363100012155169": "b342825", "0363100012155171": "b362723", "0363100012155172": "b5a4b46", "0363100012155189": "b7b534e", "0363100012155190": "pecdacc", "0363100012155215": "pe7e8eb", "0363100012155220": "b7a544b", "0363100012155228": "b493c38", "0363100012155235": "b492e26", "0363100012155245": "p818282", "0363100012155300": "pe8e8ea", "0363100012155422": "b483b38", "0363100012155452": "b674c48", "0363100012155473": "p787879", "0363100012155492": "b564742", "0363100012155572": "b5f4231", "0363100012155637": "p757777", "0363100012155701": "p929191", "0363100012155765": "b866b5d", "0363100012155879": "b665854", "0363100012156027": "b62504a", "0363100012156047": "p82817d", "0363100012156342": "p888889", "0363100012156481": "b70615c", "0363100012156487": "b5b3832", "0363100012156715": "pede7e3", "0363100012156742": "b412c20", "0363100012156745": "p7e8184", "0363100012156758": "b2d211e", "0363100012156783": "b978580", "0363100012156843": "pe8e8e8", "0363100012157006": "p959597", "0363100012157007": "p97999c", "0363100012157338": "b543f33", "0363100012157402": "b4c3b36", "0363100012157515": "b423532", "0363100012157516": "p6e7070", "0363100012157546": "b8e6f5d", "0363100012157549": "b987764", "0363100012157738": "pead4cd", "0363100012157794": "p606063", "0363100012157905": "b977064", "0363100012157935": "b6b493c", "0363100012158018": "p858487", "0363100012158217": "p797878", "0363100012158292": "b543d37", "0363100012158297": "pe9e8eb", "0363100012158365": "b9e736d", "0363100012158398": "b70514d", "0363100012158480": "b785646", "0363100012158511": "p757675", "0363100012158558": "pf2e0c9", "0363100012158599": "pe7e8eb", "0363100012158615": "b816962", "0363100012158660": "b6a4e3d", "0363100012158690": "b815c51", "0363100012158733": "b835b55", "0363100012158774": "pa79995", "0363100012158856": "p9b9694", "0363100012159057": "b452e21", "0363100012159128": "b433633", "0363100012159253": "b67433e", "0363100012159262": "b2f2420", "0363100012159265": "b5e4b46", "0363100012159266": "b524541", "0363100012159299": "b584a46", "0363100012159367": "b5e4a44", "0363100012159372": "bb0877c", "0363100012159388": "p818181", "0363100012159397": "b674540", "0363100012159427": "b8d7467", "0363100012159438": "pcbeff1", "0363100012159495": "b7d5d4b", "0363100012159519": "pe2e9ec", "0363100012159825": "b8a7062", "0363100012159830": "b7e665f", "0363100012159847": "ba57b73", "0363100012159859": "ba78b7c", "0363100012159892": "b9e7969", "0363100012159993": "b9e766b", "0363100012160026": "b79564c", "0363100012160104": "b5b4742", "0363100012160130": "b473a37", "0363100012160331": "b7a5948", "0363100012160355": "b3f332f", "0363100012160360": "b6e4f3d", "0363100012160391": "p89898a", "0363100012160418": "b493c38", "0363100012160577": "b38211e", "0363100012160658": "p9b9895", "0363100012160713": "pe1dad4", "0363100012160876": "p7d7e80", "0363100012160926": "b7d574e", "0363100012160952": "b8e7568", "0363100012160958": "ba48b84", "0363100012161007": "b493c38", "0363100012161159": "b866254", "0363100012161185": "ba38c85", "0363100012161266": "bac8976", "0363100012161362": "pe4dedc", "0363100012161413": "b53433f", "0363100012161473": "bac8976", "0363100012161507": "b5e3b33", "0363100012161723": "paaa8ab", "0363100012161755": "b9f7c6a", "0363100012161810": "p808184", "0363100012161843": "b6d4641", "0363100012161938": "b59433d", "0363100012162006": "p969091", "0363100012162062": "b44322d", "0363100012162075": "p828789", "0363100012162164": "p7f8386", "0363100012162590": "b6a483b", "0363100012162605": "b302421", "0363100012162677": "b8c635d", "0363100012162691": "pe7e8ec", "0363100012162724": "bab8a77", "0363100012162742": "b6b443f", "0363100012162804": "p6f7070", "0363100012162852": "b403330", "0363100012162990": "b9f7a6a", "0363100012163001": "b31211d", "0363100012163004": "p747776", "0363100012163114": "b615450", "0363100012163361": "p6f7170", "0363100012163441": "b5a3b34", "0363100012163483": "p948c89", "0363100012163490": "b3b2f2b", "0363100012163548": "b4f3b30", "0363100012163574": "b4d403c", "0363100012163668": "p858687", "0363100012163674": "p7a7f82", "0363100012163760": "b9e776b", "0363100012163791": "b644c3f", "0363100012164006": "pe7e8eb", "0363100012164036": "pe6e8eb", "0363100012164275": "b322118", "0363100012164405": "b633f3a", "0363100012164550": "p5d5f63", "0363100012164560": "pa6948f", "0363100012164574": "pa89692", "0363100012164611": "pe6e8eb", "0363100012164740": "p707173", "0363100012164931": "b5c3f2e", "0363100012164946": "bac8976", "0363100012164972": "b8c6659", "0363100012164987": "b422a22", "0363100012165057": "p98938d", "0363100012165069": "ba98673", "0363100012165098": "b5f4230", "0363100012165104": "p7e7e7f", "0363100012165106": "pd7d8db", "0363100012165126": "b5d3d2f", "0363100012165210": "b665651", "0363100012165224": "pe5e8ec", "0363100012165377": "pb6acb2", "0363100012165437": "pa19291", "0363100012165452": "ba68b7f", "0363100012165458": "pe0d6d4", "0363100012165467": "baa8a7f", "0363100012165468": "p96928f", "0363100012165558": "b422d20", "0363100012165560": "p727272", "0363100012165561": "b997068", "0363100012165615": "b856152", "0363100012165622": "b3b2f2b", "0363100012165650": "p636366", "0363100012165663": "b675a56", "0363100012165687": "b635551", "0363100012165696": "b422922", "0363100012165725": "pe7e8e8", "0363100012165735": "pe6dfdc", "0363100012165812": "b714a45", "0363100012165835": "p717375", "0363100012165841": "p7b7d80", "0363100012165845": "b39261b", "0363100012165913": "b3a2b26", "0363100012166200": "b4e403d", "0363100012166229": "b806a63", "0363100012166296": "p727171", "0363100012166332": "b704c40", "0363100012166463": "b987663", "0363100012166543": "peae6e2", "0363100012166698": "b806c66", "0363100012166783": "b665854", "0363100012166828": "b70513f", "0363100012166834": "b5a3830", "0363100012166913": "p979492", "0363100012166916": "p757678", "0363100012166920": "b967262", "0363100012166926": "b776661", "0363100012166927": "b9c8d89", "0363100012166943": "peae8e5", "0363100012166981": "b473b37", "0363100012166995": "p797a7b", "0363100012167021": "b524541", "0363100012167049": "pe4ded9", "0363100012167113": "b655753", "0363100012167115": "b4a3d3a", "0363100012167159": "b2d211d", "0363100012167197": "b433633", "0363100012167224": "pe6d9d0", "0363100012167296": "b52332c", "0363100012167413": "b856756", "0363100012167539": "p5d6366", "0363100012167564": "pe4e0da", "0363100012167565": "pe9e8e5", "0363100012167566": "pe6e2dc", "0363100012167569": "b8d726b", "0363100012167755": "b90736e", "0363100012167757": "b8b6d69", "0363100012167824": "b473a37", "0363100012167832": "b4c3f3c", "0363100012167837": "p7b7d80", "0363100012167850": "b58433d", "0363100012167854": "padacac", "0363100012167855": "p9d9c99", "0363100012167891": "pe1dbd5", "0363100012167975": "p79797a", "0363100012168032": "pdcdad7", "0363100012168081": "p7c7e81", "0363100012168082": "b6a514b", "0363100012168100": "p7c7c7f", "0363100012168101": "baf8782", "0363100012168121": "b422825", "0363100012168139": "pebe8e3", "0363100012168160": "b836350", "0363100012168183": "b705546", "0363100012168193": "p939198", "0363100012168217": "pe4e2dc", "0363100012168219": "pd7d7da", "0363100012168222": "pd8d7d9", "0363100012168225": "b825f4f", "0363100012168258": "b5a3831", "0363100012168304": "b7c544f", "0363100012168341": "pa2968f", "0363100012168446": "b3e322e", "0363100012168492": "pebe8e2", "0363100012168530": "b2f201c", "0363100012168544": "b856352", "0363100012168594": "pdfdad5", "0363100012168599": "p7d8184", "0363100012168615": "bac8976", "0363100012168620": "p717174", "0363100012168718": "b68423d", "0363100012168722": "b433733", "0363100012168724": "b473a36", "0363100012168725": "b4c3f3b", "0363100012168741": "peae8e3", "0363100012168777": "b312521", "0363100012168778": "pe5e3df", "0363100012168827": "pece4e0", "0363100012168830": "b5f4f4a", "0363100012168834": "pe7e8eb", "0363100012168836": "b896457", "0363100012168837": "b544643", "0363100012168865": "b6c483f", "0363100012168896": "p818184", "0363100012169029": "b382c28", "0363100012169080": "b5e3934", "0363100012169163": "b8e705f", "0363100012169215": "b674439", "0363100012169245": "pe8e8e9", "0363100012169272": "p676d6f", "0363100012169301": "pdedcd5", "0363100012169312": "b4d403c", "0363100012169332": "pdee3e4", "0363100012169342": "b402c26", "0363100012169352": "p8e8e8f", "0363100012169362": "b423632", "0363100012169393": "pe5d4d0", "0363100012169398": "b513834", "0363100012169399": "p9c98a1", "0363100012169412": "peae8e1", "0363100012169558": "b331e1c", "0363100012169573": "p737477", "0363100012169599": "b776965", "0363100012169616": "b482c28", "0363100012169632": "b867773", "0363100012169637": "b95796a", "0363100012169641": "p808286", "0363100012169653": "b331e1c", "0363100012169714": "b46332d", "0363100012169717": "b754e48", "0363100012169731": "b805853", "0363100012169733": "p8f9297", "0363100012169734": "b6e605c", "0363100012169735": "b7b5651", "0363100012169736": "b331e1b", "0363100012169761": "pf3e2c8", "0363100012169764": "p787878", "0363100012169778": "b5c423f", "0363100012169780": "b574945", "0363100012169798": "b2d211e", "0363100012169853": "b463732", "0363100012169909": "b78514b", "0363100012169937": "b3e2a24", "0363100012169994": "b805f4e", "0363100012170003": "pe0dad4", "0363100012170026": "b71635f", "0363100012170032": "b756763", "0363100012170042": "b835b55", "0363100012170049": "b655550", "0363100012170053": "pe7e8e7", "0363100012170091": "pe6e8eb", "0363100012170273": "pe0ded5", "0363100012170297": "p787978", "0363100012170309": "b674538", "0363100012170322": "peae8e0", "0363100012170332": "b765745", "0363100012170339": "b795548", "0363100012170342": "p9b9894", "0363100012170348": "b4d403c", "0363100012170376": "p6f7678", "0363100012170390": "b543929", "0363100012170392": "b57362e", "0363100012170407": "p74767a", "0363100012170465": "b382a26", "0363100012170551": "b452a26", "0363100012170554": "p989592", "0363100012170559": "b715a4d", "0363100012170562": "pe1eaed", "0363100012170563": "b7b6c68", "0363100012170576": "b775745", "0363100012170595": "pc6b7a3", "0363100012170617": "p8b8a89", "0363100012170619": "b61534f", "0363100012170623": "b302017", "0363100012170628": "p7f8082", "0363100012170643": "b69493a", "0363100012170644": "b4e3129", "0363100012170645": "b634534", "0363100012170656": "b4f3529", "0363100012170675": "p646566", "0363100012170679": "p616363", "0363100012170732": "pe9e8e2", "0363100012170745": "b7c554d", "0363100012170748": "p616364", "0363100012170774": "b613d35", "0363100012170809": "p858889", "0363100012170819": "pe1d9d3", "0363100012170873": "b634234", "0363100012170900": "b643f3a", "0363100012170915": "b623d38", "0363100012170928": "b2f2320", "0363100012170941": "b30201b", "0363100012170950": "b604032", "0363100012171002": "b725747", "0363100012171015": "peee7d9", "0363100012171019": "pdcdbd7", "0363100012171031": "b302017", "0363100012171135": "pddebed", "0363100012171141": "b69433e", "0363100012171156": "p938b88", "0363100012171162": "b766864", "0363100012171185": "b3a2320", "0363100012171220": "pe2d5d3", "0363100012171223": "pe7e8e8", "0363100012171341": "b4a3d39", "0363100012171370": "b7d6456", "0363100012171372": "pdfeaed", "0363100012171374": "pf1dbbe", "0363100012171452": "b55362c", "0363100012171521": "b3f322f", "0363100012171538": "b6b5751", "0363100012171543": "b6b544d", "0363100012171545": "b80604d", "0363100012171549": "b321f19", "0363100012171607": "p898d91", "0363100012171612": "pe3e9ec", "0363100012171613": "b311f1a", "0363100012171626": "b574742", "0363100012171627": "p6a6f72", "0363100012171656": "b734f44", "0363100012171657": "b755145", "0363100012171759": "b3d2521", "0363100012171781": "b634c45", "0363100012171793": "b8c6b58", "0363100012171794": "pe6dbd0", "0363100012171823": "p9fa0a0", "0363100012171833": "b2e221f", "0363100012171834": "pdcdbd7", "0363100012171835": "p9c9d9e", "0363100012171839": "b9e7b68", "0363100012171841": "b8e675c", "0363100012171912": "b2d211e", "0363100012171951": "pebddd4", "0363100012171991": "b7b5c57", "0363100012172011": "b432c21", "0363100012172054": "b514440", "0363100012172064": "ba07a71", "0363100012172065": "b856c65", "0363100012172082": "p686a6c", "0363100012172105": "p908e8b", "0363100012172106": "b704f3f", "0363100012172107": "b302017", "0363100012172253": "b694540", "0363100012172265": "b8e7f7b", "0363100012172268": "ba28881", "0363100012172385": "b443834", "0363100012172398": "b734c46", "0363100012172459": "pe3e1dd", "0363100012172516": "pefd7c2", "0363100012172521": "pd8e8eb", "0363100012172522": "pdcebee", "0363100012172570": "p5d5f62", "0363100012172597": "b392c28", "0363100012172598": "b40322e", "0363100012172600": "b524541", "0363100012172633": "b523e33", "0363100012172642": "b5b413e", "0363100012172650": "pe1eaec", "0363100012172655": "b37211e", "0363100012172659": "b755345", "0363100012172694": "b452926", "0363100012172698": "b714f41", "0363100012172740": "b513629", "0363100012172742": "b8f675f", "0363100012172830": "b846351", "0363100012172926": "p8a8b8f", "0363100012172931": "peddacc", "0363100012172935": "p9a8d81", "0363100012172939": "b6c4d3c", "0363100012172946": "b947b73", "0363100012172948": "b81726e", "0363100012173001": "pe3e9ec", "0363100012173002": "pe3dfd2", "0363100012173019": "b402e29", "0363100012173147": "pe6e8eb", "0363100012173172": "b50302c", "0363100012173178": "p99959d", "0363100012173183": "p7f8183", "0363100012173194": "pd7dcdb", "0363100012173196": "b6b544e", "0363100012173231": "baf8779", "0363100012173278": "b80726d", "0363100012173372": "b84635e", "0363100012173373": "b513c36", "0363100012173503": "b654743", "0363100012173566": "b321f19", "0363100012173615": "pe4e9ec", "0363100012173622": "b6a5c58", "0363100012173711": "p99938f", "0363100012173712": "pe3d9d2", "0363100012173713": "b674239", "0363100012173725": "p6b6d6f", "0363100012173728": "b5b463f", "0363100012173729": "b574844", "0363100012173745": "b3f2d22", "0363100012173765": "ba38574", "0363100012173772": "p989699", "0363100012173773": "bac8976", "0363100012173786": "pf2e5c9", "0363100012173794": "pede5dc", "0363100012173813": "b413431", "0363100012173825": "b81604e", "0363100012173828": "b7a5a48", "0363100012173834": "pece7e8", "0363100012173860": "pa7a7a7", "0363100012173891": "b603d33", "0363100012173904": "b8b6758", "0363100012173969": "b604643", "0363100012174087": "pd6d8db", "0363100012174304": "pd8d7da", "0363100012174305": "b331e1b", "0363100012174308": "b33241f", "0363100012174393": "b3e2b26", "0363100012174478": "b2d221e", "0363100012174500": "p978d8b", "0363100012174506": "b584b47", "0363100012174507": "b544643", "0363100012174516": "b896158", "0363100012174532": "b312117", "0363100012174604": "pe2e9ec", "0363100012174606": "b31201c", "0363100012174659": "b624c46", "0363100012174801": "pa49a8d", "0363100012174810": "b734c46", "0363100012174823": "p7a7c7e", "0363100012174830": "b5e3e34", "0363100012174924": "b5a4c48", "0363100012174934": "b665854", "0363100012175005": "b64493d", "0363100012175025": "b482b28", "0363100012175072": "p5f6062", "0363100012175083": "ba17770", "0363100012175085": "b331f1c", "0363100012175087": "b8a7671", "0363100012175093": "pdfd8d5", "0363100012175095": "ba67b75", "0363100012175096": "pe9e8e0", "0363100012175212": "b311f1a", "0363100012175221": "b331e1c", "0363100012175392": "p9f9288", "0363100012175442": "b33211c", "0363100012175468": "b482e25", "0363100012175495": "b735142", "0363100012175553": "b342622", "0363100012175677": "b7e5651", "0363100012175895": "p65676b", "0363100012175910": "bb0877c", "0363100012175911": "b8a6c68", "0363100012175914": "pe8e9e2", "0363100012176041": "b433633", "0363100012176105": "b564641", "0363100012176106": "b412724", "0363100012176107": "b412724", "0363100012176109": "b765f58", "0363100012176110": "b745d56", "0363100012176115": "b785349", "0363100012176165": "b4e3526", "0363100012176169": "b331e1c", "0363100012176177": "b3d2b26", "0363100012176189": "b4b3c37", "0363100012176649": "p717172", "0363100012176655": "b734c47", "0363100012176743": "b8b625d", "0363100012176870": "b603b36", "0363100012176877": "b704c42", "0363100012176879": "b775745", "0363100012176880": "b3e2b26", "0363100012176940": "b3d302d", "0363100012176989": "b3e2e2a", "0363100012177068": "b4a3d3a", "0363100012177070": "b392d29", "0363100012177106": "pdeeaed", "0363100012177172": "b422c20", "0363100012177238": "b866154", "0363100012177244": "b765644", "0363100012177274": "b36211e", "0363100012177314": "b4c3f3b", "0363100012177362": "b331e1c", "0363100012177474": "b574337", "0363100012177572": "p676769", "0363100012177573": "pe4e9ec", "0363100012177578": "pdaebee", "0363100012177685": "b483b38", "0363100012177698": "b8f807c", "0363100012177782": "b584137", "0363100012177821": "p6d7074", "0363100012177871": "b331e1c", "0363100012177940": "b2e211d", "0363100012177968": "pd8d7da", "0363100012177998": "b7b584a", "0363100012178067": "peadace", "0363100012178089": "pf3e3c9", "0363100012178093": "p898888", "0363100012178097": "pf4e2c4", "0363100012178152": "b392721", "0363100012178154": "b987564", "0363100012178188": "b7a534c", "0363100012178208": "b7c584a", "0363100012178209": "b80604e", "0363100012178273": "p908c85", "0363100012178310": "pdcdbd7", "0363100012178326": "b4e3526", "0363100012178336": "b7f5950", "0363100012178391": "b827470", "0363100012178408": "pf0e0ca", "0363100012178442": "b4c2e2a", "0363100012178456": "pdbdbd7", "0363100012178464": "b6d4742", "0363100012178510": "pece7e2", "0363100012178517": "b6f4941", "0363100012178526": "pe7e8e9", "0363100012178557": "b705a53", "0363100012178617": "b8e7f7a", "0363100012178619": "p9e857d", "0363100012178697": "b9d8d89", "0363100012178702": "b704944", "0363100012178709": "peae8e3", "0363100012178710": "b8e6d68", "0363100012178811": "pecdacd", "0363100012178813": "pe9dcce", "0363100012178814": "pebdfcd", "0363100012178862": "pe8e8ea", "0363100012178898": "b5c3b30", "0363100012179046": "pd0dde1", "0363100012179047": "b847571", "0363100012179121": "pe0eaeb", "0363100012179127": "b36201d", "0363100012179384": "b3e2a24", "0363100012179424": "b6c5e5a", "0363100012179485": "b513a2c", "0363100012179488": "b77504a", "0363100012179492": "p949b9d", "0363100012179557": "pe6e8ea", "0363100012179562": "pe9e8e6", "0363100012179579": "p6c6d70", "0363100012179583": "pdadad9", "0363100012179612": "b8a615b", "0363100012179711": "b533c32", "0363100012179756": "b4f302c", "0363100012179858": "p92989b", "0363100012179967": "b3d2e29", "0363100012180327": "b8a7b77", "0363100012180360": "b6b4540", "0363100012180393": "b5d3e2f", "0363100012180411": "b432c21", "0363100012180473": "b321f19", "0363100012180558": "ba78471", "0363100012180561": "b9f7d69", "0363100012180572": "b775846", "0363100012180573": "b82614f", "0363100012180579": "b573b2b", "0363100012180581": "b332218", "0363100012180583": "pe7ddd0", "0363100012180584": "b5b3e2d", "0363100012180585": "b5a3d2c", "0363100012180587": "b3a271c", "0363100012180588": "b3c271e", "0363100012180589": "b604231", "0363100012180590": "b432d21", "0363100012180591": "b67493a", "0363100012180592": "b6d4e3c", "0363100012180626": "p898a87", "0363100012180630": "b4b3d39", "0363100012180694": "pb2aea8", "0363100012180698": "baa8774", "0363100012180722": "p7f7e7e", "0363100012180728": "p8e8e8d", "0363100012180729": "p7a7979", "0363100012180733": "p7b7a7a", "0363100012180734": "p7c7d7d", "0363100012180741": "p817f7c", "0363100012180748": "p606161", "0363100012180791": "b856352", "0363100012180793": "p8d989a", "0363100012180794": "pa19b97", "0363100012180795": "b5d3f2e", "0363100012180798": "ba78471", "0363100012180813": "b745b51", "0363100012180832": "b694839", "0363100012180833": "b886a59", "0363100012180836": "b664537", "0363100012180954": "p7a7f83", "0363100012180957": "b412e29", "0363100012181020": "b533c35", "0363100012181059": "pdcdbd7", "0363100012181081": "p7d7c7e", "0363100012181127": "b654735", "0363100012181175": "p7b7c7d", "0363100012181177": "p818182", "0363100012181208": "b775646", "0363100012181214": "b413431", "0363100012181216": "b6f5f5a", "0363100012181230": "b876554", "0363100012181248": "b311f1b", "0363100012181303": "b9d8d89", "0363100012181307": "b352319", "0363100012181329": "b523629", "0363100012181337": "b3b2320", "0363100012181379": "p71716e", "0363100012181380": "pe6e8eb", "0363100012181381": "b3a2d2a", "0363100012181422": "pdbcfde", "0363100012181520": "baa8176", "0363100012181523": "p717170", "0363100012181528": "p7c7b7b", "0363100012181531": "b584641", "0363100012181579": "p9e9c9b", "0363100012181607": "baa827c", "0363100012181624": "p8e8f92", "0363100012181640": "b69473a", "0363100012181713": "ba2796f", "0363100012181714": "p6e7074", "0363100012181805": "b705c57", "0363100012181871": "p868887", "0363100012181893": "pebe9d0", "0363100012181965": "b32221e", "0363100012181984": "b3b2620", "0363100012182040": "b3f2b1f", "0363100012182045": "b6e4b3e", "0363100012182046": "b6e4b3e", "0363100012182208": "b55392a", "0363100012182209": "pdadad9", "0363100012182210": "b967062", "0363100012182217": "b796b67", "0363100012182219": "p6d6e71", "0363100012182274": "b937260", "0363100012182279": "pae9e9c", "0363100012182318": "b9f8476", "0363100012182327": "p8a8b8e", "0363100012182329": "b3a2320", "0363100012182341": "pdcebee", "0363100012182345": "pede0cc", "0363100012182348": "b997764", "0363100012182354": "p838386", "0363100012182451": "pb2b3b7", "0363100012182455": "b655550", "0363100012182475": "b72625d", "0363100012182486": "pbdad9e", "0363100012182512": "b3d291d", "0363100012182515": "pd0c4c8", "0363100012182518": "b311f18", "0363100012182535": "b81614e", "0363100012182538": "b3f332f", "0363100012182541": "pe8dccf", "0363100012182578": "b39261b", "0363100012182620": "pe1d9d4", "0363100012182639": "b2d211e", "0363100012182647": "b574946", "0363100012182671": "b906661", "0363100012182709": "b4a342e", "0363100012182783": "b7f584f", "0363100012182796": "b4b372c", "0363100012182798": "b4c3027", "0363100012182799": "b442c21", "0363100012182913": "b32221e", "0363100012182921": "b352319", "0363100012183006": "pdbd5d7", "0363100012183007": "pd9d2d3", "0363100012183009": "b78514b", "0363100012183010": "b613c37", "0363100012183051": "b533829", "0363100012183053": "b452e22", "0363100012183056": "b6e4a3f", "0363100012183061": "pa9a6a2", "0363100012183102": "pdddcd7", "0363100012184744": "b352824", "0363100012184936": "b4f302c", "0363100012185388": "b3e2e2a", "0363100012185408": "baf8879", "0363100012185409": "b785348", "0363100012185487": "b907770", "0363100012185488": "ba37b6e", "0363100012185490": "b9c7568", "0363100012185491": "pa69e9e", "0363100012185492": "b9d7771", "0363100012185493": "b725952", "0363100012185501": "pe9d3ce", "0363100012185505": "b503729", "0363100012185594": "b5e402f", "0363100012185682": "b866553", "0363100012185774": "b413430", "0363100012185775": "b4c3f3b", "0363100012185776": "b4b3e3a", "0363100012185777": "b4e413d", "0363100012185844": "b533e38", "0363100012185921": "b35221d", "0363100012185922": "b4d403c", "0363100012186002": "b79514c", "0363100012186194": "b321f19", "0363100012186293": "b7f6a64", "0363100012186295": "pefe5d0", "0363100012187451": "b332723", "0363100012189306": "p7c7c7c", "0363100012190009": "p646465", "0363100012191524": "b6c554e", "0363100012191915": "b865d57", "0363100012193820": "b3e2522", "0363100012194130": "b2e211d", "0363100012195130": "b9e756c", "0363100012195326": "b4d3731", "0363100012198469": "peee4e1", "0363100012199086": "b3f332f", "0363100012201311": "b311f1a", "0363100012201595": "b5a4c49", "0363100012201628": "p666665", "0363100012201672": "pe6e8ea", "0363100012201848": "b594238", "0363100012201849": "pe8e8ed", "0363100012201906": "p707070", "0363100012202597": "b573530", "0363100012202598": "p727374", "0363100012202894": "pcee1e3", "0363100012202927": "pe2e9ec", "0363100012204466": "b4b3224", "0363100012204884": "p948f90", "0363100012205436": "b483b37", "0363100012205769": "b614636", "0363100012206529": "b756763", "0363100012207223": "b3c281d", "0363100012207383": "b7c594a", "0363100012207503": "p898a8b", "0363100012207608": "b79655f", "0363100012207830": "pe6e8ec", "0363100012208029": "b6e605c", "0363100012208083": "b342825", "0363100012208306": "b423632", "0363100012211328": "b75615b", "0363100012213454": "b54332f", "0363100012213742": "p5f5f62", "0363100012213743": "b83665d", "0363100012214711": "b4e413d", "0363100012214712": "b564742", "0363100012214713": "b413531", "0363100012216988": "b6a5651", "0363100012217017": "b866661", "0363100012217018": "b3b2f2b", "0363100012217213": "pe3e9ec", "0363100012217960": "b47302a", "0363100012220839": "b6b4d3b", "0363100012221008": "pe4e9ec", "0363100012223982": "b38261b", "0363100012229139": "ba48b84", "0363100012230945": "b574338", "0363100012233413": "b2d211e", "0363100012233469": "p989695", "0363100012233470": "ba97e78", "0363100012233474": "b9d8d89", "0363100012233478": "bac8976", "0363100012233632": "b2d211e", "0363100012233635": "pafb8bb", "0363100012235000": "peae7ea", "0363100012235415": "pe0eaed", "0363100012236172": "bb2867f", "0363100012236723": "pa5acaf", "0363100012236811": "b473732", "0363100012236859": "b886f62", "0363100012236871": "p81888a", "0363100012237078": "pdbd6d7", "0363100012237116": "p626367", "0363100012237127": "b302421", "0363100012237143": "b2d211e", "0363100012237174": "bb2867e", "0363100012237197": "pa5acae", "0363100012237582": "b483b38", "0363100012237702": "pe1eaed", "0363100012237706": "pa2a1a1", "0363100012237707": "b65423d", "0363100012237719": "b563a2a", "0363100012237787": "b39221f", "0363100012237788": "pab898f", "0363100012237848": "pe3e9ec", "0363100012238016": "pe6e1d7", "0363100012238017": "pe4ded4", "0363100012238067": "b331e1c", "0363100012238220": "pe8e8e9", "0363100012238251": "b48352f", "0363100012238259": "pe8e8e5", "0363100012238303": "b382c28", "0363100012238305": "b412d28", "0363100012238306": "b41312c", "0363100012238308": "b41302b", "0363100012238309": "p696c6f", "0363100012238323": "b3f2f2b", "0363100012238324": "b70625e", "0363100012238326": "pebe9d5", "0363100012238347": "p616264", "0363100012238351": "pe9e8e7", "0363100012238361": "b372b27", "0363100012238362": "b382b28", "0363100012238363": "b382b28", "0363100012238371": "b624f49", "0363100012238383": "p737476", "0363100012238386": "b32201b", "0363100012238387": "pe1d7d3", "0363100012238391": "b30221e", "0363100012238392": "b2f211d", "0363100012238393": "b321f19", "0363100012238396": "b6b4d49", "0363100012238397": "b78514c", "0363100012238398": "b6b4a45", "0363100012238399": "b684b47", "0363100012238475": "b5f3a35", "0363100012238487": "pf2e1c9", "0363100012238517": "b4d2e2a", "0363100012238518": "b60514d", "0363100012238519": "b936963", "0363100012238646": "pe3d4d2", "0363100012238648": "b78524d", "0363100012238649": "b71524d", "0363100012238733": "p908d88", "0363100012238744": "b4f3d38", "0363100012238751": "p727274", "0363100012238752": "b5a4c48", "0363100012238755": "b413430", "0363100012238756": "b594b47", "0363100012238758": "p767a7b", "0363100012238760": "p797a7c", "0363100012238763": "p808081", "0363100012238764": "p7f8080", "0363100012238770": "b774f4a", "0363100012238780": "b623f36", "0363100012238781": "b583531", "0363100012238782": "b402822", "0363100012238783": "b442a23", "0363100012238784": "b613e34", "0363100012238785": "b5e3d31", "0363100012238786": "b674339", "0363100012238787": "b68443a", "0363100012238788": "b664238", "0363100012238789": "b472c26", "0363100012238790": "b56352e", "0363100012238791": "b54342d", "0363100012238792": "b57362f", "0363100012238793": "b593730", "0363100012238840": "pe0dcd4", "0363100012238842": "b362621", "0363100012238940": "pdcdbd7", "0363100012238943": "b554135", "0363100012239000": "b744d47", "0363100012239038": "b6f4d43", "0363100012239088": "b331e1c", "0363100012239089": "pe9e8ea", "0363100012239093": "pe8e8ea", "0363100012239099": "b473a36", "0363100012239172": "b765645", "0363100012239173": "pe0eaed", "0363100012239175": "b775745", "0363100012239177": "p5f6567", "0363100012239179": "b4b3731", "0363100012239228": "pe4e9ec", "0363100012239229": "b584944", "0363100012239237": "b503c36", "0363100012239269": "b392925", "0363100012239271": "b5e514d", "0363100012239295": "b302017", "0363100012239324": "b754f47", "0363100012239340": "b623d38", "0363100012239361": "b69443b", "0363100012239363": "b634d46", "0363100012239365": "b5c443d", "0363100012239367": "b533e38", "0363100012239410": "b30201b", "0363100012239411": "p73787b", "0363100012239414": "b463632", "0363100012239418": "b2d211e", "0363100012239419": "b2e211d", "0363100012239420": "b352723", "0363100012239421": "b311f1a", "0363100012239422": "b2d211e", "0363100012239423": "b322218", "0363100012239424": "b3c2f2b", "0363100012239462": "b3e312e", "0363100012239476": "b402d28", "0363100012239503": "b43342f", "0363100012239613": "b513e38", "0363100012239614": "b685043", "0363100012239628": "p767a7d", "0363100012239630": "b53443f", "0363100012239679": "b735a53", "0363100012239833": "b714a45", "0363100012239848": "pabacaf", "0363100012239849": "p9e9692", "0363100012240018": "b5c4e4a", "0363100012240019": "b5a4c48", "0363100012240262": "p6d6e71", "0363100012240274": "b664637", "0363100012240312": "b7b534d", "0363100012240319": "b6f4843", "0363100012240345": "b8f6660", "0363100012240397": "pbfc1c2", "0363100012240405": "b625450", "0363100012240427": "b362926", "0363100012240445": "b695144", "0363100012240446": "b52342b", "0363100012240607": "bb0887a", "0363100012240608": "bae8778", "0363100012240695": "b58392d", "0363100012240696": "b442925", "0363100012240697": "b382c29", "0363100012240899": "b4b342e", "0363100012240914": "b39221f", "0363100012240921": "b9e786f", "0363100012240951": "b987764", "0363100012240953": "pc7b0a1", "0363100012240954": "b735442", "0363100012240955": "b765644", "0363100012240956": "ba27e6d", "0363100012240957": "bac8976", "0363100012240958": "p99897d", "0363100012240994": "b382c29", "0363100012240996": "b302421", "0363100012240999": "b2d211e", "0363100012241000": "b3d312d", "0363100012241004": "b987464", "0363100012241010": "p949695", "0363100012241221": "pdfdad9", "0363100012241313": "b644635", "0363100012241314": "b36241a", "0363100012241365": "b7e5650", "0363100012241373": "b5d4f4b", "0363100012241376": "b5d3934", "0363100012241498": "b49352f", "0363100012241553": "p999897", "0363100012241620": "b5d4f4b", "0363100012241621": "bb2867e", "0363100012241631": "pe9e8e4", "0363100012241662": "b403430", "0363100012241679": "b4d403d", "0363100012241920": "p6a6c6e", "0363100012241921": "b70625e", "0363100012241922": "p686a6e", "0363100012241991": "b331e1c", "0363100012242008": "p686969", "0363100012242096": "b473a36", "0363100012242142": "b2e211d", "0363100012242144": "b33241f", "0363100012242206": "b70513f", "0363100012242209": "b70513f", "0363100012242260": "p65676b", "0363100012242261": "b50433f", "0363100012242262": "p5f6064", "0363100012242265": "p6b6c6e", "0363100012242270": "pe2e1d3", "0363100012242465": "b5b3833", "0363100012242758": "b5d3f2f", "0363100012242805": "b3d2a25", "0363100012242826": "b463935", "0363100012242866": "b3e291e", "0363100012242926": "b875f59", "0363100012242927": "b6b4d3b", "0363100012242965": "b4b3934", "0363100012243031": "b4b3a35", "0363100012243112": "b593a33", "0363100012243113": "b764f4a", "0363100012243134": "b321f19", "0363100012243137": "b645652", "0363100012243142": "b6a463c", "0363100012243146": "p626366", "0363100012243198": "b776965", "0363100012243261": "b867773", "0363100012243265": "b7d574d", "0363100012243272": "b786863", "0363100012243279": "b2d211d", "0363100012243292": "pe8e7e5", "0363100012243320": "b654736", "0363100012243322": "b6a4b3a", "0363100012243323": "b684a38", "0363100012243324": "b775745", "0363100012243325": "b654636", "0363100012243330": "pc8d0d2", "0363100012243334": "pb8c3c5", "0363100012243498": "b5c3f2e", "0363100012243512": "b593d39", "0363100012243694": "b3e312e", "0363100012243697": "b885f59", "0363100012243741": "bae847a", "0363100012243786": "b2f201c", "0363100012243819": "b4d372a", "0363100012243825": "p8c8c90", "0363100012243826": "p999695", "0363100012244096": "paeaeae", "0363100012244183": "bae8977", "0363100012244330": "b5f3a35", "0363100012244336": "pa18d7b", "0363100012244350": "p79797c", "0363100012244416": "b402d28", "0363100012244514": "pe9e3cf", "0363100012244598": "b533f39", "0363100012244607": "p989392", "0363100012244652": "pe5e9eb", "0363100012244680": "b594b48", "0363100012244682": "b5b4c48", "0363100012244683": "b5a4d49", "0363100012244684": "b5d423c", "0363100012244685": "bad8976", "0363100012244686": "b6c483d", "0363100012244687": "b6c493d", "0363100012244688": "b6d4a3e", "0363100012244689": "b6c483e", "0363100012244721": "b8a615b", "0363100012244800": "b48322c", "0363100012244801": "b483c38", "0363100012244802": "b4b3e3a", "0363100012244818": "pc5b5a3", "0363100012244819": "b9d7b68", "0363100012244820": "pc5b4a0", "0363100012244826": "pe8e8ea", "0363100012244847": "b483b38", "0363100012244861": "b4b3427", "0363100012244865": "b533d31", "0363100012244872": "p7b8080", "0363100012244873": "bac8976", "0363100012244874": "p8e8b89", "0363100012244875": "p8e8b8a", "0363100012244876": "p908e8d", "0363100012244877": "p949291", "0363100012244888": "b6e5e5a", "0363100012244889": "b6b5d59", "0363100012244930": "pe8e8e6", "0363100012244937": "b614b44", "0363100012244941": "b594b48", "0363100012245311": "p747576", "0363100012245312": "p868584", "0363100012245320": "b3c302c", "0363100012245325": "pdcd8d7", "0363100012245488": "b5d423e", "0363100012245490": "b55403a", "0363100012245491": "b493c38", "0363100012245492": "b332622", "0363100012245493": "b3f302b", "0363100012245506": "b4e3a2f", "0363100012245507": "b2d211e", "0363100012245607": "b66423a", "0363100012245608": "b3f322e", "0363100012245612": "b473833", "0363100012245614": "b4b3d39", "0363100012245616": "b4a3c38", "0363100012245618": "b433632", "0363100012245673": "b55352e", "0363100012245676": "b3d312d", "0363100012245678": "b392620", "0363100012245739": "b4c3731", "0363100012245740": "b43312c", "0363100012245741": "b4e3431", "0363100012245742": "b886755", "0363100012245770": "b5a3e35", "0363100012245775": "b7f706c", "0363100012245787": "b3c281d", "0363100012245788": "b463530", "0363100012245789": "b3d2a24", "0363100012245805": "b321f19", "0363100012246036": "b756763", "0363100012246037": "b583935", "0363100012246038": "b352824", "0363100012246040": "b443733", "0363100012246118": "b2f2320", "0363100012246127": "b41332f", "0363100012246161": "b8b7a75", "0363100012246190": "pd5cfcc", "0363100012246241": "b483b37", "0363100012246242": "b473a37", "0363100012246252": "b73635e", "0363100012246257": "b987364", "0363100012246287": "b322019", "0363100012246329": "peddacc", "0363100012246413": "b81604e", "0363100012246414": "b795a48", "0363100012246415": "b453531", "0363100012246416": "b413531", "0363100012246417": "b403430", "0363100012246448": "b7d5e4c", "0363100012246466": "b4b3833", "0363100012246473": "p5f605e", "0363100012246474": "b2d211e", "0363100012246476": "pd8ecef", "0363100012246477": "pd8ecef", "0363100012246503": "pe9e4d6", "0363100012246504": "pe9e9df", "0363100012246608": "b554744", "0363100012246609": "b624035", "0363100012246610": "b50433f", "0363100012246612": "b564642", "0363100012246613": "b56433e", "0363100012246614": "b554641", "0363100012246615": "b574945", "0363100012246632": "pe6e8ed", "0363100012246829": "b604e48", "0363100012246839": "bb0877c", "0363100012246848": "b35201d", "0363100012246869": "pb9abaa", "0363100012246878": "b534542", "0363100012246886": "pede8df", "0363100012246887": "b4a3224", "0363100012246905": "b573a2b", "0363100012246906": "pc3b9b1", "0363100012246907": "b785846", "0363100012246977": "pe8e8e7", "0363100012246981": "p5e5f62", "0363100012246982": "b473a36", "0363100012246987": "b463936", "0363100012247000": "b875e59", "0363100012247011": "b89605b", "0363100012247023": "pb8c4c6", "0363100012247024": "pdfeaed", "0363100012247030": "b321f1a", "0363100012247031": "pe6e8ec", "0363100012247032": "b382824", "0363100012247038": "bb1867f", "0363100012247115": "pe2dfd3", "0363100012247116": "pe2ded3", "0363100012247189": "p9b9ea0", "0363100012247193": "b7e605c", "0363100012247474": "b2d211e", "0363100012247491": "pe0deda", "0363100012247578": "pefe4cb", "0363100012247590": "p656567", "0363100012247591": "b534642", "0363100012247592": "p636468", "0363100012247596": "b372a26", "0363100012247598": "pe4e9ec", "0363100012247611": "b61483e", "0363100012247660": "b3f2623", "0363100012247661": "b412724", "0363100012247662": "b3d2521", "0363100012247663": "b432825", "0363100012247664": "b3c2421", "0363100012247672": "b4c2e2a", "0363100012247719": "b6f5852", "0363100012247745": "b5d423f", "0363100012247746": "b574a46", "0363100012247780": "pe5e9eb", "0363100012247781": "pe6e8ec", "0363100012247783": "pe6e8ec", "0363100012247785": "p6e6f70", "0363100012247796": "b5b4d49", "0363100012247797": "b5f514d", "0363100012247798": "b5b4a46", "0363100012247877": "bac8976", "0363100012247880": "b574945", "0363100012247942": "b5f514d", "0363100012248025": "pe9e6de", "0363100012248028": "pd7d8db", "0363100012248037": "b2d211d", "0363100012248039": "b533c35", "0363100012248057": "b3b271c", "0363100012248206": "b462f22", "0363100012248207": "b442e21", "0363100012248208": "b452f22", "0363100012248209": "p626462", "0363100012248217": "b997764", "0363100012248404": "b44342f", "0363100012248405": "p666667", "0363100012248460": "b50433f", "0363100012248461": "b473a36", "0363100012248462": "b4c3832", "0363100012248470": "b47322b", "0363100012248471": "b49362b", "0363100012248472": "b4a352e", "0363100012248473": "b433531", "0363100012248474": "b443632", "0363100012248475": "b46332e", "0363100012248532": "b86605b", "0363100012248680": "pefd7c4", "0363100012248681": "pbaaaa1", "0363100012248682": "pafa49b", "0363100012248684": "pb1a39a", "0363100012248685": "b503329", "0363100012248714": "b856452", "0363100012248742": "b775745", "0363100012248744": "b755543", "0363100012248761": "pe5e9eb", "0363100012248762": "pe8e8ea", "0363100012248763": "pe6e8ea", "0363100012248767": "b66403b", "0363100012248785": "pe5e8ec", "0363100012248786": "b3f312d", "0363100012248804": "b3b2b27", "0363100012248820": "b45342f", "0363100012248824": "b75554e", "0363100012248825": "b79534a", "0363100012248865": "b5a403c", "0363100012248866": "b5d403c", "0363100012248869": "b5e413d", "0363100012248870": "b5d3e39", "0363100012248902": "b5e413d", "0363100012248903": "b614440", "0363100012248965": "b5b413d", "0363100012248966": "b5e3f3b", "0363100012248967": "b57413b", "0363100012249002": "b39261b", "0363100012249042": "b31201b", "0363100012249118": "b483c38", "0363100012249119": "b422f2a", "0363100012249123": "pcfdfe2", "0363100012249130": "b432825", "0363100012249139": "pe2e9ec", "0363100012249140": "pe0eaed", "0363100012249191": "b3c302c", "0363100012249362": "b594b48", "0363100012249370": "pbcbfc4", "0363100012249414": "b331e1c", "0363100012249439": "b40302b", "0363100012249482": "b3c302c", "0363100012249488": "pe4e2e3", "0363100012249489": "pdcd8d7", "0363100012249500": "pd7d7d4", "0363100012249502": "pbebfbf", "0363100012249504": "pe6e6e6", "0363100012249505": "pe8e8e8", "0363100012249506": "pb0b0b1", "0363100012249509": "p5f6363", "0363100012249510": "p868688", "0363100012249520": "b2d211d", "0363100012249529": "b68423d", "0363100012249531": "b7e584e", "0363100012249546": "b2e211d", "0363100012249552": "b3c251f", "0363100012249558": "b50312d", "0363100012249612": "p626468", "0363100012249614": "b4e413d", "0363100012249642": "pf0e8cb", "0363100012249658": "b2d211d", "0363100012249661": "b412b25", "0363100012249680": "b7d554f", "0363100012249713": "b8a615b", "0363100012249720": "b8f6660", "0363100012249731": "b655753", "0363100012249760": "b534642", "0363100012249763": "b503b35", "0363100012249770": "p7d8285", "0363100012249778": "b764f49", "0363100012249782": "b4a3529", "0363100012249797": "pdfd6d5", "0363100012249798": "pe7e8e8", "0363100012249932": "peae8e6", "0363100012249960": "b7c554c", "0363100012249963": "b7c5f4f", "0363100012250003": "ba17670", "0363100012250004": "pe2ddd3", "0363100012250005": "p6d6e6c", "0363100012250007": "b452e21", "0363100012250009": "pe1ddd4", "0363100012250011": "p828483", "0363100012250017": "b312420", "0363100012250018": "pe3ded2", "0363100012250019": "b332219", "0363100012250042": "b33211b", "0363100012250153": "b2d211e", "0363100012250200": "pe6ddd0", "0363100012250203": "b998a85", "0363100012250222": "pdcdcd7", "0363100012250228": "b4b3e3a", "0363100012250230": "b452b24", "0363100012250237": "b53322e", "0363100012250239": "b594b47", "0363100012250247": "pebe9d7", "0363100012250249": "b5a3d2c", "0363100012250250": "b5f3a35", "0363100012250251": "pb9bab9", "0363100012250378": "pd8dada", "0363100012250379": "pd8dada", "0363100012250383": "pddded9", "0363100012250388": "p8e8f8e", "0363100012250392": "pe0e0d4", "0363100012250399": "pd3d4cf", "0363100012250605": "b423632", "0363100012250609": "b644541", "0363100012250628": "b2d211e", "0363100012250630": "b2d211e", "0363100012250702": "peae8e7", "0363100012250703": "peae8e7", "0363100012250704": "peae7e7", "0363100012250705": "peae8e4", "0363100012250706": "peae7df", "0363100012250707": "pebe8e2", "0363100012250759": "pe5dddc", "0363100012250801": "p8c898b", "0363100012250902": "pceb8ac", "0363100012250903": "b936c61", "0363100012250905": "bb0867b", "0363100012250919": "p838284", "0363100012250998": "pe5d4d1", "0363100012250999": "pe4d4d1", "0363100012251223": "pe0eaec", "0363100012251237": "b442e28", "0363100012251287": "b514440", "0363100012251303": "b8b6a57", "0363100012251336": "b5d3c37", "0363100012251424": "b593632", "0363100012251425": "b533b35", "0363100012251427": "b503c36", "0363100012251428": "p656767", "0363100012251429": "b4d3d38", "0363100012251430": "b54403a", "0363100012251431": "p646667", "0363100012251433": "pede7e0", "0363100012251434": "pebe5da", "0363100012251437": "pefe6dd", "0363100012251459": "b8c6b59", "0363100012251487": "pe1dad3", "0363100012251532": "pdcd9d7", "0363100012251546": "pcfc9c6", "0363100012251554": "p5f6165", "0363100012251556": "b563c2c", "0363100012251630": "b2d211e", "0363100012251648": "p9e978c", "0363100012251649": "b5e4130", "0363100012251787": "b34211c", "0363100012251802": "b33201a", "0363100012251908": "b482c28", "0363100012251909": "b7a524d", "0363100012251910": "b724b45", "0363100012251911": "b734b46", "0363100012251937": "b442926", "0363100012251938": "b432825", "0363100012251939": "b452a27", "0363100012251982": "pc0b4a6", "0363100012252112": "b7b6152", "0363100012252114": "b674538", "0363100012252163": "b402c26", "0363100012252207": "b5d3934", "0363100012252212": "pd8cfca", "0363100012252221": "pe9e8e8", "0363100012252229": "pc6c4c1", "0363100012252248": "b825a54", "0363100012252249": "b805852", "0363100012252250": "b89615b", "0363100012252260": "b937163", "0363100012252264": "b825f5a", "0363100012252266": "pbac5c8", "0363100012252286": "p989899", "0363100012252320": "b8d7369", "0363100012252329": "p808284", "0363100012252330": "p787b7e", "0363100012252331": "b785e57", "0363100012252332": "b968783", "0363100012252333": "b90786b", "0363100012252340": "b805a55", "0363100012252351": "b613c36", "0363100012252471": "b311f1a", "0363100012252472": "b4e3327", "0363100012252496": "p616162", "0363100012252516": "b584236", "0363100012252528": "b40332f", "0363100012252529": "b52322e", "0363100012252530": "b433633", "0363100012252548": "b61453c", "0363100012252692": "b302017", "0363100012252706": "b554743", "0363100012252764": "b3d2e29", "0363100012252765": "p686a69", "0363100012252767": "b4e3b35", "0363100012252768": "b7b5b49", "0363100012252772": "b331e1c", "0363100012252776": "b765345", "0363100012252781": "p787e80", "0363100012252782": "b856452", "0363100012252783": "b402b1f", "0363100012252784": "b6a493b", "0363100012252800": "b382823", "0363100012252823": "b302017", "0363100012252825": "b483123", "0363100012252827": "b584a46", "0363100012252834": "b321f1a", "0363100012252835": "b9c726c", "0363100012252849": "pd4d0c9", "0363100012252854": "b322018", "0363100012252855": "b34201a", "0363100012252857": "b664836", "0363100012252863": "ba57b72", "0363100012252864": "ba57c73", "0363100012252865": "b69433e", "0363100012252866": "bab8178", "0363100012252867": "bad8379", "0363100012252872": "bb1867f", "0363100012252873": "pd7d7db", "0363100012252981": "b2d211e", "0363100012252988": "b675955", "0363100012252997": "b331e1c", "0363100012253060": "b2d211e", "0363100012253315": "b726460", "0363100012253344": "b43302b", "0363100012253353": "b473023", "0363100012253418": "b69463a", "0363100012253432": "b946a65", "0363100012253499": "pd8dcda", "0363100012253520": "b3e2621", "0363100012253521": "b57382c", "0363100012253522": "b765e51", "0363100012253532": "p717375", "0363100012253538": "b3b261d", "0363100012253547": "b786058", "0363100012253551": "b9e7670", "0363100012253580": "pd9ecee", "0363100012253603": "b74645f", "0363100012253628": "b3e2e29", "0363100012253654": "p8d8b88", "0363100012253656": "pdfded9", "0363100012253698": "b79524c", "0363100012253700": "b473b37", "0363100012253701": "b4e3832", "0363100012253703": "b573c2c", "0363100012253707": "b392925", "0363100012253715": "b5c4c47", "0363100012253733": "b604541", "0363100012253766": "p919290", "0363100012253789": "b936c61", "0363100012253790": "b2d211e", "0363100012253816": "p838383", "0363100012254030": "p5d6264", "0363100012254032": "b35201d", "0363100012254038": "b2d211e", "0363100012254041": "b372824", "0363100012254080": "b503d38", "0363100012254088": "b4f403b", "0363100012254101": "pe2d9d3", "0363100012254103": "pe2d9d3", "0363100012254106": "pe2d8d3", "0363100012254107": "pe2d8d3", "0363100012254114": "p948e8c", "0363100012254115": "p98918e", "0363100012254117": "p97918e", "0363100012254332": "b594c48", "0363100012254336": "pe6e8ea", "0363100012254387": "pe1e0d4", "0363100012254391": "b5e504c", "0363100012254406": "pe3e9ed", "0363100012254409": "b524541", "0363100012254411": "p8a8b8f", "0363100012254419": "b453531", "0363100012254431": "b6d4b41", "0363100012254472": "b311f18", "0363100012254519": "b362a26", "0363100012254521": "b594944", "0363100012254525": "b786053", "0363100012254542": "b302017", "0363100012254552": "b7e5b4c", "0363100012254583": "b866453", "0363100012254592": "pe8e9e0", "0363100012254600": "b5e504c", "0363100012254671": "b40322e", "0363100012254674": "b423632", "0363100012254675": "b3f332f", "0363100012254677": "b40322e", "0363100012254787": "b2d211e", "0363100012254922": "p9c9695", "0363100012254971": "b66524c", "0363100012255037": "b7c544f", "0363100012255052": "b493d39", "0363100012255064": "b2d211e", "0363100012255065": "b331e1c", "0363100012255066": "b331e1c", "0363100012255067": "b331e1c", "0363100012255068": "b896756", "0363100012570103": "b866e61", "0363100012570133": "pdfeaed", "0363100012570345": "p686969", "0363100012570570": "bad897b", "0363100012571426": "b3c2822", "0363100012571562": "b302017", "0363100012571586": "b40302c", "0363100012571642": "b653f3a", "0363100012571651": "p7e8385", "0363100012571669": "pebe7e2", "0363100012571670": "b432c21", "0363100012572083": "b8e655e", "0363100012572085": "b76524d", "0363100012572086": "b764f4a", "0363100012572087": "b6e514d", "0363100012572088": "b694b47", "0363100012572325": "b6f503e", "0363100100091787": "p838382", "0457100000026393": "ba78572", "0457100000026691": "pb6b5b3", "0457100000026789": "b61534f", "0457100000054100": "p868687", "0457100000054101": "p868688", "0457100000054102": "p808081", "0457100000054108": "p89898a", "0457100000054140": "b412e29", "0457100000054154": "b69554f", "0457100000054155": "p7a7a7a", "0457100000054202": "p6b6b6c", "0457100000054209": "p757474", "0457100000054214": "b725a53", "0457100000054215": "b665854", "0457100000054267": "pe9e8e7", "0457100000054359": "pc1bfbc", "0457100000054523": "b927463", "0457100000054525": "b765e57", "0457100000054527": "p838384", "0457100000054536": "b876654", "0457100000054547": "b927463", "0457100000054554": "p7d7c7d", "0457100000054555": "b988073", "0457100000054556": "p7f7f7f", "0457100000054557": "b977f78", "0457100000054561": "b957b6c", "0457100000054568": "b906f5c", "0457100000054661": "b84695a", "0457100000054662": "b80685b", "0457100000054675": "b816657", "0457100000054677": "b8a6f60", "0457100000054681": "b8c7467", "0457100000054685": "p686767", "0457100000054686": "b876f62", "0457100000054687": "b8d7568", "0457100000054695": "b5d4d48", "0457100000054698": "p6c6c6c", "0457100000055091": "b64514c", "0457100000055264": "b42322e", "0457100000055308": "p818181", "0457100000055338": "pdbd5d7", "0457100000055507": "b493b37", "0457100000055590": "pe0ded5", "0457100000055594": "pdfded5", "0457100000055609": "p6d7074", "0457100000055654": "pd0dfe1", "0457100000055661": "b8b6a57", "0457100000056284": "b4d3426", "0457100000056291": "b543b2c", "0457100000056319": "p727273", "0457100000056320": "p6e6f70", "0457100000056321": "p797b7a", "0457100000056443": "b6f5750", "0457100000056445": "b644038", "0457100000056447": "b845c56", "0457100000056448": "b433633", "0457100000056449": "b402a24", "0457100000056461": "b8c635d", "0457100000056475": "b483428", "0457100000056489": "pdcebee", "0457100000056502": "b4e3526", "0457100000056604": "b4d3426", "0457100000056630": "b4e3a34", "0457100000056635": "pb6afb1", "0457100000056650": "pe8e9dc", "0457100000056881": "b613c37", "0457100000056895": "pf3e5c9", "0457100000057001": "b66514b", "0457100000057002": "b5c3f2e", "0457100000057004": "pe8e8ea", "0457100000057009": "bac8976", "0457100000057054": "b6c5549", "0457100000057055": "b785a4b", "0457100000057071": "b72625d", "0457100000057073": "b785947", "0457100000057079": "b795c4c", "0457100000057087": "b74605a", "0457100000057478": "pe7e8ec", "0457100000057636": "p868686", "0457100000057653": "b926962", "0457100000057690": "p969798", "0457100000057747": "p878b8e", "0457100000057749": "b43332f", "0457100000057803": "p757578", "0457100000057804": "p66676a", "0457100000057805": "b443733", "0457100000057806": "p5f6063", "0457100000057808": "b4f423e", "0457100000057958": "pe8e1db", "0457100000058190": "b6e605c", "0457100000058193": "p777879", "0457100000058195": "p7a7d7f", "0457100000058196": "p8b8d90", "0457100000058198": "p939699", "0457100000058212": "b3d312d", "0457100000058214": "b463632", "0457100000058396": "b5e4130", "0457100000058650": "pdcd8d7", "0457100000058707": "pe5dad1", "0457100000058751": "p65676a", "0457100000058983": "b4f3229", "0457100000058996": "pe7e8eb", "0457100000059045": "pe9e8e7", "0457100000059103": "b2e201c", "0457100000059110": "p9b8f8c", "0457100000059112": "pdddad6", "0457100000059162": "p6b6b6f", "0457100000059163": "p898783", "0457100000059170": "p7d7e81", "0457100000059384": "b634d46", "0457100000059409": "b5f524e", "0457100000059438": "b6e605c", "0457100000059609": "p666667", "0457100000059610": "b6d5d58", "0457100000059611": "p6f6f6f", "0457100000059618": "b6f5b56", "0457100000059619": "p676768", "0457100000059620": "b78615a", "0457100000059621": "b776059", "0457100000059622": "p646363", "0457100000059623": "b7a635c", "0457100000059628": "p686768", "0457100000059712": "b735c55", "0457100000059713": "p7e7d7d", "0457100000059717": "p747474", "0457100000059724": "b654f43", "0457100000059726": "b685145", "0457100000059790": "b6c564f", "0457100000059796": "p7a7c7e", "0457100000060231": "p68686a", "0457100000060235": "p626365", "0457100000060236": "p656567", "0457100000060245": "p656667", "0457100000060247": "p717273", "0457100000060297": "p98948f", "0457100000060298": "p93908b", "0457100000060299": "p938e8b", "0457100000060300": "p928e8b", "0457100000060509": "b6e4f3e", "0457100000061138": "b7b6d69", "0457100000061139": "b81726e", "0457100000061675": "ba27b6e", "0457100000061686": "bac807a", "0457100000061688": "b926961", "0457100000061691": "b966e63", "0457100000061693": "b846862", "0457100000061695": "p78797b", "0457100000061696": "b523935", "0457100000061711": "p69696a", "0457100000061712": "p7b7c7c", "0457100000061715": "p666668", "0457100000061716": "pa0a0a3", "0457100000061717": "p97999c", "0457100000061871": "b2d211e", "0457100000061887": "b4d3934", "0457100000061967": "p908e8c", "0457100000062018": "b3d302c", "0457100000062025": "b9c8376", "0457100000062026": "pdbdcd8", "0457100000062027": "ba58c7e", "0457100000062070": "b50433f", "0457100000062071": "b5a433c", "0457100000062072": "b514340", "0457100000062121": "b736561", "0457100000062123": "p8f9396", "0457100000062124": "b4b3d39", "0457100000062126": "p9d9695", "0457100000062141": "b625450", "0457100000062144": "pb2b2b2", "0457100000062146": "b53443f", "0457100000062152": "pdeddd6", "0457100000062155": "b483b37", "0457100000062381": "b4e403d", "0457100000062385": "b3c2a25", "0457100000062386": "p616466", "0457100000062397": "ba68674", "0457100000062398": "bac8976", "0457100000062438": "b564945", "0457100000062440": "b584944", "0457100000062442": "b554844", "0457100000062457": "p606366", "0457100000062458": "b50433f", "0457100000062500": "pdfdcd5", "0457100000062508": "pe0dcd5", "0457100000062509": "pdfdcd5", "0457100000062511": "pdfdcd5", "0457100000062512": "pe0dcd5", "0457100000062513": "pdedbd6", "0457100000062514": "pdfdcd5", "0457100000062528": "pe7e8e9", "0457100000062530": "b584844", "0457100000062537": "b594843", "0457100000062538": "b564743", "0457100000062600": "b331e1c", "0457100000062601": "b2f201c", "0457100000062611": "b3b2320", "0457100000062619": "b2d211e", "0457100000062622": "pbabec0", "0457100000062650": "b4e413d", "0457100000062651": "b533e38", "0457100000062652": "b554844", "0457100000062653": "p76777b", "0457100000062657": "b4b3e3b", "0457100000062722": "p959492", "0457100000062730": "b3b2f2c", "0457100000062731": "b3e322e", "0457100000062736": "pece4e2", "0457100000062737": "peae7ea", "0457100000062742": "b483b37", "0457100000062743": "b4c3f3b", "0457100000062756": "b45312b", "0457100000062757": "p636566", "0457100000062759": "pe7e8e9", "0457100000062770": "p616365", "0457100000062779": "b2f201c", "0457100000062788": "b2e201d", "0457100000062801": "p89898a", "0457100000062803": "p888886", "0457100000062850": "b766763", "0457100000062868": "b7b6761", "0457100000063582": "b403330", "0457100000063812": "pd8d8da", "0457100000063822": "b644a47", "0457100000064147": "b7b574b", "0457100000064150": "b886058", "0457100000064151": "b855e56", "0457100000064153": "b7c5e4f", "0457100000064179": "b7a534c", "0457100000064262": "b714c43", "0457100000064685": "p676769", "0457100000064822": "b6b5651", "0457100000064836": "b5b4843", "0457100000064892": "b4c3f3c", "0457100000064896": "p6b6b6d", "0457100000065223": "b714a44", "0457100000065225": "b6b4642", "0457100000065227": "b7e5651", "0457100000065231": "b68423d", "0457100000065239": "b744c47", "0457100000065253": "b744d48", "0457100000065255": "b5a4a46", "0457100000065257": "b5e4c47", "0457100000065259": "b744d48", "0457100000065273": "b553d36", "0457100000065275": "b5f3a35", "0457100000065277": "b584641", "0457100000065283": "b714a44", "0457100000065425": "b714a44", "0457100000065427": "b5b453f", "0457100000065429": "b5d4741", "0457100000065435": "b5f4b45", "0457100000065455": "b866055", "0457100000065457": "b7e584d", "0457100000065459": "b805b4f", "0457100000065465": "p9e9491", "0457100000065467": "b856054", "0457100000065469": "b845d53", "0457100000065475": "b7a554a", "0457100000065488": "b7f594f", "0457100000065496": "b7f594e", "0457100000065497": "b785349", "0457100000065503": "b815c50", "0457100000065526": "b805752", "0457100000065575": "b78504b", "0457100000065577": "b734c47", "0457100000065784": "b5d4c47", "0457100000066020": "b5b4d49", "0457100000066022": "b956d67", "0457100000066023": "b594944", "0457100000066035": "b403330", "0457100000066040": "p959088", "0457100000066041": "p939088", "0457100000066044": "b9b8073", "0457100000066128": "pe6e0d1", "0457100000066129": "pe5dfd1", "0457100000066131": "pe6d9d0", "0457100000066712": "b2d211e", "0457100000067320": "p666768", "0457100000067322": "p6d6d6d", "0457100000067327": "p767676", "0457100000067328": "p6f6f6f", "0457100000067500": "b4e3a35", "0457100000067502": "bb28680", "0457100000067503": "bae837b", "0457100000067515": "p9b8f8a", "0457100000067518": "peae2d9", "0457100000067519": "pe2dbd3", "0457100000067644": "b3f332f", "0457100000067645": "b46302a", "0457100000067646": "b916f5d", "0457100000067647": "p767a7d", "0457100000067649": "b51312d", "0457100000067650": "p938a86", "0457100000067651": "p978d88", "0457100000067653": "pe6d8d0", "0457100000067685": "b654945", "0457100000067686": "b6d4e49", "0457100000067687": "b4b3e3a", "0457100000067688": "b584a47", "0457100000067689": "b4d403c", "0457100000067690": "b524541", "0457100000067828": "b443834", "0457100000068319": "b50403c", "0457100000068349": "b805a4f", "0457100000068350": "b403330", "0457100000068351": "b7a534c", "0457100000068352": "b785349", "0457100000068353": "b735147", "0457100000068354": "b775149", "0457100000068355": "b7a544a", "0457100000068356": "b785348", "0457100000068358": "b795349", "0457100000068394": "p696b69", "0457100000068396": "b4c3d38", "0457100000068397": "b4a3d3a", "0457100000068398": "b463936", "0457100000068399": "b4d403c", "0457100000068423": "b79625c", "0457100000068424": "b725f59" } };

  // src/canalRecall/buurtProfiles/modernPandWalls.ts
  var CODE = /^[bp][0-9a-f]{6}$/;
  var walls = validate(modern_pand_walls_default).walls;
  function validate(set) {
    if (set?.schemaVersion !== 1 || typeof set.walls !== "object") throw new Error("modern-pand-walls: bad schema");
    for (const [id, code] of Object.entries(set.walls)) if (!/^\d{16}$/.test(id) || !CODE.test(code)) throw new Error(`modern-pand-walls: bad row ${id} ${code}`);
    return set;
  }

  // src/canalRecall/contemporary-walls.json
  var contemporary_walls_default = {
    schemaVersion: 1,
    licence: "Gemeente Amsterdam panorama, CC BY 4.0",
    source: "scripts/newbuild/sample-panos.ts (2005+ BAG pands, 2019+ panoramas)",
    liftL: 12,
    areas: {
      Houthaven: {
        centre: [
          4.8775,
          52.3935
        ],
        walls: [
          "pe3e4de",
          "b4a4342",
          "beb9b76",
          "bbf7d61",
          "bc48266",
          "bc38266",
          "bc58367",
          "bc5744c",
          "bc6774e",
          "bc6774d",
          "b504544",
          "b544644",
          "b4f4242",
          "b594842",
          "b55423c",
          "b55423c",
          "b493b3a",
          "b483b3b",
          "b493a39",
          "b423133",
          "b704c40",
          "b704c40",
          "b5e5f5a",
          "b554238",
          "b6c5450",
          "b67594b",
          "pf5e9ad",
          "bde9267",
          "bde9368",
          "bed9361",
          "be3986c",
          "be3986c",
          "bf38c55",
          "be98e60",
          "bea9060",
          "bec9260",
          "bde9e82"
        ]
      },
      IJburg: {
        centre: [
          4.99,
          52.356
        ],
        walls: [
          "pdeebe9",
          "pe0eae9",
          "babafad",
          "b57565b",
          "ba29890",
          "b7c7579",
          "b6d6d6d",
          "b6e696a",
          "pedd3c8",
          "b6a6b6d",
          "b656161",
          "pf0e8d0",
          "b686567",
          "b757272",
          "b4d4e52",
          "b626066",
          "b6d6d71",
          "pffe0cc",
          "bb4a298",
          "b8c8078",
          "b737a79",
          "b767d7c",
          "b7d554e",
          "pdcebe9",
          "b726f6f",
          "b72726d",
          "b3b3d3e",
          "pc1be97"
        ]
      },
      Overhoeks: {
        centre: [
          4.9,
          52.386
        ],
        walls: [
          "b4e514d",
          "b464742"
        ]
      },
      Sluisbuurt: {
        centre: [
          4.956,
          52.373
        ],
        walls: [
          "b8e9088"
        ]
      },
      Zeeburgereiland: {
        centre: [
          4.961,
          52.369
        ],
        walls: [
          "b555050",
          "b606162",
          "b66615e",
          "b4c5050",
          "b3c3f3e",
          "peeeba9",
          "b4d4d4f",
          "b88837d",
          "b84807b",
          "b807c78",
          "pecddaf",
          "b35373b",
          "b4e504d",
          "b6a6a69",
          "b494a44",
          "bd98c89",
          "pf0e8ce",
          "b586560",
          "ba1877e",
          "b5b4f41",
          "pefe8d0",
          "b7c7e78",
          "pe0c6ab",
          "b3d4241",
          "pdcd5ba",
          "b47423a"
        ]
      }
    }
  };

  // src/canalRecall/contemporaryFamily.ts
  function newbuildFamilyEnabled() {
    const g = globalThis;
    if (typeof g.__canalRecallNewbuildFamily === "boolean") return g.__canalRecallNewbuildFamily;
    try {
      return new URLSearchParams(g.location?.search ?? "").get("newbuildFamily") === "1";
    } catch {
      return false;
    }
  }
  var AREAS = contemporary_walls_default.areas;
  var POOLED = Object.values(AREAS).flatMap((a) => a.walls);
  var KX = 111320 * Math.cos(52.37 * Math.PI / 180);

  // src/canalRecall/bayLook.ts
  var TALL_FRENCH_BALCONY = { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "punched", openingOccupancy: 0.46, openingHeight: 0.8, sash: "plain", trimDensity: "restrained", lintel: "none", frameTone: "dark", wallMaterial: "brick", facadeAssembly: "french-balcony" };
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
      { windows: 2, shape: "rect", shutters: false, paintedFrames: false, family: "masonry", openingOccupancy: 0.55, openingHeight: 0.68, sash: "paired-transom", trimDensity: "restrained", lintel: "none" },
      { windows: 1, shape: "rect", shutters: false, paintedFrames: false, family: "masonry", openingOccupancy: 0.56, openingHeight: 0.7, sash: "paired-transom", trimDensity: "restrained", lintel: "none", openingGroup: "canal-return", groundAssembly: "tall-commercial" },
      ...[2, 3].flatMap((windows) => [void 0, "tall-side-entry", "tall-commercial"].flatMap((groundAssembly) => ["rect", "segmental"].map((shape) => ({
        windows,
        shape,
        shutters: false,
        paintedFrames: false,
        family: "masonry",
        openingOccupancy: 0.62,
        openingHeight: 0.7,
        sash: "paired-transom",
        trimDensity: "restrained",
        lintel: "none",
        openingGroup: windows === 2 ? "canal-two" : "canal-three",
        groundAssembly
      }))))
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
      { windows: 3, shape: "rect", shutters: false, paintedFrames: false, family: "punched", openingOccupancy: 0.57, openingHeight: 0.7, sash: "paired-transom", trimDensity: "restrained", lintel: "none", wallMaterial: "smooth", facadeAssembly: "stacked-open-balcony" },
      ...newbuildFamilyEnabled() ? [TALL_FRENCH_BALCONY] : []
    ]
  };
  var ARCHETYPES = Object.keys(BAY_STYLES);
  function cellKey(archetype, style, kind, restrainedShop = false) {
    const variant = { ...BAY_STYLES[archetype][style] };
    if (kind === "plain") return `${archetype}|plain|${variant.wallMaterial ?? (archetype === "modern" ? "smooth" : "brick")}`;
    if (isShopKind(kind)) return `${archetype}|${kind}|${restrainedShop}`;
    if (kind === "upper") delete variant.groundAssembly;
    if (kind === "groundDoor" && variant.groundAssembly === "tall-side-entry") kind = "ground";
    return `${archetype}|${kind}|${JSON.stringify(variant)}`;
  }
  var entries = [];
  var cellLayers = /* @__PURE__ */ new Map();
  for (const archetype of ARCHETYPES) for (const [style] of BAY_STYLES[archetype].entries()) for (const kind of BAY_KINDS) {
    if (isShopKind(kind) && style !== 0) continue;
    const key = cellKey(archetype, style, kind);
    if (!cellLayers.has(key)) {
      cellLayers.set(key, entries.length);
      entries.push({ archetype, style, kind });
    }
  }
  for (const archetype of ARCHETYPES) for (const kind of SHOP_KINDS) {
    cellLayers.set(cellKey(archetype, 0, kind, true), entries.length);
    entries.push({ archetype, style: 0, kind, restrainedShop: true });
  }
  var FATIH_MASONRY_LAYER = entries.length;
  entries.push({ archetype: "school", style: 0, kind: "plain", originalMasonry: true });
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
    const key = `${recipe.openingGroup ?? "none"}|${recipe.groundAssembly ?? "none"}|${recipe.windowHead ?? "flat"}|${archetype}|${recipe.facadeAssembly ?? "none"}|${recipe.entranceAssembly ?? "none"}|${material}|${recipe.family}|${proportion}|${dark}|${pale}|${lintel}|${sash}|${trim}`;
    const cached = recipeStyles.get(key);
    if (cached) return cached[(h >>> 4) % cached.length];
    const scored = styles.map((v, i) => ({ i, score: (v.shape === "segmental" === (recipe.windowHead === "segmental") ? 8e3 : 0) + ((v.openingGroup ?? "none") === (recipe.openingGroup ?? "none") ? 4e3 : 0) + ((v.groundAssembly ?? "none") === (recipe.groundAssembly ?? "none") ? 2e3 : 0) + ((v.entranceAssembly ?? "none") === (recipe.entranceAssembly ?? "none") ? 1e3 : 0) + ((v.facadeAssembly ?? "none") === (recipe.facadeAssembly ?? "none") ? 1e3 : 0) + ((v.wallMaterial ?? (archetype === "modern" ? "smooth" : "brick")) === material ? 25 : 0) + ((v.sash ?? "six-over-six") === sash ? 50 : 0) + (v.trimDensity === trim ? 40 : 0) + ((v.family ?? "masonry") === recipe.family ? 100 : 0) + ((v.proportions ?? "tall") === proportion ? 8 : 0) + (!!v.paleAccents === pale ? 12 : 0) + (v.frameTone === "dark" === dark ? 10 : 0) + ((v.lintel ?? "flat") === lintel ? 6 : 0) }));
    const max = Math.max(...scored.map((v) => v.score)), ties = scored.filter((v) => v.score === max);
    const indices = ties.map((v) => v.i);
    recipeStyles.set(key, indices);
    return indices[(h >>> 4) % indices.length];
  }
  var PROFILE_STYLE_INDICES = Object.fromEntries(ARCHETYPES.map((archetype) => [archetype, BAY_STYLES[archetype].flatMap((v, i) => !v.openingGroup && !v.groundAssembly && !v.entranceAssembly && !v.facadeAssembly && (archetype === "modern" ? v.family === "punched" : !v.family || v.family === "masonry") ? [i] : [])]));

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
    if (v.groundAssembly) {
      const g = canalGroundGeometry(v), ground = { axes: v.groundAssembly === "tall-side-entry" ? g.axes.slice(0, -1) : g.axes, width: g.width, sill: g.sill, head: g.head };
      return { upper, ground, doorWindow: { ...ground, axes: g.axes.slice(0, -1) }, door };
    }
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

  // src/canalRecall/look/thinFade.ts
  var THIN_CLASS = {
    other: 0,
    wall: 1,
    roof: 2,
    lid: 3,
    trim: 4,
    cornice: 5,
    frontage: 6,
    extrasStrip: 7,
    extrasBox: 8,
    extrasOther: 9,
    shell: 10
  };
  var THIN_OWNER_CLASSES = [
    { name: "other", id: THIN_CLASS.other, rgb: [0, 0, 0] },
    { name: "wall", id: THIN_CLASS.wall, rgb: [255, 255, 255] },
    { name: "roof", id: THIN_CLASS.roof, rgb: [255, 0, 0] },
    { name: "lid", id: THIN_CLASS.lid, rgb: [128, 0, 128] },
    { name: "trim-decal", id: THIN_CLASS.trim, rgb: [0, 255, 0] },
    { name: "cornice", id: THIN_CLASS.cornice, rgb: [0, 0, 255] },
    { name: "frontage", id: THIN_CLASS.frontage, rgb: [255, 255, 0] },
    { name: "extras-strip", id: THIN_CLASS.extrasStrip, rgb: [255, 0, 255] },
    { name: "extras-box", id: THIN_CLASS.extrasBox, rgb: [0, 255, 255] },
    { name: "extras-other", id: THIN_CLASS.extrasOther, rgb: [128, 128, 0] },
    { name: "shell", id: THIN_CLASS.shell, rgb: [0, 128, 128] }
  ];
  var THIN_FADE_FROM_PX = 1;
  var THIN_FADE_TO_PX = 2;
  var THIN_TRIM_DEPTH_BIAS = 4e-6;
  var f = (v) => Number.isInteger(v) ? v.toFixed(1) : String(v);
  var v3 = (rgb) => `vec3(${rgb.map((c) => (c / 255).toFixed(4)).join(", ")})`;
  var VERTEX_BODY = (
    /* glsl */
    `
vThinM = thin.x * 0.01; vThinClass = thin.y;
#ifdef CITY_THIN_FADE
if (thin.y > ${f(THIN_CLASS.trim - 0.5)} && thin.y < ${f(THIN_CLASS.trim + 0.5)}) gl_Position.z -= ${THIN_TRIM_DEPTH_BIAS.toExponential()} * gl_Position.w;
#endif
`
  );
  var FRAGMENT_DECLS = (
    /* glsl */
    `
uniform float thinFocalPx;
varying float vThinM;
flat varying float vThinClass;
vec3 thinOwnerColour(float c) {
${THIN_OWNER_CLASSES.map((k) => `  if (c < ${f(k.id + 0.5)}) return ${v3(k.rgb)};`).join("\n")}
  return vec3(0.5);
}
`
  );
  var FRAGMENT_FADE = (
    /* glsl */
    `
#ifdef CITY_THIN_FADE
if (vThinM > 0.0) {
  float thinPx = vThinM * thinFocalPx / max(vFacDist, 0.01);
  float thinCover = clamp((thinPx - ${f(THIN_FADE_FROM_PX)}) / ${f(THIN_FADE_TO_PX - THIN_FADE_FROM_PX)}, 0.0, 1.0);
  if (thinCover < 1.0 && fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666, 0.569840296))) >= thinCover) discard;
}
#endif
`
  );

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
  function shadeHex2(hex2, k) {
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
    if (!d || c.shopfront || !c.recipe || c.recipe.family !== "masonry" || c.recipe.windowHead === "segmental") return;
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
      const t = c.top, brick = shadeHex2(c.wallHex, 0.82);
      s.box(c.f, 0, c.f.len, 0, 0.08, t - 0.62, t - 0.46, brick, true);
      s.box(c.f, 0, c.f.len, 0, 0.17, t - 0.46, t - 0.3, brick, true);
      s.box(c.f, 0, c.f.len, 0, 0.27, t - 0.3, t - 0.06, brick, true);
      s.box(c.f, 0, c.f.len, 0, 0.33, t - 0.06, t + 0.06, CREAM2, true);
    } },
    { id: "stepped-parapet", styles: ["school"], p: 0.2, wide: true, street: true, group: "crown", rise: 1.25, build: (c, s) => {
      if (c.f.len < 6) return;
      const t = c.top, L = c.f.len, brick = shadeHex2(c.wallHex, 0.9);
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
      const l = d.x - d.hw, rr = d.x + d.hw, brick = shadeHex2(c.wallHex, 0.78), top = d.z1 + 0.05;
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
      if (o.ribbon || c.recipe?.windowHead === "segmental") return;
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
      if (openingsOf(c).ribbon || c.recipe?.windowHead === "segmental") return;
      const restrained = !!c.recipe && c.recipe.trimDensity !== "ornate";
      const hex2 = r < 0.6 ? WHITE2 : CREAM2, n = storeysThatFit(c, s, 6, 5);
      for (let k = 0; k < n; k++) for (const w of windowSpans(c, k)) {
        const a0 = w.x - w.hw - (restrained ? 0.04 : 0.14), a1 = w.x + w.hw + (restrained ? 0.04 : 0.14);
        s.strip(c.f, a0, a1, restrained ? 0.04 : 0.14, w.z1 + 0.03, w.z1 + (restrained ? 0.09 : 0.2), hex2);
        s.slope(c.f, a0, a1, 0, restrained ? 0.04 : 0.14, w.z1 + (restrained ? 0.12 : 0.3), w.z1 + (restrained ? 0.09 : 0.2), hex2);
      }
    } },
    { id: "white-window-frames", styles: CANAL, p: { canal: 0.3, c19: 0.35 }, wide: true, build: (c, s) => {
      if (openingsOf(c).ribbon || c.recipe?.windowHead === "segmental") return;
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
        for (const f2 of [-1 / 3, 1 / 3]) s.strip(c.f, w.x + f2 * w.hw * 2 - 0.025, w.x + f2 * w.hw * 2 + 0.025, 0.04, w.z0, w.z1, hex2);
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
      const brick = shadeHex2(c.wallHex, 0.8), z0 = storeyZ(c, 0) - 0.3;
      for (const x of pierXs(c).slice(1, -1).slice(0, 8)) s.box(c.f, x - 0.11, x + 0.11, 0, 0.32, z0, c.top - 0.05, brick, true);
    } },
    // --- Projections --------------------------------------------------------------------------
    { id: "oriel", styles: ["school", "c19"], p: { school: 0.25, c19: 0.08 }, street: true, group: "oriel", build: (c, s, r) => {
      if (c.layout.storeys < 2 || c.f.len < 5.5) return;
      const x = c.f.len * (r < 0.5 ? 0.5 : 0.3), z0 = storeyZ(c, 0) + 0.1, z1 = storeyZ(c, Math.min(2, c.layout.storeys - 1)) - 0.1;
      const glassZ0 = z0 + 0.7, glassZ1 = z1 - 0.35, frame = c.style === "school" ? pickOf(SCHOOL_FRAMES, r) : WHITE2;
      s.box(c.f, x - 0.75, x + 0.75, 0, 0.4, z0 - 0.4, z0, SANDSTONE, true);
      const body = shadeHex2(c.wallHex, 0.88);
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
      const L = c.f.len, w = 1.6, a0 = r < 0.5 ? 0 : L - w, brick = shadeHex2(c.wallHex, 0.86);
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
    // No generic stair-glass (removed 2026-10-29, #94). Drawn at random on three in ten
    // school/postwar/modern walls, it put a full-height 1 m grey glass strip on fronts that
    // have none: Dam 2 (pand 0363100012253910) and the 1991 stone corner beside the Bijenkorf
    // (0363100012179183), feedback 59b67ef0. A real stair window comes from a building type.
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

  // src/canalRecall/roofs/roofFurniture.ts
  var FURNITURE_UNITS = {
    chimney: { h: 1.1, hex: "#6b5d55", min: 0.5, max: 1.4 },
    vent: { h: 0.8, hex: "#6a6d70", min: 0.25, max: 0.6 },
    skylight: { h: 0.32, hex: ROOF_SLOT_TONES.glass.hex, min: 0.5, max: 6 },
    hvac: { h: 1.25, hex: "#c9cbcd", min: 0.8, max: 5 },
    overrun: { h: 2.6, hex: "#a7a49c", min: 2, max: 9 },
    solar: { h: 0.12, hex: ROOF_SLOT_TONES.solar.hex, min: 0.9, max: 30, lift: 0.25 },
    railing: { h: 1, hex: "#9a9fa3", min: 0.04, max: 60 }
  };
  var DECK_HEX = ROOF_SLOT_TONES.terrace.hex;

  // src/canalRecall/threeBuildingMesh.ts
  var parseHex = (hex2) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex2);
    if (!m) return [200, 190, 175];
    const v = parseInt(m[1], 16);
    return [v >> 16 & 255, v >> 8 & 255, v & 255];
  };
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
        const shade = bakedFaceShade(t.n);
        for (let k = 0; k < 3; k++) {
          positions[v * 3] = t.p[k][0];
          positions[v * 3 + 1] = t.p[k][1];
          positions[v * 3 + 2] = t.p[k][2];
          uvs[v * 2] = t.uv[k][0];
          uvs[v * 2 + 1] = t.uv[k][1];
          layerArr[v] = part.id === "NL.IMBAG.Pand.0363100012167944" && t.layer === "plain" && layers.fatihMasonry !== void 0 ? layers.fatihMasonry : layers[t.layer];
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
    return { positions, uvs, layers: layerArr, tints, accents, indices, ranges, vertexCount, quadCount: Math.ceil(tris / 2), wallCount: 0, buildingCount: ranges.length, kinds: { kit: tris } };
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
    for (const f2 of features) {
      const g = f2.geometry, ring = g.type === "Polygon" ? g.coordinates[0] : g.coordinates[0][0], id = String(f2.properties.id);
      const pts = local(ring);
      if (mine.has(id)) parts.set(id, { id, ring: pts, minHeightM: Number(f2.properties.minHeight) || 0, heightM: Number(f2.properties.height) });
      else if (Math.hypot(pts[0][0], pts[0][1]) < 70) context.push({ pts, h: Number(f2.properties.height) || 8, min: Number(f2.properties.minHeight) || 0 });
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
