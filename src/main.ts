import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createCozyRoom, type Action } from './cozyRoom';
import { createBearController } from './bearController';
import { bookGalleryHTML, mountBookGallery } from './bookGallery';
import { objectFocusHTML, mountObjectFocus, type FocusKind } from './objectFocus';
import { musicFocusHTML,mountMusicFocus } from './musicFocus';
import { createRecordPlayer } from './recordPlayer';
import { deviceFocusHTML, mountDeviceFocus, type DeviceKind } from './deviceFocus';
import { createKeyboardIPad, createPhoneController } from './deviceModels';
import { internships, projects, cities, titles, type Story } from './content';
import './styles.css';

const $=<T extends Element=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const dialog=$<HTMLDialogElement>('#story-dialog');
const content=$('#dialog-content');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let returnFocus:HTMLElement|null=null;
let cancelBearVisit=()=>{};
let disposeBooks=()=>{};
let focusSources:Record<FocusKind,THREE.Group>|null=null;
let musicSource:THREE.Group|null=null;
let deviceSources:Record<DeviceKind,THREE.Group>|null=null;
dialog.addEventListener('close',()=>{disposeBooks();disposeBooks=()=>{};});
let night=false;
try{night=localStorage.getItem('wendy-room-theme')==='night';}catch{/* The room also works without storage. */}
$('#year').textContent=String(new Date().getFullYear());
function toast(message:string){$('#toast').textContent=message;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),2800);}
function heading(key:Story,description:string){return `<h2 id="dialog-title">${titles[key][1]}</h2><p class="lead">${description}</p>`;}
function details(items:string[][]){return `<ul class="detail-list">${items.map(([title,body])=>`<li><strong>${title}</strong>${body}</li>`).join('')}</ul>`;}
function show(key:Story,html:string,objectMode=false){dialog.classList.toggle('object-mode',objectMode);dialog.classList.remove('folder-mode');disposeBooks();disposeBooks=()=>{};$('#dialog-kicker').textContent=titles[key][0];content.innerHTML=html;if(!dialog.open){returnFocus=document.activeElement as HTMLElement;dialog.showModal();}dialog.scrollTop=0;$('#close-dialog').focus();const gallery=content.querySelector<HTMLElement>('.book-gallery');if(gallery)disposeBooks=mountBookGallery(gallery);}
function openStory(key:Story){
 if(key==='experience'){show(key,`<h2 id="dialog-title" class="sr-only">三份实习档案</h2><div class="folder-stack" aria-label="三份实习档案">${internships.map((job,i)=>`<button class="stack-file" style="--tilt:${(i-1)*7}deg;--file-color:${['#a5af95','#c9b59a','#b79586'][i]}" data-job="${i}"><span class="file-tab">FILE 0${i+1}</span><span class="file-paper"></span><span class="file-front"><span class="file-company">${job.name}</span><span class="file-role">${job.role}</span><span class="file-date">${job.date}</span><span class="file-location">${job.city} / INTERNSHIP</span><span class="file-open">翻开档案 ↗</span></span></button>`).join('')}</div>`,true);dialog.classList.add('folder-mode');}
 if(key==='projects')show(key,heading(key,'从一个问题出发，和团队一起，把创意向前推进一点。')+projects.map((p,i)=>`<button class="project-card" data-project="${i}"><span class="meta">0${i+1} / ${p.brand}</span><span class="arrow">↗</span><h3>${p.name}</h3><p>${p.role} · ${p.date}</p></button>`).join(''));
 if(key==='about')show(key,heading(key,'你好，我是吴雯婷，也可以叫我 Wendy。这里有我的学习轨迹，也有课堂之外的生活。')+`<div class="chips"><span>语言与表达</span><span>数据与商业</span><span>对生活保持好奇</span></div><p class="section-label">沿着好奇心走过的路</p><div class="timeline"><div class="timeline-item"><span class="meta">2026.08 — 2027.06 · 香港</span><h3>香港大学 · 商业人工智能</h3><p>把对商业问题的兴趣，延伸到人工智能的应用。</p></div><div class="timeline-item"><span class="meta">2022.09 — 2026.06 · 厦门</span><h3>厦门大学 · 英语专业，辅修统计学</h3><p>GPA 3.7 / 4.0。学习概率论、数理统计、计算数据分析、数据挖掘、活动营销与英汉口译。</p></div><div class="timeline-item"><span class="meta">2024.08 — 2024.12 · 美国伯克利</span><h3>加州大学伯克利分校 · 学期交流</h3><p>文理学院，GPA 4.0 / 4.0。选修定价、AI 与媒体、语言学。</p></div></div><p class="section-label">不在课堂的时候</p><p class="lead">做过中国国际投资贸易洽谈会的翻译志愿者、中国电影金鸡奖志愿者，也在厦大外文女子篮球队打球，担任过宣传中心副部长。房间里的另一面，是游戏、追剧、看现场，还有一架喜欢的书。</p><p class="section-label">随身携带的工具箱</p><div class="chips">${['SQL','Python','Power BI','Vibe Coding','Microsoft Office','Photoshop','视频剪辑','公众号排版'].map(s=>`<span>${s}</span>`).join('')}</div><p class="meta">英语 IELTS 7.5 · 口语 7.0 / 法语入门 / 闽南语母语</p><button class="explore-link" data-open="life">翻到生活的那一页 ↗</button>`);
 if(key==='life')renderLife('music');
 if(key==='travel')openFocused('travel');
 if(key==='contact')show(key,heading(key,'关于工作、共同的兴趣，或者只是一声问候，都欢迎。')+`<div class="contact-card"><small>EMAIL</small><a href="mailto:wentingwu.wendy@gmail.com">wentingwu.wendy@gmail.com ↗</a></div><div class="contact-card"><small>WECHAT</small><strong>Wendywu55t</strong><button id="copy-wechat">复制微信号</button></div><p class="dialog-note">谢谢你来我的小房间坐坐。希望下次，我们又有新的故事可以交换。</p>`);
}
function openFocused(kind:FocusKind){
 if(!focusSources){show(kind==='books'?'life':'travel',kind==='books'?bookGalleryHTML():heading('travel','国际经历与旅行照片正在整理。'));return;}
 show(kind==='books'?'life':'travel',objectFocusHTML(kind),true);
 disposeBooks=mountObjectFocus(content.querySelector<HTMLElement>('.object-focus')!,kind,focusSources[kind]);
}
function openDevice(kind:DeviceKind){
 show('life',deviceFocusHTML(kind),true);
 const source=deviceSources?.[kind]??(kind==='games'?createPhoneController():createKeyboardIPad());
 try{disposeBooks=mountDeviceFocus(content.querySelector<HTMLElement>('.device-focus')!,kind,source);}
 catch{show('life',`<h2 id="dialog-title">${kind==='games'?'游戏时间':'装腔启示录'}</h2><p class="lead">当前浏览器暂时无法显示 3D 组件，请开启硬件加速或使用其他浏览器。</p>`);}
}
function renderLife(tab:string,isolated=false){if(tab==='music'&&isolated){show('life',musicFocusHTML(),true);disposeBooks=mountMusicFocus(content.querySelector<HTMLElement>('.music-focus')!,musicSource??createRecordPlayer());return;}if(tab==='books'){openFocused('books');return;}if(tab==='games'||(tab==='shows'&&isolated)){openDevice(tab);return;}const tabs=[['books','书页之间'],['games','游戏时间'],['shows','追剧清单'],['music','耳机与现场'],['objects','可爱收藏']];let body='';
 if(tab==='books')body=bookGalleryHTML();
 const cards:Record<string,string[][]>={games:[['🎮','王者荣耀','峡谷里的游戏时间。'],['☁','人类一败涂地','喜欢这份摇摇晃晃的快乐。'],['⚔','元气骑士','也喜欢像素世界里的冒险。']],shows:[['▻','中国电视剧','《月光变奏曲》《唐朝诡事录》《庆余年》'],['▻','美剧','《破产姐妹》《使女的故事》'],['✳','综艺 / 追星','范丞丞']],music:[['♫','歌单里的名字','薛之谦 · 黄子弘凡'],['♪','也听说唱','Jony J · TizzyT'],['✧','从耳机到现场','喜欢听歌，也喜欢现场。演出照片的位置留好了，等下一次整理。']],objects:[['🧸','小熊毛绒玩具','给房间留一个柔软的位置。'],['✿','可爱的小摆件','把喜欢的小东西，慢慢收集到身边。'],['✈','冰箱贴收藏','每个城市，都可以留下一枚小小的纪念。']]};
 if(tab!=='books')body=`<div class="life-list">${(cards[tab]||cards.objects).map(([icon,title,desc])=>`<div class="life-item"><span class="life-icon">${icon}</span><h3>${title}</h3><p>${desc}</p></div>`).join('')}</div>`;
 const onlyTitle:Record<string,string>={books:'我的书架',music:'我的音乐盒',games:'游戏时间',shows:'追剧与综艺',objects:'可爱的小收藏'};
 if(isolated){show('life',`<h2 id="dialog-title">${onlyTitle[tab]}</h2><p class="lead">${{books:'翻一翻我喜欢的书。',music:'耳机里的喜欢，也想在现场听见。',games:'进入游戏，换一种方式冒险。',shows:'留给追剧和综艺的时间。',objects:'日常生活里的小小喜欢。'}[tab]}</p>`+body);return;}
 show('life',heading('life','有些喜欢不需要一个理由。它们拼在一起，就是日常生活里的我。')+`<div class="life-tabs" role="tablist" aria-label="兴趣分类">${tabs.map(([id,title])=>`<button id="tab-${id}" role="tab" aria-selected="${tab===id}" aria-controls="life-panel" tabindex="${tab===id?0:-1}" data-life="${id}">${title}</button>`).join('')}</div><div id="life-panel" role="tabpanel" aria-labelledby="tab-${tab}">${body}</div>`);
}
function openJob(i:number){const j=internships[i];if(!j)return;show('experience',`<button class="back-link" data-open="experience">← 回到书架</button><h2 id="dialog-title">${j.name}</h2><p class="meta">${j.role} / ${j.city} / ${j.date}</p><p class="lead">${j.summary}</p><div class="chips">${j.tags.map(t=>`<span>${t}</span>`).join('')}</div><div class="metric-row">${j.metrics.map(([n,label])=>`<div class="metric"><b>${n}</b><small>${label}</small></div>`).join('')}</div>${details(j.details)}<div class="archive-images"><div class="archive-placeholder"><span>▧</span><strong>工作成果 / 报告节选</strong><small>图片待补充</small></div><div class="archive-placeholder"><span>▥</span><strong>项目过程 / 数据看板</strong><small>图片待补充</small></div></div><p class="dialog-note">以上留白用于补充可以公开的实习成果，当前不代表真实工作截图。</p>`);}
function openProject(i:number){const p=projects[i];if(!p)return;show('projects',`<button class="back-link" data-open="projects">← 回到电脑</button><h2 id="dialog-title">${p.name}</h2><p class="meta">${p.brand} / ${p.date}</p><div class="chips"><span>${p.role}</span></div><p class="lead">${p.intro}</p>${details(p.details)}<div class="placeholder"><span>▧</span>${p.placeholder}<br><small>图片待补充</small></div>`);}
function openCity(id:string){if(id==='shanghai'){show('travel',`<button class="back-link" data-open="travel">← 回到冰箱贴展示板</button><h2 id="dialog-title">上海 · 照片变成冰箱贴</h2><p class="lead">从你提供的照片里，留下东方明珠和陆家嘴的轮廓。</p><img class="magnet-presentation" width="1254" height="1254" src="${import.meta.env.BASE_URL}magnets/shanghai-reference-magnet.png" alt="以上海天际线照片为参考生成的金属描边冰箱贴"><figure class="reference-photo"><img width="1098" height="606" src="${import.meta.env.BASE_URL}window/shanghai-reference.png" alt="用户提供的上海陆家嘴天际线参考照片"><figcaption>你提供的参考照片 · 此项是制作示例，未添加为旅行足迹</figcaption></figure>`);return;}const city=cities.find(c=>c.id===id);if(!city)return;show('travel',`<button class="back-link" data-open="travel">← 回到冰箱贴展示板</button><h2 id="dialog-title">${city.name} <span class="meta">${city.en}</span></h2><p class="lead">${city.country} · 一段旅程，等着被慢慢翻开。</p><img class="album-hero" src="${import.meta.env.BASE_URL}magnets/${id}.png" alt="${city.name}地标冰箱贴封面，非旅行实拍"><p class="section-label">相册留白 / 照片待补充</p><div class="album-grid">${['街头的一瞬','喜欢的风景','想记住的自己'].map((s,i)=>`<div class="album-slot"><span>0${i+1}</span>${s}</div>`).join('')}</div><p class="dialog-note">这里预留了真实旅行照片与文字的位置。现在展示的是城市插画，旅程故事将在补充照片后更新。</p>`);}
async function copyWechat(){try{await navigator.clipboard.writeText('Wendywu55t');toast('微信号已复制：Wendywu55t');}catch{toast('微信号：Wendywu55t（可长按或选中复制）');}}
document.addEventListener('click',e=>{const el=(e.target as HTMLElement).closest<HTMLElement>('button');if(!el)return;if(el.dataset.open){cancelBearVisit();openStory(el.dataset.open as Story);}if(el.dataset.job!==undefined)openJob(Number(el.dataset.job));if(el.dataset.project!==undefined)openProject(Number(el.dataset.project));if(el.dataset.city)openCity(el.dataset.city);if(el.dataset.life){renderLife(el.dataset.life);document.querySelector<HTMLElement>(`#tab-${el.dataset.life}`)?.focus();}if(el.id==='copy-wechat')void copyWechat();});
dialog.addEventListener('keydown',e=>{const target=e.target as HTMLElement;if(target.getAttribute('role')!=='tab')return;const tabs=Array.from(dialog.querySelectorAll<HTMLElement>('[role=tab]'));let idx=tabs.indexOf(target);if(e.key==='ArrowRight')idx=(idx+1)%tabs.length;else if(e.key==='ArrowLeft')idx=(idx+tabs.length-1)%tabs.length;else if(e.key==='Home')idx=0;else if(e.key==='End')idx=tabs.length-1;else return;e.preventDefault();const id=tabs[idx].dataset.life!;renderLife(id);document.querySelector<HTMLElement>(`#tab-${id}`)?.focus();});
$('#close-dialog').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});dialog.addEventListener('close',()=>returnFocus?.focus());
function themeUI(){document.body.classList.toggle('night',night);$('#theme-label').textContent=night?'灯下夜读':'白日小憩';$('#theme-icon').textContent=night?'☾':'☼';$('#theme-toggle').setAttribute('aria-pressed',String(night));$('meta[name="theme-color"]').setAttribute('content',night?'#242d32':'#f5f2e9');}
function toggleTheme(){night=!night;themeUI();try{localStorage.setItem('wendy-room-theme',night?'night':'day');}catch{/* Preference persistence is optional. */}}
$('#theme-toggle').addEventListener('click',toggleTheme);themeUI();

function initRoom(){
 const canvas=$<HTMLCanvasElement>('#room-canvas'),stage=$('#room-stage');
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setClearColor(0x000000,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 const scene=new THREE.Scene();const camera=new THREE.OrthographicCamera(-7,7,6,-6,.1,70);const start=new THREE.Vector3(11,9.5,13);camera.position.copy(start);
 const controls=new OrbitControls(camera,canvas);controls.target.set(0,2.25,0);controls.enableDamping=!reduced;controls.dampingFactor=.08;controls.enablePan=false;controls.enableZoom=true;controls.zoomSpeed=.75;controls.minZoom=.7;controls.maxZoom=2.2;controls.minAzimuthAngle=.3;controls.maxAzimuthAngle=1.05;controls.minPolarAngle=.74;controls.maxPolarAngle=1.18;controls.update();controls.saveState();
 const model=createCozyRoom();scene.add(model.room);focusSources={books:model.bookGroup,travel:model.board};deviceSources={games:model.gamepad,shows:model.ipad};musicSource=model.player;
 const bearController=createBearController(model.bear,model.room,reduced,s=>$('#bear-status').textContent=s);
 cancelBearVisit=()=>bearController.cancelPending();
 $('#bear-sit').addEventListener('click',()=>bearController.sitDown());
 const ambient=new THREE.HemisphereLight('#fff6df','#b5ad96',1.8);scene.add(ambient);
 const sun=new THREE.DirectionalLight('#fff3d4',2.4);sun.position.set(-3,9,6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-8;sun.shadow.camera.right=8;sun.shadow.camera.top=8;sun.shadow.camera.bottom=-8;sun.shadow.normalBias=.025;sun.shadow.bias=-.0001;sun.shadow.radius=4;scene.add(sun);
 const fill=new THREE.DirectionalLight('#c8ddd5',.8);fill.position.set(5,4,-2);scene.add(fill);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({color:'#5c5946',opacity:.11}));ground.rotation.x=-Math.PI/2;ground.position.y=-.32;ground.receiveShadow=true;scene.add(ground);
 // Furniture and shadow-casting light positions are fixed; reuse their shadow
 // map while orbiting so the hover passes do not rebuild it with hidden meshes.
 renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;

 const renderTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:Math.min(4,renderer.capabilities.maxSamples)});
 const composer=new EffectComposer(renderer,renderTarget);
 composer.addPass(new RenderPass(scene,camera));
 const outline=new OutlinePass(new THREE.Vector2(1,1),scene,camera);
 outline.visibleEdgeColor.set('#ffffff');outline.hiddenEdgeColor.set('#000000');outline.edgeStrength=3;outline.edgeThickness=1.4;outline.edgeGlow=0;outline.pulsePeriod=0;
 // An alpha mask derived from visible edges keeps the canvas transparent and
 // suppresses occluded edges, including their alpha, when an object is hovered.
 outline.overlayMaterial.fragmentShader=outline.overlayMaterial.fragmentShader.replace('gl_FragColor = finalColor;', 'float edgeAlpha = clamp(max(max(finalColor.r, finalColor.g), finalColor.b), 0.0, 1.0);\n gl_FragColor = vec4(vec3(4.0), edgeAlpha);');
 outline.overlayMaterial.blending=THREE.NormalBlending;
 composer.addPass(outline);composer.addPass(new OutputPass());

 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const raycastMeshes:THREE.Mesh[]=[];
 model.room.traverseVisible(obj=>{if(obj instanceof THREE.Mesh&&!obj.userData.noOutline&&!obj.userData.noRaycast)raycastMeshes.push(obj);});
 let hovered:THREE.Object3D|null=null;
 let hoverPointer:{clientX:number;clientY:number}|null=null,hoverDirty=false;
 let pickedPoint=new THREE.Vector3();
 const activePointers=new Map<number,{x:number;y:number}>();
 let gestureMoved=false,multiTouch=false;
 function visible(obj:THREE.Object3D){let parent:THREE.Object3D|null=obj;while(parent){if(!parent.visible)return false;parent=parent.parent;}return true;}
 function hit(e:{clientX:number;clientY:number}):THREE.Object3D|null{
  const r=canvas.getBoundingClientRect();
  pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
  raycaster.setFromCamera(pointer,camera);
  for(const intersection of raycaster.intersectObjects(raycastMeshes,false)){
   const mesh=intersection.object as THREE.Mesh;
   if(!visible(mesh))continue;
   const material=Array.isArray(mesh.material)?mesh.material[intersection.face?.materialIndex??0]:mesh.material;
   if(!material.visible||material.opacity<.05)continue;
   pickedPoint.copy(intersection.point);if(mesh.userData.ground)return mesh;
   let obj:THREE.Object3D|null=mesh;
   while(obj){if(obj.userData.action)return obj;obj=obj.parent;}
   // The first solid surface blocks interaction with objects behind it.
   if(!material.transparent||material.opacity>=.5)return null;
  }
  return null;
 }
 function visitObject(object:THREE.Object3D){
  const id=object.userData.action as Action;
  if(id==='chair'){bearController.sitDown();return;}
  if(id==='bear'){$('#bear-status').textContent='点一处空地，带我一起走走吧。';return;}
  const spots:Partial<Record<Action,[number,number,number,number,number,'touch'|'look'|'read'|'sit']>>={
   experience:[-.95,-.55,-2.78,4.26,.5,'look'],projects:[.7,-.24,.3,2.6,-1.65,'sit'],about:[-.95,-.55,-2.64,2.1,.25,'read'],books:[-.95,-.55,-3.2,4.2,-.65,'read'],music:[1.87,-.55,1.8,2.2,-1.8,'look'],games:[1.87,2.10,2.6,.8,1.48,'touch'],shows:[.7,-.24,-1.57,2.6,-1.80,'sit'],objects:[-.2,2.1,-.2,1,2.1,'look'],travel:[-3.1,1.95,-3.8,3.5,2.04,'look'],contact:[2.75,-.72,2.87,2.05,-1.5,'look'],lamp:[-.95,2.10,-2.05,2.1,2.1,'touch']};
  const spot=spots[id];if(!spot)return;
  bearController.interact({position:new THREE.Vector3(spot[0],.3,spot[1]),lookAt:new THREE.Vector3(spot[2],spot[3],spot[4]),pose:spot[5],onArrival:()=>{
   if(id==='lamp')toggleTheme();else if(['books','music','games','shows','objects'].includes(id))renderLife(id,true);else if(id==='travel')openFocused('travel');else openStory(id as Story);
  }});
 }
 function highlight(obj:THREE.Object3D|null){
  if(hovered!==obj){
   hovered=obj;
   const meshes:THREE.Mesh[]=[];
   if(!obj?.userData.ground)obj?.traverseVisible(child=>{if(child instanceof THREE.Mesh&&!child.userData.noOutline)meshes.push(child);});
   outline.selectedObjects=meshes;
  }
  canvas.style.cursor=activePointers.size?'grabbing':obj?.userData.ground?'crosshair':obj?'pointer':'grab';
 }
 canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0&&e.pointerType!=='touch')return;
  if(activePointers.size===0){gestureMoved=false;multiTouch=false;}
  activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(activePointers.size>1)multiTouch=true;
  hoverPointer=null;highlight(null);
 });
 canvas.addEventListener('pointermove',e=>{
  const down=activePointers.get(e.pointerId);
  if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>7)gestureMoved=true;
  if(e.pointerType!=='touch'&&activePointers.size===0){hoverPointer={clientX:e.clientX,clientY:e.clientY};hoverDirty=true;}
 });
 canvas.addEventListener('pointerup',e=>{
  const down=activePointers.get(e.pointerId);
  const clicked=!!down&&!gestureMoved&&!multiTouch&&activePointers.size===1&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<=7;
  activePointers.delete(e.pointerId);
  if(clicked){const object=hit(e);if(object?.userData.ground)bearController.move(pickedPoint.clone());else if(object)visitObject(object);}
  if(e.pointerType!=='touch'){hoverPointer={clientX:e.clientX,clientY:e.clientY};hoverDirty=true;}
  highlight(null);
 });
 canvas.addEventListener('pointercancel',e=>{activePointers.delete(e.pointerId);gestureMoved=true;hoverPointer=null;highlight(null);});
 canvas.addEventListener('pointerleave',()=>{hoverPointer=null;highlight(null);});
 window.addEventListener('blur',()=>{activePointers.clear();gestureMoved=true;hoverPointer=null;highlight(null);});
 dialog.addEventListener('close',()=>{hoverDirty=true;});

 const zoomIn=$<HTMLButtonElement>('#zoom-in'),zoomOut=$<HTMLButtonElement>('#zoom-out');
 function syncZoom(){zoomIn.disabled=camera.zoom>=controls.maxZoom-.001;zoomOut.disabled=camera.zoom<=controls.minZoom+.001;$('#zoom-level').textContent=`${Math.round(camera.zoom*100)}%`;}
 function zoomBy(factor:number){camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,controls.minZoom,controls.maxZoom);camera.updateProjectionMatrix();controls.update();syncZoom();hoverDirty=true;}
 zoomIn.addEventListener('click',()=>zoomBy(1.2));zoomOut.addEventListener('click',()=>zoomBy(1/1.2));
 controls.addEventListener('change',()=>{hoverDirty=true;syncZoom();});
 function resetView(){
  const damping=controls.enableDamping;controls.enableDamping=false;controls.update();controls.reset();controls.enableDamping=damping;
  highlight(null);syncZoom();toast('回到最初的小房间');
 }
 $('#reset-view').addEventListener('click',resetView);
 canvas.addEventListener('keydown',e=>{if(e.key==='+'||e.key==='='){e.preventDefault();zoomBy(1.2);}else if(e.key==='-'){e.preventDefault();zoomBy(1/1.2);}else if(e.key==='0'){e.preventDefault();resetView();}});
 function resize(){const w=stage.clientWidth,h=stage.clientHeight;const aspect=w/h;const extent=innerWidth<=700?8:aspect<.8?7.7:aspect<1.05?6.8:5.7;camera.left=-extent*aspect;camera.right=extent*aspect;camera.top=extent;camera.bottom=-extent;camera.updateProjectionMatrix();renderer.setSize(w,h,false);composer.setSize(w,h);hoverDirty=true;}
 new ResizeObserver(resize).observe(stage);resize();syncZoom();let blend=night?1:0;let lastTime=0;
 renderer.setAnimationLoop((time)=>{
  if(document.hidden||time-lastTime<1000/40)return;
  const dt=lastTime?Math.min((time-lastTime)/1000,.05):.025;lastTime=time;
  if(bearController.update(dt)){renderer.shadowMap.needsUpdate=true;hoverDirty=true;}
  model.room.updateMatrixWorld(true);blend=reduced?(night?1:0):THREE.MathUtils.lerp(blend,night?1:0,.07);
  ambient.intensity=1.8-blend*1.05;sun.intensity=2.4-blend*2.05;fill.intensity=.8-blend*.35;fill.color.set(blend>.5?'#9bbfdf':'#c8ddd5');renderer.toneMappingExposure=1.15-blend*.17;
  model.setNight(night,blend);controls.update();
  if(dialog.open)highlight(null);else if(hoverDirty&&hoverPointer&&activePointers.size===0){highlight(hit(hoverPointer));hoverDirty=false;}
  composer.render();$('#loading').hidden=true;
 });
 if(import.meta.env.DEV)(window as unknown as {roomDebug:unknown}).roomDebug={state:bearController.getState,project:(point:number[])=>{const p=new THREE.Vector3(...point as [number,number,number]).project(camera);const r=canvas.getBoundingClientRect();return {x:r.left+(p.x*.5+.5)*r.width,y:r.top+(-p.y*.5+.5)*r.height};},targets:()=>model.clickable.map(o=>({name:o.name,action:o.userData.action,city:o.userData.city})),hover:()=>hovered?.name??null,objects:()=>model.clickable.map(o=>{const p=new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).project(camera);const r=canvas.getBoundingClientRect();return {name:o.name,action:o.userData.action,x:r.left+(p.x*.5+.5)*r.width,y:r.top+(-p.y*.5+.5)*r.height};})};
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('#fallback').hidden=false;$('#loading').hidden=true;zoomIn.disabled=true;zoomOut.disabled=true;$('#reset-view').setAttribute('disabled','');});canvas.addEventListener('webglcontextrestored',()=>location.reload());
}
try{initRoom();}catch(error){console.error('Room rendering unavailable',error);$('#loading').hidden=true;$('#fallback').hidden=false;for(const id of ['reset-view','zoom-in','zoom-out'])$(`#${id}`).setAttribute('disabled','');}

