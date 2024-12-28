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
    // 从 GitHub 仓库分析
    const result = await ingest.analyzeFromUrl(
      'https://github.com/example/repo',
      {
        branch: 'main',
        maxFileSize: 500 * 1024 // 500KB
      }
    );

    // 输出结果
    console.log('项目摘要：');
    console.log(result.summary);

    console.log('\n文件树：');
    console.log(result.tree);

    console.log('\n元数据：');
    console.log(result.metadata);
  } catch (error) {
    console.error('分析失败：', error);
  }
}

main().catch(console.error); 