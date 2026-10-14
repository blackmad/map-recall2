import type {BuildingTools} from './cultural-builders';
import {memorialFrame} from './memorial-frame';
import {dove, rabbit as carveRabbit, squirrel} from './animal-kit';

/**
 * The Kinderbrug (bridge 420 over the Boerenwetering at the Muzenplein, Hildo Krop 1931): at each end of the bridge a brick pier carries a pale granite group.
 * Modelled here, as two models because the piers stand 24 m apart across the roadway (a single model fails the far-outside gate), are the two at the south end, OSM nodes 4370459609 "Boy with rabbits" and 4370460330 "Girl with squirrels", 24 m apart across the roadway:
 *   the boy (bald, seen from the back in the 2020 panorama) sits bust-up between two huge curling shell-like wings with rabbits at his sides;
 *   the girl (long hair, collar, a dove cupped in her hands, an open book on her lap) sits against a rounded back with squirrels and rabbits crowded on the slab at her feet.
 * Source photos: Wikimedia Commons "Brug 420 Kinderbrug pic 7" and "Jongen met konijnen, beeld op de Kinder(tjes)brug (brug 420) ..." (Alf van Beem, public
 * domain), "Brug over Boerenwetering (Beeld van Jongen met konijnen)" and "Beeld door hildo krop. Kinderbrug. Brug over Boerenwetering." (Marcelmulder68, CC BY-SA 3.0 nl).
 * Not modelled: the two north-end groups (OSM node 4370459608 and its pair) which no photo in the open set shows well. Piers 1.25 x 1.05 m, 2.3 m above the deck,
 * the group 0.95 m high on a 0.15 m slab: estimates scaled off the girl's head (0.2 m). Facing 180 (south, along the bridge axis, away from the water) is seen in
 * panorama TMX7316010203-001170_pano_0000_000080 (the back of the boy against the Amstel hotel buildings), so it stands on a panorama; the girl is assumed to match.
 * Local frame: origin at the pier centre (deck level); +z the way the group faces.
 */
const FACING = 180;
/** Offsets of the two nodes from the model origin (east, south) in metres; computed from the OSM coordinates at 52.3473 N. */

function kinderbrug(b: BuildingTools, which: 'girl' | 'boy') {
  const f = memorialFrame(b, FACING);
  const {box, ball, limb} = f;
  // facing 180 gives yaw 0, so the local frame is the world frame (x east, z south)
  const pier = (x: number, z: number) => {
    box(x, 0, z, 1.25, 2.1, 1.05, 'brick');
    box(x, 2.1, z, 1.35, 0.2, 1.15, 'stone');                 // granite cap
    return 2.3;
  };
  const rabbit = (x: number, y: number, z: number, k = 1, turn = 0) => carveRabbit(f, x, y, z, {k, turn, colour: 'stone'});
  // ---- the girl with squirrels
  if (which === 'girl') {
    const [gx, gz] = [0, 0];
    const top = pier(gx, gz);
    box(gx, top, gz, 1.2, 0.12, 0.95, 'stone');                                // slab
    const y0 = top + 0.12;
    ball(gx - 0.34, y0 + 0.4, gz - 0.12, 0.3, 0.38, 0.17, 'stone', 10);       // rounded back, left
    ball(gx + 0.34, y0 + 0.4, gz - 0.12, 0.3, 0.38, 0.17, 'stone', 10);       // rounded back, right
    ball(gx, y0 + 0.2, gz + 0.06, 0.4, 0.2, 0.3, 'stone', 10);                // lap and skirt
    // torso, shoulders, neck, head with long hair and collar
    limb([gx, y0 + 0.2, gz], [gx, y0 + 0.62, gz], 0.25, 0.2, 'stone', 10);
    ball(gx, y0 + 0.62, gz, 0.27, 0.07, 0.15, 'stone', 10);
    limb([gx, y0 + 0.64, gz], [gx, y0 + 0.78, gz], 0.075, 0.065, 'stone', 7);
    ball(gx, y0 + 0.88, gz + 0.01, 0.115, 0.14, 0.12, 'stone', 10);               // head
    ball(gx, y0 + 0.88, gz - 0.05, 0.14, 0.16, 0.11, 'stone', 10);            // long hair behind
    ball(gx - 0.1, y0 + 0.72, gz - 0.01, 0.045, 0.14, 0.07, 'stone', 6); ball(gx + 0.1, y0 + 0.72, gz - 0.01, 0.045, 0.14, 0.07, 'stone', 6);   // hair over the shoulders
    ball(gx, y0 + 0.62, gz + 0.1, 0.1, 0.03, 0.04, 'stone', 7);                // collar
    // arms down to the lap holding the dove
    limb([gx - 0.27, y0 + 0.6, gz], [gx - 0.12, y0 + 0.3, gz + 0.14], 0.07, 0.055, 'stone', 6);
    limb([gx + 0.27, y0 + 0.6, gz], [gx + 0.12, y0 + 0.3, gz + 0.14], 0.07, 0.055, 'stone', 6);
    ball(gx, y0 + 0.32, gz + 0.14, 0.08, 0.05, 0.06, 'stone', 7);              // hands
    dove(f, gx - 0.02, y0 + 0.33, gz + 0.15, {k: 1.7, turn: 0.2, colour: 'stone'});   // the dove cupped in her hands
    // animals crowding the slab front and sides
    // squirrels sit upright in front of her; rabbits crouch between them and at the sides
    for (const [dx, dz, k, t] of [[-0.3, 0.33, 1.3, 0.5], [0.0, 0.37, 1.35, 0], [0.3, 0.33, 1.3, -0.5], [-0.46, 0.05, 1.2, 1.1]] as [number, number, number, number][]) squirrel(f, gx + dx, y0, gz + dz, {k, turn: t, colour: 'stone'});
    for (const [dx, dz, k, t] of [[-0.16, 0.3, 0.85, 0.2], [0.17, 0.3, 0.85, -0.2], [0.47, 0.03, 0.9, -1.2]] as [number, number, number, number][]) rabbit(gx + dx, y0, gz + dz, k, t);
  }
  // ---- the boy with rabbits
  if (which === 'boy') {
    const [bx, bz] = [0, 0];
    const top = pier(bx, bz);
    box(bx, top, bz, 1.2, 0.12, 0.95, 'stone');
    const y0 = top + 0.12;
    ball(bx - 0.3, y0 + 0.42, bz - 0.08, 0.27, 0.4, 0.2, 'stone', 10);        // left wing/shell
    ball(bx + 0.3, y0 + 0.42, bz - 0.08, 0.27, 0.4, 0.2, 'stone', 10);        // right wing/shell
    ball(bx, y0 + 0.15, bz + 0.05, 0.36, 0.15, 0.3, 'stone', 10);             // seat and legs
    limb([bx, y0 + 0.15, bz], [bx, y0 + 0.65, bz], 0.25, 0.2, 'stone', 10);   // torso
    ball(bx, y0 + 0.65, bz, 0.27, 0.07, 0.15, 'stone', 10);
    limb([bx, y0 + 0.66, bz], [bx, y0 + 0.8, bz], 0.075, 0.065, 'stone', 7);
    ball(bx, y0 + 0.9, bz, 0.115, 0.14, 0.12, 'stone', 10);                  // bald head
    ball(bx + 0.09, y0 + 0.86, bz - 0.01, 0.015, 0.035, 0.025, 'stone', 5);    // ear
    limb([bx - 0.27, y0 + 0.62, bz], [bx - 0.15, y0 + 0.25, bz + 0.12], 0.07, 0.055, 'stone', 6);
    limb([bx + 0.27, y0 + 0.62, bz], [bx + 0.15, y0 + 0.25, bz + 0.12], 0.07, 0.055, 'stone', 6);
    for (const [dx, dz, k, t] of [[0.42, 0.25, 1.15, -0.6], [-0.42, 0.25, 1.0, 0.6], [0.48, -0.02, 0.9, -1.3], [0.2, 0.36, 0.85, -0.2]] as [number, number, number, number][]) rabbit(bx + dx, y0, bz + dz, k, t);
  }
}

export const buildKinderbrugMeisje = (_w: number, _d: number, b: BuildingTools) => kinderbrug(b, 'girl');
export const buildKinderbrugJongen = (_w: number, _d: number, b: BuildingTools) => kinderbrug(b, 'boy');
