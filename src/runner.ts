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
 const w=900,h=430,ground=334;
 c.clearRect(0,0,w,h);c.fillStyle='#f4f0e5';c.fillRect(0,0,w,h);
 c.fillStyle='#737966';c.font='16px monospace';c.textAlign='left';c.fillText('WENDY / POCKET RUN',33,37);
 c.textAlign='right';c.fillText(`HI ${String(best).padStart(3,'0')}   ${String(game.score).padStart(3,'0')}`,w-33,37);
 // Quiet, continuous scenery makes the forward motion legible.
 c.strokeStyle='#d9ddce';c.lineWidth=2;
 for(let i=0;i<5;i++){
  const x=((i*227-game.distance*.17)%1135+1135)%1135-110;
  c.beginPath();c.moveTo(x,230);c.quadraticCurveTo(x+55,150,x+120,230);c.quadraticCurveTo(x+155,190,x+197,230);c.stroke();
 }
 c.strokeStyle='#8b947a';c.lineWidth=2;c.beginPath();c.moveTo(0,ground);c.lineTo(w,ground);c.stroke();
 c.fillStyle='#c4c9b6';
 for(let i=0;i<22;i++){const x=((i*49-game.distance)%1078+1078)%1078-50;c.fillRect(x,ground+14+(i%3)*8,8+(i%4)*4,2);}
 const logs=game.state==='ready'?[{x:660,width:37,height:52,scored:false}]:game.logs;
 for(const log of logs){
  c.fillStyle='#ae825d';c.strokeStyle='#755f49';c.lineWidth=2.5;
  c.beginPath();c.roundRect(log.x,ground-log.height,log.width,log.height,4);c.fill();c.stroke();
  c.fillStyle='#dbc39e';c.beginPath();c.ellipse(log.x+log.width/2,ground-log.height+3,log.width/2,6,0,0,Math.PI*2);c.fill();c.stroke();
  c.strokeStyle='#866647';c.lineWidth=1.8;
  for(let j=1;j<=2;j++){c.beginPath();c.moveTo(log.x+j*log.width/3,ground-log.height+14);c.lineTo(log.x+j*log.width/3-2,ground-5);c.stroke();}
 }
 const x=173,y=ground-game.height,phase=game.state==='running'&&game.height===0?Math.sin(game.elapsed*19):.15;
 c.fillStyle='#67745222';c.beginPath();c.ellipse(x,ground+2,22-game.height*.035,4,0,0,Math.PI*2);c.fill();
 c.strokeStyle=game.state==='over'?'#ac6857':'#465940';c.fillStyle=c.strokeStyle;c.lineWidth=5.2;c.lineCap='round';c.lineJoin='round';
 c.beginPath();c.arc(x+2,y-66,10,0,Math.PI*2);c.stroke();
 c.beginPath();c.moveTo(x+2,y-55);c.lineTo(x-3,y-29);
 c.moveTo(x,y-47);c.lineTo(x+15,y-37+phase*8);c.lineTo(x+23,y-44+phase*8);
 c.moveTo(x,y-46);c.lineTo(x-16,y-43-phase*8);c.lineTo(x-21,y-34-phase*8);
 c.moveTo(x-3,y-29);c.lineTo(x+phase*17,y-14);c.lineTo(x+phase*22+3,y-2);
 c.moveTo(x-3,y-29);c.lineTo(x-phase*17,y-14);c.lineTo(x-phase*22-3,y-2);c.stroke();
 if(game.state!=='running'){
  c.fillStyle='#f4f0e5ed';c.fillRect(276,102,352,140);
  c.textAlign='center';c.fillStyle='#465940';c.font='27px "Microsoft YaHei",sans-serif';
  c.fillText(game.state==='ready'?'木桩漫游':'游戏结束',452,145);
  c.fillStyle='#657750';c.beginPath();c.roundRect(363,172,178,48,24);c.fill();
  c.fillStyle='#fffaf0';c.font='19px "Microsoft YaHei",sans-serif';c.fillText(game.state==='ready'?'开始游戏  ▷':'再跑一次  ↻',452,204);
 }
}
