import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

type Mats = ReturnType<typeof materials>;
function materials() {
  const wood = (color: string, roughness = 0.55) => new THREE.MeshStandardMaterial({ color, roughness });
  return {
    wall: wood('#e8e1d8', 0.88), edge: wood('#faf6ef', 0.72), floor: wood('#8c5d3f', 0.76),
    wood: wood('#8f5c3d', 0.62), woodLight: wood('#b8784c', 0.57), woodDark: wood('#5b3525', 0.68),
    black: new THREE.MeshStandardMaterial({ color: '#202326', roughness: 0.32, metalness: 0.2 }),
    fabric: new THREE.MeshStandardMaterial({ color: '#ded9d2', roughness: 0.92 }),
    blue: new THREE.MeshStandardMaterial({ color: '#6f8794', roughness: 0.86 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#b9dbe4', roughness: 0.08, transmission: 0.8, transparent: true, opacity: 0.56 }),
  };
}
function group(id: string, name: string, note: string, pos: [number, number, number]) { const g = new THREE.Group(); g.name = name; g.position.set(...pos); g.userData.sculptComponent = { id, name, note }; g.userData.basePosition = [...pos]; return g; }
function box(parent: THREE.Object3D, mat: THREE.Material, size: [number, number, number], pos: [number, number, number], radius = 0.04) { const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 3, Math.min(radius, Math.min(...size) * 0.4)), mat); mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; }
function cyl(parent: THREE.Object3D, mat: THREE.Material, r: number, h: number, pos: [number, number, number], segments = 20) { const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segments), mat); mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; }

function addCubeShell(root: THREE.Group, m: Mats) {
  const shell = group('cube-shell', '立方体房间', '米白色三面墙与木地板组成的开放式立方体空间。', [0, 0, 0]); root.add(shell); shell.userData.explodeDirection = [0, 0.2, -0.2];
  box(shell, m.floor, [10, 0.28, 8], [0, 0.14, 0], 0.08); box(shell, m.wall, [10, 7.3, 0.22], [0, 3.8, -3.9], 0.03); box(shell, m.wall, [0.22, 7.3, 8], [-4.9, 3.8, 0], 0.03);
  box(shell, m.edge, [10.15, 0.16, 0.16], [0, 7.42, -3.82], 0.02); box(shell, m.edge, [0.16, 0.16, 8], [-4.82, 7.42, 0], 0.02);
  for (let x = -4.5; x <= 4.5; x += 1) box(shell, m.woodDark, [0.018, 0.012, 7.78], [x, 0.3, 0], 0); return shell;
}
function addDesk(root: THREE.Group, m: Mats) {
  const desk = group('desk', 'L 形书桌', '参考图中的 L 形木桌：宽桌面、右侧三层抽屉和左侧支撑架。', [0.55, 0, 0.1]); root.add(desk); desk.userData.explodeDirection = [0.35, 0.15, 0.2];
  box(desk, m.woodLight, [6.7, 0.22, 1.7], [0.2, 2.7, -1.7], 0.1); box(desk, m.woodLight, [2.5, 0.22, 3.3], [-2.0, 2.7, 0.1], 0.1); box(desk, m.wood, [2.15, 2.45, 1.5], [3.05, 1.3, -1.55], 0.06);
  for (let i = 0; i < 3; i++) { box(desk, m.woodLight, [1.9, 0.58, 1.56], [3.05, 0.62 + i * 0.76, -1.54], 0.035); cyl(desk, m.woodDark, 0.07, 0.12, [3.05, 0.91 + i * 0.76, -2.35], 18).rotation.x = Math.PI / 2; }
  for (const [x, z] of [[-4.0, -1.2], [-0.5, -1.2], [-3.9, 1.25], [3.85, -1.35]] as [number, number][]) { const leg = cyl(desk, m.woodDark, 0.1, 2.55, [x, 1.35, z], 16); leg.rotation.z = x < -3 ? 0.18 : -0.08; }
  box(desk, m.black, [2.3, 1.4, 0.07], [0.95, 2.86, -2.26], 0.03); box(desk, m.edge, [1.05, 0.76, 0.04], [0.95, 2.88, -2.31], 0.02); return desk;
}
function addChair(root: THREE.Group, m: Mats) {
  const chair = group('chair', '软包木椅', '中央单人椅：木质扶手与腿架，配米白色靠背和坐垫。', [0, 0, 1.65]); root.add(chair); chair.userData.explodeDirection = [0, 0.15, 0.75];
  box(chair, m.fabric, [1.55, 1.25, 0.32], [0, 2.0, 0], 0.16); box(chair, m.fabric, [1.5, 1.0, 0.32], [0, 3.05, -0.42], 0.16);
  for (const x of [-0.58, 0.58]) for (const z of [-0.36, 0.36]) cyl(chair, m.wood, 0.075, 2.0, [x, 1.0, z], 16);
  for (const x of [-0.85, 0.85]) { const arm = cyl(chair, m.woodLight, 0.08, 1.85, [x, 2.55, 0], 16); arm.rotation.z = x * -0.08; box(chair, m.woodLight, [0.15, 0.15, 1.55], [x, 3.18, 0], 0.05); } return chair;
}
function addWindow(root: THREE.Group, m: Mats) {
  const win = group('window', '百叶窗', '右侧大窗与水平百叶片，把鼠标驱动的暖光投进房间。', [2.15, 0, -3.76]); root.add(win); win.userData.explodeDirection = [0.55, 0.2, -0.55];
  box(win, m.glass, [4.3, 3.3, 0.06], [0, 4.55, 0], 0.02); box(win, m.edge, [4.6, 0.13, 0.16], [0, 6.25, 0.08], 0.02); box(win, m.edge, [4.6, 0.13, 0.16], [0, 2.85, 0.08], 0.02);
  box(win, m.edge, [0.13, 3.5, 0.16], [-2.25, 4.55, 0.08], 0.02); box(win, m.edge, [0.13, 3.5, 0.16], [2.25, 4.55, 0.08], 0.02);
  for (let i = 0; i < 15; i++) box(win, i % 2 ? m.edge : m.wall, [4.28, 0.11, 0.12], [0, 3.05 + i * 0.22, 0.22], 0.02); return win;
}
function addShelf(root: THREE.Group, m: Mats) {
  const shelf = group('shelf', '开放式书架', '左后方木质开放层架，书本与小摆件作为空间尺度参照。', [-1.85, 0, -3.15]); root.add(shelf); shelf.userData.explodeDirection = [-0.45, 0.2, -0.65];
  for (const x of [-0.9, 0.9]) box(shelf, m.wood, [0.16, 5.7, 0.95], [x, 3.25, 0], 0.03); for (const y of [0.55, 1.9, 3.25, 4.6, 5.95]) box(shelf, m.woodLight, [1.95, 0.16, 1], [0, y, 0], 0.03);
  const colors = [m.edge, m.blue, m.woodDark, m.fabric]; for (let level = 0; level < 3; level++) for (let i = 0; i < 7; i++) { const book = box(shelf, colors[(i + level) % colors.length], [0.16 + (i % 2) * 0.05, 0.85, 0.7], [-0.65 + i * 0.2, 0.98 + level * 1.35, 0.08], 0.015); book.rotation.z = i === 2 ? 0.1 : 0; } return shelf;
}
export function createNordicRoomModel() { const root = new THREE.Group(); root.name = 'Desk Chair Window Cube'; const m = materials(); addCubeShell(root, m); addDesk(root, m); addChair(root, m); addWindow(root, m); addShelf(root, m); root.userData.approximation = 'Single-view stylized procedural reconstruction; hidden surfaces are plausibly completed.'; return root; }
export function createWarmNordicMiniatureRoomLookDevLights() {
  const lights = new THREE.Group(); lights.add(new THREE.HemisphereLight(0xfff3df, 0x28313a, 1.35)); const fill = new THREE.DirectionalLight(0xa9c9e8, 1.1); fill.position.set(-4, 6, 6); lights.add(fill);
  const key = new THREE.SpotLight(0xffc477, 8, 22, Math.PI / 7, 0.65, 1.5); key.name = 'mouse-follow-key-light'; key.position.set(2, 6.5, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); lights.add(key);
  const target = new THREE.Object3D(); target.name = 'mouse-light-target'; target.position.set(0, 1.5, 0); lights.add(target); key.target = target; lights.userData.mouseLight = { key, target }; return lights;
}
export function createLightRayVisual() {
  const root = new THREE.Group(); root.name = 'mouse-light-rays'; const mat = new THREE.MeshBasicMaterial({ color: '#ffd68e', transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  for (let i = 0; i < 3; i++) { const ray = new THREE.Mesh(new THREE.ConeGeometry(0.28 + i * 0.12, 6.5, 24, 1, true), mat.clone()); ray.name = `light-ray-${i}`; ray.position.set(2.1 + (i - 1) * 0.55, 4.65, -1); ray.rotation.x = Math.PI / 2; root.add(ray); }
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 12), new THREE.MeshBasicMaterial({ color: '#ffe4a8' })); orb.name = 'light-orb'; root.add(orb); return root;
}
