// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(x1, y1, x2, y2) { return Math.sqrt((x2-x1)**2 + (y2-y1)**2); }
function normalizeAngle(a) { while (a > Math.PI) a -= 2*Math.PI; while (a < -Math.PI) a += 2*Math.PI; return a; }
function dot(ax, ay, bx, by) { return ax*bx + ay*by; }

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t*t, t3 = t2*t;
  return {
    x: 0.5*((2*p1.x) + (-p0.x+p2.x)*t + (2*p0.x-5*p1.x+4*p2.x-p3.x)*t2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    y: 0.5*((2*p1.y) + (-p0.y+p2.y)*t + (2*p0.y-5*p1.y+4*p2.y-p3.y)*t2 + (-p0.y+3*p1.y-3*p2.y+p3.y)*t3)
  };
}

function catmullRomWidth(w0, w1, w2, w3, t) {
  const t2 = t*t, t3 = t2*t;
  return 0.5*((2*w1) + (-w0+w2)*t + (2*w0-5*w1+4*w2-w3)*t2 + (-w0+3*w1-3*w2+w3)*t3);
}

function darken(color, amt) {
  let r, g, b;
  if (color.startsWith('#')) {
    r = parseInt(color.slice(1,3),16); g = parseInt(color.slice(3,5),16); b = parseInt(color.slice(5,7),16);
  } else if (color.startsWith('rgb')) {
    const m = color.match(/(\d+)/g);
    r = parseInt(m[0]); g = parseInt(m[1]); b = parseInt(m[2]);
  } else { return color; }
  r = clamp(r - amt, 0, 255); g = clamp(g - amt, 0, 255); b = clamp(b - amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}

function lighten(hex, amt) { return darken(hex, -amt); }

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.arcTo(x+w, y, x+w, y+r, r);
  ctx.lineTo(x+w, y+h-r);
  ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
  ctx.lineTo(x+r, y+h);
  ctx.arcTo(x, y+h, x, y+h-r, r);
  ctx.lineTo(x, y+r);
  ctx.arcTo(x, y, x+r, y, r);
  ctx.closePath();
}

// Do segments p1→p2 and p3→p4 cross? Used to tell an actual bridge crossing
// from merely passing near one of its approach ways.
// Wrap `text` to at most `maxLines` lines of `maxWidth`, ending with an
// ellipsis when it does not fit. Cards used to stop mid-sentence with no
// indication that there was more, which reads as a rendering bug.
function wrapText(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width <= maxWidth || !line) { line = test; continue; }
    if (lines.length === maxLines - 1) {
      while (line && ctx.measureText(`${line}…`).width > maxWidth) line = line.replace(/\s*\S+$/, '');
      lines.push(`${line}…`);
      return lines;
    }
    lines.push(line);
    line = words[i];
  }
  if (line) lines.push(line);
  return lines;
}

function segmentsIntersect(p1, p2, p3, p4) {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
