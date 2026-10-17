/**
 * IO half of the buurt panel's lists (src/canalRecall/coverage/contents.ts): reads the type libraries, block faces,
 * building-type designs, placed models and landmark kits, assigns each to buurten through the units build-coverage.ts
 * already located, and builds the catalogue coverage.html shows. Every thumbnail is a file already under
 * public/canal-drive (or public/); every link names a page under public/canal-drive and a target that page's own data
 * lists (or a file on main for the GitHub review-sheet links). Anything that cannot be verified is dropped and counted.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fullPandId } from '../../src/canalRecall/bagTiles';
import { HAND_KITS } from '../../src/canalRecall/landmarkKits';
import { GAME_BUILDING_MODELS, SIGNATURE_MODELS } from '../../src/canalRecall/landmarks/browser';
import { tallyByBuurt, type BuurtContent, type PandRecord, type TierId } from '../../src/canalRecall/coverage/coverage';
import {
  eraOf, paletteSwatches, parseDesignUnit, shortLabel, typeKitKeys,
  type ContentItems, type DesignItem, type FaceItem, type FaceStatus, type Link, type ModelItem, type Thumb, type TypeItem,
} from '../../src/canalRecall/coverage/contents';

const REPO_BLOB = 'https://github.com/blackmad/map-recall2/blob/main/';

type Input = {
  ROOT: string;
  pands: ReadonlyMap<string, PandRecord>;
  unitBuurt: ReadonlyMap<string, string>;
  modelUnits: ReadonlyMap<string, { tier: TierId; name: string; units: string[] }>;
  kitUnits: ReadonlyMap<string, string[]>;
  instances: readonly { pand: string; unit: string }[];
  survey: ReadonlyMap<string, readonly string[]>;
};

export function buildContents({ ROOT, pands, unitBuurt, modelUnits, kitUnits, instances, survey }: Input) {
  const PAGE = path.join(ROOT, 'public/canal-drive');
  const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
  const dropped: string[] = [];
  /** A thumbnail path relative to public/canal-drive, kept only when the file ships. */
  const thumb = (rel: string, label: string): Thumb | undefined => {
    const clean = rel.split('?')[0];
    if (fs.existsSync(path.resolve(PAGE, clean)) && fs.statSync(path.resolve(PAGE, clean)).isFile()) return { src: rel, label };
    dropped.push(`thumb:${rel}`);
    return undefined;
  };
  /** A link to a page under public/canal-drive, kept only when the page exists and `target` holds. */
  const link = (label: string, href: string, target = true): Link | undefined => {
    const page = href.split(/[?#]/)[0];
    if (target && fs.existsSync(path.join(PAGE, page))) return { label, href };
    dropped.push(`link:${href}`);
    return undefined;
  };
  const repoLink = (label: string, rel: string): Link | undefined => fs.existsSync(path.join(ROOT, rel)) ? { label, href: REPO_BLOB + rel } : undefined;
  const defined = <T>(xs: (T | undefined)[]): T[] => xs.filter((x): x is T => x !== undefined);
  const pandBuurt = (id: string) => unitBuurt.get(fullPandId(id)) ?? null;
  const short = (id: string) => /^\d{6}$/.test(id) ? `0363100012${id}` : id;

  // --- what the linked pages can show ------------------------------------------------
  const chunks = new Set<string>((readJson(path.join(PAGE, 'ordinary-buildings-data/chunks.json')).chunks as { id: string }[]).map(c => c.id));
  const catalogue = new Map<string, { referenceImages?: string[] }>((readJson(path.join(PAGE, 'ordinary-buildings-data/catalogue.json')).models as { id: string; referenceImages?: string[] }[]).map(m => [m.id, m]));
  const demoIds = new Set([...SIGNATURE_MODELS, ...GAME_BUILDING_MODELS].map(m => m.id));
  const handKits = new Set(HAND_KITS.map(k => k.name));
  const surveyPage = readJson(path.join(PAGE, 'street-surveys-data/surveys.json')) as { streets: { street: string; faces: { id: string; title: string; status: string; statusReason?: string; chunkId?: string }[]; recipeHouses?: { pandId: string; photo?: { src: string } }[] }[] };
  /** Per-house recipe models on the street-surveys page: catalogue id → the page's photo crop. */
  const recipeHouses = new Map<string, { pandId: string; photo?: { src: string } }>(surveyPage.streets.flatMap(s => (s.recipeHouses ?? []).map(r => [`ordinary-${r.pandId}`, r] as const)));
  const surveyStreets = new Set(surveyPage.streets.map(s => s.street));
  const surveyFaces = new Map(surveyPage.streets.flatMap(s => s.faces.map(f => [f.id, f] as const)));
  const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const sheetFor = (() => {
    const out = new Map<string, string>();
    const walk = (dir: string) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else { const m = /^(.+)-sheet\.(jpg|png|webp)$/.exec(e.name); if (m) out.set(m[1], path.relative(ROOT, p)); } } };
    walk(path.join(ROOT, 'docs/images'));
    return out;
  })();

  // --- street surveys (scripts/street-surveys/streets) -----------------------------------------
  const faceTitles = new Map<string, { street: string; title: string; crops: Map<string, string> }>();
  const surveyDir = path.join(ROOT, 'scripts/street-surveys/streets');
  for (const file of fs.readdirSync(surveyDir).filter(f => f.endsWith('.json'))) {
    const s = readJson(path.join(surveyDir, file)) as { street: string; faces?: { id: string; numbers?: number[] }[]; proposedFaces?: { id: string; numbers?: number[] }[] };
    for (const f of [...(s.faces ?? []), ...(s.proposedFaces ?? [])]) {
      if (faceTitles.has(f.id)) continue;
      const n = f.numbers?.length === 2 ? (f.numbers[0] === f.numbers[1] ? ` ${f.numbers[0]}` : ` ${f.numbers[0]}–${f.numbers[1]}`) : '';
      faceTitles.set(f.id, { street: s.street, title: `${s.street}${n}`, crops: new Map() });
    }
  }

  // --- block faces ----------------------------------------------------------------------------
  const faces: Record<string, FaceItem> = {};
  const faceUnits: { id: string; units: string[] }[] = [];
  const facesDir = path.join(ROOT, 'scripts/block-face/faces');
  for (const id of fs.readdirSync(facesDir).sort()) {
    const dir = path.join(facesDir, id);
    if (id.startsWith('_') || !fs.statSync(dir).isDirectory()) continue; // underscore folders are synthetic demos, never surveys
    const discovery = fs.existsSync(path.join(dir, 'discovery.json')) ? readJson(path.join(dir, 'discovery.json')) as { street?: string; members?: string[] } : {};
    const intent = fs.existsSync(path.join(dir, 'intent.json')) ? readJson(path.join(dir, 'intent.json')) as { street?: string } : null;
    const pandDir = path.join(dir, 'pands');
    const members = fs.existsSync(pandDir) ? fs.readdirSync(pandDir).filter(p => /^\d{16}$/.test(p)) : (discovery.members ?? []);
    const units = members.map(fullPandId);
    faceUnits.push({ id, units });
    const chunkId = `chunk-face-${id}`, installed = chunks.has(chunkId), page = surveyFaces.get(id);
    const status: FaceStatus = installed ? 'installed' : page?.status === 'held' ? 'held' : page?.status === 'staged' ? 'staged' : intent ? 'authored' : 'discovery';
    const note = installed ? `Drawn in the game by default as ${chunkId}.` : page?.statusReason ?? (intent ? 'Intent authored; not installed as a chunk.' : 'Discovery and photo strip only; no intent authored yet.');
    const known = faceTitles.get(id);
    const street = intent?.street ?? discovery.street ?? known?.street ?? '';
    const sheet = sheetFor.get(id);
    faces[id] = {
      street, title: page?.title ?? known?.title ?? `${street} (${id})`, status, note, pands: members.length,
      ...(installed ? { chunk: chunkId } : {}),
      links: defined([
        installed ? link('View the chunk', `street-chunks.html?only=${encodeURIComponent(chunkId)}`) : undefined,
        page ? link('Street survey entry', `street-surveys.html#${encodeURIComponent(page.chunkId ?? slug(street))}`, surveyStreets.has(street)) : undefined,
        sheet ? repoLink('Review sheet (GitHub)', sheet) : undefined,
      ]),
      thumbs: defined([
        fs.existsSync(path.join(PAGE, `street-surveys-data/thumbs/${id}-photo.webp`)) ? thumb(`./street-surveys-data/thumbs/${id}-photo.webp`, 'Photo strip') : undefined,
        fs.existsSync(path.join(PAGE, `street-surveys-data/thumbs/${id}-model.webp`)) ? thumb(`./street-surveys-data/thumbs/${id}-model.webp`, 'Model') : undefined,
      ]),
    };
  }

  // --- type libraries -----------------------------------------------------------------------
  const types: Record<string, TypeItem> = {};
  const typeUnits: { id: string; units: string[] }[] = [];
  const typesDir = path.join(ROOT, 'scripts/block-face/types');
  for (const district of fs.readdirSync(typesDir).filter(d => fs.statSync(path.join(typesDir, d)).isDirectory()).sort()) {
    for (const file of fs.readdirSync(path.join(typesDir, district)).filter(f => f.endsWith('.json')).sort()) {
      const t = readJson(path.join(typesDir, district, file));
      const id = String(t.id ?? file.replace(/\.json$/, ''));
      const seen = new Map<string, string | undefined>();
      for (const e of (t.evidence ?? []) as { face?: string; pands?: string[] }[]) for (const p of e.pands ?? []) if (!seen.has(short(p))) seen.set(short(p), e.face);
      const exemplars = [...seen].map(([pand, face]) => {
        const crop = fs.existsSync(path.join(ROOT, `public/data/pand-reference/${pand}/thumb.jpg`)) ? thumb(`../data/pand-reference/${pand}/thumb.jpg`, `Photo crop of ${pand}`)
          : face && fs.existsSync(path.join(PAGE, `street-surveys-data/thumbs/${face}-photo.webp`)) ? thumb(`./street-surveys-data/thumbs/${face}-photo.webp`, `Photo strip of ${face}`) : undefined;
        return { pand, buurt: pandBuurt(pand), ...(face ? { face } : {}), ...(crop ? { thumb: crop } : {}) };
      });
      const desc = String(t.description ?? '');
      types[id] = {
        district, description: desc.length > 320 ? `${desc.slice(0, 317).trimEnd()}…` : desc,
        era: eraOf([...seen.keys()].map(p => pands.get(fullPandId(p))?.year)),
        swatches: paletteSwatches(t.palettes), kitKeys: typeKitKeys(t), exemplars,
        faces: [...new Set([...seen.values()].filter((f): f is string => !!f))],
      };
      typeUnits.push({ id, units: [...seen.keys()].map(fullPandId) });
    }
  }

  // --- building-type designs -----------------------------------------------------------------
  const designs: Record<string, DesignItem> = {};
  const byUnit = new Map<string, string[]>();
  for (const i of instances) { const l = byUnit.get(i.unit); if (l) l.push(fullPandId(i.pand)); else byUnit.set(i.unit, [fullPandId(i.pand)]); }
  const familyDir = path.join(ROOT, 'src/canalRecall/buildingTypes/types');
  for (const [unit, list] of byUnit) {
    const d = parseDesignUnit(unit);
    const famFile = path.join(familyDir, `${d.family}.json`);
    const label = fs.existsSync(famFile) ? shortLabel(String(readJson(famFile).label ?? d.family)) : d.family;
    const glb = `building-types/${unit}.glb`, hasGlb = fs.existsSync(path.join(PAGE, glb));
    if (!hasGlb) dropped.push(`glb:${glb}`);
    const preview = hasGlb ? `model-compare.html?${encodeURIComponent(d.variant || 'design')}=${encodeURIComponent(`./${glb}`)}&spin=0.4` : undefined;
    designs[unit] = {
      ...d, label, instances: list.length,
      links: defined([preview ? link('3D model', preview) : undefined]),
      ...(preview ? { preview } : {}),
    };
  }

  // --- placed models and landmark kits ---------------------------------------------------------------
  const models: Record<string, ModelItem> = {};
  for (const [id, m] of modelUnits) {
    const inCatalogue = catalogue.has(id);
    const ref = catalogue.get(id)?.referenceImages?.[0];
    const landmarkFacade = fs.existsSync(path.join(ROOT, `public/data/landmark-facades/${id}.jpg`)) ? `../data/landmark-facades/${id}.jpg` : undefined;
    const surveyChunk = [...surveyFaces.values()].find(f => f.chunkId === id);
    const house = recipeHouses.get(id);
    const shown = (ref ? thumb(ref, 'Municipal reference photo') : undefined) ?? (house?.photo ? thumb(house.photo.src, 'Photo crop') : undefined)
      ?? (landmarkFacade ? thumb(landmarkFacade, 'Facade photo') : undefined);
    models[id] = {
      name: m.name, tier: m.tier,
      links: defined([
        m.tier === 'chunk' ? link('View the chunk', `street-chunks.html?only=${encodeURIComponent(id)}`, chunks.has(id)) : undefined,
        m.tier === 'chunk' && surveyChunk ? link('Street survey entry', `street-surveys.html#${encodeURIComponent(id)}`) : undefined,
        house ? link('Street survey entry', `street-surveys.html#ordinary-${house.pandId}`) : undefined,
        inCatalogue ? link('Model viewer', `ordinary-buildings.html?building=${encodeURIComponent(id)}`) : undefined,
        demoIds.has(id) && m.tier !== 'chunk' ? link('Placement on the map', `signature-landmark-demo.html?only=${encodeURIComponent(id)}`) : undefined,
      ]),
      ...(shown ? { thumb: shown } : {}),
    };
  }
  const kits: ContentItems['kits'] = {};
  for (const name of kitUnits.keys()) {
    const hand = handKits.has(name);
    kits[name] = { hand, links: defined([hand ? link('Kit in 3D', `landmark-gallery.html?kit=${encodeURIComponent(name)}`) : undefined]) };
  }
  const surveys: ContentItems['surveys'] = {};
  for (const street of new Set([...survey.values()].flat())) surveys[street] = { links: defined([surveyStreets.has(street) ? link('Street survey', `street-surveys.html#${slug(street)}`) : undefined]) };

  // --- per buurt -------------------------------------------------------------------------------------
  const buurtOf = (u: string) => unitBuurt.get(u);
  const tallies = {
    types: tallyByBuurt(typeUnits, buurtOf),
    faces: tallyByBuurt(faceUnits, buurtOf),
    designs: tallyByBuurt([...byUnit].map(([id, units]) => ({ id, units })), buurtOf),
    models: tallyByBuurt([...modelUnits].map(([id, m]) => ({ id, units: m.units })), buurtOf),
    kits: tallyByBuurt([...kitUnits].map(([id, units]) => ({ id, units })), buurtOf),
  };
  const byBuurt = new Map<string, BuurtContent>();
  for (const [kind, map] of Object.entries(tallies) as [keyof BuurtContent, Map<string, BuurtContent[keyof BuurtContent]>][]) {
    for (const [code, list] of map) {
      let c = byBuurt.get(code);
      if (!c) byBuurt.set(code, c = { types: [], faces: [], designs: [], models: [], kits: [] });
      c[kind] = list;
    }
  }
  const items: ContentItems = { types, faces, designs, models, kits, surveys };
  return {
    items, byBuurt, dropped,
    note: 'Catalogue for coverage.html: per-buurt id lists live in buurten.json features[].properties.content as [id, units in the buurt]. Links are relative to public/canal-drive/; thumbnails are files under public/.',
  };
}
