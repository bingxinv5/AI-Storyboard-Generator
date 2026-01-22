/**
 * 任务队列系统
 * 统一管理提示词推理、图片生成、视频生成等异步任务
 */

// ==================== 任务类型定义 ====================
const TaskType = {
    PROMPT: 'prompt',           // 提示词推理/AI分析
    IMAGE_GEN: 'image_gen',     // 图片生成
    VIDEO_GEN: 'video_gen',     // 视频生成
    OTHER: 'other'              // 其他任务
};

// 任务状态
const TaskStatus = {
    PENDING: 'pending',         // 等待中
    RUNNING: 'running',         // 运行中
    COMPLETED: 'completed',     // 已完成
    FAILED: 'failed',           // 失败
    CANCELLED: 'cancelled'      // 已取消
};

// 任务优先级
const TaskPriority = {
    LOW: 0,
    NORMAL: 1,
    HIGH: 2,
    URGENT: 3
};

// ==================== 任务队列管理器 ====================
class TaskQueueManager {
    constructor() {
        this.tasks = new Map();              // 所有任务 taskId -> task
        this.queue = [];                     // 等待队列
        this.runningTasks = new Map();       // 正在运行的任务 taskId -> task
        this.completedTasks = [];            // 已完成任务历史
        this.maxConcurrent = {               // 各类型最大并发数
            [TaskType.PROMPT]: 5,
            [TaskType.IMAGE_GEN]: 9,
            [TaskType.VIDEO_GEN]: 9,
            [TaskType.OTHER]: 5
        };
        this.currentConcurrent = {           // 当前各类型运行数
            [TaskType.PROMPT]: 0,
            [TaskType.IMAGE_GEN]: 0,
            [TaskType.VIDEO_GEN]: 0,
            [TaskType.OTHER]: 0
        };
        this.isPaused = false;               // 队列是否暂停
        this.listeners = new Set();          // 状态变化监听器
        this.taskIdCounter = 0;
        this.taskKeyMap = new Map();         // 任务唯一标识映射 uniqueKey -> taskId（用于去重）
        
        // 从本地存储恢复未完成任务
        this.loadFromStorage();
    }

    // ==================== 任务创建 ====================
    
    /**
     * 检查任务是否已存在（用于去重）
     * @param {string} uniqueKey 任务唯一标识
     * @returns {boolean} 任务是否已存在且未完成
     */
    hasActiveTask(uniqueKey) {
        if (!uniqueKey) return false;
        const existingTaskId = this.taskKeyMap.get(uniqueKey);
        if (!existingTaskId) return false;
        
        const task = this.tasks.get(existingTaskId);
        if (!task) {
            this.taskKeyMap.delete(uniqueKey);
            return false;
        }
        
        // 只有等待中或运行中的任务才算存在
        if (task.status === TaskStatus.PENDING || task.status === TaskStatus.RUNNING) {
            return true;
        }
        
        // 已完成/失败/取消的任务，移除映射
        this.taskKeyMap.delete(uniqueKey);
        return false;
    }
    
    /**
     * 创建新任务
     * @param {Object} options 任务选项
     * @returns {string|null} 任务ID，如果任务已存在返回 null
     */
    createTask(options) {
        const {
            type = TaskType.OTHER,
            name = '未命名任务',
            description = '',
            priority = TaskPriority.NORMAL,
            executor,                        // 执行函数 async (task, updateProgress) => result
            onProgress,                      // 进度回调
            onComplete,                      // 完成回调
            onError,                         // 错误回调
            data = {},                       // 任务数据
            retryCount = 0,                  // 重试次数
            maxRetries = 3,                  // 最大重试次数
            timeout = 0,                     // 超时时间(ms)，0表示不限
            uniqueKey = null                 // 任务唯一标识（用于去重）
        } = options;

        // 检查任务是否已存在
        if (uniqueKey && this.hasActiveTask(uniqueKey)) {
            console.log(`任务已存在，跳过: ${uniqueKey}`);
            showToast(`任务已在队列中: ${name}`, 'info');
            return null;
        }

        const taskId = `task_${Date.now()}_${++this.taskIdCounter}`;
        
        const task = {
            id: taskId,
            type,
            name,
            description,
            priority,
            status: TaskStatus.PENDING,
            progress: 0,
            progressText: '',
            executor,
            onProgress,
            onComplete,
            onError,
            data,
            result: null,
            error: null,
            retryCount,
            maxRetries,
            timeout,
            uniqueKey,
            createdAt: Date.now(),
            startedAt: null,
            completedAt: null,
            duration: null
        };

        this.tasks.set(taskId, task);
        this.queue.push(taskId);
        
        // 记录唯一标识映射
        if (uniqueKey) {
            this.taskKeyMap.set(uniqueKey, taskId);
        }
        
        // 按优先级排序队列
        this.sortQueue();
        
        this.notifyListeners('taskCreated', task);
        this.saveToStorage();
        this.processQueue();
        
        return taskId;
    }

    // ==================== 便捷方法 ====================

    /**
     * 添加提示词推理任务
     */
    addPromptTask(name, executor, options = {}) {
        return this.createTask({
            type: TaskType.PROMPT,
            name,
            executor,
            ...options
        });
    }

    /**
     * 添加图片生成任务
     * @param {string} name 任务名称
     * @param {Function} executor 执行函数
     * @param {Object} options 选项，包含 uniqueKey 用于去重
     */
    addImageTask(name, executor, options = {}) {
        return this.createTask({
            type: TaskType.IMAGE_GEN,
            name,
            executor,
            timeout: 600000, // 10分钟超时
            ...options
        });
    }

    /**
     * 添加视频生成任务
     * @param {string} name 任务名称
     * @param {Function} executor 执行函数
     * @param {Object} options 选项，包含 uniqueKey 用于去重
     */
    addVideoTask(name, executor, options = {}) {
        return this.createTask({
            type: TaskType.VIDEO_GEN,
            name,
            executor,
            timeout: 1800000, // 30分钟超时
            ...options
        });
    }
    
    /**
     * 批量添加视频生成任务
     * @param {Array} taskConfigs 任务配置数组 [{name, executor, uniqueKey, ...options}]
     * @returns {Array} 成功添加的任务ID列表
     */
    addBatchVideoTasks(taskConfigs) {
        const addedTasks = [];
        const skippedCount = { duplicate: 0 };
        
        for (const config of taskConfigs) {
            const { name, executor, ...options } = config;
            const taskId = this.addVideoTask(name, executor, options);
            if (taskId) {
                addedTasks.push(taskId);
            } else {
                skippedCount.duplicate++;
            }
        }
        
        if (addedTasks.length > 0) {
            showToast(`已添加 ${addedTasks.length} 个视频任务到队列${skippedCount.duplicate > 0 ? `，跳过 ${skippedCount.duplicate} 个重复任务` : ''}`, 'success');
        } else if (skippedCount.duplicate > 0) {
            showToast(`所有任务都已在队列中`, 'info');
        }
        
        return addedTasks;
    }
    
    /**
     * 批量添加图片生成任务
     * @param {Array} taskConfigs 任务配置数组 [{name, executor, uniqueKey, ...options}]
     * @returns {Array} 成功添加的任务ID列表
     */
    addBatchImageTasks(taskConfigs) {
        const addedTasks = [];
        const skippedCount = { duplicate: 0 };
        
        for (const config of taskConfigs) {
            const { name, executor, ...options } = config;
            const taskId = this.addImageTask(name, executor, options);
            if (taskId) {
                addedTasks.push(taskId);
            } else {
                skippedCount.duplicate++;
            }
        }
        
        if (addedTasks.length > 0) {
            showToast(`已添加 ${addedTasks.length} 个图片任务到队列${skippedCount.duplicate > 0 ? `，跳过 ${skippedCount.duplicate} 个重复任务` : ''}`, 'success');
        } else if (skippedCount.duplicate > 0) {
            showToast(`所有任务都已在队列中`, 'info');
        }
        
        return addedTasks;
    }
    
    /**
     * 设置并发数
     * @param {string} type 任务类型
     * @param {number} count 最大并发数
     */
    setMaxConcurrent(type, count) {
        if (this.maxConcurrent.hasOwnProperty(type)) {
            this.maxConcurrent[type] = Math.max(1, Math.min(20, count));
            this.processQueue(); // 重新处理队列
        }
    }
    
    /**
     * 获取当前并发设置
     */
    getMaxConcurrent() {
        return { ...this.maxConcurrent };
    }

    // ==================== 队列处理 ====================

    /**
     * 处理队列中的任务
     */
    async processQueue() {
        if (this.isPaused) return;

        // 遍历队列，找出可以运行的任务
        const tasksToRun = [];
        
        for (const taskId of this.queue) {
            const task = this.tasks.get(taskId);
            if (!task || task.status !== TaskStatus.PENDING) continue;

            // 检查该类型是否还能运行更多任务
            if (this.currentConcurrent[task.type] < this.maxConcurrent[task.type]) {
                tasksToRun.push(taskId);
            }
        }

        // 启动任务
        for (const taskId of tasksToRun) {
            this.runTask(taskId);
        }
    }

    /**
     * 运行单个任务
     */
    async runTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task || task.status !== TaskStatus.PENDING) return;

        // 从等待队列移除
        this.queue = this.queue.filter(id => id !== taskId);
        
        // 更新状态
        task.status = TaskStatus.RUNNING;
        task.startedAt = Date.now();
        this.runningTasks.set(taskId, task);
        this.currentConcurrent[task.type]++;

        this.notifyListeners('taskStarted', task);
        this.updateUI();

        // 创建进度更新函数
        const updateProgress = (progress, text = '') => {
            task.progress = Math.min(100, Math.max(0, progress));
            task.progressText = text;
            if (task.onProgress) {
                task.onProgress(task.progress, text, task);
            }
            this.notifyListeners('taskProgress', task);
            this.updateUI();
        };

        // 超时处理
        let timeoutId = null;
        const timeoutPromise = task.timeout > 0 ? new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(`任务超时 (${task.timeout / 1000}秒)`));
            }, task.timeout);
        }) : null;

        try {
            // 执行任务
            const executorPromise = task.executor(task, updateProgress);
            
            let result;
            if (timeoutPromise) {
                result = await Promise.race([executorPromise, timeoutPromise]);
            } else {
                result = await executorPromise;
            }

            if (timeoutId) clearTimeout(timeoutId);

            // 任务完成
            task.status = TaskStatus.COMPLETED;
            task.result = result;
            task.progress = 100;
            task.completedAt = Date.now();
            task.duration = task.completedAt - task.startedAt;

            if (task.onComplete) {
                task.onComplete(result, task);
            }

            this.notifyListeners('taskCompleted', task);
            console.log(`✅ 任务完成: ${task.name} (${(task.duration / 1000).toFixed(1)}秒)`);

        } catch (error) {
            if (timeoutId) clearTimeout(timeoutId);

            // 检查是否可以重试
            if (task.retryCount < task.maxRetries) {
                task.retryCount++;
                task.status = TaskStatus.PENDING;
                task.progress = 0;
                task.progressText = `重试中 (${task.retryCount}/${task.maxRetries})...`;
                
                // 重新加入队列
                this.queue.unshift(taskId);
                this.notifyListeners('taskRetry', task);
                console.warn(`⚠️ 任务重试: ${task.name} (${task.retryCount}/${task.maxRetries})`);
            } else {
                // 任务失败
                task.status = TaskStatus.FAILED;
                task.error = error.message || String(error);
                task.completedAt = Date.now();
                task.duration = task.completedAt - task.startedAt;

                if (task.onError) {
                    task.onError(error, task);
                }

                this.notifyListeners('taskFailed', task);
                console.error(`❌ 任务失败: ${task.name}`, error);
            }
        } finally {
            // 清理
            this.runningTasks.delete(taskId);
            this.currentConcurrent[task.type]--;

            // 清理任务去重映射（任务结束后允许再次添加相同任务）
            if (task.uniqueKey) {
                this.taskKeyMap.delete(task.uniqueKey);
            }

            // 添加到完成历史
            if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
                this.completedTasks.unshift(task);
                // 只保留最近100条历史
                if (this.completedTasks.length > 100) {
                    this.completedTasks.pop();
                }
            }

            this.saveToStorage();
            this.updateUI();
            
            // 继续处理队列
            this.processQueue();
        }
    }

    // ==================== 任务控制 ====================

    /**
     * 取消任务
     */
    cancelTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) return false;

        if (task.status === TaskStatus.PENDING) {
            // 等待中的任务直接取消
            task.status = TaskStatus.CANCELLED;
            this.queue = this.queue.filter(id => id !== taskId);
            
            // 清理任务去重映射
            if (task.uniqueKey) {
                this.taskKeyMap.delete(task.uniqueKey);
            }
            
            this.notifyListeners('taskCancelled', task);
            this.saveToStorage();
            this.updateUI();
            return true;
        } else if (task.status === TaskStatus.RUNNING) {
            // 运行中的任务标记为取消（需要执行器支持取消）
            // 注意：taskKeyMap 会在 finally 块中清理
            task.status = TaskStatus.CANCELLED;
            this.notifyListeners('taskCancelled', task);
            return true;
        }

        return false;
    }

    /**
     * 暂停队列
     */
    pause() {
        this.isPaused = true;
        this.notifyListeners('queuePaused', null);
        this.updateUI();
    }

    /**
     * 恢复队列
     */
    resume() {
        this.isPaused = false;
        this.notifyListeners('queueResumed', null);
        this.processQueue();
        this.updateUI();
    }

    /**
     * 清空等待队列
     */
    clearQueue() {
        for (const taskId of this.queue) {
            const task = this.tasks.get(taskId);
            if (task) {
                task.status = TaskStatus.CANCELLED;
                // 清理任务去重映射
                if (task.uniqueKey) {
                    this.taskKeyMap.delete(task.uniqueKey);
                }
            }
        }
        this.queue = [];
        this.notifyListeners('queueCleared', null);
        this.saveToStorage();
        this.updateUI();
    }

    /**
     * 暂停所有任务
     */
    pauseAll() {
        this.pause();
    }

    /**
     * 恢复所有任务
     */
    resumeAll() {
        this.resume();
    }

    /**
     * 清除已完成的任务
     */
    clearCompleted() {
        // 从tasks中移除已完成和已取消的任务
        for (const [taskId, task] of this.tasks.entries()) {
            if (task.status === TaskStatus.COMPLETED || 
                task.status === TaskStatus.CANCELLED ||
                task.status === TaskStatus.FAILED) {
                this.tasks.delete(taskId);
            }
        }
        this.saveToStorage();
        this.updateUI();
        if (typeof showToast === 'function') {
            showToast('已清除完成的任务', 'success');
        }
    }

    /**
     * 取消所有任务
     */
    cancelAll() {
        // 取消等待中的任务
        this.clearQueue();
        
        // 取消运行中的任务
        for (const [taskId, task] of this.runningTasks.entries()) {
            task.status = TaskStatus.CANCELLED;
            this.notifyListeners('taskCancelled', task);
        }
        
        this.updateUI();
        if (typeof showToast === 'function') {
            showToast('已取消所有任务', 'warning');
        }
    }

    /**
     * 清空历史记录
     */
    clearHistory() {
        this.completedTasks = [];
        this.saveToStorage();
        this.updateUI();
        if (typeof showToast === 'function') {
            showToast('历史记录已清空', 'success');
        }
    }

    /**
     * 重新排序队列（按优先级）
     */
    sortQueue() {
        this.queue.sort((a, b) => {
            const taskA = this.tasks.get(a);
            const taskB = this.tasks.get(b);
            if (!taskA || !taskB) return 0;
            // 优先级高的在前，相同优先级按创建时间
            if (taskB.priority !== taskA.priority) {
                return taskB.priority - taskA.priority;
            }
            return taskA.createdAt - taskB.createdAt;
        });
    }

    /**
     * 调整任务优先级
     */
    setPriority(taskId, priority) {
        const task = this.tasks.get(taskId);
        if (task && task.status === TaskStatus.PENDING) {
            task.priority = priority;
            this.sortQueue();
            this.updateUI();
            return true;
        }
        return false;
    }

    // ==================== 状态查询 ====================

    getTask(taskId) {
        return this.tasks.get(taskId);
    }

    getQueuedTasks() {
        return this.queue.map(id => this.tasks.get(id)).filter(Boolean);
    }

    getRunningTasks() {
        return Array.from(this.runningTasks.values());
    }

    getCompletedTasks() {
        return this.completedTasks;
    }

    getStats() {
        return {
            pending: this.queue.length,
            running: this.runningTasks.size,
            completed: this.completedTasks.filter(t => t.status === TaskStatus.COMPLETED).length,
            failed: this.completedTasks.filter(t => t.status === TaskStatus.FAILED).length,
            isPaused: this.isPaused,
            concurrent: { ...this.currentConcurrent },
            maxConcurrent: { ...this.maxConcurrent }
        };
    }

    // ==================== 事件监听 ====================

    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notifyListeners(event, task) {
        for (const listener of this.listeners) {
            try {
                listener(event, task, this.getStats());
            } catch (e) {
                console.error('任务队列监听器错误:', e);
            }
        }
    }

    // ==================== 持久化 ====================

    saveToStorage() {
        try {
            const data = {
                queue: this.queue,
                tasks: Array.from(this.tasks.entries()).filter(([id, task]) => 
                    task.status === TaskStatus.PENDING || task.status === TaskStatus.RUNNING
                ),
                completedTasks: this.completedTasks.slice(0, 50) // 只保存最近50条
            };
            localStorage.setItem('taskQueue', JSON.stringify(data));
        } catch (e) {
            console.warn('保存任务队列失败:', e);
        }
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem('taskQueue');
            if (saved) {
                const data = JSON.parse(saved);
                // 恢复完成历史
                if (data.completedTasks) {
                    this.completedTasks = data.completedTasks;
                }
                // 注意：不恢复未完成任务，因为执行器函数无法序列化
                // 清理无效的任务数据，只保留完成历史
                if (data.queue?.length > 0 || data.tasks?.length > 0) {
                    console.log('🧹 清理无效的任务队列数据（刷新后任务无法恢复）');
                    this.saveToStorage(); // 重新保存，不包含无效任务
                }
            }
        } catch (e) {
            console.warn('加载任务队列失败:', e);
        }
    }

    // ==================== UI 更新 ====================

    updateUI() {
        // 使用外部渲染函数
        if (typeof updateTaskQueueStats === 'function') {
            updateTaskQueueStats();
        }
        if (typeof renderTaskList === 'function') {
            renderTaskList();
        }
    }

    /**
     * 渲染单个任务项
     */
    renderTaskItem(task) {
        const typeIcons = {
            [TaskType.PROMPT]: '🤖',
            [TaskType.IMAGE_GEN]: '🖼️',
            [TaskType.VIDEO_GEN]: '🎬',
            [TaskType.OTHER]: '📦'
        };

        const statusClasses = {
            [TaskStatus.PENDING]: 'pending',
            [TaskStatus.RUNNING]: 'running',
            [TaskStatus.COMPLETED]: 'completed',
            [TaskStatus.FAILED]: 'failed',
            [TaskStatus.CANCELLED]: 'cancelled'
        };

        const priorityLabels = {
            [TaskPriority.LOW]: '',
            [TaskPriority.NORMAL]: '',
            [TaskPriority.HIGH]: '⬆️',
            [TaskPriority.URGENT]: '🔥'
        };

        return `
            <div class="task-item ${statusClasses[task.status]}" data-task-id="${task.id}">
                <div class="task-item-header">
                    <span class="task-type-icon">${typeIcons[task.type]}</span>
                    <span class="task-name">${task.name}</span>
                    <span class="task-priority">${priorityLabels[task.priority]}</span>
                    ${task.status === TaskStatus.PENDING || task.status === TaskStatus.RUNNING ? 
                        `<button class="task-cancel-btn" onclick="taskQueue.cancelTask('${task.id}')" title="取消">✕</button>` : ''
                    }
                </div>
                ${task.status === TaskStatus.RUNNING ? `
                    <div class="task-progress">
                        <div class="task-progress-bar" style="width: ${task.progress}%"></div>
                    </div>
                    <div class="task-progress-text">${task.progressText || `${task.progress}%`}</div>
                ` : ''}
                ${task.status === TaskStatus.FAILED ? `
                    <div class="task-error">${task.error}</div>
                ` : ''}
                ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
            </div>
        `;
    }
}

// ==================== 全局实例 ====================
const taskQueue = new TaskQueueManager();

// 当前显示的标签页
let currentTaskTab = 'all';

// ==================== UI 辅助函数 ====================

// 切换任务面板显示
function toggleTaskQueuePanel() {
    const panel = document.getElementById('taskQueuePanel');
    if (panel) {
        panel.classList.toggle('visible');
        if (panel.classList.contains('visible')) {
            taskQueue.updateUI();
        }
    }
}

// 切换任务标签页
function switchTaskTab(tab) {
    currentTaskTab = tab;
    
    // 更新标签按钮状态
    document.querySelectorAll('.task-queue-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // 重新渲染列表
    renderTaskList();
}

// 渲染任务列表
function renderTaskList() {
    const container = document.getElementById('taskQueueList');
    if (!container) return;
    
    const allTasks = [];
    
    // 收集所有任务
    for (const task of taskQueue.tasks.values()) {
        allTasks.push(task);
    }
    
    // 根据标签过滤
    let filteredTasks = allTasks;
    switch (currentTaskTab) {
        case 'running':
            filteredTasks = allTasks.filter(t => t.status === TaskStatus.RUNNING);
            break;
        case 'pending':
            filteredTasks = allTasks.filter(t => t.status === TaskStatus.PENDING);
            break;
        case 'completed':
            filteredTasks = allTasks.filter(t => t.status === TaskStatus.COMPLETED);
            break;
        case 'failed':
            filteredTasks = allTasks.filter(t => t.status === TaskStatus.FAILED || t.status === TaskStatus.CANCELLED);
            break;
    }
    
    // 排序：运行中 > 等待中 > 完成/失败
    filteredTasks.sort((a, b) => {
        const statusOrder = {
            [TaskStatus.RUNNING]: 0,
            [TaskStatus.PENDING]: 1,
            [TaskStatus.COMPLETED]: 2,
            [TaskStatus.FAILED]: 3,
            [TaskStatus.CANCELLED]: 4
        };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
            return statusOrder[a.status] - statusOrder[b.status];
        }
        return (b.createdAt || 0) - (a.createdAt || 0);
    });
    
    if (filteredTasks.length === 0) {
        container.innerHTML = `
            <div class="task-queue-empty">
                <div class="task-queue-empty-icon">📭</div>
                <div>暂无任务</div>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">任务将在这里显示</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredTasks.map(task => taskQueue.renderTaskItem(task)).join('');
}

// 更新统计信息
function updateTaskQueueStats() {
    const stats = taskQueue.getStats();
    
    // 更新徽章
    const badge = document.getElementById('taskQueueBadge');
    if (badge) {
        const activeCount = stats.pending + stats.running;
        badge.textContent = activeCount;
        badge.style.display = activeCount > 0 ? 'flex' : 'none';
    }
    
    // 更新浮动按钮状态
    const floatBtn = document.getElementById('taskQueueFloatBtn');
    if (floatBtn) {
        floatBtn.classList.toggle('has-tasks', stats.running > 0);
    }
    
    // 更新标签计数
    const allTasks = Array.from(taskQueue.tasks.values());
    document.getElementById('tabCountAll')?.textContent && 
        (document.getElementById('tabCountAll').textContent = allTasks.length);
    document.getElementById('tabCountRunning')?.textContent && 
        (document.getElementById('tabCountRunning').textContent = allTasks.filter(t => t.status === TaskStatus.RUNNING).length);
    document.getElementById('tabCountPending')?.textContent && 
        (document.getElementById('tabCountPending').textContent = allTasks.filter(t => t.status === TaskStatus.PENDING).length);
    document.getElementById('tabCountCompleted')?.textContent && 
        (document.getElementById('tabCountCompleted').textContent = allTasks.filter(t => t.status === TaskStatus.COMPLETED).length);
    document.getElementById('tabCountFailed')?.textContent && 
        (document.getElementById('tabCountFailed').textContent = allTasks.filter(t => t.status === TaskStatus.FAILED || t.status === TaskStatus.CANCELLED).length);
    
    // 更新统计卡片
    document.getElementById('statTotal')?.textContent && 
        (document.getElementById('statTotal').textContent = allTasks.length);
    document.getElementById('statRunning')?.textContent && 
        (document.getElementById('statRunning').textContent = stats.running);
    document.getElementById('statCompleted')?.textContent && 
        (document.getElementById('statCompleted').textContent = stats.completed);
    document.getElementById('statFailed')?.textContent && 
        (document.getElementById('statFailed').textContent = stats.failed);
}

// 显示任务历史
function showTaskHistory() {
    const history = taskQueue.getCompletedTasks();
    
    const content = history.length === 0 ? 
        '<p style="text-align: center; color: #888;">暂无历史记录</p>' :
        history.map(task => `
            <div class="history-item ${task.status}">
                <div class="history-header">
                    <span>${task.status === TaskStatus.COMPLETED ? '✅' : '❌'}</span>
                    <span class="history-name">${task.name}</span>
                    <span class="history-time">${new Date(task.completedAt).toLocaleString()}</span>
                </div>
                ${task.duration ? `<div class="history-duration">耗时: ${(task.duration / 1000).toFixed(1)}秒</div>` : ''}
                ${task.error ? `<div class="history-error">${task.error}</div>` : ''}
            </div>
        `).join('');

    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'task-history-modal';
    modal.innerHTML = `
        <div class="task-history-content">
            <div class="task-history-header">
                <h3>📜 任务历史</h3>
                <button onclick="this.closest('.task-history-modal').remove()">✕</button>
            </div>
            <div class="task-history-list">${content}</div>
            <div class="task-history-footer">
                <button class="btn btn-danger" onclick="clearTaskHistory(); this.closest('.task-history-modal').remove();">清空历史</button>
                <button class="btn" onclick="this.closest('.task-history-modal').remove()">关闭</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// 清空任务历史
function clearTaskHistory() {
    taskQueue.completedTasks = [];
    taskQueue.saveToStorage();
    if (typeof showToast === 'function') {
        showToast('历史记录已清空', 'success');
    }
}

// ==================== 初始化 ====================

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 监听任务状态变化
    taskQueue.addListener((event, task, stats) => {
        updateTaskQueueStats();
        renderTaskList();
    });
    
    // 初始化UI
    setTimeout(() => {
        updateTaskQueueStats();
    }, 100);
});

console.log('📋 任务队列系统已加载');
