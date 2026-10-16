import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, InstancedMesh, Matrix4, Mesh, PerspectiveCamera, Raycaster, Vector3 } from 'three';
import { createParkEnvironment } from '../src/park-environment.ts';
test('park props leave the entire gameplay run-out clear with a bounded render budget',()=>{
 const park=createParkEnvironment();park.updateMatrixWorld(true);let meshes=0,triangles=0;
 for(const name of ['park-ground','park-paths','park-fences','park-benches','park-trees','park-planting','park-objects'])assert.ok(park.getObjectByName(name));
 park.traverse(o=>{if(!(o instanceof Mesh))return;meshes++;o.geometry.computeBoundingBox();
  const count=o instanceof InstancedMesh?o.count:1;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3*count;
  for(let i=0;i<count;i++){
   const transform=o.matrixWorld.clone();if(o instanceof InstancedMesh){const local=new Matrix4();o.getMatrixAt(i,local);transform.multiply(local);}
   const bounds=new Box3().copy(o.geometry.boundingBox!).applyMatrix4(transform);
   if(bounds.max.y<=.10)continue;
   assert.ok(bounds.max.x< -4.5||bounds.min.x>4.5||bounds.max.z< -8.3||bounds.min.z>8.3,`prop intersects play area: ${o.name}`);
  }
 });
 assert.ok(meshes<155,`meshes ${meshes}`);assert.ok(triangles<15000,`triangles ${triangles}`);
 assert.ok(!park.getObjectByProperty('isLight',true));
});
test('park geometry cannot block the court or players from the existing follow camera, including movement extremes',()=>{
 const park=createParkEnvironment();park.updateMatrixWorld(true);const camera=new PerspectiveCamera(46,16/9,.1,100),ray=new Raycaster();ray.params.Line.threshold=.005;
 for(const player of [new Vector3(0,.045,5),new Vector3(-4.4,.045,.55),new Vector3(4.4,.045,8.2)]){
  camera.position.set(player.x*.23+1.8,11.4,15.9+player.z*.26);camera.lookAt(0,.3,-1.4);camera.updateMatrixWorld(true);
  for(const x of [-3,0,3])for(const z of [-7.8,-3,0,3,8.2]){
   const target=new Vector3(x,.8,z),distance=camera.position.distanceTo(target);ray.set(camera.position,target.sub(camera.position).normalize());
   assert.ok(!ray.intersectObject(park,true).some(hit=>hit.distance<distance-.02&&hit.object instanceof Mesh),`blocked court view x=${x}, z=${z}`);
  }
 }
});
