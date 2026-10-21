# 主进程与业务地图

<!-- Updated: 2026-10-21 | Source files scanned: 167 -->

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
| 基础能力   | `storage.ts`、`settings.ts`、`models.ts`、`model-health.ts`、`credentials.ts`、`errors.ts` |

## 后台入口

- `document-worker.ts`：资料解析；失败和取消不提交半份资料。
- `search-worker.ts`：关键词／向量检索与 CPU 嵌入；故障明确降级，取消不重试。
- `backup-worker.ts`：复制、快照和完整性校验；确认进程退出后才清理与解锁。

服务调用链：IPC 参数校验 → 当前保存配置／记录／预览 → 业务操作 → 版本化持久化／事件。Renderer 不传 SQL、路径、提示模板或自行构造的证据。

核心规格位于 `electron/core/__tests__/`。`interface-wiring.test.ts` 仍检查类型、desktop 封装、preload 和 main 的 90 个方法对应关系；本轮未拆走 handler，因此该检查继续有效。

`Storage` 统一打开主库并挂载各领域存储；它与 `documents.ts` 存在校验复用，后续若拆目录应先梳理依赖，避免仅靠文件夹掩盖循环引用。
