import * as T from 'three';
export function createSouvenirMagnet(id:string){
 const group=new T.Group();group.name=`magnet-${id}`;
 const metal=new T.MeshPhysicalMaterial({color:'#d0bc90',metalness:.85,roughness:.25,clearcoat:.7});
 const enamel=(color:string)=>new T.MeshPhysicalMaterial({color,roughness:.23,clearcoat:1,clearcoatRoughness:.2});
 const red=enamel('#b85e53'),blue=enamel('#597d94'),leaf=enamel('#628d71'),white=enamel('#f0e4c8'),pink=enamel('#bf7c9c');
 function shape(points:number[][],material:T.Material,z=.025){const s=new T.Shape(points.map(p=>new T.Vector2(p[0],p[1])));const back=new T.Mesh(new T.ExtrudeGeometry(s,{depth:.025,bevelEnabled:true,bevelSize:.012,bevelThickness:.006,bevelSegments:2}),metal);back.position.z=z;group.add(back);const face=new T.Mesh(new T.ShapeGeometry(s),material);face.scale.set(.94,.94,1);face.position.z=z+.033;group.add(face);return back;}
 function rect(x:number,y:number,w:number,h:number,m:T.Material){return shape([[x-w/2,y],[x+w/2,y],[x+w/2,y+h],[x-w/2,y+h]],m);}
 function line(points:number[][],radius=.012,m:T.Material=metal){const tube=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(p[0],p[1],.076))),20,radius,6,false),m);group.add(tube);}
 function disc(x:number,y:number,r:number,m:T.Material){const pts=[];for(let i=0;i<36;i++)pts.push([x+Math.cos(i/36*Math.PI*2)*r,y+Math.sin(i/36*Math.PI*2)*r]);shape(pts,m,.035);}
 shape([[-.47,-.26],[.47,-.26],[.43,-.18],[-.43,-.18]],blue,0);
 if(id==='tokyo'){rect(-.27,-.19,.045,.49,red);rect(.27,-.19,.045,.49,red);rect(0,.16,.67,.045,red);shape([[-.4,.28],[-.22,.25],[.22,.25],[.4,.28],[.36,.34],[-.36,.34]],red);disc(.37,.49,.06,pink);}
 if(id==='san-francisco'){for(const x of[-.24,.24])rect(x,-.22,.035,.57,red);line([[-.45,.0],[-.24,.33],[0,.02],[.24,.33],[.45,0]],.016,red);line([[-.44,-.07],[.44,-.07]],.025,red);for(let i=-4;i<=4;i++){const x=i*.09;line([[x,-.07],[x,.015+Math.abs(x)*.5]],.005);}}
 if(id==='los-angeles'){line([[0,-.18],[.04,.17],[0,.42]],.029,metal);for(const side of[-1,1]){shape([[0,.42],[side*.24,.58],[side*.38,.40],[side*.15,.44]],leaf);shape([[0,.42],[side*.20,.38],[side*.29,.18],[side*.11,.32]],leaf);}disc(-.3,.52,.10,white);}
 if(id==='new-york'){for(const [x,h]of[[-.34,.28],[-.19,.41],[.17,.52],[.33,.36]])rect(x,-.18,.13,h,blue);shape([[-.06,-.18],[.07,-.18],[.025,.23],[-.025,.23]],leaf);disc(0,.29,.05,leaf);line([[0,.20],[-.12,.37],[-.13,.53]],.025,leaf);disc(-.13,.57,.036,white);line([[.17,.35],[.17,.50]],.012);}
 if(id==='toronto'){rect(-.10,-.18,.034,.79,blue);disc(-.1,.36,.081,white);rect(.19,-.18,.13,.26,red);rect(.35,-.18,.11,.36,blue);line([[-.1,.60],[-.1,.76]],.009);}
 if(id==='san-diego'){shape([[-.35,-.12],[.35,-.12],[.20,-.24],[-.22,-.24]],white);line([[0,-.12],[0,.6]],.012);shape([[-.02,.54],[-.32,-.05],[-.02,-.05]],white);shape([[.04,.34],[.31,-.05],[.04,-.05]],blue);}
 if(id==='singapore'){for(const x of[-.27,0,.27])rect(x,-.19,.09,.43,blue);shape([[-.41,.22],[.41,.28],[.34,.18],[-.32,.15]],white);line([[-.38,-.16],[-.38,.12]],.014,leaf);disc(-.38,.17,.10,leaf);}
 if(id==='shanghai'){rect(-.2,-.18,.025,.84,blue);disc(-.2,.08,.09,pink);disc(-.2,.42,.058,pink);line([[-.2,.48],[-.2,.7]],.008);shape([[.05,-.18],[.19,-.18],[.16,.36],[.07,.33]],blue);rect(.31,-.18,.12,.72,blue);line([[.1,.27],[.15,.28]],.014,white);rect(-.38,-.18,.12,.2,blue);}
 if(id==='berkeley'){rect(0,-.18,.17,.70,white);shape([[-.11,.52],[.11,.52],[0,.71]],white);disc(0,.39,.047,blue);line([[0,.39],[0,.42]],.006);rect(-.28,-.18,.22,.13,red);rect(.28,-.18,.22,.13,red);}
 if(id==='hong-kong'){shape([[-.42,-.18],[-.20,.14],[.08,-.18]],leaf);rect(-.15,-.18,.10,.39,blue);shape([[.04,-.18],[.19,-.18],[.19,.37],[.12,.58],[.04,.37]],blue);line([[.05,.05],[.18,.34],[.05,.34],[.18,.05]],.008,white);rect(.34,-.18,.11,.56,white);}
 group.scale.setScalar(.42);return group;
}
