import { DependencyAnalyzer } from '../src/core/dependency.js';
import { DependencyReporter } from '../src/core/reporter.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analyzeProject() {
  try {
    // 初始化分析器
    const rootDir = path.resolve(__dirname, '..');
    const analyzer = new DependencyAnalyzer(rootDir);

    console.log('开始分析项目...');

    // 分析依赖关系
    const graph = await analyzer.analyze('src/index.ts');

    console.log(`分析完成！发现 ${graph.nodes.size} 个文件`);
    console.log(`发现 ${graph.cycles.length} 个循环依赖`);

    // 创建报告生成器
    const reporter = new DependencyReporter(graph, rootDir);

    // 生成不同格式的报告
    const outputDir = path.join(__dirname, 'reports');

    console.log('\n生成报告...');

    // 生成HTML报告（包含所有功能）
    await reporter.generateReport({
      outputDir,
      format: 'html',
      includeExports: true,
      excludeNodeModules: true,
      includeComplexity: true,
      includeChanges: true,
      since: '1 month ago'
    });
    console.log('- HTML报告已生成');

    // 生成JSON报告
    await reporter.generateReport({
      outputDir,
      format: 'json',
      includeExports: true,
      includeComplexity: true,
      includeChanges: true
    });
    console.log('- JSON报告已生成');

    // 生成Mermaid图表
    await reporter.generateReport({
      outputDir,
      format: 'mermaid',
      excludeNodeModules: true
    });
    console.log('- Mermaid图表已生成');

    // 生成DOT图表
    await reporter.generateReport({
      outputDir,
      format: 'dot'
    });
    console.log('- DOT图表已生成');

    console.log(`\n所有报告已生成到: ${outputDir}`);
    console.log('你可以在浏览器中打开HTML报告查看详细信息');

  } catch (error) {
    console.error('分析过程中发生错误:', error);
  }
}

// 运行分析
analyzeProject();