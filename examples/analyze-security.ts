import { SecurityAnalyzer } from '../src/core/security-analyzer.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analyzeSecurity() {
  try {
    const analyzer = new SecurityAnalyzer();
    const rootDir = path.resolve(__dirname, '..');

    console.log('开始安全分析...\n');

    // 创建输出目录
    const outputDir = path.resolve(__dirname, 'reports');
    await mkdir(outputDir, { recursive: true });

    // 分析整个项目
    console.log('分析项目安全问题...\n');
    const analysis = await analyzer.analyzeDirectory(rootDir);

    // 生成安全报告
    const report = generateSecurityReport(analysis);
    await writeFile(
      path.join(outputDir, 'security-report.md'),
      report
    );

    // 输出分析概要
    console.log('安全分析概要:');
    console.log(`  总问题数: ${analysis.summary.totalIssues}`);
    console.log(`  严重问题: ${analysis.summary.criticalIssues}`);
    console.log(`  高危问题: ${analysis.summary.highIssues}`);
    console.log(`  中危问题: ${analysis.summary.mediumIssues}`);
    console.log(`  低危问题: ${analysis.summary.lowIssues}`);

    // 输出问题详情
    if (analysis.issues.length > 0) {
      console.log('\n发现的安全问题:');
      analysis.issues.forEach(issue => {
        console.log(`\n  [${issue.severity.toUpperCase()}] ${issue.type}`);
        console.log(`    文件: ${issue.file}`);
        console.log(`    行号: ${issue.line}`);
        console.log(`    描述: ${issue.description}`);
        console.log(`    建议: ${issue.recommendation}`);
        if (issue.code) {
          console.log(`    代码: ${issue.code}`);
        }
      });
    }

    // 输出建议
    if (analysis.recommendations.length > 0) {
      console.log('\n安全建议:');
      analysis.recommendations.forEach(rec => {
        console.log(`  - ${rec}`);
      });
    }

    console.log('\n安全分析报告已生成:', path.join(outputDir, 'security-report.md'));

  } catch (error) {
    console.error('安全分析时发生错误:', error);
  }
}

/**
 * 生成安全报告
 */
function generateSecurityReport(analysis: any): string {
  let report = '# 项目安全分析报告\n\n';

  // 添加概要
  report += '## 安全问题概要\n\n';
  report += `- 总问题数: ${analysis.summary.totalIssues}\n`;
  report += `- 严重问题: ${analysis.summary.criticalIssues}\n`;
  report += `- 高危问题: ${analysis.summary.highIssues}\n`;
  report += `- 中危问题: ${analysis.summary.mediumIssues}\n`;
  report += `- 低危问题: ${analysis.summary.lowIssues}\n\n`;

  // 添加问题详情
  if (analysis.issues.length > 0) {
    report += '## 安全问题详情\n\n';
    analysis.issues.forEach((issue: any) => {
      report += `### [${issue.severity.toUpperCase()}] ${issue.type}\n\n`;
      report += `- **文件**: ${issue.file}\n`;
      report += `- **行号**: ${issue.line}\n`;
      report += `- **描述**: ${issue.description}\n`;
      report += `- **建议**: ${issue.recommendation}\n`;
      if (issue.code) {
        report += '\n**问题代码**:\n';
        report += '```\n';
        report += issue.code;
        report += '\n```\n';
      }
      report += '\n';
    });
  }

  // 添加建议
  if (analysis.recommendations.length > 0) {
    report += '## 安全改进建议\n\n';
    analysis.recommendations.forEach((rec: string) => {
      report += `- ${rec}\n`;
    });
  }

  return report;
}

// 运行分析
analyzeSecurity(); 