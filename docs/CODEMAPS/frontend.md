# 前端地图

<!-- Updated: 2026-10-21 | Source files scanned: 167 -->

入口：`src/main.tsx` → `src/App.tsx` → `src/components/<功能>/`。App 管理工作台、导航和阅读侧栏；多个页面保持挂载以保存窗口内草稿。

| 组件目录    | 主要入口／职责                                       |
| ----------- | ---------------------------------------------------- |
| `home/`     | 首次引导、学习流程、今日任务、日历、最近阅读与待复习 |
| `library/`  | `LibraryPage`：导入、过滤和阅读入口                  |
| `reader/`   | `ReadingPage`、`PdfPage`、阅读工作区样式             |
| `chat/`     | `ChatPage`、`ModelAnswer`、`PracticeResult`          |
| `notes/`    | `NotesPage`、`NoteFeedbackPanel`                     |
| `agent/`    | `AgentPage`、路线编辑、任务与记忆提议面板            |
| `memory/`   | `MemoryPage`：手动管理长期记忆                       |
| `planning/` | `PlanningPage`、`PlanningEditor`                     |
| `focus/`    | `FocusPage`、`FocusHistoryPanel`                     |
| `reviews/`  | `ReviewsPage`：回忆、作答与手动复习安排              |
| `settings/` | `SettingsPage`、模型能力检查与嵌入设置               |
| `backup/`   | `BackupPanel`、备份忙碌对话框                        |
| `shared/`   | 证据卡片、生成状态、历史操作展示                     |

## 共享代码

- `src/lib/desktop.ts`：具体桌面调用的界面封装。
- `src/lib/types.ts`：renderer／preload／主进程共同契约。
- `src/lib/` 其他文件：日期、笔记、路线、练习等纯规则；`useBackupState.ts` 是界面 hook。
- `styles.css`：基础和仍未分离的功能样式；`themes.css`：三种主题语义变量。已有独立样式与所属组件同目录。

`ModelAnswer` 仍被笔记与路线复用，目录整理没有引入新的页面实例、状态库或 CSS 隔离机制。跨页通信优先沿用 App 的明确回调，不直接读取其他页面内部状态。

修改导航、引用或侧栏时，关注隐藏页面草稿、过期请求、焦点和组件卸载；相关流程在 `tests/reading-workspace.spec.ts`、`tests/rag.spec.ts`、`tests/reviews.spec.ts`。
