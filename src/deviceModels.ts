import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Runner, drawRunner } from './runner';

function material(color:string,metalness=0,roughness=.48){return new T.MeshStandardMaterial({color,metalness,roughness});}
function box(parent:T.Object3D,m:T.Material,size:[number,number,number],at:[number,number,number],r=.03){
 const mesh=new T.Mesh(new RoundedBoxGeometry(...size,3,Math.min(r,...size.map(x=>x*.45))),m);
 mesh.position.set(...at);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function button(parent:T.Object3D,m:T.Material,x:number,y:number,r:number,z=.15){
 const mesh=new T.Mesh(new T.CylinderGeometry(r,r,.032,32),m);mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;
}
export function createPhoneController(){
 const g=new T.Group();g.name='phone-controller';
 const red=material('#cf3f49',.12,.36),dark=material('#222829',.15,.38),rim=material('#495253',.7,.32),white=material('#efe8dc');
 box(g,rim,[2.83,1.44,.14],[0,0,0],.07);box(g,dark,[2.77,1.40,.05],[0,0,.081],.025);
 const canvas=document.createElement('canvas');canvas.width=900;canvas.height=430;drawRunner(canvas.getContext('2d')!,new Runner());
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 const screen=new T.Mesh(new T.PlaneGeometry(2.59,1.238),new T.MeshBasicMaterial({map:texture,toneMapped:false}));screen.position.set(0,0,.11);screen.name='runner-screen';g.add(screen);
 button(g,dark,-1.365,0,.023,.118);
 for(const side of [-1,1]){
  box(g,dark,[.61,1.61,.15],[side*1.57,0,-.038],.065);
  const shape=new T.Shape();shape.moveTo(-.29,-.78);shape.lineTo(-.29,.78);shape.lineTo(.02,.78);
  shape.bezierCurveTo(.24,.78,.30,.64,.34,.38);shape.bezierCurveTo(.42,-.08,.36,-.53,.20,-.71);shape.quadraticCurveTo(.14,-.78,-.02,-.78);shape.closePath();
  const grip=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelSize:.032,bevelThickness:.032,bevelSegments:4,curveSegments:18}),red);
  grip.position.set(side*1.60,0,-.015);grip.scale.x=side;grip.castShadow=grip.receiveShadow=true;g.add(grip);
  // Shoulder triggers, inset seams and subtle glossy side panels.
  box(g,white,[.39,.067,.075],[side*1.63,.802,-.022],.025);
  const stickY=side<0?.32:-.37;
  button(g,dark,side*1.59,stickY,.143,.195);button(g,rim,side*1.59,stickY,.105,.224);
  const ring=new T.Mesh(new T.TorusGeometry(.083,.008,6,32),dark);ring.position.set(side*1.59,stickY,.246);g.add(ring);
  button(g,white,side*1.61,side<0?-.65:.63,.041,.18);
 }
 box(g,dark,[.34,.10,.047],[-1.60,-.20,.192],.018);box(g,dark,[.10,.34,.047],[-1.60,-.20,.194],.018);
 const labels=['Y','B','A','X'];
 for(let i=0;i<4;i++){
  const a=i*Math.PI/2,x=1.60+Math.sin(a)*.17,y=.25+Math.cos(a)*.17;
  button(g,i===2?white:dark,x,y,.072,.195);
  const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d')!;
  ctx.fillStyle=i===2?'#b4434d':'#eee6da';ctx.font='32px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(labels[i],32,34);
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;
  const label=new T.Mesh(new T.PlaneGeometry(.09,.09),new T.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));label.position.set(x,y,.215);g.add(label);
 }
 for(let i=0;i<3;i++)box(g,material('#adc28a'),[.025,.013,.01],[1.56+i*.055,-.70,.162],.004);
 return g;
}

export function createKeyboardIPad(){
 const g=new T.Group();g.name='favorite-shows-ipad';
 const silver=material('#a8adb0',.72,.32),keys=material('#34393c',.12,.5),black=material('#11191c'),hinge=material('#757f7e',.55,.4);
 // Keyboard base and trackpad sit flat; the magnetic tablet support rises behind it.
 box(g,silver,[1.15,.042,.84],[0,.024,.02],.02);
 box(g,hinge,[1.04,.009,.41],[0,.048,-.125],.008);
 for(let row=0;row<4;row++)for(let col=0;col<11;col++)box(g,keys,[.073,.012,.071],[-.465+col*.093,.058,-.265+row*.094],.008);
 box(g,keys,[.40,.012,.058],[0,.058,.113],.008);
 box(g,hinge,[.40,.004,.175],[0,.047,.28],.014);box(g,silver,[.383,.004,.16],[0,.050,.28],.014);
 const support=new T.Group();support.position.set(0,.055,-.29);support.rotation.x=-.30;g.add(support);
 box(support,hinge,[.84,.39,.04],[0,.18,-.055],.018);
 const lid=new T.Group();lid.position.set(0,.14,-.375);lid.rotation.x=-.20;g.add(lid);
 box(lid,silver,[1.16,.82,.043],[0,.39,0],.02);box(lid,black,[1.13,.79,.015],[0,.39,.027],.015);
 const tex=new T.TextureLoader().load(`${import.meta.env.BASE_URL}shows/fake-it-till-you-make-it.jpg`);tex.colorSpace=T.SRGBColorSpace;
 const screen=new T.Mesh(new T.PlaneGeometry(1.05,1.05*571/1170),new T.MeshBasicMaterial({map:tex}));screen.position.set(0,.395,.036);lid.add(screen);
 button(lid,hinge,0,.756,.009,.038);
 const pencil=new T.Mesh(new T.CapsuleGeometry(.013,.79,4,12),material('#eeeae0'));pencil.rotation.z=Math.PI/2;pencil.position.set(0,.822,0);lid.add(pencil);
 return g;
}
