/* Local development imagery is deliberately kept in an ignored run directory. */
(async () => {
  const $ = id => document.getElementById(id), api = window.CanalRecallRecipe;
  const runName = new URLSearchParams(location.search).get('run') || 'dino-fit-05';
  if (!/^[a-zA-Z0-9_-]+$/.test(runName)) throw new Error('Invalid local run name');
  const base = `facade-photo-review/local/${runName}/`;
  const response = await fetch(`${base}manifest.json`);
  if (!response.ok) throw new Error('Local extraction is missing. Run scripts/facade-rebuild/extract-strip-features.py; see EXTRACT_PIPELINE.md.');
  const bytes = await response.arrayBuffer();
  const hashBytes = async b => [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2, '0')).join('');
  const extractionHash = await hashBytes(bytes), run = JSON.parse(new TextDecoder().decode(bytes));
  const renderer = new api.RecipeDiagnosticView($('diagnostic'));
  let record, result, asset, selectedIndex = 0, revision = 0, compileRevision = 0, edits = [], ready = false, saved, sourceImage, selectedPatch;
  const renderOptions = () => ({ details: $('details').checked, wallFinish: $('finish').value });
  fetch(`${base}correction.json`).then(r => r.ok ? r.json() : null).then(data => { saved = data; if (record) $('saved').hidden = saved?.sourceSha256 !== record.sourceSha256; }).catch(() => {});
  const originals = run.records;
  const pipelines=[['dino-fit-05','Tiny · original three'],['dino-base-pilot-fit-01','Base · original three'],
    ['dino-base-pilot-study-02','Base · inferred reconstruction · original three'],
    ['dino-base-pilot-day2-03','Base · family / context evidence · original three'],
    ['dino-expansion-fit-02','Tiny · six additional'],['dino-base-expansion-fit-02','Base · six additional'],
    ['dino-tiny-expansion-study-02','Tiny · inferred reconstruction · six additional'],
    ['dino-base-expansion-study-02','Base · inferred reconstruction · six additional'],
    ['dino-base-expansion-day2-03','Base · family / occlusion evidence · six additional'],
    ['dino-base-expansion-ensemble-01','Base · semantic + SAM + edge ensemble'],
    ['dino-base-expansion-grid-01','Base · ensemble + inferred grid cells'],
    ['dino-base-expansion-grid-03','Base · bounded grid + roof context'],
    ['dino-base-city-variety-raw-01','Base · registered city variety · raw control'],
    ['dino-base-city-variety-fit-01','Base · registered city variety · fitted families'],
    ['appearance-03','Previous appearance extractor'],['pilot-01','Original semantic extractor']];
  if(!pipelines.some(([id])=>id===runName))pipelines.push([runName,runName]);
  for(const [id,label]of pipelines)$('pipeline').add(new Option(label,id));
  $('pipeline').value=runName;
  $('pipeline').onchange=()=>{const url=new URL(location.href);url.searchParams.set('run',$('pipeline').value);if(record)url.searchParams.set('source',record.sourceSha256);location.assign(url);};
  const registered=originals.some(record=>record.registration==='reviewed-development');
  $('pipeline-note').textContent=run.openingStage?.layoutHypotheses
    ? `Inferred layout preview: repeated sizes may extend beyond measured boxes. ${run.openingStage.imageStudy?'Source-image extent is used; wall ownership and ground remain unresolved.':registered?'The source wall passed development registration review; opening and appearance correctness remain unaccepted.':'Registration remains unresolved.'}`
    : `Measured candidates with conservative fitting. ${registered?'The source wall passed development registration review. ':''}Roof geometry is not implemented in this wall renderer.`;
  originals.forEach((r, i) => $('source').add(new Option(`${r.source.address} · ${r.source.capturedAt}${r.status === 'rejected' ? ' · rejected' : ''}`, String(i))));
  const safePath = name => {
    if (typeof name !== 'string' || !/^[a-zA-Z0-9_.-]+$/.test(name)) throw new Error('Invalid local asset filename');
    return base + name;
  };
  function form() {
    const opening = record.openings.find(o => o.id === $('opening').value);
    ['apply', 'omit'].forEach(id => $(id).disabled = !opening);
    if (!opening) return;
    $('kind').value = opening.kind;
    ['x0', 'y0', 'x1', 'y1'].forEach((id, i) => $(id).value = opening.box[i]);
    windowDetail(opening);
    fittingUi(opening);
    overlay();
  }
  function fittingUi(opening) {
    const fit=record.fitting;
    $('fit-summary').textContent=fit ? `${fit.adjustedCount} of ${fit.attemptedCount} attempted box adjustments applied; ${fit.rows.length} head rows, ${fit.sillGroups?.length ?? fit.rows.length} family-specific sill groups, ${fit.windowFamilies?.length ?? 0} repeated window families and ${fit.bays.length} columns. Movements are bounded to ${fit.config.maximumMovePx} pixels and checked against image edges. ${run.openingStage?.gridCompletion?'Dense row/column crossings may add explicit amber inferred cells.':'No windows are added from empty grid cells.'}` : 'No joint fitting stage in this run.';
    const details=[];
    if(opening.reconstruction){
      const measured=opening.reconstruction.measuredBox;
      details.push(`INFERRED reconstruction: ${measured?`${measured.join(', ')} → `:''}${opening.reconstruction.inferredBox.join(', ')}. ${opening.reconstruction.reason}`);
    }
    if(opening.identityWarnings?.length)details.push(`Unresolved placement: ${opening.identityWarnings.join('; ')}`);
    if(opening.visibility?.state==='partial')details.push(`Partial source observation at ${opening.visibility.sourceBoundaries.join(', ')} boundary.`);
    if(opening.assembly)details.push(`Assembly ${opening.assembly.role}: ${opening.assembly.componentIds?.join(', ') ?? opening.assembly.parentId}.`);
    if(opening.contextCheck?.weakObservedPeerIds?.length)details.push(`Semantic disagreement retained because independently bounded nearby observation(s) ${opening.contextCheck.weakObservedPeerIds.join(', ')} supply local architectural context.`);
    if(opening.detector)details.push(`Original detector score ${opening.detector.score.toFixed(3)} (uncalibrated).`);
    if(opening.secondaryCheck)details.push(`Secondary check ${opening.secondaryCheck.passed?'supported recovery':'did not recover'}${opening.secondaryCheck.supportMode?` via ${opening.secondaryCheck.supportMode}`:''}: ${opening.secondaryCheck.rowPeers.length} row peers, ${opening.secondaryCheck.bayPeers.length} column peers${opening.secondaryCheck.roofLowerPeerIds?.length?`, ${opening.secondaryCheck.roofLowerPeerIds.length} lower facade peers`:''}; bounded mask ${opening.secondaryCheck.maskBounded?'yes':'no'}.`);
    if(opening.fit?.rawBox && opening.fit?.candidateBox)details.push(`Fit ${opening.fit.applied?'applied':'retained raw box'}: ${opening.fit.rawBox.join(', ')} → ${opening.fit.candidateBox.join(', ')}. ${opening.fit.reasons.join('; ')}`);
    if(opening.maskEvidence?.state==='needs-review')details.push('SAM mask needs review; excluded from colour sampling.');
    $('selected-fit').textContent=details.join(' ');
    $('ontology-fields').replaceChildren();
    const original=record.featureOntology?.openings.find(o=>o.id===opening.id);
    for(const [name,field] of Object.entries({...record.featureOntology?.building,...original?.fields})){
      const row=document.createElement('tr');
      const bound=field.evidence.find(e=>e.box && e.method?.includes('outer-frame'))?.box;
      const stale=bound && !bound.every((v,i)=>v===opening.box[i]);
      for(const value of [name,field.value===null?'Unknown':JSON.stringify(field.value),`${field.basis} / ${stale?'stale after box edit':field.state}`]){
        const cell=document.createElement('td');cell.textContent=value;cell.style.overflowWrap='anywhere';row.append(cell);
      }
      $('ontology-fields').append(row);
    }
  }
  function swatch(hex, label) {
    const item = document.createElement('span'), chip = document.createElement('span');
    chip.className = 'swatch'; chip.style.backgroundColor = hex; item.append(chip, `${label} ${hex} `); return item;
  }
  function windowDetail(opening) {
    const canvas = $('window-detail'), ctx = canvas.getContext('2d'); canvas.width = 540; canvas.height = 220;
    ctx.clearRect(0,0,540,220); $('window-evidence').replaceChildren(); $('bar-controls').replaceChildren(); $('window-style').value = '';
    if (!sourceImage || !opening) return;
    const [x0,y0,x1,y1] = opening.box, w=x1-x0,h=y1-y0, scale=Math.min(500/w,200/h), left=(540-w*scale)/2, top=(220-h*scale)/2;
    ctx.imageSmoothingEnabled = false; ctx.drawImage(sourceImage,x0,y0,w,h,left,top,w*scale,h*scale);
    const a = opening.appearance;
    if (!a) { $('window-evidence').textContent = 'No appearance evidence for this box. Internal bars and frame style remain unknown.'; return; }
    if (!a.boundBox.every((v,i)=>v===opening.box[i])) { $('window-evidence').textContent = 'Box changed: previous colour / bar measurements are stale and excluded from rendering.'; return; }
    ctx.strokeStyle = '#36dcf5'; ctx.lineWidth = 2;
    for (const bar of a.bars) {
      if (bar.state !== 'proposed') continue;
      ctx.beginPath();
      if(bar.axis==='vertical'){const x=left+bar.fraction*w*scale;ctx.moveTo(x,top);ctx.lineTo(x,top+h*scale);}
      else {const y=top+bar.fraction*h*scale;ctx.moveTo(left,y);ctx.lineTo(left+w*scale,y);}
      ctx.stroke();
    }
    if(a.trimColour) $('window-evidence').append(swatch(a.trimColour.hex,'Frame'));
    if(a.glassColour) $('window-evidence').append(swatch(a.glassColour.hex,'Glass'));
    if(a.panelColour) $('window-evidence').append(swatch(a.panelColour.hex,'Door panel'));
    $('window-evidence').append(document.createElement('br'), opening.kind==='door'
      ? `Door panel colour is sampled separately; glazing and panel layout remain unknown.`
      : `${a.bars.length} line candidates · ${a.style.value ?? 'style unknown'}. Sash / casement mechanism remains unknown.`);
    a.bars.forEach((bar,index)=>{
      const button=document.createElement('button');button.textContent=`${bar.axis} ${Math.round(bar.fraction*100)}% · ${bar.state==='rejected'?'restore':'omit'}`;
      button.onclick=()=>{if(!ready)return;const next=structuredClone(record),b=next.openings.find(o=>o.id===opening.id);b.appearance.bars[index].state=bar.state==='rejected'?'proposed':'rejected';compile(next,{action:'window-bar',id:b.id,index,state:b.appearance.bars[index].state});};
      $('bar-controls').append(button);
    });
  }
  function appearanceUi() {
    $('wall-evidence').replaceChildren(); $('patches').replaceChildren();
    const wall = record.appearance?.wall;
    if (record.rawWallColour?.hex) $('wall-evidence').append(swatch(record.rawWallColour.hex,'Original'));
    if (record.wallColour?.hex) $('wall-evidence').append(swatch(record.wallColour.hex,'Current'));
    $('wall-evidence').append(document.createElement('br'), record.wallColour?.note ?? 'No supported wall-colour sample.');
    if(sourceImage) for (const patch of wall?.patches ?? []) {
      const button = document.createElement('button'), canvas=document.createElement('canvas'); button.className='patch'; button.title=`${patch.id}: ${patch.colour.hex}`; button.setAttribute('aria-label',`Locate ${patch.id}`);
      const [x0,y0,x1,y1]=patch.box;canvas.width=x1-x0;canvas.height=y1-y0;canvas.getContext('2d').drawImage(sourceImage,x0,y0,x1-x0,y1-y0,0,0,canvas.width,canvas.height);
      button.append(canvas); button.onclick=()=>{selectedPatch=patch;$('use-patch').disabled=false;$('patch-caption').textContent=`${patch.id} · pixels ${patch.box.join(', ')} · ${patch.colour.hex}. Display is enlarged; no new detail is inferred.`;overlay();};$('patches').append(button);
    }
    const repeats=wall?.texture?.horizontalRepeats ?? [];
    $('texture-evidence').textContent=wall ? `${wall.material.value ?? 'Material unknown'} · ${repeats.length} horizontal-repeat candidates in ${new Set(repeats.map(p=>p.patchId)).size} patches. The procedural tile uses generic brick dimensions and mortar; bond and roughness are unmeasured.` : 'No texture analysis in this run.';
    if($('finish').value==='ambientcg-Bricks057'){
      const link=document.createElement('a');link.href='https://ambientcg.com/a/Bricks057';link.textContent=' ambientCG Bricks057 · CC0, authored material study';$('texture-evidence').append(link);
    }
    const coverage=record.appearance?.coverage;
    $('appearance-status').textContent=coverage ? `Detail region covers ${Math.round(coverage.imageRowsFraction*100)}% of source rows; ${coverage.unknownOpeningCount} opening candidates need review. This can exclude ground-floor exceptions. Roof, cornice geometry and intrinsic surface colour remain unresolved.` : 'Original segmentation run; no automatic appearance stage.';
  }
  function overlay() {
    $('overlay').replaceChildren();
    if (!record) return;
    $('overlay').setAttribute('viewBox', `0 0 ${record.width} ${record.height}`);
    if(selectedPatch){
      const [x0,y0,x1,y1]=selectedPatch.box,r=document.createElementNS('http://www.w3.org/2000/svg','rect');
      for(const [k,v]of Object.entries({x:x0,y:y0,width:x1-x0,height:y1-y0,stroke:'#edbb38','stroke-width':3,fill:'none','vector-effect':'non-scaling-stroke'}))r.setAttribute(k,v);
      $('overlay').append(r);
    }
    const [top, bottom] = record.visibleRows ?? [0, record.height];
    for (const [y, h] of [[0, top], [bottom, record.height - bottom]]) {
      const shade = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      for (const [key, value] of Object.entries({ x: 0, y, width: record.width, height: h, fill: '#000000', opacity: 0.45, 'pointer-events': 'none' })) shade.setAttribute(key, value);
      $('overlay').append(shade);
    }
    for (const b of record.openings) {
      const shown = result?.included.includes(b.id), partial=b.visibility?.state==='partial';
      const colour = partial ? '#9d6bff' : !shown ? '#ff7272' : b.state === 'corrected' || b.basis === 'inferred' || b.reconstruction ? '#edbb38' : '#39a9ff';
      if($('show-raw').checked){
        const raw=record.rawOpenings?.find(o=>o.id===b.id);
        if(raw){const r=document.createElementNS('http://www.w3.org/2000/svg','rect');const [x0,y0,x1,y1]=raw.box;
          for(const [k,v]of Object.entries({x:x0,y:y0,width:x1-x0,height:y1-y0,fill:'none',stroke:'#ffffff','stroke-width':1,'stroke-dasharray':'4 3','vector-effect':'non-scaling-stroke','pointer-events':'none'}))r.setAttribute(k,v);
          $('overlay').append(r);}
      }
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const [x0, y0, x1, y1] = b.box;
      for (const [key, value] of Object.entries({ x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: 'transparent', stroke: colour,
        'stroke-width': b.id === $('opening').value ? 3 : 1.5, 'vector-effect': 'non-scaling-stroke', tabindex: 0, role: 'button', 'aria-label': `Select ${b.id}` })) r.setAttribute(key, value);
      if(partial)r.setAttribute('stroke-dasharray','2 2');
      r.style.cursor = 'pointer';
      const select = () => { $('opening').value = b.id; form(); };
      r.onclick = select;
      r.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } };
      $('overlay').append(r);
    }
  }
  function update() {
    [$('wall-top').value, $('wall-bottom').value] = record.visibleRows ?? [0, record.height];
    $('crop').disabled = !result;
    $('saved').hidden = saved?.sourceSha256 !== record.sourceSha256;
    const previous = $('opening').value;
    $('opening').replaceChildren();
    record.openings.forEach(o => $('opening').add(new Option(o.id, o.id)));
    if (record.openings.some(o => o.id === previous)) $('opening').value = previous;
    form();
    $('features').replaceChildren();
    for (const b of record.openings) {
      const row = document.createElement('tr'), reason = result?.omitted.find(o => o.id === b.id)?.reason;
      for (const value of [b.id, b.box.join(', '), b.maskFill == null ? '—' : `${Math.round(b.maskFill * 100)}%`, reason || `${b.state} · rendered`]) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      $('features').append(row);
    }
    $('stats').textContent = asset ? `${record.openings.length} detections / edits · ${result.included.length} rendered · ${asset.triangleCount} triangles` : record.reason;
    $('comparison-note').textContent = asset ? `${result.omitted.length} boxes omitted · ${result.staleDetails.length} stale detail records. Photo and façade share the same scale and vertical position. Surface colours / line candidates remain proposals; depth, cap and bar thickness are display choices.` : 'No mesh generated for this source.';
    $('provenance').textContent = JSON.stringify({ source: record.source, sourceSha256: record.sourceSha256, maskSha256: record.maskSha256,
      extractionHash, revisionHash: result?.revisionHash, meshHash: asset?.meshHash, registration: record.registration,
      frame: record.frame, wallColour: record.wallColour, appearance:record.appearance, fitting:record.fitting, featureOntology:record.featureOntology, openingStage:run.openingStage, model: run.model, acceptance: run.acceptance, edits }, null, 2);
    appearanceUi();
    overlay();
  }
  async function compile(next, edit) {
    const currentCompile = ++compileRevision, currentSource = revision;
    try {
      const nextResult = await api.photoToRecipe(next, extractionHash, renderOptions()), compiled = await api.compile(nextResult.recipe);
      if(nextResult.recipe.detailing.value.wallMaterial==='ambientcg-Bricks057')await api.loadMaterialAssets();
      if (currentCompile !== compileRevision || currentSource !== revision) return false;
      record = next; result = nextResult; asset = compiled;
      if (edit) edits.push({ ...edit, at: new Date().toISOString(), sourceSha256: record.sourceSha256, extractionHash });
      const f=record.frame, bottom=record.visibleRows?.[1] ?? record.height;
      renderer.setComparisonFrame({widthM:record.width*f.metresPerPixelX,heightM:record.height*f.metresPerPixelY,centerZM:(bottom-record.height/2)*f.metresPerPixelY});
      renderer.setAsset(asset, result.recipe, $('view').value, 'palette');
      update(); $('error').textContent = ''; return true;
    } catch (error) { if (currentCompile === compileRevision && currentSource === revision) $('error').textContent = error.message; return false; }
  }
  async function choose(index) {
    const currentRevision = ++revision;
    ready = false; selectedIndex = index; edits = []; result = null; asset = null;
    sourceImage=null;selectedPatch=null;$('use-patch').disabled=true;$('bar-controls').replaceChildren();$('patch-caption').textContent='Select a patch to locate its source pixels.';
    $('window-detail').getContext('2d').clearRect(0,0,540,220);$('window-evidence').textContent='';
    $('error').textContent = '';
    record = structuredClone(originals[index]);
    $('selected-fit').textContent='';$('fit-summary').textContent='';$('ontology-fields').replaceChildren();
    const sourceRecord = record;
    $('photo-frame').querySelector('img')?.remove();
    $('photo-frame').hidden = true; $('empty').hidden = false;
    $('empty').textContent = record.reason || 'Loading source image…';
    $('source-caption').textContent = `${record.source.panoramaId} · ${record.source.capturedAt} · © Gemeente Amsterdam`;
    // Hide the previous mesh immediately, including rejected / failed sources.
    $('diagnostic').style.visibility = 'hidden';
    if (record.status !== 'proposed') { update(); $('add').disabled = true; ready = true; return; }
    const registrationText=record.registration==='reviewed-development'?'development registration reviewed; feature correctness unaccepted':'identity and registration unreviewed';
    const image = new Image(); image.alt = `${record.source.address}: rectified source, ${registrationText}`;
    const imageResponse = await fetch(safePath(record.image)), imageBytes = await imageResponse.arrayBuffer();
    if (currentRevision !== revision) return;
    if (!imageResponse.ok || await hashBytes(imageBytes) !== sourceRecord.sourceSha256) throw new Error('Source image changed: regenerate extraction before review');
    const imageUrl = URL.createObjectURL(new Blob([imageBytes], { type: 'image/jpeg' }));
    image.src = imageUrl;
    try { await image.decode(); } finally { URL.revokeObjectURL(imageUrl); }
    if (currentRevision !== revision) return;
    const maskResponse = await fetch(safePath(sourceRecord.mask)), maskBytes = await maskResponse.arrayBuffer();
    if (currentRevision !== revision) return;
    if (!maskResponse.ok || await hashBytes(maskBytes) !== sourceRecord.maskSha256) throw new Error('Source mask changed: regenerate extraction before review');
    const bitmap = await createImageBitmap(new Blob([maskBytes], { type: 'image/png' }));
    if (currentRevision !== revision) { bitmap.close(); return; }
    sourceImage=image;$('photo-frame').prepend(image); $('photo-frame').hidden = false; $('empty').hidden = true;
    const c = $('mask'); c.width = record.width; c.height = record.height;
    const ctx = c.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
    const tint = ctx.getImageData(0, 0, c.width, c.height), colours = [[180, 90, 180], [244, 157, 65], [255, 195, 55], [79, 151, 244], [50, 228, 137]];
    for (let i = 0; i < tint.data.length; i += 4) { const rgb = colours[tint.data[i]] || [0, 0, 0]; tint.data.set([...rgb, 255], i); }
    ctx.putImageData(tint, 0, 0); c.hidden = !$('show-mask').checked;
    $('add').disabled = false;
    if (await compile(record)) $('diagnostic').style.visibility = 'visible';
    ready = true;
  }
  const showError = error => { $('error').textContent = error.message; $('empty').textContent = error.message; };
  $('source').onchange = () => choose(Number($('source').value)).catch(showError);
  $('opening').onchange = form;
  $('show-mask').onchange = () => $('mask').hidden = !$('show-mask').checked;
  $('show-raw').onchange = overlay;
  $('finish').onchange=()=>{if(ready&&result)compile(structuredClone(record),{action:'render-finish',value:$('finish').value});};
  $('details').onchange=()=>{if(ready&&result)compile(structuredClone(record),{action:'render-detail',value:$('details').checked});};
  function applyPatch(next,id){
    const patch=originals[selectedIndex].appearance?.wall?.patches.find(p=>p.id===id);
    if(!patch)throw new Error('Colour patch does not belong to this source analysis');
    next.wallColour={...structuredClone(patch.colour),note:`Selected source patch ${patch.id}, pixels ${patch.box.join(', ')}. Observed camera RGB; not intrinsic reflectance.`};
    next.appearance.wall.selectedPatchId=id;
  }
  $('use-patch').onclick=()=>{if(ready&&result&&selectedPatch){const next=structuredClone(record);applyPatch(next,selectedPatch.id);compile(next,{action:'wall-colour-patch',id:selectedPatch.id});}};
  $('view').onchange = () => { if (asset) renderer.setAsset(asset, result.recipe, $('view').value, 'palette'); };
  function editBox(add) {
    if (!ready || !result) return;
    const next = structuredClone(record), selected = next.openings.find(o => o.id === $('opening').value);
    let serial = edits.length + 1;
    while (next.openings.some(o => o.id === `manual-${serial}`)) serial++;
    const id = add ? `manual-${serial}` : selected?.id;
    if (!id) return;
    const box = ['x0', 'y0', 'x1', 'y1'].map(id => Number($(id).value));
    const value = { id, kind: $('kind').value, box, state: 'corrected', reasons: [], confidence: null };
    if (add) next.openings.push(value); else Object.assign(selected, value, { maskFill: null, maskPixels: null });
    compile(next, { action: add ? 'add' : 'box', id, before: add ? null : record.openings.find(o => o.id === id), after: value });
  }
  $('apply').onclick = () => editBox(false); $('add').onclick = () => editBox(true);
  $('window-style').onchange=()=>{
    const style=$('window-style').value;if(!ready||!result||!style)return;
    const next=structuredClone(record),b=next.openings.find(o=>o.id===$('opening').value);if(!b)return;
    const [x0,y0,x1,y1]=b.box,vertical=style==='plain'?[]:[.5],horizontal=style==='sash-6'?[1/3,2/3]:style==='sash-8'?[.25,.5,.75]:style==='cross'?[.36]:[];
    const bars=[...vertical.map(f=>({axis:'vertical',fraction:f,sourceLine:[x0+f*(x1-x0),y0,x0+f*(x1-x0),y1],basis:'authored',state:'proposed'})),...horizontal.map(f=>({axis:'horizontal',fraction:f,sourceLine:[x0,y0+f*(y1-y0),x1,y0+f*(y1-y0)],basis:'authored',state:'proposed'}))];
    const fresh=b.appearance?.boundBox.every((v,i)=>v===b.box[i]);
    b.appearance={boundBox:[...b.box],trimColour:fresh?b.appearance.trimColour:null,glassColour:fresh?b.appearance.glassColour:null,bars,style:{value:style,basis:'authored',state:'proposed',confidence:null},note:'Explicit local style annotation; not a detector result.',unknown:['mechanism','hidden geometry']};
    compile(next,{action:'window-style',id:b.id,value:style});
  };
  $('crop').onclick = () => {
    if (!ready || !result) return;
    const next = structuredClone(record); next.visibleRows = [Number($('wall-top').value), Number($('wall-bottom').value)];
    compile(next, { action: 'visible-region', before: record.visibleRows ?? [0, record.height], after: next.visibleRows });
  };
  $('omit').onclick = () => {
    if (!ready || !result) return;
    const next = structuredClone(record), b = next.openings.find(o => o.id === $('opening').value);
    if (b) { b.state = 'rejected'; b.reasons = ['Omitted in local feature review']; compile(next, { action: 'omit', id: b.id }); }
  };
  $('reset').onclick = () => choose(selectedIndex).catch(showError);
  $('export').onclick = () => {
    const data = { schemaVersion: 1, extractionHash, sourceSha256: record.sourceSha256, record, edits, renderOptions:renderOptions(), recipe: result?.recipe, asset, disposition: 'unaccepted-development-proposal' };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `${record.id}.evidence.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  async function importCorrections(data) {
    if (data.extractionHash !== extractionHash || data.sourceSha256 !== record.sourceSha256) throw new Error('Corrections belong to another source or extraction version');
    const next = structuredClone(record); next.openings = data.record.openings; next.visibleRows = data.record.visibleRows;
    if(data.record.appearance?.wall?.selectedPatchId)applyPatch(next,data.record.appearance.wall.selectedPatchId);
    return compile(next, { action: 'import', importedEdits: data.edits });
  }
  $('saved').onclick = () => importCorrections(saved).catch(showError);
  $('import').onchange = async () => {
    try {
      const file = $('import').files[0]; if (!file) return;
      const data = JSON.parse(await file.text());
      // Only opening corrections are importable; identity, source frame and pixels stay bound to this run.
      await importCorrections(data);
    } catch (error) { showError(error); }
    $('import').value = '';
  };
  window.canalRecallPhotoLab = { status: () => ({ ready, source: record?.id, openings: result?.included, omitted: result?.omitted, meshHash: asset?.meshHash, extractionHash, edits: edits.length, error: $('error').textContent }),
    record: () => structuredClone(record), recipe: () => structuredClone(result?.recipe), asset: () => structuredClone(asset) };
  const requestedSource=new URLSearchParams(location.search).get('source');
  const requestedIndex=originals.findIndex(r=>r.sourceSha256===requestedSource);
  const initial = requestedIndex>=0 ? requestedIndex : Math.max(0, originals.findIndex(r => r.source.address === 'Keizersgracht 136'));
  $('source').value = String(initial); await choose(initial);
})().catch(error => { document.getElementById('error').textContent = error.message; document.getElementById('empty').textContent = error.message; });
