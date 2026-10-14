# 运行时来源、源码补丁与原文通知增量核对

日期：2026-10-14；起点 `fee3c4efb6ebcadb2ce15ac93bbac5ce6f8904cb`。**三项仍 pending，尚无可信签名或正式发布。** 上轮 SignPath 已确认收到申请，未再次提交；fee3c4e 的远端CI已通过，本轮没有重复它、安装链或模型/库替换测试。

## 已完成的材料检查

### 16 份固定源码补丁

复用原始 wrapper/MXE、28主源及固定补丁；在本轮 UUID 的临时源码副本中，只复制补丁涉及的文件并核对来源摘要。11 个组件的16份选定补丁全部具备可应用的材料：14份由 git apply 检查/应用，MozJPEG两份使用生产方的GNU patch工具与`-p1 -u`顺序处理，额外要求零模糊匹配。

首次 git apply 将 MozJPEG 复合补丁报为 corrupt patch；同字节原文在GNU patch上零模糊通过。这是工具解析差异，**不是证实源码版本不适配**。初始失败保留，没有改原补丁、放松到跳过失败或重跑已成功的14份。副本内实际文件摘要变化可核对；没有执行源码、构建脚本、编译器或库，也未修改软件代码/原冻结包。

这关闭“所选补丁是否可用于保留源码”的材料检查，不能替代实际原生重建或全部相应源码/组合库分发义务。

### Rust nightly library vendor 与通知

复用原2026-09-24源归档263102648字节/SHA `f2c139528ba025f1141935df4f634e18db614b9b3b1cf2ea59e3675a6ade89f3`，记录版本1.100.0-nightly、commit `6eeff9a52c3e35c4c4cbf5651f342dcd2191866f`。官方完整源已含vendor；无需再下载依赖。

- `library/Cargo.lock`中的31个注册依赖与vendor中的包checksum声明全部对应。没有重新逐文件验证vendor的checksum地图，也没有声称全31项实际进入Windows二进制。
- 64份原文通知候选包含vendor及compiler-builtins/libm；去重为32份非空原文。24份复用现有相同字节资产，新增8份共47148字节；来源记录保留旧399项，仅附加32条来源。
- 源锁的候选超集含开发/其他目标。三项无独立具名notice（fortanix-sgx-abi、vex-sdk、wasip1）保留为来源范围；不编造版权或把它们声称为Windows已链接组件。
- 原文UTF-8/非空/NUL/摘要及实际生成输出核对通过；未格式化原文。

仅生成通知的结果：147元数据 + 158许可 + 403补充 + 2索引 = **710**，仍3pending。旧安装器仍697，上轮临时生成仍702；本轮没有新安装器或签名。

### Canvas/SDK运行时依据

微软官方[CRT/STL说明](https://learn.microsoft.com/en-us/cpp/c-runtime-library/crt-library-features?view=msvc-170)区分UCRT与VCRuntime/STL；[部署文档](https://learn.microsoft.com/en-us/cpp/windows/deployment-in-visual-cpp?view=msvc-170)明确提供静态部署方式，无需另交付库DLL。技术部署支持不自动证明每个具体库文件都受某一分发许可覆盖。

首次读取官方 Microsoft.Windows.SDK.CPP 10.0.26100.1 元数据，指向`https://aka.ms/WinSDKLicenseURL`；原RTF246945字节/SHA `dd07eb178e00c6bba4148457fc00ff77cd4887eb521d504186fe59c9ec8bbe62`保留，只读提取正文，没有安装SDK或接受许可。条款明确：属于可分发代码的`.lib`只可作为链接后的程序结果分发，并有下游保护、保留通知及责任要求。

这缩小了静态分发的具体判断范围；**尚未完成实际生产版SDK/VC库与适用条款的逐项对应，不把一般SDK或当前STL主线许可当确切供方版本**。后续先复用RTF/既有VS2026 EULA和生产记录，不重复下载。

## Sharp询证的新状态

原[issue432](https://github.com/lovell/sharp-libvips/issues/432)被维护者关闭为not planned，标记llm-generated。回复要求[官方Question模板](https://github.com/lovell/sharp-libvips/blob/af1c585cb26f4fed3236077ef97935aa6351cdbf/.github/ISSUE_TEMPLATE/QUESTION.yml)，明确真人以自己语言提问、限相关包、自动化/LLM使用可能导致关闭或被维护者屏蔽。

这没有给许可答复。先前自动发送没有核对该模板，现已纠正流程边界。用户选择**暂不追加询证，继续现有材料**；不再自动发帖、改帖、另账号或转到其它维护者。当前事实与人工边界见[人工资料页](../releases/sharp-human-followup-facts.md)，相应源码/库修改/公开获取准备见[分发安排](../releases/sharp-source-distribution-plan.md)。

Canvas #1360尚无新回复；BGE #1487没有新固定模型许可答复，继续保留并等待。SignPath审核也待服务方邮件，不把流程回执当签名批准。

## 当前清单

- [x] 固定16补丁的源码副本可应用性，原文/失败记录保留。
- [x] nightly lock/vendor声明与64候选通知；8新原文、24复用和710输出。
- [x] SDK原始许可来源、静态部署与适用`.lib`条件定位。
- [x] Sharp关闭原因核对，用户不追加询证的决定记录。
- [ ] Canvas具体静态runtime/实际嵌入例外与适用条件。
- [ ] Sharp其它runtime条件、适用未组合材料及相应源码完整公开提供。
- [ ] BGE固定五文件明确许可。
- [ ] SignPath资格/账户/策略信息、真实三文件签名及发布验收。

未新运行软件功能/原生重建/安装或质量测试；材料检查不等于法律认证。修改数据/文档，保留他人的README/AGENTS/未追踪内容。

## 本机接手入口

`artifacts/runtime-source-followup-41c2e6c4-6dbe-42f9-9cf8-03b20b48dad9/`：`source-patch-material-check.json`、`mozjpeg-gnu-material-verified.json`、`nightly-library-notice-inventory.json`、`nightly-notice-copy-plan.json`、`nightly-notice-addition-receipt.json`、`updated-notice-output-receipt.json`及SDK原始RTF/元数据。临时补丁副本与源码原文不提交。

公开摘要：[runtime-source-materials-0.1.1.json](../releases/runtime-source-materials-0.1.1.json)。旧成功/失败与冻结包不修改，新原文后续包需携带；条件真实闭合后再制作固定发布候选。
