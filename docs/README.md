# 文档索引

日常先读根目录 [README](../README.md)，开发协作再读 [AGENTS](../AGENTS.md)。本页按阅读目的组织资料，旧报告中的状态按其日期与冻结版本解释。

## 使用与维护

| 要做什么                                       | 阅读入口                               |
| ---------------------------------------------- | -------------------------------------- |
| 打开本地最新代码、安装依赖、查看常用命令       | [项目入口](../README.md#本地运行)      |
| 阅读、问答、笔记、任务、备份与软件更新怎么使用 | [使用指南](usage.md)                   |
| 理解系统边界与当前架构评价                     | [整体架构](CODEMAPS/architecture.md)   |
| 找页面、子组件与样式                           | [前端地图](CODEMAPS/frontend.md)       |
| 找 IPC、业务服务与后台进程                     | [主进程地图](CODEMAPS/backend.md)      |
| 找数据库、密钥、索引和恢复位置                 | [数据地图](CODEMAPS/data.md)           |
| 找依赖、构建、评测和打包入口                   | [依赖与构建](CODEMAPS/dependencies.md) |
| 选择相关测试                                   | [测试说明](../tests/README.md)         |

## 交付与审查

- 最新主线整合：[设置更新入口、分支合并与相关回归](testing/updates-integration-2026-10-22.md)。

- 当前已发布首版：[最终交付回执](testing/github-preview-release-2026-10-15.md)。
- 后续源码维护：[全局审查](testing/full-code-review-2026-10-16.md) → [修复交接](testing/full-code-review-fixes-2026-10-16.md)。
- 用户体验维护：[试用报告](testing/user-trial-2026-10-16.md) → [优化交接](testing/user-trial-fixes-2026-10-16.md)。
- 目录与架构维护：[2026-10-21 整理范围、验证和开发监听修复](testing/structure-maintenance-2026-10-21.md)。
- 正式界面维护：[晴岛设计规范](design/SUNNY_ISLE.md)、[动效规范](design/SUNNY_MOTION.md)；[晴岛交接](handoffs/2026-10-18-sunny-isle.md)与[动效交接](handoffs/2026-10-21-sunny-motion.md)记录各自历史范围，离线设计演示不代表正式功能或本轮验收结果。
- 发布规则：[首版发布计划](releases/v1-release-plan.md)、[签名政策](releases/code-signing-policy.md)。
- 许可材料：[第三方说明](third-party-licenses.md)及 `releases/` 中的具体分发政策。

`testing/` 的分阶段清单、模型质量、规模和安装记录保留原文件名。它们的旧路径、测试数量、未执行项目与失败不因目录整理而改写；当前测试位置见测试说明。

## 历史归档

- [整理前的完整 README](archive/README-history-2026-10-21.md)：原使用长文、分阶段计划、候选构建和全部历史交付记录。
- [整理前的完整 AGENTS](archive/AGENTS-history-2026-10-21.md)：原 3.1～3.44 接手快照及当时完整协作说明。

新增资料按目的放置：当前使用写 `usage.md`；模块变化同步 `CODEMAPS/`；有日期和明确验证范围的结果写 `testing/`；发行材料写 `releases/`。不要再向根目录文档追加整段历史流水。
