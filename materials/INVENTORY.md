# 素材总清单

基础库存快照：2026-10-11；彩蛋增量核验：2026-10-12（北京时间）。

素材库存快照及本轮增量共 **756 个文件，11.58 GiB**。本轮在 `video` worktree 运行 `npm run materials:inventory`，新增 15 项均重新计算 SHA-256。主仓库独有的忽略素材保持此前快照与校验值，本轮未重验，也未因 worktree 缺少这些文件而移除其条目；本清单和 inventory.csv 不计入统计。

原始输入与二级材料的定义、使用方式见 [README.md](README.md)。完整文件、层级、分类依据、来源和校验值见 [inventory.csv](inventory.csv)。

## 按层级和类型查找

| 层级 | 类型 | 文件数 | 大小 | 目录 |
| --- | --- | ---: | ---: | --- |
| 原始输入 | 图片 | 54 | 10.93 MiB | [images/source/](images/source/) |
| 原始输入 | 视频 | 34 | 9.94 GiB | [videos/source/](videos/source/) |
| 原始输入 | 字体 | 1 | 2.51 MiB | [fonts/source/](fonts/source/) |
| 原始输入 | 资料与审计 | 72 | 12.77 MiB | [documents/source/](documents/source/) |
| 二级材料 | 图片 | 44 | 42.65 MiB | [images/derived/](images/derived/) |
| 二级材料 | 模型 | 73 | 1.45 GiB | [models/derived/](models/derived/) |
| 二级材料 | 视频 | 15 | 89.59 MiB | [videos/derived/](videos/derived/) |
| 二级材料 | 字体 | 1 | 86.71 KiB | [fonts/derived/](fonts/derived/) |
| 二级材料 | 资料与审计 | 458 | 32.09 MiB | [documents/derived/](documents/derived/) |

## 当前展示与处理输入

| 使用情况 | 文件数 | 大小 |
| --- | ---: | ---: |
| 公开来源快照 | 24 | 9.17 MiB |
| 剪辑来源与参数 | 3 | 11.05 KiB |
| 剪辑输入 | 7 | 67.54 MiB |
| 历史网站输入 | 13 | 1.22 MiB |
| 原件目录说明 | 2 | 1.07 KiB |
| 原始下载元数据 | 43 | 1.15 MiB |
| 原始事实资料 | 2 | 784.81 KiB |
| 原片与公开投稿原件 | 34 | 9.94 GiB |
| 原片检索索引 | 2 | 63.13 KiB |
| 图片处理输入 | 21 | 23.59 MiB |
| 图片来源记录 | 3 | 1.68 MiB |
| 字体原件 | 1 | 2.51 MiB |
| 官方文章原图 | 5 | 671.09 KiB |
| 彩蛋视频定位与验证记录 | 1 | 6.32 KiB |
| 投稿原封面 | 36 | 9.05 MiB |
| 来源与审计支撑 | 455 | 32.02 MiB |
| 模型处理输入 | 47 | 1.43 GiB |
| 模型说明 | 1 | 6.78 KiB |
| 目录索引 | 1 | 3.96 KiB |
| 网页使用 | 34 | 38.01 MiB |
| 网页封面（彩蛋，待组件接入） | 3 | 449.64 KiB |
| 网页素材（彩蛋，待组件接入） | 3 | 9.96 MiB |
| 网页运行依赖 | 5 | 760.81 KiB |
| 说明与索引 | 1 | 767.91 KiB |
| 运动学交付 | 9 | 10.83 MiB |

## 当前模型与视频

| 文件 | 用途 | 大小 |
| --- | --- | ---: |
| [arm-joints.json](models/derived/web/arm-joints.json) | 网页使用 | 100.03 KiB |
| [arm.glb](models/derived/web/arm.glb) | 网页使用 | 1.03 MiB |
| [engineer-pump.glb](models/derived/web/engineer-pump.glb) | 网页使用 | 141.18 KiB |
| [engineer-swerve.glb](models/derived/web/engineer-swerve.glb) | 网页使用 | 336.78 KiB |
| [engineer.glb](models/derived/web/engineer.glb) | 网页使用 | 1.82 MiB |
| [hero-adaptive-chassis.glb](models/derived/web/hero-adaptive-chassis.glb) | 网页使用 | 776.69 KiB |
| [hero-launcher.glb](models/derived/web/hero-launcher.glb) | 网页使用 | 388.07 KiB |
| [hero-side-feed.glb](models/derived/web/hero-side-feed.glb) | 网页使用 | 82.52 KiB |
| [hero.glb](models/derived/web/hero.glb) | 网页使用 | 1.74 MiB |
| [l4.glb](models/derived/web/l4.glb) | 网页使用 | 845.37 KiB |
| [l4.json](models/derived/web/l4.json) | 网页使用 | 9.08 KiB |
| [exchange-58.mp4](videos/derived/web/exchange-58.mp4) | 网页使用 | 12.08 MiB |
| [exchange-58.source.json](videos/derived/web/exchange-58.source.json) | 网页使用 | 791 B |
| [egg-grab.mp4](videos/derived/web/egg-grab.mp4) | 网页素材（彩蛋，待组件接入） | 5.44 MiB |
| [egg-grab.source.json](videos/derived/web/egg-grab.source.json) | 剪辑来源与参数 | 4.71 KiB |
| [egg-stairs.mp4](videos/derived/web/egg-stairs.mp4) | 网页素材（彩蛋，待组件接入） | 640.11 KiB |
| [egg-stairs.source.json](videos/derived/web/egg-stairs.source.json) | 剪辑来源与参数 | 2.38 KiB |
| [egg-steal.mp4](videos/derived/web/egg-steal.mp4) | 网页素材（彩蛋，待组件接入） | 3.90 MiB |
| [egg-steal.source.json](videos/derived/web/egg-steal.source.json) | 剪辑来源与参数 | 3.96 KiB |

## 本次整理记录

清理 **990 个未使用的二级文件，3.47 GiB**。文件送入 Windows 回收站；逐项旧路径、大小、SHA-256、删除原因和保留材料的新路径见 [cleanup.json](cleanup.json)。

原片目录 [videos/source/bilibili/](videos/source/bilibili/) 及来源索引 [documents/derived/bilibili-video-catalog.md](documents/derived/bilibili-video-catalog.md) 均保留。

CAD 原件在外部只读目录，入口见 [models/source/README.md](models/source/README.md)。模型导出、PNG 截图、URDF 等归二级材料；本地仅保留当前展示、复现和溯源所需的加工文件。

刷新本清单：`npm run materials:inventory`。历史网页发布包由 publish/ 单独管理。
