# 前端地图

<!-- Updated: 2026-10-22 | Scope: update panel and Sunny Isle motion integration -->

入口：`src/main.tsx` → `src/App.tsx` → `src/components/<功能>/`。App 管理工作台、导航和阅读侧栏；多个页面保持挂载以保存窗口内草稿。

| 组件目录    | 主要入口／职责                                            |
| ----------- | --------------------------------------------------------- |
| `home/`     | 首次引导、学习流程、今日任务、日历、最近阅读与待复习      |
| `library/`  | `LibraryPage`：导入、过滤和阅读入口                       |
| `reader/`   | `ReadingPage`、`PdfPage`、阅读工作区样式                  |
| `chat/`     | `ChatPage`、`ModelAnswer`、`PracticeResult`               |
| `notes/`    | `NotesPage`、`NoteFeedbackPanel`                          |
| `agent/`    | `AgentPage`、路线编辑、任务与记忆提议面板                 |
| `memory/`   | `MemoryPage`：手动管理长期记忆                            |
| `planning/` | `PlanningPage`、`PlanningEditor`                          |
| `focus/`    | `FocusPage`、`FocusHistoryPanel`                          |
| `reviews/`  | `ReviewsPage`：回忆、作答与手动复习安排                   |
| `settings/` | `SettingsPage`、`AppUpdatesPanel`、模型能力检查与嵌入设置 |
| `backup/`   | `BackupPanel`、备份忙碌对话框                             |
| `shared/`   | 证据卡片、生成状态、历史操作展示                          |

## 共享代码

- `src/lib/desktop.ts`：具体桌面调用的界面封装。
- `src/lib/types.ts`：renderer／preload／主进程共同契约。
- `src/lib/motion.ts`、`src/styles/motion.css`：晴岛语义动效与减少动态效果支持；组件用 `data-motion` 标记状态。
- `src/lib/` 其他文件：日期、笔记、路线、练习等纯规则；`useBackupState.ts` 是界面 hook。
- `styles.css`：基础和仍未分离的功能样式；`themes.css`：三种主题语义变量。已有独立样式与所属组件同目录。

`ModelAnswer` 仍被笔记与路线复用，目录整理没有引入新的页面实例、状态库或 CSS 隔离机制。跨页通信优先沿用 App 的明确回调，不直接读取其他页面内部状态。

修改导航、引用或侧栏时，关注隐藏页面草稿、过期请求、焦点和组件卸载；相关流程在 `tests/reading-workspace.spec.ts`、`tests/rag.spec.ts`、`tests/reviews.spec.ts`。

## 设置中的软件更新

`settings/AppUpdatesPanel.tsx` 与同目录 CSS 负责版本、状态、更新说明和操作按钮；经 `desktop.ts` 调用三个固定接口，不直接联网或接受任意外部地址。打开设置时检查，成功缓存由主进程管理；说明只作文本展示，不执行 HTML 或加载远程图片。仅在发现更高安装包版本时显示“升级最新版”，点击打开官方发布页，由用户手动下载安装；错误与上次成功结果分别显示。本地开发运行的同版本提示不声称源码已经与发行版一致。

## 晴岛与动效维护

整合晴岛外观与动效时保留当前全部学习入口、聊天常驻、异步导航、选文和窗口内草稿；视觉不修改学习记录或模型权限。`src/styles/tokens.css`／`study-home.css` 和原创 `src/assets/sunny-isle-plant.svg` 维护晴岛基础外观，三种主题仍由 `themes.css` 管理。动效只跟随明确状态切换，不为每秒计时、进度轮询或流式文本重复播放；保留 `hidden`／`inert` 语义、PDF 文字层坐标及系统减少动态效果偏好。

正式规范见[晴岛](../design/SUNNY_ISLE.md)与[动效](../design/SUNNY_MOTION.md)。`design-lab/` 中的演示仅供离线设计验证，使用示例数据，不接桌面桥接、不读写学习数据；不要把演示 JS／CSS 导入正式组件或把演示当作已交付功能。
