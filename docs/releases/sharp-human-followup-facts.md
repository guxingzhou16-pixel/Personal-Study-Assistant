# Sharp 后续人工询证：事实与边界

日期：2026-10-14。原 [issue432](https://github.com/lovell/sharp-libvips/issues/432) 已被维护者关闭为 not planned，并标记 llm-generated；这是提问流程处置，没有提供许可答复或构建材料。

## 为什么这里需要本人处理

维护者要求使用[官方 Question 页面](https://github.com/lovell/sharp-libvips/issues/new?template=QUESTION.yml)。[固定模板](https://github.com/lovell/sharp-libvips/blob/af1c585cb26f4fed3236077ef97935aa6351cdbf/.github/ISSUE_TEMPLATE/QUESTION.yml)要求提问者本人用自己的话提问、问题属于 `@img/sharp-libvips-*` 包，并说明检测到自动化或 LLM 工具使用时会关闭问题、账户可能被屏蔽。

先前自动发送没有核对这份模板，是本项目询证流程的疏漏。不要再用 API、浏览器自动填写、改账号或编辑原帖来继续相同询证。需要维护者答复时，由维护者本人理解这些事实后独立组织和提交问题；本页提供可核查资料和项目状态。

## 已知事实，供你自己核对

| 项目          | 事实及来源                                                                                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 应用          | Windows x64 的学习助手，自有代码 MIT；安装包尚未公开发布                                                                                                                                |
| 相关包        | `@img/sharp-libvips-dev@1.3.4` 及固定 sharp-libvips 1.3.4 构建材料；Windows 运行时被 Sharp 0.35.5 原生包包含                                                                            |
| libvips       | 8.18.7；本应用 core DLL 与官方 static developer ZIP 内的文件逐字节相同                                                                                                                  |
| core DLL 摘要 | `06dab07cc386748513337a31672b1d5269fbc770a14ff403080575665bf0813f`，19018240 字节                                                                                                       |
| 发布来源      | sharp-libvips 固定提交 `ebb95f8add54eee8bed840e3fb587e4cbec857d7`；Windows 构建 wrapper `ef19ca09af2453d127453d677c849ccb37cf5694`，MXE 基础 `c36160b231e66e1cbe032ed54aef7617e8b259da` |
| 已具备源码    | 28 份主库源、GVDB、353 个 librsvg Cargo 候选源、2026-09-24 Rust 完整源、固定规则和补丁                                                                                                  |
| C++ bridge    | 已核清固定源码/构建入口，五份 CPP 和 348 份 Windows include 对应；这一项无需重新问维护者                                                                                                |
| 库替换        | 已在真实独立 Windows 环境修改 core DLL、加载和恢复，原 addon 不变、像素相同；未从源码重建                                                                                               |
| 原文通知      | 原29库通知/GPL/LGPL文本保留，未将第三方改标为应用 MIT                                                                                                                                   |

完整来源：[固定发布关系](native-materials-followup-0.1.1.json)、[源码库存](native-sources-0.1.1.json)、[源码状态](native-source-status-2026-10-13.md)。自己核查时优先看原始项目、源码和许可文本。

## 仍需解决的具体事实

- core DLL 内部组合的适用分发材料，尤其同一工作未组合形式的获取与说明。
- 固定 Rust build-std/native runtime 的通知覆盖及对应构建材料。
- 完整相应源码及必要构建/安装资料的公开获取安排。

把自己实际理解且尚未解决的部分组织成简短问题。问题应与 `@img/sharp-libvips-*` 包相关；源码与 recipe 已找到的 bridge 事项不再重复问。无需请求新商业授权、法律认证、精确链接 SBOM 或重建后摘要相同的保证。

提交后把新 issue 地址告知本项目。保留原432的历史和关闭原因，不把重新提问当作已获分发许可。
