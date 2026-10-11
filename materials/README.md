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
| 视频 | [完整下载原片](videos/source/bilibili/) | [当前剪辑与来源](videos/derived/web/)、[剪辑输入](videos/derived/inputs/) |
| 字体 | [字体原件](fonts/source/) | [网页字体子集](fonts/derived/subsets/) |
| 资料 | [事实与简历](documents/source/CUIChuhanCV.md)、[视频来源快照](documents/source/bilibili/)、[照片来源网页](documents/source/photos/) | [视频索引](documents/derived/bilibili-video-catalog.md)、[来源与工程审计](documents/derived/audits/) |

图片原始输入可以直接被 Astro 引用，构建仅输出页面使用的优化图片。构建另将 `models/derived/web/`、`videos/derived/web/`、`images/derived/video-posters/` 与 `images/derived/web/` 复制到临时静态目录；大型原片和处理输入保存在本地。

## 清理与维护

二级材料的“使用”包括当前展示、保留的加工流程输入、运动学交付和事实溯源。来源映射、只读 CAD 审计及技术推导继续保留。未引用的试渲染、检查截图、抽帧拼图、巨大 BMP、旧候选、重复文件和剪辑残片已清理。

逐项迁移与删除结果见 [cleanup.json](cleanup.json)：包含整理前路径、保留文件的新路径、层级、使用情况、分类理由、大小与 SHA-256。删除文件放入 Windows 回收站，可按原路径恢复；迁移文件可按记录反向移动。回收站清空后，本地忽略文件不保证可恢复。

历史报告保留当时的路径。先查 `documents/derived/audits/reorganization/migration.json`，再查 `cleanup.json`，确认文件现位置或删除原因。`scripts/asset-pipeline-archive/` 是历史脚本记录，旧路径须按清单定位后再使用。

新增原片归 `source/`；提取、编辑和生成结果归 `derived/`，并保存来源记录。素材变更后运行 `npm run materials:inventory`，重新扫描全部本地文件、计算 SHA-256，并保留已有清单中的来源、作者、分 P 和迁移字段。独立历史网页由 [publish/](../publish/) 管理。
