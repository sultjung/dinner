import {describe,it,expect} from 'vitest';
import {defaults} from './config';
import {schedule,totals,safeSettings,type RouteState} from './logic';
const route:RouteState={status:'ready',segments:[{from:'golf',to:'billiards',meters:500,seconds:600,path:[[127,37],[127.01,37.01]]},{from:'billiards',to:'sashimi',meters:800,seconds:900,path:[[127,37],[127.01,37.01]]},{from:'sashimi',to:'final',meters:900,seconds:1200,path:[[127,37],[127.01,37.01]]}]};
describe('dashboard model',()=>{
 it('cascades arrival times with route durations',()=>{const s=structuredClone(defaults);const a=schedule(s,route);expect(a[0].start).toBe(480);expect(a[1].start).toBe(670);expect(a[2].start).toBe(745);expect(a[3].start).toBe(885);s.durations.billiards=90;expect(schedule(s,route)[2].start).toBe(775)});
 it('never invents arrival when routes are missing',()=>{const a=schedule(defaults,{status:'unavailable',segments:[]});expect(a[0].end).toBe(660);expect(a[1].start).toBeNull()});
 it('tracks restaurant-specific costs',()=>{const s=structuredClone(defaults);const a=totals(s).cost;s.restaurant='beef';expect(totals(s).cost).not.toBe(a);s.budgets.beef.meat+=20000;expect(totals(s).cost).toBe(466000)});
 it('validates share/import data',()=>{expect(safeSettings({party:0,restaurant:'invalid'}).party).toBe(1);expect(safeSettings({restaurant:'beef'}).restaurant).toBe('beef')});
});
