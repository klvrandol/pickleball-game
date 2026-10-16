import { createRanger, animateRanger, rangerContact } from './ranger.ts';
import * as THREE from 'three';
import { cloneAthleteModel, type AthleteStyle } from './athlete-model.ts';
import { contactBodyOffset } from './volley.ts';
import { SWING_PROFILES, sampleSwingKey, swingProfile, type SwingId, type SwingKey } from './swing-keyframes.ts';
import { swingPose, type SwingMotion } from './swing.ts';
import type { Shot } from './ball.ts';

export type AthleteTeam = 'player' | 'cpu';
interface RigTrack { bone: THREE.Bone; property: 'position' | 'quaternion'; sampler: THREE.Interpolant }
export interface Athlete {
  style: AthleteStyle; paddleReach: number;
  team: AthleteTeam; group: THREE.Group; model: THREE.Object3D;
  body: THREE.Bone; chest: THREE.Bone; head: THREE.Bone;
  legs: THREE.Bone[]; knees: THREE.Bone[]; feet: THREE.Bone[];
  arms: THREE.Bone[]; elbows: THREE.Bone[]; wrists: THREE.Bone[];
  footHome: THREE.Vector3[];
  swingRig?: { clips: Record<SwingId, THREE.AnimationClip>; tracks: Record<SwingId, RigTrack[]> };
  footLock?: { serial: number; points: THREE.Vector3[]; moving: boolean };
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
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.004, bevelSegments: 1, steps: 1, curveSegments: 5 }), new THREE.MeshStandardMaterial({ color: team === 'cpu' ? 0xfff0d7 : 0x192d38, roughness: 0.75 }));
  blade.position.y = -0.34; group.add(blade);
  if (team === 'cpu') {
    const edge = new THREE.Mesh(blade.geometry, new THREE.MeshStandardMaterial({ color: 0x532039, roughness: .8 }));
    edge.name='paddle-contrast-edge';edge.position.set(0,-.34,-.004);edge.scale.set(1.12,1.10,.85);group.add(edge);
  }
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.027, 0.18, 10), new THREE.MeshStandardMaterial({ color: 0x15191c })); grip.position.y = -0.085; group.add(grip);
  for (const y of [-0.28, -0.38]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.018, 0.004), new THREE.MeshStandardMaterial({ color: team === 'cpu' ? y === -.28 ? 0x8f2139 : 0xe74c55 : y === -.28 ? 0xffffff : 0x4ca6ff }));
    stripe.position.set(0, y, -0.012); group.add(stripe);
    if(team === 'cpu'){const front=stripe.clone();front.position.z=.029;group.add(front);}
  }
  group.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  return group;
}

/** The old primitive avatar is replaced entirely by the artist's skinned GLB mesh. */
export function createAthlete(team: AthleteTeam, z: number, facing: number, style: AthleteStyle = team === 'player' ? 'sd' : 'classic'): Athlete {
  if (style === 'ranger' || style === 'barbarian') return createRanger(team, z, facing, paddle(team), style);
  const { scene: model, animations } = cloneAthleteModel(style);
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
  bat.scale.setScalar((style === 'sd' ? 1.18 : 1) / worldScale); bat.position.y = 0.07 / worldScale; bat.rotation.z = Math.PI;
  group.updateMatrixWorld(true);
  model.traverse(object => { if (object instanceof THREE.SkinnedMesh) { object.skeleton.update(); object.computeBoundingBox(); } });
  const actor: Athlete = { style, paddleReach: .07 + .34 * (style === 'sd' ? 1.18 : 1), team, group, model, footHome: [bone('Foot.L').position.clone(), bone('Foot.R').position.clone()], body: bone('Body'), chest: bone('Torso'), head: bone('Head'),
    legs: [bone('UpperLeg.L'), bone('UpperLeg.R')], knees: [bone('LowerLeg.L'), bone('LowerLeg.R')],
    feet: [bone('Foot.L'), bone('Foot.R')], arms: [bone('UpperArm.L'), bone('UpperArm.R')],
    elbows: [bone('LowerArm.L'), bone('LowerArm.R')], wrists, paddle: bat, mixer, actions, bind };
  actor.swingRig = createSwingRig(actor);
  return actor;
}

export interface AthletePose {
  motion?: SwingMotion; incoming?: { ball: THREE.Vector3; volley: boolean; shot: Shot }; contact?: THREE.Vector3; contactBlend?: number;
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
  bone.quaternion.copy(bone.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world)).normalize();
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
export function posePaddleContact(actor: Athlete, target: THREE.Vector3, hand = 1, _clampReach = false, wristPose = new THREE.Quaternion(), armOnly = false) {
  if (actor.style === 'ranger' || actor.style === 'barbarian') { rangerContact(actor, target); return; }
  actor.group.updateWorldMatrix(true, true);
  const targets = actor.feet.map(position);
  const lengths = actor.legs.map((hip, i) => [position(hip).distanceTo(position(actor.knees[i])), position(actor.knees[i]).distanceTo(targets[i])]);
  const relative = actor.group.worldToLocal(target.clone());
  const offset = contactBodyOffset(relative);
  if (!armOnly) {
    offsetBone(actor, actor.body, new THREE.Vector3(0, offset.y, 0));
    offsetBone(actor, actor.chest, new THREE.Vector3(offset.x, 0, offset.z));
    plantedLegs(actor, targets, lengths);
  }
  const arm = actor.arms[1], elbow = actor.elbows[1], wrist = actor.wrists[1];
  if (actor.style === 'sd') {
    const reach = position(arm).distanceTo(position(elbow)) + position(elbow).distanceTo(position(wrist)) + actor.paddleReach;
    const over = position(arm).distanceTo(target) - reach + .01;
    if (over > 0) {
      const leanWorld = target.clone().sub(position(arm)).normalize().multiplyScalar(Math.min(.20,over));
      const local = leanWorld.applyQuaternion(actor.group.quaternion.clone().invert());
      offsetBone(actor,actor.chest,local);
    }
  }
  const origin = position(arm), joint = position(elbow);
  const upper = origin.distanceTo(joint);
  const scale = wrist.getWorldScale(new THREE.Vector3()).x;
  let solvedWrist = wristPose.clone();
  const vectorAt = (q: THREE.Quaternion) => new THREE.Vector3(0, actor.paddleReach / scale, 0).applyQuaternion(q).add(wrist.position);
  let faceVector = vectorAt(solvedWrist);
  if (actor.style === 'sd') {
    // Short arms + a larger paddle need a sideways wrist fold for close contacts.
    // Solve this visual wrist angle instead of changing the existing hit envelope.
    const desiredLower = origin.distanceTo(target) + upper - .005;
    if (faceVector.length()*scale > desiredLower) {
      let low = 0, high = 2.75;
      for (let i=0;i<20;i++) {
        const angle=(low+high)/2;
        const q=wristPose.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),angle*hand));
        if(vectorAt(q).length()*scale > desiredLower) low=angle; else high=angle;
      }
      solvedWrist = wristPose.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),high*hand));
      faceVector = vectorAt(solvedWrist);
    }
  }
  const lower = faceVector.length() * scale;
  const pole = new THREE.Vector3(hand, -0.2, 0.35).applyQuaternion(actor.group.quaternion);
  const desired = elbowPoint(origin, target, upper, lower, pole);
  aimBone(arm, joint.sub(origin), desired.clone().sub(origin));
  aimBone(elbow, faceVector.clone().applyQuaternion(elbow.getWorldQuaternion(new THREE.Quaternion())), target.clone().sub(position(elbow)));
  // Wrist rotates independently; straight alignment keeps the face on the solved contact axis.
  wrist.quaternion.copy(solvedWrist); wrist.updateWorldMatrix(false, true);
}

export function animateAthlete(actor: Athlete, pose: AthletePose) {
  if (actor.style === 'ranger' || actor.style === 'barbarian') { animateRanger(actor, pose); return; }
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
  if (actor.style === 'sd' && !pose.motion?.active) {
    actor.group.updateWorldMatrix(true, true);
    const feet = actor.feet.map(position);
    const lengths = actor.legs.map((hip, i) => [position(hip).distanceTo(position(actor.knees[i])), position(actor.knees[i]).distanceTo(feet[i])]);
    offsetBone(actor, actor.body, new THREE.Vector3(0,-.045,0));
    plantedLegs(actor,feet,lengths);
    const target = actor.group.localToWorld(new THREE.Vector3(.34,1.0,-.40));
    posePaddleContact(actor,target,1,true,new THREE.Quaternion(),true);
  }
  // Curl the artist's skinned fingers around the paddle handle.
  for (const [name, angle] of [['MiddleHandR', 0.4], ['FingersR', 0.7], ['Thumb1R', -0.35], ['MiddleHandL', .18], ['FingersL', .32]] as const) {
    const finger = actor.model.getObjectByName(name); if (finger) finger.rotateX(angle);
  }
  const motion = pose.motion?.active ? pose.motion : null;
  if (motion) {
    const profile = swingProfile(motion.hand, motion.kind), time = motion.clipTime;
    const ease = (v: number) => { const x = THREE.MathUtils.clamp(v, 0, 1); return x*x*(3-2*x); };
    const weight = ease(time / .13) * ease((1-time) / .18);
    actor.group.updateWorldMatrix(true, true);
    const nativeFeet = actor.feet.map(position);
    if (!actor.footLock || actor.footLock.serial !== motion.serial || actor.footLock.moving !== walking) {
      actor.footLock = { serial: motion.serial, points: nativeFeet.map(p => p.clone()), moving: walking };
    }
    const feet = walking ? nativeFeet : actor.footLock.points.map(p => p.clone());
    if (!walking) feet[motion.hand === 'forehand' ? 1 : 0].y += sampleSwingKey(profile, time).heel * weight;
    const lengths = actor.legs.map((hip, i) => [position(hip).distanceTo(position(actor.knees[i])), position(actor.knees[i]).distanceTo(nativeFeet[i])]);
    applySwingTracks(actor, profile.id, time, weight, walking);
    const heightDrop = Math.min(.30, Math.max(0, 1.1-motion.contact.y)*.55)*weight;
    offsetBone(actor, actor.body, new THREE.Vector3(0, -heightDrop, 0));
    // Rotate the authored arm arc for high/low balls before the narrow impact correction.
    actor.group.updateWorldMatrix(true, true);
    const origin = position(actor.arms[1]);
    const arc = actor.paddle.localToWorld(new THREE.Vector3(0,-.34,0)).sub(origin);
    const adapted = arc.clone().add(new THREE.Vector3(0,(motion.contact.y-1.15+heightDrop)*.75*weight,0));
    aimBone(actor.arms[1], arc, adapted);
    actor.chest.rotateY(motion.aimYaw * weight * .45);
    actor.head.rotateY(-motion.aimYaw * weight * .20);
    actor.group.updateWorldMatrix(true, true);
    // Foot targets stay grounded in a standing stroke. Moving strokes retain native gait targets.
    actor.feet.forEach((foot, i) => {
      foot.position.copy(foot.parent!.worldToLocal(feet[i].clone()));
      foot.updateWorldMatrix(false, true);
    });
    plantedLegs(actor, feet, lengths);
    // IK is a narrow contact correction, not the source of the backswing/follow-through.
    const contactWeight = time <= .5 ? ease((time-.37)/.13) : 1-ease((time-.5)/.13);
    if (contactWeight > 0) {
      const sample = sampleSwingKey(profile, time);
      const wrist = new THREE.Quaternion().setFromEuler(new THREE.Euler(...sample.wrist));
      const target = actor.group.localToWorld(swingPose(motion).target);
      const joints = [actor.arms[1], actor.elbows[1], actor.wrists[1]];
      const before = joints.map(bone => bone.quaternion.clone());
      // A small visual torso reach accommodates off-centre contacts without moving gameplay feet.
      const reach = contactBodyOffset(motion.contact);
      offsetBone(actor, actor.chest, new THREE.Vector3(reach.x, 0, reach.z).multiplyScalar(contactWeight));
      posePaddleContact(actor, target, motion.hand === 'forehand' ? 1 : -1, true, wrist, true);
      joints.forEach((bone, i) => bone.quaternion.slerpQuaternions(before[i], bone.quaternion.clone(), contactWeight));
    }
  } else if (pose.contact) {
    posePaddleContact(actor, pose.contact, pose.side);
  } else if (pose.incoming) {
    const local = actor.group.worldToLocal(pose.incoming.ball.clone());
    const anticipation = swingProfile(local.x >= 0 ? 'forehand' : 'backhand', pose.incoming.volley ? 'volley' : pose.incoming.shot);
    const proximity = THREE.MathUtils.clamp((2.5 - Math.hypot(local.x, local.z)) / 1.4, 0, 1);
    applySwingTracks(actor, anticipation.id, .18, proximity*.32, walking);
  }
  actor.group.updateMatrixWorld(true);
  actor.model.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); });
}

const swingClipCache: Partial<Record<AthleteStyle, Record<SwingId, THREE.AnimationClip>>> = {};
function restoreBase(actor: Athlete) {
  for (const [bone, base] of actor.bind) { bone.position.copy(base.position); bone.quaternion.copy(base.quaternion); }
  actor.group.updateWorldMatrix(true, true);
}
function authorPose(actor: Athlete, key: SwingKey, hand: number) {
  const feet = actor.feet.map(position);
  const lengths = actor.legs.map((hip, i) => [position(hip).distanceTo(position(actor.knees[i])), position(actor.knees[i]).distanceTo(feet[i])]);
  const exaggeration = actor.style === 'sd' ? 1.18 : 1;
  actor.body.rotateY(key.chain[0] * exaggeration);
  const spine = actor.model.getObjectByName('Abdomen')!; spine.rotateY(key.chain[1] * exaggeration);
  actor.chest.rotateY(key.chain[2] * exaggeration);
  actor.head.rotateY(-key.chain[1]*.32);
  const shoulder = actor.model.getObjectByName('ShoulderR')!; shoulder.rotateY(key.chain[2]*.45);
  offsetBone(actor, actor.body, new THREE.Vector3(key.lower[1], key.lower[0], key.lower[2]));
  const wrist = new THREE.Quaternion().setFromEuler(new THREE.Euler(...key.wrist));
  posePaddleContact(actor, actor.group.localToWorld(new THREE.Vector3(...key.paddle)), hand, true, wrist, true);
  // Counterbalance with the free arm; backhands gather it in front before opening out.
  const arm = actor.arms[0], elbow = actor.elbows[0], wristLeft = actor.wrists[0];
  const support = actor.group.localToWorld(new THREE.Vector3(-.25+key.support*.18, 1.0+key.support*.25, -.10-key.support*.25));
  const origin = position(arm), joint = position(elbow);
  const freeElbow = elbowPoint(origin, support, origin.distanceTo(joint), joint.distanceTo(position(wristLeft)),
    new THREE.Vector3(0,-1,.15).applyQuaternion(actor.group.quaternion));
  aimBone(arm, joint.sub(origin), freeElbow.sub(origin));
  aimBone(elbow, Y.clone().applyQuaternion(elbow.getWorldQuaternion(new THREE.Quaternion())), support.sub(position(elbow)));
  wristLeft.rotateY(-key.support*.10);
  feet.forEach((target, i) => {
    target.y += i === (hand > 0 ? 1 : 0) ? key.heel : 0;
    actor.feet[i].position.copy(actor.feet[i].parent!.worldToLocal(target.clone()));
  });
  plantedLegs(actor, feet, lengths);
}
function createSwingRig(actor: Athlete) {
  let cachedSwingClips = swingClipCache[actor.style];
  if (!cachedSwingClips) {
    const clips = {} as Record<SwingId, THREE.AnimationClip>;
    for (const profile of SWING_PROFILES) {
      const bones = [...actor.bind.keys()];
      const values = bones.map(() => ({ q: [] as number[], p: [] as number[] }));
      const times = Array.from({ length: 61 }, (_, i) => i / 60);
      for (const time of times) {
        restoreBase(actor);
        if (time > 0 && time < 1) authorPose(actor, sampleSwingKey(profile, time), profile.hand === 'forehand' ? 1 : -1);
        bones.forEach((bone, i) => {
          const base = actor.bind.get(bone)!;
          const q = base.quaternion.clone().invert().multiply(bone.quaternion);
          values[i].q.push(...q.toArray()); values[i].p.push(...bone.position.clone().sub(base.position).toArray());
        });
      }
      const tracks = bones.flatMap((bone, i) => [
        new THREE.QuaternionKeyframeTrack(bone.name+'.quaternion', times, values[i].q),
        new THREE.VectorKeyframeTrack(bone.name+'.position', times, values[i].p),
      ]);
      clips[profile.id] = new THREE.AnimationClip(profile.id, 1, tracks);
    }
    cachedSwingClips = clips; swingClipCache[actor.style] = clips;
    restoreBase(actor);
  }
  const tracks = {} as Record<SwingId, RigTrack[]>;
  for (const profile of SWING_PROFILES) tracks[profile.id] = cachedSwingClips![profile.id].tracks.map(track => {
    const [name, property] = track.name.split('.');
    return { bone: actor.model.getObjectByName(name) as THREE.Bone, property: property as 'position' | 'quaternion', sampler: track.InterpolantFactoryMethodLinear() };
  });
  return { clips: cachedSwingClips, tracks };
}
function applySwingTracks(actor: Athlete, id: SwingId, time: number, weight: number, moving: boolean) {
  for (const track of actor.swingRig!.tracks[id]) {
    const value = track.sampler.evaluate(time);
    const lower = actor.legs.includes(track.bone) || actor.knees.includes(track.bone) || actor.feet.includes(track.bone);
    const w = weight * (moving && lower ? .22 : 1) * (actor.team === 'cpu' ? .96 : 1);
    if (track.property === 'quaternion') {
      const delta = new THREE.Quaternion().fromArray(value).normalize();
      track.bone.quaternion.multiply(new THREE.Quaternion().slerp(delta, w)).normalize();
    } else track.bone.position.addScaledVector(new THREE.Vector3().fromArray(value), w);
  }
}
