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
