import {useEffect,useRef,useState} from 'react';
import {AlertTriangle,ExternalLink,MapPinned,Navigation2} from 'lucide-react';
import {places,routeIds,type RestaurantId,type TravelMode,type PlaceId} from './config';
import {getKakao,kakaoSearchLink,type ResolvedPlace} from './map';
import type {RouteState} from './logic';
type Props={restaurant:RestaurantId;mode:TravelMode;resolved:Record<PlaceId,ResolvedPlace>|null;route:RouteState;onMapError:(s:string)=>void};
export default function MapView({restaurant,mode,resolved,route,onMapError}:Props){
 const host=useRef<HTMLDivElement>(null);const map=useRef<any>(null);const objects=useRef<any[]>([]);const [ready,setReady]=useState(false);
 useEffect(()=>{let active=true;getKakao().then(k=>{if(!active||!host.current)return;map.current=new k.maps.Map(host.current,{center:new k.maps.LatLng(37.579,127.039),level:5});setReady(true);}).catch(e=>{if(active)onMapError(String(e.message))});return()=>{active=false}},[onMapError]);
 useEffect(()=>{
  if(!ready||!resolved||!map.current||!window.kakao)return;
  const k=window.kakao;objects.current.forEach(x=>x.setMap(null));objects.current=[];
  const ids=[...routeIds(restaurant),restaurant==='sashimi'?'beef':'sashimi'] as PlaceId[];
  const bounds=new k.maps.LatLngBounds();let count=0;
  ids.forEach((id,i)=>{
   const coord=resolved[id]?.coord;if(!coord)return;
   const pos=new k.maps.LatLng(coord.lat,coord.lng);bounds.extend(pos);count++;
   const active=i<4;const label=active?String(i+1):'ALT';
   const tag=document.createElement('div');tag.className=`map-pin ${active?'map-pin-active':'map-pin-alt'}`;tag.textContent=label;
   const marker=new k.maps.CustomOverlay({position:pos,content:tag,yAnchor:1.2});marker.setMap(map.current);objects.current.push(marker);
   const detail=document.createElement('div');detail.className='map-pop';detail.textContent=`${places[id].name} · ${places[id].address}`;
   const info=new k.maps.CustomOverlay({position:pos,content:detail,yAnchor:2.7});
   tag.addEventListener('click',()=>{info.setMap(map.current);objects.current.push(info)});
  });
  if(route.status==='ready')route.segments.forEach(seg=>{
   const path=seg.path.map(([lng,lat])=>new k.maps.LatLng(lat,lng));path.forEach((p:any)=>bounds.extend(p));
   const line=new k.maps.Polyline({map:map.current,path,strokeWeight:5,strokeColor:'#36ac92',strokeOpacity:.95,strokeStyle:'solid'});objects.current.push(line);
  });
  if(count>0)map.current.setBounds(bounds,36,36,36,36);
 },[restaurant,resolved,route,ready]);
 return <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#152a30] h-[370px] md:h-[565px]">
  <div className="absolute inset-0" ref={host}/>
  {!ready&&<div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#11252b] text-center p-8"><MapPinned size={38} className="text-gold"/><p className="font-bold text-white">라이브 카카오맵 연결 전</p><p className="text-sm text-muted max-w-sm">JavaScript 키 등록 후 장소가 검색됩니다. 키가 없으면 임의 좌표나 가짜 경로를 표시하지 않습니다.</p><a className="action-button" target="_blank" rel="noreferrer" href={kakaoSearchLink('golf')}>카카오맵에서 시작점 찾기 <ExternalLink size={14}/></a></div>}
  <div className="absolute top-4 left-4 right-4 flex gap-2 justify-between items-start pointer-events-none"><span className="rounded-lg bg-ink/90 border border-white/10 text-xs px-3 py-2 font-semibold flex gap-2 items-center"><Navigation2 size={13} className="text-emerald"/>{mode==='walking'?'WALKING ROUTE':'DRIVING ROUTE'}</span><span className="rounded-lg bg-ink/90 border border-white/10 text-xs px-3 py-2">{route.status==='ready'?'실제 경로 API':'경로 미확인'}</span></div>
  {ready&&route.status!=='ready'&&<div className="absolute bottom-4 left-4 right-4 bg-[#0a1519]/90 border border-gold/25 rounded-xl p-3 flex gap-2 text-xs text-[#f0d7a8]"><AlertTriangle size={17} className="shrink-0"/>{route.reason||'도로 경로 미확인 — 장소 마커만 표시됩니다.'}</div>}
 </div>
}
