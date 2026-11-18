import {useEffect,useRef,useState} from 'react';
import {AlertTriangle,ExternalLink,MapPinned,Navigation2} from 'lucide-react';
import {places,routeIds,type RestaurantId,type TravelMode,type PlaceId} from './config';
import {getKakao,kakaoSearchLink,type ResolvedPlace} from './map';
import {clock,type RouteState} from './logic';

type AgendaPoint={id:PlaceId;start:number|null};
type Props={restaurant:RestaurantId;mode:TravelMode;resolved:Record<PlaceId,ResolvedPlace>|null;route:RouteState;agenda:AgendaPoint[];focusedPlace:PlaceId|null;onFocusPlace:(id:PlaceId)=>void;onMapError:(s:string)=>void};

export default function MapView({restaurant,mode,resolved,route,agenda,focusedPlace,onFocusPlace,onMapError}:Props){
 const host=useRef<HTMLDivElement>(null);
 const map=useRef<any>(null);
 const objects=useRef<any[]>([]);
 const [ready,setReady]=useState(false);
 const [loadError,setLoadError]=useState('');
 const currentIds=routeIds(restaurant);
 useEffect(()=>{
  let active=true;
  getKakao().then(k=>{
   if(!active||!host.current)return;
   try{
    map.current=new k.maps.Map(host.current,{center:new k.maps.LatLng(37.579,127.039),level:5});
    setReady(true);setLoadError('');
   }catch(e){throw new Error(`지도 생성 실패: ${e instanceof Error?e.message:String(e)}`)}
  }).catch(e=>{if(active){const message=e instanceof Error?e.message:String(e);setLoadError(message);onMapError(message)}});
  return()=>{active=false;objects.current.forEach(x=>x.setMap(null));objects.current=[]};
 },[onMapError]);

 // Rebuild marker overlays when a restaurant, start time, or verified route changes.
 useEffect(()=>{
  if(!ready||!resolved||!map.current||!window.kakao)return;
  const k=window.kakao;
  objects.current.forEach(x=>x.setMap(null));
  objects.current=[];
  const ids=[...currentIds,restaurant==='sashimi'?'beef':'sashimi'] as PlaceId[];
  const bounds=new k.maps.LatLngBounds();
  let count=0;
  ids.forEach((id,i)=>{
   const coord=resolved[id]?.coord;
   if(!coord)return;
   const pos=new k.maps.LatLng(coord.lat,coord.lng);
   bounds.extend(pos);count++;
   const active=i<4;
   const selected=id===focusedPlace;
   const start=agenda.find(a=>a.id===id)?.start;
   const time=active?(start===null||start===undefined?'시간 미확인':clock(start)):'대안 식당';
   const tag=document.createElement('button');
   tag.type='button';
   tag.className=`map-stop-label ${active?'map-stop-label-active':'map-stop-label-alt'} ${selected?'map-stop-label-focused':''}`;
   tag.setAttribute('aria-label',`${places[id].name} ${time} 지도에서 확대`);
   const index=document.createElement('span');
   index.className='map-stop-number';
   index.textContent=active?String(i+1):'ALT';
   const text=document.createElement('span');
   text.className='map-stop-content';
   const name=document.createElement('strong');
   name.textContent=places[id].name;
   const timeLabel=document.createElement('small');
   timeLabel.textContent=active?`시작 ${time}`:'선택 전 대안';
   text.append(name,timeLabel);
   tag.append(index,text);
   tag.addEventListener('click',()=>onFocusPlace(id));
   const marker=new k.maps.CustomOverlay({position:pos,content:tag,yAnchor:1.12,zIndex:selected?20:active?10:3});
   marker.setMap(map.current);objects.current.push(marker);
  });
  if(route.status==='ready')route.segments.forEach(seg=>{
   const path=seg.path.map(([lng,lat])=>new k.maps.LatLng(lat,lng));
   path.forEach((p:any)=>bounds.extend(p));
   const line=new k.maps.Polyline({map:map.current,path,strokeWeight:5,strokeColor:'#36ac92',strokeOpacity:.92,strokeStyle:'solid',zIndex:1});
   objects.current.push(line);
  });
  // Fit the entire itinerary only when a stop is not selected.
  if(!focusedPlace&&count>0)map.current.setBounds(bounds,55,45,55,45);
 },[restaurant,resolved,route,ready,agenda,focusedPlace,onFocusPlace]);

 useEffect(()=>{
  if(!ready||!map.current||!window.kakao||!resolved)return;
  const k=window.kakao;
  const current=focusedPlace?resolved[focusedPlace]?.coord:null;
  if(current){
   map.current.setCenter(new k.maps.LatLng(current.lat,current.lng));
   map.current.setLevel(1,{animate:true});
  }else{
   const bounds=new k.maps.LatLngBounds();
   let count=0;
   currentIds.forEach(id=>{const c=resolved[id]?.coord;if(c){bounds.extend(new k.maps.LatLng(c.lat,c.lng));count++}});
   if(route.status==='ready')route.segments.forEach(s=>s.path.forEach(([lng,lat])=>bounds.extend(new k.maps.LatLng(lat,lng))));
   if(count>0)map.current.setBounds(bounds,55,45,55,45);
  }
 },[focusedPlace,ready,resolved,restaurant,route]);

 return <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#152a30] h-[370px] md:h-[565px]">
  <div className="absolute inset-0" ref={host}/>
  {!ready&&<div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#11252b] text-center p-8"><MapPinned size={38} className="text-gold"/><p className="font-bold text-white">{loadError?'카카오맵 연결 실패':'카카오맵 연결 중'}</p><p className="text-sm text-muted max-w-sm">{loadError||'카카오맵 SDK를 불러오는 중입니다. 연결할 수 없으면 실제 지도나 경로를 표시하지 않습니다.'}</p><a className="action-button" target="_blank" rel="noreferrer" href={kakaoSearchLink('golf')}>카카오맵에서 시작점 찾기 <ExternalLink size={14}/></a></div>}
  <div className="absolute top-4 left-4 right-4 flex gap-2 justify-between items-start pointer-events-none"><span className="rounded-lg bg-ink/90 border border-white/10 text-xs px-3 py-2 font-semibold flex gap-2 items-center"><Navigation2 size={13} className="text-emerald"/>{mode==='walking'?'WALKING ROUTE':'DRIVING ROUTE'}</span><span className="rounded-lg bg-ink/90 border border-white/10 text-xs px-3 py-2">{route.status==='ready'?'실제 경로 표시':'경로 미확인'}</span></div>
  {ready&&route.status!=='ready'&&<div className="absolute bottom-4 left-4 right-4 bg-[#0a1519]/90 border border-gold/25 rounded-xl p-3 flex gap-2 text-xs text-[#f0d7a8]"><AlertTriangle size={17} className="shrink-0"/>{route.reason||'실제 길찾기 API 미연결 — 장소와 시작시간만 표시합니다.'}</div>}
 </div>;
}
