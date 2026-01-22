/**
 * 下载模块
 * 负责拆分图片的下载功能
 */

// 更新下载配置
function updateDownloadConfig() {
    const prefixEl = document.getElementById('downloadPrefix');
    const timestampEl = document.getElementById('downloadTimestamp');
    
    if (prefixEl) {
        downloadConfig.prefix = prefixEl.value.trim();
    }
    if (timestampEl) {
        downloadConfig.useTimestamp = timestampEl.checked;
    }
}

// 选择下载目录
async function selectDownloadDirectory() {
    try {
        // 检查浏览器是否支持 File System Access API
        if (!('showDirectoryPicker' in window)) {
            showToast('您的浏览器不支持选择目录功能，请使用 Chrome/Edge 浏览器', 'warning');
            return;
        }
        
        // 弹出目录选择对话框
        downloadDirectoryHandle = await window.showDirectoryPicker({
            mode: 'readwrite'
        });
        
        // 更新显示
        const pathEl = document.getElementById('selectedDirPath');
        if (pathEl) {
            pathEl.textContent = `✅ 已选择: ${downloadDirectoryHandle.name}`;
            pathEl.style.color = '#4ade80';
        }
        
        showToast(`已选择保存目录: ${downloadDirectoryHandle.name}`, 'success');
    } catch (error) {
        if (error.name === 'AbortError') {
            return;
        }
        console.error('选择目录失败:', error);
        showToast('选择目录失败: ' + error.message, 'error');
    }
}

// 将 Base64 转换为 Blob
function base64ToBlob(base64Data, mimeType) {
    const base64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

// 保存文件到选定目录
async function saveFileToDirectory(filename, blob) {
    if (!downloadDirectoryHandle) {
        throw new Error('未选择保存目录');
    }
    
    const fileHandle = await downloadDirectoryHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
}

// 生成下载文件名
function getDownloadFilename(baseName, ext, imageName = null) {
    let filename = '';
    
    if (downloadConfig.prefix) {
        filename += downloadConfig.prefix;
    }
    
    if (imageName) {
        filename += imageName + '_';
    }
    
    filename += baseName;
    
    if (downloadConfig.useTimestamp) {
        const now = new Date();
        const timestamp = `_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
        filename += timestamp;
    }
    
    if (upscaleEnabled) {
        filename += `_${upscaleConfig.scale}x`;
    }
    
    return `${filename}.${ext}`;
}

// 动态加载 JSZip 库
function loadJSZip() {
    return new Promise((resolve, reject) => {
        if (typeof JSZip !== 'undefined') {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('加载 JSZip 失败'));
        document.head.appendChild(script);
    });
}

// 下载所有拆分图片
async function downloadAllSplitImages() {
    if (splitResults.length === 0) {
        showToast('没有可下载的图片', 'warning');
        return;
    }

    try {
        if (typeof JSZip === 'undefined') {
            await loadJSZip();
        }
        
        const zip = new JSZip();
        
        const alreadyUpscaled = splitResults.some(piece => piece.upscaled === true);
        const needUpscale = upscaleEnabled && !alreadyUpscaled;
        
        const folderName = (alreadyUpscaled || needUpscale) ? '拆分图片_AI放大' : '拆分图片';
        const rootFolder = zip.folder(folderName);
        
        let imagesToDownload = splitResults.map(piece => piece.dataUrl);
        
        if (needUpscale) {
            showLoading(`正在 AI 放大图片 (0/${splitResults.length})...`);
            
            try {
                imagesToDownload = await upscaleImages(imagesToDownload, (current, total) => {
                    showLoading(`正在 AI 放大图片 (${current}/${total})...`);
                });
                showToast(`✅ ${splitResults.length} 张图片放大完成`, 'success');
            } catch (error) {
                console.error('AI 放大过程出错:', error);
                showToast('部分图片放大失败，将使用原图', 'warning');
            }
        } else if (alreadyUpscaled) {
            showToast('图片已在拆分时放大，直接下载', 'info');
        }
        
        showLoading('正在打包图片...');
        
        const isMultiImage = splitSourceImages.length > 1;
        const wasUpscaled = alreadyUpscaled || needUpscale;
        const scaleLabel = wasUpscaled ? `_${upscaleConfig.scale}x` : '';
        
        for (let i = 0; i < splitResults.length; i++) {
            const piece = splitResults[i];
            const ext = wasUpscaled ? 'png' : (piece.format === 'jpeg' ? 'jpg' : piece.format);
            const baseName = `R${piece.row}C${piece.col}`;
            
            let filename;
            let targetFolder;
            if (isMultiImage && piece.imageName) {
                targetFolder = rootFolder.folder(piece.imageName);
                filename = `${downloadConfig.prefix}${baseName}${scaleLabel}.${ext}`;
            } else {
                targetFolder = rootFolder;
                filename = `${downloadConfig.prefix}${baseName}${scaleLabel}.${ext}`;
            }
            
            const imageData = imagesToDownload[i];
            const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
            targetFolder.file(filename, base64Data, { base64: true });
        }
        
        const content = await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        
        const zipPrefix = downloadConfig.prefix || '拆分图片_';
        const zipTimestamp = new Date().toISOString().slice(0, 10);
        const zipSuffix = wasUpscaled ? `_AI放大${upscaleConfig.scale}x` : '';
        const imageCountSuffix = isMultiImage ? `_${splitSourceImages.length}张` : '';
        const zipFilename = `${zipPrefix}${zipTimestamp}${imageCountSuffix}${zipSuffix}.zip`;
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = zipFilename;
        link.click();
        
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        
        hideLoading();
        showToast(`已下载 ${splitResults.length} 张图片的压缩包`, 'success');
    } catch (error) {
        hideLoading();
        console.error('打包失败:', error);
        showToast('压缩包创建失败，将逐个下载...', 'warning');
        await downloadSplitImagesOneByOne();
    }
}

// 逐个下载（降级方案）
async function downloadSplitImagesOneByOne() {
    for (let i = 0; i < splitResults.length; i++) {
        const piece = splitResults[i];
        const ext = piece.format === 'jpeg' ? 'jpg' : piece.format;
        const baseName = `R${piece.row}C${piece.col}`;
        const imageName = splitSourceImages.length > 1 ? piece.imageName : null;
        const filename = getDownloadFilename(baseName, ext, imageName);
        
        const link = document.createElement('a');
        link.href = piece.dataUrl;
        link.download = filename;
        link.click();
        
        if (i < splitResults.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
    showToast(`已下载 ${splitResults.length} 张图片`, 'success');
}

// 下载选中的拆分图片
async function downloadSelectedSplitImages() {
    if (selectedSplitItems.size === 0) {
        showToast('请先选择要下载的图片', 'warning');
        return;
    }

    const indices = Array.from(selectedSplitItems).sort((a, b) => a - b);
    let imagesToDownload = indices.map(idx => splitResults[idx].dataUrl);
    const hasUpscaled = indices.some(idx => splitResults[idx].upscaled === true);

    if (downloadDirectoryHandle) {
        showLoading(`正在保存 ${indices.length} 张图片到目录...`);
        let successCount = 0;
        
        try {
            for (let i = 0; i < indices.length; i++) {
                const piece = splitResults[indices[i]];
                const ext = piece.upscaled ? 'png' : (piece.format === 'jpeg' ? 'jpg' : piece.format);
                const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
                const baseName = `R${piece.row}C${piece.col}`;
                const imageName = splitSourceImages.length > 1 ? piece.imageName : null;
                const filename = getDownloadFilename(baseName, ext, imageName);
                
                const blob = base64ToBlob(imagesToDownload[i], mimeType);
                await saveFileToDirectory(filename, blob);
                successCount++;
                
                showLoading(`正在保存图片 (${successCount}/${indices.length})...`);
            }
            
            hideLoading();
            showToast(`✅ 已保存 ${successCount} 张图片到 ${downloadDirectoryHandle.name}`, 'success');
        } catch (error) {
            hideLoading();
            console.error('保存到目录失败:', error);
            showToast('保存失败: ' + error.message + '，将使用浏览器下载', 'warning');
            await downloadSelectedImagesTraditional(indices, imagesToDownload);
        }
    } else {
        await downloadSelectedImagesTraditional(indices, imagesToDownload);
    }
}

// 传统下载方式
async function downloadSelectedImagesTraditional(indices, imagesToDownload) {
    showToast(`正在下载 ${indices.length} 张图片...`, 'info');
    
    for (let i = 0; i < indices.length; i++) {
        const piece = splitResults[indices[i]];
        const ext = piece.upscaled ? 'png' : (piece.format === 'jpeg' ? 'jpg' : piece.format);
        const baseName = `R${piece.row}C${piece.col}`;
        const imageName = splitSourceImages.length > 1 ? piece.imageName : null;
        const filename = getDownloadFilename(baseName, ext, imageName);
        
        const link = document.createElement('a');
        link.href = imagesToDownload[i];
        link.download = filename;
        link.click();
        
        if (i < indices.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    showToast(`已下载 ${indices.length} 张图片`, 'success');
}

// 下载选中的拆分图片为 ZIP
async function downloadSelectedSplitImagesZip() {
    if (selectedSplitItems.size === 0) {
        showToast('请先选择要下载的图片', 'warning');
        return;
    }

    const indices = Array.from(selectedSplitItems).sort((a, b) => a - b);
    
    showLoading(`正在打包 ${indices.length} 张图片...`);
    
    try {
        const zip = new JSZip();
        const prefix = document.getElementById('downloadPrefix')?.value || '';
        
        for (let i = 0; i < indices.length; i++) {
            const piece = splitResults[indices[i]];
            const ext = piece.upscaled ? 'png' : (piece.format === 'jpeg' ? 'jpg' : piece.format);
            const baseName = `R${piece.row}C${piece.col}`;
            const imageName = splitSourceImages.length > 1 ? piece.imageName : null;
            const filename = getDownloadFilename(baseName, ext, imageName);
            
            const dataUrl = piece.dataUrl;
            const base64Data = dataUrl.split(',')[1];
            
            zip.file(filename, base64Data, { base64: true });
            
            showLoading(`正在打包图片 (${i + 1}/${indices.length})...`);
        }
        
        showLoading('正在生成 ZIP 文件...');
        const content = await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const zipFilename = prefix ? `${prefix}_选中_${indices.length}张_${timestamp}.zip` : `拆分图片_选中_${indices.length}张_${timestamp}.zip`;
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = zipFilename;
        link.click();
        URL.revokeObjectURL(link.href);
        
        hideLoading();
        showToast(`✅ 已打包下载 ${indices.length} 张选中图片`, 'success');
    } catch (error) {
        hideLoading();
        console.error('ZIP打包失败:', error);
        showToast('ZIP打包失败: ' + error.message, 'error');
    }
}
