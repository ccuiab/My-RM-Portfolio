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
| hero-launcher.glb | Launcher subtree of the September 2024 Hero assembly; the refreshed native SolidWorks image uses the same source assembly. |
| hero-side-feed.glb | Isolated side-feed subsystem only: hopper, feeding mechanism and drive. Re-exported to match feeder-large.webp; excludes the gooseneck tube and external upper cover. |
| hero-adaptive-chassis.glb | Bare frame subtree with wheels and linked suspension. Re-exported to match hero-chassis-adaptive.webp; excludes armour, feed and upper electrical equipment. |
| engineer-swerve.glb | One 3508_3508_Swerve_drive_v2 instance from the Engineer assembly. |
| engineer-pump.glb | Four components of the 3508 converted pump from the Engineer assembly. |
| research-launcher4.glb | New_Hero_gimbal_3.0 / shootertest_上交限位法: four-wheel test assembly; native SolidWorks image uses this same source. |
| research-launcher6.glb | New_Hero_gimbal_4.0 / 发机试验: six-wheel test assembly; native SolidWorks image uses this same source. |
| research-feeder.glb | LengendaryLoaderAssebly 20240816 / MKV feed revision, also used for the refreshed native SolidWorks image. This archived CAD view does not establish the first design or on-robot use. |
| research-hero-wheel.glb | RM25 Steering Wheel 24081001 / #STEERINGWHEEL_V0.2: native SolidWorks image uses the same V0.2 assembly. |

All nine assets are Draco-compressed, decoded and rendered for inspection, and pass glTF Validator with zero errors and warnings. Source geometry was read without saving changes to CAD. Extraction mappings, export scripts, validation and screenshots are preserved locally under `output/module-models/`. Research source SHA256 audits passed for the launcher and wheel batches; the feeder baseline was overwritten by a later audit, so a before/after hash proof is not claimed for it.

No matching source CAD was located for the custom controller or exoskeleton; the historical controller image and authentic exoskeleton photograph remain the reference. The home page stays photographic and does not load these models.

## Complete L4 and distal wrist

`l4.glb` and `l4.json` replace the older transmission-only wrist selection in the Engineer exploded viewer. The source boundary is the complete `L4.2025.10.1` structural subassembly plus the `L6_v2` distal wrist subassembly, extracted from the existing SolidWorks-derived `arm_tagged.glb`. The structural source is `Robotic arm/Robotic arm v2/L4.2025.10.1.SLDASM` in the HKUST ENTERPRIZE RM2025 open-source CAD package. CAD assembly ancestry defines this selection: many L4 plates belong to the kinematic `link_3`, so selecting only `link_4` would omit them.

The final asset has 20 exploded groups, 241,332 triangles and 865,668 bytes. Added groups cover the left/right longitudinal main plates, proximal/distal cross plates, motor and bearing mounts, proximal shaft and guards, central tube clamps and VT03 transmitter. They accompany the universal shaft drive, J4 output, slip ring, belt and bevel transmission, wrist motors, L6 frame, wheels, cup and air fittings. `l4.json` provides matching `ex_<key>` names, bilingual labels, explode vectors, distances, stagger order and surface anchors for every group.

All principal structural components are retained at their CAD assembly transforms. Detailed motor internals, screws and bearing internals are omitted; motor exterior housings and interfaces remain. Coincident CAD face vertices are welded, triangle counts are reduced, normals are reconstructed and the result is Draco-compressed. No replacement or procedural frame geometry is used. The source selection asserts coverage of every retained non-motor-internal L4 component in the original mapping. The source node names prefixed `~$` for the distal upper/lower plates have real exported geometry and are retained.

The compressed model passes glTF Validator with zero errors and warnings, and independently decodes as 20 mesh objects with finite normals. The website assembled and exploded stills are native SolidWorks captures, respectively 2808 × 2568 and 2804 × 2518 pixels after cropping. The exploded still moves 163 actual components in an isolated output copy, retaining all principal L4 and distal wrist structures. It uses 18 independently movable SolidWorks groups: a multi-body wrist part remains one component, while the interactive GLB separates its bodies into additional groups. No source CAD is saved. Reproducible mappings and model validation live locally in `output/module-models/l4-*`; native capture and source audits are in `output/image-refresh/sw/`. The older `wrist.glb` remains a historical transmission-focused asset.

## Website image refresh

The module stills are native SolidWorks exports from the same source assemblies listed above. Source assemblies are opened read-only and lightweight components are resolved before capture. A visible model window is framed at native resolution; exported pixels are cropped with a margin rather than interpolated to claim extra detail. Reference planes, sketches and other editing overlays are hidden. The arm overview omits the separate UWB camera mast to give the arm itself more room; the full Engineer image retains the mast.

Original competition photographs and the correct 5.8-second broadcast card are preserved where no clearer same-content original was found. The arm-feature video poster is extracted at native 1920 × 1080 from the official footage. The custom controller's historical image remains because no matching source CAD was located. Source-to-image mappings, accepted/rejected candidates, dimensions and source-file audits are recorded locally in `output/image-refresh/`.
