import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { createBallLocator } from '../src/ball-locator.ts';
test('hollow ball locator renders through an opaque avatar without writing depth or changing ball position',()=>{
 const marker=createBallLocator(.12);assert.equal(marker.children.length,2);
 for(const child of marker.children){
  const mesh=child as Mesh;const material=mesh.material as MeshBasicMaterial;
  assert.equal(material.depthTest,false);assert.equal(material.depthWrite,false);assert.ok(mesh.renderOrder>=100);
  mesh.geometry.computeBoundingSphere();assert.ok(mesh.geometry.boundingSphere!.radius>.12);
 }
 assert.deepEqual(marker.position.toArray(),new Vector3().toArray());
});
