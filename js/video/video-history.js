/**
 * 视频历史记录模块
 * 负责视频生成历史的管理、展示、导出等
 */

// 添加视频到历史记录
function addVideoToHistory(videoUrl, prompt, model) {
    videoGenerationHistory.unshift({
        id: Date.now(),
        videoUrl: videoUrl,
        prompt: prompt,
        model: model,
        time: new Date().toLocaleString()
    });
    
    if (videoGenerationHistory.length > 50) {
        videoGenerationHistory = videoGenerationHistory.slice(0, 50);
    }
    
    updateVideoHistory();
}

// 更新历史记录UI
function updateVideoHistory() {
    const section = document.getElementById('videoHistorySection');
    const list = document.getElementById('videoHistoryList');
    const countEl = document.getElementById('historyCount');
    
    if (videoGenerationHistory.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    
    if (countEl) {
        countEl.textContent = `(${videoGenerationHistory.length}条)`;
    }
    
    list.innerHTML = videoGenerationHistory.map((item, index) => `
        <div class="video-history-item" id="history_${item.id || index}">
            <div class="video-history-thumbnail" onclick="playVideoFromHistory('${item.videoUrl}')" title="点击全屏播放">
                <video src="${getProxiedVideoUrl(item.videoUrl)}" muted crossorigin="anonymous" preload="metadata"></video>
                <div class="video-play-overlay">▶</div>
            </div>
            <div class="video-history-info">
                <div class="title" title="${item.prompt}">${item.prompt.substring(0, 60)}${item.prompt.length > 60 ? '...' : ''}</div>
                <div class="meta">
                    <span class="model-tag">${item.model}</span>
                    <span class="time">${item.time}</span>
                </div>
            </div>
            <div class="video-history-actions">
                <button class="btn btn-sm btn-success" onclick="downloadVideoFromHistory('${item.videoUrl}')" title="下载视频">
                    📥
                </button>
                <button class="btn btn-sm btn-primary" onclick="playVideoFromHistory('${item.videoUrl}')" title="全屏播放">
                    ▶️
                </button>
                <button class="btn btn-sm btn-warning" onclick="copyVideoUrl('${item.videoUrl}')" title="复制链接">
                    🔗
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteVideoHistory(${item.id || index}, ${index})" title="删除此记录">
                    ✕
                </button>
            </div>
        </div>
    `).join('');
}

// 更新历史记录显示（别名）
function updateVideoHistoryDisplay() {
    updateVideoHistory();
}

// 删除单条历史记录
async function deleteVideoHistory(id, index) {
    if (!confirm('确定要删除这条视频记录吗？')) return;
    
    videoGenerationHistory.splice(index, 1);
    updateVideoHistory();
    await autoSave();
    
    showToast('已删除该视频记录', 'success');
}

// 清空所有历史记录
async function clearAllVideoHistory() {
    if (!confirm('确定要清空所有视频生成历史吗？此操作不可恢复！')) return;
    
    videoGenerationHistory = [];
    updateVideoHistory();
    await autoSave();
    
    showToast('已清空所有视频历史', 'success');
}

// 导出历史记录
function exportVideoHistory() {
    if (videoGenerationHistory.length === 0) {
        showToast('没有可导出的历史记录', 'warning');
        return;
    }
    
    const exportData = {
        exportTime: new Date().toLocaleString(),
        count: videoGenerationHistory.length,
        history: videoGenerationHistory.map(item => ({
            prompt: item.prompt,
            model: item.model,
            time: item.time,
            videoUrl: item.videoUrl
        }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `视频生成历史_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    showToast(`已导出 ${videoGenerationHistory.length} 条记录`, 'success');
}
