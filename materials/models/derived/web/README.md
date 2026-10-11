# RM2025 web models

- `arm.glb`: animated six-axis arm, 226,937 triangles, 8 joint/link nodes, 7 PBR materials, metres, +Y up. Includes a paired-wheel branch, coupled to wrist motion.
- `engineer.glb`: static full robot, 363,063 triangles, 7 PBR materials.
- Both require Draco; local decoder files are in `draco/`. Prefix every URL with the site's Astro BASE_URL.
- `arm-joints.json`: axes, rest-pose convention and full source mapping. q=0 is the CAD export pose. All rest node rotations are identity. Set each named link quaternion from `web_axis` and a single angle in radians. Wheel increments: q7=q5-q6, with hardware sign calibration still outstanding.
- Wireframe is derived from the loaded geometry (`src/scripts/scan-scene.ts`). No separate wire asset is needed.

Derivation, source audit, known limitations and DH table live outside the site build in `materials/documents/derived/audits/codex/` (not committed): `report.md`, `dh.md`. URDF and link meshes are in `materials/models/derived/inputs/codex/`: `arm.urdf`, `urdf-meshes/`. These are derived materials; native CAD sources remain in the external read-only directories described in `materials/models/source/README.md`.

## Project and module viewers

`hero.glb` is the complete September 2024 Hero assembly. It is displayed before the Hero mechanisms, with mouse / touch rotation. The following module assets support explicit photo / model switching; they load on demand and release GPU resources away from the viewport.

| Asset | Source / revision boundary |
| --- | --- |
| hero-launcher.glb | Launcher subtree of the September 2024 Hero assembly; the refreshed native SolidWorks image uses the same source assembly. |
| hero-side-feed.glb | Isolated side-feed subsystem only: hopper, feeding mechanism and drive. Re-exported to match feeder-large.webp; excludes the gooseneck tube and external upper cover. |
| hero-adaptive-chassis.glb | Bare frame subtree with wheels and linked suspension. Re-exported to match hero-chassis-adaptive.webp; excludes armour, feed and upper electrical equipment. |
| engineer-swerve.glb | One 3508_3508_Swerve_drive_v2 instance from the Engineer assembly. |
| engineer-pump.glb | Four components of the 3508 converted pump from the Engineer assembly. |

The five module assets above are Draco-compressed and were decoded, rendered and validated at delivery. Their extraction mappings and validation records remain under `materials/documents/derived/audits/module-models/` and `module-corrections/`. Temporary review screenshots and unused candidate models were removed during material cleanup; the current delivery bytes are preserved.

### Engineer module motion

`engineer-pump.glb` and `engineer-swerve.glb` now retain component nodes rather than a single merged visible mesh. `engineer-modules.json` records the read-only input hashes, output hashes, original source names, component origins, local motion axes and explosion offsets. `scripts/export-module-parts.py` regenerates both with Blender 5.1.1 from the existing derived `module-models/*-raw.glb` inputs; in an independent worktree these inputs can be read directly from the primary repository. No native CAD is opened or saved. The original metres, Y-up orientation and centred assembly coordinates are retained.

The pump has four source components: crank (1426), pump head (1427), piston (1428), and complete gearless motor (1429). The crank uses its original local shaft axis; the piston receives a small illustrative reciprocation. The head is translucent in the viewer. No suction cup is present in this selection; sparse amber particles are confined to the head's lateral openings. Speed, piston stroke, port polarity and airflow are visual studies, without measured operating parameters or a validated fluid simulation.

The swerve contains 48 source component nodes plus a steering carrier, positioned at the original `Steering_inner` axis. Original wheel, spur gear, MGN7 rails/sliders, gas spring and bearing carriers can separate; motor nodes retain their complete geometry and receive no individual explosion offset. The wheel rolls around its existing local axle and the inner carrier steers around the vertical axis. The website's established dark CAD palette is retained; all interactive highlighting uses `--amber`. The shared viewer loads and renders only in the viewport, releases its context offscreen, and shows the native CAD still on mobile or with reduced motion.

The research page uses images from the four-wheel and six-wheel launcher, MKV feeder and V0.2 steering-wheel assemblies. Their unused GLBs were removed; the earlier source mappings and audits remain in the local audit directories. Earlier website versions have independent publication snapshots. Research source SHA256 audits passed for the launcher and wheel batches; the feeder baseline was overwritten by a later audit, so a before/after hash proof is not claimed for it.

No matching source CAD was located for the custom controller or exoskeleton; the historical controller image and authentic exoskeleton photograph remain the reference. The home page stays photographic and does not load these models.

## Complete L4 and distal wrist

`l4.glb` and `l4.json` replace the older transmission-only wrist selection in the Engineer exploded viewer. The source boundary is the complete `L4.2025.10.1` structural subassembly plus the `L6_v2` distal wrist subassembly, extracted from the existing SolidWorks-derived `arm_tagged.glb`. The structural source is `Robotic arm/Robotic arm v2/L4.2025.10.1.SLDASM` in the HKUST ENTERPRIZE RM2025 open-source CAD package. CAD assembly ancestry defines this selection: many L4 plates belong to the kinematic `link_3`, so selecting only `link_4` would omit them.

The final asset has 20 exploded groups, 241,332 triangles and 865,668 bytes. Added groups cover the left/right longitudinal main plates, proximal/distal cross plates, motor and bearing mounts, proximal shaft and guards, central tube clamps and VT03 transmitter. They accompany the universal shaft drive, J4 output, slip ring, belt and bevel transmission, wrist motors, L6 frame, wheels, cup and air fittings. `l4.json` provides matching `ex_<key>` names, bilingual labels, explode vectors, distances, stagger order and surface anchors for every group.

All principal structural components are retained at their CAD assembly transforms. Detailed motor internals, screws and bearing internals are omitted; motor exterior housings and interfaces remain. Coincident CAD face vertices are welded, triangle counts are reduced, normals are reconstructed and the result is Draco-compressed. No replacement or procedural frame geometry is used. The source selection asserts coverage of every retained non-motor-internal L4 component in the original mapping. The source node names prefixed `~$` for the distal upper/lower plates have real exported geometry and are retained.

The compressed model passed glTF Validator with zero errors and warnings, and independently decoded as 20 mesh objects with finite normals. The current loading fallback is a processed native SolidWorks assembled capture. The earlier exploded still used an isolated output copy with 18 independently movable SolidWorks groups; it is no longer displayed and was removed. No source CAD was saved. Mappings and validation remain locally in `materials/documents/derived/audits/module-models/l4-*`; native capture and source audits are in `materials/documents/derived/audits/image-refresh/sw/`. The older transmission-focused `wrist.glb` and its JSON were removed from the current material library and remain in earlier website snapshots.

## Website image refresh

The module stills are native SolidWorks exports from the same source assemblies listed above. Source assemblies are opened read-only and lightweight components are resolved before capture. A visible model window is framed at native resolution; exported pixels are cropped with a margin rather than interpolated to claim extra detail. Reference planes, sketches and other editing overlays are hidden. The arm overview omits the separate UWB camera mast to give the arm itself more room; the full Engineer image retains the mast.

Original competition photographs and the correct 5.8-second broadcast card are preserved where no clearer same-content original was found. The custom controller's historical image remains because no matching source CAD was located. The introduction uses a Bilibili embed, so its old local preview and extracted poster were removed. Source-to-image mappings, accepted/rejected candidate records, dimensions and source-file audits remain locally in `materials/documents/derived/audits/image-refresh/`.
