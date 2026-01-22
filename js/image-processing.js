/**
 * 图片处理模块 - 分镜参考组管理
 * AI分镜提示词生成器
 */

// ==================== 分镜参考组管理 ====================

// 分镜参考组最大数量
const MAX_REF_GROUPS = 50;

// 添加新的分镜参考组
function addRefGroup() {
    const groupIndex = refGroups.length;
    
    if (groupIndex >= MAX_REF_GROUPS) {
        showToast(`最多支持 ${MAX_REF_GROUPS} 个分镜参考`, 'warning');
        return;
    }
    
    refGroups.push({
        id: Date.now() + Math.random(),
        images: [],
        desc: '',
        analyzed: false
    });
    
    // 新添加的组默认折叠，并保存状态
    collapsedGroups.add(groupIndex);
    saveGroupCollapseState();
    
    renderRefGroups();
    showToast(`已添加分镜参考 ${groupIndex + 1}`, 'success');
}

// 删除分镜参考组
function removeRefGroup(groupIndex) {
    if (confirm(`确定删除分镜参考 ${groupIndex + 1} 吗？`)) {
        refGroups.splice(groupIndex, 1);
        
        // 重新调整折叠状态索引
        const newCollapsedGroups = new Set();
        collapsedGroups.forEach(idx => {
            if (idx < groupIndex) {
                newCollapsedGroups.add(idx);
            } else if (idx > groupIndex) {
                newCollapsedGroups.add(idx - 1);
            }
            // idx === groupIndex 的情况下，被删除的组不需要加入
        });
        collapsedGroups = newCollapsedGroups;
        saveGroupCollapseState();
        
        renderRefGroups();
        autoSave();
        showToast('已删除分镜参考', 'info');
    }
}

// 向分镜参考组添加图片
function addImageToGroup(groupIndex, files) {
    const group = refGroups[groupIndex];
    if (!group) return;
    
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    let addedCount = 0;
    
    imageFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            group.images.push({
                id: Date.now() + Math.random(),
                data: e.target.result
            });
            addedCount++;
            if (addedCount === imageFiles.length) {
                renderRefGroups();
                autoSave();
                showToast(`已添加 ${addedCount} 张图片到分镜参考 ${groupIndex + 1}`, 'success');
            }
        };
        reader.readAsDataURL(file);
    });
}

// 从分镜参考组删除图片
function removeImageFromGroup(groupIndex, imageIndex) {
    const group = refGroups[groupIndex];
    if (group && group.images[imageIndex]) {
        group.images.splice(imageIndex, 1);
        renderRefGroups();
        autoSave();
    }
}

// 折叠状态存储
let collapsedGroups = new Set();

// 保存分组折叠状态到 localStorage
function saveGroupCollapseState() {
    try {
        localStorage.setItem('refGroupsCollapseState', JSON.stringify([...collapsedGroups]));
    } catch (e) {
        console.warn('保存折叠状态失败:', e);
    }
}

// 从 localStorage 恢复分组折叠状态
function restoreGroupCollapseState() {
    try {
        const saved = localStorage.getItem('refGroupsCollapseState');
        if (saved) {
            const indices = JSON.parse(saved);
            collapsedGroups = new Set(indices);
        }
    } catch (e) {
        console.warn('恢复折叠状态失败:', e);
    }
}

// 切换分组折叠状态
function toggleGroupCollapse(groupIndex) {
    if (collapsedGroups.has(groupIndex)) {
        collapsedGroups.delete(groupIndex);
    } else {
        collapsedGroups.add(groupIndex);
    }
    saveGroupCollapseState();
    renderRefGroups();
}

// 展开所有分组
function expandAllGroups() {
    collapsedGroups.clear();
    saveGroupCollapseState();
    renderRefGroups();
}

// 折叠所有分组
function collapseAllGroups() {
    refGroups.forEach((_, index) => collapsedGroups.add(index));
    saveGroupCollapseState();
    renderRefGroups();
}

// 滚动到指定分组（在容器内滚动）
function scrollToGroup(groupIndex) {
    const container = document.getElementById('refGroupsContainer');
    const groupEl = document.querySelector(`.ref-group-item[data-group-index="${groupIndex}"]`);
    
    if (!container || !groupEl) return;
    
    // 如果是折叠的，先展开
    if (collapsedGroups.has(groupIndex)) {
        collapsedGroups.delete(groupIndex);
        saveGroupCollapseState();
        renderRefGroups();
        // 等待DOM更新后滚动
        setTimeout(() => {
            scrollToGroupInContainer(groupIndex);
        }, 50);
    } else {
        scrollToGroupInContainer(groupIndex);
    }
}

// 在容器内滚动到指定分组
function scrollToGroupInContainer(groupIndex) {
    const container = document.getElementById('refGroupsContainer');
    const groupEl = document.querySelector(`.ref-group-item[data-group-index="${groupIndex}"]`);
    
    if (!container || !groupEl) return;
    
    // 计算滚动位置（相对于容器）
    const containerTop = container.getBoundingClientRect().top;
    const groupTop = groupEl.getBoundingClientRect().top;
    const navBar = container.querySelector('.ref-groups-nav');
    const navHeight = navBar ? navBar.offsetHeight + 15 : 0;
    
    // 滚动容器到目标位置
    container.scrollTo({
        top: container.scrollTop + (groupTop - containerTop) - navHeight,
        behavior: 'smooth'
    });
    
    // 高亮效果
    groupEl.classList.add('highlight-group');
    setTimeout(() => groupEl.classList.remove('highlight-group'), 2000);
}

// 渲染所有分镜参考组
function renderRefGroups() {
    const container = document.getElementById('refGroupsContainer');
    const navContainer = document.getElementById('refGroupsNav');
    if (!container) return;
    
    if (refGroups.length === 0) {
        // 隐藏导航栏
        if (navContainer) navContainer.style.display = 'none';
        
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <div style="font-size: 48px; margin-bottom: 15px;">📷</div>
                <div>暂无分镜参考，点击上方"➕ 添加分镜参考"开始</div>
                <div style="margin-top: 10px; font-size: 12px; color: #888;">每个分镜参考对应一个镜头，可上传多张参考图</div>
            </div>
        `;
        return;
    }
    
    // 快速导航栏（当分组数量超过3个时显示在外部固定位置）
    if (navContainer) {
        if (refGroups.length > 3) {
            navContainer.style.display = 'flex';
            navContainer.innerHTML = `
                <div class="nav-label">快速导航：</div>
                <div class="nav-buttons">
                    ${refGroups.map((group, index) => {
                        const hasImages = group.images.length > 0;
                        const isAnalyzed = group.analyzed;
                        const statusClass = isAnalyzed ? 'analyzed' : (hasImages ? 'has-images' : '');
                        return `<button class="nav-btn ${statusClass}" onclick="scrollToGroup(${index})" title="分镜参考 ${index + 1}${isAnalyzed ? ' (已分析)' : ''}">${index + 1}</button>`;
                    }).join('')}
                </div>
                <div class="nav-actions">
                    <button class="btn btn-sm" onclick="expandAllGroups()" title="展开全部">📂 全部展开</button>
                    <button class="btn btn-sm" onclick="collapseAllGroups()" title="折叠全部">📁 全部折叠</button>
                </div>
            `;
        } else {
            navContainer.style.display = 'none';
        }
    }
    
    const groupsHtml = refGroups.map((group, groupIndex) => {
        const isProcessing = processingImages[group.id];
        const imageCount = group.images.length;
        const isCollapsed = collapsedGroups.has(groupIndex);
        
        // 生成缩略图HTML（折叠时也显示）
        const thumbnailsHtml = imageCount > 0 ? `
            <div class="ref-group-thumbnails">
                ${group.images.slice(0, 5).map((img, imgIndex) => `
                    <img src="${img.data}" alt="缩略图${imgIndex + 1}" class="thumbnail-img" onclick="event.stopPropagation(); openImageModal(this.src)">
                `).join('')}
                ${imageCount > 5 ? `<span class="thumbnail-more">+${imageCount - 5}</span>` : ''}
            </div>
        ` : '';
        
        return `
            <div class="ref-group-item ${isCollapsed ? 'collapsed' : ''}" data-group-index="${groupIndex}">
                <div class="ref-group-header" onclick="toggleGroupCollapse(${groupIndex})">
                    <div class="ref-group-title">
                        <span class="collapse-icon">${isCollapsed ? '▶' : '▼'}</span>
                        <span class="ref-group-number">${groupIndex + 1}</span>
                        <span>分镜参考 ${groupIndex + 1}</span>
                        <span class="ref-group-count">(${imageCount} 张图片)</span>
                        ${group.analyzed ? '<span class="ai-analyzed-badge">✨ 已分析</span>' : ''}
                        ${isCollapsed ? thumbnailsHtml : ''}
                    </div>
                    <div class="ref-group-actions" onclick="event.stopPropagation()">
                        ${group.analyzed ? `<button class="btn btn-sm btn-primary" onclick="loadGroupToSettings(${groupIndex})" title="加载场景描述和镜头到设置">📥 加载到分镜</button>` : ''}
                        <button class="btn btn-sm btn-info" onclick="triggerGroupUpload(${groupIndex})" ${isProcessing ? 'disabled' : ''}>
                            📁 添加图片
                        </button>
                        <button class="btn btn-sm btn-warning" onclick="analyzeRefGroup(${groupIndex})" ${isProcessing || imageCount === 0 ? 'disabled' : ''}>
                            🤖 AI分析
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="removeRefGroup(${groupIndex})" ${isProcessing ? 'disabled' : ''}>
                            🗑️
                        </button>
                    </div>
                </div>
                
                <input type="file" id="groupUpload${groupIndex}" accept="image/*" multiple style="display:none;" 
                       onchange="addImageToGroup(${groupIndex}, this.files)">
                
                ${isCollapsed ? '' : `
                    <div class="ref-group-images">
                        ${imageCount === 0 ? `
                            <div class="ref-group-empty" onclick="triggerGroupUpload(${groupIndex})">
                                <div>🖼️</div>
                                <div>点击添加参考图</div>
                                <div style="font-size: 11px; color: #666;">可添加人物、场景、风格等多张参考</div>
                            </div>
                        ` : group.images.map((img, imgIndex) => `
                            <div class="ref-group-image">
                                <img src="${img.data}" alt="参考图${imgIndex + 1}" onclick="openImageModal(this.src)">
                                <button class="remove-image-btn" onclick="removeImageFromGroup(${groupIndex}, ${imgIndex})">✕</button>
                                <div class="image-index">${imgIndex + 1}</div>
                            </div>
                        `).join('')}
                    </div>
                    
                    ${group.shots && group.shots.length > 0 ? `
                        <div class="ref-group-shots">
                            <div class="shots-header">
                                <span>📋 生成的镜头描述 (${group.shots.length}个)</span>
                            </div>
                            <div class="shots-list">
                                ${group.shots.map((shot, shotIndex) => `
                                    <div class="shot-preview">
                                        <span class="shot-num">${shotIndex + 1}</span>
                                        <span class="shot-type-badge">${shot.type || 'MS'}</span>
                                        <span class="shot-desc-preview">${shot.desc || '(空)'}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : `
                        <div class="ref-group-desc">
                            <textarea 
                                id="groupDesc${groupIndex}" 
                                placeholder="点击"🤖 AI分析"按钮，AI将根据参考图生成所有镜头描述..."
                                onchange="updateGroupDesc(${groupIndex}, this.value)"
                                ${isProcessing ? 'disabled' : ''}
                            >${group.desc || ''}</textarea>
                        </div>
                    `}
                    
                    ${isProcessing ? `
                        <div class="ref-group-loading">
                            <div class="loading-spinner"></div>
                            <span>${isProcessing.text || '处理中...'}</span>
                        </div>
                    ` : ''}
                `}
            </div>
        `;
    }).join('');
    
    container.innerHTML = groupsHtml;
    
    // 更新卡片摘要
    if (typeof updateRefGroupsSummary === 'function') {
        updateRefGroupsSummary();
    }
}

// 触发分组上传
function triggerGroupUpload(groupIndex) {
    document.getElementById(`groupUpload${groupIndex}`).click();
}

// 更新分组描述
function updateGroupDesc(groupIndex, desc) {
    if (refGroups[groupIndex]) {
        refGroups[groupIndex].desc = desc;
    }
}

// 清空所有分镜参考组
function clearAllRefGroups() {
    if (refGroups.length === 0) {
        showToast('没有可清空的分镜参考', 'info');
        return;
    }
    if (confirm('确定要清空所有分镜参考吗？此操作不可恢复。')) {
        refGroups = [];
        renderRefGroups();
        autoSave();
        showToast('已清空所有分镜参考', 'info');
    }
}

// AI分析单个分镜参考组 - 根据当前模式生成镜头描述
async function analyzeRefGroup(groupIndex) {
    const group = refGroups[groupIndex];
    if (!group || group.images.length === 0) {
        showToast('请先添加参考图', 'warning');
        return;
    }
    
    if (!getApiKey()) {
        showToast('请先输入API Key并测试连接', 'error');
        return;
    }
    
    const { total } = getGridInfo();
    const isStoryMode = currentMode === 'story';
    const storyContext = document.getElementById('storyContext')?.value?.trim() || '';
    const existingSceneDesc = document.getElementById('sceneDesc')?.value?.trim() || '';
    
    // 标记为处理中
    const modeText = isStoryMode ? '故事画面' : '分镜头';
    processingImages[group.id] = { text: `AI正在生成${total}个${modeText}...` };
    renderRefGroups();
    
    try {
        const imageDataList = group.images.map(img => img.data);
        
        let prompt;
        if (isStoryMode) {
            // 故事模式提示词 - 同时返回场景描述
            prompt = `你是专业的故事分镜师。请仔细分析提供的${imageDataList.length}张参考图片，创作一个连贯的故事，并拆分为${total}个关键画面。

${storyContext ? `## 故事设定：\n${storyContext}\n` : ''}
${existingSceneDesc ? `## 现有场景描述（可参考或改进）：\n${existingSceneDesc}\n` : ''}

## 创作要求：
1. 综合分析所有参考图的元素（人物特征、场景环境、艺术风格等）
2. 创作一个有开头、发展、高潮、结局的完整故事
3. 将故事拆分为${total}个关键画面，画面之间有时间顺序和因果关系
4. 每个画面描述要具体，包含人物动作、表情、对话暗示、情绪氛围等
5. 注意叙事节奏，合理分配情节点
6. 同时提供一个整体场景描述，概括图片的核心视觉元素和风格特征

## 输出格式（JSON对象）：
{
  "sceneDesc": "整体场景描述：概括人物外观、场景环境、艺术风格、光影氛围等核心视觉元素（80-150字）",
  "shots": [
    {"shot": 1, "type": "LS", "desc": "故事开场：详细的画面描述（50-80字）"},
    {"shot": 2, "type": "MS", "desc": "情节发展：详细的画面描述（50-80字）"},
    ...共${total}个
  ]
}

景别类型可选：ECU(极特写)、CU(特写)、MCU(中特写)、MS(中景)、MLS(中远景)、LS(远景)、ELS(大远景)、POV(主观视角)、OTS(过肩镜头)

请直接输出JSON对象，不要包含其他内容。`;
        } else {
            // 分镜模式提示词 - 同时返回场景描述
            prompt = `你是专业的影视分镜师。请仔细分析提供的${imageDataList.length}张参考图片，然后创作${total}个不同视角的分镜头描述。

${existingSceneDesc ? `## 现有场景描述（可参考或改进）：\n${existingSceneDesc}\n` : ''}

## 创作要求：
1. 综合分析所有参考图的元素（人物特征、场景环境、艺术风格、光影氛围等）
2. 将这些元素有机融合，创作${total}个分镜画面
3. 每个镜头使用不同的景别（远景→全景→中景→近景→特写），形成视觉节奏
4. 描述同一场景/人物的不同角度和距离
5. 描述要具体，包含人物动作、表情、环境细节、光影氛围等
6. 同时提供一个整体场景描述，概括图片的核心视觉元素和风格特征

## 输出格式（JSON对象）：
{
  "sceneDesc": "整体场景描述：概括人物外观、场景环境、艺术风格、光影氛围等核心视觉元素（80-150字）",
  "shots": [
    {"shot": 1, "type": "ELS", "desc": "远景：详细的画面描述（50-80字）"},
    {"shot": 2, "type": "LS", "desc": "全景：详细的画面描述（50-80字）"},
    ...共${total}个
  ]
}

景别类型可选：ECU(极特写)、CU(特写)、MCU(中特写)、MS(中景)、MLS(中远景)、LS(远景)、ELS(大远景)、POV(主观视角)、OTS(过肩镜头)

请直接输出JSON对象，不要包含其他内容。`;
        }

        let result;
        if (imageDataList.length === 1) {
            result = await callGeminiAPI(prompt, imageDataList[0]);
        } else {
            result = await callGeminiAPIWithMultipleImages(prompt, imageDataList);
        }
        
        if (result) {
            // 解析JSON结果 - 新格式包含 sceneDesc 和 shots
            const parsedResult = parseAnalysisResult(result, total);
            
            // 更新场景描述字段
            if (parsedResult.sceneDesc) {
                const sceneDescEl = document.getElementById('sceneDesc');
                if (sceneDescEl) {
                    sceneDescEl.value = parsedResult.sceneDesc;
                }
                // 保存到分组 - 同时保存到 desc 和 sceneDesc 以兼容 generatePrompt()
                group.desc = parsedResult.sceneDesc;
                group.sceneDesc = parsedResult.sceneDesc;
            }
            
            // 保存分镜到分组
            group.shots = parsedResult.shots;
            group.analyzed = true;
            group.mode = currentMode; // 记录生成时的模式
            
            // 自动加载到分镜设置
            loadShotsToSettings(parsedResult.shots);
            
            // 自动重新生成提示词（确保输出区域显示最新内容）
            if (typeof generatePrompt === 'function') {
                generatePrompt();
            }
            
            const modeLabel = isStoryMode ? '故事画面' : '分镜头';
            showToast(`✅ 已生成 ${parsedResult.shots.length} 个${modeLabel}并加载到分镜设置`, 'success');
        }
    } catch (error) {
        console.error('分析失败:', error);
        showToast('分析失败: ' + error.message, 'error');
    } finally {
        delete processingImages[group.id];
        renderRefGroups();
        autoSave();
    }
}

// 解析分析结果 - 新格式包含 sceneDesc 和 shots
function parseAnalysisResult(result, total) {
    let sceneDesc = '';
    let shots = [];
    
    try {
        // 尝试提取JSON对象格式 {sceneDesc: ..., shots: [...]}
        const jsonObjMatch = result.match(/\{[\s\S]*\}/);
        if (jsonObjMatch) {
            const parsed = JSON.parse(jsonObjMatch[0]);
            
            // 提取场景描述
            if (parsed.sceneDesc) {
                sceneDesc = parsed.sceneDesc;
            }
            
            // 提取分镜数组
            if (Array.isArray(parsed.shots)) {
                for (let i = 0; i < Math.min(parsed.shots.length, total); i++) {
                    shots.push({
                        type: parsed.shots[i].type || 'MS',
                        desc: parsed.shots[i].desc || parsed.shots[i].description || ''
                    });
                }
            }
        }
        
        // 如果新格式解析失败，尝试兼容旧的数组格式
        if (shots.length === 0) {
            shots = parseMultiShotsResult(result, total);
        }
    } catch (e) {
        console.warn('新格式JSON解析失败，尝试旧格式:', e);
        // 回退到旧格式解析
        shots = parseMultiShotsResult(result, total);
    }
    
    // 确保返回足够数量的分镜
    while (shots.length < total) {
        shots.push({ type: 'MS', desc: '' });
    }
    
    return { sceneDesc, shots };
}

// 解析多镜头结果（旧格式，用于兼容）
function parseMultiShotsResult(result, total) {
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
        
        // 文本解析备用
        const lines = result.split('\n').filter(l => l.trim());
        for (const line of lines) {
            if (shots.length >= total) break;
            
            const descMatch = line.match(/["']?desc["']?\s*[:：]\s*["']?([^"'\n]+)/i);
            if (descMatch) {
                const typeMatch = line.match(/(ECU|CU|MCU|MS|MLS|LS|ELS|POV|OTS|远景|全景|中景|近景|特写)/i);
                shots.push({
                    type: typeMatch ? typeMatch[1].toUpperCase() : 'MS',
                    desc: descMatch[1].trim()
                });
            }
        }
    }
    
    // 确保返回足够数量
    while (shots.length < total) {
        shots.push({ type: 'MS', desc: '' });
    }
    
    return shots;
}

// 将镜头描述加载到分镜设置
function loadShotsToSettings(shots) {
    shots.forEach((shot, i) => {
        const shotNum = i + 1;
        const typeEl = document.getElementById(`shotType${shotNum}`);
        const descEl = document.getElementById(`shotDesc${shotNum}`);
        
        if (typeEl && shot.type) {
            // 尝试匹配景别
            const matchedType = Object.keys(shotTypes.zh).find(k => 
                shot.type.includes(k) || shot.type.toUpperCase() === k
            );
            if (matchedType) typeEl.value = matchedType;
        }
        if (descEl && shot.desc) {
            descEl.value = shot.desc;
        }
    });
}

// 从分组加载所有设置（包括场景描述和分镜）
function loadGroupToSettings(groupIndex) {
    const group = refGroups[groupIndex];
    if (!group) {
        showToast('分组不存在', 'error');
        return;
    }
    
    // 加载场景描述
    if (group.desc || group.sceneDesc) {
        const sceneDescEl = document.getElementById('sceneDesc');
        if (sceneDescEl) {
            sceneDescEl.value = group.sceneDesc || group.desc || '';
        }
    }
    
    // 加载分镜描述
    if (group.shots && group.shots.length > 0) {
        loadShotsToSettings(group.shots);
    }
    
    // 自动重新生成提示词
    if (typeof generatePrompt === 'function') {
        generatePrompt();
    }
    
    // 自动保存
    if (typeof autoSave === 'function') {
        autoSave();
    }
    
    showToast(`已加载分镜参考 ${groupIndex + 1} 的设置`, 'success');
}

// 将所有分组的分镜加载到设置
function loadAllGroupsToSettings() {
    const analyzedGroups = refGroups.filter(g => g.analyzed && g.shots && g.shots.length > 0);
    
    if (analyzedGroups.length === 0) {
        showToast('没有已分析的分镜参考可加载', 'warning');
        return;
    }
    
    // 收集所有分镜
    const allShots = [];
    const sceneDescParts = [];
    
    analyzedGroups.forEach((group, idx) => {
        if (group.sceneDesc || group.desc) {
            sceneDescParts.push(group.sceneDesc || group.desc);
        }
        if (group.shots) {
            allShots.push(...group.shots);
        }
    });
    
    // 加载场景描述（合并所有场景描述）
    const sceneDescEl = document.getElementById('sceneDesc');
    if (sceneDescEl && sceneDescParts.length > 0) {
        sceneDescEl.value = sceneDescParts.join('；');
    }
    
    // 加载分镜（截取到当前网格数量）
    const { total } = getGridInfo();
    const shotsToLoad = allShots.slice(0, total);
    
    if (shotsToLoad.length > 0) {
        loadShotsToSettings(shotsToLoad);
    }
    
    // 自动重新生成提示词
    if (typeof generatePrompt === 'function') {
        generatePrompt();
    }
    
    // 自动保存
    if (typeof autoSave === 'function') {
        autoSave();
    }
    
    showToast(`已加载 ${analyzedGroups.length} 个分组的 ${shotsToLoad.length} 个分镜`, 'success');
}

// AI分析所有分镜参考组
async function analyzeAllRefGroups() {
    const groupsWithImages = refGroups.filter(g => g.images.length > 0 && !g.analyzed);
    
    if (groupsWithImages.length === 0) {
        showToast('没有需要分析的分镜参考', 'info');
        return;
    }
    
    if (!getApiKey()) {
        showToast('请先输入API Key并测试连接', 'error');
        return;
    }
    
    showToast(`开始分析 ${groupsWithImages.length} 个分镜参考...`, 'info');
    
    for (let i = 0; i < refGroups.length; i++) {
        const group = refGroups[i];
        if (group.images.length > 0 && !group.analyzed) {
            await analyzeRefGroup(i);
            // 稍微延迟避免API限流
            await new Promise(r => setTimeout(r, 500));
        }
    }
    
    showToast('✅ 全部分析完成', 'success');
}

// 将分镜参考组的描述加载到对应镜头
function loadGroupToShot(groupIndex) {
    const group = refGroups[groupIndex];
    if (!group || !group.desc) {
        showToast('请先进行AI分析', 'warning');
        return;
    }
    
    const shotNum = groupIndex + 1;
    const descEl = document.getElementById(`shotDesc${shotNum}`);
    
    if (descEl) {
        descEl.value = group.desc;
        showToast(`✅ 已加载到镜头 ${shotNum}`, 'success');
    } else {
        showToast(`镜头 ${shotNum} 不存在，请检查布局设置`, 'error');
    }
}

// 根据分镜参考组生成所有镜头的提示词
async function generateShotsFromRefGroups() {
    const analyzedGroups = refGroups.filter(g => g.desc);
    
    if (analyzedGroups.length === 0) {
        showToast('请先对分镜参考进行AI分析', 'warning');
        return;
    }
    
    // 将所有分析结果加载到对应镜头
    analyzedGroups.forEach((group, i) => {
        const groupIndex = refGroups.indexOf(group);
        loadGroupToShot(groupIndex);
    });
    
    showToast(`✅ 已将 ${analyzedGroups.length} 个分镜参考加载到镜头`, 'success');
}

// ==================== 兼容旧版本 ====================

// 初始化上传处理器（保持兼容）
function initUploadHandlers() {
    // 新版本不需要全局上传区域，每个分组有自己的上传
    console.log('分镜参考组模式已启用');
}

// 旧版函数兼容
function handleFiles(files) {
    // 如果没有分组，先创建一个
    if (refGroups.length === 0) {
        addRefGroup();
    }
    // 添加到最后一个分组
    addImageToGroup(refGroups.length - 1, files);
}

function updateRefImages(skipAutoSave = false) {
    renderRefGroups();
    if (!skipAutoSave) {
        autoSave();
    }
}

// 实际的DOM更新操作
function updateRefImagesDOM() {
    const currentLayout = getCurrentGridLayout();
    const refImagesContainer = document.getElementById('refImages');
    
    // 使用DocumentFragment减少重排
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement('div');
    
    tempDiv.innerHTML = refImages.map((img, index) => {
        const isProcessing = processingImages[img.id];
        const processingClass = isProcessing ? 'processing' : '';
        const loadingActive = isProcessing ? 'active' : '';
        const loadingText = isProcessing ? isProcessing.text : '';
        const loadingProgress = isProcessing ? (isProcessing.progress || '') : '';
        
        const currentShots = (img.shotsData && img.shotsData[currentLayout]) || [];
        const currentGeneratedImages = (img.generatedImages && img.generatedImages[currentLayout]) || [];
        
        const allLayoutsWithShots = img.shotsData ? Object.keys(img.shotsData).filter(k => img.shotsData[k].length > 0) : [];
        const allLayoutsWithImages = img.generatedImages ? Object.keys(img.generatedImages).filter(k => img.generatedImages[k] && img.generatedImages[k].length > 0) : [];
        const totalImageCount = allLayoutsWithImages.reduce((sum, k) => sum + (img.generatedImages[k]?.length || 0), 0);
        
        return `
        <div class="ref-image-item ${currentEditingImageIndex === index ? 'editing' : ''} ${processingClass}" data-index="${index}" data-id="${img.id}">
            <div class="ref-image-loading ${loadingActive}" id="imgLoading_${img.id}">
                <div class="loading-spinner"></div>
                <div class="loading-text" id="imgLoadingText_${img.id}">${loadingText}</div>
                <div class="loading-progress" id="imgLoadingProgress_${img.id}">${loadingProgress}</div>
            </div>
            
            <button class="remove-btn" onclick="removeRefImage(${index})" ${isProcessing ? 'disabled' : ''}>✕</button>
            <div class="ref-image-index">${index + 1}</div>
            <img src="${img.data}" alt="参考图${index + 1}" 
                 onclick="selectImageForEditing(${index})" 
                 ondblclick="openImageModal(this.src)" 
                 style="cursor: pointer;" 
                 title="单击选择，双击放大"
                 loading="lazy">
            
            <div class="ref-image-actions" style="margin-top: 8px;">
                <button class="btn btn-sm btn-warning" onclick="analyzeRefImage(${index})" title="AI分析图片内容" ${isProcessing ? 'disabled' : ''}>
                    🤖 分析
                </button>
                <button class="btn btn-sm btn-primary" onclick="loadDescToShots(${index})" title="将描述加载到分镜设置" ${isProcessing ? 'disabled' : ''}>
                    📥 加载分镜
                </button>
            </div>
            ${img.analyzed ? '<div class="ai-badge">✨ 已分析</div>' : ''}
            ${totalImageCount > 0 ? '<div class="generated-badge">🖼️ ' + totalImageCount + '张</div>' : ''}
            <textarea 
                id="refDesc${index}"
                placeholder="图片描述（可AI分析或手动填写）..." 
                onchange="updateRefDesc(${index}, this.value)" ${isProcessing ? 'disabled' : ''}>${img.desc}</textarea>
        </div>
    `}).join('');
    
    // 一次性替换内容
    refImagesContainer.innerHTML = tempDiv.innerHTML;
    
    // 异步更新画廊，不阻塞主线程
    requestIdleCallback ? requestIdleCallback(() => updateAllGeneratedImagesGallery()) 
                        : setTimeout(() => updateAllGeneratedImagesGallery(), 100);
}

function removeRefImage(index) {
    const img = refImages[index];
    if (img && processingImages[img.id]) {
        showToast('该图片正在处理中，无法删除', 'warning');
        return;
    }
    refImages.splice(index, 1);
    if (currentEditingImageIndex === index) {
        currentEditingImageIndex = -1;
    } else if (currentEditingImageIndex > index) {
        currentEditingImageIndex--;
    }
    updateRefImages();
}

function selectImageForEditing(index) {
    const img = refImages[index];
    if (!img) return;
    if (currentEditingImageIndex === index) return;
    
    currentEditingImageIndex = index;
    const { total, layout } = getGridInfo();
    
    if (img.desc) {
        document.getElementById('sceneDesc').value = img.desc;
    }
    
    const shots = (img.shotsData && img.shotsData[layout]) || [];
    const prompt = (img.promptData && img.promptData[layout]) || { zh: '', en: '' };
    const generatedImage = (img.generatedImages && img.generatedImages[layout]) || null;
    
    if (shots && shots.length > 0) {
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
        document.getElementById('outputSection').classList.add('active');
        switchLang(currentLang);
    }
    
    if (generatedImage) {
        generatedImageUrl = generatedImage;
        displayGeneratedImage(generatedImage);
    }
    
    updateRefImages();
    showToast(`已切换到参考图 ${index + 1}`, 'info');
}

function updateRefDesc(index, desc) {
    refImages[index].desc = desc;
}

function saveImageShots(index) {
    const { total, layout } = getGridInfo();
    const shots = [];
    
    for (let i = 1; i <= total; i++) {
        const shotType = document.getElementById(`shotType${i}`).value;
        const shotDesc = document.getElementById(`shotDesc${i}`).value;
        shots.push({ type: shotType, desc: shotDesc });
    }
    
    if (!refImages[index].shotsData) refImages[index].shotsData = {};
    if (!refImages[index].promptData) refImages[index].promptData = {};
    
    refImages[index].shotsData[layout] = shots;
    refImages[index].promptData[layout] = { ...generatedPrompt };
    currentEditingImageIndex = index;
    updateRefImages();
    showToast(`已保存 ${shots.length} 个镜头到参考图 ${index + 1}（布局: ${layout}）`, 'success');
}

function loadImageShots(index) {
    const img = refImages[index];
    const { total, layout } = getGridInfo();
    
    const shots = (img.shotsData && img.shotsData[layout]) || [];
    const prompt = (img.promptData && img.promptData[layout]) || { zh: '', en: '' };
    
    if (!shots || shots.length === 0) {
        showToast(`该图片在布局 ${layout} 下没有保存的镜头`, 'error');
        return;
    }
    
    shots.forEach((shot, i) => {
        const shotNum = i + 1;
        if (shotNum <= total) {
            const typeEl = document.getElementById(`shotType${shotNum}`);
            const descEl = document.getElementById(`shotDesc${shotNum}`);
            if (typeEl) typeEl.value = shot.type;
            if (descEl) descEl.value = shot.desc;
        }
    });

    if (prompt && (prompt.zh || prompt.en)) {
        generatedPrompt = { ...prompt };
        document.getElementById('outputSection').classList.add('active');
        switchLang(currentLang);
    }

    if (img.desc) {
        document.getElementById('sceneDesc').value = img.desc;
    }

    currentEditingImageIndex = index;
    updateRefImages();
    showToast(`已加载参考图 ${index + 1} 的 ${shots.length} 个镜头（布局: ${layout}）`, 'success');
}

// AI分析参考图
async function analyzeRefImage(index) {
    const img = refImages[index];
    if (!img) {
        showToast('参考图不存在', 'error');
        return;
    }
    
    if (!getApiKey()) {
        showToast('请先输入API Key并测试连接', 'error');
        return;
    }
    
    showLoading('AI正在分析图片...');
    
    try {
        const result = await analyzeImage(img.data);
        if (result) {
            refImages[index].desc = result;
            refImages[index].analyzed = true;
            updateRefImages();
            hideLoading();
            showToast('✅ AI分析完成', 'success');
        } else {
            throw new Error('未获取到分析结果');
        }
    } catch (error) {
        hideLoading();
        console.error('AI分析图片失败:', error);
        showToast('分析失败: ' + error.message, 'error');
    }
}

// 将参考图描述加载到分镜设置
async function loadDescToShots(index) {
    const img = refImages[index];
    if (!img) {
        showToast('参考图不存在', 'error');
        return;
    }
    
    // 将描述加载到场景描述
    if (img.desc) {
        document.getElementById('sceneDesc').value = img.desc;
    }
    
    // 如果有已保存的分镜数据，加载分镜
    const { total, layout } = getGridInfo();
    const shots = (img.shotsData && img.shotsData[layout]) || [];
    
    if (shots.length > 0) {
        // 加载已有分镜
        shots.forEach((shot, i) => {
            const shotNum = i + 1;
            if (shotNum <= total) {
                const typeEl = document.getElementById(`shotType${shotNum}`);
                const descEl = document.getElementById(`shotDesc${shotNum}`);
                if (typeEl) typeEl.value = shot.type || 'MS';
                if (descEl) descEl.value = shot.desc || '';
            }
        });
        currentEditingImageIndex = index;
        updateRefImages();
        autoSave(); // 自动保存分镜数据
        showToast(`✅ 已加载参考图 ${index + 1} 的分镜数据（${shots.length} 个镜头）`, 'success');
    } else if (img.desc) {
        // 没有分镜数据，但有描述，询问是否AI生成分镜
        if (confirm(`参考图 ${index + 1} 没有保存的分镜数据。\n\n是否根据图片描述自动生成 ${total} 个分镜？`)) {
            currentEditingImageIndex = index;
            updateRefImages();
            autoSave(); // 自动保存当前选中状态
            // 调用综合生成分镜功能
            await generateShotsFromAllImages();
        } else {
            currentEditingImageIndex = index;
            updateRefImages();
            autoSave(); // 自动保存当前选中状态
            showToast(`已选中参考图 ${index + 1}，请手动填写分镜内容`, 'info');
        }
    } else {
        // 没有描述也没有分镜
        showToast('请先点击"🤖 分析"按钮分析图片内容', 'warning');
    }
}

// 添加到文生图参考
function addToImageGenRef(index) {
    const img = refImages[index];
    const exists = imageGenRefImages.find(r => r.id === img.id);
    if (exists) {
        showToast('该图片已在文生图参考列表中', 'warning');
        return;
    }
    if (imageGenRefImages.length >= 9) {
        showToast('最多支持9张参考图', 'error');
        return;
    }
    imageGenRefImages.push({
        id: img.id,
        data: img.data,
        source: 'upload'
    });
    updateImageGenRefDisplay();
    showToast('已添加到文生图参考', 'success');
}

async function analyzeOneImage(index) {
    if (!getApiKey()) {
        showToast('请先输入API Key并测试连接', 'error');
        return;
    }

    showLoading('AI正在分析图片...');
    
    try {
        const result = await analyzeImage(refImages[index].data);
        refImages[index].desc = result;
        refImages[index].analyzed = true;
        updateRefImages();
        autoSave();
        showToast('图片分析完成', 'success');
    } catch (error) {
        showToast('分析失败: ' + error.message, 'error');
    }
    
    hideLoading();
}

async function analyzeAllImages() {
    if (!getApiKey()) {
        showToast('请先输入API Key并测试连接', 'error');
        return;
    }

    if (refImages.length === 0) {
        showToast('请先上传参考图片', 'error');
        return;
    }

    showLoading('AI正在分析所有图片...');
    
    try {
        for (let i = 0; i < refImages.length; i++) {
            document.getElementById('loadingText').textContent = `正在分析第 ${i + 1}/${refImages.length} 张图片...`;
            const result = await analyzeImage(refImages[i].data);
            refImages[i].desc = result;
            refImages[i].analyzed = true;
            updateRefImages();
        }
        
        autoSave();
        showToast('所有图片分析完成', 'success');
    } catch (error) {
        showToast('分析失败: ' + error.message, 'error');
    }
    
    hideLoading();
}

function generateAllImageShots() {
    if (!getApiKey()) {
        showToast('请先输入API Key并测试连接', 'error');
        return;
    }

    if (refImages.length === 0) {
        showToast('请先上传参考图片', 'error');
        return;
    }

    const availableImages = refImages.filter(img => !processingImages[img.id]);
    if (availableImages.length === 0) {
        showToast('所有图片都在处理中', 'warning');
        return;
    }

    // 使用队列机制控制并发，避免API压力过大
    const MAX_CONCURRENT = 2; // 最大同时处理2张
    let currentIndex = 0;
    let runningCount = 0;
    let completedCount = 0;
    const totalCount = availableImages.length;
    
    const processNext = async () => {
        while (currentIndex < refImages.length && runningCount < MAX_CONCURRENT) {
            const index = currentIndex++;
            const img = refImages[index];
            
            if (processingImages[img.id]) continue;
            
            runningCount++;
            
            try {
                await generateShotsForImage(index);
            } catch (e) {
                console.error(`参考图 ${index + 1} 处理失败:`, e);
            }
            
            runningCount--;
            completedCount++;
            updateProcessingStatus(`批量生成中: ${completedCount}/${totalCount}`);
            
            // 继续处理下一张
            processNext();
        }
        
        if (completedCount >= totalCount) {
            showToast(`✅ 批量生成完成：${completedCount} 张图片已处理`, 'success');
            updateProcessingStatus();
        }
    };
    
    showToast(`📋 开始批量处理 ${totalCount} 张图片（每次最多${MAX_CONCURRENT}张并行）`, 'info');
    updateProcessingStatus(`批量生成中: 0/${totalCount}`);
    
    // 启动初始并发
    for (let i = 0; i < MAX_CONCURRENT && i < totalCount; i++) {
        processNext();
    }
}

function generateAllImages() {
    if (!getApiKey()) {
        showToast('请先输入API Key并测试连接', 'error');
        return;
    }

    if (refImages.length === 0) {
        showToast('请先上传参考图片', 'error');
        return;
    }

    const { layout } = getGridInfo();

    // 筛选出有提示词且未在处理中的图片
    const availableIndices = [];
    refImages.forEach((img, index) => {
        const promptData = img.promptData && img.promptData[layout];
        const hasPrompt = promptData && (promptData.zh || promptData.en);
        const notProcessing = !processingImages[img.id];
        if (hasPrompt && notProcessing) {
            availableIndices.push(index);
        }
    });

    if (availableIndices.length === 0) {
        const noPromptCount = refImages.filter(img => {
            const promptData = img.promptData && img.promptData[layout];
            return !promptData || (!promptData.zh && !promptData.en);
        }).length;
        if (noPromptCount > 0) {
            showToast(`有 ${noPromptCount} 张图片在布局 ${layout} 下还没有生成提示词，请先生成分镜`, 'warning');
        } else {
            showToast('所有图片都在处理中或已完成', 'warning');
        }
        return;
    }

    // 使用队列机制控制并发，AI生图一次只处理1张（API较慢）
    const MAX_CONCURRENT = 1;
    let queueIndex = 0;
    let runningCount = 0;
    let completedCount = 0;
    const totalCount = availableIndices.length;
    
    const processNext = async () => {
        while (queueIndex < availableIndices.length && runningCount < MAX_CONCURRENT) {
            const imageIndex = availableIndices[queueIndex++];
            
            if (processingImages[refImages[imageIndex].id]) continue;
            
            runningCount++;
            
            try {
                await generateImageForRef(imageIndex);
            } catch (e) {
                console.error(`参考图 ${imageIndex + 1} AI生图失败:`, e);
            }
            
            runningCount--;
            completedCount++;
            updateProcessingStatus(`批量生图中: ${completedCount}/${totalCount}`);
            
            // 继续处理下一张
            processNext();
        }
        
        if (completedCount >= totalCount) {
            showToast(`✅ 批量AI生图完成：${completedCount} 张图片（布局: ${layout}）`, 'success');
            updateProcessingStatus();
        }
    };
    
    showToast(`🎨 开始批量AI生图 ${totalCount} 张图片（布局: ${layout}）`, 'info');
    updateProcessingStatus(`批量生图中: 0/${totalCount}`);
    
    // 启动处理
    processNext();
}

// 将图片描述用作场景
function useAsScene(index) {
    const desc = refImages[index].desc;
    if (desc) {
        document.getElementById('sceneDesc').value = desc;
        showToast('已应用到场景描述', 'success');
    } else {
        showToast('请先分析图片或填写描述', 'error');
    }
}

// ==================== 文生图参考图管理 ====================

function updateImageGenRefDisplay() {
    const container = document.getElementById('imageGenRefList');
    const countEl = document.getElementById('imageGenRefCount');
    
    countEl.textContent = `(${imageGenRefImages.length}/9)`;
    
    if (imageGenRefImages.length === 0) {
        container.innerHTML = '<div class="image-gen-ref-empty">暂无参考图，可从上方参考图点击"用于文生图"添加，或直接上传/输入URL</div>';
        return;
    }
    
    container.innerHTML = imageGenRefImages.map((img, index) => `
        <div class="image-gen-ref-item">
            <button class="remove-btn" onclick="removeImageGenRef(${index})">✕</button>
            <img src="${img.data}" alt="参考图${index + 1}" onclick="openImageModal(this.src)" title="点击放大">
            <span class="source-badge">${img.source === 'url' ? 'URL' : '上传'}</span>
        </div>
    `).join('');
}

function removeImageGenRef(index) {
    imageGenRefImages.splice(index, 1);
    updateImageGenRefDisplay();
    autoSave();
}

function clearImageGenRef() {
    imageGenRefImages = [];
    updateImageGenRefDisplay();
    autoSave();
    showToast('已清空文生图参考图', 'success');
}

function uploadImageGenRef() {
    document.getElementById('imageGenRefInput').click();
}

function initImageGenRefUpload() {
    const input = document.getElementById('imageGenRefInput');
    if (input) {
        input.addEventListener('change', function(e) {
            const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
            
            files.forEach(file => {
                if (imageGenRefImages.length >= 9) {
                    showToast('最多支持9张参考图', 'warning');
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = (ev) => {
                    imageGenRefImages.push({
                        id: Date.now() + Math.random(),
                        data: ev.target.result,
                        source: 'upload'
                    });
                    updateImageGenRefDisplay();
                };
                reader.readAsDataURL(file);
            });
            
            if (files.length > 0) {
                showToast(`已添加 ${Math.min(files.length, 9 - imageGenRefImages.length + files.length)} 张参考图`, 'success');
            }
            e.target.value = '';
        });
    }
}

function addImageGenRefByUrl() {
    if (imageGenRefImages.length >= 9) {
        showToast('最多支持9张参考图', 'error');
        return;
    }
    
    const url = prompt('请输入图片URL：');
    if (!url) return;
    
    if (!url.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|bmp)/i) && !url.startsWith('data:image/')) {
        showToast('请输入有效的图片URL', 'error');
        return;
    }
    
    showLoading('正在加载图片...');
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        try {
            const dataUrl = canvas.toDataURL('image/png');
            imageGenRefImages.push({
                id: Date.now() + Math.random(),
                data: dataUrl,
                source: 'url'
            });
            updateImageGenRefDisplay();
            showToast('图片添加成功', 'success');
        } catch (e) {
            imageGenRefImages.push({
                id: Date.now() + Math.random(),
                data: url,
                source: 'url'
            });
            updateImageGenRefDisplay();
            showToast('图片添加成功（使用原始URL）', 'success');
        }
        hideLoading();
    };
    img.onerror = function() {
        hideLoading();
        showToast('图片加载失败，请检查URL是否正确', 'error');
    };
    img.src = url;
}

// ==================== 参考图选择器（添加到文生图） ====================

// 临时存储选中的参考图
let selectedRefImagesForGen = new Set();

// 打开参考图选择器 - 从分镜参考组中选择
function openAddRefImagePicker() {
    // 收集所有分镜参考组中的图片
    const allImages = [];
    refGroups.forEach((group, groupIndex) => {
        group.images.forEach((img, imgIndex) => {
            allImages.push({
                groupIndex,
                imgIndex,
                id: img.id,
                data: img.data,
                label: `分镜${groupIndex + 1}-图${imgIndex + 1}`
            });
        });
    });
    
    // 兼容旧版 refImages
    refImages.forEach((img, index) => {
        allImages.push({
            type: 'legacy',
            index,
            id: img.id,
            data: img.data,
            label: `参考图${index + 1}`
        });
    });
    
    if (allImages.length === 0) {
        showToast('请先在分镜参考中上传图片', 'warning');
        return;
    }
    
    selectedRefImagesForGen.clear();
    
    const container = document.getElementById('refImagePickerList');
    
    // 生成参考图列表
    container.innerHTML = allImages.map((img, index) => {
        // 检查该图片是否已经添加到文生图参考中
        const alreadyAdded = imageGenRefImages.some(r => r.sourceId === img.id);
        
        return `
            <div class="ref-picker-item ${alreadyAdded ? 'already-added' : ''}" 
                 data-index="${index}" 
                 onclick="toggleRefImageSelectionNew(${index}, this)"
                 style="position: relative; width: 100px; height: 100px; border-radius: 8px; overflow: hidden; cursor: pointer; border: 3px solid ${alreadyAdded ? '#4CAF50' : 'transparent'}; transition: all 0.2s;">
                <img src="${img.data}" style="width: 100%; height: 100%; object-fit: cover;" alt="${img.label}">
                <div style="position: absolute; top: 4px; left: 4px; background: rgba(0,0,0,0.7); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${img.label}</div>
                ${alreadyAdded ? '<div style="position: absolute; top: 4px; right: 4px; background: #4CAF50; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">✓</div>' : ''}
                <div class="selection-check" style="position: absolute; bottom: 4px; right: 4px; width: 24px; height: 24px; background: rgba(33,150,243,0.9); border-radius: 50%; display: none; align-items: center; justify-content: center; color: white; font-size: 14px;">✓</div>
            </div>
        `;
    }).join('');
    
    // 存储当前的图片列表供后续使用
    window._pickerImages = allImages;
    
    document.getElementById('refImagePickerModal').style.display = 'flex';
}

// 切换参考图选择状态（新版）
function toggleRefImageSelectionNew(index, element) {
    const img = window._pickerImages[index];
    const alreadyAdded = imageGenRefImages.some(r => r.sourceId === img.id);
    
    if (alreadyAdded) {
        showToast('该图片已添加到文生图参考', 'info');
        return;
    }
    
    if (selectedRefImagesForGen.has(index)) {
        selectedRefImagesForGen.delete(index);
        element.style.border = '3px solid transparent';
        element.querySelector('.selection-check').style.display = 'none';
    } else {
        // 检查是否超过限制
        const currentCount = imageGenRefImages.length + selectedRefImagesForGen.size;
        if (currentCount >= 9) {
            showToast('最多只能添加9张参考图', 'warning');
            return;
        }
        selectedRefImagesForGen.add(index);
        element.style.border = '3px solid #2196F3';
        element.querySelector('.selection-check').style.display = 'flex';
    }
}

// 确认添加选中的参考图
function confirmAddRefImages() {
    if (selectedRefImagesForGen.size === 0) {
        showToast('请选择要添加的参考图', 'warning');
        return;
    }
    
    let addedCount = 0;
    selectedRefImagesForGen.forEach(index => {
        const img = window._pickerImages[index];
        if (imageGenRefImages.length < 9) {
            imageGenRefImages.push({
                id: Date.now() + Math.random(),
                data: img.data,
                source: 'ref',
                sourceId: img.id,
                desc: img.label
            });
            addedCount++;
        }
    });
    
    updateImageGenRefDisplay();
    closeRefImagePicker();
    autoSave();
    showToast(`已添加 ${addedCount} 张参考图到文生图`, 'success');
}

// 关闭参考图选择器
function closeRefImagePicker() {
    document.getElementById('refImagePickerModal').style.display = 'none';
    selectedRefImagesForGen.clear();
    window._pickerImages = null;
}

// 兼容旧版函数
function toggleRefImageSelection(index, element) {
    toggleRefImageSelectionNew(index, element);
}
