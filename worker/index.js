/** Cloudflare Worker. Set KAKAO_REST_KEY as a SECRET, never a VITE_ variable. */
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin')||'';
  const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  const headers={'Access-Control-Allow-Origin':allowed.includes(origin)?origin:'null','Vary':'Origin','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Content-Type':'application/json','Cache-Control':'public, max-age=180'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(!allowed.includes(origin))return new Response(JSON.stringify({error:'Origin not allowed'}),{status:403,headers});
  const url=new URL(request.url);if(url.pathname!=='/route'||request.method!=='GET')return new Response('Not found',{status:404,headers});
  const mode=url.searchParams.get('mode');if(!['walking','driving'].includes(mode))return new Response(JSON.stringify({error:'Invalid mode'}),{status:400,headers});
  const numbers=['sx','sy','ex','ey'].map(k=>Number(url.searchParams.get(k)));
  const [sx,sy,ex,ey]=numbers;
  if(numbers.some(n=>!Number.isFinite(n))||sx<124||sx>132||ex<124||ex>132||sy<33||sy>39||ey<33||ey>39)return new Response(JSON.stringify({error:'Invalid Korean coordinates'}),{status:400,headers});
  if(!env.KAKAO_REST_KEY)return new Response(JSON.stringify({error:'Server key missing'}),{status:503,headers});
  const target=mode==='walking'?new URL('https://dapi.kakao.com/v2/routing/walk'):new URL('https://apis-navi.kakaomobility.com/v1/directions');
  if(mode==='walking')for(const [k,v] of Object.entries({start_x:sx,start_y:sy,end_x:ex,end_y:ey,output_coord:'WGS84'}))target.searchParams.set(k,v);
  else for(const [k,v] of Object.entries({origin:`${sx},${sy}`,destination:`${ex},${ey}`,summary:'false'}))target.searchParams.set(k,v);
  try{
   const result=await fetch(target.toString(),{headers:{Authorization:`KakaoAK ${env.KAKAO_REST_KEY}`}});
   if(!result.ok)return new Response(JSON.stringify({error:'Provider failed',providerStatus:result.status}),{status:502,headers});
   const j=await result.json();let meters,seconds,path=[];
   if(mode==='walking'){
    meters=j.route?.properties?.totalDistance;seconds=j.route?.properties?.totalTime;
    // Walking route includes multiple legs/steps with GeoJSON-like point arrays [lng,lat].
    path=(j.route?.legs||[]).flatMap(leg=>(leg.steps||[]).flatMap(step=>step.path?.points||[]));
   }else{
    const r=j.routes?.[0];if(r?.result_code!==0)throw Error('No driving route');
    meters=r.summary?.distance;seconds=r.summary?.duration;
    path=(r.sections||[]).flatMap(section=>(section.roads||[]).flatMap(road=>{const v=road.vertexes||[];const arr=[];for(let i=0;i<v.length;i+=2)arr.push([v[i],v[i+1]]);return arr}));
   }
   if(!Number.isFinite(meters)||!Number.isFinite(seconds)||path.length<2)throw Error('Incomplete route');
   return new Response(JSON.stringify({meters,seconds,path}),{headers});
  }catch{return new Response(JSON.stringify({error:'Route could not be verified'}),{status:502,headers})}
 }
};
