"""Observed roof glazing: source aerial scope + native measured roof/rim geometry.
Original semantic/glass flags do not determine visible material or pane height.
"""
import json
from pathlib import Path
from shapely.geometry import Polygon
from shapely.ops import unary_union
p=Path('scripts/ordinary-buildings/keizers575-spec.json');s=json.loads(p.read_text());owner={r['surface']:r for r in s['roofs']if r['role']=='survey-roof-owner'}
s['roofGlazing']={'directSurveySurfaceIds':[229,222,215],'evidence':'OriginalPDOK2025rear80m source41 aerial: unmistakable central pitchedglassatrium withregularpale structuralgrid; western tallwhitegridskylight215 andpaired darkXbracedwellcanopies. Crosschecked2023/2026 aerial; original roof/source polygons define scope. No sourcepixels imported.','sourcePack':'experiments/canal-belt-continuation-20261007/keizers575-rear-source41','sourceCommit':'24ce200c6','sourceFile':'raw/pdok-2025-rear-80m.jpg','datasetFlagPolicy':'b3_is_glass is not material authority; photo overrides retained explicitly.','directHeightConfidence':'High:229/222 mainpitched glass and215skylight panes use source planes/native clipped rings.','inferredCanopyHeightConfidence':'Moderate: observedglass canopies above western lightwells; lower survey planes plausibly penetrating-glass interior returns. Canopy planes fitted to measured surrounding234rim; no opaque cap or garden fill.','canopies':[]}
for label,ids in [('west-left-X',[213,212,219,209,207]),('west-right-X',[211,208,218,210,206])]:
 poly=unary_union([Polygon(owner[i]['ring'],owner[i]['holes'])for i in ids]).intersection(Polygon(s['nativeRing']))
 pieces=[poly]if poly.geom_type=='Polygon'else list(poly.geoms)
 for idx,r in enumerate(pieces):
  s['roofGlazing']['canopies'].append({'id':label+('-'+str(idx)if len(pieces)>1 else''),'sourceInteriorSurfaces':ids,'ring':[list(p)for p in r.exterior.coords[:-1]],'holes':[[list(p)for p in h.coords[:-1]]for h in r.interiors],'plane':owner[234]['plane'],'areaMetres2':r.area,'heightSource':'Original measuredsurrounding234rim plane, confined to observedcanopy footprint. Interior low roofowners retained beneath, not promoted to visible pane heights.','assembly':'Photo-observed perimeter frame, orthogonal pane divisions, two crossing diagonal braces. Pane counts/spacing approximate current aerial; footprint and supporting rim surveyed.'})
p.write_text(json.dumps(s,indent=2)+'\n');print(json.dumps({'canopies':[(c['id'],c['areaMetres2'])for c in s['roofGlazing']['canopies']],'directSurfaces':s['roofGlazing']['directSurveySurfaceIds']}))
# Original architectural frame grids clipped to observed source fields. Counts
# are photo-guided approximations, not extracted or pasted photograph pixels.
import math
from shapely.geometry import LineString,Point
from shapely import make_valid
anchor=s['nativeRing'][8];end=s['nativeRing'][13];L=math.dist(anchor,end);t=[(end[i]-anchor[i])/L for i in range(2)];n=[-t[1],t[0]]
def uv(q):return[(q[0]-anchor[0])*t[0]+(q[1]-anchor[1])*t[1],(q[0]-anchor[0])*n[0]+(q[1]-anchor[1])*n[1]]
def xy(q):return[anchor[0]+t[0]*q[0]+n[0]*q[1],anchor[1]+t[1]*q[0]+n[1]*q[1]]
def pieces(q):
 if q.is_empty:return[]
 if q.geom_type=='Polygon':return[q]
 return[p for g in getattr(q,'geoms',[])for p in pieces(g)]
def record(q):return{'ring':[xy(p)for p in list(q.exterior.coords)[:-1]],'holes':[[xy(p)for p in list(h.coords)[:-1]]for h in q.interiors]}
s['roofGlazing']['canopies']=[c for c in s['roofGlazing']['canopies']if c['areaMetres2']>1]
s['roofGlazing']['excludedDisconnectedInteriorPatchMetres2']=.8166010643481454
# West glass slope229 toe falls below the observed surrounding228rim.
# Preserve the raw laser fit as interior/provenance; bound visible glass between
# source228's measured high rim20.55m and original229 crest23.65m.
r=owner[229];low,high=r['sourceHeightRange'];toe=owner[228]['sourceHeightRange'][1];scale=(high-toe)/(high-low);visible229=[scale*r['plane'][0],scale*r['plane'][1],toe+scale*(r['plane'][2]-low)]
s['roofGlazing']['visibleProfileOverrides']=[{'surface':229,'plane':visible229,'originalPlane':r['plane'],'measuredRimSurface':228,'rimMetres':toe,'measuredCrestMetres':high,'confidence':'moderate','method':'Current aerial confirms glass footprint; raw16.68m toe lies beneath observed20.4m adjacent roof rim. Visible glass plane bounded by source228rim and source229crest; lower raw plane retained as interior-return/provenance, no duplicate top.'}]
s['roofGlazing']['directHeightConfidence']='High:222 and215pane planes direct survey. Surface229visible slope reconstructed from observedglazing footprint+measured228rim/229crest; moderateconfidence, rawlower fit nottopowner.'
fields=[{'id':'survey-'+str(i),'surface':i,'ring':owner[i]['ring'],'holes':owner[i]['holes'],'plane':visible229 if i==229 else owner[i]['plane'],'heightRole':'inferred visibleplane frommeasured228rim+229crest'if i==229 else'direct surveyed visibleglassplane'}for i in [229,222,215]]+[{**c,'heightRole':'observed aerialcanopy, inferred from measured234rim'}for c in s['roofGlazing']['canopies']]
s['roofGlazing']['assemblies']=[]
for f in fields:
 poly=Polygon([uv(q)for q in f['ring']],[[uv(q)for q in h]for h in f['holes']]);a,b,c,d=poly.bounds;rawframes=[poly.boundary.buffer(.055).intersection(poly)]
 for axis,pitch in [(0,.9),(1,1.02)]:
  lo,hi=(a,c)if axis==0 else(b,d)
  for k in range(math.ceil(lo/pitch),math.floor(hi/pitch)+1):
   coord=k*pitch;line=LineString([(coord,b-1),(coord,d+1)])if axis==0 else LineString([(a-1,coord),(c+1,coord)])
   rawframes.append(line.buffer(.025,cap_style='flat').intersection(poly))
 if f['id'].startswith('west-'):
  for ps in [[(a,b),(c,d)],[(a,d),(c,b)]]:rawframes.append(LineString(ps).buffer(.045,cap_style='flat').intersection(poly))
 frame=unary_union(rawframes);panes=poly.difference(frame);frameprobes=[];paneprobes=[]
 for q in pieces(panes):
  clear=q.buffer(-.09)
  if q.area>.15 and not clear.is_empty:
   p0=clear.representative_point();paneprobes.append(xy([p0.x,p0.y]))
 for q in rawframes:
  pp=max(pieces(q),key=lambda p:p.area)if pieces(q)else None
  if pp is not None and pp.area>.003:
   p0=pp.representative_point();frameprobes.append(xy([p0.x,p0.y]))
 s['roofGlazing']['assemblies'].append({**f,'frames':[record(q)for q in pieces(frame)if q.area>.00001],'paneProbes':paneprobes,'frameProbes':frameprobes,'gridPitchMetres':[.9,1.02],'boundaryFrameWidthMetres':.11,'mullionWidthMetres':.05,'westDiagonalBraceWidthMetres':.09})
p.write_text(json.dumps(s,indent=2)+'\n');print(json.dumps({'assemblies':[(f['id'],len(f['paneProbes']),len(f['frameProbes']))for f in s['roofGlazing']['assemblies']]}))
# LoD2 fitted flat polygons overlap the photo-established centralglass field.
# Those opaque caps must not first-hit in front of intended visible panes.
# Keep original survey owners/planes verbatim; subtract only their overlapping
# top footprint. This is a source-supported visible surface override.
glassScope=unary_union([Polygon(owner[i]['ring'],owner[i]['holes'])for i in [229,222]])
s['roofGlazing']['opaqueTopCutouts']=[]
for index,r in enumerate(s['roofs']):
 if r['surface']not in [228,230,236]:continue
 raw=Polygon(r['ring'],r['holes']);overlap=raw.intersection(glassScope)
 if overlap.area<.00001:continue
 remain=raw.difference(glassScope);fragments=[]
 for q in pieces(remain):
  if q.area>.00001:fragments.append({'ring':[list(p)for p in list(q.exterior.coords)[:-1]],'holes':[[list(p)for p in list(h.coords)[:-1]]for h in q.interiors]})
 s['roofGlazing']['opaqueTopCutouts'].append({'roofRecordIndex':index,'surface':r['surface'],'removedOpaqueOverlapMetres2':overlap.area,'fragments':fragments,'reason':'Originalaerial establishes continuouscentralglass field. Overlapping opaqueLoD2caps wouldbury observedglazing; rawowner/plane retained, remainingtopstillsurveyed.'})
p.write_text(json.dumps(s,indent=2)+'\n');print(json.dumps({'opaqueTopCutouts':[(r['surface'],r['removedOpaqueOverlapMetres2'])for r in s['roofGlazing']['opaqueTopCutouts']]}))
