# iPhone start memory, 2026-11-27

Lane `lane/iphone-start-memory-20261127`, built on `lane/loading-lines-20261127` (own engine is the default).
This note answers David's question 1: why the friend's iPhone tab died last night (Sentry CANAL-RECALL-V). It also
covers the iPhone half of question 2: can the own engine be the default on a phone?

## Answer

**Superseded for the friend's phone by the afternoon update below:** it is a new iPhone on iOS 27, and a memory kill at its moment of death is now unlikely. What follows holds for 4 GB-class iPhones.

**Question 1 (morning reading, 4 GB-class phone): a jetsam memory kill during the ride start.** In the iOS Simulator the MapLibre
start pushes the tab's WebContent process past 1.4 GB in every run (3 of 3). It peaks at 1,556–1,623 MB,
9–18 s after load. The morning run peaked at 1,626 MB at 17 s. Sentry saw three kills 5–21 s after load, all
`engine: maplibre`, with the heartbeat "previous ride ended without unload". That timing and symptom match a
WebContent process killed while the city streams in.

I assume a 4 GB-class iPhone (iPhone 11–13, SE 3) and a WebContent kill threshold of about 1.4–1.5 GB. That is
the brief's figure for 4–6 GB phones. The friend's model is unknown. The Simulator has no jetsam (runningboard logs
`Memory Limits: active 0 inactive 0`) and sends no memory-pressure warnings, so these are footprints to set against
the limit, not observed kills.

**Question 2, the iPhone half: the own engine was barely better before this lane.** It peaked at 1,310–1,705 MB,
and 1 of 3 runs passed 1.4 GB. With this lane's fixes the own default peaks at 979–1,275 MB (median 1,184, 0 of 3
over 1.4 GB), and MapLibre at 1,301–1,329 MB (was 1,556–1,623). That is under the limit but not *well* under:
the own default's worst run leaves about 125 MB of headroom. The largest remaining owner is the game's own city
world, which loads before either engine draws anything (see "What is left").

One more finding. One own-engine run (base, run 3) lost its WebContent process 19 s in at 1,242 MB, and that was
not a memory kill. `~/Library/Logs/DiagnosticReports/com.apple.WebKit.WebContent-2026-11-27-101405.ips` shows
`EXC_BREAKPOINT`/SIGKILL in the JSC DFG compiler thread (`DFG::AbstractInterpreter::verifyEdge` in
`ConstantFoldingPhase`). That is a WebKit JIT assertion in iOS 18.4's JavaScriptCore. Sentry's heartbeat cannot
tell this apart from jetsam. It happened once in about 35 Simulator starts today. Memory crossed 1.4 GB in
every MapLibre start before the fixes (3 of 3, and in the morning run).

## Update, afternoon: the friend's iPhone is new and runs iOS 27

New evidence (Sentry issue 7850333241). The friend's Safari is 27.2, so the phone runs iOS 27.x on a recent iPhone
with 6–8 GB of RAM, not a 4 GB phone. The three events on 2026-11-26 came at 20:38:39, 20:38:51 and 20:39:08,
and the same signature appeared on 11-21 and 11-16. Each has `phase=loading`, `uptimeS 10`, `distanceM 0`,
`workers 4` (three building workers plus the ground worker: the build before this lane's one-worker change),
`heapMB null` and `previousVisible=true`. The last stamp came 10 s after load and stamps are 5 s apart, so each
reload died 10–15 s into loading, every time.

**What is now most likely: not proven. A memory kill at that moment is unlikely on this phone, and the DFG crash
did not reproduce on iOS 27.2.** The evidence:

1. **iOS 27.2 runs.** iPhone 17 Simulator, iOS 27.2 (24B8117), Xcode 27.2, n = 5 cold loads per configuration,
   20 in all. Every load started the default ride (Geldersekade) and was sampled for 45 s. 0 of 20 lost their
   WebContent process. No new WebContent `.ips` appeared in `~/Library/Logs/DiagnosticReports`; the only WebContent
   report today is still the iOS 18.4 one.

   | Configuration | Peak over 45 s, MB (each run) | Largest by 15 s, MB (each run) |
   |---|---|---|
   | own, this lane | 1168, 793, 1232, 1251, 1334 | 920, 721, 730, 761, 776 |
   | MapLibre, this lane | 1097, 1265, 1519, 1319, 1322 | 385, 839, 750, 754, 721 |
   | own, `?touchPool=0` (four workers, as the friend ran) | 1190, 1337, 1379, 1228, 1223 | 1154, 763, 913, 915, 796 |
   | MapLibre, `?touchPool=0` (the friend's configuration) | 1159, 1250, 1202, 1286, 1678 | 820, 1020, 874, 1154, 879 |

   In the friend's configuration the page held 0.8–1.15 GB when the friend's tab died (10–15 s). That is below the
   1.5 GB soft limit and well below the 2,048 MB hard limit reported for current iPhones (sources below). The full
   45 s peaks stay under 2 GB too; the worst was 1,678 MB.
2. **The DFG crash.** It happened once in about 35 iOS 18.4 starts and 0 of 20 iOS 27.2 starts. Its `.ips` names
   no JS function or CodeBlock: the faulting thread is `JIT Worklist Helper Thread`, in
   `DFG::AbstractInterpreter::verifyEdge` ← `ConstantFoldingPhase::foldConstants` ← `Plan::compileInThreadImpl`.
   Release JSC asserts there without logging the code block. With no function to point at, I made no workaround;
   a blind rewrite could not be tested against a crash that does not reproduce.
3. **What the Simulator cannot see.** The Simulator has no jetsam and no memory-pressure signals. It renders
   WebGL with the Mac's GPU, so IOSurface and Metal buffers on a phone may count differently. It also cannot
   reproduce a JIT bug that only shows in the device's ARM64e tiers. A deterministic death at 10–15 s on every
   reload fits a crash that fires at the same place each time (a JIT or WebGL/GPU-process fault) better than a
   memory kill that depends on pressure. Without a device log that is an inference, not a finding.

**How to settle it.** Either of these would decide it:

- the device's own report: on the friend's iPhone, Settings › Privacy & Security › Analytics & Improvements ›
  Analytics Data, a `JetsamEvent-…` or `com.apple.WebKit.WebContent-…` file from 2026-11-26 around 20:38; or
- the next Sentry event from this lane's heartbeat. It now names the last loading step (tag `loadStep`, extra
  `steps`) and carries a memory proxy that is not null on Safari.

**Heartbeat change (this update).** Loading marks its steps on `window.__canalRecallLoadSteps`
(`src/canalRecall/loadSteps.ts`). The steps are the city world's `world:start`, `world:fetched`,
`world:segments`, `world:restored`/`world:graph`; `pool:N` when the worker pool starts; the own engine's
`own:overview`, `own:buildings`, `own:ground` and `own:booted`; and the ride's `ride:loading`,
`ride:worldJoined`, `ride:mapPrepared`, `ride:routed`, `ride:raceSetUp`, `ride:holdReleased`,
`ride:introHoldReleased` and `ride:racing`. Each mark stamps the heartbeat at once, so a tab that dies between two
5 s beats still names its step. The unended report adds tag `loadStep`, and extra `stepAtS`, `steps` (the last
10 as `name@s`), `geometries` and `textures` (three.js, both engines, through `__canalPerf.rendererInfo`),
`groundCells` and `worldSegments`. `?heartbeat=0` still turns all of it off. Regression:
`src/canalRecall/rideHeartbeat.test.ts`, the two "loading steps: …" tests.

**Documented WebContent limits.** Apple publishes no figure. What is on record:

- Simon Fraser (WebKit), 2024-08-09: WebContent on iPhone has a "soft" limit of about 1.5 GB. It is enforced as
  memory pressure rises, and it is lower on iPhones with less RAM.
  <https://bugs.webkit.org/show_bug.cgi?id=277848>
- Apple Developer Forums, 2026: an iPhone 17 Pro (12 GB) on iOS 26.3–26.4.1 logged
  `com.apple.WebKit.WebContent … exceeded mem limit: ActiveHard 2048 MB (fatal)`. An Apple engineer replied that
  iPhones have stricter jetsam limits than iPads. <https://developer.apple.com/forums/thread/823061>
- WebKit bug 312727, 2026-04: a jetsam during page load, reproduced on iPhone 16 Pro and 17 Pro with iOS 26.
  The tab reloads and dies again. No figure is given. <https://bugs.webkit.org/show_bug.cgi?id=312727>

So a current 6–8 GB iPhone allows about 1.5 GB under pressure and 2 GB hard. This page held about 0.7–1.15 GB at
the moment the friend's tab died.

Note on method. On iOS 27.2 `safaridriver` found no session host for the Simulator ("Could not find any session
hosts that match the requested capabilities"), so these runs use the probe's new `--openurl` mode. That mode opens
the page with `simctl openurl` and records footprint and process loss only: no in-page probe, and no ArrowUp (the
probe's ArrowUp never moved the rider anyway). Onboarding was marked done once, by a throwaway same-origin page.
The load-step bundles were rebuilt partway through the batch; they add a few array entries, not memory.

## Before / after

All rows: iOS Simulator iPhone 16, iOS 18.4, Mobile Safari through `safaridriver`, a cold website data store per
run. Each run starts the default ride at Geldersekade (`#race=52.37665,4.90115,…`), `travel=car`, onboarding seen,
then holds ArrowUp for 45 s once racing. "Peak" is the page WebContent's `phys_footprint_peak` from `footprint`,
sampled each second; it is the number jetsam compares with the limit. The machine was shared (load average 15–30),
so the time-to-racing column is indicative only.

| Engine, build | n | WebContent peak, MB (each run) | median | runs ≥ 1,400 MB | GPU process peak, MB |
|---|---|---|---|---|---|
| MapLibre, before (3 building workers) | 3 | 1623, 1556, 1556 | 1556 | 3 | 175–220 |
| MapLibre, this lane | 3 | 1329, 1301, 1305 | 1305 | 0 | 214–219 |
| own, before (3 building workers) | 3 | 1339, 1705, 1310* | 1339 | 1 | 180–263 |
| own, one building worker on touch | 3 | 1146, 1063, 1177 | 1146 | 0 | 250–255 |
| own, this lane (one worker + ferry churn fix) | 3 | 1275, 979, 1184 | 1184 | 0 | 238–252 |
| own, this lane with `?touchPool=0` (control: three workers) | 3 | 1406, 1477, 1328 | 1406 | 2 | 239–244 |
| MapLibre, this lane with `?touchPool=0` (control) | 3 | 1356, 1453, 1984 | 1453 | 2 | 218–220 |

\* That run's WebContent died at 19 s from the JSC DFG crash above, so its peak is truncated.

Screening runs (own engine, n = 2–3; peaks in MB):

| Variant | Peaks | What it says |
|---|---|---|
| `?tier=low` (no shadows, 1×, touch facades) | 1263, 1346 | Render quality is not the owner. |
| `?workerPool=0` (no building workers; chunks build inline) | 1007, 938 | The three building workers cost about 300–400 MB. |
| `?poolWorkers=2` | 1193, 1176, 1438 | Two workers are not safe. |
| one worker + `?worldCells=16` | 1175, 1247 | The decoded-cell cache is not the owner. |
| one worker + `?facades=0` (no buildings at all) | 1096, 1144 | Buildings are about 100 MB. The rest comes before them. |
| menu only (no ride: the game's boot and the city world prewarm) | 723, 991 | **The game's own boot is the largest owner.** |

## Who owns the memory

The WebContent footprint by VM category (`footprint`) at the own engine's peak, before the fixes:
WebKit malloc 957–1,306 MB, JS VM Gigacage (typed-array backing stores) 200–223 MB, JS JIT code 107 MB. With
one worker, JIT code falls to 57–65 MB: each worker JITs its own copy of the 6 MB worker bundle.

JSC heap snapshots of the live page, by class, taken over the Simulator's web inspector socket
(`scripts/perf/sim-heap-snapshot.py`):

| Moment | WebContent footprint | Live JS heap (page) | Largest classes |
|---|---|---|---|
| Menu, 20 s after load | ~720–990 MB | 259 MB, 3.7 M cells | ArrayBuffer 88 MB (7.9 k), Object 55 MB (1.27 M), string 22 MB, canvas 19 MB, Array 18 MB (1.2 M) |
| Ride, 16 s after load (one worker) | 1,097 MB (peak 1,281) | 352 MB, 4.2 M cells | ArrayBuffer 103 MB, Object 54 MB, string 40 MB, canvas 29 MB, Immutable Butterfly 29 MB, Array 24 MB (1.5 M) |

So the page's live JS objects are about a third of the footprint. The rest is the workers' VMs (1 building and 1
ground worker after the fix), JIT code, WebCore, and dead objects the collector has not yet reclaimed. The
Simulator has no memory pressure, so WebKit never hurries that collection along. On a real phone, pressure
warnings near the limit would make JSC collect sooner. The Simulator's peak is therefore an upper bound on the
garbage part, not on the live part.

The menu page alone is 0.7–1.0 GB. It builds the whole city's street network, routing graph and surface index
while the briefing is up (`_prepareCityWorld`, `?worldPrewarm=0` moves it to submit): about 1.2 M objects and
1.2 M arrays.

Chromium iPhone-15 emulation (`scripts/perf/chromium-start-memory.ts`), which sees owners by script, shows the
same shape. It is V8, not JSC, so read it for ratios only.

- **Own engine, 15 s after racing.** Main-thread live heap about 190–250 MB. Worker heaps: own-ground 50 MB and
  three building workers at 20, 20 and 24 MB. Top live allocators: engine.bundle.js 50 MB, own-ground-game
  32 MB, road-projection 15 MB, three-buildings 12 MB, road-network.js 10 MB.
- **Own engine, allocations from navigation to racing (`--alloc`).** 1.8 GB sampled in total. road-graph
  224 MB, three-buildings 244 MB, engine 196 MB, own-ground-game 181 MB, road-projection 134 MB and
  ferry-network 134 MB. Of the ferry share, 96 MB is `nearestOnLand`, an object per city street point per ferry
  terminal.
- **MapLibre, 15 s after racing.** Main heap about 280 MB, plus three MapLibre workers (70, 38 and 28 MB), the
  own-ground worker (334 MB, against 50 MB under own on touch) and building workers (24, 43 and 144 MB). About
  680 MB sits in workers alone.

## What changed

1. **One building worker on a touch device** (`src/canalRecall/engine/workerPool.ts`, `pagePoolSize`,
   `TOUCH_POOL_WORKERS = 1`). Each pool worker is a whole JSC VM in the WebContent process. Off-switch:
   `?touchPool=0` restores three. `?poolWorkers=N` (1–3) sets the count anywhere. Measured: own median peak
   1,339 → 1,146 MB, and the worst run 1,705 → 1,177 MB. Cost: chunks build one at a time. Time to racing in the
   final runs was 14–16 s with one worker and 16–17 s with the `?touchPool=0` control taken in the same
   session; one screening run took 34 s. All of these ran under a load
   average of 15–30, so this needs a quiet-machine timing before anyone trusts the start time. Regression: `src/canalRecall/engine/workerPool.test.ts` ("pool size: a touch device
   starts TOUCH_POOL_WORKERS …"). It applies to MapLibre too, because the building pool is shared.
2. **`nearestOnLand` allocates nothing per point** (`src/canalRecall/ferry/network.ts`). It runs the same
   arithmetic and gives the same answer, so there is no behaviour to switch off. The test pins it against the
   old version on 200 random points (`npm run test:ferry`). It removes about 100 MB of start-time garbage, a
   transient the Simulator footprint carries until the next collection. Measured with fix 1 in the "this lane"
   rows: own 1,275 / 979 / 1,184 MB against 1,146 / 1,063 / 1,177 MB with fix 1 alone. That is within the
   run-to-run spread, so I claim no footprint gain for it, only less garbage and less CPU at the start.

Rejected after measuring: `?tier=low` on touch, a smaller decoded-cell cache, two workers.

## What is left, by expected size

- **The city world at the menu (0.7–1.0 GB footprint).** This is the largest owner. Cheapest lever: build the
  street network as typed arrays instead of `{lat, lon}` objects and per-way arrays. It is not a one-line cap, so
  I left it for a routing-lane change with its own regression pins.
- **The own-ground worker under MapLibre (334 MB in Chromium).** This moves with the MapLibre retirement
  (question 3).
- **Workers' JIT.** The worker bundle is 6 MB, and each worker's copy costs 15–20 MB of JIT code.
- **A real-device reading.** The Simulator has no jetsam and no pressure signals. One run on a 4 GB iPhone with
  Web Inspector's memory timeline would turn "upper bound" into a measured margin.

## Commands

```sh
# Simulator (booted iPhone 16, iOS 18.4; safaridriver -p 4632; dev server on 4631). iOS 27.2: add --openurl (no WebDriver)
node_modules/.bin/tsx scripts/perf/iphone-sim-start-memory.ts --udid <udid> --engine own|maplibre --runs 3 --ride-s 45 [--qs 'touchPool=0'] [--menu]
# JSC heap by class over the Simulator's web inspector socket (a normal tab, not a WebDriver one)
python3 -I scripts/perf/sim-heap-snapshot.py --match canal-drive --open 'http://localhost:4631/canal-drive/?travel=car&engine=own' --wait 20 --label menu
# Chromium owners (in a browser slot)
/tmp/canal-pw.sh node_modules/.bin/tsx scripts/perf/chromium-start-memory.ts --engine own --at-s 15 [--snapshot | --alloc]
```

Raw results: `docs/perf/iphone-start-memory-20261127-raw/` (`ios27-runs.txt` for the iOS 27.2 runs; summaries of every run in this note; the morning's
MapLibre `simrun.log` and `fp.txt`).
