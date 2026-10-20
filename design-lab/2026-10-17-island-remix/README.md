# 晴岛排版 · 三种新气质

日期：2026-10-17。状态：本地概念 demo，用于选择视觉方向；尚未接入正式 Electron 软件。

用户认可第一轮「03 晴岛」的排版。本轮保留顶部导航、欢迎横幅、下方左侧阅读／资料与右侧签到／计时的结构，额外制作三套新风格。晴岛原版只作对照，不计入新增数量，也不修改原文件。

## 先看效果

打开 [本轮四入口总览](index.html)。三套新风格使用同一份合成内容、相同的信息结构与交互，便于比较。

| 方向                        | 视觉区别                               | 入口                                                            | AI 档案                                                         |
| --------------------------- | -------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| 新增 01 玄墨 / Mono Noir    | 黑白灰暗色、灰阶表面、克制线条         | [进入玄墨](01-mono/index.html)                                  | [HANDOFF](01-mono/HANDOFF.md) / [JSON](01-mono/design.json)     |
| 新增 02 赤陶 / Terra Studio | 米白、陶土橙、编辑工作室式字体和纸感   | [进入赤陶](02-terra/index.html)                                 | [HANDOFF](02-terra/HANDOFF.md) / [JSON](02-terra/design.json)   |
| 新增 03 蓝调 / Blue Atelier | 钴蓝、奶油黄、硬描边、几何图形         | [进入蓝调](03-blue/index.html)                                  | [HANDOFF](03-blue/HANDOFF.md) / [JSON](03-blue/design.json)     |
| 原版对照 晴岛 / Sunny Isle  | 第一轮柔和绿、杏色、灰紫；仅作排版依据 | [查看原版](../2026-10-17-three-directions/03-island/index.html) | [原版档案](../2026-10-17-three-directions/03-island/HANDOFF.md) |

截图位于 [previews/](previews/)，包含总览及三套首页、阅读页。原晴岛截图继续引用第一轮资产。

## 本地运行

没有安装依赖或构建步骤。直接双击本轮 `index.html`；也可在本目录运行：

```powershell
python -m http.server 4318 --bind 127.0.0.1 --directory ..
```

浏览器访问 `http://127.0.0.1:4318/2026-10-17-island-remix/`。`--directory ..` 同时提供本轮和复用的第一轮共享文件。直接本地文件打开时，相对路径无需额外配置。

[本地 GitHub 参考展示](references/index.html) 在同一目录内保存，来源、版本、许可和借鉴范围见 [REFERENCES.md](REFERENCES.md)。参考项目的源码位于 `references/upstream/`，与正式软件依赖分开；不得据此声称其已集成到产品。

## 可体验的范围

- 顶部导航切换今日、资料库、阅读工作台；本轮风格导航保留原晴岛对照。
- 资料库按名称／主题搜索、按 PDF／Markdown 筛选，`/` 聚焦搜索。
- 打开第一份示例资料，切换目录、护眼、助手，点击引用高亮原文。
- 示例签到与手动计时可操作，刷新重置；不写入个人学习记录。
- 导入、设置、另外两份资料阅读与问答提交通过弹窗说明概念范围。

不包含 Electron、真实模型、持久化、真实 PDF 或正式主题切换系统。示例问答不是本轮生成质量评测；计时没有升级为番茄钟。

## 其他 AI 如何接手

依次读取项目根 `AGENTS.md`／`README.md`、`design-lab/AGENTS.md`、[designs.json](designs.json)，再打开所选方向的 `HANDOFF.md` 与 `design.json`。结合实际 HTML、CSS 与截图确认视觉，实际检查结果见 [VALIDATION.md](VALIDATION.md)。

`handoff.schema.json` 沿用第一轮 v1 档案结构。三个新 ID 代表独立视觉方向；`layoutReference` 在目录注册表中记录晴岛为共同排版来源。`productIntegration.file` 均为仓库根目录相对路径，其他资产路径相对于各自 `design.json`。这是其他 AI 可读取的静态交接接口，不是应用运行时 API。

```text
index.html                  三套新增风格 + 一套原版对照
shared/variants.css          本轮三套视觉覆盖，不改变晴岛页面骨架
shared/variants.js           本轮导航与视觉内容调整
01-mono/                    玄墨入口、HANDOFF 和 design.json
02-terra/                   赤陶入口、HANDOFF 和 design.json
03-blue/                    蓝调入口、HANDOFF 和 design.json
previews/                   总览、三个首页、三个阅读页
references/                 本地 GitHub 参考展示与来源资产
designs.json                稳定 ID 与入口注册表
handoff.schema.json         三份设计档案的结构契约
REFERENCES.md               参考来源、借鉴点、版本与许可
VALIDATION.md               实际检查结果与未验证范围
```

三套入口通过相对路径复用第一轮 `shared/demo.css` 和 `demo.js`，再加载本轮覆盖层。实现时保留 `data-theme="garden"` 来选择晴岛排版，以 `data-variant="mono|terra|blue"` 区分本轮视觉。原轮文件是共享基线，后续改动不应直接覆盖它。

如果正式采用某一方向，应把视觉 token 和组件外观移入现有 React 组件；页面状态、资料数据、签到计时、引用与错误处理继续使用已有逻辑和 `DesktopApi`。不复制 demo 的 HTML 字符串、固定资料、示例回答或计时状态。

## 验证边界

以 [VALIDATION.md](VALIDATION.md) 的实际记录为准。本轮交付是审美参考，不代表真实桌面功能已更新。黑白灰方案仍需维持可读的文字层次；蓝调的硬描边与阴影应限定在首页工具区，长时间阅读保持安静。
