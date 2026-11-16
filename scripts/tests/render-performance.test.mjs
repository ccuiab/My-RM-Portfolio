import assert from 'node:assert/strict';
import test from 'node:test';
import { BoxGeometry, SphereGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3, DoubleSide } from 'three';
import { acceleratedRaycast } from 'three-mesh-bvh';
import { FrameClock } from '../../src/scripts/lib/frame-clock.ts';
import { copyPickingGeometry, buildPickingTree, attachPickingTree } from '../../src/scripts/lib/picking-geometry.ts';

test('frame pacing tolerates display jitter and preserves wall-clock animation time', () => {
  for (const target of [30, 60]) for (const refresh of [60, 120, 144]) {
    const clock = new FrameClock(target), times = [], deltas = [];
    for (let i = 0; i <= refresh * 3; i++) {
      const now = i * 1000 / refresh + Math.sin(i) * .15;
      const dt = clock.sample(now);
      if (dt !== undefined) { times.push(now); deltas.push(dt); }
    }
    assert.ok(times.length >= target * 3 - 1 && times.length <= target * 3 + 2, `${target}/${refresh} Hz produced ${times.length} frames`);
    assert.ok(Math.abs(deltas.reduce((s,x) => s+x,0) - (times.at(-1)-times[0])/1000) < 1e-9);
    assert.ok(Math.max(...times.slice(1).map((t,i) => t-times[i])) < 1000 / target + 1000 / refresh + .5);
    clock.reset(); assert.equal(clock.sample(20000), 0, 'Resuming must not integrate hidden time');
    assert.equal(clock.sample(21000), .1, 'A stalled frame must not jump the animation');
  }
});

test('worker-built BVH preserves nearest CAD hits, triangle order and material groups', () => {
  for (const geometry of [new BoxGeometry(1,2,1,8,8,8),new SphereGeometry(.8,48,32),new BoxGeometry().toNonIndexed()]) {
    const material = new MeshBasicMaterial({ side: DoubleSide });
    const mesh = new Mesh(geometry, geometry.groups.length ? geometry.groups.map(() => material) : material);
    mesh.rotation.set(.3,.5,.2); mesh.scale.set(1.2,.8,1); mesh.position.set(.1,-.1,0);mesh.updateMatrixWorld(true);
    const index = geometry.index?.array.slice(), positions = geometry.getAttribute('position').array.slice(), groups = structuredClone(geometry.groups);
    const rays = [];
    for(let x=-1.2;x<=1.2;x+=.2)for(let y=-1.2;y<=1.2;y+=.2)rays.push(new Raycaster(new Vector3(x,y,4),new Vector3(0,0,-1)));
    const expected = rays.map(ray => ray.intersectObject(mesh,false)[0]);
    const input = copyPickingGeometry(geometry);
    // Structured cloning models the actual worker boundary and transferred buffers.
    attachPickingTree(geometry, structuredClone(buildPickingTree(structuredClone(input))));
    mesh.raycast = acceleratedRaycast;
    rays.forEach((ray,i) => {
      ray.firstHitOnly = true;
      const hit = ray.intersectObject(mesh,false)[0], original=expected[i];
      assert.equal(Boolean(hit),Boolean(original));
      if(hit) { assert.ok(Math.abs(hit.distance-original.distance)<1e-6); assert.equal(hit.face.materialIndex,original.face.materialIndex); }
    });
    if(index) assert.deepEqual(geometry.index.array,index);
    assert.deepEqual(geometry.getAttribute('position').array,positions);assert.deepEqual(geometry.groups,groups);
    geometry.dispose();material.dispose();
  }
});
