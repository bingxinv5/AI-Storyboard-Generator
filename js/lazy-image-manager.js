/**
 * 懒加载图片管理器
 * 解决大量图片导致内存溢出的问题
 * 
 * 策略：
 * 1. 缓存只存储缩略图（小尺寸）
 * 2. 原图存储到单独的 IndexedDB（按需读取）
 * 3. 支持虚拟滚动，只渲染可视区域
 * 4. LRU 缓存淘汰机制
 */

const LazyImageManager = {
    // 配置
    config: {
        thumbnailMaxSize: 200,      // 缩略图最大尺寸（像素）
        thumbnailQuality: 0.6,       // 缩略图质量
        maxMemoryImages: 100,        // 内存中最多保留的原图数量
        maxCacheSize: 50 * 1024 * 1024, // 缓存最大 50MB
        dbName: 'LazyImageStore',
        dbVersion: 1
    },
    
    // 内存中的原图缓存（LRU）
    _imageCache: new Map(),
    _accessOrder: [],
    
    // IndexedDB 实例
    _db: null,
    
    /**
     * 初始化数据库
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.config.dbName, this.config.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this._db = request.result;
                resolve(this._db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 原图存储（大数据）
                if (!db.objectStoreNames.contains('originals')) {
                    db.createObjectStore('originals', { keyPath: 'id' });
                }
                
                // 缩略图存储（小数据，用于快速加载）
                if (!db.objectStoreNames.contains('thumbnails')) {
                    db.createObjectStore('thumbnails', { keyPath: 'id' });
                }
                
                // 元数据存储
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'id' });
                }
            };
        });
    },
    
    /**
     * 生成缩略图
     */
    generateThumbnail(dataUrl, maxSize = null) {
        maxSize = maxSize || this.config.thumbnailMaxSize;
        
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
                
                resolve(canvas.toDataURL('image/jpeg', this.config.thumbnailQuality));
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
        });
    },
    
    /**
     * 存储图片（自动生成缩略图）
     * @param {string} id - 唯一标识
     * @param {string} originalDataUrl - 原图 base64
     * @param {object} metadata - 额外的元数据
     * @returns {Promise<{id, thumbnail, metadata}>}
     */
    async storeImage(id, originalDataUrl, metadata = {}) {
        if (!this._db) await this.init();
        
        // 生成缩略图
        const thumbnail = await this.generateThumbnail(originalDataUrl);
        
        // 存储原图到 IndexedDB
        await this._storeToDb('originals', { id, data: originalDataUrl, timestamp: Date.now() });
        
        // 存储缩略图到 IndexedDB
        await this._storeToDb('thumbnails', { id, data: thumbnail, timestamp: Date.now() });
        
        // 存储元数据
        const meta = { id, ...metadata, hasOriginal: true, timestamp: Date.now() };
        await this._storeToDb('metadata', meta);
        
        // 添加到内存缓存
        this._addToMemoryCache(id, originalDataUrl);
        
        return { id, thumbnail, metadata: meta };
    },
    
    /**
     * 批量存储图片（优化版）
     */
    async storeImages(images) {
        const results = [];
        for (const { id, dataUrl, metadata } of images) {
            const result = await this.storeImage(id, dataUrl, metadata);
            results.push(result);
        }
        return results;
    },
    
    /**
     * 获取缩略图（快速，用于列表展示）
     */
    async getThumbnail(id) {
        if (!this._db) await this.init();
        
        const record = await this._getFromDb('thumbnails', id);
        return record?.data || null;
    },
    
    /**
     * 批量获取缩略图
     */
    async getThumbnails(ids) {
        const results = {};
        for (const id of ids) {
            results[id] = await this.getThumbnail(id);
        }
        return results;
    },
    
    /**
     * 获取原图（按需加载）
     */
    async getOriginal(id) {
        // 先检查内存缓存
        if (this._imageCache.has(id)) {
            this._updateAccessOrder(id);
            return this._imageCache.get(id);
        }
        
        if (!this._db) await this.init();
        
        // 从 IndexedDB 加载
        const record = await this._getFromDb('originals', id);
        if (record?.data) {
            this._addToMemoryCache(id, record.data);
            return record.data;
        }
        
        return null;
    },
    
    /**
     * 获取元数据
     */
    async getMetadata(id) {
        if (!this._db) await this.init();
        return await this._getFromDb('metadata', id);
    },
    
    /**
     * 获取所有元数据（用于恢复列表，不加载图片数据）
     */
    async getAllMetadata() {
        if (!this._db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction(['metadata'], 'readonly');
            const store = transaction.objectStore('metadata');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },
    
    /**
     * 删除图片
     */
    async deleteImage(id) {
        if (!this._db) await this.init();
        
        await this._deleteFromDb('originals', id);
        await this._deleteFromDb('thumbnails', id);
        await this._deleteFromDb('metadata', id);
        
        this._imageCache.delete(id);
        this._accessOrder = this._accessOrder.filter(i => i !== id);
    },
    
    /**
     * 清空所有数据
     */
    async clearAll() {
        if (!this._db) await this.init();
        
        await this._clearStore('originals');
        await this._clearStore('thumbnails');
        await this._clearStore('metadata');
        
        this._imageCache.clear();
        this._accessOrder = [];
    },
    
    /**
     * 获取缓存统计信息
     */
    async getStats() {
        if (!this._db) await this.init();
        
        const metadata = await this.getAllMetadata();
        
        return {
            totalImages: metadata.length,
            memoryImages: this._imageCache.size,
            maxMemoryImages: this.config.maxMemoryImages
        };
    },
    
    // ==================== 私有方法 ====================
    
    _addToMemoryCache(id, data) {
        // LRU 淘汰
        if (this._imageCache.size >= this.config.maxMemoryImages) {
            const oldestId = this._accessOrder.shift();
            if (oldestId) {
                this._imageCache.delete(oldestId);
            }
        }
        
        this._imageCache.set(id, data);
        this._updateAccessOrder(id);
    },
    
    _updateAccessOrder(id) {
        this._accessOrder = this._accessOrder.filter(i => i !== id);
        this._accessOrder.push(id);
    },
    
    async _storeToDb(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },
    
    async _getFromDb(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    
    async _deleteFromDb(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },
    
    async _clearStore(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }
};

/**
 * 虚拟滚动列表管理器
 * 只渲染可视区域的元素
 */
class VirtualScrollList {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.options = {
            itemHeight: options.itemHeight || 150,
            itemWidth: options.itemWidth || 150,
            columns: options.columns || 4,
            buffer: options.buffer || 2, // 上下缓冲行数
            renderItem: options.renderItem || ((item, index) => `<div>${index}</div>`),
            onItemVisible: options.onItemVisible || null,
            gap: options.gap || 8
        };
        
        this.items = [];
        this.scrollTop = 0;
        this.containerHeight = 0;
        
        this._init();
    }
    
    _init() {
        // 创建滚动容器
        this.scrollContainer = document.createElement('div');
        this.scrollContainer.className = 'virtual-scroll-container';
        this.scrollContainer.style.cssText = `
            overflow-y: auto;
            height: 100%;
            position: relative;
        `;
        
        // 创建内容占位（撑开滚动高度）
        this.spacer = document.createElement('div');
        this.spacer.className = 'virtual-scroll-spacer';
        this.spacer.style.cssText = `
            width: 100%;
            position: relative;
        `;
        
        // 创建可视区域容器
        this.viewport = document.createElement('div');
        this.viewport.className = 'virtual-scroll-viewport';
        this.viewport.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            display: grid;
            grid-template-columns: repeat(${this.options.columns}, 1fr);
            gap: ${this.options.gap}px;
        `;
        
        this.spacer.appendChild(this.viewport);
        this.scrollContainer.appendChild(this.spacer);
        this.container.appendChild(this.scrollContainer);
        
        // 监听滚动
        this.scrollContainer.addEventListener('scroll', this._onScroll.bind(this));
        
        // 监听容器大小变化
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(() => this._updateLayout());
            this.resizeObserver.observe(this.scrollContainer);
        }
    }
    
    setItems(items) {
        this.items = items;
        this._updateLayout();
        this._render();
    }
    
    _updateLayout() {
        this.containerHeight = this.scrollContainer.clientHeight;
        const rowHeight = this.options.itemHeight + this.options.gap;
        const totalRows = Math.ceil(this.items.length / this.options.columns);
        this.spacer.style.height = `${totalRows * rowHeight}px`;
    }
    
    _onScroll() {
        this.scrollTop = this.scrollContainer.scrollTop;
        this._render();
    }
    
    _render() {
        const rowHeight = this.options.itemHeight + this.options.gap;
        const startRow = Math.max(0, Math.floor(this.scrollTop / rowHeight) - this.options.buffer);
        const visibleRows = Math.ceil(this.containerHeight / rowHeight) + this.options.buffer * 2;
        const endRow = Math.min(Math.ceil(this.items.length / this.options.columns), startRow + visibleRows);
        
        const startIndex = startRow * this.options.columns;
        const endIndex = Math.min(this.items.length, endRow * this.options.columns);
        
        // 更新 viewport 位置
        this.viewport.style.top = `${startRow * rowHeight}px`;
        
        // 渲染可见项
        const visibleItems = this.items.slice(startIndex, endIndex);
        this.viewport.innerHTML = visibleItems.map((item, i) => {
            const globalIndex = startIndex + i;
            return this.options.renderItem(item, globalIndex);
        }).join('');
        
        // 触发可见回调（用于懒加载原图）
        if (this.options.onItemVisible) {
            visibleItems.forEach((item, i) => {
                this.options.onItemVisible(item, startIndex + i);
            });
        }
    }
    
    scrollToIndex(index) {
        const row = Math.floor(index / this.options.columns);
        const rowHeight = this.options.itemHeight + this.options.gap;
        this.scrollContainer.scrollTop = row * rowHeight;
    }
    
    refresh() {
        this._updateLayout();
        this._render();
    }
    
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        this.container.innerHTML = '';
    }
}

// 导出到全局
window.LazyImageManager = LazyImageManager;
window.VirtualScrollList = VirtualScrollList;
