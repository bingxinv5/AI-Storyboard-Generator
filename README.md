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
