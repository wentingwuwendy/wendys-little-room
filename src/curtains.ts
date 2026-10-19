import * as T from 'three';
import { clothMaterial } from './detailMaterials';

/** Continuous gathered linen panels, with hems following the same cloth surface. */
export function createCurtains() {
 const curtains = new T.Group();
 curtains.name = 'linen-curtains';
 const panels:T.Group[]=[];
 const cloth:T.Mesh[]=[];
 const hardware:{mesh:T.Mesh;open:T.Vector3;closed:T.Vector3}[]=[];
 let closed=false, progress=0;
 const fabric = clothMaterial('#eee6d3');
 fabric.side = T.DoubleSide;
 fabric.bumpScale = .0012;
 fabric.bumpMap!.repeat.set(2, 9);
 fabric.sheen = .65;
 const hem = fabric.clone();
 hem.color.set('#e7dec9');
 const metal = new T.MeshStandardMaterial({color:'#998061', metalness:.65, roughness:.38});

 function add(geometry:T.BufferGeometry, material:T.Material, position:T.Vector3, parent:T.Group=curtains) {
  const mesh = new T.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
 }
 const rod = add(new T.CylinderGeometry(.026,.026,4.92,24),metal,new T.Vector3(1.27,5.44,-2.46));
 rod.rotation.z = Math.PI/2;
 for (const side of [-1,1]) {
  const end = add(new T.SphereGeometry(.064,24,16),metal,new T.Vector3(1.27+side*2.5,5.44,-2.46));
  end.scale.set(1.25,.85,.85);
  const bracket = add(new T.CylinderGeometry(.023,.023,.37,16),metal,new T.Vector3(1.27+side*2.26,5.44,-2.65));
  bracket.rotation.x = Math.PI/2;
  const mount = add(new T.CylinderGeometry(.065,.065,.025,24),metal,new T.Vector3(1.27+side*2.26,5.44,-2.84));
  mount.rotation.x = Math.PI/2;
  const panelGroup=new T.Group();
  panelGroup.name=side<0?'curtain-left':'curtain-right';
  curtains.add(panelGroup);panels.push(panelGroup);

  // The folds drift gently along their length and open under the cloth's weight.
  function point(u:number,v:number,offset=0,closure=0) {
   const width = .53 + .18*Math.pow(v,.8);
   const drift = Math.sin(v*Math.PI)*.055;
   const phase = u*Math.PI*8 + Math.sin(v*4.3+u*2)*.18*v;
   const depth = .061 + .035*Math.sin(v*Math.PI/2);
   // Keep each outside edge fixed; unfold the cloth toward the middle.
   const outer=1.94+drift+width/2, spread=outer+.025;
   const openX=1.27+side*(1.94+drift)+(u-.5)*width;
   const closedX=1.27+side*(outer-spread/2)+(u-.5)*spread;
   const x=T.MathUtils.lerp(openX,closedX,closure);
   const bottom = .026*Math.cos(u*Math.PI*8+.3)+.012*Math.sin(u*7);
   const y = 5.32-v*2.97+bottom*Math.pow(v,5)-.009*Math.sin(u*Math.PI*8)**2*(1-v);
   const z = -2.43+Math.cos(phase)*T.MathUtils.lerp(depth,.036,closure)+.024*Math.sin(v*5+u*3)+offset+closure*side*.006;
   return new T.Vector3(x,y,z);
  }
  function surface(u0:number,u1:number,v0:number,v1:number,cols:number,rows:number,offset:number,material:T.Material) {
   const geometry = new T.PlaneGeometry(1,1,cols,rows);
   const positions = geometry.getAttribute('position');
   const closedPositions=positions.clone();
   const uv = geometry.getAttribute('uv');
   for(let j=0;j<=rows;j++) for(let i=0;i<=cols;i++) {
    const u=u0+(u1-u0)*i/cols, v=v0+(v1-v0)*j/rows;
    const p=point(u,v,offset), index=j*(cols+1)+i;
    positions.setXYZ(index,p.x,p.y,p.z);
    const end=point(u,v,offset,1);
    closedPositions.setXYZ(index,end.x,end.y,end.z);
    uv.setXY(index,u,1-v);
   }
   geometry.computeVertexNormals();
   const endGeometry=geometry.clone();
   endGeometry.setAttribute('position',closedPositions);endGeometry.computeVertexNormals();
   geometry.morphAttributes.position=[closedPositions];
   geometry.morphAttributes.normal=[endGeometry.getAttribute('normal').clone()];
   endGeometry.dispose();
   geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const mesh=add(geometry,material,new T.Vector3(),panelGroup);
   cloth.push(mesh);return mesh;
  }
  const panel=surface(0,1,0,1,96,64,0,fabric);
  panel.name=side<0?'curtain-left':'curtain-right';
  // Folded heading, weighted lower hem and narrow turned-in side seams.
  surface(0,1,0,.031,96,3,.004,hem);
  surface(0,1,.978,1,96,3,.004,hem);
  for(const u of [0,.983]) surface(u,u+.017,.031,.978,2,64,.003,hem);
  for(let i=0;i<=4;i++) {
   const p=point(i/4,0);
   const end=point(i/4,0,0,1);
   const ring=add(new T.TorusGeometry(.059,.009,8,24),metal,new T.Vector3(p.x,5.405,-2.46),panelGroup);
   ring.rotation.y=Math.PI/2;
   hardware.push({mesh:ring,open:ring.position.clone(),closed:new T.Vector3(end.x,5.405,-2.46)});
   // Small linen loops connect the gathered heading to its individual ring.
   const loop=add(new T.CapsuleGeometry(.012,.042,3,8),hem,new T.Vector3(p.x,5.345,p.z),panelGroup);
   hardware.push({mesh:loop,open:loop.position.clone(),closed:new T.Vector3(end.x,5.345,end.z)});
  }
 }
 return {
  group:curtains,panels,
  toggle(){closed=!closed;},
  getState:()=>({closed,progress}),
  update(dt:number,reduced=false){
   const target=closed?1:0;
   if(progress===target)return false;
   progress=reduced?target:T.MathUtils.damp(progress,target,4.5,dt);
   if(Math.abs(target-progress)<.001)progress=target;
   for(const mesh of cloth)mesh.morphTargetInfluences![0]=progress;
   for(const item of hardware)item.mesh.position.lerpVectors(item.open,item.closed,progress);
   return true;
  }
 };
}
