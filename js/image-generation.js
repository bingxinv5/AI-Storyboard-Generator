/**
 * AI文生图模块 - 图片生成API调用
 * AI分镜提示词生成器
 */

// ==================== AI文生图功能 ====================

// 生成画廊缩略图（用于快速显示，避免高分辨率图片导致卡顿）
function generateGalleryThumbnail(dataUrl, maxSize = 200) {
    return new Promise((resolve) => {
        // 如果是远程 URL，直接返回（让浏览器处理）
        if (!dataUrl.startsWith('data:')) {
            resolve(dataUrl);
            return;
        }
        
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

// 为指定参考图生成AI图片
async function generateImageForRef(imageIndex) {
    const img = refImages[imageIndex];
    if (!img) {
        showToast('图片不存在', 'error');
        return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
        showToast('请先输入API Key', 'error');
        return;
    }
    
    const { layout } = getGridInfo();

    if (processingImages[img.id]) {
        showToast(`参考图 ${imageIndex + 1} 正在处理中，请稍候`, 'warning');
        return;
    }

    let promptText = '';
    const promptData = img.promptData && img.promptData[layout];
    if (promptData && promptData[currentLang]) {
        promptText = promptData[currentLang];
    } else if (generatedPrompt[currentLang] && currentEditingImageIndex === imageIndex) {
        promptText = generatedPrompt[currentLang];
    }

    if (!promptText) {
        showToast(`请先为此图在布局 ${layout} 下生成分镜，再进行文生图`, 'warning');
        return;
    }

    const aspectRatio = document.getElementById('imageAspectRatio').value;
    const imageSize = document.getElementById('imageSize').value;
    const referenceImages = [img.data];

    // 标记为处理中，添加取消功能
    processingImages[img.id] = { 
        type: 'image', 
        text: 'AI正在生成图片...', 
        progress: '',
        canCancel: true 
    };
    updateRefImages();

    let elapsed = 0;
    const progressInterval = setInterval(() => {
        elapsed += 10;
        if (processingImages[img.id]) {
            let progressText = '';
            if (elapsed < 30) {
                progressText = `已用时 ${elapsed} 秒`;
            } else if (elapsed < 60) {
                progressText = `AI正在构思... ${elapsed}秒`;
            } else if (elapsed < 120) {
                progressText = `精细绘制中... ${Math.floor(elapsed/60)}分${elapsed%60}秒`;
            } else {
                progressText = `耐心等待... ${Math.floor(elapsed/60)}分${elapsed%60}秒`;
            }
            processingImages[img.id].progress = progressText;
            updateImageLoadingState(img.id, processingImages[img.id].text, progressText, true, img.id);
        }
    }, 10000);

    try {
        // 使用 img.id 作为控制器ID，传递给API调用
        const result = await callImageGenerationAPI(promptText, referenceImages, aspectRatio, imageSize, img.id);
        
        if (result) {
            if (!img.generatedImages) img.generatedImages = {};
            if (!img.generatedImages[layout]) img.generatedImages[layout] = [];
            
            // 生成缩略图用于画廊快速显示
            const thumbnail = await generateGalleryThumbnail(result, 200);
            
            img.generatedImages[layout].push({
                url: result,
                thumbnail: thumbnail, // 缩略图
                timestamp: Date.now(),
                aspectRatio: aspectRatio,
                imageSize: imageSize
            });
            
            if (currentEditingImageIndex === imageIndex) {
                generatedImageUrl = result;
                displayGeneratedImage(result);
            }
            
            updateAllGeneratedImagesGallery();
            autoSave();
            
            showToast(`参考图 ${imageIndex + 1} 的AI图片生成成功！（布局: ${layout}）`, 'success');
        } else {
            throw new Error('未获取到生成的图片');
        }
    } catch (error) {
        if (error.message !== '图片生成已取消') {
            showToast(`参考图 ${imageIndex + 1} 图片生成失败: ` + error.message, 'error');
        }
        console.error('图片生成错误:', error);
    }

    clearInterval(progressInterval);
    delete processingImages[img.id];
    updateRefImages();
    updateProcessingStatus();
    autoSave();
}

async function generateImage() {
    // 优先使用用户在输入框中编辑后的提示词
    const outputTextEl = document.getElementById('outputText');
    const prompt = outputTextEl ? outputTextEl.value.trim() : (generatedPrompt[currentLang] || '');
    
    if (!prompt) {
        showToast('请先生成或输入提示词', 'error');
        return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
        showToast('请先输入API Key', 'error');
        return;
    }

    const aspectRatio = document.getElementById('imageAspectRatio').value;
    const imageSize = document.getElementById('imageSize').value;
    const referenceImages = imageGenRefImages.map(img => img.data);
    const refCount = referenceImages.length;

    // 使用任务队列
    if (typeof taskQueue !== 'undefined') {
        const taskName = refCount > 0 ? `AI文生图(${refCount}张参考)` : 'AI文生图';
        
        taskQueue.addImageTask(taskName, async (task, updateProgress) => {
            updateProgress(0, '准备生成...');
            
            // 模拟进度
            let progressValue = 0;
            const progressTimer = setInterval(() => {
                if (task.status === TaskStatus.CANCELLED) {
                    clearInterval(progressTimer);
                    return;
                }
                progressValue = Math.min(progressValue + 5, 90);
                const elapsed = Math.floor((Date.now() - task.startedAt) / 1000);
                if (elapsed < 30) {
                    updateProgress(progressValue, `正在生成... (${elapsed}秒)`);
                } else if (elapsed < 60) {
                    updateProgress(progressValue, `构思画面中... (${elapsed}秒)`);
                } else {
                    updateProgress(progressValue, `精细绘制中... (${Math.floor(elapsed/60)}分${elapsed%60}秒)`);
                }
            }, 5000);
            
            try {
                const result = await callImageGenerationAPI(prompt, referenceImages, aspectRatio, imageSize);
                clearInterval(progressTimer);
                
                if (result) {
                    generatedImageUrl = result;
                    displayGeneratedImage(result);
                    
                    // 生成缩略图用于画廊快速显示
                    const thumbnail = await generateGalleryThumbnail(result, 200);
                    
                    // 保存到关联的参考图，或独立存储
                    const { layout } = getGridInfo();
                    if (currentEditingImageIndex >= 0 && refImages[currentEditingImageIndex]) {
                        const img = refImages[currentEditingImageIndex];
                        if (!img.generatedImages) img.generatedImages = {};
                        if (!img.generatedImages[layout]) img.generatedImages[layout] = [];
                        img.generatedImages[layout].push({
                            url: result,
                            thumbnail: thumbnail,
                            timestamp: Date.now(),
                            aspectRatio: aspectRatio,
                            imageSize: imageSize
                        });
                    } else {
                        // 没有选中参考图时，保存到独立存储
                        if (typeof standaloneGeneratedImages === 'undefined') {
                            window.standaloneGeneratedImages = [];
                        }
                        standaloneGeneratedImages.push({
                            url: result,
                            thumbnail: thumbnail,
                            timestamp: Date.now(),
                            aspectRatio: aspectRatio,
                            imageSize: imageSize,
                            layout: layout
                        });
                    }
                    
                    autoSave();
                    updateAllGeneratedImagesGallery();
                    updateProgress(100, '生成成功');
                    showToast('图片生成成功！', 'success');
                    return result;
                } else {
                    throw new Error('未获取到生成的图片');
                }
            } catch (error) {
                clearInterval(progressTimer);
                throw error;
            }
        }, {
            description: `${aspectRatio} ${imageSize}`,
            priority: TaskPriority.NORMAL,
            timeout: 600000 // 10分钟超时
        });
        
        showToast('已添加图片生成任务到队列', 'info');
        return;
    }

    // 原有逻辑（兼容模式）
    const loadingMsg = refCount > 0 
        ? `AI正在生成图片（包含${refCount}张参考图），预计需要1-3分钟...` 
        : 'AI正在生成图片，预计需要30秒-2分钟...';

    showLoading(loadingMsg);

    let elapsed = 0;
    const progressInterval = setInterval(() => {
        elapsed += 10;
        const loadingText = document.getElementById('loadingText');
        if (loadingText) {
            if (elapsed < 30) {
                loadingText.textContent = `AI正在生成图片... (${elapsed}秒)`;
            } else if (elapsed < 60) {
                loadingText.textContent = `AI正在构思画面... (${elapsed}秒)`;
            } else if (elapsed < 120) {
                loadingText.textContent = `AI正在精细绘制... (${Math.floor(elapsed/60)}分${elapsed%60}秒)`;
            } else {
                loadingText.textContent = `仍在处理中，请耐心等待... (${Math.floor(elapsed/60)}分${elapsed%60}秒)`;
            }
        }
    }, 10000);

    try {
        const result = await callImageGenerationAPI(prompt, referenceImages, aspectRatio, imageSize);
        
        if (result) {
            generatedImageUrl = result;
            displayGeneratedImage(result);
            
            // 生成缩略图用于画廊快速显示
            const thumbnail = await generateGalleryThumbnail(result, 200);
            
            // 保存到关联的参考图，或独立存储
            const { layout } = getGridInfo();
            if (currentEditingImageIndex >= 0 && refImages[currentEditingImageIndex]) {
                const img = refImages[currentEditingImageIndex];
                if (!img.generatedImages) img.generatedImages = {};
                if (!img.generatedImages[layout]) img.generatedImages[layout] = [];
                img.generatedImages[layout].push({
                    url: result,
                    thumbnail: thumbnail,
                    timestamp: Date.now(),
                    aspectRatio: aspectRatio,
                    imageSize: imageSize
                });
            } else {
                // 没有选中参考图时，保存到独立存储
                if (typeof standaloneGeneratedImages === 'undefined') {
                    window.standaloneGeneratedImages = [];
                }
                standaloneGeneratedImages.push({
                    url: result,
                    thumbnail: thumbnail,
                    timestamp: Date.now(),
                    aspectRatio: aspectRatio,
                    imageSize: imageSize,
                    layout: layout
                });
            }
            
            autoSave();
            showToast('图片生成成功！', 'success');
        } else {
            throw new Error('未获取到生成的图片');
        }
    } catch (error) {
        showToast('图片生成失败: ' + error.message, 'error');
        console.error('图片生成错误:', error);
    }

    clearInterval(progressInterval);
    hideLoading();
}

// 调用图片生成API（支持取消）
async function callImageGenerationAPI(prompt, referenceImages = [], aspectRatio = '16:9', imageSize = '2K', controllerId = null) {
    const apiKey = getApiKey();
    const apiBaseUrl = (await getImageApiBaseUrlAsync()).replace(/\/+$/, '');
    const url = `${apiBaseUrl}/images/generations`;

    // 创建取消控制器
    const controller = new AbortController();
    if (controllerId) {
        imageGenerationControllers[controllerId] = controller;
    }

    const requestBody = {
        model: 'nano-banana-2',
        prompt: prompt,
        aspect_ratio: aspectRatio,
        image_size: imageSize,
        response_format: 'b64_json'
    };

    if (referenceImages.length > 0) {
        requestBody.image = referenceImages.slice(0, 9).map(img => {
            if (img.startsWith('data:')) {
                return img;
            }
            return `data:image/png;base64,${img}`;
        });
    }

    console.log('图片生成API请求:', {
        url,
        model: requestBody.model,
        aspectRatio: requestBody.aspect_ratio,
        imageSize: requestBody.image_size,
        refImagesCount: referenceImages.length,
        promptLength: prompt.length
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        console.log('图片生成API响应状态:', response.status);

        const responseText = await response.text();
        console.log('图片生成API原始响应:', responseText.substring(0, 500));

        if (!response.ok) {
            let errorMessage = `API请求失败: ${response.status}`;
            try {
                const errorData = JSON.parse(responseText);
                errorMessage = errorData.error?.message || errorMessage;
            } catch (e) {
                errorMessage = responseText || errorMessage;
            }
            throw new Error(errorMessage);
        }

        const data = JSON.parse(responseText);
        console.log('图片生成API解析后数据:', data);

        if (data.data && data.data.length > 0) {
            const imageData = data.data[0];
            
            if (imageData.b64_json) {
                if (imageData.b64_json.startsWith('data:')) {
                    return imageData.b64_json;
                }
                return `data:image/png;base64,${imageData.b64_json}`;
            }
            if (imageData.url) {
                return imageData.url;
            }
        }

        throw new Error('API响应中没有找到图片数据');
    } catch (error) {
        // 清理控制器
        if (controllerId && imageGenerationControllers[controllerId]) {
            delete imageGenerationControllers[controllerId];
        }
        
        // 检查是否是取消操作
        if (error.name === 'AbortError') {
            throw new Error('图片生成已取消');
        }
        
        console.error('图片生成API错误:', error);
        throw error;
    } finally {
        // 确保清理控制器
        if (controllerId && imageGenerationControllers[controllerId]) {
            delete imageGenerationControllers[controllerId];
        }
    }
}

// 取消图片生成
function cancelImageGeneration(imageId) {
    if (imageGenerationControllers[imageId]) {
        imageGenerationControllers[imageId].abort();
        delete imageGenerationControllers[imageId];
        showToast('已取消图片生成', 'info');
        return true;
    }
    return false;
}

// 显示生成的图片（直接更新到画廊）
function displayGeneratedImage(imageUrl) {
    const downloadBtns = document.getElementById('imageDownloadBtns');
    const imageSection = document.getElementById('imageOutputSection');

    if (!imageUrl) {
        console.warn('⚠️ displayGeneratedImage: imageUrl 为空');
        return;
    }

    // 确保 imageUrl 是字符串
    const imgSrc = typeof imageUrl === 'string' ? imageUrl : (imageUrl.url || imageUrl.data || '');
    if (!imgSrc) {
        console.warn('⚠️ displayGeneratedImage: 无法获取有效的图片URL');
        return;
    }

    downloadBtns.style.display = 'flex';
    imageSection.classList.add('active');
    
    console.log('🖼️ 已生成图片:', imgSrc.substring(0, 100) + '...');
    
    // 直接更新画廊
    updateAllGeneratedImagesGallery();
}

// 防抖更新画廊
let galleryUpdateTimeout = null;

// 更新所有生成图片画廊（带防抖）
function updateAllGeneratedImagesGallery() {
    if (galleryUpdateTimeout) {
        clearTimeout(galleryUpdateTimeout);
    }
    galleryUpdateTimeout = setTimeout(() => {
        updateAllGeneratedImagesGalleryDOM();
    }, 200);
}

// 实际更新画廊DOM
function updateAllGeneratedImagesGalleryDOM() {
    const gallerySection = document.getElementById('allGeneratedImagesSection');
    const gallery = document.getElementById('allGeneratedImages');
    const countEl = document.getElementById('generatedImagesCount');
    const currentLayout = getCurrentGridLayout();
    
    const allGeneratedItems = [];
    
    // 从参考图收集生成的图片
    refImages.forEach((img, refIndex) => {
        if (img.generatedImages) {
            Object.keys(img.generatedImages).forEach(layout => {
                const imagesArray = img.generatedImages[layout];
                if (imagesArray && Array.isArray(imagesArray)) {
                    imagesArray.forEach((imageData, historyIndex) => {
                        // 兼容不同的数据格式
                        const imageUrl = typeof imageData === 'string' ? imageData : (imageData?.url || imageData?.data || '');
                        if (!imageUrl) return; // 跳过无效数据
                        
                        // 获取缩略图（如果有）
                        const thumbnailUrl = imageData?.thumbnail || imageUrl;
                        
                        allGeneratedItems.push({
                            img,
                            refIndex,
                            layout,
                            imageUrl: imageUrl,
                            thumbnailUrl: thumbnailUrl,
                            timestamp: imageData?.timestamp || 0,
                            aspectRatio: imageData?.aspectRatio || '',
                            imageSize: imageData?.imageSize || '',
                            historyIndex: historyIndex,
                            isCurrentLayout: layout === currentLayout,
                            isLatest: historyIndex === imagesArray.length - 1,
                            isStandalone: false
                        });
                    });
                }
            });
        }
    });
    
    // 添加独立生成的图片（不关联参考图）
    if (typeof standaloneGeneratedImages !== 'undefined' && Array.isArray(standaloneGeneratedImages)) {
        standaloneGeneratedImages.forEach((imageData, historyIndex) => {
            const imageUrl = typeof imageData === 'string' ? imageData : (imageData?.url || '');
            if (!imageUrl) return;
            
            // 获取缩略图（如果有）
            const thumbnailUrl = imageData?.thumbnail || imageUrl;
            
            allGeneratedItems.push({
                img: null,
                refIndex: -1,
                layout: imageData?.layout || currentLayout,
                imageUrl: imageUrl,
                thumbnailUrl: thumbnailUrl,
                timestamp: imageData?.timestamp || 0,
                aspectRatio: imageData?.aspectRatio || '',
                imageSize: imageData?.imageSize || '',
                historyIndex: historyIndex,
                isCurrentLayout: (imageData?.layout || currentLayout) === currentLayout,
                isLatest: historyIndex === standaloneGeneratedImages.length - 1,
                isStandalone: true
            });
        });
    }
    
    if (allGeneratedItems.length === 0) {
        gallerySection.style.display = 'block';
        countEl.textContent = '0';
        gallery.innerHTML = '<div style="color: #666; text-align: center; padding: 40px;">点击上方"AI文生图"按钮生成图片</div>';
        return;
    }
    
    gallerySection.style.display = 'block';
    countEl.textContent = allGeneratedItems.length;
    
    // 按生成时间排序（最新的在前面）
    allGeneratedItems.sort((a, b) => {
        return (b.timestamp || 0) - (a.timestamp || 0);
    });
    
    // 保存所有图片URL用于画廊切换
    window._galleryAllImages = allGeneratedItems.map(item => item.imageUrl);
    
    // 使用虚拟渲染：只渲染可见区域的图片（限制最多显示50张）
    const visibleItems = allGeneratedItems.slice(0, 50);
    const hasMore = allGeneratedItems.length > 50;
    
    gallery.innerHTML = visibleItems.map((item, idx) => {
        const layoutBadge = item.isCurrentLayout 
            ? `<span class="layout-badge current">${item.layout}</span>` 
            : `<span class="layout-badge">${item.layout}</span>`;
        const timeStr = new Date(item.timestamp).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});
        const historyBadge = item.isLatest ? '🆕' : `#${item.historyIndex + 1}`;
        
        // 使用缩略图显示，点击时用原图预览
        const displaySrc = item.thumbnailUrl || item.imageUrl;
        
        // 独立生成的图片显示不同的标题和按钮
        if (item.isStandalone) {
            return `
                <div class="generated-image-item ${item.isCurrentLayout ? 'current-layout' : ''} standalone">
                    <img src="${displaySrc}" alt="独立生成 - ${item.layout} ${historyBadge}" 
                         onclick="openGalleryImage(${idx})" 
                         title="点击放大预览（支持左右键切换）\n生成时间: ${timeStr}" loading="lazy">
                    <button class="delete-generated-btn" onclick="deleteStandaloneImage(${item.historyIndex})" title="删除此图片">✕</button>
                    <div class="image-info">
                        <div class="image-title">🎨 独立生成 ${layoutBadge} ${historyBadge}</div>
                        <div class="image-actions">
                            <button class="btn-download" onclick="downloadStandaloneImage(${item.historyIndex})">💾 下载</button>
                            <button class="btn-view" onclick="useImageForSplit('${item.imageUrl}')" title="用于九宫格拆分">✂️ 拆分</button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="generated-image-item ${item.isCurrentLayout ? 'current-layout' : ''}">
                <img src="${displaySrc}" alt="参考图${item.refIndex + 1} - ${item.layout} ${historyBadge}" 
                     onclick="openGalleryImage(${idx})" 
                     title="点击放大预览（支持左右键切换）\n生成时间: ${timeStr}" loading="lazy">
                <button class="delete-generated-btn" onclick="deleteGeneratedImage(${item.refIndex}, '${item.layout}', ${item.historyIndex})" title="删除此图片">✕</button>
                <div class="image-info">
                    <div class="image-title">参考图 ${item.refIndex + 1} ${layoutBadge} ${historyBadge}</div>
                    <div class="image-actions">
                        <button class="btn-view" onclick="selectImageForEditing(${item.refIndex})">📍 查看</button>
                        <button class="btn-download" onclick="downloadSingleGeneratedImage(${item.refIndex}, '${item.layout}', ${item.historyIndex})">💾 下载</button>
                        <button class="btn-view" onclick="useImageForSplit('${item.imageUrl}')" title="用于九宫格拆分">✂️ 拆分</button>
                    </div>
                </div>
            </div>
        `;
    }).join('') + (hasMore ? `<div class="load-more-hint">还有 ${allGeneratedItems.length - 50} 张图片...</div>` : '');
}

// 打开画廊图片（支持切换）
function openGalleryImage(index) {
    const images = window._galleryAllImages || [];
    if (images.length > 0) {
        openImageModal(images[index], images, index);
    }
}

// 删除独立生成的图片
function deleteStandaloneImage(historyIndex) {
    if (typeof standaloneGeneratedImages === 'undefined' || !Array.isArray(standaloneGeneratedImages)) {
        return;
    }
    
    if (historyIndex >= 0 && historyIndex < standaloneGeneratedImages.length) {
        standaloneGeneratedImages.splice(historyIndex, 1);
        updateAllGeneratedImagesGallery();
        autoSave();
        showToast('已删除图片', 'success');
    }
}

// 下载独立生成的图片
function downloadStandaloneImage(historyIndex) {
    if (typeof standaloneGeneratedImages === 'undefined' || !Array.isArray(standaloneGeneratedImages)) {
        showToast('没有找到图片', 'error');
        return;
    }
    
    const imageData = standaloneGeneratedImages[historyIndex];
    if (!imageData) {
        showToast('图片不存在', 'error');
        return;
    }
    
    const imageUrl = typeof imageData === 'string' ? imageData : imageData.url;
    if (!imageUrl) {
        showToast('图片URL无效', 'error');
        return;
    }
    
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `AI生成_独立_${imageData.layout || 'unknown'}_v${historyIndex + 1}_${Date.now()}.png`;
    link.click();
    showToast('图片下载中...', 'success');
}

// 下载单个生成的图片
function downloadSingleGeneratedImage(refIndex, layout = null, historyIndex = null) {
    const img = refImages[refIndex];
    const targetLayout = layout || getCurrentGridLayout();
    
    if (!img || !img.generatedImages || !img.generatedImages[targetLayout]) {
        showToast('没有找到生成的图片', 'error');
        return;
    }
    
    const imagesArray = img.generatedImages[targetLayout];
    let imageUrl;
    
    if (Array.isArray(imagesArray)) {
        const index = historyIndex !== null ? historyIndex : imagesArray.length - 1;
        imageUrl = imagesArray[index]?.url;
    } else {
        imageUrl = imagesArray;
    }
    
    if (!imageUrl) {
        showToast('图片URL无效', 'error');
        return;
    }
    
    const historyLabel = historyIndex !== null ? `_v${historyIndex + 1}` : '';
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `AI生成_参考图${refIndex + 1}_${targetLayout}${historyLabel}_${Date.now()}.png`;
    link.click();
    showToast('图片下载中...', 'success');
}

// 下载所有生成的图片
async function downloadAllGeneratedImages() {
    const allGeneratedItems = [];
    
    // 从参考图收集
    refImages.forEach((img, refIndex) => {
        if (img.generatedImages) {
            Object.keys(img.generatedImages).forEach(layout => {
                const imagesArray = img.generatedImages[layout];
                if (imagesArray && Array.isArray(imagesArray)) {
                    imagesArray.forEach((imageData, idx) => {
                        const imageUrl = typeof imageData === 'string' ? imageData : imageData?.url;
                        if (imageUrl) {
                            allGeneratedItems.push({
                                refIndex,
                                layout,
                                imageUrl,
                                isStandalone: false,
                                historyIndex: idx
                            });
                        }
                    });
                }
            });
        }
    });
    
    // 添加独立生成的图片
    if (typeof standaloneGeneratedImages !== 'undefined' && Array.isArray(standaloneGeneratedImages)) {
        standaloneGeneratedImages.forEach((imageData, idx) => {
            const imageUrl = typeof imageData === 'string' ? imageData : imageData?.url;
            if (imageUrl) {
                allGeneratedItems.push({
                    refIndex: -1,
                    layout: imageData?.layout || 'unknown',
                    imageUrl,
                    isStandalone: true,
                    historyIndex: idx
                });
            }
        });
    }
    
    if (allGeneratedItems.length === 0) {
        showToast('没有生成的图片可下载', 'error');
        return;
    }
    
    showToast(`正在下载 ${allGeneratedItems.length} 张图片...`, 'info');
    
    for (let i = 0; i < allGeneratedItems.length; i++) {
        const item = allGeneratedItems[i];
        
        const link = document.createElement('a');
        link.href = item.imageUrl;
        const prefix = item.isStandalone ? '独立' : `参考图${item.refIndex + 1}`;
        link.download = `AI生成_${prefix}_${item.layout}_v${item.historyIndex + 1}_${Date.now()}.png`;
        link.click();
        
        if (i < allGeneratedItems.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    showToast(`已下载 ${allGeneratedItems.length} 张图片`, 'success');
}

// 删除单张生成的图片
function deleteGeneratedImage(refIndex, layout, historyIndex) {
    const img = refImages[refIndex];
    if (!img || !img.generatedImages || !img.generatedImages[layout]) {
        showToast('图片不存在', 'error');
        return;
    }
    
    const imagesArray = img.generatedImages[layout];
    if (!Array.isArray(imagesArray) || historyIndex >= imagesArray.length) {
        showToast('图片索引无效', 'error');
        return;
    }
    
    imagesArray.splice(historyIndex, 1);
    
    if (imagesArray.length === 0) {
        delete img.generatedImages[layout];
    }
    
    if (Object.keys(img.generatedImages).length === 0) {
        img.generatedImages = null;
    }
    
    updateAllGeneratedImagesGallery();
    updateRefImages();
    autoSave();
    
    showToast('已删除该图片', 'success');
}

// 清空所有生成的图片
function clearAllGeneratedImages() {
    const hasRefImages = refImages.some(img => img.generatedImages && Object.keys(img.generatedImages).length > 0);
    const hasStandalone = typeof standaloneGeneratedImages !== 'undefined' && 
                          Array.isArray(standaloneGeneratedImages) && 
                          standaloneGeneratedImages.length > 0;
    
    if (!hasRefImages && !hasStandalone) {
        showToast('没有生成的图片', 'warning');
        return;
    }
    
    if (!confirm('确定要清空所有生成的图片吗？此操作不可恢复！')) return;
    
    // 清空参考图关联的生成图片
    refImages.forEach(img => {
        img.generatedImages = null;
    });
    
    // 清空独立生成的图片
    if (typeof standaloneGeneratedImages !== 'undefined') {
        standaloneGeneratedImages.length = 0;
    }
    
    generatedImageUrl = null;
    
    const downloadBtns = document.getElementById('imageDownloadBtns');
    if (downloadBtns) {
        downloadBtns.style.display = 'none';
    }
    
    updateAllGeneratedImagesGallery();
    updateRefImages();
    autoSave();
    
    showToast('已清空所有生成的图片', 'success');
}

// 下载生成的图片
function downloadGeneratedImage() {
    if (!generatedImageUrl) {
        showToast('没有可下载的图片', 'error');
        return;
    }

    const link = document.createElement('a');
    link.href = generatedImageUrl;
    link.download = `AI生成分镜_${Date.now()}.png`;
    link.click();
    showToast('图片下载中...', 'success');
}

// 复制生成的图片到剪贴板
async function copyGeneratedImage() {
    if (!generatedImageUrl) {
        showToast('没有可复制的图片', 'error');
        return;
    }

    try {
        let blob;
        if (generatedImageUrl.startsWith('data:')) {
            const parts = generatedImageUrl.split(',');
            const mimeMatch = parts[0].match(/:(.*?);/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
            const base64Data = parts[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            blob = new Blob([byteArray], { type: mimeType });
        } else {
            const response = await fetch(generatedImageUrl);
            blob = await response.blob();
        }
        
        await navigator.clipboard.write([
            new ClipboardItem({ [blob.type]: blob })
        ]);
        showToast('图片已复制到剪贴板', 'success');
    } catch (error) {
        console.error('复制图片失败:', error);
        showToast('复制失败: ' + error.message, 'error');
    }
}

// 保留原函数以兼容旧代码
function openGeneratedImageInNewTab() {
    if (!generatedImageUrl) return;
    openImageModal(generatedImageUrl);
}
