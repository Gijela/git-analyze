import Router from '@koa/router';
import { GitIngest } from '../../../src/index.js';
import { DependencyAnalyzer } from '../../../src/core/dependency/analyzer.js';
import { EnhancedScanner } from '../../../src/core/dependency/enhanced-scanner.js';
import { processTargetPaths, formatFileContent, PATH_ALIASES } from '../../../src/utils/path-utils.js';
import { generateDependencyGraph } from '../../../src/utils/dependency-utils.js';
import { join } from 'path';

const router = new Router();
const ingest = new GitIngest({
  tempDir: "./temp-web",
  keepTempFiles: false,
  defaultPatterns: {
    exclude: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
  }
});

const dependencyAnalyzer = new DependencyAnalyzer();
const enhancedScanner = new EnhancedScanner(dependencyAnalyzer);

async function processAnalysisResult(result: any, projectName: string) {
  const mermaidDiagrams = {
    dependencies: generateDependencyGraph(result, projectName)
  };

  return {
    ...result,
    mermaidDiagrams
  };
}

router.post('/analyze/github', async (ctx) => {
  const { url, branch, targetPaths, aliasPath = 'src', analyzeDependencies = true } = ctx.request.body as {
    url?: string;
    branch?: string;
    targetPaths?: string;
    aliasPath?: string;
    analyzeDependencies?: boolean;
  };

  if (!url) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      error: '仓库 URL 不能为空'
    };
    return;
  }

  try {
    PATH_ALIASES['@'] = aliasPath;

    let allTargetPaths = processTargetPaths(targetPaths);

    if (analyzeDependencies && allTargetPaths) {
      const initialResult = await ingest.analyzeFromUrl(url, {
        branch,
        targetPaths: allTargetPaths,
        maxFileSize: 500 * 1024
      });

      const dependencies = new Set<string>();
      initialResult.content.split('File: ').forEach(section => {
        if (!section) return;
        const lines = section.split('\n');
        const currentFile = lines[0].trim();

        lines.forEach(line => {
          const importMatches = line.match(/from\s+['"]([^'"]+)['"]/);
          if (importMatches) {
            const importPath = importMatches[1];
            if (importPath.startsWith('@/')) {
              const resolvedPath = importPath.replace('@/', `${aliasPath}/`);
              dependencies.add(resolvedPath);
            } else if (importPath.startsWith('./') || importPath.startsWith('../')) {
              const currentDir = currentFile.split('/').slice(0, -1).join('/');
              const resolvedPath = join(currentDir, importPath).replace(/\\/g, '/');
              dependencies.add(resolvedPath);
            }
          }
        });
      });

      allTargetPaths = [...allTargetPaths, ...Array.from(dependencies)];
    }

    const result = await ingest.analyzeFromUrl(url, {
      branch,
      targetPaths: allTargetPaths,
      maxFileSize: 500 * 1024
    });

    result.tree = result.tree
      .split('\n')
      .slice(2)
      .join('\n');

    const { content, projectName } = formatFileContent(result.content);
    result.content = content;

    ctx.body = {
      success: true,
      data: await processAnalysisResult(result, projectName)
    };
  } catch (error) {
    console.error('GitHub repository analysis failed:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

export default router; 