import {useEffect,useRef,useState} from 'react';
import {AlertTriangle,ExternalLink,MapPinned,Navigation2} from 'lucide-react';
import {places,routeIds,type RestaurantId,type TravelMode,type PlaceId} from './config';
import {getKakao,kakaoSearchLink,type ResolvedPlace} from './map';
import {clock,type RouteState} from './logic';
import {activities,tracePath,travelDurationMs} from './simulation';
import SimulationClock from './SimulationClock';

type AgendaPoint={id:PlaceId;start:number|null};
type Props={restaurant:RestaurantId;mode:TravelMode;resolved:Record<PlaceId,ResolvedPlace>|null;route:RouteState;agenda:AgendaPoint[];focusedPlace:PlaceId|null;activityPlace:PlaceId|null;activityTiming:{elapsed:number;duration:number}|null;simulationStops:PlaceId[];travelFrom:PlaceId|null;travelTo:PlaceId|null;onTravelEnd:()=>void;onFocusPlace:(id:PlaceId)=>void;onMapError:(s:string)=>void};

export default function MapView({restaurant,mode,resolved,route,agenda,focusedPlace,activityPlace,activityTiming,simulationStops,travelFrom,travelTo,onTravelEnd,onFocusPlace,onMapError}:Props){
 const host=useRef<HTMLDivElement>(null);
 const map=useRef<any>(null);
 const objects=useRef<any[]>([]);
 const [ready,setReady]=useState(false);
 const [loadError,setLoadError]=useState('');
 const currentIds=routeIds(restaurant);
 const mapFocus=activityPlace??focusedPlace;
 const legs=simulationStops.slice(1).map((to,index)=>{
  const from=simulationStops[index];
  const segment=route.status==='ready'?route.segments.find(item=>item.from===from&&item.to===to):undefined;
  return {from,to,segment};
 });
 const hasGuideLines=legs.some(({from,to,segment})=>!segment&&resolved?.[from]?.coord&&resolved?.[to]?.coord);
 const travelSegment=legs.find(leg=>leg.from===travelFrom&&leg.to===travelTo)?.segment;
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
   const selected=id===mapFocus;
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
   timeLabel.textContent=active?`시작 ${time}${id==='final'?' · 단지 위치':''}`:'선택 전 대안';
   text.append(name,timeLabel);
   tag.append(index,text);
   tag.addEventListener('click',()=>onFocusPlace(id));
   const marker=new k.maps.CustomOverlay({position:pos,content:tag,yAnchor:1.12,zIndex:selected?20:active?10:3});
   marker.setMap(map.current);objects.current.push(marker);
  });
  legs.forEach(({from,to,segment})=>{
   const start=resolved[from]?.coord;
   const end=resolved[to]?.coord;
   if(!start||!end)return;
   const coordinates=segment?.path??[[start.lng,start.lat],[end.lng,end.lat]];
   const path=coordinates.map(([lng,lat])=>new k.maps.LatLng(lat,lng));
   path.forEach((p:any)=>bounds.extend(p));
   const line=new k.maps.Polyline({map:map.current,path,strokeWeight:segment?5:4,strokeColor:segment?'#178168':'#95601f',strokeOpacity:.92,strokeStyle:segment?'solid':'shortdash',zIndex:1});
   objects.current.push(line);
  });
  // Fit the entire itinerary only when a stop is not selected.
  if(!travelFrom&&!mapFocus&&count>0)map.current.setBounds(bounds,55,45,55,45);
 },[restaurant,resolved,route,ready,agenda,mapFocus,onFocusPlace,simulationStops,travelFrom]);

 useEffect(()=>{
  if(travelFrom||!ready||!map.current||!window.kakao||!resolved)return;
  const k=window.kakao;
  const current=mapFocus?resolved[mapFocus]?.coord:null;
  if(current){
   const position=new k.maps.LatLng(current.lat,current.lng);
   const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
   if(activityPlace&&!reducedMotion){
    map.current.setLevel(1);
    map.current.panTo(position);
   }else{
    map.current.setCenter(position);
    map.current.setLevel(1,{animate:!reducedMotion});
   }
  }else{
   const bounds=new k.maps.LatLngBounds();
   let count=0;
   currentIds.forEach(id=>{const c=resolved[id]?.coord;if(c){bounds.extend(new k.maps.LatLng(c.lat,c.lng));count++}});
   legs.forEach(({segment})=>segment?.path.forEach(([lng,lat])=>bounds.extend(new k.maps.LatLng(lat,lng))));
   if(count>0)map.current.setBounds(bounds,55,45,55,45);
  }
 },[mapFocus,activityPlace,ready,resolved,restaurant,route,simulationStops,travelFrom]);

 useEffect(()=>{
  if(!ready||!map.current||!window.kakao||!travelFrom||!travelTo||!resolved)return;
  const start=resolved[travelFrom]?.coord;
  const end=resolved[travelTo]?.coord;
  if(!start||!end){onTravelEnd();return}
  const {CustomOverlay,LatLng,LatLngBounds}=window.kakao.maps;
  const points=travelSegment?[start,...travelSegment.path.map(([lng,lat])=>({lat,lng})),end]:[start,end];
  const positionAt=tracePath(points);
  const bounds=new LatLngBounds();
  points.forEach(({lat,lng})=>bounds.extend(new LatLng(lat,lng)));
  if(points.some(point=>point.lat!==start.lat||point.lng!==start.lng))map.current.setBounds(bounds,86,64,86,64);
  const group=document.createElement('div');
  group.className='map-travel-group';
  group.setAttribute('aria-hidden','true');
  const travelers=mode==='walking'?['🚶','🚶‍♀️','🚶','🚶‍♀️']:['🚗'];
  travelers.forEach((emoji,index)=>{
   const walker=document.createElement('span');
   walker.textContent=emoji;
   walker.style.setProperty('--step-delay',`${index*125}ms`);
   group.append(walker);
  });
  const overlay=new CustomOverlay({position:new LatLng(start.lat,start.lng),content:group,yAnchor:0.68,zIndex:35});
  overlay.setMap(map.current);
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const started=performance.now();
  let frame=0;
  const animate=(now:number)=>{
   const progress=Math.min(1,(now-started)/travelDurationMs);
   if(!reducedMotion||progress===1){
    const {lat,lng}=positionAt(progress);
    overlay.setPosition(new LatLng(lat,lng));
   }
   if(progress<1)frame=requestAnimationFrame(animate);
   else onTravelEnd();
  };
  frame=requestAnimationFrame(animate);
  return()=>{cancelAnimationFrame(frame);overlay.setMap(null)};
 },[travelFrom,travelTo,travelSegment,ready,resolved,mode,onTravelEnd]);

 useEffect(()=>{
  if(!ready||!map.current||!window.kakao||!activityPlace)return;
  const coord=resolved?.[activityPlace]?.coord;
  if(!coord)return;
  const activity=activities[activityPlace];
  const scene=document.createElement('div');
  scene.className='map-activity';
  scene.dataset.place=activityPlace;
  scene.dataset.activity=activity.type;
  scene.setAttribute('aria-hidden','true');
  const group=document.createElement('div');
  group.className='map-activity-group';
  for(let index=0;index<4;index++){
   const player=document.createElement('span');
   player.className='map-activity-player';
   player.style.setProperty('--player-delay',`${index*100}ms`);
   const person=document.createElement('span');
   person.className='map-activity-person';
   person.textContent=activity.player;
   const equipment=document.createElement('span');
   equipment.className='map-activity-equipment';
   equipment.textContent=activity.equipment;
   const action=document.createElement('span');
   action.className='map-activity-action';
   action.textContent=activity.action;
   player.append(person,equipment,action);
   if(activity.type==='golf'){
    const club=document.createElement('span');
    club.className='map-golf-club';
    player.append(club);
   }
   group.append(player);
  }
  const label=document.createElement('strong');
  label.textContent=activity.label;
  scene.append(group,label);
  const {CustomOverlay,LatLng}=window.kakao.maps;
  const overlay=new CustomOverlay({position:new LatLng(coord.lat,coord.lng),content:scene,yAnchor:-0.18,zIndex:30});
  overlay.setMap(map.current);
  return()=>overlay.setMap(null);
 },[activityPlace,ready,resolved]);

 return <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#152a30] h-[370px] md:h-[565px]">
  <div className="absolute inset-0" ref={host}/>
  {!ready&&<div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#11252b] text-center p-8"><MapPinned size={38} className="text-gold"/><p className="font-bold text-white">{loadError?'카카오맵 연결 실패':'카카오맵 연결 중'}</p><p className="text-sm text-muted max-w-sm">{loadError||'카카오맵 SDK를 불러오는 중입니다. 연결할 수 없으면 실제 지도나 경로를 표시하지 않습니다.'}</p><a className="action-button" target="_blank" rel="noreferrer" href={kakaoSearchLink('golf')}>카카오맵에서 시작점 찾기 <ExternalLink size={14}/></a></div>}
  <div className="absolute top-4 left-4 right-4 flex gap-2 justify-between items-start pointer-events-none">
   <div className="flex flex-col items-start gap-1">
    <span className="rounded-lg bg-ink/90 border border-white/10 text-xs px-3 py-2 font-semibold flex gap-2 items-center"><Navigation2 size={13} className="text-emerald"/>{mode==='walking'?'WALKING ROUTE':'DRIVING ROUTE'}</span>
    {hasGuideLines&&<span className="rounded-lg bg-ink/90 px-2 py-1 text-[10px] text-gold">점선 · 장소 연결선</span>}
   </div>
   {travelFrom
    ? <span className="rounded-lg bg-ink/90 border border-white/10 px-3 py-2 text-xs">{mode==='walking'?'도보':'차량'} 이동 중{travelSegment?'':' · 연결선 연출'}</span>
    : activityPlace&&activityTiming
    ? <SimulationClock key={activityPlace} {...activityTiming}/>
    : <span className="rounded-lg bg-ink/90 border border-white/10 text-xs px-3 py-2">{route.status==='ready'?'실제 경로 표시':'경로 미확인'}</span>}
  </div>
  {ready&&route.status!=='ready'&&<div className="absolute bottom-4 left-4 right-4 bg-[#0a1519]/90 border border-gold/25 rounded-xl p-3 flex gap-2 text-xs text-[#f0d7a8]"><AlertTriangle size={17} className="shrink-0"/>{route.reason||'실제 길찾기 API 미연결 — 장소와 시작시간만 표시합니다.'}</div>}
 </div>;
}
