export interface Axes {yaw:number;pitch:number;boost:boolean;}
export interface PlayerState {p:number[];d:number[];g:number[];stamina:number;speed:number;yaw:number;pitch:number;}
export interface Snapshot {type:'state';elapsed:number;positions:number[];directions:number[];allegiance:number[];informed:number[];players:PlayerState[];score:[number,number];done:boolean;}
export function validAxes(v:unknown):v is Axes {if(!v||typeof v!=='object')return false;const a=v as Axes;return Number.isFinite(a.yaw)&&Math.abs(a.yaw)<=1&&Number.isFinite(a.pitch)&&Math.abs(a.pitch)<=1&&typeof a.boost==='boolean';}
export const validRoom=(v:unknown):v is string=>typeof v==='string'&&/^[A-HJ-NP-Z2-9]{6}$/.test(v);
