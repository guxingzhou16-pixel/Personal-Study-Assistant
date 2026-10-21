# 测试阅读与运行

| 位置                                | 用途                                                   |
| ----------------------------------- | ------------------------------------------------------ |
| `electron/core/__tests__/*.test.ts` | 参数、协议、业务、数据库、迁移和故障边界的 Vitest 规格 |
| `src/lib/*.test.ts`                 | 日期、引用和路线等纯规则规格                           |
| `tests/*.spec.ts`                   | 真实 Electron 窗口、preload／IPC／worker 的常规流程    |
| `tests/*.real.ts`                   | 显式选择的真实模型／嵌入／规模门禁                     |
| `tests/fixtures/`                   | 合成资料、旧版本数据库与固定问题                       |
| `tests/retrieval-evaluation.ts`     | 检索评测入口，供评测脚本构建                           |

## 日常检查

按修改范围选择，下面不是每次都要完整执行的清单：

```powershell
npm run typecheck
npm test -- electron/core/__tests__/interface-wiring.test.ts
npm test -- electron/core/__tests__/note-storage.test.ts
npm run desktop:build
npx playwright test tests/reading-workspace.spec.ts
```

`npm test -- --testTimeout=30000` 执行当前全部核心规格；`npm run test:e2e` 先构建再跑常规桌面套件，包含较耗时的真实专注场景，阶段验收或确有需要时使用。

## 独立门禁

- `npm run test:embedding`：已有固定评测权重时执行真实 CPU 门禁。
- `npm run eval:retrieval`／`npm run eval:hybrid`：固定合成检索回归；退出码不能代替逐题结果。
- `playwright.quality*.config.ts` 与 `playwright.vector-scale.config.ts`：显式真实质量／规模验证，不能当作普通快速检查。

测试使用隔离临时数据与合成资料；协议测试默认使用模拟服务和假密钥。不要读取个人数据库、自动下载模型或调用收费接口。正式安装验收另按项目的真实账户／Sandbox 规则执行。

2026-10-21 将后端 `.test.ts` 从 `electron/core/` 移到 `electron/core/__tests__/`，测试名称和断言保留。Vitest 已有递归匹配，无需更改配置。历史报告仍记录旧路径，按文件名和[目录说明](../docs/CODEMAPS/architecture.md)查当前归属。
