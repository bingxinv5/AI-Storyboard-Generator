# 🎬 AI分镜提示词生成器

基于 Gemini 多模态AI，智能反推图片场景，生成专业分镜提示词，支持AI文生图和视频生成。

![界面预览](docs/preview.png)

## ✨ 核心功能

### 1. 🤖 智能分镜分析
- 上传参考图，AI自动分析场景、人物、风格
- 生成远景、中景、近景、特写等专业镜头描述
- 支持批量分析多张参考图

### 2. 📝 两种创作模式
- **分镜模式**：同一画面的不同镜头角度，适合电影/广告分镜
- **故事模式**：连续剧情的关键画面，自动编排时间线和因果关系

### 3. 🎨 AI文生图
- 一键根据提示词生成AI图片
- 支持最多9张参考图，保持风格统一
- 多种画幅比例和分辨率选择

### 4. 🧩 九宫格图片拆分
- 一键拆分AI生成的九宫格图片
- 支持多种布局：2×2、3×3、4×4、6×6等
- 集成AI放大功能（4倍超分辨率）
- 批量下载、ZIP打包

### 5. 🎬 视频分镜生成
- 支持多个AI视频模型：
  - **Sora 2 / Sora 2 Pro**：OpenAI图生视频
  - **Veo 3.1 / Veo 3.1 Pro**：首帧/尾帧控制
  - **Veo 3.1 Components**：多图组合生成
- 批量生成、任务队列、断点续传
- 生成历史自动保存

## 🚀 快速开始

### 方式一：直接使用
1. 下载项目文件
2. 双击 `storyboard-generator-modular.html` 打开
3. 配置 API Key（支持 OpenAI 兼容格式）
4. 开始创作！

### 方式二：启用本地代理（推荐）
如果遇到网络问题或需要使用AI放大功能：
1. 安装 [Node.js](https://nodejs.org/)
2. 双击 `启动代理服务器.bat`
3. 刷新页面即可

## ⚙️ API配置

支持任何 OpenAI 兼容格式的 API：

| 服务商 | API Base URL | 说明 |
|-------|-------------|------|
| OpenAI 官方 | `https://api.openai.com/v1` | 需科学上网 |
| 第三方转发 | `https://api.bltcy.ai/v1` | 国内可用 |
| 本地部署 | `http://localhost:11434/v1` | Ollama等 |

## 🔍 技术栈分析

从仓库结构和源码实现来看，这个工程采用的是“**原生前端 + Node.js 本地代理 + Upscayl 独立放大服务**”的组合方案，整体偏轻量，不依赖前端打包器。

### 1. 前端技术

- **HTML5**：主入口是 `storyboard-generator-modular.html`
- **CSS3**：样式文件位于 `css/storyboard-generator.css`、`css/task-queue.css`
- **原生 JavaScript（Vanilla JS）**：核心逻辑拆分在 `js/` 目录下，以多个脚本模块协作完成
- **浏览器存储**：
  - `localStorage`：保存 API Key、URL、用户设置
  - `IndexedDB`：保存分镜、历史记录、任务数据
- **第三方前端库**：
  - `JSZip`：通过 CDN 引入，用于批量下载和 ZIP 打包

### 2. 后端与本地服务

- **Node.js**：用于运行本地代理服务 `proxy-server.js`
- **Node 原生模块**：
  - `http` / `https`：转发 API 请求
  - `fs` / `path`：读写本地文件与路径处理
  - `child_process`：调用 Upscayl 可执行程序
- **Express.js**：`upscayl-api/server.js` 中用于提供图片放大 API
- **Multer**：处理图片上传
- **CORS**：解决跨域访问
- **UUID**：用于任务或文件唯一标识

### 3. AI 与多媒体能力

- **Google Gemini 多模态模型**：用于分析参考图并生成分镜描述
- **OpenAI 兼容接口**：用于接入文生图、图生视频等模型
- **视频模型接入**：
  - Sora 2 / Sora 2 Pro
  - Veo 3.1 / Veo 3.1 Pro
  - Veo 3.1 Components
- **Upscayl**：本地图片超分辨率放大引擎，支持多种 4x 模型

### 4. 前端架构特点

- **单页应用形态（SPA）**：页面入口集中在一个 HTML 中，交互逻辑由多个 JS 文件组织
- **按功能拆分模块**：
  - `js/api.js`：API 请求与代理检测
  - `js/main.js`：初始化入口
  - `js/image-generation.js`：AI 文生图
  - `js/task-queue.js`：任务队列
  - `js/split/`：九宫格拆分与下载
  - `js/video/`：视频分镜与视频生成
- **无前端框架、无构建步骤**：适合直接双击 HTML 启动，也便于本地快速部署

### 5. 工程特点总结

这个项目的技术选型重点是：

1. **尽量降低使用门槛**：前端无需编译，直接打开 HTML 即可运行  
2. **用本地代理解决网络与跨域问题**：提高 API 兼容性  
3. **把 AI 能力拆成多个业务模块**：分镜、文生图、拆图、放大、视频生成彼此独立  
4. **兼顾桌面本地工作流**：尤其适合需要本地放大、批处理和断点续传的创作场景

## 📁 项目结构

```
├── storyboard-generator-modular.html  # 主页面
├── proxy-server.js                     # 本地代理服务器
├── 启动代理服务器.bat                   # 一键启动脚本
├── css/                                # 样式文件
├── js/                                 # JavaScript模块
│   ├── split/                          # 图片拆分模块
│   └── video/                          # 视频生成模块
├── upscayl-api/                        # AI放大服务
│   ├── server.js
│   ├── bin/                            # 放大引擎
│   └── models/                         # 放大模型
└── docs/                               # 文档
```

## 🔧 AI放大功能

内置 Upscayl 超分辨率引擎，支持多种模型：

| 模型 | 特点 |
|-----|------|
| upscayl-standard-4x | 通用标准 |
| upscayl-lite-4x | 轻量快速 |
| ultrasharp-4x | 超清晰 |
| high-fidelity-4x | 高保真 |
| digital-art-4x | 动漫/插画优化 |

## 💡 使用技巧

1. **参考图越清晰**，AI分析效果越好
2. **描述词尽量具体**，如"人物缓缓转身，微笑"比"人物动作"效果好
3. **故事模式**建议先填写故事设定，让AI理解上下文
4. **视频生成**耗时较长（1-3分钟/个），可使用批量生成+任务队列

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- [Gemini](https://ai.google.dev/) - 多模态AI分析
- [Upscayl](https://upscayl.org/) - 开源图片放大
- [JSZip](https://stuk.github.io/jszip/) - ZIP文件处理
