import { PerformanceAnalyzer } from '../src/core/performance-analyzer.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analyzePerformance() {
  try {
    const analyzer = new PerformanceAnalyzer();
    const rootDir = path.resolve(__dirname, '..');

    console.log('开始性能分析...\n');

    // 创建输出目录
    const outputDir = path.resolve(__dirname, 'reports');
    await mkdir(outputDir, { recursive: true });

    // 分析整个项目
    console.log('分析项目性能问题...\n');
    const analysis = await analyzer.analyzeDirectory(rootDir);

    // 生成性能报告
    const report = generatePerformanceReport(analysis);
    await writeFile(
      path.join(outputDir, 'performance-report.md'),
      report
    );

    // 输出分析概要
    console.log('性能分析概要:');
    console.log(`  总问题数: ${analysis.summary.totalIssues}`);
    console.log(`  严重问题: ${analysis.summary.criticalIssues}`);
    console.log(`  高危问题: ${analysis.summary.highIssues}`);
    console.log(`  中危问题: ${analysis.summary.mediumIssues}`);
    console.log(`  低危问题: ${analysis.summary.lowIssues}`);

    // 输出性能热点
    if (analysis.hotspots.length > 0) {
      console.log('\n性能热点文件:');
      analysis.hotspots.forEach(hotspot => {
        console.log(`  [${hotspot.severity.toUpperCase()}] ${hotspot.file}`);
        console.log(`    问题数: ${hotspot.issues}`);
      });
    }

    // 输出问题详情
    if (analysis.metrics.length > 0) {
      console.log('\n性能问题详情:');
      analysis.metrics.forEach(metric => {
        console.log(`\n  [${metric.severity.toUpperCase()}] ${metric.type}`);
        console.log(`    文件: ${metric.file}`);
        if (metric.function) {
          console.log(`    函数: ${metric.function}`);
        }
        console.log(`    行号: ${metric.line}`);
        console.log(`    描述: ${metric.description}`);
        console.log(`    建议: ${metric.recommendation}`);
      });
    }

    // 输出建议
    if (analysis.recommendations.length > 0) {
      console.log('\n性能优化建议:');
      analysis.recommendations.forEach(rec => {
        console.log(`  - ${rec}`);
      });
    }

    console.log('\n性能分析报告已生成:', path.join(outputDir, 'performance-report.md'));

  } catch (error) {
    console.error('性能分析时发生错误:', error);
  }
}

/**
 * 生成性能报告
 */
function generatePerformanceReport(analysis: any): string {
  let report = '# 项目性能分析报告\n\n';

  // 添加概要
  report += '## 性能问题概要\n\n';
  report += `- 总问题数: ${analysis.summary.totalIssues}\n`;
  report += `- 严重问题: ${analysis.summary.criticalIssues}\n`;
  report += `- 高危问题: ${analysis.summary.highIssues}\n`;
  report += `- 中危问题: ${analysis.summary.mediumIssues}\n`;
  report += `- 低危问题: ${analysis.summary.lowIssues}\n\n`;

  // 添加性能热点
  if (analysis.hotspots.length > 0) {
    report += '## 性能热点文件\n\n';
    analysis.hotspots.forEach((hotspot: any) => {
      report += `### ${hotspot.file}\n\n`;
      report += `- **严重程度**: ${hotspot.severity}\n`;
      report += `- **问题数**: ${hotspot.issues}\n\n`;
    });
  }

  // 添加问题详情
  if (analysis.metrics.length > 0) {
    report += '## 性能问题详情\n\n';
    // 按严重程度分组
    const severityOrder = ['critical', 'high', 'medium', 'low'];
    const groupedMetrics = severityOrder.reduce((acc: any, severity) => {
      acc[severity] = analysis.metrics.filter((m: any) => m.severity === severity);
      return acc;
    }, {});

    severityOrder.forEach(severity => {
      const metrics = groupedMetrics[severity];
      if (metrics.length > 0) {
        report += `### ${severity.toUpperCase()} 级别问题\n\n`;
        metrics.forEach((metric: any) => {
          report += `#### ${metric.type}\n\n`;
          report += `- **文件**: ${metric.file}\n`;
          if (metric.function) {
            report += `- **函数**: ${metric.function}\n`;
          }
          report += `- **行号**: ${metric.line}\n`;
          report += `- **描述**: ${metric.description}\n`;
          report += `- **建议**: ${metric.recommendation}\n\n`;
        });
      }
    });
  }

  // 添加优化建议
  if (analysis.recommendations.length > 0) {
    report += '## 性能优化建议\n\n';
    analysis.recommendations.forEach((rec: string) => {
      report += `- ${rec}\n`;
    });
  }

  return report;
}

// 运行分析
analyzePerformance(); 