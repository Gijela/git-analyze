import { ConfigAnalyzer } from '../src/core/config-analyzer.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analyzeConfig() {
  try {
    const analyzer = new ConfigAnalyzer();
    const rootDir = path.resolve(__dirname, '..');

    console.log('开始分析配置文件...\n');

    // 分析常见配置文件
    const configFiles = [
      'package.json',
      'tsconfig.json',
      '.eslintrc.json',
      '.prettierrc'
    ];

    // 创建输出目录
    const outputDir = path.resolve(__dirname, 'reports');
    await mkdir(outputDir, { recursive: true });

    // 分析每个配置文件
    for (const file of configFiles) {
      const filePath = path.join(rootDir, file);

      if (!fs.existsSync(filePath)) {
        console.log(`跳过不存在的文件: ${file}`);
        continue;
      }

      console.log(`分析文件: ${file}`);
      const analysis = await analyzer.analyzeFile(filePath);

      // 生成配置文档
      const doc = generateConfigDoc(analysis);
      await writeFile(
        path.join(outputDir, `${path.basename(file, path.extname(file))}-config.md`),
        doc
      );

      // 输出分析结果
      console.log('\n配置项概要:');
      console.log(`  总配置项: ${analysis.items.length}`);
      console.log(`  必需项: ${analysis.items.filter(item => item.required).length}`);
      console.log(`  已废弃项: ${analysis.items.filter(item => item.deprecated).length}`);

      // 输出配置项详情
      console.log('\n配置项列表:');
      analysis.items.forEach(item => {
        console.log(`\n  ${item.key}:`);
        console.log(`    类型: ${item.type}`);
        console.log(`    描述: ${item.description || '无描述'}`);
        if (item.required) console.log('    必需: 是');
        if (item.deprecated) console.log('    状态: 已废弃');
        if (item.examples?.length) {
          console.log('    示例:');
          item.examples.forEach(example => {
            console.log(`      - ${example}`);
          });
        }
        if (item.validation) {
          console.log(`    验证规则: ${item.validation.type} ${item.validation.rule}`);
        }
      });

      console.log('\n' + '-'.repeat(80) + '\n');
    }

    // 分析整个项目的配置
    console.log('分析项目配置...\n');
    const projectAnalysis = await analyzer.analyzeDirectory(rootDir);

    // 生成项目配置报告
    const projectReport = generateProjectReport(projectAnalysis);
    await writeFile(
      path.join(outputDir, 'project-config.md'),
      projectReport
    );

    // 输出项目配置概要
    console.log('项目配置概要:');
    console.log(`  配置文件数: ${projectAnalysis.files.length}`);
    console.log(`  总配置项: ${projectAnalysis.summary.totalConfigs}`);
    console.log(`  必需配置项: ${projectAnalysis.summary.requiredConfigs}`);
    console.log(`  已废弃配置项: ${projectAnalysis.summary.deprecatedConfigs}`);

    // 输出建议
    if (projectAnalysis.recommendations.length > 0) {
      console.log('\n配置建议:');
      projectAnalysis.recommendations.forEach(rec => {
        console.log(`  - [${rec.type}] ${rec.message}`);
      });
    }

    console.log('\n配置分析报告已生成到:', outputDir);
    console.log('- project-config.md');
    configFiles.forEach(file => {
      const baseName = path.basename(file, path.extname(file));
      console.log(`- ${baseName}-config.md`);
    });

  } catch (error) {
    console.error('分析配置时发生错误:', error);
  }
}

/**
 * 生成配置文档
 */
function generateConfigDoc(config: any): string {
  let doc = `# ${path.basename(config.path)} 配置说明\n\n`;

  // 添加文件描述
  doc += `## 文件说明\n\n${config.description}\n\n`;

  // 添加配置项
  doc += '## 配置项\n\n';
  config.items.forEach((item: any) => {
    doc += `### ${item.key}\n\n`;
    doc += `- **类型**: \`${item.type}\`\n`;
    if (item.description) {
      doc += `- **描述**: ${item.description}\n`;
    }
    if (item.required) {
      doc += '- **必需**: 是\n';
    }
    if (item.deprecated) {
      doc += '- **状态**: 已废弃\n';
    }
    if (item.defaultValue !== undefined) {
      doc += `- **默认值**: \`${JSON.stringify(item.defaultValue)}\`\n`;
    }
    if (item.validation) {
      doc += `- **验证规则**: ${item.validation.type} ${item.validation.rule}\n`;
    }
    if (item.examples?.length) {
      doc += '\n**示例**:\n';
      item.examples.forEach((example: string) => {
        doc += `\`\`\`\n${example}\n\`\`\`\n`;
      });
    }
    doc += '\n';
  });

  // 添加完整示例
  if (config.examples.length > 0) {
    doc += '## 完整示例\n\n';
    config.examples.forEach((example: string) => {
      doc += `\`\`\`\n${example}\n\`\`\`\n\n`;
    });
  }

  return doc;
}

/**
 * 生成项目配置报告
 */
function generateProjectReport(analysis: any): string {
  let report = '# 项目配置分析报告\n\n';

  // 添加概要
  report += '## 配置概要\n\n';
  report += `- 配置文件数: ${analysis.files.length}\n`;
  report += `- 总配置项: ${analysis.summary.totalConfigs}\n`;
  report += `- 必需配置项: ${analysis.summary.requiredConfigs}\n`;
  report += `- 已废弃配置项: ${analysis.summary.deprecatedConfigs}\n\n`;

  // 添加配置文件列表
  report += '## 配置文件\n\n';
  analysis.files.forEach((file: any) => {
    report += `### ${file.path}\n\n`;
    report += `- **类型**: ${file.type}\n`;
    report += `- **描述**: ${file.description}\n`;
    report += `- **配置项数**: ${file.items.length}\n`;
    if (file.dependencies?.length) {
      report += '- **依赖文件**:\n';
      file.dependencies.forEach((dep: string) => {
        report += `  - ${dep}\n`;
      });
    }
    report += '\n';
  });

  // 添加建议
  if (analysis.recommendations.length > 0) {
    report += '## 改进建议\n\n';
    analysis.recommendations.forEach((rec: any) => {
      report += `- **${rec.type}**: ${rec.message}\n`;
    });
  }

  return report;
}

// 运行分析
analyzeConfig(); 