"""Validate the derived 2D contact against the actual 3D source meshes in Blender."""
import ast,json,math,pathlib,struct
import numpy as np
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(__file__).resolve().parents[1]
study=json.loads((root/'materials/models/derived/web/arm-linked-limit.json').read_text('utf8'))
meta=json.loads((root/'materials/models/derived/web/arm-parts.json').read_text('utf8'))
tree=ast.parse((root/'scripts/build-arm-parts.py').read_text('utf8'))
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='Cad'],type_ignores=[]),'Cad','exec'))
cad=Cad('arm',root/'materials/models/derived/inputs/codex/arm_tagged.glb')
plate_vertices=[];plate_faces=[]
with cad.path.open('rb') as stream:
    for primitive in cad.data['meshes'][cad.data['nodes'][370]['mesh']]['primitives']:
        v=cad.accessor(primitive['attributes']['POSITION'],stream)
        f=cad.accessor(primitive['indices'],stream).reshape(-1,3)
        plate_faces.extend((f+len(plate_vertices)).tolist());plate_vertices.extend(v.tolist())
plate_vertices=(np.c_[plate_vertices,np.ones(len(plate_vertices))]@cad.matrix(370).T)[:,:3]
vertices=[];faces=[]
with cad.path.open('rb') as stream:
    for primitive in cad.data['meshes'][cad.data['nodes'][311]['mesh']]['primitives']:
        v=cad.accessor(primitive['attributes']['POSITION'],stream)
        f=cad.accessor(primitive['indices'],stream).reshape(-1,3)
        faces.extend((f+len(vertices)).tolist());vertices.extend(v.tolist())
roller_vertices=(np.c_[vertices,np.ones(len(vertices))]@cad.matrix(311).T)[:,:3]
def rotation(point,degrees):
    p=Vector(point);return Matrix.Translation(p)@Matrix.Rotation(math.radians(degrees),4,'X')@Matrix.Translation(-p)
q2=study['demo']['q2_deg'];contact=study['demo']['q3_contact_deg'];direction=1 if contact>0 else -1
shoulder=rotation(meta['motion']['joints'][1]['point_m'],q2)
plate_matrix=shoulder@rotation(meta['motion']['uwb_point_m'],-q2)
plate_bvh=BVHTree.FromPolygons([plate_matrix@Vector(v) for v in plate_vertices],plate_faces,all_triangles=True)
contact_point=plate_matrix@Vector(study['demo']['contact_point_m'])
checks=[]
for name,q3 in [('before',contact-direction*.5),('contact',contact),('beyond',contact+direction*.5)]:
    matrix=shoulder@rotation(meta['motion']['joints'][2]['point_m'],q3)
    roller_bvh=BVHTree.FromPolygons([matrix@Vector(v) for v in roller_vertices],faces,all_triangles=True)
    overlaps=len(plate_bvh.overlap(roller_bvh));nearest=roller_bvh.find_nearest(contact_point)
    checks.append({'name':name,'q3_deg':q3,'intersecting_triangle_pairs':overlaps,'marker_to_roller_m':nearest[3]})
assert checks[0]['intersecting_triangle_pairs']==0,checks
assert checks[2]['intersecting_triangle_pairs']>0,checks
assert checks[1]['marker_to_roller_m']<.0002,checks
out=root/'materials/documents/derived/audits/arm-revision-20261017';out.mkdir(parents=True,exist_ok=True)
(out/'native-contact-checks.json').write_text(json.dumps({'checks':checks,'plate_source_sha256':study['plate_source_sha256'],'scope':'Native plate and actual roller triangle meshes only.'},indent=2)+'\n',encoding='utf8')
print('Native 3D contact checks:',json.dumps(checks),flush=True)
