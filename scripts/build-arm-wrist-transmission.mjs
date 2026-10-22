/** Read the existing derived CAD export; do not modify the native CAD or arm GLB. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';

const input='materials/models/derived/inputs/codex/arm_tagged.glb';
const bytes=await readFile(input),jsonLength=bytes.readUInt32LE(12);
const gltf=JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8'));
const binary=bytes.subarray(28+jsonLength),meta=JSON.parse(await readFile('materials/models/derived/web/arm-parts.json','utf8'));
const world=new Map();
function visit(index,parent){
 const node=gltf.nodes[index],matrix=new THREE.Matrix4();
 if(node.matrix)matrix.fromArray(node.matrix);else matrix.compose(new THREE.Vector3().fromArray(node.translation??[0,0,0]),new THREE.Quaternion().fromArray(node.rotation??[0,0,0,1]),new THREE.Vector3().fromArray(node.scale??[1,1,1]));
 matrix.premultiply(parent);world.set(index,matrix);for(const child of node.children??[])visit(child,matrix);
}
for(const index of gltf.scenes[gltf.scene??0].nodes)visit(index,new THREE.Matrix4());
function accessor(index){
 const a=gltf.accessors[index],view=gltf.bufferViews[a.bufferView],width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],component={5121:[1,'readUInt8'],5123:[2,'readUInt16LE'],5125:[4,'readUInt32LE'],5126:[4,'readFloatLE']}[a.componentType];
 if(!component||!width)throw Error('Unsupported CAD accessor');
 const offset=(view.byteOffset??0)+(a.byteOffset??0),stride=view.byteStride??width*component[0],values=[];
 for(let i=0;i<a.count;i++){const row=[];for(let k=0;k<width;k++)row.push(binary[component[1]](offset+i*stride+k*component[0]));values.push(width===1?row[0]:row);}
 return values;
}
const partFor=source=>meta.parts.find(p=>p.members.some(m=>m.asset==='arm'&&m.index===source));
const center=source=>{
 const node=gltf.nodes[source],bounds=new THREE.Box3();
 for(const p of gltf.meshes[node.mesh].primitives){const a=gltf.accessors[p.attributes.POSITION];bounds.union(new THREE.Box3(new THREE.Vector3().fromArray(a.min),new THREE.Vector3().fromArray(a.max)));}
 return bounds.getCenter(new THREE.Vector3()).applyMatrix4(world.get(source));
};
const axis=new THREE.Vector3().fromArray(meta.motion.joints.find(j=>j.name==='J5').axis).normalize();
const shaftPoint=new THREE.Vector3().setFromMatrixPosition(world.get(762));
const rotors=[
 {source:507,channel:'wheel',ratio:1,point:center(507).toArray(),teeth:38},
 ...[505,762,782,766,779,781,500,696].map(source=>({source,channel:'wheel',ratio:-1,point:shaftPoint.toArray(),...([505,500,696].includes(source)?{teeth:source===505?38:40}:{})})),
 {source:683,channel:'pitch',ratio:1,point:center(683).toArray(),teeth:21},
].map(r=>({...r,key:partFor(r.source).key,axis:axis.toArray(),name:gltf.nodes[r.source].extras.source_node_name}));

const beltPart=partFor(691),prototypes=[],lookup=new Map(),stations=[];
for(const member of beltPart.members){
 const node=gltf.nodes[member.index],positions=[],normals=[],indices=[];
 for(const p of gltf.meshes[node.mesh].primitives){const vertices=accessor(p.attributes.POSITION),faces=accessor(p.indices);indices.push(...faces.map(x=>x+positions.length));positions.push(...vertices);if(p.attributes.NORMAL!==undefined)normals.push(...accessor(p.attributes.NORMAL));}
 const signature=createHash('sha256').update(JSON.stringify({positions,indices})).digest('hex');
 if(!lookup.has(signature)){lookup.set(signature,prototypes.length);prototypes.push({positions,normals,indices});}
 stations.push({source:member.index,prototype:lookup.get(signature),matrix:world.get(member.index).toArray(),center:center(member.index).toArray()});
}
const mean=stations.reduce((s,p)=>s.add(new THREE.Vector3().fromArray(p.center)),new THREE.Vector3()).divideScalar(stations.length);
const along=center(680).sub(center(683)).normalize(),side=new THREE.Vector3().crossVectors(axis,along).normalize();
stations.sort((a,b)=>{const angle=s=>{const d=new THREE.Vector3().fromArray(s.center).sub(mean);return Math.atan2(d.dot(side),d.dot(along));};return angle(a)-angle(b);});
const lineDistance=(p,origin,direction)=>new THREE.Vector3().fromArray(p).sub(origin).cross(direction).length();
const transverseDistance=(a,b)=>center(a).sub(center(b)).cross(axis).length();
const evidence={source:input,sourceSha256:createHash('sha256').update(bytes).digest('hex'),axis:axis.toArray(),shaftSources:[762,782],shaftCenters:[762,782].map(source=>({source,center:center(source).toArray(),axisLineErrorMetres:lineDistance(center(source).toArray(),shaftPoint,axis)})),meshPairs:[{source:[507,505],teeth:[38,38],transverseDistanceMetres:transverseDistance(507,505),pitchDiameterMetres:.038},{source:[500,593],teeth:[40,40],transverseDistanceMetres:transverseDistance(500,593),pitchDiameterMetres:.05},{source:[696,684],teeth:[40,40],transverseDistanceMetres:transverseDistance(696,684),pitchDiameterMetres:.05}],coupling:'wheel=q5-q6; 38T external pair reverses once; common shaft keys both 40T drive gears; each 40T external pair reverses again. Existing link_wheel outputs remain unchanged. Open 21T belt has equal signed input/output pitch rotation.'};
const output={schema:1,rotors,belt:{key:beltPart.key,drive:'pitch',teeth:21,advanceSign:1,axis:axis.toArray(),prototypes,stations},evidence};
const path='materials/models/derived/web/arm-wrist-transmission.json';
await writeFile(path,JSON.stringify(output)+'\n');
console.log(JSON.stringify({path,rotors:rotors.length,beltStations:stations.length,prototypes:prototypes.length,bytes:(await readFile(path)).length,evidence}));
