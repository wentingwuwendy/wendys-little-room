import * as T from 'three';
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js';

export function createMonstera(){
 const plant=new T.Group();plant.name='monstera-deliciosa';
 const potMat=new T.MeshStandardMaterial({color:'#c5a48a',roughness:.7});
 const profile=[[.23,0],[.25,.025],[.33,.46],[.335,.49],[.30,.50],[.292,.45],[.26,.08]].map(p=>new T.Vector2(...p as [number,number]));
 const pot=new T.Mesh(new T.LatheGeometry(profile,48),potMat);pot.material.side=T.DoubleSide;pot.castShadow=pot.receiveShadow=true;plant.add(pot);
 const soil=new T.Mesh(new T.CylinderGeometry(.294,.294,.02,40),new T.MeshStandardMaterial({color:'#44392b',roughness:1}));soil.position.y=.46;plant.add(soil);
 const stemMat=new T.MeshStandardMaterial({color:'#526f36',roughness:.66});
 const leafMats=['#315d35','#427244','#507d43'].map(color=>new T.MeshPhysicalMaterial({color,roughness:.48,clearcoat:.28,clearcoatRoughness:.45,side:T.DoubleSide}));
 // Deep edge splits plus true interior holes distinguish mature monstera leaves.
 const outline=new T.Shape();outline.moveTo(0,.08);
 outline.bezierCurveTo(.10,-.08,.32,-.02,.42,.18);outline.quadraticCurveTo(.46,.25,.39,.29);outline.lineTo(.12,.25);outline.quadraticCurveTo(.10,.27,.14,.31);outline.lineTo(.47,.36);outline.quadraticCurveTo(.55,.42,.51,.51);outline.lineTo(.16,.43);outline.quadraticCurveTo(.13,.45,.18,.49);outline.lineTo(.51,.59);outline.quadraticCurveTo(.53,.70,.43,.76);outline.lineTo(.16,.61);outline.quadraticCurveTo(.13,.64,.18,.69);outline.lineTo(.39,.84);outline.quadraticCurveTo(.27,1.01,0,1.17);
 outline.quadraticCurveTo(-.27,1.01,-.39,.84);outline.lineTo(-.18,.69);outline.quadraticCurveTo(-.13,.64,-.16,.61);outline.lineTo(-.43,.76);outline.quadraticCurveTo(-.53,.70,-.51,.59);outline.lineTo(-.18,.49);outline.quadraticCurveTo(-.13,.45,-.16,.43);outline.lineTo(-.51,.51);outline.quadraticCurveTo(-.55,.42,-.47,.36);outline.lineTo(-.14,.31);outline.quadraticCurveTo(-.10,.27,-.12,.25);outline.lineTo(-.39,.29);outline.quadraticCurveTo(-.46,.25,-.42,.18);outline.bezierCurveTo(-.32,-.02,-.10,-.08,0,.08);
 for(const side of [-1,1])for(const [x,y,rx,ry]of [[.23,.16,.045,.065],[.075,.53,.025,.058],[.07,.78,.021,.05]]){const hole=new T.Path();hole.absellipse(x*side,y,rx,ry,0,Math.PI*2,true,side*.35);outline.holes.push(hole);}
 const geometry=new TessellateModifier(.09,4).modify(new T.ShapeGeometry(outline,20));const pos=geometry.getAttribute('position');
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);pos.setZ(i,.15*Math.sin(y*2.7)-.22*x*x+.018*Math.sin(y*24)*Math.abs(x));}geometry.computeVertexNormals();
 const leaves=[[-.34,1.10,.12,.20,-.22,.88],[.25,1.42,-.20,.65,-.12,.82],[.42,.78,.26,1.04,-.65,.72],[-.38,.68,.34,-.38,-.55,.64],[.01,.96,-.19,2.5,-.25,.60]];
 leaves.forEach(([x,y,z,turn,tilt,size],i)=>{
  const end=new T.Vector3(x,y,z),curve=new T.CatmullRomCurve3([new T.Vector3((i%2-.5)*.08,.44,0),new T.Vector3(x*.5,y*.63,z*.55),end]);
  const stem=new T.Mesh(new T.TubeGeometry(curve,20,.012,8,false),stemMat);stem.castShadow=true;plant.add(stem);
  const group=new T.Group();group.position.copy(end);group.rotation.set(tilt,turn,(i%2?1:-1)*.22);group.scale.setScalar(size);plant.add(group);
  const leaf=new T.Mesh(geometry,leafMats[i%3]);leaf.castShadow=leaf.receiveShadow=true;group.add(leaf);
  const vein=new T.CatmullRomCurve3([new T.Vector3(0,.08,.04),new T.Vector3(0,.55,.155),new T.Vector3(0,1.12,.037)]);
  group.add(new T.Mesh(new T.TubeGeometry(vein,20,.006,5,false),stemMat));
 });
 return plant;
}
