# 2026-10-16 试用反馈修复与体验优化：编码交接

## 范围与起点

按 `user-trial-2026-10-16.md` 处理 U-01～U-04。用户另外确认本次落实首次引导、生成等待与路线流程优化；资料移除/重命名及全局专注提示后续再做。

修复位于 `E:\私人学习助手`，HEAD 保持 `24efad1ef0e1c329557e29808cc7515281b92e85`。本轮起点已经包含上一轮未提交修复，不能把相对 HEAD 的全部 diff 当成本轮增量。起点源码在本轮产物目录 `before/` 保存；没有 commit、push、reset、checkout、安装依赖、更新发行附件或处理个人学习数据。

本文件是编码代理的自检交接，等待独立窗口审查，不是发布或最终审查结论。

## 四项修复

| 编号 | 根因与改动 | 文件 |
| --- | --- | --- |
| U-01 | 上轮把中英混合问句的普通英文词强制当成技术名称，造成回归。本轮将请求方式词从关键词覆盖中去噪，只对缩写、标识符或候选证据中有对应命名形式的词执行强制匹配；首字母大写的普通祈使语也不直接当名称。关键词和向量路径一致，大小写及带扩展名的资料名可匹配。保留 TCP、比较主题与范围保护，也覆盖“给个例子”。 | `electron/core/retrieval.ts`、`electron/core/vector-retrieval.ts` |
| U-02 | 复习页当前编辑记录的 revision 没有随其他入口更新，且没有保留草稿的恢复动作。新增读取最新作答/比较区域，由用户明确选择采用保存内容或保留输入更新编辑基线；作答、疑问和日期一并处理，不自动提交，主进程乐观锁保留。 | `src/components/ReviewsPage.tsx`、`ReviewsPage.css` |
| U-03 | 相同创建时间后按随机 UUID 排序。数据库按状态、创建时间和 rowid 排序；前端稳定排序保留其顺序，更新原任务时在原位置替换。没有伪造时间、修改 UUID 或增加数据库字段；测试中刻意反转 UUID 顺序验证与随机 ID 无关。 | `electron/core/planning-storage.ts`、`src/components/PlanningPage.tsx` |
| U-04 | 日历绝对定位的 `.sr-only` 缺少定位容器，撑开外层文档。仅给 `.daily-section` 增加 `position: relative`，保留状态播报，不隐藏溢出来掩盖问题。 | `src/styles.css` |

## 三项体验优化

| 操作 | 之前 | 现在 |
| --- | --- | --- |
| 首次引导 | 放在日历/学习流程下方，首次打开难发现；切页后示例状态丢失 | 放到首页欢迎卡之前；按内置示例的 SHA-256 读取真实已导入记录，跨设置页/重启可找回。只读取，不自动导入；已配置模型时保留原来的默认折叠行为。 |
| 等待生成 | 空白期间只显示等待文字 | 普通聊天、资料问答、练习、笔记反馈及路线显示从本次请求 `createdAt` 计算的经过时间，区分尚未收到/正在接收正文，持续提供停止入口；30 秒后提供换小模型的建议。无百分比、不展示内部推理、不声称生成提速；计时使用等宽数字，时间每秒变化不重复播报。 |
| 路线转任务 | 前端确认路线 → 预览 → 最终确认，说明重复占位 | 合并为校验后预览 → 最终确认；保留完整写入内容、明确确认、取消、编辑使旧预览失效、主进程校验和防重放。补充说明收进可展开区域，没有自动写入任务。 |

界面文件：`src/App.tsx`、`FirstUseGuide.tsx`、`GenerationStatus.tsx/.css`（新增）、`ChatPage.tsx`、`NoteFeedbackPanel.tsx`、`AgentPage.tsx`、`ModelAnswer.tsx`、`LearningPlanPanel.tsx`。以上组件均位于 `src/components/`（`App.tsx` 除外）。未增加 IPC 方法或改变数据库结构。

## 复现与验证

本轮独立产物目录：

```text
E:\私人学习助手\artifacts\user-trial-fixes-20261016-464d8c71-f2f9-4cc7-a591-d12ac5437380
```

桌面构建/运行与检索评测使用其中的 `runtime/` 普通源码副本；复用已有依赖和公共评测权重 junction，未覆盖共享 `dist/dist-electron`，不是重新锁安装的正式候选验收。核心测试在主目录运行。Electron 仅使用唯一临时数据与合成资料，聊天服务为本机模拟协议，BGE 为真实固定 CPU 模型。

### 失败记录

- `core-red.log`：首轮 7 项失败；随后拆开关键词/混合两条路径，`core-red-2.log` 为 12 失败、1 通过。另补首字母大写的普通请求，`capitalized-requests-red.log` 的 4 项先失败。最终新增核心 17 项均通过，未改原 27 题题目、资料或标注。
- `ui-red.log`：引导位置、双滚动条、路线冗余确认及等待信息的预期失败保留。其中复习用例最初因合成会话没有正确命名而未进入目标流程，不能把该脚本问题算成产品缺陷。
- 修正会话设置后，单独把本轮起点的 `ReviewsPage.tsx` 复制到自己的 runtime 做前后对照，没有回退主目录。`review-red.log` 先经过版本冲突，再因缺少读取最新作答入口失败；恢复当前组件后该流程通过。
- 现有 `learning-journey.spec.ts` 改为对预览按钮验证无效预算会阻止继续，先选中步骤使该负例保持有效；移除旧中间按钮操作，原最终预览、取消不写入、明确确认与重启恢复断言保留。`embedding.real.ts` 追加三种英文请求，原 CPU/离线/出处/取消/缓存/损坏降级断言保留。

### 实际结果

| 命令 | 结果与证据 |
| --- | --- |
| `npm test -- --testTimeout=30000` | **34 文件、405/405**；`core-final.log`。包含新增 `electron/core/user-trial-regressions.test.ts` 的 17 项。 |
| `node node_modules/@playwright/test/cli.js test tests/user-trial-fixes.spec.ts tests/learning-journey.spec.ts tests/reviews.spec.ts tests/calendar.spec.ts tests/chat.spec.ts --output='../desktop-final-results'` | **10/10，33.7 秒**；`desktop-final.log`。新增 6 场景及 4 条相关旧流程，含备份实际恢复重启的源码流程。 |
| 新用例四场景补验 | **4/4**；`ui-extra.log`。补充采用最新作答时的响应/疑问/日期恢复、无额外写入，以及三张界面截图；不是另外四个独立产品场景。 |
| `npm run test:embedding -- --output='../embedding-final-results'` | **1/1**；`embedding-final.log`。真实 BGE 同时覆盖 demo、review、Describe，请求聊天仅一次模拟服务，无收费 API 或新模型下载。 |
| `npm run eval:retrieval`、`npm run eval:hybrid` | 原两套合计 27 题，两种模式 Mean Recall@4、Mean Target Precision@4、空证据准确率均为 **100%**，无降级；`retrieval-final.json`、`hybrid-final.json`。这是开发回归集，不是新独立语义成绩。 |
| `npm run desktop:build` | 通过；`build-final.log` 含两套 TypeScript、Vite、主进程/预加载/worker 构建，保留既有大资源块提示。 |
| `npm run typecheck`、`npm run format:check`、`git diff --check` | **全部通过**；`typecheck-final.log`、`format-final.log` 与验证元数据，未跳过或移除门禁。 |

截图在 `ui-extra-results/`：`guide-first-screen.png`、`home-minimum-single-scroll.png`、`generation-waiting.png`。已实际查看；最小窗口的侧栏可独立滚动，修复的是外层文档多余滚动。等待截图的 31 秒由受控浏览器时钟推进，用于验证显示逻辑，不是模型响应性能记录；实际状态/正文/停止仍走真实 IPC 与模拟 HTTP 流。

## 独立审查重点与边界

1. 检索规则仍是有界启发式，检查普通英文请求不会变成名称硬门槛，同时保留技术主题、范围、对比和不可答保护。新增问句也已参与开发，不宣称自然表达全部解决或真实模型结论正确。
2. 复习两个恢复选择都不得丢弃未明确放弃的输入、静默改版本重发；拒绝/失败/重新读取时继续保留草稿。对同题双入口继续核对乐观锁。
3. **任务顺序需要人工核对：**同批时间相等时使用 SQLite rowid 的持久顺序，前端稳定排序和原位更新一致；未来备份/重建不可丢失 rowid。此次无 schema 迁移，现有备份已保留 rowid。
4. **路线确认需要人工核对：**去掉的是前端冗余确认，不是最终任务确认。无效预算、变化的来源/项目、取消、过期及重复确认仍由原主进程规则约束。
5. 等待时间是请求经过时间，不是推理阶段、进度或学习时长。空正文、部分正文、停止、失败和跨页时正确销毁/恢复计时；不得展示模型内部推理正文。
6. 未重新跑真实 Ollama 语义/长时间性能、所有主题/复杂资料、全容量、完整普通桌面套件或 NSIS 安装链；未更新远端 CI 或公开发行附件。资料移除/重命名和全局专注提示按用户确认延期。旧发布包与本轮源码结果分开。
