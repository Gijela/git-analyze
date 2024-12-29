import { ChangeAnalyzer } from '../src/core/change-analyzer.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analyzeChanges() {
  try {
    // 初始化变更分析器
    const rootDir = path.resolve(__dirname, '..');
    const analyzer = new ChangeAnalyzer(rootDir);

    console.log('开始分析项目变更...');

    // 分析最近一个月的变更
    const analysis = await analyzer.analyze('1 month ago');

    // 输出分析结果
    console.log('\n=== 变更分析报告 ===');

    // 1. 文件变更统计
    console.log('\n文件变更统计:');
    analysis.files.forEach(file => {
      console.log(`\n文件: ${file.filePath}`);
      console.log(`  添加: ${file.additions} 行`);
      console.log(`  删除: ${file.deletions} 行`);
      console.log(`  总变更: ${file.changes} 行`);
      console.log(`  影响分数: ${file.impactScore.toFixed(2)}`);
      console.log(`  圈复杂度: ${file.complexity.cyclomaticComplexity}`);
      console.log(`  可维护性指数: ${file.complexity.maintainabilityIndex.toFixed(2)}`);
    });

    // 2. 热点文件
    console.log('\n热点文件:');
    analysis.hotspots.forEach(file => {
      console.log(`- ${file}`);
    });

    // 3. 风险区域
    console.log('\n风险区域:');
    analysis.riskAreas.forEach(file => {
      console.log(`- ${file}`);
    });

    // 4. 贡献者统计
    console.log('\n贡献者统计:');
    analysis.contributors.forEach(contributor => {
      console.log(`\n${contributor.name}:`);
      console.log(`  提交次数: ${contributor.commits}`);
      console.log(`  变更行数: ${contributor.changes}`);
    });

    // 5. 变更时间线
    console.log('\n变更时间线:');
    analysis.timeline.forEach(entry => {
      console.log(`${entry.date}: ${entry.changes} 行变更`);
    });

  } catch (error) {
    console.error('分析过程中发生错误:', error);
  }
}

// 运行分析
analyzeChanges(); 