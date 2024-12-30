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

  // 生成 Mermaid 图表数据
  const mermaidDiagrams = {
    // 依赖关系图
    dependencies: generateDependencyGraph(result)
  };

  ctx.body = {
    success: true,
    data: {
      ...result,
      mermaidDiagrams
    }
  };
});

// 工具函数：生成依赖关系图
function generateDependencyGraph(result: any) {
  let graph = 'graph LR\n';
  const nodes = new Map<string, Set<string>>(); // 文件 -> 导出项集合
  const edges = new Set<string>();

  // 第一遍扫描：收集所有文件及其导出项
  result.content.split('File: ').forEach((section: string) => {
    if (!section) return;
    const lines = section.split('\n');
    const filePath = lines[0].trim();
    const exports = new Set<string>();

    lines.forEach((line: string) => {
      // 收集导出的类
      const classMatch = line.match(/export\s+class\s+(\w+)/);
      if (classMatch) {
        exports.add(classMatch[1]);
      }

      // 收集导出的类型和接口
      const typeMatch = line.match(/export\s+(type|interface)\s+(\w+)/);
      if (typeMatch) {
        exports.add(typeMatch[2]);
      }

      // 收集导出的常量和函数
      const constMatch = line.match(/export\s+(?:const|function)\s+(\w+)/);
      if (constMatch) {
        exports.add(constMatch[1]);
      }
    });

    nodes.set(filePath, exports);
  });

  // 生成节点ID映射
  const nodeIds = new Map<string, string>();
  Array.from(nodes.keys()).forEach((file, index) => {
    nodeIds.set(file, `n${index}`);
  });

  // 添加节点
  nodes.forEach((exports, file) => {
    const nodeId = nodeIds.get(file) || '';
    graph += `  ${nodeId}["${file}"]\n`;
  });

  // 第二遍扫描：分析导入关系
  result.content.split('File: ').forEach((section: string) => {
    if (!section) return;
    const lines = section.split('\n');
    const currentFile = lines[0].trim();
    const currentId = nodeIds.get(currentFile);
    if (!currentId) return;

    lines.forEach((line: string) => {
      if (line.includes('import ')) {
        // 处理具名导入
        const namedImport = line.match(/import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/);
        if (namedImport) {
          const [, imports, from] = namedImport;
          const importItems = imports.split(',').map(s => s.trim().split(' as ')[0]);

          // 解析导入路径
          const importPath = resolveImportPath(currentFile, from);
          if (importPath && nodes.has(importPath)) {
            const targetId = nodeIds.get(importPath);
            if (targetId) {
              importItems.forEach(item => {
                if (nodes.get(importPath)?.has(item)) {
                  graph += `  ${currentId} -- "${item}" --> ${targetId}\n`;
                }
              });
            }
          }
        }

        // 处理默认导入
        const defaultImport = line.match(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/);
        if (defaultImport) {
          const [, importName, from] = defaultImport;
          const importPath = resolveImportPath(currentFile, from);
          if (importPath && nodes.has(importPath)) {
            const targetId = nodeIds.get(importPath);
            if (targetId) {
              graph += `  ${currentId} -- "${importName}" --> ${targetId}\n`;
            }
          }
        }
      }
    });
  });

  return graph;
}

// 辅助函数：解析导入路径
function resolveImportPath(currentFile: string, importPath: string): string | null {
  if (!importPath.startsWith('.')) {
    return null; // 忽略非相对路径导入
  }

  // 移除 .js 扩展名
  importPath = importPath.replace(/\.js$/, '.ts');

  // 获取当前文件的目录
  const currentDir = currentFile.split('/').slice(0, -1).join('/');

  // 解析相对路径
  let resolvedPath = importPath.startsWith('./')
    ? `${currentDir}/${importPath.slice(2)}`
    : importPath.startsWith('../')
      ? `${currentDir}/../${importPath.slice(3)}`
      : importPath;

  // 规范化路径
  resolvedPath = resolvedPath.split('/').reduce((acc: string[], part: string) => {
    if (part === '..') {
      acc.pop();
    } else if (part !== '.') {
      acc.push(part);
    }
    return acc;
  }, []).join('/');

  return resolvedPath;
}

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

  // 生成 Mermaid 图表数据
  const mermaidDiagrams = {
    // 依赖关系图
    dependencies: generateDependencyGraph(result)
  };

  ctx.body = {
    success: true,
    data: {
      ...result,
      mermaidDiagrams
    }
  };
});

// 添加新的路由处理 /:owner/:repo 格式的请求
router.get('/:owner/:repo', async (ctx) => {
  const { owner, repo } = ctx.params;
  const githubUrl = `https://github.com/${owner}/${repo}`;

  try {
    // 分析仓库
    const result = await ingest.analyzeFromUrl(githubUrl, {
      maxFileSize: 500 * 1024 // 500KB
    });

    // 渲染 HTML 页面
    const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${owner}/${repo} - GitIngest 分析结果</title>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      <style>
        .tree-view { font-family: monospace; white-space: pre; }
        .code-block { font-family: monospace; white-space: pre-wrap; max-height: 400px; overflow-y: auto; }
      </style>
    </head>
    <body class="bg-gray-100">
      <div class="container mx-auto px-4 py-8">
        <h1 class="text-4xl font-bold text-center mb-8">${owner}/${repo}</h1>
        
        <div class="bg-white rounded-lg shadow-lg p-6 mb-8">
          <!-- 基本信息 -->
          <div class="mb-6">
            <h3 class="text-xl font-semibold mb-2">基本信息</h3>
            <div class="bg-gray-50 p-4 rounded">
              文件数: ${result.metadata.files}
              总大小: ${result.metadata.size} bytes
              预估Token数: ${result.metadata.tokens}
            </div>
          </div>

          <!-- 文件树 -->
          <div class="mb-6">
            <h3 class="text-xl font-semibold mb-2">文件树</h3>
            <div class="bg-gray-50 p-4 rounded tree-view">${result.tree}</div>
          </div>

          <!-- 项目概要 -->
          <div class="mb-6">
            <h3 class="text-xl font-semibold mb-2">项目概要</h3>
            <div class="bg-gray-50 p-4 rounded whitespace-pre-line">${result.summary}</div>
          </div>

          <!-- 文件内容 -->
          <div>
            <h3 class="text-xl font-semibold mb-2">文件内容</h3>
            <div class="space-y-4">
              ${result.content
        .split(/File: /)
        .filter(Boolean)
        .map(section => {
          const lines = section.split('\n');
          const filePath = lines[0].trim();
          const content = lines.slice(2).join('\n').trim();
          return `
                    <div class="bg-gray-50 p-4 rounded">
                      <div class="font-semibold mb-2 text-blue-600">${filePath}</div>
                      <div class="code-block bg-gray-100 p-4 rounded">${content}</div>
                    </div>
                  `;
        })
        .join('')}
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
    `;

    ctx.type = 'html';
    ctx.body = html;
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      // error: error.message
    };
  }
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