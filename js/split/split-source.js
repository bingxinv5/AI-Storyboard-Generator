/**
 * 源图片管理模块
 * 负责拆分源图片的添加、删除、选择等操作
 */

// 缓存的选中数量（避免每次遍历）
let _cachedSelectedCount = -1;

// 使用图片进行拆分
function useImageForSplit(imageUrl) {
    if (!imageUrl) {
        showToast('图片URL无效', 'error');
        return;
    }
    addSplitSourceImage(imageUrl, `图片${splitSourceImages.length + 1}`);
    document.getElementById('splitSection').scrollIntoView({ behavior: 'smooth' });
}

// 添加单张图片到拆分源列表（带缩略图）
async function addSplitSourceImage(dataUrl, name) {
    showLoading('正在处理图片...');
    try {
        const thumbnail = await generateThumbnail(dataUrl, 120);
        splitSourceImages.push({ dataUrl, thumbnail, name, selected: true });
        splitSourceImage = dataUrl;
        updateSplitSourcePreview();
        hideLoading();
        
        if (splitSourceImages.length === 1) {
            performSplit();
        }
        showToast(`已添加图片: ${name}`, 'success');
    } catch (error) {
        hideLoading();
        splitSourceImages.push({ dataUrl, name, selected: true });
        splitSourceImage = dataUrl;
        updateSplitSourcePreview();
        showToast(`已添加图片: ${name}`, 'success');
    }
}

// 清空拆分源图片
function clearSplitSourceImages() {
    splitSourceImages = [];
    splitSourceImage = null;
    splitResults = [];
    selectedSplitItems.clear();
    updateSplitSourcePreview();
    document.getElementById('splitResultSection').style.display = 'none';
    document.getElementById('clearSplitBtn').style.display = 'none';
    clearSplitCache();
    showToast('已清空所有图片', 'info');
}

// 使用当前生成的图片进行拆分 - 弹出画廊选择器
function useCurrentGeneratedImageForSplit() {
    const galleryImages = window._galleryAllImages || [];
    
    if (galleryImages.length === 0) {
        if (generatedImageUrl) {
            useImageForSplit(generatedImageUrl);
            return;
        }
        showToast('请先生成AI图片', 'warning');
        return;
    }
    
    if (galleryImages.length === 1) {
        useImageForSplit(galleryImages[0]);
        return;
    }
    
    showGalleryPickerForSplit(galleryImages);
}

// 显示画廊图片选择器（使用缩略图提升性能）
async function showGalleryPickerForSplit(galleryImages) {
    showLoading('正在加载图片...');
    
    const thumbnails = {};
    for (let i = 0; i < galleryImages.length; i++) {
        try {
            thumbnails[i] = await generateThumbnail(galleryImages[i], 150);
        } catch (e) {
            thumbnails[i] = galleryImages[i];
        }
    }
    
    hideLoading();
    
    const modalHtml = `
        <div id="galleryPickerModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px;">
            <div style="background: linear-gradient(135deg, #2a2a4a 0%, #1a1a2e 100%); border-radius: 16px; padding: 25px; max-width: 800px; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: #a5b4fc;">📷 选择要拆分的图片</h3>
                    <button onclick="closeGalleryPicker()" style="background: none; border: none; color: #888; font-size: 24px; cursor: pointer; padding: 0 5px;">&times;</button>
                </div>
                <div style="color: #888; font-size: 12px; margin-bottom: 12px;">
                    点击选择图片，可多选。已选: <span id="galleryPickerCount">0</span>/${galleryImages.length}
                    <button onclick="selectAllGalleryPicker()" class="btn btn-xs btn-secondary" style="margin-left: 10px;">全选</button>
                    <button onclick="deselectAllGalleryPicker()" class="btn btn-xs btn-secondary">清空</button>
                </div>
                <div id="galleryPickerGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; overflow-y: auto; max-height: 50vh; padding: 5px; contain: layout style;">
                    ${galleryImages.map((img, idx) => `
                        <div class="gallery-picker-item" data-index="${idx}" onclick="toggleGalleryPickerItem(${idx})" 
                             style="position: relative; cursor: pointer; border-radius: 8px; overflow: hidden; border: 3px solid transparent; transition: border-color 0.2s; contain: layout style paint;">
                            <img src="${thumbnails[idx]}" loading="lazy" style="width: 100%; aspect-ratio: 1; object-fit: cover; display: block;">
                            <div style="position: absolute; top: 5px; left: 5px; width: 20px; height: 20px; border-radius: 50%; background: rgba(0,0,0,0.5); border: 2px solid #fff; display: flex; align-items: center; justify-content: center;">
                                <span class="picker-check" style="display: none; color: #4ade80;">✓</span>
                            </div>
                            <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.7); color: #fff; font-size: 11px; padding: 3px; text-align: center;">${idx + 1}</div>
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="closeGalleryPicker()" class="btn btn-secondary">取消</button>
                    <button onclick="confirmGalleryPicker()" class="btn btn-primary">添加选中图片</button>
                </div>
            </div>
        </div>
    `;
    
    window._galleryPickerImages = galleryImages;
    window._galleryPickerThumbnails = thumbnails;
    window._galleryPickerSelected = new Set();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// 切换画廊选择器中图片的选中状态
function toggleGalleryPickerItem(index) {
    const selected = window._galleryPickerSelected;
    const item = document.querySelector(`.gallery-picker-item[data-index="${index}"]`);
    const check = item?.querySelector('.picker-check');
    
    if (selected.has(index)) {
        selected.delete(index);
        if (item) item.style.borderColor = 'transparent';
        if (check) check.style.display = 'none';
    } else {
        selected.add(index);
        if (item) item.style.borderColor = '#667eea';
        if (check) check.style.display = 'block';
    }
    
    document.getElementById('galleryPickerCount').textContent = selected.size;
}

// 全选画廊选择器
function selectAllGalleryPicker() {
    const images = window._galleryPickerImages || [];
    window._galleryPickerSelected = new Set(images.map((_, i) => i));
    
    document.querySelectorAll('.gallery-picker-item').forEach((item, idx) => {
        item.style.borderColor = '#667eea';
        item.querySelector('.picker-check').style.display = 'block';
    });
    document.getElementById('galleryPickerCount').textContent = images.length;
}

// 清空画廊选择器选择
function deselectAllGalleryPicker() {
    window._galleryPickerSelected.clear();
    
    document.querySelectorAll('.gallery-picker-item').forEach(item => {
        item.style.borderColor = 'transparent';
        item.querySelector('.picker-check').style.display = 'none';
    });
    document.getElementById('galleryPickerCount').textContent = '0';
}

// 关闭画廊选择器
function closeGalleryPicker() {
    const modal = document.getElementById('galleryPickerModal');
    if (modal) modal.remove();
    window._galleryPickerImages = null;
    window._galleryPickerSelected = null;
}

// 确认画廊选择器选择
async function confirmGalleryPicker() {
    const selected = window._galleryPickerSelected;
    const images = window._galleryPickerImages;
    const thumbnails = window._galleryPickerThumbnails || {};
    
    if (!selected || selected.size === 0) {
        showToast('请至少选择一张图片', 'warning');
        return;
    }
    
    showLoading(`正在处理 ${selected.size} 张图片...`);
    
    const sortedIndices = Array.from(selected).sort((a, b) => a - b);
    for (const idx of sortedIndices) {
        const thumbnail = thumbnails[idx] || await generateThumbnail(images[idx], 120);
        splitSourceImages.push({ 
            dataUrl: images[idx], 
            thumbnail,
            name: `画廊图${idx + 1}`, 
            selected: true 
        });
    }
    
    splitSourceImage = splitSourceImages[0]?.dataUrl;
    updateSplitSourcePreview();
    closeGalleryPicker();
    hideLoading();
    
    showToast(`已添加 ${selected.size} 张画廊图片`, 'success');
    document.getElementById('splitSection').scrollIntoView({ behavior: 'smooth' });
}

// 上传多张图片进行拆分
function uploadSplitImages() {
    document.getElementById('splitImageInput').click();
}

// 兼容旧函数名
function uploadSplitImage() {
    uploadSplitImages();
}

// 初始化拆分图片上传监听
function initSplitImageUpload() {
    const input = document.getElementById('splitImageInput');
    if (input) {
        input.addEventListener('change', async function(e) {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            
            showLoading(`正在加载 ${files.length} 张图片...`);
            
            let loadedCount = 0;
            for (const file of files) {
                try {
                    const dataUrl = await readFileAsDataURL(file);
                    const thumbnail = await generateThumbnail(dataUrl, 120);
                    splitSourceImages.push({ 
                        dataUrl, 
                        thumbnail,
                        name: file.name.replace(/\.[^/.]+$/, ''),
                        selected: true
                    });
                    loadedCount++;
                } catch (error) {
                    console.error('加载图片失败:', file.name, error);
                }
            }
            
            if (loadedCount > 0) {
                splitSourceImage = splitSourceImages[0].dataUrl;
                updateSplitSourcePreview();
                hideLoading();
                showToast(`已加载 ${loadedCount} 张图片，选择后点击"拆分选中"`, 'success');
            } else {
                hideLoading();
                showToast('图片加载失败', 'error');
            }
            
            e.target.value = '';
        });
    }
    
    setTimeout(() => {
        initSplitFromCache();
    }, 500);
}

// 读取文件为 DataURL
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 通过URL添加拆分图片
async function addSplitImageByUrl() {
    const url = prompt('请输入图片URL:');
    if (!url) return;
    
    showLoading('正在加载图片...');
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        try {
            const dataUrl = canvas.toDataURL('image/png');
            const thumbnail = await generateThumbnail(dataUrl, 120);
            
            splitSourceImages.push({
                dataUrl,
                thumbnail,
                name: `URL图片${splitSourceImages.length + 1}`,
                selected: true
            });
            splitSourceImage = splitSourceImages[0]?.dataUrl;
            updateSplitSourcePreview();
            hideLoading();
            showToast('图片添加成功', 'success');
        } catch (err) {
            hideLoading();
            showToast('加载失败，可能存在跨域限制', 'error');
        }
    };
    img.onerror = () => {
        hideLoading();
        showToast('图片加载失败', 'error');
    };
    img.src = url;
}

// 更新拆分源图片预览（支持多图+选择）
function updateSplitSourcePreview() {
    const container = document.getElementById('splitSourcePreview');
    const clearBtn = document.getElementById('clearSplitBtn');
    
    _cachedSelectedCount = splitSourceImages.filter(img => img.selected !== false).length;
    
    if (splitSourceImages.length === 0) {
        container.innerHTML = `
            <div style="color: #666; padding: 50px 20px; background: rgba(0,0,0,0.2); border-radius: 12px; border: 2px dashed rgba(255,255,255,0.1);">
                <div style="font-size: 32px; margin-bottom: 10px;">📷</div>
                <div>点击上方按钮添加要拆分的图片</div>
                <div style="font-size: 12px; color: #555; margin-top: 5px;">支持同时添加多张图片进行批量拆分</div>
            </div>`;
        if (clearBtn) clearBtn.style.display = 'none';
        return;
    }
    
    if (clearBtn) clearBtn.style.display = 'inline-flex';
    
    const selectedCount = _cachedSelectedCount;
    const alreadySplitIndices = new Set(splitResults.map(r => r.imageIndex));
    
    const imagesHtml = splitSourceImages.map((img, idx) => {
        const isSelected = img.selected !== false;
        const isSplit = alreadySplitIndices.has(idx);
        const displaySrc = img.thumbnail || img.dataUrl;
        return `
        <div class="split-source-item" 
             data-index="${idx}"
             data-selected="${isSelected}"
             onclick="handleSplitSourceClick(event, ${idx})"
             oncontextmenu="handleSplitSourceRightClick(event, ${idx})"
             style="position: relative; display: inline-block; cursor: pointer; contain: layout style paint;">
            <div style="position: relative;">
                <img src="${displaySrc}" 
                     loading="lazy"
                     class="split-source-img"
                     style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; border: 2px solid ${isSelected ? '#667eea' : 'rgba(255,255,255,0.1)'}; opacity: ${isSelected ? '1' : '0.5'};" 
                     title="${img.name} - 左键选中/取消，右键预览">
                ${isSplit ? '<div class="split-badge" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(56,239,125,0.9); color: #000; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">已拆分</div>' : ''}
            </div>
            <div class="split-checkbox" style="position: absolute; top: 6px; left: 6px; width: 18px; height: 18px; border-radius: 4px; background: ${isSelected ? '#667eea' : 'rgba(0,0,0,0.5)'}; border: 2px solid ${isSelected ? '#667eea' : '#888'}; display: flex; align-items: center; justify-content: center;">
                ${isSelected ? '<span style="color: #fff; font-size: 12px;">✓</span>' : ''}
            </div>
            <div style="position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.8); color: #fff; padding: 1px 5px; border-radius: 3px; font-size: 10px;">${idx + 1}</div>
            <button onclick="event.stopPropagation(); removeSplitSourceImage(${idx})" style="position: absolute; bottom: 24px; right: 4px; background: rgba(255,50,50,0.8); color: white; border: none; border-radius: 50%; width: 18px; height: 18px; cursor: pointer; font-size: 11px; line-height: 1; display: flex; align-items: center; justify-content: center;" title="删除">×</button>
            <div style="font-size: 10px; color: #888; margin-top: 4px; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center;">${img.name}</div>
        </div>
    `}).join('');
    
    container.innerHTML = `
        <div style="background: rgba(0,0,0,0.2); border-radius: 12px; padding: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                <span id="splitSelectedCount" style="color: #a5b4fc; font-size: 12px; background: rgba(102,126,234,0.2); padding: 3px 10px; border-radius: 10px;">
                    📷 ${selectedCount}/${splitSourceImages.length} 张已选
                </span>
                <div style="display: flex; gap: 6px;">
                    <button class="btn btn-xs btn-secondary" onclick="selectAllSplitSource(true)">全选</button>
                    <button class="btn btn-xs btn-secondary" onclick="selectAllSplitSource(false)">清空</button>
                </div>
            </div>
            <div id="splitSourceGrid" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; max-height: 280px; overflow-y: auto; padding: 5px; contain: layout style;">
                ${imagesHtml}
            </div>
            <div style="margin-top: 12px; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                <button id="splitSelectedBtn" class="btn btn-primary" onclick="performSplitSelected()" ${selectedCount === 0 ? 'disabled' : ''} style="min-width: 140px;">
                    ✂️ 拆分选中 (${selectedCount})
                </button>
                <button class="btn btn-secondary" onclick="performSplitAll()" style="min-width: 140px;">
                    ✂️ 拆分全部 (${splitSourceImages.length})
                </button>
            </div>
        </div>
    `;
    
    debouncedSaveSplitCache();
}

// 删除单张源图片（优化：不完整重渲染）
function removeSplitSourceImage(index) {
    const item = document.querySelector(`.split-source-item[data-index="${index}"]`);
    if (item) {
        item.style.transition = 'opacity 0.15s, transform 0.15s';
        item.style.opacity = '0';
        item.style.transform = 'scale(0.8)';
        
        setTimeout(() => {
            const wasSelected = splitSourceImages[index]?.selected !== false;
            splitSourceImages.splice(index, 1);
            if (splitSourceImages.length > 0) {
                splitSourceImage = splitSourceImages[0].dataUrl;
            } else {
                splitSourceImage = null;
            }
            
            invalidateSelectedCountCache();
            
            if (splitSourceImages.length === 0) {
                updateSplitSourcePreview();
            } else {
                item.remove();
                rebuildSplitSourceIndices();
                updateSplitSourceStats();
            }
            
            debouncedSaveSplitCache();
        }, 150);
    } else {
        splitSourceImages.splice(index, 1);
        if (splitSourceImages.length > 0) {
            splitSourceImage = splitSourceImages[0].dataUrl;
        } else {
            splitSourceImage = null;
        }
        invalidateSelectedCountCache();
        updateSplitSourcePreview();
        debouncedSaveSplitCache();
    }
    
    showToast('已删除图片', 'info');
}

// 快速重建索引（不重新渲染）
function rebuildSplitSourceIndices() {
    const items = document.querySelectorAll('.split-source-item');
    items.forEach((item, newIndex) => {
        item.dataset.index = newIndex;
        item.onclick = (e) => handleSplitSourceClick(e, newIndex);
        item.oncontextmenu = (e) => handleSplitSourceRightClick(e, newIndex);
        
        const indexLabel = item.querySelector('div[style*="top: 6px; right: 6px"]');
        if (indexLabel) {
            indexLabel.textContent = newIndex + 1;
        }
        
        const deleteBtn = item.querySelector('button[title="删除"]');
        if (deleteBtn) {
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                removeSplitSourceImage(newIndex);
            };
        }
    });
}

// 切换单张图片的选择状态
function toggleSplitSourceSelection(index, selected) {
    if (splitSourceImages[index]) {
        splitSourceImages[index].selected = selected;
        invalidateSelectedCountCache();
        updateSplitSourcePreview();
    }
}

// 全选/全不选（优化：批量更新UI而不是重新渲染）
function selectAllSplitSource(selectAll) {
    splitSourceImages.forEach((img) => {
        img.selected = selectAll;
    });
    
    _cachedSelectedCount = selectAll ? splitSourceImages.length : 0;
    
    const items = document.querySelectorAll('.split-source-item');
    items.forEach((item, idx) => {
        if (!splitSourceImages[idx]) return;
        
        const isSelected = selectAll;
        const img = item.querySelector('.split-source-img');
        const checkbox = item.querySelector('.split-checkbox');
        
        item.dataset.selected = isSelected;
        
        if (img) {
            img.style.borderColor = isSelected ? '#667eea' : 'rgba(255,255,255,0.1)';
            img.style.opacity = isSelected ? '1' : '0.5';
        }
        
        if (checkbox) {
            checkbox.style.background = isSelected ? '#667eea' : 'rgba(0,0,0,0.5)';
            checkbox.style.borderColor = isSelected ? '#667eea' : '#888';
            checkbox.innerHTML = isSelected ? '<span style="color: #fff; font-size: 12px;">✓</span>' : '';
        }
    });
    
    updateSplitSourceStatsQuick();
    debouncedSaveSplitCache();
}

// 处理源图片单击事件 - 切换选中状态
function handleSplitSourceClick(event, index) {
    event.preventDefault();
    event.stopPropagation();
    
    const imgData = splitSourceImages[index];
    if (!imgData) return;
    
    const wasSelected = imgData.selected !== false;
    imgData.selected = !wasSelected;
    
    adjustSelectedCount(wasSelected ? -1 : 1);
    updateSingleSourceItemUI(index);
    updateSplitSourceStatsQuick();
    debouncedSaveSplitCache();
}

// 优化：只更新单个源图片的UI状态
function updateSingleSourceItemUI(index) {
    const item = document.querySelector(`.split-source-item[data-index="${index}"]`);
    if (!item || !splitSourceImages[index]) return;
    
    const isSelected = splitSourceImages[index].selected !== false;
    const img = item.querySelector('.split-source-img');
    const checkbox = item.querySelector('.split-checkbox');
    
    item.dataset.selected = isSelected;
    
    if (img) {
        img.style.borderColor = isSelected ? '#667eea' : 'rgba(255,255,255,0.1)';
        img.style.opacity = isSelected ? '1' : '0.5';
    }
    
    if (checkbox) {
        checkbox.style.background = isSelected ? '#667eea' : 'rgba(0,0,0,0.5)';
        checkbox.style.borderColor = isSelected ? '#667eea' : '#888';
        checkbox.innerHTML = isSelected ? '<span style="color: #fff; font-size: 12px;">✓</span>' : '';
    }
}

// 快速更新统计（增量更新，不遍历数组）
function updateSplitSourceStatsQuick() {
    if (_cachedSelectedCount < 0) {
        _cachedSelectedCount = splitSourceImages.filter(img => img.selected !== false).length;
    }
    
    const total = splitSourceImages.length;
    
    const statsSpan = document.getElementById('splitSelectedCount');
    if (statsSpan) {
        statsSpan.textContent = `📷 ${_cachedSelectedCount}/${total} 张已选`;
    }
    
    const splitSelectedBtn = document.getElementById('splitSelectedBtn');
    if (splitSelectedBtn) {
        splitSelectedBtn.disabled = _cachedSelectedCount === 0;
        splitSelectedBtn.textContent = `✂️ 拆分选中 (${_cachedSelectedCount})`;
    }
}

// 使缓存失效
function invalidateSelectedCountCache() {
    _cachedSelectedCount = -1;
}

// 更新选中数量缓存（增减1）
function adjustSelectedCount(delta) {
    if (_cachedSelectedCount >= 0) {
        _cachedSelectedCount = Math.max(0, _cachedSelectedCount + delta);
    }
}

// 更新统计信息和按钮状态
function updateSplitSourceStats() {
    _cachedSelectedCount = splitSourceImages.filter(img => img.selected !== false).length;
    updateSplitSourceStatsQuick();
}

// 处理源图片右键事件 - 预览图片
function handleSplitSourceRightClick(event, index) {
    event.preventDefault();
    event.stopPropagation();
    
    if (splitSourceImages[index]) {
        const allImages = splitSourceImages.map(img => img.dataUrl);
        openImageModal(splitSourceImages[index].dataUrl, allImages, index);
    }
}
