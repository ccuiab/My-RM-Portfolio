export function stationAdvance(loop:{drive:number;teeth:number;advance_sign:number},angles:number[]){
  return angles[loop.drive]*loop.teeth/360*loop.advance_sign;
}
