import { DependencyAnalyzer } from '../src/core/dependency.js';
import { DependencyReporter } from '../src/core/reporter.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analyzeProject() {
  try {
    // 设置项目根目录
    const rootDir = path.resolve(__dirname, '../src');
    console.log('分析目录:', rootDir);

    // 创建依赖分析器
    const analyzer = new DependencyAnalyzer(rootDir);

    // 分析项目依赖
    console.log('\n开始分析项目依赖...');
    const graph = await analyzer.analyze('index.ts');

    // 创建报告生成器
    const reporter = new DependencyReporter(graph, rootDir);

    // 生成报告
    console.log('\n生成分析报告...');
    const outputDir = path.resolve(__dirname, 'reports');

    // 生成不同格式的报告
    await reporter.generateReport({
      outputDir,
      format: 'json',
      includeExports: true,
      includeComplexity: true,
      includeChanges: true,
      includeComments: true
    });

    await reporter.generateReport({
      outputDir,
      format: 'html',
      includeExports: true,
      includeComplexity: true,
      includeChanges: true,
      includeComments: true
    });

    await reporter.generateReport({
      outputDir,
      format: 'mermaid',
      excludeNodeModules: true
    });

    await reporter.generateReport({
      outputDir,
      format: 'dot',
      excludeNodeModules: true
    });

    console.log('\n报告已生成到:', outputDir);
    console.log('- dependency-report.json');
    console.log('- dependency-report.html');
    console.log('- dependency-graph.mmd');
    console.log('- dependency-graph.dot');

  } catch (error) {
    console.error('分析过程中发生错误:', error);
  }
}

// 运行分析
analyzeProject();