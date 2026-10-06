/** Original chunky animal miniatures. No copied game geometry or textures. */
import * as T from 'three';
import {ConvexGeometry} from 'three/examples/jsm/geometries/ConvexGeometry.js';
import {Document, NodeIO} from '@gltf-transform/core';
import {weld, meshopt} from '@gltf-transform/functions';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptEncoder} from 'meshoptimizer';

// OSM source point, model name, approximate adult height, silhouette family,
// coat colour and defining details. Source spellings are preserved in the index.
export const originalAnimals = [
  ['12923412128','Spoonbill',.85,'bird','#f5ede0','spoonbill'],
  ['12923412128','Lapwing',.32,'bird','#304b48','lapwing'],
  ['12923412138','Scimitar-horned oryx',1.25,'hoof','#eee2c8','oryx'],
  ['12923412138','Meerkat',.45,'upright','#c79b62','meerkat'],
  ['12923412139','Asian small-clawed otter',.35,'long','#765344','otter'],
  ['12927954942','Jaguar',.9,'cat','#dbaa49','jaguar'],
  ['12927954943','Jaguar',.9,'cat','#dbaa49','jaguar'],
  ['12927954944','Red ruffed lemur',.6,'primate','#b74325','ruffed'],
  ['12927954947','Yellow-cheeked gibbon',.85,'primate','#343237','gibbon'],
  ['12927954955','Red-faced spider monkey',.8,'primate','#36323a','spider'],
  ['12927954956','Great white pelican',1.3,'bird','#f5d7d2','pelican'],
  ['12930531147','Sulawesi crested macaque',.65,'primate','#353138','macaque'],
  ['12930531149','Visayan warty pig',.7,'hoof','#776052','pig'],
  ['12941391668','Lowland tapir',1.05,'hoof','#846651','tapir'],
  ['12941391668','Vicuña',1.3,'hoof','#c88f54','vicuna'],
  ['12941391668','Giant anteater',.8,'long','#817766','anteater'],
  ['12941391668','Capybara',.6,'long','#aa8256','capybara'],
  ['12941391668','Patagonian mara',.65,'long','#a69379','mara'],
  ['12941391668','Crested screamer',.8,'bird','#81827b','screamer'],
  ['12942273048','Indian crested porcupine',.5,'long','#453a36','porcupine'],
  ['12950333640','Anoa',.9,'hoof','#594840','anoa'],
  ['12950334374','Griffon vulture',1,'bird','#9e7653','vulture'],
  ['12950334391','Greater kudu',1.7,'hoof','#a7937e','kudu'],
  ['12950334391','Nile lechwe',1.3,'hoof','#89624a','lechwe'],
  ['12950334392','Bennett’s wallaby',1,'upright','#8e8376','wallaby'],
  ['12952103910','Chimpanzee',1.2,'primate','#3f3631','chimp'],
  ['12952111505','Hudson Bay wolf',.85,'cat','#e8e3d2','wolf'],
  ['12954909219','Common crane',1.1,'bird','#a5a8a3','crane'],
  ['12954909510','Southern cassowary',1.65,'bird','#242833','cassowary'],
  ['12954909651','Mandrill',.85,'primate','#716456','mandrill'],
  ['12956627032','Red-crowned crane',1.5,'bird','#f5efe1','red-crane'],
  ['12956627032','Little egret',.65,'bird','#fff7e8','egret'],
  ['12956647402','Alpine ibex',1.15,'hoof','#ae916e','ibex'],
  ['13799239487','Ring-tailed lemur',.65,'primate','#a5a3a0','ringtail'],
  ['13799239488','Bat-eared fox',.65,'cat','#b29877','fox'],
];
// Keep the zoo easter egg focused on larger silhouettes and distinctive animals.
// These small additions were deliberately retired after the user's review.
export const retiredAnimalDetails = new Set(['lapwing','meerkat','otter','mara','screamer','porcupine','egret']);

export async function buildOriginalAnimal(file, family, coat, detail) {
  const parts=[];
  const cream='#f5e6c9', dark='#29262c', pink='#ca877f';
  function add(g,x,y,z,sx,sy,sz,c=coat,rotation=0) {
    g.scale(sx,sy,sz);g.rotateX(rotation);g.translate(x,y,z);
    const flat=(g.index?g.toNonIndexed():g);flat.computeVertexNormals();parts.push({g:flat,c});
  }
  // Broad planar faces with just the corners clipped, like the imported PS2
  // animals. Avoid the bead-like sphere assemblies of the rejected first pass.
  function blockGeometry() {
    const points=[];
    for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])
      points.push(new T.Vector3(x*.48,y,z),new T.Vector3(x,y*.48,z),new T.Vector3(x,y,z*.48));
    return new ConvexGeometry(points);
  }
  const blob=(x,y,z,sx,sy,sz,c=coat)=>add(blockGeometry(),x,y,z,sx,sy,sz,c);
  const cube=(x,y,z,sx,sy,sz,c=coat)=>add(new T.BoxGeometry(1,1,1),x,y,z,sx,sy,sz,c);
  function rod(a,b,r,c=coat,r2=r) {
    const start=new T.Vector3(...a),end=new T.Vector3(...b),d=end.clone().sub(start);
    const g=new T.CylinderGeometry(r2,r,d.length(),5,1);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));
    g.translate(...start.add(end).multiplyScalar(.5).toArray());
    parts.push({g:g.toNonIndexed(),c});
  }
  const eye=(x,y,z)=>cube(x,y,z,.045,.055,.009,dark);
  function ears(y,z,large=false,c=coat) {
    for(const sign of [-1,1]){
      blob(sign*.24,y,z,large?.13:.07,large?.26:.09,.055,c);
      cube(sign*.24,y+.01,z+.056,large?.12:.055,large?.3:.09,.008,pink);
    }
  }
  function horns(kind) {
    for(const sign of [-1,1]) {
      const x=sign*.16;
      const points=kind==='oryx'?[[x,1.34,.54],[x,1.65,.4],[x,1.86,.1],[x,1.98,-.18]]
        :kind==='ibex'?[[x,1.32,.56],[x*1.4,1.7,.38],[x*1.4,1.88,.06],[x,1.75,-.12]]
        :kind==='kudu'?[[x,1.4,.55],[x*1.7,1.68,.5],[x*.6,1.92,.5],[x*1.5,2.18,.43]]
        :[[x,1.3,.57],[x*1.5,1.55,.52],[x*1.7,1.64,.39]];
      for(let i=1;i<points.length;i++)rod(points[i-1],points[i],.045,dark,.028);
    }
  }
  if(detail==='jaguar') {
    // Heavy, low feline body, small round ears, broad square muzzle and long
    // tail. Its coat is flush polygon paint, never floating black bead spots.
    blob(0,.65,-.04,.34,.27,.68);
    blob(0,.68,.45,.35,.28,.25);
    for(const x of [-.23,.23])for(const z of [-.48,.43]) {
      blob(x,.28,z,.095,.28,.105);blob(x,.07,z+.05,.11,.075,.15);
    }
    blob(0,.75,.78,.25,.21,.27);
    for(const x of [-.18,.18]){blob(x,.95,.69,.075,.09,.055,dark);cube(x,.96,.748,.08,.08,.008,coat);}
    blob(0,.66,1.015,.205,.11,.09,cream);
    cube(0,.735,1.095,.1,.065,.018,dark);
    cube(0,.607,1.101,.19,.018,.009,dark);
    for(const x of [-.19,.19])cube(x,.815,1.053,.034,.032,.009,dark);
    const tail=[[0,.65,-.67],[.08,.63,-.94],[.18,.49,-1.18],[.22,.3,-1.38]];
    for(let i=1;i<tail.length;i++)rod(tail[i-1],tail[i],.055,i===3?dark:coat,.045);
    function rosette(x,y,z,ry,rz,seed,axis='x') {
      const positions=[];const count=7;
      for(let i=0;i<count;i++) {
        const a=i/count*Math.PI*2,b=(i+1)/count*Math.PI*2;
        const outer=t=>[x,y+Math.cos(t)*ry*(1+.13*Math.sin(t*3+seed)),z+Math.sin(t)*rz*(1+.16*Math.cos(t*2+seed))];
        const inner=t=>[x,y+Math.cos(t)*ry*.57,z+Math.sin(t)*rz*.55];
        positions.push(...outer(a),...outer(b),...inner(b),...outer(a),...inner(b),...inner(a));
      }
      // Small dark marks within the irregular dark ring distinguish jaguar
      // rosettes from a regular leopard-like grid of filled dots.
      positions.push(x,y-.011,z-.011,x,y+.008,z-.007,x,y+.003,z+.013);
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
      if(axis==='y'){const a=g.getAttribute('position');for(let i=0;i<a.count;i++)a.setXYZ(i,a.getY(i),a.getX(i),a.getZ(i));}
      if((axis==='x'&&x<0)||(axis==='y'&&x>0)){const a=g.getAttribute('position');for(let i=0;i<a.count;i+=3){const p=[a.getX(i),a.getY(i),a.getZ(i)];a.setXYZ(i,a.getX(i+1),a.getY(i+1),a.getZ(i+1));a.setXYZ(i+1,...p);}}
      g.computeVertexNormals();parts.push({g,c:dark});
    }
    const marks=[[-.48,.66,.056,.074],[-.27,.77,.061,.08],[-.08,.57,.055,.07],[.13,.72,.057,.079],[.32,.56,.049,.064],[-.37,.51,.047,.06],[.01,.82,.039,.054]];
    for(const sign of [-1,1])for(const [i,[z,y,ry,rz]] of marks.entries())rosette(sign*.341,y,z,ry,rz,i+sign);
    for(const sign of [-1,1]){
      rosette(sign*.351,.75,.45,.055,.06,sign);
      rosette(sign*.251,.77,.78,.035,.045,sign+2);
      for(const z of [-.48,.43])cube(sign*.326,.3,z,.004,.023,.025,dark);
    }
    for(const [i,[x,z]] of [[-.1,-.35],[.1,-.16],[-.09,.03],[.08,.22]].entries())rosette(.921,x,z,.05,.067,i+3,'y');
  } else if(family==='hoof') {
    const tall=detail==='vicuna', pig=detail==='pig', tapir=detail==='tapir';
    const y=tall?1.05:.76;
    blob(0,y,-.03,.34,.37,.64);
    for(const x of [-.24,.24])for(const z of [-.4,.4]){rod([x,y-.15,z],[x,.1,z],.07);cube(x,.065,z,.16,.13,.2,dark);}
    rod([0,y,.4],[0,tall?1.78:1.18,.58],tall?.13:.16);
    const headY=tall?1.8:1.17;
    blob(0,headY,.67,.22,.22,.32);blob(0,headY-.07,.88,.2,.13,.15,pig?pink:coat);
    eye(-.15,headY+.04,.993);eye(.15,headY+.04,.993);ears(headY+.23,.65,tall);
    rod([0,y,-.58],[0,y-.25,-.83],.04);
    if(['oryx','kudu','lechwe','ibex','anoa'].includes(detail))horns(detail);
    if(detail==='kudu')for(const x of [-.335,.335])for(let i=0;i<5;i++)cube(x,.85,-.35+i*.16,.017,.42,.025,cream);
    if(detail==='lechwe'){blob(0,1.03,.51,.19,.29,.18,dark);blob(0,1.21,.58,.19,.07,.2,cream);}
    if(detail==='oryx'){cube(0,1.14,.94,.09,.26,.024,dark);blob(0,1,.35,.2,.2,.2,'#a75d33');}
    if(pig){for(const x of [-.2,.2])rod([x,1.08,.86],[x*1.3,1.22,1],.025,cream,.008);for(let i=0;i<7;i++)rod([0,1.06,-.45+i*.12],[0,1.28,-.45+i*.12],.035,dark,.005);}
    if(tapir)rod([0,1.12,.89],[0,.93,1.07],.10,coat,.05);
    if(tall){blob(0,1.3,.53,.13,.5,.13,cream);blob(0,.91,.03,.26,.13,.49,cream);}
  } else if(family==='cat' || family==='long') {
    const anteater=detail==='anteater', otter=detail==='otter', capy=detail==='capybara', mara=detail==='mara';
    const low=otter||detail==='porcupine', y=low?.33:.55;
    blob(0,y,0,.3,.3,anteater?.78:.62);
    for(const x of [-.22,.22])for(const z of [-.36,.36])rod([x,y-.05,z],[x,.07,z+(z>0?.07:-.07)],low?.07:.085);
    blob(0,y+.2,.59,.25,.24,.26);
    if(anteater){rod([0,y+.18,.73],[0,y-.04,1.24],.12,coat,.035);blob(0,y+.12,-.9,.28,.32,.46);cube(0,y+.1,-.15,.58,.45,.22,dark);}
    else {blob(0,y+.08,.79,.22,.14,capy?.22:.16,capy?coat:cream);blob(0,y+.1,.91,.08,.065,.045,dark);}
    eye(-.16,y+.27,.853);eye(.16,y+.27,.853);
    ears(y+.5,.6,detail==='fox'||mara);
    if(!capy && !mara && detail!=='porcupine' && !anteater){rod([0,y,-.54],[0,y+.05,-.96],.09);rod([0,y+.05,-.96],[.15,y+.18,-1.2],.06,detail==='wolf'||detail==='fox'?dark:coat,.035);}
    if(detail==='wolf') {blob(0,y+.16,.34,.34,.28,.26,cream);}
    if(otter){blob(0,y+.07,.76,.2,.08,.15,cream);for(const sign of [-1,1])for(let i=0;i<3;i++)rod([sign*.14,y+.15,.85],[sign*.35,y+.12+i*.03,.92],.007,cream);}
    if(mara){blob(0,.43,-.35,.26,.37,.27);blob(0,.3,-.4,.27,.15,.19,cream);}
    if(detail==='porcupine')for(let i=0;i<26;i++){
      const a=i*2.4,z=-.42+(i%7)*.13;
      const start=[Math.cos(a)*.22,y+.16,z],end=[Math.cos(a)*.5,y+.45+(i%3)*.1,z-.35];
      rod(start,end,.017,cream,.007);
    }
  } else if(family==='primate' || family==='upright') {
    const wallaby=detail==='wallaby', meerkat=detail==='meerkat', gibbon=detail==='gibbon', spider=detail==='spider';
    const body=wallaby?.42:meerkat?.22:.34, y=.65;
    blob(0,y,0,body,.43,.25);
    blob(0,y+.015,.22,body*.62,.3,.055,meerkat||wallaby?cream:coat);
    for(const sign of [-1,1]) {
      rod([sign*.17,.38,0],[sign*.22,.1,.08],wallaby?.11:.09);
      blob(sign*.22,.08,.2,.12,.07,wallaby?.28:.14,dark);
      const long=gibbon||spider;
      rod([sign*body*.9,.88,.05],[sign*(long?.52:.43),long?.46:.58,.10],.075);
      rod([sign*(long?.52:.43),long?.46:.58,.10],[sign*(long?.6:.34),long?.1:.45,.24],.06);
      blob(sign*(long?.6:.34),long?.1:.45,.24,.08,.10,.065,dark);
    }
    blob(0,1.17,.04,.25,.27,.24);
    blob(0,1.15,.245,.20,.17,.06,detail==='chimp'?pink:cream);
    blob(0,1.09,.32,.065,.04,.035,dark);
    ears(1.4,.02,wallaby,coat);
    if(detail==='mandrill'){blob(0,1.14,.31,.07,.14,.04,'#d65041');for(const sign of [-1,1])blob(sign*.12,1.14,.29,.055,.14,.06,'#658dac');blob(0,1.0,.28,.14,.06,.06,'#d4bd62');}
    if(spider)blob(0,1.16,.285,.16,.12,.05,'#c4776c');
    if(gibbon)for(const sign of [-1,1])blob(sign*.18,1.18,.23,.05,.15,.045,'#edb669');
    if(detail==='macaque')rod([0,1.37,.0],[0,1.63,-.08],.12,dark,.015);
    if(['ringtail','ruffed','spider','wallaby','meerkat'].includes(detail)) {
      const points=wallaby?[[0,.43,-.1],[0,.17,-.65],[0,.06,-1.1]]:[[0,.5,-.15],[.14,.62,-.57],[.25,1.04,-.75],[.24,1.49,-.7]];
      for(let i=1;i<points.length;i++) {
        if(detail==='ringtail')for(let j=0;j<5;j++){
          const a=new T.Vector3(...points[i-1]),b=new T.Vector3(...points[i]);
          rod(a.clone().lerp(b,j/5).toArray(),a.clone().lerp(b,(j+1)/5).toArray(),.07,j%2?cream:dark);
        }else rod(points[i-1],points[i],wallaby?.11:.065,detail==='ruffed'?dark:coat,.045);
      }
    }
    if(detail==='ruffed'){blob(0,.96,.09,.33,.15,.27,dark);blob(0,1.16,.1,.2,.23,.25,dark);}
    const faceZ=['ruffed','mandrill'].includes(detail)?.353:spider?.338:.308;
    eye(-.085,1.22,faceZ);eye(.085,1.22,faceZ);
    if(meerkat)for(const sign of [-1,1])blob(sign*.085,1.22,.28,.08,.07,.03,dark);
  } else if(family==='bird') {
    const pelican=detail==='pelican', vulture=detail==='vulture', lapwing=detail==='lapwing', cassowary=detail==='cassowary';
    const y=pelican||vulture?.5:.75, neck=lapwing?.18:pelican?.35:.5;
    blob(0,y,0,.29,.34,.43);
    for(const sign of [-1,1]){
      rod([sign*.14,y-.16,0],[sign*.14,.08,.05],.027,detail==='crane'?'#48515b':'#b79062');
      for(const dx of [-.09,0,.09])rod([sign*.14,.05,.02],[sign*.14+dx,.04,.22],.016,'#b79062');
      blob(sign*.23,y+.03,-.08,.08,.27,.34,vulture?'#554636':cassowary?dark:coat);
    }
    const neckColour=cassowary?'#4576b7':vulture?cream:coat;
    rod([0,y+.17,.19],[0,y+neck,.32],.08,neckColour);
    blob(0,y+neck+.09,.36,.16,.16,.18,neckColour);
    const beakLength=pelican?.6:detail==='spoonbill'?.48:.25;
    rod([0,y+neck+.05,.48],[0,y+neck+.02,.48+beakLength],pelican?.065:.032,pelican?'#e6b74c':dark,.016);
    if(pelican)blob(0,y+neck-.03,.77,.12,.12,.25,'#dda150');
    if(detail==='spoonbill')blob(0,y+neck+.02,.94,.075,.024,.11,dark);
    for(const sign of [-1,1])eye(sign*.10,y+neck+.12,.543);
    rod([0,y,-.28],[0,y+.13,-.6],.11,lapwing?cream:dark,.02);
    if(['crane','red-crane'].includes(detail)){blob(0,y+neck+.23,.32,.09,.035,.09,'#c8433a');blob(0,y+.12,-.31,.22,.23,.19,dark);}
    if(cassowary){blob(0,y+neck+.31,.3,.095,.17,.1,'#b99770');for(const sign of [-1,1])rod([sign*.05,y+neck-.04,.4],[sign*.055,y+neck-.23,.4],.045,'#d54d4a',.02);}
    if(lapwing){blob(0,y-.11,.19,.22,.15,.16,cream);rod([0,y+neck+.23,.26],[.03,y+neck+.44,.05],.018,dark,.005);}
    if(detail==='screamer')for(let i=0;i<5;i++)rod([0,y+neck+.2,.29],[(i-2)*.04,y+neck+.32,.12],.012,dark,.005);
    if(vulture)blob(0,y+.32,.2,.2,.14,.16,cream);
  }
  const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(),mesh=doc.createMesh(detail);
  doc.getRoot().setDefaultScene(scene);
  const positions=[],normals=[],colors=[];
  for(const {g,c} of parts) {
    const color=new T.Color(c), p=g.getAttribute('position'),n=g.getAttribute('normal');
    positions.push(...p.array);normals.push(...n.array);
    for(let i=0;i<p.count;i++)colors.push(color.r,color.g,color.b);
    g.dispose();
  }
  const accessor=(name,data)=>doc.createAccessor(name).setType('VEC3').setArray(Float32Array.from(data)).setBuffer(buffer);
  mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION',accessor('position',positions))
    .setAttribute('NORMAL',accessor('normal',normals)).setAttribute('COLOR_0',accessor('coat',colors))
    .setMaterial(doc.createMaterial('original-animal-colours').setMetallicFactor(0).setRoughnessFactor(.95)));
  scene.addChild(doc.createNode(detail).setMesh(mesh));await MeshoptEncoder.ready;
  await doc.transform(weld(),meshopt({encoder:MeshoptEncoder,level:'medium'}));
  await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder}).write(file,doc);
  return {triangles:positions.length/9, generator:'scripts/artis-original-animals.mjs', detail};
}
