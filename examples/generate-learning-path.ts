import { DependencyAnalyzer } from '../src/core/dependency.js';
import { DependencyReporter } from '../src/core/reporter.js';
import { LearningPathGenerator } from '../src/core/learning-path.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateLearningPath() {
  try {
    // 设置项目根目录
    const rootDir = path.resolve(__dirname, '../src');
    console.log('分析目录:', rootDir);

    // 创建依赖分析器
    const analyzer = new DependencyAnalyzer(rootDir);

    // 分析项目依赖
    console.log('\n开始分析项目依赖...');
    const graph = await analyzer.analyze('index.ts');

    // 创建报告生成器以获取分析数据
    const reporter = new DependencyReporter(graph, rootDir);

    // 分析代码复杂度和注释
    console.log('\n分析代码质量指标...');
    const complexityMetrics = new Map();
    const commentAnalyses = new Map();

    for (const [filePath] of graph.nodes) {
      const absolutePath = path.resolve(rootDir, filePath);
      try {
        const complexity = await reporter['complexityAnalyzer'].analyzeFile(absolutePath);
        complexityMetrics.set(filePath, complexity);

        const comments = await reporter['commentAnalyzer'].analyzeFile(absolutePath);
        commentAnalyses.set(filePath, comments);
      } catch (error) {
        console.error(`分析文件 ${filePath} 时出错:`, error);
      }
    }

    // 分析变更历史
    console.log('\n分析变更历史...');
    const changeAnalysis = await reporter['changeAnalyzer'].analyze();

    // 生成学习路径
    console.log('\n生成学习路径...');
    const pathGenerator = new LearningPathGenerator(
      graph,
      complexityMetrics,
      commentAnalyses,
      changeAnalysis
    );

    const learningPath = pathGenerator.generate();

    // 创建输出目录
    const outputDir = path.resolve(__dirname, 'reports');
    await mkdir(outputDir, { recursive: true });

    // 保存学习路径
    await writeFile(
      path.join(outputDir, 'learning-path.json'),
      JSON.stringify(learningPath, null, 2)
    );

    // 生成学习路径报告
    const report = generateReport(learningPath);
    await writeFile(
      path.join(outputDir, 'learning-path.md'),
      report
    );

    console.log('\n学习路径已生成到:', outputDir);
    console.log('- learning-path.json');
    console.log('- learning-path.md');

    // 打印学习建议
    console.log('\n推荐学习顺序:');
    learningPath.stages.forEach((stage, index) => {
      console.log(`\n${index + 1}. ${stage.name} (预计耗时: ${stage.estimatedTime})`);
      console.log(`   ${stage.description}`);
      stage.files.forEach(file => {
        const node = learningPath.nodes.find(n => n.file === file);
        if (node) {
          console.log(`   - ${file}`);
          node.learningPoints.forEach(point => {
            console.log(`     · ${point}`);
          });
        }
      });
    });

  } catch (error) {
    console.error('生成学习路径时发生错误:', error);
  }
}

/**
 * 生成Markdown格式的学习路径报告
 */
function generateReport(learningPath: any): string {
  let report = '# 项目学习路径\n\n';

  // 添加总览
  report += '## 学习阶段\n\n';
  learningPath.stages.forEach((stage: any, index: number) => {
    report += `### ${index + 1}. ${stage.name}\n\n`;
    report += `- 描述: ${stage.description}\n`;
    report += `- 预计耗时: ${stage.estimatedTime}\n`;
    report += '- 学习文件:\n';
    stage.files.forEach((file: string) => {
      report += `  - \`${file}\`\n`;
    });
    report += '\n';
  });

  // 添加文件详情
  report += '## 文件详情\n\n';
  learningPath.nodes.forEach((node: any) => {
    report += `### ${node.file}\n\n`;
    report += `- 类型: ${node.type}\n`;
    report += `- 描述: ${node.description}\n`;
    if (node.complexity) {
      report += `- 复杂度: ${node.complexity}\n`;
    }
    if (node.docCoverage) {
      report += `- 文档覆盖率: ${(node.docCoverage * 100).toFixed(1)}%\n`;
    }

    if (node.prerequisites.length > 0) {
      report += '- 前置知识:\n';
      node.prerequisites.forEach((pre: string) => {
        report += `  - \`${pre}\`\n`;
      });
    }

    if (node.learningPoints.length > 0) {
      report += '- 学习要点:\n';
      node.learningPoints.forEach((point: string) => {
        report += `  - ${point}\n`;
      });
    }
    report += '\n';
  });

  // 添加学习建议
  report += '## 学习建议\n\n';
  learningPath.recommendations.forEach((rec: any) => {
    report += `- \`${rec.file}\`: ${rec.reason}\n`;
  });

  return report;
}

// 运行生成器
generateLearningPath(); 