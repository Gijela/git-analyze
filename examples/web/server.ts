import Koa from 'koa';
import Router from '@koa/router';
import { koaBody } from 'koa-body';
import cors from '@koa/cors';
import serve from 'koa-static';
import { GitIngest } from '../../src/index.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { DependencyAnalyzer } from '../../src/core/dependency/analyzer.js';
import { EnhancedScanner } from '../../src/core/dependency/enhanced-scanner.js';
import { join } from 'path';

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

// 创建依赖分析器和增强扫描器实例
const dependencyAnalyzer = new DependencyAnalyzer();
const enhancedScanner = new EnhancedScanner(dependencyAnalyzer);

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
      // 清理路径，移除临时目录前缀
      const cleanPath = path
        .replace(/^temp-web\/\d+\/[^/]+\/src\//, 'src/') // 处理带临时目录的 src 路径
        .replace(/^temp-web\/\d+\/[^/]+\//, '')          // 处理其他临时目录路径
        .replace(/\\/g, '/');                            // 统一使用正斜杠
      return `File: ${cleanPath}\n${contentLines.join('\n')}`;
    })
    .join('\n\n');
};

// 修改分析结果处理函数
async function processAnalysisResult(result: any) {
  const mermaidDiagrams = {
    dependencies: generateDependencyGraph(result)
  };

  return {
    ...result,
    mermaidDiagrams
  };
}

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

  result.content = formatFileContent(result.content);

  // 使用新的处理函数
  ctx.body = {
    success: true,
    data: await processAnalysisResult(result)
  };
});

// 工具函数：生成依赖关系图
function generateDependencyGraph(result: any) {
  let graph = 'graph LR\n';
  const nodes = new Map<string, Set<string>>();
  const externalDeps = new Set<string>();
  const edges = new Map<string, Set<string>>();

  // 忽略的文件类型
  const ignoredExtensions = ['.css', '.less', '.scss', '.sass', '.style', '.styles'];

  // 判断是否为样式文件
  const isStyleFile = (path: string) => {
    return ignoredExtensions.some(ext =>
      path.toLowerCase().endsWith(ext) || path.toLowerCase().includes(ext + '.')
    );
  };

  // 第一遍扫描：收集所有文件及其导出项
  result.content.split('File: ').forEach((section: string) => {
    if (!section) return;
    const lines = section.split('\n');
    const filePath = lines[0].trim();

    // 跳过样式文件
    if (isStyleFile(filePath)) return;

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

  // 添加文件节点
  nodes.forEach((exports, file) => {
    const nodeId = nodeIds.get(file) || '';
    graph += `  ${nodeId}["${file}"]\n`;
  });

  // 添加外部依赖节点
  let externalNodeCount = 0;
  const externalNodeIds = new Map<string, string>();

  // 修改解析导入路径函数
  function resolveImportPath(currentFile: string, importPath: string): string | null {
    if (!importPath.startsWith('.')) {
      return null; // 忽略非相对路径导入
    }

    // 获取当前文件的目录和导入路径的分解
    const currentDir = currentFile.split('/').slice(0, -1).join('/');
    const importParts = importPath.split('/');
    const importFileName = importParts.pop() || '';
    const importDirPath = importParts.join('/');

    // 解析基础目录路径
    let resolvedBasePath = importPath.startsWith('./')
      ? join(currentDir, importDirPath).replace(/\\/g, '/')
      : importPath.startsWith('../')
        ? join(currentDir, '..', importDirPath).replace(/\\/g, '/')
        : join(currentDir, importDirPath).replace(/\\/g, '/');

    // 规范化路径
    resolvedBasePath = resolvedBasePath.split('/').reduce((acc: string[], part: string) => {
      if (part === '..') {
        acc.pop();
      } else if (part !== '.') {
        acc.push(part);
      }
      return acc;
    }, []).join('/');

    // 如果文件名已有扩展名，直接返回完整路径
    if (importFileName.includes('.')) {
      return join(resolvedBasePath, importFileName).replace(/\\/g, '/');
    }

    // 尝试不同的可能性
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.py', '.go', '.java'];

    // 1. 尝试直接添加扩展名
    for (const ext of extensions) {
      const pathWithExt = join(resolvedBasePath, importFileName + ext).replace(/\\/g, '/');
      // 检查完整路径和相对路径
      const possiblePaths = [
        pathWithExt,
        pathWithExt.replace(/^.*?\/src\//, 'src/'), // 尝试从 src 开始的路径
        pathWithExt.replace(/^.*?\/src\//, '')      // 尝试不带 src 的路径
      ];

      for (const path of possiblePaths) {
        if (nodes.has(path)) {
          return path;
        }
      }
    }

    // 2. 尝试查找 index 文件
    for (const ext of extensions) {
      const indexPath = join(resolvedBasePath, importFileName, 'index' + ext).replace(/\\/g, '/');
      // 同样检查完整路径和相对路径
      const possiblePaths = [
        indexPath,
        indexPath.replace(/^.*?\/src\//, 'src/'), // 尝试从 src 开始的路径
        indexPath.replace(/^.*?\/src\//, '')      // 尝试不带 src 的路径
      ];

      for (const path of possiblePaths) {
        if (nodes.has(path)) {
          return path;
        }
      }
    }

    // 如果都没找到，返回最可能的路径（用于显示在图中）
    const defaultPath = join(resolvedBasePath, importFileName + '.ts').replace(/\\/g, '/');
    return defaultPath.replace(/^.*?\/src\//, 'src/'); // 默认使用 src 开头的路径
  }

  // 第二遍扫描：分析导入关系
  result.content.split('File: ').forEach((section: string) => {
    if (!section) return;
    const lines = section.split('\n');
    const currentFile = lines[0].trim();

    if (isStyleFile(currentFile)) return;

    const currentId = nodeIds.get(currentFile);
    if (!currentId) return;

    lines.forEach((line: string) => {
      const fileExt = currentFile.split('.').pop() || '';
      const importMatches = getImportMatches(line, fileExt);

      for (const match of importMatches) {
        if (!match) continue;

        // 获取导入路径 (最后一个捕获组总是路径)
        const from = match[match.length - 1];

        // 获取导入项
        let importItems = '';
        if (match[1] && match[2]) {
          // 处理 import { a, b } from 'path' 形式
          importItems = match[1];
        } else if (match[1]) {
          // 处理 import name from 'path' 形式
          importItems = match[1];
        }

        // 跳过样式文件
        if (isStyleFile(from)) continue;

        // 处理外部库导入
        if (!from.startsWith('.')) {
          if (!externalNodeIds.has(from)) {
            const extId = `ext${externalNodeCount++}`;
            externalNodeIds.set(from, extId);
            graph += `  ${extId}["${from}"]\n`;
          }
          const edgeKey = `${currentId},${externalNodeIds.get(from)}`;
          if (!edges.has(edgeKey)) {
            edges.set(edgeKey, new Set([importItems]));
          } else {
            edges.get(edgeKey)?.add(importItems);
          }
          continue;
        }

        // 处理相对路径导入
        const importPath = resolveImportPath(currentFile, from);
        if (importPath && !isStyleFile(importPath)) {
          const targetId = nodeIds.get(importPath);
          if (targetId) {
            const edgeKey = `${currentId},${targetId}`;
            if (!edges.has(edgeKey)) {
              edges.set(edgeKey, new Set([importItems]));
            } else {
              edges.get(edgeKey)?.add(importItems);
            }
          }
        }
      }
    });
  });

  // 添加节点
  nodes.forEach((exports, file) => {
    const nodeId = nodeIds.get(file) || '';
    graph += `  ${nodeId}["${file}"]\n`;
  });

  // 添加带标签的边
  edges.forEach((importItems, key) => {
    const [fromId, toId] = key.split(',');
    const label = Array.from(importItems).filter(Boolean).join(', ');
    graph += label
      ? `  ${fromId} -->|"${label}"| ${toId}\n`
      : `  ${fromId} --> ${toId}\n`;
  });

  return graph;
}

function getImportMatches(line: string, fileExtension: string) {
  // 根据文件扩展名确定语言类型
  const patterns = {
    // JavaScript/TypeScript 模式
    ts: [
      line.match(/import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/),
      line.match(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/),
      line.match(/import\s+\*\s+as\s+\w+\s+from\s+['"]([^'"]+)['"]/),
      line.match(/import\s+['"]([^'"]+)['"]/),
      line.match(/import\s+type\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/),
    ],
    js: [
      line.match(/import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/),
      line.match(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/),
      line.match(/import\s+\*\s+as\s+\w+\s+from\s+['"]([^'"]+)['"]/),
      line.match(/import\s+['"]([^'"]+)['"]/),
    ],
    // Python 模式
    py: [
      line.match(/^import\s+(\w+)/),
      line.match(/from\s+([.\w]+)\s+import\s+(.+)/),
      line.match(/import\s+([.\w]+)\s+as\s+\w+/),
      line.match(/from\s+([.\w]+)\s+import\s+\w+\s+as\s+\w+/),
      line.match(/from\s+([.\w]+)\s+import\s+\(([^)]+)\)/),
      line.match(/from\s+(\.+)([.\w]*)\s+import\s+(.+)/),
    ],
    // Go 模式
    go: [
      line.match(/import\s+([^\s]+)\s+([^\s]+)/),
      line.match(/import\s+\(\s*([^)]+)\s*\)/),
    ],
    // Java 模式
    java: [
      line.match(/import\s+([^;]+);/),
      line.match(/import\s+([^.]+\.[^;]+);/),
      line.match(/import\s+([^.]+)\.([^;]+)\*;/),
      line.match(/import\s+static\s+([^;]+);/),
      line.match(/import\s+static\s+([^.]+)\.([^;]+)\*;/),
    ],
  };

  // 获取文件扩展名对应的模式，如果没有找到则使用 TypeScript 模式作为默认值
  const ext = fileExtension.toLowerCase().replace('.', '') as keyof typeof patterns;
  const matchPatterns = patterns[ext] || patterns.ts;

  return matchPatterns.filter(Boolean);
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

  result.content = formatFileContent(result.content);

  // 使用新的处理函数
  ctx.body = {
    success: true,
    data: await processAnalysisResult(result)
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