/**
 * 分镜生成模块 - 镜头生成和提示词生成
 * AI分镜提示词生成器
 */

// ==================== 综合多图生成分镜 ====================

// 将所有参考图综合分析，一次性生成所有分镜
async function generateShotsFromAllImages() {
    if (!getApiKey()) {
        showToast('请先输入API Key并测试连接', 'error');
        return;
    }
    
    if (refImages.length === 0) {
        showToast('请先上传参考图片', 'warning');
        return;
    }
    
    const { total, layout } = getGridInfo();
    const sceneDesc = document.getElementById('sceneDesc')?.value?.trim() || '';
    const storyContext = document.getElementById('storyContext')?.value?.trim() || '';
    
    showLoading('正在综合分析所有参考图...');
    
    try {
        // 收集所有参考图
        const allImages = [];
        const imageDescriptions = [];
        
        for (let i = 0; i < refImages.length; i++) {
            const img = refImages[i];
            allImages.push(img.data);
            
            // 如果图片没有描述，先简单标记
            const desc = img.desc || `参考图${i + 1}`;
            imageDescriptions.push({
                index: i + 1,
                desc: desc,
                analyzed: !!img.desc
            });
        }
        
        updateLoadingText(`正在用AI分析 ${allImages.length} 张图片，生成 ${total} 个分镜...`);
        
        // 构建综合分析提示词
        const prompt = buildMultiImageShotsPrompt(imageDescriptions, total, sceneDesc, storyContext);
        
        // 调用多图API
        const result = await callGeminiAPIWithMultipleImages(prompt, allImages);
        
        // 解析结果
        const shots = parseMultiImageShotsResult(result, total);
        
        // 填充到分镜设置
        shots.forEach((shot, i) => {
            const shotNum = i + 1;
            const typeEl = document.getElementById(`shotType${shotNum}`);
            const descEl = document.getElementById(`shotDesc${shotNum}`);
            if (typeEl && shot.type) {
                // 尝试匹配景别
                const matchedType = Object.keys(shotTypes.zh).find(k => 
                    shot.type.includes(k) || shotTypes.zh[k].includes(shot.type)
                );
                if (matchedType) typeEl.value = matchedType;
            }
            if (descEl) descEl.value = shot.desc || '';
        });
        
        hideLoading();
        showToast(`✅ 已根据 ${allImages.length} 张参考图生成 ${total} 个分镜`, 'success');
        
        // 自动保存
        autoSave();
        
    } catch (error) {
        hideLoading();
        showToast('生成失败: ' + error.message, 'error');
        console.error('综合生成分镜错误:', error);
    }
}

// 构建多图分镜提示词
function buildMultiImageShotsPrompt(imageDescriptions, total, sceneDesc, storyContext) {
    const imageList = imageDescriptions.map(d => `- 图${d.index}: ${d.desc}`).join('\n');
    
    let prompt = `你是专业的影视分镜师。请仔细分析提供的 ${imageDescriptions.length} 张参考图片，然后创作 ${total} 个连贯的分镜头。

## 参考图片信息：
${imageList}

## 创作要求：
1. 综合分析所有参考图的元素（人物、场景、风格、氛围等）
2. 将这些元素有机融合，创作 ${total} 个分镜画面
3. 每个镜头使用不同的景别（远景、全景、中景、近景、特写等）
4. 分镜之间要有叙事逻辑和视觉节奏变化
5. 描述要具体，包含人物动作、表情、环境细节、光影氛围等`;

    if (sceneDesc) {
        prompt += `\n\n## 场景补充说明：\n${sceneDesc}`;
    }
    
    if (storyContext) {
        prompt += `\n\n## 故事背景：\n${storyContext}`;
    }

    prompt += `

## 输出格式（JSON数组）：
[
  {"type": "景别类型", "desc": "详细的画面描述"},
  {"type": "景别类型", "desc": "详细的画面描述"},
  ...共${total}个
]

景别类型可选：ECU(极特写)、CU(特写)、MCU(中特写)、MS(中景)、MLS(中远景)、LS(远景)、ELS(大远景)、POV(主观视角)、OTS(过肩镜头)

请直接输出JSON数组，不要包含其他内容。`;

    return prompt;
}

// 解析多图分镜结果
function parseMultiImageShotsResult(result, total) {
    const shots = [];
    
    try {
        // 尝试提取JSON
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) {
                for (let i = 0; i < Math.min(parsed.length, total); i++) {
                    shots.push({
                        type: parsed[i].type || 'MS',
                        desc: parsed[i].desc || parsed[i].description || ''
                    });
                }
            }
        }
    } catch (e) {
        console.warn('JSON解析失败，尝试文本解析:', e);
        
        // 文本解析备用方案
        const lines = result.split('\n').filter(l => l.trim());
        let currentShot = null;
        
        for (const line of lines) {
            const shotMatch = line.match(/镜头\s*(\d+)|Shot\s*(\d+)/i);
            if (shotMatch) {
                if (currentShot) shots.push(currentShot);
                currentShot = { type: 'MS', desc: '' };
            }
            
            const typeMatch = line.match(/(ECU|CU|MCU|MS|MLS|LS|ELS|POV|OTS|远景|全景|中景|近景|特写)/i);
            if (typeMatch && currentShot) {
                currentShot.type = typeMatch[1].toUpperCase();
            }
            
            if (currentShot && line.length > 10) {
                currentShot.desc += line.replace(/^[\d\.\-\*\s]+/, '').trim() + ' ';
            }
        }
        
        if (currentShot) shots.push(currentShot);
    }
    
    // 确保返回足够数量的分镜
    while (shots.length < total) {
        shots.push({ type: 'MS', desc: '' });
    }
    
    return shots.slice(0, total);
}

// ==================== 分镜处理 ====================

function initShotsHandlers() {
    document.getElementById('gridLayout').addEventListener('change', () => {
        updateShots();
        updateStoryFrameCount();
        updateRefImages();
        
        if (currentEditingImageIndex >= 0 && refImages[currentEditingImageIndex]) {
            const img = refImages[currentEditingImageIndex];
            const { layout, total } = getGridInfo();
            const shots = (img.shotsData && img.shotsData[layout]) || [];
            const prompt = (img.promptData && img.promptData[layout]) || { zh: '', en: '' };
            const generatedImage = (img.generatedImages && img.generatedImages[layout]) || null;
            
            if (shots.length > 0) {
                shots.forEach((shot, i) => {
                    const shotNum = i + 1;
                    if (shotNum <= total) {
                        const typeEl = document.getElementById(`shotType${shotNum}`);
                        const descEl = document.getElementById(`shotDesc${shotNum}`);
                        if (typeEl) typeEl.value = shot.type;
                        if (descEl) descEl.value = shot.desc;
                    }
                });
            }
            
            if (prompt && (prompt.zh || prompt.en)) {
                generatedPrompt = { ...prompt };
                switchLang(currentLang);
            }
            
            if (generatedImage) {
                generatedImageUrl = generatedImage;
                displayGeneratedImage(generatedImage);
            }
        }
    });
}

function updateShots() {
    const { total } = getGridInfo();
    autoSave();
    
    const existingData = [];
    document.querySelectorAll('.shot-item').forEach((item, index) => {
        const type = item.querySelector('.shot-type-select').value;
        const desc = item.querySelector('.shot-desc').value;
        existingData.push({ type, desc });
    });

    const shotsContainer = document.getElementById('shotsContainer');
    shotsContainer.innerHTML = '';
    
    for (let i = 0; i < total; i++) {
        const defaultType = defaultShotTypes[i] || 'MS';
        const existing = existingData[i] || { type: defaultType, desc: '' };
        const shotType = existingData[i] ? existing.type : defaultType;
        shotsContainer.innerHTML += createShotItem(i + 1, shotType, existing.desc);
    }
    
    // 更新分镜设置摘要
    if (typeof updateShotsSettingsSummary === 'function') {
        updateShotsSettingsSummary();
    }
    
    // 更新基础设置摘要
    if (typeof updateBasicSettingsSummary === 'function') {
        updateBasicSettingsSummary();
    }
}

function createShotItem(num, type = 'MS', desc = '') {
    return `
        <div class="shot-item" id="shotItem${num}">
            <div class="shot-loading" id="shotLoading${num}">
                <div class="spinner"></div>
                <div>AI生成中...</div>
            </div>
            <div class="shot-header">
                <span class="shot-number">镜头 ${String(num).padStart(2, '0')}</span>
                <select class="shot-type-select" id="shotType${num}">
                    ${Object.keys(shotTypes.zh).map(key => 
                        `<option value="${key}" ${type === key ? 'selected' : ''}>${key} ${shotTypes.zh[key].split('（')[0]}</option>`
                    ).join('')}
                </select>
                <button class="shot-ai-btn" onclick="aiGenerateShot(${num})">🤖 AI生成</button>
            </div>
            <textarea class="shot-desc" id="shotDesc${num}" placeholder="描述这个镜头的内容...">${desc}</textarea>
        </div>
    `;
}

// AI生成单个镜头（使用所有参考图）
async function aiGenerateShot(num) {
    if (!getApiKey()) {
        showToast('请先输入API Key并测试连接', 'error');
        return;
    }

    const shotType = document.getElementById(`shotType${num}`).value;
    const shotTypeDesc = shotTypes.zh[shotType] || shotType;
    const sceneDesc = document.getElementById('sceneDesc')?.value?.trim() || '';
    
    // 收集所有参考图
    const allImages = refImages.map(img => img.data);
    const imageDescs = refImages.map((img, i) => `图${i+1}: ${img.desc || '参考图片'}`).join('\n');
    
    document.getElementById(`shotLoading${num}`).classList.add('active');

    try {
        let result;
        
        if (allImages.length > 0) {
            // 使用所有参考图生成单个镜头
            const prompt = `作为专业的影视分镜师，请为镜头 ${num} 生成详细的画面描述。

## 景别要求：${shotType} - ${shotTypeDesc}

## 参考图片：
${imageDescs}

${sceneDesc ? `## 场景说明：\n${sceneDesc}\n` : ''}
## 要求：
1. 综合参考所有图片的元素（人物、场景、风格等）
2. 根据 ${shotType} 景别特点进行构图
3. 描述要具体，包含人物动作、表情、环境细节等

请直接输出镜头描述，不要包含其他内容。`;

            result = await callGeminiAPIWithMultipleImages(prompt, allImages);
        } else {
            // 无参考图时使用场景描述
            result = await generateShotDescription(shotType, sceneDesc, null);
        }
        
        document.getElementById(`shotDesc${num}`).value = result.trim();
        showToast(`镜头${num}生成完成`, 'success');
    } catch (error) {
        showToast('生成失败: ' + error.message, 'error');
    }
    
    document.getElementById(`shotLoading${num}`).classList.remove('active');
}

// 为指定图片生成所有镜头（根据当前模式选择生成方式）
async function generateShotsForImage(imageIndex) {
    if (currentMode === 'story') {
        await generateStoryShotsForImage(imageIndex);
    } else {
        await generateCameraShotsForImage(imageIndex);
    }
}

// 故事模式：生成故事关键画面
async function generateStoryShotsForImage(imageIndex) {
    if (!getApiKey()) {
        showToast('请先输入API Key并测试连接', 'error');
        return;
    }

    const img = refImages[imageIndex];
    if (!img) {
        showToast('图片不存在', 'error');
        return;
    }

    if (processingImages[img.id]) {
        showToast(`参考图 ${imageIndex + 1} 正在处理中，请稍候`, 'warning');
        return;
    }

    const { total, layout } = getGridInfo();
    const storyContext = document.getElementById('storyContext')?.value?.trim() || '';

    processingImages[img.id] = { type: 'story', text: '正在分析图片...', progress: '' };
    updateRefImages();

    try {
        if (!img.desc) {
            updateImageLoadingState(img.id, 'AI正在分析图片...');
            try {
                const result = await analyzeImage(img.data);
                img.desc = result;
                img.analyzed = true;
                if (currentEditingImageIndex === imageIndex) {
                    document.getElementById('sceneDesc').value = result;
                }
            } catch (error) {
                delete processingImages[img.id];
                updateRefImages();
                updateProcessingStatus();
                showToast(`参考图 ${imageIndex + 1} 分析失败: ` + error.message, 'error');
                return;
            }
        }

        processingImages[img.id].text = `正在创作 ${total} 个故事画面...`;
        updateImageLoadingState(img.id, processingImages[img.id].text);

        const storyPrompt = buildStoryPrompt(img.desc, storyContext, total, img.data);
        
        try {
            const storyResult = await callGeminiAPI(storyPrompt, img.data);
            const storyShots = parseStoryResult(storyResult, total);
            
            if (!img.shotsData) img.shotsData = {};
            if (!img.promptData) img.promptData = {};
            
            img.shotsData[layout] = storyShots;
            img.storyMode = true;

            if (currentEditingImageIndex === imageIndex) {
                storyShots.forEach((shot, i) => {
                    const shotNum = i + 1;
                    const shotDescEl = document.getElementById(`shotDesc${shotNum}`);
                    const shotTypeEl = document.getElementById(`shotType${shotNum}`);
                    if (shotDescEl) shotDescEl.value = shot.desc;
                    if (shotTypeEl) shotTypeEl.value = shot.type;
                });
            }

            processingImages[img.id].text = '正在生成提示词...';
            updateImageLoadingState(img.id, processingImages[img.id].text);
            
            const promptResult = generatePromptForImage(img, layout);
            img.promptData[layout] = promptResult;
            
            if (currentEditingImageIndex === imageIndex) {
                generatedPrompt = { ...promptResult };
                document.getElementById('outputSection').classList.add('active');
                switchLang(currentLang);
            }

            showToast(`参考图 ${imageIndex + 1} 的故事分镜（${total}画面）已生成`, 'success');

        } catch (error) {
            console.error('故事生成失败:', error);
            showToast(`参考图 ${imageIndex + 1} 故事生成失败: ` + error.message, 'error');
        }

        delete processingImages[img.id];
        updateRefImages();
        updateProcessingStatus();
        autoSave();

    } catch (error) {
        delete processingImages[img.id];
        updateRefImages();
        updateProcessingStatus();
        showToast(`参考图 ${imageIndex + 1} 生成失败: ` + error.message, 'error');
    }
}

// 构建故事生成的提示词
function buildStoryPrompt(imageDesc, storyContext, totalFrames, imageData) {
    let prompt = `你是一位专业的漫画故事编剧和分镜师。请根据以下信息创作一个完整的故事，并将其拆分为 ${totalFrames} 个关键画面。

【参考图片描述】
${imageDesc}

`;
    if (storyContext) {
        prompt += `【故事设定】
${storyContext}

`;
    }

    prompt += `【要求】
1. 根据参考图片中的角色、场景、氛围，创作一个有起承转合的完整故事
2. 将故事拆分为 ${totalFrames} 个连续的关键画面，每个画面代表故事的一个重要时刻
3. 每个画面描述要具体、生动，包含人物动作、表情、环境细节
4. 保持角色外观、服装的一致性
5. 画面之间要有剧情的递进和情绪的变化
6. 每个画面描述控制在50字以内
7. 根据故事情节选择最合适的镜头景别

${generateShotTypesPromptText()}

【输出格式】
请按以下格式输出每个画面：

画面01|景别类型|画面描述
画面02|景别类型|画面描述
...
画面${String(totalFrames).padStart(2, '0')}|景别类型|画面描述

例如：
画面01|EWS|夕阳下的校园，女孩独自站在天台上望着远方
画面02|MS|女孩转身，看到男孩推门走上天台
画面03|OTS|从女孩肩后看向男孩，他手里拿着一封信`;

    return prompt;
}

// 生成景别类型提示文本
function generateShotTypesPromptText() {
    if (typeof getShotTypesForPrompt === 'function') {
        return getShotTypesForPrompt();
    }
    return '';
}

// 解析故事生成结果
function parseStoryResult(result, totalFrames) {
    const shots = [];
    const lines = result.split('\n').filter(line => line.trim());
    const shotTypePattern = typeof getShotTypeRegexPattern === 'function' ? getShotTypeRegexPattern() : 'EWS|VWS|WS|MWS|FS|MFS|AS|KS|MS|MCU|CU|BCU|ECU|OTS|POV|HA|LA|EA|TA|DA|2S|3S|GS|INS|EST';
    
    for (let i = 0; i < totalFrames; i++) {
        let type = 'MS';
        let desc = '';
        
        const regex = new RegExp(`画面${String(i + 1).padStart(2, '0')}\\s*[|｜]\\s*(\\w+)\\s*[|｜]\\s*(.+)`, 'i');
        
        for (const line of lines) {
            const match = line.match(regex);
            if (match) {
                type = match[1].toUpperCase();
                desc = match[2].trim();
                break;
            }
        }
        
        if (!desc) {
            const altRegex = new RegExp(`(?:画面|镜头|场景)?\\s*(?:${i + 1}|0?${i + 1})\\s*[:|：|.|、|\\-|\\||｜]\\s*(.+)`, 'i');
            for (const line of lines) {
                const match = line.match(altRegex);
                if (match) {
                    desc = match[1].trim();
                    const typeMatch = desc.match(new RegExp(`^(${shotTypePattern})\\s*[:|：|,|，]?\\s*`, 'i'));
                    if (typeMatch) {
                        type = typeMatch[1].toUpperCase();
                        desc = desc.replace(typeMatch[0], '').trim();
                    }
                    break;
                }
            }
        }
        
        if (typeof isValidShotType === 'function' && !isValidShotType(type)) {
            type = 'MS';
        }
        
        shots.push({ type, desc: desc || `故事画面 ${i + 1}` });
    }
    
    return shots;
}

// 分镜模式：生成不同镜头角度
async function generateCameraShotsForImage(imageIndex) {
    if (!getApiKey()) {
        showToast('请先输入API Key并测试连接', 'error');
        return;
    }

    const img = refImages[imageIndex];
    if (!img) {
        showToast('图片不存在', 'error');
        return;
    }

    if (processingImages[img.id]) {
        showToast(`参考图 ${imageIndex + 1} 正在处理中，请稍候`, 'warning');
        return;
    }

    const { total, layout } = getGridInfo();

    processingImages[img.id] = { type: 'shots', text: '正在分析图片...', progress: '' };
    updateRefImages();

    try {
        if (!img.desc) {
            updateImageLoadingState(img.id, 'AI正在分析图片...');
            try {
                const result = await analyzeImage(img.data);
                img.desc = result;
                img.analyzed = true;
                if (currentEditingImageIndex === imageIndex) {
                    document.getElementById('sceneDesc').value = result;
                }
            } catch (error) {
                delete processingImages[img.id];
                updateRefImages();
                updateProcessingStatus();
                showToast(`参考图 ${imageIndex + 1} 分析失败: ` + error.message, 'error');
                return;
            }
        }

        const sceneDesc = img.desc;
        const refImage = img.data;

        let successCount = 0;
        let failCount = 0;
        const tempShots = [];

        for (let i = 1; i <= total; i++) {
            processingImages[img.id].text = `正在生成镜头 ${i}/${total}`;
            processingImages[img.id].progress = `完成: ${successCount} / 失败: ${failCount}`;
            updateImageLoadingState(img.id, processingImages[img.id].text, processingImages[img.id].progress);
            
            const defaultShotType = defaultShotTypes[i - 1] || 'MS';
            
            try {
                const result = await generateShotDescription(defaultShotType, sceneDesc, refImage);
                tempShots.push({ type: defaultShotType, desc: result });
                successCount++;
                
                if (currentEditingImageIndex === imageIndex) {
                    const shotDescEl = document.getElementById(`shotDesc${i}`);
                    const shotTypeEl = document.getElementById(`shotType${i}`);
                    if (shotDescEl) shotDescEl.value = result;
                    if (shotTypeEl) shotTypeEl.value = defaultShotType;
                }
            } catch (error) {
                console.error(`参考图${imageIndex + 1} 镜头${i}生成失败:`, error.message);
                tempShots.push({ type: defaultShotType, desc: '' });
                failCount++;
            }
            
            if (i < total) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        
        if (!img.shotsData) img.shotsData = {};
        if (!img.promptData) img.promptData = {};
        
        img.shotsData[layout] = tempShots;
        
        processingImages[img.id].text = '正在生成提示词...';
        updateImageLoadingState(img.id, processingImages[img.id].text);
        
        const promptResult = generatePromptForImage(img, layout);
        img.promptData[layout] = promptResult;
        
        if (currentEditingImageIndex === imageIndex) {
            generatedPrompt = { ...promptResult };
            document.getElementById('outputSection').classList.add('active');
            switchLang(currentLang);
        }
        
        delete processingImages[img.id];
        updateRefImages();
        updateProcessingStatus();
        autoSave();
        
        if (failCount === 0) {
            showToast(`参考图 ${imageIndex + 1} 的 ${total} 个镜头已生成`, 'success');
        } else {
            showToast(`参考图 ${imageIndex + 1}: 完成 ${successCount} 个，失败 ${failCount} 个`, 'warning');
        }
    } catch (error) {
        delete processingImages[img.id];
        updateRefImages();
        updateProcessingStatus();
        showToast(`参考图 ${imageIndex + 1} 生成失败: ` + error.message, 'error');
    }
}

// 为单个图片生成提示词
function generatePromptForImage(img, layout = null) {
    const gridInfo = getGridInfo();
    const { rows, cols, total } = gridInfo;
    const currentLayout = layout || gridInfo.layout;
    const resolution = document.getElementById('resolution').value;
    const aspectRatio = document.getElementById('aspectRatio').value;

    const combinedScene = img.desc || '';
    
    if (!combinedScene) {
        return { zh: '', en: '' };
    }

    const shotsData = img.shotsData && img.shotsData[currentLayout];
    const shots = shotsData && shotsData.length > 0 
        ? shotsData.map((shot, index) => ({ num: index + 1, type: shot.type, desc: shot.desc }))
        : [];

    if (shots.length === 0) {
        return { zh: '', en: '' };
    }

    const isStoryMode = img.storyMode || currentMode === 'story';

    let zhPrompt, enPrompt;

    if (isStoryMode) {
        zhPrompt = `根据[${combinedScene}]，生成一张具有凝聚力的 [${rows}x${cols}] 网格图像，展示一个完整故事的[${total}]个连续关键画面，画面避免出现任何台词，严格保持角色外观、服装和画风的一致性，[${resolution}]分辨率，[${aspectRatio}]画幅。\n\n【故事画面】\n`;
        
        shots.forEach(shot => {
            const typeLabel = shotTypes.zh[shot.type] || shot.type;
            const desc = shot.desc || '（待补充）';
            zhPrompt += `画面${String(shot.num).padStart(2, '0')}：${typeLabel}，${desc}\n`;
        });

        enPrompt = `Based on [${combinedScene}], generate a cohesive [${rows}x${cols}] grid image showing [${total}] consecutive key frames of a complete story, strictly maintaining consistency of character appearance, costumes, and art style, [${resolution}] resolution, [${aspectRatio}] aspect ratio.\n\n【Story Frames】\n`;
        
        shots.forEach(shot => {
            const typeLabel = shotTypes.en[shot.type] || shot.type;
            const desc = shot.desc || '(to be added)';
            enPrompt += `Frame ${String(shot.num).padStart(2, '0')}: ${typeLabel}, ${desc}\n`;
        });
    } else {
        zhPrompt = `根据[${combinedScene}]，生成一张具有凝聚力的 [${rows}x${cols}] 网格图像，包含在同一环境中的[${total}]个不同摄像机镜头，镜头画面避免出现任何台词，严格保持人物/物体、服装和光线的一致性，[${resolution}]分辨率，[${aspectRatio}]画幅。\n\n`;
        
        shots.forEach(shot => {
            const typeLabel = shotTypes.zh[shot.type] || shot.type;
            const desc = shot.desc || '（待补充）';
            zhPrompt += `镜头${String(shot.num).padStart(2, '0')}：${typeLabel}，${desc}\n`;
        });

        enPrompt = `Based on [${combinedScene}], generate a cohesive [${rows}x${cols}] grid image containing [${total}] different camera shots in the same environment, strictly maintaining consistency of characters/objects, costumes, and lighting, [${resolution}] resolution, [${aspectRatio}] aspect ratio.\n\n`;
        
        shots.forEach(shot => {
            const typeLabel = shotTypes.en[shot.type] || shot.type;
            const desc = shot.desc || '(to be added)';
            enPrompt += `Shot ${String(shot.num).padStart(2, '0')}: ${typeLabel}, ${desc}\n`;
        });
    }

    return { zh: zhPrompt, en: enPrompt };
}

// AI生成所有镜头
async function aiGenerateAllShots() {
    if (!getApiKey()) {
        showToast('请先输入API Key并测试连接', 'error');
        return;
    }

    if (currentEditingImageIndex >= 0 && refImages[currentEditingImageIndex]) {
        await generateShotsForImage(currentEditingImageIndex);
        return;
    }

    const sceneDesc = document.getElementById('sceneDesc').value || 
                      refImages.map(img => img.desc).filter(d => d).join('，');
    
    if (!sceneDesc) {
        showToast('请先填写场景描述或上传并分析参考图', 'error');
        return;
    }

    const { total } = getGridInfo();
    const refImage = refImages.length > 0 ? refImages[0].data : null;

    // 使用任务队列
    if (typeof taskQueue !== 'undefined') {
        taskQueue.addPromptTask(`AI生成${total}个镜头`, async (task, updateProgress) => {
            let successCount = 0;
            let failCount = 0;
            
            for (let i = 1; i <= total; i++) {
                // 检查任务是否被取消
                if (task.status === TaskStatus.CANCELLED) {
                    throw new Error('任务已取消');
                }
                
                updateProgress(Math.round((i - 1) / total * 100), `正在生成镜头 ${i}/${total}...`);
                
                const shotType = document.getElementById(`shotType${i}`).value;
                document.getElementById(`shotLoading${i}`)?.classList.add('active');
                
                try {
                    const result = await generateShotDescription(shotType, sceneDesc, refImage);
                    document.getElementById(`shotDesc${i}`).value = result;
                    successCount++;
                } catch (error) {
                    console.error(`镜头${i}生成失败:`, error.message);
                    failCount++;
                }
                
                document.getElementById(`shotLoading${i}`)?.classList.remove('active');
                
                if (i < total) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
            
            updateProgress(100, '完成');
            
            if (failCount === 0) {
                showToast(`所有 ${total} 个镜头生成完成`, 'success');
            } else {
                showToast(`完成 ${successCount} 个，失败 ${failCount} 个`, 'warning');
            }
            
            return { successCount, failCount };
        }, {
            description: `基于场景描述生成${total}个分镜`,
            priority: TaskPriority.NORMAL
        });
        
        showToast(`已添加镜头生成任务到队列`, 'info');
        return;
    }

    // 原有逻辑（兼容模式）
    showLoading(`AI正在生成 ${total} 个镜头...`);
    
    for (let i = 1; i <= total; i++) {
        document.getElementById(`shotLoading${i}`).classList.add('active');
    }
    
    let successCount = 0;
    let failCount = 0;
    
    try {
        for (let i = 1; i <= total; i++) {
            document.getElementById('loadingText').textContent = `正在生成镜头 ${i}/${total}...`;
            
            const shotType = document.getElementById(`shotType${i}`).value;
            
            try {
                const result = await generateShotDescription(shotType, sceneDesc, refImage);
                document.getElementById(`shotDesc${i}`).value = result;
                successCount++;
            } catch (error) {
                console.error(`镜头${i}生成失败:`, error.message);
                failCount++;
            }
            
            document.getElementById(`shotLoading${i}`).classList.remove('active');
            
            if (i < total) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        
        if (failCount === 0) {
            showToast(`所有 ${total} 个镜头生成完成`, 'success');
        } else {
            showToast(`完成 ${successCount} 个，失败 ${failCount} 个`, 'warning');
        }
    } catch (error) {
        showToast('生成失败: ' + error.message, 'error');
        for (let i = 1; i <= total; i++) {
            document.getElementById(`shotLoading${i}`).classList.remove('active');
        }
    }
    
    hideLoading();
}

function fillScene(text) {
    document.getElementById('sceneDesc').value = text;
}

function autoFillShots() {
    const items = document.querySelectorAll('.shot-item');
    const templates = autoFillTemplates.zh;
    
    items.forEach((item, index) => {
        const desc = item.querySelector('.shot-desc');
        if (!desc.value.trim()) {
            desc.value = templates[index % templates.length];
        }
    });
    
    showToast('已填充空白镜头', 'success');
}

function clearAllShots() {
    document.querySelectorAll('.shot-desc').forEach(el => el.value = '');
    autoSave();
    showToast('已清空所有镜头描述');
}

// ==================== 生成提示词 ====================

function generatePrompt() {
    const sceneDesc = document.getElementById('sceneDesc').value.trim();
    const { rows, cols, total } = getGridInfo();
    const resolution = document.getElementById('resolution').value;
    const aspectRatio = document.getElementById('aspectRatio').value;

    // 直接使用 sceneDesc 输入框的值作为场景描述
    let combinedScene = sceneDesc;
    let isStoryMode = currentMode === 'story';
    
    // 从分镜参考组获取模式设置（如果有）
    if (typeof refGroups !== 'undefined' && refGroups.length > 0) {
        const analyzedGroup = refGroups.find(g => g.analyzed);
        if (analyzedGroup && analyzedGroup.mode) {
            isStoryMode = analyzedGroup.mode === 'story';
        }
    }
    
    // 兼容旧版 refImages - 只获取模式，不再覆盖 combinedScene
    if (currentEditingImageIndex >= 0 && refImages[currentEditingImageIndex]) {
        const currentImg = refImages[currentEditingImageIndex];
        if (currentImg.storyMode !== undefined) {
            isStoryMode = currentImg.storyMode;
        }
    }
    
    const shots = [];
    document.querySelectorAll('.shot-item').forEach((item, index) => {
        const type = item.querySelector('.shot-type-select').value;
        const desc = item.querySelector('.shot-desc').value.trim();
        shots.push({ num: index + 1, type, desc });
    });

    if (!combinedScene) {
        showToast('请至少填写场景描述或选择一张参考图', 'error');
        return;
    }

    let zhPrompt, enPrompt;

    if (isStoryMode) {
        zhPrompt = `根据[${combinedScene}]，生成一张具有凝聚力的 [${rows}x${cols}] 网格图像，展示一个完整故事的[${total}]个连续关键画面，画面避免出现任何台词，严格保持角色外观、服装和画风的一致性，[${resolution}]分辨率，[${aspectRatio}]画幅。\n\n【故事画面】\n`;
        
        shots.forEach(shot => {
            const typeLabel = shotTypes.zh[shot.type] || shot.type;
            const desc = shot.desc || '（待补充）';
            zhPrompt += `画面${String(shot.num).padStart(2, '0')}：${typeLabel}，${desc}\n`;
        });

        enPrompt = `Based on [${combinedScene}], generate a cohesive [${rows}x${cols}] grid image showing [${total}] consecutive key frames of a complete story, strictly maintaining consistency of character appearance, costumes, and art style, [${resolution}] resolution, [${aspectRatio}] aspect ratio.\n\n【Story Frames】\n`;
        
        shots.forEach(shot => {
            const typeLabel = shotTypes.en[shot.type] || shot.type;
            const desc = shot.desc || '(to be added)';
            enPrompt += `Frame ${String(shot.num).padStart(2, '0')}: ${typeLabel}, ${desc}\n`;
        });
    } else {
        zhPrompt = `根据[${combinedScene}]，生成一张具有凝聚力的 [${rows}x${cols}] 网格图像，包含在同一环境中的[${total}]个不同摄像机镜头，镜头画面避免出现任何台词，严格保持人物/物体、服装和光线的一致性，[${resolution}]分辨率，[${aspectRatio}]画幅。\n\n`;
        
        shots.forEach(shot => {
            const typeLabel = shotTypes.zh[shot.type] || shot.type;
            const desc = shot.desc || '（待补充）';
            zhPrompt += `镜头${String(shot.num).padStart(2, '0')}：${typeLabel}，${desc}\n`;
        });

        enPrompt = `Based on [${combinedScene}], generate a cohesive [${rows}x${cols}] grid image containing [${total}] different camera shots in the same environment, strictly maintaining consistency of characters/objects, costumes, and lighting, [${resolution}] resolution, [${aspectRatio}] aspect ratio.\n\n`;
        
        shots.forEach(shot => {
            const typeLabel = shotTypes.en[shot.type] || shot.type;
            const desc = shot.desc || '(to be added)';
            enPrompt += `Shot ${String(shot.num).padStart(2, '0')}: ${typeLabel}, ${desc}\n`;
        });
    }

    generatedPrompt = { zh: zhPrompt, en: enPrompt };
    
    if (currentEditingImageIndex >= 0 && refImages[currentEditingImageIndex]) {
        const img = refImages[currentEditingImageIndex];
        const { layout } = getGridInfo();
        if (!img.promptData) img.promptData = {};
        img.promptData[layout] = { zh: zhPrompt, en: enPrompt };
        updateRefImages();
    }
    
    document.getElementById('outputSection').classList.add('active');
    switchLang(currentLang);
    document.getElementById('outputSection').scrollIntoView({ behavior: 'smooth' });
    
    if (currentEditingImageIndex >= 0) {
        showToast(`参考图 ${currentEditingImageIndex + 1} 的提示词生成成功！`, 'success');
    } else {
        showToast('提示词生成成功！', 'success');
    }
}

function switchLang(lang) {
    currentLang = lang;
    document.getElementById('langZh').classList.toggle('active', lang === 'zh');
    document.getElementById('langEn').classList.toggle('active', lang === 'en');
    document.getElementById('outputText').value = generatedPrompt[lang] || '';
}

function copyOutput() {
    const text = document.getElementById('outputText').value;
    if (!text) {
        showToast('没有可复制的内容', 'warning');
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        showToast('已复制到剪贴板', 'success');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('已复制到剪贴板', 'success');
    });
}

function downloadTxt() {
    const text = document.getElementById('outputText').value;
    if (!text) {
        showToast('没有可下载的内容', 'warning');
        return;
    }
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `分镜提示词_${currentLang === 'zh' ? '中文' : 'English'}_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('已下载TXT文件', 'success');
}

// ==================== 多图 API 调用 ====================

// 带多图的 Gemini API 调用（供分镜参考组使用）
async function callGeminiAPIWithMultipleImages(prompt, images) {
    const apiKey = getApiKey();
    const apiBaseUrl = getApiBaseUrl();
    
    // 构建多图消息
    const content = [{ type: 'text', text: prompt }];
    
    for (const imgData of images) {
        const base64 = imgData.replace(/^data:image\/\w+;base64,/, '');
        content.push({
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64}` }
        });
    }
    
    const response = await fetch(`${apiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: getModel(),
            messages: [{ role: 'user', content }],
            max_tokens: 4096,
            temperature: 0.7
        })
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`API请求失败: ${error}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}
