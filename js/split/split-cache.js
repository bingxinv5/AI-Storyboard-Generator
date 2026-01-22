/**
 * 缓存模块
 * 负责拆分数据的 IndexedDB 缓存
 */

const SPLIT_DB_NAME = 'SplitImageCache';
const SPLIT_STORE_NAME = 'splitData';
const SPLIT_DB_VERSION = 1;

// 打开/创建 IndexedDB 数据库
function openSplitDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(SPLIT_DB_NAME, SPLIT_DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(SPLIT_STORE_NAME)) {
                db.createObjectStore(SPLIT_STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

// 保存拆分数据到 IndexedDB
async function saveSplitDataToCache() {
    try {
        const db = await openSplitDB();
        
        const cacheData = {
            id: 'splitCache',
            sourceImages: splitSourceImages,
            results: splitResults,
            selectedItems: Array.from(selectedSplitItems),
            upscaleEnabled: upscaleEnabled,
            timestamp: Date.now()
        };
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([SPLIT_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(SPLIT_STORE_NAME);
            const request = store.put(cacheData);
            
            request.onsuccess = () => {
                db.close();
                resolve(true);
            };
            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('保存拆分缓存失败:', error);
        return false;
    }
}

// 从 IndexedDB 加载拆分数据
async function loadSplitDataFromCache() {
    try {
        const db = await openSplitDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([SPLIT_STORE_NAME], 'readonly');
            const store = transaction.objectStore(SPLIT_STORE_NAME);
            const request = store.get('splitCache');
            
            request.onsuccess = () => {
                db.close();
                const data = request.result;
                
                if (!data) {
                    resolve(false);
                    return;
                }
                
                // 检查缓存是否过期（24小时）
                if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
                    clearSplitCache();
                    resolve(false);
                    return;
                }
                
                // 检查数据数量，防止内存溢出（不使用 JSON.stringify 避免内存问题）
                const sourceCount = data.sourceImages?.length || 0;
                const resultCount = data.results?.length || 0;
                
                // 如果数据量过大，直接清除缓存
                if (sourceCount > 100 || resultCount > 500) {
                    console.warn(`缓存数据过大 (源图:${sourceCount}, 结果:${resultCount})，清除缓存`);
                    clearSplitCache();
                    resolve(false);
                    return;
                }
                
                // 限制加载的图片数量，防止内存溢出
                const maxSourceImages = 50;
                const maxResults = 200;
                
                // 恢复数据
                if (data.sourceImages && data.sourceImages.length > 0) {
                    splitSourceImages = data.sourceImages.slice(0, maxSourceImages);
                    splitSourceImage = splitSourceImages[0]?.dataUrl || null;
                    if (data.sourceImages.length > maxSourceImages) {
                        console.warn(`源图片过多，只加载前 ${maxSourceImages} 张`);
                    }
                }
                
                if (data.results && data.results.length > 0) {
                    splitResults = data.results.slice(0, maxResults);
                    if (data.results.length > maxResults) {
                        console.warn(`拆分结果过多，只加载前 ${maxResults} 个`);
                    }
                }
                
                if (data.selectedItems) {
                    selectedSplitItems = new Set(data.selectedItems);
                }
                
                // 恢复 AI 放大设置
                if (data.upscaleEnabled !== undefined) {
                    upscaleEnabled = data.upscaleEnabled;
                    const checkbox = document.getElementById('upscaleEnabled');
                    if (checkbox) {
                        checkbox.checked = upscaleEnabled;
                        toggleUpscale(upscaleEnabled);
                    }
                }
                
                resolve(true);
            };
            
            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('加载拆分缓存失败:', error);
        return false;
    }
}

// 清除拆分缓存
async function clearSplitCache() {
    try {
        const db = await openSplitDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([SPLIT_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(SPLIT_STORE_NAME);
            const request = store.delete('splitCache');
            
            request.onsuccess = () => {
                db.close();
                resolve(true);
            };
            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('清除拆分缓存失败:', error);
        return false;
    }
}

// 初始化时恢复缓存
async function initSplitFromCache() {
    try {
        const loaded = await loadSplitDataFromCache();
        if (loaded) {
            updateSplitSourcePreview();
            
            if (splitResults.length > 0) {
                const layout = document.getElementById('splitLayout')?.value || '3x3';
                const [rows, cols] = layout.split('x').map(Number);
                const imageCount = new Set(splitResults.map(r => r.imageIndex)).size || 1;
                displaySplitResults(rows, cols, imageCount);
                
                showToast('已恢复上次的拆分数据', 'info');
            } else if (splitSourceImages.length > 0) {
                showToast('已恢复上次上传的图片', 'info');
            }
        }
    } catch (error) {
        console.error('初始化拆分缓存失败:', error);
    }
}

// 防抖保存缓存（避免频繁写入）
let _splitCacheSaveTimer = null;
function debouncedSaveSplitCache() {
    if (_splitCacheSaveTimer) {
        clearTimeout(_splitCacheSaveTimer);
    }
    _splitCacheSaveTimer = setTimeout(() => {
        _splitCacheSaveTimer = null;
        saveSplitDataToCache().catch(err => console.warn('缓存保存失败:', err));
    }, 1000);
}
