"""Derive the report figure-19 linkage mapping from the carbon arch and roller.

Run with tmp/arm-limit-env/Scripts/python.exe (numpy, shapely, scipy, pillow).
The original exported source meshes remain read-only.
"""
import ast
import hashlib
import json
import math
import pathlib
import struct
from collections import deque

import numpy as np
import shapely
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import unary_union, polygonize, nearest_points
from shapely import affinity
from scipy.ndimage import binary_dilation, binary_closing

root=pathlib.Path(__file__).resolve().parents[1]
inputs=root/'materials/models/derived/inputs/linked-limit'
out=root/'materials/models/derived/web'
tree=ast.parse((root/'scripts/build-arm-parts.py').read_text('utf8'))
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='Cad'],type_ignores=[]),'Cad','exec'))
cad=Cad('arm',root/'materials/models/derived/inputs/codex/arm_tagged.glb')
triangles=[]
plate_mesh=cad.data['meshes'][cad.data['nodes'][370]['mesh']]
with cad.path.open('rb') as stream:
    for primitive in plate_mesh['primitives']:
        v=cad.accessor(primitive['attributes']['POSITION'],stream)
        world=(np.c_[v,np.ones(len(v))]@cad.matrix(370).T)[:,:3]
        faces=cad.accessor(primitive['indices'],stream).reshape(-1,3)
        triangles.extend(world[faces])
triangles=np.array(triangles)
mesh=cad.data['meshes'][cad.data['nodes'][311]['mesh']]
with cad.path.open('rb') as stream:
    local=np.concatenate([cad.accessor(p['attributes']['POSITION'],stream) for p in mesh['primitives']])
roller=(np.c_[local,np.ones(len(local))]@cad.matrix(311).T)[:,:3]
roller_center=(roller.min(0)+roller.max(0))/2
radial=np.linalg.norm(roller[:,1:]-roller_center[1:],axis=1)
radius=float(radial.max());outer=roller[radial>radius*.985]
x_range=[float(outer[:,0].min()),float(outer[:,0].max())]

def clip_x(poly,bound,greater):
    result=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        ina=(a[0]>=bound) if greater else (a[0]<=bound)
        inb=(b[0]>=bound) if greater else (b[0]<=bound)
        if ina:result.append(a)
        if ina!=inb:result.append(a+(b-a)*((bound-a[0])/(b[0]-a[0])))
    return result

sections=[]
for tri in triangles:
    poly=clip_x(list(tri),x_range[0],True)
    if poly:poly=clip_x(poly,x_range[1],False)
    if len(poly)<3:continue
    polygon=Polygon(np.array(poly)[:,1:])
    if polygon.area>1e-12:sections.append(polygon)
profile=unary_union(sections).buffer(0)
assert not profile.is_empty,'Plate does not overlap the actual roller bearing width.'

meta=json.loads((out/'arm-parts.json').read_text('utf8'))
motion=meta['motion'];A=np.array(motion['joints'][1]['point_m'])[1:];E=np.array(motion['joints'][2]['point_m'])[1:];U=np.array(motion['uwb_point_m'])[1:]
J6=motion['joints'][5];axis=np.array(J6['axis']);axis/=np.linalg.norm(axis)
tcp=np.array(J6['point_m'])+axis*.0705

def rotate(vec,degrees):
    a=np.deg2rad(degrees);c,s=np.cos(a),np.sin(a)
    return np.stack((c*vec[0]-s*vec[1],s*vec[0]+c*vec[1]),axis=-1)

def relative_center(q2,q3):return U+rotate(E-U,q2)+rotate(roller_center[1:]-E,q2+q3)
def clearance(q2,q3):
    p=Point(relative_center(q2,q3));d=profile.distance(p)
    return (-d if profile.contains(p) else d)-radius

# Find the first real contact encountered from the source pose, not an arbitrary angle.
demo_q2=30.
assert clearance(demo_q2,0)>0
contacts=[]
for direction in (1,-1):
    previous=0.
    for angle in np.arange(.25,180.001,.25)*direction:
        if clearance(demo_q2,float(angle))<=0:
            lo,hi=previous,float(angle)
            for _ in range(35):
                mid=(lo+hi)/2
                if clearance(demo_q2,mid)>0:lo=mid
                else:hi=mid
            contacts.append((abs(lo),lo));break
        previous=float(angle)
assert contacts,'No reachable plate/roller contact found in the scan.'
contact_q3=min(contacts)[1]
contact=nearest_points(Point(relative_center(demo_q2,contact_q3)),profile)[1]

q2=np.arange(-180,180.001,.5);q3=np.arange(-180,180.001,.5)
Q2,Q3=np.meshgrid(q2,q3,indexing='ij')
centers=relative_center(Q2,Q3)
points=shapely.points(centers.reshape(-1,2))
distance=shapely.distance(profile,points).reshape(Q2.shape)
blocked=(distance<=radius)|shapely.contains(profile,points).reshape(Q2.shape)
seed=(int(np.argmin(abs(q2))),int(np.argmin(abs(q3))))
assert not blocked[seed],'Source design pose is blocked by the recovered plate.'
connected=np.zeros_like(blocked);connected[seed]=True;queue=deque([seed])
while queue:
    i,j=queue.popleft()
    for a,b in ((i-1,j),(i+1,j),(i,j-1),(i,j+1)):
        if 0<=a<len(q2) and 0<=b<len(q3) and not blocked[a,b] and not connected[a,b]:connected[a,b]=True;queue.append((a,b))
workspace=A+rotate(E-A,Q2)+rotate(tcp[1:]-E,Q2+Q3)
resolution=.003;origin=np.floor(workspace.reshape(-1,2).min(0)/resolution)*resolution-.012
indices=np.rint((workspace-origin)/resolution).astype(int)
shape=tuple(indices.reshape(-1,2).max(0)+6)

def region(valid):
    mask=np.zeros(shape,dtype=bool);cells=indices[valid];mask[cells[:,0],cells[:,1]]=True
    yy,xx=np.ogrid[-2:3,-2:3];mask=binary_dilation(mask,structure=xx*xx+yy*yy<=4);mask=binary_closing(mask)
    edges=[]
    for dy,dz,edge in [(-1,0,((0,0),(0,1))),(1,0,((1,1),(1,0))),(0,-1,((1,0),(0,0))),(0,1,((0,1),(1,1)))]:
        neighbor=np.zeros_like(mask)
        ys=slice(max(0,-dy),min(shape[0],shape[0]-dy));zs=slice(max(0,-dz),min(shape[1],shape[1]-dz))
        neighbor[ys,zs]=mask[slice(max(0,dy),min(shape[0],shape[0]+dy)),slice(max(0,dz),min(shape[1],shape[1]+dz))]
        for cell in np.argwhere(mask&~neighbor):edges.append(LineString([(origin+(cell+corner)*resolution).tolist() for corner in edge]))
    polygons=[]
    for p in polygonize(edges):
        test=np.floor((np.array(p.representative_point().coords[0])-origin)/resolution).astype(int)
        if (test>=0).all() and (test<shape).all() and mask[tuple(test)]:polygons.append(p)
    return unary_union(polygons).simplify(.002,preserve_topology=True)

def polygons(geometry):
    pieces=list(geometry.geoms) if geometry.geom_type=='MultiPolygon' else [geometry]
    return [{'outer':np.round(p.exterior.coords,6).tolist(),'holes':[np.round(h.coords,6).tolist() for h in p.interiors]} for p in pieces if p.area>1e-6]

baseline=region(np.ones_like(connected));limited=region(connected)
samples=[]
for i in range(0,len(q2),40):
    allowed=np.flatnonzero(connected[i])
    if not len(allowed):continue
    for j in (allowed[0],allowed[-1]):samples.append({'angles':[0,0,float(q2[i]),float(q3[j]),0,0,0],'tcp':[float(tcp[0]),*workspace[i,j].tolist()]})
scale=float(np.linalg.norm((E-U))/np.linalg.norm(E-A))
wrist=np.array(motion['joints'][4]['point_m'])
# The report's two-link construction ends at the wrist centre. The cup TCP adds
# an orientation-dependent 70.5 mm extension and is not an exact homothety.
similarity={'scale':scale,'large_points':[motion['joints'][1]['point_m'],motion['joints'][2]['point_m'],wrist.tolist()],
            'small_points':[[float(np.mean(x_range)),*U],[float(np.mean(x_range)),*E],roller_center.tolist()],
            'small_radius_m':float(np.linalg.norm(E-U)+np.linalg.norm(roller_center[1:]-E)),
            'distal_scale':float(np.linalg.norm(roller_center[1:]-E)/np.linalg.norm(wrist[1:]-E)),
            'meaning':'Report section 2.6, figure 19: similar large/small linkages. CAD arm lengths give near-equal ratios; the suction cup extends beyond the wrist construction.'}
reach=similarity['small_radius_m'];inner=abs(np.linalg.norm(E-U)-np.linalg.norm(roller_center[1:]-E))
small_baseline=Point(U).buffer(reach,quad_segs=128).difference(Point(U).buffer(inner,quad_segs=64))
small_limited=small_baseline.difference(profile.buffer(radius,quad_segs=24))
if small_limited.geom_type=='MultiPolygon':
    small_limited=next(p for p in small_limited.geoms if p.distance(Point(roller_center[1:]))<1e-6)
def mapped_region(region):return affinity.translate(affinity.scale(region,xfact=1/scale,yfact=1/scale,origin=tuple(U)),xoff=A[0]-U[0],yoff=A[1]-U[1])
data={'schema_version':2,'frame':'source arm CAD, metres','plate_source_sha256':hashlib.sha256(cad.path.read_bytes()).hexdigest(),
      'plate_asset':'arm','plate_index':370,'roller_source':{'asset':'arm','index':311,'center_m':roller_center.tolist(),'radius_m':radius,'outer_width_x_m':x_range},
      'profile':polygons(profile),'tcp':{'definition':'Suction-cup working-face centre, shared with chapter A','offset_m':.0705,'point_m':tcp.tolist()},
      'similarity':similarity,
      'scan':{'q2_deg':[-180,180],'q3_deg':[-180,180],'step_deg':.5,'raster_m':resolution,'fixed_angles':[0,0,0,0,0],
              'meaning':'Declared geometry scan intervals, not calibrated joint limits. Other axes fixed; plate/roller constraint only; no whole-robot collision certification.',
              'samples':int(connected.size),'blocked_samples':int(blocked.sum()),'connected_samples':int(connected.sum())},
      'demo':{'q2_deg':demo_q2,'q3_contact_deg':contact_q3,'contact_point_m':[float(np.mean(x_range)),*contact.coords[0]],'clearance_m':clearance(demo_q2,contact_q3)},
      'regions':{'baseline':polygons(mapped_region(small_baseline)),'limited':polygons(mapped_region(small_limited))},
      'small_regions':{'baseline':polygons(small_baseline),'limited':polygons(small_limited)},
      'cup_regions':{'baseline':polygons(baseline),'limited':polygons(limited)},'boundary_poses':samples,
      'method':'Report figure 19 and source arm:370 arch-shaped carbon plate. True section over the roller outer-bearing width; circular bearing/profile distance; source-connected configuration component. Similar-link construction plus separate sampled cup TCP region.'}
(out/'arm-linked-limit.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
print(json.dumps({'plate_triangles':len(triangles),'profile_area_m2':profile.area,'roller_radius_m':radius,'demo':data['demo'],'scan':data['scan'],'baseline_area_m2':baseline.area,'limited_area_m2':limited.area,'bytes':(out/'arm-linked-limit.json').stat().st_size},ensure_ascii=False),flush=True)
