import { bridgeLngLat, bridgeLocalPoint, bridgeSurfaceAt, bridgeVehiclePoseAt, insideBridgeOutline, validateBridgeSurfaceFile, type BridgeSurface } from './bridgeSurface.ts';
import { buildBridgeGeometry } from './bridgeGeometry.ts';

const { THREE } = window.CanalRecallThree;
export class BridgeSurfaces {
  ready=false; enabled=true; bridges:BridgeSurface[]=[]; meshes:any[]=[]; generation=0;
  debugPaints=0; debugTriangles=0; debugGeometryBytes=0;
  private scene=new THREE.Scene(); private renderer:any; private camera:any;
  private controller:AbortController|null=null;
  private filters=new Map<string,any>();
  private move=()=>this.syncBasemap();
  private sourceData=()=>this.syncBasemap();
  private areaHidden=new Map<string,Set<number|string>>();
  private areaLastScan=0;
  private activeIds=new Set<string>();
  private cached=new Map<string,any[]>();
  layer:any;
  constructor(private map:any,private maplibregl:any) {
    this.scene.add(new THREE.HemisphereLight(0xfff7e9,0x596052,2));
    const sun=new THREE.DirectionalLight(0xffeed7,1.8);sun.position.set(-2,-1,4);this.scene.add(sun);
    this.layer={id:'measured-bridge-surfaces',type:'custom',renderingMode:'3d',
      onAdd:(_map:any,gl:any)=>{this.camera=new THREE.Camera();this.renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});this.renderer.autoClear=false;},
      onRemove:()=>{this.dispose();this.renderer?.dispose();},
      render:(_gl:any,args:any)=>{
        if(!this.enabled||!this.ready||map.getZoom()<15)return;
        const origin=maplibregl.MercatorCoordinate.fromLngLat([4.885,52.375],0),scale=origin.meterInMercatorCoordinateUnits();
        const transform=new THREE.Matrix4().makeTranslation(origin.x,origin.y,origin.z).scale(new THREE.Vector3(scale,-scale,scale));
        this.camera.projectionMatrix.fromArray(args.defaultProjectionData?.mainMatrix||args).multiply(transform);
        const bounds=map.getBounds();
        for(const mesh of this.meshes){const b=mesh.userData.bounds;mesh.visible=this.activeIds.has(mesh.userData.bridgeId)&&b[0]<=bounds.getEast()&&b[2]>=bounds.getWest()&&b[1]<=bounds.getNorth()&&b[3]>=bounds.getSouth();}
        this.renderer.resetState();this.renderer.render(this.scene,this.camera);this.debugPaints++;
      }};
    map.addLayer(this.layer);
    map.on('moveend',this.move);
    map.on('sourcedata',this.sourceData);
  }
  async load(root:string) {
    const generation=++this.generation;this.controller?.abort();this.clear();this.ready=false;this.bridges=[];this.syncBasemap();
    if(!root.replace(/\/$/,'').endsWith('/amsterdam'))return;
    const controller=new AbortController();this.controller=controller;
    try {
      const response=await fetch(`${root}/bridge-surfaces.json`,{signal:controller.signal});
      if(!response.ok)throw Error('HTTP '+response.status);
      const value=await response.json();validateBridgeSurfaceFile(value);
      if(generation!==this.generation||controller.signal.aborted)return;
      this.bridges=value.bridges;this.ready=true;this.syncBasemap();this.map.triggerRepaint();
    }catch(error:any){if(error.name!=='AbortError')console.warn('Bridge pilot unavailable; retaining flat roads.',error);}
  }
  sample(lngLat:[number,number],angle=0,contacts?:[number,number]) {
    const bridges=this.enabled&&this.ready&&this.map.getZoom()>=15?this.bridges.filter(b=>this.activeIds.has(b.id)):[];
    return contacts?bridgeVehiclePoseAt(bridges,lngLat,angle,contacts):bridgeSurfaceAt(bridges,lngLat,angle);
  }
  setEnabled(enabled:boolean){this.enabled=enabled;this.syncBasemap();this.map.triggerRepaint();}
  private syncBasemap() {
    const active=this.enabled&&this.ready&&this.map.getZoom()>=15;
    if(!active){for(const[id,filter]of this.filters)if(this.map.getLayer(id))this.map.setFilter(id,filter);this.filters.clear();this.areaHidden.clear();this.areaLastScan=0;return;}
    this.updateMeshSet();
    if(!this.activeIds.size)return;
    if(this.filters.size){this.syncBasemapAreas();return;}
    // Only fully contained basemap bridge lines are replaced. Other roads, water,
    // nearby bridges and low-zoom fallback remain owned by the basemap.
    const coordinates=this.bridges.filter(b=>this.activeIds.has(b.id)).map(b=>{
      const axis=b.deckAxis,half=Math.max(Math.abs(b.deckAcrossM[0]),Math.abs(b.deckAcrossM[1]))+3;
      const start=b.roadwayRangeM[0]-24-4,end=b.roadwayRangeM[1]-24+4;
      const point=(s:number,t:number)=>bridgeLngLat(b,[axis[0]*s-axis[1]*t,axis[1]*s+axis[0]*t]);
      const ring=[point(start,-half),point(end,-half),point(end,half),point(start,half)];
      return[[...ring,ring[0]]];
    });
    const mask={type:'MultiPolygon',coordinates};
    for(const layer of this.map.getStyle().layers||[]){
      if(layer.type!=='line'||layer['source-layer']!=='transportation'||!/^bridge_/.test(layer.id))continue;
      if(!this.filters.has(layer.id))this.filters.set(layer.id,this.map.getFilter(layer.id)||null);
      const original=this.filters.get(layer.id);
      this.map.setFilter(layer.id,['all',original||true,['!', ['within',mask]]]);
    }
    this.syncBasemapAreas();
  }
  private syncBasemapAreas() {
    const now=performance.now();if(now-this.areaLastScan<500)return;this.areaLastScan=now;
    const bounds=this.map.getBounds();
    if(!this.bridges.some(b=>b.origin[0]>bounds.getWest()-.001&&b.origin[0]<bounds.getEast()+.001&&
      b.origin[1]>bounds.getSouth()-.001&&b.origin[1]<bounds.getNorth()+.001))return;
    // Transportation polygons use a patterned fill under the old deck. `within`
    // only handles points/lines, so replace exact polygon identities after a
    // bounded geographic match; preserve every neighboring bridge polygon.
    for(const layer of this.map.getStyle().layers||[]){
      if(layer.type!=='fill'||layer['source-layer']!=='transportation')continue;
      const hidden=this.areaHidden.get(layer.id)||new Set<number|string>();let changed=false;
      for(const feature of this.map.querySourceFeatures(layer.source,{sourceLayer:'transportation'})){
        if(feature.id==null||hidden.has(feature.id)||!['Polygon','MultiPolygon'].includes(feature.geometry.type)||
          !(feature.properties?.class==='bridge'||feature.properties?.brunnel==='bridge'))continue;
        const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
        const match=this.bridges.filter(b=>this.activeIds.has(b.id)).some(b=>polygons.some((polygon:number[][][])=>{
          const ring=polygon[0].map(p=>bridgeLocalPoint(b,[p[0],p[1]]));
          const center: [number,number]=[b.deckAxis[0]*((b.deckRangeM[0]+b.deckRangeM[1])/2-24),
            b.deckAxis[1]*((b.deckRangeM[0]+b.deckRangeM[1])/2-24)];
          if(!insideBridgeOutline(center,ring))return false;
          return ring.every(p=>{const s=24+p[0]*b.deckAxis[0]+p[1]*b.deckAxis[1],t=-p[0]*b.deckAxis[1]+p[1]*b.deckAxis[0];
            return s>b.roadwayRangeM[0]-8&&s<b.roadwayRangeM[1]+8&&t>b.deckAcrossM[0]-4&&t<b.deckAcrossM[1]+4;});
        }));
        if(match){hidden.add(feature.id);changed=true;}
      }
      if(!changed)continue;
      if(!this.filters.has(layer.id))this.filters.set(layer.id,this.map.getFilter(layer.id)||null);
      this.areaHidden.set(layer.id,hidden);
      this.map.setFilter(layer.id,['all',this.filters.get(layer.id)||true,['!', ['in',['id'],['literal',[...hidden]]]]]);
    }
  }
  private updateMeshSet() {
    const bounds=this.map.getBounds(),center=this.map.getCenter();
    const nearby=this.bridges.filter(b=>b.origin[0]>bounds.getWest()-.0006&&b.origin[0]<bounds.getEast()+.0006&&
      b.origin[1]>bounds.getSouth()-.0006&&b.origin[1]<bounds.getNorth()+.0006)
      .sort((a,b)=>Math.hypot((a.origin[0]-center.lng)*.61,a.origin[1]-center.lat)-Math.hypot((b.origin[0]-center.lng)*.61,b.origin[1]-center.lat));
    const selected:BridgeSurface[]=[];let triangles=0;
    for(const b of nearby){const cost=(b as any).review?.triangles||15000;if(selected.length>=12||triangles+cost>150000)break;selected.push(b);triangles+=cost;}
    const ids=new Set(selected.map(b=>b.id));
    if(ids.size===this.activeIds.size&&[...ids].every(id=>this.activeIds.has(id)))return;
    this.activeIds=ids;
    // Restore old identities before replacing a different set of bridges.
    for(const[id,filter]of this.filters)if(this.map.getLayer(id))this.map.setFilter(id,filter);
    this.filters.clear();this.areaHidden.clear();this.areaLastScan=0;
    for(const bridge of selected)if(!this.cached.has(bridge.id))this.createMeshes([bridge]);
    // Keep a bounded LRU of nearby meshes, disposing GPU buffers on eviction.
    for(const id of ids){const meshes=this.cached.get(id)!;this.cached.delete(id);this.cached.set(id,meshes);}
    for(const[id,meshes]of this.cached) {
      if(this.cached.size<=24&&this.debugGeometryBytes<=16000000)break;
      if(ids.has(id))continue;
      for(const mesh of meshes){this.scene.remove(mesh);this.debugTriangles-=mesh.userData.triangles;this.debugGeometryBytes-=mesh.userData.bytes;mesh.geometry.dispose();mesh.material.dispose();}
      this.cached.delete(id);
    }
    this.meshes=[...this.cached.values()].flat();
  }
  private createMeshes(bridges:BridgeSurface[]) {
    const origin=this.maplibregl.MercatorCoordinate.fromLngLat([4.885,52.375],0),scale=origin.meterInMercatorCoordinateUnits();
    for(const bridge of bridges) {
      const created:any[]=[];
      const triangulate=(ring:[number,number][])=>THREE.ShapeUtils.triangulateShape(ring.map(p=>new THREE.Vector2(...p)),[]);
      const batches=buildBridgeGeometry(bridge,triangulate);
      const outline=bridge.outline.map(p=>bridgeLngLat(bridge,p));
      const bounds=[Math.min(...outline.map(p=>p[0]))-.0006,Math.min(...outline.map(p=>p[1]))-.0004,
        Math.max(...outline.map(p=>p[0]))+.0006,Math.max(...outline.map(p=>p[1]))+.0004];
      for(const batch of batches) {
        const positions=[];
        for(let i=0;i<batch.positions.length;i+=3){
          const ll=bridgeLngLat(bridge,[batch.positions[i],batch.positions[i+1]]);
          const coordinate=this.maplibregl.MercatorCoordinate.fromLngLat(ll,batch.positions[i+2]);
          positions.push((coordinate.x-origin.x)/scale,-(coordinate.y-origin.y)/scale,(coordinate.z-origin.z)/scale);
        }
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
        geometry.setIndex(batch.indices);if(batch.normals)geometry.setAttribute('normal',new THREE.Float32BufferAttribute(batch.normals,3));else geometry.computeVertexNormals();geometry.computeBoundingSphere();
        const material=new THREE.MeshStandardMaterial({color:batch.colour,roughness:.9,metalness:batch.kind==='railings'?.2:0,side:THREE.DoubleSide});
        const mesh=new THREE.Mesh(geometry,material);mesh.name=`bridge-${bridge.id}-${batch.kind}`;mesh.userData.bounds=bounds;
        mesh.userData.bridgeId=bridge.id;mesh.userData.triangles=batch.indices.length/3;mesh.userData.bytes=positions.length*8+geometry.index.array.byteLength;
        this.scene.add(mesh);created.push(mesh);this.debugTriangles+=mesh.userData.triangles;
        this.debugGeometryBytes+=mesh.userData.bytes;
      }
      this.cached.set(bridge.id,created);
    }
  }
  private clear(){for(const mesh of this.meshes){this.scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}this.meshes=[];this.cached.clear();this.activeIds.clear();this.debugTriangles=0;this.debugGeometryBytes=0;}
  dispose(){this.generation++;this.controller?.abort();this.clear();this.bridges=[];this.ready=false;this.syncBasemap();this.map.off('moveend',this.move);this.map.off('sourcedata',this.sourceData);}
}
declare global { interface Window { CanalRecallBridgeSurfaces?: { BridgeSurfaces:typeof BridgeSurfaces } } }
window.CanalRecallBridgeSurfaces={BridgeSurfaces};
