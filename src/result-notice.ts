import {t} from './i18n/index.ts';
import {SINGLES_NAMES} from './display-names.ts';
import type { Phase, RallyResult } from './match.ts';

export const RESULT_NOTICE_SECONDS = 2;
const FADE_SECONDS = 0.35;
export function resultTitle(result: RallyResult): string {
  if(result.matchWinner)return t(result.matchWinner==='player'?'result.win':'result.lose');
  if(result.kind==='point')return t(result.side==='player'?'result.youPoint':'result.cpuPoint',{name:SINGLES_NAMES.player});
  return t(result.side==='player'?'result.youServe':'result.cpuServe');
}
export function resultDetail(result:RallyResult):string {
  const score=`${result.score.player} : ${result.score.cpu}`;
  if(result.matchWinner)return t('result.final',{score,name:SINGLES_NAMES[result.matchWinner]});
  return t(result.kind==='point'?'result.keep':'result.sideout',{score,name:SINGLES_NAMES[result.side]});
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
