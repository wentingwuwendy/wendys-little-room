import * as T from 'three';
export type BoxObstacle={x:number;z:number;w:number;d:number};
const STEP=.16,MIN_X=-3.48,MAX_X=3.46,MIN_Z=-2.48,MAX_Z=2.70;
const NX=Math.floor((MAX_X-MIN_X)/STEP)+1,NZ=Math.floor((MAX_Z-MIN_Z)/STEP)+1;
export const obstacles:BoxObstacle[]=[
 {x:.7,z:.8,w:1.52,d:1.35},{x:3.28,z:.28,w:.70,d:.72},{x:2.6,z:1.48,w:.83,d:.83},{x:-2.05,z:2.1,w:.68,d:.68},
 {x:-3.27,z:-.65,w:.83,d:3.4},
 ...[-2.35,.86].flatMap(z=>[-3.58,-2.36].map(x=>({x,z,w:.09,d:.09}))),
 ...[-2.37,-1.28].map(z=>({x:3.22,z,w:.1,d:.1}))
];
export function walkable(x:number,z:number){return x>=MIN_X&&x<=MAX_X&&z>=MIN_Z&&z<=MAX_Z&&!obstacles.some(o=>Math.abs(x-o.x)<o.w/2+.24&&Math.abs(z-o.z)<o.d/2+.24);}
export const dockingPoints=[[-.95,-.55],[-.95,2.10],[1.87,2.10],[1.87,-.55]].map(([x,z])=>new T.Vector3(x,.24,z));
export function clearSegment(a:T.Vector3,b:T.Vector3){const n=Math.ceil(a.distanceTo(b)/.035);for(let i=0;i<=n;i++){const t=n?i/n:0;if(!walkable(T.MathUtils.lerp(a.x,b.x,t),T.MathUtils.lerp(a.z,b.z,t)))return false;}return true;}
function shortestRoute(nodes:T.Vector3[],connected:(a:number,b:number)=>boolean){
 const cost=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),open=new Set(nodes.map((_,i)=>i));cost[0]=0;
 while(open.size){let best=-1;for(const i of open)if(best<0||cost[i]<cost[best])best=i;if(!isFinite(cost[best]))return null;if(best===1){const path=[1];while(previous[path[0]]>=0)path.unshift(previous[path[0]]);return path.slice(1).map(i=>nodes[i].clone());}open.delete(best);for(const i of open){if(!connected(best,i))continue;const d=cost[best]+nodes[best].distanceTo(nodes[i]);if(d<cost[i]){cost[i]=d;previous[i]=best;}}}return null;
}
/** Exact endpoints and long, visible straight segments instead of grid-sized steps. */
export function findStraightPath(start:T.Vector3,end:T.Vector3,visiting=false){
 const a=start.clone().setY(.24),b=end.clone().setY(.24);
 if(clearSegment(a,b))return [b];
 if(visiting){const docks=[a,b,...dockingPoints];const route=shortestRoute(docks,(i,j)=>clearSegment(docks[i],docks[j]));if(route)return route;}
 const corners=obstacles.flatMap(o=>[-1,1].flatMap(dx=>[-1,1].map(dz=>new T.Vector3(o.x+dx*(o.w/2+.27),.24,o.z+dz*(o.d/2+.27))))).filter(p=>walkable(p.x,p.z));
 const nodes=[a,b,...corners];return shortestRoute(nodes,(i,j)=>clearSegment(nodes[i],nodes[j]));
}
const point=(id:number)=>new T.Vector3(MIN_X+(id%NX)*STEP,.24,MIN_Z+Math.floor(id/NX)*STEP);
function nearest(v:T.Vector3){let best=-1,distance=Infinity;for(let id=0;id<NX*NZ;id++){const p=point(id);if(!walkable(p.x,p.z))continue;const d=(v.x-p.x)**2+(v.z-p.z)**2;if(d<distance){best=id;distance=d;}}return best;}
/** A* on a clearance grid; diagonal corner cutting is explicitly forbidden. */
export function findPath(start:T.Vector3,end:T.Vector3){const a=nearest(start),b=nearest(end);if(a<0||b<0)return null;const open=new Set([a]),g=new Map([[a,0]]),previous=new Map<number,number>();
 const heuristic=(id:number)=>point(id).distanceTo(point(b));
 while(open.size){let current=-1,score=Infinity;for(const n of open){const f=g.get(n)!+heuristic(n);if(f<score){current=n;score=f;}}if(current===b){const ids=[b];while(previous.has(ids[0]))ids.unshift(previous.get(ids[0])!);return ids.map(point);}open.delete(current);const x=current%NX,z=Math.floor(current/NX);
 for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dz)continue;const xx=x+dx,zz=z+dz;if(xx<0||xx>=NX||zz<0||zz>=NZ)continue;const n=zz*NX+xx,p=point(n);if(!walkable(p.x,p.z))continue;if(dx&&dz){const p1=point(z*NX+xx),p2=point(zz*NX+x);if(!walkable(p1.x,p1.z)||!walkable(p2.x,p2.z))continue;}const cost=g.get(current)!+Math.hypot(dx,dz)*STEP;if(cost<(g.get(n)??Infinity)){g.set(n,cost);previous.set(n,current);open.add(n);}}
 }return null;
}
export type Visit={position:T.Vector3;lookAt:T.Vector3;pose?:'touch'|'look'|'sit'|'read';onArrival?:()=>void};
export function createBearController(bear:T.Group,room:T.Group,reduced:boolean,onStatus:(s:string)=>void){
 let route:T.Vector3[]=[],visit:Visit|null=null,phase=0,activity='idle',elapsed=0,sit=0,reach=0,wait=0,callback:(()=>void)|undefined;
 const chairPosition=new T.Vector3(.7,1.13,.82),chairEntry=new T.Vector3(.7,.24,-.24);
 const seatedLook=new T.Vector3(.7,1,-3);
 function seatApproach(from:T.Vector3){const dx=from.x-.7,dz=from.z-.82;const t=1/Math.max(Math.abs(dx)/1.04,Math.abs(dz)/.98);return new T.Vector3(.7+dx*t,.24,.82+dz*t);}
 const departurePosition=new T.Vector3();let departureSit=0;
 const marker=new T.Mesh(new T.RingGeometry(.09,.17,40),new T.MeshBasicMaterial({color:'#fff9dc',transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}));marker.rotation.x=-Math.PI/2;marker.userData.noRaycast=true;marker.userData.noOutline=true;room.add(marker);let markerTime=0;
 const pose=bear.userData.setPose as (p:{sit:number;walk:number;phase:number;reach:number;look:number})=>void;
 function face(target:T.Vector3,dt:number){const direction=Math.atan2(target.x-bear.position.x,target.z-bear.position.z);const delta=Math.atan2(Math.sin(direction-bear.rotation.y),Math.cos(direction-bear.rotation.y));bear.rotation.y+=delta*Math.min(1,dt*10);}
 function go(destination:T.Vector3,next:Visit|null){
  const wasSitting=['sitting','seating','leaving'].includes(activity);
  if(wasSitting&&next?.pose==='sit'){seatedLook.copy(next.lookAt);callback=next.onArrival;wait=.12;return true;}
  if(wasSitting)chairEntry.copy(seatApproach(destination));
  if(next?.pose==='sit'){chairEntry.copy(seatApproach(bear.position));destination=chairEntry;seatedLook.copy(next.lookAt);}
  const start=wasSitting?chairEntry:bear.position;
  const path=findStraightPath(start,destination,!!next);if(!path)return false;
  // Cancel the prior destination and its pending action whenever the user chooses again.
  if(wasSitting){departurePosition.copy(bear.position);departureSit=sit;}
  callback=undefined;wait=0;visit=next;route=path;activity=wasSitting?'leaving':'walking';elapsed=0;
  marker.position.set(destination.x,.265,destination.z);markerTime=1.2;onStatus(next?'小熊正在走过去…':'小熊去这里散散步。');
  return true;
 }
 function move(point:T.Vector3){if(!walkable(point.x,point.z)){onStatus('这里放着家具，点旁边的空地试试。');return false;}return go(point,null);}
 function interact(target:Visit){return go(target.position,target);}
 function sitDown(){return interact({position:chairEntry,lookAt:new T.Vector3(.7,1,-3),pose:'sit'});}
 function cancelPending(){callback=undefined;visit=null;wait=0;route=[];if(!['sitting','seating','leaving'].includes(activity)){activity='idle';reach=0;}onStatus('点击地面散步，点击物件一起探索。');}
 function update(dt:number){dt=Math.min(dt,.05);phase+=dt*9;elapsed+=dt;markerTime=Math.max(0,markerTime-dt);(marker.material as T.MeshBasicMaterial).opacity=markerTime*.6;marker.scale.setScalar(1+(1.2-markerTime)*.4);let walking=0;
  if(activity==='leaving'){const t=Math.min(1,elapsed/.6);bear.position.lerpVectors(departurePosition,chairEntry,t);bear.position.y+=Math.sin(t*Math.PI)*.16;sit=departureSit*(1-t);if(t===1){activity='walking';elapsed=0;}}
  else if(activity==='walking'){
   sit=T.MathUtils.damp(sit,0,12,dt);reach=T.MathUtils.damp(reach,0,10,dt);let budget=dt*(reduced?4.8:2.1);walking=1;
   while(route.length&&budget>0){const p=route[0],distance=Math.hypot(p.x-bear.position.x,p.z-bear.position.z);if(distance<budget){face(p,dt);bear.position.set(p.x,.24,p.z);budget-=distance;route.shift();}else{face(p,dt);const r=budget/distance;bear.position.x+=(p.x-bear.position.x)*r;bear.position.z+=(p.z-bear.position.z)*r;bear.position.y=.24;budget=0;}}
   if(!route.length){activity=visit?.pose==='sit'?'seating':visit?'interacting':'idle';elapsed=0;if(activity==='idle')onStatus('到啦。再点一处空地，或选一件喜欢的东西。');}
  }else if(activity==='seating'){
   const t=Math.min(1,elapsed/.7),smooth=t*t*(3-2*t);bear.position.lerpVectors(chairEntry,chairPosition,smooth);bear.position.y+=Math.sin(t*Math.PI)*.19;sit=smooth;face(seatedLook,dt);
   if(t===1){activity='sitting';callback=visit?.onArrival;visit=null;wait=callback?.5:0;onStatus('小熊坐下休息了。点地面就能继续走。');}
  }else if(activity==='interacting'){
   if(visit)face(visit.lookAt,dt);reach=T.MathUtils.damp(reach,visit?.pose==='touch'?1:visit?.pose==='read'?.55:0,10,dt);
   if(elapsed>.8){callback=visit?.onArrival;visit=null;activity='waiting';wait=.2;onStatus('小熊陪你一起看看。');}
  }else if(activity==='waiting'){if(wait>0){wait-=dt;if(wait<=0){const fn=callback;callback=undefined;fn?.();}}}
  else if(activity==='sitting'){face(seatedLook,dt);if(wait>0){wait-=dt;if(wait<=0){const fn=callback;callback=undefined;fn?.();}}}
  else if(activity==='idle')reach=T.MathUtils.damp(reach,0,8,dt);
  pose({sit,walk:reduced?0:walking,phase,reach,look:activity==='interacting'||activity==='waiting'?.25:0});
  bear.userData.state=activity;
  return activity==='walking'||activity==='leaving'||activity==='seating'||activity==='interacting';
 }
 pose({sit:0,walk:0,phase:0,reach:0,look:0});
 return {move,interact,sitDown,update,cancelPending,getState:()=>({activity,position:bear.position.toArray(),route:route.map(p=>p.toArray()),pending:!!visit||!!callback}),chairEntry};
}

