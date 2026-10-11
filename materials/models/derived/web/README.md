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

## Retired wrist-only viewer assets

The former `l4.glb`, `l4.json`, and `l4-assembled.*` assets served the wrist-only exploded viewer. The full-arm viewer now uses `arm-parts.glb` and `arm-parts.json`; its mobile and reduced-motion fallback is `materials/images/derived/site/cad-cutouts/arm-exploded.png`. The retired files were removed after their prior published copies were confirmed; per-file history locations are in `materials/cleanup.json`.

The L4/L6 source mapping, CAD selection rationale and validation history remain in `materials/documents/derived/audits/module-models/l4-*` and `materials/documents/derived/audits/arm-explode/`. The external native CAD source remains read-only.

## Website image refresh

The module stills are native SolidWorks exports from the same source assemblies listed above. Source assemblies are opened read-only and lightweight components are resolved before capture. A visible model window is framed at native resolution; exported pixels are cropped with a margin rather than interpolated to claim extra detail. Reference planes, sketches and other editing overlays are hidden. The arm overview omits the separate UWB camera mast to give the arm itself more room; the full Engineer image retains the mast.

Original competition photographs and the correct 5.8-second broadcast card are preserved where no clearer same-content original was found. The custom controller's historical image remains because no matching source CAD was located. The introduction uses a Bilibili embed, so its old local preview and extracted poster were removed. Source-to-image mappings, accepted/rejected candidate records, dimensions and source-file audits remain locally in `materials/documents/derived/audits/image-refresh/`.
