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

`images/derived/site/research-cutouts/hero-launcher-core.png` 为预研 A1 专用透明 PNG（2400 × 1400）。当前版本使用 SolidWorks 原生带边线上色视口，直接只读加载 `D:\RM2025\New_Hero_gimbal_2.0\Main_assembly\发机_4310pitch.SLDASM`；顶层装配 SHA-256 为 `564bafb94a2be2be67d37eee3df23b4893c2096ee20e6e63929acf7691bb9e60`。枪口朝左，正面开口可见；相机方位角由 57° 调为 40°，保持 5° 低俯角，使侧视程度与 A2/A3 更一致。主体宽度为画布的 89.6%，垂直中心为 53.6%。

隐藏顶板 `3mm_供弹摩擦轮上板-1`、顶板专属支承和外围云台、电控配件。中板、加固板、主轮两侧保护板、小轮夹轴板及邻接垫片共七件使用原生组件透明显示，透明度设为 0.82；保留原色、碳纤维纹理和黑色轮廓。底板、两个主摩擦轮与一个预加速小轮保持实体，电机、减速器、轴和原始线缆保持整体与原装配位置。按已核验核心清单显示零件，避免旧 GLB 未覆盖的原生外围装配进入画面。

原生白底、黑底视口均为 4000 × 4000，视角、缩放和位置一致；关闭 RealView、环境遮蔽、地面阴影与反射。通过 `scripts/matte-sw-research.py` 计算 `alpha = 1 - median((W-B)/255)`，再由黑底像素恢复非预乘 RGB；只进行无损裁剪、预乘 alpha 的 Lanczos 缩小和透明画布排版，没有生成式修补或重画机械零件。隐藏七块透明板的另一组原生黑白底截图用于独立校验实体内部；白底重合成误差的最大值约为 3.39/255，均值约为 0.0022/255。

入口为 `scripts/render-sw-research.ps1 -Asset launcher -Size 4000 -ViewMatrix <九个矩阵元素>`。使用 `scripts/render-sw-research-components.json` 精确匹配零件，原生组件透明开关及核心单独取景均由 typed interop 实现，不保存 CAD。源目录前后 854 个文件的大小、修改时间与两个顶层装配哈希一致；六个核心组件的装配变换和边界与上一版相同。本轮正常完成：先关闭只读装配，再恢复临时显示、自动保存、搜索和引用只读设置，自建实例已退出。旧 TIFF 纸张尺寸按原有纸型被 SolidWorks 规范化，纸型与其它记录设置一致。

相机矩阵、四张原生 BMP、组件与只读文档清单、差分数值检查、深/白底预览、源快照及设置恢复记录保存在 `documents/derived/audits/swimg-a1-side-20261013/`，上一版 57° 视角记录保留在 `documents/derived/audits/swimg-a1-20261013/`。每文件来源覆盖项见本图目录的 `provenance.json`。先前 Blender 第四版及其 `materials/models/derived/inputs/codex/task3_hero_raw.glb` 输入仍可由 Git 历史和 `scripts/render-launcher-core.ps1` 复现；旧审计保留在本机 `C:\Users\cch20\AppData\Local\Temp\rm-shots\launcher\fourth\`。英雄页配图与 A1 文案没有随此次图片替换更改。

## 清理与维护

二级材料的“使用”包括当前展示、保留的加工流程输入、运动学交付和事实溯源。来源映射、只读 CAD 审计及技术推导继续保留。未引用的试渲染、检查截图、抽帧拼图、巨大 BMP、旧候选、重复文件和剪辑残片已清理。

全臂爆炸视图已替换旧腕部视图；未再被页面或处理脚本引用的 `l4.glb`、`l4.json`、`l4-assembled.*` 与 `eng-reach-lines.webp` 已在历史版本留档后删除。当前全臂模型和静态图分别见 `models/derived/web/arm-parts.glb`、`arm-parts.json` 与 `images/derived/site/cad-cutouts/arm-exploded.png`。

逐项迁移与删除结果见 [cleanup.json](cleanup.json)：包含整理前路径、保留文件的新路径、层级、使用情况、分类理由、大小与 SHA-256。早期删除项放入 Windows 回收站；本轮新增删除项由 Git 记录，并注明替代物与历史网页副本位置。迁移文件可按记录反向移动。

历史报告保留当时的路径。先查 `documents/derived/audits/reorganization/migration.json`，再查 `cleanup.json`，确认文件现位置或删除原因。`scripts/asset-pipeline-archive/` 是历史脚本记录，旧路径须按清单定位后再使用。

新增原片归 `source/`；提取、编辑和生成结果归 `derived/`，并保存来源记录。素材变更后运行 `npm run materials:inventory`，重新扫描全部本地文件、计算 SHA-256，并保留已有清单中的来源、作者、分 P 和迁移字段。独立历史网页由 [publish/](../publish/) 管理。
