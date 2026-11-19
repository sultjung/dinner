import type {Coordinate,PlaceId} from './config';

export const activities = {
 golf: {label: '스크린 골프 · 스윙', player: '🙂', equipment: '⛳', action: '⚪', type: 'golf'},
 billiards: {label: '당구 · 큐로 공 치기', player: '🧍', equipment: '🎱', action: '⚪', type: 'billiards'},
 sashimi: {label: '점심 · 젓가락으로 회 먹기', player: '🙂', equipment: '🍽️', action: '🍣', type: 'meal'},
 beef: {label: '점심 · 젓가락으로 한우 먹기', player: '🙂', equipment: '🍽️', action: '🥩', type: 'meal'},
 final: {label: '맥주 · 잔을 들어 마시기', player: '🙂', equipment: '🍻', action: '🍺', type: 'beer'},
} satisfies Record<PlaceId, {label: string; player: string; equipment: string; action: string; type: string}>;

export const activityDurationMs = 4500;
export const travelDurationMs = 6500;

export function tracePath(points:Coordinate[]){
 const lengths=[0];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  const longitudeScale=Math.cos((a.lat+b.lat)*Math.PI/360);
  lengths.push(lengths[i-1]+Math.hypot(b.lat-a.lat,(b.lng-a.lng)*longitudeScale));
 }
 const total=lengths[lengths.length-1];
 return (progress:number):Coordinate=>{
  const distance=progress*total;
  const i=lengths.findIndex(length=>length>distance);
  if(i<1)return points[points.length-1];
  const fraction=(distance-lengths[i-1])/(lengths[i]-lengths[i-1]);
  const a=points[i-1],b=points[i];
  return {lat:a.lat+(b.lat-a.lat)*fraction,lng:a.lng+(b.lng-a.lng)*fraction};
 };
}
