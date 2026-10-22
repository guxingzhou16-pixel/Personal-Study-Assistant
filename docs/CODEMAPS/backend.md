# 主进程与业务地图

<!-- Updated: 2026-10-22 | Scope: update service and desktop integration -->

入口 `electron/main.ts` 装配存储与服务、注册固定 IPC、管理窗口／退出／睡眠。`preload.ts` 解包结构化结果并转发有限事件。

## core 服务归属

| 领域       | 关键文件                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------ |
| 资料       | `documents.ts`、`document-parser.ts`：副本、哈希、导入、选文与引用                         |
| 检索       | `search.ts`、`retrieval.ts`、`vector-retrieval.ts`、`vector-index.ts`                      |
| 嵌入       | `embedding-files.ts`、`embedding-model.ts`、`embeddings.ts`                                |
| 生成       | `chat.ts`、`chat-stream.ts`、`chat-storage.ts`：单活动请求、协议、保存与恢复               |
| 学习工作流 | `note-feedback.ts`、`learning-agent.ts`、`practice.ts`                                     |
| 确认写入   | `memory-proposals.ts`、`task-proposals.ts`：预览、版本、确认与取消                         |
| 学习记录   | `note-storage.ts`、`memory-storage.ts`、`planning-storage.ts`、`review-storage.ts`         |
| 计时       | `study.ts`／`study-storage.ts`、`focus.ts`／`focus-storage.ts`                             |
| 备份       | `backup.ts`、`backup-runner.ts`、`backup-files.ts`、`backup-data.ts`、`data-location.ts`   |
| 软件更新   | `app-updates.ts`：官方发布元数据、版本比较、成功缓存与固定浏览器目标                       |
| 基础能力   | `storage.ts`、`settings.ts`、`models.ts`、`model-health.ts`、`credentials.ts`、`errors.ts` |

## 后台入口

- `document-worker.ts`：资料解析；失败和取消不提交半份资料。
- `search-worker.ts`：关键词／向量检索与 CPU 嵌入；故障明确降级，取消不重试。
- `backup-worker.ts`：复制、快照和完整性校验；确认进程退出后才清理与解锁。

服务调用链：IPC 参数校验 → 当前保存配置／记录／预览 → 业务操作 → 版本化持久化／事件。Renderer 不传 SQL、路径、提示模板或自行构造的证据。

核心规格位于 `electron/core/__tests__/`。`interface-wiring.test.ts` 检查类型、desktop 封装、preload 和 main 的 93 个方法（87 个请求、6 个可移除事件）对应关系。新增 `getAppVersion()`、`checkAppUpdate(force?: boolean)`、`openAppUpdate('latest' | 'history')`，分别使用 `study:get-app-version`、`study:check-app-update`、`study:open-app-update` 固定频道，继续经过原 `handle` 的主窗口／主 frame 与备份忙碌校验。

`Storage` 统一打开主库并挂载各领域存储；它与 `documents.ts` 存在校验复用，后续若拆目录应先梳理依赖，避免仅靠文件夹掩盖循环引用。

## 软件更新边界

`AppUpdates` 从 `app.getVersion()`／`app.isPackaged` 取得当前版本，由主进程通过 Electron `net.fetch` 匿名请求固定仓库 `guxingzhou16-pixel/Personal-Study-Assistant` 的 `releases?per_page=30`。只检查这批最多 30 条发布记录，包含预览版；不使用会排除预览版的 `/latest`，不翻页扫描全部历史。请求不带 Authorization、不发送学习内容或模型配置，拒绝重定向，响应最多 512 KiB、15 秒超时；网络、限流或数据错误明确返回失败。

只选择非草稿且有已上传、正大小、同仓库下载地址的 Windows x64 NSIS 附件，按 `StudyCompanion-<version>-win-x64-setup.exe` 的实际应用 SemVer 选最高版本，标签的主／次／补丁版本须对应。首个 `v0.1.1-preview.1` 标签实际装的是 `0.1.1`，保留此兼容判断；未来发布必须递增真实 `package.json`／安装包版本，不能只改标签。同版本的本地开发运行报告 `development`，不声明源码与发行版一致。

成功结果仅在本进程缓存 5 分钟，在途检查合并；手动 `force=true` 刷新，失败不写成功缓存。主进程保留核对过的发布目标，`openAppUpdate` 只接受两个固定选项，在系统浏览器打开该标签页或固定发布历史页；不接受 renderer URL，不下载或执行安装程序。发布说明作为有界纯文本交给界面。当前手动更新和未签名安装提示见[使用指南](../usage.md#版本信息与手动更新)。
