import {SINGLES_NAMES} from './display-names.ts';
import type { Phase, RallyResult } from './match.ts';

export const RESULT_NOTICE_SECONDS = 2;
const FADE_SECONDS = 0.35;
export function resultTitle(result: RallyResult): string {
  if (result.matchWinner) return result.matchWinner === 'player' ? 'YOU WIN!' : 'YOU LOSE!';
  if (result.kind === 'point') return result.side === 'player' ? `POINT! - ${SINGLES_NAMES.player} 득점` : 'CPU SCORES! - CPU 득점';
  return result.side === 'player' ? `${SINGLES_NAMES.player} SERVE!` : 'CPU SERVE!';
}
export function resultDetail(result: RallyResult): string {
  const score = `${result.score.player} : ${result.score.cpu}`;
  if (result.matchWinner) return `최종 점수 ${score} · ${result.matchWinner === 'player' ? `${SINGLES_NAMES.player} 승리` : 'CPU 승리'}`;
  const who = SINGLES_NAMES[result.side];
  return result.kind === 'point' ? `${score} · ${who} 서브 유지` : `${score} · 득점 없이 ${who}에게 서브권 이동`;
}

/** Real-time presentation clock, independent of the selected simulation speed. */
export class ResultNotice {
  result: RallyResult | null = null;
  private elapsed = 0;
  show(result: RallyResult) { this.result = result; this.elapsed = 0; }
  clear() { this.result = null; this.elapsed = 0; }
  get active(): boolean { return this.result !== null && this.elapsed < RESULT_NOTICE_SECONDS; }
  get opacity(): number {
    if (!this.active) return 0;
    const t = Math.max(0, Math.min(1, (this.elapsed - (RESULT_NOTICE_SECONDS - FADE_SECONDS)) / FADE_SECONDS));
    return 1 - t * t * (3 - 2 * t);
  }
  advance(realSeconds: number, paused = false) {
    if (!paused && this.active && Number.isFinite(realSeconds)) this.elapsed += Math.max(0, realSeconds);
  }
  canPrepareServe(phase: Phase): boolean { return phase === 'between' && this.result !== null && !this.active; }
}
