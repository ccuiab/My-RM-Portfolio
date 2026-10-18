"""Read CAD link geometry into reusable prototypes and source-frame chain stations."""
import ast,hashlib,itertools,json,pathlib,struct
import numpy as np
root=pathlib.Path(__file__).resolve().parents[1]
tree=ast.parse((root/'scripts/build-arm-parts.py').read_text(encoding='utf8'))
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='Cad'],type_ignores=[]),'<Cad>','exec'))
out=root/'materials/models/derived/web'
meta=json.loads((out/'arm-parts.json').read_text(encoding='utf8'))
cad={a:Cad(a,root/f'materials/models/derived/inputs/codex/{a}_tagged.glb') for a in ('arm','engineer')}
engineer_to_arm=np.linalg.inv(cad['engineer'].matrix(477))
prototypes=[];lookup={};loops=[]
for p in meta['parts']:
 if '04C链节' not in p['node_name']:continue
 stations=[]
 for m in p['members']:
  c=cad[m['asset']];i=m['index'];verts=[];normals=[];faces=[]
  with c.path.open('rb') as stream:
   for prim in c.data['meshes'][c.data['nodes'][i]['mesh']]['primitives']:
    v=c.accessor(prim['attributes']['POSITION'],stream);f=c.accessor(prim['indices'],stream).reshape(-1,3)
    n=c.accessor(prim['attributes']['NORMAL'],stream) if 'NORMAL' in prim['attributes'] else np.zeros_like(v)
    faces.extend((f+len(verts)).tolist());verts.extend(v.tolist());normals.extend(n.tolist())
  signature=hashlib.sha256(np.array(verts,dtype='<f4').tobytes()+np.array(faces,dtype='<u4').tobytes()).hexdigest()
  if signature not in lookup:
   lookup[signature]=len(prototypes);prototypes.append({'positions':verts,'normals':normals,'indices':faces})
  matrix=(engineer_to_arm if m['asset']=='engineer' else np.eye(4))@c.matrix(i)
  centroid=(matrix@np.r_[np.mean(verts,axis=0),1])[:3]
  stations.append({'prototype':lookup[signature],'matrix':matrix.T.flatten().tolist(),'center':centroid.tolist(),'source':i})
 centers=np.array([s['center'] for s in stations]);mean=centers.mean(axis=0)
 flat=int(np.argmin(np.ptp(centers,axis=0)));axes=[i for i in range(3) if i!=flat]
 stations.sort(key=lambda s:np.arctan2(s['center'][axes[1]]-mean[axes[1]],s['center'][axes[0]]-mean[axes[0]]))
 drive=2 if m['asset']=='arm' else 1 if p['group']==1 else 0
 normal=np.cross(np.eye(3)[axes[0]],np.eye(3)[axes[1]])
 relative_axis=np.array([0.,-1.,0.]) if drive==0 else np.array(meta['motion']['joints'][0]['axis']) if drive==1 else -np.array(meta['motion']['joints'][1]['axis'])
 advance_sign=int(np.sign(normal@relative_axis))
 loops.append({'part':p['key'],'motion_group':p['motion_group'],'drive':drive,'teeth':22 if drive==2 else 30 if drive==1 else 37,'advance_sign':advance_sign,'station_normal':normal.tolist(),'relative_drive_axis':relative_axis.tolist(),'stations':stations})
(out/'arm-chains.json').write_text(json.dumps({'prototypes':prototypes,'loops':loops},separators=(',',':'))+'\n',encoding='utf8')
print('Chain stations',[(x['part'],len(x['stations'])) for x in loops],'prototypes',len(prototypes),'bytes',(out/'arm-chains.json').stat().st_size)
