/**
 * 图片放大模块
 * 负责 AI 图片放大相关功能
 */

// 切换 AI 放大开关
function toggleUpscale(enabled) {
    upscaleEnabled = enabled;
    const optionsEl = document.getElementById('upscaleOptions');
    if (optionsEl) {
        optionsEl.style.display = enabled ? 'flex' : 'none';
    }
    if (enabled) {
        checkUpscaleApiStatus();
    }
}

// 更新放大配置
function updateUpscaleConfig() {
    const modelEl = document.getElementById('upscaleModel');
    const scaleEl = document.getElementById('upscaleScale');
    if (modelEl) {
        upscaleConfig.model = modelEl.value;
    }
    if (scaleEl) {
        upscaleConfig.scale = parseInt(scaleEl.value, 10);
    }
}

// 检查 Upscayl API 服务状态
async function checkUpscaleApiStatus() {
    const statusEl = document.getElementById('upscaleStatus');
    if (!statusEl) return;
    
    statusEl.textContent = '⏳ 检测中...';
    statusEl.style.color = '#888';
    
    try {
        // 使用 AbortController 实现超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(`${upscaleConfig.apiUrl}/api/health`, {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const data = await response.json();
        if (data.status === 'ok') {
            statusEl.textContent = `✅ 服务可用 (${data.gpu || 'GPU'})`;
            statusEl.style.color = '#4ade80';
        } else {
            throw new Error('服务异常');
        }
    } catch (error) {
        statusEl.textContent = '❌ 服务不可用，请启动 upscayl-api';
        statusEl.style.color = '#f87171';
    }
}

// AI 放大单张图片
async function upscaleImage(base64Data) {
    try {
        const response = await fetch(`${upscaleConfig.apiUrl}/api/upscale/base64`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image: base64Data,
                model: upscaleConfig.model,
                scale: upscaleConfig.scale,
                format: upscaleConfig.format
            })
        });
        
        const result = await response.json();
        if (result.status === 'success') {
            return result.data.image;
        } else {
            throw new Error(result.error || '放大失败');
        }
    } catch (error) {
        console.error('AI 放大失败:', error);
        throw error;
    }
}

// 批量放大图片
async function upscaleImages(images, onProgress) {
    const results = [];
    for (let i = 0; i < images.length; i++) {
        if (onProgress) {
            onProgress(i + 1, images.length);
        }
        try {
            const upscaled = await upscaleImage(images[i]);
            results.push(upscaled);
        } catch (error) {
            console.error(`图片 ${i + 1} 放大失败:`, error);
            // 放大失败时使用原图
            results.push(images[i]);
        }
    }
    return results;
}
