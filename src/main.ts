import * as THREE from 'three';
import './style.css';
import { CpuPlayer } from './cpu';
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

  function person(color: number, z: number, facing: number) {
    const group = new THREE.Group();
    group.position.set(0, 0.045, z);
    group.rotation.y = facing;
    const torso = box(0.48, 0.59, 0.28, color, 0, 1.03);
    group.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), new THREE.MeshStandardMaterial({ color: 0xefc5a0 }));
    head.position.y = 1.53; head.castShadow = true; group.add(head);
    group.add(box(0.38, 0.09, 0.36, color, 0, 1.66));
    group.add(box(0.38, 0.035, 0.19, color, 0, 1.63, -0.2));
    group.add(box(0.45, 0.23, 0.3, 0x23434b, 0, 0.65));
    const legs = [-1, 1].map(side => {
      const pivot = new THREE.Group(); pivot.position.set(side * 0.13, 0.6, 0);
      pivot.add(box(0.14, 0.45, 0.16, 0xefc5a0, 0, -0.22));
      pivot.add(box(0.19, 0.12, 0.32, 0xf8f6e8, 0, -0.5, -0.055));
      group.add(pivot); return pivot;
    });
    const arms = [-1, 1].map(side => {
      const pivot = new THREE.Group(); pivot.position.set(side * 0.31, 1.25, 0);
      pivot.add(box(0.13, 0.43, 0.14, 0xefc5a0, 0, -0.21));
      group.add(pivot); return pivot;
    });
    const paddle = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.035, 20), new THREE.MeshStandardMaterial({ color: 0x173d45 }));
    paddle.rotation.x = Math.PI / 2; paddle.scale.z = 1.25; paddle.position.set(0, -0.61, -0.04); arms[1].add(paddle);
    arms[1].add(box(0.045, 0.18, 0.045, 0xe1c59b, 0, -0.45));
    scene.add(group);
    return { group, legs, arms };
  }
  const player = person(0x348ee0, 5, 0);
  const opponent = person(0xf09355, -5, Math.PI);
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
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS * 1.65, 20, 12), new THREE.MeshStandardMaterial({ color: 0xeaff16, emissive: 0x778800, emissiveIntensity: 0.45, roughness: 0.5 }));
  ballMesh.castShadow = true;
  scene.add(ballMesh);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), new THREE.MeshBasicMaterial({ color: 0x294a35, transparent: true, opacity: 0.4, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
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
  const message = document.querySelector<HTMLElement>('#message')!;
  const readiness = document.querySelector<HTMLElement>('#readiness')!;
  let pendingFeed = 0.8, swingTimer = 0, hitCooldown = 0;
  let returned = false, rallyActive = false, rallyHits = 0;
  const rallyLabel = document.querySelector<HTMLElement>('#rally')!;
  const cpuLabel = document.querySelector<HTMLElement>('#cpu-status')!;
  function feed() {
    const from = new THREE.Vector3(0, 1.25, -4.5);
    const target = new THREE.Vector3(THREE.MathUtils.clamp(player.group.position.x, -2.3, 2.3), 0, 4);
    ball.launch(from, launchVelocity(from, target, 1.35));
    pendingFeed = 0; returned = false; rallyActive = true; rallyHits = 0;
    cpu.attempted = false; rallyLabel.textContent = '0';
    message.textContent = 'CPU가 연습 공을 보냅니다. 받아쳐서 랠리를 이어가세요!';
  }
  function queueFeed(text: string) {
    if (!rallyActive) return;
    rallyActive = false; message.textContent = text;
    pendingFeed = 2.2;
  }
  function inReach() {
    return rallyActive && ball.active && !returned && ball.position.z > 0 && ball.position.y >= 0.18 && ball.position.y <= 1.9 &&
      Math.hypot(ball.position.x - player.group.position.x, ball.position.z - player.group.position.z) <= 1.25;
  }
  function hit(shot: Shot) {
    if (hitCooldown > 0) return;
    hitCooldown = 0.3; swingTimer = 0.28;
    if (!inReach()) { message.textContent = '헛스윙! 공 가까이에서 높이와 타이밍을 맞춰보세요.'; return; }
    const target = aim.clone();
    const distance = Math.hypot(ball.position.x - player.group.position.x, ball.position.z - player.group.position.z);
    // Reaching/low contacts lose accuracy. Dinks become more reliable close to the net.
    const error = Math.max(0, distance - 0.85) * 1.8 + Math.max(0, 0.45 - ball.position.y) * 2 +
      (shot === 'dink' ? Math.max(0, player.group.position.z - 3) * 0.15 : 0);
    target.x += (Math.random() - 0.5) * error;
    target.z += (Math.random() - 0.5) * error;
    ball.launch(ball.position.clone(), shotVelocity(ball.position, target, shot));
    returned = true; cpu.receive(); rallyHits++; rallyLabel.textContent = String(rallyHits);
    message.textContent = shot === 'drive' ? '드라이브! 빠르고 낮게 보냅니다.' : '딩크! 짧은 공은 상대 키친을 조준하세요.';
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button === 0 || event.button === 2) { event.preventDefault(); hit(event.button === 0 ? 'drive' : 'dink'); }
  });
  document.querySelector('#feed')!.addEventListener('click', () => {
    feed(); (document.activeElement as HTMLElement)?.blur();
  });
  const keys = new Set<string>();
  const validKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
  window.addEventListener('keydown', event => {
    if (validKeys.includes(event.code) && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); keys.add(event.code); }
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => { if (document.hidden) keys.clear(); });
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  document.querySelector('#reset')!.addEventListener('click', () => { player.group.position.set(0, 0.045, 5); keys.clear(); ball.active = false; pendingFeed = 0.8; returned = false; rallyActive = false; rallyHits = 0; rallyLabel.textContent = '0'; cpu.reset(); message.textContent = '위치를 초기화했습니다. 새 공을 준비합니다.'; (document.activeElement as HTMLElement)?.blur(); });
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
  let stride = 0, accumulator = 0;
  const impact = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    movement.set(Number(keys.has('KeyD')) - Number(keys.has('KeyA')), 0, Number(keys.has('KeyS')) - Number(keys.has('KeyW')));
    hitCooldown = Math.max(0, hitCooldown - dt);
    swingTimer = Math.max(0, swingTimer - dt);
    if (pendingFeed > 0) { pendingFeed -= dt; if (pendingFeed <= 0) feed(); }
    if (pointerInside) {
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(aimPlane, impact)) {
        aim.set(THREE.MathUtils.clamp(impact.x, -3.45, 3.45), 0.05, THREE.MathUtils.clamp(impact.z, -7.1, -0.25));
      }
    }
    marker.position.copy(aim);
    // Only nudge a nearby incoming ball's receiver; never trigger a shot.
    if (rallyActive && ball.active && !returned && ball.position.z > 0 && ball.position.y < 2.2) {
      const dx = ball.position.x - player.group.position.x;
      const dz = ball.position.z - player.group.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 0.65 && distance < 1.65) {
        player.group.position.x += dx / distance * Math.min(0.65 * dt, distance - 0.65);
        player.group.position.z += dz / distance * Math.min(0.65 * dt, distance - 0.65);
      }
    }
    accumulator += dt;
    while (accumulator >= 1 / 120) {
      const event = ball.step(1 / 120);
      if (event === 'net') queueFeed(`${returned ? '나' : 'CPU'}의 공이 네트에 걸렸습니다. 새 랠리를 준비합니다.`);
      if (event === 'out') queueFeed(ball.bounces >= 2 ? `${returned ? 'CPU가' : '내가'} 공을 놓쳤습니다. 새 랠리를 준비합니다.` : `${returned ? '나' : 'CPU'}의 공이 아웃되었습니다. 새 랠리를 준비합니다.`);
      if (event === 'double-bounce') queueFeed(`${returned ? 'CPU가' : '내가'} 공을 놓쳤습니다. 두 번 바운드!`);
      const reply = cpu.update(1 / 120, ball, player.group.position, rallyActive && returned);
      if (reply) {
        if (reply.missed) message.textContent = 'CPU가 어려운 공에 헛스윙했습니다!';
        else {
          ball.launch(ball.position.clone(), shotVelocity(ball.position, reply.target, reply.shot));
          returned = false; rallyHits++; rallyLabel.textContent = String(rallyHits);
          message.textContent = `CPU ${reply.shot === 'drive' ? '드라이브' : '딩크'}! 공을 따라 이동해 직접 받아치세요.`;
        }
      }
      accumulator -= 1 / 120;
    }
    opponent.group.position.copy(cpu.position);
    const cpuSwing = cpu.moving ? Math.sin(cpu.stride) * 0.4 : 0;
    opponent.legs[0].rotation.x = cpuSwing; opponent.legs[1].rotation.x = -cpuSwing;
    opponent.arms[0].rotation.x = -cpuSwing * 0.5;
    opponent.arms[1].rotation.x = cpu.swing > 0 ? -Math.sin(cpu.swing / 0.28 * Math.PI) * 1.7 : cpuSwing * 0.5;
    cpuLabel.textContent = cpu.status;
    ballMesh.position.copy(ball.position); ballMesh.visible = ball.active || pendingFeed > 0;
    shadow.position.set(ball.position.x, 0.05, ball.position.z);
    shadow.visible = ballMesh.visible;
    shadow.scale.setScalar(1 + ball.position.y * 0.15);
    readiness.textContent = inReach() ? '● 지금 클릭하면 타격 가능' : '○ 공을 따라 이동하세요';
    readiness.classList.toggle('ready', inReach());
    const moving = movement.lengthSq() > 0;
    if (moving) {
      movement.normalize(); player.group.position.addScaledVector(movement, 3.8 * dt); stride += dt * 11;
    }
    // Keep the player on their own side; allow space outside the lines.
    player.group.position.x = THREE.MathUtils.clamp(player.group.position.x, -4.4, 4.4);
    player.group.position.z = THREE.MathUtils.clamp(player.group.position.z, 0.55, 8.2);
    const swing = moving ? Math.sin(stride) * 0.42 : 0;
    player.legs[0].rotation.x = swing; player.legs[1].rotation.x = -swing;
    player.arms[0].rotation.x = -swing * 0.6; player.arms[1].rotation.x = swingTimer > 0 ? -Math.sin(swingTimer / 0.28 * Math.PI) * 1.7 - 0.2 : swing * 0.4 - 0.2;
    player.group.position.y = 0.045 + (moving ? Math.abs(Math.sin(stride)) * 0.025 : 0);
    // Limited follow keeps the far baseline visible even near the net.
    desiredCamera.set(player.group.position.x * 0.23 + 1.8, 10.8, 15.5 + player.group.position.z * 0.26);
    camera.position.lerp(desiredCamera, 1 - Math.exp(-3 * dt));
    camera.lookAt(lookAt);
    renderer.render(scene, camera);
  });
}
