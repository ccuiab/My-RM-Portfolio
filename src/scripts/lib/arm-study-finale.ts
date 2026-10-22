/** A short assembly-to-vehicle ending. The 80 mm illustrative step stays put;
 * the loop reset happens only under the final fade, never by sinking terrain. */
export const STUDY_FINALE_SECONDS=39;
const smooth=(n:number)=>{const u=Math.max(0,Math.min(1,n));return u*u*u*(u*(u*6-15)+10);};
const seconds=(progress:number)=>Math.max(0,Math.min(1,progress))*STUDY_FINALE_SECONDS;
export const finaleMotionProgress=(progress:number)=>Math.max(0,Math.min(1,(seconds(progress)-3)/32));
export const finaleEntry=(progress:number)=>smooth(seconds(progress)/3);
export const finaleStairReveal=(progress:number)=>smooth((seconds(progress)-2)/1.5);
export const finaleWideView=(progress:number)=>smooth((seconds(progress)-32)/3);
export const finaleFade=(progress:number)=>smooth((seconds(progress)-38));
export const openingFade=(clock:number)=>1-smooth(clock/.65);
