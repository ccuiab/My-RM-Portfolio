import {writeFile} from 'node:fs/promises';
import * as T from 'three';
import {loadMissionGeometry} from './mission-geometry.mjs';
const g=await loadMissionGeometry(),names=['yaw','shoulder','forearm','wristYaw','roll','pitch'],weights=[1,1.1,1.2,.55,.55,.8];
const bounds=[[-100,100],[-75,40],[-65,40],[-180,180],[-180,180],[-100,-3]];
let seed=20251018;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return(seed+.5)/4294967296;};
const arr=p=>names.map(k=>p[k]),obj=a=>Object.fromEntries(names.map((k,i)=>[k,a[i]])),distance=(a,b)=>Math.hypot(...a.map((x,i)=>(x-b[i])*weights[i])),mix=(a,b,u)=>a.map((x,i)=>x+(b[i]-x)*u);
function free(a,cargo){const p=obj(a);if(g.stationSelf(p).length)return false;if(cargo){const m=g.R.stationSlotMatrix(p,new T.Matrix4()),n=new T.Vector3(0,0,1).transformDirection(m);if(n.y<-.09){const c=new T.Vector3(0,-.0199,-.106).applyMatrix4(m);if(Math.abs(c.x)<.52||Math.abs(c.x)>.70||c.z< -1.26||c.z>-.92)return false;}}return true;}
function edge(a,b,cargo,step=4){const n=Math.max(1,Math.ceil(Math.max(...a.map((x,i)=>Math.abs(x-b[i])))/step));for(let i=1;i<=n;i++)if(!free(mix(a,b,i/n),cargo))return false;return true;}
function plan(start,goal,cargo){const a=arr(start),b=arr(goal);if(!free(a,cargo)||!free(b,cargo))throw Error('Endpoint collision '+JSON.stringify({start,goal}));if(edge(a,b,cargo))return[a,b];
 let left=[{a,parent:-1}],right=[{a:b,parent:-1}],swapped=false;
 const nearest=(tree,p)=>{let best=0,d=Infinity;for(let i=0;i<tree.length;i++){const v=distance(tree[i].a,p);if(v<d){best=i;d=v;}}return best;};
 const extend=(tree,p)=>{const i=nearest(tree,p),old=tree[i].a,d=distance(old,p),next=mix(old,p,Math.min(1,20/Math.max(d,1e-9)));if(!edge(old,next,cargo))return null;tree.push({a:next,parent:i});return{index:tree.length-1,reached:d<=20};};
 const path=(tree,i)=>{const out=[];while(i>=0){out.push(tree[i].a);i=tree[i].parent;}return out.reverse();};
 for(let n=0;n<10000;n++){
  const target=random()<.2?right[0].a:bounds.map(([a,b])=>a+(b-a)*random()),r=extend(left,target);
  if(r){let connect;for(let k=0;k<50;k++){connect=extend(right,left[r.index].a);if(!connect||connect.reached)break;}if(connect?.reached){let p=path(left,r.index),q=path(right,connect.index);let out=swapped?[...q,...p.reverse().slice(1)]:[...p,...q.reverse().slice(1)];for(let k=0;k<300;k++){const i=Math.floor(random()*(out.length-1)),j=i+1+Math.floor(random()*(out.length-i-1));if(j>i+1&&edge(out[i],out[j],cargo))out.splice(i+1,j-i-1);}return out;}}
  [left,right]=[right,left];swapped=!swapped;
 }throw Error('No collision-free station path');
}
const dumpA={yaw:45,shoulder:-18,forearm:-10,wristYaw:135,roll:180,pitch:-85},dumpB={yaw:-45,shoulder:-18,forearm:-10,wristYaw:-135,roll:-180,pitch:-85},preA={...dumpA,pitch:-5},preB={...dumpB,pitch:-5};
const segments={};
const upA={...dumpA,roll:0},upB={...dumpB,roll:0};
console.log('Planning first recovery');segments.toDumpA=[...plan(g.R.STATION_A,upA,true),arr(dumpA)];
console.log('Planning transition to second receiving pose');segments.toB=[arr(dumpA),...plan(upA,g.R.STATION_B,false)];
console.log('Planning second recovery');segments.toDumpB=[...plan(g.R.STATION_B,upB,true),arr(dumpB)];
const report={schema:1,source:'Actual exchange-station.glb rigid groups and source pivots',dumpA,dumpB,segments:{},seed:20251018};
for(const [name,p]of Object.entries(segments)){const cargo=name!=='toB';let checks=0;for(let i=1;i<p.length;i++){if(!edge(p[i-1],p[i],cargo,.5))throw Error('Dense station path collision '+name);checks+=Math.ceil(Math.max(...p[i].map((x,k)=>Math.abs(x-p[i-1][k])))/.5);}report.segments[name]=p.map(obj);console.log(name,p.length,'waypoints;',checks,'half-degree checks',JSON.stringify(p.map(obj)));}
await writeFile('materials/models/derived/rm2025-field/models/mission-station-recovery.json',JSON.stringify(report,null,2)+'\n');
