import bpy, math
from pathlib import Path
from mathutils import Matrix
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
mesh=next(o for o in bpy.data.objects if o.type=='MESH')
# Retain the artist's armature and weights. Bake its IK when exporting the source actions.
for o in list(bpy.data.objects):
 if o not in [arm,mesh]:bpy.data.objects.remove(o,do_unlink=True)
arm.animation_data_clear(); arm.data.pose_position='REST'
for p in arm.pose.bones:p.matrix_basis=Matrix.Identity(4)
coords=[v.co for v in mesh.data.vertices]; print('REST BBOX',[(min(v[i] for v in coords),max(v[i] for v in coords)) for i in range(3)])
# Rotate the artist's forward (-Y) to our local forward (-Z after glTF conversion).
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=arm
arm.rotation_euler.z=math.pi;arm.scale=(1.85/4.82,)*3
# Child mesh inherits the normalized armature. No gameplay/root movement is baked into the avatar.
arm.data.pose_position='POSE'
# Original file shares the dark eye material with shoes; give trainers their own palette slot.
for face in mesh.data.polygons:
 if face.material_index == 1 and max(mesh.data.vertices[i].co.z for i in face.vertices) < 0.20:
  face.material_index = 6
for mat in mesh.data.materials:
 color = tuple(mat.diffuse_color)

 mat.use_nodes=True
 bsdf=mat.node_tree.nodes.get('Principled BSDF')
 # Preserve source palette; game clones and recolors jersey, shorts, shoes and skin.
 if bsdf:
  bsdf.inputs['Roughness'].default_value=.85
  bsdf.inputs['Base Color'].default_value=color
# Export only useful locomotion actions; exporter samples original constraints into skeletal tracks.
for a in list(bpy.data.actions):
 if a.name not in ['Man_Idle','Man_Walk','Man_Run']:bpy.data.actions.remove(a)
arm.animation_data_create();arm.animation_data.action=bpy.data.actions.get('Man_Idle')
bpy.context.scene.render.fps=24
bpy.ops.export_scene.gltf(filepath=str(Path(__file__).resolve().parents[1] / 'assets' / 'athlete.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_skins=True,export_def_bones=False,export_yup=True)
