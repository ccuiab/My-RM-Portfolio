import study from '../../../materials/models/derived/web/arm-linked-limit.json' with {type:'json'};
export {study};

/** Distance from the bearing centre to the carbon arch over its actual X width. */
export function profileClearance(y:number,z:number){
  let inside=false,best=Infinity,nearest:[number,number]=[y,z];
  for(const polygon of study.profile)for(const ring of [polygon.outer,...polygon.holes]){
    for(let i=1;i<ring.length;i++){
      const a=ring[i-1],b=ring[i],dy=b[0]-a[0],dz=b[1]-a[1];
      if((a[1]>z)!==(b[1]>z)&&y<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
      const t=Math.max(0,Math.min(1,((y-a[0])*dy+(z-a[1])*dz)/(dy*dy+dz*dz||1)));
      const point:[number,number]=[a[0]+t*dy,a[1]+t*dz],d=Math.hypot(y-point[0],z-point[1]);
      if(d<best){best=d;nearest=point;}
    }
  }
  return {clearance:(inside?-best:best)-study.roller_source.radius_m,nearest};
}
