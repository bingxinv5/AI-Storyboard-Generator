/**
 * 状态管理模块 - 全局状态变量
 * AI分镜提示词生成器
 */

// ==================== 状态 ====================
let refImages = []; // 保留兼容，但主要使用 refGroups
let refGroups = []; // 分镜参考组，每个组包含多张图片 [{id, images: [], desc: '', analyzed: false}]
let currentLang = 'zh';
let generatedPrompt = { zh: '', en: '' };
let apiConnected = false;
let generatedImageUrl = null; // 存储生成的图片URL
let imageGenRefImages = []; // AI文生图专用的参考图列表
let currentEditingImageIndex = -1; // 当前正在编辑镜头的图片索引
let processingImages = {}; // 追踪正在处理的图片 { imageId: { type: 'shots'|'image', text: '...' } }
let currentMode = 'shot'; // 当前模式: 'shot' = 分镜模式, 'story' = 故事模式

// 独立生成的图片（不关联参考图）
let standaloneGeneratedImages = []; // [{url, timestamp, aspectRatio, imageSize, layout}]

// AI图片生成取消控制器
let imageGenerationControllers = {};

// 画廊状态（用于图片切换）
let galleryImages = []; // 当前画廊的所有图片
let galleryCurrentIndex = 0; // 当前查看的图片索引

// 代理服务器状态
let proxyServerAvailable = null;
let forceProxyEnabled = false;
let proxyWarningShown = false;

// 九宫格拆分状态
let splitSourceImage = null;
let splitSourceImages = []; // 多图拆分：源图片列表 [{dataUrl, name}]
let splitResults = [];
let selectedSplitItems = new Set();

// AI 图片放大状态
let upscaleEnabled = false; // 是否启用 AI 放大
let upscaleConfig = {
    apiUrl: 'http://localhost:3456',  // 统一使用代理服务器端口
    model: 'upscayl-standard-4x',
    scale: 4,
    format: 'png'
};

// 下载设置
let downloadConfig = {
    prefix: '', // 下载文件名前缀
    useTimestamp: true // 是否添加时间戳
};

// 下载目录句柄（File System Access API）
let downloadDirectoryHandle = null;

// 视频分镜状态
let videoShots = [];
let videoGenerationHistory = [];
let currentVideoShotIndex = -1;
let videoGenerationControllers = {};
let generatedVideoUrl = null;

// 正在执行的视频任务（用于刷新后恢复）
// { shotIndex: { taskId, prompt, model, startTime } }
let pendingVideoTasks = {};

// 保存状态追踪
let saveStatus = {
    pending: false,
    lastSaveTime: 0,
    lastSaveSuccess: true,
    saveCount: 0,
    failCount: 0
};

let saveTimeout = null;
let lastSaveTime = 0;
