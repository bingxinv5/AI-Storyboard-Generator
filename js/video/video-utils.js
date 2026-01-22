/**
 * 视频工具模块
 * 负责缩略图生成、代理URL、模型配置等辅助功能
 */

// 生成缩略图（用于快速显示，避免高分辨率图片导致卡顿）
function generateVideoThumbnail(dataUrl, maxSize = 150) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
            const width = Math.round(img.width * scale);
            const height = Math.round(img.height * scale);
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => resolve(dataUrl); // 失败时返回原图
        img.src = dataUrl;
    });
}

// 将视频 URL 转换为代理 URL（解决 CORS 问题）
function getProxiedVideoUrl(videoUrl) {
    if (!videoUrl) return videoUrl;
    
    // 如果是 filesystem.site 的视频，通过本地代理访问
    if (videoUrl.includes('filesystem.site')) {
        // https://filesystem.site/cdn/xxx/xxx.mp4 → http://localhost:3456/video-proxy/cdn/xxx/xxx.mp4
        const path = videoUrl.replace('https://filesystem.site/', '');
        return `http://localhost:3456/video-proxy/${path}`;
    }
    
    // 其他 URL 保持原样
    return videoUrl;
}

// 更新视频模型提示信息
function updateVideoModelTip() {
    try {
        const model = document.getElementById('videoModel')?.value;
        const tip = document.getElementById('videoModelTip');
        const durationSelect = document.getElementById('videoDuration');
        const hdLabel = document.getElementById('videoHdLabel');
        const watermarkLabel = document.getElementById('videoWatermarkLabel');
        
        if (!model) return;
        
        const tips = {
            'veo3.1': '⬆️ 支持1-2张参考图（首帧/尾帧），或纯文生视频，自动配音',
            'veo3.1-pro': '⬆️ 高质量视频，支持1-2张参考图（首帧/尾帧）',
            'veo3.1-components': '⬆️ 支持1-3张参考图组合生成，创意组合',
            'sora-2': '⬆️ 支持1张参考图生视频，10/15秒时长',
            'sora-2-pro': '⬆️ 支持1张参考图，高清(HD)和长时长(最长25秒)'
        };
        
        if (tip) {
            tip.textContent = tips[model] || '请选择视频模型';
        }
        
        if (model === 'sora-2-pro') {
            if (durationSelect) {
                durationSelect.style.display = 'inline-block';
                durationSelect.innerHTML = `
                    <option value="10">10秒</option>
                    <option value="15">15秒</option>
                    <option value="25">25秒</option>
                `;
            }
            if (hdLabel) hdLabel.style.display = 'flex';
            if (watermarkLabel) watermarkLabel.style.display = 'flex';
        } else if (model === 'sora-2') {
            if (durationSelect) {
                durationSelect.style.display = 'inline-block';
                durationSelect.innerHTML = `
                    <option value="10">10秒</option>
                    <option value="15">15秒</option>
                `;
            }
            if (hdLabel) hdLabel.style.display = 'none';
            if (watermarkLabel) watermarkLabel.style.display = 'flex';
        } else {
            if (durationSelect) durationSelect.style.display = 'none';
            if (hdLabel) hdLabel.style.display = 'none';
            if (watermarkLabel) watermarkLabel.style.display = 'none';
        }
    } catch (error) {
        console.error('updateVideoModelTip 错误:', error);
    }
}

// 模型切换时的处理
function onVideoModelChange() {
    updateVideoModelTip();
    // 重新渲染以更新激活状态高亮
    renderVideoShots(true); // true = 跳过自动保存
    autoSave();
}

// 获取当前模型的图片模式配置
function getVideoModelImageMode() {
    const model = document.getElementById('videoModel')?.value || 'veo3.1';
    
    switch (model) {
        case 'sora-2':
        case 'sora-2-pro':
            return {
                mode: 'single',
                maxImages: 1,
                description: '参考图 (可选，最多1张)',
                supportsFirstFrame: false,
                supportsLastFrame: false
            };
        case 'veo3.1':
        case 'veo3.1-pro':
            return {
                mode: 'frames',
                maxImages: 2,
                description: '首帧/尾帧 (可选)',
                supportsFirstFrame: true,
                supportsLastFrame: true
            };
        case 'veo3.1-components':
            return {
                mode: 'multi',
                maxImages: 3,
                description: '参考图 (1-3张)',
                supportsFirstFrame: false,
                supportsLastFrame: false
            };
        default:
            return {
                mode: 'single',
                maxImages: 1,
                description: '参考图 (可选)',
                supportsFirstFrame: false,
                supportsLastFrame: false
            };
    }
}

// 检查分镜是否有任何图片
function hasAnyImages(shot) {
    if (shot.firstFrame || shot.lastFrame) return true;
    if (shot.refImages && shot.refImages.some(img => img !== null && img !== undefined)) return true;
    return false;
}

// 复制视频URL到剪贴板
function copyVideoUrl(videoUrl) {
    navigator.clipboard.writeText(videoUrl).then(() => {
        showToast('视频链接已复制到剪贴板', 'success');
    }).catch(() => {
        const input = document.createElement('input');
        input.value = videoUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast('视频链接已复制', 'success');
    });
}

// 全屏播放历史视频
function playVideoFromHistory(videoUrl) {
    // 使用代理 URL 播放
    const proxiedUrl = getProxiedVideoUrl(videoUrl);
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        cursor: pointer;
    `;
    
    modal.innerHTML = `
        <div style="position: relative; max-width: 90%; max-height: 90%;">
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="position: absolute; top: -40px; right: 0; background: white; border: none; 
                           border-radius: 50%; width: 36px; height: 36px; cursor: pointer; font-size: 20px;
                           box-shadow: 0 2px 8px rgba(0,0,0,0.3);">✕</button>
            <video controls autoplay crossorigin="anonymous" style="max-width: 100%; max-height: 80vh; border-radius: 12px;">
                <source src="${proxiedUrl}" type="video/mp4">
                您的浏览器不支持视频播放
            </video>
        </div>
    `;
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    document.body.appendChild(modal);
}

// 下载已生成的视频
async function downloadGeneratedVideo() {
    if (!generatedVideoUrl) {
        showToast('没有可下载的视频', 'warning');
        return;
    }
    
    try {
        // 使用代理 URL 下载（解决 CORS）
        const proxiedUrl = getProxiedVideoUrl(generatedVideoUrl);
        const response = await fetch(proxiedUrl, {
            mode: 'cors',
            credentials: 'omit'
        });
        
        if (!response.ok) {
            throw new Error('下载失败');
        }
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `AI视频_${Date.now()}.mp4`;
        link.click();
        
        URL.revokeObjectURL(url);
        showToast('视频下载中...', 'success');
    } catch (error) {
        window.open(generatedVideoUrl, '_blank');
        showToast('已在新标签页打开视频，请右键保存', 'info');
    }
}

// 从历史记录下载视频
function downloadVideoFromHistory(videoUrl) {
    generatedVideoUrl = videoUrl;
    downloadGeneratedVideo();
}
