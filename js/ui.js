/**
 * UI模块 - 模态框和界面交互
 * AI分镜提示词生成器
 */

// ==================== 图片模态框功能（支持切换） ====================

// 打开图片预览模态框（支持画廊切换）
function openImageModal(imageSrc, imageList = null, startIndex = 0) {
    // 如果提供了图片列表，设置画廊状态
    if (imageList && Array.isArray(imageList) && imageList.length > 0) {
        galleryImages = imageList;
        galleryCurrentIndex = startIndex;
    } else {
        // 单张图片模式
        galleryImages = [imageSrc];
        galleryCurrentIndex = 0;
    }
    
    const hasMultiple = galleryImages.length > 1;
    
    // 创建模态框元素
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.id = 'imageModal';
    modal.onclick = function(e) {
        if (e.target === this) closeImageModal();
    };
    
    modal.innerHTML = `
        <div class="image-modal-content">
            <span class="image-modal-close" onclick="closeImageModal()">&times;</span>
            ${hasMultiple ? `
                <button class="modal-nav-btn modal-prev" onclick="galleryPrev()" title="上一张 (←)">‹</button>
                <button class="modal-nav-btn modal-next" onclick="galleryNext()" title="下一张 (→)">›</button>
                <div class="modal-counter" id="modalCounter">${galleryCurrentIndex + 1} / ${galleryImages.length}</div>
            ` : ''}
            <img src="${galleryImages[galleryCurrentIndex]}" class="image-modal-img" id="modalImage" onclick="event.stopPropagation()">
            <div class="image-modal-actions">
                <button class="btn btn-success" onclick="downloadModalImage()">📥 下载</button>
                <button class="btn btn-primary" onclick="copyModalImage()">📋 复制</button>
                <button class="btn btn-info" onclick="openImageInNewTab()">🔗 新窗口</button>
                <button class="btn btn-warning" onclick="useImageForSplit(galleryImages[galleryCurrentIndex])">✂️ 拆分</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 延迟添加 active 类以触发动画
    requestAnimationFrame(() => {
        modal.classList.add('active');
    });
}

// 画廊上一张
function galleryPrev() {
    if (galleryImages.length <= 1) return;
    galleryCurrentIndex = (galleryCurrentIndex - 1 + galleryImages.length) % galleryImages.length;
    updateModalImage();
}

// 画廊下一张
function galleryNext() {
    if (galleryImages.length <= 1) return;
    galleryCurrentIndex = (galleryCurrentIndex + 1) % galleryImages.length;
    updateModalImage();
}

// 更新模态框中的图片
function updateModalImage() {
    const img = document.getElementById('modalImage');
    const counter = document.getElementById('modalCounter');
    if (img) {
        img.src = galleryImages[galleryCurrentIndex];
    }
    if (counter) {
        counter.textContent = `${galleryCurrentIndex + 1} / ${galleryImages.length}`;
    }
}

// 关闭图片模态框
function closeImageModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
    // 清空画廊状态
    galleryImages = [];
    galleryCurrentIndex = 0;
}

// 点击背景关闭模态框
function closeImageModalOnBackdrop(event) {
    if (event.target.id === 'imageModal' || event.target.classList.contains('image-modal')) {
        closeImageModal();
    }
}

// 下载模态框中的图片
function downloadModalImage() {
    const img = document.getElementById('modalImage');
    if (!img) return;
    
    const link = document.createElement('a');
    link.href = img.src;
    link.download = `图片_${Date.now()}.png`;
    link.click();
    showToast('图片下载中...', 'success');
}

// 复制模态框中的图片到剪贴板
async function copyModalImage() {
    const img = document.getElementById('modalImage');
    if (!img) return;
    
    try {
        let blob;
        if (img.src.startsWith('data:')) {
            const parts = img.src.split(',');
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
            const response = await fetch(img.src);
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

// 在新标签页打开图片
function openImageInNewTab() {
    const img = document.getElementById('modalImage');
    if (!img) return;
    
    // 创建新窗口显示图片
    if (img.src.startsWith('data:')) {
        const newWindow = window.open('', '_blank');
        if (newWindow) {
            newWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>图片预览</title>
                    <style>
                        body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #1a1a2e; }
                        img { max-width: 100%; max-height: 100vh; object-fit: contain; }
                    </style>
                </head>
                <body>
                    <img src="${img.src}" alt="预览图片">
                </body>
                </html>
            `);
            newWindow.document.close();
        }
    } else {
        window.open(img.src, '_blank');
    }
}

// 别名函数（用于兼容旧代码）
function openModalImageInNewTab() {
    openImageInNewTab();
}

// 键盘事件 - ESC关闭模态框，左右箭头切换图片
document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('imageModal');
    if (!modal) return;
    
    if (e.key === 'Escape') {
        closeImageModal();
    } else if (e.key === 'ArrowLeft') {
        galleryPrev();
    } else if (e.key === 'ArrowRight') {
        galleryNext();
    }
});

// ==================== 全局Loading ====================

// 紧急关闭Loading
function emergencyCloseLoading(event) {
    if (event) event.stopPropagation();
    hideLoading();
    showToast('已强制关闭加载状态', 'info');
}
