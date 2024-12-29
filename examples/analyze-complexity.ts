import { ComplexityAnalyzer } from '../src/core/complexity.js';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analyzeComplexity() {
  try {
    const analyzer = new ComplexityAnalyzer();
    const rootDir = path.resolve(__dirname, '../src');

    console.log('开始分析代码复杂度...');

    // 获取所有TypeScript文件
    const files = await getAllTypeScriptFiles(rootDir);

    // 分析每个文件
    for (const file of files) {
      console.log(`\n分析文件: ${path.relative(rootDir, file)}`);

      const result = await analyzer.analyzeFile(file);

      // 输出文件级别的复杂度指标
      console.log('\n文件级别指标:');
      console.log(`  圈复杂度: ${result.metrics.cyclomaticComplexity}`);
      console.log(`  可维护性指数: ${result.metrics.maintainabilityIndex.toFixed(2)}`);
      console.log(`  代码行数: ${result.metrics.linesOfCode}`);
      console.log(`  注释行数: ${result.metrics.commentLines}`);
      console.log(`  注释率: ${(result.metrics.commentRatio * 100).toFixed(1)}%`);

      // 输出函数级别的复杂度指标
      if (result.functions.length > 0) {
        console.log('\n函数级别指标:');
        result.functions.forEach(fn => {
          console.log(`\n  函数: ${fn.name}`);
          console.log(`    圈复杂度: ${fn.metrics.cyclomaticComplexity}`);
          console.log(`    可维护性指数: ${fn.metrics.maintainabilityIndex.toFixed(2)}`);
          console.log(`    代码行数: ${fn.metrics.linesOfCode}`);
          console.log(`    注释率: ${(fn.metrics.commentRatio * 100).toFixed(1)}%`);
        });
      }

      // 输出复杂度警告
      const warnings: string[] = [];
      if (result.metrics.cyclomaticComplexity > 20) {
        warnings.push('文件圈复杂度过高');
      }
      if (result.metrics.maintainabilityIndex < 65) {
        warnings.push('文件可维护性较低');
      }
      if (result.metrics.commentRatio < 0.1) {
        warnings.push('注释率过低');
      }

      result.functions.forEach(fn => {
        if (fn.metrics.cyclomaticComplexity > 15) {
          warnings.push(`函数 ${fn.name} 圈复杂度过高`);
        }
      });

      if (warnings.length > 0) {
        console.log('\n警告:');
        warnings.forEach(warning => {
          console.log(`  - ${warning}`);
        });
      }
    }

  } catch (error) {
    console.error('分析过程中发生错误:', error);
  }
}

async function getAllTypeScriptFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

// 运行分析
analyzeComplexity(); 