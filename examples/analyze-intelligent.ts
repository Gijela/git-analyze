import { IntelligentAnalyzer } from '../src/core/intelligent-analyzer.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analyzeIntelligent() {
  try {
    const analyzer = new IntelligentAnalyzer();
    const rootDir = path.resolve(__dirname, '..');

    console.log('开始智能代码分析...\n');

    // 创建输出目录
    const outputDir = path.resolve(__dirname, 'reports');
    await mkdir(outputDir, { recursive: true });

    // 分析整个项目
    console.log('分析项目代码模式...\n');
    const analysis = await analyzer.analyzeDirectory(rootDir);

    // 生成分析报告
    const report = generateIntelligentReport(analysis);
    await writeFile(
      path.join(outputDir, 'intelligent-report.md'),
      report
    );

    // 输出分析概要
    console.log('代码模式分析概要:');
    console.log(`  总模式数: ${analysis.summary.totalPatterns}`);
    console.log(`  设计模式: ${analysis.summary.designPatterns}`);
    console.log(`  代码气味: ${analysis.summary.codeSmells}`);
    console.log(`  最佳实践: ${analysis.summary.bestPractices}`);
    console.log(`  重构机会: ${analysis.summary.refactorings}`);
    console.log(`  架构模式: ${analysis.summary.architecturePatterns}`);

    // 输出模式详情
    if (analysis.patterns.length > 0) {
      console.log('\n发现的代码模式:');
      analysis.patterns.forEach(pattern => {
        console.log(`\n  [${pattern.type}] ${pattern.name}`);
        console.log(`    文件: ${pattern.file}`);
        if (pattern.line) {
          console.log(`    行号: ${pattern.line}`);
        }
        console.log(`    描述: ${pattern.description}`);
        console.log(`    建议: ${pattern.suggestion}`);
        console.log(`    置信度: ${(pattern.confidence * 100).toFixed(1)}%`);
      });
    }

    // 输出改进建议
    if (analysis.recommendations.length > 0) {
      console.log('\n改进建议:');
      analysis.recommendations.forEach(rec => {
        console.log(`\n  [${rec.type}]`);
        console.log(`    描述: ${rec.description}`);
        console.log(`    优先级: ${rec.priority}`);
        console.log(`    工作量: ${rec.effort}`);
      });
    }

    console.log('\n智能分析报告已生成:', path.join(outputDir, 'intelligent-report.md'));

  } catch (error) {
    console.error('智能分析时发生错误:', error);
  }
}

/**
 * 生成智能分析报告
 */
function generateIntelligentReport(analysis: any): string {
  let report = '# 项目智能代码分析报告\n\n';

  // 添加概要
  report += '## 代码模式概要\n\n';
  report += `- 总模式数: ${analysis.summary.totalPatterns}\n`;
  report += `- 设计模式: ${analysis.summary.designPatterns}\n`;
  report += `- 代码气味: ${analysis.summary.codeSmells}\n`;
  report += `- 最佳实践: ${analysis.summary.bestPractices}\n`;
  report += `- 重构机会: ${analysis.summary.refactorings}\n`;
  report += `- 架构模式: ${analysis.summary.architecturePatterns}\n\n`;

  // 添加模式详情
  if (analysis.patterns.length > 0) {
    report += '## 代码模式详情\n\n';
    // 按类型分组
    const patternsByType = analysis.patterns.reduce((acc: any, pattern: any) => {
      acc[pattern.type] = acc[pattern.type] || [];
      acc[pattern.type].push(pattern);
      return acc;
    }, {});

    Object.entries(patternsByType).forEach(([type, patterns]: [string, any]) => {
      report += `### ${type}\n\n`;
      patterns.forEach((pattern: any) => {
        report += `#### ${pattern.name}\n\n`;
        report += `- **文件**: ${pattern.file}\n`;
        if (pattern.line) {
          report += `- **行号**: ${pattern.line}\n`;
        }
        report += `- **描述**: ${pattern.description}\n`;
        report += `- **建议**: ${pattern.suggestion}\n`;
        report += `- **置信度**: ${(pattern.confidence * 100).toFixed(1)}%\n\n`;
      });
    });
  }

  // 添加改进建议
  if (analysis.recommendations.length > 0) {
    report += '## 改进建议\n\n';
    analysis.recommendations.forEach((rec: any) => {
      report += `### ${rec.type}\n\n`;
      report += `- **描述**: ${rec.description}\n`;
      report += `- **优先级**: ${rec.priority}\n`;
      report += `- **工作量**: ${rec.effort}\n\n`;
    });
  }

  return report;
}

// 运行分析
analyzeIntelligent(); 