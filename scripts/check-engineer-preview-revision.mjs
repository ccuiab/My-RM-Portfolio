/** Rendered page checks after mission rendering and npm run build. Uses the
 * running local preview; never starts a server or changes product components.
 * PNGs are retained for human viewing: numerical image differences alone do not
 * constitute approval of composition, motion rhythm or mechanical readability. */
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {homedir} from 'node:os';
import sharp from 'sharp';

const require=createRequire(import.meta.url),home=homedir();
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(join(home,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
let executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
if(!executablePath&&process.platform==='win32'){
 const cache=join(home,'AppData/Local/ms-playwright'),versions=(await readdir(cache)).filter(name=>/^chromium-\d+$/.test(name)).sort((a,b)=>Number(a.slice(9))-Number(b.slice(9)));
 executablePath=join(cache,versions.at(-1),'chrome-win64/chrome.exe');
}
const base=(process.env.PREVIEW_URL??'http://127.0.0.1:4322/My-RM-Portfolio/').replace(/\/?$/,'/');
const output=resolve(process.env.MISSION_AUDIT_DIR??'materials/documents/derived/audits/engineer-mission/revision-20261022');await mkdir(output,{recursive:true});
const timing=JSON.parse(await readFile('materials/models/derived/rm2025-field/models/mission-timing.json','utf8'));
const report={created:new Date().toISOString(),base,expectedDuration:timing.duration,passed:true,humanVisualReview:'pending; open the saved header wire/solid and encoded chapter images',pages:[]};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function imageStats(bytes){
 const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let amber=0,neutralSolid=0,foreground=0,minX=info.width,minY=info.height,maxX=-1,maxY=-1,total=0,squared=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
  const i=(y*info.width+x)*4,r=data[i],g=data[i+1],b=data[i+2],mean=(r+g+b)/3;
  // ACES/linear-to-sRGB makes the authored amber a bright yellow-gold. Test
  // its hue/saturation after rendering rather than assuming the input RGB ratio.
  const wire=r>70&&g>55&&r>=g*.95&&g>b*1.3&&r>b*1.3,solid=mean>45&&Math.max(r,g,b)-Math.min(r,g,b)<45;
  if(wire)amber++;if(solid)neutralSolid++;
  if(wire||solid){foreground++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  total+=mean;squared+=mean*mean;
 }
 const pixels=info.width*info.height;
 return {width:info.width,height:info.height,amberPixels:amber,neutralSolidPixels:neutralSolid,foregroundPixels:foreground,bounds:[minX,minY,maxX,maxY],brightnessVariance:squared/pixels-(total/pixels)**2,sha256:sha(bytes)};
}
if(process.argv.includes('--reanalyze-images')){
 const saved=JSON.parse(await readFile(join(output,'preview-page-checks.json'),'utf8'));
 for(const result of saved.pages.filter(p=>p.width===1440)){
  const wire=await imageStats(await readFile(join(output,result.id+'-header-wire.png'))),solid=await imageStats(await readFile(join(output,result.id+'-header-solid.png')));
  const transition=result.checks.find(c=>c.name==='Real rendered header changes from amber drawing to solid CAD');
  if(transition){transition.detail={...transition.detail,wire,solid};transition.passed=wire.amberPixels>100&&solid.neutralSolidPixels>wire.neutralSolidPixels*1.35+200&&wire.sha256!==solid.sha256;}
  const framing=result.checks.find(c=>c.name==='Rendered CAD features fit within the canvas'),bounds=solid.bounds;
  if(framing){framing.detail={...framing.detail,bounds};framing.passed=solid.foregroundPixels>500&&bounds[0]>solid.width*.005&&bounds[1]>solid.height*.005&&bounds[2]<solid.width*.995&&bounds[3]<solid.height*.995;}
  result.passed=result.checks.every(c=>c.passed);
 }
 saved.passed=saved.pages.length===8&&saved.pages.every(p=>p.passed);
 saved.imageAnalysis={updated:new Date().toISOString(),method:'Recomputed original captured PNGs with an ACES-aware yellow-gold hue test; screenshot hashes and all browser/video checks retained.'};
 await writeFile(join(output,'preview-page-checks.json'),JSON.stringify(saved,null,2)+'\n');
 console.log(JSON.stringify({passed:saved.passed,pages:saved.pages.length,failures:saved.pages.flatMap(p=>p.checks.filter(c=>!c.passed).map(c=>({page:p.id,...c}))),report:join(output,'preview-page-checks.json')},null,2));
 process.exit(saved.passed?0:1);
}
const browser=await chromium.launch({headless:true,executablePath,args:['--enable-webgl','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
try{
 for(const width of [1440,390])for(const language of ['zh','en'])for(const project of ['engineer','hero']){
  const id=`${project}-${language}-${width}`,context=await browser.newContext({viewport:{width,height:width===390?844:1000},deviceScaleFactor:1,isMobile:width===390,hasTouch:width===390,reducedMotion:'no-preference'}),page=await context.newPage();
  const result={id,url:base+(language==='en'?'en/':'')+project+'/',width,language,project,checks:[],pageErrors:[],httpErrors:[],screenshots:[]};
  const check=(name,passed,detail)=>result.checks.push({name,passed:!!passed,detail});
  page.on('pageerror',error=>result.pageErrors.push(String(error)));
  page.on('response',response=>{if(response.status()>=400&&response.url().startsWith(new URL(base).origin))result.httpErrors.push({status:response.status(),url:response.url()});});
  async function shot(locator,name){const bytes=await locator.screenshot({path:join(output,name+'.png'),type:'png'});result.screenshots.push(name+'.png');return imageStats(bytes);}
  try{
   await page.goto(result.url,{waitUntil:'domcontentloaded',timeout:60000});
   await page.evaluate(()=>document.fonts.ready);
   const header=page.locator('[data-ph]'),module=header.locator('[data-module-media]'),view=module.locator('.media-view');
   check('Header title exists and page has no horizontal overflow',await header.locator('h1').isVisible()&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),{title:await header.locator('h1').innerText()});
   if(width===1440){
    await module.waitFor({state:'visible'});
    await page.waitForFunction(()=>document.querySelector('[data-ph] [data-module-media]')?.dataset.ready==='true',null,{timeout:90000});
    const canvas=module.locator('canvas');
    check('Desktop header has a live WebGL canvas',await canvas.count()===1&&await canvas.isVisible(),await canvas.evaluate(c=>({width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight})));
    // Engineer reset restarts elapsed=0 and preserves the CAD front view; hero
    // begins at elapsed=0 immediately when its shared stage becomes ready.
    if(project==='engineer')await module.locator('[data-module-reset]').click();
    const wireTime=Date.now(),wire=await shot(view,id+'-header-wire');
    const delay=Math.max(0,8200-(Date.now()-wireTime));if(delay)await page.waitForTimeout(delay);
    const solid=await shot(view,id+'-header-solid');
    check('Real rendered header changes from amber drawing to solid CAD',wire.amberPixels>100&&solid.neutralSolidPixels>wire.neutralSolidPixels*1.35+200&&wire.sha256!==solid.sha256,{wire,solid,elapsedSeconds:(Date.now()-wireTime)/1000});
    const bounds=solid.bounds,marginX=solid.width*.005,marginY=solid.height*.005;
    check('Rendered CAD features fit within the canvas',solid.foregroundPixels>500&&bounds[0]>marginX&&bounds[1]>marginY&&bounds[2]<solid.width-marginX&&bounds[3]<solid.height-marginY,{bounds,canvas:[solid.width,solid.height],scope:'Image-space feature bounds; human review also checks dark wheels, camera direction and whole-vehicle framing.'});
    await module.locator('[data-module-spin]').click();
   }else{
    const image=module.locator('[data-module-photo] img');await image.waitFor({state:'visible'});
    await page.waitForFunction(()=>{const image=document.querySelector('[data-ph] [data-module-photo] img');return image?.complete&&image.naturalWidth>0;});
    check('Mobile header retains a loaded static CAD fallback',await image.isVisible()&&await module.locator('canvas').count()===0,await image.evaluate(i=>({naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,width:i.clientWidth,height:i.clientHeight})));
   }
   await shot(header,id+'-header-context');
   if(project==='engineer'){
    const film=page.locator('[data-mission-film]'),video=film.locator('video');await film.scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>{const v=document.querySelector('[data-mission-film] video');return v?.readyState>=1&&Number.isFinite(v.duration);},null,{timeout:60000});
    const media=await video.evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,source:v.currentSrc,error:v.error?{code:v.error.code,message:v.error.message}:null,readyState:v.readyState}));
    check('New encoded mission video has the current duration and resolution',Math.abs(media.duration-timing.duration)<.04&&media.width===1920&&media.height===1080&&!media.error&&media.source.endsWith(`engineer-mission-${language}.mp4`),media);
    if(width===1440&&language==='zh'){
     await page.setViewportSize({width,height:1440});
     await page.locator('#layout').evaluate(el=>scrollTo({top:el.getBoundingClientRect().top+scrollY-180,behavior:'instant'}));
     await page.waitForTimeout(120);
     await video.evaluate(v=>{v.pause();v.currentTime=2.5;});
     await page.waitForFunction(()=>{const v=document.querySelector('[data-mission-film] video');return v?.readyState>=2&&!v.seeking&&v.paused&&Math.abs(v.currentTime-2.5)<.04;},null,{timeout:30000});
     await mkdir(join(output,'site'),{recursive:true});
     await page.locator('#layout').screenshot({path:join(output,'site/engineer-a-current.png'),type:'png'});
     result.screenshots.push('site/engineer-a-current.png');
     await page.setViewportSize({width,height:1000});
    }
    const buttons=film.locator('[data-mission-time]'),expected=[0,1,2,4,6].map(i=>timing.chapters[i]),actual=await buttons.evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.missionTime)));
    check('Every chapter uses the rebuilt timing map',actual.length===expected.length&&actual.every((n,i)=>Math.abs(n-expected[i])<1e-8),{actual,expected});
    const chapterChecks=[];
    for(let i=0;i<expected.length;i++){
     await buttons.nth(i).click();
     await page.waitForFunction(target=>{const v=document.querySelector('[data-mission-film] video');return v&&!v.paused&&v.readyState>=2&&v.currentTime>=target-.02&&v.currentTime<target+.8;},expected[i],{timeout:30000});
     const start=await video.evaluate(v=>v.currentTime);await page.waitForTimeout(250);const end=await video.evaluate(v=>v.currentTime);
     chapterChecks.push({index:i,target:expected[i],start,end,plays:end>start+.10});
     if([1,2,4].includes(i)){
      await video.evaluate(v=>v.pause());const stats=await shot(video,id+'-chapter-'+i);chapterChecks.at(-1).image=stats;
      check('Encoded chapter '+i+' renders actual image pixels',stats.brightnessVariance>20,{variance:stats.brightnessVariance,screenshot:id+'-chapter-'+i+'.png'});
     }
    }
    check('Chapter controls seek correctly and video playback advances',chapterChecks.every(c=>c.plays),chapterChecks);
    await video.evaluate(v=>v.pause());
   }
   check('No JavaScript exceptions or missing local assets',!result.pageErrors.length&&!result.httpErrors.length,{pageErrors:result.pageErrors,httpErrors:result.httpErrors});
  }catch(error){check('Page verification completed',false,{error:String(error)});}
  result.passed=result.checks.every(c=>c.passed);report.passed&&=result.passed;report.pages.push(result);
  await context.close();
  await writeFile(join(output,'preview-page-checks.json'),JSON.stringify(report,null,2)+'\n');
  console.log('PAGE',id,result.passed?'passed':'failed',JSON.stringify(result.checks.filter(c=>!c.passed)));
 }
}finally{await browser.close();}
await writeFile(join(output,'preview-page-checks.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,pages:report.pages.length,humanVisualReview:report.humanVisualReview,report:join(output,'preview-page-checks.json')},null,2));
if(!report.passed)process.exitCode=1;
