import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {nodes, edges} from './graph.js';

// Every destination threshold and route uses graph.js coordinates. The surrounding
// architecture is a representative mall reconstruction, not a surveyed venue.
const P=(x,z,y=0)=>new THREE.Vector3((x-460)/10,y,(z-280)/10);
const GREEN=0x216754;
let savedCamera=null;
const roomSets={
  1:[
    {name:'H&M',id:'hm',x:130,z:319,w:94,d:124,front:'east',tone:0xded8cd,kind:'fashion',code:'01'},
    {name:'STUDIO LANE',x:62,z:60,w:145,d:184,front:'east',tone:0xd7c3a7,kind:'fashion',code:'02'},
    {name:'MARKET & CO.',x:295,z:337,w:135,d:108,front:'south',tone:0xd2c3ad,kind:'home',code:'03'},
    {name:'EVERYDAY GOODS',x:493,z:337,w:175,d:108,front:'south',tone:0xc7cbbd,kind:'home',code:'04'},
    {name:'MELLOW',id:'cafe',x:737,z:319,w:130,d:125,front:'west',tone:0xc9b290,kind:'cafe',code:'05'},
    {name:'FOOD HALL',x:739,z:59,w:127,d:184,front:'west',tone:0xc8bda8,kind:'cafe',code:'06'},
    {name:'WC',id:'restroom1',x:798,z:250,w:68,d:60,front:'west',tone:0xc5cbbd,kind:'wc',code:'WC'}
  ],
  2:[
    {name:'BOOK GARDEN',id:'books',x:62,z:332,w:162,d:111,front:'east',tone:0xc7b68f,kind:'books',code:'11'},
    {name:'DESIGN STUDIO',x:62,z:60,w:145,d:184,front:'east',tone:0xc7c5b9,kind:'home',code:'12'},
    {name:'CINESPACE',id:'cinema',x:497,z:52,w:370,d:50,front:'south',tone:0x51575b,kind:'cinema',code:'13'},
    {name:'GALLERY',x:493,z:337,w:175,d:108,front:'south',tone:0xd9d2c2,kind:'gallery',code:'14'},
    {name:'LITTLE EXPLORERS',id:'play',x:737,z:332,w:130,d:112,front:'west',tone:0xd3b68f,kind:'play',code:'15'},
    {name:'WC',id:'restroom2',x:798,z:250,w:68,d:60,front:'west',tone:0xc5cbbd,kind:'wc',code:'WC'}
  ]
};
const threshold=r=>r.front==='south'?{x:r.id?nodes[r.id].x:r.x+r.w/2,y:r.z+r.d}:r.front==='east'?{x:r.x+r.w,y:r.id?nodes[r.id].y:r.z+r.d/2}:{x:r.x,y:r.id?nodes[r.id].y:r.z+r.d/2};
const entryPoints=Object.fromEntries([1,2].flatMap(f=>roomSets[f].filter(r=>r.id).map(r=>[r.id,{...threshold(r),f}])));entryPoints.info={x:100,y:400,f:1};
export const sceneLayout={
  unitsPerMetre:5,
  floors:Object.fromEntries([1,2].map(f=>[f,{
    rooms:roomSets[f].map(r=>({id:r.id||null,name:r.name,x:r.x,y:r.z,width:r.w,depth:r.d,front:r.front,door:r.id?threshold(r):null,approach:r.id?{x:nodes[r.id].x,y:nodes[r.id].y}:null})),
    lightWells:f===2?[{x:300,y:178,width:120,depth:57},{x:505,y:178,width:145,depth:57},{x:432,y:75,width:56,depth:50}]:[],
    lift:{x:250,y:130},stairs:{x:460,y:130},information:f===1?{door:{x:100,y:400},approach:{x:100,y:410}}:null
  }]))
};

function fallback(host,o){
  host.dataset.state='fallback';const rooms=roomSets[o.floor],svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg');svg.classList.add('scene-fallback');svg.setAttribute('viewBox','0 0 920 570');svg.setAttribute('aria-label',`Level ${o.floor} floor plan`);
  const item=(tag,attrs,text)=>{const e=document.createElementNS(svgNS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;svg.append(e);return e;};
  item('rect',{x:40,y:40,width:840,height:480,fill:'#f9f7ef',stroke:'#a6a494','stroke-width':3});
  for(const r of rooms){const g=item('rect',{x:r.x,y:r.z,width:r.w,height:r.d,fill:'#ded8c8',stroke:'#a9a18e','stroke-width':2});if(r.id){g.setAttribute('tabindex','0');g.setAttribute('role','button');g.setAttribute('aria-label',`Route to ${r.name}`);g.addEventListener('click',()=>o.onSelect?.(r.id));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')o.onSelect?.(r.id);});}item('text',{x:r.x+r.w/2,y:r.z+r.d/2,'text-anchor':'middle','font-size':13,fill:'#3c4639'},r.name);}
  for(const s of o.route?.segments||[]){const a=nodes[s.from],b=nodes[s.to];if(a.f===o.floor&&b.f===o.floor)item('path',{d:`M${a.x},${a.y}L${b.x},${b.y}`,stroke:'#216754','stroke-width':7,fill:'none','stroke-linecap':'round'});}
  const n=nodes[o.current||o.start];if(n?.f===o.floor)item('circle',{cx:n.x,cy:n.y,r:9,fill:'#216754',stroke:'white','stroke-width':4});
  item('text',{x:60,y:500,'font-size':12,fill:'#626b5b'},'Plan view · 3D graphics unavailable in this browser');host.replaceChildren(svg);
  return {dispose(){},zoom(){},reset(){},setView(){},rotate(){}};
}

export function mountMallScene(host,options={}){
  const o={floor:1,start:'entrance',destination:null,screen:'map',step:0,...options};
  host.classList.add('scene-host');
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e9e7e0');
  const resources=new Set(),objects=[],labels=[];
  let dirty=true;let buildGroup=null;
  const own=r=>(resources.add(r),r);
  let renderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch{return fallback(host,o);}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
  const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Interactive three dimensional Level ${o.floor} mall. Drag to orbit, scroll to zoom, right drag to pan. Store labels are keyboard accessible.`);
  const overlay=document.createElement('div');overlay.className='scene-labels';
  const leaders=document.createElementNS('http://www.w3.org/2000/svg','svg');leaders.classList.add('scene-label-leaders');leaders.setAttribute('aria-hidden','true');overlay.append(leaders);
  host.replaceChildren(canvas,overlay);
  const compass=document.createElement('span');compass.className='scene-compass';compass.setAttribute('aria-label','North');compass.innerHTML='<b>N</b><span>↑</span>';host.append(compass);
  const camera=new THREE.OrthographicCamera(-60,60,40,-40,.1,500);
  const controls=new OrbitControls(camera,canvas);controls.addEventListener('change',()=>{dirty=true;});controls.enableDamping=true;controls.dampingFactor=.12;controls.minZoom=.55;controls.maxZoom=3.6;controls.maxPolarAngle=Math.PI*.44;controls.minPolarAngle=0;controls.screenSpacePanning=true;controls.panSpeed=.7;controls.rotateSpeed=.55;controls.zoomSpeed=.8;
  let mode=savedCamera?.mode||'3d';
  const setDefault=()=>{camera.position.set(64,84,91);controls.target.set(0,0,1);camera.zoom=1;camera.updateProjectionMatrix();controls.update();};
  setDefault();
  if(savedCamera){camera.position.fromArray(savedCamera.position);controls.target.fromArray(savedCamera.target);camera.zoom=savedCamera.zoom;camera.updateProjectionMatrix();controls.enableRotate=mode!=='plan';controls.update();}
  scene.add(new THREE.HemisphereLight(0xfffaf0,0x8d9284,1.8));
  const sun=new THREE.DirectionalLight(0xfff3dc,2.7);sun.position.set(-24,70,-30);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-70,right:70,top:55,bottom:-55,near:1,far:150});sun.shadow.normalBias=.025;sun.shadow.bias=-.0002;sun.shadow.radius=3;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xf2f6ff,.65);fill.position.set(40,30,50);scene.add(fill);
  const mat=(color,extra={})=>own(new THREE.MeshStandardMaterial({color,roughness:.78,...extra}));
  const stone=mat(0xd8d2c2),wall=mat(0xe4ddce),cap=mat(0xf9f5e9),wood=mat(0x96734e),dark=mat(0x565c52),metal=mat(0x6d7569,{metalness:.65,roughness:.35}),soil=mat(0x605947),leaf=mat(0x708262),leafLight=mat(0x8c9b74),green=own(new THREE.MeshBasicMaterial({color:GREEN,toneMapped:false})),glass=mat(0xc1d9d1,{transparent:true,opacity:.29,roughness:.2,metalness:.08,depthWrite:false}),floor=mat(0xf8f4e9),grout=mat(0xbab5a6);
  const loader=new THREE.TextureLoader();
  const texturePaths=['limestone-color.jpg','limestone-normal.jpg','limestone-rough.jpg'];
  const maps=texturePaths.map((name,i)=>{const t=own(loader.load('./assets/materials/'+name,()=>{dirty=true;}));t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(10.5,6);t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);if(!i)t.colorSpace=THREE.SRGBColorSpace;return t;});
  floor.map=maps[0];floor.normalMap=maps[1];floor.normalScale.set(.22,.22);floor.roughnessMap=maps[2];floor.needsUpdate=true;
  const unitBox=own(new THREE.BoxGeometry(1,1,1)),cylinderGeo=own(new THREE.CylinderGeometry(1,1,1,16)),ballGeo=own(new THREE.IcosahedronGeometry(1,1));
  const mesh=(g,m,pos,scale,shadow=true)=>{const e=new THREE.Mesh(g,m);e.position.copy(pos);if(scale)e.scale.set(...scale);e.castShadow=shadow;e.receiveShadow=true;(buildGroup||scene).add(e);return e;};
  const box=(x,z,w,d,h,m,y=0,shadow=true)=>mesh(unitBox,m,P(x,z,y+h/2),[w/10,h,d/10],shadow);
  const cyl=(x,z,r,h,m,y=0)=>mesh(cylinderGeo,m,P(x,z,y+h/2),[r/10,h,r/10]);
  function strip(x1,z1,x2,z2,width,h,m,y=0){const a=P(x1,z1),b=P(x2,z2),len=a.distanceTo(b),e=mesh(unitBox,m,a.clone().add(b).multiplyScalar(.5).add(new THREE.Vector3(0,y+h/2,0)),[width/10,h,len]);e.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);return e;}
  function bar(a,b,r,m){const delta=b.clone().sub(a),g=own(new THREE.CylinderGeometry(r,r,delta.length(),8));const e=mesh(g,m,a.clone().add(b).multiplyScalar(.5));e.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return e;}
  function tree(x,z,scale=1){cyl(x,z,5.5*scale,.65,stone);cyl(x,z,4.8*scale,.08,soil,.65);cyl(x,z,1.1*scale,2.4*scale,wood,.7);for(const [dx,dz,dy,r] of [[0,0,3.5,1.6],[.9,.1,3.3,1.1],[-.8,.2,3.2,1.2],[.2,-.7,3.9,1.1]]){const e=mesh(ballGeo,dy>3.4?leafLight:leaf,P(x+dx*10*scale,z+dz*10*scale,dy*scale),[r*scale,r*.84*scale,r*scale]);e.rotation.y=x+z;}}
  function bench(x,z,angle=0){const group=new THREE.Group();scene.add(group);group.position.copy(P(x,z));group.rotation.y=angle;for(let i=0;i<5;i++){const e=new THREE.Mesh(unitBox,wood);e.position.set(0,.56,(i-2)*.17);e.scale.set(3.2,.1,.13);e.castShadow=true;group.add(e);}for(const dx of [-1.1,1.1]){const e=new THREE.Mesh(unitBox,metal);e.position.set(dx,.25,0);e.scale.set(.16,.5,.8);group.add(e);}return group;}
  function table(x,z,r=6){cyl(x,z,r,.12,wood,.85);cyl(x,z,.7,.8,dark,.05);cyl(x,z,r*.48,.07,dark);for(const a of [0,Math.PI]){const cx=x+Math.cos(a)*(r+4),cz=z+Math.sin(a)*(r+4);cyl(cx,cz,2.8,.12,wood,.47);box(cx,cz,.6,.6,.45,metal);const b=box(cx+Math.cos(a)*2.6,cz+Math.sin(a)*2.6,1,5,.48,wood,.56);b.rotation.y=-a;}}
  function label(text,x,z,y,{id=null,code='',kind='',priority=1,current=false}={}){
    const el=document.createElement(id?'button':'span');el.className=id?'scene-poi':'scene-static-label'+(current?' is-current':'');
    if(id){el.type='button';el.dataset.place=id;el.dataset.kind=kind;el.setAttribute('aria-label',`Plan route to ${text}`);if(id===o.destination&&o.route)el.classList.add('is-destination');const badge=document.createElement('span');badge.className='poi-code';badge.textContent=code;el.append(badge);const txt=document.createElement('span');txt.textContent=text;el.append(txt);el.addEventListener('click',()=>o.onSelect?.(id));}else el.textContent=text;
    let leader=null;if(id){leader=document.createElementNS('http://www.w3.org/2000/svg','line');leader.setAttribute('stroke','#7d8272');leader.setAttribute('stroke-width','1');leader.setAttribute('stroke-opacity','.7');leaders.append(leader);}
    overlay.append(el);labels.push({el,leader,position:P(x,z,y),priority:current?100:id===o.destination&&o.route?90:id?50:priority,id});return el;
  }
  function sign(text,w=512,bg='#e7dfcf',fg='#373d32'){
    const c=document.createElement('canvas');c.width=w;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,w,96);ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`500 ${text.length>14?24:34}px Arial`;ctx.fillText(text,w/2,50,w-25);const t=own(new THREE.CanvasTexture(c));t.colorSpace=THREE.SRGBColorSpace;return own(new THREE.MeshBasicMaterial({map:t,toneMapped:false}));
  }
  function wallSign(text,x,z,width,height,face='south',bg,fg){const m=sign(text,512,bg,fg),g=own(new THREE.PlaneGeometry(width,height)),e=mesh(g,m,P(x,z,2.25),null,false);e.rotation.y=face==='east'?Math.PI/2:face==='west'?-Math.PI/2:0;return e;}
  // A thick, exposed perimeter slab gives the floor the physical scale of a
  // cutaway building; walkways remain at y=0 on both displayed levels.
  const shape=new THREE.Shape();shape.moveTo(-42,-24);shape.lineTo(42,-24);shape.lineTo(42,24);shape.lineTo(-42,24);shape.closePath();
  const wells=[{x:300,z:178,w:120,d:57},{x:505,z:178,w:145,d:57}];
  if(o.floor===2)for(const r of [...wells,{x:432,z:75,w:56,d:50}]){const hole=new THREE.Path();const x=(r.x-460)/10,z=(r.z-280)/10;hole.moveTo(x,z);hole.lineTo(x,z+r.d/10);hole.lineTo(x+r.w/10,z+r.d/10);hole.lineTo(x+r.w/10,z);hole.closePath();shape.holes.push(hole);}
  const slabGeometry=own(new THREE.ExtrudeGeometry(shape,{depth:.9,bevelEnabled:false,steps:1}));slabGeometry.rotateX(Math.PI/2);mesh(slabGeometry,stone,new THREE.Vector3(0,-.04,0));
  for(const [x,z,w,d] of [[460,40,848,4],[460,520,848,4],[40,280,4,480],[880,280,4,480]])box(x,z,w,d,.15,cap,-1.08);
  const fg=own(new THREE.ShapeGeometry(shape));const uv=fg.getAttribute('uv'),position=fg.getAttribute('position');for(let i=0;i<uv.count;i++)uv.setXY(i,(position.getX(i)+42)/84,(position.getY(i)+24)/48);fg.rotateX(Math.PI/2);const floorMesh=mesh(fg,floor,new THREE.Vector3(0,-.015,0),null,false);floorMesh.material.side=THREE.DoubleSide;
  // Architectural inlay follows the actual public circulation network.
  for(const z of [280,470]){strip(58,z-18,866,z-18,1.1,.012,grout,.004);strip(58,z+18,866,z+18,1.1,.012,grout,.004);}
  for(const x of [250,460,710]){strip(x-18,126,x-18,470,.8,.012,grout,.004);strip(x+18,126,x+18,470,.8,.012,grout,.004);}
  if(o.floor===2){strip(250,112,710,112,1,.012,grout);strip(250,148,710,148,1,.012,grout);}
  // Low perimeter parapets: full height at the back, cut down toward the camera.
  box(460,42,842,3,2.4,wall);box(460,42,844,4,.12,cap,2.4);box(41,280,3,478,1.3,wall);box(879,280,3,478,1.3,wall);
  for(const [x,w] of [[63,43],[505,746]]){box(x,519,w,3,.38,wall);box(x,519,w+1,4,.08,cap,.38);}
  // Recessed public courtyard/light wells sit either side of the central bridge.
  for(const r of wells){const cx=r.x+r.w/2,cz=r.z+r.d/2;
    if(o.floor===1){box(cx,cz,r.w,r.d,.14,stone);box(cx,cz,r.w-9,r.d-9,.08,soil,.14);for(let i=0;i<4;i++){tree(r.x+15+i*(r.w-30)/3,cz, .62);}}
    else {box(cx,cz,r.w,r.d,.18,mat(0x8d9682),-3.6);for(const [dx,dz] of [[0,-r.d/2],[0,r.d/2]]){strip(r.x,cz+dz,r.x+r.w,cz+dz,.8,.08,metal,1.05);strip(r.x,cz+dz,r.x+r.w,cz+dz,.7,.04,metal,.13);for(let x=r.x;x<=r.x+r.w;x+=20)cyl(x,cz+dz,.45,1.05,metal);box(cx,cz+dz,r.w,.4,.86,glass,.15);}for(const x of [r.x,r.x+r.w]){strip(x,r.z,x,r.z+r.d,.8,.08,metal,1.05);box(x,cz,.4,r.d,.86,glass,.15);for(let z=r.z;z<=r.z+r.d;z+=20)cyl(x,z,.45,1.05,metal);}const treeStart=scene.children.length;tree(cx,cz,.55);for(const e of scene.children.slice(treeStart))e.position.y-=3.6;}
  }
  function room(r){
    const group=new THREE.Group();group.userData.placeId=r.id||null;scene.add(group);buildGroup=group;
    const cx=r.x+r.w/2,cz=r.z+r.d/2,roomFloor=mat(r.kind==='cinema'?0x888c86:r.tone,{roughness:.92});
    box(cx,cz,r.w,r.d,.045,roomFloor,.008,false);
    const frontAxis=r.front==='south'?'z':'x',front=r.front==='south'?r.z+r.d:r.front==='east'?r.x+r.w:r.x;
    // Three walls and a deliberately open store threshold. The fourth wall is
    // a glazed fascia with real door gaps at the graph destination.
    if(frontAxis==='z'){box(r.x,cz,2,r.d,2.5,wall);box(r.x+r.w,cz,2,r.d,2.5,wall);box(cx,r.z,r.w,2,2.5,wall);}
    else{box(cx,r.z,r.w,2,2.5,wall);box(cx,r.z+r.d,r.w,2,2.5,wall);box(r.front==='east'?r.x:r.x+r.w,cz,2,r.d,2.5,wall);}
    const wm=r.kind==='cinema'?dark:wood;
    if(frontAxis==='z'){
      const door=r.id?nodes[r.id].x:cx;
      for(const [a,b] of [[r.x,door-12],[door+12,r.x+r.w]]){if(b<=a)continue;box((a+b)/2,front,b-a,1.2,1.75,glass);box((a+b)/2,front,b-a,1.5,.12,wm);for(let x=a;x<=b;x+=20)box(x,front,.8,1.4,2.15,metal);}
      box(cx,front,r.w,2.7,.52,wm,2.0);box(cx,front,r.w,3,.08,cap,2.52);wallSign(r.name,cx,front+1.5,Math.min(13,r.w/10-1),.49,'south',r.kind==='cinema'?'#414942':'#e5d8bc',r.kind==='cinema'?'#fff5d8':'#344133');
    }else{
      const door=r.id?nodes[r.id].y:cz;
      for(const [a,b] of [[r.z,door-12],[door+12,r.z+r.d]]){if(b<=a)continue;box(front,(a+b)/2,1.2,b-a,1.75,glass);box(front,(a+b)/2,1.5,b-a,.12,wm);for(let z=a;z<=b;z+=20)box(front,z,1.4,.8,2.15,metal);}
      box(front,cz,2.7,r.d,.52,wm,2.0);box(front,cz,3,r.d,.08,cap,2.52);wallSign(r.name,front+(r.front==='east'?1.5:-1.5),cz,Math.min(11,r.d/10-1),.49,r.front);
    }
    // Fine wall cap profiles, columns, lighting strips and timber thresholds.
    for(const x of [r.x,r.x+r.w])for(const z of [r.z,r.z+r.d])box(x,z,3,3,2.62,cap);
    if(r.id){const n=nodes[r.id];if(frontAxis==='z')box(n.x,front,22,3,.04,wm,.04);else box(front,n.y,3,22,.04,wm,.04);}
    // Furniture is materially and spatially specific to each store.
    if(r.kind==='cafe'){for(let i=0;i<2;i++)for(let j=0;j<3;j++)table(r.x+29+i*55,r.z+28+j*(r.d-50)/2,5);box(cx,r.z+12,r.w-24,14,1.1,wood);box(cx,r.z+12,r.w-22,15,.08,cap,1.1);for(let x=r.x+25;x<r.x+r.w-15;x+=22)cyl(x,r.z+12,1.2,.28,green,1.18);}
    else if(r.kind==='books'){for(let i=0;i<4;i++){const bx=r.x+25+i*35;box(bx,cz,7,r.d-28,1.35,wood);for(let j=0;j<12;j++){const bookMat=mat([0x8d7560,0xbba681,0x7f9188,0xd0bc91,0x9a8673][j%5]);box(bx,cz-r.d/2+20+j*(r.d-35)/12,7.5,3,.38,bookMat,1.35);}}box(r.x+r.w-18,r.z+12,25,12,.8,wood);}
    else if(r.kind==='fashion'){for(let j=0;j<3;j++){const zz=r.z+25+j*(r.d-50)/2;box(cx,zz,r.w-40,6,.78,wood);box(cx,zz,r.w-38,7,.08,cap,.78);for(let k=0;k<5;k++)box(cx-r.w/3+k*r.w/7,zz,8,6,.08,mat([0xb8b9ae,0xeee7d9,0x7c8a7b,0xa68b71,0xc6b39a][k]),.88);}for(let j=0;j<3;j++){const z=r.z+25+j*40;bar(P(r.x+10,z,.4),P(r.x+10,z,1.6),.04,metal);bar(P(r.x+10,z,1.6),P(r.x+10,z+24,1.6),.04,metal);for(let k=0;k<6;k++)box(r.x+10,z+k*4,5,1,.6,mat(k%2?0xb3aa95:0xd9cfbd),.9);}}
    else if(r.kind==='cinema'){for(let i=0;i<3;i++){box(r.x+30+i*70,r.z+21,44,25,.75,dark);for(let k=0;k<3;k++)box(r.x+15+i*70+k*13,r.z+30,10,10,.48,mat(0x9a7358),.75);}for(let j=0;j<4;j++){const x=r.x+245+j*28;box(x,cz,16,25,1.7,dark);wallSign(String(j+1),x,r.z+r.d+1,1,.5,'south','#484f49','#f0d9a8');}}
    else if(r.kind==='play'){for(const [dx,dz,color] of [[25,30,0xc7a05e],[68,28,0x8b9d88],[45,67,0xb67e5c]]){box(r.x+dx,r.z+dz,25,25,.12,mat(0xdbb485));cyl(r.x+dx,r.z+dz,7,1.0,mat(color));}box(r.x+r.w-20,r.z+30,18,32,1.2,wood);}
    else if(r.kind==='wc'){box(r.x+r.w-12,cz,20,r.d-10,1.4,wall);for(let i=0;i<3;i++)box(r.x+15+i*15,r.z+8,11,9,.8,cap);}
    else{for(let j=0;j<2;j++)for(let i=0;i<3;i++){const x=r.x+25+i*(r.w-50)/2,z=r.z+25+j*(r.d-50);box(x,z,19,15,.65,wood);box(x,z,20,16,.07,cap,.65);if(r.kind==='gallery'){box(x,z,9,9,.8,stone,.72);cyl(x,z,4,.45,wood,1.52);}else{cyl(x,z,3,.35,mat(0xa3a58a),.72);box(x+5,z,5,5,.25,stone,.72);}}}
    if(r.id){const kind=r.kind==='cafe'?'food':['cinema','play'].includes(r.kind)?'leisure':r.kind==='wc'?'facility':'shopping';const node=nodes[r.id];label(r.name==='MELLOW'?'Mellow Coffee':r.name==='WC'?'Restrooms':r.name==='H&M'?'H&M':r.name==='CINESPACE'?'CineSpace':r.name==='BOOK GARDEN'?'Book Garden':'Little Explorers',r.kind==='cinema'?node.x:cx,r.kind==='cinema'?r.z+18:cz,2.95,{id:r.id,code:r.code,kind,priority:15});objects.push({r,group});}
    buildGroup=null;
  }
  roomSets[o.floor].forEach(room);
  // Lift core: a recessed door at the exact lift node, with shaft glazing,
  // stainless surround, call panel and illuminated floor number.
  box(250,90,43,44,3.5,wall);box(250,112,27,1.3,2.6,metal);box(243,112.8,12,1,2.4,mat(0xa8b0a5,{metalness:.75,roughness:.25}));box(257,112.8,12,1,2.4,mat(0xa8b0a5,{metalness:.75,roughness:.25}));box(250,113.7,.55,.5,2.4,dark);box(269,114,2.2,1,.5,dark,1.1);cyl(269,114, .5,.02,green,1.4);wallSign('LIFT  ·  L'+o.floor,250,114,3.5,.4,'south','#c9cebd','#3d493b');
  label('West lift',250,100,4,{priority:7});
  // Twin-flight stair assembly, including individual treads, side stringers,
  // central landing, vertical guard posts and continuous handrails.
  const stairX=460,stairZ=100,stairStart=scene.children.length;
  box(stairX,stairZ,55,60,.12,stone);
  for(let i=0;i<12;i++){const z=stairZ+24-i*3.4;box(stairX-12,z,19,3.6,(i+1)*.14,cap);box(stairX+12,stairZ-18+i*3.4,19,3.6,1.68+(i+1)*.14,cap);}
  box(stairX,stairZ-20,43,11,.2,stone,1.6);
  for(const x of [stairX-22,stairX-2]){bar(P(x,stairZ+26,1),P(x,stairZ-15,2.68),.06,metal);for(let i=0;i<5;i++)bar(P(x,stairZ+24-i*10,i*.41),P(x,stairZ+24-i*10,1+i*.41),.035,metal);}
  for(const x of [stairX+2,stairX+22])bar(P(x,stairZ-15,2.68),P(x,stairZ+26,4.36),.06,metal);
  if(o.floor===2){for(const e of scene.children.slice(stairStart))e.position.y-=3.36;for(const x of [432,488]){strip(x,75,x,125,.8,.08,metal,1.05);box(x,100,.4,50,.86,glass,.15);for(let z=75;z<=125;z+=20)cyl(x,z,.45,1.05,metal);}strip(432,75,488,75,.8,.08,metal,1.05);box(460,75,56,.4,.86,glass,.15);}
  label('Atrium stairs',460,98,o.floor===2?1.5:4.7,{priority:8});
  // The ground-floor information point opens directly onto the entrance path.
  if(o.floor===1){const infoGroup=new THREE.Group();infoGroup.userData.placeId='info';scene.add(infoGroup);buildGroup=infoGroup;box(100,391,31,15,1.05,wood);box(100,391,32,16,.1,cap,1.05);box(105,391,5,3,.3,dark,1.15);cyl(89,392,2,.32,leaf,1.15);buildGroup=null;label('Information',100,387,2,{id:'info',code:'i',kind:'facility',priority:14});
    strip(83,517,117,517,1,.06,metal);for(const x of [82,118])box(x,510,1,16,2.2,metal);box(100,502,34,1,.18,wood,2.2);label('South entrance',101,510,.1,{priority:30});
  }
  for(const [x,z,ang] of [[310,308,0],[604,308,0],[319,488,0],[603,488,0]])bench(x,z,ang);
  for(const [x,z] of [[284,158],[681,158],[285,486],[682,486],[78,303],[852,470]])tree(x,z,.67);
  // Columns frame walkways without blocking any graph edge.
  for(const x of [280,488,681])for(const z of [155,309,491]){box(x,z,4,4,2.8,wall);box(x,z,5,5,.12,cap,2.8);box(x,z,5,5,.12,stone);}
  label(o.floor===1?'CENTRAL COURT':'UPPER GALLERY',456,322,.03,{priority:0});
  // Path graphics are physical inlays above the finished floor. Raised endpoint
  // pins and floor-change rings remain legible when the building is orbited.
  if(o.congestion&&o.floor===1){for(const [x,z] of [[441,330],[472,355],[449,400],[480,438]]){const m=mat(0xb88e48,{transparent:true,opacity:.17});cyl(x,z,15,.012,m,.02);}}
  const routeY=.075;
  function pathLine(a,b,color,width=4){const m=own(new THREE.MeshBasicMaterial({color,toneMapped:false})),y=color===0xfafbf5?routeY:routeY+.025;strip(a.x,a.y,b.x,b.y,width,.025,m,y);cyl(a.x,a.y,width/2,.028,m,y);cyl(b.x,b.y,width/2,.028,m,y);}
  for(const [id,door] of Object.entries(entryPoints)){if(door.f!==o.floor)continue;const approach=nodes[id];strip(approach.x,approach.y,door.x,door.y,18,.017,cap,.015);if(o.route&&(id===o.start||id===o.destination)){pathLine(approach,door,0xfafbf5,6.8);pathLine(approach,door,GREEN,4);}}
  for(const [i,s] of (o.route?.segments||[]).entries()){
    const a=nodes[s.from],b=nodes[s.to],done=o.screen==='arrival'||o.screen==='navigation'&&i<o.step;
    if(a.f===o.floor&&b.f===o.floor){pathLine(a,b,0xfafbf5,6.8);pathLine(a,b,done?0x9aa99b:GREEN,i===o.step&&o.screen==='navigation'?5:4);
      // Small directional chevrons along each physical corridor segment.
      if(!done){const len=Math.hypot(b.x-a.x,b.y-a.y),dx=(b.x-a.x)/len,dz=(b.y-a.y)/len;for(let d=28;d<len-15;d+=50){const x=a.x+dx*d,z=a.y+dz*d;const shape=new THREE.Shape();shape.moveTo(-.24,-.22);shape.lineTo(.24,0);shape.lineTo(-.24,.22);shape.lineTo(-.07,0);shape.closePath();const g=own(new THREE.ShapeGeometry(shape));g.rotateX(-Math.PI/2);const chevron=mesh(g,own(new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,toneMapped:false})),P(x,z,.16),null,false);chevron.rotation.y=-Math.atan2(dz,dx);}}
    }else if(a.f===o.floor||b.f===o.floor){const n=a.f===o.floor?a:b;const ringG=own(new THREE.TorusGeometry(1.05,.12,8,32)),e=mesh(ringG,green,P(n.x,n.y,.12));e.rotation.x=Math.PI/2;label(`${s.type==='lift'?'Lift':'Stairs'} to L${a.f===o.floor?b.f:a.f}`,n.x,n.y,2.2,{priority:80});}
  }
  const currentId=o.current||o.start,current=entryPoints[currentId]&&(['map','route','arrival'].includes(o.screen)||o.screen==='navigation'&&o.step===0)?entryPoints[currentId]:nodes[currentId];let pulse;
  if(current?.f===o.floor){cyl(current.x,current.y,8,.06,cap,.13);cyl(current.x,current.y,5.7,.12,green,.19);const ring=own(new THREE.TorusGeometry(.95,.05,8,40));pulse=mesh(ring,own(new THREE.MeshBasicMaterial({color:GREEN,transparent:true,opacity:.5})),P(current.x,current.y,.17));pulse.rotation.x=Math.PI/2;label(o.screen==='arrival'?'Arrived':o.screen==='navigation'?'You are here':'Start',current.x,current.y-7,1.2,{current:true,priority:100});}
  const dest=entryPoints[o.destination]||nodes[o.destination];if(o.route&&dest?.f===o.floor&&o.destination!==(o.current||o.start)){cyl(dest.x,dest.y,6.5,.08,cap,.1);cyl(dest.x,dest.y,3.8,.11,green,.18);bar(P(dest.x,dest.y,.25),P(dest.x,dest.y,2.5),.06,green);const flag=box(dest.x+5,dest.y,10,.6,.58,green,1.9);flag.castShadow=false;}
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),activePointers=new Set();let down=null,disposed=false,frame=0,needsFit=true;
  const downFn=e=>{activePointers.add(e.pointerId);if(!e.isPrimary||e.button!==0||activePointers.size>1){down=null;return;}down={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};};
  const moveFn=e=>{if(down&&down.id===e.pointerId&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)down.moved=true;};
  const cancelFn=e=>{activePointers.delete(e.pointerId);down=null;};
  const upFn=e=>{activePointers.delete(e.pointerId);if(!e.isPrimary||e.button!==0||activePointers.size||!down||down.id!==e.pointerId||down.moved||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5){down=null;return;}down=null;const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-((e.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(scene.children,true)[0];if(!hit)return;let object=hit.object;while(object&&!object.userData.placeId)object=object.parent;if(object?.userData.placeId)o.onSelect?.(object.userData.placeId);};
  canvas.addEventListener('pointerdown',downFn);canvas.addEventListener('pointermove',moveFn);canvas.addEventListener('pointerup',upFn);canvas.addEventListener('pointercancel',cancelFn);
  const resize=()=>{dirty=true;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);const aspect=w/h;const halfWidth=aspect<1?52:54;camera.left=-halfWidth;camera.right=halfWidth;camera.top=halfWidth/aspect;camera.bottom=-halfWidth/aspect;camera.updateProjectionMatrix();needsFit=false;};
  const ro=new ResizeObserver(resize);ro.observe(host);resize();
  let lastLabelFrame=0;
  function placeLabels(){const rect=host.getBoundingClientRect(),occupied=[];leaders.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);for(const l of [...labels].sort((a,b)=>b.priority-a.priority)){const p=l.position.clone().project(camera),anchorX=(p.x*.5+.5)*rect.width,anchorY=(-p.y*.5+.5)*rect.height;const w=l.el.offsetWidth||90,h=l.el.offsetHeight||28;let x=anchorX,y=anchorY,visible=p.z<1&&p.z>-1&&x>-30&&x<rect.width+30&&y>-20&&y<rect.height+20,b;
    const candidates=l.id?[[0,0],[0,-30],[0,30],[-42,0],[42,0],[-42,-30],[42,-30],[-42,30],[42,30],[0,-60],[0,60],[-75,0],[75,0]]:[[0,0]];let found=false;
    if(visible)for(const [dx,dy] of candidates){const cx=Math.max(w/2+8,Math.min(rect.width-w/2-8,anchorX+dx)),cy=Math.max(h/2+12,Math.min(rect.height-h/2-20,anchorY+dy));const test={l:cx-w/2-4,r:cx+w/2+4,t:cy-h/2-3,b:cy+h/2+3};if(!occupied.some(a=>test.l<a.r&&test.r>a.l&&test.t<a.b&&test.b>a.t)){x=cx;y=cy;b=test;found=true;break;}}
    if(!found){if(l.id&&visible){x=Math.max(w/2+8,Math.min(rect.width-w/2-8,anchorX));y=Math.max(h/2+12,Math.min(rect.height-h/2-20,anchorY-30));b={l:x-w/2-4,r:x+w/2+4,t:y-h/2-3,b:y+h/2+3};}else visible=false;}
    l.el.style.visibility=visible?'visible':'hidden';if(l.leader){const displaced=visible&&Math.hypot(x-anchorX,y-anchorY)>5;l.leader.style.display=displaced?'':'none';if(displaced){l.leader.setAttribute('x1',anchorX);l.leader.setAttribute('y1',anchorY);l.leader.setAttribute('x2',x);l.leader.setAttribute('y2',y);}}
    if(visible){l.el.style.left=x+'px';l.el.style.top=y+'px';l.el.style.zIndex=String(l.priority);occupied.push(b);}}
  }
  function orientCompass(){const c=P(460,280).project(camera),n=P(460,230).project(camera);const dx=(n.x-c.x)*host.clientWidth,dy=-(n.y-c.y)*host.clientHeight;compass.lastElementChild.style.transform=`rotate(${Math.atan2(dx,-dy)}rad)`;}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function animate(time){if(disposed)return;frame=requestAnimationFrame(animate);if(!host.clientWidth||!host.clientHeight||document.hidden)return;controls.update();if(pulse&&!reduced&&o.screen==='navigation'){pulse.scale.setScalar(1+Math.sin(time*.002)*.10);pulse.material.opacity=.3+Math.sin(time*.002)*.1;}if(dirty||pulse&&!reduced&&o.screen==='navigation'){renderer.render(scene,camera);dirty=false;}host.dataset.state='ready';host.dataset.triangles=String(renderer.info.render.triangles);host.dataset.drawcalls=String(renderer.info.render.calls);if(time-lastLabelFrame>40){placeLabels();orientCompass();lastLabelFrame=time;}}
  frame=requestAnimationFrame(animate);
  const api={
    zoom(delta){dirty=true;camera.zoom=THREE.MathUtils.clamp(camera.zoom+delta*.22,.55,3.6);camera.updateProjectionMatrix();placeLabels();return Math.round(camera.zoom*100);},
    reset(){dirty=true;if(mode==='plan'){camera.position.set(0,130,.001);controls.target.set(0,0,0);camera.zoom=1;camera.updateProjectionMatrix();controls.update();}else setDefault();placeLabels();return 100;},
    setView(view){dirty=true;mode=view==='plan'?'plan':'3d';controls.enableRotate=mode!=='plan';if(mode==='plan'){camera.position.set(0,130,.001);controls.target.set(0,0,0);camera.zoom=1;camera.updateProjectionMatrix();controls.update();}else setDefault();placeLabels();},
    rotate(delta=.35){dirty=true;if(mode==='plan')api.setView('3d');const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),delta);camera.position.copy(controls.target).add(offset);controls.update();placeLabels();},
    dispose(){if(disposed)return;disposed=true;savedCamera={position:camera.position.toArray(),target:controls.target.toArray(),zoom:camera.zoom,mode};cancelAnimationFrame(frame);ro.disconnect();canvas.removeEventListener('pointerdown',downFn);canvas.removeEventListener('pointermove',moveFn);canvas.removeEventListener('pointerup',upFn);canvas.removeEventListener('pointercancel',cancelFn);controls.dispose();for(const r of resources)r.dispose?.();renderer.dispose();renderer.forceContextLoss();host.replaceChildren();}
  };
  return api;
}
