import { CommentAnalyzer } from '../src/core/comment-analyzer.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analyzeComments() {
  try {
    const analyzer = new CommentAnalyzer();
    const rootDir = path.resolve(__dirname, '../src');

    console.log('开始分析代码注释...\n');

    // 分析核心文件
    const coreFiles = [
      'core/comment-analyzer.ts',
      'core/complexity.ts',
      'core/dependency.ts',
      'core/quality-analyzer.ts',
      'core/reporter.ts'
    ];

    for (const file of coreFiles) {
      const filePath = path.join(rootDir, file);
      console.log(`分析文件: ${file}`);

      const analysis = await analyzer.analyzeFile(filePath);

      // 输出分析结果
      console.log('\n注释概要:');
      console.log(`  TODO 标记: ${analysis.summary.todoCount}`);
      console.log(`  FIXME 标记: ${analysis.summary.fixmeCount}`);
      console.log(`  文档注释: ${analysis.summary.docCount}`);
      console.log(`  重要注释: ${analysis.summary.importantCount}`);

      console.log('\n文档覆盖率:');
      console.log(`  已文档化: ${analysis.coverage.documented}`);
      console.log(`  需文档化: ${analysis.coverage.total}`);
      console.log(`  覆盖率: ${(analysis.coverage.ratio * 100).toFixed(1)}%`);

      // 输出待办事项
      if (analysis.todos.length > 0) {
        console.log('\nTODO 列表:');
        analysis.todos.forEach(todo => {
          console.log(`  [行 ${todo.line}] ${todo.content}`);
        });
      }

      // 输出需修复项
      if (analysis.fixmes.length > 0) {
        console.log('\nFIXME 列表:');
        analysis.fixmes.forEach(fixme => {
          console.log(`  [行 ${fixme.line}] ${fixme.content}`);
        });
      }

      // 输出重要注释
      if (analysis.importantNotes.length > 0) {
        console.log('\n重要注释:');
        analysis.importantNotes.forEach(note => {
          console.log(`  [行 ${note.line}] ${note.content}`);
        });
      }

      console.log('\n' + '-'.repeat(80) + '\n');
    }

  } catch (error) {
    console.error('分析过程中发生错误:', error);
  }
}

// 运行分析
analyzeComments(); 