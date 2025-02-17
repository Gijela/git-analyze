import { GitIngest } from '../src';
import express from 'express';
import { searchKnowledgeGraph, type SearchOptions } from '../src/utils/graphSearch';

const app = express();
const port = 3789;

const ingest = new GitIngest({
  // 默认最大文件大小
  defaultMaxFileSize: 1000000,
  // 默认文件模式
  defaultPatterns: {
    include: ["**/*"],
    exclude: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**", "*.lock", "pnpm-lock.yaml"],
  }
});

app.use(express.json());

async function main(url: string, branch: string, targetPaths: string[], maxFileSize: number) {
  const result = await ingest.analyzeFromUrl(url, {
    branch,
    targetPaths,
    maxFileSize
  });

  // 详细打印文件树结构
  // console.log('\n=== 文件树结构 ===');
  // console.log(JSON.stringify(result.fileTree, null, 2));

  // 详细打印大小树结构
  // console.log('\n=== 大小树结构 ===');
  // console.log(JSON.stringify(result.sizeTree, null, 2));

  // 详细打印代码分析结果
  // console.log('\n=== 代码分析结果 ===');
  // console.log('知识图谱节点:', JSON.stringify(result.codeAnalysis.knowledgeGraph.nodes, null, 12));
  // console.log('知识图谱边:', JSON.stringify(result.codeAnalysis.knowledgeGraph.edges, null, 2));

  // 打印代码索引
  console.log('\n=== 代码索引详情 ===', Object.fromEntries(result.codeAnalysis.codeIndex));
  // for (const [name, elements] of result.codeAnalysis.codeIndex) {
  //   console.log(`\n${name}:`);
  //   console.log(JSON.stringify(elements, null, 2));
  // }

  return result;
}

// 添加API路由
app.post('/analyze', async (req, res) => {
  try {
    const { url, branch, targetPaths, maxFileSize } = req.body;
    const { fileTree, codeAnalysis } = await main(url, branch, targetPaths, maxFileSize);

    res.json({
      success: true,
      data: {
        fileTree,
        codeAnalysis: {
          ...codeAnalysis,
          codeIndex: Object.fromEntries(codeAnalysis.codeIndex)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 更新搜索API路由
app.post('/search', async (req, res) => {
  try {
    const { knowledgeGraph, ...rest } = req.body;
    const searchResults = searchKnowledgeGraph(knowledgeGraph, rest);

    res.json({ success: true, data: searchResults });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});