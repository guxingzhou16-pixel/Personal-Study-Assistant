# 数据与恢复地图

<!-- Updated: 2026-10-21 | Source files scanned: 167 -->

| 数据               | 版本／位置                                   | 所有者                             |
| ------------------ | -------------------------------------------- | ---------------------------------- |
| 学习主库           | v13，`study-companion.sqlite3`               | `Storage` 及领域存储               |
| 签到／累计学习时间 | v1，`study-activity.sqlite3`，`study_days`   | `StudyStorage`                     |
| 派生全文／向量     | v2，`search-index.sqlite3`                   | 检索 worker；可重建                |
| 资料副本           | 活动学习目录的 `sources/`，内容 SHA-256 命名 | `Documents`                        |
| API 密钥           | 根数据目录的独立密文，按服务地址绑定         | `Credentials`／Windows safeStorage |
| 固定本地嵌入模型   | 根数据目录的 `embedding-models/`             | `EmbeddingFiles`                   |

## 主库表

- 设置与资料：`app_settings`、`sources`、`source_segments`。
- 问答与学习历史：`conversations`、`chat_turns`；用途、证据、笔记／路线／练习快照存于受校验字段。
- 用户作品与偏好：`notes`、`memories`。
- 安排与专注：`study_projects`、`daily_tasks`、`focus_sessions`。
- 保存作答：`practice_reviews`，保留题目、参考答案与证据快照。

迁移集中由 `storage.ts` 编排，领域模块提供迁移片段。既有 revision 用于冲突保护；展示状态与写入成功回执分开。

## 路径与备份

本地双击入口默认使用 `user-data/local-preview/`；安装版默认在该 Windows 用户的 APPDATA 下。恢复后活动学习目录可改变，密钥和嵌入模型仍使用根数据目录；由 `data-location.ts` 解释 active／pending 标记。

完整备份 format 1 支持真实 12/1、13/1，包含两库和全部资料副本，仅含已保存内容；不包含密钥、模型、派生索引或未确认提议。恢复是整份替换，启动再次校验并保留原目录，不直接覆盖活动 WAL 文件。

不要手动调整 `PRAGMA user_version`、拆走单个活动数据库、清空数据目录或把索引当原始数据。实际操作看[使用指南](../usage.md#备份与恢复)；目录整理不迁移用户数据。
