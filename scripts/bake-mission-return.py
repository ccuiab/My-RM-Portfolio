"""Bake the open return route from the official field triangles.

This uses the northern wide slope and road shelf, then the open 10-degree
ramp back to the blue floor. It avoids the 450mm-high highland tunnel.
Native CAD is never changed. Heights are sampled under all four wheels.
"""
from pathlib import Path
import json, math
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'materials/models/derived/rm2025-field/models/mission-field-context.json'
OUTPUT=SOURCE.with_name('mission-return-route.json')
f=json.loads(SOURCE.read_text(encoding='utf-8'))
step=.025;xmin=-14.;zmin=-7.5;w=1121;h=601
H=np.full((h,w),np.nan)
for part in f['meshes']:
 p=np.array(part['positions']).reshape(-1,3)
 for face in p[np.array(part['indices']).reshape(-1,3)]:
  x=face[:,0];z=face[:,2];y=face[:,1]
  den=(z[1]-z[2])*(x[0]-x[2])+(x[2]-x[1])*(z[0]-z[2])
  if abs(den)<1e-10:continue
  x0=max(0,int(np.floor((x.min()-xmin)/step)));x1=min(w-1,int(np.ceil((x.max()-xmin)/step)))
  z0=max(0,int(np.floor((z.min()-zmin)/step)));z1=min(h-1,int(np.ceil((z.max()-zmin)/step)))
  xx,zz=np.meshgrid(xmin+np.arange(x0,x1+1)*step,zmin+np.arange(z0,z1+1)*step)
  a=((z[1]-z[2])*(xx-x[2])+(x[2]-x[1])*(zz-z[2]))/den
  b=((z[2]-z[0])*(xx-x[2])+(x[0]-x[2])*(zz-z[2]))/den;c=1-a-b
  inside=(a>=-1e-7)&(b>=-1e-7)&(c>=-1e-7);yy=a*y[0]+b*y[1]+c*y[2]
  old=H[z0:z1+1,x0:x1+1];old[inside]=np.fmax(old[inside],yy[inside])
def height(x,z):
 fx=(x-xmin)/step;fz=(z-zmin)/step;ix=int(fx);iz=int(fz);u=fx-ix;v=fz-iz
 a=H[iz:iz+2,ix:ix+2]
 if not np.all(np.isfinite(a)):raise ValueError(f'Outside source terrain {x,z}')
 return float(a[0,0]*(1-u)*(1-v)+a[0,1]*u*(1-v)+a[1,0]*(1-u)*v+a[1,1]*u*v)

# Rulebook p69: 11 +/-2mm high, 40mm wide, 240mm flat gap.
# Original CAD arrow footprints are reused, replacing their 1mm display extrusion.
arrows=json.loads(SOURCE.with_name('mission-bump-arrows.json').read_text(encoding='utf-8'))
arrow_faces=[]
for part in arrows['meshes']:
 p=np.array(part['positions']).reshape(-1,3)
 for face in p[np.array(part['indices']).reshape(-1,3)]:
  if np.ptp(face[:,1])<1e-6 and np.mean(face[:,1])>.0035:
   tri=face[:,[0,2]];arrow_faces.append((tri.tolist(),tri.min(axis=0).tolist(),tri.max(axis=0).tolist()))
north=[(-1.45,-5.),(3.,-5.),(2.1,-4.16),(2.1,-2.81),(-1.45,-2.81)]
def inside(x,z,poly):
 hit=False
 for i,(ax,az) in enumerate(poly):
  bx,bz=poly[i-1]
  if (az>z)!=(bz>z) and x<(bx-ax)*(z-az)/(bz-az)+ax:hit=not hit
 return hit
def rough_height(x,z):
 for sign in (1,-1):
  xx,zz=x*sign,z*sign
  if inside(xx,zz,north) and height(x,z)>.29:
   d=abs((zz+4.96+.14)%.28-.14)
   return .0112*max(0,min(1,(.020-d)/.006))
 for tri,lo,hi in arrow_faces:
  if x<lo[0] or x>hi[0] or z<lo[1] or z>hi[1]:continue
  a,b,c=tri;cross=lambda p,q:p[0]*q[1]-p[1]*q[0];ba=[b[0]-a[0],b[1]-a[1]];ca=[c[0]-a[0],c[1]-a[1]];pa=[x-a[0],z-a[1]];den=cross(ba,ca)
  if abs(den)<1e-10:continue
  u=cross(pa,ca)/den;vv=cross(ba,pa)/den
  if u>=0 and vv>=0 and u+vv<=1:return .0112
 return 0.

bumps=[]
for part in arrows['meshes']:
 p=np.array(part['positions']).reshape(-1,3);base=float(p[:,1].min());p[:,1]=base+(p[:,1]-base)*11.2
 bumps.append({'source':'official arrow footprint '+str(part['sourceId']),'positions':p.reshape(-1).tolist(),'indices':part['indices']})
for sign in (1,-1):
 for center in np.arange(-4.96,-2.8,.28):
  pos=[];ind=[]
  for x in np.arange(-1.45,3,.04):
   if not all(inside(x,center+d,north) and height(x*sign,(center+d)*sign)>.29 for d in (-.020,.020)):continue
   for xa in (x,x+.04):
    for d,y in [(-.020,0),(-.014,.0112),(.014,.0112),(.020,0)]:pos.extend([xa*sign,height(xa*sign,(center+d)*sign)+y,(center+d)*sign])
   n=len(pos)//3-8
   for j in range(3):ind.extend([n+j,n+j+1,n+4+j,n+j+1,n+5+j,n+4+j])
  if pos:bumps.append({'source':'rule69 straight rib','positions':pos,'indices':ind})
SOURCE.with_name('mission-bumps.json').write_text(json.dumps({'schema':1,'source':'Rulebook p69; source CAD arrow footprints; 11.2mm nominal height,40mm width,280mm period','height':.0112,'width':.04,'period':.28,'meshes':bumps},separators=(',',':'))+'\n')

def ease(u):
 u=max(0,min(1,u));return u*u*u*(u*(u*6-15)+10)

def geometry(points,trim=.18):
 points=[np.array(p,dtype=float) for p in points];out=[points[0]]
 def line(a,b):
  length=np.linalg.norm(b-a)
  for u in np.linspace(0,1,max(2,int(math.ceil(length/.02))+1))[1:]:out.append(a+(b-a)*u)
 cursor=points[0]
 for i in range(1,len(points)-1):
  prev,p,nex=points[i-1:i+2];a=p-prev;b=nex-p;la=np.linalg.norm(a);lb=np.linalg.norm(b)
  if la<1e-6 or lb<1e-6:continue
  da=a/la;db=b/lb;d=min(trim,la*.24,lb*.24)
  if np.dot(da,db)>.9999:line(cursor,p);cursor=p;continue
  pin=p-da*d;pout=p+db*d;line(cursor,pin)
  count=max(8,int((2*d)/.012))
  for u in np.linspace(0,1,count+1)[1:]:out.append((1-u)**2*pin+2*u*(1-u)*p+u*u*pout)
  cursor=pout
 line(cursor,points[-1]);out=np.array(out)
 keep=np.r_[True,np.linalg.norm(np.diff(out,axis=0),axis=1)>1e-7]
 return out[keep]

def build_plan(points,max_speed=2.4,accel=2.3,brake=5.5,lateral=1.8,body_start=-270,body_end=-270,min_duration=0,lead_in=0):
 path=geometry(points);delta=np.gradient(path,axis=0);heading=np.unwrap(np.arctan2(delta[:,0],delta[:,1]))
 # Same physical chassis frame during road travel; the gimbal independently tracks velocity.
 ds2=np.r_[0,np.linalg.norm(np.diff(path,axis=0),axis=1)];distance2=np.cumsum(ds2)
 body=np.array([math.radians(body_start+(body_end-body_start)*ease(d/2.0)) for d in distance2])
 poses=[]
 for (x,z),hbody,hg in zip(path,body,heading):
  right=np.array([math.cos(hbody),0,-math.sin(hbody)]);forward=np.array([math.sin(hbody),0,math.cos(hbody)])
  hf=height(x+.19*forward[0],z+.19*forward[2]);hb=height(x-.19*forward[0],z-.19*forward[2]);hr=height(x+.19*right[0],z+.19*right[2]);hl=height(x-.19*right[0],z-.19*right[2])
  pitch=math.atan2(hb-hf,.38);roll=math.atan2(hr-hl,.38)
  if abs(pitch)<math.radians(.1):pitch=0.
  if abs(roll)<math.radians(.1):roll=0.
  cp,sp=math.cos(pitch),math.sin(pitch);cr,sr=math.cos(roll),math.sin(roll);cy,sy=math.cos(hbody),math.sin(hbody)
  R=np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]])@np.array([[1,0,0],[0,cp,-sp],[0,sp,cp]])@np.array([[cr,-sr,0],[sr,cr,0],[0,0,1]])
  y=-1.
  for xx,zz in [(-.19,-.19),(.19,-.19),(-.19,.19),(.19,.19)]:
   q=R@np.array([xx,.059989754,zz]);y=max(y,height(x+q[0],z+q[2])+.059989754-q[1])
  poses.append([x,y,z,pitch,roll,hbody,hg])
 poses=np.array(poses);ds=np.r_[0,np.linalg.norm(np.diff(poses[:,:3],axis=0),axis=1)];distance=np.cumsum(ds)
 curvature=np.zeros(len(path))
 for i in range(1,len(path)-1):curvature[i]=abs(heading[i+1]-heading[i-1])/max(distance2[i+1]-distance2[i-1],1e-7)
 limits=np.minimum(max_speed,np.sqrt(lateral/np.maximum(curvature,1e-8)))
 speed=limits.copy();speed[0]=0;speed[-1]=0
 for i in range(1,len(path)):speed[i]=min(speed[i],math.sqrt(speed[i-1]**2+2*accel*ds[i]))
 for i in range(len(path)-2,-1,-1):speed[i]=min(speed[i],math.sqrt(speed[i+1]**2+2*brake*ds[i+1]))
 dt=2*ds[1:]/np.maximum(speed[:-1]+speed[1:],1e-6);times=np.r_[0,np.cumsum(dt)]
 settle=.5
 idle=max(0,min_duration-lead_in-times[-1]-settle);duration=math.ceil((lead_in+idle+times[-1]+settle)*120)/120
 output=[]
 initial_gimbal=math.radians(-135) if lead_in else heading[0]
 initial_gimbal+=round((heading[0]-initial_gimbal)/(2*math.pi))*2*math.pi
 for t in np.arange(round(duration*120)+1)/120:
  local=max(0,min(times[-1],t-lead_in-idle));i=min(max(0,int(np.searchsorted(times,local,side='right')-1)),len(path)-2)
  elapsed=local-times[i];span=times[i+1]-times[i];acc=(speed[i+1]-speed[i])/span;u=max(0,min(1,(speed[i]*elapsed+.5*acc*elapsed*elapsed)/max(ds[i+1],1e-9)));p=poses[i]+(poses[i+1]-poses[i])*u
  velocity=speed[i]+acc*elapsed
  if t<lead_in+idle:
   p=poses[0].copy();p[6]=initial_gimbal+(heading[0]-initial_gimbal)*ease(t/max(lead_in,1e-6));velocity=0
  if t>=lead_in+idle+times[-1]:p=poses[-1].copy();velocity=0
  output.append([*[round(float(v),7) for v in p],round(float(velocity),7),round(float(np.interp(local,times,distance)),7)])
 # Small sprung-body load transfer. Wheels keep the terrain pose. A damped
 # second-order response is illustrative; no spring rate is claimed measured.
 values=np.array(output);velocity=np.gradient(values[:,:3],1/120,axis=0);acceleration=np.gradient(velocity,1/120,axis=0)
 load=np.zeros(3);load_rate=np.zeros(3);suspension=[];wn=2*math.pi*4;damping=.68
 for a in acceleration:
  ax,az=np.clip(a[[0,2]],-6,6);target=np.array([-.00055*min(5,math.hypot(ax,az)),ax,az])
  load_rate+=(wn*wn*(target-load)-2*damping*wn*load_rate)/120;load+=load_rate/120
  suspension.append([round(float(x),8) for x in load])
 # Four independent wheel contacts drive a filtered sprung chassis response.
 # Offsets are in original main_0..3 order, in world Y, not a time sine wave.
 wheel_local=[(.19,-.19),(-.19,-.19),(-.19,.19),(.19,.19)]
 wheels=[];road=[];state=np.zeros(3);rate=np.zeros(3);wn_road=2*math.pi*6.;zeta=.58
 for p in values:
  x,y,z,pitch,roll,hbody,hg=p[:7];cy,sy=math.cos(hbody),math.sin(hbody);off=[]
  for xx,zz in wheel_local:
   wx=x+cy*xx+sy*zz;wz=z-sy*xx+cy*zz
   envelope=-1.;base_envelope=-1.
   for u in np.linspace(-.059,.059,17):
    sx=wx+u*math.sin(hg);sz=wz+u*math.cos(hg);arc=math.sqrt(.059989754**2-u*u);floor=height(sx,sz)
    base_envelope=max(base_envelope,floor+arc);envelope=max(envelope,floor+rough_height(sx,sz)+arc)
   off.append(max(0,envelope-base_envelope))
  target=np.array([np.mean(off),((off[0]+off[1])-(off[2]+off[3]))/.76,((off[0]+off[3])-(off[1]+off[2]))/.76])
  rate+=(wn_road*wn_road*(target-state)-2*zeta*wn_road*rate)/120;state+=rate/120
  wheels.append([round(float(a),8) for a in off]);road.append([round(float(a),8) for a in state])
 return {'duration':duration,'fps':120,'samples':output,'suspension':suspension,'wheels':wheels,'road':road,'distance':float(distance[-1]),'maxSpeed':float(max(speed)),'acceleration':accel,'braking':brake,'lateralAcceleration':lateral,'leadIn':lead_in,'idle':idle,'settle':settle,'tightEntry':float(lead_in+idle+np.interp(3.0,distance,times))}

# Open CAD routes, rather than the low 450mm tunnel. Corners are actual fillets;
# speed is planned along arc length with a forward acceleration and backward braking pass.
gold=(.7636753237,.7636753237)
return_points=[gold,(1.9,.05),(1.9,-3.1),(2.4,-4.4),(4,-5.9),(9.15,-5.9),(9.2,-5.75),(9.2,-5),(7.65,-4.5),(6.9,-4.5),(6.9,-3.75),(10.15,-3.15),(10.85,-3.15),(11.2,-6.245),(12.04,-6.245)]
ret=build_plan(return_points,body_start=-135,body_end=-270,lead_in=.35)
# The story's return slot stays fixed. Its side parking is completed on the
# drive, rather than beside the forward-facing station. Any saved road time
# becomes a stopped terminal settle; the physical trajectory is never sped up.
return_slot_seconds=17.716666666666665
target_count=round(return_slot_seconds*ret['fps'])+1
if len(ret['samples'])<target_count:
 extra=target_count-len(ret['samples'])
 for key in ('samples','suspension','wheels','road'):
  ret[key].extend([ret[key][-1].copy() for _ in range(extra)])
 ret['settle']+=extra/ret['fps'];ret['duration']=return_slot_seconds
travel={
 'departure':build_plan([(11,1.6),(9.7,1.4),(7.1,1.4),(4.935,1.19)],body_start=-90,body_end=-90),
 'toSteps':build_plan([(4.935,1.19),(5.20,.60),(5.105,0)],max_speed=1.6,body_start=-90,body_end=-90),
 'toGold':build_plan([(3.505,0),(2.25,.55),gold],max_speed=1.9,body_start=-90,body_end=-135),
}
# These short travel slots retain their established action times. Uniform time
# dilation is only used when the physical minimum is longer, never time compression.
result={'schema':3,'source':'mission-field-context.json','sourceStepSha256':f['sourceStepSha256'],'frame':f['frame'],'start':54,**ret,'travel':travel,'keys':[{'t':54+i/(len(return_points)-1)*8,'p':[x,height(x,z),z],'h':-270} for i,(x,z) in enumerate(return_points)],'note':'Arc-length travel <=2.4m/s, acceleration2.3m/s2, braking5.5m/s2, corner lateral limit1.8m/s2. Four-wheel 11.2mm source-position rib contact, filtered road heave/pitch/roll and separate load transfer at120Hz.'}
OUTPUT.write_text(json.dumps(result,separators=(',',':'),ensure_ascii=False)+'\n',encoding='utf-8')
print('Physical return:',round(ret['duration'],3),'seconds,',round(ret['distance'],3),'m, maximum',ret['maxSpeed'],'m/s; other travel slots',{n:p['duration'] for n,p in travel.items()})
