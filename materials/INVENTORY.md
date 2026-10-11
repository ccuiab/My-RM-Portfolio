# 素材总清单

生成时间：2026-10-11T20:52:55.559+08:00（北京时间）。

本地 materials/ 共 **741 个文件，11.55 GiB**。包含 Git 忽略的本地素材；本清单和 inventory.csv 不计入统计。每个文件均重新计算 SHA-256。

原始输入与二级材料的定义、使用方式见 [README.md](README.md)。完整文件、层级、分类依据、来源和校验值见 [inventory.csv](inventory.csv)。

## 按层级和类型查找

| 层级 | 类型 | 文件数 | 大小 | 目录 |
| --- | --- | ---: | ---: | --- |
| 原始输入 | 图片 | 54 | 10.93 MiB | [images/source/](images/source/) |
| 原始输入 | 视频 | 34 | 9.94 GiB | [videos/source/](videos/source/) |
| 原始输入 | 字体 | 1 | 2.51 MiB | [fonts/source/](fonts/source/) |
| 原始输入 | 资料与审计 | 72 | 12.77 MiB | [documents/source/](documents/source/) |
| 二级材料 | 图片 | 41 | 42.21 MiB | [images/derived/](images/derived/) |
| 二级材料 | 模型 | 73 | 1.45 GiB | [models/derived/](models/derived/) |
| 二级材料 | 视频 | 4 | 55.43 MiB | [videos/derived/](videos/derived/) |
| 二级材料 | 字体 | 1 | 86.71 KiB | [fonts/derived/](fonts/derived/) |
| 二级材料 | 资料与审计 | 457 | 32.08 MiB | [documents/derived/](documents/derived/) |

## 当前展示与处理输入

| 使用情况 | 文件数 | 大小 |
| --- | ---: | ---: |
| 公开来源快照 | 24 | 9.17 MiB |
| 剪辑输入 | 2 | 43.35 MiB |
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
| 投稿原封面 | 36 | 9.05 MiB |
| 来源与审计支撑 | 455 | 32.02 MiB |
| 模型处理输入 | 47 | 1.43 GiB |
| 模型说明 | 1 | 6.78 KiB |
| 目录索引 | 1 | 3.96 KiB |
| 网页使用 | 34 | 38.01 MiB |
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

## 本次整理记录

清理 **990 个未使用的二级文件，3.47 GiB**。文件送入 Windows 回收站；逐项旧路径、大小、SHA-256、删除原因和保留材料的新路径见 [cleanup.json](cleanup.json)。

原片目录 [videos/source/bilibili/](videos/source/bilibili/) 及来源索引 [documents/derived/bilibili-video-catalog.md](documents/derived/bilibili-video-catalog.md) 均保留。

CAD 原件在外部只读目录，入口见 [models/source/README.md](models/source/README.md)。模型导出、PNG 截图、URDF 等归二级材料；本地仅保留当前展示、复现和溯源所需的加工文件。

刷新本清单：`npm run materials:inventory`。历史网页发布包由 publish/ 单独管理。
