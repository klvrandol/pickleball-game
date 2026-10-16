import {t,localizeText} from './i18n/index.ts';
import {DOUBLES_NAMES} from './display-names.ts';
import { SinglesMatch, endSign, other, inKitchen, type Side, type CourtPosition } from './match.ts';
export type ActorId = 'ranger' | 'rogue' | 'barbarian' | 'mage';
export const TEAM: Record<ActorId, Side> = {ranger:'player',rogue:'player',barbarian:'cpu',mage:'cpu'};
export const MEMBERS: Record<Side, readonly ActorId[]> = {player:['ranger','rogue'],cpu:['barbarian','mage']};
export const NAMES: Record<ActorId,string> = DOUBLES_NAMES;
export interface DoublesResult {
  kind:'point'|'second-server'|'sideout'; side:Side; score:{player:number;cpu:number};
  server:ActorId; serverNumber:1|2; winner:Side|null;
}
/** Side-out doubles. Reuses the unchanged singles rally/ball fault engine, not singles service order. */
export class DoublesMatch extends SinglesMatch {
  serverNumber:1|2=2;
  serverId:ActorId='ranger';
  // The right/even starting player remains tied to team score parity through side-outs.
  right:Record<Side,ActorId>={player:'ranger',cpu:'barbarian'};
  doublesResult:DoublesResult|null=null;
  private volleyWatch:Partial<Record<ActorId,number>>={};
  private airborneKitchen:Record<ActorId,boolean>={ranger:false,rogue:false,barbarian:false,mage:false};
  start() {
    this.right={player:'ranger',cpu:'barbarian'};this.serverId='ranger';this.serverNumber=2;
    this.volleyWatch={};this.airborneKitchen={ranger:false,rogue:false,barbarian:false,mage:false};
    super.start();this.doublesResult=null;
  }
  prepare() {super.prepare();this.doublesResult=null;this.volleyWatch={};this.message=`${this.scoreCall} · ${NAMES[this.serverId]} 서브`;} 
  get serveX() {return (this.right[this.server]===this.serverId?1:-1)*endSign(this.server)*1.5;}
  get designatedReceiver():ActorId {
    const receiving=other(this.server);
    // Diagonal receiver is on the same local half as the server, seen from the other end.
    return this.right[this.server]===this.serverId?this.right[receiving]:this.partner(this.right[receiving]);
  }
  get scoreCall() {return `${this.score[this.server]}-${this.score[other(this.server)]}-${this.serverNumber}`;}
  partner(id:ActorId):ActorId {return MEMBERS[TEAM[id]].find(a=>a!==id)!;}
  startPosition(id:ActorId):CourtPosition {
    const team=TEAM[id],sign=endSign(team),x=(this.right[team]===id?1:-1)*sign*1.5;
    return {x,z:sign*(id===this.serverId?7.3:team===this.server?7.1:5.8)};
  }
  constrainActor(id:ActorId,p:CourtPosition,v?:{x:number;z:number}) {return id===this.serverId?this.constrainServeMovement(TEAM[id],p,v):false;}
  drop(){const accepted=super.drop();if(accepted)this.message=`${NAMES[this.serverId]} 드롭 서브 · ${this.serverId==='ranger'?'바운드 후 클릭하세요.':'AI가 자동으로 서브합니다.'}`;return accepted;}
  serveActor(id:ActorId,feet:CourtPosition):boolean {
    if(id!==this.serverId){this.fault(TEAM[id],'잘못된 서버입니다.');return false;}
    const accepted=super.serve(TEAM[id],feet);
    if(accepted)this.message=`${NAMES[id]} 서브! 지정 리시버는 ${NAMES[this.designatedReceiver]}입니다.`;
    return accepted;
  }
  hitActor(id:ActorId,feet:CourtPosition,bounces:number):boolean {
    const team=TEAM[id];
    if(this.phase!=='rally'||team!==this.receiver)return false;
    if(this.hits===1&&id!==this.designatedReceiver){this.fault(team,'지정된 대각선 리시버가 서브를 받아야 합니다.');return false;}
    if(bounces===0&&this.airborneKitchen[id]){this.fault(team,'키친에서 도약한 발리 반칙입니다.');return false;}
    if(bounces===0&&inKitchen(feet)){this.fault(team,'키친 또는 키친 라인 발리 반칙입니다.');return false;}
    // The inherited rule engine validates turns and mandatory bounces. Individual
    // momentum watches live here, so a partner's feet cannot trigger a false fault.
    const accepted=super.hit(team,feet,1);
    if(accepted){if(bounces===0)this.volleyWatch[id]=.6;this.message=`${NAMES[id]} ${bounces===0?'발리':'타격'} · 랠리 ${this.hits}`;}
    return accepted;
  }
  updateActorFeet(id:ActorId,p:CourtPosition,dt:number,advancing:boolean) {
    if(p.grounded!==false)this.airborneKitchen[id]=inKitchen(p);
    if(this.volleyWatch[id]===undefined)return;
    if(this.phase!=='rally'&&this.phase!=='settling')return;
    if(p.grounded!==false&&inKitchen(p)){
      delete this.volleyWatch[id];this.fault(TEAM[id],'키친 발리 반칙: 타격 후 관성으로 진입했습니다.');return;
    }
    this.volleyWatch[id]!-=dt;
    if(this.volleyWatch[id]!<=0&&!advancing&&p.grounded!==false)delete this.volleyWatch[id];
  }
  fault(loser:Side,reason:string){super.fault(loser,reason);if(this.phase==='settling')this.message=`${loser==='player'?'우리 팀':'상대 팀'} 폴트 · ${reason}`;}
  tick(dt:number) {
    const oldServer=this.server,oldNumber=this.serverNumber;
    super.tick(Object.keys(this.volleyWatch).length?0:dt);
    if(!this.result||this.doublesResult)return;
    let kind:DoublesResult['kind'];
    if(this.result.kind==='point'){
      kind='point';this.right[oldServer]=this.partner(this.right[oldServer]);
    }else if(oldNumber===1){
      kind='second-server';this.server=oldServer;this.serverNumber=2;this.serverId=this.partner(this.serverId);
    }else{
      kind='sideout';this.serverNumber=1;this.serverId=this.right[this.server];
    }
    this.doublesResult={kind,side:this.result.side,score:{...this.score},server:this.serverId,serverNumber:this.serverNumber,winner:this.winner};
    this.message=`${this.pending?.reason??''} · ${doublesTitle(this.doublesResult)} · ${this.scoreCall}`;
  }
}
export function doublesTitle(r:DoublesResult):string {
  if(r.winner)return t(r.winner==='player'?'doubles.win':'doubles.lose');
  if(r.kind==='point')return t(r.side==='player'?'doubles.ourPoint':'doubles.theirPoint');
  return t(r.kind==='sideout'?'doubles.sideoutServer':'doubles.server',{
    team:localizeText(TEAM[r.server]==='player'?'우리 팀':'상대 팀'),
    number:t(r.serverNumber===1?'server.first':'server.second'),
  });
}
