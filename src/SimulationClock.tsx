import {useEffect,useState} from 'react';
import {Clock3} from 'lucide-react';
import {activityDurationMs} from './simulation';

export default function SimulationClock({elapsed,duration}:{elapsed:number;duration:number}){
 const [progress,setProgress]=useState(0);
 useEffect(()=>{
  const started=performance.now();
  const id=window.setInterval(()=>{
   setProgress(Math.min(1,(performance.now()-started)/activityDurationMs));
  },80);
  return()=>window.clearInterval(id);
 },[]);
 const minutes=Math.floor(elapsed+duration*progress);
 const hours=String(Math.floor(minutes/60)).padStart(2,'0');
 const rest=String(minutes%60).padStart(2,'0');
 return <div className="simulation-clock">
  <span><Clock3 size={13}/> 누적 활동 시간</span>
  <strong>{hours}:{rest}</strong>
  <small>현재 장소 체류 {duration}분</small>
  <progress aria-label="현재 장소 체류 진행률" max={1} value={progress}/>
 </div>;
}
