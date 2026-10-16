# Windows 标准运行库：分发角色与保护条件

核对日期：**2026-10-15**。本页记录当前 Canvas/Sharp 完整 Windows 模块的分发依据与实施范围；最终f84285f的实际许可界面、安装和数据保护已通过，软件与源码已在同一Release公开。三个公开附件匿名完整下载已相同大小/SHA，确切范围见[发布验收](../testing/github-preview-release-2026-10-15.md)。

## 当前分发角色

本项目使用固定官方 `@napi-rs/canvas-win32-x64-msvc@1.0.9`、`@img/sharp-win32-x64@0.35.5` 完整未改二进制，保留供应方及第三方许可、版权和通知。供应方公开二进制许可是取得这些 programme 模块的直接依据；Microsoft 专有运行库代码不因模块或项目标注 MIT/Apache/LGPL 而被重新授权。

当前角色是完整应用组件的下游分发者，不因接收、打包这些模块就成为 Visual Studio/SDK 开发工具产品的使用者，也不取得单独提取和发布 Microsoft 工具、原始 `.lib` 或 Runtime 产品的权利。原构建者自身的工具许可和责任仍按其实际合同适用。

## 原条款与判断边界

- [VS2026 Enterprise/Professional 原条款](https://visualstudio.microsoft.com/license-terms/vs2026-ga-pro-enterprise/)的 Distributable Code 部分允许获许可开发者授权应用分发者随应用复制、分发代码，同时要求显著主功能及分发者/外部用户的保护条款。
- [Windows SDK 原条款](https://aka.ms/WinSDKLicenseURL)同样允许第三方程序分发。[SDK REDIST](https://learn.microsoft.com/en-us/legal/windows-sdk/redist)明确覆盖公开 SDK 的 `ucrt/x64`、`um/x64` 等目录中的库，按条件提供未改的链接结果；这不是原始 `.lib` 的独立分发许可。
- [Microsoft 部署说明](https://learn.microsoft.com/en-us/cpp/windows/deployment-in-visual-cpp?view=msvc-170)区分独立 Runtime 安装、应用本地 DLL 和静态链接。终端 Runtime 产品的安装/使用合同不能单独充当发行授权，其禁止再分发也不能无条件套到另一许可路径下的静态程序。

把完整供应方模块的公开分发许可与上述委托路径相联系，包含对供应方确有其发布权限的常规信赖。本项目没有独立审计其私有采购合同、全部静态输入或最终工具链小版本，不能声称这些权利已逐对象证明；也未发现本角色必须另购 VS、追查私有默认版本或联系 Microsoft 取得专项批准的原条款要求。

## 已落地的保护与安装安排

[安装确认正文](../../scripts/licenses/installation-terms.txt)只覆盖 Microsoft 保留专有权利的标准运行库部分，保留通知、商标和许可范围，包含适用技术限制/反向工程保护、无担保及责任/救济限制，不统一猜定赔偿金额。强制法和独立开源许可权利优先，包括 Microsoft 自行开源的代码及 LGPL 修改、替换和调试权利。

选择同意仅接受实际组件条件，不要求接受整个开发工具合同，不豁免真实适用责任。项目自有代码继续适用 MIT；不能把 Microsoft 专有代码重授 MIT，也不能把专有条件扩张为整个开源模块的禁令。

`electron-builder.json` 将正文接入 NSIS 许可页并复制为 `resources/INSTALLATION-TERMS.txt`。[安装钩子](../../scripts/installer.nsh)拒绝 `/S` 和更新自动安装路径，要求本版进行图形确认。真实Sandbox已验证中文原文可读、实际同意/取消，两个自动参数退出1602；普通手动覆盖及卸载器仍按对应路径验证，不用源码检查冒充GUI。

[Sharp 库旁通知](../../scripts/licenses/sharp-distribution-notice.txt)已进入实际库目录的 `SOURCE-NOTICE.txt`，原字节经安装器实提核对，标明相应及未组合源码附件、固定来源、库替换位置和 LGPL 权利。独立源码形态及公开获取安排见 [Sharp 分发计划](sharp-source-distribution-plan.md)；[BGE 下载范围](bge-download-distribution-policy.md)另行记录，均不扩张本页结论。

## 本轮验收与范围

- 最终包的安装确认、库旁通知和原有许可字节/位置对应，实际图形许可、自动拒绝、首装/覆盖/重开/卸载及61数据文件零差异均已验证。
- 对应源码和清晰说明已与二进制同页公开；安装器、源码附件和清单均已匿名完整下载并核对相同大小/摘要，不改写构建时的待办快照。
- 当前具体保护与交付路径按上述角色依据履行；保留供应方信赖和未覆盖范围。本页不是对全部上游权利、合同效力或软件质量的保证。

实际安装只在本轮专用Sandbox执行；宿主未安装应用、未打开个人学习数据或重新执行模型，未代表用户接受整个Microsoft开发工具合同。
