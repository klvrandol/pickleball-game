import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3, Mesh } from 'three';
import { createAthlete, animateAthlete } from '../src/athlete.ts';

test('both athletes have human proportions and a small shared geometry budget',()=>{
  for(const team of ['player','cpu'] as const) {
    const athlete=createAthlete(team,0,0), size=new Box3().setFromObject(athlete.group).getSize(new Vector3());
    assert.ok(size.y>1.7 && size.y<2);assert.ok(size.x<0.85);assert.ok(size.z<0.5);
    let meshes=0,triangles=0;const geometries=new Set();
    athlete.group.traverse(object=>{
      if(object instanceof Mesh){meshes++;triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;geometries.add(object.geometry);}
    });
    assert.ok(meshes<100);assert.ok(triangles<22000);assert.ok(geometries.size<=12);
  }
});
test('jerseys distinguish the blue player from the red CPU while sharing shapes',()=>{
  const blue=createAthlete('player',0,0).group.getObjectByName('sports-shirt') as Mesh;
  const red=createAthlete('cpu',0,0).group.getObjectByName('sports-shirt') as Mesh;
  const blueMaterial=blue.material as import('three').MeshStandardMaterial;
  const redMaterial=red.material as import('three').MeshStandardMaterial;
  assert.ok(blueMaterial.color.b>blueMaterial.color.r);assert.ok(redMaterial.color.r>redMaterial.color.b);
  assert.equal(blue.geometry,red.geometry);
});
test('jointed running and swings animate without moving the gameplay root or detaching the paddle',()=>{
  const athlete=createAthlete('player',5,0);athlete.group.position.x=1.5;
  const root=athlete.group.position.clone(), facing=athlete.group.rotation.clone();
  for(let frame=0;frame<180;frame++)animateAthlete(athlete,{
    walking:true,phase:frame/8,swingLeft:frame%40<20?0.32-frame%40/60:0,
    shot:frame<90?'drive':'dink',lateral:2,side:frame<90?1:-1,ready:true,dt:1/60,time:frame/60,reduceMotion:false,
  });
  assert.deepEqual(athlete.group.position,root);assert.ok(athlete.group.rotation.equals(facing));
  assert.equal(athlete.paddle.parent,athlete.elbows[1]);
  assert.ok(Math.abs(athlete.knees[0].rotation.x)>0.01);assert.ok(athlete.elbows[1].rotation.x>0);
  athlete.group.updateMatrixWorld(true);
  athlete.group.traverse(object=>assert.ok(object.matrixWorld.elements.every(Number.isFinite)));
});
