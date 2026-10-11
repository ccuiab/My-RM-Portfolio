# 工程页彩蛋视频交付与定位记录

核验日期：2026-10-12。仅修改 `D:\AI_playground\rm-wt\video`；原片从主仓库只读读取，未复制完整原片，未改 `src/`，未新增依赖。

## 输出与剪辑决策

| 文件 | 分辨率 | 时长 | 大小（十进制 MB） | 机位组织 |
| --- | --- | ---: | ---: | --- |
| [egg-stairs.mp4](../../videos/derived/web/egg-stairs.mp4) | 384×854 | 7.76 s | 0.66 | 原投稿上台阶完整动作 |
| [egg-steal.mp4](../../videos/derived/web/egg-steal.mp4) | 1280×720 | 13.52 s | 4.08 | 第一视角取矿 → 官方全景离岛 |
| [egg-grab.mp4](../../videos/derived/web/egg-grab.mp4) | 1280×720 | 13.52 s | 5.70 | 第一视角吸走矿石 → 官方同一交锋回看 |

三段均为 H.264、yuv420p、25 fps、CRF 24、无音轨、`+faststart`。两个机位之间交叉淡化 0.24 s；三段循环边界均将最后六帧淡化至最初六帧，输出从原开头后 0.24 s 开始。保持 1× 速度，不倒放、不变速。输出时长因机位交叠和循环交叠略短于输入总时长。

竖屏原片自身有横向倾斜，保持其 384×854 像素、构图和水印，不放大、不旋转。横屏保留完整比赛 HUD 和水印，缩小至 1280×720。封面来自对应最终视频，位于 `materials/images/derived/video-posters/egg-*.jpg`。

## 上台阶：BV1MV8nzFEcb P1

- 投稿：star_Light星《复活赛寄了，可以发了》。选取源时间 **00:06.24–00:14.24**。
- 目视依据：约 00:07 车轮开始上阶，00:09–00:11 底盘抬升，00:12–00:14 整车到达上层平台；剪辑结束于随后下行动作之前。后段也有上阶，但其动作前有人脚与相机移动遮挡，选择这一段完整近景。
- 关键帧：`C:\Users\cch20\AppData\Local\Temp\rm-shots\video\egg-stairs-key-ascent.jpg`，源 00:10.00，底盘抬升至平台。

## 偷银矿：复活赛第26场港科大 vs 华东理工，第二局

- 第一视角：**BV1YN83zCEUy P8，21:51.80–22:01.00**。投稿者翔林魔主。末端进入蓝色边界银矿石资源岛，靠近白色矿石，吸取后抬升并转离。
- 官方：**BV13T8ezrEwC P1，16:59.60–17:04.40**。投稿者 RoboMaster机甲大师。全景可见红方 2 号工程离开蓝方银矿石资源岛，作为第一视角取矿后的接续。
- 对齐依据：单帧 seek 得到 POV **21:57.00** 与官方 **16:56.00**，均为第二局倒计时 **5:01**；官方红方 2 号的资源岛位置与 POV 的蓝方岛边界一致。源时间差约 301 s。
- 官方这一刻没有吸盘近景，白色矿石被吸取与抬升以 POV 为主证据。
- 关键帧：`C:\Users\cch20\AppData\Local\Temp\rm-shots\video\egg-steal-pov-key.jpg`（21:57.00）；`C:\Users\cch20\AppData\Local\Temp\rm-shots\video\egg-steal-official-key.jpg`（16:56.00）。

## 抢矿：全明星赛，第二局

- 第一视角：**BV1YFhLz4Evi P10，39:05.60–39:14.80**。投稿者翔林魔主。红方 INNOVATOR 创新者工程为港科大工程，身份依据索引及历史全明星工程卡片 `materials/images/source/historical/eng-allstar.webp`。
- 目视依据：39:07 附近贴近蓝方 2 号工程；**39:09.00 / 倒计时 5:08**，吸盘接近其携带的黑色矿石；39:11–39:14 矿石被吸起，移至本机镜头前，蓝方工程退开。
- 官方：**BV1Uvt3zKEt4 P1，46:25.60–46:30.40**。投稿者 RoboMaster机甲大师。**46:25.00 / 倒计时 5:07** 可见红蓝 2 号在蓝方资源岛旁交锋，随后分离。官方是全景，取矿细节以 POV 为主证据。
- 此处官方剪辑为同一交锋的第二机位回看，计时器会回退数秒，不表示连续时间线。
- 合集 BV1r6tjzME6L P125–P132 已逐段看画面。对应动作是 **P131“斗舞现场”**（第二局约 5:09–5:02）；**P129“阴沟里捞矿”** 是约 6:44–6:21 在资源岛地面取矿，排除为这次抢矿。合集仅作交叉核验，未作为输出画面。
- 关键帧：`C:\Users\cch20\AppData\Local\Temp\rm-shots\video\egg-grab-pov-contact.jpg`（39:09.00，接触）；`C:\Users\cch20\AppData\Local\Temp\rm-shots\video\egg-grab-pov-lift.jpg`（39:14.00，矿石已随本机末端抬走）。官方对齐帧另见 `egg-grab-official-key.jpg`（46:25.00）。

## 复现、来源与验证

编辑参数、源文件路径、BV/分 P、起止秒数与时间码、UP 主、版权署名、原片目录中的既有 SHA-256 均在各视频旁的 `egg-*.source.json`。目录记录的原片 SHA-256 沿用来源索引，本轮未对全部大型原片重新哈希。画面版权与转播署名归原作者/赛事制作方，额外转载授权状态未核实。

从当前 worktree 执行：

```powershell
npm ci
.\scripts\cut-eggs.ps1
npm run build
```

脚本先查当前 worktree 的原片目录，缺少时从 `D:\AI_playground\My-RM-Portfolio` 只读读取，也支持 `-MainRepository` 指定原片库。仅提取五个短、静音、CRF 18 的输入片段至 `materials/videos/derived/inputs/egg-*.mp4`；按仓库规则这些输入在本地保留、被 Git 忽略，可用脚本重建。`-ReuseInputs` 可以复用已有短片段。脚本验证完整解码、格式、尺寸、无音轨、时长和严格 6,000,000 字节上限。

本轮验证通过：

- `npm ci` 成功，未修改依赖或锁文件。
- 全部视频以 `ffmpeg -xerror` 完整解码通过；`ffprobe` 确认单视频流、H.264 / yuv420p / 25 fps。
- MP4 顶层 atom 检查均为 `ftyp → moov → free → mdat`，确认 faststart。
- Chrome 无头浏览器，1440×900：三段均加载到 `readyState=4`，播放时间正常推进，播放至结尾后成功回到开头，无媒体错误。
- 浏览器截图：`C:\Users\cch20\AppData\Local\Temp\rm-shots\video\eggs-browser-1440x900.png`；详细浏览器结果在同目录 `browser-validation.json`。
- `npm run build` 成功，视频和封面均进入 `publish/current/video/`。构建有非致命的 chunk 体积告警。
- `npm run materials:inventory` 在当前 worktree 扫描；将本任务 15 个新增条目与 SHA-256 纳入清单，保留主仓库独有的大型忽略素材的此前快照，未把 worktree 缺失的原片当作删除。

本任务不负责页面组件接入；正式 URL 为 `video/egg-*.mp4` 与 `video/egg-*.jpg`，组件应通过项目的 `href()` 生成地址。官方机位都是远景，动作细节需要保留第一视角。未启动开发服务器；用于截图的临时 Chrome 已关闭。提交至当前分支，不推送。
