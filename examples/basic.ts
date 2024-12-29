import { GitIngest } from '../src/index.js';

async function main() {
  // 初始化实例
  const ingest = new GitIngest({
    tempDir: './temp',
    defaultMaxFileSize: 1024 * 1024, // 1MB
    defaultPatterns: {
      exclude: ['**/node_modules/**', '**/.git/**', '**/dist/**']
    }
  });

  try {
    // 1. 分析特定目录
    console.log('\n1. 分析特定目录：');
    const dirResult = await ingest.analyzeFromDirectory('./src', {
      targetPaths: ['core/', 'utils/'],
      maxFileSize: 500 * 1024 // 500KB
    });
    console.log('目录分析结果：');
    console.log(dirResult.summary);
    console.log('\n文件树：');
    console.log(dirResult.tree);

    // 2. 分析特定文件
    console.log('\n2. 分析特定文件：');
    const fileResult = await ingest.analyzeFromDirectory('./src', {
      targetPaths: ['index.ts', 'types/index.ts']
    });
    console.log('文件分析结果：');
    console.log(fileResult.summary);
    console.log('\n文件内容：');
    console.log(fileResult.content);

    // 3. 从 GitHub 仓库分析特定路径
    console.log('\n3. 分析 GitHub 仓库的特定路径：');
    const githubResult = await ingest.analyzeFromUrl(
      'https://github.com/example/repo',
      {
        branch: 'main',
        maxFileSize: 500 * 1024, // 500KB
        targetPaths: [
          'src/core/',           // 分析整个 core 目录
          'README.md',           // 分析 README 文件
          'src/utils/config.ts'  // 分析特定文件
        ]
      }
    );

    console.log('GitHub 仓库分析结果：');
    console.log(githubResult.summary);
    console.log('\n文件树：');
    console.log(githubResult.tree);

  } catch (error) {
    console.error('分析失败：', error);
  }
}

main().catch(console.error); 