import Koa from 'koa';
import Router from '@koa/router';
import { koaBody } from 'koa-body';
import cors from '@koa/cors';
import serve from 'koa-static';
import { GitIngest } from '../../src/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建应用实例
const app = new Koa();
const router = new Router();

// 错误处理中间件
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    const error = err as Error;
    ctx.status = error.name === 'ValidationError' ? 400 : 500;
    ctx.body = {
      success: false,
      error: error.message
    };
    // 记录错误日志
    console.error(`[${new Date().toISOString()}] Error:`, error);
  }
});

// 请求日志中间件
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`[${new Date().toISOString()}] ${ctx.method} ${ctx.url} - ${ms}ms`);
});

// 基础中间件
app.use(koaBody());
app.use(cors({
  allowMethods: ['GET', 'POST'],
  allowHeaders: ['Content-Type', 'Authorization']
}));
app.use(serve(__dirname));

// 创建 GitIngest 实例
const ingest = new GitIngest({
  tempDir: "./temp-web",
  keepTempFiles: false,
  defaultPatterns: {
    exclude: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
  }
});

// 工具函数：处理目标路径
const processTargetPaths = (paths?: string) => {
  if (!paths) return undefined;
  return paths.split(',').map(p => p.trim()).filter(Boolean);
};

// 工具函数：格式化文件内容
const formatFileContent = (content: string) => {
  // 移除多余的空行和分隔符
  return content.split('File: ')
    .filter(Boolean)
    .map(section => {
      const [path, ...contentLines] = section.trim().split('\n');
      return `File: ${path}\n${contentLines.join('\n')}`;
    })
    .join('\n\n');
};

// API 路由
router.post('/analyze/local', async (ctx) => {
  const { path: dirPath, targetPaths } = ctx.request.body as {
    path?: string;
    targetPaths?: string;
  };

  if (!dirPath) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: '目录路径不能为空'
    };
    return;
  }

  const result = await ingest.analyzeFromDirectory(dirPath, {
    targetPaths: processTargetPaths(targetPaths)
  });

  // 格式化文件内容
  result.content = formatFileContent(result.content);

  ctx.body = {
    success: true,
    data: result
  };
});

router.post('/analyze/github', async (ctx) => {
  const { url, branch, targetPaths } = ctx.request.body as {
    url?: string;
    branch?: string;
    targetPaths?: string;
  };

  if (!url) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: '仓库 URL 不能为空'
    };
    return;
  }

  const result = await ingest.analyzeFromUrl(url, {
    branch,
    targetPaths: processTargetPaths(targetPaths),
    maxFileSize: 500 * 1024 // 500KB
  });

  // 格式化文件内容
  result.content = formatFileContent(result.content);

  ctx.body = {
    success: true,
    data: result
  };
});

// 健康检查接口
router.get('/health', (ctx) => {
  ctx.body = {
    success: true,
    timestamp: new Date().toISOString(),
    status: 'running'
  };
});

// 注册路由
app.use(router.routes()).use(router.allowedMethods());

// 全局错误事件监听
app.on('error', (err, ctx) => {
  console.error('服务器错误:', err);
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] 服务器启动成功: http://localhost:${PORT}`);
}); 