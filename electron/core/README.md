# 主进程业务核心

此目录保留已有服务与存储文件名；后端测试统一放入 `__tests__/`，避免与业务实现混排。

| 查找内容       | 文件前缀／入口                                                                    |
| -------------- | --------------------------------------------------------------------------------- |
| 资料与解析     | `documents`、`document-parser`                                                    |
| 检索与向量     | `search`、`retrieval`、`vector-*`、`embedding*`                                   |
| 生成与历史     | `chat*`、`history*`、`citation-audit`、`evidence-policy`                          |
| 学习工作流     | `learning-*`、`note-feedback`、`practice`、`*-proposals`                          |
| 保存记录       | `storage`、`note-storage`、`memory-storage`、`planning-storage`、`review-storage` |
| 计时           | `focus*`、`study*`                                                                |
| 备份与位置切换 | `backup*`、`data-location`                                                        |
| 软件更新       | `app-updates`：固定官方发布元数据、安装包版本比较、缓存和浏览器目标               |
| 配置与系统能力 | `settings`、`models`、`model-health`、`credentials`、`errors`                     |

日常修改先看[主进程地图](../../docs/CODEMAPS/backend.md)和[数据地图](../../docs/CODEMAPS/data.md)。IPC 装配仍在 `electron/main.ts`，三个 worker 入口仍在 `electron/`。

单文件检查示例：

```powershell
npm test -- electron/core/__tests__/chat-stream.test.ts
```

移动测试时需同步相对 import、动态 import 和 `vi.mock` 路径；不要改断言来适配目录。完整测试分类见[测试说明](../../tests/README.md)。

更新服务不读学习库或聊天配置：匿名检查固定 GitHub 仓库最近最多 30 条发布（含预览），按有效 Windows x64 NSIS 附件的应用版本比较，成功缓存 5 分钟。主进程负责三个固定更新接口，沿用窗口权限与备份忙碌边界；只打开已验证的官方发布页，不下载安装包。维护细节及历史预览标签兼容见[主进程地图](../../docs/CODEMAPS/backend.md#软件更新边界)，对应规格为 `__tests__/app-updates.test.ts`。
