export const nodes = {
 entrance:{x:100,y:470,f:1,label:'South entrance'}, west:{x:250,y:470,f:1,label:'West corridor'}, center:{x:460,y:470,f:1,label:'South atrium'}, east:{x:710,y:470,f:1,label:'East corridor'},
 westmid:{x:250,y:280,f:1,label:'West atrium'}, atrium:{x:460,y:280,f:1,label:'Central atrium'}, eastmid:{x:710,y:280,f:1,label:'Food court junction'},
 lift1:{x:250,y:130,f:1,label:'West lift · L1'}, stairs1:{x:460,y:130,f:1,label:'Atrium stairs · L1'},
 hm:{x:250,y:380,f:1,label:'H&M'}, cafe:{x:710,y:380,f:1,label:'Mellow Coffee'}, restroom1:{x:790,y:280,f:1,label:'Restrooms · L1'}, info:{x:100,y:410,f:1,label:'Information desk'},
 lift2:{x:250,y:130,f:2,label:'West lift · L2'}, stairs2:{x:460,y:130,f:2,label:'Atrium stairs · L2'},
 west2:{x:250,y:280,f:2,label:'West gallery'}, atrium2:{x:460,y:280,f:2,label:'Upper atrium'}, east2:{x:710,y:280,f:2,label:'East gallery'},
 cinema:{x:710,y:130,f:2,label:'CineSpace'}, books:{x:250,y:410,f:2,label:'Book Garden'}, play:{x:710,y:410,f:2,label:'Little Explorers'}, restroom2:{x:790,y:280,f:2,label:'Accessible restrooms · L2'}
};
const raw=[['entrance','west',30],['entrance','info',12],['west','center',42,'atrium'],['center','east',50],['west','hm',18],['hm','westmid',20],['westmid','lift1',30],['westmid','atrium',42],['center','atrium',38,'atrium'],['atrium','stairs1',30,'atrium'],['atrium','eastmid',50],['east','cafe',18],['cafe','eastmid',20],['eastmid','restroom1',16],['stairs1','stairs2',22,'','stairs'],['lift1','lift2',32,'','lift'],['lift2','west2',30],['stairs2','atrium2',30],['west2','atrium2',42],['atrium2','east2',50],['east2','cinema',30],['stairs2','cinema',50],['west2','books',26],['east2','play',26],['east2','restroom2',16]];
export const edges=raw.map(([a,b,m,zone='',type='corridor'])=>({a,b,m,zone,type}));
export const places=[
 {id:'cinema',name:'CineSpace',category:'Leisure',floor:2,desc:'Movies above the atrium',keywords:'cinema movie film theatre theater',icon:'film'},
 {id:'hm',name:'H&M',category:'Shopping',floor:1,desc:'Everyday style, west wing',icon:'bag'},
 {id:'cafe',name:'Mellow Coffee',category:'Food',floor:1,desc:'A quieter coffee stop',icon:'cup'},
 {id:'books',name:'Book Garden',category:'Shopping',floor:2,desc:'Books and stationery',icon:'book'},
 {id:'play',name:'Little Explorers',category:'Leisure',floor:2,desc:'Family play zone',icon:'star'},
 {id:'restroom1',name:'Restrooms · L1',category:'Facilities',floor:1,desc:'East wing facilities',icon:'facility'},
 {id:'restroom2',name:'Accessible restrooms · L2',category:'Facilities',floor:2,desc:'Step-free access',icon:'facility'},
 {id:'info',name:'Information desk',category:'Facilities',floor:1,desc:'South entrance support',icon:'info'}
];
export function calculateRoute(start,end,{accessible=false,congestion=false}={}){
 if(!nodes[start]||!nodes[end])return null;
 const dist=Object.fromEntries(Object.keys(nodes).map(n=>[n,Infinity]));dist[start]=0;
 const prev={},visited=new Set();
 while(true){
  let u=null;for(const n in dist)if(!visited.has(n)&&(u===null||dist[n]<dist[u]))u=n;
  if(u===null||!Number.isFinite(dist[u]))break;
  if(u===end)break;visited.add(u);
  for(const e of edges){
   const v=e.a===u?e.b:e.b===u?e.a:null; if(!v||(accessible&&e.type==='stairs'))continue;
   const cost=e.m*(congestion&&e.zone==='atrium'?4:1);
   if(dist[u]+cost<dist[v]){dist[v]=dist[u]+cost;prev[v]={node:u,edge:e};}
  }
 }
 if(!Number.isFinite(dist[end]))return null;
 const path=[end],segments=[];let at=end;
 while(at!==start){const p=prev[at];if(!p)return null;segments.unshift({...p.edge,from:p.node,to:at});at=p.node;path.unshift(at);}
 const meters=segments.reduce((s,e)=>s+e.m,0);
 // Congestion weight is an avoidance preference, not a measured walking delay.
 // ETA uses physical route distance and the illustrative lift wait only.
 return {path,segments,meters,cost:dist[end],seconds:Math.ceil(meters/1.2+segments.filter(e=>e.type==='lift').length*25)};
}
export function nearbyFacilities(id,options={}){
 return places.filter(p=>p.category==='Facilities'&&p.id!==id).map(p=>({ ...p,route:calculateRoute(id,p.id,options)})).filter(p=>p.route&&p.route.meters<=90).sort((a,b)=>a.route.meters-b.route.meters);
}
