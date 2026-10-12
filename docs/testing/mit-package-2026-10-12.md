# MIT 项目许可与新候选实物核对

核对日期：2026-10-12。用户已明确选择项目自有代码使用MIT；本文完成该项收尾，保留第三方待办和此前各版本的原始记录。

## 1. 固定来源

| 项目         | 实际结果                                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| 源码         | `d2055b23cf491768e65f4ef5c01e6de9a8610f1e`，0.1.1                                                                    |
| 干净工作区   | `artifacts/candidate-mit-0f74a5c7-2d81-4a60-91f0-b5e6c271fef6/`；构建前后HEAD、工作区及锁摘要一致                    |
| 锁SHA-256    | `9801ceab8aa24659cb9b10e8ed2ce88c7f2f3e8d64f2f5c5825f9b02822d52af`；只增加根MIT标识，依赖版本未改                    |
| 工具         | Node24.16.0、Electron44.5.1、builder26.15.3、ASAR4.3.1；518包独立锁安装                                              |
| 五个构建命令 | 锁安装、Electron准备、生产构建、目录包、NSIS全部退出0；原始UTC日志保留2026-10-11执行时间                             |
| 许可正文     | 根目录[LICENSE](../../LICENSE)，1075字节，SHA-256 `677ab4b011fa3e4f35514bebdb2e79de1edb0f376a3d16e5e405de3f740f101d` |

`package.json`与锁根声明MIT，`private:true`保持。全文依据[SPDX MIT](https://spdx.org/licenses/MIT.html)，版权为2026 guxingzhou16-pixel。第三方材料继续采用各自原文及来源；项目许可选择不自动授权GitHub推送、改变可见性或公开发布。

## 2. 可维护的打包要求

- `electron-builder.json`将根LICENSE复制到`resources/LICENSE.txt`；打包入口合并原extraResources后追加本次build-info，修复覆盖配置导致文件丢失的问题。
- afterPack要求目标为普通文件、非空且与源码逐字节一致，并检查实际ASAR包元数据的MIT标识；不符合时拒绝成功审计。
- 两项新负例覆盖缺失／不同正文，原五项许可规格保留，共7/7通过。类型、修改源码格式和两reviewer静态检查通过；不为文档或许可元数据重复功能全套。
- `scripts/licenses/manifest.json`只移除已由用户关闭的“项目许可未选”项，五项第三方问题原文保持。75份资产与385个第三方输出不因项目许可证而改计数。

## 3. 新实物

| 产物          | 路径与独立核对结果                                                                                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 目录包        | `release/dir-mit-af0f330b-a643-4970-9d2c-828b111c2f8e/win-unpacked/`；4896文件／708026623字节                                                                                             |
| 目录EXE       | 245726720字节，SHA-256 `0b3a6201e9493ea7d48a6104529d41cdc122a7b7ae64245695a0bbf63e778de8`                                                                                                 |
| 安装包        | `release/nsis-mit-768684b8-aa64-4db9-a75e-c3c5aa32f159/StudyCompanion-0.1.1-win-x64-setup.exe`；152390060字节，SHA-256 `8b277d83cfa3626c84250c530674117d90242b407b6d013098949e4d324fe2a0` |
| 真实setup载荷 | 4896文件逐大小／SHA核对，与构建载荷一致；除各自build-info之外与目录包一致                                                                                                                 |
| 项目全文      | 目录、NSIS构建载荷、实际setup提取载荷均与根LICENSE完全一致；audit标识／路径／大小及ASAR license均通过                                                                                     |
| 第三方输出    | 150元数据、158许可通知、75补充，共385；原字节、版本／来源／引用摘要通过，五项reviewIssues仍pending                                                                                        |
| 完整性        | setup CRC2267411324／flags0；卸载器139907字节，SHA-256 `13c3bc335cd85d9b7e72ba06202981460097054c7bc52d08ae859bf9d820f90e`，CRC2228982316／flags1；检查启用                                |
| 签名／发布    | 应用、setup、卸载器实际NotSigned；未执行新正式包、未上传或发布，无GitHub下载地址                                                                                                          |

证据根目录`artifacts/mit-package-8bf2e1f3-f3ce-42b7-8083-6cfc4b3fbff1/`。`handoff-summary.json`覆盖26份构建／静态证据；`compiled-application-equivalence.json`另记录下面的完整比对。五个复用helper及所有参数改动有原件／新件SHA清单，两reviewer已逐字节确认，旧文件和包未覆盖。

## 4. 与已安装36候选的关系

实际新／旧setup提取载荷的207个`dist`／`dist-electron`文件清单与字节完全一致，包含主进程、preload、三个worker、renderer及PDF资产。新增文件仅`resources/LICENSE.txt`，无文件删除；发生差异的原文件恰为启动EXE、app.asar、build-info及第三方README／索引，分别记录新旧大小和摘要。新ASAR保留MIT元数据，启动EXE／ASAR差异单独记录；不声称两个安装器逐字节相同。

这证明本轮未改变编译后的学习功能。实际运行仍引用[36安装版AI报告](installed-ai-2026-10-11.md)及[53历史生命周期](final-acceptance-2026-10-10.md)，不能改写成新MIT包重新安装／恢复／卸载或模型生成通过。新卸载器与旧包原字节相同，本次仅做静态完整性核对，不重复已完成的真实Sandbox链。

## 5. 未关闭项

包核对后的CI准备只修改工作流／测试：Electron准备使用锁安装内入口，两类许可规格纳入CI。洁净目录仅复制LICENSE，旧fixture因未建artifacts而两项ENOENT；补一行幂等目录创建后2/2通过，成功输出保存在`artifacts/clean-license-test-ba5b8eb4-032f-4f68-9081-6582c0c6714f/green.log`。该修正不进入应用载荷，d205固定包／摘要保持；GitHub执行仍需先取得明确推送要求。

项目MIT选择、原文文件及新包携带核对已完成。[第三方说明](../third-party-licenses.md)中的GUID版权、Canvas构建覆盖、Sharp／LGPL对应材料、固定量化BGE授权及DirectML适用分发条件仍待完成。远端CI需获得明确推送授权后验证，公开发行另需授权。原语义失败、同义漏召回与未覆盖范围保持原结论，见[发布总表](release-readiness.md)。
