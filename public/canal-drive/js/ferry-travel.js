// Cycling remains the selected trip mode. Only the vehicle changes at a pier.
window.CanalRecallFerryTravel = {
  beginFrame(game) {
    const player = game.player;
    if (game.travelMode !== 'car') return false;
    const links = game.track._ferryLinks ||= game.track.segments.filter(s => s.ferryLink).map(s => s.ferryLink);
    if (!links.length) return false;
    if (!player.ferryOrigin) {
      const road = game.track.getNearestRoad(player.x, player.y, player.angle);
      if (road && game.track.segments[road.segIdx]?.type === 'ferry-access') {
        const access = game.track.segments[road.segIdx];
        for (const terminal of [access.ferryTerminal]) {
          if (!terminal) continue;
          const dx = terminal.x - terminal.land.x, dy = terminal.y - terminal.land.y;
          const forward = dx * Math.cos(player.angle) + dy * Math.sin(player.angle);
          if (forward <= 0 || player.speed < 1) continue;
          // The access segment includes the quay approach. Reach its water
          // end before switching vehicles; proximity to the ramp alone is not boarding.
          const distanceToBoarding = Math.hypot(player.x - terminal.x, player.y - terminal.y);
          if (distanceToBoarding > 6) continue; // 2 m at the game's native scale.
          if (!game.vectorMap.isWater(player.x, player.y, game.osmLoader)) continue;
          player.ferryOrigin = terminal;
          player.ferryDeparted = false;
          player.isBoat = true;
          player._bikeMaxSpeed = player.maxSpeed;
          player.maxSpeed = Math.min(player.maxSpeed, 135);
          player._bikeSize = { length: player.length, width: player.width };
          player.length = 96; player.width = 27;
          const destinations = window.CanalRecallFerry.connectedTerminals(terminal.id, links);
          player.ferryDestinations = destinations.map(t => t.name).join(' or ');
          break;
        }
      }
    }
    return !!player.ferryOrigin;
  },
  motionTrack(game) {
    const track = Object.create(game.track);
    track.getSurface = () => 'asphalt';
    // Free steering on water: street-heading assistance must not turn the
    // vessel towards the nearest road on the other bank.
    track.getNearestRoad = () => null;
    return track;
  },
  afterMove(game, previous) {
    const p = game.player, origin = p.ferryOrigin;
    if (!origin) return;
    const links = game.track._ferryLinks ||= game.track.segments.filter(s => s.ferryLink).map(s => s.ferryLink);
    if (Math.hypot(p.x - origin.x, p.y - origin.y) > 90) p.ferryDeparted = true;
    const allowed = [origin, ...window.CanalRecallFerry.connectedTerminals(origin.id, links)];
    const near = allowed.find(t => Math.hypot(p.x - t.x, p.y - t.y) < 48);
    if (near && p.ferryDeparted && Math.hypot(p.x-near.x,p.y-near.y) <= 18) {
      const dx = near.land.x - near.x, dy = near.land.y - near.y;
      const landward = (p.x - previous.x) * dx + (p.y - previous.y) * dy;
      if (landward > 0) {
        p.ferryOrigin = null; p.ferryDeparted = false; p.isBoat = false;
        p.maxSpeed = p._bikeMaxSpeed;
        Object.assign(p, p._bikeSize);
        p.ferryDestinations = '';
        // GTFS ferry stops sit at the vessel's mooring position, sometimes
        // offshore. Disembark at this pier's own land access, not in the water.
        p.x = near.land.x; p.y = near.land.y;
        p.angle = Math.atan2(dy, dx);
        p.speed = 0; p.vx = 0; p.vy = 0;
        return;
      }
    }
    const fitsWater = game.vectorMap.isWater(p.x, p.y, game.osmLoader);
    const pierAccess = allowed.some(t => {
      if (Math.hypot(p.x - t.x, p.y - t.y) < 48) return true;
      const dx = t.x - t.land.x, dy = t.y - t.land.y;
      const u = Math.max(0, Math.min(1, ((p.x-t.land.x)*dx+(p.y-t.land.y)*dy)/(dx*dx+dy*dy||1)));
      return Math.hypot(p.x-t.land.x-u*dx,p.y-t.land.y-u*dy) <= 20;
    });
    if (!fitsWater && !pierAccess) {
      p.x = previous.x; p.y = previous.y;
      p.speed = 0; p.vx = 0; p.vy = 0;
    }
  },
};
