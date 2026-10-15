import * as THREE from 'three';
import { createAthlete, animateAthlete } from './athlete';
import './style.css';
import { canContact, volleyVelocity, volleyStyle, SWING_CONTACT_DELAY } from './volley';
import { SwingMotion } from './swing';
import { CpuPlayer } from './cpu';
import { GameAudio } from './audio';
import { DEFAULT_GAME_SPEED, parseGameSpeed, simulationDelta } from './speed';
import { landingPoint, contactQuality, contactText } from './feedback';
import { ResultNotice, resultTitle, resultDetail } from './result-notice';
import { SinglesMatch, endSign, inKitchen, inCourt, type RallyResult } from './match';
import { PracticeBall, BALL_RADIUS, launchVelocity, shotVelocity, type Shot } from './ball';

const canvas = document.querySelector<HTMLCanvasElement>('#court')!;
try {
  boot();
} catch (error) {
  document.querySelector<HTMLElement>('#error')!.hidden = false;
  console.error(error);
}

function boot() {
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
  const ground = box(180, 0.15, 180, 0xdce9cf, 0, -0.19);
  scene.add(ground);
  scene.add(box(13, 0.12, 23, 0x81ac93, 0, -0.07));
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

  const player = createAthlete('player', 5, 0);
  const opponent = createAthlete('cpu', -5, Math.PI);
  scene.add(player.group, opponent.group);
  const cpu = new CpuPlayer();
  // Simple scenery frames the court without external assets.
  for (const x of [-8.5, 8.5]) for (const z of [-9, 0, 9]) {
    scene.add(box(0.22, 1.8, 0.22, 0x8d8263, x, 0.9, z));
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), new THREE.MeshStandardMaterial({ color: z === 0 ? 0x7ea878 : 0x91b383, roughness: 1 }));
    crown.position.set(x, 2.3, z); crown.scale.y = 1.25; crown.castShadow = true; scene.add(crown);
  }
  for (const x of [-5.2, 5.2]) {
    scene.add(box(0.65, 0.12, 2.2, 0xb29a70, x, 0.52, -3.8));
    for (const z of [-4.5, -3.1]) scene.add(box(0.48, 0.48, 0.1, 0x647568, x, 0.24, z));
  }

  const ball = new PracticeBall();
  // Only the drawing is enlarged. PracticeBall still uses the physical BALL_RADIUS.
  const ballDisplayRadius = BALL_RADIUS * 3.25;
  const ballMesh = new THREE.Group();
  const ballBody = new THREE.Mesh(new THREE.SphereGeometry(ballDisplayRadius, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffed20 }));
  const ballOutline = new THREE.Mesh(new THREE.SphereGeometry(ballDisplayRadius * 1.22, 24, 16), new THREE.MeshBasicMaterial({ color: 0x132b42, side: THREE.BackSide }));
  ballMesh.add(ballOutline, ballBody);
  scene.add(ballMesh);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 32), new THREE.MeshBasicMaterial({ color: 0x132b42, transparent: true, opacity: 0.65, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  const shadowRim = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.205, 32), new THREE.MeshBasicMaterial({ color: 0xffffe0, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
  shadowRim.rotation.x = -Math.PI / 2; scene.add(shadowRim);
  const trailCount = 8;
  const trailPositions = new Float32Array(trailCount * 3), trailColors = new Float32Array(trailCount * 3);
  for (let i = 0; i < trailCount; i++) new THREE.Color().lerpColors(new THREE.Color(0xd1efff), new THREE.Color(0xffef45), i / (trailCount - 1)).toArray(trailColors, i * 3);
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  trailGeometry.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
  const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }));
  trail.frustumCulled = false; scene.add(trail);
  let trailTime = 0;
  function resetTrail() {
    for (let i = 0; i < trailCount; i++) ball.position.toArray(trailPositions, i * 3);
    trailGeometry.attributes.position.needsUpdate = true; trailTime = 0;
  }
  function launchBall(position: THREE.Vector3, velocity: THREE.Vector3) { ball.launch(position, velocity); resetTrail(); }
  function effectRing(color: number) {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.09, 24), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false }));
    mesh.visible = false; scene.add(mesh); return mesh;
  }
  const hitRing = effectRing(0xfff4a0), bounceRing = effectRing(0xffffff);
  bounceRing.rotation.x = -Math.PI / 2;
  let hitPulse = 0, bouncePulse = 0;
  const landingMarker = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.30, 32), new THREE.MeshBasicMaterial({ color: 0x8df4ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  landingMarker.add(new THREE.Mesh(new THREE.RingGeometry(0.30, 0.35, 32), new THREE.MeshBasicMaterial({ color: 0x132b42, side: THREE.DoubleSide, depthWrite: false })));
  landingMarker.rotation.x = -Math.PI / 2; scene.add(landingMarker);
  const reachRing = new THREE.Mesh(new THREE.RingGeometry(1.21, 1.24, 48), new THREE.MeshBasicMaterial({ color: 0xb6d8dc, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
  reachRing.rotation.x = -Math.PI / 2; scene.add(reachRing);
  const aim = new THREE.Vector3(0, 0.05, -4.8);
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.25, 32), new THREE.MeshBasicMaterial({ color: 0xffed91, side: THREE.DoubleSide }));
  marker.rotation.x = -Math.PI / 2; scene.add(marker);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05);
  let pointerInside = false;
  canvas.addEventListener('pointermove', event => {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    pointerInside = true;
  });
  canvas.addEventListener('pointerleave', () => { pointerInside = false; });
  const match = new SinglesMatch();
  const message = document.querySelector<HTMLElement>('#message')!;
  const readiness = document.querySelector<HTMLElement>('#readiness')!;
  const rallyLabel = document.querySelector<HTMLElement>('#rally')!;
  const cpuLabel = document.querySelector<HTMLElement>('#cpu-status')!;
  const serveButton = document.querySelector<HTMLButtonElement>('#serve')!;
  const overlay = document.querySelector<HTMLElement>('#match-overlay')!;
  const playerScore = document.querySelector<HTMLElement>('#player-score')!;
  const cpuScore = document.querySelector<HTMLElement>('#cpu-score')!;
  const audio = new GameAudio();
  const speedControl = document.querySelector<HTMLSelectElement>('#game-speed')!;
  let gameSpeed = DEFAULT_GAME_SPEED;
  try { gameSpeed = parseGameSpeed(localStorage.getItem('pickleball.speed')); } catch { /* Optional preference. */ }
  speedControl.value = String(gameSpeed);
  speedControl.addEventListener('change', () => {
    gameSpeed = parseGameSpeed(speedControl.value);
    speedControl.value = String(gameSpeed);
    try { localStorage.setItem('pickleball.speed', String(gameSpeed)); } catch { /* Optional preference. */ }
    speedControl.blur();
  });
  const soundButton = document.querySelector<HTMLButtonElement>('#sound')!;
  const volumeSlider = document.querySelector<HTMLInputElement>('#volume')!;
  const volumeLabel = document.querySelector<HTMLElement>('#volume-label')!;
  const motionControl = document.querySelector<HTMLInputElement>('#reduce-motion')!;
  const pauseButton = document.querySelector<HTMLButtonElement>('#pause')!;
  const pauseOverlay = document.querySelector<HTMLElement>('#pause-overlay')!;
  const resultNotice = new ResultNotice();
  const resultPanel = document.querySelector<HTMLElement>('#result-notice')!;
  const resultHeading = document.querySelector<HTMLElement>('#result-title')!;
  const resultCopy = document.querySelector<HTMLElement>('#result-detail')!;
  let handledResult: RallyResult | null = null;
  const toast = document.querySelector<HTMLElement>('#shot-feedback')!;
  const contactHint = document.querySelector<HTMLElement>('#contact-hint')!;
  const landingHint = document.querySelector<HTMLElement>('#landing-hint')!;
  const playerCard = document.querySelector<HTMLElement>('#player-card')!;
  const cpuCard = document.querySelector<HTMLElement>('#cpu-card')!;
  const serverLabel = document.querySelector<HTMLElement>('#server-label')!;
  let paused = false, toastTime = 0;
  let reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  try { const stored = localStorage.getItem('pickleball.reduceMotion'); if (stored !== null) reduceMotion = stored === 'on'; } catch { /* Optional preference. */ }
  motionControl.checked = reduceMotion;
  function text(element: HTMLElement, value: string) { if (element.textContent !== value) element.textContent = value; }
  function syncSound() {
    text(soundButton, audio.available ? audio.enabled ? '♪ 소리 켜짐' : '♪ 소리 꺼짐' : '소리 사용 불가');
    soundButton.setAttribute('aria-pressed', String(audio.enabled && audio.available));
    soundButton.disabled = !audio.available;
    volumeSlider.value = String(Math.round(audio.volume * 100)); text(volumeLabel, `${Math.round(audio.volume * 100)}%`);
  }
  soundButton.addEventListener('click', () => {
    audio.setEnabled(!audio.enabled); syncSound(); (document.activeElement as HTMLElement)?.blur();
  });
  volumeSlider.addEventListener('input', () => { audio.unlock(); audio.setVolume(Number(volumeSlider.value) / 100); syncSound(); });
  volumeSlider.addEventListener('change', () => { audio.play('dink'); volumeSlider.blur(); });
  motionControl.addEventListener('change', () => {
    reduceMotion = motionControl.checked;
    try { localStorage.setItem('pickleball.reduceMotion', reduceMotion ? 'on' : 'off'); } catch { /* Optional preference. */ }
    motionControl.blur();
  });
  const playerVelocity = new THREE.Vector3();
  function setPaused(value: boolean) {
    if (['idle', 'over'].includes(match.phase)) return;
    paused = value; keys.clear(); playerVelocity.set(0, 0, 0);
    pauseOverlay.hidden = !paused; audio.setPaused(paused);
    pauseButton.setAttribute('aria-pressed', String(paused));
    if (!paused) { clock.getDelta(); audio.unlock(); (document.activeElement as HTMLElement)?.blur(); }
  }
  pauseButton.addEventListener('click', () => setPaused(!paused));
  document.querySelector('#resume')!.addEventListener('click', () => setPaused(false));
  function feedback(value: string, good = true) {
    text(toast, value); toastTime = 1.15;
    toast.classList.toggle('good', good);
  }
  function shotEffect() {
    hitRing.position.copy(ball.position); hitPulse = 0.18;
  }
  function groundEffect() {
    bounceRing.position.set(ball.position.x, 0.054, ball.position.z); bouncePulse = 0.32;
    audio.play('bounce');
  }
  syncSound();
  const serviceBox = new THREE.Mesh(new THREE.PlaneGeometry(width / 2, halfLength - kitchen), new THREE.MeshBasicMaterial({ color: 0xffdf7d, transparent: true, opacity: 0.21, depthWrite: false }));
  serviceBox.rotation.x = -Math.PI / 2; scene.add(serviceBox);
  let swingTimer = 0, hitCooldown = 0, cpuServeDelay = 0;
  const playerMotion = new SwingMotion();
  let pendingHit: { shot: Shot; remaining: number } | null = null;
  let contactPoseTime = 0;
  const playerContact = new THREE.Vector3(), cpuContact = new THREE.Vector3();
  let cpuContactTime = 0;
  let announcedGameOver = false;
  let playerShot: Shot = 'drive', swingSide = 1;
  let lastPhase = match.phase;
  const keys = new Set<string>();

  function preparePoint() {
    playerMotion.clear();
    pendingHit = null; contactPoseTime = 0; cpuContactTime = 0;
    match.prepare(); ball.active = false; keys.clear(); cpu.reset(); playerVelocity.set(0, 0, 0);
    resetTrail(); hitPulse = 0; bouncePulse = 0; toastTime = 0;
    const from = match.servePosition, to = match.serveTarget;
    if (match.server === 'player') {
      player.group.position.set(from.x, 0.045, from.z);
      cpu.position.set(to.x, 0.045, -5.8);
    } else {
      cpu.position.set(from.x, 0.045, from.z);
      player.group.position.set(to.x, 0.045, 5.8);
    }
    aim.set(match.server === 'player' ? to.x : 0, 0.05, match.server === 'player' ? to.z : -4.8);
    pointerInside = false; hitCooldown = 0; swingTimer = 0; cpuServeDelay = 1.2;
  }
  function startMatch() {
    audio.unlock(); paused = false; pauseOverlay.hidden = true; audio.setPaused(false); pauseButton.setAttribute('aria-pressed', 'false');
    resultNotice.clear(); resultPanel.hidden = true; handledResult = null;
    match.start(); announcedGameOver = false; overlay.hidden = true;
    preparePoint(); (document.activeElement as HTMLElement)?.blur();
  }
  function dropServe() {
    if (paused || resultNotice.active) return;
    if (match.server === 'player') audio.unlock();
    if (!match.drop()) return;
    const actor = match.server === 'player' ? player.group.position : cpu.position;
    launchBall(new THREE.Vector3(actor.x + endSign(match.server) * 0.32, 1.0, actor.z - endSign(match.server) * 0.25), new THREE.Vector3());
    (document.activeElement as HTMLElement)?.blur();
  }
  function inReach() {
    const allowed = match.phase === 'rally' && match.receiver === 'player' || match.phase === 'drop' && match.server === 'player' && ball.bounces === 1;
    return allowed && ball.active && ball.position.z > 0 && canContact(player.group.position, ball.position);
  }
  function launchServe() {
    const actor = match.server === 'player' ? player.group.position : cpu.position;
    const server = match.server;
    if (!match.serve(server, actor)) return;
    const destination = server === 'player' ? aim.clone() : new THREE.Vector3(match.serveTarget.x, 0, match.serveTarget.z);
    const distance = Math.hypot(destination.x - ball.position.x, destination.z - ball.position.z);
    launchBall(ball.position.clone(), launchVelocity(ball.position, destination, Math.max(1.2, distance / 9.2)));
    const motion = server === 'player' ? playerMotion : cpu.motion;
    motion.begin(actor, ball.position, server === 'player' ? 0 : Math.PI, 'drive', false, 0);
    audio.play('serve'); shotEffect(); feedback(server === 'player' ? 'SERVE · 대각선으로!' : 'CPU SERVE');
    if (server === 'player') cpu.receive(); else cpu.swing = 0.28;
  }
  function hit(shot: Shot) {
    if (paused || resultNotice.active) return;
    audio.unlock();
    if (match.phase === 'ready' && match.server === 'player') { dropServe(); return; }
    if (hitCooldown > 0 || !['rally', 'drop'].includes(match.phase)) return;
    hitCooldown = 0.3; swingTimer = 0.32; playerShot = shot;
    playerMotion.begin(player.group.position, ball.position, 0, shot, match.phase === 'rally' && match.hits >= 3 && ball.bounces === 0);
    swingSide = ball.position.x >= player.group.position.x ? 1 : -1;
    if (!inReach()) { match.message = '헛스윙! 가까운 공의 높이와 타이밍을 맞춰보세요.'; audio.play('miss'); feedback('헛스윙 · 공 가까이에서 클릭!', false); return; }
    if (match.phase === 'drop') { launchServe(); return; }
    pendingHit = { shot, remaining: SWING_CONTACT_DELAY };
  }
  function contactHit(shot: Shot) {
    if (!inReach() || match.phase !== 'rally') { audio.play('miss'); feedback('헛스윙 · 공이 타격 범위를 벗어났어요', false); return; }
    const volley = ball.bounces === 0;
    if (!match.hit('player', player.group.position, ball.bounces)) return;
    playerMotion.impact(player.group.position, ball.position, 0, volley);
    playerContact.copy(ball.position); contactPoseTime = 0.11;
    const target = aim.clone();
    const distance = Math.hypot(ball.position.x - player.group.position.x, ball.position.z - player.group.position.z);
    const error = Math.max(0, distance - 0.85) * 1.8 + Math.max(0, 0.45 - ball.position.y) * 2 +
      (shot === 'dink' ? Math.max(0, player.group.position.z - 3) * 0.15 : 0);
    target.x += (Math.random() - 0.5) * error; target.z += (Math.random() - 0.5) * error;
    const velocity = volley ? volleyVelocity(ball.position, target, volleyStyle(shot, ball.velocity.length(), ball.position.y)) : shotVelocity(ball.position, target, shot);
    launchBall(ball.position.clone(), velocity); cpu.receive();
    const quality = contactQuality(distance, ball.position.y);
    audio.play(shot); shotEffect(); feedback(`${volley ? (shot === 'drive' ? 'VOLLEY' : 'SOFT VOLLEY') : shot === 'drive' ? 'DRIVE' : 'DINK'} · ${contactText[quality]}`, quality === 'sweet');
    match.message = volley ? (shot === 'drive' ? '발리! 공중에서 빠르게 받아쳤습니다.' : '부드러운 발리! 짧은 코스를 조준하세요.') : shot === 'drive' ? '드라이브! 빠르고 낮게 보냅니다.' : '딩크! 상대 키친에 짧게 보내보세요.';
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button === 0 || event.button === 2) { event.preventDefault(); hit(event.button === 0 ? 'drive' : 'dink'); }
  });
  serveButton.addEventListener('click', dropServe);
  document.querySelector('#start')!.addEventListener('click', startMatch);
  document.querySelector('#restart')!.addEventListener('click', startMatch);
  document.querySelector('#pause-restart')!.addEventListener('click', startMatch);
  const validKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
  window.addEventListener('keydown', event => {
    if ((event.code === 'Escape' || event.code === 'KeyP') && !event.repeat) { event.preventDefault(); setPaused(!paused); return; }
    if (paused || event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (validKeys.includes(event.code)) { event.preventDefault(); keys.add(event.code); }
    if (event.code === 'Space' && !event.repeat && match.server === 'player' && ['ready', 'drop'].includes(match.phase)) {
      event.preventDefault(); dropServe();
    }
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); playerVelocity.set(0, 0, 0); setPaused(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); playerVelocity.set(0, 0, 0); setPaused(true); } else clock.getDelta(); });
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  function resize() {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();
  const clock = new THREE.Clock();
  const movement = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();
  const lookAt = new THREE.Vector3(0, 0.3, -1.4);
  camera.position.set(1.8, 10.8, 16.8);
  let stride = 0, accumulator = 0, gameTime = 0;
  const impact = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    const elapsed = clock.getDelta();
    const realDt = document.hidden || paused ? 0 : Math.min(Math.max(elapsed, 0), 0.05);
    const dt = simulationDelta(elapsed, gameSpeed, document.hidden || paused);
    resultNotice.advance(elapsed, document.hidden || paused);
    if (!paused && resultNotice.canPrepareServe(match.phase)) { resultNotice.clear(); preparePoint(); }
    gameTime += dt;
    const canMove = !paused && ['ready', 'drop', 'rally', 'settling'].includes(match.phase);
    movement.set(canMove ? Number(keys.has('KeyD')) - Number(keys.has('KeyA')) : 0, 0,
      canMove ? Number(keys.has('KeyS')) - Number(keys.has('KeyW')) : 0);
    hitCooldown = Math.max(0, hitCooldown - dt); swingTimer = Math.max(0, swingTimer - dt);
    if (!paused && match.phase === 'ready' && match.server === 'cpu') { cpuServeDelay -= dt; if (cpuServeDelay <= 0) dropServe(); }
    if (pointerInside && !paused) {
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(aimPlane, impact)) aim.set(THREE.MathUtils.clamp(impact.x, -3.45, 3.45), 0.05, THREE.MathUtils.clamp(impact.z, -7.1, -0.25));
    }
    marker.position.copy(aim); marker.visible = !['idle', 'over'].includes(match.phase);
    serviceBox.visible = match.server === 'player' && ['ready', 'drop'].includes(match.phase);
    serviceBox.position.set(match.serveTarget.x < 0 ? -width / 4 : width / 4, 0.047, -(halfLength + kitchen) / 2);
    const oldPlayerZ = player.group.position.z;
    movement.normalize().multiplyScalar(3.8);
    playerVelocity.lerp(movement, 1 - Math.exp(-20 * dt));
    if (playerVelocity.lengthSq() < 0.0001) playerVelocity.set(0, 0, 0);
    player.group.position.addScaledVector(playerVelocity, dt);
    const moving = playerVelocity.lengthSq() > 0.03;
    if (moving) stride += playerVelocity.length() * dt * 2.8;
    // Movement assistance never serves or hits a ball, and cannot pull a volley into the kitchen.
    if (match.phase === 'rally' && match.receiver === 'player' && ball.active && ball.position.z > 0 && ball.position.y < 2.2) {
      const dx = ball.position.x - player.group.position.x, dz = ball.position.z - player.group.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 0.65 && distance < 1.65) {
        player.group.position.x += dx / distance * Math.min(0.65 * dt, distance - 0.65);
        if (ball.bounces > 0 || player.group.position.z > 2.6 && ball.position.z > 2.6)
          player.group.position.z += dz / distance * Math.min(0.65 * dt, distance - 0.65);
      }
    }
    player.group.position.x = THREE.MathUtils.clamp(player.group.position.x, -4.4, 4.4);
    player.group.position.z = THREE.MathUtils.clamp(player.group.position.z, 0.55, 8.2);
    accumulator += dt;
    while (accumulator >= 1 / 120) {
      const step = 1 / 120;
      if (match.phase === 'drop') {
        const event = ball.step(step, true);
        if (event === 'bounce' || event === 'double-bounce') groundEffect();
        if (match.server === 'cpu' && ball.bounces === 1 && ball.position.y >= 0.24 && ball.active) launchServe();
        else if (!ball.active && event) {
          match.phase = 'ready'; cpuServeDelay = 0.5;
          match.message = '서브 공을 놓쳤습니다. Space 또는 서브 준비로 다시 떨어뜨리세요.';
        }
      } else if (match.phase === 'rally') {
        const event = ball.step(step);
        if (event === 'net') { audio.play('net'); match.net(); }
        if (event === 'bounce' || event === 'out' || event === 'double-bounce') groundEffect();
        if (event === 'bounce' || event === 'out' || event === 'double-bounce') match.bounce(ball.position, ball.bounces);
      }
      playerMotion.advance(step);
      contactPoseTime = Math.max(0, contactPoseTime - step); cpuContactTime = Math.max(0, cpuContactTime - step);
      if (pendingHit) {
        pendingHit.remaining -= step;
        if (match.phase !== 'rally') pendingHit = null;
        else if (pendingHit.remaining <= 0) { const shot = pendingHit.shot; pendingHit = null; contactHit(shot); }
      }
      if (match.phase === 'rally') {
        const previousZ = cpu.position.z;
        const reply = cpu.update(step, ball, player.group.position, match.receiver === 'cpu', match.hits >= 3 && !match.bounceRequired.cpu);
        match.updateFeet('cpu', cpu.position, step, cpu.position.z > previousZ + 0.00001);
        if (reply && match.phase === 'rally') {
          if (reply.missed) { match.message = 'CPU가 헛스윙했습니다!'; audio.play('miss'); }
          else if (match.hit('cpu', cpu.position, ball.bounces)) {
            cpuContact.copy(ball.position); cpuContactTime = 0.11;
            launchBall(ball.position.clone(), reply.volley ? volleyVelocity(ball.position, reply.target, reply.volley) : shotVelocity(ball.position, reply.target, reply.shot));
            audio.play(reply.shot); shotEffect();
            match.message = `CPU ${reply.volley ? '발리' : reply.shot === 'drive' ? '드라이브' : '딩크'}! 직접 받아치세요.`;
          }
        }
      } else {
        cpu.motion.advance(step);
        cpu.moving = false; cpu.swing = Math.max(0, cpu.swing - step);
        match.updateFeet('cpu', cpu.position, step, false);
      }
      match.updateFeet('player', player.group.position, step, player.group.position.z < oldPlayerZ - 0.00001);
      match.tick(step);
      if (['settling', 'between', 'over'].includes(match.phase)) ball.active = false;
      accumulator -= step;
    }
    opponent.group.position.copy(cpu.position);
    text(cpuLabel, match.server === 'cpu' && ['ready', 'drop'].includes(match.phase) ? '서브 준비' : cpu.status);
    if (match.phase === 'ready') {
      const actor = match.server === 'player' ? player.group.position : cpu.position;
      ball.position.set(actor.x + endSign(match.server) * 0.32, 1, actor.z - endSign(match.server) * 0.25);
    }
    ballMesh.position.copy(ball.position); ballMesh.visible = !['idle', 'over', 'between'].includes(match.phase);
    shadow.position.set(ball.position.x, 0.05, ball.position.z); shadow.visible = ballMesh.visible;
    shadow.scale.setScalar(1 + ball.position.y * 0.10);
    shadowRim.position.copy(shadow.position); shadowRim.scale.copy(shadow.scale); shadowRim.visible = shadow.visible;
    // Target a 12 CSS-pixel ball at a distance, with a capped visual boost.
    const pixelsRadius = 12 * camera.position.distanceTo(ball.position) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(1, canvas.clientHeight);
    ballMesh.scale.setScalar(THREE.MathUtils.clamp(pixelsRadius / ballDisplayRadius, 1, 2));
    // Lift only the enlarged drawing so its outline is not cut off by the floor.
    ballMesh.position.y += ballDisplayRadius * ballMesh.scale.x * 1.22 - BALL_RADIUS;
    const reach = inReach();
    const mustBounce = match.phase === 'rally' && match.receiver === 'player' && match.bounceRequired.player;
    const kitchenVolley = reach && match.phase === 'rally' && ball.bounces === 0 && inKitchen(player.group.position);
    const quality = contactQuality(Math.hypot(ball.position.x - player.group.position.x, ball.position.z - player.group.position.z), ball.position.y);
    text(readiness, match.phase === 'ready' ? (match.server === 'player' ? 'Space 또는 클릭으로 서브 공 떨어뜨리기' : 'CPU 서브를 준비합니다') :
      mustBounce ? '투바운스 룰 · 바운드를 기다리세요' : kitchenVolley ? '키친 안 · 바운드한 공만 타격 가능' :
      reach ? '● 지금 클릭하면 타격 가능' : match.phase === 'rally' ? '○ 공을 따라 이동하세요' : match.phase === 'drop' ? '드롭 서브 · 바운드 후 클릭' : '11점 · 2점 차 승리 · 서버만 득점');
    readiness.classList.toggle('ready', reach && !mustBounce && !kitchenVolley);
    const serving = match.server === 'player' && ['ready', 'drop'].includes(match.phase);
    const aimError = serving ? match.serveLandingError(aim) : !inCourt(aim) ? '목표가 라인 밖입니다. 아웃에 주의하세요.' : undefined;
    marker.material.color.setHex(aimError ? 0xff8168 : 0xffed91);
    text(contactHint, aimError || (reach && !mustBounce && !kitchenVolley ? contactText[quality] : serving ? '노란 서비스 코트 조준 → 바운드 후 직접 클릭' : '낮은 공은 딩크로 띄워보세요.'));
    contactHint.classList.toggle('warning', Boolean(aimError));
    const showLanding = match.phase === 'rally' && match.receiver === 'player' && ball.active && ball.bounces === 0;
    landingMarker.visible = showLanding;
    if (showLanding) {
      const expected = landingPoint(ball.position, ball.velocity);
      landingMarker.position.set(expected.x, expected.y, expected.z);
      landingMarker.material.color.setHex(inCourt(expected) ? 0x8df4ff : 0xff8c73);
      landingMarker.scale.setScalar(reduceMotion ? 1 : 1 + Math.sin(gameTime * 7) * 0.06);
    }
    text(landingHint, showLanding ? '◎ 큰 원: 예상 착지 · 진한 점: 공 아래 · 아웃 예상은 주황색' : 'WASD 이동 · P / Esc 일시정지');
    reachRing.visible = !paused && (match.phase === 'rally' && match.receiver === 'player' || match.phase === 'drop' && match.server === 'player');
    reachRing.position.set(player.group.position.x, 0.052, player.group.position.z);
    reachRing.material.color.setHex(mustBounce || kitchenVolley ? 0xf4a478 : reach ? 0x9affc4 : 0xb6d8dc);
    text(message, match.message); text(rallyLabel, String(match.hits));
    text(playerScore, String(match.score.player)); text(cpuScore, String(match.score.cpu));
    playerCard.classList.toggle('serving', match.server === 'player'); cpuCard.classList.toggle('serving', match.server === 'cpu');
    text(serverLabel, `${match.server === 'player' ? '나' : 'CPU'} 서브 · ${match.score[match.server] % 2 === 0 ? '오른쪽' : '왼쪽'}`);
    serveButton.disabled = paused || match.server !== 'player' || !['ready', 'drop'].includes(match.phase);
    pauseButton.disabled = ['idle', 'over'].includes(match.phase);
    if (match.phase !== lastPhase) {
      if (match.phase === 'settling' && !match.pending?.reason.includes('네트')) audio.play('fault');
      lastPhase = match.phase;
    }
    if (match.result && match.result !== handledResult) {
      handledResult = match.result;
      resultNotice.show(match.result);
      text(resultHeading, resultTitle(match.result)); text(resultCopy, resultDetail(match.result));
      resultPanel.classList.toggle('cpu-result', match.result.side === 'cpu');
      keys.clear(); playerVelocity.set(0, 0, 0); toastTime = 0;
      if (match.result.kind === 'point' && !reduceMotion) {
        (match.result.side === 'player' ? playerScore : cpuScore).animate([{ transform: 'scale(1.35)', color: '#2b9962' }, { transform: 'scale(1)', color: '#163e3c' }], { duration: 400 });
      }
      audio.play(match.result.matchWinner ? match.result.matchWinner === 'player' ? 'win' : 'lose' : match.result.kind === 'point' ? 'point' : 'sideout');
    }
    resultPanel.hidden = !resultNotice.active;
    resultPanel.style.opacity = String(resultNotice.opacity);
    toastTime = Math.max(0, toastTime - dt); toast.classList.toggle('visible', toastTime > 0 && !paused);
    document.documentElement.classList.toggle('reduced-motion', reduceMotion);
    syncSound();
    if (match.phase === 'over' && !announcedGameOver && !resultNotice.active) {
      announcedGameOver = true; keys.clear(); playerVelocity.set(0, 0, 0); overlay.hidden = false;
      document.querySelector('#overlay-title')!.textContent = match.winner === 'player' ? 'YOU WIN!' : 'YOU LOSE!';
      document.querySelector('#overlay-copy')!.textContent = `최종 점수 ${match.score.player} : ${match.score.cpu} · 새 경기에서 다시 도전하세요.`;
      document.querySelector('#start')!.textContent = '다시 경기하기';
    }
    animateAthlete(player, { motion: playerMotion, contactBlend: pendingHit ? 1 - pendingHit.remaining / SWING_CONTACT_DELAY : 1, contact: pendingHit ? ball.position : contactPoseTime > 0 ? playerContact : undefined, walking: moving, phase: stride, swingLeft: swingTimer, shot: playerShot, lateral: playerVelocity.x, side: swingSide, ready: reach, dt, time: gameTime, reduceMotion });
    animateAthlete(opponent, { motion: cpu.motion, contactBlend: cpu.pending ? 1 - cpu.pending.remaining / SWING_CONTACT_DELAY : 1, contact: cpu.pending ? ball.position : cpuContactTime > 0 ? cpuContact : undefined, walking: cpu.moving, phase: cpu.stride, swingLeft: cpu.swing, shot: cpu.status.includes('딩크') || cpu.volley === 'soft' ? 'dink' : 'drive', lateral: 0, side: 1, ready: match.phase === 'rally' && match.receiver === 'cpu', dt, time: gameTime, reduceMotion });
    trailTime += dt;
    if (trailTime >= 0.025) {
      trailTime = 0; trailPositions.copyWithin(0, 3); ball.position.toArray(trailPositions, (trailCount - 1) * 3);
      trailGeometry.attributes.position.needsUpdate = true;
    }
    trail.visible = !reduceMotion && ball.active && match.phase === 'rally';
    hitPulse = Math.max(0, hitPulse - dt); bouncePulse = Math.max(0, bouncePulse - dt);
    hitRing.visible = !reduceMotion && hitPulse > 0; hitRing.quaternion.copy(camera.quaternion);
    hitRing.scale.setScalar(1 + (1 - hitPulse / 0.18) * 4); hitRing.material.opacity = hitPulse / 0.18;
    bounceRing.visible = !reduceMotion && bouncePulse > 0;
    bounceRing.scale.setScalar(1 + (1 - bouncePulse / 0.32) * 5); bounceRing.material.opacity = bouncePulse / 0.32;
    desiredCamera.set(player.group.position.x * 0.23 + 1.8, 10.8, 15.5 + player.group.position.z * 0.26);
    camera.position.lerp(desiredCamera, 1 - Math.exp(-3 * realDt)); camera.lookAt(lookAt);
    renderer.render(scene, camera);
  });
}
