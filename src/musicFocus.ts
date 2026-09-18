import * as T from 'three';
import { createVinyl,recordArtists } from './recordPlayer';
export function musicFocusHTML(){return '<h2 id="dialog-title" class="sr-only">唱片收藏</h2><section class="music-focus" tabindex="0" aria-label="唱片机；上下滑动或按方向键切换唱片"><canvas aria-hidden="true"></canvas><button class="record-prev" aria-label="上一张唱片"></button><button class="record-next" aria-label="下一张唱片"></button><span class="sr-only record-status" role="status" aria-live="polite"></span></section>';}
export function mountMusicFocus(host:HTMLElement,source:T.Group){
 const renderer=new T.WebGLRenderer({canvas:host.querySelector('canvas')!,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-2,2,2,-2,.1,20);camera.position.set(0,6,3.5);camera.lookAt(0,0,0);
 scene.add(new T.HemisphereLight('#fff7e5','#606756',2.4));const light=new T.DirectionalLight('#fff3d8',3);light.position.set(-3,6,4);scene.add(light);
 const root=new T.Group();root.scale.setScalar(2.8);scene.add(root);
 const player=source.clone(true);player.position.set(0,0,0);player.rotation.set(0,0,0);player.scale.setScalar(1);const old=player.getObjectByName('vinyl');old?.removeFromParent();root.add(player);
 const discs=recordArtists.map((_,i)=>{const disc=createVinyl(i);root.add(disc);return disc;});
 let selected=0,position=0,frame=0,last=0,disposed=false,wheelSum=0,wheelAt=0,touchY=0;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
 function select(delta:number){selected+=delta;host.dataset.record=String(((selected%4)+4)%4);host.querySelector('.record-status')!.textContent=recordArtists[((selected%4)+4)%4];}
 function wheel(e:WheelEvent){e.preventDefault();if(performance.now()-wheelAt<350)return;wheelSum+=e.deltaY;if(Math.abs(wheelSum)>35){select(Math.sign(wheelSum));wheelSum=0;wheelAt=performance.now();}}
 function down(e:PointerEvent){touchY=e.clientY;if(e.pointerType==='touch'&&!(e.target instanceof HTMLButtonElement))host.setPointerCapture(e.pointerId);}
 function up(e:PointerEvent){const dy=touchY-e.clientY;if(Math.abs(dy)>35)select(Math.sign(dy));}
 function key(e:KeyboardEvent){if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();select(e.key==='ArrowDown'?1:-1);}}
 const prev=()=>select(-1),next=()=>select(1);
 host.addEventListener('wheel',wheel,{passive:false});host.addEventListener('pointerdown',down);host.addEventListener('pointerup',up);host.addEventListener('keydown',key);host.querySelector('.record-prev')!.addEventListener('click',prev);host.querySelector('.record-next')!.addEventListener('click',next);
 function resize(){const w=host.clientWidth,h=host.clientHeight,half=Math.max(2.25,1.5/(w/h));camera.left=-half*w/h;camera.right=half*w/h;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}
 const observer=new ResizeObserver(resize);observer.observe(host);resize();select(0);
 function tick(time:number){if(disposed)return;frame=requestAnimationFrame(tick);const dt=last?Math.min((time-last)/1000,.05):.016;last=time;position=T.MathUtils.damp(position,selected,reduced?100:12,dt);
  discs.forEach((disc,i)=>{let offset=((i-position+6)%4+4)%4-2;disc.position.set(-.085,.119+Math.min(1,Math.abs(offset))*.12,offset*.96);disc.visible=Math.abs(offset)<1.65;disc.rotation.y=Math.abs(offset)<.05&&!reduced?time*.00013:0;});renderer.render(scene,camera);}
 frame=requestAnimationFrame(tick);
 return ()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();host.removeEventListener('wheel',wheel);host.removeEventListener('pointerdown',down);host.removeEventListener('pointerup',up);host.removeEventListener('keydown',key);host.querySelector('.record-prev')!.removeEventListener('click',prev);host.querySelector('.record-next')!.removeEventListener('click',next);discs.forEach(d=>d.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();const m=o.material as T.MeshStandardMaterial;m.map?.dispose();m.dispose();}}));renderer.dispose();renderer.forceContextLoss();};
}
