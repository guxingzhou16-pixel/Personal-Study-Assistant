# 三项分发条件的后续核对

日期：2026-10-14。**三项尚未全部闭合，未签名、未正式发布。** 本轮继续缺口核对，复用已完成的 825d80b CI、77acd64 候选及旧 v13 安装证据。用户已明确选择保留固定 BGE 等待答复；SignPath 再次提交按用户要求留在三项闭合之后。

## 已完成的新增事项

### Canvas 发布实物、生产记录与运行时通知

- 官方 [v1.0.9](https://github.com/Brooooooklyn/canvas/releases/tag/v1.0.9) 的 Windows x64 资产为 27436032 字节，SHA-256 `f69cac8093b0a4914d41a01add30a08cb739ecc254ad1d124b1804384af16586`，与当前候选原生文件一致。
- 只读取得[生产 run34340650671](https://github.com/Brooooooklyn/canvas/actions/runs/34340650671)及 Windows job102430380104 的日志，确认固定来源、Rust 1.98.1 / `48a229ceaefd4985c50990b14116b6d856af0985`、`--locked` 和 `skia-a9c42c9f` 十份静态库下载 URL。编译器提交与前轮实物内嵌提交相同；静态库的发布元数据不是每个链接对象的校验结果。
- 新取得固定 Skia 完整源归档：79689406 字节、SHA `70a57fda737ea04d1d469421f911508e58fbc5f6ed89b1c44c3935ba031fcf97`。只读取 97 份 GN 来源和 9 个许可候选，不执行构建脚本。复用前轮 Canvas 工程、DEPS、93 Cargo 源和 83 项图；FreeType/Brotli、libjxl/Highway/skcms 等关系按固定 GN 文本核对，完整静态/内嵌与 C++ 运行时覆盖仍未关闭。
- Rust 官方固定 channel 的摘要校验通过：Windows std 23032992 字节、SHA `42727764a01a54db7423e43db08a9c818405679af6a9a677068e8cd4b8361242`；docs 24174044 字节、SHA `e16a75443493b8830154232ca7339e6d3cb83f9d694725817962b3087dedb2e7`。没有安装或执行编译器。两个归档没有提取到所需详细 COPYRIGHT-library.html，不能把根 COPYRIGHT 当全部外部组件通知。
- 从固定来源补入三份原文，共 4634 字节：Rust COPYRIGHT、MIT、Unicode 3.0；已有 Apache 原文按相同 SHA 复用现有 Canvas 引用。保留四条新增来源记录，Unicode Git blob `ee8e69b233293872fcb4d6d4930ec196b63626e7` 核对通过。Root/std 通知不等于编译运行时的完整许可审阅。

### Sharp 官方实物联系与真正修改库的替换测试

新取得[官方 8.18.7 static developer ZIP](https://github.com/libvips/build-win64-mxe/releases/tag/v8.18.7)，9398858 字节、SHA `a736af61d3b46499760efa606e469cb14e060445b1f6fd36a1fa2e75009e1197`。其 `libvips-42.dll` 为 19018240 字节、SHA `06dab07cc386748513337a31672b1d5269fbc770a14ff403080575665bf0813f`，与当前候选逐字节相同。ZIP 中的 `libvips.lib` 为链接材料，未作为独立未组合库或完整相应源码证明。

在真实 Windows Sandbox `cc17b621-be35-4cf3-ad9d-bc9b9a97ca48` 运行本轮独立测试：

- 实际 WDAGUtilityAccount、KnownFolder、ProfileList、独立于宿主的 SID 核对；网络/设备重定向关闭，只读输入和独立可写日志。
- 106 份副本逐项大小/摘要核对；来自 77acd64 的 `.node` 和 C++ DLL 原字节不变。未启动应用/安装器、打开数据库或运行模型。
- 只修改 guest 核心 DLL 的 `vips_version` 导出查表中的一个 byte，位置 13419238，7→8；导出结构和其它文件不变。三个新进程实际读到 `8.18.7 → 8.18.8 → 8.18.7`。
- 修改库 SHA 为 `d0f7f34eea095b768d848f207236d03d9a209ea8d8d46ce5cc3090f731c1548b`；恢复后与原库 SHA 相同。各轮真实原生 PNG 编解码/2×2 像素全部相同，PNG SHA `9e409971b7f7b7e523333e2c81da83f027a69b5711bd43704143e74f2b0012a0`。
- 黄金回执 SHA `130bcbb247f89c899e9721ac727f279c965c3bfacdda6bfc1774168e7acbe5df`。测试完成后只停止本轮沙盒，列表读回为空；宿主库和既有包未修改。

**这关闭了当前 core DLL 的真实修改/加载/恢复测试缺口；它是二进制修改验证，未从源码重建库，未覆盖任意 ABI 改动或所有 LGPL 组合库义务。** 完整来源/剩余头部通知、C++ bridge 重建与组合分发材料继续待核对。

## 失败与修正保留

沙盒启动后首次登录会话尚未建立，身份命令失败，未执行业务。首次 runner 中原库 Node 输出已通过，但 Windows PowerShell 的 Start-Process 退出码核对使验收中断，尚未进入修改阶段；原输出/CLI/失败记录保留。改为持有 Diagnostics.Process、异步读取两输出、有限 30 秒并核对明确 ExitCode 后，完整三轮通过；所有版本/像素/摘要断言保留，没有用原 stdout 替代退出码门槛。每次日志新 UUID，不覆盖首轮失败。

独立静态评审先指出包 exports 入口和输入验证缺口，均在原生执行前修复；随后修正退出码管线并复审通过。原型通知检查器首次相对 import 多走一层，模块加载失败、未开始生成；修正后运行通过，不计为产品故障。

## 仅生成通知的增量验证

读取原 77acd64 ASAR 和必要元数据/许可副本，在新临时目录调用现有生成器；**没有重建安装包或改写原包**。输出 147 元数据、158 许可、393 补充、2 索引，共 **700**；新三份原文/已有 Apache 与来源及输出大小/摘要匹配，仍为三项 pending。生成器逐项核对写入的通知。

此前 77acd64 安装候选仍为 **697** 输出、实际 NotSigned，安装器摘要 `926f585f1efe170a2c5fc154d50a5b9ccc8dd745c6f29639fd3a27da01b89e86`。700 只描述本轮通知生成结果，不能写成已完成新的安装器、签名或发布。没有重复完整 CI、CPU/BGE/PDF、旧安装升级卸载或模型质量题。

## 剩余门槛与下一步

| 项目     | 本轮完成                                       | 尚未完成                                                   |
| -------- | ---------------------------------------------- | ---------------------------------------------------------- |
| Canvas   | 发布实物摘要/生产日志/固定 GN 与运行时基准通知 | 全静态/内嵌与编译运行时通知覆盖，生产材料对应              |
| Sharp    | 官方 core DLL 同字节来源；实际修改库替换/恢复  | 完整相应源码/头部版权/编译运行时/C++ bridge 与组合分发义务 |
| BGE      | 只读复查评论与当前 metadata；用户确认等待      | 固定五文件许可答复及指定通知                               |
| SignPath | 既有材料和失败记录复用                         | 三项闭合后一次正常验证码提交及真实成功/审核回执            |

两份完整询证按 AGENTS 3.33 单独获用户授权后，已分别创建并全文读回：[Canvas #1360](https://github.com/Brooooooklyn/canvas/issues/1360)、[Sharp #432](https://github.com/lovell/sharp-libvips/issues/432)。两次连接器403均未创建；已有Git身份核对账号/仓库/重复后每份只POST一次，再按ID读回完整正文。实际全文、时间和摘要见[Canvas记录](../releases/canvas-distribution-inquiry.md)、[Sharp记录](../releases/sharp-distribution-inquiry.md)。没有把发送成功当作取得许可答复，也不授权追加其它消息。BGE 原评论保持等待，无追加消息、无换模型。没有新标签、Release、可信签名或 main 合并。

验证脚本三轮静态复审已通过；最终数据复核完成700项输出、新原文、来源前缀/归属和黄金回执检查，未报告新问题，末轮总结任务因评审模型容量不足未完成。主维护者另完成原文Git blob/暂存字节、114本地链接与diff核对；本机 `review-status-final.json` 保留这一区别，不冒称末轮完整批准。

## 本机证据与接手顺序

新证据：`artifacts/distribution-closure-28cb8db4-728b-4300-9ab8-d8c9cddf9933/`。先读 `scope.json`、`sharp-replacement-golden.json`、`sharp-original-binary-lineage.json`、`updated-notice-output-receipt.json`、`added-runtime-notices.json`。原成功/失败不能由新脚本覆盖；输入脚本、readonly 配置与黄金回执保持可核对。

本轮三项都保留 pending；取得缺失生产/通知材料后逐项更新，条件闭合再固定提交生成新包并执行必要增量验收。不得重复发送 BGE 评论、重复下载校验通过的对象，或把待发草稿/临时生成通知当成分发条件全部完成。
