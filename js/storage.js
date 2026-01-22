/**
 * 存储模块 - IndexedDB和本地存储管理
 * AI分镜提示词生成器
 * 
 * 依赖的全局变量（来自 state.js）：
 * - saveStatus, saveTimeout, lastSaveTime
 * 依赖的常量（来自 config.js）：
 * - SAVE_DEBOUNCE, SAVE_THROTTLE
 */

// ==================== 本地存储功能（使用IndexedDB） ====================

// 收集分镜格子数据
function collectShotsGridData() {
    const shotsData = [];
    document.querySelectorAll('.shot-item').forEach((item, index) => {
        const typeEl = item.querySelector('.shot-type-select');
        const descEl = item.querySelector('.shot-desc');
        if (typeEl || descEl) {
            shotsData.push({
                num: index + 1,
                type: typeEl?.value || 'MS',
                desc: descEl?.value || ''
            });
        }
    });
    return shotsData;
}

// 恢复分镜格子数据
function restoreShotsGridData(shotsData) {
    if (!shotsData || !Array.isArray(shotsData)) return;
    
    shotsData.forEach((shot, i) => {
        const shotNum = i + 1;
        const typeEl = document.getElementById(`shotType${shotNum}`);
        const descEl = document.getElementById(`shotDesc${shotNum}`);
        
        if (typeEl && shot.type) {
            typeEl.value = shot.type;
        }
        if (descEl && shot.desc) {
            descEl.value = shot.desc;
        }
    });
    
    console.log(`📋 已恢复 ${shotsData.length} 个分镜格子数据`);
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

// 保存数据到IndexedDB
async function saveToIndexedDB(retryCount = 0) {
    const maxRetries = 3;
    
    try {
        updateSaveIndicator('saving');
        saveStatus.pending = true;
        
        // 统计数据
        let totalGeneratedImages = 0;
        let totalShotsData = 0;
        refImages.forEach(img => {
            if (img.generatedImages) {
                Object.keys(img.generatedImages).forEach(layout => {
                    const images = img.generatedImages[layout];
                    if (Array.isArray(images)) {
                        totalGeneratedImages += images.length;
                    } else if (images) {
                        totalGeneratedImages += 1;
                    }
                });
            }
            if (img.shotsData) {
                totalShotsData += Object.keys(img.shotsData).length;
            }
        });
        
        // 添加独立生成的图片数量
        const standaloneCount = (typeof standaloneGeneratedImages !== 'undefined' && 
                                 Array.isArray(standaloneGeneratedImages)) ? 
                                standaloneGeneratedImages.length : 0;
        totalGeneratedImages += standaloneCount;

        // 构建保存数据
        const saveData = {
            refImages: refImages,
            refGroups: refGroups, // 新增：分镜参考组
            standaloneGeneratedImages: (typeof standaloneGeneratedImages !== 'undefined') ? standaloneGeneratedImages : [], // 独立生成的图片
            currentEditingImageIndex: currentEditingImageIndex,
            videoShots: videoShots,
            generatedPrompt: generatedPrompt,
            currentLang: currentLang,
            currentMode: currentMode,
            imageGenRefImages: imageGenRefImages,
            videoGenerationHistory: videoGenerationHistory,
            shotsGridData: collectShotsGridData(), // 新增：分镜格子数据
            settings: {
                gridLayout: document.getElementById('gridLayout')?.value || '3x3',
                resolution: document.getElementById('resolution')?.value || '2K',
                aspectRatio: document.getElementById('aspectRatio')?.value || '16:9',
                sceneDesc: document.getElementById('sceneDesc')?.value || '',
                imageAspectRatio: document.getElementById('imageAspectRatio')?.value || '16:9',
                imageSize: document.getElementById('imageSize')?.value || '2K',
                storyContext: document.getElementById('storyContext')?.value || ''
            },
            // 元数据
            _meta: {
                saveTime: Date.now(),
                version: '2.1',
                stats: {
                    refImages: refImages.length,
                    refGroups: refGroups.length,
                    generatedImages: totalGeneratedImages,
                    videoShots: videoShots.length,
                    videoHistory: videoGenerationHistory.length,
                    shotsDataLayouts: totalShotsData
                }
            }
        };

        // 保存项目状态
        await storageManager.saveProjectState(saveData);
        
        // 更新保存状态
        saveStatus.pending = false;
        saveStatus.lastSaveTime = Date.now();
        saveStatus.lastSaveSuccess = true;
        saveStatus.saveCount++;
        
        const statsMsg = `参考图:${refImages.length} 生成图:${totalGeneratedImages} 视频:${videoShots.length}`;
        console.log(`💾 保存成功 [${saveStatus.saveCount}] - ${statsMsg}`);
        updateSaveIndicator('success', `✓ 已保存 (${statsMsg})`);
        
        return true;
    } catch (error) {
        console.error('❌ 保存数据失败:', error);
        saveStatus.pending = false;
        saveStatus.lastSaveSuccess = false;
        saveStatus.failCount++;
        
        // 重试机制
        if (retryCount < maxRetries) {
            console.log(`🔄 保存失败，${500 * (retryCount + 1)}ms后重试 (${retryCount + 1}/${maxRetries})...`);
            updateSaveIndicator('warning', `⏳ 重试保存中... (${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1)));
            return saveToIndexedDB(retryCount + 1);
        }
        
        updateSaveIndicator('error', '✕ 保存失败，请手动保存');
        showToast('自动保存失败，请手动保存数据', 'error');
        return false;
    }
}

// 兼容旧版调用
function saveToLocalStorage() {
    saveToIndexedDB();
}

// 从旧的localStorage迁移数据到IndexedDB
async function migrateFromLocalStorage() {
    const oldData = localStorage.getItem('storyboardData');
    if (!oldData) return false;
    
    try {
        console.log('📦 发现旧的localStorage数据，开始迁移到IndexedDB...');
        const data = JSON.parse(oldData);
        
        // 保存到IndexedDB
        await storageManager.saveProjectState(data);
        
        // 迁移成功后删除旧数据
        localStorage.removeItem('storyboardData');
        
        console.log('✅ 数据迁移成功！旧数据已清除');
        showToast('数据已从旧存储迁移到新存储', 'success');
        return true;
    } catch (error) {
        console.error('❌ 数据迁移失败:', error);
        return false;
    }
}

// 从IndexedDB加载数据
async function loadFromIndexedDB() {
    try {
        // 先尝试迁移旧数据
        await migrateFromLocalStorage();
        
        const data = await storageManager.loadProjectState();
        if (!data) {
            console.log('📂 IndexedDB中没有保存的数据');
            return false;
        }
        
        console.log('📂 正在从IndexedDB恢复数据...', {
            参考图数量: data.refImages?.length || 0,
            分镜参考组: data.refGroups?.length || 0,
            视频分镜: data.videoShots?.length || 0,
            保存时间: data.timestamp ? new Date(data.timestamp).toLocaleString() : '未知'
        });
        
        // 恢复分镜参考组（新版本）
        if (data.refGroups && data.refGroups.length > 0) {
            refGroups = data.refGroups;
            renderRefGroups();
            console.log(`📷 已恢复 ${refGroups.length} 个分镜参考组`);
        }
        
        // 恢复参考图（兼容旧版本）
        if (data.refImages && data.refImages.length > 0) {
            refImages = data.refImages;
            
            // 调试：检查每张图片的生成图片数据
            refImages.forEach((img, idx) => {
                if (img.generatedImages) {
                    const layouts = Object.keys(img.generatedImages);
                    const totalImages = layouts.reduce((sum, layout) => {
                        const images = img.generatedImages[layout];
                        return sum + (Array.isArray(images) ? images.length : 0);
                    }, 0);
                    console.log(`📸 参考图${idx + 1}:`, {
                        layouts: layouts,
                        totalImages: totalImages
                    });
                }
            });
            
            updateRefImages();
            updateAllGeneratedImagesGallery();
        }
        
        // 恢复独立生成的图片
        if (data.standaloneGeneratedImages && Array.isArray(data.standaloneGeneratedImages)) {
            standaloneGeneratedImages = data.standaloneGeneratedImages;
            console.log(`🖼️ 已恢复 ${standaloneGeneratedImages.length} 张独立生成的图片`);
            updateAllGeneratedImagesGallery();
        }
        
        // 恢复当前编辑索引
        if (data.currentEditingImageIndex !== undefined) {
            currentEditingImageIndex = data.currentEditingImageIndex;
            
            // 如果有当前编辑的图片，显示其生成的图片
            if (currentEditingImageIndex >= 0 && refImages[currentEditingImageIndex]) {
                const img = refImages[currentEditingImageIndex];
                const currentLayout = getCurrentGridLayout();
                
                if (img.generatedImages && img.generatedImages[currentLayout]) {
                    const images = img.generatedImages[currentLayout];
                    if (Array.isArray(images) && images.length > 0) {
                        const latestImage = images[images.length - 1];
                        generatedImageUrl = latestImage.url;
                        displayGeneratedImage(latestImage.url);
                        console.log('🖼️ 已恢复当前编辑图片的生成图');
                    }
                }
            }
        }
        
        // 恢复文生图参考图
        if (data.imageGenRefImages && data.imageGenRefImages.length > 0) {
            imageGenRefImages = data.imageGenRefImages;
            updateImageGenRefDisplay();
        }
        
        // 恢复视频分镜
        if (data.videoShots && data.videoShots.length > 0) {
            videoShots = data.videoShots;
            
            // 清理恢复标记（刷新后需要重新恢复）
            videoShots.forEach(shot => {
                delete shot.isRecovering;
            });
            
            // 检查是否有带 task_id 的任务（可以尝试恢复）
            const recoverableTasks = videoShots.filter(shot => 
                shot.taskId && (shot.status === 'generating' || shot.status === 'queued')
            );
            
            // 没有 task_id 的任务无法恢复，重置状态
            let resetCount = 0;
            videoShots.forEach(shot => {
                if ((shot.status === 'generating' || shot.status === 'queued') && !shot.taskId) {
                    shot.status = 'pending';
                    resetCount++;
                }
            });
            
            if (resetCount > 0) {
                console.log(`🔄 重置了 ${resetCount} 个无法恢复的视频任务`);
            }
            
            renderVideoShots();
            
            // 尝试恢复有 task_id 的任务
            if (recoverableTasks.length > 0) {
                console.log(`🔄 发现 ${recoverableTasks.length} 个可恢复的视频任务`);
                // 延迟执行，确保页面初始化完成和 video.js 加载完毕
                setTimeout(() => {
                    if (typeof resumePendingVideoTasks === 'function') {
                        console.log('🔄 开始调用 resumePendingVideoTasks...');
                        resumePendingVideoTasks();
                    } else {
                        console.warn('⚠️ resumePendingVideoTasks 函数未定义，无法恢复任务');
                        // 重置可恢复任务的状态
                        recoverableTasks.forEach(shot => {
                            shot.status = 'pending';
                            shot.error = '恢复功能不可用，请重新生成';
                            delete shot.taskId;
                            delete shot.taskStartTime;
                        });
                        renderVideoShots();
                        showToast('视频恢复功能不可用，请重新生成', 'warning');
                    }
                }, 2000); // 增加到 2 秒确保所有脚本加载完成
            } else if (resetCount > 0) {
                showToast(`${resetCount} 个视频生成任务因页面刷新已中断，请重新生成`, 'warning');
            }
        }
        
        // 恢复视频生成历史
        if (data.videoGenerationHistory && data.videoGenerationHistory.length > 0) {
            videoGenerationHistory = data.videoGenerationHistory;
            updateVideoHistory();
        }
        
        // 恢复提示词
        if (data.generatedPrompt) {
            generatedPrompt = data.generatedPrompt;
            if (generatedPrompt.zh || generatedPrompt.en) {
                outputSection.classList.add('active');
                switchLang(data.currentLang || 'zh');
            }
        }
        
        // 恢复语言
        if (data.currentLang) {
            currentLang = data.currentLang;
        }
        
        // 恢复模式
        if (data.currentMode) {
            switchMode(data.currentMode);
        }
        
        // 恢复设置
        if (data.settings) {
            const s = data.settings;
            if (s.gridLayout) document.getElementById('gridLayout').value = s.gridLayout;
            if (s.resolution) document.getElementById('resolution').value = s.resolution;
            if (s.aspectRatio) document.getElementById('aspectRatio').value = s.aspectRatio;
            if (s.sceneDesc) document.getElementById('sceneDesc').value = s.sceneDesc;
            if (s.imageAspectRatio) document.getElementById('imageAspectRatio').value = s.imageAspectRatio;
            if (s.imageSize) document.getElementById('imageSize').value = s.imageSize;
            if (s.storyContext && document.getElementById('storyContext')) {
                document.getElementById('storyContext').value = s.storyContext;
            }
        }
        
        // 恢复分镜格子数据（需要在 updateShots 之后执行）
        if (data.shotsGridData && data.shotsGridData.length > 0) {
            // 延迟执行，确保 DOM 已更新
            setTimeout(() => {
                restoreShotsGridData(data.shotsGridData);
            }, 100);
        }
        
        console.log('✅ 数据恢复成功');
        showToast('已恢复上次编辑的数据', 'success');
        return true;
    } catch (error) {
        console.error('❌ 加载数据失败:', error);
        showToast('加载保存数据失败，将以空白状态开始', 'warning');
        return false;
    }
}

// 兼容旧版调用
function loadFromLocalStorage() {
    return loadFromIndexedDB();
}

// 清除所有数据
async function clearLocalStorage() {
    if (confirm('确定要清除所有保存的数据吗？此操作不可恢复！')) {
        try {
            await storageManager.clearAllData();
            localStorage.removeItem('storyboardData');
            localStorage.removeItem('forceProxy');
            showToast('数据已清除，正在刷新页面...', 'success');
            setTimeout(() => location.reload(), 500);
        } catch (error) {
            console.error('清除数据失败:', error);
            showToast('清除数据失败: ' + error.message, 'error');
        }
    }
}

// 显示存储使用情况
async function showStorageStats() {
    showLoading('正在统计存储...');
    
    try {
        const stats = await storageManager.getStorageStats();
        console.log('📊 存储使用情况:', stats);
        
        // 计算本地内存中的数据统计
        const memoryStats = {
            refImages: refImages.length,
            refImagesWithDesc: refImages.filter(img => img.desc).length,
            generatedImagesTotal: 0,
            generatedImagesLayouts: new Set(),
            videoShots: videoShots.length,
            videoShotsWithImage: videoShots.filter(s => s.refImage).length,
            videoShotsCompleted: videoShots.filter(s => s.status === 'completed').length,
            videoHistoryCount: videoGenerationHistory.length,
            imageGenRefCount: imageGenRefImages.length
        };
        
        // 统计生成图片
        refImages.forEach(img => {
            if (img.generatedImages) {
                Object.keys(img.generatedImages).forEach(layout => {
                    memoryStats.generatedImagesLayouts.add(layout);
                    const arr = img.generatedImages[layout];
                    if (Array.isArray(arr)) {
                        memoryStats.generatedImagesTotal += arr.length;
                    }
                });
            }
        });
        
        // 格式化存储大小
        const formatSize = (bytes) => {
            if (bytes === undefined) return '未知';
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
            return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
        };
        
        // 创建模态框HTML
        const modalHtml = `
            <div id="storageStatsModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center;" onclick="closeStorageStatsModal(event)">
                <div style="background: linear-gradient(135deg, #2a2a4a 0%, #1a1a2e 100%); border-radius: 16px; padding: 30px; max-width: 600px; width: 90%; margin: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);" onclick="event.stopPropagation()">
                    <h3 style="margin: 0 0 20px 0; color: #667eea; font-size: 20px; display: flex; align-items: center; gap: 10px;">
                        📊 存储统计
                    </h3>
                    
                    <!-- 存储空间 -->
                    <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <span style="color: #aaa;">存储空间使用</span>
                            <span style="color: #38ef7d; font-weight: bold;">${formatSize(stats.usage)} / ${formatSize(stats.quota)}</span>
                        </div>
                        <div style="background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px; overflow: hidden;">
                            <div style="background: linear-gradient(90deg, #38ef7d, #11998e); height: 100%; width: ${stats.usagePercent || 0}%; transition: width 0.3s;"></div>
                        </div>
                        <div style="text-align: right; margin-top: 5px; color: #888; font-size: 12px;">${stats.usagePercent || 0}%</div>
                    </div>
                    
                    <!-- 数据统计表格 -->
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;">
                        <div style="background: rgba(102, 126, 234, 0.2); padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="font-size: 28px; color: #667eea; font-weight: bold;">${memoryStats.refImages}</div>
                            <div style="color: #aaa; font-size: 12px;">参考图</div>
                            <div style="color: #666; font-size: 11px;">${memoryStats.refImagesWithDesc} 张已分析</div>
                        </div>
                        <div style="background: rgba(56, 239, 125, 0.2); padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="font-size: 28px; color: #38ef7d; font-weight: bold;">${memoryStats.generatedImagesTotal}</div>
                            <div style="color: #aaa; font-size: 12px;">生成图片</div>
                            <div style="color: #666; font-size: 11px;">${memoryStats.generatedImagesLayouts.size} 种布局</div>
                        </div>
                        <div style="background: rgba(240, 147, 251, 0.2); padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="font-size: 28px; color: #f093fb; font-weight: bold;">${memoryStats.videoShots}</div>
                            <div style="color: #aaa; font-size: 12px;">视频分镜</div>
                            <div style="color: #666; font-size: 11px;">${memoryStats.videoShotsCompleted} 个已完成</div>
                        </div>
                        <div style="background: rgba(79, 172, 254, 0.2); padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="font-size: 28px; color: #4facfe; font-weight: bold;">${memoryStats.videoHistoryCount}</div>
                            <div style="color: #aaa; font-size: 12px;">视频历史</div>
                            <div style="color: #666; font-size: 11px;">生成记录</div>
                        </div>
                    </div>
                    
                    <!-- IndexedDB 统计 -->
                    <div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; margin-bottom: 20px;">
                        <div style="color: #888; font-size: 12px; margin-bottom: 8px;">IndexedDB 存储详情</div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 12px;">
                            <div style="color: #aaa;">参考图: <span style="color: #fff;">${stats.refImages}</span></div>
                            <div style="color: #aaa;">生成图: <span style="color: #fff;">${stats.generatedImages}</span></div>
                            <div style="color: #aaa;">视频分镜: <span style="color: #fff;">${stats.videoShots}</span></div>
                            <div style="color: #aaa;">生成视频: <span style="color: #fff;">${stats.generatedVideos}</span></div>
                            <div style="color: #aaa;">历史记录: <span style="color: #fff;">${stats.history}</span></div>
                            <div style="color: #aaa;">文生图参考: <span style="color: #fff;">${memoryStats.imageGenRefCount}</span></div>
                        </div>
                    </div>
                    
                    <!-- 操作按钮 -->
                    <div style="display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;">
                        <button onclick="exportDataToFile(); closeStorageStatsModalDirect();" style="padding: 10px 20px; border: 1px solid #667eea; background: transparent; color: #667eea; border-radius: 8px; cursor: pointer;">
                            📤 导出数据
                        </button>
                        <button onclick="importDataFromFile(); closeStorageStatsModalDirect();" style="padding: 10px 20px; border: 1px solid #38ef7d; background: transparent; color: #38ef7d; border-radius: 8px; cursor: pointer;">
                            📥 导入数据
                        </button>
                        <button onclick="closeStorageStatsModalDirect()" style="padding: 10px 20px; border: none; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; cursor: pointer; font-weight: bold;">
                            关闭
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        hideLoading();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        return stats;
    } catch (error) {
        hideLoading();
        console.error('获取存储统计失败:', error);
        showToast('获取存储统计失败: ' + error.message, 'error');
    }
}

// 关闭存储统计模态框
function closeStorageStatsModal(event) {
    if (event.target.id === 'storageStatsModal') {
        closeStorageStatsModalDirect();
    }
}

function closeStorageStatsModalDirect() {
    const modal = document.getElementById('storageStatsModal');
    if (modal) modal.remove();
}

// 导出数据为JSON文件
async function exportDataToFile() {
    try {
        showLoading('正在导出数据...');
        const data = await storageManager.exportAllData();
        
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `分镜数据备份_${new Date().toISOString().slice(0,10)}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        hideLoading();
        showToast('数据导出成功！', 'success');
    } catch (error) {
        hideLoading();
        showToast('导出失败: ' + error.message, 'error');
    }
}

// 导入数据
async function importDataFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            showLoading('正在导入数据...');
            const text = await file.text();
            const data = JSON.parse(text);
            
            await storageManager.importData(data);
            
            hideLoading();
            showToast('数据导入成功，正在刷新页面...', 'success');
            
            setTimeout(() => location.reload(), 1000);
        } catch (error) {
            hideLoading();
            showToast('导入失败: ' + error.message, 'error');
        }
    };
    
    input.click();
}

// 自动保存（防抖 + 节流）
function autoSave() {
    // 如果正在保存中，跳过
    if (saveStatus.pending) {
        console.log('⏳ 保存进行中，跳过本次自动保存');
        return;
    }
    
    if (saveTimeout) clearTimeout(saveTimeout);
    
    // 检查节流：距离上次保存不足5秒
    const timeSinceLastSave = Date.now() - saveStatus.lastSaveTime;
    if (timeSinceLastSave < SAVE_THROTTLE && saveStatus.lastSaveSuccess) {
        // 延迟到节流间隔后保存
        const delay = SAVE_THROTTLE - timeSinceLastSave + 100;
        saveTimeout = setTimeout(async () => {
            await saveToIndexedDB();
        }, delay);
        return;
    }
    
    // 正常防抖保存
    saveTimeout = setTimeout(async () => {
        await saveToIndexedDB();
    }, SAVE_DEBOUNCE);
}

// 手动保存（立即保存，显示详细反馈）
async function manualSave() {
    if (saveStatus.pending) {
        showToast('正在保存中，请稍候...', 'info');
        return;
    }
    
    showLoading('正在保存数据...');
    const success = await saveToIndexedDB();
    hideLoading();
    
    if (success) {
        // 显示保存统计
        let totalGeneratedImages = 0;
        refImages.forEach(img => {
            if (img.generatedImages) {
                Object.values(img.generatedImages).forEach(arr => {
                    totalGeneratedImages += Array.isArray(arr) ? arr.length : 1;
                });
            }
        });
        
        const msg = `保存成功！\n参考图: ${refImages.length}张\n生成图片: ${totalGeneratedImages}张\n视频分镜: ${videoShots.length}个\n视频历史: ${videoGenerationHistory.length}条`;
        showToast(msg.replace(/\n/g, ' | '), 'success');
    }
}

// 获取保存状态
function getSaveStatus() {
    return {
        ...saveStatus,
        timeSinceLastSave: Date.now() - saveStatus.lastSaveTime,
        lastSaveTimeStr: saveStatus.lastSaveTime ? new Date(saveStatus.lastSaveTime).toLocaleTimeString() : '从未保存'
    };
}

// 暴露到全局以便调试
window.getSaveStatus = getSaveStatus;

// 调试函数：检查当前数据状态
function debugDataStatus() {
    console.log('=== 数据状态调试 ===');
    console.log('参考图数量:', refImages.length);
    console.log('当前编辑索引:', currentEditingImageIndex);
    
    refImages.forEach((img, idx) => {
        console.log(`\n参考图 ${idx + 1}:`);
        console.log('  - 描述:', img.desc ? '已填写' : '未填写');
        console.log('  - 已分析:', img.analyzed);
        
        if (img.generatedImages) {
            console.log('  - 生成图片数据:');
            Object.keys(img.generatedImages).forEach(layout => {
                const images = img.generatedImages[layout];
                if (Array.isArray(images)) {
                    console.log(`    ${layout}: ${images.length}张图片`);
                    images.forEach((imgData, i) => {
                        console.log(`      #${i + 1}: ${imgData.url ? imgData.url.substring(0, 50) + '...' : 'URL缺失'}`);
                    });
                } else if (images) {
                    console.log(`    ${layout}: 1张图片 (旧格式)`);
                }
            });
        } else {
            console.log('  - 生成图片数据: 无');
        }
        
        if (img.shotsData) {
            const layouts = Object.keys(img.shotsData);
            console.log('  - 分镜数据:', layouts.join(', '));
        }
    });
    
    // 检查localStorage
    const saved = localStorage.getItem('storyboardData');
    if (saved) {
        const data = JSON.parse(saved);
        console.log('\nlocalStorage中保存的数据:');
        console.log('  - 参考图数量:', data.refImages?.length || 0);
        console.log('  - 保存时间:', data.timestamp ? new Date(data.timestamp).toLocaleString() : '未知');
        
        let savedImagesCount = 0;
        data.refImages?.forEach(img => {
            if (img.generatedImages) {
                Object.values(img.generatedImages).forEach(images => {
                    savedImagesCount += Array.isArray(images) ? images.length : 1;
                });
            }
        });
        console.log('  - 保存的生成图片:', savedImagesCount + '张');
    }
    
    console.log('===================');
}

// 暴露到全局以便在控制台调用
window.debugDataStatus = debugDataStatus;
