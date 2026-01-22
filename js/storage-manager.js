/**
 * StorageManager - IndexedDB 大容量存储管理器
 * 支持存储大量图片、视频等二进制数据
 * 容量：通常 50MB - 数GB（取决于浏览器和磁盘空间）
 */

class StorageManager {
    constructor(dbName = 'StoryboardDB', version = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
        this.isReady = false;
        this.readyPromise = this.init();
    }

    /**
     * 初始化数据库
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = (event) => {
                console.error('❌ IndexedDB 打开失败:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.isReady = true;
                console.log('✅ IndexedDB 已连接:', this.dbName);
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                console.log('📦 IndexedDB 升级/创建数据库结构...');
                const db = event.target.result;

                // 1. 项目元数据存储（小数据，如设置、索引等）
                if (!db.objectStoreNames.contains('metadata')) {
                    const metaStore = db.createObjectStore('metadata', { keyPath: 'key' });
                    metaStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('  - 创建 metadata 存储');
                }

                // 2. 参考图片存储（原始上传的图片）
                if (!db.objectStoreNames.contains('refImages')) {
                    const refStore = db.createObjectStore('refImages', { keyPath: 'id' });
                    refStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('  - 创建 refImages 存储');
                }

                // 3. 生成的图片存储（AI生成的图片）
                if (!db.objectStoreNames.contains('generatedImages')) {
                    const genStore = db.createObjectStore('generatedImages', { keyPath: 'id' });
                    genStore.createIndex('refImageId', 'refImageId', { unique: false });
                    genStore.createIndex('layout', 'layout', { unique: false });
                    genStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('  - 创建 generatedImages 存储');
                }

                // 4. 视频分镜数据存储
                if (!db.objectStoreNames.contains('videoShots')) {
                    const videoStore = db.createObjectStore('videoShots', { keyPath: 'id' });
                    videoStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('  - 创建 videoShots 存储');
                }

                // 5. 生成的视频存储
                if (!db.objectStoreNames.contains('generatedVideos')) {
                    const vidGenStore = db.createObjectStore('generatedVideos', { keyPath: 'id' });
                    vidGenStore.createIndex('shotId', 'shotId', { unique: false });
                    vidGenStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('  - 创建 generatedVideos 存储');
                }

                // 6. 历史记录存储（撤销/重做）
                if (!db.objectStoreNames.contains('history')) {
                    const historyStore = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
                    historyStore.createIndex('timestamp', 'timestamp', { unique: false });
                    historyStore.createIndex('type', 'type', { unique: false });
                    console.log('  - 创建 history 存储');
                }
            };
        });
    }

    /**
     * 等待数据库就绪
     */
    async ensureReady() {
        if (!this.isReady) {
            await this.readyPromise;
        }
        return this.db;
    }

    // ==================== 通用CRUD操作 ====================

    /**
     * 保存数据到指定存储
     */
    async save(storeName, data) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            // 添加时间戳
            if (!data.timestamp) {
                data.timestamp = Date.now();
            }
            
            const request = store.put(data);
            
            request.onsuccess = () => {
                resolve(data);
            };
            
            request.onerror = (event) => {
                console.error(`❌ 保存到 ${storeName} 失败:`, event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * 批量保存数据
     */
    async saveAll(storeName, dataArray) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            let successCount = 0;
            
            dataArray.forEach(data => {
                if (!data.timestamp) {
                    data.timestamp = Date.now();
                }
                const request = store.put(data);
                request.onsuccess = () => {
                    successCount++;
                };
            });
            
            transaction.oncomplete = () => {
                resolve(successCount);
            };
            
            transaction.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 根据ID获取数据
     */
    async get(storeName, id) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 获取存储中的所有数据
     */
    async getAll(storeName) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = () => {
                resolve(request.result || []);
            };
            
            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 根据索引查询数据
     */
    async getByIndex(storeName, indexName, value) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            
            request.onsuccess = () => {
                resolve(request.result || []);
            };
            
            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 删除数据
     */
    async delete(storeName, id) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            
            request.onsuccess = () => {
                resolve(true);
            };
            
            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 清空存储
     */
    async clear(storeName) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            
            request.onsuccess = () => {
                console.log(`🗑️ 已清空 ${storeName}`);
                resolve(true);
            };
            
            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 获取存储中的数据数量
     */
    async count(storeName) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.count();
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    // ==================== 高级功能 ====================

    /**
     * 保存项目完整状态
     */
    async saveProjectState(state) {
        const projectData = {
            key: 'currentProject',
            ...state,
            timestamp: Date.now()
        };
        
        await this.save('metadata', projectData);
        console.log('💾 项目状态已保存到IndexedDB');
        return projectData;
    }

    /**
     * 加载项目状态
     */
    async loadProjectState() {
        const data = await this.get('metadata', 'currentProject');
        if (data) {
            console.log('📂 从IndexedDB加载项目状态');
        }
        return data;
    }

    /**
     * 保存参考图（包含完整base64数据）
     */
    async saveRefImage(imageData) {
        const refImage = {
            id: imageData.id || Date.now() + Math.random(),
            data: imageData.data,  // base64
            desc: imageData.desc || '',
            analyzed: imageData.analyzed || false,
            shotsData: imageData.shotsData || {},
            promptData: imageData.promptData || {},
            storyMode: imageData.storyMode || false,
            timestamp: Date.now()
        };
        
        await this.save('refImages', refImage);
        return refImage;
    }

    /**
     * 保存生成的图片
     */
    async saveGeneratedImage(refImageId, layout, imageUrl, metadata = {}) {
        const genImage = {
            id: `${refImageId}_${layout}_${Date.now()}`,
            refImageId: refImageId,
            layout: layout,
            url: imageUrl,
            aspectRatio: metadata.aspectRatio || '',
            imageSize: metadata.imageSize || '',
            timestamp: Date.now()
        };
        
        await this.save('generatedImages', genImage);
        return genImage;
    }

    /**
     * 获取参考图的所有生成图片
     */
    async getGeneratedImagesForRef(refImageId) {
        return await this.getByIndex('generatedImages', 'refImageId', refImageId);
    }

    /**
     * 保存视频分镜
     */
    async saveVideoShot(shotData) {
        const shot = {
            id: shotData.id || Date.now(),
            refImage: shotData.refImage || null,
            prompt: shotData.prompt || '',
            status: shotData.status || 'pending',
            timestamp: Date.now()
        };
        
        await this.save('videoShots', shot);
        return shot;
    }

    /**
     * 保存生成的视频
     */
    async saveGeneratedVideo(shotId, videoUrl, metadata = {}) {
        const video = {
            id: `${shotId}_${Date.now()}`,
            shotId: shotId,
            url: videoUrl,
            model: metadata.model || '',
            prompt: metadata.prompt || '',
            duration: metadata.duration || 0,
            timestamp: Date.now()
        };
        
        await this.save('generatedVideos', video);
        return video;
    }

    /**
     * 获取存储使用情况
     */
    async getStorageStats() {
        const stats = {
            refImages: await this.count('refImages'),
            generatedImages: await this.count('generatedImages'),
            videoShots: await this.count('videoShots'),
            generatedVideos: await this.count('generatedVideos'),
            history: await this.count('history')
        };
        
        // 尝试获取存储配额（如果浏览器支持）
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            stats.quota = estimate.quota;
            stats.usage = estimate.usage;
            stats.usagePercent = ((estimate.usage / estimate.quota) * 100).toFixed(2);
        }
        
        return stats;
    }

    /**
     * 导出所有数据为JSON
     */
    async exportAllData() {
        const data = {
            exportTime: new Date().toISOString(),
            version: this.version,
            metadata: await this.getAll('metadata'),
            refImages: await this.getAll('refImages'),
            generatedImages: await this.getAll('generatedImages'),
            videoShots: await this.getAll('videoShots'),
            generatedVideos: await this.getAll('generatedVideos')
        };
        
        return data;
    }

    /**
     * 导入数据
     */
    async importData(data) {
        if (!data || !data.version) {
            throw new Error('无效的导入数据格式');
        }

        console.log('📥 开始导入数据...');
        
        if (data.metadata && data.metadata.length > 0) {
            await this.saveAll('metadata', data.metadata);
            console.log(`  - metadata: ${data.metadata.length} 条`);
        }
        
        if (data.refImages && data.refImages.length > 0) {
            await this.saveAll('refImages', data.refImages);
            console.log(`  - refImages: ${data.refImages.length} 张`);
        }
        
        if (data.generatedImages && data.generatedImages.length > 0) {
            await this.saveAll('generatedImages', data.generatedImages);
            console.log(`  - generatedImages: ${data.generatedImages.length} 张`);
        }
        
        if (data.videoShots && data.videoShots.length > 0) {
            await this.saveAll('videoShots', data.videoShots);
            console.log(`  - videoShots: ${data.videoShots.length} 条`);
        }
        
        if (data.generatedVideos && data.generatedVideos.length > 0) {
            await this.saveAll('generatedVideos', data.generatedVideos);
            console.log(`  - generatedVideos: ${data.generatedVideos.length} 条`);
        }
        
        console.log('✅ 数据导入完成');
        return true;
    }

    /**
     * 清空所有数据
     */
    async clearAllData() {
        await this.clear('metadata');
        await this.clear('refImages');
        await this.clear('generatedImages');
        await this.clear('videoShots');
        await this.clear('generatedVideos');
        await this.clear('history');
        console.log('🗑️ 所有数据已清空');
    }

    /**
     * 删除数据库
     */
    async deleteDatabase() {
        if (this.db) {
            this.db.close();
        }
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(this.dbName);
            
            request.onsuccess = () => {
                console.log('🗑️ 数据库已删除:', this.dbName);
                this.db = null;
                this.isReady = false;
                resolve(true);
            };
            
            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }
}

// 创建全局实例
const storageManager = new StorageManager();

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StorageManager, storageManager };
}
