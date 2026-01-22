/**
 * 视频分镜管理模块
 * 负责分镜的增删改查、同步等操作
 */

// 初始化视频分镜
function initVideoShots() {
    const layout = document.getElementById('gridLayout').value;
    const [cols, rows] = layout.split('x').map(Number);
    const shotCount = cols * rows;
    
    const countEl = document.getElementById('videoShotCount');
    if (countEl) {
        countEl.textContent = shotCount;
    }
    
    if (videoShots.length === shotCount) {
        renderVideoShots();
        return;
    }
    
    const newShots = [];
    for (let i = 0; i < shotCount; i++) {
        if (videoShots[i]) {
            newShots.push(videoShots[i]);
        } else {
            newShots.push({
                id: Date.now() + i,
                refImage: null,
                prompt: '',
                status: 'pending',
                videoUrl: null,
                error: null
            });
        }
    }
    
    videoShots = newShots;
    renderVideoShots();
}

// 添加新分镜
function addVideoShot() {
    videoShots.push({
        id: Date.now(),
        refImage: null,
        prompt: '',
        status: 'pending',
        videoUrl: null,
        error: null
    });
    updateVideoShotCount();
    renderVideoShots();
    showToast(`已添加分镜 ${videoShots.length}`, 'success');
}

// 在指定位置前插入分镜
function insertVideoShotBefore(index) {
    const newShot = {
        id: Date.now(),
        refImage: null,
        prompt: '',
        status: 'pending',
        videoUrl: null,
        error: null
    };
    videoShots.splice(index, 0, newShot);
    updateVideoShotCount();
    renderVideoShots();
    showToast(`已在分镜 ${index + 1} 前插入新分镜`, 'success');
}

// 在指定位置后插入分镜
function insertVideoShotAfter(index) {
    const newShot = {
        id: Date.now(),
        refImage: null,
        prompt: '',
        status: 'pending',
        videoUrl: null,
        error: null
    };
    videoShots.splice(index + 1, 0, newShot);
    updateVideoShotCount();
    renderVideoShots();
    showToast(`已在分镜 ${index + 1} 后插入新分镜`, 'success');
}

// 删除指定分镜
function deleteVideoShot(index) {
    if (videoShots.length <= 1) {
        showToast('至少需要保留1个分镜', 'warning');
        return;
    }
    const shotNum = index + 1;
    videoShots.splice(index, 1);
    updateVideoShotCount();
    renderVideoShots();
    showToast(`已删除分镜 ${shotNum}`, 'info');
}

// 移除最后一个分镜
function removeVideoShot() {
    if (videoShots.length <= 1) {
        showToast('至少需要保留1个分镜', 'warning');
        return;
    }
    videoShots.pop();
    updateVideoShotCount();
    renderVideoShots();
    showToast(`已删除分镜 ${videoShots.length + 1}`, 'info');
}

// 设置分镜数量
function setVideoShotCount(count) {
    if (count < 1) count = 1;
    if (count > 36) count = 36;
    
    const currentCount = videoShots.length;
    
    if (count > currentCount) {
        for (let i = currentCount; i < count; i++) {
            videoShots.push({
                id: Date.now() + i,
                refImage: null,
                refImages: [],
                firstFrame: null,
                lastFrame: null,
                prompt: '',
                status: 'pending',
                videoUrl: null,
                error: null
            });
        }
    } else if (count < currentCount) {
        videoShots = videoShots.slice(0, count);
    }
    
    updateVideoShotCount();
    renderVideoShots();
    showToast(`已设置为 ${count} 个分镜`, 'success');
}

// 同步分镜到网格布局
function syncVideoShotsToGrid() {
    const layout = document.getElementById('gridLayout').value;
    const [cols, rows] = layout.split('x').map(Number);
    const targetCount = cols * rows;
    
    setVideoShotCount(targetCount);
    showToast(`已同步为网格布局 ${layout} (${targetCount}个分镜)`, 'success');
}

// 更新分镜数量显示
function updateVideoShotCount() {
    const countEl = document.getElementById('videoShotCount');
    if (countEl) {
        countEl.textContent = videoShots.length;
    }
}

// 更新分镜提示词
function updateVideoShotPrompt(index, prompt) {
    videoShots[index].prompt = prompt;
}

// 上传分镜图片
function uploadVideoShotImage(index, slot = 0) {
    currentVideoShotIndex = index;
    const input = document.getElementById('videoShotImageInput');
    const savedSlot = slot;
    
    input.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            const imageData = event.target.result;
            const shot = videoShots[currentVideoShotIndex];
            
            // 生成缩略图用于快速显示
            const thumbnail = await generateVideoThumbnail(imageData, 150);
            
            // 根据 slot 设置对应的图片（同时保存原图和缩略图）
            if (savedSlot === 'first') {
                shot.firstFrame = imageData;
                shot.firstFrameThumb = thumbnail;
            } else if (savedSlot === 'last') {
                shot.lastFrame = imageData;
                shot.lastFrameThumb = thumbnail;
            } else {
                // 数字索引 - 参考图数组
                const slotIndex = typeof savedSlot === 'number' ? savedSlot : parseInt(savedSlot);
                if (!shot.refImages) shot.refImages = [];
                if (!shot.refImageThumbs) shot.refImageThumbs = [];
                while (shot.refImages.length <= slotIndex) {
                    shot.refImages.push(null);
                    shot.refImageThumbs.push(null);
                }
                shot.refImages[slotIndex] = imageData;
                shot.refImageThumbs[slotIndex] = thumbnail;
            }
            
            renderVideoShots();
            
            const slotLabels = { 'first': '首帧', 'last': '尾帧' };
            const label = slotLabels[savedSlot] || `参考图${(typeof savedSlot === 'number' ? savedSlot : parseInt(savedSlot)) + 1}`;
            showToast(`分镜 ${currentVideoShotIndex + 1} ${label}已添加`, 'success');
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };
    input.click();
}

// 清除分镜指定槽位的图片
function clearVideoShotImage(index, slot = 0) {
    const shot = videoShots[index];
    
    // 根据 slot 清除对应的图片
    if (slot === 'first') {
        shot.firstFrame = null;
        shot.firstFrameThumb = null;
    } else if (slot === 'last') {
        shot.lastFrame = null;
        shot.lastFrameThumb = null;
    } else {
        // 数字索引 - 参考图数组
        const slotIndex = typeof slot === 'number' ? slot : parseInt(slot);
        if (shot.refImages && shot.refImages[slotIndex] !== undefined) {
            shot.refImages[slotIndex] = null;
        }
        if (shot.refImageThumbs && shot.refImageThumbs[slotIndex] !== undefined) {
            shot.refImageThumbs[slotIndex] = null;
        }
    }
    
    renderVideoShots();
}

// 清除分镜所有图片
function clearVideoShotImages(index) {
    const shot = videoShots[index];
    shot.firstFrame = null;
    shot.firstFrameThumb = null;
    shot.lastFrame = null;
    shot.lastFrameThumb = null;
    shot.refImages = [];
    shot.refImageThumbs = [];
    renderVideoShots();
    showToast(`分镜 ${index + 1} 的所有图片已清除`, 'success');
}

// 清除所有分镜数据
function clearAllVideoShots() {
    console.log('clearAllVideoShots 被调用');
    if (!confirm('确定要清除所有视频分镜数据吗？')) {
        console.log('用户取消了清空操作');
        return;
    }
    
    console.log('开始清空分镜数据，当前分镜数:', videoShots.length);
    
    videoShots = videoShots.map(shot => ({
        ...shot,
        firstFrame: null,
        firstFrameThumb: null,
        lastFrame: null,
        lastFrameThumb: null,
        refImages: [],
        refImageThumbs: [],
        prompt: '',
        status: 'pending',
        videoUrl: null,
        error: null
    }));
    
    console.log('分镜数据已清空，准备重新渲染');
    
    // 直接调用 DOM 更新，不使用防抖
    renderVideoShotsDOM();
    autoSave();
    showToast('已清除所有分镜数据', 'info');
}

// 从分镜导入提示词
function useShotsForVideo() {
    const { total } = getGridInfo();
    
    let importCount = 0;
    
    for (let i = 1; i <= total && i <= videoShots.length; i++) {
        const shotTypeEl = document.getElementById(`shotType${i}`);
        const shotDescEl = document.getElementById(`shotDesc${i}`);
        
        if (shotTypeEl && shotDescEl) {
            const shotType = shotTypeEl.value;
            const shotDesc = shotDescEl.value.trim();
            
            if (shotDesc) {
                const typeLabel = shotTypes.zh[shotType] || shotType;
                videoShots[i - 1].prompt = `${typeLabel}，${shotDesc}`;
                importCount++;
            }
        }
    }
    
    renderVideoShots();
    
    if (importCount > 0) {
        showToast(`已从分镜导入 ${importCount} 个镜头提示词`, 'success');
    } else {
        showToast('未找到可导入的分镜描述', 'warning');
    }
}

// 从拆分结果导入图片
function useSplitForVideo() {
    if (splitResults.length === 0) {
        showToast('请先拆分图片', 'warning');
        return;
    }
    
    const imageMode = getVideoModelImageMode();
    const mode = imageMode.mode;
    
    splitResults.forEach((piece, index) => {
        if (index < videoShots.length) {
            const shot = videoShots[index];
            const thumb = piece.thumbnailUrl || piece.dataUrl;
            
            if (mode === 'single' || mode === 'multi') {
                // 统一填充到 refImages[0]
                if (!shot.refImages) {
                    shot.refImages = [];
                    shot.refImageThumbs = [];
                }
                shot.refImages[0] = piece.dataUrl;
                shot.refImageThumbs[0] = thumb;
            } else if (mode === 'frames') {
                // 首尾帧模式：默认填充到首帧
                shot.firstFrame = piece.dataUrl;
                shot.firstFrameThumb = thumb;
            }
        }
    });
    
    renderVideoShots();
    
    let message = `已将 ${Math.min(splitResults.length, videoShots.length)} 张拆分图片导入到视频分镜`;
    if (mode === 'frames') {
        message += '（作为首帧）';
    } else {
        message += '（作为参考图1）';
    }
    showToast(message, 'success');
}

// 下载单个分镜视频
async function downloadVideoShot(index) {
    const shot = videoShots[index];
    if (!shot.videoUrl) {
        showToast('该分镜没有生成的视频', 'warning');
        return;
    }
    
    try {
        // 使用代理 URL 下载（解决 CORS）
        const proxiedUrl = getProxiedVideoUrl(shot.videoUrl);
        const response = await fetch(proxiedUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `分镜${index + 1}_${Date.now()}.mp4`;
        link.click();
        
        URL.revokeObjectURL(url);
        showToast('视频下载中...', 'success');
    } catch (error) {
        // 备用：打开原始 URL
        window.open(shot.videoUrl, '_blank');
        showToast('已在新标签页打开视频', 'info');
    }
}

// 下载所有已完成的分镜视频
async function downloadAllVideoShots() {
    const completedShots = videoShots.filter(s => s.status === 'completed' && s.videoUrl);
    if (completedShots.length === 0) {
        showToast('没有已完成的视频可下载', 'warning');
        return;
    }
    
    showToast(`开始下载 ${completedShots.length} 个视频...`, 'info');
    
    for (let i = 0; i < videoShots.length; i++) {
        if (videoShots[i].status === 'completed' && videoShots[i].videoUrl) {
            await downloadVideoShot(i);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
}
