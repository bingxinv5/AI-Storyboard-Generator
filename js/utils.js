/**
 * 工具函数模块
 * AI分镜提示词生成器
 */

// ==================== DOM 元素获取 ====================
function getDomElements() {
    return {
        uploadArea: document.getElementById('uploadArea'),
        fileInput: document.getElementById('fileInput'),
        refImagesContainer: document.getElementById('refImages'),
        shotsContainer: document.getElementById('shotsContainer'),
        outputSection: document.getElementById('outputSection'),
        outputText: document.getElementById('outputText'),
        toast: document.getElementById('toast'),
        globalLoading: document.getElementById('globalLoading'),
        loadingText: document.getElementById('loadingText')
    };
}

// ==================== 工具函数 ====================
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showLoading(text = 'AI正在分析中...') {
    const loadingText = document.getElementById('loadingText');
    const globalLoading = document.getElementById('globalLoading');
    loadingText.textContent = text;
    globalLoading.classList.add('active');
}

function updateLoadingText(text) {
    const loadingText = document.getElementById('loadingText');
    if (loadingText) {
        loadingText.textContent = text;
    }
}

function hideLoading() {
    const globalLoading = document.getElementById('globalLoading');
    globalLoading.classList.remove('active');
}

// 紧急关闭loading（点击遮罩时触发）
function emergencyCloseLoading(event) {
    const globalLoading = document.getElementById('globalLoading');
    if (event.target === globalLoading || event.target.tagName === 'DIV') {
        hideLoading();
        showToast('已强制关闭加载状态', 'info');
    }
}

function getApiKey() {
    return document.getElementById('apiKey').value.trim();
}

function getModel() {
    return document.getElementById('modelSelect').value;
}

// 代理服务器地址
const PROXY_URL = 'http://localhost:3456';

// 获取 API Base URL（考虑强制代理模式）
function getApiBaseUrl() {
    // 如果强制代理模式开启，必须使用代理地址
    if (typeof forceProxyEnabled !== 'undefined' && forceProxyEnabled) {
        return PROXY_URL + '/v1';
    }
    
    // 如果代理可用，优先使用代理
    if (typeof proxyServerAvailable !== 'undefined' && proxyServerAvailable) {
        return PROXY_URL + '/v1';
    }
    
    // 否则使用输入框中的地址
    const inputUrl = document.getElementById('apiBaseUrl')?.value?.trim();
    return inputUrl || 'https://api.bltcy.ai/v1';
}

// 获取当前网格布局值（如 "3x3", "4x4" 等）
function getCurrentGridLayout() {
    return document.getElementById('gridLayout').value;
}

function getGridInfo() {
    const layout = document.getElementById('gridLayout').value;
    const [rows, cols] = layout.split('x').map(Number);
    return { rows, cols, total: rows * cols, layout };
}

// 切换图片压缩设置
function toggleCompression(enabled) {
    imageProcessConfig.enableCompression = enabled;
    showToast(enabled ? '已开启图片压缩' : '已关闭图片压缩（使用原图）', 'info');
}

// 模式切换
function switchMode(mode) {
    currentMode = mode;
    
    // 更新按钮状态
    document.getElementById('modeShot').classList.toggle('active', mode === 'shot');
    document.getElementById('modeStory').classList.toggle('active', mode === 'story');
    
    // 显示/隐藏故事设置和分镜模式提示
    document.getElementById('storySettings').style.display = mode === 'story' ? 'block' : 'none';
    const shotModeTips = document.getElementById('shotModeTips');
    if (shotModeTips) {
        shotModeTips.style.display = mode === 'shot' ? 'block' : 'none';
    }
    
    // 更新分镜参考区域的提示
    const refGroupTips = document.getElementById('refGroupTips');
    if (refGroupTips) {
        const { total } = getGridInfo();
        if (mode === 'story') {
            refGroupTips.innerHTML = `💡 <strong>故事模式</strong>：上传参考图后，AI将创作完整故事并拆分为 <strong>${total}</strong> 个关键画面`;
        } else {
            refGroupTips.innerHTML = `💡 <strong>分镜模式</strong>：上传参考图后，AI将生成 <strong>${total}</strong> 个不同景别的镜头描述`;
        }
    }
    
    // 更新故事画面数量显示
    if (mode === 'story') {
        const { total } = getGridInfo();
        const frameCountEl = document.getElementById('storyFrameCount');
        if (frameCountEl) frameCountEl.textContent = total;
    }
    
    showToast(mode === 'story' ? '已切换到故事模式' : '已切换到分镜模式', 'info');
}

// 网格布局变化时的回调
function onGridLayoutChange() {
    const { total } = getGridInfo();
    
    // 更新故事画面数量
    const frameCountEl = document.getElementById('storyFrameCount');
    if (frameCountEl) frameCountEl.textContent = total;
    
    // 更新分镜参考区域提示
    const refGroupTips = document.getElementById('refGroupTips');
    if (refGroupTips) {
        if (currentMode === 'story') {
            refGroupTips.innerHTML = `💡 <strong>故事模式</strong>：上传参考图后，AI将创作完整故事并拆分为 <strong>${total}</strong> 个关键画面`;
        } else {
            refGroupTips.innerHTML = `💡 <strong>分镜模式</strong>：上传参考图后，AI将生成 <strong>${total}</strong> 个不同景别的镜头描述`;
        }
    }
    
    // 重新生成分镜设置
    if (typeof generateShotsSettings === 'function') {
        generateShotsSettings();
    }
}

// 监听网格布局变化，更新故事画面数量
function updateStoryFrameCount() {
    const frameCountEl = document.getElementById('storyFrameCount');
    if (frameCountEl) {
        const { total } = getGridInfo();
        frameCountEl.textContent = total;
    }
}

// 更新处理状态显示
function updateProcessingStatus() {
    const statusEl = document.getElementById('processingStatus');
    if (!statusEl) return;
    
    const count = Object.keys(processingImages).length;
    if (count > 0) {
        statusEl.textContent = `⏳ ${count} 张图片处理中...`;
        statusEl.style.color = '#ffc107';
    } else {
        statusEl.textContent = '';
    }
}

// 更新单个图片的加载状态（不重绘整个列表）
function updateImageLoadingState(imageId, text, progress = '', showCancel = false, cancelId = null) {
    const loadingEl = document.getElementById(`imgLoading_${imageId}`);
    const textEl = document.getElementById(`imgLoadingText_${imageId}`);
    const progressEl = document.getElementById(`imgLoadingProgress_${imageId}`);
    const cardEl = document.querySelector(`.ref-image-item[data-id="${imageId}"]`);
    
    if (loadingEl && textEl) {
        if (text) {
            loadingEl.classList.add('active');
            textEl.textContent = text;
            if (progressEl) {
                let cancelBtn = '';
                if (showCancel && cancelId) {
                    cancelBtn = ` <button onclick="cancelImageGeneration('${cancelId}')" class="cancel-gen-btn">🛑 取消</button>`;
                }
                progressEl.innerHTML = progress + cancelBtn;
            }
            if (cardEl) cardEl.classList.add('processing');
        } else {
            loadingEl.classList.remove('active');
            if (cardEl) cardEl.classList.remove('processing');
        }
    }
}

// 更新保存状态指示器
function updateSaveIndicator(status, message = '') {
    const indicator = document.getElementById('saveIndicator');
    if (!indicator) return;
    
    switch(status) {
        case 'saving':
            indicator.style.background = 'rgba(102, 126, 234, 0.9)';
            indicator.textContent = '💾 保存中...';
            indicator.style.opacity = '1';
            break;
        case 'success':
            indicator.style.background = 'rgba(17, 153, 142, 0.9)';
            indicator.textContent = message || '✓ 已保存 ' + new Date().toLocaleTimeString();
            indicator.style.opacity = '1';
            setTimeout(() => { indicator.style.opacity = '0'; }, 2000);
            break;
        case 'error':
            indicator.style.background = 'rgba(235, 51, 73, 0.9)';
            indicator.textContent = message || '✕ 保存失败';
            indicator.style.opacity = '1';
            setTimeout(() => { indicator.style.opacity = '0'; }, 3000);
            break;
        case 'warning':
            indicator.style.background = 'rgba(240, 147, 251, 0.9)';
            indicator.textContent = message;
            indicator.style.opacity = '1';
            setTimeout(() => { indicator.style.opacity = '0'; }, 3000);
            break;
    }
}

// 格式化存储大小
function formatSize(bytes) {
    if (bytes === undefined) return '未知';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

// ==================== 卡片折叠功能 ====================

// 存储折叠状态
const collapsedCards = new Set();

// 切换卡片折叠状态
function toggleCardCollapse(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    
    const isCollapsed = card.classList.contains('collapsed');
    
    if (isCollapsed) {
        card.classList.remove('collapsed');
        collapsedCards.delete(cardId);
        updateCollapseToggleText(card, false);
    } else {
        card.classList.add('collapsed');
        collapsedCards.add(cardId);
        updateCollapseToggleText(card, true);
    }
    
    // 更新摘要信息
    updateCardSummary(cardId);
    
    // 保存折叠状态到 localStorage
    saveCardCollapseState();
}

// 更新折叠按钮文本
function updateCollapseToggleText(card, isCollapsed) {
    const toggleText = card.querySelector('.collapse-text');
    if (toggleText) {
        toggleText.textContent = isCollapsed ? '展开' : '折叠';
    }
}

// 更新卡片摘要信息
function updateCardSummary(cardId) {
    switch (cardId) {
        case 'refGroupsCard':
            updateRefGroupsSummary();
            break;
        case 'basicSettingsCard':
            updateBasicSettingsSummary();
            break;
        case 'shotsSettingsCard':
            updateShotsSettingsSummary();
            break;
        case 'apiSettingsCard':
            updateApiSettingsSummary();
            break;
        case 'outputSection':
            updateOutputSectionSummary();
            break;
        case 'imageOutputSection':
            updateImageOutputSectionSummary();
            break;
        case 'splitSection':
            updateSplitSectionSummary();
            break;
        case 'videoSection':
            updateVideoSectionSummary();
            break;
    }
}

// 更新分镜参考组摘要
function updateRefGroupsSummary() {
    const summary = document.getElementById('refGroupsSummary');
    if (!summary) return;
    
    if (typeof refGroups !== 'undefined' && refGroups.length > 0) {
        const totalImages = refGroups.reduce((sum, g) => sum + g.images.length, 0);
        const analyzedCount = refGroups.filter(g => g.analyzed).length;
        summary.textContent = `(${refGroups.length} 组, ${totalImages} 张图片, ${analyzedCount} 已分析)`;
    } else {
        summary.textContent = '(暂无)';
    }
}

// 更新基础设置摘要
function updateBasicSettingsSummary() {
    const summary = document.getElementById('basicSettingsSummary');
    if (!summary) return;
    
    const gridLayout = document.getElementById('gridLayout')?.value || '3x3';
    const mode = typeof currentMode !== 'undefined' && currentMode === 'story' ? '故事' : '分镜';
    const sceneDesc = document.getElementById('sceneDesc')?.value?.trim() || '';
    const descPreview = sceneDesc ? (sceneDesc.length > 15 ? sceneDesc.substring(0, 15) + '...' : sceneDesc) : '未填写';
    
    summary.textContent = `(${mode}模式, ${gridLayout}, 场景: ${descPreview})`;
}

// 更新分镜设置摘要
function updateShotsSettingsSummary() {
    const summary = document.getElementById('shotsSettingsSummary');
    if (!summary) return;
    
    const shotItems = document.querySelectorAll('.shot-item');
    const filledCount = Array.from(shotItems).filter(item => {
        const desc = item.querySelector('.shot-desc');
        return desc && desc.value.trim();
    }).length;
    
    summary.textContent = `(${shotItems.length} 镜头, ${filledCount} 已填写)`;
}

// 更新API设置摘要
function updateApiSettingsSummary() {
    const summary = document.getElementById('apiSettingsSummary');
    if (!summary) return;
    
    const apiStatus = document.getElementById('apiStatus');
    const isConnected = apiStatus?.classList.contains('connected');
    const model = document.getElementById('modelSelect')?.value || 'gemini';
    const modelShort = model.split('-').slice(0, 2).join('-');
    
    summary.textContent = isConnected ? `(已连接, ${modelShort})` : '(未连接)';
}

// 更新生成结果摘要
function updateOutputSectionSummary() {
    const summary = document.getElementById('outputSectionSummary');
    if (!summary) return;
    
    const outputText = document.getElementById('outputText')?.value?.trim() || '';
    if (outputText) {
        const lines = outputText.split('\n').filter(l => l.trim()).length;
        summary.textContent = `(${lines} 行内容)`;
    } else {
        summary.textContent = '(暂无)';
    }
}

// 更新AI生成图片摘要
function updateImageOutputSectionSummary() {
    const summary = document.getElementById('imageOutputSectionSummary');
    if (!summary) return;
    
    const count = document.getElementById('generatedImagesCount')?.textContent || '0';
    const refCount = typeof imageGenRefImages !== 'undefined' ? imageGenRefImages.length : 0;
    
    if (parseInt(count) > 0 || refCount > 0) {
        summary.textContent = `(${count} 张生成图, ${refCount} 张参考图)`;
    } else {
        summary.textContent = '(暂无)';
    }
}

// 更新九宫格拆分摘要
function updateSplitSectionSummary() {
    const summary = document.getElementById('splitSectionSummary');
    if (!summary) return;
    
    const sourceCount = typeof splitSourceImages !== 'undefined' ? splitSourceImages.length : 0;
    const resultCount = typeof splitResults !== 'undefined' ? splitResults.length : 0;
    
    if (sourceCount > 0 || resultCount > 0) {
        summary.textContent = `(${sourceCount} 源图, ${resultCount} 拆分结果)`;
    } else {
        summary.textContent = '(暂无)';
    }
}

// 更新视频分镜摘要
function updateVideoSectionSummary() {
    const summary = document.getElementById('videoSectionSummary');
    if (!summary) return;
    
    const shotCount = typeof videoShots !== 'undefined' ? videoShots.length : 0;
    const completedCount = typeof videoShots !== 'undefined' 
        ? videoShots.filter(s => s.videoUrl).length 
        : 0;
    
    if (shotCount > 0) {
        summary.textContent = `(${shotCount} 分镜, ${completedCount} 已生成)`;
    } else {
        summary.textContent = '(暂无)';
    }
}

// 保存折叠状态
function saveCardCollapseState() {
    localStorage.setItem('collapsedCards', JSON.stringify([...collapsedCards]));
}

// 恢复折叠状态
function restoreCardCollapseState() {
    try {
        const saved = localStorage.getItem('collapsedCards');
        if (saved) {
            const cardIds = JSON.parse(saved);
            cardIds.forEach(cardId => {
                const card = document.getElementById(cardId);
                if (card) {
                    card.classList.add('collapsed');
                    collapsedCards.add(cardId);
                    updateCollapseToggleText(card, true);
                    updateCardSummary(cardId);
                }
            });
        }
    } catch (e) {
        console.warn('恢复折叠状态失败:', e);
    }
}

// 所有可折叠的卡片ID
const ALL_COLLAPSIBLE_CARDS = [
    'apiSettingsCard',
    'refGroupsCard', 
    'basicSettingsCard', 
    'shotsSettingsCard',
    'outputSection',
    'imageOutputSection',
    'splitSection',
    'videoSection'
];

// 展开所有卡片
function expandAllCards() {
    ALL_COLLAPSIBLE_CARDS.forEach(cardId => {
        const card = document.getElementById(cardId);
        if (card && card.classList.contains('collapsed')) {
            card.classList.remove('collapsed');
            collapsedCards.delete(cardId);
            updateCollapseToggleText(card, false);
        }
    });
    saveCardCollapseState();
    showToast('已展开所有区域', 'info');
}

// 折叠所有卡片
function collapseAllCards() {
    ALL_COLLAPSIBLE_CARDS.forEach(cardId => {
        const card = document.getElementById(cardId);
        if (card && !card.classList.contains('collapsed')) {
            card.classList.add('collapsed');
            collapsedCards.add(cardId);
            updateCollapseToggleText(card, true);
            updateCardSummary(cardId);
        }
    });
    saveCardCollapseState();
    showToast('已折叠所有区域', 'info');
}

// 更新所有卡片摘要
function updateAllCardSummaries() {
    ALL_COLLAPSIBLE_CARDS.forEach(cardId => {
        updateCardSummary(cardId);
    });
}

