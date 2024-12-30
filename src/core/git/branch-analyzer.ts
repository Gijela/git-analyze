import { SimpleGit } from 'simple-git';
import type { BranchDiffAnalysis, BranchAnalysisOptions } from '../../types/git/branch.js';
import type { CommitInfo } from '../../types/git/index.js';
import { DependencyAnalyzer } from '../dependency/analyzer.js';
import { GitAnalysisError } from '../errors.js';

interface ConflictArea {
  file: string;
  lines: number[];
  severity: 'high' | 'medium' | 'low';
}

export class BranchAnalyzer {
  private defaultOptions: Required<BranchAnalysisOptions> = {
    includeCommits: true,
    includeConflicts: true,
    includeDependencies: true,
    maxDepth: 100
  };

  constructor(
    private git: SimpleGit,
    private dependencyAnalyzer: DependencyAnalyzer
  ) { }

  async analyzeBranchDiff(
    sourceBranch: string,
    targetBranch: string,
    options?: BranchAnalysisOptions
  ): Promise<BranchDiffAnalysis> {
    try {
      const opts = { ...this.defaultOptions, ...options };

      // 获取分支差异信息
      const mergeBase = await this.getMergeBase(sourceBranch, targetBranch);

      // 获取提交信息
      const commits = opts.includeCommits
        ? await this.analyzeCommits(sourceBranch, targetBranch, mergeBase)
        : { ahead: [], behind: [], diverged: [] };

      // 分析文件差异
      const files = await this.analyzeFiles(sourceBranch, targetBranch);

      // 分析冲突
      const conflicts = opts.includeConflicts
        ? await this.analyzeConflicts(sourceBranch, targetBranch, files)
        : { files: [], probability: 0, conflictAreas: [] };

      // 分析依赖影响
      const dependencyImpact = opts.includeDependencies
        ? await this.analyzeDependencyImpact(files)
        : { broken: [], affected: [], risk: 'low' as const };

      return {
        sourceBranch,
        targetBranch,
        commits,
        files,
        conflicts,
        dependencyImpact
      };
    } catch (error) {
      throw new GitAnalysisError(
        'analyzeBranchDiff',
        `${sourceBranch}..${targetBranch}`,
        (error as Error).message
      );
    }
  }

  private async getMergeBase(source: string, target: string): Promise<string> {
    const result = await this.git.raw(['merge-base', source, target]);
    return result.trim();
  }

  private async analyzeCommits(
    source: string,
    target: string,
    mergeBase: string
  ): Promise<BranchDiffAnalysis['commits']> {
    const [sourceLog, targetLog] = await Promise.all([
      this.git.log([`${mergeBase}..${source}`]),
      this.git.log([`${mergeBase}..${target}`])
    ]);

    const ahead = sourceLog.all.map(commit => ({
      hash: commit.hash,
      author: commit.author_name,
      date: new Date(commit.date),
      message: commit.message
    }));

    const behind = targetLog.all.map(commit => ({
      hash: commit.hash,
      author: commit.author_name,
      date: new Date(commit.date),
      message: commit.message
    }));

    // 找出分叉的提交
    const diverged = await this.findDivergedCommits(source, target, mergeBase);

    return { ahead, behind, diverged };
  }

  private async findDivergedCommits(
    source: string,
    target: string,
    mergeBase: string
  ): Promise<CommitInfo[]> {
    const log = await this.git.log([
      '--graph',
      '--format=%H %P',
      `${mergeBase}..${source}`,
      `${mergeBase}..${target}`
    ]);

    const commits = new Set<string>();
    const lines = log.all.map(c => c.hash);

    for (const line of lines) {
      const [commit, ...parents] = line.split(' ');
      if (parents.length > 1) {
        commits.add(commit);
      }
    }

    // 获取分叉提交的详细信息
    const divergedCommits: CommitInfo[] = [];
    for (const hash of commits) {
      const commit = await this.git.show(['--format=%H %an %aI %s', '-s', hash]);
      const [commitHash, author, date, ...messageParts] = commit.split(' ');
      divergedCommits.push({
        hash: commitHash,
        author,
        date: new Date(date),
        message: messageParts.join(' ')
      });
    }

    return divergedCommits;
  }

  private async analyzeFiles(
    source: string,
    target: string
  ): Promise<BranchDiffAnalysis['files']> {
    const diff = await this.git.diff([source, target, '--name-status']);
    const files = {
      added: [] as string[],
      modified: [] as string[],
      deleted: [] as string[],
      renamed: [] as { from: string; to: string; }[]
    };

    const lines = diff.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;

      const [status, ...paths] = line.split('\t');
      switch (status[0]) {
        case 'A':
          files.added.push(paths[0]);
          break;
        case 'M':
          files.modified.push(paths[0]);
          break;
        case 'D':
          files.deleted.push(paths[0]);
          break;
        case 'R':
          files.renamed.push({ from: paths[0], to: paths[1] });
          break;
      }
    }

    return files;
  }

  private async analyzeConflicts(
    source: string,
    target: string,
    files: BranchDiffAnalysis['files']
  ): Promise<BranchDiffAnalysis['conflicts']> {
    const conflictFiles = new Set<string>();
    const conflictAreas: ConflictArea[] = [];

    // 检查每个修改的文件
    for (const file of [...files.modified, ...files.renamed.map(r => r.to)]) {
      try {
        // 尝试合并以检测冲突
        await this.git.raw(['merge-tree', source, target, file]);
      } catch (error) {
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('conflict')) {
          conflictFiles.add(file);

          // 分析冲突区域
          const areas = await this.analyzeFileConflicts(file, source, target);
          conflictAreas.push(...areas);
        }
      }
    }

    return {
      files: Array.from(conflictFiles),
      probability: this.calculateConflictProbability(conflictAreas),
      conflictAreas
    };
  }

  private async analyzeFileConflicts(
    file: string,
    source: string,
    target: string
  ): Promise<ConflictArea[]> {
    const areas: ConflictArea[] = [];

    try {
      const diff = await this.git.diff([source, target, '--', file]);
      const chunks = diff.split('@@');

      for (let i = 1; i < chunks.length; i++) {
        const chunk = chunks[i];
        const lines = chunk.split('\n');
        const header = lines[0];
        const match = header.match(/-(\d+),(\d+) \+(\d+),(\d+)/);

        if (match) {
          const [, startA, lengthA, startB, lengthB] = match.map(Number);
          const severity = this.calculateConflictSeverity(lines);

          areas.push({
            file,
            lines: Array.from(
              { length: Math.max(lengthA, lengthB) },
              (_, i) => startA + i
            ),
            severity
          });
        }
      }
    } catch {
      // 如果无法分析具体行，则将整个文件标记为潜在冲突
      areas.push({
        file,
        lines: [],
        severity: 'medium'
      });
    }

    return areas;
  }

  private calculateConflictSeverity(
    lines: string[]
  ): 'high' | 'medium' | 'low' {
    const changes = lines.filter(line => line.startsWith('+') || line.startsWith('-'));
    const overlap = changes.length / lines.length;

    if (overlap > 0.5) return 'high';
    if (overlap > 0.2) return 'medium';
    return 'low';
  }

  private calculateConflictProbability(areas: ConflictArea[]): number {
    if (areas.length === 0) return 0;

    const weights = {
      high: 1,
      medium: 0.6,
      low: 0.3
    };

    const totalWeight = areas.reduce(
      (sum, area) => sum + weights[area.severity] * area.lines.length,
      0
    );

    return Math.min(1, totalWeight / (areas.length * 100));
  }

  private async analyzeDependencyImpact(
    files: BranchDiffAnalysis['files']
  ): Promise<BranchDiffAnalysis['dependencyImpact']> {
    const broken = new Set<string>();
    const affected = new Set<string>();

    // 分析修改和删除的文件
    for (const file of [...files.modified, ...files.deleted]) {
      try {
        const content = await this.git.show([`HEAD:${file}`]);
        const analysis = await this.dependencyAnalyzer.analyzeFile(content, file);

        // 检查依赖是否被破坏
        for (const dep of analysis.dependencies) {
          if (files.deleted.includes(dep)) {
            broken.add(dep);
          }
          affected.add(dep);
        }
      } catch {
        // 忽略无法分析的文件
        continue;
      }
    }

    // 分析重命名的文件
    for (const { from, to } of files.renamed) {
      try {
        const content = await this.git.show([`HEAD:${from}`]);
        const analysis = await this.dependencyAnalyzer.analyzeFile(content, from);

        // 更新依赖路径
        for (const dep of analysis.dependencies) {
          if (files.deleted.includes(dep)) {
            broken.add(dep);
          }
          affected.add(dep);
        }
      } catch {
        continue;
      }
    }

    return {
      broken: Array.from(broken),
      affected: Array.from(affected),
      risk: this.calculateDependencyRisk(broken.size, affected.size)
    };
  }

  private calculateDependencyRisk(
    brokenCount: number,
    affectedCount: number
  ): 'high' | 'medium' | 'low' {
    const risk = (brokenCount * 2 + affectedCount) / 2;
    if (risk > 10) return 'high';
    if (risk > 5) return 'medium';
    return 'low';
  }
} 