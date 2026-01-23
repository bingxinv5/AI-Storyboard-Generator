/**
 * API调用模块 - 代理和API请求相关
 * AI分镜提示词生成器
 */

// ==================== 代理服务器相关 ====================

// 切换强制代理模式
function toggleForceProxy(enabled) {
    forceProxyEnabled = enabled;
    localStorage.setItem('forceProxy', enabled ? 'true' : 'false');
    if (enabled) {
        proxyServerAvailable = true;
        updateProxyStatus(true);
        checkProxyServerReal().then(available => {
            if (!available) {
                showProxyWarning();
            } else {
                showToast('✅ 已启用强制代理模式，代理服务器运行正常', 'success');
            }
        });
    } else {
        proxyWarningShown = false;
        checkProxyServer();
        showToast('已关闭强制代理模式', 'info');
    }
}

// 显示代理服务器未运行的警告
function showProxyWarning() {
    if (proxyWarningShown) return;
    proxyWarningShown = true;
    
    const warningHtml = `
        <div id="proxyWarningModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center;">
            <div style="background: linear-gradient(135deg, #2a2a4a 0%, #1a1a2e 100%); border-radius: 16px; padding: 30px; max-width: 500px; margin: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
                <h3 style="margin: 0 0 15px 0; color: #ff6b6b; font-size: 20px;">⚠️ 代理服务器未运行</h3>
                <p style="color: #ccc; line-height: 1.6; margin-bottom: 20px;">
                    您已启用强制代理模式，但本地代理服务器未检测到。<br>
                    API请求可能会失败。
                </p>
                <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="color: #aaa; margin: 0 0 10px 0; font-size: 13px;">请选择以下方式启动代理：</p>
                    <p style="color: #4ecdc4; margin: 0; font-size: 14px;">
                        📁 双击运行 <code style="background: rgba(255,255,255,0.1); padding: 3px 8px; border-radius: 4px;">启动代理服务器.bat</code>
                    </p>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;">
                    <button onclick="switchToDirectMode()" style="padding: 10px 20px; border: 1px solid #f093fb; background: transparent; color: #f093fb; border-radius: 8px; cursor: pointer;">
                        🔗 切换到直连模式
                    </button>
                    <button onclick="closeProxyWarning()" style="padding: 10px 20px; border: 1px solid #666; background: transparent; color: #aaa; border-radius: 8px; cursor: pointer;">
                        稍后处理
                    </button>
                    <button onclick="retryProxyCheck()" style="padding: 10px 20px; border: none; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; cursor: pointer; font-weight: bold;">
                        🔄 重新检测
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', warningHtml);
}

// 切换到直连模式
function switchToDirectMode() {
    closeProxyWarning();
    const checkbox = document.getElementById('forceProxy');
    if (checkbox) checkbox.checked = false;
    forceProxyEnabled = false;
    localStorage.setItem('forceProxy', 'false');
    proxyServerAvailable = false;
    updateProxyStatus(false);
    showToast('✅ 已切换到直连模式，将直接访问 API', 'success');
}

// 关闭代理警告
function closeProxyWarning() {
    const modal = document.getElementById('proxyWarningModal');
    if (modal) modal.remove();
}

// 重新检测代理
async function retryProxyCheck() {
    closeProxyWarning();
    proxyWarningShown = false;
    const available = await checkProxyServerReal();
    if (available) {
        showToast('✅ 代理服务器已连接', 'success');
        updateProxyStatus(true);
    } else {
        showProxyWarning();
    }
}

// 真实检测代理服务器（不受强制代理影响）
async function checkProxyServerReal() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch(`${PROXY_SERVER_URL}/health-check`, {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        return false;
    }
}

// 初始化强制代理设置
async function initForceProxy() {
    const saved = localStorage.getItem('forceProxy');
    if (saved === 'true') {
        forceProxyEnabled = true;
        const checkbox = document.getElementById('forceProxy');
        if (checkbox) checkbox.checked = true;
        
        // 立即检测代理服务器是否真正可用
        const available = await checkProxyServerReal();
        if (available) {
            proxyServerAvailable = true;
            updateProxyStatus(true);
            console.log('✅ 强制代理模式已启用，代理服务器运行正常');
        } else {
            // 代理不可用，但仍然保持强制代理标记（用户可能稍后启动代理）
            proxyServerAvailable = false;
            updateProxyStatus(false);
            showProxyWarning();
            console.warn('⚠️ 强制代理模式已启用，但代理服务器未检测到');
        }
    }
}

// 检测代理服务器是否可用
function updateProxyStatus(available) {
    const statusEl = document.getElementById('proxyStatus');
    if (statusEl) {
        if (available) {
            statusEl.innerHTML = '<span style="color: #4CAF50;">🟢 代理已连接</span>';
        } else {
            statusEl.innerHTML = '<span style="color: #888;">⚪ 直连模式</span>';
        }
    }
}

async function checkProxyServer() {
    if (forceProxyEnabled) {
        proxyServerAvailable = true;
        updateProxyStatus(true);
        return true;
    }
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch(`${PROXY_SERVER_URL}/health-check`, {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        proxyServerAvailable = true;
        updateProxyStatus(true);
        return true;
    } catch (error) {
        if (error.name !== 'AbortError') {
            try {
                const controller2 = new AbortController();
                const timeoutId2 = setTimeout(() => controller2.abort(), 2000);
                
                await fetch(`${PROXY_SERVER_URL}/`, {
                    method: 'OPTIONS',
                    signal: controller2.signal
                });
                
                clearTimeout(timeoutId2);
                proxyServerAvailable = true;
                updateProxyStatus(true);
                return true;
            } catch (e) {
                console.log('代理服务器不可用，将使用直连模式');
            }
        }
        proxyServerAvailable = false;
        updateProxyStatus(false);
        return false;
    }
}

// ==================== API URL 获取 ====================

async function getVideoApiBaseUrlAsync() {
    const userConfiguredUrl = document.getElementById('videoApiBaseUrl').value.trim();
    
    // 如果用户配置了 localhost 或本地地址，直接使用
    if (userConfiguredUrl && (userConfiguredUrl.includes('localhost') || userConfiguredUrl.includes('127.0.0.1'))) {
        return userConfiguredUrl;
    }
    
    if (proxyServerAvailable === null) {
        await checkProxyServer();
    }
    
    // 如果强制代理开启，必须使用代理
    if (forceProxyEnabled) {
        const reallyAvailable = await checkProxyServerReal();
        if (reallyAvailable) {
            return PROXY_SERVER_URL;
        } else {
            // 强制代理模式下，代理不可用则抛出错误
            showProxyWarning();
            throw new Error('代理服务器未运行，请先启动代理服务器');
        }
    }
    
    // 代理可用时优先使用代理
    if (proxyServerAvailable) {
        return PROXY_SERVER_URL;
    }
    
    // 使用用户配置的 URL 或默认地址
    return userConfiguredUrl || 'https://api.bltcy.ai';
}

function getVideoApiBaseUrl() {
    // 如果强制代理模式开启，必须使用代理地址
    if (typeof forceProxyEnabled !== 'undefined' && forceProxyEnabled) {
        return PROXY_SERVER_URL;
    }
    
    const userConfiguredUrl = document.getElementById('videoApiBaseUrl')?.value?.trim();
    
    if (userConfiguredUrl) {
        return userConfiguredUrl;
    }
    
    if (proxyServerAvailable) {
        return PROXY_SERVER_URL;
    }
    return 'https://api.bltcy.ai';
}

async function getImageApiBaseUrlAsync() {
    const userConfiguredUrl = document.getElementById('apiBaseUrl').value.trim();
    
    // 检查代理状态
    if (proxyServerAvailable === null) {
        await checkProxyServer();
    }
    
    // 如果用户配置了 localhost 或本地地址，直接使用
    if (userConfiguredUrl && (userConfiguredUrl.includes('localhost') || userConfiguredUrl.includes('127.0.0.1'))) {
        return userConfiguredUrl;
    }
    
    // 如果强制代理开启，必须使用代理
    if (forceProxyEnabled) {
        const reallyAvailable = await checkProxyServerReal();
        if (reallyAvailable) {
            return PROXY_SERVER_URL + '/v1';
        } else {
            // 强制代理模式下，代理不可用则抛出错误
            showProxyWarning();
            throw new Error('代理服务器未运行，请先启动代理服务器');
        }
    }
    
    // 代理可用时优先使用代理
    if (proxyServerAvailable) {
        return PROXY_SERVER_URL + '/v1';
    }
    
    // 没有代理时使用用户配置的URL
    if (userConfiguredUrl) {
        if (userConfiguredUrl.endsWith('/v1') || userConfiguredUrl.includes('/v1/')) {
            return userConfiguredUrl;
        }
        return userConfiguredUrl + '/v1';
    }
    
    return 'https://api.bltcy.ai/v1';
}

// ==================== Gemini API 调用 ====================

async function processImage(base64Data) {
    if (!imageProcessConfig.enableCompression) {
        return base64Data;
    }
    
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > imageProcessConfig.maxWidth) {
                height = (height * imageProcessConfig.maxWidth) / width;
                width = imageProcessConfig.maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            let quality = imageProcessConfig.quality;
            let result = canvas.toDataURL('image/jpeg', quality);
            
            while (result.length / 1024 > imageProcessConfig.maxSizeKB && quality > 0.3) {
                quality -= 0.1;
                result = canvas.toDataURL('image/jpeg', quality);
            }

            resolve(result);
        };
        img.onerror = () => resolve(base64Data);
        img.src = base64Data;
    });
}

async function callGeminiAPI(prompt, imageBase64 = null, retryCount = 0) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('请先输入 API Key');
    }

    const model = getModel();
    const apiBaseUrl = getApiBaseUrl();
    const url = `${apiBaseUrl}/chat/completions`;

    let content = [];
    
    if (imageBase64) {
        const processedImage = await processImage(imageBase64);
        content.push({
            type: 'image_url',
            image_url: {
                url: processedImage
            }
        });
    }
    
    content.push({
        type: 'text',
        text: prompt
    });

    const requestBody = {
        model: model,
        messages: [
            {
                role: 'user',
                content: content
            }
        ],
        max_tokens: 2048,
        temperature: 0.7
    };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const responseText = await response.text();

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

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            throw new Error('API响应格式错误，无法解析JSON');
        }

        const result = data.choices?.[0]?.message?.content;
        if (!result) {
            throw new Error('API响应中没有找到内容');
        }

        return result;
    } catch (error) {
        if ((error.name === 'TypeError' || error.name === 'AbortError') && retryCount < 3) {
            showToast(`网络波动，正在重试 (${retryCount + 1}/3)...`, 'info');
            await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
            
            if (imageBase64 && !imageProcessConfig.enableCompression) {
                imageProcessConfig.enableCompression = true;
            }
            
            return callGeminiAPI(prompt, imageBase64, retryCount + 1);
        }
        
        imageProcessConfig.enableCompression = false;
        throw error;
    }
}

async function testApiConnection() {
    const apiKey = getApiKey();
    if (!apiKey) {
        showToast('请先输入 API Key', 'error');
        return;
    }

    // 如果强制代理模式开启，先检查代理是否可用
    if (forceProxyEnabled) {
        showLoading('正在检查代理服务器...');
        const proxyOk = await checkProxyServerReal();
        if (!proxyOk) {
            hideLoading();
            showToast('❌ 代理服务器未运行，请先启动代理服务器', 'error');
            document.getElementById('apiStatus').className = 'api-status disconnected';
            document.getElementById('apiStatus').innerHTML = '<span class="status-dot"></span><span>代理未连接</span>';
            showProxyWarning();
            return;
        }
        // 更新代理状态
        proxyServerAvailable = true;
        updateProxyStatus(true);
    }

    showLoading('正在测试API连接...');
    
    try {
        const result = await callGeminiAPI('请回复"连接成功"四个字');
        
        apiConnected = true;
        document.getElementById('apiStatus').className = 'api-status connected';
        document.getElementById('apiStatus').innerHTML = '<span class="status-dot"></span><span>已连接</span>';
        
        const usedUrl = getApiBaseUrl();
        const isUsingProxy = usedUrl.includes('localhost') || usedUrl.includes('127.0.0.1');
        showToast(`API连接成功！${isUsingProxy ? '（通过代理）' : '（直连）'}`, 'success');
        
        localStorage.setItem('geminiApiKey', apiKey);
        localStorage.setItem('apiBaseUrl', getApiBaseUrl());
        localStorage.setItem('videoApiBaseUrl', getVideoApiBaseUrl());
    } catch (error) {
        apiConnected = false;
        document.getElementById('apiStatus').className = 'api-status disconnected';
        document.getElementById('apiStatus').innerHTML = '<span class="status-dot"></span><span>连接失败</span>';
        showToast('连接失败: ' + error.message, 'error');
    }
    
    hideLoading();
}

// 分析单张图片
async function analyzeImage(imageBase64) {
    const prompt = `请分析这张图片，用简洁的中文描述：
1. 图片中的主要人物/角色（外貌、服装、姿态）
2. 场景环境（地点、氛围、光线）
3. 整体风格（写实/动漫/插画等）

请用一段话概括，不超过100字，直接输出描述内容，不要加任何前缀。`;

    return await callGeminiAPI(prompt, imageBase64);
}

async function generateShotDescription(shotType, sceneContext, imageBase64 = null) {
    const shotDesc = shotTypePrompts[shotType] || '中景镜头';
    
    let prompt = `你是一位专业的分镜师。根据以下信息，生成一个镜头的画面描述：

场景背景：${sceneContext || '未指定场景'}
镜头类型：${shotDesc}

要求：
1. 描述应该具体、生动，包含人物动作、表情、环境细节
2. 与场景背景保持一致性
3. 用中文输出，不超过50字
4. 直接输出描述内容，不要加任何前缀或序号`;

    if (imageBase64) {
        prompt = `你是一位专业的分镜师。请根据这张参考图片和以下要求，生成一个镜头的画面描述：

镜头类型：${shotDesc}

要求：
1. 基于图片中的人物/场景特征
2. 按照指定的镜头类型（${shotType}）进行构图描述
3. 描述应该具体、生动，包含人物动作、表情、环境细节
4. 用中文输出，不超过50字
5. 直接输出描述内容，不要加任何前缀或序号`;
    }

    return await callGeminiAPI(prompt, imageBase64);
}
