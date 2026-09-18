import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

type Point = [number, number];
type Crop = { file: string; corners: [Point, Point, Point, Point] };
export type BookSpec = { id: string; title: string; author: string; edition: string; color: string; width: number; height: number; depth: number; front: Crop; spine: Crop };
const crop = (file: string, w: number, h: number, points: [Point, Point, Point, Point]): Crop => ({file, corners: points.map(([x,y]) => [x/w,y/h]) as Crop['corners']});
export const books: BookSpec[] = [
 {id:'dalloway',title:'Mrs Dalloway',author:'Virginia Woolf',edition:'达洛维夫人 · Hogarth Press',color:'#e8d7ab',width:1.45,height:2.2,depth:.28,
  front:crop('01-mrs-dalloway-cover-spine.jpg',700,700,[[202,62],[585,60],[585,646],[202,645]]),spine:crop('01-mrs-dalloway-cover-spine.jpg',700,700,[[131,76],[195,62],[195,641],[130,628]])},
 {id:'room',title:'A Room of One’s Own',author:'Virginia Woolf',edition:'一间自己的房间 · Hogarth Press',color:'#ebc999',width:1.4,height:2.16,depth:.22,
  front:crop('02-a-room-of-ones-own-cover-spine.jpg',700,700,[[199,65],[558,66],[558,635],[199,633]]),spine:crop('02-a-room-of-ones-own-cover-spine.jpg',700,700,[[160,67],[195,65],[196,633],[161,628]])},
 {id:'wind',title:'飘',author:'Margaret Mitchell',edition:'Gone with the Wind · Macmillan',color:'#d3bc80',width:1.48,height:2.2,depth:.57,
  front:crop('03-gone-with-the-wind-cover.jpg',1920,1280,[[637,128],[1315,127],[1304,1136],[638,1131]]),spine:crop('gone-5.jpg',1920,1280,[[817,197],[1045,195],[1050,1115],[833,1107]])},
 {id:'poe',title:'爱伦·坡作品集',author:'Edgar Allan Poe',edition:'Stories and Poems · Canterbury Classics',color:'#162e37',width:1.48,height:2.3,depth:.43,
  front:crop('04-edgar-allan-poe-cover-spine.jpg',671,1000,[[148,88],[644,36],[631,897],[148,974]]),spine:crop('04-edgar-allan-poe-cover-spine.jpg',671,1000,[[27,49],[132,79],[134,977],[26,943]])},
 {id:'cholera',title:'霍乱时期的爱情',author:'Gabriel García Márquez',edition:'Love in the Time of Cholera · Knopf',color:'#eee9d9',width:1.46,height:2.3,depth:.38,
  front:crop('05-love-in-the-time-of-cholera-cover.jpg',1368,1824,[[173,111],[1280,104],[1267,1751],[184,1742]]),spine:crop('05-love-in-the-time-of-cholera-spine.jpg',1368,1824,[[590,124],[800,122],[823,1690],[599,1690]])},
];

// Shared source textures: the room and the inspector use the same GPU resources.
const textures = new Map<string,T.Texture>();
function texture(file: string) {
 let t=textures.get(file);
 if(!t){t=new T.TextureLoader().load(`${import.meta.env.BASE_URL}books/${file}`);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;textures.set(file,t);}
 return t;
}

// Map a flat rectangle to the photographed quadrilateral with a homography.
// Subdivision preserves straight lettering without baking a new bitmap asset.
function photoFace(width:number,height:number,source:Crop){
 const g=new T.PlaneGeometry(width,height,32,48);
 const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=source.corners;
 const dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3;
 const dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3;
 const det=dx1*dy2-dx2*dy1;
 const p=Math.abs(det)>1e-10?(dx3*dy2-dx2*dy3)/det:0;
 const q=Math.abs(det)>1e-10?(dx1*dy3-dx3*dy1)/det:0;
 const a=x1-x0+p*x1,b=x3-x0+q*x3,d=y1-y0+p*y1,e=y3-y0+q*y3;
 const uv=g.getAttribute('uv');
 for(let i=0;i<uv.count;i++){const u=uv.getX(i),v=1-uv.getY(i),den=p*u+q*v+1;uv.setXY(i,(a*u+b*v+x0)/den,1-(d*u+e*v+y0)/den);}
 return new T.Mesh(g,new T.MeshStandardMaterial({map:texture(source.file),roughness:.83}));
}

let paper:T.CanvasTexture|undefined;
function paperTexture(){
 if(paper)return paper;
 const c=document.createElement('canvas');c.width=128;c.height=512;const ctx=c.getContext('2d')!;
 ctx.fillStyle='#e7dfc9';ctx.fillRect(0,0,128,512);
 for(let y=0;y<512;y+=3){ctx.strokeStyle=y%9===0?'#bfb49c':'#d3c9b3';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y+.5);ctx.stroke();}
 paper=new T.CanvasTexture(c);paper.colorSpace=T.SRGBColorSpace;paper.anisotropy=4;return paper;
}

/** Centered on X/Z, bottom at Y=0; cover faces +Z and spine faces -X. */
export function createBookModel(spec:BookSpec){
 const root=new T.Group();root.name=`book-${spec.id}`;root.userData.bookId=spec.id;
 const {width:w,height:h,depth:d}=spec;
 const binding=new T.MeshStandardMaterial({color:spec.color,roughness:.85});
 const edge=new T.MeshStandardMaterial({color:spec.id==='poe'?'#a78b4c':'#d4c7a4',roughness:.8});
 const pageMat=new T.MeshStandardMaterial({map:paperTexture(),roughness:1});
 const addBox=(name:string,width:number,height:number,depth:number,x:number,y:number,z:number,m:T.Material|T.Material[])=>{
  const mesh=new T.Mesh(new RoundedBoxGeometry(width,height,depth,2,Math.min(.012,depth/4)),m);
  mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
 };
 addBox('page-block',w-.07,h-.085,d-.055,.015,h/2,0,[pageMat,pageMat,edge,edge,pageMat,pageMat]);
 addBox('front-board',w,h,.024,0,h/2,d/2,binding);
 addBox('back-board',w,h,.024,0,h/2,-d/2,binding);
 addBox('spine-binding',.044,h,d+.025,-w/2+.015,h/2,0,binding);
 const front=photoFace(w-.012,h-.018,spec.front);front.name='front-artwork';front.position.set(.002,h/2,d/2+.013);root.add(front);
 const spine=photoFace(d+.014,h-.018,spec.spine);spine.name='spine-artwork';spine.rotation.y=-Math.PI/2;spine.position.set(-w/2-.008,h/2,0);root.add(spine);
 for(const y of[.04,h-.04])addBox('headband',.045,.018,d-.03,-w/2+.05,y,0,edge);
 root.userData.parts=root.children.map(p=>p.name);
 return root;
}

export function disposeBookModel(root:T.Object3D){
 root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
}
