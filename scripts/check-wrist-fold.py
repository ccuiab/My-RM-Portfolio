"""Sample CAD surface interference of folded cup against wrist frame and wheels."""
import bpy,json,pathlib,math
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(__file__).resolve().parents[1]
m=json.loads((root/'materials/models/derived/web/arm-parts.json').read_text(encoding='utf8'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root/'materials/models/derived/web/arm-parts.glb'))
C=Matrix(((1,0,0),(0,0,-1),(0,1,0))).to_4x4()
nodes={o.get('part_key'):o for o in bpy.data.objects if o.type=='MESH'}
data={}
for p in m['parts']:
 if p['motion_group'] not in ['link_4','link_5','link_6','link_wheel']:continue
 o=nodes[p['key']];o.data.calc_loop_triangles()
 data[p['key']]=(p,[C.inverted()@o.matrix_world@v.co for v in o.data.vertices],[tuple(t.vertices) for t in o.data.loop_triangles])
def rot(j,deg):
 p=Vector(j['point_m']);return Matrix.Translation(p)@Matrix.Rotation(math.radians(deg),4,Vector(j['axis']))@Matrix.Translation(-p)
j5,j6,j7=m['motion']['joints'][4:7]
def trees(angle,roll):
 a=rot(j5,angle);trans={'link_4':Matrix.Identity(4),'link_5':a,'link_6':a@rot(j6,roll),'link_wheel':rot(j7,angle-roll)}
 return {k:BVHTree.FromPolygons([trans[p['motion_group']]@v for v in vs],fs,all_triangles=True) for k,(p,vs,fs) in data.items()}
moving=[k for k,(p,_,_) in data.items() if p['motion_group']=='link_6']
fixed=[k for k,(p,_,_) in data.items() if p['motion_group'] in ['link_4','link_wheel']]
baseline=trees(0,0);exempt={(a,b) for a in moving for b in fixed if baseline[a].overlap(baseline[b])}
def hits(angle,roll):
 t=trees(angle,roll);return [(a,b) for a in moving for b in fixed if (a,b) not in exempt and t[a].overlap(t[b])]
scan=[];safe=0
for angle in range(-10,-121,-5):
 h=hits(angle,0);scan.append({'pitch':angle,'new_intersections':h});print(angle,len(h),flush=True)
 if h:break
 safe=angle
# Leave five degrees from the last sampled unobstructed endpoint.
chosen=min(0,safe+5);spin=[]
for roll in range(0,360,15):
 h=hits(chosen,roll);spin.append({'roll':roll,'new_intersections':h});print('roll',roll,len(h),flush=True)
out={'chosen_pitch_degrees':chosen,'scan':scan,'spin':spin,'baseline_contact_pairs_excluded':list(exempt),'scope':'Triangle surface intersections for cup/roll group vs wrist frame and wheels. 5 degree pitch,15 degree roll samples; not continuous collision proof, clearance distance, hardware limit or full-robot validation.'}
(root/'materials/documents/derived/audits/arm-study-20261014/wrist-fold-checks.json').write_text(json.dumps(out,indent=2),encoding='utf8')
