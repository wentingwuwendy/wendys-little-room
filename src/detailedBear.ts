import * as T from 'three';
import { clothMaterial, furMaterial, seeded } from './detailMaterials';

/** A seated plush toy: shaped panels, short directional pile, inset paw pads and sewn details. */
export function createDetailedBear(){
 const bear=new T.Group();bear.name='teddy-bear';
 const fur=furMaterial('#b58d65'),patch=furMaterial('#dbc2a0');
 const embroidery=new T.MeshStandardMaterial({color:'#4b352c',roughness:.95});
 const eyeMat=new T.MeshPhysicalMaterial({color:'#211913',roughness:.12,clearcoat:1,clearcoatRoughness:.1});
 const hairMat=new T.MeshPhysicalMaterial({color:'#ffffff',roughness:1,side:T.DoubleSide,sheen:.8,sheenColor:new T.Color('#e6cdb0'),sheenRoughness:1});
 const random=seeded(2027);const hairsGeometry=new T.BufferGeometry();
 hairsGeometry.setAttribute('position',new T.Float32BufferAttribute([-.00065,0,0,.00065,0,0,-.00045,.003,.001,.00045,.003,.001,0,.007,.003],3));hairsGeometry.setIndex([0,1,2,1,3,2,2,3,4]);hairsGeometry.computeVertexNormals();
 function panel(name:string,center:number[],radii:number[],material:T.Material,count=0,tilt=0){
  const g=new T.Group();g.name=name;g.position.set(center[0],center[1],center[2]);g.rotation.z=tilt;bear.add(g);
  function shape(v:T.Vector3){const ripple=1+.013*Math.sin(v.y*11+v.x*5)*Math.sin(v.z*10);return new T.Vector3(v.x*radii[0]*ripple,v.y*radii[1],v.z*radii[2]*ripple);}
  const geo=new T.SphereGeometry(1,48,36);const p=geo.getAttribute('position');for(let i=0;i<p.count;i++){const v=shape(new T.Vector3().fromBufferAttribute(p,i));p.setXYZ(i,v.x,v.y,v.z);}geo.computeVertexNormals();
  const mesh=new T.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);
  if(count){count*=3;const pile=new T.InstancedMesh(hairsGeometry,hairMat,count);pile.userData.noOutline=true;const dummy=new T.Object3D();for(let i=0;i<count;i++){const y=random()*2-1,a=random()*Math.PI*2,q=Math.sqrt(1-y*y);const unit=new T.Vector3(q*Math.cos(a),y,q*Math.sin(a));const pos=shape(unit);const n=new T.Vector3(unit.x/radii[0],unit.y/radii[1],unit.z/radii[2]).normalize();dummy.position.copy(pos);dummy.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),n);dummy.rotateY(random()*Math.PI*2);dummy.scale.set(1,.6+random()*.7,1);dummy.updateMatrix();pile.setMatrixAt(i,dummy.matrix);pile.setColorAt(i,new T.Color('#b58d65').multiplyScalar(.90+random()*.22));}pile.instanceMatrix.needsUpdate=true;pile.computeBoundingSphere();g.add(pile);}
  return g;
 }
 function stitch(points:number[][],radius=.005,material:T.Material=embroidery){const curve=new T.CatmullRomCurve3(points.map(v=>new T.Vector3(v[0],v[1],v[2])));const m=new T.Mesh(new T.TubeGeometry(curve,24,radius,6,false),material);bear.add(m);return m;}
 panel('pear-shaped-torso',[0,.35,0],[.285,.37,.24],fur,2200);
 panel('soft-neck',[0,.64,-.005],[.22,.18,.20],fur,400);
 panel('cheek-shaped-head',[0,.83,.025],[.315,.29,.265],fur,2800);
 for(const side of[-1,1]){
  panel('ear',[side*.252,1.045,.0],[.129,.145,.075],fur,400,side*-.23);
  panel('recessed-ear-fabric',[side*.257,1.055,.071],[.073,.089,.019],patch,0,side*-.23);
  panel('relaxed-arm',[side*.285,.35,.014],[.126,.255,.129],fur,700,side*.24);
  panel('seated-thigh',[side*.206,.14,.10],[.17,.16,.21],fur,500);
  panel('forward-facing-foot',[side*.235,.065,.262],[.161,.126,.172],fur,500,-side*.18);
  panel('stitched-foot-pad',[side*.235,.067,.427],[.108,.084,.023],patch);
  for(let i=0;i<3;i++)stitch([[side*.235+(i-1)*.043,.099,.453],[side*.235+(i-1)*.043,.075,.455]],.0027).name='foot-stitch';
  panel('glossy-safety-eye',[side*.116,.872,.263],[.025,.028,.014],eyeMat);
  panel('eye-catchlight',[side*.116-.007,.884,.274],[.006,.007,.004],new T.MeshBasicMaterial({color:'#fff4dd'}));
 }
 panel('protruding-muzzle',[0,.768,.256],[.155,.109,.091],patch,0);
 panel('embroidered-nose',[0,.815,.334],[.046,.031,.022],embroidery);
 stitch([[0,.802,.351],[0,.772,.353],[0,.755,.351]],.006);
 stitch([[-.062,.763,.337],[-.037,.747,.347],[0,.755,.351],[.037,.747,.347],[.062,.763,.337]],.004);
 const seam=new T.MeshStandardMaterial({color:'#8e6e50',roughness:1});
 for(let i=0;i<10;i++){const y=.23+i*.032;stitch([[-.006,y,.239],[.006,y+.008,.242]],.0016,seam);}
 const ribbon=clothMaterial('#798267');
 function bowWing(side:number){const shape=new T.Shape();shape.moveTo(0,0);shape.bezierCurveTo(side*.1,.055,side*.22,.16,side*.23,.08);shape.bezierCurveTo(side*.24,-.04,side*.17,-.12,0,-.015);const geometry=new T.ExtrudeGeometry(shape,{depth:.022,bevelEnabled:true,bevelSize:.007,bevelThickness:.007,bevelSegments:3,steps:1,curveSegments:16});const mesh=new T.Mesh(geometry,ribbon);mesh.position.set(0,.605,.214);mesh.rotation.y=side*.12;mesh.castShadow=true;bear.add(mesh);}
 bowWing(-1);bowWing(1);panel('bow-knot',[0,.607,.255],[.047,.045,.035],ribbon);
 for(const side of[-1,1])stitch([[side*.035,.59,.24],[side*.07,.49,.255],[side*.10,.435,.255]],.025,ribbon);
 const parts=bear.children.map(obj=>({obj,position:obj.position.clone(),rotation:obj.rotation.clone(),scale:obj.scale.clone()}));
 bear.userData.setPose=({sit,walk,phase,reach,look}:{sit:number;walk:number;phase:number;reach:number;look:number})=>{
  const stand=1-sit;
  for(const {obj,position,rotation,scale} of parts){obj.position.copy(position);obj.rotation.copy(rotation);obj.scale.copy(scale);const foot=/foot/.test(obj.name),leg=obj.name==='seated-thigh',arm=obj.name==='relaxed-arm';const side=(obj.name==='foot-stitch'?(obj as T.Mesh).geometry.getAttribute('position').getX(0):position.x)<0?-1:1;const swing=Math.sin(phase+ (side<0?Math.PI:0))*walk;
   if(foot){obj.position.z-=stand*.13;obj.position.y+=stand*.05;obj.position.z+=swing*.07;obj.position.y+=Math.max(0,swing)*.06;}
   else if(leg){obj.position.y+=stand*.12;obj.position.z-=stand*.04;obj.scale.y*=1+stand*.6;obj.scale.x*=1-stand*.16;obj.rotation.x+=swing*.25;}
   else{obj.position.y+=stand*.25;obj.position.y+=walk*Math.abs(Math.sin(phase))*.015;
    if(arm){obj.rotation.x+=swing*.5-reach*1.05;obj.position.y+=reach*.07;obj.position.z+=reach*.12;}
    if(obj.name==='cheek-shaped-head'||obj.name==='soft-neck')obj.rotation.x-=look*.03;
   }
  }
 };
 return bear;
}
