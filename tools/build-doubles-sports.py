"""Non-destructive Ranger sports outfit. Blender 4.3+: blender -b --python tools/build-ranger-sports.py
Preserves the source head mesh/UV/material, armature, bind pose, and retained hand/shoe weights.
New garment surfaces receive normalized weights from the corresponding original skinned surface.
"""
import bpy, bmesh, math, sys
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
ROOT=Path(__file__).resolve().parents[1]
CHARACTER='Mage' if '--mage' in sys.argv else 'Rogue'
RED=CHARACTER=='Mage'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/(CHARACTER+'.glb')))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
originals={o.name.replace(CHARACTER+'_','Ranger_'):o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith(CHARACTER+'_')}
head=originals['Ranger_Head']

def material(name,color):
 m=bpy.data.materials.new(name);m.use_nodes=True
 rgb=[int(color[i:i+2],16)/255 for i in (0,2,4)]
 rgb=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
 m.diffuse_color=(*rgb,1);bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1);bs.inputs['Roughness'].default_value=.82
 return m
BLUE=material('Sports_Shirt_Red' if RED else 'Sports_Shirt_Blue','d83b43' if RED else '217cd0');NAVY=material('Sports_Shorts_Navy','512838' if RED else '193954')
WHITE=material('Sports_Trim_White','eef4ef');SIDE=material('Sports_Panel_Red' if RED else 'Sports_Panel_Blue','9f2334' if RED else '125294')
SKIN=material('Sports_Skin','e0b48d');SOLE=material('Sports_Sole','d7e2e8')
MATS=[BLUE,NAVY,WHITE,SIDE,SKIN,SOLE]

# Cache source skin weights before editing/deleting any geometry.
def source_data(obj):
 kd=KDTree(len(obj.data.vertices));weights=[]
 for v in obj.data.vertices:
  kd.insert(v.co,v.index);weights.append({obj.vertex_groups[g.group].name:g.weight for g in v.groups if g.weight>1e-5})
 kd.balance();return kd,weights
sources={name:source_data(obj) for name,obj in originals.items()}

def weight_mesh(obj,source):
 kd,weights=sources[source]
 groups={b.name:obj.vertex_groups.new(name=b.name) for b in arm.data.bones}
 for v in obj.data.vertices:
  mixed={}
  for _,idx,d in kd.find_n(v.co,3):
   w=1/max(.00001,d*d)
   for name,value in weights[idx].items():mixed[name]=mixed.get(name,0)+w*value
  strongest=sorted(mixed.items(),key=lambda item:item[1],reverse=True)[:4];total=sum(v for _,v in strongest)
  for name,value in strongest:
   if total:groups[name].add([v.index],value/total,'REPLACE')
 mod=obj.modifiers.new('Original Ranger skin','ARMATURE');mod.object=arm;obj.parent=arm

def mesh(name,verts,faces,mats,source):
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
 for m in MATS:data.materials.append(m)
 for f,index in zip(data.polygons,mats):f.material_index=index;f.use_smooth=True
 weight_mesh(obj,source);return obj

def tube(name,rings,axis,source,colors=None,segments=16,center=(0,0,0)):
 verts=[];faces=[];mats=[]
 for a,r1,r2 in rings:
  for i in range(segments):
   t=2*math.pi*i/segments
   verts.append((a,center[1]+math.cos(t)*r1,center[2]+math.sin(t)*r2) if axis=='x' else (center[0]+math.cos(t)*r1,center[1]+math.sin(t)*r2,a))
 for k in range(len(rings)-1):
  for i in range(segments):
   face=(k*segments+i,k*segments+(i+1)%segments,(k+1)*segments+(i+1)%segments,(k+1)*segments+i)
   faces.append(face);mats.append(colors[k] if colors else 0)
 faces.extend([tuple(range(segments-1,-1,-1)),tuple((len(rings)-1)*segments+i for i in range(segments))]);mats.extend([mats[0],mats[-1]])
 return mesh(name,verts,faces,mats,source)

# Remove entire isolated adventure objects, not just their colors.
for name in ['Ranger_Cape','Ranger_Quiver','Ranger_BearHat','Ranger_Hat']:
 if name in originals:bpy.data.objects.remove(originals[name],do_unlink=True)
# Body contains scarf, harness, belt, pouches and tunic in a single object.
# Replace that garment shell with a proper jersey + separate shorts; keep head and rig.
body=originals['Ranger_Body']
tube('Sports_Jersey',[(.62,.30,.23),(.67,.31,.24),(.96,.30,.235),(1.10,.29,.22),(1.16,.265,.20),(1.20,.125,.115)],'z','Ranger_Body',[3,0,0,0,0])
tube('Sports_Collar',[(1.195,.128,.118),(1.22,.126,.116)],'z','Ranger_Body',[2])
tube('Sports_Neck',[(1.20,.105,.10),(1.27,.105,.10)],'z','Ranger_Body',[4])
tube('Sports_Waistband',[(.58,.30,.23),(.635,.30,.23)],'z','Ranger_Body',[1])
for sign,side in [(1,'Left'),(-1,'Right')]:
 src='Ranger_Arm'+side
 rings=[(sign*x,ry,rz) for x,ry,rz in [(.20,.125,.125),(.30,.14,.14),(.40,.125,.125),(.43,.12,.12),(.445,.12,.12)]]
 if sign<0:rings.reverse()
 tube('Sports_Sleeve'+side,rings,'x',src,[0,0,0,2] if sign>0 else [2,0,0,0],center=(0,0,1.1068))
 # Bare arms replace leather bracers; hand/palm geometry and original skin weights remain.
 rings=[(sign*x,r,r) for x,r in [(.435,.10),(.47,.10),(.62,.096),(.71,.09),(.787,.093),(.84,.095),(.90,.095)]]
 if sign<0:rings.reverse()
 tube('Sports_Forearm'+side,rings,'x',src,[4]*6,center=(0,0,1.1068))
 obj=originals[src];bm=bmesh.new();bm.from_mesh(obj.data)
 bmesh.ops.delete(bm,geom=[v for v in bm.verts if abs(v.co.x)<.786],context='VERTS')
 # Remove the original raised leather cuff pieces, preserving thumb and main palm.
 unseen=set(bm.verts);cuffs=[]
 while unseen:
  todo=[unseen.pop()];part=set(todo)
  while todo:
   for e in todo.pop().link_edges:
    for v in e.verts:
     if v in unseen:unseen.remove(v);part.add(v);todo.append(v)
  if min(abs(v.co.x) for v in part)>.84 and max(abs(v.co.x) for v in part)<.90:cuffs.extend(part)
 bmesh.ops.delete(bm,geom=cuffs,context='VERTS');bm.to_mesh(obj.data);bm.free()
 obj.data.materials.clear()
 for m in MATS:obj.data.materials.append(m)
 for f in obj.data.polygons:
  x=sum(abs(obj.data.vertices[i].co.x) for i in f.vertices)/len(f.vertices)
  f.material_index=4
 rings=[(sign*x,.104,.104) for x in [.75,.775,.80]]
 if sign<0:rings.reverse()
 tube('Sports_Wristband'+side,rings,'x',src,[0,2] if sign>0 else [2,0],center=(0,0,1.1068))
 # Separate short legs and exposed calves, with white socks.
 legsrc='Ranger_Leg'+side
 tube('Sports_Shorts'+side,[(.30,.123,.119),(.335,.128,.122),(.53,.151,.17),(.61,.155,.185)],'z',legsrc,[2,1,1],center=(sign*.17,0,0))
 tube('Sports_Calf'+side,[(.155,.103,.104),(.21,.102,.102),(.225,.098,.098),(.30,.10,.10),(.39,.106,.106)],'z',legsrc,[2,2,4,4],center=(sign*.17,0,0))
 shoe=originals[legsrc];bm=bmesh.new();bm.from_mesh(shoe.data)
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.00001,plane_co=(0,0,.16),plane_no=(0,0,1),clear_outer=True,clear_inner=False)
 bm.to_mesh(shoe.data);bm.free();shoe.data.materials.clear()
 for m in MATS:shoe.data.materials.append(m)
 for f in shoe.data.polygons:
  z=sum(shoe.data.vertices[i].co.z for i in f.vertices)/len(f.vertices)
  f.material_index=5 if z<.045 else 2 if z<.125 else 3
 # Three small raised lace strips, weighted to the original shoe.
 for z,y in [(.125,-.11),(.115,-.15),(.10,-.19)]:
  x=sign*.17;v=[(x-.065,y-.012,z),(x+.065,y-.012,z),(x+.065,y+.012,z+.008),(x-.065,y+.012,z+.008)]
  mesh('Sports_Lace'+side,v,[(0,1,2,3)],[3],legsrc)
# Short athletic skirt over the independent, skinned compression shorts.
# Upper hem follows hips; lower hem lightly follows each thigh (not a rigid hip prop).
skirt=tube('Sports_Skirt',[(.32,.36,.265),(.36,.355,.26),(.43,.34,.25),(.51,.32,.24),(.58,.305,.235),(.625,.30,.23)],'z','Ranger_Body',[2,0,0,0,0],segments=24)
for v in skirt.data.vertices:
 for group in skirt.vertex_groups:group.remove([v.index])
 leg='upperleg.l' if v.co.x>=0 else 'upperleg.r'
 leg_weight=max(0,min(.45,(.58-v.co.z)/.26*.45))*min(1,abs(v.co.x)/.18)
 skirt.vertex_groups['hips'].add([v.index],1-leg_weight,'REPLACE')
 skirt.vertex_groups[leg].add([v.index],leg_weight,'REPLACE')
# Flat white back number and chest badge; separate garment details, not body tint.
def patch(name,x,y,z,w,h,index):
 return mesh(name,[(x-w/2,y,z-h/2),(x+w/2,y,z-h/2),(x+w/2,y,z+h/2),(x-w/2,y,z+h/2)],[(0,1,2,3)],[index],'Ranger_Body')
patch('Sports_Back_Number',0,.242,.90,.045,.18,2)
patch('Sports_Back_Number_Base',0,.243,.81,.11,.025,2)
patch('Sports_Chest_Badge',-.135,-.234,1.02,.085,.085,2)
patch('Sports_Chest_Badge_Inset',-.135,-.236,1.02,.045,.045,3)
# Source snapshot no longer needed after all weight transfers.
bpy.data.objects.remove(body,do_unlink=True)
# Exclude the importer's bone display Icosphere and select only the rig + real meshes.
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True)
for o in bpy.context.scene.objects:
 if o.type=='MESH' and (o.name.startswith('Sports_') or o.name.startswith(CHARACTER+'_')):o.select_set(True)
bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(ROOT/('public/models/'+CHARACTER+'-sports.glb')),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_def_bones=False,export_yup=True)
print('SPORTS_EXPORT',len(arm.data.bones),'bones; original head retained',len(head.data.vertices),'vertices')
