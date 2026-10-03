import type {BuildingTools} from './cultural-builders';

/** Original harbour housing model. MVRDV's ten-storey block is a collage of
 * apartments, not repeating identical floors. OSM includes the projecting
 * public deck in the footprint, so the housing takes only its western half. */
export function buildSilodam(w:number,d:number,{box}:BuildingTools){
 const depth=d*.50,z=d*.245,height=29;
 box(0,2,z,w*.98,height-2,depth,'stone');
 const skins=['gold','red','white','blue','stone','frame','brick','dark'] as const;
 const patches=[
  [-.50,-.20,2,7,'gold'],[-.20,.13,2,9,'red'],[.13,.50,2,6,'stone'],
  [-.50,-.32,9,9,'white'],[-.32,-.07,11,8,'blue'],[-.07,.22,9,8,'frame'],[.22,.50,8,11,'white'],
  [-.50,-.17,18,7,'brick'],[-.17,.09,17,8,'white'],[.09,.30,19,6,'dark'],[.30,.50,19,7,'red'],
  [-.50,-.15,25,4,'stone'],[-.15,.20,25,4,'gold'],[.20,.50,26,3,'frame'],
 ] as const;
 for(const side of [-1,1])for(const [left,right,y,h,colour] of patches){
  const x=(left+right)*w/2,width=(right-left)*w;
  box(x,y,z+side*(depth/2+.07),width-.12,h,.18,colour);
  // Corrugated coloured cladding alternates with smooth plaster and glazing.
  if(colour==='gold'||colour==='red'||colour==='frame')for(let u=left*w+.3;u<right*w;u+=.9)box(u,y,z+side*(depth/2+.2),.075,h,.08,colour);
  const double=colour==='white'||colour==='blue';const step=double?3.8:4.6;
  for(let v=y+1;v<y+h-1;v+=3.1)for(let u=left*w+step*.55;u<right*w-step*.35;u+=step){
   box(u,v-.1,z+side*(depth/2+.22),double?2.75:2.2,double?2.25:1.6,.17,'white');
   box(u,v,z+side*(depth/2+.32),double?2.45:1.9,double?2.0:1.35,.1,'glass');
   box(u,v,z+side*(depth/2+.4),.1,double?2.0:1.35,.08,'white');
  }
 }
 // Short ends have their own horizontal apartment bands and a glazed gallery.
 for(const side of [-1,1])for(let floor=0;floor<10;floor++){
  const y=2+floor*2.7,colour=skins[(floor+(side>0?2:0))%skins.length];
  box(side*w*.497,y,z,.16,2.65,depth,colour);
  for(let u=-depth*.37;u<depth*.45;u+=3.4){box(side*w*.5,y+.65,z+u,.17,1.8,2.5,'white');box(side*w*.504,y+.77,z+u,.14,1.55,2.25,'glass');}
 }
 box(0,height,z,w, .25,depth+.4,'slate');
 // Piles leave water visible under the floating-looking orange base.
 for(let x=-w*.47;x<w*.5;x+=6)for(let u of [-depth*.41,depth*.41])box(x,0,z+u,.65,2,.65,'stone');
 const deckLength=w*.49,deckZ=-d*.25;
 box(w*.08,3,deckZ,deckLength,.35,d*.49,'frame');
 for(let x=-deckLength*.43;x<=deckLength*.53;x+=3)for(let u of [-d*.48,-d*.02])box(x+w*.08,0,u,.35,3,.35,'frame');
 // A low restaurant/office volume occupies only part of the projecting deck.
 box(w*.08,3.35,deckZ,deckLength*.79,3.65,d*.28,'glass');box(w*.08,7,deckZ,deckLength,.25,d*.49,'white');
 for(let x=-deckLength*.3;x<=deckLength*.46;x+=3)box(x+w*.08,3.35,deckZ-d*.145,.16,3.65,.18,'white');
 for(let u of [-d*.49,-d*.015]){box(w*.08,8, u,deckLength,.10,.12,'frame');for(let x=-deckLength*.45;x<=deckLength*.55;x+=2)box(x+w*.08,7.2,u,.1,.8,.1,'frame');}
}
