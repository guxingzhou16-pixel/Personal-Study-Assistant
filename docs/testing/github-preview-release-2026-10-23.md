# 拾知 0.1.2：最终安装包与 GitHub 交付

交付日期：**2026-10-23**。维护预览已公开：[GitHub 发布页](https://github.com/guxingzhou16-pixel/Personal-Study-Assistant/releases/tag/v0.1.2-preview.1)。本页只记录本次最终源码、安装器和验证范围；0.1.1 的历史证据不改写为本次成绩。

## 固定发布物

| 项目 | 实际对象 |
| --- | --- |
| 软件与目标 | 0.1.2，Windows x64，当前用户 NSIS，未签名 |
| 源码与标签 | `4471f349765dd7aacf2d09fec7ad5062509db3c6`；`v0.1.2-preview.1` 注解标签已解引用核对 |
| 安装器 | `StudyCompanion-0.1.2-win-x64-setup.exe`，140,695,049 字节 |
| 安装器 SHA-256 | `7650e1e44a5d0099b53fc36268a39008d656c00b1d8380404fd0b4836237a242` |
| 第三方源码 | `study-companion-0.1.1-native-source-companion.zip`，566,036,876 字节 |
| 源码附件 SHA-256 | `3fecbcbc66cc30a8760ca7851831f950ff62a38cfaebd47ef1713a9e3637f0f3` |
| 校验清单 | `SHA256SUMS.txt`，221 字节；SHA `bab61ce609d9c2a1e1713b465b8d035108ea9e9bd4e4d31fc7dcbe8454978485` |
| 公开发布 | Release ID 420794477，2026-10-23 10:48:45（香港时间） |

构建从独立干净 worktree 的固定提交锁安装依赖，未复用主工作区 node_modules/dist。两处根锁版本与包版本一致，第三方依赖版本未变；最终包内 build-info 的提交、锁摘要和版本与冻结源码一致。实际签名状态为 NotSigned。

## 本次变化与发布前修复

包含首版后的检索/复习/任务体验修复、阅读侧栏、目录整理、晴岛视觉与动效、三入口导航/首页学习摘要及设置中的手动更新入口。详见[发行说明](../releases/0.1.2-preview.md)与[截至 10 月 22 日的更新统计](main-update-summary-2026-10-22.md)；旧统计冻结到 f310e97，未把后续版本准备与收尾提交倒加到旧成绩中。

首轮 536f06d 的[CI](https://github.com/guxingzhou16-pixel/Personal-Study-Assistant/actions/runs/39791535699)为 434 核心通过、56 桌面通过、3 桌面失败。两项为过时的测试假设：引导现在默认收起；首页摘要会指定最近草稿，fixture 同时间的旧路线不能被假定为当前目标。测试改为显式展开和选择实际 fixture UUID，原任务零写入/取消/最终确认断言保留。

另一项是真实首页滚动缺陷：日历屏幕阅读状态为绝对定位，入场动画结束撤去 transform 后缺少稳定定位祖先，造成普通/最小窗口文档高度多出 673/891 像素。只为 .daily-section 增加 position:relative；增强测试先等待入场动画结束，保留外层溢出≤1、main 实际可滚动、标题栏固定和 window.scrollY=0，并确认日历状态节点仍存在。旧构建增强测试 RED，修复后六条试用流程 GREEN（15.8秒）；随后从 4471f34 重新构建最终包。

## 最终源码与载荷验证

[最终 CI](https://github.com/guxingzhou16-pixel/Personal-Study-Assistant/actions/runs/39890186889)与最终包绑定同一 4471f34：格式、类型/构建、17项打包规则、35文件434项核心和59条普通 Electron 流程全部通过。桌面总时长9.3分钟，包含真实五分钟专注。真实聊天/云端协议使用合成资料与模拟服务，不把它当作模型语义评测。

实际从最终 NSIS 纯文件提取载荷，4,790 个文件的路径、大小和 SHA 均与构建目录一致；ASAR 4,776 项，715通知逐项与首版原字节/摘要相同。MIT、安装条款、新的库旁 SOURCE-NOTICE 与冻结 Git 原文一致；9个原生 DLL/node 文件与首版逐项相同，因而复用原源码附件的原名与原字节。未捆绑模型、用户资料或密钥，排除 GUID、浏览器 ONNX 和非目标平台原生文件。

生成时的两条分发 reviewIssues 快照保留，按[首版交付](github-preview-release-2026-10-15.md)及既有具体分发政策解释，不将旧包回执篡改为零 pending，不据此扩大模型镜像/捆绑授权。

## 最终安装器：真实隔离验证

使用专属 Windows Sandbox（ID 86b73145-4bf7-4e2d-9732-e51daa3c89b7），运行中核实真实 WDAGUtilityAccount/SID/KnownFolders/ProfileList，SID 与宿主不同；只映射专属只读 input/可写 logs，关闭网络/剪贴板和设备重定向。未使用个人 APPDATA 或测试目录覆盖来冒充正式包隔离。

| 步骤 | 实际结果 |
| --- | --- |
| 旧版安装 | UIA 读取完整中文许可并明确同意，实际注册和包内来源为 f84285f |
| 升级前学习记录 | 通过界面保存昵称、导入并阅读合成 Markdown、保存笔记和任务；旧正式 EXE 两次正常启动/退出0并读回 |
| 取消升级 | 读取新安装器许可并取消；62个数据文件及4,791个旧程序文件的路径/大小/SHA全部不变 |
| 正式升级 | 明确同意后退出0，注册/包内版本与来源为0.1.2/4471f34；首次启动前62个数据文件全部不变 |
| 新版重开 | 新正式 EXE 两次正常启动/退出0；验证三入口导航、新版号、原昵称、资料正文/副本摘要、笔记与任务完整内容/ID/revision保持一致 |
| 实际卸载 | 仅运行已验证的 guest HKCU 注册卸载器，退出0；程序目录和两注册项消失；卸载前后的69个学习目录文件全部不变 |

新版本启动可新增 Chromium 缓存，所以升级前62文件与最终卸载前69文件分别比较各自阶段，不能跨阶段假称整个目录字节未变。原生文件选择对话框只替代为专属合成 Markdown 路径；IPC、解析进程、文件副本、SQLite与实际界面均未替代。六个本轮回执全部 PASS，旧/新 EXE 共四次正常启动与退出。本轮只停止自己创建的 Sandbox，保留日志与截图。

## 下载校验

三个公开附件均在不带 Authorization/Cookie 的独立请求中完整下载，实际字节数及流式 SHA-256 全部与本地和 GitHub 服务端摘要一致：安装器140,695,049字节、相应源码566,036,876字节、校验清单221字节。完整下载字节及逐项回执保存在 public-downloads-final/；标签又经远端解引用核对为4471f34。

## 失败保留与范围

第一候选因宿主打包工具缓存跨盘重命名 EXDEV 失败，改用本轮独立工具缓存成功；旧输出保留。静态审计工具先后遇到简版7za不识别NSIS和排序比较不一致，两次失败均保留，最终工具已修正并成功验证实际载荷。安装工具首次遇到保存后的 textarea 标签包含正文导致精确选择器失败，保留失败截图/回执，只修定位后在新 Sandbox 执行；未改产品适配工具，未削弱值断言。

这些首轮/中间记录不计为最终包通过；最终包的独立来源、载荷、CI和完整六步安装链另有上述证据。没有重新运行真实聊天、真实BGE、Windows10设备矩阵或签名信誉评估，不借旧测试次数宣称本轮已覆盖。

本地证据根目录：`artifacts/release-0.1.2-434bc79c-dc0b-4c23-955f-a9ef176ef3d1/`。最终证据为 final-release-evidence.json、final-candidate-manifest.json、payload-audit-final/result/receipt.json、ci-final*.json/log、acceptance-final/logs、public-downloads-final/ 与实际发行读回；生成物不提交。原有第三方下载、本机配置/脚本及其它未追踪历史资料保留原处。

文档收尾仅修改 README、AGENTS、文档索引与本回执，使用 [skip ci] 避免重复完整测试；功能、安装器和 CI 始终绑定4471f34，不宣称后续纯文档提交又运行了一次软件回归。
