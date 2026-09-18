import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createBlueSofaModel, type SofaPart } from './blueSofaModel';
import './sofa.css';

const canvas = document.querySelector<HTMLCanvasElement>('#sofa-canvas');
if (!canvas) throw new Error('Sofa canvas not found');
const params = new URLSearchParams(location.search);
if (params.has('review')) document.body.classList.add('review');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.94;

const scene = new THREE.Scene();
scene.background = new THREE.Color(params.has('review') ? '#f4f0eb' : '#ebe6e0');
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.035).texture;

const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 60);
camera.position.set(-7.1, 4.1, 8.7);
if (params.get('view') === 'side') camera.position.set(8.8, 3.2, 0.8);
if (params.get('view') === 'rear') camera.position.set(-6.7, 3.7, -8.2);

const sofa = createBlueSofaModel();
sofa.rotation.y = -0.03;
scene.add(sofa);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: '#e6ded5', roughness: 0.94 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0.02;
ground.receiveShadow = true;
scene.add(ground);

const hemi = new THREE.HemisphereLight(0xfff8ef, 0x59646d, 1.08);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffead6, 2.5);
key.position.set(-4.5, 7.5, 7);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = key.shadow.camera.bottom = -7;
key.shadow.camera.right = key.shadow.camera.top = 7;
scene.add(key);
const rim = new THREE.DirectionalLight(0xbad7ef, 0.72);
rim.position.set(6, 4, -5);
scene.add(rim);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.target.set(0, 1.35, 0);
controls.minDistance = 5;
controls.maxDistance = 18;
controls.maxPolarAngle = 1.48;
controls.update();

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
canvas.addEventListener('pointerdown', (event) => {
  const rect = canvas.getBoundingClientRect();
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(sofa, true)[0];
  let node: THREE.Object3D | null = hit?.object ?? null;
  while (node && !node.userData.sculptComponent) node = node.parent;
  const component = node?.userData.sculptComponent as { name: string; note: string } | undefined;
  const title = document.querySelector('#part-title');
  const note = document.querySelector('#part-note');
  if (component && title && note) {
    title.textContent = component.name;
    note.textContent = component.note;
  }
});

document.querySelector('#reset')?.addEventListener('click', () => {
  camera.position.set(-7.1, 4.1, 8.7);
  controls.target.set(0, 1.35, 0);
  controls.update();
});

let exploded = false;
document.querySelector('#explode')?.addEventListener('click', (event) => {
  exploded = !exploded;
  const button = event.currentTarget as HTMLButtonElement;
  button.textContent = exploded ? '合拢模型' : '展开部件';
  button.classList.toggle('active', exploded);
});

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
}
addEventListener('resize', resize);

let firstFrame = true;
renderer.setAnimationLoop(() => {
  const parts = sofa.userData.parts as SofaPart[];
  parts.forEach((part) => {
    const base = part.userData.basePosition ?? [0, 0, 0];
    const direction = part.userData.explodeDirection ?? [0, 0, 0];
    const amount = exploded ? 1.15 : 0;
    part.position.lerp(new THREE.Vector3(base[0] + direction[0] * amount, base[1] + direction[1] * amount, base[2] + direction[2] * amount), 0.09);
  });
  controls.update();
  renderer.render(scene, camera);
  if (firstFrame) {
    firstFrame = false;
    requestAnimationFrame(() => document.querySelector('#loading')?.classList.add('hidden'));
  }
});
