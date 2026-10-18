"""Derive a source-aligned chassis and two rack lifts; never writes native CAD."""
import ast, hashlib, itertools, json, pathlib, struct, re
import numpy as np
import bpy

root=pathlib.Path(__file__).resolve().parents[1]
tree=ast.parse((root/'scripts/build-arm-parts.py').read_text(encoding='utf8'))
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='Cad'],type_ignores=[]),'<Cad>','exec'))
source=root/'materials/models/derived/inputs/codex/engineer_tagged.glb'
cad=Cad('engineer',source)
meta=json.loads((root/'materials/models/derived/web/arm-parts.json').read_text(encoding='utf8'))
arm_root=477
transform=np.linalg.inv(cad.matrix(arm_root))
excluded={m['index'] for p in meta['parts'] for m in p['members'] if m['asset']=='engineer'}
groups={
 'left_carriage':[156,157,163,165,166,170,171], 'left_gear':[161,162,167], 'left_foot':[155,159,164,173], 'left_roller':[169],
 'right_carriage':[269,274,277,281,275,271,276,284], 'right_gear':[272,273,282], 'right_foot':[267,270,283,286], 'right_roller':[285],
}
membership={i:k for k,ids in groups.items() for i in ids}
wheel_roots=[22,175,337,425]
wheel_tires=[31,189,348,438]
palette={}
for name,color,metal,rough in [('aluminium',(.38,.42,.47,1),.65,.42),('motor',(.075,.085,.10,1),.45,.4),('carbon',(.025,.032,.04,1),.05,.64),('print_black',(.045,.05,.06,1),0,.68),('rubber',(.035,.04,.045,1),0,.82),('misc',(.67,.69,.71,1),.05,.57)]:
 mat=bpy.data.materials.new(name)
 if mat.node_tree is None:mat.use_nodes=True
 shader=mat.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=color;shader.inputs['Metallic'].default_value=metal;shader.inputs['Roughness'].default_value=rough
 palette[name]=mat
batches={}
for i,node in enumerate(cad.data['nodes']):
 if 'mesh' not in node or i in excluded or arm_root in cad.ancestry(i):continue
 group=membership.get(i,'gimbal_context' if 468 in cad.ancestry(i) else 'chassis')
 for w,steer_root in enumerate(wheel_roots):
  if steer_root in cad.ancestry(i):group=f'main_{w}_'+('tire' if i==wheel_tires[w] else 'steer')
 name=cad.name(i)
 source_materials=[cad.data.get('materials',[])[p['material']].get('name','').lower() for p in cad.data['meshes'][node['mesh']]['primitives'] if 'material' in p]
 ancestry=' '.join(cad.name(k) for k in cad.ancestry(i))
 if re.search(r'MG[48]0|M3508|M2006|GM6020',ancestry):kind='motor'
 elif any('rubber' in x for x in source_materials) or any(x in name for x in ['聚氨酯','包胶','轮胎']):kind='rubber'
 elif any('carbon' in x for x in source_materials) or '碳' in name:kind='carbon'
 elif any(x in name for x in ['保护罩','管夹','电池','电路','遥控','接收机']):kind='print_black'
 elif any('plastic' in x for x in source_materials):kind='print_black'
 else:kind='aluminium'
 batches.setdefault((group,kind),[]).append(i)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
C=np.array([[1,0,0],[0,0,-1],[0,1,0]])
records=[]
group_triangles={}
for (g,k),ids in batches.items():
 group_triangles[g]=group_triangles.get(g,0)+sum(cad.data['accessors'][p['indices']]['count']//3 for i in ids for p in cad.data['meshes'][cad.data['nodes'][i]['mesh']]['primitives'])
for (group,kind),ids in batches.items():
 vertices=[];faces=[]
 with source.open('rb') as stream:
  for i in ids:
   mat=transform@cad.matrix(i)
   for primitive in cad.data['meshes'][cad.data['nodes'][i]['mesh']]['primitives']:
    v=cad.accessor(primitive['attributes']['POSITION'],stream).astype(np.float64)
    f=cad.accessor(primitive['indices'],stream).reshape(-1,3)
    v=(v@mat[:3,:3].T+mat[:3,3])@C.T
    faces.extend((f+len(vertices)).tolist());vertices.extend(v.tolist())
 mesh=bpy.data.meshes.new(group+'_'+kind);mesh.from_pydata(vertices,[],faces);mesh.update()
 obj=bpy.data.objects.new(group+'_'+kind,mesh);bpy.context.collection.objects.link(obj)
 bpy.context.view_layer.objects.active=obj;obj.select_set(True)
 budget=240000 if group=='chassis' else 75000 if group=='gimbal_context' else 14000
 limit=max(1200,int(budget*len(faces)/group_triangles[group]))
 if len(faces)>limit:
  mod=obj.modifiers.new('Context tessellation budget','DECIMATE');mod.ratio=limit/len(faces);bpy.ops.object.modifier_apply(modifier=mod.name)
 obj.data.materials.append(palette[kind])
 obj['context_group']=group
 obj.select_set(False)
 records.append({'group':group,'material':kind,'source_nodes':ids,'source_triangles':len(faces),'triangles':len(obj.data.polygons)})
 print(group,len(ids),len(obj.data.polygons),flush=True)
out=root/'materials/models/derived/web'
bpy.ops.export_scene.gltf(filepath=str(out/'arm-context.glb'),export_format='GLB',export_yup=True,export_extras=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=10)
if (out/'arm-context.glb').stat().st_size>6*1024*1024:raise RuntimeError('Context GLB exceeds 6 MiB budget')
info={'source':str(source.relative_to(root)),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'engineer_to_arm':transform.tolist(),'groups':records,'lift_axis':[0,1,0],'gear_axis':[.608163021,0,.793812173],'gear_points':[[-.434342559,-.136701081,-.135801579],[-.096812078,-.136701081,.304764183]],'foot_points':[[-.466491952,-.204968621,-.111170977],[-.128961471,-.204968621,.329394785]],'evidence':'engineer_mates[347,621]: carriage 60.28246 mm, allowed 7..120 mm. Demonstration stroke 0..52 mm down; second rack 2x inferred from opposed rack/pinion geometry, not calibrated. Excludes every B engineer source and the complete arm subtree.'}
(out/'arm-context.json').write_text(json.dumps(info,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
