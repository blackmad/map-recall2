// Panoramas aimed at a bridge face, and the face rectified (lane bridge-fidelity 2026-10-14).
//
// scripts/pand-reference/select.ts picks a street panorama in front of a
// facade wall; here the "wall" is a bridge's side face (the vertical plane
// along the deck axis at the half-width, bridge-reference/geometry.ts) and
// the cameras are the Gemeente Amsterdam boat missions (`tags=surface-water`,
// CC BY 4.0), which run along the canals and so look straight at the bridge
// faces. Land panoramas on the quays are the fallback (more oblique).
import { rectifyFacade, AMSTERDAM_WORLD_ALIGNED } from '../../src/canalRecall/facade/rectify.ts';
import { lensFor } from '../da-costa-block/neighbourhood-core.ts';
import { listPanos, rankPanos, type PanoPick, type RankWindow, type Wall } from '../pand-reference/select.ts';
import { loadPano } from '../pand-reference/rectify.ts';
import type { BridgeFace, Rd } from './geometry.ts';

/** A boat on the canal 10-60 m off the face, at most 40 deg off its normal. */
export const BRIDGE_WINDOW: RankWindow = { minD: 9, maxD: 60, strict: [14, 42], maxObliquityDeg: 40 };
/** Margin past the deck span on the rectified face, metres. */
export const FACE_MARGIN_M = 3;
/** Above the crown: the parapet, lamps and a little sky. */
export const FACE_HEADROOM_M = 2.2;
/** Below the water line (the waterline itself is uncertain by decimetres). */
export const FACE_FOOT_M = 0.4;

export interface FaceView { side: 1 | -1; wall: Wall; along: [number, number]; pick: PanoPick; surface: 'water' | 'land' }

/** The face wall on `side` (+1: the +n side), its ends ordered so its outward normal (side·n) is on the right. */
export function faceWall(face: BridgeFace, side: 1 | -1): { wall: Wall; along: [number, number] } {
  const along: [number, number] = [face.deck[0] - FACE_MARGIN_M, face.deck[1] + FACE_MARGIN_M];
  const off = { x: face.mid.x + face.n.x * face.halfWidth * side, y: face.mid.y + face.n.y * face.halfWidth * side };
  const P = (a: number): Rd => ({ x: off.x + face.u.x * a, y: off.y + face.u.y * a });
  // Right of start→end (dy, -dx) must be side·n: for side +1 run along −u (n is left of u).
  const [a, b] = side > 0 ? [P(along[1]), P(along[0])] : [P(along[0]), P(along[1])];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  return { wall: { a, b, len, nx: face.n.x * side, ny: face.n.y * side, mid: off, roadDistM: 0, facing: 1 }, along };
}

/**
 * The 2017 boat mission shot from an open deck; the 2021 one often from inside
 * a cabin (window frames, a rope, the roof edge across the face: Torensluis,
 * Reguliersgracht 2021 crops). 2017 first, then the straightest view.
 */
export const boatOrder = (p: PanoPick, q: PanoPick) => Number(p.missionYear !== 2017) - Number(q.missionYear !== 2017) || Number(p.relaxed) - Number(q.relaxed) || p.obliquityDeg - q.obliquityDeg;

/** Best water panorama per side (land panoramas when no boat mission sees the face), best first. */
export async function bridgeViews(face: BridgeFace, opts: { land?: boolean } = {}): Promise<FaceView[]> {
  const radius = Math.min(90, BRIDGE_WINDOW.maxD + (face.deck[1] - face.deck[0]) / 2 + face.halfWidth);
  const water = await listPanos(face.mid, radius, 'surface-water');
  const out: FaceView[] = [];
  for (const side of [1, -1] as const) {
    const { wall, along } = faceWall(face, side);
    const ranked = rankPanos(wall, water, BRIDGE_WINDOW).sort(boatOrder);
    if (ranked[0]) out.push({ side, wall, along, pick: ranked[0], surface: 'water' });
  }
  if (!out.length && opts.land) {
    const land = await listPanos(face.mid, Math.min(60, radius), undefined);
    for (const side of [1, -1] as const) {
      const { wall, along } = faceWall(face, side);
      const ranked = rankPanos(wall, land, { ...BRIDGE_WINDOW, maxObliquityDeg: 55 });
      if (ranked[0]) out.push({ side, wall, along, pick: ranked[0], surface: 'land' });
    }
  }
  return out.sort((p, q) => boatOrder(p.pick, q.pick));
}

export interface FaceCrop {
  /** RGBA, x along the face from `along[0]`-side end (as the camera sees it: left to right), y down from topZ. */
  data: Uint8ClampedArray; width: number; height: number; ppm: number;
  baseZ: number; topZ: number; missingFraction: number;
  /** True when image x runs along −u (the face seen from the +n side). */
  flipped: boolean;
  cameraZ: number; heightSource: string;
}

/** Rectify a bridge face at `ppm` px/m: x along the face, y from crown + headroom down to the water. */
export async function rectifyBridgeFace(face: BridgeFace, view: FaceView, ppm = 20): Promise<FaceCrop | null> {
  const pano = await loadPano(view.pick);
  if (!pano) return null;
  let lens = lensFor(view.pick.record, face.waterNAP), source = 'published camera height - 43.5 m';
  if (!lens) return null;
  if (lens.inferred) source = 'water level + 2.44 m (published height implausible)';
  // Boat cameras sit 1.0-1.3 m over the water (2017 mission: published − 43.5 m gives 0.56-0.89 m NAP over −0.40);
  // a few records publish 1.4-2.1 m (BRU0073, BRU0074 +n side), which lifts the face by the error. Outside 0.6-1.8 m: 1.15 m.
  if (view.surface === 'water' && !(lens.pose.z - face.waterNAP >= 0.6 && lens.pose.z - face.waterNAP <= 1.8)) {
    source = `water level + 1.15 m (published ${lens.pose.z.toFixed(2)} implausible for a boat)`; lens = { ...lens, pose: { ...lens.pose, z: face.waterNAP + 1.15 } };
  }
  const baseZ = face.waterNAP - FACE_FOOT_M, topZ = face.crownNAP + FACE_HEADROOM_M;
  const out = rectifyFacade(pano.img, { ...lens.pose, headingDeg: 0, pitchDeg: 0, rollDeg: 0 }, { start: view.wall.a, end: view.wall.b, baseZ, topZ }, { pixelsPerMetre: ppm, camera: AMSTERDAM_WORLD_ALIGNED, maxPixels: 4_000_000 });
  return { data: out.data, width: out.width, height: out.height, ppm: out.width / out.wallWidthM, baseZ, topZ, missingFraction: out.missingFraction, flipped: view.side > 0, cameraZ: lens.pose.z, heightSource: source };
}
