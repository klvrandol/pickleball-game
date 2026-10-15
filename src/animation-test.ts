import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadAthleteModel } from './athlete-model';
import { createAthlete, animateAthlete, type AthleteTeam } from './athlete';
import { SwingMotion } from './swing';
import { SWING_PROFILES } from './swing-keyframes';
import './animation-test.css';
const input = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
async function start() {
  const select = input<HTMLSelectElement>('swing');
  for (const profile of SWING_PROFILES) select.add(new Option(profile.label, profile.id));
  await loadAthleteModel();
  const canvas = input<HTMLCanvasElement>('preview'), renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled=true;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe3ece6);
  scene.add(new THREE.HemisphereLight(0xffffff,0x6b8371,2.4));
  const sun=new THREE.DirectionalLight(0xfff7e8,3);sun.position.set(-3,5,-4);sun.castShadow=true;scene.add(sun);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:0xb6cab9,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=.036;floor.receiveShadow=true;scene.add(floor);
  const grid=new THREE.GridHelper(8,32,0x749584,0x9bb7a3);grid.position.y=.038;scene.add(grid);
  const camera=new THREE.PerspectiveCamera(38,1,.1,50);camera.position.set(2,1.9,-3.5);
  const controls=new OrbitControls(camera,canvas);controls.target.set(0,.95,0);controls.enableDamping=true;controls.minDistance=1.5;controls.maxDistance=8;controls.maxPolarAngle=Math.PI*.49;controls.update();
  const actors={player:createAthlete('player',0,0),cpu:createAthlete('cpu',0,0)};
  scene.add(actors.player.group,actors.cpu.group);
  const ball=new THREE.Mesh(new THREE.SphereGeometry(.045,16,12),new THREE.MeshStandardMaterial({color:0xffe629,emissive:0x4c3900}));scene.add(ball);
  const motion=new SwingMotion(); let progress=0,playing=true,profile=SWING_PROFILES[0];
  const team=()=>input<HTMLSelectElement>('team').value as AthleteTeam;
  function reset() {
    profile=SWING_PROFILES.find(p=>p.id===select.value)!;progress=0;
    const actor=actors[team()],target=new THREE.Vector3(profile.hand==='forehand'?.35:-.35,Number(input<HTMLInputElement>('height').value),-.55);
    motion.begin(actor.group.position,target,0,profile.kind==='dink'?'dink':'drive',profile.kind==='volley');
    motion.aimAt(actor.group.position,new THREE.Vector3(Number(input<HTMLInputElement>('aim').value),0,-5),0);
    ball.position.copy(target);
  }
  const syncPlay=()=>input<HTMLButtonElement>('play').textContent=playing?'일시정지':'재생';
  select.addEventListener('change',reset);input('team').addEventListener('change',reset);
  input('play').addEventListener('click',()=>{playing=!playing;syncPlay();});
  input('replay').addEventListener('click',()=>{reset();playing=true;syncPlay();});
  input('impact').addEventListener('click',()=>{progress=.5;playing=false;syncPlay();});
  input('progress').addEventListener('input',()=>{progress=Number(input<HTMLInputElement>('progress').value)/1000;playing=false;syncPlay();});
  input('height').addEventListener('input',()=>{input('height-label').textContent=Number(input<HTMLInputElement>('height').value).toFixed(2)+'m';reset();});
  input('aim').addEventListener('input',()=>{const v=Number(input<HTMLInputElement>('aim').value);input('aim-label').textContent=v===0?'중앙':v<0?'왼쪽':'오른쪽';reset();});
  reset();const clock=new THREE.Clock();
  renderer.setAnimationLoop(()=>{
    const dt=document.hidden?0:Math.min(clock.getDelta(),.05);
    if(playing) {progress+=dt*Number(input<HTMLSelectElement>('speed').value)/(profile.kind==='drive'?1.3:profile.kind==='dink'?1.1:.8);if(progress>=1){if(input<HTMLInputElement>('loop').checked)reset();else{progress=1;playing=false;syncPlay();}}}
    motion.active=progress<1;motion.age=progress<.5?progress*2*motion.contactAt:motion.contactAt+(progress-.5)*2*motion.finishTime;
    for(const name of ['player','cpu'] as const){actors[name].group.visible=name===team();if(name===team())animateAthlete(actors[name],{motion,walking:false,phase:0,swingLeft:0,shot:motion.shot,lateral:0,side:motion.hand==='forehand'?1:-1,ready:true,dt:playing?dt:0,time:0,reduceMotion:false});}
    input<HTMLInputElement>('progress').value=String(Math.round(progress*1000));input('progress-label').textContent=Math.round(progress*100)+'%';
    const actor=actors[team()];actor.group.updateWorldMatrix(true,true);const face=actor.paddle.localToWorld(new THREE.Vector3(0,-.34,0));
    input('phase').textContent=progress<.33?'준비 · 체중 싣기':progress<.49?'회전 · 패들 가속':progress<.52?`임팩트 · 접촉 오차 ${(face.distanceTo(ball.position)*100).toFixed(1)}cm`:progress<.83?'마무리 · 감속':'준비 자세로 복귀';
    canvas.dataset.swing=profile.id;canvas.dataset.progress=progress.toFixed(4);canvas.dataset.contactError=face.distanceTo(ball.position).toFixed(5);canvas.dataset.ready='true';
    const w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==Math.round(w*renderer.getPixelRatio())||canvas.height!==Math.round(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
    controls.update();renderer.render(scene,camera);
  });
}
start().catch(error=>{input('error').hidden=false;input('error').textContent='미리보기를 불러오지 못했습니다. 새로고침해 주세요.';console.error(error);});
