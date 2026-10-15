import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

let template: GLTF | null = null;
let loading: Promise<void> | null = null;
export const ATHLETE_MODEL_URL = new URL('../assets/athlete.glb', import.meta.url).href;
/** Shared local GLB; no runtime CDN or paid service. Reject broken/unskinned replacements. */
export async function installAthleteModel(data: ArrayBuffer): Promise<void> {
  const model = await new GLTFLoader().parseAsync(data, '');
  let skinned = 0;
  model.scene.traverse(object => { if (object instanceof THREE.SkinnedMesh) {
    if (!object.geometry.getAttribute('skinWeight') || !object.skeleton.bones.length) throw new Error('캐릭터 스키닝 데이터가 없습니다.');
    skinned++;
  } });
  const required = ['Body', 'Torso', 'Head', 'UpperArm.L', 'UpperArm.R', 'LowerArm.L', 'LowerArm.R', 'Palm.L', 'Palm.R', 'UpperLeg.L', 'UpperLeg.R', 'LowerLeg.L', 'LowerLeg.R', 'Foot.L', 'Foot.R'];
  if (!skinned || required.some(name => !((model.scene.getObjectByName(name.replaceAll('.', '')) ?? model.scene.getObjectByName(name)) instanceof THREE.Bone))) {
    throw new Error('호환되는 인체 리그가 아닙니다.');
  }
  if (!model.animations.some(clip => clip.name === 'Man_Walk')) throw new Error('캐릭터 이동 애니메이션이 없습니다.');
  template = model;
}
export function loadAthleteModel(): Promise<void> {
  if (template) return Promise.resolve();
  return loading ??= (async () => {
    const response = await fetch(ATHLETE_MODEL_URL);
    if (!response.ok) throw new Error(`캐릭터 모델을 불러오지 못했습니다 (${response.status}).`);
    await installAthleteModel(await response.arrayBuffer());
  })().catch(error => { loading = null; throw error; });
}
export function cloneAthleteModel() {
  if (!template) throw new Error('캐릭터 모델 로딩이 완료되지 않았습니다.');
  return { scene: clone(template.scene), animations: template.animations };
}
