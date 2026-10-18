import assert from 'node:assert/strict';
import * as THREE from 'three';
import {setStudyOpacity,createStudyRenderer} from '../src/scripts/lib/arm-study-renderer.ts';

const material=new THREE.MeshStandardMaterial({transparent:true,depthWrite:false});
for(const opacity of [1,.35,.05,1]){
  setStudyOpacity(material,opacity);
  assert.equal(material.opacity,opacity);
  if(opacity===1){assert.equal(material.transparent,false,'Solid CAD belongs in the opaque pass.');assert.equal(material.depthWrite,true,'Solid CAD must occlude surfaces behind it.');}
  else {assert.equal(material.transparent,true);assert.equal(material.depthWrite,false);}
}
setStudyOpacity(material,.018,true);
assert.equal(material.transparent,false,'Background CAD must resolve its own depth before fading.');
assert.equal(material.depthWrite,true);
const shader={uniforms:{},fragmentShader:'#include <premultiplied_alpha_fragment>'};material.onBeforeCompile(shader,{});
assert.equal(shader.uniforms.studyGhostOpacity.value,.018);

// Exercise the actual compositing sequence, including restoration of shared renderer state.
const scene=new THREE.Scene(),context=new THREE.Group(),camera=new THREE.Camera();scene.add(context);
const contextMaterial=new THREE.MeshStandardMaterial(),contextGeometry=new THREE.BoxGeometry();
context.add(new THREE.Mesh(contextGeometry,contextMaterial));
const calls=[];let target=null,fail=false;
const renderer={
  info:{autoReset:true,reset(){}},
  getDrawingBufferSize(size){return size.set(640,360);},
  getRenderTarget(){return target;},setRenderTarget(value){target=value;},
  render(value,view){calls.push({context:view.layers.test(context.layers),target,scene:value});if(fail)throw new Error('Synthetic render failure');},
};
const presentation=createStudyRenderer(renderer,scene,camera,context);
for(const opacity of [.08,.5,1]){
  calls.length=0;presentation.render(opacity);
  assert.equal(calls.length,3);
  assert.equal(calls[0].scene,scene);assert.equal(calls[0].context,false);
  assert.equal(calls[1].scene,scene);assert.equal(calls[1].context,true);
  assert.equal(calls[2].target,null);
  assert.equal(contextMaterial.opacity,opacity);
  assert.equal(contextMaterial.transparent,false);assert.equal(contextMaterial.depthWrite,true);
  assert.equal(context.visible,true);assert.equal(camera.layers.mask,1);assert.equal(target,null);
}
fail=true;assert.throws(()=>presentation.render(.08),/Synthetic render failure/);
assert.equal(context.visible,true);assert.equal(camera.layers.mask,1);assert.equal(target,null);
presentation.dispose();material.dispose();assert.equal(renderer.info.autoReset,true);assert.equal(context.layers.mask,1);
contextMaterial.dispose();contextGeometry.dispose();
console.log('Arm depth: opaque CAD, isolated vehicle fade and renderer-state recovery passed.');
