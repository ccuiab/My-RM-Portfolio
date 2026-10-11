# 发布文件夹

- `current/`：当前版本的完整网页，可直接交给静态托管服务。
- `history/<版本名>/`：每个历史版本的独立网页和资源，自动归档不会覆盖。
- `VERSIONS.md`、`versions.json`：全部本地版本的索引。
- 每个版本的 `version.json`：Git 提交、构建或部署时间、保存方式及可用的校验信息。

执行 `npm run build` 更新当前网页并新增历史快照。执行 `npm run archive:history` 从 GitHub 发布记录恢复旧版，完成后执行 `node scripts/archive-current.mjs` 刷新版次索引。

历史版本中的“原始发布包”与“源码重建”均有明确标记；本文件夹中的大型网页输出由 Git 忽略，保留在本机。GitHub Pages 工作流只上传 `current/`。
