import * as THREE from 'three';
import { cloneAthleteModel, type KayKitStyle } from './athlete-model.ts';
import type { Athlete, AthletePose, AthleteTeam } from './athlete.ts';
import { swingPose } from './swing.ts';

// Presentation scale only. The group root and canContact() envelope stay in game units.
export const RANGER_DISPLAY_SCALE = .65;
const point = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
/** KayKit's own 23-bone rig: no renaming, Quaternius tracks, or bind-axis assumptions. */
export function createRanger(team: AthleteTeam, z: number, facing: number, paddle: THREE.Group, style: KayKitStyle = 'ranger'): Athlete {
  const { scene: model } = cloneAthleteModel(style);
  const group = new THREE.Group(); group.name = `${team}-athlete`;
  group.position.set(0,.045,z); group.rotation.y=facing; group.add(model);
  // KayKit faces +Z; the game player's forward is -Z. Normalize height and soles.
  model.rotation.y=Math.PI;
  group.updateMatrixWorld(true);
  model.traverse(o=>{if(o instanceof THREE.SkinnedMesh)o.skeleton.update();});
  const box=new THREE.Box3().setFromObject(model,true), scale=(1.8*RANGER_DISPLAY_SCALE)/(box.max.y-box.min.y);
  model.scale.setScalar(scale); model.position.y=-(box.min.y-group.position.y)*scale;
  const bone=(name:string)=>{
    const b=model.getObjectByName(name);
    if(!(b instanceof THREE.Bone)) throw new Error(`Ranger 관절 누락: ${name}`);
    return b;
  };
  model.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
  const wrists=[bone('handl'),bone('handr')];
  const slot=bone('handslotr');
  wrists[1].add(paddle);
  // Position the grip at KayKit's supplied weapon socket, retaining a hand-parented paddle.
  paddle.position.copy(slot.position);
  paddle.rotation.z=Math.PI;
  group.updateWorldMatrix(true,true);
  const handScale=wrists[1].getWorldScale(new THREE.Vector3()).x;
  paddle.scale.setScalar(RANGER_DISPLAY_SCALE*(team === 'cpu' ? 1.15 : 1)/handScale);
  if(team === 'cpu')paddle.position.z-=.025/handScale;
  const bind:Athlete['bind']=new Map();
  model.traverse(o=>{if(o instanceof THREE.Bone)bind.set(o,{position:o.position.clone(),quaternion:o.quaternion.clone()});});
  const actor:Athlete={style,team,group,model,paddle,paddleReach:.41,
    body:bone('hips'),chest:bone('chest'),head:bone('head'),
    arms:[bone('upperarml'),bone('upperarmr')],elbows:[bone('lowerarml'),bone('lowerarmr')],wrists,
    legs:[bone('upperlegl'),bone('upperlegr')],knees:[bone('lowerlegl'),bone('lowerlegr')],feet:[bone('footl'),bone('footr')],
    footHome:[bone('footl').position.clone(),bone('footr').position.clone()],bind,
    mixer:new THREE.AnimationMixer(model),actions:{}};
  animateRanger(actor,{walking:false,phase:0,swingLeft:0,shot:'drive',lateral:0,side:1,ready:true,dt:0,time:0,reduceMotion:false});
  return actor;
}
/** CCD solves the real paddle face through the real KayKit hand/wrist/elbow chain. */
function reach(actor:Athlete,target:THREE.Vector3,right:boolean,gripOnly=false) {
  const end=right?(gripOnly?actor.wrists[1]:actor.paddle):actor.wrists[0];
  const face=()=>right&&!gripOnly?end.localToWorld(new THREE.Vector3(0,-.34,0)):point(end);
  const names=right?(gripOnly?['wristr','lowerarmr','upperarmr']:['handr','wristr','lowerarmr','upperarmr']):['wristl','lowerarml','upperarml'];
  const joints=names.map(n=>actor.model.getObjectByName(n) as THREE.Bone);
  for(let i=0;i<90;i++) {
    for(const joint of joints) {
      actor.group.updateWorldMatrix(true,true);
      const origin=point(joint),a=face().sub(origin),b=target.clone().sub(origin);
      if(a.lengthSq()<1e-9||b.lengthSq()<1e-9)continue;
      const delta=new THREE.Quaternion().setFromUnitVectors(a.normalize(),b.normalize());
      const world=delta.multiply(joint.getWorldQuaternion(new THREE.Quaternion()));
      joint.quaternion.copy(joint.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world)).normalize();
    }
    actor.group.updateWorldMatrix(true,true);
    if(face().distanceTo(target)<.001)break;
  }
}
function contactReach(actor:Athlete,target:THREE.Vector3) {
  actor.group.updateWorldMatrix(true,true);
  const chain=[actor.arms[1],actor.elbows[1],actor.model.getObjectByName('wristr')!,actor.wrists[1]];
  let reachLength=point(chain[3]).distanceTo(actor.paddle.localToWorld(new THREE.Vector3(0,-.34,0)));
  for(let i=1;i<chain.length;i++)reachLength+=point(chain[i-1]).distanceTo(point(chain[i]));
  const direction=target.clone().sub(point(chain[0]));
  const excess=direction.length()-reachLength*.82+.015;
  if(excess>0){
    // A small visual torso reach retains high-ball contact after shrinking the skin.
    // Hips, legs, gameplay root and contact eligibility never move with this correction.
    const spine=actor.model.getObjectByName('spine')!;
    const wanted=point(spine).add(direction.normalize().multiplyScalar(Math.min(.12,excess)));
    spine.position.copy(spine.parent!.worldToLocal(wanted));
  }
  actor.group.updateWorldMatrix(true,true);
  const distance=target.distanceTo(point(chain[0]));
  const armLength=point(chain[0]).distanceTo(point(chain[1]))+point(chain[1]).distanceTo(point(chain[2]));
  // Presentation-only stretchy IK for occasional high/far contacts. This preserves
  // the gameplay root without enlarging the head/body or moving the feet.
  // Only the human Ranger may reach the added assist margin; AI skin behavior is unchanged.
  const maxStretch=actor.style==='ranger'&&actor.team==='player'?6.5:3.6;
  const stretch=THREE.MathUtils.clamp(1+(distance-reachLength*.88)/armLength,1,maxStretch);
  chain[1].position.multiplyScalar(stretch);chain[2].position.multiplyScalar(stretch);
  reach(actor,target,true);
}
export function rangerContact(actor:Athlete,target:THREE.Vector3) {contactReach(actor,target);}
/** Ready-only hand orientation. Keep existing swing/impact IK untouched. */
function cpuReadyPaddle(actor:Athlete,target:THREE.Vector3){
  const normal=new THREE.Vector3(0,.12,-1).applyQuaternion(actor.group.quaternion).normalize();
  const down=new THREE.Vector3(-.6,-1,0).applyQuaternion(actor.group.quaternion);
  down.addScaledVector(normal,-down.dot(normal)).normalize();
  const across=down.clone().cross(normal).normalize();
  const batWorld=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across,down,normal));
  const handWorld=batWorld.clone().multiply(actor.paddle.quaternion.clone().invert());
  const scale=actor.wrists[1].getWorldScale(new THREE.Vector3());
  const offset=new THREE.Vector3(0,-.34,0).multiply(actor.paddle.scale).applyQuaternion(actor.paddle.quaternion).add(actor.paddle.position).multiply(scale).applyQuaternion(handWorld);
  reach(actor,target.clone().sub(offset),true,true);
  const hand=actor.wrists[1];
  hand.quaternion.copy(hand.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(handWorld));
}
export function animateRanger(actor:Athlete,pose:AthletePose) {
  for(const [b,base]of actor.bind){b.position.copy(base.position);b.quaternion.copy(base.quaternion);}
  // Rig-specific gait; source GLB contains no animation clips. Never run Man_* clips.
  if(pose.walking)for(let i=0;i<2;i++){
    const step=Math.sin(pose.phase+i*Math.PI);
    actor.legs[i].rotateX(step*.25);actor.knees[i].rotateX(-Math.max(0,-step)*.34);
    actor.feet[i].rotateX(-step*.08);
  }
  const motion=pose.motion?.active?pose.motion:null;
  let target=new THREE.Vector3(.32,1.03,-.40).multiplyScalar(RANGER_DISPLAY_SCALE);
  if(motion){
    const swing=swingPose(motion);target.copy(swing.target);
    const weight=Math.sin(Math.PI*motion.clipTime);
    actor.body.rotateY(swing.twist*.3*weight);
    actor.model.getObjectByName('spine')!.rotateY(swing.twist*.35*weight);
    actor.chest.rotateY(swing.twist*.35*weight+motion.aimYaw*.3*weight);
    // Separate free-arm counterbalance; no foreign local-space animation tracks.
    const support=actor.group.localToWorld(new THREE.Vector3(-.30,1.02+swing.support*.12,-.24).multiplyScalar(RANGER_DISPLAY_SCALE));
    reach(actor,support,false);
  }else{
    reach(actor,actor.group.localToWorld(new THREE.Vector3(-.30,1.02,-.24).multiplyScalar(RANGER_DISPLAY_SCALE)),false);
  }
  actor.group.updateWorldMatrix(true,true);
  const worldTarget=pose.contact??actor.group.localToWorld(target);
  if(motion||pose.contact)contactReach(actor,worldTarget);
  else if(actor.team === 'cpu'||actor.style === 'rogue')cpuReadyPaddle(actor,actor.group.localToWorld(new THREE.Vector3(.50,1.15,-.38).multiplyScalar(RANGER_DISPLAY_SCALE)));
  else reach(actor,worldTarget,true);
  actor.group.updateMatrixWorld(true);
  actor.model.traverse(o=>{if(o instanceof THREE.SkinnedMesh)o.skeleton.update();});
}
