export type RunState = 'ready' | 'running' | 'over';
export type Log = { x:number; width:number; height:number; scored:boolean };

/** Fixed-step simulation: screen pixels, positive jump height, obstacles move left. */
export class Runner {
 state:RunState='ready';
 height=0; velocity=0; elapsed=0; distance=0; score=0;
 logs:Log[]=[];
 private spawnIn=1.6;
 private jumpAt=-Infinity;
 private boosted=false;
 constructor(private random:()=>number=Math.random) {}
 reset() {
  this.state='running';this.height=0;this.velocity=0;this.elapsed=0;
  this.distance=0;this.score=0;this.logs=[];this.spawnIn=1.6;
  this.jumpAt=-Infinity;this.boosted=false;
 }
 jump() {
  if(this.state!=='running')this.reset();
  if(this.height===0){this.velocity=640;this.jumpAt=this.elapsed;this.boosted=false;}
  else if(!this.boosted && this.elapsed-this.jumpAt<=.32){this.velocity=820;this.boosted=true;}
 }
 step(dt:number) {
  if(this.state!=='running')return;
  this.elapsed+=dt;
  const speed=Math.min(410,255+this.elapsed*2.1);
  this.distance+=speed*dt;
  this.velocity-=1900*dt;
  this.height=Math.max(0,this.height+this.velocity*dt);
  if(this.height===0)this.velocity=0;
  this.spawnIn-=dt;
  if(this.spawnIn<=0){
   this.logs.push({x:930,width:26+this.random()*22,height:33+this.random()*36,scored:false});
   this.spawnIn=1.5+this.random()*.9;
  }
  for(const log of this.logs){
   log.x-=speed*dt;
   // Slightly forgiving body bounds exclude the runner's moving hands and toes.
   if(log.x<185 && log.x+log.width>161 && this.height+5<log.height){this.state='over';return;}
   if(!log.scored && log.x+log.width<155){log.scored=true;this.score++;}
  }
  this.logs=this.logs.filter(log=>log.x+log.width>-10);
 }
}

export function drawRunner(c:CanvasRenderingContext2D,game:Runner,best=0) {
 const w=900,h=430,ground=340;
 c.clearRect(0,0,w,h);c.fillStyle='#fff';c.fillRect(0,0,w,h);
 c.fillStyle='#111';c.font='26px "Microsoft YaHei",sans-serif';c.textAlign='left';c.fillText(`得分: ${game.score}`,32,42);
 if(best>0){c.textAlign='right';c.font='18px "Microsoft YaHei",sans-serif';c.fillText(`最高: ${best}`,w-32,40);}
 c.fillRect(0,ground,w,6);
 const logs=game.state==='ready'?[{x:710,width:40,height:68,scored:false}]:game.logs;
 for(const log of logs)c.fillRect(log.x,ground-log.height,log.width,log.height);
 const x=173,y=ground-game.height,phase=game.state==='running'&&game.height===0?Math.sin(game.elapsed*20):.25;
 c.strokeStyle='#111';c.lineWidth=5;c.lineCap='round';c.lineJoin='round';
 c.beginPath();c.arc(x+3,y-55,8,0,Math.PI*2);c.fill();
 c.beginPath();c.moveTo(x+2,y-45);c.lineTo(x-3,y-25);
 c.moveTo(x,y-39);c.lineTo(x+12,y-30+phase*7);c.lineTo(x+18,y-37+phase*7);
 c.moveTo(x,y-39);c.lineTo(x-12,y-36-phase*7);c.lineTo(x-17,y-29-phase*7);
 c.moveTo(x-3,y-25);c.lineTo(x+phase*13,y-13);c.lineTo(x+phase*19+2,y-2);
 c.moveTo(x-3,y-25);c.lineTo(x-phase*13,y-13);c.lineTo(x-phase*19-2,y-2);c.stroke();
 // A small white cap keeps the runner close to the reference silhouette.
 c.fillStyle='#fff';c.strokeStyle='#111';c.lineWidth=1.6;c.beginPath();c.ellipse(x+1,y-62,12,4,-.12,0,Math.PI*2);c.fill();c.stroke();
 if(game.state!=='running'){
  c.fillStyle='#fff';c.fillRect(314,119,272,120);c.textAlign='center';c.fillStyle='#111';c.font='26px "Microsoft YaHei",sans-serif';
  c.fillText(game.state==='ready'?'开始游戏':'游戏结束',450,164);
  c.font='21px "Microsoft YaHei",sans-serif';c.fillText(game.state==='ready'?'▷':'↻ 再来一次',450,207);
 }
}
