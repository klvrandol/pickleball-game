import {applyDisplayNames,displayColor,renderDoublesRoster} from './display-names.ts';
import {PlayerIdentification} from './player-identification.ts';
import {PlayerHitAssist,canPlayerContact,canAttemptPlayerHit,playerTiming,type PlayerHitContext,type PlayerHitEvent} from './player-hit-assist.ts';
import {PlayerTimingVisual} from './player-timing-visual.ts';
import * as THREE from 'three';
import './style.css';
import {createParkEnvironment} from './park-environment.ts';
import {loadDoublesModels} from './athlete-model.ts';
import {createAthlete,animateAthlete,type Athlete} from './athlete.ts';
import {PracticeBall,BALL_RADIUS,launchVelocity,shotVelocity,type Shot} from './ball.ts';
import {canContact,volleyVelocity,volleyStyle,SWING_CONTACT_DELAY} from './volley.ts';
import {SwingMotion} from './swing.ts';
import {DoublesMatch,TEAM,MEMBERS,NAMES,doublesTitle,type ActorId,type DoublesResult} from './doubles-match.ts';
import {DoublesAgent,TeamCoordinator,separateTeammates} from './doubles-ai.ts';
import {endSign,inCourt,inKitchen} from './match.ts';
import {ResultNotice} from './result-notice.ts';
import {GameAudio} from './audio.ts';
import {ImpactEffects} from './impact-effects.ts';
import {createBallLocator} from './ball-locator.ts';
import {landingPoint} from './feedback.ts';
import {DEFAULT_GAME_SPEED,parseGameSpeed,simulationDelta} from './speed.ts';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=$<HTMLCanvasElement>('court');
applyDisplayNames(document,'doubles');
boot().catch(error=>{$('error').hidden=false;$('error').textContent=`복식 모델 또는 게임 로딩 실패: ${String(error)} · 새로고침해 주세요.`;console.error(error);});
async function boot(){
  const start=$<HTMLButtonElement>('start');start.disabled=true;start.textContent='네 선수 불러오는 중…';
  await loadDoublesModels();start.disabled=false;start.textContent='혼합복식 시작';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0xdce9df);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xdce9df, 30, 65);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xf5fbff, 0x7a9b70, 2.5));
  const sun = new THREE.DirectionalLight(0xfff3da, 3);
  sun.position.set(-8, 16, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 18, bottom: -18, far: 50 });
  sun.shadow.normalBias = 0.035;
  scene.add(sun);

  function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    return mesh;
  }
  scene.add(createParkEnvironment());
  // Official court: 20 × 44 feet; kitchen extends 7 feet from net.
  const width = 6.096, halfLength = 6.7056, kitchen = 2.1336;
  scene.add(box(width, 0.025, halfLength * 2, 0x377f83, 0, 0.005));
  scene.add(box(width, 0.028, kitchen * 2, 0x78b4ad, 0, 0.009));
  const line = 0.0508;
  for (const x of [-width / 2, width / 2]) scene.add(box(line, 0.012, halfLength * 2 + line, 0xf8f4dc, x, 0.03));
  for (const z of [-halfLength, -kitchen, kitchen, halfLength]) scene.add(box(width, 0.012, line, 0xf8f4dc, 0, 0.03, z));
  for (const sign of [-1, 1]) scene.add(box(line, 0.012, halfLength - kitchen, 0xf8f4dc, 0, 0.03, sign * (halfLength + kitchen) / 2));

  // A light mesh with a slightly lower center, 34–36 inches tall.
  const netMaterial = new THREE.LineBasicMaterial({ color: 0x304b48, transparent: true, opacity: 0.58 });
  const segments: number[] = [];
  const netHeight = (x: number) => 0.864 + 0.05 * Math.abs(x) / 3.35;
  for (let x = -3.35; x <= 3.36; x += 0.12) segments.push(x, 0.08, 0, x, netHeight(x), 0);
  for (let y = 0.08; y < 0.9; y += 0.1) segments.push(-3.35, y, 0, 3.35, y, 0);
  const netGeometry = new THREE.BufferGeometry();
  netGeometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
  scene.add(new THREE.LineSegments(netGeometry, netMaterial));
  for (const x of [-3.4, 3.4]) scene.add(box(0.09, 1.05, 0.09, 0x304c48, x, 0.525));
  for (const sign of [-1, 1]) {
    const tape = box(3.4, 0.045, 0.045, 0xfffae9, sign * 1.68, 0.89);
    tape.rotation.z = sign * 0.015;
    scene.add(tape);
  }

  const ids:ActorId[]=['ranger','rogue','barbarian','mage'];
  const actors={} as Record<ActorId,Athlete>;
  const agents={} as Record<Exclude<ActorId,'ranger'>,DoublesAgent>;
  for(const id of ids){const team=TEAM[id];actors[id]=createAthlete(team,endSign(team)*5,team==='player'?0:Math.PI,id);scene.add(actors[id].group);if(id!=='ranger')agents[id]=new DoublesAgent(id);}
  const identification=new PlayerIdentification(canvas,ids.map(id=>({athlete:actors[id],role:id==='ranger'?'you':id==='rogue'?'partner':'cpu',label:NAMES[id]})),document.querySelector<HTMLInputElement>('#show-nameplates')!);
  const player=actors.ranger,match=new DoublesMatch(),ball=new PracticeBall(),coordinator=new TeamCoordinator();
  const positions=Object.fromEntries(ids.map(id=>[id,id==='ranger'?player.group.position:agents[id].position])) as Record<ActorId,THREE.Vector3>;
  for(const id of ids){const p=match.startPosition(id);positions[id].set(p.x,.045,p.z);if(id!=='ranger')agents[id].reset(positions[id]);}
  const playerMotion=new SwingMotion(),velocity=new THREE.Vector3(),keys=new Set<string>();
  const hitAssist=new PlayerHitAssist(()=>performance.now()/1000);
  let hitCooldown=0,paused=false,gameTime=0,stride=0,serveDelay=1.2;
  let handled:DoublesResult|null=null,finished=false;
  const contacts:Partial<Record<ActorId,{point:THREE.Vector3;time:number}>>={};
  const notice=new ResultNotice(),audio=new GameAudio(),fx=new ImpactEffects();scene.add(fx.root);
  let speed=DEFAULT_GAME_SPEED;try{speed=parseGameSpeed(localStorage.getItem('pickleball.speed'));}catch{}
  const speedSelect=$<HTMLSelectElement>('game-speed');speedSelect.value=String(speed);
  speedSelect.onchange=()=>{speed=parseGameSpeed(speedSelect.value);try{localStorage.setItem('pickleball.speed',String(speed));}catch{}speedSelect.blur();};
  const motion=$<HTMLInputElement>('reduce-motion');motion.checked=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sound=$<HTMLButtonElement>('sound'),volume=$<HTMLInputElement>('volume');volume.value=String(audio.volume*100);
  function syncSound(){sound.textContent=audio.enabled?'♪ 소리 켜짐':'♪ 소리 꺼짐';sound.setAttribute('aria-pressed',String(audio.enabled));$('volume-label').textContent=`${Math.round(audio.volume*100)}%`;}
  sound.onclick=()=>{audio.setEnabled(!audio.enabled);syncSound();sound.blur();};volume.oninput=()=>{audio.setVolume(Number(volume.value)/100);syncSound();};syncSound();
  const ballRadius=BALL_RADIUS*3.25,ballMesh=new THREE.Group();
  ballMesh.add(new THREE.Mesh(new THREE.SphereGeometry(ballRadius*1.22,24,16),new THREE.MeshBasicMaterial({color:0x132b42,side:THREE.BackSide})),new THREE.Mesh(new THREE.SphereGeometry(ballRadius,24,16),new THREE.MeshBasicMaterial({color:0xffed20})));
  const locator=createBallLocator(ballRadius);ballMesh.add(locator);scene.add(ballMesh);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.16,32),new THREE.MeshBasicMaterial({color:0x132b42,transparent:true,opacity:.65,depthWrite:false}));shadow.rotation.x=-Math.PI/2;scene.add(shadow);
  const rim=new THREE.Mesh(new THREE.RingGeometry(.16,.205,32),new THREE.MeshBasicMaterial({color:0xffffe0,transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide}));rim.rotation.x=-Math.PI/2;scene.add(rim);
  function ring(inner:number,outer:number,color:number){const m=new THREE.Mesh(new THREE.RingGeometry(inner,outer,32),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.85,depthWrite:false}));m.rotation.x=-Math.PI/2;scene.add(m);return m;}
  const marker=ring(.2,.25,0xffed91),landing=ring(.25,.30,0x8df4ff),reachRing=ring(1.21,1.24,0xb6d8dc);
  const timingVisual=new PlayerTimingVisual(reachRing);scene.add(timingVisual.paddleCue);
  landing.add(new THREE.Mesh(new THREE.RingGeometry(.30,.35,32),new THREE.MeshBasicMaterial({color:0x132b42,side:THREE.DoubleSide,depthWrite:false})));
  const serviceBox=new THREE.Mesh(new THREE.PlaneGeometry(width/2-.1,halfLength-kitchen-.1),new THREE.MeshBasicMaterial({color:0xffe690,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide}));serviceBox.rotation.x=-Math.PI/2;scene.add(serviceBox);
  const aim=new THREE.Vector3(0,.05,-4.8),pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.05),impact=new THREE.Vector3();let pointerInside=false;
  canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);pointerInside=true;});canvas.addEventListener('pointerleave',()=>pointerInside=false);
  function preparePoint(){
    match.prepare();keys.clear();velocity.set(0,0,0);playerMotion.clear();hitAssist.clear();ball.active=false;fx.clear();coordinator.owner=null;
    for(const id of ids){const p=match.startPosition(id);positions[id].set(p.x,.045,p.z);if(id!=='ranger')agents[id].reset(positions[id]);delete contacts[id];}
    const target=match.serveTarget;aim.set(match.serverId==='ranger'?target.x:0,.05,match.serverId==='ranger'?target.z:-4.8);pointerInside=false;serveDelay=1.2;hitCooldown=0;
  }
  function startMatch(){paused=false;audio.unlock();audio.setPaused(false);$('pause-overlay').hidden=true;$('match-overlay').hidden=true;notice.clear();handled=null;finished=false;match.start();preparePoint();(document.activeElement as HTMLElement)?.blur();}
  function setPaused(value:boolean){if(match.phase==='idle'||match.phase==='over')return;paused=value;hitAssist.resetClock();keys.clear();velocity.set(0,0,0);audio.setPaused(value);$('pause-overlay').hidden=!value;$('pause').setAttribute('aria-pressed',String(value));(document.activeElement as HTMLElement)?.blur();}
  function dropServe(){if(paused||notice.active||!match.drop())return;hitAssist.clear();const id=match.serverId,p=positions[id],sign=endSign(TEAM[id]);match.constrainActor(id,p,id==='ranger'?velocity:undefined);ball.launch(new THREE.Vector3(p.x+sign*.32,1,p.z-sign*.25),new THREE.Vector3());(document.activeElement as HTMLElement)?.blur();}
  function launchServe(){const id=match.serverId,p=positions[id];match.constrainActor(id,p,id==='ranger'?velocity:undefined);if(!match.serveActor(id,p))return;
    const target=id==='ranger'?aim.clone():new THREE.Vector3(match.serveTarget.x,0,match.serveTarget.z);
    const distance=Math.hypot(target.x-ball.position.x,target.z-ball.position.z);ball.launch(ball.position.clone(),launchVelocity(ball.position,target,Math.max(1.2,distance/9.2)));
    const swing=id==='ranger'?playerMotion:agents[id].motion;swing.begin(p,ball.position,TEAM[id]==='player'?0:Math.PI,'drive',false,0);audio.play('serve');
  }
  function playerHitContext():PlayerHitContext {
    return {ball,feet:positions.ranger,velocity,speed,
      role:match.phase==='rally'&&match.receiver==='player'?'return':match.phase==='drop'&&match.serverId==='ranger'?'serve':'none',
      mustBounce:match.bounceRequired.player,volleyAllowed:match.phase==='rally'&&match.hits>=3&&!match.bounceRequired.player,
      designated:match.hits!==1||match.designatedReceiver==='ranger'};
  }
  function inReach(){return canAttemptPlayerHit(playerHitContext());}
  function assistEvents(events:PlayerHitEvent[]){for(const event of events){
    if(event.kind==='start')playerMotion.begin(positions.ranger,event.point,0,event.shot,event.volley,event.delay);
    else if(event.kind==='impact'){if(match.phase==='drop'){if(inReach())launchServe();}else playerContact(event.shot);}
    else {match.message='헛스윙 · 공이 타격 범위를 벗어났어요.';audio.play('miss');}
  }}
  function hit(shot:Shot){if(paused||notice.active)return;audio.unlock();if(match.phase==='ready'&&match.serverId==='ranger'){dropServe();return;}if(hitCooldown>0||!['drop','rally'].includes(match.phase))return;
    hitCooldown=.3;
    if(!hitAssist.queue(shot,playerHitContext())){playerMotion.begin(positions.ranger,ball.position,0,shot,match.phase==='rally'&&match.hits>=3&&ball.bounces===0);match.message='헛스윙 · 너무 멀거나 이미 지나간 공입니다.';audio.play('miss');return;}
    assistEvents(hitAssist.advance(0,playerHitContext()));
  }
  function contactHit(id:ActorId,shot:Shot,target:THREE.Vector3){
    if(!ball.active||!(id==='ranger'?canPlayerContact(positions[id],ball.position):canContact(positions[id],ball.position)))return;
    const volley=ball.bounces===0;if(!match.hitActor(id,positions[id],ball.bounces))return;
    const swing=id==='ranger'?playerMotion:agents[id].motion;swing.impact(positions[id],ball.position,TEAM[id]==='player'?0:Math.PI,volley);swing.aimAt(positions[id],target,TEAM[id]==='player'?0:Math.PI);
    const incomingSpeed=ball.velocity.length(),from=ball.position.clone();contacts[id]={point:from.clone(),time:.11};
    const reply=volley?volleyVelocity(from,target,volleyStyle(shot,incomingSpeed,from.y)):shotVelocity(from,target,shot);
    ball.launch(from,reply);fx.emit(volley?'volley':shot,from,reply);audio.play(shot);match.message=`${NAMES[id]} ${volley?'발리':shot==='drive'?'드라이브':'딩크'} · 랠리 ${match.hits}`;
  }
  function playerContact(shot:Shot){if(!inReach()||match.phase!=='rally')return;const target=aim.clone(),p=positions.ranger;
    const distance=Math.hypot(ball.position.x-p.x,ball.position.z-p.z);
    const error=Math.max(0,distance-.85)*1.8+Math.max(0,.45-ball.position.y)*2+(shot==='dink'?Math.max(0,p.z-3)*.15:0);
    target.x+=(Math.random()-.5)*error;target.z+=(Math.random()-.5)*error;contactHit('ranger',shot,target);
  }
  start.onclick=startMatch;$('restart').onclick=startMatch;$('pause-restart').onclick=startMatch;$('resume').onclick=()=>setPaused(false);$('pause').onclick=()=>setPaused(!paused);$('serve').onclick=()=>{audio.unlock();dropServe();};
  canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{if(e.button===0||e.button===2){e.preventDefault();hit(e.button===0?'drive':'dink');}});
  window.addEventListener('keydown',e=>{if((e.target as HTMLElement).matches('input,select,button,a'))return;
    if(['KeyW','KeyA','KeyS','KeyD','Space','KeyP','Escape'].includes(e.code))e.preventDefault();
    if(e.code==='KeyP'||e.code==='Escape'){if(!e.repeat)setPaused(!paused);return;}if(paused)return;
    if(e.code==='Space'&&!e.repeat){audio.unlock();dropServe();}keys.add(e.code);
  });window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>setPaused(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)setPaused(true);});
  function resize(){renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();}window.addEventListener('resize',resize);resize();
  const desiredCamera=new THREE.Vector3(),lookAt=new THREE.Vector3(0,.3,-1.4);camera.position.set(1.8,11.4,15.9+positions.ranger.z*.26);camera.lookAt(lookAt);
  const clock=new THREE.Clock();let accumulator=0;
  function stepSimulation(dt:number){
    const previous=Object.fromEntries(ids.map(id=>[id,positions[id].z])) as Record<ActorId,number>;
    const movable=['ready','drop','rally','settling'].includes(match.phase);
    const movement=new THREE.Vector3(movable?Number(keys.has('KeyD'))-Number(keys.has('KeyA')):0,0,movable?Number(keys.has('KeyS'))-Number(keys.has('KeyW')):0).normalize().multiplyScalar(3.8);
    velocity.lerp(movement,1-Math.exp(-20*dt));if(velocity.lengthSq()<.0001)velocity.set(0,0,0);positions.ranger.addScaledVector(velocity,dt);stride+=velocity.length()*dt*2.8;
    if(match.phase==='rally'&&match.receiver==='player'&&coordinator.owner==='ranger'&&ball.active&&ball.position.z>0&&ball.position.y<2.2){
      const dx=ball.position.x-positions.ranger.x,dz=ball.position.z-positions.ranger.z,d=Math.hypot(dx,dz);
      if(d>.65&&d<1.65){positions.ranger.x+=dx/d*Math.min(.65*dt,d-.65);if(ball.bounces>0||positions.ranger.z>2.6&&ball.position.z>2.6)positions.ranger.z+=dz/d*Math.min(.65*dt,d-.65);}
    }
    positions.ranger.x=THREE.MathUtils.clamp(positions.ranger.x,-4.4,4.4);positions.ranger.z=THREE.MathUtils.clamp(positions.ranger.z,.55,8.2);
    for(const id of ids)match.constrainActor(id,positions[id],id==='ranger'?velocity:undefined);
    hitCooldown=Math.max(0,hitCooldown-dt);playerMotion.advance(dt);gameTime+=dt;
    if(match.phase==='ready'&&match.serverId!=='ranger'){serveDelay-=dt;if(serveDelay<=0)dropServe();}
    if(match.phase==='ready'){const p=positions[match.serverId],s=endSign(match.server);ball.position.set(p.x+s*.32,1,p.z-s*.25);}
    if(match.phase==='drop'){
      const event=ball.step(dt,true);if(event==='bounce')audio.play('bounce');
      if(match.serverId!=='ranger'&&ball.bounces===1&&ball.active&&ball.position.y>.2&&ball.position.y<.8)launchServe();
      else if(!ball.active&&event){match.phase='ready';serveDelay=.5;match.message='서브 공을 놓쳤습니다. Space로 다시 준비하세요.';}
    }else if(match.phase==='rally'){
      const event=ball.step(dt);if(event==='net'){match.net();audio.play('net');}if(event==='bounce'||event==='out'||event==='double-bounce'){match.bounce(ball.position,ball.bounces);audio.play('bounce');}
    }
    coordinator.update(dt,match,ball,positions);
    assistEvents(hitAssist.advance(dt,playerHitContext()));
    if(hitAssist.pending?.started&&hitAssist.pending.remaining<=0)playerMotion.age=Math.min(playerMotion.age,playerMotion.contactAt*.96);
    for(const id of ['rogue','barbarian','mage'] as const){
      const reply=agents[id].update(dt,match,ball,coordinator.owner,positions);
      if(match.phase==='rally'&&!agents[id].pending){const mate=match.partner(id);separateTeammates(positions[id],positions[mate],dt);positions[id].x=THREE.MathUtils.clamp(positions[id].x,-3.8,3.8);positions[id].z=endSign(TEAM[id])*THREE.MathUtils.clamp(positions[id].z*endSign(TEAM[id]),.6,7.8);}
      if(reply&&match.phase==='rally'){if(reply.missed){match.message=`${NAMES[id]} 헛스윙!`;audio.play('miss');}else contactHit(id,reply.shot,reply.target);}
      match.constrainActor(id,positions[id]);
    }
    for(const id of ids){match.updateActorFeet(id,positions[id],dt,(positions[id].z-previous[id])*endSign(TEAM[id])<-.00001);if(contacts[id])contacts[id]!.time=Math.max(0,contacts[id]!.time-dt);}
    match.tick(dt);if(['settling','between','over'].includes(match.phase)){ball.active=false;hitAssist.clear();}
  }
  renderer.setAnimationLoop(()=>{
    const elapsed=clock.getDelta(),realDt=Math.min(elapsed,.05),dt=simulationDelta(elapsed,speed,paused||document.hidden);notice.advance(elapsed,paused||document.hidden);
    if(!paused&&notice.canPrepareServe(match.phase)){notice.clear();preparePoint();}
    accumulator+=dt;while(accumulator>=1/120){stepSimulation(1/120);accumulator-=1/120;}
    if(pointerInside&&!paused){raycaster.setFromCamera(pointer,camera);if(raycaster.ray.intersectPlane(plane,impact))aim.set(THREE.MathUtils.clamp(impact.x,-3.45,3.45),.05,THREE.MathUtils.clamp(impact.z,-7.1,-.25));}
    if(match.doublesResult&&match.doublesResult!==handled){handled=match.doublesResult;notice.show(match.result!);$('result-title').textContent=doublesTitle(handled);$('result-title').style.color=displayColor(handled.winner?handled.winner==='player'?'ranger':'barbarian':handled.server);$('result-detail').style.color=displayColor(handled.server);$('result-detail').textContent=`${match.scoreCall} · ${NAMES[handled.server]} ${handled.serverNumber===1?'첫 번째':'두 번째'} 서버${handled.kind==='point'?' 유지':''}`;keys.clear();velocity.set(0,0,0);audio.play(handled.winner?handled.winner==='player'?'win':'lose':handled.kind==='point'?'point':'sideout');}
    $('result-notice').hidden=!notice.active;$('result-notice').style.opacity=String(notice.opacity);$('result-notice').classList.toggle('cpu-result',Boolean(handled&&TEAM[handled.server]==='cpu'));
    if(match.phase==='over'&&!notice.active&&!finished){finished=true;$('match-overlay').hidden=false;$('overlay-title').textContent=match.winner==='player'?'YOU WIN!':'YOU LOSE!';$('overlay-copy').textContent=`최종 점수 ${match.score.player} : ${match.score.cpu} · 아래에서 재경기 또는 단식 모드를 선택하세요.`;start.textContent='혼합복식 다시 하기';}
    for(const id of ids){const a=actors[id],agent=id==='ranger'?null:agents[id];if(agent)a.group.position.copy(agent.position);const c=contacts[id];
      animateAthlete(a,{motion:id==='ranger'?playerMotion:agent!.motion,contact:agent?.pending?ball.position:c&&c.time>0?c.point:undefined,walking:id==='ranger'?velocity.lengthSq()>.03:agent!.moving,phase:id==='ranger'?stride:agent!.stride,swingLeft:0,shot:id==='ranger'?playerMotion.shot:agent!.motion.shot,lateral:id==='ranger'?velocity.x:agent!.destination.x-agent!.position.x,side:1,ready:match.phase==='rally',dt,time:gameTime,reduceMotion:motion.checked});}
    marker.position.copy(aim);marker.visible=!['idle','over'].includes(match.phase);marker.material.color.setHex((match.serverId==='ranger'&&['ready','drop'].includes(match.phase)?match.serveLandingError(aim):!inCourt(aim))?0xff8168:0xffed91);
    serviceBox.visible=['ready','drop'].includes(match.phase);serviceBox.position.set(Math.sign(match.serveTarget.x)*width/4,.047,-endSign(match.server)*(halfLength+kitchen)/2);
    const pixelsRadius=12*camera.position.distanceTo(ball.position)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.max(1,canvas.clientHeight);ballMesh.scale.setScalar(THREE.MathUtils.clamp(pixelsRadius/ballRadius,1,2));ballMesh.position.copy(ball.position);ballMesh.position.y+=ballRadius*ballMesh.scale.x*1.22-BALL_RADIUS;ballMesh.visible=!['idle','over','between'].includes(match.phase);
    shadow.position.set(ball.position.x,.05,ball.position.z);shadow.visible=ballMesh.visible;shadow.scale.setScalar(1+ball.position.y*.1);rim.position.copy(shadow.position);rim.scale.copy(shadow.scale);rim.visible=shadow.visible;
    landing.visible=match.phase==='rally'&&match.receiver==='player'&&ball.active&&ball.bounces===0;if(landing.visible){const p=landingPoint(ball.position,ball.velocity);landing.position.set(p.x,p.y,p.z);landing.material.color.setHex(inCourt(p)?0x8df4ff:0xff8c73);}
    const timingContext=playerHitContext(),timing=playerTiming(timingContext);
    $('player-score').textContent=String(match.score.player);$('cpu-score').textContent=String(match.score.cpu);$('rally').textContent=String(match.hits);$('message').textContent=match.message;
    $('server-label').textContent=`${match.scoreCall} · ${NAMES[match.serverId]} 서브`; $('cpu-status').textContent=`${NAMES.barbarian} ${agents.barbarian.status} / ${NAMES.mage} ${agents.mage.status}`;
    $('server-label').style.color=displayColor(match.serverId);$('cpu-status').style.color=displayColor('barbarian');$('landing-hint').style.color=displayColor('rogue');
    $('readiness').textContent=match.phase==='ready'?match.serverId==='ranger'?'Space → 바운드 후 클릭':`${NAMES[match.serverId]} 서브 준비`:timing==='now'?'● 초록 · 지금 클릭!':timing==='soon'?'● 노랑 · 곧 타격! 미리 클릭 가능':timing==='blocked'?'바운드/키친/지정 리시버를 확인하세요':`○ ${coordinator.owner?NAMES[coordinator.owner]+' 공 처리':'서브 준비'}`;
    if(match.phase==='rally'&&match.hits===1){$('contact-hint').textContent=`지정 리시버: ${NAMES[match.designatedReceiver]} · 반드시 바운드 후 리턴`;$('contact-hint').dataset.roster='';$('contact-hint').style.color=displayColor(match.designatedReceiver);}else{$('contact-hint').style.color='';renderDoublesRoster($('contact-hint'));}
    $('landing-hint').textContent=`${NAMES.rogue} ${agents.rogue.status} · WASD / 마우스 / P 일시정지`;
    $<HTMLButtonElement>('serve').disabled=paused||match.serverId!=='ranger'||!['ready','drop'].includes(match.phase);$<HTMLButtonElement>('pause').disabled=['idle','over'].includes(match.phase);
    $('player-card').classList.toggle('serving',match.server==='player');$('cpu-card').classList.toggle('serving',match.server==='cpu');
    desiredCamera.set(positions.ranger.x*.23+1.8,11.4,15.9+positions.ranger.z*.26);camera.position.lerp(desiredCamera,1-Math.exp(-3*realDt));camera.lookAt(lookAt);locator.quaternion.copy(camera.quaternion);timingVisual.update(timing,timingContext,player.paddle,camera,paused||document.hidden,canvas.clientHeight);fx.update(paused?0:realDt,camera,motion.checked);identification.update(camera,canvas,!['idle','over'].includes(match.phase));renderer.render(scene,camera);
  });
}
