import * as THREE from 'three';
import { cloneAthleteModel } from './athlete-model.ts';
import { contactBodyOffset } from './volley.ts';
import { swingPose, type SwingMotion } from './swing.ts';
import type { Shot } from './ball.ts';

export type AthleteTeam = 'player' | 'cpu';
export interface Athlete {
  team: AthleteTeam; group: THREE.Group; model: THREE.Object3D;
  body: THREE.Bone; chest: THREE.Bone; head: THREE.Bone;
  legs: THREE.Bone[]; knees: THREE.Bone[]; feet: THREE.Bone[];
  arms: THREE.Bone[]; elbows: THREE.Bone[]; wrists: THREE.Bone[];
  footHome: THREE.Vector3[];
  paddle: THREE.Group; mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  bind: Map<THREE.Bone, { position: THREE.Vector3; quaternion: THREE.Quaternion }>;
}
function paddle(team: AthleteTeam) {
  const group = new THREE.Group(); group.name = 'pickleball-paddle';
  const shape = new THREE.Shape();
  shape.moveTo(-0.065, -0.18); shape.quadraticCurveTo(-0.145, -0.18, -0.145, -0.10);
  shape.lineTo(-0.145, 0.11); shape.quadraticCurveTo(-0.145, 0.19, -0.065, 0.19);
  shape.lineTo(0.065, 0.19); shape.quadraticCurveTo(0.145, 0.19, 0.145, 0.11);
  shape.lineTo(0.145, -0.10); shape.quadraticCurveTo(0.145, -0.18, 0.065, -0.18); shape.closePath();
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.004, bevelSegments: 1, steps: 1, curveSegments: 5 }), new THREE.MeshStandardMaterial({ color: 0x192d38, roughness: 0.75 }));
  blade.position.y = -0.34; group.add(blade);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.027, 0.18, 10), new THREE.MeshStandardMaterial({ color: 0x15191c })); grip.position.y = -0.085; group.add(grip);
  for (const y of [-0.28, -0.38]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.018, 0.004), new THREE.MeshStandardMaterial({ color: y === -0.28 ? 0xffffff : team === 'player' ? 0x4ca6ff : 0xff6a73 }));
    stripe.position.set(0, y, -0.012); group.add(stripe);
  }
  group.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  return group;
}

/** The old primitive avatar is replaced entirely by the artist's skinned GLB mesh. */
export function createAthlete(team: AthleteTeam, z: number, facing: number): Athlete {
  const { scene: model, animations } = cloneAthleteModel();
  const group = new THREE.Group(); group.name = `${team}-athlete`;
  group.position.set(0, 0.045, z); group.rotation.y = facing; group.add(model);
  const bone = (name: string) => {
    const value = model.getObjectByName(name.replaceAll('.', '')) ?? model.getObjectByName(name);
    if (!(value instanceof THREE.Bone)) throw new Error(`캐릭터 관절 누락: ${name}`);
    return value;
  };
  const palette: Record<string, number> = {
    Skin: team === 'player' ? 0xc88b61 : 0xa96e4b, Eyes: 0x191e24, Hair: team === 'player' ? 0x36271e : 0x201c1b,
    Shirt: team === 'player' ? 0x1769c5 : 0xc52e46, Pants: team === 'player' ? 0x183a63 : 0x462b35,
    Socks: 0xecf0ed, Shoes: 0xdde5e8,
  };
  model.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true; object.receiveShadow = true; object.frustumCulled = false;
      const recolor = (source: THREE.Material) => {
        const material = source.clone() as THREE.MeshStandardMaterial;
        if (palette[material.name] !== undefined) material.color.setHex(palette[material.name]);
        material.roughness = 0.85; material.metalness = 0;
        return material;
      };
      object.material = Array.isArray(object.material) ? object.material.map(recolor) : recolor(object.material);
    }
  });
  const mixer = new THREE.AnimationMixer(model);
  const actions = Object.fromEntries(animations.map(clip => [clip.name, mixer.clipAction(clip).play().setEffectiveWeight(clip.name === 'Man_Idle' ? 1 : 0)]));
  mixer.update(0);
  const bind = new Map<THREE.Bone, { position: THREE.Vector3; quaternion: THREE.Quaternion }>();
  model.traverse(object => { if (object instanceof THREE.Bone) bind.set(object, { position: object.position.clone(), quaternion: object.quaternion.clone() }); });
  const wrists = [bone('Palm.L'), bone('Palm.R')];
  const bat = paddle(team); wrists[1].add(bat);
  group.updateWorldMatrix(true, true);
  const worldScale = wrists[1].getWorldScale(new THREE.Vector3()).x;
  bat.scale.setScalar(1 / worldScale); bat.position.y = 0.07 / worldScale; bat.rotation.z = Math.PI;
  group.updateMatrixWorld(true);
  model.traverse(object => { if (object instanceof THREE.SkinnedMesh) { object.skeleton.update(); object.computeBoundingBox(); } });
  return { team, group, model, footHome: [bone('Foot.L').position.clone(), bone('Foot.R').position.clone()], body: bone('Body'), chest: bone('Torso'), head: bone('Head'),
    legs: [bone('UpperLeg.L'), bone('UpperLeg.R')], knees: [bone('LowerLeg.L'), bone('LowerLeg.R')],
    feet: [bone('Foot.L'), bone('Foot.R')], arms: [bone('UpperArm.L'), bone('UpperArm.R')],
    elbows: [bone('LowerArm.L'), bone('LowerArm.R')], wrists, paddle: bat, mixer, actions, bind };
}

export interface AthletePose {
  motion?: SwingMotion; contact?: THREE.Vector3; contactBlend?: number;
  walking: boolean; phase: number; swingLeft: number; shot: Shot;
  lateral: number; forward?: number; side: number; ready: boolean; dt: number; time: number; reduceMotion: boolean;
}

const Y = new THREE.Vector3(0, 1, 0);
function position(object: THREE.Object3D) { return object.getWorldPosition(new THREE.Vector3()); }
/** Aim an actual skinning bone in world space without assuming the artist's bind axes. */
function aimBone(bone: THREE.Bone, current: THREE.Vector3, desired: THREE.Vector3) {
  if (current.lengthSq() < 1e-10 || desired.lengthSq() < 1e-10) return;
  const delta = new THREE.Quaternion().setFromUnitVectors(current.normalize(), desired.normalize());
  const world = delta.multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
  bone.quaternion.copy(bone.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
  bone.updateWorldMatrix(false, true);
}
function offsetBone(actor: Athlete, bone: THREE.Bone, offset: THREE.Vector3) {
  const worldOffset = offset.clone().applyQuaternion(actor.group.getWorldQuaternion(new THREE.Quaternion()));
  const target = position(bone).add(worldOffset);
  bone.position.copy(bone.parent!.worldToLocal(target));
  bone.updateWorldMatrix(false, true);
}
function elbowPoint(origin: THREE.Vector3, target: THREE.Vector3, upper: number, lower: number, pole: THREE.Vector3) {
  const direction = target.clone().sub(origin), distance = direction.length();
  direction.normalize();
  const d = THREE.MathUtils.clamp(distance, Math.abs(lower - upper) + 0.001, upper + lower - 0.001);
  const along = (d * d + upper * upper - lower * lower) / (2 * d);
  const bend = pole.clone().addScaledVector(direction, -pole.dot(direction)).normalize();
  if (bend.lengthSq() < 0.1) bend.set(1, 0, 0);
  return origin.clone().addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, upper * upper - along * along)));
}
function plantedLegs(actor: Athlete, targets: THREE.Vector3[], lengths: number[][]) {
  for (let i = 0; i < 2; i++) {
    const hip = actor.legs[i], knee = actor.knees[i];
    const origin = position(hip), joint = position(knee);
    const pole = new THREE.Vector3(0, 0, -1).applyQuaternion(actor.group.quaternion);
    const desired = elbowPoint(origin, targets[i], lengths[i][0], lengths[i][1], pole);
    aimBone(hip, joint.sub(origin), desired.clone().sub(origin));
    const axis = Y.clone().applyQuaternion(knee.getWorldQuaternion(new THREE.Quaternion()));
    aimBone(knee, axis, targets[i].clone().sub(position(knee)));
  }
}

/** Layer racket contact IK over the GLB's native locomotion and skin weights. */
export function posePaddleContact(actor: Athlete, target: THREE.Vector3, hand = 1, _clampReach = false) {
  actor.group.updateWorldMatrix(true, true);
  const targets = actor.feet.map(position);
  const lengths = actor.legs.map((hip, i) => [position(hip).distanceTo(position(actor.knees[i])), position(actor.knees[i]).distanceTo(targets[i])]);
  const relative = actor.group.worldToLocal(target.clone());
  const offset = contactBodyOffset(relative);
  offsetBone(actor, actor.body, new THREE.Vector3(0, offset.y, 0));
  offsetBone(actor, actor.chest, new THREE.Vector3(offset.x, 0, offset.z));
  plantedLegs(actor, targets, lengths);
  const arm = actor.arms[1], elbow = actor.elbows[1], wrist = actor.wrists[1];
  const origin = position(arm), joint = position(elbow);
  const upper = origin.distanceTo(joint);
  const lower = joint.distanceTo(position(wrist)) + 0.07 + 0.34;
  const pole = new THREE.Vector3(hand, -0.2, 0.35).applyQuaternion(actor.group.quaternion);
  const desired = elbowPoint(origin, target, upper, lower, pole);
  aimBone(arm, joint.sub(origin), desired.clone().sub(origin));
  aimBone(elbow, Y.clone().applyQuaternion(elbow.getWorldQuaternion(new THREE.Quaternion())), target.clone().sub(position(elbow)));
  // Wrist rotates independently; straight alignment keeps the face on the solved contact axis.
  wrist.quaternion.identity(); wrist.updateWorldMatrix(false, true);
}

export function animateAthlete(actor: Athlete, pose: AthletePose) {
  const { walking, phase, lateral, forward = 0, dt, ready } = pose;
  const sideStep = walking && Math.abs(lateral) > Math.abs(forward) * 1.1;
  const run = walking && !sideStep && Math.hypot(lateral, forward) > 2.8;
  const blend = 1 - Math.exp(-14 * dt);
  const desired: Record<string, number> = { Man_Idle: walking ? 0 : 1, Man_Walk: walking && !run ? 1 : 0, Man_Run: run ? 1 : 0 };
  for (const [name, action] of Object.entries(actor.actions)) {
    action.setEffectiveWeight(THREE.MathUtils.lerp(action.getEffectiveWeight(), desired[name] ?? 0, blend));
    action.setEffectiveTimeScale(name === 'Man_Idle' ? 1 : forward > 0.3 ? -0.9 : sideStep ? 0.85 : 1);
  }
  // glTF omits static tracks. Undo last frame's IK layer before advancing the mixer,
  // otherwise unkeyed torso/finger offsets accumulate and stretch the skinned mesh.
  for (const [bone, base] of actor.bind) { bone.position.copy(base.position); bone.quaternion.copy(base.quaternion); }
  actor.mixer.update(dt);
  for (const [bone, base] of actor.bind) { base.position.copy(bone.position); base.quaternion.copy(bone.quaternion); }
  if (sideStep) {
    actor.group.updateWorldMatrix(true, true);
    const lengths = actor.legs.map((hip, i) => [position(hip).distanceTo(position(actor.knees[i])), position(actor.knees[i]).distanceTo(position(actor.feet[i]))]);
    for (let i = 0; i < 2; i++) {
      const step = Math.sin(phase + i * Math.PI);
      actor.feet[i].position.lerp(actor.footHome[i], 0.75);
      offsetBone(actor, actor.feet[i], new THREE.Vector3(step * 0.10 * Math.sign(lateral), Math.max(0, step) * 0.035, 0));
    }
    plantedLegs(actor, actor.feet.map(position), lengths);
  }
  if (ready || walking) {
    // Relaxed sports stance instead of the source animation's empty, straight hands.
    for (let i = 0; i < 2; i++) {
      const arm = actor.arms[i], elbow = actor.elbows[i];
      const target = actor.group.localToWorld(new THREE.Vector3(i ? 0.30 : -0.30, 1.03, -0.18));
      aimBone(arm, position(elbow).sub(position(arm)), target.sub(position(arm)));
    }
  }
  // Curl the artist's skinned fingers around the paddle handle.
  for (const [name, angle] of [['MiddleHandR', 0.4], ['FingersR', 0.7], ['Thumb1R', -0.35]] as const) {
    const finger = actor.model.getObjectByName(name); if (finger) finger.rotateX(angle);
  }
  if (pose.motion?.active || pose.contact) {
    const motion = pose.motion?.active ? swingPose(pose.motion, actor.team === 'cpu') : null;
    const target = motion ? actor.group.localToWorld(motion.target.clone()) : pose.contact!;
    const bones = [...actor.bind.keys()];
    const before = bones.map(bone => ({ q: bone.quaternion.clone(), p: bone.position.clone() }));
    if (motion) { actor.chest.rotateY(motion.twist); actor.head.rotateY(-motion.twist * 0.35); }
    posePaddleContact(actor, target, motion?.hand ?? pose.side, true);
    const weight = motion ? motion.recovery : pose.contactBlend ?? 1;
    bones.forEach((bone, i) => {
      bone.quaternion.slerpQuaternions(before[i].q, bone.quaternion.clone(), weight);
      bone.position.lerpVectors(before[i].p, bone.position.clone(), weight);
    });
  }
  actor.group.updateMatrixWorld(true);
  actor.model.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); });
}
