import './model-fixture.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3, Mesh, SkinnedMesh, Bone } from 'three';
import { installAthleteModel } from '../src/athlete-model.ts';
import { createAthlete, animateAthlete } from '../src/athlete.ts';

function skins(actor: ReturnType<typeof createAthlete>) {
  const result: SkinnedMesh[] = []; actor.model.traverse(o => { if (o instanceof SkinnedMesh) result.push(o); }); return result;
}
test('the replacement GLB has a weighted human mesh, complete rig, and a small render budget', () => {
  const actor = createAthlete('player', 0, 0), size = new Box3().setFromObject(actor.model).getSize(new Vector3());
  assert.ok(size.y > 1.7 && size.y < 2); assert.ok(size.x < 0.85);
  const meshes = skins(actor); assert.ok(meshes.length >= 1 && meshes.length < 12);
  const bones = meshes[0].skeleton.bones; assert.ok(bones.length >= 25);
  for (const joint of [...actor.arms, ...actor.elbows, ...actor.wrists, actor.chest, ...actor.legs, ...actor.knees, ...actor.feet]) assert.ok(joint instanceof Bone);
  let triangles = 0;
  for (const mesh of meshes) {
    triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
    assert.ok(mesh.geometry.getAttribute('skinIndex')); assert.ok(mesh.geometry.getAttribute('skinWeight'));
  }
  assert.ok(triangles < 15000); assert.ok(actor.actions.Man_Idle && actor.actions.Man_Walk && actor.actions.Man_Run);
});
test('players share geometry but have independent skeletons and blue/red sports materials', () => {
  const p = createAthlete('player', 3, 0), c = createAthlete('cpu', -3, Math.PI);
  const pm = skins(p), cm = skins(c); assert.equal(pm[0].geometry, cm[0].geometry);
  assert.notEqual(pm[0].skeleton.bones[0].uuid, cm[0].skeleton.bones[0].uuid);
  function shirt(a: typeof p) { let material: import('three').MeshStandardMaterial | undefined;
    a.model.traverse(o => { if (o instanceof Mesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.name === 'Shirt') material = m as import('three').MeshStandardMaterial; }); return material!; }
  assert.ok(shirt(p).color.b > shirt(p).color.r); assert.ok(shirt(c).color.r > shirt(c).color.b);
  assert.notEqual(shirt(p).uuid, shirt(c).uuid); assert.equal(p.paddle.parent?.uuid, p.wrists[1].uuid);
});
test('native locomotion deforms skin vertices while leaving the gameplay root intact', () => {
  const actor = createAthlete('player', 5, 0); actor.group.position.x = 1.5;
  const root = actor.group.position.clone(), facing = actor.group.quaternion.clone();
  const mesh = skins(actor)[0], count = mesh.geometry.attributes.position.count;
  const indices = Array.from({ length: 80 }, (_, i) => Math.floor(i * count / 80));
  const before = indices.map(i => mesh.getVertexPosition(i, new Vector3()));
  for (let frame = 0; frame < 30; frame++) animateAthlete(actor, {
    walking: true, phase: frame / 8, swingLeft: 0, shot: 'drive', lateral: 0, forward: -3.8,
    side: 1, ready: true, dt: 1 / 60, time: frame / 60, reduceMotion: false,
  });
  assert.ok(indices.some((index, i) => mesh.getVertexPosition(index, new Vector3()).distanceTo(before[i]) > 0.05));
  assert.ok(actor.group.position.equals(root)); assert.ok(actor.group.quaternion.equals(facing));
  assert.equal(actor.paddle.parent?.uuid, actor.wrists[1].uuid);
  actor.group.traverse(o => assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
});

test('repeated contact and paused frames never accumulate offsets or stretch the skinned torso', () => {
  const actor = createAthlete('player', 3, 0);
  const pose = { contact: new Vector3(0.3, 0.6, 2.5), walking: false, phase: 0, swingLeft: 0, shot: 'dink' as const,
    lateral: 0, side: 1, ready: true, dt: 0, time: 0, reduceMotion: false };
  animateAthlete(actor, pose);
  const torso = actor.chest.getWorldPosition(new Vector3());
  const first = actor.arms[1].quaternion.clone();
  for (let i = 0; i < 60; i++) animateAthlete(actor, pose);
  assert.ok(actor.chest.getWorldPosition(new Vector3()).distanceTo(torso) < 1e-6);
  assert.ok(actor.arms[1].quaternion.angleTo(first) < 1e-6);
  for (let i = 0; i < 60; i++) animateAthlete(actor, { ...pose, dt: 1 / 60 });
  const size = new Box3().setFromObject(actor.model, true).getSize(new Vector3());
  assert.ok(size.y < 2.1 && size.x < 1.7 && size.z < 1.7);
});

test('side steps move the planted rig laterally in opposite directions while backward movement reverses the walk clip', () => {
  function step(lateral: number, forward: number) {
    const actor = createAthlete('player', 3, 0);
    animateAthlete(actor, { walking: true, phase: Math.PI / 2, swingLeft: 0, shot: 'drive', lateral, forward,
      side: 1, ready: false, dt: 0.1, time: 0.1, reduceMotion: false });
    return actor;
  }
  const left = step(-3, 0), right = step(3, 0);
  assert.ok(right.feet[0].getWorldPosition(new Vector3()).x - left.feet[0].getWorldPosition(new Vector3()).x > 0.15);
  assert.ok(step(0, 2).actions.Man_Walk.getEffectiveTimeScale() < 0);
  assert.ok(step(0, -2).actions.Man_Walk.getEffectiveTimeScale() > 0);
});

test('the GLB loader refuses an unskinned replacement and retains the valid template', async () => {
  const invalid = new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0' }, scenes: [{}], scene: 0 }));
  await assert.rejects(installAthleteModel(invalid.buffer), /인체 리그/);
  assert.ok(skins(createAthlete('player', 3, 0)).length > 0);
});
