import { FLOOR, GRAVITY } from './ball.ts';
export interface BallPosition { x: number; y: number; z: number }
export type ContactQuality = 'sweet' | 'low' | 'high' | 'stretch';

/** Prediction is visual only: collision/rule logic remains authoritative. */
export function landingPoint(position: BallPosition, velocity: BallPosition): BallPosition {
  const time = Math.max(0, (velocity.y + Math.sqrt(Math.max(0, velocity.y * velocity.y + 2 * GRAVITY * (position.y - FLOOR)))) / GRAVITY);
  return { x: position.x + velocity.x * time, y: 0.052, z: position.z + velocity.z * time };
}
export function contactQuality(distance: number, height: number): ContactQuality {
  if (height < 0.55) return 'low';
  if (height > 1.45) return 'high';
  return distance <= 0.9 ? 'sweet' : 'stretch';
}
export const contactText: Record<ContactQuality, string> = {
  sweet: '좋은 타점', low: '낮은 타점 · 딩크 추천', high: '높은 타점 · 정확도 주의', stretch: '먼 타점 · 조금 더 가까이',
};
