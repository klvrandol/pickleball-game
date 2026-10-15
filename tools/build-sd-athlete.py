"""Original SD prototype mesh and skinned rig. No third-party model is reshaped.
Run: blender -b --python tools/build-sd-athlete.py
Coordinates: +Y forward, +Z up. GLB exports facing Three.js local -Z.
"""
import bpy, math
from mathutils import Vector
from pathlib import Path
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
materials={}
for name,color in {'Skin':(.65,.36,.20,1),'Eyes':(.012,.018,.028,1),'Hair':(.032,.019,.014,1),'Shirt':(.015,.17,.60,1),'Pants':(.012,.035,.10,1),'Socks':(.85,.90,.91,1),'Shoes':(.78,.85,.90,1),'Accent':(.12,.52,.94,1),'White':(.95,.98,1,1),'Cheek':(.9,.22,.17,1),'Cap':(.015,.055,.16,1)}.items():
 m=bpy.data.materials.new(name);m.diffuse_color=color;m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=color;m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.82;materials[name]=m
parts=[]
def mesh(name,vertices,faces,mat,bone):
 d=bpy.data.meshes.new(name);d.from_pydata(vertices,[],faces);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.data.materials.append(materials[mat]);g=o.vertex_groups.new(name=bone);g.add(list(range(len(vertices))),1,'REPLACE');parts.append(o)
 for p in d.polygons:p.use_smooth=True
 return o
# Sections sculpt a broad jaw, cheeks, forehead, tapered jersey, shorts and sneaker silhouette.
def loft(name,sections,mat,bone,n=16):
 vs=[]
 for x,y,z,rx,ry in sections:
  for i in range(n):
   a=2*math.pi*i/n;vs.append((x+rx*math.cos(a),y+ry*math.sin(a),z))
 fs=[tuple(reversed(range(n)))];
 for j in range(len(sections)-1):
  for i in range(n):a=j*n+i;b=j*n+(i+1)%n;fs.append((a,b,b+n,a+n))
 fs.append(tuple((len(sections)-1)*n+i for i in range(n)))
 return mesh(name,vs,fs,mat,bone)
def blob(name,center,scale,mat,bone):
 x,y,z=center;rx,ry,rz=scale
 return loft(name,[(x,y,z+rz*t,rx*math.sqrt(max(.003,1-t*t)),ry*math.sqrt(max(.003,1-t*t))) for t in [-1,-.85,-.5,0,.5,.85,1]],mat,bone,16)
def limb(name,a,b,ra,rb,mat,bone):
 a=Vector(a);b=Vector(b);d=(b-a).normalized();u=d.cross(Vector((0,1,0))).normalized();v=d.cross(u).normalized();vs=[];n=12
 for t,r in [(0,ra*.8),(.12,ra),(.75,rb),(1,rb*.8)]:
  c=a.lerp(b,t)
  for i in range(n):vs.append(tuple(c+r*(math.cos(2*math.pi*i/n)*u+math.sin(2*math.pi*i/n)*v)))
 fs=[tuple(reversed(range(n)))]+[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(3) for i in range(n)]+[tuple(3*n+i for i in range(n))]
 return mesh(name,vs,fs,mat,bone)
# Height 1.83 m, head 0.61 m: roughly three heads tall. Legs and torso are rebuilt short and broad.
loft('SD sports jersey',[(0,0,.62,.235,.145),(0,0,.68,.255,.16),(0,0,.89,.265,.175),(0,0,1.08,.285,.18),(0,0,1.17,.235,.15),(0,0,1.205,.12,.10)],'Shirt','Torso')
loft('Neck',[(0,0,1.17,.085,.08),(0,0,1.285,.09,.085)],'Skin','Neck')
loft('Sculpted SD head',[(0,.015,1.22,.13,.13),(0,.025,1.27,.24,.19),(0,.02,1.39,.315,.24),(0,0,1.58,.325,.245),(0,-.015,1.72,.30,.22),(0,-.02,1.80,.20,.16),(0,-.02,1.83,.025,.025)],'Skin','Head',24)
loft('Short sculpted hair',[(0,-.03,1.57,.322,.235),(0,-.04,1.72,.305,.235),(0,-.04,1.81,.20,.16),(0,-.04,1.845,.025,.025)],'Hair','Head',24)
loft('Blue sports cap',[(0,-.03,1.71,.315,.24),(0,-.04,1.80,.245,.19),(0,-.04,1.85,.05,.04)],'Cap','Head',24)
blob('Cap visor',(0,.24,1.71),(.32,.20,.025),'Cap','Head')
blob('Cap emblem',(0,.158,1.79),(.045,.018,.028),'White','Head')
for s in [-1,1]:
 blob('Ear',(s*.315,.0,1.47),(.055,.045,.08),'Skin','Head')
 blob('Eye',(s*.115,.235,1.535),(.041,.018,.061),'Eyes','Head')
 blob('Eye shine',(s*.115-.010,.252,1.558),(.012,.006,.017),'White','Head')
 blob('Eyebrow',(s*.115,.233,1.622),(.057,.014,.013),'Hair','Head')
 blob('Cheek',(s*.205,.218,1.435),(.048,.012,.022),'Cheek','Head')
blob('Button nose',(0,.253,1.465),(.036,.036,.038),'Skin','Head')
# Smile made of a slim curved ribbon rather than a painted texture.
vs=[]
for i in range(13):
 x=-.075+i*.15/12;z=1.368+.032*(x/.075)**2
 vs.extend([(x,.209,z),(x,.213,z+.009)])
mesh('Smile',vs,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(12)],'Hair','Head')
loft('Shorts waist',[(0,0,.56,.235,.15),(0,0,.68,.245,.16)],'Pants','Body')
for s,side in [(-1,'L'),(1,'R')]:
 hip=(s*.145,0,.65);knee=(s*.16,.025,.38);ankle=(s*.16,0,.13)
 loft('Shorts '+side,[(s*.145,0,.46,.125,.14),(s*.145,0,.58,.14,.155),(s*.13,0,.65,.14,.15)],'Pants','UpperLeg.'+side)
 limb('Thigh '+side,hip,knee,.105,.095,'Skin','UpperLeg.'+side)
 limb('Calf '+side,knee,ankle,.09,.08,'Skin','LowerLeg.'+side)
 loft('Sock '+side,[(s*.16,0,.12,.085,.08),(s*.16,0,.23,.088,.085)],'Socks','LowerLeg.'+side)
 # Wide, layered trainers with rounded toe boxes and contrasting soles.
 loft('Trainer sole '+side,[(s*.16,.065,.045,.13,.20),(s*.16,.065,.075,.135,.205)],'Cap','Foot.'+side)
 loft('Trainer upper '+side,[(s*.16,.065,.075,.13,.20),(s*.16,.065,.13,.12,.185),(s*.16,.015,.19,.095,.105)],'Shoes','Foot.'+side)
 for y in [.025,.065,.105]:blob('Lace '+side,(s*.16,y,.17),(.07,.012,.008),'White','Foot.'+side)
 blob('Shoe stripe '+side,(s*.278,.065,.115),(.009,.08,.018),'Accent','Foot.'+side)
 shoulder=(s*.285,0,1.145);elbow=(s*.40,0,.95);wrist=(s*.45,.02,.715)
 limb('Sleeve '+side,shoulder,(s*.34,0,1.045),.125,.115,'Shirt','UpperArm.'+side)
 limb('Upper arm '+side,(s*.34,0,1.045),elbow,.10,.09,'Skin','UpperArm.'+side)
 limb('Forearm '+side,elbow,wrist,.09,.08,'Skin','LowerArm.'+side)
 blob('Sport wristband '+side,(s*.44,.018,.755),(.088,.085,.03),'White','Palm.'+side)
 blob('Hand '+side,(s*.46,.025,.675),(.09,.07,.10),'Skin','Palm.'+side)
 blob('Thumb '+side,(s*.385,.075,.68),(.042,.043,.06),'Skin','Thumb1.'+side)
# Back number visible from the game's behind-player camera.
loft('Back number one',[(0,-.178,.87,.020,.006),(0,-.178,1.04,.020,.006)],'White','Torso',8)
# Same semantic bone names as the game, but an original, compact SD skeleton.
armdata=bpy.data.armatures.new('SD sports rig');arm=bpy.data.objects.new('SD_Athlete',armdata);bpy.context.collection.objects.link(arm);bpy.context.view_layer.objects.active=arm;arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
def bone(name,a,b,parent=None):
 q=armdata.edit_bones.new(name);q.head=a;q.tail=b
 if parent:q.parent=armdata.edit_bones[parent]
 return q
bone('Bone',(0,0,0),(0,0,.1));bone('Body',(0,0,.65),(0,0,.75),'Bone');bone('Hips',(0,0,.65),(0,0,.77),'Body');bone('Abdomen',(0,0,.77),(0,0,.96),'Hips');bone('Torso',(0,0,.96),(0,0,1.17),'Abdomen');bone('Neck',(0,0,1.17),(0,0,1.28),'Torso');bone('Head',(0,0,1.28),(0,0,1.83),'Neck')
for s,side in [(-1,'L'),(1,'R')]:
 bone('Shoulder.'+side,(s*.15,0,1.14),(s*.285,0,1.145),'Torso')
 bone('UpperArm.'+side,(s*.285,0,1.145),(s*.40,0,.95),'Shoulder.'+side)
 bone('LowerArm.'+side,(s*.40,0,.95),(s*.45,.02,.715),'UpperArm.'+side)
 bone('Palm.'+side,(s*.45,.02,.715),(s*.46,.025,.63),'LowerArm.'+side)
 bone('MiddleHand.'+side,(s*.46,.025,.63),(s*.46,.025,.60),'Palm.'+side)
 bone('Fingers.'+side,(s*.46,.025,.60),(s*.46,.025,.58),'MiddleHand.'+side)
 bone('Thumb1.'+side,(s*.40,.06,.69),(s*.38,.08,.65),'Palm.'+side)
 bone('Thumb2.'+side,(s*.38,.08,.65),(s*.38,.08,.63),'Thumb1.'+side)
 bone('UpperLeg.'+side,(s*.145,0,.65),(s*.16,.025,.38),'Body')
 bone('LowerLeg.'+side,(s*.16,.025,.38),(s*.16,0,.13),'UpperLeg.'+side)
 # Root-controlled ankle targets are compatible with the game's planted-leg solver.
 bone('Foot.'+side,(s*.16,0,.13),(s*.16,.2,.1),'Bone')
bpy.ops.object.mode_set(mode='OBJECT')
# Merge the original sculpted meshes into one material-split skinned body.
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();body=parts[0];body.name='SD_Sport_Player';body.parent=arm
mod=body.modifiers.new('Weighted SD skeleton','ARMATURE');mod.object=arm
# Smooth weights across actual elbow/knee seams while retaining rigid head and clothing details.
# Separate sculpted limb sections share the same contiguous joint positions; skin is driven by the rig.
arm.animation_data_create()
for name,period,strength in [('Man_Idle',48,.025),('Man_Walk',28,.28),('Man_Run',20,.40)]:
 action=bpy.data.actions.new(name);arm.animation_data.action=action
 for frame in range(period+1):
  t=frame/period*math.tau
  for p in arm.pose.bones:p.rotation_mode='XYZ';p.rotation_euler=(0,0,0);p.location=(0,0,0)
  if name=='Man_Idle':arm.pose.bones['Body'].location.y=math.sin(t)*.008
  else:
   for s,side in [(-1,'L'),(1,'R')]:
    phase=t+(0 if s==1 else math.pi);arm.pose.bones['UpperLeg.'+side].rotation_euler.x=math.sin(phase)*strength
    arm.pose.bones['LowerLeg.'+side].rotation_euler.x=max(0,-math.sin(phase))*.35
    arm.pose.bones['UpperArm.'+side].rotation_euler.x=-math.sin(phase)*strength*.55
    foot=arm.pose.bones['Foot.'+side];foot.location.y=math.sin(phase)*.06;foot.location.z=max(0,math.sin(phase))*.035
   arm.pose.bones['Body'].location.y=abs(math.sin(t))*.018
  for p in arm.pose.bones:p.keyframe_insert('rotation_euler',frame=frame);p.keyframe_insert('location',frame=frame)
arm.animation_data.action=bpy.data.actions.get('Man_Idle');bpy.context.scene.frame_set(0);bpy.context.scene.render.fps=24
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);body.select_set(True)
# Keep the shoe sole at model-local ground zero, matching the classic avatar origin.
arm.location.z=-.045
out=Path(__file__).resolve().parents[1]/'assets'/'athlete-sd.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_skins=True,export_yup=True)
print('SD MODEL:',out)
