import * as THREE from 'three';
import {mountPreviewNotes} from './preview-notes';
import { appearanceBrickMaterial } from '../../src/canalRecall/appearanceBrickMaterial';
import { createFacadeSignMaterial } from '../../src/canalRecall/facadeSignMaterial';

type Point = [number, number];
type Case = {
  caseId: string;
  roofReview?: {status:string};
  note: string;
  architectureComposite?: {study:ViewData;provenance:any;omissions:string[]};
  source: { full: { url: string }; ground: { url: string } };
  previousRenderUrl: string;
  status: string;
  frame: { a: Point; u: Point; n: Point; width: number; bottom: number; top: number };
  owner: any;
  omissions?: string[];
  patches: { triangles: number[]; colour: string; featureId: string; featureKind: string; previewOnly: boolean; material?: string; partialAtFace?: boolean; sign?: { text: string; background: string; colour: string; font?: string; physicalSignId: string; aspectRatio?: number; uv: number[] } }[];
  counts?: Record<string, number>;
  shapeStudy?: { full?: ViewData; ground?: ViewData };
  address?: string;
  temporalEvidence?: { candidates: { url: string; cropSha256: string; captureDate: string; tier: string; width: number; height: number; geometryCandidate?: string; registration?: string }[]; recoveredFeatureCount: number; status: string };
};
type ViewData = { owner?: any; frame?: Case['frame'] | null; patches?: Case['patches']; counts?: Record<string, number> };

const dataUrl = '/data/facade-repair-preview/cases.json';
const $ = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
const point = (p: Point, direction: Point, distance: number): Point => [p[0] + direction[0] * distance, p[1] + direction[1] * distance];
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];

class Preview {
  private cases: Case[] = [];
  private notes?: Awaited<ReturnType<typeof mountPreviewNotes>>;
  private index = 0;
  private sourceTier: 'full' | 'ground' = 'ground';
  private cameraMode: 'full' | 'ground' | 'oblique' = 'ground';
  private displayMode: 'source-shapes' | 'building-placement' | 'architecture-composite' = 'source-shapes';
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private readonly model = new THREE.Group();
  private readonly source = $('img[data-role="source"]') as HTMLImageElement;
  private readonly previous = $('img[data-role="previous"]') as HTMLImageElement;
  private readonly canvas = $('canvas[data-role="candidate"]') as HTMLCanvasElement;
  private readonly label = $('[data-role="case-label"]');
  private readonly note = $('[data-role="case-note"]');
  private readonly status = $('[data-role="case-status"]');
  private readonly counts = $('[data-role="counts"]');
  private readonly gallery = $('[data-role="temporal-gallery"]');
  private readonly galleryStatus = $('[data-role="temporal-status"]');

  constructor() {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xf3f0ea, 1);
    this.canvas.replaceWith(this.renderer.domElement);
    this.renderer.domElement.dataset.role = 'candidate';
    this.renderer.domElement.setAttribute('aria-label', 'Revised candidate preview');
    this.renderer.domElement.className = 'candidate-canvas';
    this.renderer.domElement.addEventListener('webglcontextlost', event => event.preventDefault());
    this.scene.add(new THREE.AmbientLight(0xffffff, 2));
    this.scene.add(this.model);
    this.bind();
    window.addEventListener('resize', () => this.resize());
  }

  async load() {
    const response = await fetch(dataUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Preview data unavailable (${response.status})`);
    const bytes=await response.arrayBuffer();
    const json = JSON.parse(new TextDecoder().decode(bytes)) as { cases: Case[] };
    try{this.notes=await mountPreviewNotes(bytes);}catch(e){document.querySelector('#repair-note-message')!.textContent=`Notes unavailable: ${String(e)}`;}
    if (!Array.isArray(json.cases) || !json.cases.length) throw new Error('Preview data contains no cases');
    this.cases = json.cases;
    const requestedCase = new URLSearchParams(location.search).get('case');
    const requestedIndex = requestedCase ? this.cases.findIndex(item => item.caseId === requestedCase) : -1;
    if (requestedIndex >= 0) this.index = requestedIndex;
    if (!this.cases[this.index].shapeStudy?.[this.sourceTier]) this.displayMode = 'building-placement';
    const select = $('[data-role="case-select"]') as HTMLSelectElement;
    select.replaceChildren(...this.cases.map((item, index) => new Option(item.caseId, String(index))));
    select.value = String(this.index);
    this.renderCase();
    this.resize();
    window.previewReady = true;
    window.previewSelectedCaseId = this.cases[this.index].caseId;
  }

  private bind() {
    $('[data-action="prev"]').addEventListener('click', () => this.select(this.index - 1));
    $('[data-action="next"]').addEventListener('click', () => this.select(this.index + 1));
    const select = $('[data-role="case-select"]') as HTMLSelectElement;
    select.addEventListener('change', () => this.select(Number(select.value)));
    document.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(button => button.addEventListener('click', () => {
      this.cameraMode = button.dataset.camera as Preview['cameraMode'];
      if (this.cameraMode === 'ground' || this.cameraMode === 'full') this.sourceTier = this.cameraMode;
      document.querySelectorAll('[data-source-tier]').forEach(node => node.classList.toggle('active', node.getAttribute('data-source-tier') === this.sourceTier));
      document.querySelectorAll('[data-camera]').forEach(node => node.classList.toggle('active', node === button));
      this.renderCase();
    }));
    document.querySelectorAll<HTMLButtonElement>('[data-source-tier]').forEach(button => button.addEventListener('click', () => {
      this.sourceTier = button.dataset.sourceTier as Preview['sourceTier'];
      this.cameraMode = this.sourceTier;
      document.querySelectorAll('[data-camera]').forEach(node => node.classList.toggle('active', node.getAttribute('data-camera') === this.cameraMode));
      document.querySelectorAll('[data-source-tier]').forEach(node => node.classList.toggle('active', node === button));
      this.renderCase();
    }));
    document.querySelectorAll<HTMLButtonElement>('[data-display-mode]').forEach(button => button.addEventListener('click', () => {
      this.displayMode = button.dataset.displayMode as Preview['displayMode'];
      if(this.displayMode==='architecture-composite'){
        this.sourceTier='full'; this.cameraMode='full';
        document.querySelectorAll('[data-camera]').forEach(node=>node.classList.toggle('active',node.getAttribute('data-camera')==='full'));
        document.querySelectorAll('[data-source-tier]').forEach(node=>node.classList.toggle('active',node.getAttribute('data-source-tier')==='full'));
      }
      document.querySelectorAll('[data-display-mode]').forEach(node => node.classList.toggle('active', node === button));
      this.renderCase();
    }));
  }

  private select(next: number) {
    this.index = Math.max(0, Math.min(this.cases.length - 1, next));
    const select = $('[data-role="case-select"]') as HTMLSelectElement;
    select.value = String(this.index);
    this.renderCase();
    window.previewSelectedCaseId = this.cases[this.index].caseId;
    history.replaceState(null, '', `${location.pathname}?case=${encodeURIComponent(this.cases[this.index].caseId)}`);
  }

  private renderCase() {
    const current = this.cases[this.index];
    if (!current) return;
    this.notes?.show(current.caseId);
    if(this.displayMode==='architecture-composite'&&!current.architectureComposite)this.displayMode='source-shapes';
    const requestedMode = this.displayMode;
    const composite=requestedMode==='architecture-composite'?current.architectureComposite:undefined;
    const study = composite?.study ?? (requestedMode === 'source-shapes' ? current.shapeStudy?.[this.sourceTier] : undefined);
    const compositeButton=document.querySelector<HTMLButtonElement>('[data-display-mode=architecture-composite]');if(compositeButton)compositeButton.disabled=!current.architectureComposite;
    const renderMode = requestedMode === 'source-shapes' && !study ? 'building-placement' : requestedMode;
    document.querySelectorAll('[data-display-mode]').forEach(node => node.classList.toggle('active', node.getAttribute('data-display-mode') === requestedMode));
    const view = study ?? { owner: current.owner, frame: current.frame, patches: current.patches, counts: current.counts };
    this.source.src = current.source[composite?'full':this.sourceTier].url;
    this.previous.src = current.previousRenderUrl;
    this.label.textContent = `${this.index + 1}/${this.cases.length} · ${current.caseId}${current.address ? ` · ${current.address}` : ''}`;
    this.note.textContent = current.note;
    const captureDate = (current.source[this.sourceTier] as { captureDate?: string })?.captureDate;
    this.status.textContent = renderMode === 'source-shapes' ? `Source-space shape study · no metric placement claim · source ${captureDate ?? 'date unavailable'}` : `Preview alignment unverified · ${current.status} · source ${captureDate ?? 'date unavailable'}`;
    if(this.sourceTier==='full'&&renderMode==='source-shapes'&&!composite)this.status.textContent+=current.roofReview?.status==='source-outline-reviewed'?' · roof outline reviewed':' · roof outline not yet reviewed';
    if(composite){const p=composite.provenance;this.status.textContent=`Architecture composite · preview alignment only · upper openings from ${p.targetFull.captureDate.slice(0,10)}, recovered display and entrance from ${p.sourceGround.captureDate.slice(0,10)} · dated signs, paint and awnings excluded`; }
    const measured = Object.entries(view.counts ?? {}).map(([key, value]) => `${key}: ${value}`);
    const partial = renderMode === 'building-placement' ? (view.patches ?? []).filter(patch => patch.partialAtFace).length : 0;
    if (partial) measured.push(`partial clipped: ${partial}`);
    this.counts.textContent = measured.join(' · ') || 'No measured counts';
    this.renderTemporalEvidence(current);
    ($('[data-action="prev"]') as HTMLButtonElement).disabled = this.index === 0;
    ($('[data-action="next"]') as HTMLButtonElement).disabled = this.index === this.cases.length - 1;
    this.buildModel(current, view);
    this.positionCamera(current, view);
    this.renderer.render(this.scene, this.camera);
  }

  private renderTemporalEvidence(current: Case) {
    const evidence = current.temporalEvidence;
    this.gallery.replaceChildren();
    if (!evidence?.candidates?.length) {
      this.galleryStatus.textContent = 'No separate dated source candidates supplied.';
      return;
    }
    this.galleryStatus.textContent = `${evidence.status} · alignment unverified · ${evidence.candidates.length} separate dated candidate${evidence.candidates.length === 1 ? '' : 's'}`;
    for (const candidate of evidence.candidates) {
      const card = document.createElement('a');
      card.className = 'evidence-card'; card.href = candidate.url; card.target = '_blank'; card.rel = 'noreferrer';
      const image = document.createElement('img'); image.loading = 'lazy'; image.src = candidate.url; image.alt = `${candidate.tier} source captured ${candidate.captureDate}`;
      const caption = document.createElement('span');
      const date = candidate.captureDate.slice(0, 10);
      caption.textContent = `${date} · ${candidate.tier} · ${candidate.width}×${candidate.height}`;
      card.title = `${candidate.captureDate} · ${candidate.tier} · ${candidate.registration ?? 'alignment unverified'}`;
      card.append(image, caption); this.gallery.append(card);
    }
  }

  private buildModel(current: Case, view: ViewData) {
    while (this.model.children.length) {
      const object = this.model.children.pop()!;
      object.traverse(child => {
        if (child instanceof THREE.Mesh) { const material = child.material as THREE.MeshBasicMaterial; material.map?.dispose(); material.dispose(); child.geometry.dispose(); }
      });
    }
    const { frame } = view;
    if (!frame) {
      this.status.textContent = `Preview alignment unverified · omitted: missing frontage frame`;
      this.addOwnerSurfaces(view.owner);
      return;
    }
    const bottom = frame.bottom, top = frame.top, left = frame.a, right = add(frame.a, [frame.u[0] * frame.width, frame.u[1] * frame.width]);
    const corners = [
      new THREE.Vector3(left[0], bottom, left[1]), new THREE.Vector3(right[0], bottom, right[1]),
      new THREE.Vector3(right[0], top, right[1]), new THREE.Vector3(left[0], top, left[1])
    ];
    const surface = new THREE.BufferGeometry();
    surface.setAttribute('position', new THREE.Float32BufferAttribute(corners.flatMap(v => [v.x, v.y, v.z]), 3));
    const ownerFaces = THREE.ShapeUtils.triangulateShape(
      [new THREE.Vector2(0, bottom), new THREE.Vector2(frame.width, bottom), new THREE.Vector2(frame.width, top), new THREE.Vector2(0, top)], []
    );
    surface.setIndex(ownerFaces.flat());
    surface.computeVertexNormals();
    const owner = new THREE.Mesh(surface, new THREE.MeshBasicMaterial({ color: 0xd7d0c7, side: THREE.DoubleSide }));
    owner.name = `owner:${current.owner}`;
    this.model.add(owner);
    this.addOwnerSurfaces(view.owner, owner);
    for (const patch of view.patches ?? []) {
      if (!patch.previewOnly || patch.triangles.length < 9 || patch.triangles.length % 9) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(patch.triangles, 3));
      if (patch.sign?.uv?.length === patch.triangles.length / 3 * 2) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(patch.sign.uv, 2));
      geometry.computeVertexNormals();
      const material = patch.sign ? createFacadeSignMaterial(THREE, patch.sign).material : patch.material === 'brick' ? appearanceBrickMaterial(THREE, patch.colour) : new THREE.MeshBasicMaterial({ color: patch.colour, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `preview:${patch.featureKind}:${patch.featureId}`;
      this.model.add(mesh);
    }
  }

  private addOwnerSurfaces(ownerData: any, legacyOwner?: THREE.Mesh) {
    const surfaces = ownerData?.geometry?.building?.surfaces;
    if (!Array.isArray(surfaces)) return;
    if (legacyOwner) this.model.remove(legacyOwner);
    for (const surface of surfaces) {
      for (const rings of [surface.rings ?? []]) {
        if (!rings.length || rings[0].length < 3) continue;
        const vertexRings = rings.map((ring: unknown) => (Array.isArray(ring) ? ring.filter((p: unknown): p is number[] => Array.isArray(p) && p.length >= 3 && p.every(Number.isFinite)) : []));
        const points = vertexRings.flat();
        if (!vertexRings[0] || vertexRings[0].length < 3) continue;
        const projectionCandidates = [
          (ring: number[]) => new THREE.Vector2(ring[0], ring[1]),
          (ring: number[]) => new THREE.Vector2(ring[0], ring[2]),
          (ring: number[]) => new THREE.Vector2(ring[1], ring[2])
        ];
        const projectionRings = projectionCandidates.map(project => vertexRings.map(ring => ring.map(project)));
        const projection = projectionRings.reduce((best, candidate) => Math.abs(THREE.ShapeUtils.area(candidate[0])) > Math.abs(THREE.ShapeUtils.area(best[0])) ? candidate : best);
        const faces = THREE.ShapeUtils.triangulateShape(projection[0], projection.slice(1));
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
        geometry.setIndex(faces.flat());
        geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: surface.type === 'roof' ? 0x9c887d : 0xc5bcb1, side: THREE.DoubleSide, transparent: true, opacity: .82 }));
        mesh.name = `owner:${surface.type ?? 'surface'}`;
        this.model.add(mesh);
      }
    }
  }

  private positionCamera(current: Case, view: ViewData) {
    const { frame } = view;
    if (!frame) {
      const bounds = new THREE.Box3().setFromObject(this.model);
      if (bounds.isEmpty()) { this.camera.position.set(0, 3, 8); this.camera.lookAt(0, 3, 0); return; }
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      this.camera.position.set(center.x, center.y + size.y * .15, center.z + Math.max(size.x, size.y, size.z) * 1.8);
      this.camera.lookAt(center);
      return;
    }
    const center = add(frame.a, [frame.u[0] * frame.width / 2, frame.u[1] * frame.width / 2]);
    const plane = view.owner?.observations?.[0]?.payload?.images?.[this.sourceTier]?.plane;
    const sourceBottom = Number.isFinite(plane?.baseZ) ? plane.baseZ - .65 : frame.bottom;
    const sourceTop = Number.isFinite(plane?.topZ) ? plane.topZ - .65 : frame.top;
    const groundHeight = Math.max(sourceTop - sourceBottom, 1);
    const bottom = this.cameraMode === 'ground' ? sourceBottom : frame.bottom;
    const top = this.cameraMode === 'ground' ? sourceTop : frame.top;
    const height = Math.max(top - bottom, 1);
    const target = new THREE.Vector3(center[0], (bottom + top) / 2, center[1]);
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const fitVertical = height / (2 * Math.tan(halfFov));
    const fitHorizontal = frame.width / (2 * Math.tan(halfFov) * Math.max(this.camera.aspect, .01));
    const distance = Math.max(fitVertical, fitHorizontal) * 1.08;
    const normal = frame.n;
    this.camera.position.set(center[0] + normal[0] * distance, target.y + (this.cameraMode === 'ground' ? 0 : height * .08), center[1] + normal[1] * distance);
    if (this.cameraMode === 'oblique') {
      this.camera.position.x += frame.u[0] * distance * .35;
      this.camera.position.z += frame.u[1] * distance * .35;
    }
    this.camera.lookAt(target);
  }

  private resize() {
    const box = this.renderer.domElement.parentElement?.getBoundingClientRect();
    if (!box) return;
    this.camera.aspect = Math.max(box.width, 1) / Math.max(box.height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(Math.max(box.width, 1), Math.max(box.height, 1), false);
    if (this.cases.length) this.renderer.render(this.scene, this.camera);
  }
}

declare global {
  interface Window { previewReady?: boolean; previewSelectedCaseId?: string; }
}

const preview = new Preview();
preview.load().catch(error => {
  $('[data-role="case-status"]').textContent = `Preview unavailable: ${String(error)}`;
});
