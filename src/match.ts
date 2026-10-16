export type Side = 'player' | 'cpu';
export type Phase = 'idle' | 'ready' | 'drop' | 'rally' | 'settling' | 'between' | 'over';
export interface RallyResult {
  readonly kind: 'point' | 'sideout';
  readonly side: Side;
  readonly score: Readonly<{ player: number; cpu: number }>;
  readonly matchWinner: Side | null;
}
export interface CourtPosition { x: number; z: number; grounded?: boolean }
// With no jump control, avatars are grounded. Optional airborne samples retain takeoff
// eligibility and keep momentum faults pending until both feet land outside the kitchen.
export const HALF_WIDTH = 3.048;
export const HALF_LENGTH = 6.7056;
export const KITCHEN = 2.1336;
export const LINE_HALF = 0.0254;
const FOOT_X = 0.23, FOOT_Z = 0.20;
export const other = (side: Side): Side => side === 'player' ? 'cpu' : 'player';
export const endSign = (side: Side) => side === 'player' ? 1 : -1;
export const sideName = (side: Side) => side === 'player' ? '나' : 'CPU';
export function inKitchen(p: CourtPosition): boolean {
  return Math.abs(p.x) <= HALF_WIDTH + LINE_HALF + FOOT_X && Math.abs(p.z) <= KITCHEN + LINE_HALF + FOOT_Z;
}
export function inCourt(p: CourtPosition): boolean {
  return Math.abs(p.x) <= HALF_WIDTH + LINE_HALF && Math.abs(p.z) <= HALF_LENGTH + LINE_HALF;
}

/** Side-out singles scoring and faults, independent of rendering and AI. */
export class SinglesMatch {
  phase: Phase = 'idle';
  score = { player: 0, cpu: 0 };
  server: Side = 'player';
  lastHitter: Side = 'player';
  winner: Side | null = null;
  result: RallyResult | null = null;
  hits = 0;
  message = '경기 시작을 누르면 11점 단식 경기를 시작합니다.';
  bounceRequired = { player: true, cpu: true };
  serveLandingPending = false;
  pending: { loser: Side; reason: string } | null = null;
  private settleTime = 0;
  private kitchenDeparture = { player: false, cpu: false };
  // Simplified grounded-avatar follow-through: at least 0.6s, longer while still advancing.
  private followThrough = { player: 0, cpu: 0 };
  private watching = { player: false, cpu: false };

  start() {
    this.score = { player: 0, cpu: 0 }; this.server = 'player'; this.winner = null;
    this.prepare();
  }
  prepare() {
    this.phase = 'ready'; this.pending = null; this.hits = 0; this.result = null;
    this.bounceRequired = { player: true, cpu: true }; this.serveLandingPending = false;
    this.kitchenDeparture = { player: false, cpu: false };
    this.watching = { player: false, cpu: false }; this.followThrough = { player: 0, cpu: 0 };
    this.message = `${sideName(this.server)} 서브 · ${this.score[this.server] % 2 === 0 ? '오른쪽' : '왼쪽'}에서 대각선으로!`;
  }
  get receiver(): Side { return other(this.lastHitter); }
  get serveX(): number { return (this.score[this.server] % 2 === 0 ? 1 : -1) * endSign(this.server) * 1.5; }
  get servePosition(): CourtPosition { return { x: this.serveX, z: endSign(this.server) * 7.3 }; }
  get serveTarget(): CourtPosition { return { x: -this.serveX, z: -endSign(this.server) * 4.8 }; }

  /** Grounded feet must remain wholly behind/between the service boundary extensions. */
  get serveMovementBounds() {
    const margin=0.01,innerX=FOOT_X+margin,outerX=HALF_WIDTH+LINE_HALF-FOOT_X-margin;
    const behind=HALF_LENGTH+LINE_HALF+FOOT_Z+margin,back=this.server==='player'?8.2:7.8;
    return {minX:this.serveX>0?innerX:-outerX,maxX:this.serveX>0?outerX:-innerX,
      minZ:this.server==='player'?behind:-back,maxZ:this.server==='player'?back:-behind};
  }
  /** Apply after every manual/assisted displacement; never restrict the receiver or rally. */
  constrainServeMovement(side:Side,position:CourtPosition,velocity?:{x:number;z:number}):boolean {
    if(side!==this.server||(this.phase!=='ready'&&this.phase!=='drop'))return false;
    const bounds=this.serveMovementBounds,oldX=position.x,oldZ=position.z;
    position.x=Math.max(bounds.minX,Math.min(bounds.maxX,position.x));
    position.z=Math.max(bounds.minZ,Math.min(bounds.maxZ,position.z));
    if(velocity){if(position.x!==oldX)velocity.x=0;if(position.z!==oldZ)velocity.z=0;}
    return position.x!==oldX||position.z!==oldZ;
  }

  serveLandingError(p: CourtPosition): string | undefined {
    if (!inCourt(p)) return '아웃! 코트 안쪽을 조준하세요.';
    if (p.z * endSign(this.server) >= 0) return '상대 서비스 코트를 조준하세요.';
    if (Math.abs(p.z) <= KITCHEN + LINE_HALF) return '서브 폴트: 키친과 키친 라인은 서브 착지 불가입니다.';
    if (p.x * Math.sign(this.serveTarget.x) < -LINE_HALF) return '서브 폴트: 대각선 서비스 코트에 넣어야 합니다.';
  }
  drop() {
    if (this.phase !== 'ready' && this.phase !== 'drop') return false;
    this.phase = 'drop'; this.message = this.server === 'player' ? '드롭 서브: 바운드한 공을 왼쪽 클릭으로 치세요.' : 'CPU가 드롭 서브를 준비합니다.';
    return true;
  }
  serve(side: Side, feet: CourtPosition): boolean {
    if (this.phase !== 'drop' || side !== this.server) return false;
    const correctX = Math.sign(this.serveX);
    const legalFeet = feet.z * endSign(side) - FOOT_Z > HALF_LENGTH + LINE_HALF &&
      feet.x * correctX - FOOT_X > 0 && Math.abs(feet.x) + FOOT_X < HALF_WIDTH + LINE_HALF;
    if (!legalFeet) { this.fault(side, '서브 발 반칙: 베이스라인 뒤, 지정된 좌우 구역 안에서 서브하세요.'); return false; }
    this.phase = 'rally'; this.lastHitter = side; this.serveLandingPending = true; this.hits = 1;
    this.message = `${sideName(side)}의 서브! 리시버는 반드시 한 번 바운드한 뒤 치세요.`;
    return true;
  }
  hit(side: Side, feet: CourtPosition, bounces: number): boolean {
    if (this.phase !== 'rally' || side !== this.receiver) return false;
    if (this.bounceRequired[side]) { this.fault(side, '투바운스 룰: 서브와 첫 리턴은 각각 바운드한 뒤 쳐야 합니다.'); return false; }
    if (feet.grounded !== false) this.kitchenDeparture[side] = inKitchen(feet);
    if (bounces === 0) {
      if ((feet.grounded !== false && inKitchen(feet)) || this.kitchenDeparture[side]) { this.fault(side, '키친 발리 반칙: 발이 키친 또는 경계선에 닿았습니다.'); return false; }
      this.watching[side] = true; this.followThrough[side] = 0.6;
    }
    this.lastHitter = side; this.hits++;
    this.message = `${sideName(side)} ${bounces === 0 ? '발리' : '타격'} · 랠리 ${this.hits}`;
    return true;
  }
  bounce(p: CourtPosition, count: number) {
    if (this.phase !== 'rally') return;
    if (count >= 2) { this.fault(this.receiver, '공이 두 번 바운드했습니다.'); return; }
    if (!inCourt(p)) { this.fault(this.lastHitter, '아웃!'); return; }
    if (p.z * endSign(this.receiver) <= 0) { this.fault(this.lastHitter, '공이 상대 코트에 도달하지 못했습니다.'); return; }
    if (this.serveLandingPending) {
      const error = this.serveLandingError(p);
      if (error) { this.fault(this.server, error); return; }
      this.serveLandingPending = false;
    }
    this.bounceRequired[this.receiver] = false;
    this.message = this.bounceRequired[other(this.receiver)] ? '바운드 확인! 리턴한 공도 서버 쪽에서 바운드해야 합니다.' : '투바운스 완료 · 키친 밖에서는 발리 가능';
  }
  net() { if (this.phase === 'rally') this.fault(this.lastHitter, '네트에 걸렸습니다.'); }
  updateFeet(side: Side, p: CourtPosition, dt: number, advancing: boolean) {
    if (p.grounded !== false) this.kitchenDeparture[side] = inKitchen(p);
    if (!this.watching[side] || (this.phase !== 'rally' && this.phase !== 'settling')) return;
    if (p.grounded !== false && inKitchen(p)) {
      this.watching[side] = false;
      this.fault(side, '키친 발리 반칙: 타격 후 관성 이동으로 키친에 들어갔습니다.');
      return;
    }
    this.followThrough[side] -= dt;
    if (this.followThrough[side] <= 0 && !advancing && p.grounded !== false) this.watching[side] = false;
  }
  fault(loser: Side, reason: string) {
    if (this.phase !== 'rally' && this.phase !== 'drop' && this.phase !== 'settling') return;
    // Follow-through faults may override a provisional ball-out/net result before scoring.
    this.pending = { loser, reason }; this.phase = 'settling'; this.settleTime = 0.65;
    this.message = `${sideName(loser)} 폴트 · ${reason}`;
  }
  tick(dt: number) {
    if (this.phase !== 'settling') return;
    this.settleTime -= dt;
    if (this.settleTime > 0 || this.watching.player || this.watching.cpu || !this.pending) return;
    const winner = other(this.pending.loser);
    const serverWon = winner === this.server;
    if (serverWon) {
      this.score[winner]++;
      this.message += ` ${sideName(winner)} +1점.`;
    } else {
      this.server = winner;
      this.message += ` 득점 없이 ${sideName(winner)}에게 서브권 이동.`;
    }
    if (this.score[winner] >= 11 && this.score[winner] - this.score[other(winner)] >= 2) {
      this.winner = winner; this.phase = 'over';
      this.message = `${winner === 'player' ? '승리했습니다!' : 'CPU가 승리했습니다.'} ${this.score.player} : ${this.score.cpu}`;
    } else this.phase = 'between';
    this.result = { kind: serverWon ? 'point' : 'sideout', side: winner, score: { ...this.score }, matchWinner: this.winner };
  }
}
