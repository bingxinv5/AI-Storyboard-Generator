/**
 * 景别配置文件
 * 
 * 如需添加新的景别，只需在对应分类中添加新条目即可。
 * 格式：
 *   'CODE': {
 *       zh: '中文名称（英文名）',
 *       en: 'English Name',
 *       desc: '景别描述提示词，用于AI生成'
 *   }
 * 
 * 最后更新：2026-01-16
 */

const ShotTypesConfig = {
    // ==================== 景别距离类 ====================
    distance: {
        'EWS': {
            zh: '极远景（Extreme Wide Shot）',
            en: 'Extreme Wide Shot / Establishing Shot',
            desc: '极远景，定场镜头，广阔景观，主体非常小，展示宏大环境'
        },
        'WS': {
            zh: '远景（Wide Shot）',
            en: 'Wide Shot / Long Shot',
            desc: '远景，全身入镜，长镜头，展示人物与环境关系'
        },
        'FS': {
            zh: '全镜头（Full Shot）',
            en: 'Full Shot / Full Body',
            desc: '全镜头，全身可见，从头到脚完整呈现，展示人物完整姿态'
        },
        'MLS': {
            zh: '中远景/美式镜头（Medium Long Shot）',
            en: 'Medium Long Shot / American Shot',
            desc: '中远景，从膝盖以上取景，美式镜头，三分之二身镜头'
        },
        'MS': {
            zh: '中景镜头（Medium Shot）',
            en: 'Medium Shot / Waist Shot',
            desc: '中景，腰部以上，半身镜头，展示人物上半身动作'
        },
        'MCU': {
            zh: '中近景镜头（Medium Close-Up）',
            en: 'Medium Close-Up Shot',
            desc: '中近景，胸部以上，包含头部与肩膀，适合对话场景'
        },
        'CU': {
            zh: '近景镜头（Close-Up）',
            en: 'Close-Up Shot',
            desc: '近景，脸部特写，紧凑构图，突出人物表情'
        },
        'ECU': {
            zh: '大特写镜头（Extreme Close-Up）',
            en: 'Extreme Close-Up Shot',
            desc: '大特写，眼部微距，细节特写，聚焦面部表情细节'
        },
        'MACRO': {
            zh: '微距镜头（Macro Shot）',
            en: 'Macro Shot / Micro Photography',
            desc: '微距摄影，显微视角，高度细节纹理，100mm微距镜头效果'
        },
        // 兼容旧版
        'LS': {
            zh: '全景镜头（Long Shot）',
            en: 'Long Shot / Full Shot',
            desc: '全景，展示人物全身，包含部分环境'
        },
        'VLS': {
            zh: '远景镜头（Very Long Shot）',
            en: 'Very Long Shot',
            desc: '远景，人物较小，环境占主导，建立空间感'
        },
        'ELS': {
            zh: '大远景镜头（Extreme Long Shot）',
            en: 'Extreme Long Shot / Establishing Shot',
            desc: '大远景，展示宏大场景，人物很小或不可见'
        }
    },

    // ==================== 拍摄角度类 ====================
    angle: {
        'EYE': {
            zh: '平视角度（Eye Level）',
            en: 'Eye Level Shot',
            desc: '平视镜头，中性角度，正面直拍，相机位于眼睛高度'
        },
        'LOW': {
            zh: '低角度/仰拍（Low Angle）',
            en: 'Low Angle Shot / Hero Shot',
            desc: '低角度仰拍，威严感视角，英雄视角，增强人物气势'
        },
        'HIGH': {
            zh: '高角度/俯拍（High Angle）',
            en: 'High Angle Shot',
            desc: '高角度俯拍，弱势视角，主体向上看，显示人物渺小'
        },
        'WORM': {
            zh: '虫眼视角（Worm\'s Eye View）',
            en: 'Worm\'s Eye View / Ground Level',
            desc: '虫眼视角，地面水平，垂直向上看，蚂蚁视角'
        },
        'BIRD': {
            zh: '鸟瞰/顶视图（Bird\'s Eye View）',
            en: 'Bird\'s Eye View / Overhead Shot',
            desc: '鸟瞰视角，顶视图，垂直俯拍，90度角'
        },
        'GOD': {
            zh: '上帝视角（God\'s Eye View）',
            en: 'God\'s Eye View / Satellite View',
            desc: '上帝视角，卫星视角，高空垂直拍摄，正上方视角'
        },
        'DUTCH': {
            zh: '荷兰角/倾斜镜头（Dutch Angle）',
            en: 'Dutch Angle / Canted Angle',
            desc: '荷兰角倾斜构图，地平线歪斜，对角线镜头，营造迷失感'
        }
    },

    // ==================== 特殊视角类 ====================
    special: {
        'POV': {
            zh: '主观视角（Point of View）',
            en: 'Point of View Shot',
            desc: 'POV第一人称视角，透过角色眼睛观看，可见双手'
        },
        'OTS': {
            zh: '过肩镜头（Over-the-Shoulder）',
            en: 'Over-the-Shoulder Shot',
            desc: '过肩镜头，从肩膀后方拍摄，前景肩膀模糊'
        },
        'TWO': {
            zh: '双人镜头（Two-Shot）',
            en: 'Two-Shot / Two Person Frame',
            desc: '双人镜头，画面中包含两个主体，中景，并排站位'
        },
        'FISHEYE': {
            zh: '鱼眼视角（Fisheye View）',
            en: 'Fisheye View / Ultra Wide',
            desc: '鱼眼镜头，桶形畸变，超广角180度，暗角效果'
        },
        'ISO': {
            zh: '等距视角（Isometric View）',
            en: 'Isometric View / Orthographic',
            desc: '等距视角，正交投影，3D渲染感，微缩模型感'
        },
        'TELE': {
            zh: '长焦压缩（Telephoto）',
            en: 'Telephoto / Compression Shot',
            desc: '长焦镜头，长焦距，背景压缩，扁平化透视'
        },
        'SELFIE': {
            zh: '自拍视角（Selfie View）',
            en: 'Selfie View / Front Camera',
            desc: '自拍角度，手臂长度距离，前置摄像头，手机镜头畸变'
        },
        'DRONE': {
            zh: '无人机视角（Drone View）',
            en: 'Drone View / Aerial Hover',
            desc: '无人机视角，航拍，悬停拍摄，高空拍摄'
        },
        'CCTV': {
            zh: '监控摄像头视角（CCTV）',
            en: 'CCTV / Security Camera View',
            desc: '监控录像，安防摄像头视角，颗粒感，高角度角落'
        },
        'GOPRO': {
            zh: '运动相机视角（GoPro）',
            en: 'GoPro / Action Camera View',
            desc: 'GoPro运动相机，随身摄像机，广角，桶形畸变'
        }
    },

    // ==================== 运动镜头类 ====================
    motion: {
        'AERIAL': {
            zh: '航拍镜头（Aerial Shot）',
            en: 'Aerial Shot / Bird\'s Eye View',
            desc: '航拍鸟瞰视角，展示地形全貌'
        },
        'TRACKING': {
            zh: '跟踪镜头（Tracking Shot）',
            en: 'Tracking Shot / Follow Shot',
            desc: '跟踪运动镜头，跟随人物或物体移动'
        }
    }
};

// ==================== 默认景别配置 ====================
// 用于新建分镜时的默认景别顺序（镜头01-09）
const defaultShotTypesOrder = ['EWS', 'WS', 'FS', 'MLS', 'MS', 'MCU', 'CU', 'ECU', 'POV'];

// ==================== 景别图例配置 ====================
// 用于界面上显示的景别参考图例
const shotTypesLegend = [
    // 景别距离
    { code: 'EWS', label: '极远景 - 定场镜头' },
    { code: 'WS', label: '远景 - 全身入镜' },
    { code: 'FS', label: '全镜头 - 头到脚' },
    { code: 'MLS', label: '中远景 - 膝盖以上' },
    { code: 'MS', label: '中景 - 腰部以上' },
    { code: 'MCU', label: '中近景 - 胸部以上' },
    { code: 'CU', label: '近景 - 脸部特写' },
    { code: 'ECU', label: '大特写 - 眼部微距' },
    { code: 'MACRO', label: '微距 - 细节纹理' },
    // 拍摄角度
    { code: 'EYE', label: '平视 - 眼睛高度' },
    { code: 'LOW', label: '仰拍 - 英雄视角' },
    { code: 'HIGH', label: '俯拍 - 弱势视角' },
    { code: 'WORM', label: '虫眼 - 地面仰视' },
    { code: 'BIRD', label: '鸟瞰 - 顶视图' },
    { code: 'GOD', label: '上帝视角 - 卫星俯拍' },
    { code: 'DUTCH', label: '荷兰角 - 倾斜构图' },
    // 特殊视角
    { code: 'POV', label: '主观 - 第一人称' },
    { code: 'OTS', label: '过肩 - 肩膀后拍' },
    { code: 'TWO', label: '双人镜头 - 两主体' },
    { code: 'FISHEYE', label: '鱼眼 - 超广角' },
    { code: 'ISO', label: '等距 - 正交投影' },
    { code: 'TELE', label: '长焦 - 背景压缩' },
    { code: 'SELFIE', label: '自拍 - 前置摄像' },
    { code: 'DRONE', label: '无人机 - 航拍悬停' },
    { code: 'CCTV', label: '监控 - 安防视角' },
    { code: 'GOPRO', label: '运动相机 - 广角' }
];

// ==================== 工具函数 ====================

/**
 * 获取所有景别的扁平化对象
 * @returns {Object} { CODE: { zh, en, desc }, ... }
 */
function getAllShotTypes() {
    const all = {};
    Object.values(ShotTypesConfig).forEach(category => {
        Object.assign(all, category);
    });
    return all;
}

/**
 * 获取所有有效的景别代码
 * @returns {string[]} ['EWS', 'WS', 'FS', ...]
 */
function getAllShotTypeCodes() {
    return Object.keys(getAllShotTypes());
}

/**
 * 获取中文景别映射
 * @returns {Object} { CODE: '中文名称（英文名）', ... }
 */
function getShotTypesZh() {
    const result = {};
    const all = getAllShotTypes();
    Object.entries(all).forEach(([code, data]) => {
        result[code] = data.zh;
    });
    return result;
}

/**
 * 获取英文景别映射
 * @returns {Object} { CODE: 'English Name', ... }
 */
function getShotTypesEn() {
    const result = {};
    const all = getAllShotTypes();
    Object.entries(all).forEach(([code, data]) => {
        result[code] = data.en;
    });
    return result;
}

/**
 * 获取景别描述提示词映射
 * @returns {Object} { CODE: '描述提示词', ... }
 */
function getShotTypePrompts() {
    const result = {};
    const all = getAllShotTypes();
    Object.entries(all).forEach(([code, data]) => {
        result[code] = data.desc;
    });
    return result;
}

/**
 * 生成用于AI提示词的景别列表文本
 * @returns {string} 格式化的景别列表
 */
function generateShotTypesPromptText() {
    let text = '';
    
    text += '\n景别距离：\n';
    Object.entries(ShotTypesConfig.distance).forEach(([code, data]) => {
        // 只显示主要的景别，跳过兼容旧版的
        if (!['LS', 'VLS', 'ELS'].includes(code)) {
            text += `- ${code}：${data.desc.split('，')[0]}\n`;
        }
    });
    
    text += '\n拍摄角度：\n';
    Object.entries(ShotTypesConfig.angle).forEach(([code, data]) => {
        text += `- ${code}：${data.desc.split('，')[0]}\n`;
    });
    
    text += '\n特殊视角：\n';
    Object.entries(ShotTypesConfig.special).forEach(([code, data]) => {
        text += `- ${code}：${data.desc.split('，')[0]}\n`;
    });
    
    text += '\n运动镜头：\n';
    Object.entries(ShotTypesConfig.motion).forEach(([code, data]) => {
        text += `- ${code}：${data.desc.split('，')[0]}\n`;
    });
    
    return text;
}

/**
 * 生成用于正则匹配的景别代码模式
 * @returns {string} 正则模式字符串，如 'EWS|WS|FS|...'
 */
function getShotTypeRegexPattern() {
    return getAllShotTypeCodes().join('|');
}

/**
 * 验证景别代码是否有效
 * @param {string} code 景别代码
 * @returns {boolean}
 */
function isValidShotType(code) {
    return getAllShotTypeCodes().includes(code?.toUpperCase());
}

/**
 * 获取景别信息
 * @param {string} code 景别代码
 * @returns {Object|null} { zh, en, desc } 或 null
 */
function getShotTypeInfo(code) {
    const all = getAllShotTypes();
    return all[code?.toUpperCase()] || null;
}

// 导出配置（兼容浏览器和模块化环境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ShotTypesConfig,
        defaultShotTypesOrder,
        shotTypesLegend,
        getAllShotTypes,
        getAllShotTypeCodes,
        getShotTypesZh,
        getShotTypesEn,
        getShotTypePrompts,
        generateShotTypesPromptText,
        getShotTypeRegexPattern,
        isValidShotType,
        getShotTypeInfo
    };
}
