// Heap-snapshot owners for the ride-start heap gate (P3, issue #130): retained size per named app object and self
// size per constructor, from a V8 heap snapshot taken over CDP. Used by scripts/heap-ride.mjs.
//
// The page marks its owners first (`window.__heapMarks = { 'vm._threeBuildings': new WeakRef(obj), ... }`); after the snapshot the
// marks object is found by its property name and each mark's retained size is read off the dominator tree
// (Cooper-Harvey-Kennedy over reverse postorder; weak edges ignored), so an object two owners share is counted in
// neither, as DevTools does. ArrayBuffer backing stores are in the snapshot as native "JSArrayBufferData" nodes.
import fs from 'node:fs';

/** Stream HeapProfiler.takeHeapSnapshot into `file` (the snapshot of a 600 MB heap is > 1 GB of JSON). */
export async function takeSnapshot(cdp, file) {
  const out = fs.createWriteStream(file);
  const onChunk = e => out.write(e.chunk);
  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
  await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false, captureNumericValue: false });
  cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk);
  await new Promise(resolve => out.end(resolve));
}

/** Parse a JSON array of non-negative integers starting at buf[at] === '['; returns the values and the index after ']'. */
function intArray(buf, at) {
  if (buf[at] !== 0x5b) throw Error(`expected [ at ${at}`);
  let cap = 1 << 20, n = 0, out = new Uint32Array(cap), v = 0, inNum = false, i = at + 1;
  for (; i < buf.length; i++) {
    const c = buf[i];
    if (c >= 48 && c <= 57) { v = v * 10 + (c - 48); inNum = true; continue; }
    if (inNum) { if (n === cap) { const next = new Uint32Array(cap *= 2); next.set(out); out = next; } out[n++] = v; v = 0; inNum = false; }
    if (c === 0x5d) return { values: out.subarray(0, n), end: i + 1 };
  }
  throw Error('unterminated array');
}

export function analyseSnapshot(file, { top = 40 } = {}) {
  const buf = fs.readFileSync(file);
  const find = (s, from = 0) => { const i = buf.indexOf(s, from); if (i < 0) throw Error(`no ${s} in snapshot`); return i; };
  const nodesAt = find('"nodes":');
  const head = JSON.parse(buf.subarray(0, nodesAt).toString('utf8').replace(/,\s*$/, '') + '}');
  const meta = head.snapshot.meta, nf = meta.node_fields.length, ef = meta.edge_fields.length;
  const nodes = intArray(buf, nodesAt + 8).values;
  const edgesAt = find('"edges":', nodesAt + 8 + nodes.length), edges = intArray(buf, edgesAt + 8).values;
  const stringsAt = find('"strings":', edgesAt);
  let stringsEnd = buf.lastIndexOf(']');
  const strings = JSON.parse(buf.subarray(stringsAt + 10, stringsEnd + 1).toString('utf8'));
  const N = nodes.length / nf;
  const NT = meta.node_types[0], ET = meta.edge_types[0];
  const fType = meta.node_fields.indexOf('type'), fName = meta.node_fields.indexOf('name'), fSelf = meta.node_fields.indexOf('self_size'), fEdges = meta.node_fields.indexOf('edge_count');
  const eType = meta.edge_fields.indexOf('type'), eName = meta.edge_fields.indexOf('name_or_index'), eTo = meta.edge_fields.indexOf('to_node');
  const WEAK = ET.indexOf('weak'), SHORTCUT = ET.indexOf('shortcut'), ELEMENT = ET.indexOf('element'), HIDDEN = ET.indexOf('hidden');
  const firstEdge = new Uint32Array(N + 1);
  for (let i = 0, e = 0; i < N; i++) { firstEdge[i] = e; e += nodes[i * nf + fEdges] * ef; firstEdge[i + 1] = e; }
  // A WeakRef's `target` edge is not typed weak in every V8; it never retains, so it is not a dominator edge either.
  const weakRefName = strings.indexOf('WeakRef'), targetName = strings.indexOf('target');
  const isWeakRef = new Uint8Array(N);
  if (weakRefName >= 0) for (let v = 0; v < N; v++) if (nodes[v * nf + fName] === weakRefName) isWeakRef[v] = 1;
  let from = 0;
  const strong = e => {
    const t = edges[e + eType]; if (t === WEAK || t === SHORTCUT) return false;
    return !(isWeakRef[from] && t !== ELEMENT && t !== HIDDEN && edges[e + eName] === targetName);
  };
  // Reverse postorder from the root (node 0), iteratively.
  const order = new Int32Array(N).fill(-1), post = new Uint32Array(N); let count = 0;
  { const stack = new Uint32Array(N), cursor = new Uint32Array(N); let sp = 0; stack[sp++] = 0; order[0] = -2; cursor[0] = firstEdge[0];
    while (sp) {
      const v = stack[sp - 1];
      if (cursor[v] < firstEdge[v + 1]) {
        const e = cursor[v]; cursor[v] += ef; from = v;
        if (!strong(e)) continue;
        const w = edges[e + eTo] / nf;
        if (order[w] === -1) { order[w] = -2; cursor[w] = firstEdge[w]; stack[sp++] = w; }
      } else { sp--; post[count] = v; order[v] = count++; }
    } }
  // Predecessors (strong edges, reachable nodes only) in CSR form.
  const predCount = new Uint32Array(N + 1);
  for (let v = 0; v < N; v++) if (order[v] >= 0) { from = v; for (let e = firstEdge[v]; e < firstEdge[v + 1]; e += ef) if (strong(e)) { const w = edges[e + eTo] / nf; if (order[w] >= 0) predCount[w + 1]++; } }
  for (let i = 0; i < N; i++) predCount[i + 1] += predCount[i];
  const preds = new Uint32Array(predCount[N]), fill = predCount.slice(0, N);
  for (let v = 0; v < N; v++) if (order[v] >= 0) { from = v; for (let e = firstEdge[v]; e < firstEdge[v + 1]; e += ef) if (strong(e)) { const w = edges[e + eTo] / nf; if (order[w] >= 0) preds[fill[w]++] = v; } }
  // Dominators: idom by postorder number.
  const UNDEF = 0xffffffff, idom = new Uint32Array(count).fill(UNDEF), root = order[0];
  idom[root] = root;
  const intersect = (a, b) => { while (a !== b) { while (a < b) a = idom[a]; while (b < a) b = idom[b]; } return a; };
  for (let changed = true, passes = 0; changed && passes < 100; passes++) {
    changed = false;
    for (let k = count - 2; k >= 0; k--) {
      const v = post[k]; let best = UNDEF;
      for (let p = predCount[v]; p < predCount[v + 1]; p++) { const u = order[preds[p]]; if (idom[u] === UNDEF) continue; best = best === UNDEF ? u : intersect(u, best); }
      if (best !== UNDEF && idom[k] !== best) { idom[k] = best; changed = true; }
    }
  }
  const retained = new Float64Array(count);
  for (let k = 0; k < count; k++) retained[k] += nodes[post[k] * nf + fSelf];
  for (let k = 0; k < count; k++) if (k !== root && idom[k] !== UNDEF) retained[idom[k]] += retained[k];
  // Marks.
  const nameOf = v => strings[nodes[v * nf + fName]];
  let marksNode = -1;
  for (let v = 0; v < N && marksNode < 0; v++) for (let e = firstEdge[v]; e < firstEdge[v + 1]; e += ef) {
    const t = edges[e + eType]; if (t === ELEMENT || t === HIDDEN || t === WEAK) continue;
    if (strings[edges[e + eName]] === '__heapMarks') { marksNode = edges[e + eTo] / nf; break; }
  }
  const marks = [];
  if (marksNode >= 0) for (let e = firstEdge[marksNode]; e < firstEdge[marksNode + 1]; e += ef) {
    const t = edges[e + eType]; if (t === ELEMENT || t === HIDDEN || t === WEAK || t === SHORTCUT) continue;
    const key = strings[edges[e + eName]], ref = edges[e + eTo] / nf;
    if (key === '__proto__' || key === 'map') continue;
    // Each mark is a WeakRef (heap-ride.mjs); its target is the owner.
    let w = -1;
    for (let f = firstEdge[ref]; f < firstEdge[ref + 1]; f += ef) if (strings[edges[f + eName]] === 'target') { w = edges[f + eTo] / nf; break; }
    if (w < 0) continue;
    const k = order[w]; if (k < 0) continue;
    marks.push({ k: key, constructor: nameOf(w), mb: +(retained[k] / 1048576).toFixed(1) });
  }
  marks.sort((a, b) => b.mb - a.mb);
  // Claimed bytes: shared buffers (three.js geometry in the scene graph and in its owner) are dominated by neither, so
  // retained size misses them. Each mark claims, breadth-first, every node it reaches that a more specific mark
  // (deeper key, e.g. vm._ownGround.store before vm._ownGround) has not claimed, without passing through functions,
  // contexts, prototypes or the global object. `buffersMB` is the ArrayBuffer backing stores among them.
  const markNodes = [];
  if (marksNode >= 0) for (let e = firstEdge[marksNode]; e < firstEdge[marksNode + 1]; e += ef) {
    const t = edges[e + eType]; if (t === ELEMENT || t === HIDDEN || t === WEAK || t === SHORTCUT) continue;
    const key = strings[edges[e + eName]], ref = edges[e + eTo] / nf;
    for (let f = firstEdge[ref]; f < firstEdge[ref + 1]; f += ef) if (strings[edges[f + eName]] === 'target') { markNodes.push({ key, node: edges[f + eTo] / nf }); break; }
  }
  // Hubs (the camera map, the frame host, the loader, the world view itself) reach everything; they claim nothing.
  const HUBS = /\.(map|host|cameraMap|owner|vectorMap|loader|pendingAim|_sharedFrame|camera|view|frame|hookedGround|landmarkHighlight)$/;
  for (let i = markNodes.length - 1; i >= 0; i--) if (HUBS.test(markNodes[i].key)) markNodes.splice(i, 1);
  markNodes.sort((a, b) => b.key.split('.').length - a.key.split('.').length || a.key.localeCompare(b.key));
  const owner = new Int32Array(N).fill(-1), CLOSURE = NT.indexOf('closure'), CODE = NT.indexOf('code'), NATIVE = NT.indexOf('native'), CONTEXT = ET.indexOf('context');
  const skipName = new Set(['__proto__', 'constructor', 'prototype', 'map', 'context', 'native_context', 'global_proxy', 'feedback_cell', 'shared']);
  const blocked = v => { const t = nodes[v * nf + fType], n = nameOf(v); return t === CLOSURE || t === CODE || /^(Window|system \/ (Native)?Context|global)/.test(n); };
  const claimed = [];
  const queue = new Uint32Array(N);
  markNodes.forEach(({ key, node }, mi) => {
    if (owner[node] >= 0 || order[node] < 0) { claimed.push({ k: key, mb: 0, buffersMB: 0, shared: owner[node] >= 0 ? markNodes[owner[node]].key : null }); return; }
    let head = 0, tail = 0, bytes = 0, buffers = 0; queue[tail++] = node; owner[node] = mi;
    while (head < tail) {
      const v = queue[head++], self = nodes[v * nf + fSelf]; bytes += self;
      if (nodes[v * nf + fType] === NATIVE && /JSArrayBufferData|ArrayBuffer/.test(nameOf(v))) buffers += self;
      for (let e = firstEdge[v]; e < firstEdge[v + 1]; e += ef) {
        const t = edges[e + eType]; if (t === WEAK || t === SHORTCUT || t === CONTEXT) continue;
        if (t !== ELEMENT && t !== HIDDEN && skipName.has(strings[edges[e + eName]])) continue;
        const w = edges[e + eTo] / nf; if (owner[w] >= 0 || blocked(w)) continue;
        owner[w] = mi; queue[tail++] = w;
      }
    }
    claimed.push({ k: key, mb: +(bytes / 1048576).toFixed(1), buffersMB: +(buffers / 1048576).toFixed(1) });
  });
  claimed.sort((a, b) => b.mb - a.mb);
  let unclaimedBuffers = 0;
  for (let v = 0; v < N; v++) if (order[v] >= 0 && owner[v] < 0 && nodes[v * nf + fType] === NATIVE && /JSArrayBufferData|ArrayBuffer/.test(nameOf(v))) unclaimedBuffers += nodes[v * nf + fSelf];
  // Self size by constructor (objects by class name, natives and arrays by type/name).
  const byCtor = new Map(); let total = 0;
  for (let v = 0; v < N; v++) {
    if (order[v] < 0) continue;
    const s = nodes[v * nf + fSelf]; total += s;
    const type = NT[nodes[v * nf + fType]], name = nameOf(v);
    const k = type === 'object' || type === 'native' || type === 'closure' ? `${type}:${String(name).split(' / ')[0].slice(0, 60)}` : type;
    const c = byCtor.get(k) ?? [0, 0]; c[0] += s; c[1]++; byCtor.set(k, c);
  }
  const ctors = [...byCtor].sort((a, b) => b[1][0] - a[1][0]).slice(0, top).map(([k, [s, n]]) => ({ k, mb: +(s / 1048576).toFixed(1), count: n }));
  return { nodes: N, reachableMB: +(total / 1048576).toFixed(1), marksFound: marksNode >= 0, marks: marks.slice(0, top * 2), claimed: claimed.filter(c => c.mb >= 0.1).slice(0, top * 2), unclaimedBuffersMB: +(unclaimedBuffers / 1048576).toFixed(1), constructors: ctors };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(analyseSnapshot(process.argv[2]), null, 1));
