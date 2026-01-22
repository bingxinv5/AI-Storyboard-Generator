/**
 * 配置模块 - 全局配置和常量
 * AI分镜提示词生成器
 */

// ==================== 跨域资源访问处理 ====================
// 监听并抑制浏览器的跨域存储警告（这些警告不影响功能）
window.addEventListener('error', function(e) {
    if (e.message && e.message.includes('Tracking Prevention')) {
        e.preventDefault();
        e.stopPropagation();
        return true;
    }
}, true);

// 抑制控制台的跨域存储警告
const originalConsoleError = console.error;
console.error = function(...args) {
    const message = args.join(' ');
    if (message.includes('Tracking Prevention blocked access to storage')) {
        return;
    }
    originalConsoleError.apply(console, args);
};

// ==================== 配置 ====================

// 景别数据 - 从配置文件加载
const shotTypes = {
    zh: getShotTypesZh(),
    en: getShotTypesEn()
};

// 景别描述提示词 - 从配置文件加载
const shotTypePrompts = getShotTypePrompts();

// 智能填充模板
const autoFillTemplates = {
    zh: [
        '角色正面全身立像，展示整体造型',
        '角色面部特写，展现表情细节',
        '角色侧面半身像，展示服装细节',
        '角色背影全景，融入环境氛围',
        '角色动作瞬间，展现动态姿态',
        '角色与环境互动的中景',
        '俯视角度的角色全景',
        '仰视角度突出角色气场',
        '角色剪影效果，逆光氛围'
    ],
    en: [
        'Character front full body standing pose',
        'Character face close-up with expression details',
        'Character side profile half body showing costume',
        'Character back view blending with environment',
        'Character action moment with dynamic pose',
        'Medium shot of character interacting with environment',
        'High angle overhead view of character',
        'Low angle shot emphasizing character presence',
        'Character silhouette with backlit atmosphere'
    ]
};

// 默认景别配置 - 从配置文件加载
const defaultShotTypes = defaultShotTypesOrder;

// 代理服务器配置
const PROXY_SERVER_URL = 'http://localhost:3456';

// 图片处理选项（可配置）
const imageProcessConfig = {
    enableCompression: false,  // 是否启用压缩（默认关闭保持原图质量）
    maxSizeKB: 500,            // 压缩后最大大小
    maxWidth: 1280,            // 最大宽度
    quality: 0.85              // JPEG质量
};

// 保存配置（优化性能）
const SAVE_DEBOUNCE = 2000;  // 防抖延迟 2秒（减少频繁保存）
const SAVE_THROTTLE = 10000; // 节流间隔 10秒（防止频繁保存影响性能）
