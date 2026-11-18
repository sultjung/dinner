import type {PlaceId} from './config';

export const activities = {
 golf: {label: '스크린 골프 · 스윙', player: '🏌️', equipment: '⛳', action: '⚪', type: 'golf'},
 billiards: {label: '당구 · 큐로 공 치기', player: '🧍', equipment: '🎱', action: '⚪', type: 'billiards'},
 sashimi: {label: '점심 · 젓가락으로 회 먹기', player: '🙂', equipment: '🍽️', action: '🍣', type: 'meal'},
 beef: {label: '점심 · 젓가락으로 한우 먹기', player: '🙂', equipment: '🍽️', action: '🥩', type: 'meal'},
 final: {label: '맥주 · 잔을 들어 마시기', player: '🙂', equipment: '🍻', action: '🍺', type: 'beer'},
} satisfies Record<PlaceId, {label: string; player: string; equipment: string; action: string; type: string}>;

export const activityDurationMs = 4500;
