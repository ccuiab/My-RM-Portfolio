"""Render the same web-model assembly storyboard used by B chapter (Blender 5.1).
Run after build-arm-parts.py. Source CAD and all source geometry remain read-only.
"""
import bpy, json, math, pathlib, sys
from mathutils import Vector
root=pathlib.Path(__file__).resolve().parents[1]
meta=json.loads((root/'materials/models/derived/web/arm-parts.json').read_text('utf8'))
assert meta['schema_version']==6
out=root/'materials/images/derived/web/arm-study';out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'materials/models/derived/web/arm-parts.glb'))
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1400;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.38,.48,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
scene.view_settings.view_transform='AgX'
C=lambda v:Vector((v[0],-v[2],v[1]))
objects={o.get('part_key'):o for o in scene.objects if o.get('part_key')}
records={p['key']:p for p in meta['parts']}
rests={k:o.location.copy() for k,o in objects.items()}
# Only the already-cleared covers fade. Each object's material is independent.
original_materials={}
for k,o in objects.items():
 if o.type!='MESH':continue
 original_materials[k]=list(o.data.materials)

for loc,power,size in [((1.5,-2,2.8),300,2.5),((-1.5,1,1.5),240,2),((0,-1,-1),100,1.5)]:
 d=bpy.data.lights.new('Softbox','AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new('Softbox',d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
cam_data=bpy.data.cameras.new('Study camera');cam=bpy.data.objects.new('Study camera',cam_data);scene.collection.objects.link(cam);scene.camera=cam;cam_data.type='ORTHO';cam_data.lens=48
amber=bpy.data.materials.new('Amber guides');amber.diffuse_color=(.89,.46,.035,1);amber.use_nodes=True
shader=amber.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(.89,.46,.035,1);shader.inputs['Emission Color'].default_value=(.89,.46,.035,1);shader.inputs['Emission Strength'].default_value=.6
annotations=[]
def line(a,b,radius=.00055):
 curve=bpy.data.curves.new('Assembly guide','CURVE');curve.dimensions='3D';curve.bevel_depth=radius;curve.bevel_resolution=1;s=curve.splines.new('POLY');s.points.add(1);s.points[0].co=(*a,1);s.points[1].co=(*b,1);o=bpy.data.objects.new('Assembly guide',curve);scene.collection.objects.link(o);o.data.materials.append(amber);annotations.append(o)
def center(p):return C([(a+b)/2 for a,b in zip(p['bounds']['min'],p['bounds']['max'])])
def shot(view_id):
 for o in annotations:bpy.data.objects.remove(o,do_unlink=True)
 annotations.clear()
 view=next((d for d in meta['details'] if d['id']==view_id),None)
 keys=set(view['part_keys']) if view else set(objects)
 points=[]
 for k,o in objects.items():
  p=records[k];o.hide_render=k not in keys;o.location=rests[k]+C(p['detail_offset_m'] if view else p['group_offset_m'])
  if k in original_materials:
   o.data.materials.clear()
   for original in original_materials[k]:
    if view and p['stage']==1:
     mat=original.copy();nodes=mat.node_tree.nodes;links=mat.node_tree.links;output=nodes.get('Material Output');old=output.inputs['Surface'].links[0].from_socket
     mix=nodes.new('ShaderNodeMixShader');transparent=nodes.new('ShaderNodeBsdfTransparent');mix.inputs[0].default_value=.07
     links.new(transparent.outputs[0],mix.inputs[1]);links.new(old,mix.inputs[2]);links.new(mix.outputs[0],output.inputs['Surface']);o.data.materials.append(mat)
    else:o.data.materials.append(original)
  if k in keys:
   points.extend(o.matrix_world@Vector(corner)+C(p['detail_offset_m'] if view else p['group_offset_m']) for corner in o.bound_box)
 bpy.context.view_layer.update()
 points=[o.matrix_world@Vector(corner) for k,o in objects.items() if k in keys and (not view or records[k]['stage']!=1) for corner in o.bound_box]
 low=Vector([min(p[i] for p in points) for i in range(3)]);high=Vector([max(p[i] for p in points) for i in range(3)]);target=(low+high)/2
 direction=C(view['camera'] if view else [1,.65,1.5]).normalized();cam.location=target+direction*3;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
 right=cam.rotation_euler.to_matrix()@Vector((1,0,0));up=cam.rotation_euler.to_matrix()@Vector((0,1,0))
 xs=[(p-target).dot(right) for p in points];ys=[(p-target).dot(up) for p in points]
 target+=right*((min(xs)+max(xs))/2)+up*((min(ys)+max(ys))/2);cam.location=target+direction*3
 cam_data.ortho_scale=max(max(xs)-min(xs),(max(ys)-min(ys))*1400/900)*1.18
 if view:
  for k in keys:
   p=records[k];d=C(p['detail_offset_m'])
   if p['stage']!=2 or d.length<.003:continue
   a=center(p);b=a+d;n=max(1,int(d.length/.01))
   for i in range(n):line(a+d*(i/n),a+d*min(1,(i+.4)/n),.0003)
  route=[k for k in view['route_keys'] if k in keys]
  path=[center(records[k])+C(records[k]['detail_offset_m']) for k in route]
  for a,b in view['route_edges']:line(path[a],path[b])
  for i,p in enumerate(path):
   text=bpy.data.curves.new('Route number','FONT');text.body=str(i+1);text.size=cam_data.ortho_scale*.019;text.align_x='CENTER';o=bpy.data.objects.new('Route number',text);scene.collection.objects.link(o);o.location=p+up*.008+right*.009+direction*.035;o.rotation_euler=cam.rotation_euler; o.data.materials.append(amber);annotations.append(o)
 filename=out/f'detail-{view_id}.png' if view else root/'materials/images/derived/site/cad-cutouts/arm-exploded.png'
 scene.render.filepath=str(filename);bpy.ops.render.render(write_still=True);print('RENDERED',filename,flush=True)
views=[int(v) for v in sys.argv[sys.argv.index('--')+1].split(',')] if '--' in sys.argv else [0,1,8,2,6,3,4,5,7,-1]
for i in views:shot(i)
