import * as THREE from 'three';

const ghostUniforms=new WeakMap<THREE.Material,{value:number}>();
/** Solid parts use the opaque depth pass; only fading covers use alpha blending. */
export function setStudyOpacity(material:THREE.MeshStandardMaterial,opacity:number,background=false){
  let uniform=ghostUniforms.get(material);
  if(!uniform){
    uniform={value:-1};ghostUniforms.set(material,uniform);
    const ghostOpacity=uniform;
    material.onBeforeCompile=shader=>{
      shader.uniforms.studyGhostOpacity=ghostOpacity;
      shader.fragmentShader=shader.fragmentShader.replace('#include <premultiplied_alpha_fragment>',`#include <premultiplied_alpha_fragment>
        if(studyGhostOpacity>=0.){if(studyGhostOpacity<=0.)discard;gl_FragColor.a=studyGhostOpacity;gl_FragColor.rgb*=studyGhostOpacity;}`);
      shader.fragmentShader='uniform float studyGhostOpacity;\n'+shader.fragmentShader;
    };
    material.needsUpdate=true;
  }
  uniform.value=background?opacity:-1;
  const transparent=!background&&opacity<1;
  if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}
  material.opacity=opacity;material.depthWrite=!transparent;
}

/** Fade the depth-resolved vehicle image once, rather than every overlapping CAD face. */
export function createStudyRenderer(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,context:THREE.Object3D){
  const options={type:THREE.HalfFloatType,samples:4};
  const local=new THREE.WebGLRenderTarget(1,1,options),vehicle=new THREE.WebGLRenderTarget(1,1,options);
  local.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  vehicle.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  // The two depth buffers let the compositor retain real front/back relationships
  // while drawing each CAD mesh only once. Layer 1 is private to this scene.
  const layers=new Map<THREE.Object3D,number>();
  const contextMaterials=new Set<THREE.MeshStandardMaterial>();
  context.traverse(node=>{layers.set(node,node.layers.mask);node.layers.set(1);const mesh=node as THREE.Mesh;if(mesh.isMesh){for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])contextMaterials.add(m as THREE.MeshStandardMaterial);}});
  scene.traverse(node=>{if((node as THREE.Light).isLight){layers.set(node,node.layers.mask);node.layers.enable(1);}});
  const material=new THREE.ShaderMaterial({
    depthTest:false,depthWrite:false,
    uniforms:{localImage:{value:local.texture},vehicleImage:{value:vehicle.texture},localDepth:{value:local.depthTexture},vehicleDepth:{value:vehicle.depthTexture}},
    vertexShader:'varying vec2 uvImage; void main(){uvImage=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`
      uniform sampler2D localImage;
      uniform sampler2D vehicleImage;
      uniform sampler2D localDepth;
      uniform sampler2D vehicleDepth;
      varying vec2 uvImage;
      void main(){
        vec4 arm=texture2D(localImage,uvImage);
        vec4 vehicle=texture2D(vehicleImage,uvImage);
        bool vehicleInFront=texture2D(vehicleDepth,uvImage).r<texture2D(localDepth,uvImage).r;
        gl_FragColor=vehicleInFront?vehicle+arm*(1.-vehicle.a):arm+vehicle*(1.-arm.a);
        gl_FragColor.rgb/=max(gl_FragColor.a,0.00001);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor.rgb*=gl_FragColor.a;
      }`,
  });
  const geometry=new THREE.PlaneGeometry(2,2),output=new THREE.Scene();
  output.add(new THREE.Mesh(geometry,material));
  const outputCamera=new THREE.Camera(),size=new THREE.Vector2(),autoReset=renderer.info.autoReset;
  renderer.info.autoReset=false;
  return {
    render(opacity:number){
      renderer.getDrawingBufferSize(size);
      if(local.width!==size.x||local.height!==size.y){local.setSize(size.x,size.y);vehicle.setSize(size.x,size.y);}
      const target=renderer.getRenderTarget(),cameraLayers=camera.layers.mask;
      renderer.info.reset();
      try{
        contextMaterials.forEach(m=>setStudyOpacity(m,THREE.MathUtils.clamp(opacity,0,1),true));
        camera.layers.set(0);renderer.setRenderTarget(local);renderer.render(scene,camera);
        camera.layers.set(1);renderer.setRenderTarget(vehicle);renderer.render(scene,camera);
        renderer.setRenderTarget(target);renderer.render(output,outputCamera);
      }finally{camera.layers.mask=cameraLayers;renderer.setRenderTarget(target);}
    },
    dispose(){local.dispose();vehicle.dispose();geometry.dispose();material.dispose();layers.forEach((mask,node)=>{node.layers.mask=mask;});renderer.info.autoReset=autoReset;},
  };
}
