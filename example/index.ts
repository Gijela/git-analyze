import { GitIngest } from '../src';

const ingest = new GitIngest({
  // 默认最大文件大小
  defaultMaxFileSize: 1000000,
  // 默认文件模式
  defaultPatterns: {
    include: ["**/*"],
    exclude: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**", "*.lock", "pnpm-lock.yaml"],
  }
});

async function main() {
  const result = await ingest.analyzeFromUrl('https://github.com/Gijela/github101', {
    branch: 'main',
    targetPaths: ['src/index.ts'],
    maxFileSize: 1000000
  });

  // 详细打印文件树结构
  console.log('\n=== 文件树结构 ===');
  console.log(JSON.stringify(result.fileTree, null, 2));

  // 详细打印大小树结构
  console.log('\n=== 大小树结构 ===');
  console.log(JSON.stringify(result.sizeTree, null, 2));

  // 详细打印代码分析结果
  console.log('\n=== 代码分析结果 ===');
  console.log('知识图谱节点:', JSON.stringify(result.codeAnalysis.knowledgeGraph.nodes, null, 12));
  console.log('知识图谱边:', JSON.stringify(result.codeAnalysis.knowledgeGraph.edges, null, 2));
  
  // 打印代码索引
  console.log('\n=== 代码索引详情 ===');
  for (const [name, elements] of result.codeAnalysis.codeIndex) {
    console.log(`\n${name}:`);
    console.log(JSON.stringify(elements, null, 2));
  }

  return result;
}

main().then(result => {
  console.log('example fileTree => ', result.fileTree);
  console.log('example sizeTree => ', result.sizeTree);
  console.log('example codeAnalysis => ', result.codeAnalysis);
}).catch(error => {
  console.error('example error => ', error);
});