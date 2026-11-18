export type PlaceId='golf'|'billiards'|'sashimi'|'beef'|'final';
export type RestaurantId='sashimi'|'beef';
export type TravelMode='walking'|'driving';
export type Coordinate={lat:number;lng:number};
export type Place={id:PlaceId;name:string;search:string;address:string;category:string;description:string;menu:string;hours:string;parking:string;phone:string;verified:boolean;addressHint?:string;coordinate?:Coordinate};
// Coordinates intentionally omitted: each point must be matched from an actual Kakao place/address search.
export const places:Record<PlaceId,Place>={
 golf:{id:'golf',name:'골프존파크 용두포스빌점',search:'골프존파크 용두포스빌점',address:'서울 동대문구 왕산로 122 지하2층 3호',addressHint:'왕산로 122',category:'스크린 골프',description:'4인 18홀 · 스크린 골프',menu:'18홀 라운드',hours:'토요일 08:00 운영 확인 필요',parking:'주차 가능 여부 및 조건 확인 필요',phone:'02-964-5789',verified:false},
 billiards:{id:'billiards',name:'SBS당구프로',search:'SBS당구프로 왕산로26길',address:'서울 동대문구 왕산로26길 13 2층',addressHint:'왕산로26길 13',category:'당구',description:'친구들과 60분 당구',menu:'당구',hours:'확인 필요',parking:'확인 필요',phone:'확인 필요',verified:false},
 sashimi:{id:'sashimi',name:'전시회 제기본점',search:'전시회 제기본점',address:'서울 동대문구 왕산로 129',addressHint:'왕산로 129',category:'회 · 해산물',description:'제철회와 모둠회를 즐기는 점심',menu:'모둠회 · 제철회',hours:'11:00–22:00 (방문 전 재확인)',parking:'인근 주차장 이용 여부 확인 필요',phone:'02-6958-8570',verified:false},
 beef:{id:'beef',name:'신숯불탁탁',search:'신숯불탁탁 마장동',address:'서울 성동구 마장동 510-2 (지도 재확인)',addressHint:'마장동 510-2',category:'한우 · 숯불구이',description:'고기 구매와 상차림을 분리해 계산',menu:'한우 · 상차림 · 식사류',hours:'10:30–22:30 (방문 전 재확인)',parking:'확인 필요',phone:'02-2299-4987',verified:false},
 final:{id:'final',name:'제기동 푸르지오시티 101동',search:'제기동 푸르지오시티',address:'서울 동대문구 제기동 (101동 정확 주소 확인 필요)',category:'맥주 모임',description:'마지막 장소에서 맥주와 안주',menu:'맥주 · 안주',hours:'개인 모임 · 종료시간 자유 설정',parking:'확인 필요',phone:'해당 없음',verified:false}
};
export type Budget={golf:number;billiards:number;food:number;meat:number;table:number;extra:number;alcohol:number;beer:number;snacks:number;transport:number};
export type Settings={restaurant:RestaurantId;mode:TravelMode;party:number;start:string;durations:{golf:number;billiards:number;lunch:number;final:number};waits:{golf:number;billiards:number;lunch:number;final:number};budgets:Record<RestaurantId,Budget>};
export const initialBudget:Record<RestaurantId,Budget>={
 sashimi:{golf:80000,billiards:24000,food:140000,meat:0,table:0,extra:0,alcohol:40000,beer:40000,snacks:30000,transport:0},
 beef:{golf:80000,billiards:24000,food:0,meat:180000,table:32000,extra:20000,alcohol:40000,beer:40000,snacks:30000,transport:0}
};
export const defaults:Settings={restaurant:'sashimi',mode:'walking',party:4,start:'08:00',durations:{golf:180,billiards:60,lunch:120,final:120},waits:{golf:0,billiards:0,lunch:0,final:0},budgets:initialBudget};
export const routeIds=(restaurant:RestaurantId):PlaceId[]=>['golf','billiards',restaurant,'final'];
