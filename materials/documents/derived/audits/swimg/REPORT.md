# swimg 原生截图准备与阻塞记录

本轮目标尚未完成。没有生成或替换任何 SolidWorks 终稿，也没有修改页面图片引用。开始时无 SLDWORKS 进程，可用内存低于用户要求的 2000 MB；取得 heavy 锁后，以约 30 秒间隔复查十分钟，21 次采样均为 1146–1367 MB，因此按用户规定停止，立即释放锁。完整等待结果见 `preflight-results.json`。SolidWorks、Blender、浏览器和开发服务器均未启动。

工作目录为 `D:\AI_playground\rm-wt\swimg`，分支 `polish-swimg`。主仓库、`D:\RM2025` 和 OneDrive 均未写入；没有复制大型 CAD、GLB 或视频文件，没有运行素材清单刷新。

## 已交付的准备工作

- `scripts/preflight-sw-research.ps1`：记录两个 CAD 来源目录下所有文件的路径、长度和 UTC 修改时间，只对两个顶层 SLDASM 计算 SHA-256；可单独执行内存门槛检查。PowerShell 5.1 使用 UTF-8 BOM，以保持中文源路径正确。
- `scripts/render-sw-research.ps1/.cs`：原生截图管线草稿。使用 typed interop；从主仓库归档的 `SwProbe.cs` 直接 Add-Type 编译，不依赖已不存在的 DLL 或 output 目录。一次仅打开一个只读装配，选项为 67，调用 MarkAllRO；仅 SaveBMP 输出视口位图，不保存 CAD。背景、窗口、搜索路径、只读偏好、自动保存和备份偏好在内存中备份并在 finally 恢复，之后关闭文档并退出自己启动的 SW。
- `scripts/render-sw-research-components.json`：从上一轮第四版 candidate-a.json 提取的组件匹配计划，包含隐藏、半透明和保持实体的名称。未经过本轮 SW 实例名核验，不能当作实际处理结果。
- `scripts/matte-sw-research.py`：确定性的白底/黑底差分抠图；三通道差分取中位数得到 alpha，黑底 RGB 除以 alpha 得到 PNG 的非预乘颜色。不使用生成式修改或阈值裁掉淡色板件；可无损裁剪，缩放时使用预乘 alpha 的 Lanczos。不提前应用站点 CSS 调色。

原生辅助代码与既有 SwProbe、Task2Sw、Task3Sw、SwImage 五份源文件一并编译通过；两个 PowerShell 文件语法检查通过。原生截图管线仅完成编译和语法验证，尚未运行验收。

## 组件处理计划（尚未在 SW 执行）

七个半透明组件计划保持原色，只将材质 transparency 改为 0.82：

| CAD 实例名 | 计划 |
| --- | --- |
| `4mm_发机主上板-1` | 半透明，保留轮廓线 |
| `4mm_主摩擦轮加固板-1` | 半透明，保留轮廓线 |
| `2mm_主摩擦轮侧保护壳-1` | 半透明，保留轮廓线 |
| `2mm_主摩擦轮侧保护壳-2` | 半透明，保留轮廓线 |
| `4mm_2006电机固定板-1` | 半透明，保留轮廓线 |
| `4mm_2006电机对轴固定板-1` | 半透明，保留轮廓线 |
| `3mm_云台左侧主支架垫片-1` | 半透明，保留轮廓线 |

顶板 `3mm_供弹摩擦轮上板-1` 及 23 个顶板专属支承/紧固件，连同第四版排除的外罩、后部云台、电控和外围配件均列在 JSON 的 hidden 中。hidden 共 125 个名称，solid 共 70 个名称；这些是 GLB 审计的匹配计划，包含子装配及其子件，不能直接解释为 SW 实际零件数量。实际 SW 名称有任何未匹配项就抛出错误，不按模糊关键词批量隐藏。

底板 `4mm_发机主下板-1`、两个大摩擦轮、一个预加速小轮、完整电机、轴、枪管及蓝色测速模块计划保持实体。新管线不裁切电机网格或线缆。工程舵轮计划保留完整模组、悬挂滑轨和气弹簧；隐藏所有辅助显示类型，使用带边线上色，并关闭 RealView、环境遮蔽、地面阴影与反射。

## 双底抠图的数值检查

只完成合成样本验证，不能替代真实 SW 材质验证。64×64 RGB 样本包含 alpha 为 0、0.18、0.25、1 的四个区域：

- 实体 RGB 精确保留；完全透明像素为 RGBA 0；部分透明板没有被阈值删掉。
- 最大 alpha 误差为 0.003529419；8-bit 输入量化下，低 alpha 区域最大颜色误差为 6/255。
- 白底重合成最大误差约 1.118/255；实体内部 `|W−B|` 为 0。
- 尺寸不一致的输入会被拒绝。

脚本会记录实体内部差分分布、RGB 通道差分跨度、白底重合成误差及负差分像素数。默认的实体区域由推算 alpha 得到，只是代理检查；支持额外传入独立的实体 mask。真实反射检查必须在取得原生截图后完成，不能根据推算 alpha 自证不存在背景反射。

如果材质反射背景，差分不再满足单一 alpha 的合成模型。应关闭 RealView、反射、阴影和 AO 后重新截取，保留 SW 原色；不对异常像素进行生成式修复。

## 源文件快照

快照覆盖 `D:\RM2025\New_Hero_gimbal_2.0` 和工程开源结构根目录，共 854 个文件、1,628,575,184 bytes。逐文件长度与修改时间以及顶层装配 hash 保存到 worktree 外的 `D:\AI_playground\rm-wt\shared-inputs\swimg\source-*.json`。本轮没有打开任何 CAD 文档或解析 OneDrive 引用；不会把这次快照说成已验证一次 SW 开关文档对所有引用目录均无写入。

收尾快照与初始快照对比：文件数与总长度一致；新增 0、删除 0、长度或修改时间变化 0；两个顶层装配 SHA-256 均一致。记录区间为 UTC `2026-10-12T17:57:44` 至 `2026-10-12T18:05:25`。快照覆盖范围与原始记录路径见 `preflight-results.json`。

| 顶层装配 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `Main_assembly/发机_4310pitch.SLDASM` | 109134016 | `564bafb94a2be2be67d37eee3df23b4893c2096ee20e6e63929acf7691bb9e60` |
| `3508_3508舵轮模组/3508_3508_Swerve_drive_v2.2025.10.1.SLDASM` | 10128154 | `7365110a387f236d3d0699d99616bec419506b61e0394f70590f2f1290a04e56` |

## 验收状态与后续入口

`npm ci` 成功，209 packages audited，0 vulnerabilities；未新增依赖。`npm run build` 两次通过，均输出 10 个页面；最近构建记录为 `publish/history/20261012-180211290-local-d0d9b3c/`，日志位于 `C:\Users\cch20\AppData\Local\Temp\rm-shots\swimg\build.log`。管线准备里程碑已提交为 `672dbea`。

证据目录为 `C:\Users\cch20\AppData\Local\Temp\rm-shots\swimg\`。当前只有抠图合成样本与数值检查、构建日志及阻塞报告；没有 SW 视口截图、原生终稿深/白底预览、页面桌面/手机截图，不把合成样本称为验收截图。

尚未完成：两个装配的只读实际打开、引用核验与源快照回归；枪口轴向和最终视角矩阵；A1 七块板的实际透明度与黑色轮廓；舵轮完整悬挂视角；真实双底差分及反射自检；长边至少 1600 px 的两个终稿与构图度量；中英文 1440×900 / 390×844 页面验收；content.ts、provenance.json 和 A1 素材说明更新。A1、A2、A3、hero-wheel、eng-wheel 与 3D 脚本均未修改。

后续在满足内存门槛后，先用 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/render-sw-research.ps1 -Asset launcher -ProbeOnly` 获取实际组件 bounds 和试拍。核验 CAD 轴向、组件名和视角后，再传入 `-ViewMatrix`（九个逗号分隔的 CAD-to-view 矩阵数值）与 `-Size` 获取一致白/黑底。舵轮用 `-Asset swerve` 单独处理。该入口会重新取锁并重新检查内存，不复用本轮的预检结果。

风险：原生管线尚未运行；如果 SW 卡死触发 14 分钟紧急终止，进程内 finally 可能无法完成偏好恢复，需要依据 preferences-before.json 核查恢复后再重试。未经原生截图与源快照验证，不应将该管线输出直接写入站点。

收尾核验：无 SLDWORKS 进程；heavy 锁不存在；4373 无监听。没有 push、切换分支或修改其他 worktree；没有修改素材清单或任何现有图像文件。

API 依据：[IModelView.Orientation3](https://help.solidworks.com/2025/english/api/sldworksapi/SOLIDWORKS.Interop.sldworks~SOLIDWORKS.Interop.sldworks.IModelView~Orientation3.html)；具体方法与枚举另已通过本机 SolidWorks.Interop 反射和 Add-Type 编译核对。
