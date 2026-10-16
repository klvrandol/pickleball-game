import * as THREE from 'three';
import {createParkEnvironment} from './park-environment.ts';
export function createTitleScene(canvas:HTMLCanvasElement){
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


 return {renderer,scene,camera};
}
