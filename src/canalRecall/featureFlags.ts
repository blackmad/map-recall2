// Product flags with their defaults in one typed place (F1, #311).
//
// User decision 2026-11-09, answering #285: "no daily ride, no gameplay
// element in free ride." Both are switched off here, not deleted, so the
// lanes' work (G2 Today's ride, G3 the Free Ride landmark question, G4 Free
// Ride's collection) stays in the repo and each comes back by flipping one
// constant. Pure: no DOM; the browser passes `location.search`.

/** Today's ride card on the returning landing (G2, #272; dailyRide.ts).
 *  Off: the landing shows Continue and Free Ride. The ride itself still
 *  starts from the hidden opt-in `?ride=daily` (game-route.js). The landing
 *  bundle drops the card's code while this is false (landingBrowser.ts). */
export const DAILY_RIDE_ON_LANDING = false;

/** Free Ride's collection (G4, #274; freeRideCollection.ts): the checklist
 *  line on the plaque, "N of 9 places" on the postcard, the discovery coin,
 *  the radar's unopened places and buurt stamps earned in Free Ride.
 *  Off by default; `?collection=1` opts in, `?collection=0` forces off.
 *  Stamps earned before stay in the passport. */
export const FREE_RIDE_COLLECTION_DEFAULT = false;

/** The landmark question in Free Ride (G3, landmarkQuestion.ts) and its
 *  "Quiz me on landmarks" toggle in Route setup. Off by default;
 *  `?freeRideQuiz=1` shows the toggle and lets Free Ride ask when it is on.
 *  Routes (the quiz modes) always ask; the stored preference is kept. */
export const FREE_RIDE_LANDMARK_QUIZ_DEFAULT = false;

/** `?name=1|true|on` → true, `?name=0|false|off` → false, else the default. */
export function queryFlag(search: string, name: string, fallback: boolean): boolean {
  const match = new RegExp(`[?&]${name}=([^&#]*)`).exec(search || '');
  if (!match) return fallback;
  const value = match[1].toLowerCase();
  if (value === '1' || value === 'true' || value === 'on') return true;
  if (value === '0' || value === 'false' || value === 'off') return false;
  return fallback;
}

export function freeRideCollectionEnabled(search: string): boolean {
  return queryFlag(search, 'collection', FREE_RIDE_COLLECTION_DEFAULT);
}

export function freeRideLandmarkQuizEnabled(search: string): boolean {
  return queryFlag(search, 'freeRideQuiz', FREE_RIDE_LANDMARK_QUIZ_DEFAULT);
}
