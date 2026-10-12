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

`images/derived/site/research-cutouts/hero-launcher-core.png` 是预研页首个发射阶段专用的透明 PNG（2400 × 1400），只读输入为主仓库 `materials/models/derived/inputs/codex/task3_hero_raw.glb`。同装配的网页模型 `models/derived/web/hero-launcher.glb` 已合并为单个网格，无法按零件节点核验，因此使用完整派生输入中的 `发机_4310pitch` 装配（节点 767）。

模型确认为两个主摩擦轮装配（803、819）和一个预加速小轮装配（809）。本版恢复发射核心的完整框架：保留主上下板（801／816）、加固板（791）、小轮电机与对轴支架（796／800）、上层框架板（914）、轮轴支承、连接立柱、核心紧固件、枪管导向件（813）、供弹导引块（823）和测速模块及其连接件（817、807、814、830），共 96 个原生网格对象。电机本体、减速器和输出轴（806／811／822）保持整体及原装配位置。节点 811 只隐藏主体外的长线缆和连接器，不拆解电机。

外罩、侧护板隐藏节点为 771、774、777、781、915、919、923、926、927、931、946；它们不属于承力框架。加固板 791、小轮电机固定板 796、主上板 816、上层框架板 914 均恢复不透明；本版没有半透明零件。完整英雄输入中的后部云台支架、CV 相机、电控仓、图传及它们的外围配件未纳入发射核心画面；逐节点理由与所有保留件见运行时审计报告。

第三版生成不透明候选 A（局部方位角 45°、俯仰 3°）和 B（57°、5°），分别与 `launcher-dual-4.png`、`launcher-dual-6.png` 并排比较，最终采用 B。相机贴近弹道高度，从框架开口看到两个大轮与上层预加速小轮；测速／枪口模块投影在左、摩擦轮框架在右。碳板保留深色纹理，立柱和支座使用粗糙度较高的金属灰，避免上一版透明板和过亮白块压过轮子。主体宽度以 A2 的实心 alpha 包围盒为准，垂直中心以 A2/A3 平均位置为准，调整正交相机比例和位置，保留完整模型入框。没有添加弹道箭头或移动装配内的零件。

复现运行 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/render-launcher-core.ps1`（默认候选 B）；通过 `-Candidate a/b -Output <worktree 内 PNG 路径> -Audit <审计 JSON 路径>` 可分别生成两张候选。脚本自动取重负载锁、后台运行 Blender 5.1.1、在 14 分钟超时或出错后释放锁；启动参数和渲染设置均限制为 2 个线程，渲染后立即退出。采用 CPU Cycles、16 samples、denoise、Standard、Freestyle 细边线、透明背景和正交侧向 3/4 视角。只提取选中网格及引用的 CAD 纹理缓冲，不复制整车大文件，不保存 `.blend`。材质 alpha 全部为 1；三个实际轮胎网格分别按 800 个面积加权表面点作射线遮挡核验，避免只核对保留节点而没有露出轮子。节点取舍、遮挡检查、投影边界及 SHA-256 写入审计报告；第三版两候选、并排图、页面截图和报告保存在本机 `C:\Users\cch20\AppData\Local\Temp\rm-shots\launcher\side\`，前版证据保留在 `revision/`。英雄页图片和 `content.ts` 均未修改。

## 清理与维护

二级材料的“使用”包括当前展示、保留的加工流程输入、运动学交付和事实溯源。来源映射、只读 CAD 审计及技术推导继续保留。未引用的试渲染、检查截图、抽帧拼图、巨大 BMP、旧候选、重复文件和剪辑残片已清理。

全臂爆炸视图已替换旧腕部视图；未再被页面或处理脚本引用的 `l4.glb`、`l4.json`、`l4-assembled.*` 与 `eng-reach-lines.webp` 已在历史版本留档后删除。当前全臂模型和静态图分别见 `models/derived/web/arm-parts.glb`、`arm-parts.json` 与 `images/derived/site/cad-cutouts/arm-exploded.png`。

逐项迁移与删除结果见 [cleanup.json](cleanup.json)：包含整理前路径、保留文件的新路径、层级、使用情况、分类理由、大小与 SHA-256。早期删除项放入 Windows 回收站；本轮新增删除项由 Git 记录，并注明替代物与历史网页副本位置。迁移文件可按记录反向移动。

历史报告保留当时的路径。先查 `documents/derived/audits/reorganization/migration.json`，再查 `cleanup.json`，确认文件现位置或删除原因。`scripts/asset-pipeline-archive/` 是历史脚本记录，旧路径须按清单定位后再使用。

新增原片归 `source/`；提取、编辑和生成结果归 `derived/`，并保存来源记录。素材变更后运行 `npm run materials:inventory`，重新扫描全部本地文件、计算 SHA-256，并保留已有清单中的来源、作者、分 P 和迁移字段。独立历史网页由 [publish/](../publish/) 管理。
