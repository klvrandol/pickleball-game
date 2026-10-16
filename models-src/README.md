# Character source and license

Author: Quaternius (https://quaternius.com, https://www.patreon.com/quaternius).
Pack: Animated Men Characters — February 2019. File: Smooth_Male_Casual.blend.
License of this historical distribution: **CC0 1.0 Universal**. Exact included notice is preserved in [QUATERNIUS-LICENSE.txt](QUATERNIUS-LICENSE.txt).
CC0 permits use, adaptation and redistribution, including commercial games.
The author's newer packs may use different licenses; this notice applies to the archived source included here.

## Acquisition / provenance

The creator's site could not be fetched from this cloud network. The original Blender file and its pack-level license were acquired from this public archive:

- Repository: https://github.com/beep2bleep/FreeAssetsByKenneyNLandQuaternius
- Pinned commit: `dea756baf3b3a4889d8c245e456a4791f961578a`
- Original file: https://github.com/beep2bleep/FreeAssetsByKenneyNLandQuaternius/blob/dea756baf3b3a4889d8c245e456a4791f961578a/FreeModels%20by%20Quaternius%5BPatreon%5D/Characters%20and%20Animals/Animated%20Men%20Characters%20-%20Feb%202019/Blends/Smooth_Male_Casual.blend
- License path at that commit: `FreeModels by Quaternius[Patreon]/License.txt`

The unmodified artist file is included as `Quaternius_Smooth_Male_Casual.blend` (development source only, not shipped in the Vite build). No further acquisition is necessary to play or build this project.

## Conversion

Run Blender 4.3+ from the repository root:

```sh
blender -b models-src/Quaternius_Smooth_Male_Casual.blend --python tools/export-athlete.py
```

The script keeps the artist's mesh, original vertex weights and full rig, samples the source IK constraints into Idle/Walk/Run skeletal animation tracks, converts axes/units for a 1.85 m player, exports material colors, and separates the source shoe faces from their shared dark-eye palette into the existing Shoes material slot. Runtime code recolors uniforms/skin/hair and attaches a pickleball paddle to Palm.R. No third-party paid tools, services or runtime CDN are required. Blender export warnings about >4 weights describe normalization to the four strongest skin weights supported by this export; skin deformation is checked in tests and browser rendering.

The GLB is about 837 KiB and includes all skin/animation buffers. `src/athlete-model.ts` loads this file once, validates skin data and required rig/animation features, and clones the skeleton per player. `tests/athlete.test.ts` checks actual vertex deformation, independent rigs, material colors, bounded geometry and stable repeated contact poses.

## Experimental SD player (separate original model)

`assets/athlete-sd.glb` is an original prototype generated from an empty Blender scene by `tools/build-sd-athlete.py`. It does not reshape or reuse the Quaternius mesh. Only the semantic joint names are compatible with the existing game animation adapter. The original `assets/athlete.glb` remains the CPU/classic comparison model with its CC0 provenance above.

The SD model has a sculpted section-based head/jersey, short tapered jointed limbs, wide trainers, facial features and cap; approximately 3-head proportions; a 29-joint skinning rig and Idle/Walk/Run skeletal clips. Joint deformation is intentionally basic for this prototype. The game creates a paddle 18% larger and retargets the six existing swing profiles into a separate SD clip cache.

Rebuild the SD model from the repository root:

```sh
blender -b --python tools/build-sd-athlete.py
```

Blender is a development-only tool. The generated GLB is included in the game build and requires no additional user download or paid service.

## KayKit Ranger trial

User-uploaded source: repository-root `Ranger.glb` (added in `291c057`).
Runtime copy: `public/models/Ranger.glb`, byte-for-byte identical; original retained.
Pack: KayKit Adventurers, Kay Lousberg — https://kaylousberg.itch.io/kaykit-adventurers (CC0).
Embedded texture remains intact; no runtime CDN.

Inspected GLB: eight skinned meshes, one skin `Rig_Medium`, 23 joints, **zero animation clips**.
Hierarchy: root → hips → spine → chest → head; chest → upperarm.l/r → lowerarm.l/r → wrist.l/r → hand.l/r → handslot.l/r; hips → upperleg.l/r → lowerleg.l/r → foot.l/r → toes.l/r.
Three.js sanitizes dots in node names (`hand.r` → `handr`).
There are no Quaternius-style shoulder/finger bones. Local bind rotations differ.
`src/ranger.ts` preserves these joints and skin weights, normalizes model forward/height/soles,
mounts the paddle at the right-hand socket, and uses a dedicated gait and world-space arm-chain IK.
Existing authored swing **paddle paths and timing**, not Quaternius bone tracks, are reused.
This is an appearance trial; authored KayKit-specific clips/retargeting and joint limits remain future work.


### Ranger sports derivative

`tools/build-ranger-sports.py` reads the preserved repository-root Ranger and exports only
`public/models/Ranger-sports.glb`. Original source/runtime copy remain byte-identical.
Cape/quiver are removed as independent objects. The source body combines tunic, scarf,
belt and pouches: the garment shell is rebuilt as a jersey, separate shorts and trims.
Leather arm cuffs and tall boot shafts are replaced with bare skin, sports bands and socks;
original hands and low shoe surfaces retain their weights. The original head geometry, UV,
material, armature and bind pose are retained. New clothes transfer normalized top-four
weights from the corresponding original body/arm/leg surfaces.
No Quaternius asset, gameplay envelope or camera configuration is changed.
This derivative uses the original KayKit CC0 asset; new garment geometry is generated locally.


### Barbarian CPU derivative

Uploaded source `Barbarian.glb` (commit `a90bdd1`) is preserved, with a byte-identical
copy at `public/models/Barbarian.glb`. Runtime: `public/models/Barbarian-sports.glb`.
It uses the same KayKit Adventurers provenance/license as Ranger. Actual skeleton:
23 joints, identical source inverse bind matrices to Ranger, no embedded animation clips.
The sports builder's `-- --barbarian` option removes the separate bear hat, replaces
adventure clothing with red sports garments, retains the original face/head mesh and
rig, and transfers new clothing weights from the original surfaces. The original
Ranger runtime GLB and its appearance are unchanged.

### Doubles Rogue / Mage sports derivatives

Uploaded originals `Rogue.glb` and `Mage.glb` arrived in `dac7e35` and remain unmodified.
Byte-identical copies are in `public/models/`; runtime uses `Rogue-sports.glb` and
`Mage-sports.glb`. These KayKit Adventurers assets share the provenance/CC0 license
listed above. Both source rigs have 23 joints and no animation clips. The actual
bone names and inverse bind transforms are retained; the existing KayKit-specific
swing/hand contact solver is used, never Quaternius animation tracks.

Rebuild with Blender 4.3+:

```
blender -b --python tools/build-doubles-sports.py
blender -b --python tools/build-doubles-sports.py -- --mage
```

The separate cape and Mage hat are removed; original heads/hair/UVs remain. Adventure
body garments are replaced by blue/red jerseys, short athletic skirts over separate
compression shorts, wrist bands, socks and sneakers. Most new surfaces transfer
normalized top-four source weights. The skirt waist is bound to hips and its lower
rings gradually blend up to 45% into the corresponding thigh, retaining a continuous
waist and flexible silhouette during gait. This is skinned clothing, not simulated
cloth: extreme reaching poses may still cause skirt/shorts intersections. Source
faces are retained rather than redesigned to suggest a different sex.
