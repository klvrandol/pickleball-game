import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export type AthleteStyle = 'classic' | 'sd' | 'ranger';
const templates: Partial<Record<AthleteStyle, GLTF>> = {};
let loading: Promise<void> | null = null;
export const ATHLETE_MODEL_URL = new URL('../assets/athlete.glb', import.meta.url).href;
export const SD_MODEL_URL = new URL('../assets/athlete-sd.glb', import.meta.url).href;
/** Shared local GLB; no runtime CDN or paid service. Reject broken/unskinned replacements. */
export async function installAthleteModel(data: ArrayBuffer, style: AthleteStyle = 'classic'): Promise<void> {
  const model = await new GLTFLoader().parseAsync(data, '');
  let skinned = 0;
  model.scene.traverse(object => { if (object instanceof THREE.SkinnedMesh) {
    if (!object.geometry.getAttribute('skinWeight') || !object.skeleton.bones.length) throw new Error('캐릭터 스키닝 데이터가 없습니다.');
    skinned++;
  } });
  const required = style === 'ranger' ? ['hips', 'spine', 'chest', 'head', 'upperarm.l', 'upperarm.r', 'lowerarm.l', 'lowerarm.r', 'wrist.l', 'wrist.r', 'hand.l', 'hand.r', 'handslot.r', 'upperleg.l', 'upperleg.r', 'lowerleg.l', 'lowerleg.r', 'foot.l', 'foot.r'] : ['Body', 'Torso', 'Head', 'UpperArm.L', 'UpperArm.R', 'LowerArm.L', 'LowerArm.R', 'Palm.L', 'Palm.R', 'UpperLeg.L', 'UpperLeg.R', 'LowerLeg.L', 'LowerLeg.R', 'Foot.L', 'Foot.R'];
  if (!skinned || required.some(name => !((model.scene.getObjectByName(name) ?? model.scene.getObjectByName(name.replaceAll('.', ''))) instanceof THREE.Bone))) {
    throw new Error('호환되는 인체 리그가 아닙니다.');
  }
  if (style !== 'ranger' && !model.animations.some(clip => clip.name === 'Man_Walk')) throw new Error('캐릭터 이동 애니메이션이 없습니다.');
  templates[style] = model;
}
export function loadAthleteModel(): Promise<void> {
  if (templates.classic && templates.sd && templates.ranger) return Promise.resolve();
  return loading ??= Promise.all((['classic', 'sd', 'ranger'] as const).map(async style => {
    if (templates[style]) return;
    const response = await fetch(style === 'ranger' ? './models/Ranger-sports.glb' : style === 'sd' ? SD_MODEL_URL : ATHLETE_MODEL_URL);
    if (!response.ok) throw new Error(`캐릭터 모델을 불러오지 못했습니다 (${response.status}).`);
    await installAthleteModel(await response.arrayBuffer(), style);
  })).then(() => {}).catch(error => { loading = null; throw error; });
}
export function cloneAthleteModel(style: AthleteStyle = 'classic') {
  const template = templates[style];
  if (!template) throw new Error('캐릭터 모델 로딩이 완료되지 않았습니다.');
  return { scene: clone(template.scene), animations: template.animations };
}
