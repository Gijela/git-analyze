import { simpleGit } from 'simple-git';
import { DependencyAnalyzer } from '../../src/core/dependency/analyzer.js';
import { BranchAnalyzer } from '../../src/core/git/branch-analyzer.js';

async function main() {
  try {
    const git = simpleGit();
    const dependencyAnalyzer = new DependencyAnalyzer();
    const branchAnalyzer = new BranchAnalyzer(git, dependencyAnalyzer);

    // 分析当前分支与目标分支的差异
    console.log('Analyzing branch differences...');
    const analysis = await branchAnalyzer.analyzeBranchDiff('dev', 'main');

    console.log('\nBranch Analysis Results:');
    console.log('========================');

    console.log('\nBranch Information:');
    console.log(`Source: ${analysis.sourceBranch}`);
    console.log(`Target: ${analysis.targetBranch}`);

    console.log('\nCommit Statistics:');
    console.log(`Ahead by: ${analysis.commits.ahead.length} commits`);
    console.log(`Behind by: ${analysis.commits.behind.length} commits`);
    console.log(`Diverged commits: ${analysis.commits.diverged.length}`);

    console.log('\nFile Changes:');
    console.log(`Added: ${analysis.files.added.length} files`);
    console.log(`Modified: ${analysis.files.modified.length} files`);
    console.log(`Deleted: ${analysis.files.deleted.length} files`);
    console.log(`Renamed: ${analysis.files.renamed.length} files`);

    if (analysis.files.added.length > 0) {
      console.log('\nAdded Files:');
      analysis.files.added.forEach(file => console.log(`  + ${file}`));
    }

    if (analysis.files.modified.length > 0) {
      console.log('\nModified Files:');
      analysis.files.modified.forEach(file => console.log(`  M ${file}`));
    }

    if (analysis.files.deleted.length > 0) {
      console.log('\nDeleted Files:');
      analysis.files.deleted.forEach(file => console.log(`  - ${file}`));
    }

    if (analysis.files.renamed.length > 0) {
      console.log('\nRenamed Files:');
      analysis.files.renamed.forEach(({ from, to }) =>
        console.log(`  ${from} -> ${to}`)
      );
    }

    console.log('\nConflict Analysis:');
    console.log(`Potential Conflicts: ${analysis.conflicts.files.length} files`);
    console.log(`Conflict Probability: ${(analysis.conflicts.probability * 100).toFixed(1)}%`);

    if (analysis.conflicts.files.length > 0) {
      console.log('\nConflicting Files:');
      analysis.conflicts.files.forEach(file => console.log(`  ! ${file}`));

      console.log('\nConflict Areas:');
      analysis.conflicts.conflictAreas.forEach(area => {
        console.log(`  ${area.file} (Severity: ${area.severity})`);
        console.log(`    Lines: ${area.lines.join(', ')}`);
      });
    }

    console.log('\nDependency Impact:');
    console.log(`Risk Level: ${analysis.dependencyImpact.risk}`);
    console.log(`Broken Dependencies: ${analysis.dependencyImpact.broken.length}`);
    console.log(`Affected Modules: ${analysis.dependencyImpact.affected.length}`);

    if (analysis.dependencyImpact.broken.length > 0) {
      console.log('\nBroken Dependencies:');
      analysis.dependencyImpact.broken.forEach(dep => console.log(`  ! ${dep}`));
    }

    if (analysis.dependencyImpact.affected.length > 0) {
      console.log('\nAffected Modules:');
      analysis.dependencyImpact.affected.forEach(mod => console.log(`  * ${mod}`));
    }

  } catch (error) {
    console.error('Analysis failed:', error);
  }
}

main(); 