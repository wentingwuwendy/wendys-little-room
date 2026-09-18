import * as T from 'three';
import { clothMaterial, seeded } from './detailMaterials';

export type PlushPose={sit:number;walk:number;phase:number;reach:number;look:number};

/** Cartoon fleece panda with one soft continuous shell per padded panel. */
export function createPandaPlush(){
 const bear=new T.Group();bear.name='panda-plush';
 // Soft fleece reads as a continuous padded surface at room scale.
 const pileCanvas=document.createElement('canvas');pileCanvas.width=pileCanvas.height=256;
 const ctx=pileCanvas.getContext('2d')!,pileRandom=seeded(91);
 ctx.fillStyle='#888';ctx.fillRect(0,0,256,256);
 for(let i=0;i<1800;i++){
  const x=pileRandom()*256,y=pileRandom()*256,r=1+pileRandom()*3;
  const shade=pileRandom()>.5?155:110,gradient=ctx.createRadialGradient(x,y,0,x,y,r);
  gradient.addColorStop(0,`rgba(${shade},${shade},${shade},.32)`);gradient.addColorStop(1,`rgba(${shade},${shade},${shade},0)`);
  ctx.fillStyle=gradient;ctx.fillRect(x-r,y-r,r*2,r*2);
 }
 const pileBump=new T.CanvasTexture(pileCanvas);pileBump.wrapS=pileBump.wrapT=T.RepeatWrapping;pileBump.repeat.set(2,2);
 const plush=(color:string,sheenColor:string)=>new T.MeshPhysicalMaterial({color,roughness:1,bumpMap:pileBump,bumpScale:.002,sheen:.8,sheenColor:new T.Color(sheenColor),sheenRoughness:1});
 const cream=plush('#f2e9d9','#fff8e9'),brown=plush('#483127','#9b7c64');
 const thread=clothMaterial('#201914'),patch=clothMaterial('#39281f'),ivory=clothMaterial('#f6f1e6');
 thread.sheen=.1;patch.sheen=.15;
 const body=new T.Group();body.name='body-pivot';bear.add(body);
 const head=new T.Group();head.name='head-pivot';head.position.y=1.01;body.add(head);
 const parts:T.Object3D[]=[];
 function panel(parent:T.Object3D,name:string,position:number[],radii:number[],material:T.Material){
  const group=new T.Group();group.name=name;group.position.set(...position as [number,number,number]);parent.add(group);parts.push(group);
  function shape(x:number,y:number,z:number){
   if(name==='torso'){x=Math.sign(x)*Math.abs(x)**.76;y=Math.sign(y)*Math.abs(y)**.72;z=Math.sign(z)*Math.abs(z)**.86;}
   const fluffy=material===cream||material===brown;
   const padding=1+(fluffy?.008:.003)*Math.sin(x*16+y*9)*Math.sin(z*13-y*5);
   const cheek=name==='head'?1+.065*Math.exp(-(((y+.36)/.42)**2)):1;
   const pear=name==='torso'?1-.14*y:1;
   return new T.Vector3(x*radii[0]*padding*cheek*pear,Math.max(y*radii[1],name.startsWith('leg')?-radii[1]*.90:-Infinity),z*radii[2]*padding);
  }
  const geometry=new T.SphereGeometry(1,48,32),p=geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){const v=shape(p.getX(i),p.getY(i),p.getZ(i));p.setXYZ(i,v.x,v.y,v.z);}
  geometry.computeVertexNormals();const mesh=new T.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  group.userData.radii=radii;return group;
 }
 function seam(parent:T.Object3D,name:string,points:T.Vector3[],radius:number,material:T.Material,closed=false){
  const curve=new T.CatmullRomCurve3(points,closed);const mesh=new T.Mesh(new T.TubeGeometry(curve,closed?64:24,radius,5,closed),material);mesh.name=name;mesh.castShadow=true;parent.add(mesh);parts.push(mesh);return mesh;
 }
 panel(body,'torso',[0,.43,0],[.29,.30,.23],cream);
 panel(body,'collar',[0,.68,0],[.30,.105,.232],brown);
 panel(body,'tail',[0,.335,-.235],[.088,.09,.09],cream);
 panel(head,'head',[0,0,0],[.47,.43,.345],cream);
 panel(head,'muzzle',[0,-.06,.331],[.163,.138,.09],cream);
 panel(head,'nose',[0,.005,.42],[.042,.028,.017],patch);
 seam(head,'smile',[new T.Vector3(-.038,-.106,.411),new T.Vector3(0,-.116,.42),new T.Vector3(.038,-.106,.411)],.0045,thread);
 const arms:T.Group[]=[],legs:T.Group[]=[];
 for(const side of [-1,1]){
  const suffix=side===1?'l':'r';
  const ear=panel(head,`ear-${suffix}`,[side*.393,.347,-.005],[.157,.17,.089],brown);ear.rotation.z=-side*.27;
  const eye=new T.Group();eye.name=`eye-pivot-${suffix}`;eye.position.set(side*.231,-.025,.303);eye.rotation.y=side*.40;eye.rotation.z=side*-.14;head.add(eye);
  panel(eye,`eye-patch-${suffix}`,[0,0,0],[.100,.126,.026],patch);
  panel(eye,`eye-${suffix}`,[0,.034,.023],[.060,.073,.014],thread);
  const ring=Array.from({length:64},(_,i)=>{const a=i/64*Math.PI*2;return new T.Vector3(Math.cos(a)*.060,.034+Math.sin(a)*.073,.034+Math.sin(a)*.001);});
  seam(eye,`eye-ring-${suffix}`,ring,.0034,ivory,true);
  const arm=new T.Group();arm.name=`shoulder-${suffix}`;arm.position.set(side*.277,.651,0);body.add(arm);arms.push(arm);
  panel(arm,`arm-${suffix}`,[side*.038,-.173,0],[.106,.215,.109],brown);
  const leg=new T.Group();leg.name=`hip-${suffix}`;leg.position.set(side*.147,.315,0);bear.add(leg);legs.push(leg);
  panel(leg,`leg-${suffix}`,[0,-.158,.028],[.132,.173,.148],brown);
 }
 bear.userData.setPose=({sit,walk,phase,reach,look}:PlushPose)=>{
  body.position.y=-sit*.23+(1-sit)*walk*Math.abs(Math.sin(phase))*.010;
  body.rotation.z=(1-sit)*walk*Math.sin(phase)*.018;
  head.rotation.set(-look*.12,Math.sin(phase*.35)*walk*.02,0);
  arms.forEach((arm,i)=>{const side=i===0?-1:1,swing=Math.sin(phase+i*Math.PI)*walk;
   arm.rotation.set(swing*.43-reach*1.14-sit*.23,side*reach*.10,side*(.15+reach*.18));
  });
  legs.forEach((leg,i)=>{const swing=Math.sin(phase+i*Math.PI)*walk;
   leg.position.y=.315-sit*.20;leg.rotation.x=-sit*1.35+swing*.37*(1-sit);
   leg.position.z=sit*.065;leg.position.y+=(1-sit)*Math.max(0,swing)*.024;
  });
 };
 bear.userData.setPose({sit:0,walk:0,phase:0,reach:0,look:0});
 const homes=parts.map(p=>({p,position:p.position.clone()}));
 bear.userData.sculptRuntime={parts:parts.map(p=>p.name),pivots:['body-pivot','head-pivot',...arms.map(a=>a.name),...legs.map(l=>l.name)],explode:(amount:number)=>homes.forEach(({p,position})=>p.position.copy(position).multiplyScalar(1+amount)),reference:'.img2threejs-panda/reference.png'};
 return bear;
}
