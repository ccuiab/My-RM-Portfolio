# 素材库

材料按图片、模型、视频、字体和资料存放，各类统一分为 `source/`（原始输入）与 `derived/`（二级材料）。

总量和分类见 [素材总清单](INVENTORY.md)。[完整逐文件清单](inventory.csv) 包含层级、使用情况、分类依据、公开来源、作者、分 P、分辨率和重新计算的 SHA-256，可用 Excel 打开。

## 原始输入与二级材料

| 层级 | 定义 | 例子 |
| --- | --- | --- |
| `source/` | 接收到或直接下载的文件，按收到的内容保留 | 完整公开视频、投稿封面、官方文章图片、历史网站图片、简历、字体、原网页与视频元数据 |
| `derived/` | 本仓库从输入中提取、剪辑、编辑、转换或生成的文件 | 视频片段、封面抽帧、CAD 导出、减面模型、抠图、线稿、字体子集、索引及审计报告 |

“原始输入”相对于本仓库的加工流程而言。历史网站已压缩的 WebP、官方截图和上游作者发布的剪辑，均按收到的内容保存；不将其称为相机原片、未压缩图片或未经剪辑的比赛录像。

CAD 原件在 `D:\RM2025` 和 OneDrive，只读使用，入口见 [models/source/README.md](models/source/README.md)。本地 GLB、Blender、URDF、截图和派生装配副本都归二级材料，即使旧文件名带 `raw`、`source` 或 `original`。

## 目录入口

| 类型 | 原始输入 | 二级材料 |
| --- | --- | --- |
| 图片 | [历史网站输入](images/source/historical/)、[官方原图](images/source/official-article/)、[投稿封面](images/source/bilibili/covers/) | [网页抠图](images/derived/site/)、[处理输入](images/derived/inputs/)、[线稿与腕部输入](images/derived/generated/)、[视频封面](images/derived/video-posters/)、[图标与分享图](images/derived/web/) |
| 模型 | [外部 CAD 说明](models/source/README.md) | [网页模型与参数](models/derived/web/)、[重建与运动学输入](models/derived/inputs/) |
| 视频 | [完整下载原片](videos/source/bilibili/) | [当前剪辑与来源](videos/derived/web/)、[剪辑输入](videos/derived/inputs/)、[视频封面](images/derived/video-posters/) |
| 字体 | [字体原件](fonts/source/) | [网页字体子集](fonts/derived/subsets/) |
| 资料 | [事实与简历](documents/source/CUIChuhanCV.md)、[视频来源快照](documents/source/bilibili/)、[照片来源网页](documents/source/photos/) | [视频索引](documents/derived/bilibili-video-catalog.md)、[来源与工程审计](documents/derived/audits/) |

图片原始输入可以直接被 Astro 引用，构建仅输出页面使用的优化图片。构建另将 `models/derived/web/`、`videos/derived/web/`、`images/derived/video-posters/` 与 `images/derived/web/` 复制到临时静态目录；大型原片和处理输入保存在本地。工程页片尾的上台阶、偷银矿和抢矿静音循环位于 `videos/derived/web/egg-*.mp4`，剪辑输入在 `videos/derived/inputs/`，来源记录随视频保存；复现使用 `scripts/cut-eggs.ps1`，原片仍在 `videos/source/bilibili/`。

### 工程整车前视图

`images/derived/site/cad-cutouts/engineer-front.png` 是 orient 轮生成的车头 3/4 透明 PNG（1600 × 1440）。输入只读来自主仓库 `materials/models/derived/inputs/codex/engineer_tagged.glb`，通过节点 `extras.source_node_index` 核对末端吸盘 779、车尾存矿吸盘 1330/1673、四个轮胎和裁判系统的位置；车头为整车水平单位方向约 `(-0.794, 0, -0.608)`，对应机械臂局部 `+Z`。

生成使用 Blender 5.1.1 后台 CPU Cycles、32 samples、denoise、AgX、透明胶片和正交相机。按 `atan2(camera.x, camera.z)` 计，方位角 255.04°，俯仰角约 33.02°；保留整车装配位置，按投影包围盒留白取景。保留 GLB 中的白色壳体、灯条及裁判系统材质；SolidWorks 碳纤维贴图导入时偏白，渲染内将其乘以深色环氧底色 `(0.028, 0.032, 0.040)`，roughness 设为 0.32。没有修改输入 GLB 或保存 `.blend`。图片 SHA-256 为 `28aabf2e81745bfa764556304f3fd60cbd6c5fa47a6f84ab93df86798fca09e2`。旧图 `engineer-full.png` 保留。

本次派生输入的 UWB 支架在车头投影中形成较高轮廓，与旧 SolidWorks 静态图的紧凑构图有差异；在整车完整入框的条件下，主体占比和小图辨识度低于旧图。因此按本轮“质量明显不如原图时不要替换”的要求，将新图保留为前视候选，首页和静态降级继续使用 `engineer-full.png`。页头 3D 已改为车头视角。图片选择依据和对比见本轮 orient 验收报告；生成脚本及原色/深色候选对比保存在本机 `C:\Users\cch20\AppData\Local\Temp\rm-shots\orient\`。

### RM2024 英雄发射机构核心

`images/derived/site/research-cutouts/hero-launcher-core.png` 是预研页首个发射阶段专用的透明 PNG（1800 × 1400），只读输入为主仓库 `materials/models/derived/inputs/codex/task3_hero_raw.glb`。同装配的网页模型 `models/derived/web/hero-launcher.glb` 已合并为单个网格，无法按零件节点核验，因此使用完整派生输入中的 `发机_4310pitch` 装配（节点 767）。

模型确认为两个主摩擦轮装配（803、819）和一个预加速小轮装配（809）。保留外圈、金属中心、完整电机（806、811、822）、主轮对轴销及轴承（772、818、773、792）、小轮对轴销及轴承（799、797），不改变零件的内部装配位置。隐藏上下板、侧板、罩盖、电子仓、枪管等遮挡件。此输入的 `Hub` 与 `Rubber` 名称和实际几何、原材质相反：805／821／810 的外圈使用灰黑橡胶表现，804／820／812 的中心使用银色金属表现；节点原名和网格均保留。琥珀虚线箭头是弹道方向示意，沿枪管长轴及小轮到主轮的位置关系推断，不属于 CAD 零件。

复现运行 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/render-launcher-core.ps1`；脚本自动取重负载锁、后台运行 Blender 5.1.1、在超时或出错后释放锁。采用 CPU Cycles、48 samples、denoise、AgX、透明背景和正交 3/4 视角，按实际网格的投影边界取景。只提取选中网格的缓冲，不复制整车大文件，不保存 `.blend`。生成节点、尺寸边界、输入与图片 SHA-256 写入运行时审计报告，默认位置为 `C:\Users\cch20\AppData\Local\Temp\rm-shots\launcher\render-audit.json`。英雄页继续使用 `images/derived/site/cad-cutouts/hero-launcher-2024.png`。

## 清理与维护

二级材料的“使用”包括当前展示、保留的加工流程输入、运动学交付和事实溯源。来源映射、只读 CAD 审计及技术推导继续保留。未引用的试渲染、检查截图、抽帧拼图、巨大 BMP、旧候选、重复文件和剪辑残片已清理。

全臂爆炸视图已替换旧腕部视图；未再被页面或处理脚本引用的 `l4.glb`、`l4.json`、`l4-assembled.*` 与 `eng-reach-lines.webp` 已在历史版本留档后删除。当前全臂模型和静态图分别见 `models/derived/web/arm-parts.glb`、`arm-parts.json` 与 `images/derived/site/cad-cutouts/arm-exploded.png`。

逐项迁移与删除结果见 [cleanup.json](cleanup.json)：包含整理前路径、保留文件的新路径、层级、使用情况、分类理由、大小与 SHA-256。早期删除项放入 Windows 回收站；本轮新增删除项由 Git 记录，并注明替代物与历史网页副本位置。迁移文件可按记录反向移动。

历史报告保留当时的路径。先查 `documents/derived/audits/reorganization/migration.json`，再查 `cleanup.json`，确认文件现位置或删除原因。`scripts/asset-pipeline-archive/` 是历史脚本记录，旧路径须按清单定位后再使用。

新增原片归 `source/`；提取、编辑和生成结果归 `derived/`，并保存来源记录。素材变更后运行 `npm run materials:inventory`，重新扫描全部本地文件、计算 SHA-256，并保留已有清单中的来源、作者、分 P 和迁移字段。独立历史网页由 [publish/](../publish/) 管理。
