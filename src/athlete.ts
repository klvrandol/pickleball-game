import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { contactBodyOffset } from './volley.ts';
import { swingPose, type SwingMotion } from './swing.ts';
import type { Shot } from './ball.ts';

export type AthleteTeam = 'player' | 'cpu';
const sphere = new THREE.SphereGeometry(1, 12, 8);
const rounded = new RoundedBoxGeometry(1, 1, 1, 2, 0.14);
const capsule = new THREE.CapsuleGeometry(1, 1, 3, 10);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
const collar = new THREE.TorusGeometry(1, 0.16, 5, 16);
const gripRing = new THREE.TorusGeometry(0.026, 0.004, 4, 12);
const hair = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, 1.23);
const shirt = new THREE.LatheGeometry([
  new THREE.Vector2(0, 0), new THREE.Vector2(0.16, 0), new THREE.Vector2(0.18, 0.04),
  new THREE.Vector2(0.18, 0.16), new THREE.Vector2(0.20, 0.34), new THREE.Vector2(0.215, 0.43),
  new THREE.Vector2(0.195, 0.49), new THREE.Vector2(0.115, 0.53), new THREE.Vector2(0, 0.53),
], 16);
const shirtPanel = new THREE.LatheGeometry([
  new THREE.Vector2(0.18, 0.04), new THREE.Vector2(0.18, 0.16),
  new THREE.Vector2(0.20, 0.34), new THREE.Vector2(0.215, 0.43),
], 4, Math.PI / 2 - 0.17, 0.34);
const bladeShape = new THREE.Shape();
bladeShape.moveTo(-0.07, -0.18);
bladeShape.quadraticCurveTo(-0.145, -0.18, -0.145, -0.11);
bladeShape.lineTo(-0.145, 0.12);
bladeShape.quadraticCurveTo(-0.145, 0.19, -0.075, 0.19);
bladeShape.lineTo(0.075, 0.19);
bladeShape.quadraticCurveTo(0.145, 0.19, 0.145, 0.12);
bladeShape.lineTo(0.145, -0.11);
bladeShape.quadraticCurveTo(0.145, -0.18, 0.07, -0.18);
bladeShape.closePath();
const blade = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.025, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.006, bevelSegments: 1, steps: 1, curveSegments: 4 });
const bladeFace = new THREE.ShapeGeometry(bladeShape, 4);

export interface Athlete {
  team: AthleteTeam;
  group: THREE.Group;
  body: THREE.Group;
  chest: THREE.Group;
  head: THREE.Group;
  legs: THREE.Group[];
  knees: THREE.Group[];
  feet: THREE.Group[];
  arms: THREE.Group[];
  elbows: THREE.Group[];
  paddle: THREE.Group;
}

/** A lightweight, jointed athlete facing local -Z. Root position remains gameplay-owned. */
export function createAthlete(team: AthleteTeam, z: number, facing: number): Athlete {
  const isPlayer = team === 'player';
  const colors = {
    jersey: isPlayer ? 0x1769c5 : 0xc52e46,
    dark: isPlayer ? 0x163a65 : 0x472735,
    accent: isPlayer ? 0x8dc9f5 : 0xf49da5,
    shorts: isPlayer ? 0x163452 : 0x30323d,
    white: 0xf0f5f2, skin: isPlayer ? 0xdca67e : 0xc88b65,
    hair: isPlayer ? 0x493629 : 0x292526, sole: 0xcbd6db, black: 0x182732,
  };
  const materials = Object.fromEntries(Object.entries(colors).map(([key, color]) => [key, new THREE.MeshStandardMaterial({ color, roughness: key === 'black' ? 0.55 : 0.85 })])) as Record<keyof typeof colors, THREE.MeshStandardMaterial>;
  const group = new THREE.Group(); group.name = `${team}-athlete`;
  group.position.set(0, 0.045, z); group.rotation.y = facing;
  const body = new THREE.Group(); group.add(body);
  const chest = new THREE.Group(); body.add(chest);
  function part(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: keyof typeof colors,
    x: number, y: number, z: number, sx: number, sy: number, sz: number, cast = true) {
    const mesh = new THREE.Mesh(geometry, materials[color]);
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    mesh.castShadow = cast; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function soft(parent: THREE.Object3D, color: keyof typeof colors, x: number, y: number, z: number, w: number, h: number, d: number, cast = true) {
    return part(parent, rounded, color, x, y, z, w, h, d, cast);
  }
  function limb(parent: THREE.Object3D, color: keyof typeof colors, y: number, length: number, width: number, depth: number) {
    return part(parent, capsule, color, 0, y, 0, width / 2, length / 3, depth / 2);
  }
  // Fitted curved jersey, contrasting side panels, collar and hem.
  part(chest, shirt, 'jersey', 0, 0.94, 0, 1.15, 1, 0.74).name = 'sports-shirt';
  for (const side of [-1, 1]) {
    part(chest, shirtPanel, isPlayer ? 'accent' : 'white', 0, 0.94, 0, 1.163, 1, 0.752, false).rotation.y = side === 1 ? 0 : Math.PI;
    soft(chest, 'white', side * 0.13, 1.35, -0.132, 0.065, 0.015, 0.008, false).rotation.z = side * 0.22;
  }
  part(chest, cylinder, 'skin', 0, 1.48, 0, 0.065, 0.13, 0.065);
  const neckTrim = part(chest, collar, 'dark', 0, 1.465, 0, 0.077, 0.077, 0.077, false); neckTrim.rotation.x = Math.PI / 2;
  soft(chest, 'dark', 0, 0.958, 0, 0.38, 0.025, 0.25, false);
  soft(chest, 'white', -0.10, 1.31, -0.145, 0.05, 0.032, 0.01, false);
  // Shirt number, visible on the back. Geometry avoids font/image downloads.
  for (const offset of [-0.038, 0.038]) soft(chest, 'white', 0.038, 1.20 + offset, 0.147, 0.018, 0.068, 0.012, false);
  if (!isPlayer) soft(chest, 'white', 0, 1.28, 0.143, 0.094, 0.018, 0.012, false);
  soft(chest, 'accent', 0, 1.355, 0.15, 0.16, 0.014, 0.009, false);
  soft(body, 'shorts', 0, 0.875, 0, 0.37, 0.18, 0.265);
  soft(body, 'dark', 0, 0.95, -0.002, 0.38, 0.035, 0.265, false);
  for (const side of [-1, 1]) soft(body, 'white', side * 0.025, 0.904, -0.143, 0.008, 0.055, 0.008, false).rotation.z = side * 0.25;

  const head = new THREE.Group(); head.position.y = 1.70; chest.add(head);
  part(head, sphere, 'skin', 0, 0, 0, 0.151, 0.193, 0.146);
  for (const side of [-1, 1]) {
    part(head, sphere, 'skin', side * 0.15, -0.005, 0, 0.033, 0.05, 0.031);
    part(head, sphere, 'black', side * 0.055, 0.035, -0.136, 0.013, 0.019, 0.009, false);
    soft(head, 'hair', side * 0.055, 0.069, -0.136, 0.037, 0.01, 0.009, false).rotation.z = side * 0.08;
  }
  part(head, sphere, 'skin', 0, -0.008, -0.146, 0.025, 0.034, 0.031);
  soft(head, 'hair', 0, -0.073, -0.132, 0.042, 0.009, 0.007, false);
  part(head, hair, 'hair', 0, 0.005, 0.008, 0.163, 0.20, 0.155);
  if (isPlayer) {
    part(head, hair, 'dark', 0, 0.025, 0, 0.175, 0.186, 0.169);
    soft(head, 'jersey', 0, 0.102, -0.167, 0.29, 0.022, 0.21);
    soft(head, 'white', 0, 0.166, -0.12, 0.045, 0.018, 0.008, false);
  } else {
    part(head, cylinder, 'white', 0, 0.092, 0, 0.16, 0.046, 0.15, false);
    soft(head, 'jersey', 0, 0.092, -0.153, 0.07, 0.025, 0.008, false);
  }

  const knees: THREE.Group[] = [], feet: THREE.Group[] = [];
  const legs = [-1, 1].map(side => {
    const hip = new THREE.Group(); hip.position.set(side * 0.112, 0.9, 0); body.add(hip);
    limb(hip, 'skin', -0.18, 0.38, 0.15, 0.15);
    soft(hip, 'shorts', 0, -0.09, 0, 0.205, 0.28, 0.25);
    soft(hip, 'jersey', side * 0.092, -0.10, 0, 0.018, 0.23, 0.22, false);
    soft(hip, 'accent', 0, -0.223, -0.02, 0.19, 0.018, 0.22, false);
    const knee = new THREE.Group(); knee.position.y = -0.37; hip.add(knee); knees.push(knee);
    part(knee, sphere, 'skin', 0, 0, 0, 0.066, 0.064, 0.065);
    limb(knee, 'skin', -0.155, 0.34, 0.12, 0.125);
    part(knee, cylinder, 'white', 0, -0.285, 0, 0.065, 0.095, 0.067);
    part(knee, cylinder, 'jersey', 0, -0.25, 0, 0.066, 0.014, 0.068, false);
    const ankle = new THREE.Group(); ankle.position.y = -0.35; knee.add(ankle); feet.push(ankle);
    soft(ankle, 'sole', 0, -0.155, -0.055, 0.20, 0.045, 0.35);
    soft(ankle, 'white', 0, -0.087, -0.055, 0.186, 0.12, 0.32);
    soft(ankle, 'dark', 0, -0.056, -0.065, 0.075, 0.025, 0.13, false);
    soft(ankle, 'jersey', 0, -0.08, 0.075, 0.17, 0.075, 0.075, false);
    for (const z of [-0.04, -0.08, -0.12]) soft(ankle, 'white', 0, -0.034, z, 0.105, 0.009, 0.012, false);
    for (const edge of [-1, 1]) soft(ankle, 'jersey', edge * 0.093, -0.08, -0.06, 0.01, 0.025, 0.105, false).rotation.x = -0.3;
    return hip;
  });
  const elbows: THREE.Group[] = [];
  const arms = [-1, 1].map(side => {
    const shoulder = new THREE.Group(); shoulder.position.set(side * 0.265, 1.365, 0); chest.add(shoulder);
    limb(shoulder, 'skin', -0.13, 0.29, 0.12, 0.13);
    part(shoulder, cylinder, 'jersey', 0, -0.08, 0, 0.085, 0.16, 0.09);
    part(shoulder, sphere, 'jersey', 0, -0.015, 0, 0.085, 0.07, 0.09);
    part(shoulder, cylinder, isPlayer ? 'accent' : 'white', 0, -0.155, 0, 0.086, 0.022, 0.091, false);
    const elbow = new THREE.Group(); elbow.position.y = -0.26; shoulder.add(elbow); elbows.push(elbow);
    part(elbow, sphere, 'skin', 0, 0, 0, 0.053, 0.055, 0.054);
    limb(elbow, 'skin', -0.115, 0.26, 0.105, 0.115);
    part(elbow, cylinder, isPlayer ? 'white' : 'dark', 0, -0.19, 0, 0.057, 0.06, 0.059, false);
    part(elbow, sphere, 'skin', 0, -0.265, -0.005, 0.058, 0.076, 0.046);
    part(elbow, sphere, 'skin', -side * 0.043, -0.25, -0.025, 0.025, 0.046, 0.027, false);
    return shoulder;
  });
  const paddle = new THREE.Group(); paddle.name = 'pickleball-paddle';
  paddle.position.set(0, -0.27, -0.012); elbows[1].add(paddle);
  part(paddle, cylinder, 'black', 0, -0.075, 0, 0.026, 0.19, 0.026);
  for (let y = -0.01; y > -0.15; y -= 0.03) {
    const wrap = part(paddle, gripRing, 'accent', 0, y, 0, 1, 1, 1, false); wrap.rotation.x = Math.PI / 2;
  }
  part(paddle, blade, 'black', 0, -0.34, -0.0125, 1, 1, 1);
  for (const z of [-0.023, 0.036]) {
    const face = part(paddle, bladeFace, 'dark', 0, -0.34, z, 0.91, 0.91, 1, false);
    face.material = materials.dark.clone(); face.material.side = THREE.DoubleSide;
    soft(paddle, 'jersey', 0, -0.37, z + Math.sign(z) * 0.002, 0.23, 0.035, 0.005, false).rotation.z = -0.4;
    soft(paddle, 'white', 0, -0.28, z + Math.sign(z) * 0.002, 0.075, 0.012, 0.005, false);
  }
  return { team, group, body, chest, head, legs, knees, feet, arms, elbows, paddle };
}

export interface AthletePose {
  motion?: SwingMotion;
  contact?: THREE.Vector3; contactBlend?: number;
  walking: boolean; phase: number; swingLeft: number; shot: Shot;
  lateral: number; side: number; ready: boolean; dt: number; time: number; reduceMotion: boolean;
}
export function animateAthlete(actor: Athlete, pose: AthletePose) {
  const { walking, phase, swingLeft, shot, lateral, side, ready, dt, time, reduceMotion } = pose;
  const blend = 1 - Math.exp(-18 * dt);
  const swing = swingLeft > 0 ? Math.sin((1 - Math.min(1, swingLeft / 0.32)) * Math.PI) : 0;
  for (let i = 0; i < 2; i++) {
    const stride = walking ? Math.sin(phase + i * Math.PI) : 0;
    actor.legs[i].rotation.x = THREE.MathUtils.lerp(actor.legs[i].rotation.x, stride * 0.32 + (ready ? 0.035 : 0), blend);
    actor.knees[i].rotation.x = THREE.MathUtils.lerp(actor.knees[i].rotation.x, -Math.max(0, -stride) * 0.65 - (ready ? 0.07 : 0), blend);
    actor.feet[i].rotation.x = THREE.MathUtils.lerp(actor.feet[i].rotation.x, Math.max(0, -stride) * 0.20, blend);
    actor.elbows[i].rotation.x = THREE.MathUtils.lerp(actor.elbows[i].rotation.x, 0.17 + (ready ? 0.18 : 0) + (i === 1 ? swing * 0.25 : 0), blend);
  }
  actor.arms[0].rotation.z *= 1 - blend;
  actor.arms[1].rotation.y *= 1 - blend;
  for (const elbow of actor.elbows) { elbow.rotation.y *= 1 - blend; elbow.rotation.z *= 1 - blend; }
  actor.arms[0].rotation.x = THREE.MathUtils.lerp(actor.arms[0].rotation.x, Math.sin(phase) * (walking ? -0.18 : 0) + 0.12, blend);
  actor.arms[1].rotation.x = THREE.MathUtils.lerp(actor.arms[1].rotation.x, 0.22 + swing * (shot === 'drive' ? 1.65 : 0.85), blend);
  actor.arms[1].rotation.z = THREE.MathUtils.lerp(actor.arms[1].rotation.z, side * swing * 0.40, blend);
  actor.chest.rotation.y = THREE.MathUtils.lerp(actor.chest.rotation.y, side * swing * (shot === 'drive' ? 0.32 : 0.14), blend);
  actor.head.rotation.y = -actor.chest.rotation.y * 0.45;
  actor.body.rotation.z = THREE.MathUtils.lerp(actor.body.rotation.z, -lateral * 0.014, blend);
  actor.body.position.y = THREE.MathUtils.lerp(actor.body.position.y, reduceMotion ? 0 : (walking ? Math.abs(Math.sin(phase)) * 0.018 : Math.sin(time * 2.4) * 0.005), blend);
  actor.chest.position.x *= 1 - blend; actor.chest.position.z *= 1 - blend;
  if (pose.motion?.active) {
    const motion = swingPose(pose.motion, actor.team === 'cpu');
    actor.chest.rotation.y = motion.twist;
    actor.head.rotation.y = -motion.twist * 0.45;
    actor.arms[0].rotation.x = 0.2 + motion.support * motion.recovery;
    actor.arms[0].rotation.z = -motion.hand * 0.22 * motion.recovery;
    const arm = actor.arms[1].quaternion.clone(), elbow = actor.elbows[1].quaternion.clone();
    const body = actor.body.position.clone(), chest = actor.chest.position.clone();
    const joints = [...actor.legs, ...actor.knees, ...actor.feet];
    const rotations = joints.map(joint => joint.quaternion.clone());
    actor.group.updateWorldMatrix(true, false);
    const target = actor.group.localToWorld(motion.target.clone());
    posePaddleContact(actor, target, motion.hand, true);
    const weight = motion.recovery;
    actor.arms[1].quaternion.slerpQuaternions(arm, actor.arms[1].quaternion.clone(), weight);
    actor.elbows[1].quaternion.slerpQuaternions(elbow, actor.elbows[1].quaternion.clone(), weight);
    actor.body.position.lerpVectors(body, actor.body.position.clone(), weight);
    actor.chest.position.lerpVectors(chest, actor.chest.position.clone(), weight);
    joints.forEach((joint, i) => joint.quaternion.slerpQuaternions(rotations[i], joint.quaternion.clone(), weight));
  } else if (pose.contact) {
    const arm = actor.arms[1].quaternion.clone(), elbow = actor.elbows[1].quaternion.clone();
    const body = actor.body.position.clone(), chest = actor.chest.position.clone();
    const joints = [...actor.legs, ...actor.knees, ...actor.feet];
    const jointRotations = joints.map(joint => joint.quaternion.clone());
    posePaddleContact(actor, pose.contact);
    const weight = pose.contactBlend ?? 1;
    actor.arms[1].quaternion.slerpQuaternions(arm, actor.arms[1].quaternion.clone(), weight);
    actor.elbows[1].quaternion.slerpQuaternions(elbow, actor.elbows[1].quaternion.clone(), weight);
    actor.body.position.lerpVectors(body, actor.body.position.clone(), weight);
    actor.chest.position.lerpVectors(chest, actor.chest.position.clone(), weight);
    joints.forEach((joint, i) => joint.quaternion.slerpQuaternions(jointRotations[i], joint.quaternion.clone(), weight));
  }
}

/** Two-link shoulder/elbow pose places the paddle face at the real ball contact. */
export function posePaddleContact(actor: Athlete, target: THREE.Vector3, hand = 1, clampReach = false) {
  actor.group.updateWorldMatrix(true, true);
  const relative = actor.group.worldToLocal(target.clone());
  // A small visual lunge and knee bend extend the reach without teleporting the feet.
  const offset = contactBodyOffset(relative);
  actor.body.position.set(0, offset.y, 0);
  actor.chest.position.set(offset.x, 0, offset.z);
  const crouch = Math.acos(THREE.MathUtils.clamp((0.72 + actor.body.position.y) / 0.72, 0, 1));
  for (let i = 0; i < 2; i++) {
    actor.legs[i].rotation.x = crouch; actor.knees[i].rotation.x = -2 * crouch; actor.feet[i].rotation.x = crouch;
  }
  actor.group.updateWorldMatrix(true, true);
  const local = actor.chest.worldToLocal(target.clone());
  const shoulder = actor.arms[1];
  local.sub(shoulder.position);
  const direction = local.clone();
  const distance = direction.length();
  const upper = 0.26, lower = 0.61;
  if (distance < 0.05 || (!clampReach && distance > upper + lower + 0.15)) return;
  direction.normalize();
  const d = THREE.MathUtils.clamp(distance, lower - upper + 0.001, upper + lower - 0.001);
  if (clampReach) local.copy(direction).multiplyScalar(d);
  const along = (d * d + upper * upper - lower * lower) / (2 * d);
  const bend = new THREE.Vector3(0, 0, 1).cross(direction).normalize();
  if (bend.lengthSq() < 0.1) bend.set(1, 0, 0);
  bend.multiplyScalar(hand);
  const elbow = direction.clone().multiplyScalar(along).addScaledVector(bend, Math.sqrt(Math.max(0, upper * upper - along * along)));
  shoulder.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), elbow.clone().normalize());
  const lowerDirection = local.clone().sub(elbow).applyQuaternion(shoulder.quaternion.clone().invert()).normalize();
  actor.elbows[1].quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), lowerDirection);
}
