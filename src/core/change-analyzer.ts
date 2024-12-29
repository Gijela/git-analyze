import * as fs from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as path from 'path';
import { ComplexityAnalyzer, ComplexityMetrics } from './complexity';

const execAsync = promisify(exec);

export interface FileChange {
  filePath: string;
  additions: number;
  deletions: number;
  changes: number;
  complexity: ComplexityMetrics;
  impactScore: number;
  commitHistory: CommitInfo[];
}

export interface CommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
  changes: {
    additions: number;
    deletions: number;
  };
}

export interface ChangeAnalysis {
  files: FileChange[];
  hotspots: string[];
  riskAreas: string[];
  contributors: {
    name: string;
    commits: number;
    changes: number;
  }[];
  timeline: {
    date: string;
    changes: number;
  }[];
}

export class ChangeAnalyzer {
  private complexityAnalyzer: ComplexityAnalyzer;

  constructor(private rootDir: string) {
    this.complexityAnalyzer = new ComplexityAnalyzer();
  }

  /**
   * 分析项目变更历史
   */
  async analyze(since?: string): Promise<ChangeAnalysis> {
    const files = await this.analyzeFiles(since);
    const hotspots = this.identifyHotspots(files);
    const riskAreas = await this.identifyRiskAreas(files);
    const contributors = await this.analyzeContributors(since);
    const timeline = await this.generateTimeline(since);

    return {
      files,
      hotspots,
      riskAreas,
      contributors,
      timeline
    };
  }

  /**
   * 分析文件变更
   */
  private async analyzeFiles(since?: string): Promise<FileChange[]> {
    const files: FileChange[] = [];
    const gitLogCmd = since
      ? `git log --since="${since}" --name-only --pretty=format:"%H|%an|%ad|%s" --no-merges`
      : 'git log --name-only --pretty=format:"%H|%an|%ad|%s" --no-merges';

    const { stdout } = await execAsync(gitLogCmd, { cwd: this.rootDir });
    const commits = this.parseGitLog(stdout);

    for (const filePath of new Set(commits.flatMap(c => c.files))) {
      try {
        const absolutePath = path.join(this.rootDir, filePath);
        if (!fs.existsSync(absolutePath) || !filePath.endsWith('.ts')) continue;

        const complexity = await this.complexityAnalyzer.analyzeFile(absolutePath);
        const stats = await this.getFileChangeStats(filePath, since);
        const commitHistory = this.getFileCommitHistory(filePath, commits);

        const impactScore = this.calculateImpactScore({
          changes: stats.changes,
          complexity: complexity.metrics,
          commitFrequency: commitHistory.length
        });

        files.push({
          filePath,
          ...stats,
          complexity: complexity.metrics,
          impactScore,
          commitHistory
        });
      } catch (error) {
        console.error(`Error analyzing file ${filePath}:`, error);
      }
    }

    return files;
  }

  /**
   * 解析Git日志
   */
  private parseGitLog(log: string): Array<CommitInfo & { files: string[] }> {
    const commits: Array<CommitInfo & { files: string[] }> = [];
    const lines = log.split('\n');
    let currentCommit: (CommitInfo & { files: string[] }) | null = null;

    for (const line of lines) {
      if (line.includes('|')) {
        const [hash, author, date, message] = line.split('|');
        currentCommit = {
          hash,
          author,
          date,
          message,
          changes: { additions: 0, deletions: 0 },
          files: []
        };
        commits.push(currentCommit);
      } else if (line.trim() && currentCommit) {
        currentCommit.files.push(line.trim());
      }
    }

    return commits;
  }

  /**
   * 获取文件变更统计
   */
  private async getFileChangeStats(filePath: string, since?: string): Promise<{ additions: number; deletions: number; changes: number }> {
    const gitCmd = since
      ? `git log --since="${since}" --numstat --pretty="" ${filePath}`
      : `git log --numstat --pretty="" ${filePath}`;

    const { stdout } = await execAsync(gitCmd, { cwd: this.rootDir });
    const stats = stdout.split('\n')
      .filter(line => line.trim())
      .reduce((acc, line) => {
        const [additions, deletions] = line.split('\t').map(Number);
        return {
          additions: acc.additions + additions,
          deletions: acc.deletions + deletions,
          changes: acc.changes + additions + deletions
        };
      }, { additions: 0, deletions: 0, changes: 0 });

    return stats;
  }

  /**
   * 获取文件提交历史
   */
  private getFileCommitHistory(filePath: string, commits: Array<CommitInfo & { files: string[] }>): CommitInfo[] {
    return commits
      .filter(commit => commit.files.includes(filePath))
      .map(({ files, ...commit }) => commit);
  }

  /**
   * 识别热点文件
   */
  private identifyHotspots(files: FileChange[]): string[] {
    const threshold = this.calculateThreshold(files.map(f => f.changes));
    return files
      .filter(file => file.changes > threshold)
      .sort((a, b) => b.changes - a.changes)
      .map(file => file.filePath);
  }

  /**
   * 识别风险区域
   */
  private async identifyRiskAreas(files: FileChange[]): Promise<string[]> {
    return files
      .filter(file => {
        const isComplex = file.complexity.cyclomaticComplexity > 15;
        const isFrequentlyChanged = file.changes > 100;
        const hasLowMaintainability = file.complexity.maintainabilityIndex < 65;
        return isComplex || isFrequentlyChanged || hasLowMaintainability;
      })
      .sort((a, b) => b.impactScore - a.impactScore)
      .map(file => file.filePath);
  }

  /**
   * 分析贡献者
   */
  private async analyzeContributors(since?: string): Promise<{ name: string; commits: number; changes: number; }[]> {
    const gitCmd = since
      ? `git log --since="${since}" --pretty=format:"%an" --numstat`
      : 'git log --pretty=format:"%an" --numstat';

    const { stdout } = await execAsync(gitCmd, { cwd: this.rootDir });
    const lines = stdout.split('\n');
    const contributors = new Map<string, { commits: number; changes: number }>();
    let currentAuthor: string | null = null;

    for (const line of lines) {
      if (line.trim()) {
        if (!line.includes('\t')) {
          currentAuthor = line.trim();
          if (!contributors.has(currentAuthor)) {
            contributors.set(currentAuthor, { commits: 0, changes: 0 });
          }
          contributors.get(currentAuthor)!.commits++;
        } else if (currentAuthor) {
          const [additions, deletions] = line.split('\t').map(Number);
          contributors.get(currentAuthor)!.changes += additions + deletions;
        }
      }
    }

    return Array.from(contributors.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.changes - a.changes);
  }

  /**
   * 生成时间线
   */
  private async generateTimeline(since?: string): Promise<{ date: string; changes: number; }[]> {
    const gitCmd = since
      ? `git log --since="${since}" --pretty=format:"%ad" --date=short --numstat`
      : 'git log --pretty=format:"%ad" --date=short --numstat';

    const { stdout } = await execAsync(gitCmd, { cwd: this.rootDir });
    const lines = stdout.split('\n');
    const timeline = new Map<string, number>();
    let currentDate: string | null = null;

    for (const line of lines) {
      if (line.trim()) {
        if (!line.includes('\t')) {
          currentDate = line.trim();
          if (!timeline.has(currentDate)) {
            timeline.set(currentDate, 0);
          }
        } else if (currentDate) {
          const [additions, deletions] = line.split('\t').map(Number);
          timeline.set(currentDate, timeline.get(currentDate)! + additions + deletions);
        }
      }
    }

    return Array.from(timeline.entries())
      .map(([date, changes]) => ({ date, changes }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /**
   * 计算影响分数
   */
  private calculateImpactScore(params: {
    changes: number;
    complexity: ComplexityMetrics;
    commitFrequency: number;
  }): number {
    const { changes, complexity, commitFrequency } = params;
    const changeWeight = 0.4;
    const complexityWeight = 0.4;
    const frequencyWeight = 0.2;

    const normalizedChanges = Math.min(changes / 1000, 1);
    const normalizedComplexity = Math.min(complexity.cyclomaticComplexity / 30, 1);
    const normalizedFrequency = Math.min(commitFrequency / 100, 1);

    return (
      normalizedChanges * changeWeight +
      normalizedComplexity * complexityWeight +
      normalizedFrequency * frequencyWeight
    ) * 100;
  }

  /**
   * 计算阈值（使用四分位数方法）
   */
  private calculateThreshold(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const q3Index = Math.floor(sorted.length * 0.75);
    const q3 = sorted[q3Index];
    const iqr = q3 - sorted[Math.floor(sorted.length * 0.25)];
    return q3 + 1.5 * iqr;
  }
} 