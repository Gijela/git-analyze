import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { QualityAnalyzer } from '../src/core/quality-analyzer';

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);

/**
 * 分析代码质量
 */
async function analyzeCodeQuality(directory: string): Promise<void> {
  try {
    // 递归获取所有 TypeScript 文件
    const files = await getTypeScriptFiles(directory);

    console.log('开始代码质量分析...\n');

    // 分析每个文件
    for (const file of files) {
      const content = await readFile(file, 'utf-8');
      const analyzer = new QualityAnalyzer(file, content);
      const result = analyzer.analyze();

      // 输出分析结果
      console.log(`\n文件: ${path.relative(process.cwd(), file)}`);
      console.log('质量指标:');
      console.log('  可维护性:', formatScore(result.metrics.maintainability));
      console.log('  可靠性:', formatScore(result.metrics.reliability));
      console.log('  安全性:', formatScore(result.metrics.security));
      console.log('  效率:', formatScore(result.metrics.efficiency));
      console.log('  可重用性:', formatScore(result.metrics.reusability));
      console.log('  可测试性:', formatScore(result.metrics.testability));
      console.log('  文档完整性:', formatScore(result.metrics.documentation));

      if (result.smells.length > 0) {
        console.log('\n代码气味:');
        result.smells.forEach(smell => {
          console.log(`  [${smell.severity.toUpperCase()}] ${smell.type}`);
          console.log(`    位置: ${smell.location.file}:${smell.location.line}`);
          console.log(`    问题: ${smell.message}`);
          console.log(`    建议: ${smell.suggestion}`);
        });
      }

      if (result.duplicates.length > 0) {
        console.log('\n重复代码:');
        result.duplicates.forEach(duplicate => {
          console.log(`  源文件: ${path.relative(process.cwd(), duplicate.sourceFile)}`);
          console.log(`  目标文件: ${path.relative(process.cwd(), duplicate.targetFile)}`);
          console.log(`  相似度: ${(duplicate.similarity * 100).toFixed(1)}%`);
          console.log(`  源代码行: ${duplicate.sourceLines.join(', ')}`);
          console.log(`  目标代码行: ${duplicate.targetLines.join(', ')}`);
        });
      }

      if (result.suggestions.length > 0) {
        console.log('\n改进建议:');
        result.suggestions.forEach(suggestion => {
          console.log(`  - ${suggestion}`);
        });
      }

      console.log('\n' + '='.repeat(80));
    }

    console.log('\n代码质量分析完成！');

  } catch (error) {
    console.error('代码质量分析失败:', error);
    process.exit(1);
  }
}

/**
 * 递归获取所有 TypeScript 文件
 */
async function getTypeScriptFiles(directory: string): Promise<string[]> {
  const files: string[] = [];

  async function scan(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // 排除 node_modules 和 dist 目录
        if (entry.name !== 'node_modules' && entry.name !== 'dist') {
          await scan(fullPath);
        }
      } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  await scan(directory);
  return files;
}

/**
 * 格式化分数显示
 */
function formatScore(score: number): string {
  const value = score.toFixed(1);
  let color = '\x1b[32m'; // 绿色

  if (score < 60) {
    color = '\x1b[31m'; // 红色
  } else if (score < 80) {
    color = '\x1b[33m'; // 黄色
  }

  return `${color}${value}\x1b[0m`; // 重置颜色
}

// 运行分析
const sourceDir = path.join(process.cwd(), 'src');
analyzeCodeQuality(sourceDir); 