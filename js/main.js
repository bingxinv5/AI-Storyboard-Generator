/**
 * 主模块 - 初始化和入口
 * AI分镜提示词生成器
 */

// 获取输出区域元素引用
let outputSection;

// ==================== 初始化 ====================
async function init() {
    // 获取DOM元素引用
    outputSection = document.getElementById('outputSection');
    
    // 初始化上传处理器
    initUploadHandlers();
    
    // 恢复分镜参考组的折叠状态
    if (typeof restoreGroupCollapseState === 'function') {
        restoreGroupCollapseState();
    }
    
    // 初始化渲染分镜参考组
    renderRefGroups();
    
    // 动态生成景别图例（从配置文件）
    const shotTypesGrid = document.getElementById('shotTypesGrid');
    if (shotTypesGrid && typeof shotTypesLegend !== 'undefined') {
        shotTypesGrid.innerHTML = shotTypesLegend.map(item => 
            `<div class="shot-type-item"><span class="shot-type-badge">${item.code}</span> ${item.label}</div>`
        ).join('');
    }
    
    // 恢复保存的API设置
    const savedApiKey = localStorage.getItem('geminiApiKey');
    const savedApiBaseUrl = localStorage.getItem('apiBaseUrl');
    const savedVideoApiBaseUrl = localStorage.getItem('videoApiBaseUrl');
    
    if (savedApiKey) {
        document.getElementById('apiKey').value = savedApiKey;
    }
    if (savedApiBaseUrl) {
        document.getElementById('apiBaseUrl').value = savedApiBaseUrl;
    }
    if (savedVideoApiBaseUrl) {
        document.getElementById('videoApiBaseUrl').value = savedVideoApiBaseUrl;
    }
    
    // 等待IndexedDB就绪
    await storageManager.ensureReady();
    console.log('📦 IndexedDB存储已就绪');
    
    // 尝试从IndexedDB恢复数据
    const restored = await loadFromIndexedDB();
    
    // 初始化分镜事件处理器
    initShotsHandlers();
    
    // 如果没有恢复数据，则初始化分镜
    if (!restored) {
        updateShots();
        initVideoShots();
    } else {
        // 已恢复数据，需要更新分镜显示
        updateShots();
        
        // 确保画廊在数据恢复后显示
        setTimeout(() => {
            updateAllGeneratedImagesGallery();
            console.log('🎨 画廊已更新');
        }, 100);
    }
    
    // 恢复卡片折叠状态
    restoreCardCollapseState();
    
    // 初始化所有卡片摘要
    setTimeout(() => {
        if (typeof updateAllCardSummaries === 'function') {
            updateAllCardSummaries();
        }
    }, 200);
    
    // 同步网格布局到拆分布局
    syncGridLayoutToSplit();
    
    // 初始化视频模型提示
    updateVideoModelTip();
    
    // 初始化强制代理设置
    initForceProxy();
    
    // 初始化拆分图片上传监听
    initSplitImageUpload();
    
    // 初始化文生图参考图上传监听
    if (typeof initImageGenRefUpload === 'function') {
        initImageGenRefUpload();
    }
    
    // 检测代理服务器状态
    checkProxyServer().then(available => {
        if (available) {
            if (forceProxyEnabled) {
                showToast('🔒 强制代理模式已启用，请确保代理服务器正在运行', 'info');
            } else {
                showToast('🔄 检测到本地代理服务器，API将自动使用代理', 'success');
            }
        } else {
            console.log('ℹ️ 未检测到本地代理服务器，将直连API');
        }
    });
    
    // 添加视频模型切换监听器（确保事件绑定）
    const videoModelSelect = document.getElementById('videoModel');
    if (videoModelSelect) {
        videoModelSelect.addEventListener('change', function() {
            console.log('📢 模型切换事件触发');
            updateVideoModelTip();
        });
    }
    
    // 监听网格布局变化，同步更新视频分镜
    document.getElementById('gridLayout').addEventListener('change', () => {
        initVideoShots();
        autoSave();
    });
    
    // 监听表单变化，自动保存
    document.getElementById('sceneDesc').addEventListener('input', autoSave);
    document.getElementById('storyContext')?.addEventListener('input', autoSave);
    
    // 监听 API URL 变化，自动保存到 localStorage
    document.getElementById('apiBaseUrl').addEventListener('change', function() {
        localStorage.setItem('apiBaseUrl', this.value.trim());
        console.log('📝 已保存 API Base URL:', this.value.trim());
    });
    document.getElementById('videoApiBaseUrl').addEventListener('change', function() {
        localStorage.setItem('videoApiBaseUrl', this.value.trim());
        console.log('📝 已保存视频 API Base URL:', this.value.trim());
    });
    // 也监听 blur 事件（失去焦点时保存）
    document.getElementById('apiBaseUrl').addEventListener('blur', function() {
        const saved = localStorage.getItem('apiBaseUrl');
        if (saved !== this.value.trim()) {
            localStorage.setItem('apiBaseUrl', this.value.trim());
        }
    });
    document.getElementById('videoApiBaseUrl').addEventListener('blur', function() {
        const saved = localStorage.getItem('videoApiBaseUrl');
        if (saved !== this.value.trim()) {
            localStorage.setItem('videoApiBaseUrl', this.value.trim());
        }
    });
    
    // 页面关闭前保存数据
    window.addEventListener('beforeunload', (e) => {
        // 立即同步保存（beforeunload 不支持 async）
        if (saveTimeout) clearTimeout(saveTimeout);
        
        // 使用 sendBeacon 或同步方式保存关键数据
        try {
            // 标记需要在下次启动时检查
            localStorage.setItem('_pendingSave', 'true');
            localStorage.setItem('_lastCloseTime', Date.now().toString());
            console.log('🔒 页面关闭，已标记待保存');
        } catch (err) {
            console.error('关闭前保存标记失败:', err);
        }
        
        // 如果有未完成的处理或未保存的更改，提示用户
        const hasUnsavedChanges = saveStatus.pending || (Date.now() - saveStatus.lastSaveTime > 3000);
        const hasProcessing = Object.keys(processingImages).length > 0;
        
        if (hasProcessing) {
            e.preventDefault();
            e.returnValue = '还有图片正在处理中，确定要离开吗？';
            return e.returnValue;
        }
        
        if (hasUnsavedChanges && refImages.length > 0) {
            e.preventDefault();
            e.returnValue = '有未保存的更改，确定要离开吗？';
            return e.returnValue;
        }
    });
    
    // 页面卸载时尝试最后保存
    window.addEventListener('unload', () => {
        // 使用 navigator.sendBeacon 发送保存信号（如果需要服务器端保存）
        // 这里我们只记录日志，因为 IndexedDB 保存需要异步
        console.log('📤 页面卸载');
    });
    
    // 页面可见性变化时保存（用户切换标签页或最小化）
    document.addEventListener('visibilitychange', async () => {
        if (document.hidden) {
            // 页面隐藏时立即保存
            if (saveTimeout) clearTimeout(saveTimeout);
            await saveToIndexedDB();
            console.log('👁️ 页面隐藏，已保存数据');
        } else {
            // 页面恢复可见时，检查是否需要恢复保存
            const pendingSave = localStorage.getItem('_pendingSave');
            if (pendingSave === 'true') {
                localStorage.removeItem('_pendingSave');
                console.log('🔄 检测到待保存标记，执行保存');
                await saveToIndexedDB();
            }
        }
    });
    
    // 添加清除数据按钮到页面
    addClearDataButton();
    
    // 添加手动保存按钮
    addManualSaveButton();
}

function addClearDataButton() {
    const apiSettings = document.querySelector('.api-settings');
    if (apiSettings) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-danger';
        btn.textContent = '🗑️ 清除所有数据';
        btn.onclick = clearLocalStorage;
        apiSettings.appendChild(btn);
    }
}

// 添加手动保存按钮
function addManualSaveButton() {
    const apiSettings = document.querySelector('.api-settings');
    if (apiSettings) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-success';
        btn.textContent = '💾 手动保存';
        btn.onclick = manualSave;
        btn.title = '立即保存所有数据到IndexedDB存储';
        apiSettings.appendChild(btn);
        
        // 添加导出按钮
        const exportBtn = document.createElement('button');
        exportBtn.className = 'btn btn-sm btn-info';
        exportBtn.textContent = '📤 导出备份';
        exportBtn.onclick = exportDataToFile;
        exportBtn.title = '导出所有数据为JSON文件备份';
        apiSettings.appendChild(exportBtn);
        
        // 添加导入按钮
        const importBtn = document.createElement('button');
        importBtn.className = 'btn btn-sm btn-warning';
        importBtn.textContent = '📥 导入备份';
        importBtn.onclick = importDataFromFile;
        importBtn.title = '从JSON文件导入数据';
        apiSettings.appendChild(importBtn);
        
        // 添加存储统计按钮
        const statsBtn = document.createElement('button');
        statsBtn.className = 'btn btn-sm btn-secondary';
        statsBtn.textContent = '📊 存储统计';
        statsBtn.onclick = showStorageStats;
        statsBtn.title = '查看当前存储使用情况';
        apiSettings.appendChild(statsBtn);
    }
}

// 同步网格布局到拆分布局选择器
function syncGridLayoutToSplit() {
    const gridLayout = document.getElementById('gridLayout');
    const splitLayout = document.getElementById('splitLayout');
    
    if (gridLayout && splitLayout) {
        // 初始同步
        if (splitLayout.querySelector(`option[value="${gridLayout.value}"]`)) {
            splitLayout.value = gridLayout.value;
        }
        
        // 监听变化
        gridLayout.addEventListener('change', () => {
            if (splitLayout.querySelector(`option[value="${gridLayout.value}"]`)) {
                splitLayout.value = gridLayout.value;
            }
        });
    }
}

// 异步初始化应用
init().then(() => {
    console.log('✅ 应用初始化完成');
}).catch(err => {
    console.error('❌ 应用初始化失败:', err);
    alert('应用初始化失败，请刷新页面重试');
});
