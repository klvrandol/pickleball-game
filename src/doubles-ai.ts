import { MathUtils, Vector3 } from 'three';
import { PracticeBall, type Shot } from './ball.ts';
import { predictContact } from './cpu.ts';
import { canContact, SWING_CONTACT_DELAY } from './volley.ts';
import { SwingMotion } from './swing.ts';
import { endSign, inKitchen, type Side } from './match.ts';
import { TEAM, MEMBERS, type ActorId, type DoublesMatch } from './doubles-match.ts';
export function mirroredBall(ball:PracticeBall,team:Side):PracticeBall {
  const out=new PracticeBall(),sign=team==='cpu'?1:-1;
  out.position.copy(ball.position).multiplyScalar(sign);out.position.y=ball.position.y;
  out.velocity.copy(ball.velocity).multiplyScalar(sign);out.velocity.y=ball.velocity.y;
  out.active=ball.active;out.bounces=ball.bounces;out.netTouched=ball.netTouched;return out;
}
export function teamPrediction(ball:PracticeBall,p:Vector3,team:Side,volley:boolean):Vector3 {
  const sign=team==='cpu'?1:-1,local=p.clone().multiplyScalar(sign);local.y=p.y;
  const predicted=predictContact(mirroredBall(ball,team),local,volley).multiplyScalar(sign);predicted.y=.045;return predicted;
}
/** Exactly one owner per incoming shot; hysteresis prevents teammates chasing the same ball. */
export class TeamCoordinator {
  owner:ActorId|null=null;
  private hit=-1;private refresh=0;
  update(dt:number,m:DoublesMatch,ball:PracticeBall,positions:Record<ActorId,Vector3>) {
    if(m.phase!=='rally'){this.owner=null;this.hit=-1;return;}
    if(m.hits===1){this.owner=m.designatedReceiver;this.hit=m.hits;return;}
    this.refresh-=dt;
    if(this.hit===m.hits&&this.refresh>0)return;
    const members=MEMBERS[m.receiver],volley=m.hits>=3&&!m.bounceRequired[m.receiver];
    const costs=members.map(id=>{
      const target=teamPrediction(ball,positions[id],m.receiver,volley);
      const distance=Math.hypot(target.x-positions[id].x,target.z-positions[id].z);
      return {id,cost:distance-(id===this.owner? .65:0)};
    }).sort((a,b)=>a.cost-b.cost);
    // A player already at a playable contact always has priority over their partner.
    this.owner=m.receiver==='player'&&canContact(positions.ranger,ball.position)?'ranger':costs[0].id;
    this.hit=m.hits;this.refresh=.25;
  }
}
export interface DoublesReply {shot:Shot;target:Vector3;missed:boolean}
export class DoublesAgent {
  motion=new SwingMotion();position=new Vector3();destination=new Vector3();stride=0;moving=false;status='준비';
  pending:{remaining:number;shot:Shot;target:Vector3;missed:boolean}|null=null;
  private hit=-1;private reaction=0;private refresh=0;private attempted=false;
  readonly id:ActorId;private random:()=>number;
  constructor(id:ActorId,random:()=>number=Math.random){this.id=id;this.random=random;}
  reset(p:Vector3){this.position.copy(p);this.destination.copy(p);this.motion.clear();this.pending=null;this.hit=-1;this.attempted=false;this.moving=false;}
  update(dt:number,m:DoublesMatch,ball:PracticeBall,owner:ActorId|null,positions:Record<ActorId,Vector3>):DoublesReply|undefined {
    this.motion.advance(dt);this.moving=false;
    if(m.phase!=='rally'){this.pending=null;return;}
    const team=TEAM[this.id],sign=endSign(team),receiving=team===m.receiver&&owner===this.id;
    const volleyAllowed=m.hits>=3&&!m.bounceRequired[team];
    if(this.hit!==m.hits){this.hit=m.hits;this.reaction=.22+this.random()*.16;this.refresh=0;this.attempted=false;this.pending=null;}
    if(this.pending){
      this.pending.remaining-=dt;
      if(!receiving||!ball.active){this.pending=null;return;}
      if(this.pending.remaining>0)return;
      const reply=this.pending;this.pending=null;
      if(!canContact(this.position,ball.position))return {...reply,missed:true};
      this.motion.impact(this.position,ball.position,sign===1?0:Math.PI,ball.bounces===0);
      return reply;
    }
    if(receiving&&!this.attempted){
      this.reaction=Math.max(0,this.reaction-dt);if(this.reaction>0){this.status='반응 중';return;}
      this.refresh-=dt;
      if(this.refresh<=0){this.destination.copy(teamPrediction(ball,this.position,team,volleyAllowed));this.destination.x+=(this.random()-.5)*.25;this.refresh=.16;}
      this.status='공 처리';
    }else{
      const mate=MEMBERS[team].find(id=>id!==this.id)!,otherX=positions[mate].x;
      const lane=owner&&TEAM[owner]===team?(positions[owner].x>=0?-1:1):(m.right[team]===this.id?sign:-sign);
      this.destination.set(lane*1.55,.045,sign*(volleyAllowed?2.9:4.6));
      if(Math.abs(otherX-this.destination.x)<.75)this.destination.x=-Math.sign(otherX||1)*1.6;
      this.status='빈 공간 커버';
    }
    // Unbounced approaches stay behind the kitchen. Bounced short balls may be chased inside.
    if(receiving&&ball.bounces===0)this.destination.z=sign*Math.max(2.65,Math.abs(this.destination.z));
    const dx=this.destination.x-this.position.x,dz=this.destination.z-this.position.z,distance=Math.hypot(dx,dz);
    if(distance>.08){const step=Math.min(distance,(receiving?3.25:2.25)*dt);this.position.x+=dx/distance*step;this.position.z+=dz/distance*step;this.moving=true;this.stride+=dt*10;}
    this.position.x=MathUtils.clamp(this.position.x,-3.8,3.8);this.position.z=sign*MathUtils.clamp(this.position.z*sign,.6,7.8);
    if(!receiving||this.attempted||!ball.active||ball.position.z*sign<=.3)return;
    const volley=ball.bounces===0;
    if(volley&&(!volleyAllowed||inKitchen(this.position)))return;
    if(ball.bounces!==1&&!volley)return;
    if(!canContact(this.position,ball.position)||ball.position.y<.45||ball.position.y>1.85)return;
    this.attempted=true;
    const reach=Math.hypot(ball.position.x-this.position.x,ball.position.z-this.position.z);
    const difficulty=Math.max(0,reach-.65)+Math.max(0,ball.velocity.length()-9)*.055;
    const shot:Shot=(Math.abs(this.position.z)<3.3&&ball.velocity.length()<10&&ball.position.y<1.45&&this.random()<.65)?'dink':'drive';
    const enemies=MEMBERS[team==='player'?'cpu':'player'];
    const open=positions[enemies[0]].x+positions[enemies[1]].x>=0?-1:1;
    const target=new Vector3((this.random()<.35?open*2.1:(this.random()-.5)*3.8)+(this.random()-.5)*difficulty,-0,-sign*(shot==='dink'?1.5:4.6));
    const missed=this.random()<(volley?.09:.025)+difficulty*.22;
    this.motion.begin(this.position,ball.position,sign===1?0:Math.PI,shot,volley,SWING_CONTACT_DELAY);
    this.motion.aimAt(this.position,target,sign===1?0:Math.PI);
    this.pending={remaining:SWING_CONTACT_DELAY,shot,target,missed};this.status=volley?'발리':shot==='dink'?'딩크':'드라이브';
  }
}
/** Only AI yields to the human; never changes the player's logical contact root. */
export function separateTeammates(ai:Vector3,mate:Vector3,dt:number){
  const dx=ai.x-mate.x,dz=ai.z-mate.z,d=Math.hypot(dx,dz);
  if(d>=.72)return;
  const amount=Math.min(.72-d,1.7*dt);ai.x+=(d>.001?dx/d:1)*amount;ai.z+=(d>.001?dz/d:0)*amount;
}
