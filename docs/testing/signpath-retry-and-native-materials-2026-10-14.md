# SignPath 回执与原生材料增量核对

日期：2026-10-14。起点提交 `25a5f1af331a37c4e117fa537c59b94f950d9d84`。用户本轮改为先重跑 SignPath，再逐步处理 Canvas、Sharp、BGE；旧“全部闭合后重试”的顺序不再适用。**申请已收到、待审核；三项分发条件仍 pending，尚无可信签名或正式发布。**

## 1. SignPath 申请已收到

- 重新打开[官方申请页](https://signpath.org/apply.html)，核对[条件](https://signpath.org/terms.html)与[隐私政策](https://signpath.io/privacy-policy)，沿用已授权的姓名/邮箱及真实项目材料。申请说明新项目、没有外部信誉/公开安装包，以及 Canvas/Sharp/BGE 分发核对未完成；请求资格预审及 DirectML 例外确认。营销未选。
- 普通 fill 操作部分字段离开输入框后丢失，改用正常键盘输入并逐项读回；最终必填项和必要同意项均已保留。正常点击 Submit 一次，仍返回 `Failed to validate Captcha. Please try again.`；保留本次失败，不绕过验证码或使用提交 API。
- 将填写好的标签页切到前台，用户本人手动提交后提供基金会确认邮件正文，明确确认已收到申请，会在接下来几个工作日审核并通过邮件联系。**证据是用户提供的确认邮件正文**；提交后浏览器重连，原成功页已不可直接读回。没有保存姓名、邮箱或邮件跟踪链接到仓库。
- 当前没有获批账户、组织/项目/策略 ID、证书或签名回执。**无需再次提交申请**；等待审核及具体补充问题，不把收到邮件当成批准或签名成功。

## 2. Sharp bridge 来源子项已闭合

首次取得 `@img/sharp-libvips-dev@1.3.4`：2009303 字节，SHA-256 `e9dd5562c219d44cab7ce811906773a1354b583ed4bfa5115e1cdc954a0290aa`；npm SHA-512/SHA-1 都匹配，705 成员原字节保留。没有安装依赖或执行源码。

固定对应链：

1. 当前原生包 `@img/sharp-win32-x64@0.35.5` 的发布元数据和官方 SLSA 声明指向 `lovell/sharp@51a990faa26ade5586a4934ac9673c98d8893326`，构建 run36322847196。
2. 该提交的 [package.json](https://raw.githubusercontent.com/lovell/sharp/51a990faa26ade5586a4934ac9673c98d8893326/package.json) 准确固定 dev 为 **1.3.4**，不是范围猜测。
3. dev 发布元数据/声明指向 `sharp-libvips@ebb95f8add54eee8bed840e3fb587e4cbec857d7`，构建 run36315646015；其固定 versions/打包脚本选择 libvips **8.18.7**。
4. `binding.gyp` 明确选取 VConnection/VError/VImage/VInterpolate/VRegion 五个源文件、Windows 头文件、`libvips.lib` 和 MSVC 参数；构建辅助代码给出 node-gyp 入口。五个 CPP 与此前校验的 libvips 源归档逐字节一致。
5. dev 与旧官方 static ZIP 的 **348** 份 Windows include 成员逐项相同：47 vips、301 GLib，零差异/零缺失。dev 额外 **347** 份 include 属于超集，不能全部称为 Windows 来源；glibconfig/import library 仍由 Windows ZIP 提供。

这关闭“bridge 源码/公开构建规则与当前版本不能对应”的子项。**没有源码重建，没有独立验证 Sigstore 签名/透明日志链，也没有关闭 Sharp 整项。** 旧 core DLL 真实修改/加载/恢复结果直接复用，不重跑。

原生包声明 `Apache-2.0 AND LGPL-3.0-or-later`。分发核对分别处理共享库机制、库内部组合材料及相应源码公开提供。源码超集可以保留，所需版本/补丁/运行时和构建脚本仍要齐全；精确链接 SBOM 或重建后 SHA 相同是证明手段，不另设为许可证未写出的独立条件。

## 3. Canvas 三处通知缺口已补

### 标准库详细版权原文

固定 Rust 构建源码把生成的版权 HTML 放在 **rustc** 分发组件，而非先前取得的 std/docs。首次新增读取官方 Windows rustc 1.98.1 归档时响应截短为 35619226 字节，摘要不匹配，未使用其内容。官方 HEAD 为 71317968 字节；使用 ETag/If-Range 从已取得字节末尾续传到新文件，保留旧失败文件。

新完整文件大小 **71317968**，SHA-256 `cb5370843a9d15ce6e6cf6461b4c997722220d268d0d813c2b2b86f3ed59ac24`，与已有固定 channel 一致。没有安装或运行编译器。

最初选择所有 COPYRIGHT 文件的读取器遇到 15380909 字节的编译器总版权文件，超过 8 MiB 限额而停止；后续只读取所需的标准库版权及小型许可证。未放宽到分发整份编译器版权集合。标准库 `COPYRIGHT-library.html` 为 **1512520** 字节，SHA `68129500b616d5838629e68f55ff3aed5e096dacf60ce9eb41bbe599a563afa6`，原字节进入通知资产。含标准库源和外部依赖的作者/完整许可文本，没有 script/iframe；不是当前二进制的精确链接清单，也不覆盖 MSVC/Skia 的全部运行时条件。

### HarfBuzz Microsoft USE 通知复用

固定 HarfBuzz `9cb1fee51069b206effb4736e443b038d230789d` 的 `src/ms-use/COPYING` 与已有 Canvas 通知同 Git blob `9e841e7a26e4eb057b24511e7b92d42b257a80e5`，1141 字节/SHA `c2cfccb812fe482101a8f04597dfc5a9991a6b2748266c47ac91b6a5aae15383`。固定 Skia GN 选中的 USE 生成表包含该 Microsoft 数据部分。补来源记录和归属说明，**不复制相同通知或增加输出计数**。

### Unicode 17 版权与已有完整许可对应

HarfBuzz 固定生成表明确使用 UCD **17.0.0**。首次保留[官方 ReadMe](https://www.unicode.org/Public/17.0.0/ucd/ReadMe.txt)原字节：**740** 字节/SHA `9fe1a90bd32659d7953616283dc2bffaa165518aae9ace026040c42c559ba606`，含 2025 版权。[官方条款](https://www.unicode.org/copyright.html)第 3.3 项将 Public 数据置于 Unicode License v3；完整 v3 文本和覆盖 2025 的通知已经保留在 ICU 资产。新增版本原文并交叉引用已有许可，不单用 Rust 的 2024 通知替代。首次控制台打印遇到 GBK 编码错误，文件/摘要已成功保存；改为读取已保存文件核对，没有重复下载。

独立只读核对另外整理 **17** 类声明组件、**54** 个现有通知引用。保守固定 GN/DEPS 对应可支持通知覆盖，未把精确链接对象清单设成额外许可门槛。静态 CRT 的固定 runner/image 和官方分发/EULA 来源已定位；实际适用覆盖及具体嵌入例外继续核对，未提前关闭整项。

## 4. 仅生成通知的验证

复用现有已审阅生成检查器和旧 77acd64 ASAR 的只读元数据/通知，在新目录生成并核对：

| 输出     |    数量 |
| -------- | ------: |
| 包元数据 |     147 |
| 许可     |     158 |
| 补充通知 |     395 |
| 索引     |       2 |
| **合计** | **702** |

两份新增原文共 **1513260** 字节；Microsoft USE 通知复用已有文件。新原文与生成输出大小/SHA 一致，生成器核对全部输出，仍为三项 pending。**这不是新安装器或新签名包**；旧 77 安装器仍 697，前轮临时生成仍 700，各自记录不追写。

本地没有重复完整 CI、安装升级卸载、CPU/PDF/BGE/模型质量或已通过的修改库替换测试。没有应用功能、数据库、IPC、模型或上游消息变化。最新申请政策和原文材料会同步到已经授权的功能分支，供基金会核对；推送触发现有远端 CI 一次，其实际结果按新提交的确切 SHA/run 留在本机交接回执，不用旧绿灯替代，也不为补写 run 再触发一轮。

## 5. 剩余工作与执行清单

- [x] SignPath 正常表单重试及用户手动提交，取得确认收到的邮件正文。
- [x] Sharp bridge 的固定源码/recipe、五个 CPP 与 348 Windows headers 对应。
- [x] Canvas 标准库版权原文、Microsoft USE 复用、Unicode 17 原版权与许可映射。
- [x] 新增通知生成/原字节校验，702 输出，三项 pending 保留。
- [ ] Canvas 静态 Windows runtime 的适用分发条件及具体嵌入例外核对。
- [ ] Sharp 剩余 runtime/header 通知、适用组合库材料和相应源码公开提供。
- [ ] BGE 固定五文件的明确许可/指定通知；保留当前模型，等待已发询证答复。
- [ ] SignPath 资格审核与真实组织/项目/策略信息；获批后才接入云签名审批。
- [ ] 条件齐全后的固定新包、真实三文件签名/时间戳及必要发布验收。

本轮只读复查 Canvas #1360、Sharp #432 均零新回复；BGE #1487 最后一条仍为已发送的固定五文件询证，没有针对该模型的新许可答复。没有追加消息、换模型、标签、Release 或 main 合并。

## 6. 接手入口

公开摘要：[native-materials-followup-0.1.1.json](../releases/native-materials-followup-0.1.1.json)。最新签名状态见[Code signing policy](../releases/code-signing-policy.md)。

本机证据：`artifacts/signpath-retry-2350d5e4-fae1-43b7-af14-21cf972becd8/`。先读：

- `signpath-application-received.json`、`signpath-retry-result.json`：收到邮件与旧失败分开。
- `sharp-dev-lineage.json`、`sharp-dev-receipt.json`：固定发布关系和逐项原字节。
- `canvas-coverage-followup.json`：先前的组件矩阵，Rust/Unicode 补齐结果由本报告和新增资产记录补充。
- `rustc-archive-receipt.json`、`rustc-download-head.json`、`rustc-resume-receipt.json`：截短失败与续传成功。
- `rustc-notice-inventory.json`、`unicode-17-notice-receipt.json`、`added-runtime-notices.json`、`updated-notice-output-receipt.json`。

源归档、个人申请字段、回执及输出留在忽略目录；原字节许可资产不格式化。首次 code-reviewer 调用因模型容量不足未能执行，不写为评审批准；实际独立数据核对和后续审阅范围另记本机回执。保留他人的 README/AGENTS/未追踪改动，仅提交本轮资料与文档。
