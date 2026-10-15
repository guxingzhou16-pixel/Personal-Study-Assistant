# GitHub 预览发布：通知、BGE 范围与源码附件

核对日期：2026-10-15。用户已决定通过GitHub下载NSIS，首发明确未签名，不走商店。本文记录新增分发材料的实际结果，**安装器尚未发布，Canvas/Sharp还有具体待办**。此前收件/3pending/710生成和旧697安装器分别保留原范围。

## 已完成的增量

### 1. Sharp 运行库原文

固定MXE规则使用LLVM23.1.2及MinGW-w64 `57b595039040eaa15bece85b7cc71d952281b269`。core动态导入Windows UCRT；不再列不存在的GCC/libstdc++/winpthreads分发待办。MSVC bridge/addon的静态运行库判断与Canvas共用一项核对，不重复追查相同条件。

四份LLVM runtime许可及MinGW runtime汇总原文，共 **5份/78,978字节**，已按原字节接入；来源记录431→436，Sharp资产引用308→313。源文件、仓库资产、Git暂存和新通知输出的SHA逐项相等。原431记录前缀及其它JSON语义在这次追加中保持；后面的BGE修正单独替换其中一条，不沿用“全部前缀仍未变”的断言。

本地提交 `5ed9a37`。根COPYING及两个DISCLAIMER、构建许可说明留作研究证据；没有将不实际分发的整套工具链加入安装器。两次错误子许可路径的404保留，改用固定Git目录中的确切TXT路径，没有关闭TLS或改取其它版本。

### 2. BGE：关闭当前应用的具体转载缺口

实际代码、Git跟踪文件及77候选ASAR均确认：固定五文件不在应用源码或安装器；用户点击后直接从Hub固定revision取得。Hub服务条款、发布者使用示例及基座说明为当前下载方式提供依据，不等于五文件已明确MIT。

原安装材料包含1057字节模型卡全文，其外部转载依据不足。现改为项目自写的[来源事实说明](../../scripts/licenses/assets/bge-model-provenance.txt)，**2523字节**，SHA-256 `1cf370c0e9673c78346745aa321474c9df26594be9764f212e2f180905f359ef`；原文留本机证据，Git历史和旧包不改。模型/revision/五个大小及摘要、缓存和功能均未更换。

来源记录仍436条，只原位替换BGE一条，其它435条逐值相同；全部6组supplement与Sharp313引用保持。移出仅BGE的应用二进制分发待办，**3→2pending**，Canvas/Sharp两条原文不改。原询证仍等待，固定量化MIT/完整通知仍未确认；未来外部镜像、捆绑或重新分发五文件须重新核对。完整依据和范围见[下载分发政策](../releases/bge-download-distribution-policy.md)。本地提交 `e989e32`。

### 3. 新通知输出

复用现有纯文件生成器，在新UUID验证：147元数据 + 158许可 + 408补充 + 2索引 = **715输出、2pending**。新增5份runtime和1份自写说明共81,501字节逐项通过输出摘要核对，输出中旧模型卡不存在。此次只生成通知，未构建新安装器；旧77候选仍697，不追写其已含新内容。

证据：`artifacts/preview-notices-a63839ad-6dce-40dd-a714-b2e434e3dbfa/`。原715/3pending生成保留在本轮材料目录，用以区分先补runtime、后修BGE的两个步骤；不是重复安装或模型验收。

### 4. 可交付的原生源码附件

新文件 `study-companion-0.1.1-native-source-companion.zip`，**566,036,876字节**，SHA-256：

```text
3fecbcbc66cc30a8760ca7851831f950ff62a38cfaebd47ef1713a9e3637f0f3
```

ZIP含19,408个普通相对成员、解压内容723,716,875字节：原19,402个candidate文件（含其SHA256SUMS）、5份runtime原文和一份交付说明。首次CRC检查通过，原索引/清单及五许可回读摘要相同；完成ZIP独立Windows SHA-256与回执一致。压缩原档以stored保留，未改变其原字节，旧462 MB准备ZIP未修改。

本机位置：`artifacts/native-source-delivery-55aa2dc2-3272-4bbb-afea-eadb15cbd0a6/`。复用[完整改后源的独立核对](distribution-material-decision-2026-10-14.md)，没有重做源内容语义、编译或native测试。这是本机源码companion，**未上传、未成为公开下载承诺，也不证明所有分发条件已完成**。

### 5. e989e32 实际 NSIS 载荷

从干净、独立的 `e989e32ff9efd8dd54db38c08c2b5d35bb523afb` worktree 锁安装构建，前后已跟踪状态均为空。安装器 **140,677,686字节**，SHA-256 `440cb8ef4db8a4a9ac290d410321895311ed67c989f9f5388ec1f4f4082b207e`，独立 Windows 摘要相同，Authenticode 为 **NotSigned**。

直接从实际 NSIS 提取 app-64.7z，再提取载荷：715通知实际字节/大小/摘要、旧模型卡不存在、1075字节MIT及包内build-info全部通过。主程序、ASAR、9个原生文件共11项与77候选字节相同；这是未变运行载荷的复用依据，不伪称本包已重新安装或重跑模型。

证据 `artifacts/preview-package-validation-e989e32-2026-10-15/receipt.json`。首次列表解码遇到7z控制台编码而中止，保留成功提取的140172412字节子归档后，以显式UTF-8继续，未重提外层或运行安装器。限定代码审阅通过；该候选尚没有后续新增的安装许可页/随库源码notice，不将其当最终发布物。

### 6. 安装许可与随库源码说明（已实现，定向安装验证待执行）

`electron-builder.json`保留oneClick/当前用户/路径/数据策略，增加项目自有UTF-8 BOM许可页及相同安装后文本，另把`SOURCE-NOTICE.txt`放在Sharp三文件同目录。确认只圈定Microsoft专有runtime保护，保留MIT/Apache/LGPL等独立权利和法律例外；不要求接受整个开发工具合同，不单独重分发Runtime产品。

当前首发只支持图形确认，安装器`/S`或`--updated`返回1602；普通手动覆盖升级仍展示许可页。guard仅在安装器customInit，卸载器和内部更新卸载不受影响。源码notice明确对应及未组合独立源、ZIP名称/摘要、公开同页安排和修改/替换权；实际公开下载仍待执行。

afterPack新增两份材料原字节/普通文件检查及中文BOM检查；缺失/改字节先RED，再GREEN。两个reviewer只读核对配置/模板/控制流/材料路径通过；这不代替真实页面和同意/拒绝验证，也不是全部上游授权认证。

## 剩余的具体发布工作

- 按[Windows runtime安排](../releases/windows-runtime-distribution-policy.md)验证安装前明确同意/拒绝及最终材料字节；依赖供应方权限信赖边界保留，不要求精确私有工具版本或位同重建。
- LGPL未组合工作可提供现有独立源码形态，没有额外编译独立DLL要求；最终显著通知已落地，仍需与二进制同页实际公开源码及取得地址。
- 新许可页影响的干净NSIS构建、载荷、真实Sandbox图形安装/取消/覆盖/卸载定向验证，以及GitHub Release实际下载/摘要核对；不重复旧模型、全套业务或原生库测试。

## 验证清单

- [x] 5份runtime源/资产/Git/通知输出摘要与归属。
- [x] BGE5tuple与实际常量、435条不变/6组不变/仅1记录替换。
- [x] 715输出/2pending、自写说明存在、原模型卡缺席。
- [x] 新源码ZIP首次CRC、索引/清单/5许可回读及独立SHA。
- [x] 新文档与manifest格式、针对改动的diff检查。
- [ ] Canvas/Sharp实际剩余条件、最终包与真实GitHub下载验收。

应用源码/依赖/数据库/IPC未改；未运行个人数据、真实模型、收费API或旧安装链。额外code-reviewer受team/usage限额未能执行的步骤如实保留；已有源码材料两类限定预审及独立新产物核对不扩展成这一轮全部批准。新小helper由root直接静态审阅，实际字节/生成结果另外验证。没有以付费、商店或身份资料作为继续前提。
