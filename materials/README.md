# 素材库

## A 章整车行动短片

`videos/derived/web/engineer-mission-{zh,en}.mp4` 为约 87.0 秒、16:9、静音三维成片，封面位于 `images/derived/video-posters/engineer-mission-{zh,en}.jpg`。原始方案与录像参考记录在 `videos/derived/web/engineer-mission.source.json`。影片是功能情境示意，动作和等待经过编排；平移速度最高约 2.4 m/s。

制作入口为 `scripts/extract-mission-field.py`、`scripts/bake-mission-return.py`、`scripts/extract-mission-lights.py`、`scripts/build-engineer-mission.mjs` 和 `scripts/render-engineer-mission.mjs`；运动检查为 `scripts/check-engineer-mission.mjs`。派生时间轴、精确灯面与离线场景位于 `models/derived/inputs/engineer-mission/`，中间录制位于 `videos/derived/inputs/engineer-mission/`，试帧和检查记录位于 `documents/derived/audits/engineer-mission/`。

车体沿用分组 CAD；装甲八条灯带随底盘，上装灯管随云台，均为蓝色表面发光，不向车身投射蓝光。资源岛、两级翻越结构、完整兑换站、矿石和槽口均采用现有官方派生几何与琥珀轮廓；兑换站按实际平行连杆和末端轴运动。`mission-transmitter.glb/json` 补回原 CAD 的 VT03 图传，绑定 `link_3`，仅隐藏后方两根长线，保留外壳、镜头和安装结构。

开局直接行驶。银矿由上方压入背部吸盘；上阶准备依次转云台、转臂底座、翻肘，保留用户确认的反肘方向。前抬升机构先搭上每级台阶，配合后臂水平撑起车体；后腕轮始终支撑原下层平地，直到四个舵轮全部到达二级平台才抬起收臂。金矿仍从侧洞吸取、洞内抬高后退出，之后低位携矿并避开背矿；图传实际镜头保持接近水平向前。返程沿北侧宽坡和开放坡面，镜头视线随行进方向；启动、急停和颠簸分别驱动车身悬挂及四轮接触。

机器人停稳后，初始朝前的蓝方兑换站才转至第一次四级矿接收位姿。两次兑换均先退出机械臂，再后收倾倒至后侧收集箱，矿石按重力落下。接矿范围、全模型干涉与实际渲染分别检查，动作属于基于 CAD 和录像的功能示意。小地图采用规则第 37 页原图，动态显示渐隐尾迹、前导光点、目标脉冲和车头朝向。补齐能量机关、红蓝基地、原场地灯面、增益区丝印和规则第69页减速条；镜头收近突出机器人，移除机械臂末端轨迹线。弹丸在取金矿末期出现，按实际 CAD 表面散布命中与反弹，逃离后逐渐停止小陀螺。

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

### RM2025 官方手册与场地资产

2026-10-16 核对并保存了[官方公告 1768](https://www.robomaster.com/zh-CN/resource/pages/announcement/1768)中全部 19 项标记为“最新”的 PDF，包括各赛区、各站参赛手册、增补及协议文件。原件、公告快照和逐文件 URL、版本、页数、SHA-256 位于 [documents/source/robomaster/2025/](documents/source/robomaster/2025/latest-manifest.json)。该公告属于 RM2025，版本选择不跨赛季。

原始场地 STEP 来自[官方整场图纸](https://bbs.robomaster.com/article/372035?source=4)，保存于 [models/source/robomaster/2025/](models/source/robomaster/2025/)，按只读原始输入使用。图纸基于规则 V2.0.0；最新版规则 V2.1.0 的修订日志只列出小能量机关增益调整。建模同时核对了最新规则中的相关尺寸图。

| 入口 | 内容 |
| --- | --- |
| [模型与本地交互预览](models/derived/rm2025-field/preview.html) | 大资源岛、小资源岛、金矿石、银矿石、完整兑换站、独立兑换槽、中央高地翻越局部，共 7 个独立 GLB；包含双语预览及官方尺寸参考图 |
| [模型参数、来源与处理记录](models/derived/rm2025-field/manifest.json) | 原点、坐标轴、单位、源节点、实际网格包围盒、三角面、大小、SHA-256；保留取矿玻璃、矿石标识及机构层级 |
| [可编辑 Blender 工程](models/derived/inputs/rm2025-field/rm2025-field-assets.blend) | 保留减面前的 CAD 网格和可关闭的网页减面修改器；共点焊接与近共面清理有记录，原始场地图纸未改动 |
| [手册参考图](images/derived/inputs/rm2025-field-reference/sources.json) | 规则手册相关页面的完整渲染及页码对应关系 |
| [几何验证](documents/derived/audits/rm2025-field/geometry-verification.json) | 实际 GLB 槽口尺寸、51 个插入位置的三角面与包围盒检查、4 个示例位姿范围及翻越面高度采样 |

GLB 使用米和 Y 向上坐标。矿石原点在几何中心；本体名义边长 200 mm，官方 CAD 丝印凸起使外包络约为 200.4 mm。独立兑换槽原点在入口前表面中心，+Z 朝外，槽体沿 -Z 延伸。完整槽体包含上部安装结构，因此整体高度与 288 mm 前框高度不同。翻越结构采用官方中央高地靠小资源岛的一侧；邻接结构的裁切边界只用于展示。

预览通过本地 HTTP 服务打开：在仓库根目录运行 `python -m http.server 4336 --bind 127.0.0.1 --directory materials/models/derived/rm2025-field`，再访问 `http://127.0.0.1:4336/preview.html`；也可使用 `scripts/preview-rm2025-field.ps1` 启动。界面支持模型切换、轨道观察、兑换槽位姿及矿石放入/取出；四级示例是可检查的示意姿态，不代表比赛随机序列。

复现入口为 `scripts/download-rm2025-manuals.py`、`scripts/download-rm2025-field.py`、`scripts/extract-rm2025-field-evidence.py`、`scripts/rm2025-field-cad.py`、`scripts/build-rm2025-field-blender.py` 和 `scripts/build-rm2025-field-preview.mjs`；独立验证运行 `node scripts/check-rm2025-field.mjs`。OCP 依赖安装在忽略目录 `tmp/rm2025-field-python/`，未加入网站依赖。当前资产包放在 `models/derived/rm2025-field/`，供后续编排使用。

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

## 舵轮章节的整车循环

`models/derived/web/engineer-swerve-context.glb` 与云台、六轴机械臂章节使用同一 `engineer_tagged.glb` 派生输入。它排除四个完整舵轮子装配和由 `arm-parts.glb` 提供的机械臂，保留其余 **1,678,118** 个来源三角面，不做降面；Draco 位置与法线量化分别为 16/12 位。四个舵轮共用现有 `engineer-swerve.glb` 的高精度几何；两处不同安装壳体及电机保留各自的来源网格，随上述文件一同导出（合计 1,833,930 面）。机械臂直接复用 `arm-parts.glb`。

四轮完整来源根为 `21 / 174 / 287 / 375`。同名模组的内部安装位置也不同，不能只平移或旋转整个模组复制；每个活动件按来源装配变换定位，四轮转向在车体坐标中对齐。来源哈希、逐件映射、安装矩阵及不降面记录位于 `engineer-swerve-context.json`。复现运行 Blender 后台脚本 `scripts/build-swerve-context.py`，原生 CAD 与输入 GLB 均只读。

动画为 27 秒循环：整车停留 0.8 秒、聚焦 1.4 秒、展开 6 秒、爆炸态 3 秒、还原 6 秒、拉回 1.3 秒、四轮联动 8 秒、恢复车体 0.5 秒。近景其余部分完全淡出，联动时车体不透明度为 12%，四轮保持实体。运行 `node scripts/check-swerve-chassis.mjs` 与 `node scripts/verify-swerve-explosion.mjs` 检查来源几何、装配、同向转向、错峰悬挂与循环连续性；本轮实际浏览器检查保存于 `documents/derived/audits/swerve-chassis-20261017/`。

## 清理与维护

二级材料的“使用”包括当前展示、保留的加工流程输入、运动学交付和事实溯源。来源映射、只读 CAD 审计及技术推导继续保留。未引用的试渲染、检查截图、抽帧拼图、巨大 BMP、旧候选、重复文件和剪辑残片已清理。

全臂爆炸视图已替换旧腕部视图；未再被页面或处理脚本引用的 `l4.glb`、`l4.json`、`l4-assembled.*` 与 `eng-reach-lines.webp` 已在历史版本留档后删除。当前全臂模型和静态图分别见 `models/derived/web/arm-parts.glb`、`arm-parts.json` 与 `images/derived/site/cad-cutouts/arm-exploded.png`。

逐项迁移与删除结果见 [cleanup.json](cleanup.json)：包含整理前路径、保留文件的新路径、层级、使用情况、分类理由、大小与 SHA-256。早期删除项放入 Windows 回收站；本轮新增删除项由 Git 记录，并注明替代物与历史网页副本位置。迁移文件可按记录反向移动。

历史报告保留当时的路径。先查 `documents/derived/audits/reorganization/migration.json`，再查 `cleanup.json`，确认文件现位置或删除原因。`scripts/asset-pipeline-archive/` 是历史脚本记录，旧路径须按清单定位后再使用。

新增原片归 `source/`；提取、编辑和生成结果归 `derived/`，并保存来源记录。素材变更后运行 `npm run materials:inventory`，重新扫描全部本地文件、计算 SHA-256，并保留已有清单中的来源、作者、分 P 和迁移字段。独立历史网页由 [publish/](../publish/) 管理。


## B 章装配与传动解析（2026-10-14）

B 章采用原画布尺寸的单一主视图，按 J0、J1、J2、J3、限位/UWB、J4、腕部的顺序逐组讲解，一轮 116.6 秒。J1/J2 分开，腕部只展开一次；每组复原后展示关节运动，最后以 14 秒七轴联动收尾。J0 仰视、J2/J3 面向输出轴，腕部镜头经过上方、下方及另一侧。镜头先到位，再展开外盖与轴系；当前组复原后才移动到下一组，整机其余部分淡化保留。桌面画布高度为 `clamp(420px, 38vw, 540px)`，手机为 340px。拖动、缩放后空闲五秒平滑续播，也可暂停、选择章节或恢复整机。

模型仍为 `models/derived/web/arm-parts.glb` 与 `arm-parts.json`。生成链为 `scripts/build-arm-parts.py` → `scripts/arm-explosion-layout.py` → `scripts/render-arm-study.py`；运镜与阶段时间位于 `src/scripts/arm-study-story.ts`。恢复了两条各 82 节的 J0/J1 外部链与 16 个 UWB 来源网格，腕部同名电机按实例区分。源节点 `arm:502` 的六个连通实体分别向两侧展开，每个来源面恰好保留一次。电机保持完整，紧固件随安装体移动。

`images/derived/site/cad-cutouts/arm-exploded.png` 和 `images/derived/web/arm-study/detail-0.png` 至 `detail-8.png` 是同模型的备用渲染；手机默认仍为实时 3D。减少动态效果或加载失败时只显示一个可切换的静态视图。来源、几何检查、分镜检查和最终截图见 `documents/derived/audits/arm-study-20261014/`。该目录的 `superseded-multiview/` 仅保留已被用户否决的中间方案证据，不是当前页面。原始 CAD 与两个 tagged GLB 输入保持只读。

当前模型 schema 6，1043 个唯一来源网格、221 个显示部件、7 个完整电机。UWB 安装板 arm:370 已恢复；运动变换位于 `src/scripts/lib/arm-study-motion.ts`，轴点与从属关系记录在模型元数据及验收报告中。运动是未标定硬件限位的展示示意。

### B 章整车上下文补充

当前循环 154.4 秒，开场从整车分离总成；J0 归位后保留底盘参照。新增 `models/derived/web/arm-context.glb/json` 由 `scripts/build-arm-context.py` 从只读 tagged GLB 派生，排除 B 已显示的来源件。两套前部双齿条、滑台、齿轮、末端齿条和滚轮分别分组，支撑一级台阶的结构用途演示；不替代 A 章功能视频。详见当前验收报告顶部及 `context-checks.json`。腕部三色线路和小幅稳定运镜由实时页面生成；备用静态图不模拟动态线路。限位边界为明确标识的示意，未补造缺失限位板。

最新 B 章修订：底盘恢复与云台一致的来源材质族；一级台阶与七轴联动合并为 28 秒“整车协同”，全轮 148.2 秒。J0 先朝实际车尾，前部双升降和末端轮连续配合，最后协调收回。详情见验收报告顶部。

### B 章联动限位与螺丝动画（2026-10-17）

`models/derived/web/arm-linked-limit.json` 由 `scripts/build-linked-limit-study.py` 从只读 CAD 导出中的 `arm:370` 拱门碳板和 `arm:311` 限位滚轮生成。机构解释依据开源报告第 2.6 节图 19（本机 `D:\RM2025\【RM2025-轮式六轴机械臂工程机械结构开源】香港科技大学-ENTERPRIZE\RM2025-香港科技大学-ENTERPRIZE战队-工程结构说明文档.pdf` 第 16 页）。

大小连杆以两种琥珀色描线；先展示相似连杆，再展示圆形活动范围被上、前、后三侧碳板限制后的对应关系。实线为腕心的近似相似映射，虚线为计入吸盘工作面外伸的采样边界。其余轴固定；几何扫描不作为整车避碰或实机安全工作空间证明。报告明确说明上场时拆除了联动限位，整车协同段据此隐藏限位板。

螺丝保留原孔位。整圈使用统一的轴向位移，抽出到位后淡出；盖板和轴系复原后，螺丝在退出位置出现并插回。独立紧固件按同样时序处理，七个完整电机保持整体。阵列与来源记录在 `models/derived/inputs/arm-bolt-circles.json`，生成与检查入口为 `scripts/arm-fastener-rings.py`、`scripts/check-arm-rings.py`。
