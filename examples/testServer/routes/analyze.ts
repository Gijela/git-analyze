import Router from '@koa/router';
import { GitIngest } from '../../../src/index';

const router = new Router();
// 设置文件大小上限为 500KB
const maxFileSize = 500 * 1024;
// 初始化 GitIngest 实例，用于分析 Git 仓库
const ingest = new GitIngest({
  tempDir: "./repo",
  keepTempFiles: false,
  defaultPatterns: {
    // 排除不需要分析的目录
    exclude: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
  }
});

// 处理 GitHub 仓库分析请求的路由
router.post('/analyze/github', async (ctx) => {
  // 解构请求参数
  const { url, branch, targetPaths, aliasPath = 'src' } = ctx.request.body

  // 验证仓库 URL
  if (!url) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: '仓库 URL 不能为空'
    };
    return;
  }

  try {
    // 设置路径别名，将 @ 映射到指定目录
    // PATH_ALIASES['@'] = aliasPath;

    // 处理目标文件路径, 将逗号分隔的路径转换为数组
    let allTargetPaths = targetPaths?.split(',').map((p: string) => p.trim()).filter(Boolean);

    // 分析仓库。如果 targetPaths 有值，则扫描 targetPaths 指定的文件及其依赖文件，否则扫描整个仓库代码返回
    const result = await ingest.analyzeFromUrl(url, {
      branch,
      targetPaths: allTargetPaths,
      maxFileSize: maxFileSize
    });

    ctx.body = {
      success: true,
      result
    };
  } catch (error) {
    // 错误处理
    console.error('GitHub repository analysis failed:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

export default router; 