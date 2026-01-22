/**
 * 核心拆分逻辑模块
 * 负责图片拆分算法和结果展示
 */

// 生成缩略图（用于快速显示）
function generateThumbnail(dataUrl, maxSize = 200) {
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
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

// 拆分单张图片（返回 Promise）
function splitSingleImage(dataUrl, imageName, imageIndex, rows, cols, format) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = async () => {
            const pieceWidth = Math.floor(img.width / cols);
            const pieceHeight = Math.floor(img.height / rows);
            const pieces = [];
            
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const canvas = document.createElement('canvas');
                    canvas.width = pieceWidth;
                    canvas.height = pieceHeight;
                    const ctx = canvas.getContext('2d');
                    
                    ctx.drawImage(
                        img,
                        col * pieceWidth, row * pieceHeight,
                        pieceWidth, pieceHeight,
                        0, 0,
                        pieceWidth, pieceHeight
                    );
                    
                    const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
                    const quality = format === 'png' ? 1 : 0.92;
                    const fullDataUrl = canvas.toDataURL(mimeType, quality);
                    
                    const thumbnail = await generateThumbnail(fullDataUrl, 200);
                    
                    pieces.push({
                        index: row * cols + col + 1,
                        row: row + 1,
                        col: col + 1,
                        imageIndex: imageIndex,
                        imageName: imageName,
                        dataUrl: fullDataUrl,
                        thumbnailUrl: thumbnail,
                        format: format
                    });
                }
            }
            resolve(pieces);
        };
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = dataUrl;
    });
}

// 拆分选中的图片
async function performSplitSelected() {
    const selectedImages = splitSourceImages.filter(img => img.selected !== false);
    if (selectedImages.length === 0) {
        showToast('请先选择要拆分的图片', 'warning');
        return;
    }
    
    const layout = document.getElementById('splitLayout').value;
    const [rows, cols] = layout.split('x').map(Number);
    const format = document.getElementById('splitFormat').value;
    
    showLoading(`正在拆分 ${selectedImages.length} 张选中图片...`);
    
    const alreadySplitIndices = new Set(splitResults.map(r => r.imageIndex));
    const shouldUpscale = upscaleEnabled;
    
    let newPiecesCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < selectedImages.length; i++) {
        const sourceImg = selectedImages[i];
        const originalIndex = splitSourceImages.indexOf(sourceImg);
        
        if (alreadySplitIndices.has(originalIndex)) {
            skippedCount++;
            continue;
        }
        
        showLoading(`正在拆分第 ${i + 1 - skippedCount}/${selectedImages.length - skippedCount} 张图片...`);
        
        try {
            const pieces = await splitSingleImage(sourceImg.dataUrl, sourceImg.name, originalIndex, rows, cols, format);
            
            if (shouldUpscale) {
                showLoading(`正在放大第 ${i + 1}/${selectedImages.length} 张图片的拆分块...`);
                for (let j = 0; j < pieces.length; j++) {
                    try {
                        showLoading(`放大中: 图片${i + 1} 块${j + 1}/${pieces.length}...`);
                        const upscaled = await upscaleImage(pieces[j].dataUrl);
                        pieces[j].dataUrl = upscaled;
                        pieces[j].upscaled = true;
                        pieces[j].thumbnailUrl = await generateThumbnail(upscaled, 200);
                    } catch (err) {
                        console.error('放大失败:', err);
                    }
                }
            }
            
            splitResults.push(...pieces);
            newPiecesCount += pieces.length;
        } catch (error) {
            console.error(`拆分图片 ${i + 1} 失败:`, error);
        }
    }
    
    if (newPiecesCount > 0 || splitResults.length > 0) {
        const imageCount = new Set(splitResults.map(r => r.imageIndex)).size;
        displaySplitResults(rows, cols, imageCount);
        hideLoading();
        
        if (skippedCount > 0 && newPiecesCount === 0) {
            showToast(`选中的 ${skippedCount} 张图片已拆分过，无需重复拆分`, 'info');
        } else {
            const upscaleMsg = shouldUpscale ? '（已AI放大）' : '';
            const skipMsg = skippedCount > 0 ? `，跳过${skippedCount}张已拆分` : '';
            showToast(`新增 ${newPiecesCount} 块拆分图片${upscaleMsg}${skipMsg}`, 'success');
        }
        await saveSplitDataToCache();
    } else {
        hideLoading();
        showToast('拆分失败', 'error');
    }
}

// 拆分所有图片
async function performSplitAll() {
    if (splitSourceImages.length === 0) {
        showToast('请先添加要拆分的图片', 'warning');
        return;
    }
    
    const layout = document.getElementById('splitLayout').value;
    const [rows, cols] = layout.split('x').map(Number);
    const format = document.getElementById('splitFormat').value;
    
    showLoading(`正在拆分 ${splitSourceImages.length} 张图片...`);
    
    const alreadySplitIndices = new Set(splitResults.map(r => r.imageIndex));
    const shouldUpscale = upscaleEnabled;
    
    let newPiecesCount = 0;
    let skippedCount = 0;

    for (let imgIdx = 0; imgIdx < splitSourceImages.length; imgIdx++) {
        const sourceImg = splitSourceImages[imgIdx];
        
        if (alreadySplitIndices.has(imgIdx)) {
            skippedCount++;
            continue;
        }
        
        showLoading(`正在拆分第 ${imgIdx + 1 - skippedCount}/${splitSourceImages.length - skippedCount} 张图片...`);
        
        try {
            const pieces = await splitSingleImage(sourceImg.dataUrl, sourceImg.name, imgIdx, rows, cols, format);
            
            if (shouldUpscale) {
                showLoading(`正在放大第 ${imgIdx + 1}/${splitSourceImages.length} 张图片的拆分块...`);
                for (let j = 0; j < pieces.length; j++) {
                    try {
                        showLoading(`放大中: 图片${imgIdx + 1} 块${j + 1}/${pieces.length}...`);
                        const upscaled = await upscaleImage(pieces[j].dataUrl);
                        pieces[j].dataUrl = upscaled;
                        pieces[j].upscaled = true;
                        pieces[j].thumbnailUrl = await generateThumbnail(upscaled, 200);
                    } catch (err) {
                        console.error('放大失败:', err);
                    }
                }
            }
            
            splitResults.push(...pieces);
            newPiecesCount += pieces.length;
        } catch (error) {
            console.error(`拆分图片 ${imgIdx + 1} 失败:`, error);
        }
    }
    
    if (newPiecesCount > 0 || splitResults.length > 0) {
        const imageCount = new Set(splitResults.map(r => r.imageIndex)).size;
        displaySplitResults(rows, cols, imageCount);
        hideLoading();
        
        if (skippedCount > 0 && newPiecesCount === 0) {
            showToast(`所有 ${skippedCount} 张图片已拆分过，无需重复拆分`, 'info');
        } else {
            const upscaleMsg = shouldUpscale ? '（已AI放大）' : '';
            const skipMsg = skippedCount > 0 ? `，跳过${skippedCount}张已拆分` : '';
            showToast(`新增 ${newPiecesCount} 块拆分图片${upscaleMsg}${skipMsg}`, 'success');
        }
        await saveSplitDataToCache();
    } else {
        hideLoading();
        showToast('拆分失败', 'error');
    }
}

// 执行拆分（兼容函数）
async function performSplit() {
    if (splitSourceImages.length === 0 && !splitSourceImage) {
        showToast('请先选择要拆分的图片', 'warning');
        return;
    }
    
    if (splitSourceImages.length === 0 && splitSourceImage) {
        splitSourceImages.push({ dataUrl: splitSourceImage, name: '图片1', selected: true });
    }
    
    splitSourceImages.forEach(img => img.selected = true);
    await performSplitSelected();
}

// 显示拆分结果（支持多图分组）
function displaySplitResults(rows, cols, imageCount) {
    const resultSection = document.getElementById('splitResultSection');
    const grid = document.getElementById('splitResultGrid');
    
    resultSection.style.display = 'block';
    
    if (!rows || !cols) {
        if (splitResults.length > 0) {
            rows = Math.max(...splitResults.map(p => p.row));
            cols = Math.max(...splitResults.map(p => p.col));
        } else {
            rows = 3;
            cols = 3;
        }
    }
    
    window._splitGalleryImages = splitResults.map(p => p.dataUrl);
    
    const uniqueImageIndices = new Set(splitResults.map(p => p.imageIndex !== undefined ? p.imageIndex : 0));
    const actualGroupCount = uniqueImageIndices.size;
    
    const groups = {};
    splitResults.forEach((piece, idx) => {
        const key = piece.imageIndex !== undefined ? piece.imageIndex : 0;
        if (!groups[key]) {
            groups[key] = { name: piece.imageName || `图片${key + 1}`, pieces: [] };
        }
        groups[key].pieces.push({ ...piece, globalIndex: idx });
    });
    
    let html = '';
    Object.keys(groups).forEach(key => {
        const group = groups[key];
        const upscaledBadge = group.pieces.some(p => p.upscaled) ? '<span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 1px 6px; border-radius: 4px; font-size: 10px; margin-left: 6px;">AI放大</span>' : '';
        html += `
            <div class="split-group" data-image-index="${key}" style="margin-bottom: 20px; background: rgba(0,0,0,0.2); border-radius: 12px; padding: 15px;">
                <div class="split-group-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <span style="font-size: 13px; color: #a5b4fc; font-weight: bold;">📷 ${group.name} (${group.pieces.length}块)${upscaledBadge}</span>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn btn-xs btn-secondary" onclick="selectGroupImages(${key})" title="选择本组">☑️ 选择</button>
                        <button class="btn btn-xs btn-danger" onclick="deleteSplitGroup(${key})" title="删除本组拆分结果" style="background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);">🗑️ 删除</button>
                    </div>
                </div>
                <div class="split-group-grid" style="display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 8px;">
                    ${group.pieces.map(piece => `
                        <div class="split-item ${selectedSplitItems.has(piece.globalIndex) ? 'selected' : ''}" 
                             onclick="toggleSplitSelection(${piece.globalIndex})" 
                             data-index="${piece.globalIndex}">
                            <input type="checkbox" class="split-item-checkbox" 
                                   ${selectedSplitItems.has(piece.globalIndex) ? 'checked' : ''} 
                                   onclick="event.stopPropagation(); toggleSplitSelection(${piece.globalIndex})">
                            <img src="${piece.thumbnailUrl || piece.dataUrl}" alt="块 ${piece.index}" ondblclick="event.stopPropagation(); openSplitImage(${piece.globalIndex})" title="单击选中，双击预览" loading="lazy">
                            <div class="split-item-label">R${piece.row}C${piece.col}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });
    
    grid.style.display = 'block';
    grid.innerHTML = html;
    
    let countEl = document.getElementById('splitSelectionCount');
    if (!countEl) {
        const buttonGroup = resultSection.querySelector('.button-group');
        if (buttonGroup) {
            const countSpan = document.createElement('span');
            countSpan.id = 'splitSelectionCount';
            countSpan.style.cssText = 'color: #a5b4fc; font-size: 13px; margin-left: 10px;';
            buttonGroup.insertBefore(countSpan, buttonGroup.firstChild);
        }
    }
    updateSelectionCount();
}

// 选择/取消选择某一组的所有图片
function selectGroupImages(imageIndex) {
    const groupIndices = [];
    splitResults.forEach((piece, idx) => {
        if (piece.imageIndex === imageIndex) {
            groupIndices.push(idx);
        }
    });
    
    const allSelected = groupIndices.every(idx => selectedSplitItems.has(idx));
    
    if (allSelected) {
        groupIndices.forEach(idx => selectedSplitItems.delete(idx));
    } else {
        groupIndices.forEach(idx => selectedSplitItems.add(idx));
    }
    
    const groupElement = document.querySelector(`.split-group[data-image-index="${imageIndex}"]`);
    if (groupElement) {
        groupElement.querySelectorAll('.split-item').forEach(item => {
            const idx = parseInt(item.dataset.index);
            const isSelected = selectedSplitItems.has(idx);
            item.classList.toggle('selected', isSelected);
            const checkbox = item.querySelector('.split-item-checkbox');
            if (checkbox) checkbox.checked = isSelected;
        });
    }
    
    updateSelectionCount();
    
    const action = allSelected ? '取消选择' : '已选择';
    showToast(`${action}第 ${imageIndex + 1} 组的 ${groupIndices.length} 张图片`, 'success');
}

// 删除某一组的拆分结果
function deleteSplitGroup(imageIndex) {
    const groupPieces = splitResults.filter(p => p.imageIndex === imageIndex);
    if (groupPieces.length === 0) {
        showToast('该组已不存在', 'warning');
        return;
    }
    
    if (!confirm(`确定要删除第 ${imageIndex + 1} 组的 ${groupPieces.length} 张拆分图片吗？`)) {
        return;
    }
    
    const indicesToRemove = new Set();
    splitResults.forEach((piece, idx) => {
        if (piece.imageIndex === imageIndex) {
            indicesToRemove.add(idx);
        }
    });
    
    indicesToRemove.forEach(idx => {
        selectedSplitItems.delete(idx);
    });
    
    splitResults = splitResults.filter(p => p.imageIndex !== imageIndex);
    selectedSplitItems.clear();
    
    if (splitResults.length > 0) {
        displaySplitResults();
        showToast(`已删除第 ${imageIndex + 1} 组的拆分结果`, 'success');
    } else {
        const resultSection = document.getElementById('splitResultSection');
        if (resultSection) {
            resultSection.style.display = 'none';
        }
        showToast('已删除所有拆分结果', 'success');
    }
    
    saveSplitDataToCache();
}

// 打开拆分图片（支持切换）
function openSplitImage(index) {
    const images = window._splitGalleryImages || [];
    if (images.length > 0) {
        openImageModal(images[index], images, index);
    }
}

// 切换拆分项选择
function toggleSplitSelection(index) {
    const isSelected = selectedSplitItems.has(index);
    
    if (isSelected) {
        selectedSplitItems.delete(index);
    } else {
        selectedSplitItems.add(index);
    }
    
    const item = document.querySelector(`.split-item[data-index="${index}"]`);
    if (item) {
        const nowSelected = !isSelected;
        item.classList.toggle('selected', nowSelected);
        const checkbox = item.querySelector('.split-item-checkbox');
        if (checkbox) {
            checkbox.checked = nowSelected;
        }
    }
    
    updateSelectionCount();
}

// 更新选中数量显示
function updateSelectionCount() {
    const countEl = document.getElementById('splitSelectionCount');
    if (countEl) {
        countEl.textContent = `已选择 ${selectedSplitItems.size}/${splitResults.length} 张`;
    }
}

// 全选拆分图片
function selectAllSplitImages() {
    splitResults.forEach((_, idx) => selectedSplitItems.add(idx));
    
    document.querySelectorAll('.split-item').forEach(item => {
        item.classList.add('selected');
        const checkbox = item.querySelector('.split-item-checkbox');
        if (checkbox) checkbox.checked = true;
    });
    
    updateSelectionCount();
    showToast(`已全选 ${splitResults.length} 张拆分图片`, 'success');
}

// 取消全选
function deselectAllSplitImages() {
    selectedSplitItems.clear();
    
    document.querySelectorAll('.split-item').forEach(item => {
        item.classList.remove('selected');
        const checkbox = item.querySelector('.split-item-checkbox');
        if (checkbox) checkbox.checked = false;
    });
    
    updateSelectionCount();
    showToast('已取消全选', 'info');
}

// 反选拆分图片
function invertSplitSelection() {
    const newSelection = new Set();
    
    splitResults.forEach((_, idx) => {
        if (!selectedSplitItems.has(idx)) {
            newSelection.add(idx);
        }
    });
    
    selectedSplitItems = newSelection;
    
    document.querySelectorAll('.split-item').forEach(item => {
        const idx = parseInt(item.dataset.index);
        const isSelected = selectedSplitItems.has(idx);
        item.classList.toggle('selected', isSelected);
        const checkbox = item.querySelector('.split-item-checkbox');
        if (checkbox) checkbox.checked = isSelected;
    });
    
    updateSelectionCount();
    showToast(`已反选，当前选中 ${selectedSplitItems.size} 张`, 'success');
}

// 将选中的拆分图片用于视频分镜
function useSplitImagesForVideo(mode = 'ref') {
    if (selectedSplitItems.size === 0) {
        showToast('请先选择要使用的图片', 'warning');
        return;
    }

    const indices = Array.from(selectedSplitItems).sort((a, b) => a - b);
    
    indices.forEach((idx, i) => {
        if (i < videoShots.length) {
            const piece = splitResults[idx];
            const thumb = piece.thumbnailUrl || piece.dataUrl;
            
            if (mode === 'first') {
                videoShots[i].firstFrame = piece.dataUrl;
                videoShots[i].firstFrameThumb = thumb;
            } else {
                if (!videoShots[i].refImages) {
                    videoShots[i].refImages = [];
                }
                if (!videoShots[i].refImageThumbs) {
                    videoShots[i].refImageThumbs = [];
                }
                videoShots[i].refImages[0] = piece.dataUrl;
                videoShots[i].refImageThumbs[0] = thumb;
            }
        }
    });

    renderVideoShots();
    const targetName = mode === 'first' ? '首帧' : '参考帧';
    showToast(`已添加 ${Math.min(indices.length, videoShots.length)} 张图片到视频分镜的${targetName}`, 'success');
    
    document.getElementById('videoSection').scrollIntoView({ behavior: 'smooth' });
}
