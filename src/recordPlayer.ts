import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { woodMaterial } from './detailMaterials';
export const recordArtists=['薛之谦','黄子弘凡','Jony J','TizzyT'];
export function createVinyl(index=0){
 const g=new T.Group();g.name='vinyl';
 const black=new T.MeshStandardMaterial({color:'#191e1e',roughness:.38,metalness:.22});
 const disc=new T.Mesh(new T.CylinderGeometry(.263,.263,.011,80),black);g.add(disc);
 for(let i=0;i<17;i++){const groove=new T.Mesh(new T.TorusGeometry(.112+i*.0085,.0009,4,80),new T.MeshStandardMaterial({color:i%2?'#414747':'#262b2b',roughness:.48}));groove.rotation.x=-Math.PI/2;groove.position.y=.006;g.add(groove);}
 const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d')!;
 ctx.fillStyle=['#b78063','#9aab84','#a8a8b4','#c1ab74'][index];ctx.fillRect(0,0,256,256);ctx.fillStyle='#fff7e8';ctx.textAlign='center';ctx.font='26px "Microsoft YaHei",sans-serif';ctx.fillText(recordArtists[index],128,98);ctx.font='14px Georgia';ctx.fillText('WENDY’S COLLECTION',128,169);
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
 const label=new T.Mesh(new T.CircleGeometry(.101,48),new T.MeshBasicMaterial({map:tex}));label.rotation.x=-Math.PI/2;label.position.y=.008;g.add(label);
 const hole=new T.Mesh(new T.CylinderGeometry(.009,.009,.019,16),black);g.add(hole);return g;
}
export function createRecordPlayer(){
 const g=new T.Group();g.name='record-player';
 const metal=new T.MeshStandardMaterial({color:'#b0a18a',metalness:.8,roughness:.28}),dark=new T.MeshStandardMaterial({color:'#343c39',roughness:.55});
 function box(m:T.Material,s:[number,number,number],p:[number,number,number]){const o=new T.Mesh(new RoundedBoxGeometry(...s,3,.014),m);o.position.set(...p);o.castShadow=o.receiveShadow=true;g.add(o);return o;}
 box(woodMaterial('#b08b64'),[.88,.14,.67],[0,0,0]);box(dark,[.79,.012,.59],[0,.077,0]);
 const platter=new T.Mesh(new T.CylinderGeometry(.28,.28,.023,72),metal);platter.position.set(-.085,.093,0);g.add(platter);
 const vinyl=createVinyl();vinyl.position.set(-.085,.116,0);g.add(vinyl);
 const pivot=new T.Mesh(new T.CylinderGeometry(.043,.043,.045,32),metal);pivot.position.set(.29,.11,-.21);g.add(pivot);
 const curve=new T.CatmullRomCurve3([new T.Vector3(.29,.139,-.21),new T.Vector3(.29,.139,.10),new T.Vector3(.18,.139,.19)]);
 g.add(new T.Mesh(new T.TubeGeometry(curve,20,.01,8,false),metal));box(dark,[.035,.021,.066],[.174,.134,.19]);
 for(const x of [-.36,.35]){const knob=new T.Mesh(new T.CylinderGeometry(.024,.024,.018,24),metal);knob.position.set(x,.092,.26);g.add(knob);}
 return g;
}
