import {places,type Coordinate,type PlaceId,type TravelMode} from './config';
import type {Segment} from './logic';
declare global {interface Window {kakao?:any}}
let sdkPromise:Promise<any>|null=null;
export function getKakao():Promise<any>{
 const key=import.meta.env.VITE_KAKAO_JS_KEY?.trim();
 if(!key)return Promise.reject(new Error('배포된 사이트에 카카오맵 JavaScript 키가 없습니다. GitHub Actions 변수 KAKAO_JS_KEY 등록 후 재배포하세요.'));
 if(window.kakao?.maps?.services)return Promise.resolve(window.kakao);
 if(sdkPromise)return sdkPromise;
 sdkPromise=new Promise((resolve,reject)=>{
  const existing=document.querySelector<HTMLScriptElement>('script[data-kakao-sdk]');
  const script=existing||document.createElement('script');
  let settled=false;
  const finish=(error?:Error)=>{
   if(settled)return;
   settled=true;
   window.clearTimeout(timeout);
   script.removeEventListener('error',onError);
   script.removeEventListener('load',onLoad);
   if(error){sdkPromise=null;reject(error)}
   else resolve(window.kakao);
  };
  const onError=()=>finish(new Error('카카오맵 SDK 다운로드 실패. 카카오맵 API 사용 설정과 JavaScript SDK 허용 도메인, 브라우저 네트워크 차단을 확인하세요.'));
  const onLoad=()=>{
   if(!window.kakao?.maps?.load){finish(new Error('SDK 파일은 로드됐지만 카카오맵 객체를 초기화하지 못했습니다. 키/도메인/카카오맵 API 활성화 설정을 확인하세요.'));return}
   try{window.kakao.maps.load(()=>{if(window.kakao?.maps?.services)finish();else finish(new Error('카카오 지도 서비스 라이브러리를 사용할 수 없습니다.'))})}
   catch(e){finish(new Error('카카오맵 초기화 실패: '+String(e)))}
  };
  const timeout=window.setTimeout(()=>finish(new Error('카카오맵 SDK 응답 시간 초과 (15초). 네트워크 및 카카오맵 API 사용 설정을 확인하세요.')),15000);
  script.addEventListener('load',onLoad);
  script.addEventListener('error',onError);
  if(window.kakao?.maps?.load)onLoad();
  else if(!existing){
   script.dataset.kakaoSdk='true';
   script.src=`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services`;
   script.async=true;
   document.head.appendChild(script);
  }
 });
 return sdkPromise;
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
   const nameMatch=id==='final'?n===normalize(p.search):n.includes(expected)||expected.includes(n);
   const address=(x.road_address_name||'')+' '+(x.address_name||'');
   return nameMatch&&(!p.addressHint||address.includes(p.addressHint)||address.replace(/\s/g,'').includes(p.addressHint.replace(/\s/g,'')));
  }).map(x=>({name:x.place_name,address:x.road_address_name||x.address_name,coord:{lat:Number(x.y),lng:Number(x.x)}}));
  if(candidates.length===1)return {id,coord:candidates[0].coord,status:'matched',candidates};
  return {id,coord:null,status:candidates.length?'ambiguous':'missing',candidates};
 };
 const entries=await Promise.all((Object.keys(places) as PlaceId[]).map(lookup));return Object.fromEntries(entries.map(x=>[x.id,x])) as Record<PlaceId,ResolvedPlace>;
}
const kakaoPlaceName=(id:PlaceId)=>id==='final'?places.final.search:places[id].name;
export const kakaoSearchLink=(id:PlaceId)=>`https://map.kakao.com/?q=${encodeURIComponent(kakaoPlaceName(id))}`;
export const kakaoDirections=(from:PlaceId,to:PlaceId,mode:TravelMode)=>`https://map.kakao.com/?sName=${encodeURIComponent(kakaoPlaceName(from))}&eName=${encodeURIComponent(kakaoPlaceName(to))}&target=${mode==='walking'?'walk':'car'}`;
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
