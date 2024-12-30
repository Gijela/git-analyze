import { DependencyAnalyzer } from '../../src/core/dependency/analyzer.js';
import { EnhancedScanner } from '../../src/core/dependency/enhanced-scanner.js';
import { GitAnalyzer } from '../../src/core/git/analyzer.js';
import { join } from 'path';

async function main() {
  try {
    // 初始化分析器
    const dependencyAnalyzer = new DependencyAnalyzer();
    const scanner = new EnhancedScanner(dependencyAnalyzer);
    const gitAnalyzer = new GitAnalyzer(process.cwd(), dependencyAnalyzer);

    // 分析当前目录
    console.log('Analyzing dependencies...');
    const files = await scanner.scanDirectory(process.cwd(), {
      includePatterns: ['**/*.ts'],
      excludePatterns: ['**/node_modules/**', '**/dist/**'],
      includeDependencies: true
    });

    console.log(`Found ${files.length} files`);

    // 分析最近的提交
    console.log('\nAnalyzing recent commit...');
    const analysis = await gitAnalyzer.analyzeChanges('HEAD');

    console.log('\nCommit Info:');
    console.log(analysis.commitInfo);

    console.log('\nChanged Files:');
    console.log(analysis.changes.map(c => `${c.type}: ${c.file}`));

    console.log('\nImpact Analysis:');
    console.log('Direct Files:', analysis.impacts.directFiles);
    console.log('Indirect Files:', analysis.impacts.indirectFiles);
    console.log('Impact Level:', analysis.impacts.potentialImpact);

    console.log('\nRelated Commits:');
    console.log(analysis.relatedCommits.map(c => ({
      hash: c.hash.slice(0, 7),
      message: c.message.split('\n')[0],
      score: c.relevanceScore.toFixed(2)
    })));

  } catch (error) {
    console.error('Analysis failed:', error);
  }
}

main(); 