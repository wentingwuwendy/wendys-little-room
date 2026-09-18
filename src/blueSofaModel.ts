import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type SofaPart = THREE.Group & {
  userData: {
    sculptComponent?: { id: string; name: string; note: string };
    basePosition?: [number, number, number];
    explodeDirection?: [number, number, number];
  };
};

function seededNoise(x: number, y: number, seed: number) {
  const v = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

function makeFabricTextures(size = 512) {
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = size;
  bumpCanvas.width = bumpCanvas.height = size;
  roughCanvas.width = roughCanvas.height = size;

  const colorCtx = colorCanvas.getContext('2d')!;
  const bumpCtx = bumpCanvas.getContext('2d')!;
  const roughCtx = roughCanvas.getContext('2d')!;
  const color = colorCtx.createImageData(size, size);
  const bump = bumpCtx.createImageData(size, size);
  const rough = roughCtx.createImageData(size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const broad = Math.sin(x * 0.011 + y * 0.007) * 1.4;
      const fleck = (seededNoise(x, y, 17) - 0.5) * 5;
      const weave = ((x % 4 === 0 ? 1 : 0) + (y % 5 === 0 ? 1 : 0)) * 0.8;
      color.data[index] = 65 + broad + fleck + weave;
      color.data[index + 1] = 91 + broad + fleck + weave;
      color.data[index + 2] = 119 + broad + fleck + weave;
      color.data[index + 3] = 255;

      const thread = 116 + (x % 4 === 0 ? 30 : 0) + (y % 5 === 0 ? 20 : 0) + (seededNoise(x, y, 41) - 0.5) * 18;
      bump.data[index] = bump.data[index + 1] = bump.data[index + 2] = thread;
      bump.data[index + 3] = 255;

      const roughness = 206 + Math.sin(x * 0.037 + y * 0.021) * 15 + (seededNoise(x, y, 89) - 0.5) * 12;
      rough.data[index] = rough.data[index + 1] = rough.data[index + 2] = roughness;
      rough.data[index + 3] = 255;
    }
  }
  colorCtx.putImageData(color, 0, 0);
  bumpCtx.putImageData(bump, 0, 0);
  roughCtx.putImageData(rough, 0, 0);

  const setup = (canvas: HTMLCanvasElement, colorSpace: THREE.ColorSpace) => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = colorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(7.5, 7.5);
    texture.anisotropy = 8;
    return texture;
  };
  return {
    color: setup(colorCanvas, THREE.SRGBColorSpace),
    bump: setup(bumpCanvas, THREE.NoColorSpace),
    roughness: setup(roughCanvas, THREE.NoColorSpace),
  };
}

function makePart(id: string, name: string, note: string, position: [number, number, number], explodeDirection: [number, number, number]) {
  const group = new THREE.Group() as SofaPart;
  group.name = name;
  group.position.set(...position);
  group.userData.sculptComponent = { id, name, note };
  group.userData.basePosition = [...position];
  group.userData.explodeDirection = explodeDirection;
  return group;
}

function roundedMesh(size: [number, number, number], radius: number, material: THREE.Material, name: string) {
  const geometry = new RoundedBoxGeometry(size[0], size[1], size[2], 7, Math.min(radius, Math.min(...size) * 0.44));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addMesh(parent: THREE.Object3D, mesh: THREE.Mesh, position: [number, number, number], rotation: [number, number, number] = [0, 0, 0]) {
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function addCushionPiping(parent: THREE.Object3D, width: number, depth: number, y: number, material: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-width / 2 + 0.12, y, depth / 2 + 0.012),
    new THREE.Vector3(0, y + 0.015, depth / 2 + 0.02),
    new THREE.Vector3(width / 2 - 0.12, y, depth / 2 + 0.012),
  ]);
  const piping = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.018, 6, false), material);
  piping.castShadow = true;
  parent.add(piping);
}

export function createBlueSofaModel() {
  const root = new THREE.Group();
  root.name = 'Muted Blue Two-Seat Sofa';
  root.userData.approximation = 'Stylized single-view reconstruction; hidden rear and underside are plausibly completed.';

  const textures = makeFabricTextures();
  const fabric = new THREE.MeshPhysicalMaterial({
    color: '#b5c1ca',
    map: textures.color,
    roughness: 0.88,
    roughnessMap: textures.roughness,
    bumpMap: textures.bump,
    bumpScale: 0.014,
    sheen: 0.18,
    sheenColor: new THREE.Color('#8ca4bb'),
    sheenRoughness: 0.74,
  });
  const seamMaterial = new THREE.MeshStandardMaterial({ color: '#31485f', roughness: 0.92 });
  const baseMaterial = new THREE.MeshStandardMaterial({ color: '#252522', roughness: 0.5, metalness: 0.05 });

  const carcass = makePart('carcass', '蓝色软包框架', '连续前围、后部支撑与两侧窄扶手。', [0, 0, 0], [0, -0.25, -0.45]);
  root.add(carcass);
  addMesh(carcass, roundedMesh([5.55, 0.78, 0.54], 0.15, fabric, 'front-rail'), [0, 0.76, 0.72]);
  addMesh(carcass, roundedMesh([5.15, 1.42, 0.42], 0.16, fabric, 'rear-support'), [0, 1.58, -0.79], [-0.05, 0, 0]);
  addMesh(carcass, roundedMesh([0.62, 1.55, 2.05], 0.15, fabric, 'left-arm'), [-2.52, 1.28, 0]);
  addMesh(carcass, roundedMesh([0.62, 1.55, 2.05], 0.15, fabric, 'right-arm'), [2.52, 1.28, 0]);

  const seats = makePart('seat-cushions', '双座垫', '两块厚实、轻微鼓起的座垫，中间保留窄缝。', [0, 0, 0], [0, 0.52, 0.36]);
  root.add(seats);
  [-1.17, 1.17].forEach((x, index) => {
    const seat = roundedMesh([2.28, 0.44, 1.58], 0.17, fabric, `seat-cushion-${index + 1}`);
    seat.scale.set(1, 1.04, 1);
    addMesh(seats, seat, [x, 1.38, 0.17], [0, index === 0 ? 0.012 : -0.012, index === 0 ? -0.008 : 0.008]);
    addCushionPiping(seat, 2.12, 1.58, -0.16, seamMaterial);
  });

  const backs = makePart('back-cushions', '双靠背垫', '两块宽大的靠背垫，向后轻靠并在中心形成暗缝。', [0, 0, 0], [0, 0.8, -0.5]);
  root.add(backs);
  [-1.15, 1.15].forEach((x, index) => {
    const back = roundedMesh([2.25, 1.28, 0.5], 0.2, fabric, `back-cushion-${index + 1}`);
    back.scale.set(1, 1.04, 1);
    addMesh(backs, back, [x, 2.12, -0.48], [-0.13, 0, index === 0 ? -0.018 : 0.018]);
  });

  const throws = makePart('throw-pillows', '两只斜放抱枕', '左右抱枕覆盖外侧靠背并向沙发中心倾斜。', [0, 0, 0], [0, 1.1, 0.45]);
  root.add(throws);
  const leftThrow = roundedMesh([1.18, 1.25, 0.44], 0.2, fabric, 'left-throw-pillow');
  leftThrow.scale.set(0.96, 1, 1.06);
  addMesh(throws, leftThrow, [-1.72, 2.18, -0.05], [-0.08, -0.05, -0.2]);
  const rightThrow = roundedMesh([1.18, 1.25, 0.44], 0.2, fabric, 'right-throw-pillow');
  rightThrow.scale.set(0.96, 1, 1.06);
  addMesh(throws, rightThrow, [1.72, 2.18, -0.05], [-0.08, 0.05, 0.2]);

  const base = makePart('base-plinth', '内缩底座与短脚', '近黑色内缩底线和四只短方脚，让蓝色前围看起来悬浮。', [0, 0, 0], [0, -0.48, 0]);
  root.add(base);
  addMesh(base, roundedMesh([5.18, 0.15, 1.56], 0.04, baseMaterial, 'recessed-plinth'), [0, 0.34, 0.13]);
  [[-2.18, 0.54], [2.18, 0.54], [-2.18, -0.53], [2.18, -0.53]].forEach(([x, z], index) => {
    addMesh(base, roundedMesh([0.34, 0.32, 0.34], 0.045, baseMaterial, `foot-${index + 1}`), [x, 0.2, z]);
  });

  root.userData.parts = [carcass, seats, backs, throws, base];
  return root;
}
