// Adapter for the typed ferry runtime (src/canalRecall/ferry/travel.ts).
// Cycling remains the selected trip mode; only the vehicle changes at a pier.
// The water test is read at call time so the e2e can probe the land mask.
window.CanalRecallFerryTravel = {
  beginFrame(game) {
    return CanalRecallFerry.beginFerryFrame(game, (x, y) => game.vectorMap.isWater(x, y, game.osmLoader));
  },
  motionTrack(game) {
    return CanalRecallFerry.ferryMotionTrack(game.track);
  },
  afterMove(game, previous) {
    return CanalRecallFerry.afterFerryMove(game, previous, (x, y) => game.vectorMap.isWater(x, y, game.osmLoader));
  },
};
