import {places,type Coordinate,type PlaceId,type TravelMode} from './config';
import type {Segment} from './logic';
declare global {interface Window {kakao?:any}}
let sdkPromise:Promise<any>|null=null;
export function getKakao():Promise<any>{
 const key=import.meta.env.VITE_KAKAO_JS_KEY;
 if(!key)return Promise.reject(new Error('카카오맵 JavaScript 키가 없습니다.'));
 if(window.kakao?.maps?.services)return Promise.resolve(window.kakao);
 if(sdkPromise)return sdkPromise;
 sdkPromise=new Promise((resolve,reject)=>{
  const existing=document.querySelector<HTMLScriptElement>('script[data-kakao-sdk]');
  const script=existing||document.createElement('script');
  if(!existing){script.dataset.kakaoSdk='true';script.src=`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services`;script.async=true;document.head.appendChild(script)}
  script.addEventListener('load',()=>window.kakao?.maps?.load(()=>resolve(window.kakao)));
  script.addEventListener('error',()=>{sdkPromise=null;reject(new Error('카카오맵 SDK 로딩 실패'))});
  if(window.kakao?.maps?.load)window.kakao.maps.load(()=>resolve(window.kakao));
 });return sdkPromise;
}
export type ResolvedPlace={id:PlaceId;coord:Coordinate|null;status:'matched'|'ambiguous'|'missing';candidates:{name:string;address:string;coord:Coordinate}[]};
export async function resolvePlaces(kakao:any):Promise<Record<PlaceId,ResolvedPlace>>{
 const service=new kakao.maps.services.Places();
 const lookup=async(id:PlaceId):Promise<ResolvedPlace>=>{
  const p=places[id];const search=()=>new Promise<any[]>(resolve=>service.keywordSearch(p.search,(data:any[],status:string)=>resolve(status===kakao.maps.services.Status.OK?data:[])));
  const data=await search();
  // Never select merely by approximate distance. Match both shop name and known street/address where possible.
  const normalize=(v:string)=>v.replace(/\s|\(.*?\)|점|본점|-/g,'').toLowerCase();
  const expected=normalize(p.name);
  const candidates=data.filter(x=>{
   const n=normalize(x.place_name||'');
   const nameMatch=id==='final'?n.includes('푸르지오')&&n.includes('제기'):n.includes(expected)||expected.includes(n);
   const address=(x.road_address_name||'')+' '+(x.address_name||'');
   return nameMatch&&(!p.addressHint||address.includes(p.addressHint)||address.replace(/\s/g,'').includes(p.addressHint.replace(/\s/g,'')));
  }).map(x=>({name:x.place_name,address:x.road_address_name||x.address_name,coord:{lat:Number(x.y),lng:Number(x.x)}}));
  if(candidates.length===1)return {id,coord:candidates[0].coord,status:'matched',candidates};
  return {id,coord:null,status:candidates.length?'ambiguous':'missing',candidates};
 };
 const entries=await Promise.all((Object.keys(places) as PlaceId[]).map(lookup));return Object.fromEntries(entries.map(x=>[x.id,x])) as Record<PlaceId,ResolvedPlace>;
}
export const kakaoSearchLink=(id:PlaceId)=>`https://map.kakao.com/?q=${encodeURIComponent(places[id].name)}`;
export const kakaoDirections=(from:PlaceId,to:PlaceId,mode:TravelMode)=>`https://map.kakao.com/?sName=${encodeURIComponent(places[from].name)}&eName=${encodeURIComponent(places[to].name)}&target=${mode==='walking'?'walk':'car'}`;
export async function getSegments(ids:PlaceId[],resolved:Record<PlaceId,ResolvedPlace>,mode:TravelMode,signal:AbortSignal):Promise<Segment[]>{
 const proxy=import.meta.env.VITE_ROUTE_PROXY_URL?.replace(/\/$/,'');if(!proxy)throw new Error('실제 길찾기용 서버리스 프록시가 연결되지 않았습니다.');
 const segments:Segment[]=[];
 for(let i=0;i<ids.length-1;i++){
  const a=resolved[ids[i]]?.coord,b=resolved[ids[i+1]]?.coord;
  if(!a||!b)throw new Error('장소의 정확한 지도 좌표를 확인해야 경로를 계산할 수 있습니다.');
  const u=new URL(proxy+'/route');for(const [k,v] of Object.entries({mode,sx:a.lng,sy:a.lat,ex:b.lng,ey:b.lat}))u.searchParams.set(k,String(v));
  const resp=await fetch(u.toString(),{signal});if(!resp.ok)throw new Error(`길찾기 요청 실패 (HTTP ${resp.status})`);
  const route=await resp.json() as {meters:number;seconds:number;path:[number,number][]};
  if(!Number.isFinite(route.meters)||!Number.isFinite(route.seconds)||!Array.isArray(route.path)||route.path.length<2)throw new Error('길찾기 응답 형식 오류');
  segments.push({from:ids[i],to:ids[i+1],...route});
 }
 return segments;
}
