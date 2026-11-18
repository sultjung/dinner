import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {toPng} from 'html-to-image';
import {Activity,AlertTriangle,ArrowRight,CalendarDays,Car,Check,Clock3,Copy,Download,ExternalLink,Flag,Footprints,Gauge,MapPinned,Minus,Plus,Printer,RotateCcw,Share2,SlidersHorizontal,Users,Wallet} from 'lucide-react';
import MapView from './MapView';
import {defaults,places,routeIds,type PlaceId,type RestaurantId,type Settings} from './config';
import {clock,loadSettings,money,readableDuration,schedule,shareUrl,totals,type RouteState} from './logic';
import {getKakao,getSegments,kakaoDirections,kakaoSearchLink,resolvePlaces,type ResolvedPlace} from './map';
import {activities,activityDurationMs} from './simulation';
import './style.css';
const keys=['golf','billiards','lunch','final'] as const;
type Stop=typeof keys[number];
const labels=['SCREEN GOLF','BILLIARDS','LUNCH TIME','BEER & CHILL'];
const costLabels:Record<string,string>={golf:'스크린 골프',billiards:'당구',food:'점심 식사',meat:'한우 구매',table:'상차림비',extra:'추가 메뉴',alcohol:'점심 주류',beer:'마지막 맥주',snacks:'안주',transport:'교통·기타'};
const colors=['#d7b778','#62b9a5','#7495c8','#b2a1d6','#f0a77a','#d5d9d2','#478f89','#a6b877','#b7837e','#6a7d90'];
const costKeys=['golf','billiards','food','meat','table','extra','alcohol','beer','snacks','transport'] as const;
function NumberField({label,value,onChange,step=10,max=1440,suffix='분'}:{label:string;value:number;onChange:(v:number)=>void;step?:number;max?:number;suffix?:string}){return <label className="flex items-center justify-between gap-3"><span className="text-muted text-xs">{label}</span><div className="flex gap-1 items-center"><button className="tiny-btn" aria-label={`${label} 감소`} onClick={()=>onChange(Math.max(0,value-step))}><Minus size={12}/></button><input className="number-input" type="number" min="0" max={max} value={value} onChange={e=>onChange(Math.max(0,Math.min(max,Number(e.target.value)||0)))}/><span className="text-xs text-muted">{suffix}</span><button className="tiny-btn" aria-label={`${label} 증가`} onClick={()=>onChange(Math.min(max,value+step))}><Plus size={12}/></button></div></label>}
export default function App(){
 const [settings,setSettings]=useState<Settings>(loadSettings);
 const [resolved,setResolved]=useState<Record<PlaceId,ResolvedPlace>|null>(null);
 const [route,setRoute]=useState<RouteState>({status:'unavailable',segments:[],reason:'API 키를 설정하면 실제 보행·차량 경로를 조회합니다.'});
 const [mapError,setMapError]=useState('');const [toast,setToast]=useState('');const [editTime,setEditTime]=useState(false);const [focusedPlace,setFocusedPlace]=useState<PlaceId|null>(null);
 const [selectedStops,setSelectedStops]=useState<Stop[]>([...keys]);
 const [playback,setPlayback]=useState<{stops:PlaceId[];index:number}|null>(null);
 const [simulationMessage,setSimulationMessage]=useState('');
 const mapPanel=useRef<HTMLDivElement>(null);
 const activityPlace=playback?.stops[playback.index]??null;
 const capture=useRef<HTMLDivElement>(null);
 const set=(fn:(s:Settings)=>void)=>setSettings(old=>{const next=structuredClone(old);fn(next);return next});
 useEffect(()=>{
  try {
   localStorage.setItem('golf-day-v1',JSON.stringify(settings));
  } catch {
   // Storage can be blocked or full; keep the current settings in React state.
  }
 },[settings]);
 const notify=(t:string)=>{setToast(t);window.setTimeout(()=>setToast(''),3200)};
 const mapErrorHandler=useCallback((message:string)=>setMapError(message),[]);
 useEffect(()=>{let alive=true;if(!import.meta.env.VITE_KAKAO_JS_KEY)return;getKakao().then(resolvePlaces).then(p=>{if(alive)setResolved(p)}).catch(e=>{if(alive)setMapError(e.message)});return()=>{alive=false}},[]);
 useEffect(()=>{
  const ctrl=new AbortController();const ids=routeIds(settings.restaurant);
  if(!resolved){setRoute({status:'unavailable',segments:[],reason:'장소 좌표 미확인 — 카카오맵 SDK 설정 및 장소 검색이 필요합니다.'});return()=>ctrl.abort()}
  if(ids.some(id=>!resolved[id]?.coord)){setRoute({status:'unavailable',segments:[],reason:'장소명이 정확히 매칭되지 않았습니다. 아래 확인 필요 목록을 확인하세요.'});return()=>ctrl.abort()}
  if(!import.meta.env.VITE_ROUTE_PROXY_URL){setRoute({status:'unavailable',segments:[],reason:'길찾기 프록시가 없어 거리·소요시간을 제공하지 않습니다.'});return()=>ctrl.abort()}
  setRoute({status:'loading',segments:[],reason:'실제 도로 경로 조회 중'});
  getSegments(ids,resolved,settings.mode,ctrl.signal).then(segments=>{if(!ctrl.signal.aborted)setRoute({status:'ready',segments})}).catch(e=>{if(!ctrl.signal.aborted)setRoute({status:'unavailable',segments:[],reason:e.message})});return()=>ctrl.abort();
 },[resolved,settings.restaurant,settings.mode]);
 const agenda=useMemo(()=>schedule(settings,route),[settings,route]);const {cost,perPerson,budget}=useMemo(()=>totals(settings),[settings]);
 const distance=route.status==='ready'?route.segments.reduce((a,s)=>a+s.meters,0):null;
 const walkMinutes=route.status==='ready'?route.segments.reduce((a,s)=>a+Math.ceil(s.seconds/60),0):null;
 const duration=walkMinutes===null?null:agenda.reduce((a,x)=>a+x.duration+x.wait,0)+walkMinutes;
 const finish=agenda.at(-1)?.end;
 const unverified=(resolved?routeIds(settings.restaurant).filter(id=>resolved[id]?.status!=='matched'):routeIds(settings.restaurant));
 const focusPlace=useCallback((id:PlaceId|null)=>{
  setPlayback(null);
  setSimulationMessage('');
  setFocusedPlace(id);
 },[]);
 const toggleStop=(stop:Stop,id:PlaceId)=>{
  const selected=selectedStops.includes(stop);
  setSelectedStops(current=>selected?current.filter(x=>x!==stop):[...current,stop]);
  focusPlace(selected?null:id);
 };
 const startSimulation=()=>{
  const stops=agenda.filter((_,index)=>selectedStops.includes(keys[index])).map(item=>item.id);
  if(stops.length===0)return;
  const missing=stops.filter(id=>!resolved?.[id]?.coord);
  if(missing.length){
   setSimulationMessage(resolved
    ? `지도 위치 확인 필요 · ${missing.map(id=>places[id].name).join(', ')}`
    : '카카오맵이 연결되고 장소가 확인되면 실행할 수 있습니다.');
   return;
  }
  setSimulationMessage('');
  setFocusedPlace(null);
  setPlayback({stops,index:0});
  mapPanel.current?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 };
 useEffect(()=>{
  if(!playback)return;
  const timer=window.setTimeout(()=>{
   if(playback.index+1<playback.stops.length){
    setPlayback({...playback,index:playback.index+1});
   }else{
    setPlayback(null);
    setFocusedPlace(playback.stops[playback.index]);
    setSimulationMessage('선택한 일정의 시뮬레이션이 끝났습니다.');
   }
  },activityDurationMs);
  return()=>window.clearTimeout(timer);
 },[playback]);
 const setCost=(key:keyof typeof budget,v:number)=>set(s=>{s.budgets[s.restaurant][key]=Math.max(0,Math.min(1e7,v))});
 const selectRestaurant=(id:RestaurantId)=>{
  if(id===settings.restaurant)return;
  setPlayback(null);
  setSimulationMessage('');
  set(s=>{s.restaurant=id});
  setFocusedPlace(current=>current===settings.restaurant?id:current);
 };
 const copy=async()=>{try{await navigator.clipboard.writeText(shareUrl(settings));notify('현재 일정의 공유 URL이 복사되었습니다.')}catch{window.prompt('공유할 URL을 복사하세요',shareUrl(settings))}};
 const savePng=async()=>{if(!capture.current)return;try{const uri=await toPng(capture.current,{pixelRatio:2,backgroundColor:'#091419',filter:n=>!(n instanceof HTMLElement&&n.dataset.skipCapture==='true')});const a=document.createElement('a');a.href=uri;a.download='해지워크샵-2026.png';a.click();notify('일정표 이미지를 저장했습니다.')}catch{notify('PNG 변환 실패 — 인쇄 기능을 이용하세요.')}};
 return <main className="min-h-screen"><div className="ambient"/><div className="max-w-[1510px] mx-auto px-4 sm:px-6 xl:px-10 pt-6 pb-16 relative z-10">
  <header className="flex flex-wrap gap-4 justify-between items-start border-b border-white/10 pb-7"><div className="flex gap-4 items-start"><div className="brand-icon"><Flag size={24}/></div><div><p className="eyebrow">NOVEMBER 21 <span className="mx-2 opacity-40">/</span> 2026</p><h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] tracking-tight text-white font-extrabold mt-1"><span className="text-gold">해지</span>워크샵</h1><p className="text-muted text-xs sm:text-sm mt-2 tracking-wide">NOVEMBER 21, 2026 <span className="mx-2 text-gold">•</span> SEOUL · YONGDU / JEGI / MAJANG</p></div></div><div className="flex gap-2 flex-wrap"><span className="pill"><CalendarDays size={14}/> SAT, NOV 21</span><span className="pill"><Users size={14}/> {settings.party} PLAYERS</span></div></header>
  <section className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-5"><div className="panel order-2 lg:order-1"><div className="panel-heading"><div><p className="eyebrow">DAY AT A GLANCE</p><h2 className="section-title">Today's Itinerary</h2></div><button className="ghost-button" onClick={()=>setEditTime(!editTime)}><SlidersHorizontal size={15}/>{editTime?'닫기':'시간 조정'}</button></div>
   <div className="mt-5 rounded-xl border border-emerald/20 bg-emerald/10 p-4">
    <label htmlFor="simulation-restaurant" className="text-xs font-semibold">점심 식당</label>
    <select id="simulation-restaurant" className="simulation-select" value={settings.restaurant} onChange={event=>selectRestaurant(event.currentTarget.value as RestaurantId)}>
     <option value="sashimi">{places.sashimi.name}</option>
     <option value="beef">{places.beef.name}</option>
    </select>
    <div className="mt-3 flex flex-wrap items-center gap-2">
     <button type="button" className="ghost-button" onClick={()=>{
      setSelectedStops(selectedStops.length===keys.length?[]:[...keys]);
      focusPlace(null);
     }}>{selectedStops.length===keys.length?'전체 해제':'전체 선택'}</button>
     {playback
      ? <button type="button" className="ghost-button" onClick={()=>focusPlace(activityPlace)}>중지</button>
      : <button type="button" className="primary-button" disabled={!selectedStops.length} onClick={startSimulation}><Activity size={16}/> 시뮬레이션</button>}
    </div>
    <p role="status" className="mt-3 text-xs text-muted">{playback&&activityPlace
     ? (playback.index+1)+'/'+playback.stops.length+' · '+places[activityPlace].name+' · '+activities[activityPlace].label
     : simulationMessage||selectedStops.length+'/'+keys.length+'개 선택 · 장소 이름을 눌러 선택하거나 해제하세요.'}</p>
   </div>
   <div className="relative mt-5">{agenda.map((item,i)=>{const id=item.id;return <div key={id} className={`timeline-row ${(activityPlace??focusedPlace)===id?'timeline-row-focused':''}`}><div className="relative z-10 flex flex-col items-center"><div className={`step-circle ${i===0?'step-current':''}`}>{String(i+1).padStart(2,'0')}</div>{i<3&&<div className="w-px bg-white/15 grow min-h-[84px]"/>}</div><div className="pb-6 min-w-0 flex-1"><div className="flex flex-wrap gap-2 justify-between"><span className="eyebrow">{labels[i]}</span><span className="text-gold font-semibold text-xs font-display">{item.start===null?'시간 미확인':clock(item.start)}</span></div><div className="flex items-center gap-1">
     <button type="button" className="timeline-place-button" aria-pressed={selectedStops.includes(keys[i])} onClick={()=>toggleStop(keys[i],id)}>
      <span className="timeline-stop-choice" aria-hidden="true">{selectedStops.includes(keys[i])&&<Check size={14}/>}</span><span>{places[id].name}</span>
     </button>
     <button type="button" className="timeline-map-button" aria-label={places[id].name+' 지도에서 확대'} onClick={()=>focusPlace(id)}><MapPinned size={17}/></button>
    </div><p className="text-muted text-xs mt-1">{places[id].description}</p><div className="flex gap-2 flex-wrap mt-3"><span className="chip"><Clock3 size={12}/>{item.duration}분</span>{item.wait>0&&<span className="chip">대기 {item.wait}분</span>}{i<3&&<span className="chip">{item.next?`${(item.next.meters/1000).toFixed(2)}km · ${Math.ceil(item.next.seconds/60)}분 이동`:'다음 구간 이동 미확인'}</span>}</div>{i<3&&<a className="text-emerald text-[11px] inline-flex items-center gap-1 mt-2 hover:underline" target="_blank" rel="noreferrer" href={kakaoDirections(id,agenda[i+1].id,settings.mode)}>카카오맵 경로 확인 <ExternalLink size={11}/></a>}</div></div>})}</div>
   {editTime&&<div className="border-t border-white/10 pt-5 space-y-5"><label className="flex justify-between items-center text-xs text-muted">집합시간<input className="input !w-28" type="time" value={settings.start} onChange={e=>set(s=>{s.start=e.target.value})}/></label><label className="flex items-center justify-between text-xs text-muted">이동수단 <span className="flex gap-1"><button className={`toggle ${settings.mode==='walking'?'selected':''}`} onClick={()=>set(s=>{s.mode='walking'})}><Footprints size={14}/>도보</button><button className={`toggle ${settings.mode==='driving'?'selected':''}`} onClick={()=>set(s=>{s.mode='driving'})}><Car size={14}/>자동차</button></span></label>{keys.map((k,i)=><div className="space-y-2" key={k}><p className="text-xs font-bold text-white">{labels[i]}</p><NumberField label="체류시간" value={settings.durations[k]} onChange={v=>set(s=>{s.durations[k]=v})}/><NumberField label="추가 대기시간" value={settings.waits[k]} onChange={v=>set(s=>{s.waits[k]=v})}/></div>)}<NumberField label="참가 인원" value={settings.party} max={20} step={1} suffix="명" onChange={v=>set(s=>{s.party=Math.max(1,v)})}/></div>}
  </div><div ref={mapPanel} className="panel order-1 lg:order-2 !p-3 sm:!p-4"><div className="flex flex-wrap items-center justify-between gap-3 px-2 pt-2 pb-4"><div><p className="eyebrow">LIVE ROUTE OVERVIEW</p><h2 className="section-title">Explore the Route</h2></div><div className="rounded-xl p-1 bg-white/5 flex gap-1"><button className={`toggle ${settings.mode==='walking'?'selected':''}`} onClick={()=>set(s=>{s.mode='walking'})}><Footprints size={15}/>도보</button><button className={`toggle ${settings.mode==='driving'?'selected':''}`} onClick={()=>set(s=>{s.mode='driving'})}><Car size={15}/>자동차</button></div></div><MapView restaurant={settings.restaurant} mode={settings.mode} resolved={resolved} route={route} agenda={agenda.map(a=>({id:a.id,start:a.start}))} focusedPlace={focusedPlace} activityPlace={activityPlace} onFocusPlace={focusPlace} onMapError={mapErrorHandler}/><div className="flex justify-between items-center gap-3 text-[11px] text-muted px-2 pt-4"><button type="button" className="text-gold underline" onClick={()=>focusPlace(null)}>전체 일정 보기</button><span><span className="text-emerald">●</span> 현재 일정 <span className="text-muted mx-2">●</span> 미선택 식당</span><a className="flex items-center gap-1 text-gold hover:underline" href={kakaoSearchLink(settings.restaurant)} target="_blank" rel="noreferrer">카카오맵 열기 <ExternalLink size={12}/></a></div></div></section>
  {(mapError||unverified.length>0||route.status!=='ready')&&<div className="border border-gold/20 bg-gold/5 rounded-xl mt-5 p-4 text-xs text-[#e7d3ae] flex items-start gap-3"><AlertTriangle size={18} className="shrink-0"/><div><strong>장소·이동 검증 상태</strong><p className="mt-1 leading-relaxed">{mapError||route.reason||'실제 이동경로를 확인할 수 없습니다.'} {unverified.length>0&&`미확인 장소: ${unverified.map(x=>places[x].name).join(', ')}.`} 정확히 일치하지 않는 후보지는 자동 선택하지 않습니다.</p><div className="mt-2 flex flex-wrap gap-3">{unverified.map(id=><a key={id} target="_blank" rel="noreferrer" href={kakaoSearchLink(id)} className="underline">{places[id].name} 검색</a>)}</div></div></div>}
  <section className="mt-8"><div className="flex flex-wrap items-end justify-between mb-4 gap-3"><div><p className="eyebrow">CHOOSE YOUR EXPERIENCE</p><h2 className="section-title !text-2xl">Where to Lunch?</h2></div><p className="text-xs text-muted">식당 변경 시 지도 · 일정 · 예산 자동 연동</p></div><div className="grid md:grid-cols-2 gap-5">{(['sashimi','beef'] as RestaurantId[]).map(id=>{const p=places[id],active=settings.restaurant===id;return <article key={id} className={`restaurant-card ${active?'restaurant-active':''}`}><div className={`restaurant-art ${id==='sashimi'?'fish-art':'beef-art'}`}><div className="art-orbit">{id==='sashimi'?'魚':'炭'}</div><span className="absolute top-4 left-4 uppercase tracking-widest text-[10px] font-bold px-3 py-2 rounded-full bg-black/45 text-white">{active?'✓ SELECTED RESTAURANT':'ALTERNATIVE OPTION'}</span><span className="absolute bottom-4 left-4 text-white/90 text-[11px]">실제 매장 사진: 확인 필요 · 임의 이미지 미사용</span></div><div className="p-5"><div className="flex gap-2 items-start justify-between"><div><p className="eyebrow text-emerald">{p.category}</p><h3 className="text-xl text-white font-bold mt-1">{p.name}</h3></div><span className="text-gold font-bold text-lg whitespace-nowrap">{money(id==='sashimi'?settings.budgets[id].food:settings.budgets[id].meat+settings.budgets[id].table+settings.budgets[id].extra)}</span></div><p className="text-muted text-xs mt-3">{p.address}</p><p className="text-[#d7e4e0] text-sm mt-3">{p.menu}</p><div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mt-5 border-t border-white/10 pt-4"><span className="text-muted">영업시간</span><span className="text-right text-white">{p.hours}</span><span className="text-muted">주차</span><span className="text-right text-white">{p.parking}</span><span className="text-muted">전화</span><span className="text-right text-white">{p.phone}</span><span className="text-muted">지도 좌표</span><span className="text-right text-white">{resolved?.[id]?.status==='matched'?'카카오 검색 매칭':'확인 필요'}</span></div><div className="grid grid-cols-[1fr_auto] gap-2 mt-5"><button className={`primary-button ${active?'!bg-[#29473f] !text-emerald':''}`} onClick={()=>selectRestaurant(id)}>{active?<><Check size={16}/> 현재 선택됨</>:<>이 식당 선택 <ArrowRight size={15}/></>}</button><a className="icon-button" href={kakaoSearchLink(id)} target="_blank" rel="noreferrer" title="지도 열기" aria-label="지도 열기"><ExternalLink size={16}/></a></div></div></article>})}</div></section>
  <section className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" aria-label="전체 일정과 예산 요약">
  {[{icon:Clock3,label:'TOTAL DURATION',value:duration===null?'미확인':readableDuration(duration),sub:finish==null?'이동 경로 확인 필요':`종료 ${clock(finish)}`},{icon:MapPinned,label:'TOTAL DISTANCE',value:distance===null?'미확인':(distance/1000).toFixed(2)+' km',sub:route.status==='ready'?'실제 경로 합산':'직선거리 대체 없음'},{icon:Wallet,label:'GROUP BUDGET',value:money(cost),sub:'4인 기준 예시 예산'},{icon:Users,label:'PER PERSON',value:money(perPerson),sub:`총 ${settings.party}명 균등 분담`}].map((k,i)=><div key={k.label} className="kpi"><div className="flex justify-between items-center"><span className="eyebrow">{k.label}</span><k.icon size={18} className={i===2?'text-gold':'text-emerald'}/></div><div className="font-display text-[25px] md:text-[30px] font-bold tracking-tight mt-4 text-white break-words">{k.value}</div><div className="text-xs text-muted mt-2">{k.sub}</div></div>)}
  </section>

  <section className="grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-5 mt-7"><div className="panel"><div className="panel-heading"><div><p className="eyebrow">FLEXIBLE SPENDING</p><h2 className="section-title">Budget Simulator</h2></div><span className="pill !text-gold"><Gauge size={15}/> 예시 견적</span></div><p className="text-xs text-muted mt-3">금액은 4인 합산 예시값입니다. 실제 메뉴 가격 및 이용 요금은 확인이 필요합니다.</p><div className="grid sm:grid-cols-2 gap-x-6 gap-y-5 mt-7">{costKeys.filter(k=>settings.restaurant==='sashimi'?!['meat','table','extra'].includes(k):k!=='food').map(k=><div key={k}><div className="flex justify-between items-center mb-2 gap-2"><label htmlFor={`cost-${k}`} className="text-xs text-[#d7e6e2]">{costLabels[k]}</label><div className="flex items-center gap-1"><input id={`cost-${k}`} aria-label={costLabels[k]} className="budget-input" type="number" min="0" step="1000" value={budget[k]} onChange={e=>setCost(k,Number(e.target.value)||0)}/><span className="text-xs text-muted">원</span></div></div><input className="range" type="range" aria-label={`${costLabels[k]} 슬라이더`} min="0" max={k==='meat'?400000:250000} step="1000" value={Math.min(budget[k],k==='meat'?400000:250000)} onChange={e=>setCost(k,Number(e.target.value))}/></div>)}</div></div>
   <div className="panel"><div className="panel-heading"><div><p className="eyebrow">COST BREAKDOWN</p><h2 className="section-title">The Final Split</h2></div><Wallet className="text-gold"/></div><div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-6 mt-7"><div className="donut" style={{background:`conic-gradient(${(()=>{let acc=0;return costKeys.filter(k=>budget[k]>0).map((k)=>{const i=costKeys.indexOf(k);const from=acc;acc+=budget[k]/Math.max(cost,1)*100;return `${colors[i]} ${from}% ${acc}%`}).join(',')})()})`}}><div className="donut-center"><span className="text-[10px] text-muted">TOTAL</span><strong className="text-white text-lg">{money(cost)}</strong></div></div><div className="flex-1 w-full space-y-2">{costKeys.filter(k=>budget[k]>0).map(k=><div key={k} className="flex justify-between text-xs gap-3"><span className="flex items-center gap-2 text-muted"><i className="w-2 h-2 rounded-full" style={{background:colors[costKeys.indexOf(k)]}}/>{costLabels[k]}</span><span className="font-semibold text-white">{money(budget[k])}</span></div>)}</div></div><div className="mt-6 rounded-xl bg-[#102e2c] border border-emerald/20 p-4 flex justify-between gap-3 items-center"><div><p className="text-xs text-muted">1인당 예상 비용</p><strong className="text-2xl font-display text-emerald">{money(perPerson)}</strong></div><Users size={25} className="text-emerald"/></div></div></section>
  <section ref={capture} className="panel mt-7" id="schedule-export"><div className="panel-heading"><div><p className="eyebrow">YOUR DAY, YOUR WAY</p><h2 className="section-title">Final Plan Snapshot</h2></div><span className="pill">NOV 21 / 4 STOPS</span></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">{agenda.map((a,i)=><div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-4"><p className="text-gold font-display font-bold text-sm">0{i+1} / {a.start===null?'미확인':clock(a.start)}</p><p className="text-white text-sm font-semibold mt-2">{places[a.id].name}</p><p className="text-muted text-xs mt-1">{a.duration}분</p></div>)}</div><div className="mt-5 flex flex-wrap justify-between gap-3 text-xs"><span className="text-muted">{settings.mode==='walking'?'도보':'자동차'} · {distance===null?'전체 이동거리 미확인':(distance/1000).toFixed(2)+'km'} · {settings.party}명</span><strong className="text-gold">총 {money(cost)} / 인당 {money(perPerson)}</strong></div></section>
  <div className="flex flex-wrap items-center gap-3 mt-5" data-skip-capture="true"><button className="primary-button" onClick={copy}><Copy size={16}/> 공유 URL 복사</button><button className="ghost-button" onClick={async()=>{if(navigator.share){try{await navigator.share({title:'해지워크샵',url:shareUrl(settings)})}catch{return}}else await copy()}}><Share2 size={16}/> 공유</button><button className="ghost-button" onClick={savePng}><Download size={16}/> PNG 저장</button><button className="ghost-button" onClick={()=>window.print()}><Printer size={16}/> 인쇄</button><button className="ghost-button" onClick={()=>{if(window.confirm('일정과 예산을 초기 설정으로 되돌릴까요?')){focusPlace(null);setSelectedStops([...keys]);setSettings(structuredClone(defaults));history.replaceState(null,'',location.pathname);notify('초기 설정으로 돌아갔습니다.')}}}><RotateCcw size={16}/> 초기화</button></div>
  <footer className="flex flex-wrap justify-between gap-3 border-t border-white/10 text-muted text-[11px] mt-10 pt-6"><span>© 2026 해지워크샵 · BUILT FOR THE CREW</span><span>예산은 임의의 초기값 · 경로는 검증된 API 결과만 표시</span></footer>
 </div>{toast&&<div role="status" className="toast"><Check size={17}/>{toast}</div>}</main>
}
