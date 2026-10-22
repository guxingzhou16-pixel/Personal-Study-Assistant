# 晴岛：三入口导航

日期：2026-10-22。保留晴岛原版外观，把常用导航留在顶部，把路线／笔记放到首页摘要，把专注／计划／复习／记忆收进设置。

[打开布局预览](index.html) · [机器设计档案](design.json) · [接手说明](HANDOFF.md) · [正式设计规范](../../docs/design/SUNNY_NAVIGATION.md) · [实施验证](../../docs/handoffs/2026-10-22-sunny-navigation.md)

双击 `index.html` 可离线打开，无需 npm 或桌面程序。顶部可以切换空记录和已有记录，三个主导航、设置齿轮、摘要详情及返回链接均可点击。支持系统减少动态效果；不自动生成、保存或计时。

**全部为示例数据。** 资料、昵称、日期、路线和笔记不来自真实账户。演示只说明布局与跳转关系，完整能力以正式 Electron 程序为准。当前页自身不具备文件导入、模型调用或数据库能力。

预览使用本目录 CSS、JS 与本地插画快照，目录整体复制后仍可打开。`previews/` 保存宽屏、最小桌面及设置预览；验证结果见交接，不引用历史结果。

本轮离线预览60组页面／尺寸／动态偏好检查通过，无横向溢出或网络请求，见[验证记录](validation.json)。正式软件另有30项相关Electron规格通过，实际范围与限制见上方实施交接。

[空记录首页](previews/01-home-empty.png) · [已有记录首页](previews/02-home-records.png) · [设置布局](previews/03-settings.png) · [900px布局](previews/04-home-900.png) · [真实窗口摘要](previews/05-desktop-home.png) · [真实窗口设置](previews/06-desktop-settings.png)

机器接口：`designs.json` 为本轮索引；`design.json` 依 `handoff.schema.json` 校验，所有源码与文档路径相对仓库根目录，预览资产路径相对本目录。历史色彩／动效 schema 不改动。
