# 第三方许可与分发说明

核对日期：2026-10-14。**当前发布条件见[分发收尾](releases/distribution-closeout-2026-10-13.md)：新候选已排除独立Web/GUID，DirectML当前Windows ML分发范围已核对，余Canvas/Sharp/固定量化BGE三项。** 最新77acd64包147元数据/158许可/390补充/2索引，共697输出，本轮两份固定原文与源/提交/实物匹配，7份原manifest对应固定VCS，11运行文件与已验2111一致；声明图83项不代表实际全编译覆盖，详见[增量验证](testing/native-notice-followup-2026-10-14.md)。旧50da0f5的695/新增223原文、2111的472、25b/d205的385及待办保留各自原范围。仓库已按授权公开，BGE询证真实发送，本日无答复；SignPath提交遭Captcha失败，可信签名未完成。本文为工程证据，非法律认证。项目自有代码[MIT](../LICENSE)，第三方保留各自条款；`package.json`的`private: true`继续防止误发npm包，与GitHub可见性无关。

## 1. 安装包中如何查阅

新构建规则将项目许可证原字节复制到`resources/LICENSE.txt`，afterPack检查缺失、链接／目录、正文差异及ASAR元数据的MIT标识。最新d205目录／NSIS构建载荷／真实setup提取载荷的1075字节全文与源码一致，详见[MIT新包实物](testing/mit-package-2026-10-12.md)。旧36及更早包的原始文件和六项待办不改写。

目录包和安装版的 `resources/third-party/` 包含：

- `README.txt`：实际包名/版本、阅读方法、许可审阅状态及待办。
- `packages.json`：实际 ASAR 包清单，包含嵌套依赖和不同版本；记录原始许可表达式、仓库、元数据及许可文件位置/摘要。
- `metadata/`：各依赖原始 `package.json`，保留上游作者等信息，不编造版权年份。
- `licenses/`：实际包内许可、通知、作者文件的原始字节；包含 Electron/Chromium 文本。
- `supplements/`：本仓库固定版本和 SHA-256 的官方补充资产。标准参考模板明确标注来源和缺口，不冒充某依赖的上游版权通知。

包根原有 `LICENSE.electron.txt` / `LICENSES.chromium.html` 和 PDF 资源许可仍保留。许可文件不替代运行验收；安装后能读取这些文件也不代表每项分发条件已满足。

## 2. 可维护的资产与生成规则

源资产在 [scripts/licenses/assets](../scripts/licenses/assets)，来源记录在 [source-records.json](../scripts/licenses/assets/source-records.json)，打包清单在 [manifest.json](../scripts/licenses/manifest.json)。原49份资产增加9份，现为58份，分别记录官方 URL、固定 revision、SHA-256、大小或提取方式。DirectML 原 EULA 由官方 NuGet 许可页面的 `pre` 提取并解码，本轮与完整 NuGet 的 `LICENSE.txt` 原字节对照一致；新增 `LICENSE-CODE.txt` / `ThirdPartyNotices.txt` 保留 ZIP 成员原文，并记录整个压缩包的 URL、摘要、大小和成员路径。Sharp README/versions 是锁安装的原始本机文件，未冒称已重新下载对照。

Canvas 四项依赖的根通知来自官方 Gitiles 固定提交；新增 FreeType `264b5fb…` 的7份次级文件来自官方 FreeType GitHub 同一提交，API base64 解码后核对固定树的 Git blob。保留完整 `fthash.c/h`、内嵌 `zlib.h` 和4份 HarfBuzz 来源文件，不抽取或改写头部。完整源文件用于保存其内嵌许可与版权，不代表已重建 Canvas 或证明全部二进制覆盖。版本与修改来源 README 一并保留，不用许可日期猜 fork 版本。

[package-notices.mjs](../scripts/package-notices.mjs) 接在 `verify-package.mjs` 的 afterPack 中：

1. 按实际 ASAR 的规范包目录读取元数据，包含嵌套 `node_modules`，不抄开发顶层版本。
2. 许可归属以最近的实际包根确定，不能用子依赖许可替缺失的父包许可。
3. 补充项须匹配确切包名/版本；缺文件、摘要不符、路径穿越或链接均拒绝成功。
4. 将原文写入本次新输出并重新读取核对大小/摘要，不修改旧 ASAR、旧安装包或旧回执。
5. 将文件核对结果及 `reviewStatus` / `reviewIssues` 写入 `package-audit`，由最终目录/安装器清单覆盖这些文件。`static-copies-verified` 仅说明文件复制与摘要核对，不是合规认证。

历史 `ce9caae` ASAR 基线与 `3955e01` 候选均有150个实际依赖：147个顶层加3个嵌套包，其中 ONNX common 的稳定版和开发版分别记录。该目录包包含150份元数据、158份原始许可/通知（含Electron/Chromium）及49补充；359输出文件和引用摘要已独立核对，六项审阅待办保留。未改旧候选；完整产物及摘要以 [发布验收总表](testing/release-readiness.md) 为准。

2026-10-10 新固定候选 `53f66a65c30be92ba9671c869a5183722f9203c5`（0.1.1）已实际包含58份补充。目录包及真实 NSIS 解包载荷分别独立核对150包、150元数据、158许可通知、58补充，共 **368输出文件**，引用摘要一致；4878个运行文件的大小/散列完整核对。新回执位于 `artifacts/runtime-package-b2c3f3a5-3b25-46af-b9ef-a83623b2ab88/`。这是当前实物结果，旧359文件候选及原始摘要保持不变。新包 `reviewStatus=pending`、六项审阅待办和未签名状态继续保留，文件核对不代表许可通过。

更新依赖时同步更新版本对应的资产/清单；不要放宽校验以接收旧版本通知。`.gitattributes` 禁止资产换行转换，`.prettierignore` 排除该目录，确保Git checkout与格式化保留上游原始字节和摘要。打包时不联网获取新的许可，网络失败不会偷偷换成其它版本。

### 2026-10-11：补齐已取得的来源材料

源码资产从58增加到75，新增16份Canvas补充（固定Chromium zlib的SIMD、Intel、优化/CPU源码中的内嵌通知及对应Chromium根LICENSE）和1份固定BGE模型卡。完整原字节、Git blob、SHA-256、大小、固定revision和提取方式已核对并写入现有source-records/manifest；只更新两项待办的进展，六类审阅条件继续保留。既有53安装包没有重建或手工改写，包内仍为58补充/368输出。

随后独立干净构建的`7fdf3fe`及最新`36f28d86a2a853842280591981798eff0f786c28`候选，实际目录包与最终setup提取载荷均包含150份元数据、158份许可通知、75份补充，共385个通知输出。逐个大小／SHA-256、固定源字节、来源与索引引用核对通过，六条`reviewIssues`仍为pending。最新回执`artifacts/policy-package-24ca0b67-1bd0-45c7-adbf-4fd58ff7f780/handoff-summary.json`；旧包及摘要不修改，静态文件齐全不等于第4节条件已满足。

zlib材料来自Skia固定依赖 `646b7f569718921d7d4b5b8e22572ff6c76f2596`，通过官方Chromium GitHub固定tree/blob取得，与其origin `2f39ac8d0a414dd65c0e1d5aae38c8f97aa06ae9` 的49个顶层条目逐项一致；按已取得的固定GN来源选取需要保留的通知，不把未列入target的minizip文件混称Canvas已使用。全部真实二进制覆盖仍需核对。

固定Xenova模型卡已取得，1057字节、SHA-256 `cb22054df1a98f7ee9d5b281d023e67c27cc316e1733baf03fc994d95c3048ab`，Git blob `e26ec7fcc01a7aff66171d44acff0a80fae865e1` 与官方固定下载ETag匹配。模型卡仅标 `base_model: BAAI/bge-small-zh-v1.5` 与transformers.js，没有license字段或量化权重授权全文；取得卡片不能关闭权重许可问题。失败请求和恢复字节的核对方式保存在 `artifacts/license-followup-93d8d7be-0fe5-493d-8ce6-233622645d2f/`，没有执行这些上游源文件。

### 2026-10-12：当前 v13 包实物

冻结 `25b2f96c58ab82b761e7bbfed68d5cfbe996264b` / 0.1.1 新 NSIS 的包内审计仍为 150 份元数据、158 许可通知、75 补充，共 385 个通知输出；项目 `resources/LICENSE.txt` 是根目录 MIT 原字节 1075。实际 setup 摘要与[安装版 v13 验收](testing/installed-v13-2026-10-12.md)对应。五项 `reviewIssues` 仍 pending；真实安装、PDF 和 CPU 推理通过也不关闭第三方分发条件。原 d205 / 36 / 53 实物和来源不改写。

## 3. 已补的具体说明

| 组件                         | 本轮资产及来源边界                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Electron / Chromium / PDF.js | 保留实际包内原始许可及 PDF CMap/字体/WASM 通知；Electron/Chromium 文本另列索引。                                                            |
| Sharp Windows x64 0.35.5     | 保留原生 README 的29库表、versions、sharp-libvips 1.3.4 通知、libvips 8.18.7 许可和 LGPL 2.1/3、GPL 3 全文。不能只写 Sharp 的 Apache 许可。 |
| Canvas Windows x64 1.0.9     | Canvas 发布提交、所 pin 的 Skia/ICU、Skia 模块及若干确切外部库许可；新增固定 FreeType 的7份内嵌许可源文件，完整二进制覆盖仍待核对。         |
| ONNX                         | common/node 1.30.0、web `8d85527…`、嵌套 common `2a43ec0…` 各自版本的 LICENSE / ThirdPartyNotices。                                         |
| DirectML 1.15.4              | 实际 NuGet EULA、完整包中的 LICENSE-CODE / ThirdPartyNotices 和独立的发布提交 NOTICE；原始 DLL 的证书差异准确记录，不替换软件分发条款。     |
| DXC 1.8.2502                 | 与实物 DLL 版本对应提交的 LICENSE.TXT / ThirdPartyNotices，覆盖 dxcompiler/dxil 的已取得通知。                                              |
| GUID TypeScript 1.0.9        | 原始 npm 元数据及明确标为参考的 SPDX ISC 模板；完整发布 tarball 的 integrity 已对照，确实没有上游许可全文，版权缺口保留。                   |
| BGE                          | 上游 FlagEmbedding **代码**许可作为明确区分的来源材料；不能将它当固定量化权重的许可授权。权重不随安装包分发。                               |

完整直接来源及摘要见清单，不用动态 `master/main` 链接替代已经固定的版本。

### DirectML 完整包的具体对照

本轮取得 [官方 Microsoft.AI.DirectML 1.15.4 NuGet](https://api.nuget.org/v3-flatcontainer/microsoft.ai.directml/1.15.4/microsoft.ai.directml.1.15.4.nupkg)，请求重定向至官方 `nuget.azure.cn`，包大小202292617字节、SHA-256 `4e7cb7ddce8cf837a7a75dc029209b520ca0101470fcdf275c1f49736a3615b9`。只读取 ZIP，未执行其中程序。`LICENSE-CODE.txt` 为1093字节、`ThirdPartyNotices.txt` 为4577字节，两个成员全文已接入；既有88339字节的 release NOTICE 是另一份文件，继续独立保留。

当前候选的 DirectML.dll 为18527584字节，NuGet x64 DLL 为18527776字节，原始摘要不同。两者 FileVersion 均为 `1.15.4+241025-1615.1.dml-1.15.fac7597`。按 [微软 PE 格式](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)，只排除文件尾部证书表并清零 checksum / Security Directory 后，剩余18517504字节完全相同，归一 SHA-256 `518c2f3fc40dd6e7ed2087bb21cf9b98296e8f0066e9c74d3d52b76766cdd4d7`。原始文件和归一结果均记录在 source-records；不能写成 raw SHA 相同、签名信任验证通过或分发条件通过。

## 4. 发布前尚需完成

2026-10-14最新材料见[本轮记录](testing/runtime-source-materials-2026-10-14.md)：nightly原文8份47148字节/24复用、临时710输出；16源码补丁已核对，未编译或执行。Sharp432为流程原因关闭，用户选择不追加，不代表授权答复。三项继续pending，source/未组合形式/运行时适用条款和SignPath批准/可信签名各自保留门槛。

2026-10-14前轮补核对Canvas发布实物/生产日志与Rust1.98.1基准通知；三份新原文4634字节和已有Apache复用后，在临时目录生成700输出，旧77安装器仍697。Sharp官方core DLL与实物同字节，真实沙盒修改/加载/恢复已通过；未源码重建或关闭全部组合分发条件，原范围见[前轮核对](testing/native-distribution-followup-2026-10-14.md)。

本轮新增标准库详细版权HTML1512520字节和Unicode17原版权740字节，固定HarfBuzz Microsoft USE复用已有1141字节通知；只生成并核对702输出（147元数据/158许可/395补充/2索引），未重建安装器。Sharp bridge源码/recipe与固定dev1.3.4、五CPP及348 Windows headers已对应；未验证Sigstore签名链或源码重建。三项仍pending，具体缺口是Canvas静态runtime/具体嵌入例外、Sharp剩余runtime/组合材料/源码公开提供及BGE许可；不要把精确链接SBOM或位同重建另设为许可证未写出的条件。BGE保留原模型等待已发答复；新原文未来包须携带，旧包成绩不追改。见[本轮记录与清单](testing/signpath-retry-and-native-materials-2026-10-14.md)和[公开摘要](releases/native-materials-followup-0.1.1.json)。

### 当前执行入口（2026-10-13）

本轮已关闭新候选的GUID分发项及当前DirectML用途/通知/数据说明工程项，现有模型和Sharp/Canvas保留。固定Sharp28主源/GVDB/353Cargo/nightly、Canvas93Cargo/固定工程已取得并校验；92主库原文进入2111包。后续793通知成员去重复用，新增223独立原文674323字节及267归属引用，实际50da0f5包695输出核对通过；本日Canvas离线图83项、7原manifest及两份固定Git原文3200字节核对后进入77acd64的697输出。编译覆盖/剩余头部版权与LGPL相应源码及修改库替换仍待闭合。450条公开来源/摘要可复用，BGE许可询证已发送但未获答复；见[源码材料状态](releases/native-source-status-2026-10-13.md)、[旧本轮验证](testing/signed-distribution-2026-10-13.md)与[本日增量](testing/native-notice-followup-2026-10-14.md)。下方2026-10-12五项清单为原候选证据，不能被改成旧包已解决。

### 本次可确认的DirectML条款范围（2026-10-12）

已阅读固定1.15.4官方NuGet的原[EULA](../scripts/licenses/assets/DirectML-1.15.4-LICENSE.txt)，沿用前次完整包／原字节核对结果，不再下载同一资产：

- 第1节限定Windows／Xbox使用，允许在采用机器学习工具／框架开发的应用中复制和分发；按当前Windows学习助手及ONNX架构，属于该允许用途的工程判断。
- 第1(c)节说明第三方组件可能适用独立通知或协议，须分别核对；第3(c)节禁止删除、弱化或修改微软／供应商通知，第3(e)节限制脱离第1节允许用途的分发。当前包携带EULA、LICENSE-CODE、两份ThirdPartyNotices／release NOTICE，全文及摘要已核对；源码许可与DLL的EULA分别记录。
- 第2节的数据事项及第4节的出口要求仍涉及实际分发者和后续使用行为。文件存在、非证书字节一致及项目选择MIT均不能证明这些行为已符合；本项目保持该分发项pending，由公开发行时的具体适用条件核对关闭。

### 待办与具体缺口

- [ ] **GUID**：完整官方1.0.9 tarball 的 SHA-1/SHA-512 与上游元数据匹配，四份文件确实没有 LICENSE/NOTICE/版权文件。包声明 ISC/作者 nicolas，但精确 gitHead API 在重定向后返回422。仍须取得相应通知或确认可接受的替代方案；模板不会消除此缺口。
- [ ] **Canvas**：pin的FreeType `264b5fb`、libjpeg-turbo `e14cbfa`、libpng `d5515b5`、zlib `646b7f5` 主许可与FreeType/JPEG引用全文已补入，FreeType内嵌zlib/HarfBuzz/fthash和固定Chromium zlib SIMD/Intel/优化通知已保留。次级材料已取得，仍须按实际二进制构建核对完整覆盖，不能用Google胶水代码BSD或根许可代替所有外部/嵌入代码。
- [ ] **Sharp/LGPL**：核对完整依赖版权、相应源码与实际构建、可替换库及适用分发条件。已确认 [build-win64-mxe固定提交](https://github.com/libvips/build-win64-mxe/commit/ef19ca09af2453d127453d677c849ccb37cf5694) 为8.18.7构建来源，并只读取得六份构建规则；sharp-libvips `ebb95f8…` 包装脚本选择 static ZIP 路线。完整依赖源码/补丁未齐，未重建或验证替换/重链接；表格、标准条款和部分脚本不等于全部对应材料已齐。
- [ ] **固定 BGE**：Xenova revision `75c43b069aac4d136ba6bc1122f995fedcfd2781` 的模型卡已取得并校验固定blob及BAAI上游关系，但卡中没有license/权重授权全文。仍需确切量化权重许可材料；上游当前模型卡的MIT声明和代码许可不足以冒称量化版本已全部核对。设置页保留来源与待办说明。
- [ ] **DirectML**：完整 NuGet 已核对，EULA、两份额外通知和独立 release NOTICE 均保留；新候选通知已实际生成并核对摘要，发布前仍须核对适用分发条件。DLL 非证书内容匹配不等于签名信任或分发条件通过。
- [x] **项目许可**：用户已于2026-10-11明确选择MIT；根目录LICENSE、项目／锁文件元数据及包内全文规则已接入，d205新包的实际全文已逐字节核对。第三方仍适用各自许可；推送、公开仓库或发布安装包仍须对应授权。

这些是已发现的实际缺口，保持在随包说明和发布门槛中。工程候选可用于隔离验收，公开发行继续待完成。

接手时按下表补证据，已有原文和成功验收无需重新获取或执行：

| 待办 | 已有证据 | 还缺什么 |
| --- | --- | --- |
| GUID | 固定tarball完整性、4文件清单、ISC／作者元数据 | 可归属于该版本的上游版权通知，或有依据的替代分发方案；不能自拟作者／年份补成上游原文 |
| Canvas | 固定源码／主许可／嵌入与SIMD次级通知 | 实际发布二进制完整构建组件和通知覆盖关系 |
| Sharp／LGPL | 29库版本／通知、固定构建提交、6份规则 | 相应完整源码／补丁／构建材料及可替换／重链接的分发方案 |
| 固定BGE | 固定模型卡／Git blob、基座关系、5模型文件摘要 | 确切量化权重的许可／授权依据；当前基座或代码的MIT不能替代缺失证明 |
| DirectML | 完整NuGet／条款、实际DLL对照及包内全文 | 具体公开分发适用条件及分发者义务的核对；不靠签名或版权模板代替 |

取得缺失权利材料需要上游证据；联系维护者、改变依赖或公开发行都不能被本文件中的待办自动授权。用户已明确允许推送`codex/structured-notes`并验证远端CI，实际记录见[CI验收](testing/github-ci-2026-10-12.md)；该授权不改变仓库私有状态，也不授予公开发行权限。

## 5. 本轮验证范围

2026-10-10 接入新增资产后，`node --test scripts/package-notices.test.mjs` 的5项纯文件测试通过，覆盖嵌套版本/归属、父包缺许可、补充版本/摘要、路径穿越、待审阅状态保留。此后当前53候选已独立构建并核对实际58份补充/368输出及 NSIS 全载荷，详情见[发布总表](testing/release-readiness.md)；此前材料阶段的“未生成新包”记录不再作为当前状态，但旧回执不改写。

文件生成器本身不启动应用/安装器或模型；软件源码和正式包另行验证，详见[整合报告](testing/final-acceptance-2026-10-10.md)。许可全文与摘要正确不能消除第4节的六项条件，也不自动勾选功能清单。

### Microsoft Visual C++ 运行库的分发边界

真实隔离系统暴露了 ONNX x64 原生运行库缺失。当前设置说明用户从[微软官方运行库页面](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170)手动安装/更新 v14 x64，再重启应用；**该运行库未随本候选分发，应用不自动安装或提升权限**，也不要求安装 C++ 编译工具。验收时仅在 guest 执行已核对的微软签名14.51.36247.0安装器，宿主没有执行。

若后续计划捆绑微软运行库，需要另核对适用再分发条件和载荷来源。当前仅提供官方安装说明，不把运行库文件的签名有效当作项目或其他依赖已获得分发授权。

2026-10-11补核2026-10-10的正式包执行记录：当前53候选在已安装运行库的真实guest中完成PDF/真实ONNX CPU混合检索子检查及独立恢复，卸载前后五份模型文件摘要未变。安装/升级/内部OS重启/卸载/目录启动/NSIS重装回看的限定证据不改变本节运行库分发边界；重装后额外CPU门禁因辅助脚本BOM解析失败，未复验，不写为通过。原始记录与覆盖限制见[整合报告](testing/final-acceptance-2026-10-10.md)。本文六项许可待办仍为pending。

同日最新36候选在新的真实Sandbox完成AI数据恢复及实际重装后的CPU混合管线；官方运行库只在guest安装，五个系统DLL与五模型摘要均有记录，原同义查询miss保留。详见[安装版AI补验](testing/installed-ai-2026-10-11.md)。这项运行通过不改变运行库未捆绑、未签名或第4节六项分发条件，也不把历史BOM原FAIL改成通过。
