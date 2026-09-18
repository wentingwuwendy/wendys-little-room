import * as T from 'three';
import { books } from './bookModels';
import { internationalExperiences } from './international';
import './objectFocus.css';

export type FocusKind='books'|'travel';
export function objectFocusHTML(kind:FocusKind){
 const items=kind==='books'?books:internationalExperiences;
 return `<h2 id="dialog-title" class="sr-only">${kind==='books'?'我喜欢的五本书':'国际经历冰箱贴板'}</h2><section class="object-focus focus-${kind}" aria-label="${kind==='books'?'书籍':'国际经历'}"><canvas class="object-canvas" aria-hidden="true"></canvas><div class="object-hit-targets">${items.map((item,i)=>`<button class="object-hit" data-focus-index="${i}" aria-label="${'title' in item?item.title:item.name}" aria-pressed="false"></button>`).join('')}</div>${kind==='travel'?'<aside class="memory-preview" hidden aria-live="polite"></aside>':''}</section>`;
}

/** Enlarges the room's actual scene objects, sharing their geometry and textures. */
export function mountObjectFocus(host:HTMLElement,kind:FocusKind,source:T.Group){
 const canvas=host.querySelector<HTMLCanvasElement>('canvas')!;
 const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-3,3,2,-2,.1,30);
 scene.add(new T.HemisphereLight('#fff8ea','#a4967d',2.3));const key=new T.DirectionalLight('#fff6e8',2.5);key.position.set(-3,5,7);scene.add(key);const fill=new T.DirectionalLight('#dceaff',.7);fill.position.set(4,2,-2);scene.add(fill);
 const root=new T.Group();scene.add(root);
 const targets:T.Object3D[]=[];
 if(kind==='books'){
  source.children.filter(o=>o.userData.bookId).forEach(o=>{const book=o.clone(true);book.position.set(0,0,0);book.rotation.set(0,Math.PI/2,0);book.scale.setScalar(1);root.add(book);targets.push(book);});
 }else{
  const board=source.clone(true);board.position.set(0,0,0);board.rotation.set(0,0,0);board.scale.setScalar(1);root.add(board);
  internationalExperiences.forEach(e=>{const o=board.children.find(o=>o.userData.experienceId===e.id);if(o)targets.push(o);});
 }
 const buttons=Array.from(host.querySelectorAll<HTMLButtonElement>('[data-focus-index]'));
 const baseScales=targets.map(o=>o.scale.clone());
 let selected=-1,frame=0,disposed=false,last=0;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const pane=host.querySelector<HTMLElement>('.memory-preview');
 function select(i:number){
  if(selected===i)return;selected=i;buttons.forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));
  if(!pane)return;
  pane.hidden=i<0;if(i<0)return;
  const e=internationalExperiences[i];
  pane.innerHTML=`<div class="memory-photo">${e.photo?`<img src="${import.meta.env.BASE_URL}${e.photo}" alt="${e.name}经历照片">`:`<div class="memory-placeholder"><span class="photo-corners">⌜<span>⌝</span></span><span class="photo-mark">▧</span><span>${e.photoLabel}</span><span class="photo-corners">⌞<span>⌟</span></span></div>`}</div><div class="memory-caption"><span>${e.kind}${e.date?` / ${e.date}`:''}</span><h3>${e.name}</h3><p>${e.description}</p></div>`;
 }
 const listeners:{button:HTMLButtonElement;enter:()=>void;click:()=>void}[]=[];
 buttons.forEach((button,i)=>{const enter=()=>select(i),click=()=>select(i);button.addEventListener('pointerenter',enter);button.addEventListener('focus',enter);button.addEventListener('click',click);listeners.push({button,enter,click});});
 function keydown(e:KeyboardEvent){if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const i=e.key==='Home'?0:e.key==='End'?buttons.length-1:(selected+(e.key==='ArrowLeft'?-1:1)+buttons.length)%buttons.length;buttons[i].focus();}
 host.addEventListener('keydown',keydown);
 function resize(){
  const w=host.clientWidth,h=host.clientHeight,aspect=w/h,mobile=w<650;
  const half=kind==='books'?Math.max(1.7,(mobile?2.25:2.6)/aspect):mobile?2.3:1.55;
  camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;
  if(kind==='books'){camera.position.set(0,1.32,9);camera.lookAt(0,1.08,0);}
  else{camera.position.set(0,0,9);camera.lookAt(0,0,0);root.position.set(mobile?0:-.92,mobile?.67:0,0);root.scale.setScalar(mobile?.9:1.15);}
  camera.updateProjectionMatrix();renderer.setSize(w,h,false);
 }
 const observer=new ResizeObserver(resize);observer.observe(host);resize();
 function tick(time:number){
  if(disposed)return;frame=requestAnimationFrame(tick);if(document.hidden||time-last<1000/40)return;const delta=last?Math.min((time-last)/1000,.1):.025;last=time;const k=reduced?1:1-Math.exp(-delta*12);
  if(kind==='books'){
   const widths=books.map((b,i)=>i===selected?b.width+.28:b.depth+.22),total=widths.reduce((a,b)=>a+b,0);let x=-total/2;
   targets.forEach((o,i)=>{const active=i===selected;x+=widths[i]/2;o.position.x=T.MathUtils.lerp(o.position.x,x,k);o.position.y=T.MathUtils.lerp(o.position.y,active?.10:0,k);o.position.z=T.MathUtils.lerp(o.position.z,active?.8:0,k);o.rotation.y=T.MathUtils.lerp(o.rotation.y,active?-.06:Math.PI/2,k);x+=widths[i]/2;});
  }else targets.forEach((o,i)=>{const scale=i===selected?1.14:1;o.scale.lerp(baseScales[i].clone().multiplyScalar(scale),k);});
  scene.updateMatrixWorld(true);
  targets.forEach((o,i)=>{
   const box=new T.Box3().setFromObject(o),points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new T.Vector3(x,y,z).project(camera));
   const xs=points.map(p=>(p.x*.5+.5)*host.clientWidth),ys=points.map(p=>(-p.y*.5+.5)*host.clientHeight);
   const b=buttons[i];b.style.left=`${Math.min(...xs)}px`;b.style.top=`${Math.min(...ys)}px`;b.style.width=`${Math.max(...xs)-Math.min(...xs)}px`;b.style.height=`${Math.max(...ys)-Math.min(...ys)}px`;b.style.zIndex=i===selected?'2':'1';
  });
  renderer.render(scene,camera);
 }
 frame=requestAnimationFrame(tick);
 return ()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();host.removeEventListener('keydown',keydown);listeners.forEach(({button,enter,click})=>{button.removeEventListener('pointerenter',enter);button.removeEventListener('focus',enter);button.removeEventListener('click',click);});renderer.dispose();renderer.forceContextLoss();};
}
