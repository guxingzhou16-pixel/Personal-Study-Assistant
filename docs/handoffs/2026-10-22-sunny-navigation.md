# 晴岛导航精简：实施交接

日期：2026-10-22。基线：本地 `main` 的 `cfc2597`，包含上一轮动效及当前完整学习功能。工作分支：`codex/sunny-isle-navigation`。用户授权本轮实现、设计归档和本地提交；不合并 main、不推送、不生成发行包。

## 已实施行为

- 主导航精简为学习首页、资料库、学习助手；左上角品牌旁设置齿轮，右上角仅昵称首字头像，原版本号移到页脚。
- 首页资料下方显示路线、笔记的真实摘要及详情链接；没有记录、加载和错误分别呈现。首次引导默认折叠。
- 专注、计划、复习、记忆改从设置学习工具进入；待复习摘要移到该区。首页保留今日任务、日历、签到和累计计时。
- 二级页面提供返回父级，首页／设置选中状态对应所属功能；阅读、引用及跨页目标继续使用原路径。

## 代码与数据

正式规范：[SUNNY_NAVIGATION](../design/SUNNY_NAVIGATION.md)。机器入口：[选定档案](../../design-lab/selected-design.json) → [本轮设计 JSON](../../design-lab/2026-10-22-sunny-navigation/design.json)。

主要修改为 App、首页摘要、首次引导、设置工具、笔记定位及对应 CSS。移除被替代的 `HomeStudyFlow`。只增加 React 内部回调／定位参数，未修改 `electron/`、共享 IPC 类型、数据库版本、模型协议或依赖。运行时不引用设计演示。

摘要复用 `listNotes`／`listLearningDrafts`，备份期间暂停，effect 清理拒绝旧结果；恢复窗口、回到首页或路线终态事件时刷新，流式片段不触发读取。笔记定位复用 `requestAction`，不同记录仍触发原脏稿确认，同一记录保持当前草稿。

相关测试改用 `tests/helpers/navigation.ts` 从新的用户入口进入，原业务断言保留；原九项顶栏的专属断言更新为三项主导航及设置归属。

## 实际验证

2026-10-22 本机实际执行，使用隔离数据、合成资料、模拟模型及假密钥；未使用收费接口：

- `npm run desktop:build`：通过，包含两套 TypeScript 检查、Vite 与全部 Electron 入口构建。保留既有大体积 PDF／界面 chunk 提示，未因此引入打包重构。
- 下列定向 Electron 流程 **29 项通过（2.1 分钟）**，覆盖导航、首次引导、模型设置与更新、真实签到／累计时间、笔记草稿、引用、阅读侧栏、聊天不断流、检索、模拟嵌入下载取消和备份恢复。

```powershell
npx playwright test tests/navigation.spec.ts tests/first-use.spec.ts tests/desktop.spec.ts tests/chat.spec.ts tests/learning-journey.spec.ts tests/notes.spec.ts tests/reading-workspace.spec.ts tests/focus-outcomes.spec.ts tests/reviews.spec.ts tests/motion.spec.ts tests/themes-audit.spec.ts tests/calendar.spec.ts tests/rag.spec.ts tests/embedding.spec.ts tests/app-updates.spec.ts --max-failures=2
```

- 专注导航追加流程 **1 项通过（15.7 秒）**：`npx playwright test tests/acceptance-v12.spec.ts --grep 'completes a manual project' --max-failures=1`。启动真实任务计时后切换首页与资料库，核对同一专注仍在运行，再经设置返回暂停／继续／结束、手动完成及重启恢复。合计本轮 **30 项不同桌面规格通过**，未跑全局核心测试套件。
- 新导航规格分别检查正常／减少动态效果、1280×900／900×640、三个主入口、齿轮与头像位置、键盘展开、空记录、已有记录、保存／删除后刷新、读取失败重试、不同笔记的脏稿确认、路线终态刷新、备份暂停与迟到结果。
- 三主题下 100%～200% 缩放的导航、焦点和可见性检查通过；原业务断言保留，旧九项顶栏专属定位改为当前用户入口。
- 离线预览通过 **60 个页面／尺寸／动态偏好组合**：10 个页面、1280×900／900×640／390×844、正常／减少动态效果，无横向溢出、脚本错误或 HTTP 请求。空态切换、详情及设置返回检查通过，结果见[validation.json](../../design-lab/2026-10-22-sunny-navigation/validation.json)。
- 产出 4 张布局示例及 2 张真实 Electron 隔离数据截图。截图审查修正了全局 `.text-button` 覆盖摘要链接的 display；增强选择器，并新增“链接在时间下方”断言，避免链接挤到时间后面。
- 初始导航 RED 明确复现旧九项顶栏；中途两处旧测试定位已按新位置修正，分别为保存路线详情与设置内待复习摘要，最终全部通过。
- 修改源码／测试、独立预览及新文档的 Prettier 检查、`git diff --check`、设计 JSON Schema、本地文档链接、档案路径和插画 SHA-256 核对通过。
- 完成范围内代码自查：父级导航归属、组件常驻、effect／事件清理、失败与空态、笔记脏稿保护、CSS 覆盖与示例脚本输入边界。未修改 IPC、数据库、密钥及模型协议；未将用户数据或生成构建物纳入提交。

## 交接限制

仅调整入口和信息展示，首页不提供完整编辑器。摘要不判断知识掌握，也不把路线预算计入真实时长。关闭或重载仍需保存未保存输入，未新增表单持久化。

演示的所有内容是示例，正式截图与测试只使用隔离目录、合成资料和模拟模型。不读个人资料或真实密钥。本轮不验证真实模型质量、真实 BGE 性能、安装器、远端 CI 或发布下载；原能力各自的历史验证按原交接解释。

本地提交号以 Git 记录及最终交付说明为准；设计档案不将本地提交称为 GitHub 已同步。
