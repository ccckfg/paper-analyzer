# ScholarLens — Codex 交接文档

## 项目概述
Tauri v2 跨平台科研文献分析工具（Windows / macOS / Android）。  
首屏为搜索对话框 → 输入主题后调 PubMed API → 论文列表 / 引用网络图 / 核心论文排行 / AI 分析报告。  
设置页支持自定义 OpenAI 格式 LLM API。

## 当前项目状态

### ✅ 已完成
| 模块 | 状态 | 文件 |
|------|------|------|
| Rust 数据模型 | ✅ 完成 | `src-tauri/src/models/{paper,network,config,mod}.rs` |
| PubMed API 服务 | ✅ 完成 | `src-tauri/src/services/pubmed.rs` |
| 引用关系获取 | ✅ 完成 | `src-tauri/src/services/citation.rs` |
| 网络分析算法 | ✅ 完成 | `src-tauri/src/services/graph.rs` |
| LLM 调用服务 | ✅ 完成 | `src-tauri/src/services/llm.rs` |
| Tauri Commands | ✅ 完成 | `src-tauri/src/commands/{search,network,analysis,settings,mod}.rs` |
| Tauri 入口 | ✅ 完成 | `src-tauri/src/lib.rs`, `src-tauri/src/main.rs` |
| **Rust `cargo check`** | ✅ **编译通过** | 无错误 |
| 前端类型定义 | ✅ 完成 | `src/types/index.ts` |
| 前端常量配置 | ✅ 完成 | `src/config/constants.ts` |
| Tauri invoke 封装 | ✅ 完成 | `src/services/tauriCommands.ts` |
| 搜索页 | ✅ 完成 | `src/pages/SearchPage.tsx` + `src/styles/SearchPage.css` |
| 结果页（Tab切换） | ✅ 完成 | `src/pages/ResultsPage.tsx` + `src/styles/ResultsPage.css` |
| 设置页 | ✅ 完成 | `src/pages/SettingsPage.tsx` + `src/styles/SettingsPage.css` |
| 论文列表/卡片 | ✅ 完成 | `src/components/{PaperList,PaperCard}.tsx` + `src/styles/PaperCard.css` |
| 引用网络图 | ✅ 完成 | `src/components/NetworkGraph.tsx` + `src/styles/NetworkGraph.css` |
| 核心论文排行 | ✅ 完成 | `src/components/TopPapers.tsx` + `src/styles/TopPapers.css` |
| AI 报告 | ✅ 完成 | `src/components/AiReport.tsx` + `src/styles/AiReport.css` |
| App 根组件 | ✅ 完成 | `src/App.tsx` |
| 全局样式 | ✅ 完成 | `src/index.css` |
| Vite 前端 | ✅ **单独启动正常** | `npx vite` 在端口 1420 正常运行 |

### ❌ 当前阻塞问题

**`npm run tauri dev` 无法正常启动 Tauri 窗口。**

**现象描述：**
- 运行 `npm run tauri dev` 后，Tauri CLI 持续输出 `Warn Waiting for localhost:1420/...`，即使 Vite 已经在 1420 端口运行
- 单独运行 `npx vite` 或 `npm run dev` → Vite 正常启动在 1420 端口
- 单独运行 `cargo check` → Rust 编译通过无错误
- 问题出在 **Tauri CLI 与 Vite dev server 在 Windows 上的协调机制**

**已尝试的方案（均失败）：**
1. `npm run tauri dev` → 卡在 Waiting for localhost:1420
2. 手动启动 Vite + `npx tauri dev --no-dev-server` → 仍然尝试 beforeDevCommand
3. 将 `beforeDevCommand` 设为空字符串 + 手动启动 Vite + `npx tauri dev` → 快速退出 exit code 1 无详细错误
4. 输出重定向到文件 → 输出为空

**可能的原因：**
- Windows PowerShell 管道与 Tauri CLI stdout 检测机制不兼容
- Tauri CLI 通过检测 stdout 中的 "localhost" 来判断 Vite 是否就绪，但 Windows 终端的输出渲染方式导致检测失败
- 可能需要将 `tauri.conf.json` 中的 `beforeDevCommand` 恢复为 `npm run dev`，并在支持 PTY 的终端（如 Windows Terminal 或 Git Bash）中运行

**当前 `tauri.conf.json` 的 `beforeDevCommand` 已被改为空字符串 `""`。**  
**原始值应为 `"npm run dev"`。**

## 期望达到的结果

### 近期目标
1. **`npm run tauri dev` 能成功启动** Tauri 窗口，显示前端 UI
2. **搜索功能正常**：输入 "genomic selection"，能从 PubMed 获取论文列表
3. **引用网络图渲染**：vis-network 正常显示交互式网络图，核心论文红色高亮
4. **核心论文排行**：展示 Top 10 核心论文
5. **设置页功能**：能保存/读取 LLM API 配置，测试连接
6. **AI 报告生成**：调用配置的 LLM API 生成分析报告

### 远期目标
7. 前端 TypeScript 类型检查 `npx tsc --noEmit` 通过
8. UI 美观度优化（动画过渡、响应式布局调整）
9. Android 适配（`npm run tauri android init` + 构建 APK）

## 环境信息

| 项目 | 版本 |
|------|------|
| OS | Windows |
| Node.js | v24.12.0 |
| npm | 11.6.2 |
| Rust | 1.94.0 |
| Tauri CLI | ^2 (via npm devDependency) |
| React | ^19.1.0 |
| Vite | ^7.0.4 |
| vis-network | (npm installed) |
| Visual Studio Build Tools | 已安装（C++ 桌面开发工作负载） |

## 项目文件树

```
paper-analyzer/
├── src-tauri/                       # Rust 后端 ✅ cargo check 通过
│   ├── Cargo.toml
│   ├── tauri.conf.json              # ⚠️ beforeDevCommand 当前为空字符串
│   ├── capabilities/default.json
│   └── src/
│       ├── main.rs
│       ├── lib.rs                   # Tauri 入口，注册所有 commands
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── search.rs            # search_papers, get_paper_count
│       │   ├── network.rs           # build_network
│       │   ├── analysis.rs          # get_core_papers, generate_ai_report, test_llm_connection
│       │   └── settings.rs          # save_settings, load_settings
│       ├── services/
│       │   ├── mod.rs
│       │   ├── pubmed.rs            # PubMed E-utilities API
│       │   ├── citation.rs          # elink 引用关系
│       │   ├── graph.rs             # 网络构建 + 中心性计算
│       │   └── llm.rs               # OpenAI 格式 LLM 调用
│       └── models/
│           ├── mod.rs
│           ├── paper.rs             # Paper, PaperSummary, CorePaper, PlantInfo
│           ├── network.rs           # NetworkNode, NetworkEdge, NetworkData
│           └── config.rs            # LlmConfig, AppSettings
│
├── src/                             # React 前端 ✅ Vite 单独启动正常
│   ├── main.tsx
│   ├── App.tsx                      # 页面切换：search / results / settings
│   ├── index.css                    # 全局深色主题样式
│   ├── config/constants.ts
│   ├── types/index.ts
│   ├── services/tauriCommands.ts    # Tauri invoke 封装
│   ├── pages/
│   │   ├── SearchPage.tsx           # 首屏搜索对话框
│   │   ├── ResultsPage.tsx          # 结果页（Tab: 论文/网络/核心/AI报告）
│   │   └── SettingsPage.tsx         # LLM API 配置
│   ├── components/
│   │   ├── PaperList.tsx
│   │   ├── PaperCard.tsx
│   │   ├── NetworkGraph.tsx         # vis-network 渲染
│   │   ├── TopPapers.tsx
│   │   └── AiReport.tsx
│   └── styles/                      # 各组件 CSS
│       ├── SearchPage.css
│       ├── ResultsPage.css
│       ├── SettingsPage.css
│       ├── PaperCard.css
│       ├── NetworkGraph.css
│       ├── TopPapers.css
│       └── AiReport.css
│
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 修复建议

1. **首先恢复 `tauri.conf.json` 的 `beforeDevCommand`**：
   ```json
   "beforeDevCommand": "npm run dev"
   ```

2. **排查 Tauri CLI 版本**：运行 `npx tauri --version` 确认版本，检查是否有已知 Windows 兼容性 issue

3. **尝试在 Git Bash 或 cmd.exe 中运行** `npm run tauri dev`（而非 PowerShell），因为 Tauri CLI 的 stdout 检测在不同 shell 中行为不同

4. **如果仍然不行**，尝试：
   ```bash
   # 终端1：手动启动 Vite
   npm run dev
   
   # 终端2：跳过 beforeDevCommand，直接编译运行 Rust
   cd src-tauri
   cargo run
   ```
   这会直接启动 Tauri 应用并连接到已运行的 Vite dev server

5. **检查防火墙/端口占用**：`netstat -ano | findstr 1420`，确认端口可用

## Codex 接续更新（2026-03-26）

### ✅ 已完成修复
1. `src-tauri/tauri.conf.json` 已恢复并强化为：
   - `"beforeDevCommand": "npm run dev -- --host 127.0.0.1 --port 1420 --strictPort"`
   - `"devUrl": "http://127.0.0.1:1420"`
2. `vite.config.ts` 已统一开发主机配置：
   - 默认 host 改为 `127.0.0.1`（避免 `localhost` 的 IPv4/IPv6 解析差异）
   - 保留 `TAURI_DEV_HOST` 场景下的 HMR 配置
3. 修复 `src/components/NetworkGraph.tsx` 的 TypeScript 类型错误：
   - 显式使用 `vis-network` 的 `Node` / `Edge` / `Options` 类型
   - 补齐 `smooth` 必需字段，`npx tsc --noEmit` 现已通过

### 🧪 验证结果（在 Codex 沙箱）
- `npx tsc --noEmit`：通过
- `cargo check`：通过（仅有 `PlantInfo` 未使用 warning）
- `npm run tauri dev`：未能最终拉起，报 `Error: spawn EPERM`（`esbuild` 子进程创建被沙箱拒绝）

> 说明：`spawn EPERM` 是当前运行环境权限限制，不是项目逻辑报错。在开发机终端中应可继续验证 Tauri 窗口启动。

### 下一步（开发机执行）
1. 在本机运行 `npm run tauri dev`，确认窗口可启动
2. 若仍异常，优先检查：
   - 终端权限（管理员/安全软件拦截）
   - Node 进程创建权限策略
   - 端口 1420 是否被占用
