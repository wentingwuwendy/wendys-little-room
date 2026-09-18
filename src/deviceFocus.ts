import * as T from 'three';
import { Runner, drawRunner } from './runner';

export type DeviceKind='games'|'shows';
export function deviceFocusHTML(kind:DeviceKind){
 return `<h2 id="dialog-title" class="sr-only">${kind==='games'?'手机手柄 · 木桩漫游':'装腔启示录'}</h2><section class="device-focus device-${kind}"><canvas class="device-canvas" aria-hidden="true"></canvas>${kind==='games'?'<button class="runner-input" aria-label="开始游戏；单击跳跃，快速双击跳得更高，也可按空格或向上键"></button><span class="sr-only runner-status" role="status" aria-live="polite"></span>':''}</section>`;
}
export function mountDeviceFocus(host:HTMLElement,kind:DeviceKind,source:T.Group){
 const canvas=host.querySelector<HTMLCanvasElement>('canvas')!;
 const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.1,30);
 scene.add(new T.HemisphereLight('#fff9ed','#8b9391',2.4));
 const key=new T.DirectionalLight('#fff4e3',2.7);key.position.set(-3,5,7);scene.add(key);
 const fill=new T.DirectionalLight('#dce8ff',1.3);fill.position.set(4,1,3);scene.add(fill);
 const model=source.clone(true);model.position.set(0,0,0);model.rotation.set(0,0,0);model.scale.setScalar(1);scene.add(model);
 if(kind==='games'){model.rotation.set(-.12,-.08,-.025);camera.position.set(0,0,8);camera.lookAt(0,0,0);}
 else{model.rotation.y=-.12;model.position.y=-.37;camera.position.set(1.1,1.45,3);camera.lookAt(0,.04,0);}
 const input=host.querySelector<HTMLButtonElement>('.runner-input'),status=host.querySelector<HTMLElement>('.runner-status');
 const game=new Runner();let best=0,frame=0,previous=0,accumulator=0,disposed=false,lastState='';
 let screen:T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>|undefined,texture:T.CanvasTexture|undefined,screenMaterial:T.MeshBasicMaterial|undefined;
 const drawing=document.createElement('canvas');drawing.width=900;drawing.height=430;const ctx=drawing.getContext('2d')!;
 if(kind==='games'){
  try{best=Number(localStorage.getItem('wendy-run-best'))||0;}catch{/* Score persistence is optional. */}
  screen=model.getObjectByName('runner-screen') as typeof screen;
  texture=new T.CanvasTexture(drawing);texture.colorSpace=T.SRGBColorSpace;
  screenMaterial=new T.MeshBasicMaterial({map:texture,toneMapped:false});screen!.material=screenMaterial;
 }
 function jump(){game.jump();input?.focus({preventScroll:true});}
 function click(e:MouseEvent){if(e.detail===0||e.button===0)jump();}
 function keydown(e:KeyboardEvent){if([' ','ArrowUp'].includes(e.key)){e.preventDefault();if(!e.repeat)jump();}}
 input?.addEventListener('click',click);host.addEventListener('keydown',keydown);
 function resize(){
  const w=host.clientWidth,h=host.clientHeight;camera.aspect=w/h;
  const desiredWidth=kind==='games'?4.35:1.7;
  const distance=Math.max(kind==='games'?5.8:3.4,desiredWidth/(2*Math.tan(T.MathUtils.degToRad(16))*camera.aspect));
  if(kind==='games')camera.position.z=distance;
  else{camera.position.set(.33,.44,1).normalize().multiplyScalar(distance);camera.lookAt(0,.04,0);}
  camera.updateProjectionMatrix();renderer.setSize(w,h,false);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  if(input){
   // One accessible hit area covers the physical phone and both controls.
   const box=new T.Box3().setFromObject(model),points:T.Vector3[]=[];
   for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new T.Vector3(x,y,z).project(camera));
   const xs=points.map(p=>(p.x*.5+.5)*w),ys=points.map(p=>(-.5*p.y+.5)*h);
   Object.assign(input.style,{left:`${Math.min(...xs)}px`,top:`${Math.min(...ys)}px`,width:`${Math.max(...xs)-Math.min(...xs)}px`,height:`${Math.max(...ys)-Math.min(...ys)}px`});
  }
 }
 const observer=new ResizeObserver(resize);observer.observe(host);resize();
 function visibility(){previous=0;accumulator=0;}
 document.addEventListener('visibilitychange',visibility);
 function tick(time:number){
  if(disposed)return;frame=requestAnimationFrame(tick);
  if(document.hidden){previous=0;return;}
  const dt=previous?Math.min((time-previous)/1000,.1):0;previous=time;
  if(kind==='games'){
   accumulator+=dt;while(accumulator>=1/120){game.step(1/120);accumulator-=1/120;}
   if(game.state==='over'&&game.score>best){best=game.score;try{localStorage.setItem('wendy-run-best',String(best));}catch{/* Optional. */}}
   if(lastState!==game.state){lastState=game.state;host.dataset.state=lastState;status!.textContent=lastState==='over'?`游戏结束，越过 ${game.score} 个木桩。点击再跑一次。`:lastState==='running'?'游戏开始。':'';input!.setAttribute('aria-label',lastState==='over'?'游戏结束，重新开始':lastState==='running'?'跳跃；快速双击跳得更高':'开始游戏；单击跳跃，快速双击跳得更高');}
   drawRunner(ctx,game,best);texture!.needsUpdate=true;
   if(import.meta.env.DEV){host.dataset.jump=game.height.toFixed(1);host.dataset.score=String(game.score);}
  }
  renderer.render(scene,camera);
 }
 frame=requestAnimationFrame(tick);
 return ()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();input?.removeEventListener('click',click);host.removeEventListener('keydown',keydown);document.removeEventListener('visibilitychange',visibility);texture?.dispose();screenMaterial?.dispose();renderer.dispose();renderer.forceContextLoss();};
}
