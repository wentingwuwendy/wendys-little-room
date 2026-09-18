import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { books, createBookModel, disposeBookModel } from './bookModels';
import './books.css';

export function bookGalleryHTML(){return `<section class="book-gallery" aria-label="五本喜欢的书"><div class="book-picker" aria-label="选择一本书">${books.map((b,i)=>`<button data-book-index="${i}" aria-pressed="${i===0}"><span>0${i+1}</span>${b.title}</button>`).join('')}</div><div class="book-view"><canvas class="book-canvas" tabindex="0" aria-label="3D 书籍，拖动旋转，方向键调整角度"></canvas><p class="book-fallback" hidden>3D 预览暂时不可用。你仍可以查看下方封面照片。</p><span class="book-view-label">ON MY BOOKSHELF</span><span class="book-view-hint">拖动旋转 · 滚轮缩放</span></div><div class="book-caption" aria-live="polite"><h3></h3><p></p><small></small></div><div class="book-view-buttons"><button data-book-view="front">封面</button><button data-book-view="spine">书脊</button><button data-book-view="back">背面</button><button data-book-view="reset">↺ 复位</button></div><details class="book-source"><summary>查看封面原图与版本说明</summary><p>封面与书脊来自同版实拍，书本尺寸为近似比例。未提供背面照片的部分采用素色装帧。</p><img alt="当前书籍的封面参考照片"></details></section>`;}

export function mountBookGallery(host:HTMLElement){
 const canvas=host.querySelector<HTMLCanvasElement>('canvas')!;
 const caption=host.querySelector('.book-caption')!;
 const source=host.querySelector<HTMLImageElement>('.book-source img')!;
 const view=host.querySelector<HTMLElement>('.book-view')!;
 let renderer:T.WebGLRenderer|undefined,controls:OrbitControls|undefined,current:T.Group|undefined;
 let disposed=false,selected=0,frame=0,remaining=0;
 const scene=new T.Scene();
 const camera=new T.PerspectiveCamera(34,1,.1,40);
 function render(){frame=0;if(disposed||!renderer||document.hidden)return;controls?.update();renderer.render(scene,camera);if(remaining-->0)frame=requestAnimationFrame(render);}
 function invalidate(frames=2){remaining=Math.max(remaining,frames);if(!frame)frame=requestAnimationFrame(render);}
 function angle(kind='reset'){
  const h=books[selected].height/2;
  const positions:Record<string,[number,number,number]>={front:[0,h,6.5],spine:[-6.5,h,.05],back:[0,h,-6.5],reset:[-3.15,h+1.3,5.6]};
  camera.position.set(...positions[kind]);controls?.target.set(0,h,0);controls?.update();invalidate(35);
 }
 function select(i:number){
  selected=i;const b=books[i];
  host.querySelectorAll<HTMLElement>('[data-book-index]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.bookIndex)===i)));
  caption.querySelector('h3')!.textContent=b.title;caption.querySelector('p')!.textContent=b.author;caption.querySelector('small')!.textContent=b.edition;
  source.src=`${import.meta.env.BASE_URL}books/${b.front.file}`;
  if(current){scene.remove(current);disposeBookModel(current);}
  current=createBookModel(b);scene.add(current);angle();invalidate(100);
 }
 function click(e:Event){const el=(e.target as HTMLElement).closest<HTMLElement>('button');if(el?.dataset.bookIndex!==undefined)select(Number(el.dataset.bookIndex));if(el?.dataset.bookView)angle(el.dataset.bookView);}
 const resize=new ResizeObserver(()=>{if(!renderer)return;const w=view.clientWidth,h=view.clientHeight;camera.aspect=w/Math.max(h,1);camera.updateProjectionMatrix();renderer.setSize(w,h,false);invalidate();});
 const lost=(e:Event)=>{e.preventDefault();host.querySelector<HTMLElement>('.book-fallback')!.hidden=false;};
 const restore=()=>{host.querySelector<HTMLElement>('.book-fallback')!.hidden=true;invalidate(60);};
 const visibility=()=>{if(!document.hidden)invalidate(60);};
 const key=(e:KeyboardEvent)=>{
  if(!controls||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;
  e.preventDefault();if(e.key==='Home'){angle();return;}
  const delta=camera.position.clone().sub(controls.target),s=new T.Spherical().setFromVector3(delta);
  if(e.key==='ArrowLeft')s.theta-=.18;if(e.key==='ArrowRight')s.theta+=.18;if(e.key==='ArrowUp')s.phi-=.12;if(e.key==='ArrowDown')s.phi+=.12;
  s.phi=T.MathUtils.clamp(s.phi,.25,Math.PI-.25);camera.position.copy(controls.target).add(new T.Vector3().setFromSpherical(s));controls.update();invalidate(30);
 };
 try{
  renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  scene.add(new T.HemisphereLight('#fff8e9','#82765f',2.1));
  const keyLight=new T.DirectionalLight('#fff1d7',2.6);keyLight.position.set(-3,7,5);keyLight.castShadow=true;keyLight.shadow.mapSize.set(1024,1024);keyLight.shadow.normalBias=.025;scene.add(keyLight);
  const fill=new T.DirectionalLight('#dce8fa',1);fill.position.set(4,3,-2);scene.add(fill);
  const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;floor.receiveShadow=true;scene.add(floor);
  controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.enableDamping=!matchMedia('(prefers-reduced-motion: reduce)').matches;controls.dampingFactor=.12;controls.minDistance=3.3;controls.maxDistance=9;controls.minPolarAngle=.25;controls.maxPolarAngle=Math.PI-.25;
  controls.addEventListener('change',()=>invalidate());controls.addEventListener('start',()=>invalidate(35));controls.addEventListener('end',()=>invalidate(35));
  resize.observe(view);
 }catch{host.querySelector<HTMLElement>('.book-fallback')!.hidden=false;canvas.hidden=true;}
 host.addEventListener('click',click);canvas.addEventListener('keydown',key);canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restore);document.addEventListener('visibilitychange',visibility);
 select(0);
 // Source photos may finish loading after the first render; a bounded refresh also
 // covers the shared TextureLoader cache without a permanent animation loop.
 const refresh=window.setInterval(()=>invalidate(),300);const finish=window.setTimeout(()=>clearInterval(refresh),15000);
 return ()=>{disposed=true;cancelAnimationFrame(frame);clearInterval(refresh);clearTimeout(finish);resize.disconnect();host.removeEventListener('click',click);canvas.removeEventListener('keydown',key);canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restore);document.removeEventListener('visibilitychange',visibility);controls?.dispose();scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});renderer?.dispose();renderer?.forceContextLoss();};
}
