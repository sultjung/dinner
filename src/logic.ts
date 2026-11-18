import {defaults,routeIds,type PlaceId,type RestaurantId,type Settings} from './config';
export type Segment={from:PlaceId;to:PlaceId;meters:number;seconds:number;path:[number,number][]};
export type RouteState={segments:Segment[];status:'loading'|'ready'|'unavailable';reason?:string};
export const money=(n:number)=>Math.round(n).toLocaleString('ko-KR')+'원';
export const readableDuration=(m:number)=>`${Math.floor(m/60)}시간 ${m%60}분`;
export const minutes=(s:string)=>{const [h,m]=s.split(':').map(Number);return (h||0)*60+(m||0)};
export const clock=(n:number)=>`${String(Math.floor(n/60)%24).padStart(2,'0')}:${String(Math.round(n)%60).padStart(2,'0')}${n>=1440?' (+1일)':''}`;
export function schedule(s:Settings,route:RouteState){
 const ids=routeIds(s.restaurant);let t=minutes(s.start);let known=true;
 const durationKeys=['golf','billiards','lunch','final'] as const;
 return ids.map((id,i)=>{
  const arrival=known?t:null;
  const wait=s.waits[durationKeys[i]];
  const start=arrival===null?null:arrival+wait;
  const end=start===null?null:start+s.durations[durationKeys[i]];
  const next=route.segments[i];
  if(end===null||(!next&&i<3)){known=false;}else if(next){t=end+Math.ceil(next.seconds/60)}
  return {id,arrival,start,end,wait,duration:s.durations[durationKeys[i]],next};
 });
}
export function totals(s:Settings){const b=s.budgets[s.restaurant];const cost=Object.values(b).reduce((a,v)=>a+v,0);return {cost,perPerson:Math.round(cost/s.party),budget:b};}
export function safeSettings(value:unknown):Settings{
 if(!value||typeof value!=='object')return structuredClone(defaults);
 const v=value as Partial<Settings>;
 const clamp=(n:unknown,lo:number,hi:number,fallback:number)=>typeof n==='number'&&Number.isFinite(n)?Math.min(hi,Math.max(lo,Math.round(n))):fallback;
 const d=structuredClone(defaults);
 d.restaurant=v.restaurant==='beef'?'beef':'sashimi';d.mode=v.mode==='driving'?'driving':'walking';d.party=clamp(v.party,1,20,4);
 if(typeof v.start==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v.start))d.start=v.start;
 for(const k of ['golf','billiards','lunch','final'] as const){d.durations[k]=clamp(v.durations?.[k],0,1440,d.durations[k]);d.waits[k]=clamp(v.waits?.[k],0,480,d.waits[k]);}
 for(const r of ['sashimi','beef'] as const)for(const k of Object.keys(d.budgets[r]) as (keyof Settings['budgets'][RestaurantId])[])d.budgets[r][k]=clamp(v.budgets?.[r]?.[k],0,1e7,d.budgets[r][k]);
 return d;
}
export function loadSettings(){try{const url=new URLSearchParams(location.search).get('plan');if(url){return safeSettings(JSON.parse(decodeURIComponent(escape(atob(url)))))}const stored=localStorage.getItem('golf-day-v1');return stored?safeSettings(JSON.parse(stored)):structuredClone(defaults)}catch{return structuredClone(defaults)}}
export function shareUrl(s:Settings){const url=new URL(location.href);url.searchParams.set('plan',btoa(unescape(encodeURIComponent(JSON.stringify(s)))));return url.toString()}
