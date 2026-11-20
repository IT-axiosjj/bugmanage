# TaskDock · 桌面悬浮任务清单

面向程序员的 Windows 桌面任务工具，把项目待办放在随手可见的悬浮窗口里。支持任务完成/取消完成、项目归属、优先级，以及从本地文档、图片和网页内容整理任务。

当前采用 **Electron + React + TypeScript + Vite**，处于 MVP 阶段，尚未迁移到 Tauri / WebView2。

## 功能概览

| 功能 | 当前能力 |
| --- | --- |
| 桌面悬浮 | 无边框、始终置顶，拖动顶部品牌区域移动窗口 |
| 窗口缩放 | 默认 `300 × 420`；可拖动边缘缩放，范围为 `280 × 360` 至 `720 × 900` |
| 任务管理 | 手动添加、勾选完成、取消完成、本地保存 |
| 项目和优先级 | 添加自定义项目，任务按项目分组；支持高、中、低优先级 |
| 状态筛选 | 点击顶部“全部任务 / 待完成 / 已完成”卡片切换 |
| 快速添加 | 点击顶部第四张“添加任务”卡片打开添加面板 |
| 搜索 | 按任务标题、项目名称和导入来源搜索 |
| 文档导入 | 拖入 Word、Excel、文本 PDF、TXT、Markdown、CSV 等文件 |
| 图片识别 | 使用 Tesseract OCR 识别图片中的中文和英文 |
| 在线内容 | 拖入链接、表格选区或 HTML 表格；支持粘贴网页链接解析 |
| 腾讯文档 | 已有 OAuth 授权及在线表格读取代码，需要应用凭据并完成实际联调 |
| Windows 安装包 | 可生成 NSIS 安装器，创建桌面和开始菜单快捷方式 |

页面隐藏滚动条，保留鼠标滚轮滚动。

## 快速启动

环境要求：Windows 10 / 11，当前安装包目标为 x64。开发环境建议使用 Node.js 22 或 24，并安装 npm。首次安装依赖、OCR 下载语言包、读取在线文档需要联网。

获取源码与安装依赖：

```powershell
git clone https://github.com/IT-axiosjj/bugmanage.git
cd bugmanage
npm ci
```

开发模式：

```powershell
npm run dev
```

该命令启动本地 Vite 服务，并打开 Electron 桌面窗口。需要完整体验文件拖拽、OCR、窗口控制和腾讯授权时，请使用 Electron 窗口。

使用构建产物启动：

```powershell
npm run start
```

该命令先执行 TypeScript 检查和前端构建，再启动桌面应用。`npm run preview` 仅提供前端页面预览，不能代替 Electron 桌面运行环境。

## 生成 Windows 安装包

```powershell
npm run dist
```

输出位置：

```text
release/
├── TaskDock-Setup-0.1.0.exe
├── TaskDock-Setup-0.1.0.exe.blockmap
└── win-unpacked/
    └── TaskDock.exe
```

安装包文件名中的版本号来自 `package.json`。双击安装器并按向导选择安装位置，安装完成后可从桌面快捷方式启动，安装用户不需要额外安装 Node.js。

如果只需要生成未安装的应用目录：

```powershell
npm run pack
```

随后运行 `release/win-unpacked/TaskDock.exe`。分发该版本时需要保留整个 `win-unpacked` 目录。

当前使用最大压缩，仍会包含 Electron 运行环境；此前本机生成的安装包约为 95 MiB，实际大小随依赖和构建结果变化。安装包尚未配置 Windows 代码签名证书。

## 使用方法

### 管理任务

1. 点击顶部第四张“添加任务”卡片。
2. 输入任务标题，选择项目归属和优先级。
3. 如需新项目，在“自定义项目归属”处输入名称并点击“新建项目”。
4. 点击“添加到清单”。
5. 点击任务前的勾选框标记完成，再次点击可以取消完成。
6. 使用前三张统计卡片切换状态，在搜索框筛选标题、项目或来源。

首次启动包含演示任务。任务和项目保存在本地 `localStorage`，存储键为 `taskdock-state-v1`，目前没有云端同步。

### 移动、缩放和滚动

- 拖动顶部 TaskDock 品牌区域移动悬浮窗口。
- 拖动窗口边缘或边角进行缩放。
- 使用鼠标滚轮浏览任务列表。

右上角“−”用于最小化，“×”当前用于隐藏窗口，恢复入口的限制见下文。

### 导入本地文件

把文件拖入任务窗口，或打开添加面板后选择文件。导入任务使用添加面板当前选定的项目归属。

| 类型 | 支持与限制 |
| --- | --- |
| Word | 支持 `.docx` 正文提取；旧版 `.doc` 尚未实现解析 |
| Excel | 支持 `.xlsx`、`.xls`，读取工作簿中的工作表文本 |
| PDF | 提取已有文本层；扫描版 PDF 尚无逐页 OCR |
| 图片 | 支持 `.png`、`.jpg`、`.jpeg`、`.webp`、`.bmp`、`.gif`；首次 OCR 下载语言包 |
| 文本 | 支持 `.txt`、`.md`、`.csv`、`.tsv`、`.json`、`.log`，按 UTF-8 读取 |

文件选择器展示的类型可能少于拖拽入口。当前使用规则提取候选任务，并非大模型语义拆解：按文本行整理，每次最多生成 500 条，候选标题长度为 3–240 个字符。

复杂表格、多行单元格、超长记录仍可能被合并或过滤，不能保证文档记录数与最终任务数完全一致。

### 导入网页和在线表格选区

- **网页链接**：拖入窗口后解析，或在添加面板中粘贴链接并点击解析。
- **表格选区**：拖入能够提供文本或 HTML 的选区，程序按行整理任务。
- **私有或动态网页**：普通网页抓取不会继承浏览器登录会话，可能无法获取正文，可改用选区内容或导出文件导入。

### 腾讯文档授权与读取

界面没有常驻的连接状态入口。拖入腾讯文档链接，或粘贴链接后点击“授权读取”，会按需打开授权配置面板。

1. 在腾讯文档开放平台创建应用并取得 `Client ID` 和 `Client Secret`。
2. 将应用的回调地址配置为与 TaskDock 一致的值，默认值为 `http://127.0.0.1:17865/oauth/tencent-docs/callback`。
3. 在 TaskDock 授权面板填写应用凭据，点击“授权登录”。
4. 在独立授权窗口中完成账号登录与授权。
5. 授权成功后，程序尝试继续读取刚才提交的链接。

当前腾讯文档读取目标为在线表格，默认范围 `A1:ZZ500`；链接应保留 `tab` 参数以指定工作表。账号必须拥有文档访问权限。

**联调状态：**仓库已包含授权入口、回调处理、Token 刷新与工作表读取代码，但尚未使用真实开放平台应用完成端到端验证；实际接口权限、响应结构和读取结果仍需要联调确认。未配置应用凭据时，不能仅凭私有文档链接完成读取。

授权配置保存在 Electron 用户数据目录的 `tencent-docs-auth.json` 中。代码尝试使用 `safeStorage` 保护 `Client Secret`，访问和刷新 Token 目前保存在本地配置中。请勿把该配置文件或实际应用密钥提交到仓库。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm ci` | 按锁文件安装依赖 |
| `npm run dev` | 启动 Vite 与 Electron 开发窗口 |
| `npm run build` | TypeScript 检查及前端生产构建 |
| `npm run start` | 构建后启动 Electron |
| `npm run preview` | 仅预览前端产物 |
| `npm run pack` | 生成 Windows 应用目录 |
| `npm run dist` | 生成 Windows x64 NSIS 安装包 |
| `node --check electron/main.cjs` | 检查 Electron 主进程语法 |
| `node --check electron/preload.cjs` | 检查 preload 语法 |

## 目录结构

```text
bugmanage/
├── electron/
│   ├── main.cjs          # 悬浮窗口、文件解析、网页读取、腾讯授权
│   └── preload.cjs       # 主进程与页面之间的 IPC 桥接
├── src/
│   ├── App.tsx           # 任务界面、筛选、导入及授权交互
│   ├── main.tsx          # React 入口
│   ├── styles.css        # 悬浮窗样式与小尺寸适配
│   └── vite-env.d.ts     # 桌面 API 类型声明
├── index.html
├── package.json          # 项目信息、脚本与 Windows 打包配置
├── package-lock.json     # npm 依赖锁文件
├── tsconfig.json
├── vite.config.ts
├── .gitignore
├── LICENSE
└── README.md
```

`node_modules/`、`dist/`、`release/`、构建缓存和本地凭据不纳入 Git。安装包通过 `npm run dist` 生成。

## 当前限制与后续方向

- 当前仍是 Electron 版本，Tauri / WebView2 迁移尚未实施。
- 暂无任务编辑、删除、截止时间、提醒、云同步和自动更新。
- 任务已按项目分组；顶部项目筛选按钮目前仅在“全部”和首个项目之间切换，任意项目筛选有待完善。
- 暂无系统托盘恢复入口；隐藏后如无法找回窗口，需要结束该应用进程再启动，日常使用建议选择最小化。
- 暂无窗口位置和用户调整后尺寸的持久化。
- 在线文档授权需要真实应用配置和联调，不代表任意腾讯文档链接都可以成功导入。
- 图片识别准确率取决于清晰度、排版和语言，OCR 不会自动处理扫描版 PDF。
- 当前未提供自动化测试套件；可先运行构建和主进程语法检查，再验证桌面交互。

后续可按需要完善任务编辑和项目筛选、托盘与快捷键、导入预览与去重，以及迁移到 Tauri / WebView2 的轻量桌面版本。

## 问题反馈与许可

问题和建议可提交到本仓库的 [Issues](https://github.com/IT-axiosjj/bugmanage/issues)。

本项目采用 [MIT License](./LICENSE)。
