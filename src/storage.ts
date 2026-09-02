import type {Board} from './engine';
export type Player={name:string;color:string}; export type Roll={total:number;player:string;at:number};
export type Game={board:Board;players:Player[];current:number;turn:number;started:number;timer:number;turnStarted:number;rolls:Roll[];events:string[];paused:boolean};
const safe=<T,>(k:string,fallback:T):T=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v).data??fallback:fallback}catch{return fallback}};
export const load=<T,>(k:string,f:T)=>safe('hexmate.'+k,f);export const save=(k:string,data:unknown)=>{try{localStorage.setItem('hexmate.'+k,JSON.stringify({version:1,data}))}catch{}}
export const remove=(k:string)=>localStorage.removeItem('hexmate.'+k);
