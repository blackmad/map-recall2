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
}

export type RoadGuardResult = 'on-road' | 'soft-edge' | 'rolled-back';

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
  const outside = !candidateRoad || candidateRoad.dist > candidateRoad.width + options.edgeTolerance;
  if (outside) {
    car.x = previous.x;
    car.y = previous.y;
    const road = previousRoad ?? candidateRoad;
    if (!road) {
      car.speed *= 0.5;
      car.vx *= 0.5;
      car.vy *= 0.5;
      return 'rolled-back';
    }

    const tangentX = Math.cos(road.angle);
    const tangentY = Math.sin(road.angle);
    const tangentVelocity = car.vx * tangentX + car.vy * tangentY;
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
  const pullStrength = Math.min(
    options.softPullLimit ?? 3,
    offRoadMargin * (options.softPullFactor ?? 0.18),
  );
  car.x += inwardX / inwardDistance * pullStrength;
  car.y += inwardY / inwardDistance * pullStrength;
  car.speed *= 0.97;
  return 'soft-edge';
}
