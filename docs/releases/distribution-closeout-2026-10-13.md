# 签名、五项分发条件与发布授权进展

日期：2026-10-13；最新增量核对2026-10-14。**尚未取得可信签名、尚未正式发布。** 本轮只处理发布条件和打包，不重新开发已验收功能，不改数据库/IPC/权重。旧 `25b2f96` 已安装验收包及五项pending原字节保留，新规则分别核对。

## 授权与发布对象

用户本轮要求完成签名/分发/发布，后确认无证书，并明确选择“保留NSIS，公开开源并申请SignPath”、提供申请显示姓名。既有仓库已实际公开，GitHub读回仓库ID1397406382、`private=false`、默认main未变；当前源码在授权的`codex/structured-notes`分支。首次申请遭Captcha拒绝；2026-10-14用户要求先重跑申请，手动提交后提供确认邮件正文，基金会已收到申请、尚待审核，未获签名授权。用户另允许一条BGE评论和两条Canvas/Sharp issue，均已发送并读回；这不扩展为追加其它消息的许可。付费、身份证明、main合并没有授权，不重复询问已获授权事项。

正式发布须有固定干净源码、对应包/通知/源码、适用范围验收、可信签名/时间戳、实际摘要及完整分发条件。用户授权已完成，不将证书/权利缺失说成仍缺用户同意。

## 原五项的处理

最新增量见[运行时/源码材料报告](../testing/runtime-source-materials-2026-10-14.md)：16补丁材料可应用，固定nightly库vendor/原文对应，新增8通知47148字节/24复用，临时710输出，旧安装器697未改。Sharp432已因自动化提问流程关闭，用户决定暂不追加；现在沿现有材料补[相应源码与未组合安排](sharp-source-distribution-plan.md)，不继续等待该原帖许可答复。SignPath收件/待审、BGE保留等待及三项pending不变。

### 2026-10-14 后续执行

本轮最新Canvas标准库版权/Unicode17两份共1513260字节及Microsoft USE复用已接入，仅生成并核对702输出，旧安装器仍697；[最新报告与清单](../testing/signpath-retry-and-native-materials-2026-10-14.md)及[来源摘要](native-materials-followup-0.1.1.json)优先于下方的前轮700记录。

Sharp 的官方 core DLL 来源匹配与真实修改库替换/恢复已通过；Canvas 的发布摘要、生产日志、固定 Skia GN 与 Rust 1.98.1 基准通知已补核对。前轮临时生成700通知，现有77安装器仍697，未重建。完整覆盖/相应源码/组合分发条件仍待补，三项保持pending；用户选择保留当前BGE等待上游答复。两份询证已发送并全文读回：[Canvas#1360](https://github.com/Brooooooklyn/canvas/issues/1360)/[Sharp#432](https://github.com/lovell/sharp-libvips/issues/432)。最新指令改为先重试SignPath，现已取得用户提供的确认邮件、等待审核；无需再提交。新取得的Sharp dev1.3.4与当前发布源码有固定对应，五份bridge源和348份Windows头文件原字节匹配，关闭这一来源子项；剩余运行时/组合库材料继续补核。旧验证见[后续核对](../testing/native-distribution-followup-2026-10-14.md)，不重复已成功的core DLL替换步骤。

| 原条件          | 本轮处理                                                                                                                             | 当前结论                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| GUID 1.0.9      | 新2111实际ASAR无顶层/嵌套独立Web/GUID，包内CPU/PDF检查通过；Transformers内嵌ONNX Web/Common通知绑定实际4.3.0                        | **新候选已关闭**：不分发该组件，没有伪造ISC版权；旧包原缺口保留                                                  |
| Canvas 1.0.9    | 固定工程/DEPS与93候选源已校验；Windows声明图选83项，7原manifest/两份固定许可入77acd64，实际包保留组件 | **未关闭**：Skia/Rust/运行时实际静态覆盖和剩余头部版权待映射，声明图不能冒充编译清单 |
| Sharp/libvips   | 固定构建、28主源/GVDB/353Cargo/nightly已校验，92主库及后续已取得Rust原文入最新包 | **未关闭**：对应源码/剩余版权/组合分发条件待补；core DLL修改/加载/恢复已通过 |
| 固定量化BGE     | 五文件pin不变、不捆绑权重；单独授权的[询证评论](https://github.com/huggingface/transformers.js/issues/1487#issuecomment-6147791372)已发送并读回 | **未关闭**：等待覆盖固定revision/五文件的许可答复及指定通知，不以其他模型/代码MIT代替 |
| DirectML 1.15.4 | 按固定EULA核对Windows ML应用用途、非独立分发、通知和数据政策                                                                         | **当前范围已完成**：适用数据/出口条款持续有效；工程核对不是法律认证或SignPath System Libraries资格通过                                 |

新manifest移除不分发的GUID和已具体核对的DirectML两条，剩 **Canvas、Sharp、固定量化BGE三项**。最新77acd64包为147元数据/158许可/390补充/2索引，共697输出，新增两份固定通知与源/提交/实物相同；50da0f5为695，已验2111为472，旧25b为385，均不改写。新包11运行文件与2111一致，首次EBUSY失败与新UUID重试成功保留，见[本日增量验证](../testing/native-notice-followup-2026-10-14.md)。全部源码材料取得范围、库存位置和剩余具体缺口见[源码材料状态](native-source-status-2026-10-13.md)。

### DirectML依据

沿用已取得的完整官方NuGet 1.15.4：202292617字节，SHA-256 `4e7cb7ddce8cf837a7a75dc029209b520ca0101470fcdf275c1f49736a3615b9`。原[EULA](../../scripts/licenses/assets/DirectML-1.15.4-LICENSE.txt)10439字节，SHA `a05138e3a085ff60a44881eedfa58dccb03ecc1d7b1f6ae888418e8c2fec4b8d`；未重复下载或修改。

1. 第1(a)节允许Windows/Xbox机器学习框架应用分发；当前固定ONNX路径为Windows x64，无独立DirectML或跨平台发行。
2. 第1(c)/3(c)节要求独立条款/通知保留，EULA、LICENSE-CODE、NuGet ThirdPartyNotices及另一份release NOTICE均已保留；不改为项目MIT。
3. [签名政策隐私章节](code-signing-policy.md#隐私与系统行为)保留微软数据说明，不把CPU路径当“绝不收集”证明；本项目不新增遥测/私人资料上传。
4. 出口等行为条件持续适用；本轮已公开源码但未发布安装包，具体目的地/用途变更时复核，不提前保证未来全部场景。

以上关闭本轮已知具体工程待办，其他组件和SignPath资格单独处理。依据[官方原文/完整包对照](../third-party-licenses.md#directml-完整包的具体对照)，不是向微软取得新审批。

## 已完成的签名工程与检查

- `desktop:dist:signed`先预检已有可信证书；三个自有EXE须指定证书/嵌入式/代码签名用途/时间戳/最终摘要一致，否则拒绝成功回执。
- `signing-receipt.json`只在三者完成后生成，保留实际卸载器。原未签名命令可作隔离验收，不作签名发布。
- 新签名6项及许可/包审计9项共15通过；真实Windows只读确认现有微软VC安装器Valid/Authenticode/EKU/时间戳，并拒绝旧25b NotSigned。未执行该安装器或导入证书。
- 实际运行缺证书npm签名命令退出1，输出目录28→28，无编译/候选；此为负例通过，不是签名成功。
- 两类静态评审完成，修复OidCollection.Add污染JSON、EKU ObjectId字符串、卸载器回执失效路径，复用流式摘要。真实自有证书链路未执行。

本机证据：`artifacts/signed-distribution-7ff696bd-f0c1-450f-a1d6-ad8db0bb9681/`。新冻结`2111b3c`的[run38376393781](https://github.com/guxingzhou16-pixel/Personal-Study-Assistant/actions/runs/38376393781)整轮及Post通过，实际日志为15打包/签名、32核心文件356、36桌面通过。新包大小/摘要、包内真实512维CPU和两页PDF结果见[本轮验证](../testing/signed-distribution-2026-10-13.md)；旧安装验收不计作新候选全链验收。免费路线/申请材料见[Code signing policy](code-signing-policy.md)。

## 剩余执行顺序与测试清单

- [x] 明确既有私有仓库发布授权与零预算约束。
- [x] 签名预检/三文件回执/失败拒绝，规则6项与真实正/负文件读取。
- [x] 独立Web/GUID排除、内嵌通知归属和审计拒绝规格。
- [x] 当前DirectML用途/通知/数据说明核对。
- [x] 新干净NSIS实物：源码/字节/摘要、无独立Web/GUID、保留内嵌ONNX与原始通知。
- [x] 包内真实512维CPU、PDF.js Node两页解析；样本无global fetch请求，仅补被裁剪依赖链，不称操作系统断网/故障降级或完整UI验收。
- [x] Sharp28主源/GVDB/353Cargo/nightly、Canvas93Cargo及固定工程源校验，原始来源/摘要归档；超集不冒充实际链接覆盖。
- [x] 用户已选择NSIS/SignPath，仓库公开及授权分支精确CI实际读回。
- [x] 后续223唯一原文入50da0f5干净候选，695输出/摘要/11运行文件与2111相同字节核对，实际NotSigned保留。
- [x] BGE五文件询证获单独授权后真实发送并读回，等待上游答复与通知。
- [ ] Canvas实际静态组件及通知覆盖。
- [x] Sharp bridge源码/构建规则与固定发布版本对应；dev包五份CPP、348份Windows头文件比对。
- [x] Sharp core DLL真实修改/加载/恢复；未从源码重建，不重复该测试。
- [ ] Sharp剩余runtime/header通知、适用组合库材料与相应源码公开提供安排。
- [ ] 固定量化BGE权利证据，不以代码MIT替代。
- [x] SignPath有效申请提交：用户手动提交后提供基金会确认收到的邮件正文，旧Captcha失败保留。
- [ ] SignPath资格审核、实际账户/组织/项目/策略ID与签名审批配置；确认收到不等于获批。
- [ ] 真签名三文件、统一发布者/版本、时间戳/摘要，干净Windows安装/卸载及CPU/PDF。
- [ ] 条件齐全后在已授权公开仓库正式发布并核对上传字节，当前未发布安装包/标签。

路线已选NSIS/SignPath，Store作为后备研究记录。本轮正常Submit仍被Captcha拒绝，用户随后手动提交并提供确认收到的邮件；浏览器重连后的成功页面未直接读回，证据类型如实保留。无需重复申请，等待审核及可能的补充问题；不绕过验证码，显示姓名/联系邮箱及跟踪链接不加入项目文档。
