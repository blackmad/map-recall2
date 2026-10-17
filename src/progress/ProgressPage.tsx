import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Bike, Sailboat, TramFront } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { AccountChip } from '../components/AccountChip';
import { PostcardRack } from '../components/PostcardRack';
import { SiteSwitch } from '../components/SiteSwitch';
import { mapQuestSite } from '../mapQuestSite';
import { earnedAreas } from '../mapRecall/progress';
import { EXTRACT_CITIES } from '../mapRecall/cityExtracts';
import { loadLocalReviewStates, syncProgress } from '../progressRepository';
import type { ReviewEvent, ReviewState } from '../spacedRepetition';
import { REVIEW_EVENTS_KEY } from '../canalRecall/knowledgeReview';
import { loadRouteHistory, rideAgainHref, rideMinutes, type RideMode, type RideRecord } from '../canalRecall/routeHistory';
import { syncRides, syncStamps } from './cloud';
import { plural, progressView, rideWhen, type StampCollection } from './progressData';
import { loadLocalStamps, loadPool, stampView } from './stamps';
import './progress.css';

const AuthModal = lazy(() => import('../components/AuthModal').then(({ AuthModal }) => ({ default: AuthModal })));

function readEvents(): ReviewEvent[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(REVIEW_EVENTS_KEY) || '{}') as Record<string, ReviewEvent> | ReviewEvent[];
    return Array.isArray(parsed) ? parsed : Object.values(parsed);
  } catch {
    return [];
  }
}

function safeStates(): ReviewState[] {
  try { return loadLocalReviewStates(); } catch { return []; }
}
function safeRides(): RideRecord[] {
  try { return loadRouteHistory(localStorage); } catch { return []; }
}

const MODE: Record<RideMode, { label: string; Icon: typeof Bike }> = {
  boat: { label: 'Boat', Icon: Sailboat },
  bike: { label: 'Bike', Icon: Bike },
  transit: { label: 'Tram & metro', Icon: TramFront },
};

const RIDES_COLLAPSED = 8;

function RideRow({ ride, now }: { ride: RideRecord; now: number }) {
  const { label, Icon } = MODE[ride.mode];
  const minutes = rideMinutes(ride);
  const again = rideAgainHref(ride, mapQuestSite.ride);
  const names = ride.streetsLearned;
  return (
    <li className="pg-ride" data-testid="ride-row" data-ride-id={ride.id}>
      <span className="pg-ride-mode" title={label}><Icon aria-hidden="true" strokeWidth={2} /></span>
      <div className="pg-ride-body">
        <h3 className="pg-ride-route">
          <span>{ride.start.name}</span>
          <span className="pg-ride-arrow" aria-label="to">→</span>
          <span>{ride.finish.name}</span>
        </h3>
        <p className="pg-ride-meta">
          {rideWhen(ride.endedAt, now)}
          {minutes ? ` · ${minutes} min` : ''} · {label}
          {ride.askedCount ? <> · <strong>{ride.namedCount} of {ride.askedCount}</strong> named</> : ' · nothing asked'}
        </p>
        {names.length ? (
          <p className="pg-ride-names">
            {names.slice(0, 6).join(', ')}{names.length > 6 ? `, and ${names.length - 6} more` : ''}
          </p>
        ) : null}
      </div>
      {again ? (
        <a className="pg-again" href={again} data-testid="ride-again">Ride again</a>
      ) : null}
    </li>
  );
}

function RouteGlyph() {
  // A start ring, a bending route and a finish flag: the shape of a ride, drawn once.
  return (
    <svg className="pg-empty-glyph" viewBox="0 0 160 64" aria-hidden="true">
      <path d="M14 46 C 46 46, 44 16, 80 18 S 118 46, 146 22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 9" />
      <circle cx="14" cy="46" r="7" fill="var(--day-paper-raised)" stroke="currentColor" strokeWidth="3" />
      <path d="M146 22 V 4 l 12 5 -12 5" fill="var(--day-accent)" stroke="var(--day-accent-ink)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function ProgressPage() {
  const { user, loading, configured, signOutUser } = useAuth();
  const [rides, setRides] = useState<RideRecord[]>(safeRides);
  const [states, setStates] = useState<ReviewState[]>(safeStates);
  const [events] = useState<ReviewEvent[]>(readEvents);
  const [stamps, setStamps] = useState<StampCollection | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [allRides, setAllRides] = useState(false);
  const [syncNote, setSyncNote] = useState('');
  const now = useMemo(() => Date.now(), [rides, states]);

  useEffect(() => {
    // index.html is the quiz's full-screen map shell; this view is a page that scrolls.
    const body = document.body;
    const shell = ['overflow-hidden', 'select-none', 'overscroll-none', 'bg-slate-950', 'text-slate-100'];
    const had = shell.filter(name => body.classList.contains(name));
    body.classList.remove(...shell);
    body.classList.add('pg-body');
    document.documentElement.classList.add('pg-doc');
    const title = document.title;
    document.title = 'My progress · Canal Recall';
    const theme = document.querySelector('meta[name="theme-color"]');
    const themeColor = theme?.getAttribute('content');
    theme?.setAttribute('content', '#f4efe5');
    return () => {
      body.classList.remove('pg-body');
      document.documentElement.classList.remove('pg-doc');
      body.classList.add(...had);
      document.title = title;
      if (themeColor) theme?.setAttribute('content', themeColor);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refreshStamps = () => { void loadLocalStamps().then(found => { if (!cancelled) setStamps(found); }); };
    refreshStamps();
    const refresh = () => { setRides(safeRides()); setStates(safeStates()); refreshStamps(); };
    window.addEventListener('storage', refresh);
    return () => { cancelled = true; window.removeEventListener('storage', refresh); };
  }, []);

  useEffect(() => {
    if (!user) { setSyncNote(''); return; }
    let cancelled = false;
    setSyncNote('Syncing…');
    Promise.allSettled([syncRides(user), syncProgress(user), syncStamps(user)]).then(async ([rideResult, stateResult, stampResult]) => {
      if (cancelled) return;
      if (rideResult.status === 'fulfilled') setRides(rideResult.value);
      if (stateResult.status === 'fulfilled') setStates(stateResult.value);
      if (stampResult.status === 'fulfilled' && stampResult.value) {
        const pool = await loadPool();
        if (!cancelled) setStamps(stampView(stampResult.value, pool));
      }
      const failed = rideResult.status === 'rejected' || stateResult.status === 'rejected' || stampResult.status === 'rejected';
      setSyncNote(failed ? 'Could not reach the cloud copy; showing this device.' : '');
    });
    return () => { cancelled = true; };
  }, [user]);

  const view = useMemo(() => progressView(rides, states, events, now), [rides, states, events, now]);
  const postcardCities = useMemo(() => {
    const earned = new Set(earnedAreas(states).map(area => area.cityId).filter(Boolean));
    return EXTRACT_CITIES.filter(city => city.id === 'amsterdam' || earned.has(city.id));
  }, [states]);
  const stampProgress = stamps ? stamps.progress() : null;
  const stampList = stamps ? stamps.all() : [];
  // A few greyed blanks show there is more to collect, as the postcard rack does.
  const blankStamps = Math.max(0, Math.min(6 - stampList.length, (stampProgress?.total ?? 6) - stampList.length));

  const accountUser = user ? { label: user.displayName || user.email || 'Signed in', email: user.email, photoURL: user.photoURL } : null;
  const shownRides = allRides ? rides : rides.slice(0, RIDES_COLLAPSED);
  const guest = !user && !loading;

  return (
    <div className="pg" data-testid="progress-page">
      <header className="pg-wrap pg-top">
        <a className="pg-wordmark enamel-plaque enamel-framed" href={mapQuestSite.home} aria-label="Canal Recall home">Canal Recall</a>
        <nav className="pg-nav" aria-label="Site">
          <a href={mapQuestSite.ride}>Ride</a>
          <a href={mapQuestSite.quiz}>Quiz</a>
          <AccountChip
            id="progress-account-chip"
            user={accountUser}
            available={configured}
            busy={loading}
            onSignIn={() => setAuthOpen(true)}
            onSignOut={() => void signOutUser()}
            progressHref={mapQuestSite.progress}
          />
        </nav>
      </header>

      <main>
        <section className="pg-intro" aria-labelledby="pg-title">
          <div className="pg-wrap">
          <h1 id="pg-title">My progress</h1>
          {view.empty ? (
            <p className="pg-ledger" data-testid="progress-summary">
              Nothing here yet. Ride a canal or a street, or try the map quiz, and every name you get right is kept on this page.
            </p>
          ) : (
            <p className="pg-ledger" data-testid="progress-summary">
              <span><b data-testid="summary-rides">{view.rides.toLocaleString('en')}</b> {view.rides === 1 ? 'ride' : 'rides'}</span>
              <span><b data-testid="summary-names">{view.namesLearned.toLocaleString('en')}</b> {view.namesLearned === 1 ? 'name' : 'names'} learned</span>
              <span>{view.streak > 0
                ? <><b data-testid="summary-streak">{view.streak}</b>-day streak</>
                : <>no streak yet <em>— ride today to start one</em></>}
              </span>
            </p>
          )}
          {guest ? (
            <p className="pg-sync">
              {configured
                ? <>Saved on this device only. <button type="button" className="pg-link" onClick={() => setAuthOpen(true)}>Sign in</button> to keep it on every device, in the ride and the quiz.</>
                : <>Saved on this device only.</>}
            </p>
          ) : null}
          {user ? <p className="pg-sync" aria-live="polite">{syncNote || `Signed in as ${accountUser?.label}. The ride and the quiz share this progress.`}</p> : null}
          </div>
        </section>

        <section className="pg-band" aria-labelledby="pg-rides">
          <div className="pg-wrap">
            <div className="pg-head">
              <h2 id="pg-rides">Recent rides</h2>
              {rides.length ? <p>{plural(rides.length, 'ride')} on record</p> : null}
            </div>
            {rides.length ? (
              <>
                <ol className="pg-rides">
                  {shownRides.map(ride => <RideRow key={ride.id} ride={ride} now={now} />)}
                </ol>
                {rides.length > RIDES_COLLAPSED ? (
                  <button type="button" className="pg-quiet pg-more" onClick={() => setAllRides(value => !value)}>
                    {allRides ? 'Show recent rides only' : `Show all ${rides.length} rides`}
                  </button>
                ) : null}
              </>
            ) : (
              <div className="pg-empty" data-testid="rides-empty">
                <RouteGlyph />
                <div>
                  <h3>No rides yet</h3>
                  <p>Finish a ride and it lands here: where you started, where you arrived, the names you got right, and a link to ride the same route again.</p>
                </div>
                <a className="pg-stamp" href={mapQuestSite.ride}>Start a ride</a>
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="pg-known">
          <div className="pg-wrap">
            <div className="pg-head">
              <h2 id="pg-known">Streets and canals you know</h2>
              <p>Mastered: right three times running, spaced out over days</p>
            </div>
            <div className="pg-known" data-testid="mastered">
              {([['Canals and water', view.canals, 'canal'], ['Streets and bridges', view.streets, 'street']] as const).map(([title, items, kind]) => (
                <div key={kind} className="pg-known-col">
                  <h3>{title} <span>{items.length}</span></h3>
                  {items.length ? (
                    <ul className="pg-plaques" data-testid={`mastered-${kind}`}>
                      {items.map(item => <li key={item.key} className="pg-plaque" title={`${item.places} ${item.places === 1 ? 'place' : 'places'} · ${item.repetitions} right`}>{item.name}</li>)}
                    </ul>
                  ) : (
                    <p className="pg-none">{kind === 'canal' ? 'None yet. Take the boat: canal names stick after a few rides.' : 'None yet. On the bike, every street you turn into is a question.'}</p>
                  )}
                </div>
              ))}
            </div>
            {view.learning ? (
              <p className="pg-foot">
                {plural(view.learning, 'more name')} on the way{view.due ? <>, <strong>{view.due} due for review</strong></> : ''}. <a href={mapQuestSite.ride}>Review them on a ride</a>
              </p>
            ) : null}
          </div>
        </section>

        <section className="pg-band" aria-labelledby="pg-postcards">
          <div className="pg-wrap">
            <div className="pg-head">
              <h2 id="pg-postcards">Neighbourhood postcards</h2>
            </div>
            {postcardCities.map(city => (
              <div key={city.id} className="pg-postcards">
                {postcardCities.length > 1 ? <h3>{city.name}</h3> : null}
                <PostcardRack
                  placement="rail"
                  alwaysShow
                  hideTitle
                  cityId={city.id}
                  cityCenter={[(city.bbox.minLat + city.bbox.maxLat) / 2, (city.bbox.minLng + city.bbox.maxLng) / 2]}
                  states={states}
                />
              </div>
            ))}
          </div>
        </section>

        {stamps ? (
          <section aria-labelledby="pg-stamps" data-testid="stamps">
            <div className="pg-wrap">
              <div className="pg-head">
                <h2 id="pg-stamps">Landmark stamps</h2>
                {stampProgress ? <p>{stampProgress.earned} of {stampProgress.total} collected</p> : null}
              </div>
              <ul className="pg-stamps">
                {stampList.map(stamp => (
                  <li key={stamp.id} className={`pg-stamp-token${stamp.kind === 'tour' ? ' pg-stamp-tour' : ''}`} data-testid="stamp-token" data-stamp-id={stamp.id} title={`${stamp.how}${stamp.count > 1 ? ` · ${stamp.count} times` : ''}`}>
                    {stamp.kind === 'tour' ? <em>Tour</em> : null}
                    <span>{stamp.name}</span>
                    <small>{rideWhen(stamp.firstEarnedAt, now)}</small>
                  </li>
                ))}
                {Array.from({ length: blankStamps }, (_, index) => (
                  <li key={`blank-${index}`} className="pg-stamp-token pg-stamp-blank" aria-hidden="true"><span>?</span></li>
                ))}
              </ul>
              {stampList.length === 0 ? <p className="pg-none">Ride to a landmark you chose, or finish a tour, to collect its stamp.</p> : null}
            </div>
          </section>
        ) : null}
      </main>

      <footer className="pg-foot-bar">
        <div className="pg-wrap">
          <SiteSwitch links={mapQuestSite} current="progress" id="progress-site-switch" />
          <p>Progress lives in this browser{user ? ' and in your account' : ''}. Clear it from Settings in the ride.</p>
        </div>
      </footer>

      {authOpen ? <Suspense fallback={null}><AuthModal onClose={() => setAuthOpen(false)} /></Suspense> : null}
    </div>
  );
}
