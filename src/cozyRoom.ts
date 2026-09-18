import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { woodMaterial, clothMaterial, seeded } from './detailMaterials';
import { createPandaPlush } from './pandaPlush';
import { createSouvenirMagnet } from './souvenirMagnets';
import { books, createBookModel } from './bookModels';
import { internationalExperiences } from './international';
import { createMonstera } from './monstera';
import { createRecordPlayer } from './recordPlayer';
import { createCurtains } from './curtains';
import { createKeyboardIPad, createPhoneController } from './deviceModels';

export type Action = 'experience'|'projects'|'about'|'life'|'travel'|'contact'|'lamp'|'books'|'music'|'games'|'shows'|'objects'|'chair'|'bear';
export function createCozyRoom(){
 const room=new T.Group();
 const clickable:T.Object3D[]=[];
 const mat=(color:string,roughness=.8)=>new T.MeshStandardMaterial({color,roughness});
 const cream=mat('#e8e3d6'),trim=mat('#f7f0e1'),oak=woodMaterial('#d5b58c'),edge=woodMaterial('#ac835b'),dark=new T.MeshStandardMaterial({color:'#41443b',roughness:.43,metalness:.45}),green=clothMaterial('#849077'),linen=clothMaterial('#e4deca'),clay=mat('#c78f75'),gold=new T.MeshStandardMaterial({color:'#ae9566',metalness:.7,roughness:.3});
 function box(p:T.Object3D,m:T.Material,s:number[],v:number[],r=.035){const o=new T.Mesh(new RoundedBoxGeometry(s[0],s[1],s[2],2,Math.min(r,...s.map(n=>n*.4))),m);o.position.set(v[0],v[1],v[2]);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;}
 function cyl(p:T.Object3D,m:T.Material,r:number,h:number,v:number[],rt=r){const o=new T.Mesh(new T.CylinderGeometry(rt,r,h,32),m);o.position.set(v[0],v[1],v[2]);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;}
 function sphere(p:T.Object3D,m:T.Material,r:number,v:number[],scale=[1,1,1]){const o=new T.Mesh(new T.SphereGeometry(r,24,16),m);o.position.set(v[0],v[1],v[2]);o.scale.set(...scale as [number,number,number]);o.castShadow=true;p.add(o);return o;}
 function action(p:T.Object3D,id:Action){p.userData.action=id;if(!p.name)p.name=`interactive-${id}-${clickable.length}`;clickable.push(p);return p;}
 function canvasTexture(w:number,h:number,draw:(c:CanvasRenderingContext2D)=>void){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d')!);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
 function textTexture(text:string,bg:string,fg:string,size=40){return canvasTexture(512,256,c=>{c.fillStyle=bg;c.fillRect(0,0,512,256);c.fillStyle=fg;c.textAlign='center';c.font=`${size}px Georgia`;text.split('\n').forEach((s,i,a)=>c.fillText(s,256,128+(i-(a.length-1)/2)*size*1.4));});}
 function plate(p:T.Object3D,t:T.Texture,w:number,h:number,v:number[]){const o=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:t,side:T.DoubleSide}));o.position.set(v[0],v[1],v[2]);p.add(o);return o;}
 // Open dollhouse shell, raised oak base, individually laid floorboards.
 box(room,edge,[8.25,.3,6.25],[0,-.14,0],.09);box(room,cream,[8.12,.17,6.12],[0,.07,0],.06);
 const floorColors=['#e3cbab','#dcc5a9','#dfc5a3','#d9bea0'];const floorMats=floorColors.map(c=>woodMaterial(c));
 for(let x=0;x<16;x++)for(let z=0;z<4;z++){const plankMat=floorMats[(x*7+z*3)%4];box(room,plankMat,[.495,.065,1.48],[-3.75+x*.5,.18,-2.25+z*1.5],.005).userData.ground=true;}
 box(room,cream,[.18,5.4,6.12],[-4,2.86,0]);box(room,cream,[8.12,5.4,.18],[0,2.86,-3]);
 box(room,trim,[.25,.12,6.2],[-4,5.6,0]);box(room,trim,[8.2,.12,.25],[0,5.6,-3]);
 box(room,trim,[.07,.22,5.98],[-3.88,.36,0]);box(room,trim,[7.98,.22,.07],[0,.36,-2.88]);
 for(let z=-2.5;z<3;z+=.55)box(room,trim,[.012,5.07,.016],[-3.9,2.97,z],.003);
 // Photographic garden backdrop; the Shanghai reference belongs to the magnet gallery.
 const dayGarden=new T.TextureLoader().load(`${import.meta.env.BASE_URL}window/leafy-garden.png`);dayGarden.colorSpace=T.SRGBColorSpace;dayGarden.repeat.set(1,.962);dayGarden.offset.set(0,.019);
 const view=plate(room,dayGarden,3.95,2.85,[1.27,3.76,-2.875]);
 view.name='window-day-view';
 const nightGarden=new T.TextureLoader().load(`${import.meta.env.BASE_URL}window/leafy-garden-night.png`);nightGarden.colorSpace=T.SRGBColorSpace;nightGarden.repeat.copy(dayGarden.repeat);nightGarden.offset.copy(dayGarden.offset);
 const nightView=plate(room,nightGarden,3.95,2.85,[1.27,3.76,-2.870]);nightView.name='window-night-view';
 const nightWindowMat=nightView.material as T.MeshBasicMaterial;nightWindowMat.transparent=true;nightWindowMat.opacity=0;nightWindowMat.depthWrite=false;

 for(const x of [-.8,3.34])box(room,trim,[.12,3.12,.15],[x,3.75,-2.78]);for(const y of [2.2,5.29])box(room,trim,[4.25,.12,.21],[1.27,y,-2.76]);
 box(room,trim,[.085,3.02,.1],[1.27,3.75,-2.72]);box(room,trim,[4.15,.07,.1],[1.27,3.6,-2.72]);box(room,oak,[4.5,.14,.45],[1.27,2.17,-2.64]);
 room.add(createCurtains());
 // One continuous L-shaped desktop: long window-facing run and perpendicular shelving return.
 const desk=new T.Group();desk.name='integrated-corner-desk';room.add(desk);
 const outline=new T.Shape();outline.moveTo(-3.79,2.57);outline.lineTo(3.47,2.57);outline.lineTo(3.47,1.10);outline.lineTo(-2.08,1.10);outline.lineTo(-2.08,-1.10);outline.lineTo(-3.79,-1.10);outline.closePath();
 const deskGeometry=new T.ExtrudeGeometry(outline,{depth:.11,steps:1,bevelEnabled:true,bevelSize:.045,bevelThickness:.026,bevelSegments:4,curveSegments:12});
 // Consistent grain scale across the continuous surface.
 const uv=deskGeometry.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*.23,uv.getY(i)*.5);
 const surface=new T.Mesh(deskGeometry,oak);surface.rotation.x=-Math.PI/2;surface.position.y=1.94;surface.castShadow=true;surface.receiveShadow=true;desk.add(surface);
 // Box-section metal end frames, cross rails, feet and exposed fasteners.
 for(const z of[-2.35,.86]){for(const x of[-3.58,-2.36])box(desk,dark,[.09,1.7,.09],[x,1.09,z],.018);box(desk,dark,[1.31,.09,.10],[-2.97,.3,z],.015);}
 for(const z of[-2.37,-1.28])box(desk,dark,[.10,1.72,.10],[3.22,1.1,z],.018);
 box(desk,dark,[.12,.10,1.22],[3.22,.3,-1.82],.018);box(desk,dark,[6.76,.12,.09],[-.18,1.77,-2.33],.02);
 box(desk,dark,[.09,.12,2.82],[-3.55,1.77,-.69],.02);
 for(const [x,z]of[[-3.58,.86],[-2.36,.86],[3.22,-1.28],[3.22,-2.37]]){cyl(desk,mat('#252823'),.071,.044,[x,.227,z]);const screw=cyl(desk,gold,.018,.01,[x+.051,1.63,z]);screw.rotation.z=Math.PI/2;}
 // The tall shelf shares the return's support frame, matching the reference relationship.
 const shelf=new T.Group();shelf.name='desk-mounted-shelf';shelf.position.set(-3.2,0,-.65);shelf.rotation.y=Math.PI/2;room.add(shelf);
 for(const x of[-1.58,1.58]){for(const z of[-.43,.43])box(shelf,dark,[.075,4.9,.075],[x,2.68,z],.03);box(shelf,dark,[.075,.09,.94],[x,5.13,0],.025);}
 for(const y of[.6,3.8,5.08])box(shelf,oak,[3.34,.105,.99],[0,y,0],.035);
 for(const y of[3.75,5.03])box(shelf,dark,[3.27,.065,.06],[0,y,-.42],.01);
 const pegTexture=canvasTexture(768,384,c=>{c.fillStyle='#51554a';c.fillRect(0,0,768,384);for(let y=16;y<384;y+=23)for(let x=15;x<768;x+=23){c.fillStyle='#292d26';c.beginPath();c.arc(x,y,3.3,0,7);c.fill();c.strokeStyle='#7b7d6f';c.lineWidth=.7;c.beginPath();c.arc(x,y,3.5,0,Math.PI);c.stroke();}});
 const pegMat=new T.MeshStandardMaterial({map:pegTexture,roughness:.58,bumpMap:pegTexture,bumpScale:.011});
 box(shelf,pegMat,[3.16,1.48,.047],[0,2.94,-.36],.015);
 // Stationery tray and hanging headphones on the pegboard.
 box(shelf,dark,[.77,.09,.24],[-.78,2.72,-.16],.014);for(let i=0;i<3;i++)box(shelf,trim,[.17,.38,.07],[-1.03+i*.23,2.95,-.2],.008);
 const headphone=new T.Group();headphone.position.set(.55,3.05,-.14);shelf.add(headphone);
 const headband=new T.Mesh(new T.TorusGeometry(.245,.034,10,40,Math.PI),gold);headband.position.y=.03;headphone.add(headband);for(const x of[-.235,.235]){box(headphone,dark,[.095,.24,.12],[x,-.06,0],.045);box(headphone,linen,[.05,.18,.105],[x*.85,-.06,.007],.024);}
 // Folders have cloth spines, card labels, metal finger rings and stitched seams.
 const folderMats=[clothMaterial('#a0a78b'),clothMaterial('#ceb08c'),clothMaterial('#aa8371')];
 const folders=new T.Group();folders.name='internship-folders';folders.position.y=3.2;shelf.add(folders);action(folders,'experience');
 for(let i=0;i<3;i++){const x=-1.18+i*.35;box(folders,folderMats[i],[.285,.80,.62],[x,1.06,.10],.014);box(folders,trim,[.187,.29,.014],[x,1.16,.418],.006);const ring=new T.Mesh(new T.TorusGeometry(.038,.009,10,24),gold);ring.position.set(x,.83,.424);folders.add(ring);const hole=cyl(folders,dark,.028,.014,[x,.83,.423]);hole.rotation.x=Math.PI/2;plate(folders,textTexture(['XHS','JD','BCG'][i],'#f4efdc','#56624e',54),.18,.09,[x,1.18,.431]);box(folders,edge,[.014,.75,.012],[x-.119,1.06,.417],.001);}
 const bookGroup=new T.Group();bookGroup.position.copy(shelf.position);bookGroup.rotation.copy(shelf.rotation);bookGroup.name='favorite-books';room.add(bookGroup);action(bookGroup,'books');
 for(let i=0;i<books.length;i++){const book=createBookModel(books[i]);book.scale.setScalar(.29);book.position.set(.25+i*.22,3.86,.06);book.rotation.y=Math.PI/2;if(i===4){book.rotation.z=-.09;book.position.y+=.009;}bookGroup.add(book);}
 // Plants, with branching stems and rounded leaves.
 const leafTexture=canvasTexture(256,512,c=>{const grad=c.createLinearGradient(0,0,256,0);grad.addColorStop(0,'#526f35');grad.addColorStop(.48,'#85975a');grad.addColorStop(.52,'#9aac6b');grad.addColorStop(1,'#587a40');c.fillStyle=grad;c.fillRect(0,0,256,512);c.strokeStyle='#b0bb7c';c.lineWidth=2;c.beginPath();c.moveTo(128,0);c.lineTo(128,512);c.stroke();c.lineWidth=.8;for(let y=20;y<512;y+=36){for(const side of[-1,1]){c.beginPath();c.moveTo(128,y);c.quadraticCurveTo(128+side*45,y-10,128+side*124,y-64);c.stroke();}}});
 const leafMat=new T.MeshPhysicalMaterial({map:leafTexture,side:T.DoubleSide,roughness:.62,clearcoat:.13,bumpMap:leafTexture,bumpScale:.008});
 const leafGeometry=new T.PlaneGeometry(1,1,12,22);const lp=leafGeometry.getAttribute('position');for(let i=0;i<lp.count;i++){const u=lp.getX(i)*2,v=lp.getY(i)+.5;lp.setXYZ(i,u*.19*Math.pow(Math.sin(Math.PI*v),.8),v*.66,.105*Math.sin(v*Math.PI)-.10*v+.018*(1-Math.abs(u)));}leafGeometry.computeVertexNormals();
 function plant(x:number,y:number,z:number,size=1){
  const g=new T.Group();g.name='ficus-plant';g.position.set(x,y,z);g.scale.setScalar(size);room.add(g);
  const potPoints=[[.20,0],[.23,.015],[.30,.37],[.308,.4],[.288,.415],[.275,.375],[.24,.09]].map(p=>new T.Vector2(p[0],p[1]));
  const pot=new T.Mesh(new T.LatheGeometry(potPoints,48),new T.MeshStandardMaterial({color:'#bc9479',roughness:.63,side:T.DoubleSide}));pot.castShadow=true;pot.receiveShadow=true;g.add(pot);
  cyl(g,mat('#443a2b'),.265,.024,[0,.37,0]);const pebbles=new T.InstancedMesh(new T.IcosahedronGeometry(.025,0),mat('#867252'),24);const dummy=new T.Object3D();const rand=seeded(16);for(let i=0;i<24;i++){const a=rand()*7,r=Math.sqrt(rand())*.23;dummy.position.set(Math.cos(a)*r,.39,Math.sin(a)*r);dummy.scale.set(.5+rand(),.3,.5+rand());dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix);}g.add(pebbles);
  for(let i=0;i<9;i++){const angle=i*2.4,h=.45+(i%4)*.17;const top=new T.Vector3(Math.cos(angle)*.14,.39+h,Math.sin(angle)*.14);const curve=new T.CatmullRomCurve3([new T.Vector3(0,.35,0),new T.Vector3(Math.cos(angle)*.05,.65,Math.sin(angle)*.05),top]);const stem=new T.Mesh(new T.TubeGeometry(curve,12,.012,6,false),mat('#65734b'));g.add(stem);const leaf=new T.Mesh(leafGeometry,leafMat);leaf.position.copy(top);leaf.rotation.set(-.2-(i%3)*.24,angle,Math.sin(angle)*.58);leaf.scale.setScalar(.65+(i%3)*.15);leaf.castShadow=true;leaf.receiveShadow=true;g.add(leaf);}
  return g;
 }
 const monstera=createMonstera();monstera.position.set(3.28,.23,.28);room.add(monstera);plant(2.85,2.25,-2.6,.48);
 // Open laptop with a custom screen, keyboard and trackpad.
 const laptop=new T.Group();laptop.position.set(.3,2.06,-1.63);laptop.rotation.y=-.12;room.add(laptop);action(laptop,'projects');
 box(laptop,dark,[1.18,.055,.8],[0,.02,.1],.04);box(laptop,mat('#777b70'),[1.02,.008,.44],[0,.052,-.015],.01);
 for(let r=0;r<4;r++)for(let k=0;k<11;k++)box(laptop,dark,[.064,.007,.062],[-.46+k*.092,.059,-.17+r*.09],.004);
 box(laptop,linen,[.36,.006,.15],[0,.056,.35],.018);
 const lid=new T.Group();lid.position.set(0,.07,-.3);lid.rotation.x=-.14;laptop.add(lid);box(lid,dark,[1.18,.8,.05],[0,.4,0],.03);
 const screen=canvasTexture(768,512,c=>{c.fillStyle='#e9ecdc';c.fillRect(0,0,768,512);c.fillStyle='#78866a';c.fillRect(0,0,768,35);c.fillStyle='#f4efdf';for(let i=0;i<3;i++){c.beginPath();c.arc(20+i*20,17,5,0,7);c.fill();}c.fillStyle='#657653';c.font='italic 50px Georgia';c.fillText('Ideas into things.',52,137);c.fillStyle='#8b957b';c.font='20px Georgia';c.fillText('WENDY’S WORKSPACE',55,185);for(let i=0;i<2;i++){c.fillStyle=i?'#bdb49d':'#9ba888';c.fillRect(53+i*340,240,300,160);c.fillStyle='#f9f5e8';c.font='22px Georgia';c.fillText(i?'ESG CHALLENGE':'BRANDSTORM',72+i*340,325);}c.fillStyle='#a3a998';c.fillRect(53,439,470,5);});plate(lid,screen,1.08,.69,[0,.405,.028]);
 // Open notebook, pencil and a little cup.
 const notes=new T.Group();room.add(notes);notes.position.set(-2.64,2.09,.25);notes.rotation.y=.15;action(notes,'about');
 box(notes,green,[.92,.045,.69],[0,0,0]);box(notes,trim,[.87,.035,.64],[0,.034,0]);box(notes,edge,[.013,.008,.61],[0,.056,0]);for(let i=0;i<6;i++)for(const side of[-1,1])box(notes,mat('#b8b6a2'),[.28,.003,.008],[side*.23,.055,-.2+i*.065],.001);
 const pen=cyl(notes,gold,.016,.6,[.54,.047,.05]);pen.rotation.x=Math.PI/2;pen.rotation.z=.3;
 const cup=cyl(room,trim,.135,.23,[-.62,2.14,-1.48]);cyl(room,mat('#574432'),.112,.007,[-.62,2.261,-1.48]);const handle=new T.Mesh(new T.TorusGeometry(.085,.024,10,24),trim);handle.position.set(-.45,2.15,-1.48);room.add(handle);void cup;
 // Record player and a tiny envelope.
 const player=createRecordPlayer();player.position.set(1.8,2.12,-1.83);room.add(player);action(player,'music');
 const letter=new T.Group();room.add(letter);action(letter,'contact');box(letter,trim,[.44,.018,.28],[2.87,2.05,-1.5]);
 // Framed travel magnet collection on the left wall.
 const board=new T.Group();board.name='international-board';board.position.set(-3.86,3.65,2.04);board.rotation.y=Math.PI/2;room.add(board);action(board,'travel');
 box(board,oak,[1.78,1.74,.08],[0,0,0]);box(board,mat('#52645e'),[1.62,1.58,.025],[0,0,.055]);
 for(let i=0;i<internationalExperiences.length;i++){
  const e=internationalExperiences[i],magnet=createSouvenirMagnet(e.magnet);magnet.position.set((i%3-1)*.5,.44-Math.floor(i/3)*.5,.09);magnet.rotation.z=(i%3-1)*.05;magnet.userData.experienceId=e.id;board.add(magnet);
  plate(board,textTexture(e.name,'#52645e','#f3ecd6',55),.36,.105,[(i%3-1)*.5,.30-Math.floor(i/3)*.5,.103]);
 }
 // Tall lamp; the room's physical day/night switch.
 const lamp=new T.Group();lamp.position.set(-2.05,.23,2.1);room.add(lamp);action(lamp,'lamp');cyl(lamp,dark,.38,.09,[0,.05,0]);cyl(lamp,gold,.032,3.12,[0,1.6,0]);
 const shadeMat=clothMaterial('#f4e4bc');shadeMat.side=T.DoubleSide;shadeMat.emissive.set('#ffd485');shadeMat.emissiveIntensity=0;const shade=new T.Mesh(new T.CylinderGeometry(.34,.57,.68,48,1,true),shadeMat);shade.position.y=3.2;shade.castShadow=true;lamp.add(shade);cyl(lamp,trim,.33,.025,[0,3.545,0]);
 const pull=cyl(lamp,gold,.01,.55,[.3,2.84,0]);void pull;sphere(lamp,gold,.035,[.3,2.54,0]);
 const bulb=new T.PointLight('#ffd290',0,8,1.5);bulb.position.set(-2.05,3.25,2.1);room.add(bulb);
 // Woven oval rug and a cozy chair with a bear.
 const rugMat=mat('#dfd5b9');const rug=cyl(room,rugMat,1.65,.025,[.55,.24,1.15]);rug.scale.z=.78;
 for(let i=0;i<9;i++){const ring=new T.Mesh(new T.TorusGeometry(.3+i*.16,.009,4,90),mat(i%2?'#c8bea0':'#f1e7cf'));ring.rotation.x=Math.PI/2;ring.position.set(.55,.258,1.15);ring.scale.y=.78;room.add(ring);}
 const chair=new T.Group();chair.position.set(.7,.25,.8);chair.rotation.y=Math.PI;room.add(chair);action(chair,'chair');
 for(const x of[-.56,.56])for(const z of[-.43,.43]){const leg=cyl(chair,edge,.055,.62,[x,.3,z]);leg.rotation.z=-x*.15;}
 box(chair,green,[1.34,.31,1.19],[0,.66,0],.15);box(chair,green,[1.39,1.08,.3],[0,1.13,-.52],.14);
 for(const x of[-.75,.75]){box(chair,oak,[.13,.12,1.16],[x,1.04,0],.055);cyl(chair,edge,.04,.45,[x,.79,.36]);}
 // Upholstery welt cords follow the rounded cushion edges.
 const piping=clothMaterial('#65765b');
 function cord(parent:T.Object3D,points:number[][],material:T.Material,r=.012){const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p as [number,number,number])),true,'catmullrom',.25);const mesh=new T.Mesh(new T.TubeGeometry(path,80,r,6,true),material);parent.add(mesh);}
 cord(chair,[[-.56,.72,-.53],[.56,.72,-.53],[.65,.72,-.4],[.65,.72,.42],[.55,.72,.54],[-.55,.72,.54],[-.65,.72,.42],[-.65,.72,-.4]],piping);
 cord(chair,[[-.55,.69,-.35],[.55,.69,-.35],[.62,.8,-.35],[.62,1.5,-.35],[.53,1.6,-.35],[-.53,1.6,-.35],[-.62,1.5,-.35],[-.62,.8,-.35]],piping,.009);
 box(chair,trim,[.10,.045,.018],[.68,.65,.28],.004);
 const bear=createPandaPlush();bear.position.set(-.35,.24,2.20);room.add(bear);action(bear,'bear');
 // Upholstered ottoman and an anatomically shaped controller with separate controls.
 cyl(room,linen,.45,.44,[2.6,.49,1.48]);const ottomanSeam=new T.Mesh(new T.TorusGeometry(.442,.009,6,72),clothMaterial('#c4bda9'));ottomanSeam.rotation.x=Math.PI/2;ottomanSeam.position.set(2.6,.687,1.48);room.add(ottomanSeam);
 const gamepad=createPhoneController();gamepad.position.set(2.6,.755,1.48);gamepad.rotation.set(-Math.PI/2,0,-.15);gamepad.scale.setScalar(.255);room.add(gamepad);action(gamepad,'games');
 const ipad=createKeyboardIPad();ipad.position.set(-1.57,2.065,-1.80);ipad.rotation.y=.64;ipad.scale.setScalar(.75);room.add(ipad);action(ipad,'shows');
 return {room,clickable,bear,chair,folders,bookGroup,board,ipad,gamepad,player,setNight(_night:boolean,blend:number){nightWindowMat.opacity=blend;shadeMat.emissiveIntensity=blend*.75;bulb.intensity=blend*9;}};
}


