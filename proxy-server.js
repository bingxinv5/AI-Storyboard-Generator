/**
 * 统一服务器 - 代理 + AI图片放大
 * 
 * 功能：
 * 1. API代理 - 解决浏览器 SSL/CORS 问题
 * 2. AI图片放大 - 集成 Upscayl 功能
 * 
 * 使用方法：
 * 1. 运行: node proxy-server.js
 * 2. 访问: http://localhost:3456
 */

const http = require('http');
const https = require('https');
const url = require('url');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// 全局错误处理
process.on('uncaughtException', (err) => {
    console.error('⚠️ 未捕获的异常:', err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error('⚠️ 未处理的Promise拒绝:', reason);
});

const PORT = 3456;
const TARGET_HOST = 'api.bltcy.ai';

// ==================== Upscayl 配置 ====================
const UPSCAYL_DIR = path.join(__dirname, 'upscayl-api');
const UPSCAYL_BIN = path.join(UPSCAYL_DIR, 'bin', 'upscayl-bin.exe');
const MODELS_PATH = path.join(UPSCAYL_DIR, 'models');
const UPLOAD_DIR = path.join(UPSCAYL_DIR, 'uploads');
const OUTPUT_DIR = path.join(UPSCAYL_DIR, 'outputs');

// 检查 Upscayl 是否可用
const UPSCAYL_AVAILABLE = fs.existsSync(UPSCAYL_BIN);
if (UPSCAYL_AVAILABLE) {
    [UPLOAD_DIR, OUTPUT_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
}

const MODELS = ['upscayl-standard-4x', 'upscayl-lite-4x', 'high-fidelity-4x', 'remacri-4x', 'ultramix-balanced-4x', 'ultrasharp-4x', 'digital-art-4x'];
const tasks = new Map();

// 生成 UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

// Upscayl 放大函数
function upscale(input, output, opts) {
    return new Promise((resolve, reject) => {
        if (!UPSCAYL_AVAILABLE) {
            return reject(new Error('Upscayl 未安装'));
        }
        const args = [
            '-i', input,
            '-o', output,
            '-m', MODELS_PATH,
            '-n', opts.model || 'upscayl-standard-4x',
            '-s', String(opts.scale || 4),
            '-f', opts.format || 'png',
            '-c', String(opts.compression || 0)
        ];
        console.log('[Upscayl]', args.join(' '));
        const proc = spawn(UPSCAYL_BIN, args);
        let err = '';
        proc.stderr.on('data', d => err += d);
        proc.on('close', code => {
            if (code === 0 && fs.existsSync(output)) {
                resolve();
            } else {
                reject(new Error(err || 'Upscayl 处理失败'));
            }
        });
        proc.on('error', reject);
    });
}

// 解析 JSON 请求体
function parseJSONBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

// 收集请求体为 Buffer
function collectBody(req) {
    return new Promise((resolve) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

// 发送 JSON 响应
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(data));
}

// ==================== 创建服务器 ====================
const server = http.createServer(async (req, res) => {
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // ==================== Upscayl API 路由 ====================
    
    // 健康检查
    if (pathname === '/api/health') {
        return sendJSON(res, 200, {
            status: 'ok',
            proxy: true,
            target: TARGET_HOST,
            upscayl: UPSCAYL_AVAILABLE,
            gpu: UPSCAYL_AVAILABLE ? 'GPU Available' : 'Not Available',
            models: UPSCAYL_AVAILABLE ? MODELS : []
        });
    }
    
    // 代理健康检查（兼容旧路径）
    if (pathname === '/health-check' || pathname === '/health') {
        return sendJSON(res, 200, { status: 'ok', proxy: true, target: TARGET_HOST });
    }

    // 获取模型列表
    if (pathname === '/api/models' && req.method === 'GET') {
        if (!UPSCAYL_AVAILABLE) {
            return sendJSON(res, 503, { error: 'Upscayl 未安装' });
        }
        return sendJSON(res, 200, {
            status: 'success',
            data: MODELS.map(id => ({ id, name: id, scale: 4 }))
        });
    }

    // Base64 图片放大
    if (pathname === '/api/upscale/base64' && req.method === 'POST') {
        if (!UPSCAYL_AVAILABLE) {
            return sendJSON(res, 503, { error: 'Upscayl 未安装，请检查 upscayl-api 目录' });
        }
        
        try {
            const body = await parseJSONBody(req);
            let { image, model, scale, format, compression } = body;
            
            if (!image) {
                return sendJSON(res, 400, { error: '缺少 image 参数' });
            }

            // 解析 base64 图片
            let buf, inputFormat = 'png';
            if (image.startsWith('data:')) {
                const match = image.match(/^data:image\/(\w+);base64,(.+)$/);
                if (match) {
                    inputFormat = match[1] === 'jpeg' ? 'jpg' : match[1];
                    buf = Buffer.from(match[2], 'base64');
                }
            } else {
                buf = Buffer.from(image, 'base64');
            }

            if (!buf) {
                return sendJSON(res, 400, { error: '无效的 base64 图片' });
            }

            const id = generateUUID();
            const inPath = path.join(UPLOAD_DIR, `${id}.${inputFormat}`);
            const outFormat = format || 'png';
            const outPath = path.join(OUTPUT_DIR, `${id}_up.${outFormat}`);

            // 写入临时文件
            fs.writeFileSync(inPath, buf);

            // 执行放大
            await upscale(inPath, outPath, {
                model: model || 'upscayl-standard-4x',
                scale: parseInt(scale) || 4,
                format: outFormat,
                compression: parseInt(compression) || 0
            });

            // 读取结果
            const outBuf = fs.readFileSync(outPath);
            
            // 清理临时文件
            try { fs.unlinkSync(inPath); } catch (e) {}
            try { fs.unlinkSync(outPath); } catch (e) {}

            const mimeType = outFormat === 'jpg' ? 'jpeg' : outFormat;
            return sendJSON(res, 200, {
                status: 'success',
                data: {
                    image: `data:image/${mimeType};base64,${outBuf.toString('base64')}`,
                    format: outFormat,
                    size: outBuf.length
                }
            });

        } catch (error) {
            console.error('[Upscale Error]', error.message);
            return sendJSON(res, 500, { error: error.message });
        }
    }

    // 任务状态查询
    if (pathname.startsWith('/api/task/') && req.method === 'GET') {
        const taskId = pathname.split('/').pop();
        const task = tasks.get(taskId);
        if (!task) {
            return sendJSON(res, 404, { error: '任务不存在' });
        }
        return sendJSON(res, 200, { status: 'success', data: task });
    }

    // ==================== 视频 CDN 代理（解决 CORS） ====================
    
    // 代理 filesystem.site 的视频资源
    if (pathname.startsWith('/video-proxy/')) {
        const videoPath = pathname.replace('/video-proxy/', '');
        const videoUrl = `https://filesystem.site/${videoPath}`;
        
        console.log(`[${new Date().toLocaleTimeString()}] 🎬 视频代理: ${videoUrl}`);
        
        let responseSent = false;
        
        // 使用递归函数处理重定向
        const proxyVideo = (url, redirectCount = 0) => {
            if (responseSent) return;
            
            if (redirectCount > 5) {
                console.error('  ✗ 重定向次数过多');
                if (!responseSent) {
                    responseSent = true;
                    return sendJSON(res, 502, { error: '重定向次数过多' });
                }
                return;
            }
            
            const parsedUrl = new URL(url);
            const protocol = parsedUrl.protocol === 'https:' ? https : http;
            
            const videoReq = protocol.request(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': '*/*',
                    'Referer': 'https://filesystem.site/',
                    'Connection': 'keep-alive'
                },
                rejectUnauthorized: false, // 跳过 SSL 验证
                timeout: 120000 // 120秒连接超时
            }, (videoRes) => {
                if (responseSent) return;
                
                // 处理重定向
                if (videoRes.statusCode >= 300 && videoRes.statusCode < 400 && videoRes.headers.location) {
                    console.log(`  ↪ 重定向到: ${videoRes.headers.location}`);
                    return proxyVideo(videoRes.headers.location, redirectCount + 1);
                }
                
                // 检查是否成功
                if (videoRes.statusCode >= 400) {
                    console.error(`  ✗ 视频请求失败: ${videoRes.statusCode}`);
                    if (!responseSent) {
                        responseSent = true;
                        return sendJSON(res, videoRes.statusCode, { error: `视频加载失败: HTTP ${videoRes.statusCode}` });
                    }
                    return;
                }
                
                responseSent = true;
                
                // 设置 CORS 和内容类型
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Content-Type', videoRes.headers['content-type'] || 'video/mp4');
                if (videoRes.headers['content-length']) {
                    res.setHeader('Content-Length', videoRes.headers['content-length']);
                }
                res.setHeader('Accept-Ranges', 'bytes');
                res.setHeader('Cache-Control', 'public, max-age=3600');
                
                res.writeHead(videoRes.statusCode);
                videoRes.pipe(res);
                
                videoRes.on('error', (err) => {
                    console.error('  ✗ 视频流错误:', err.message);
                });
            });
            
            videoReq.on('error', (error) => {
                console.error('  ✗ 视频代理错误:', error.message);
                if (!responseSent) {
                    responseSent = true;
                    sendJSON(res, 502, { error: '视频加载失败: ' + error.message });
                }
            });
            
            videoReq.on('timeout', () => {
                videoReq.destroy();
                console.error('  ✗ 视频请求超时 (60s)');
                if (!responseSent) {
                    responseSent = true;
                    sendJSON(res, 504, { error: '视频请求超时，可能是网络问题或视频服务器无响应' });
                }
            });
            
            videoReq.end();
        };
        
        proxyVideo(videoUrl);
        return;
    }

    // ==================== 代理功能 ====================
    
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    
    // 收集请求体
    const bodyBuffer = await collectBody(req);
    console.log(`  📦 请求体大小: ${(bodyBuffer.length / 1024).toFixed(2)} KB`);
    
    // 根据请求路径设置超时
    let requestTimeout = 180000;
    if (req.url.includes('/images/')) {
        requestTimeout = 600000;
        console.log('  📷 图片API请求，超时时间: 10分钟');
    } else if (req.url.includes('/video/')) {
        requestTimeout = 120000;
        console.log('  🎬 视频API请求，超时时间: 2分钟');
    }
    
    // 构建代理请求
    const options = {
        hostname: TARGET_HOST,
        port: 443,
        path: req.url,
        method: req.method,
        headers: {
            ...req.headers,
            host: TARGET_HOST,
            'content-length': bodyBuffer.length
        },
        rejectUnauthorized: true
    };
    
    delete options.headers['host'];
    delete options.headers['connection'];
    delete options.headers['transfer-encoding'];
    
    console.log(`  📤 转发到: https://${TARGET_HOST}${req.url}`);
    
    // 标记请求是否已完成
    let requestCompleted = false;
    
    const proxyReq = https.request(options, (proxyRes) => {
        if (requestCompleted) return;
        clearTimeout(timeoutTimer);
        console.log(`  ↳ 响应状态: ${proxyRes.statusCode}`);
        
        Object.keys(proxyRes.headers).forEach(key => {
            if (key.toLowerCase() !== 'transfer-encoding') {
                res.setHeader(key, proxyRes.headers[key]);
            }
        });
        
        res.writeHead(proxyRes.statusCode);
        proxyRes.pipe(res);
        
        proxyRes.on('end', () => {
            requestCompleted = true;
        });
    });
    
    // 监听客户端断开连接，取消代理请求
    req.on('close', () => {
        if (!requestCompleted) {
            console.log('  ⚡ 客户端断开连接，取消代理请求');
            requestCompleted = true;
            clearTimeout(timeoutTimer);
            proxyReq.destroy();
        }
    });
    
    req.on('aborted', () => {
        if (!requestCompleted) {
            console.log('  ⚡ 客户端中止请求');
            requestCompleted = true;
            clearTimeout(timeoutTimer);
            proxyReq.destroy();
        }
    });
    
    const timeoutTimer = setTimeout(() => {
        if (requestCompleted) return;
        console.error(`  ✗ 请求超时 (${requestTimeout/1000}秒)`);
        requestCompleted = true;
        proxyReq.destroy();
        if (!res.headersSent) {
            sendJSON(res, 504, { error: 'Gateway Timeout' });
        }
    }, requestTimeout);
    
    proxyReq.on('error', (error) => {
        if (requestCompleted) return;
        requestCompleted = true;
        clearTimeout(timeoutTimer);
        
        // 如果是因为客户端断开导致的错误，不需要记录为错误
        if (error.message === 'socket hang up' || error.code === 'ECONNRESET') {
            console.log('  ⚡ 连接已断开（可能是客户端取消）');
            return;
        }
        
        console.error(`  ✗ 代理错误: ${error.message}`);
        
        if (res.headersSent) return;
        
        // SSL 错误重试
        if (error.code && error.code.includes('SSL')) {
            console.log('  ↻ 跳过 SSL 验证重试...');
            const retryReq = https.request({ ...options, rejectUnauthorized: false }, (proxyRes) => {
                if (res.headersSent) return;
                Object.keys(proxyRes.headers).forEach(key => {
                    if (key.toLowerCase() !== 'transfer-encoding') {
                        res.setHeader(key, proxyRes.headers[key]);
                    }
                });
                res.writeHead(proxyRes.statusCode);
                proxyRes.pipe(res);
            });
            retryReq.on('error', (e) => {
                if (!res.headersSent) sendJSON(res, 502, { error: e.message });
            });
            if (bodyBuffer.length > 0) retryReq.write(bodyBuffer);
            retryReq.end();
        } else {
            sendJSON(res, 502, { error: error.message });
        }
    });
    
    if (bodyBuffer.length > 0) proxyReq.write(bodyBuffer);
    proxyReq.end();
});

server.listen(PORT, () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  🚀 统一服务器已启动');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  📡 服务地址: http://localhost:${PORT}`);
    console.log(`  🎯 代理目标: https://${TARGET_HOST}`);
    console.log(`  🔍 AI放大: ${UPSCAYL_AVAILABLE ? '✅ 可用' : '❌ 未安装'}`);
    console.log('');
    console.log('  API 端点:');
    console.log('  • 健康检查: GET  /api/health');
    console.log('  • 模型列表: GET  /api/models');
    console.log('  • 图片放大: POST /api/upscale/base64');
    console.log('  • 代理转发: /*');
    console.log('');
    console.log('  按 Ctrl+C 停止服务');
    console.log('═══════════════════════════════════════════════════════');
});

process.on('SIGINT', () => {
    console.log('\n👋 服务器已停止');
    process.exit(0);
});
