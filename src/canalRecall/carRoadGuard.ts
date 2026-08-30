export interface CarKinematics {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  speed: number;
}

export interface RoadContact {
  x: number;
  y: number;
  dist: number;
  width: number;
  angle: number;
}

export interface RoadGuardOptions {
  edgeTolerance: number;
  softPullLimit?: number;
  softPullFactor?: number;
  /** Consecutive rolled-back frames the caller has already seen. */
  blockedFrames?: number;
  /** Rolled-back frames tolerated before the car is walked back to the centreline. */
  unwedgeAfter?: number;
}

export type RoadGuardResult = 'on-road' | 'soft-edge' | 'rolled-back' | 'unwedged';

const normalizeAngle = (angle: number): number => {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
};

/** Mutates the supplied car so the runtime can use this without allocations. */
export function constrainCarToRoad(
  car: CarKinematics,
  previous: Pick<CarKinematics, 'x' | 'y'>,
  candidateRoad: RoadContact | null,
  previousRoad: RoadContact | null,
  options: RoadGuardOptions,
): RoadGuardResult {
  const attemptedX = car.x;
  const attemptedY = car.y;
  const outside = !candidateRoad || candidateRoad.dist > candidateRoad.width + options.edgeTolerance;
  if (outside) {
    car.x = previous.x;
    car.y = previous.y;
    const road = previousRoad ?? candidateRoad;
    // A plain rollback cannot free a car that has come to rest against the
    // edge of the corridor pointing out of it: every frame it accelerates,
    // leaves the corridor, and is put back exactly where it started. Once that
    // has repeated, walk it toward the centreline and turn it along the road
    // instead — the same recovery the boat hull already had.
    if (road && (options.blockedFrames ?? 0) >= (options.unwedgeAfter ?? 6)) {
      const inwardX = road.x - car.x;
      const inwardY = road.y - car.y;
      const inwardDistance = Math.hypot(inwardX, inwardY) || 1;
      const step = Math.min(6, inwardDistance);
      car.x += inwardX / inwardDistance * step;
      car.y += inwardY / inwardDistance * step;
      car.speed = 0;
      car.vx = 0;
      car.vy = 0;
      const forwardDot = Math.cos(car.angle) * Math.cos(road.angle) + Math.sin(car.angle) * Math.sin(road.angle);
      const roadHeading = road.angle + (forwardDot < 0 ? Math.PI : 0);
      car.angle += normalizeAngle(roadHeading - car.angle) * 0.5;
      return 'unwedged';
    }
    if (!road) {
      car.speed *= 0.5;
      car.vx *= 0.5;
      car.vy *= 0.5;
      return 'rolled-back';
    }

    const tangentX = Math.cos(road.angle);
    const tangentY = Math.sin(road.angle);
    const tangentVelocity = car.vx * tangentX + car.vy * tangentY;
    // Slide along the street instead of stopping dead against it. Undoing the
    // whole step turned every clipped kerb into a wall the car had to reverse
    // out of; keeping the part of the movement that runs along the road lets
    // it graze the corner and carry on, which is both truer to driving and the
    // difference between "tight corner" and "stuck".
    const rawAlong = (attemptedX - previous.x) * tangentX + (attemptedY - previous.y) * tangentY;
    // Capped so a long frame cannot slide the car down a tangent it never
    // actually drove — the guard only ever recovers a single step of movement.
    const alongStep = Math.max(-12, Math.min(12, rawAlong));
    car.x = previous.x + tangentX * alongStep;
    car.y = previous.y + tangentY * alongStep;
    car.vx = tangentX * tangentVelocity * 0.72;
    car.vy = tangentY * tangentVelocity * 0.72;
    car.speed = Math.sign(car.speed) * Math.min(Math.abs(car.speed) * 0.7, Math.abs(tangentVelocity));
    const forwardDot = Math.cos(car.angle) * tangentX + Math.sin(car.angle) * tangentY;
    const roadHeading = road.angle + (forwardDot < 0 ? Math.PI : 0);
    car.angle += normalizeAngle(roadHeading - car.angle) * 0.18;
    return 'rolled-back';
  }

  const offRoadMargin = candidateRoad.dist - candidateRoad.width;
  if (offRoadMargin <= 0) return 'on-road';

  const inwardX = candidateRoad.x - car.x;
  const inwardY = candidateRoad.y - car.y;
  const inwardDistance = Math.hypot(inwardX, inwardY) || 1;
  const unitX = inwardX / inwardDistance;
  const unitY = inwardY / inwardDistance;
  // On the shoulder the car is on grass, which drags it down to a crawl. A car
  // aimed slightly outwards then drifts out exactly as fast as the shoulder
  // pull draws it back and stands there forever, throttle open, going nowhere.
  // Cancelling any outward velocity makes the pull decisive: you may graze the
  // shoulder, but you cannot push further off it.
  const outwardVelocity = car.vx * unitX + car.vy * unitY;
  if (outwardVelocity < 0) {
    car.vx -= unitX * outwardVelocity;
    car.vy -= unitY * outwardVelocity;
  }
  // Velocity is rebuilt from heading and speed on the next frame, so cancelling
  // it is not enough on its own: a car aimed off the road keeps walking off it.
  // Ease the heading back along the street as well, exactly as the rollback
  // branch does, so the shoulder always resolves itself within a few frames.
  const shoulderForwardDot = Math.cos(car.angle) * Math.cos(candidateRoad.angle)
    + Math.sin(car.angle) * Math.sin(candidateRoad.angle);
  const shoulderHeading = candidateRoad.angle + (shoulderForwardDot < 0 ? Math.PI : 0);
  car.angle += normalizeAngle(shoulderHeading - car.angle) * 0.12;
  const pullStrength = Math.min(
    options.softPullLimit ?? 3,
    Math.max(offRoadMargin * (options.softPullFactor ?? 0.18), Math.min(offRoadMargin, 1)),
  );
  car.x += unitX * pullStrength;
  car.y += unitY * pullStrength;
  car.speed *= 0.97;
  return 'soft-edge';
}
