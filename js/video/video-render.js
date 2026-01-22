/**
 * 视频渲染模块
 * 负责分镜UI渲染、图片预览、提示词编辑器等
 */

// 渲染防抖变量
let renderVideoShotsTimeout = null;
let pendingVideoAutoSave = false;

// 渲染视频分镜（带防抖）
function renderVideoShots(skipAutoSave = false) {
    // 使用防抖避免频繁更新
    if (renderVideoShotsTimeout) {
        cancelAnimationFrame(renderVideoShotsTimeout);
    }
    
    renderVideoShotsTimeout = requestAnimationFrame(() => {
        renderVideoShotsDOM();
        
        // 延迟自动保存
        if (!skipAutoSave && !pendingVideoAutoSave) {
            pendingVideoAutoSave = true;
            setTimeout(() => {
                autoSave();
                pendingVideoAutoSave = false;
            }, 500);
        }
    });
}

// 渲染分镜图片区域
function renderVideoShotImages(shot, index, imageMode) {
    // 重新设计的统一界面
    // 上排：3个参考图 (Sora用第1个, Components用1-3个)
    // 下排：首帧 + 尾帧 (Veo专用)
    
    const refImages = shot.refImages || [];
    const refThumbs = shot.refImageThumbs || [];
    const model = document.getElementById('videoModel')?.value || 'veo3.1';
    
    // 根据模型决定哪些槽位是激活状态
    const isSora = model.startsWith('sora');
    const isVeoFrames = model === 'veo3.1' || model === 'veo3.1-pro';
    const isComponents = model === 'veo3.1-components';
    
    return `
        <div class="video-shot-image-area redesigned">
            <div class="image-row ref-images">
                <div class="row-label">参考图</div>
                <div class="image-slots">
                    ${[0, 1, 2].map(i => {
                        const isActive = isSora ? (i === 0) : isComponents;
                        const img = refImages[i];
                        const thumb = refThumbs[i] || img; // 优先使用缩略图
                        return img ? `
                            <div class="image-slot filled ${isActive ? 'active' : 'inactive'}" 
                                 onclick="uploadVideoShotImage(${index}, ${i})" 
                                 oncontextmenu="showImagePreview(event, ${index}, 'ref_${i}')"
                                 title="参考图${i + 1}${isActive ? '' : ' (当前模型不使用)'}&#10;右键预览原图">
                                <img src="${thumb}" alt="参${i + 1}" loading="lazy" />
                                <span class="slot-label">${i + 1}</span>
                                <button class="clear-btn" onclick="event.stopPropagation(); clearVideoShotImage(${index}, ${i})">✕</button>
                            </div>
                        ` : `
                            <div class="image-slot empty ${isActive ? 'active' : 'inactive'}" 
                                 onclick="uploadVideoShotImage(${index}, ${i})"
                                 title="点击添加参考图${i + 1}${isActive ? '' : ' (当前模型不使用)'}">
                                <span class="add-icon">+</span>
                                <span class="slot-label">${i + 1}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            <div class="image-row frame-images">
                <div class="row-label">首尾帧</div>
                <div class="image-slots">
                    ${['first', 'last'].map((type, i) => {
                        const isActive = isVeoFrames;
                        const img = type === 'first' ? shot.firstFrame : shot.lastFrame;
                        const thumb = type === 'first' ? (shot.firstFrameThumb || img) : (shot.lastFrameThumb || img);
                        const label = type === 'first' ? '首' : '尾';
                        return img ? `
                            <div class="image-slot filled frame-slot ${isActive ? 'active' : 'inactive'}" 
                                 onclick="uploadVideoShotImage(${index}, '${type}')" 
                                 oncontextmenu="showImagePreview(event, ${index}, '${type}')"
                                 title="${label}帧${isActive ? '' : ' (当前模型不使用)'}&#10;右键预览原图">
                                <img src="${thumb}" alt="${label}帧" loading="lazy" />
                                <span class="slot-label">${label}</span>
                                <button class="clear-btn" onclick="event.stopPropagation(); clearVideoShotImage(${index}, '${type}')">✕</button>
                            </div>
                        ` : `
                            <div class="image-slot empty frame-slot ${isActive ? 'active' : 'inactive'}" 
                                 onclick="uploadVideoShotImage(${index}, '${type}')"
                                 title="点击添加${label}帧${isActive ? '' : ' (当前模型不使用)'}">
                                <span class="add-icon">+</span>
                                <span class="slot-label">${label}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}

// 渲染分镜DOM
function renderVideoShotsDOM() {
    const container = document.getElementById('videoShotsContainer');
    if (!container) return;
    
    const count = videoShots.length;
    let cols;
    // 根据分镜数量自动调整列数
    if (count <= 2) cols = 2;
    else if (count <= 4) cols = 2;
    else if (count <= 6) cols = 3;
    else if (count <= 9) cols = 3;
    else if (count <= 12) cols = 3;
    else if (count <= 16) cols = 4;
    else cols = 4;
    
    // 新布局需要更大的卡片宽度
    container.style.gridTemplateColumns = `repeat(${cols}, minmax(320px, 1fr))`;
    updateVideoShotCount();
    
    if (videoShots.length === 0) {
        container.innerHTML = '<div class="video-shots-empty">暂无视频分镜，点击 ➕ 添加</div>';
        return;
    }
    
    const imageMode = getVideoModelImageMode();
    
    container.innerHTML = videoShots.map((shot, index) => `
        <div class="video-shot-item ${shot.status}" id="videoShot_${index}">
            <div class="video-shot-header">
                <span class="video-shot-number">分镜 ${index + 1}</span>
                <div class="shot-header-actions">
                    <button class="shot-action-btn" onclick="insertVideoShotBefore(${index})" title="在此前插入分镜">↑</button>
                    <button class="shot-action-btn" onclick="insertVideoShotAfter(${index})" title="在此后插入分镜">↓</button>
                    <button class="shot-action-btn delete" onclick="deleteVideoShot(${index})" title="删除此分镜">✕</button>
                    <span class="video-shot-status ${shot.status}">
                        ${shot.status === 'pending' ? '待生成' : 
                          shot.status === 'queued' ? '队列中' :
                          shot.status === 'generating' ? (shot.taskId ? '恢复中...' : '生成中...') : 
                          shot.status === 'completed' ? '✓ 完成' : 
                          shot.status === 'error' ? '✗ 失败' : ''}
                    </span>
                </div>
            </div>
            <div class="video-shot-content">
                <div class="video-shot-content-row">
                    ${renderVideoShotImages(shot, index, imageMode)}
                    <div class="video-shot-details">
                        <textarea class="video-prompt-input" placeholder="输入提示词描述这个分镜的动作和场景..." 
                                  onchange="updateVideoShotPrompt(${index}, this.value)"
                                  onclick="event.stopPropagation()">${shot.prompt || ''}</textarea>
                    </div>
                </div>
                <div class="video-shot-actions">
                    <button class="btn btn-info btn-sm" onclick="openPromptEditor(${index})" title="大窗口编辑提示词">
                        ✏️ 编辑
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="generateSingleVideoShot(${index})" 
                            ${shot.status === 'generating' ? 'disabled' : ''}>
                        🎬 生成
                    </button>
                    ${shot.status === 'generating' ? `
                        <button class="btn btn-warning btn-sm" onclick="cancelVideoGeneration(${index})">
                            🛑
                        </button>
                    ` : ''}
                    ${hasAnyImages(shot) ? `
                        <button class="btn btn-danger btn-sm" onclick="clearVideoShotImages(${index})" title="清除所有图片">
                            🗑️
                        </button>
                    ` : ''}
                    ${shot.videoUrl ? `
                        <button class="btn btn-success btn-sm" onclick="downloadVideoShot(${index})">
                            📥
                        </button>
                    ` : ''}
                </div>
            </div>
            ${shot.videoUrl ? `
                <div class="video-shot-result">
                    <video controls crossorigin="anonymous" src="${getProxiedVideoUrl(shot.videoUrl)}"></video>
                </div>
            ` : ''}
            ${shot.error ? `
                <div style="color: #eb3349; font-size: 11px; margin-top: 5px;">
                    ❌ ${shot.error}
                </div>
            ` : ''}
        </div>
    `).join('');
    
    if (!document.getElementById('videoShotImageInput')) {
        const input = document.createElement('input');
        input.type = 'file';
        input.id = 'videoShotImageInput';
        input.accept = 'image/*';
        input.style.display = 'none';
        document.body.appendChild(input);
    }
}

// 显示图片预览弹窗
function showImagePreview(event, index, type) {
    event.preventDefault();
    event.stopPropagation();
    
    const shot = videoShots[index];
    let imageSrc = null;
    let title = '';
    
    if (type === 'first') {
        imageSrc = shot.firstFrame;
        title = `分镜 ${index + 1} - 首帧`;
    } else if (type === 'last') {
        imageSrc = shot.lastFrame;
        title = `分镜 ${index + 1} - 尾帧`;
    } else if (type.startsWith('ref_')) {
        const imgIndex = parseInt(type.split('_')[1]);
        imageSrc = shot.refImages?.[imgIndex];
        title = `分镜 ${index + 1} - 参考图 ${imgIndex + 1}`;
    }
    
    if (!imageSrc) {
        showToast('图片不存在', 'warning');
        return;
    }
    
    // 创建预览弹窗
    const modal = document.createElement('div');
    modal.className = 'image-preview-modal';
    modal.id = 'imagePreviewModal';
    modal.onclick = function(e) {
        if (e.target === this) closeImagePreview();
    };
    
    modal.innerHTML = `
        <div class="image-preview-content">
            <div class="image-preview-header">
                <h3>🖼️ ${title}</h3>
                <button class="close-btn" onclick="closeImagePreview()">✕</button>
            </div>
            <div class="image-preview-body">
                <img src="${imageSrc}" alt="${title}" />
            </div>
            <div class="image-preview-footer">
                <button class="btn btn-secondary" onclick="closeImagePreview()">关闭</button>
                <button class="btn btn-primary" onclick="downloadPreviewImage('${imageSrc}', '${title}')">📥 下载</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // ESC 关闭
    document.addEventListener('keydown', handlePreviewEsc);
}

// 关闭图片预览
function closeImagePreview() {
    const modal = document.getElementById('imagePreviewModal');
    if (modal) {
        modal.remove();
        document.removeEventListener('keydown', handlePreviewEsc);
    }
}

// ESC键处理
function handlePreviewEsc(e) {
    if (e.key === 'Escape') {
        closeImagePreview();
    }
}

// 下载预览图片
function downloadPreviewImage(imageSrc, title) {
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = `${title.replace(/\s+/g, '_')}.png`;
    link.click();
    showToast('图片已开始下载', 'success');
}

// 打开提示词编辑器
function openPromptEditor(index) {
    const shot = videoShots[index];
    if (!shot) return;
    
    const modal = document.createElement('div');
    modal.className = 'prompt-editor-modal';
    modal.id = 'promptEditorModal';
    modal.onclick = function(e) {
        if (e.target === this) closePromptEditor();
    };
    
    modal.innerHTML = `
        <div class="prompt-editor-content">
            <div class="prompt-editor-header">
                <h3>✏️ 编辑分镜 ${index + 1} 提示词</h3>
                <button class="close-btn" onclick="closePromptEditor()">✕</button>
            </div>
            <div class="prompt-editor-body">
                ${shot.refImages && shot.refImages[0] ? `<img src="${shot.refImages[0]}" class="prompt-editor-preview" alt="参考图">` : ''}
                <textarea id="promptEditorTextarea" placeholder="输入详细的分镜提示词...">${shot.prompt || ''}</textarea>
            </div>
            <div class="prompt-editor-footer">
                <span class="char-count" id="charCount">${(shot.prompt || '').length} 字符</span>
                <div>
                    <button class="btn btn-secondary" onclick="closePromptEditor()">取消</button>
                    <button class="btn btn-primary" onclick="savePromptEditor(${index})">💾 保存</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 添加字符计数
    const textarea = document.getElementById('promptEditorTextarea');
    const charCount = document.getElementById('charCount');
    textarea.addEventListener('input', () => {
        charCount.textContent = `${textarea.value.length} 字符`;
    });
    
    // 聚焦到输入框
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }, 100);
    
    // ESC关闭
    modal._escHandler = function(e) {
        if (e.key === 'Escape') closePromptEditor();
    };
    document.addEventListener('keydown', modal._escHandler);
}

// 关闭提示词编辑器
function closePromptEditor() {
    const modal = document.getElementById('promptEditorModal');
    if (modal) {
        if (modal._escHandler) {
            document.removeEventListener('keydown', modal._escHandler);
        }
        modal.remove();
    }
}

// 保存提示词编辑器
function savePromptEditor(index) {
    const textarea = document.getElementById('promptEditorTextarea');
    if (textarea && videoShots[index]) {
        videoShots[index].prompt = textarea.value;
        renderVideoShots();
        showToast(`分镜 ${index + 1} 提示词已保存`, 'success');
    }
    closePromptEditor();
}
