import type {PlaceId} from './config';

export const activities = {
 golf: {label: '스크린 골프 치는 중', emoji: '🏌️', prop: '⛳'},
 billiards: {label: '당구 치는 중', emoji: '🎱', prop: '🎱'},
 sashimi: {label: '회 먹는 중', emoji: '🥢', prop: '🍣'},
 beef: {label: '한우 먹는 중', emoji: '🥢', prop: '🥩'},
 final: {label: '맥주 마시는 중', emoji: '🍺', prop: '🍻'},
} satisfies Record<PlaceId, {label: string; emoji: string; prop: string}>;

export const activityDurationMs = 3000;
