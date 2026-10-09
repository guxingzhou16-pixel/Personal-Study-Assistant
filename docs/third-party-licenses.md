# 第三方许可与分发说明

日期：2026-10-09。**状态：已接入许可资产和打包文件检查；下述来源/原生分发余项仍待核对，不能据此公开发行。** 这份文档记录工程证据，不作法律合规通过结论。项目本身的授权方式尚未选择，`package.json` 的 `private: true` 不代表已授予代码或二进制分发许可。

## 1. 安装包中如何查阅

目录包和安装版的 `resources/third-party/` 包含：

- `README.txt`：实际包名/版本、阅读方法、许可审阅状态及待办。
- `packages.json`：实际 ASAR 包清单，包含嵌套依赖和不同版本；记录原始许可表达式、仓库、元数据及许可文件位置/摘要。
- `metadata/`：各依赖原始 `package.json`，保留上游作者等信息，不编造版权年份。
- `licenses/`：实际包内许可、通知、作者文件的原始字节；包含 Electron/Chromium 文本。
- `supplements/`：本仓库固定版本和 SHA-256 的官方补充资产。标准参考模板明确标注来源和缺口，不冒充某依赖的上游版权通知。

包根原有 `LICENSE.electron.txt` / `LICENSES.chromium.html` 和 PDF 资源许可仍保留。许可文件不替代运行验收；安装后能读取这些文件也不代表每项分发条件已满足。

## 2. 可维护的资产与生成规则

源资产在 [scripts/licenses/assets](../scripts/licenses/assets)，来源记录在 [source-records.json](../scripts/licenses/assets/source-records.json)，打包清单在 [manifest.json](../scripts/licenses/manifest.json)。本轮取得49份资产，分别记录官方 URL、固定 revision、SHA-256、大小或提取方式。DirectML 文本由官方 NuGet 许可页面的 `pre` 提取并解码；Sharp README/versions 是锁安装的原始本机文件，未冒称已重新下载对照。Canvas新增四项依赖从官方Gitiles固定提交解码原文，并核对目录的Git blob标识；版本与修改来源README一并保留，不用许可日期猜fork版本。

[package-notices.mjs](../scripts/package-notices.mjs) 接在 `verify-package.mjs` 的 afterPack 中：

1. 按实际 ASAR 的规范包目录读取元数据，包含嵌套 `node_modules`，不抄开发顶层版本。
2. 许可归属以最近的实际包根确定，不能用子依赖许可替缺失的父包许可。
3. 补充项须匹配确切包名/版本；缺文件、摘要不符、路径穿越或链接均拒绝成功。
4. 将原文写入本次新输出并重新读取核对大小/摘要，不修改旧 ASAR、旧安装包或旧回执。
5. 将文件核对结果及 `reviewStatus` / `reviewIssues` 写入 `package-audit`，由最终目录/安装器清单覆盖这些文件。`static-copies-verified` 仅说明文件复制与摘要核对，不是合规认证。

原 `ce9caae` ASAR 基线与新 `3955e01` 均有150个实际依赖：147个顶层加3个嵌套包，其中 ONNX common 的稳定版和开发版分别记录。新目录包包含150份元数据、158份原始许可/通知（含Electron/Chromium）及49补充；359输出文件和引用摘要已独立核对，六项审阅待办保留。未改旧候选；完整产物及摘要以 [发布验收总表](testing/release-readiness.md) 为准。

更新依赖时同步更新版本对应的资产/清单；不要放宽校验以接收旧版本通知。`.gitattributes` 禁止资产换行转换，`.prettierignore` 排除该目录，确保Git checkout与格式化保留上游原始字节和摘要。打包时不联网获取新的许可，网络失败不会偷偷换成其它版本。

## 3. 已补的具体说明

| 组件                         | 本轮资产及来源边界                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Electron / Chromium / PDF.js | 保留实际包内原始许可及 PDF CMap/字体/WASM 通知；Electron/Chromium 文本另列索引。                                                            |
| Sharp Windows x64 0.35.5     | 保留原生 README 的29库表、versions、sharp-libvips 1.3.4 通知、libvips 8.18.7 许可和 LGPL 2.1/3、GPL 3 全文。不能只写 Sharp 的 Apache 许可。 |
| Canvas Windows x64 1.0.9     | Canvas 发布提交、所 pin 的 Skia/ICU、Skia 模块及若干确切外部库许可；胶水代码许可和实际外部库许可分别保留。                                  |
| ONNX                         | common/node 1.30.0、web `8d85527…`、嵌套 common `2a43ec0…` 各自版本的 LICENSE / ThirdPartyNotices。                                         |
| DirectML 1.15.4              | 实际 NuGet 软件条款和对应发布提交 NOTICE；不是用 DirectML GitHub 的 MIT 代替 DLL 的分发条款。                                               |
| DXC 1.8.2502                 | 与实物 DLL 版本对应提交的 LICENSE.TXT / ThirdPartyNotices，覆盖 dxcompiler/dxil 的已取得通知。                                              |
| GUID TypeScript 1.0.9        | 原始 npm 元数据及明确标为参考的 SPDX ISC 模板；上游原始版权文件仍缺失。                                                                     |
| BGE                          | 上游 FlagEmbedding **代码**许可作为明确区分的来源材料；不能将它当固定量化权重的许可授权。权重不随安装包分发。                               |

完整直接来源及摘要见清单，不用动态 `master/main` 链接替代已经固定的版本。

## 4. 发布前尚需完成

- [ ] **GUID**：上游包声明 ISC/作者 nicolas，但无上游 LICENSE/版权文件，npm gitHead 在原仓库重定向后不可查。取得相应通知或确认可接受的替代方案；模板不会消除此缺口。
- [ ] **Canvas**：pin的FreeType `264b5fb`、libjpeg-turbo `e14cbfa`、libpng `d5515b5`、zlib `646b7f5` 主许可与FreeType/JPEG引用全文已补入。仍须按实际二进制构建核对次级头部通知（FreeType内嵌zlib/HarfBuzz/fthash，Chromium zlib的SIMD/Intel/contrib代码等）及完整覆盖，不能用Google胶水代码BSD或根许可代替所有外部/嵌入代码。
- [ ] **Sharp/LGPL**：核对完整依赖版权、相应源码与实际构建、可替换库及适用分发条件。已定位 sharp-libvips `ebb95f8…`、build-win64-mxe `ef19ca09…`、libvips `24ad4d0…`；官方 Windows ZIP 只有根 LICENSE/README，表格和标准条款不等于全部对应材料已齐。
- [ ] **固定 BGE**：取得 Xenova revision `75c43b069aac4d136ba6bc1122f995fedcfd2781` 对应模型卡/版权材料并核对上游关系。本轮固定地址获取超时；上游当前模型卡的 MIT 声明和代码许可不足以冒称量化版本已全部核对。设置页已撤去无条件“MIT许可证”标记，说明来源与待办。
- [ ] **DirectML**：对应发布提交的 NOTICE 已保留，但未下载完整 NuGet 包比较是否有另外通知；公开分发前补核。
- [ ] **项目许可**：由用户选择自己的代码授权；第三方仍适用各自许可。选择许可不等于授权推送、公开仓库或发布安装包。

这些是已发现的实际缺口，保持在随包说明和发布门槛中。工程候选可用于隔离验收，公开发行继续待完成。

## 5. 本轮验证范围

`node --test scripts/package-notices.test.mjs` 的5项纯文件测试通过，覆盖嵌套版本/归属、父包缺许可、补充版本/摘要、路径穿越、待审阅状态保留。仅使用生成的包文件，不启动 Electron/安装器、SQLite 或模型。最终语法/构建、静态审查和新候选文件回执另记发布总表；原软件功能清单不因此自动通过。
