/**
 * 视频生成API模块
 * 负责视频生成API调用、轮询、任务恢复等
 */

// videoGenerationControllers 已在 state.js 中定义

// 取消视频生成
function cancelVideoGeneration(index) {
    const controller = videoGenerationControllers[index];
    
    // 首先尝试通过任务队列取消任务
    if (typeof taskQueue !== 'undefined') {
        const taskName = `视频分镜${index + 1}`;
        const recoverTaskName = `恢复: 分镜${index + 1}`;
        
        // 查找并取消任务队列中的对应任务（包括恢复任务）
        for (const [taskId, task] of taskQueue.tasks.entries()) {
            if ((task.name === taskName || task.name === recoverTaskName) && 
                (task.status === TaskStatus.PENDING || task.status === TaskStatus.RUNNING)) {
                taskQueue.cancelTask(taskId);
                console.log(`🛑 已通过任务队列取消: ${task.name}`);
                
                // 更新分镜状态
                if (videoShots[index]) {
                    videoShots[index].status = 'pending';
                    videoShots[index].error = null;
                    delete videoShots[index].isRecovering;
                    delete videoShots[index].taskId;
                    delete videoShots[index].taskStartTime;
                    renderVideoShots();
                    autoSave();
                }
                
                showToast(`已取消分镜 ${index + 1} 的视频生成`, 'info');
                return;
            }
        }
    }
    
    // 如果没有在任务队列中找到，直接通过 controller 取消
    if (controller) {
        controller.abort();
        
        // 更新分镜状态
        if (videoShots[index]) {
            videoShots[index].status = 'pending';
            videoShots[index].error = null;
            delete videoShots[index].isRecovering;
            delete videoShots[index].taskId;
            delete videoShots[index].taskStartTime;
            renderVideoShots();
            autoSave();
        }
        
        showToast(`已取消分镜 ${index + 1} 的视频生成`, 'info');
    } else {
        // 如果既不在任务队列中，也没有 controller，可能是刷新后的残留状态
        // 直接重置分镜状态
        if (videoShots[index] && (videoShots[index].status === 'generating' || videoShots[index].status === 'queued')) {
            videoShots[index].status = 'pending';
            videoShots[index].error = null;
            delete videoShots[index].isRecovering;
            delete videoShots[index].taskId;
            delete videoShots[index].taskStartTime;
            renderVideoShots();
            autoSave();
            showToast(`已重置分镜 ${index + 1} 的状态`, 'info');
        }
    }
}

// 生成单个分镜视频
async function generateSingleVideoShot(index) {
    const apiKey = getApiKey();
    if (!apiKey) {
        showToast('请先输入API Key', 'error');
        return;
    }
    
    const shot = videoShots[index];
    const model = document.getElementById('videoModel').value;
    
    if (model === 'veo3.1-components') {
        const hasRefImages = shot.refImages && shot.refImages.some(img => img !== null && img !== undefined);
        if (!hasRefImages) {
            showToast('Components模式需要至少添加1张参考图', 'warning');
            return;
        }
    }
    
    const aspectRatio = document.getElementById('videoAspectRatio').value;
    let prompt = shot.prompt || 'Generate a smooth and natural video';
    let enhancePrompt = document.getElementById('videoEnhancePrompt').checked;
    
    const hasChinese = /[\u4e00-\u9fa5]/.test(prompt);
    if (hasChinese) {
        enhancePrompt = true;
    }

    if (typeof taskQueue !== 'undefined') {
        const taskName = `视频分镜${index + 1}`;
        
        shot.status = 'queued';
        renderVideoShots();
        
        taskQueue.addVideoTask(taskName, async (task, updateProgress) => {
            shot.status = 'generating';
            shot.error = null;
            renderVideoShots();
            
            updateProgress(0, '开始生成视频...');
            
            let progressValue = 0;
            const progressTimer = setInterval(() => {
                if (task.status === TaskStatus.CANCELLED) {
                    clearInterval(progressTimer);
                    shot.status = 'pending';
                    renderVideoShots();
                    return;
                }
                progressValue = Math.min(progressValue + 2, 90);
                const elapsed = Math.floor((Date.now() - task.startedAt) / 1000);
                updateProgress(progressValue, `生成中... (${elapsed}秒)`);
            }, 3000);
            
            const abortController = new AbortController();
            videoGenerationControllers[index] = abortController;
            // 将 abortController 注册到任务对象，以便任务队列可以取消
            task.abortController = abortController;
            
            try {
                const imageMode = getVideoModelImageMode();
                const mode = imageMode.mode;
                let images = [];
                let firstFrame = null;
                let lastFrame = null;
                
                if (mode === 'single') {
                    // Sora: 使用第一个参考图
                    if (shot.refImages && shot.refImages[0]) {
                        images = [shot.refImages[0]];
                    }
                } else if (mode === 'frames') {
                    // Veo 3.1/Pro: 使用首帧和尾帧
                    firstFrame = shot.firstFrame || null;
                    lastFrame = shot.lastFrame || null;
                } else if (mode === 'multi') {
                    // Veo Components: 使用参考图1-3
                    if (shot.refImages) {
                        images = shot.refImages.filter(img => img !== null && img !== undefined);
                    }
                }
                
                if (mode === 'multi' && images.length === 0) {
                    throw new Error('Veo 3.1 Components 模式需要至少添加1张参考图');
                }
                
                const onTaskIdReceived = (taskId) => {
                    shot.taskId = taskId;
                    shot.taskStartTime = Date.now();
                    autoSave();
                };
                
                const result = await callVideoGenerationAPI(model, prompt, images, aspectRatio, enhancePrompt, abortController, onTaskIdReceived, firstFrame, lastFrame);
                
                clearInterval(progressTimer);
                
                delete shot.taskId;
                delete shot.taskStartTime;
                
                if (result && result.videoUrl) {
                    shot.status = 'completed';
                    shot.videoUrl = result.videoUrl;
                    
                    addVideoToHistory(result.videoUrl, `分镜${index + 1}: ${prompt}`, model);
                    
                    updateProgress(100, '生成成功');
                    showToast(`分镜 ${index + 1} 视频生成成功！`, 'success');
                    return result;
                } else {
                    throw new Error('未获取到视频结果');
                }
            } catch (error) {
                clearInterval(progressTimer);
                
                delete shot.taskId;
                delete shot.taskStartTime;
                
                if (error.name === 'AbortError' || error.message.includes('用户取消')) {
                    shot.status = 'pending';
                    shot.error = null;
                } else if (error.isSSLError || error.message.includes('SSL') || error.message.includes('网络')) {
                    shot.status = 'pending';
                    shot.error = '⚠️ 网络不稳定，请用"手动查询"检查任务状态';
                } else {
                    shot.status = 'error';
                    shot.error = error.message;
                }
                throw error;
            } finally {
                delete videoGenerationControllers[index];
                renderVideoShots();
            }
        }, {
            description: `${model} ${aspectRatio}`,
            priority: TaskPriority.NORMAL,
            timeout: 1800000
        });
        
        showToast(`分镜 ${index + 1} 已添加到任务队列`, 'info');
        return;
    }
    
    // 非任务队列模式
    shot.status = 'generating';
    shot.error = null;
    renderVideoShots();
    
    const abortController = new AbortController();
    videoGenerationControllers[index] = abortController;
    
    try {
        const imageMode = getVideoModelImageMode();
        const mode = imageMode.mode;
        let images = [];
        let firstFrame = null;
        let lastFrame = null;
        
        if (mode === 'single') {
            if (shot.refImages && shot.refImages[0]) images = [shot.refImages[0]];
        } else if (mode === 'frames') {
            firstFrame = shot.firstFrame || null;
            lastFrame = shot.lastFrame || null;
        } else if (mode === 'multi') {
            if (shot.refImages) {
                images = shot.refImages.filter(img => img !== null && img !== undefined);
            }
        }
        
        if (mode === 'multi' && images.length === 0) {
            throw new Error('Veo 3.1 Components 模式需要至少添加1张参考图');
        }
        
        const onTaskIdReceived = (taskId) => {
            shot.taskId = taskId;
            shot.taskStartTime = Date.now();
            autoSave();
        };
        
        const result = await callVideoGenerationAPI(model, prompt, images, aspectRatio, enhancePrompt, abortController, onTaskIdReceived, firstFrame, lastFrame);
        
        delete shot.taskId;
        delete shot.taskStartTime;
        
        if (result && result.videoUrl) {
            shot.status = 'completed';
            shot.videoUrl = result.videoUrl;
            
            addVideoToHistory(result.videoUrl, `分镜${index + 1}: ${prompt}`, model);
            
            showToast(`分镜 ${index + 1} 视频生成成功！`, 'success');
        } else {
            throw new Error('未获取到视频结果');
        }
    } catch (error) {
        delete shot.taskId;
        delete shot.taskStartTime;
        
        if (error.name === 'AbortError' || error.message.includes('用户取消')) {
            shot.status = 'pending';
            shot.error = null;
        } else if (error.isSSLError || error.message.includes('SSL') || error.message.includes('网络')) {
            shot.status = 'pending';
            shot.error = '⚠️ 网络不稳定，请用"手动查询"检查任务状态';
            showToast(`分镜 ${index + 1}: 网络不稳定，请检查 API 后台或使用手动查询`, 'warning');
        } else {
            shot.status = 'error';
            shot.error = error.message;
            showToast(`分镜 ${index + 1} 生成失败: ${error.message}`, 'error');
        }
    } finally {
        delete videoGenerationControllers[index];
    }
    
    renderVideoShots();
}

// 批量生成所有分镜视频
async function generateAllVideoShots() {
    const apiKey = getApiKey();
    if (!apiKey) {
        showToast('请先输入API Key', 'error');
        return;
    }
    
    // 检查是否有需要生成的分镜（有参考图或首尾帧，且未完成）
    const shotsWithImage = videoShots.filter(s => {
        const hasRefImages = s.refImages && s.refImages.some(img => img);
        const hasFrames = s.firstFrame || s.lastFrame;
        return (hasRefImages || hasFrames) && s.status !== 'completed';
    });
    if (shotsWithImage.length === 0) {
        showToast('没有需要生成的分镜（请添加参考图或清除已完成的分镜）', 'warning');
        return;
    }
    
    showToast(`开始批量生成 ${shotsWithImage.length} 个分镜视频...`, 'info');
    
    for (let i = 0; i < videoShots.length; i++) {
        const shot = videoShots[i];
        const hasRefImages = shot.refImages && shot.refImages.some(img => img);
        const hasFrames = shot.firstFrame || shot.lastFrame;
        if ((hasRefImages || hasFrames) && shot.status !== 'completed') {
            await generateSingleVideoShot(i);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    const completed = videoShots.filter(s => s.status === 'completed').length;
    showToast(`批量生成完成！成功: ${completed}/${videoShots.length}`, 'success');
}

// 调用视频生成API
async function callVideoGenerationAPI(model, prompt, images, aspectRatio, enhancePrompt, abortController = null, onTaskIdReceived = null, firstFrame = null, lastFrame = null) {
    const apiKey = getApiKey();
    const videoApiBaseUrl = (await getVideoApiBaseUrlAsync()).replace(/\/+$/, '');
    const url = `${videoApiBaseUrl}/v2/videos/generations`;
    
    const isSoraModel = model === 'sora-2' || model === 'sora-2-pro';
    const isVeoFirstLastModel = model === 'veo3.1' || model === 'veo3.1-pro';
    
    let processedImages = [];
    
    if (images && images.length > 0) {
        let maxImages = 1;
        if (model === 'veo3.1-components') {
            maxImages = 3;
        } else if (isSoraModel) {
            maxImages = 1;
        }
        
        processedImages = images.slice(0, maxImages).map(img => {
            if (img.startsWith('data:')) {
                return img;
            }
            return img;
        });
    }
    
    const requestBody = {
        model: model,
        prompt: prompt
    };
    
    if (isSoraModel) {
        const watermarkCheckbox = document.getElementById('videoWatermark');
        const durationSelect = document.getElementById('videoDuration');
        
        if (aspectRatio) {
            requestBody.aspect_ratio = aspectRatio;
        }
        
        if (processedImages.length > 0) {
            requestBody.images = processedImages;
        }
        
        if (durationSelect && durationSelect.value) {
            requestBody.duration = durationSelect.value;
        }
        
        if (watermarkCheckbox) {
            requestBody.watermark = watermarkCheckbox.checked;
        }
        
        if (model === 'sora-2-pro') {
            const hdCheckbox = document.getElementById('videoHd');
            if (hdCheckbox) {
                requestBody.hd = hdCheckbox.checked;
            }
        }
        
        requestBody.private = true;
    } else {
        requestBody.enhance_prompt = enhancePrompt || false;
        
        let veoImages = [];
        
        if (isVeoFirstLastModel) {
            if (firstFrame) {
                veoImages.push(firstFrame);
            }
            if (lastFrame) {
                veoImages.push(lastFrame);
            }
        } else {
            veoImages = processedImages;
        }
        
        requestBody.images = veoImages;
        
        if (aspectRatio) {
            requestBody.aspect_ratio = aspectRatio;
        }
    }

    try {
        const fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        };
        
        if (abortController) {
            fetchOptions.signal = abortController.signal;
        }
        
        let response = null;
        let lastError = null;
        const maxRetries = 3;
        
        for (let retry = 0; retry < maxRetries; retry++) {
            try {
                if (retry > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * retry));
                }
                
                response = await fetch(url, fetchOptions);
                break;
            } catch (fetchError) {
                lastError = fetchError;
                
                if (fetchError.message.includes('Failed to fetch') || fetchError.name === 'TypeError') {
                    showToast('网络连接不稳定，请求可能已发送成功，请检查 API 后台或使用手动查询', 'warning');
                }
                
                if (fetchError.name === 'AbortError') {
                    throw new Error('用户取消了视频生成');
                }
                
                if (retry === maxRetries - 1) {
                    const sslError = new Error(`网络/SSL 连接问题，请求可能已发送成功。请在 API 后台查看 task_id，然后使用页面底部的"手动查询任务"功能。`);
                    sslError.isSSLError = true;
                    throw sslError;
                }
            }
        }
        
        if (!response) {
            throw lastError || new Error('请求失败');
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API错误 (${response.status}): ${errorText}`);
        }

        const data = await response.json();

        if (data.task_id) {
            if (onTaskIdReceived) {
                onTaskIdReceived(data.task_id);
            }
            
            const videoUrl = await pollVideoStatus(data.task_id, apiKey, 120, 5000, abortController);
            return { videoUrl, taskId: data.task_id };
        }
        
        if (data.data && data.data[0]) {
            const result = data.data[0];
            return {
                videoUrl: result.url || result.video_url || result.b64_json
            };
        } else if (data.url || data.video_url) {
            return {
                videoUrl: data.url || data.video_url
            };
        } else {
            throw new Error('未知的API返回格式');
        }
    } catch (error) {
        throw error;
    }
}

// 轮询视频生成状态
async function pollVideoStatus(taskId, apiKey, maxAttempts = 120, interval = 5000, abortController = null) {
    const videoApiBaseUrl = (await getVideoApiBaseUrlAsync()).replace(/\/+$/, '');
    const url = `${videoApiBaseUrl}/v2/videos/generations/${taskId}`;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (abortController && abortController.signal.aborted) {
            throw new Error('用户取消了视频生成');
        }
        
        try {
            const fetchOptions = {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            };
            
            if (abortController) {
                fetchOptions.signal = abortController.signal;
            }
            
            let response = null;
            for (let retry = 0; retry < 3; retry++) {
                try {
                    response = await fetch(url, fetchOptions);
                    break;
                } catch (fetchError) {
                    if (retry < 2) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            }
            
            if (!response) {
                await new Promise(resolve => setTimeout(resolve, interval));
                continue;
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`查询失败: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            const status = data.status ? data.status.toUpperCase() : '';
            
            if (status === 'SUCCESS' || status === 'COMPLETED' || status === 'SUCCEEDED') {
                let videoUrl = null;
                
                if (data.data && data.data.output) {
                    videoUrl = data.data.output;
                } else if (data.output) {
                    videoUrl = data.output;
                } else if (data.video_url || data.url) {
                    videoUrl = data.video_url || data.url;
                } else if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                    videoUrl = data.data[0].url || data.data[0].video_url || data.data[0].output;
                }
                
                if (videoUrl) {
                    return videoUrl;
                } else {
                    throw new Error('任务完成但未找到视频URL');
                }
            } else if (status === 'FAILED' || status === 'ERROR' || status === 'FAILURE') {
                const reason = data.fail_reason || data.error || data.message || '未知错误';
                const finalError = new Error(`视频生成失败: ${reason}`);
                finalError.isFinalFailure = true;
                throw finalError;
            }
            
            const startTime = Date.now();
            while (Date.now() - startTime < interval) {
                if (abortController && abortController.signal.aborted) {
                    throw new Error('用户取消了视频生成');
                }
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
        } catch (error) {
            if (error.name === 'AbortError' || error.message.includes('用户取消')) {
                throw error;
            }
            
            if (error.isFinalFailure) {
                throw error;
            }
            
            if (attempt === maxAttempts - 1) {
                throw error;
            }
            
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }
    
    throw new Error(`视频生成超时（${maxAttempts * interval / 1000 / 60}分钟）`);
}

// 手动查询任务
async function queryManualTask() {
    const taskIdInput = document.getElementById('manualTaskId');
    const taskId = taskIdInput?.value?.trim();
    
    if (!taskId) {
        showToast('请输入 task_id', 'warning');
        return;
    }
    
    const apiKey = getApiKey();
    if (!apiKey) {
        showToast('请先配置 API Key', 'error');
        return;
    }
    
    showToast('正在查询任务状态...', 'info');
    
    try {
        const videoApiBaseUrl = (await getVideoApiBaseUrlAsync()).replace(/\/+$/, '');
        const url = `${videoApiBaseUrl}/v2/videos/generations/${taskId}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`查询失败 (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        const status = data.status ? data.status.toUpperCase() : '未知';
        
        if (status === 'SUCCESS' || status === 'COMPLETED' || status === 'SUCCEEDED') {
            let videoUrl = null;
            
            if (data.data && data.data.output) {
                videoUrl = data.data.output;
            } else if (data.output) {
                videoUrl = data.output;
            } else if (data.video_url || data.url) {
                videoUrl = data.video_url || data.url;
            } else if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                videoUrl = data.data[0].url || data.data[0].video_url || data.data[0].output;
            }
            
            if (videoUrl) {
                showToast('🎉 任务已完成！', 'success');
                
                videoGenerationHistory.unshift({
                    videoUrl: videoUrl,
                    prompt: `手动查询任务: ${taskId}`,
                    model: '手动查询',
                    time: new Date().toLocaleString()
                });
                
                await autoSave();
                updateVideoHistoryDisplay();
                playVideoFromHistory(videoUrl);
                taskIdInput.value = '';
            } else {
                showToast('任务完成但未找到视频URL', 'warning');
            }
        } else if (status === 'FAILED' || status === 'ERROR' || status === 'FAILURE') {
            const reason = data.fail_reason || data.error || data.message || '未知错误';
            showToast(`任务失败: ${reason}`, 'error');
        } else if (status === 'PROCESSING' || status === 'PENDING' || status === 'RUNNING') {
            const progress = data.progress || '进行中';
            showToast(`任务进行中 (${progress})，请稍后再查询`, 'info');
        } else {
            showToast(`任务状态: ${status}`, 'info');
        }
    } catch (error) {
        showToast(`查询失败: ${error.message}`, 'error');
    }
}

// 恢复中断的任务标志
let isRecoveringTasks = false;

// 恢复待处理的视频任务
async function resumePendingVideoTasks() {
    if (isRecoveringTasks) {
        return;
    }
    isRecoveringTasks = true;
    
    try {
        const tasksToResume = [];
        
        videoShots.forEach((shot, index) => {
            if (shot.taskId && !shot.isRecovering && (shot.status === 'generating' || shot.status === 'queued')) {
                tasksToResume.push({
                    index,
                    taskId: shot.taskId,
                    startTime: shot.taskStartTime || Date.now(),
                    prompt: shot.prompt
                });
            }
        });
        
        if (tasksToResume.length === 0) {
            return;
        }
    
        showToast(`正在恢复 ${tasksToResume.length} 个视频生成任务...`, 'info');
        
        const apiKey = getApiKey();
        if (!apiKey) {
            tasksToResume.forEach(task => {
                const shot = videoShots[task.index];
                shot.status = 'pending';
                shot.error = '页面刷新后无法恢复：请重新输入 API Key';
                delete shot.taskId;
                delete shot.taskStartTime;
            });
            renderVideoShots();
            return;
        }
        
        if (typeof taskQueue !== 'undefined') {
            const addedTasks = new Set();
            
            for (const task of tasksToResume) {
                const taskKey = `recover_${task.index}_${task.taskId}`;
                if (addedTasks.has(taskKey)) {
                    continue;
                }
                addedTasks.add(taskKey);
                
                const shot = videoShots[task.index];
                const elapsed = Math.floor((Date.now() - task.startTime) / 1000);
                
                shot.isRecovering = true;
                shot.status = 'queued';
                
                // 使用闭包保存 index，确保取消按钮能正确工作
                const shotIndex = task.index;
                
                taskQueue.addVideoTask(`恢复: 分镜${task.index + 1}`, async (queueTask, updateProgress) => {
                    shot.status = 'generating';
                    renderVideoShots();
                    
                    updateProgress(10, `恢复中... (已耗时 ${elapsed}秒)`);
                    
                    // 创建 abortController 并注册
                    const abortController = new AbortController();
                    videoGenerationControllers[shotIndex] = abortController;
                    queueTask.abortController = abortController;
                    
                    let progressValue = 10;
                    const progressTimer = setInterval(() => {
                        if (queueTask.status === TaskStatus.CANCELLED) {
                            clearInterval(progressTimer);
                            return;
                        }
                        progressValue = Math.min(progressValue + 5, 90);
                        const totalElapsed = Math.floor((Date.now() - task.startTime) / 1000);
                        updateProgress(progressValue, `恢复中... (${totalElapsed}秒)`);
                    }, 3000);
                    
                    try {
                        // 计算剩余的最大轮询次数（假设视频生成最长10分钟）
                        const maxTime = 10 * 60 * 1000; // 10分钟
                        const remainingTime = maxTime - (Date.now() - task.startTime);
                        const maxAttempts = Math.max(10, Math.floor(remainingTime / 5000));
                        
                        // 传递 abortController 以支持取消
                        const videoUrl = await pollVideoStatus(task.taskId, apiKey, maxAttempts, 5000, abortController);
                        
                        clearInterval(progressTimer);
                        
                        if (videoUrl) {
                            shot.status = 'completed';
                            shot.videoUrl = videoUrl;
                            delete shot.taskId;
                            delete shot.taskStartTime;
                            delete shot.isRecovering;
                            
                            addVideoToHistory(videoUrl, `分镜${task.index + 1}: ${shot.prompt || '恢复的任务'}`, '恢复');
                            
                            updateProgress(100, '恢复成功');
                            showToast(`分镜 ${task.index + 1} 视频恢复成功！`, 'success');
                            
                            renderVideoShots();
                            autoSave();
                            return { videoUrl };
                        } else {
                            throw new Error('未获取到视频结果');
                        }
                    } catch (error) {
                        clearInterval(progressTimer);
                        
                        // 检查是否是用户取消
                        if (error.name === 'AbortError' || error.message.includes('用户取消')) {
                            shot.status = 'pending';
                            shot.error = null;
                            delete shot.isRecovering;
                        } else if (error.message.includes('超时') || error.message.includes('not found') || error.message.includes('404')) {
                            shot.status = 'error';
                            shot.error = `task_id: ${task.taskId}`;
                        } else {
                            shot.status = 'error';
                            shot.error = `恢复失败: ${error.message}`;
                        }
                        delete shot.taskId;
                        delete shot.taskStartTime;
                        delete shot.isRecovering;
                        
                        renderVideoShots();
                        autoSave();
                        throw error;
                    } finally {
                        // 清理 controller
                        delete videoGenerationControllers[shotIndex];
                    }
                }, {
                    description: `task_id: ${task.taskId.substring(0, 20)}...`,
                    priority: TaskPriority.HIGH,
                    timeout: 600000
                });
            }
            
            renderVideoShots();
            return;
        }
        
        // 非任务队列模式
        const resumePromises = tasksToResume.map(async (task) => {
            const shot = videoShots[task.index];
            const shotIndex = task.index;
            
            // 创建 abortController 并注册
            const abortController = new AbortController();
            videoGenerationControllers[shotIndex] = abortController;
            
            try {
                const maxTime = 10 * 60 * 1000;
                const remainingTime = maxTime - (Date.now() - task.startTime);
                const maxAttempts = Math.max(10, Math.floor(remainingTime / 5000));
                
                // 传递 abortController 以支持取消
                const videoUrl = await pollVideoStatus(task.taskId, apiKey, maxAttempts, 5000, abortController);
                
                if (videoUrl) {
                    shot.status = 'completed';
                    shot.videoUrl = videoUrl;
                    delete shot.taskId;
                    delete shot.taskStartTime;
                    
                    addVideoToHistory(videoUrl, `分镜${task.index + 1}: ${shot.prompt || '恢复的任务'}`, '恢复');
                    showToast(`分镜 ${task.index + 1} 视频恢复成功！`, 'success');
                } else {
                    throw new Error('未获取到视频结果');
                }
            } catch (error) {
                // 检查是否是用户取消
                if (error.name === 'AbortError' || error.message.includes('用户取消')) {
                    shot.status = 'pending';
                    shot.error = null;
                } else if (error.message.includes('超时') || error.message.includes('not found') || error.message.includes('404')) {
                    shot.status = 'error';
                    shot.error = `task_id: ${task.taskId}`;
                } else {
                    shot.status = 'error';
                    shot.error = `恢复失败: ${error.message}`;
                }
                delete shot.taskId;
                delete shot.taskStartTime;
            } finally {
                // 清理 controller
                delete videoGenerationControllers[shotIndex];
            }
            
            renderVideoShots();
            autoSave();
        });
        
        await Promise.allSettled(resumePromises);
    } finally {
        isRecoveringTasks = false;
    }
}
