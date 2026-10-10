# RM2025 web models

- `arm.glb`: animated six-axis arm, 226,937 triangles, 8 joint/link nodes, 7 PBR materials, metres, +Y up. Includes a paired-wheel branch, coupled to wrist motion.
- `engineer.glb`: static full robot, 363,063 triangles, 7 PBR materials.
- Both require Draco; local decoder files are in `draco/`. Prefix every URL with the site's Astro BASE_URL.
- `arm-joints.json`: axes, rest-pose convention and full source mapping. q=0 is the CAD export pose. All rest node rotations are identity. Set each named link quaternion from `web_axis` and a single angle in radians. Wheel increments: q7=q5-q6, with hardware sign calibration still outstanding.
- Wireframe is derived from the loaded geometry (`src/scripts/scan-scene.ts`). No separate wire asset is needed.

URDF link meshes, derivation, source audit, known limitations, URDF and DH table live outside the site build in `output/codex/` (not committed): `report.md`, `dh.md`, `arm.urdf`, `urdf-meshes/`.

## Project and module viewers

`hero.glb` is the complete September 2024 Hero assembly. It is displayed before the Hero mechanisms, with mouse / touch rotation. The following module assets support explicit photo / model switching; they load on demand and release GPU resources away from the viewport.

| Asset | Source / revision boundary |
| --- | --- |
| hero-launcher.glb | Launcher subtree of the September 2024 Hero assembly; local details may differ from the historical image. |
| hero-feed.glb | Side feed and curved feed tube from that assembly. |
| hero-chassis.glb | Chassis, suspension and wheels from that assembly, excluding the feed. |
| engineer-swerve.glb | One 3508_3508_Swerve_drive_v2 instance from the Engineer assembly. |
| engineer-pump.glb | Four components of the 3508 converted pump from the Engineer assembly. |
| research-launcher4.glb | New_Hero_gimbal_3.0 / shootertest_上交限位法: four-wheel test assembly, different plate revision from the image. |
| research-launcher6.glb | New_Hero_gimbal_4.0 / 发机试验: six-wheel test assembly, different plate revision from the image. |
| research-feeder.glb | LengendaryLoaderAssebly 20240816 / MKV feed revision, not the pictured first design; this does not establish on-robot use. |
| research-hero-wheel.glb | RM25 Steering Wheel 24081001 / #STEERINGWHEEL_V0.2: different local configuration from the image. |

All nine assets are Draco-compressed, decoded and rendered for inspection, and pass glTF Validator with zero errors and warnings. Source geometry was read without saving changes to CAD. Extraction mappings, export scripts, validation and screenshots are preserved locally under `output/module-models/`. Research source SHA256 audits passed for the launcher and wheel batches; the feeder baseline was overwritten by a later audit, so a before/after hash proof is not claimed for it.

No matching source CAD was located for the custom controller or exoskeleton; their photographs remain the reference. The home page stays photographic and does not load these models.
