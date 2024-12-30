import { simpleGit, SimpleGit } from 'simple-git';
import type {
  ChangeAnalysis,
  CommitInfo,
  FileChange,
  GitAnalysisOptions,
  ImpactAnalysis,
  RelatedCommit
} from '../../types/git/index.js';
import { DependencyAnalyzer } from '../dependency/analyzer.js';
import { GitAnalysisError } from '../errors.js';

interface CommitCache {
  timestamp: number;
  data: any;
}

export class GitAnalyzer {
  private git: SimpleGit;
  private defaultOptions: GitAnalysisOptions = {
    maxDepth: 10,
    includeMerges: false,
    analyzeImpact: true,
    findRelated: true
  };

  // 缓存以提高性能
  private commitCache: Map<string, CommitCache> = new Map();
  private readonly CACHE_TTL = 1000 * 60 * 5; // 5分钟缓存过期

  constructor(
    private repoPath: string,
    private dependencyAnalyzer: DependencyAnalyzer
  ) {
    this.git = simpleGit(repoPath);
  }

  private getCachedData<T>(key: string): T | null {
    const cached = this.commitCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data as T;
    }
    return null;
  }

  private setCachedData(key: string, data: any): void {
    this.commitCache.set(key, {
      timestamp: Date.now(),
      data
    });
  }

  async analyzeChanges(
    commitHash: string,
    options?: GitAnalysisOptions
  ): Promise<ChangeAnalysis> {
    try {
      const opts = { ...this.defaultOptions, ...options };

      // 获取提交信息
      const commitInfo = await this.getCommitInfo(commitHash);

      // 获取文件变更
      const changes = await this.getFileChanges(commitHash);

      // 分析影响
      const impacts = opts.analyzeImpact
        ? await this.analyzeImpact(changes)
        : { directFiles: [], indirectFiles: [], potentialImpact: 'low' as const };

      // 查找相关提交
      const relatedCommits = opts.findRelated
        ? await this.findRelatedCommits(commitHash, changes, opts.maxDepth)
        : [];

      return {
        commitInfo,
        changes,
        impacts,
        relatedCommits
      };
    } catch (error) {
      throw new GitAnalysisError(
        'analyzeChanges',
        commitHash,
        (error as Error).message
      );
    }
  }

  private async getCommitInfo(hash: string): Promise<CommitInfo> {
    const cacheKey = `commit:${hash}`;
    const cached = this.getCachedData<CommitInfo>(cacheKey);
    if (cached) return cached;

    try {
      const log = await this.git.log(['-1', hash]);
      const commit = log.latest;
      if (!commit) {
        throw new Error(`Commit ${hash} not found`);
      }

      const info = {
        hash: commit.hash,
        author: commit.author_name,
        date: new Date(commit.date),
        message: commit.message,
        branch: await this.getBranchForCommit(hash)
      };

      this.setCachedData(cacheKey, info);
      return info;
    } catch (error) {
      throw new GitAnalysisError(
        'getCommitInfo',
        hash,
        (error as Error).message
      );
    }
  }

  private async getBranchForCommit(hash: string): Promise<string | undefined> {
    try {
      const result = await this.git.branch(['--contains', hash]);
      const branches = result.all.filter(b => !b.startsWith('remotes/'));
      return branches[0];
    } catch {
      return undefined;
    }
  }

  private async getFileChanges(hash: string): Promise<FileChange[]> {
    const cacheKey = `changes:${hash}`;
    const cached = this.getCachedData<FileChange[]>(cacheKey);
    if (cached) return cached;

    try {
      const changes: FileChange[] = [];
      const parentHash = await this.getParentHash(hash);

      // 使用单个命令获取所有需要的信息
      const stats = await this.git.show([
        hash,
        '--numstat',
        '--format=',
        '--unified=3'
      ]);

      // 解析统计信息
      const lines = stats.trim().split('\n');
      const fileStats = new Map<string, { additions: number; deletions: number }>();

      for (const line of lines) {
        if (!line.trim() || line.startsWith('diff')) continue;

        const [additions, deletions, file] = line.split('\t');
        if (!file) continue;

        fileStats.set(file, {
          additions: parseInt(additions) || 0,
          deletions: parseInt(deletions) || 0
        });
      }

      // 获取文件变更类型和补丁
      const diff = await this.git.show([hash]);
      const patches = this.extractAllPatches(diff);

      for (const [file, stats] of fileStats) {
        const type = await this.getChangeType(hash, file, parentHash);
        changes.push({
          file,
          type,
          additions: stats.additions,
          deletions: stats.deletions,
          patches: patches.get(file) || []
        });
      }

      this.setCachedData(cacheKey, changes);
      return changes;
    } catch (error) {
      throw new GitAnalysisError(
        'getFileChanges',
        hash,
        (error as Error).message
      );
    }
  }

  private extractAllPatches(diff: string): Map<string, string[]> {
    const patches = new Map<string, string[]>();
    const diffParts = diff.split('diff --git');

    for (const part of diffParts) {
      if (!part.trim()) continue;

      const fileMatch = part.match(/a\/(.*?) b\//);
      if (!fileMatch) continue;

      const file = fileMatch[1];
      const currentPatches: string[] = [];
      const lines = part.split('\n');
      let currentPatch: string[] = [];
      let inPatch = false;

      for (const line of lines) {
        if (line.startsWith('@@')) {
          if (currentPatch.length > 0) {
            currentPatches.push(currentPatch.join('\n'));
            currentPatch = [];
          }
          inPatch = true;
        }

        if (inPatch) {
          currentPatch.push(line);
        }
      }

      if (currentPatch.length > 0) {
        currentPatches.push(currentPatch.join('\n'));
      }

      patches.set(file, currentPatches);
    }

    return patches;
  }

  private async getChangeType(
    hash: string,
    file: string,
    parentHash: string | null
  ): Promise<'add' | 'modify' | 'delete'> {
    const cacheKey = `type:${hash}:${file}`;
    const cached = this.getCachedData<'add' | 'modify' | 'delete'>(cacheKey);
    if (cached) return cached;

    try {
      if (!parentHash) return 'add';

      const fileExistsInParent = await this.git.raw([
        'ls-tree',
        '-r',
        parentHash,
        file
      ]);

      const fileExistsInCurrent = await this.git.raw([
        'ls-tree',
        '-r',
        hash,
        file
      ]);

      let type: 'add' | 'modify' | 'delete';
      if (!fileExistsInParent) {
        type = 'add';
      } else if (!fileExistsInCurrent) {
        type = 'delete';
      } else {
        type = 'modify';
      }

      this.setCachedData(cacheKey, type);
      return type;
    } catch {
      return 'modify';
    }
  }

  private async getParentHash(hash: string): Promise<string | null> {
    try {
      const result = await this.git.raw(['rev-parse', `${hash}^`]);
      return result.trim();
    } catch {
      return null;
    }
  }

  private async analyzeImpact(changes: FileChange[]): Promise<ImpactAnalysis> {
    const directFiles = changes.map(c => c.file);
    const indirectFiles: string[] = [];

    // 分析依赖关系
    for (const change of changes) {
      try {
        const content = await this.git.show([`HEAD:${change.file}`]);
        const analysis = await this.dependencyAnalyzer.analyzeFile(
          content,
          change.file
        );

        // 添加依赖文件到间接影响列表
        for (const dep of analysis.dependencies) {
          if (!directFiles.includes(dep) && !indirectFiles.includes(dep)) {
            indirectFiles.push(dep);
          }
        }
      } catch {
        // 忽略无法分析的文件
        continue;
      }
    }

    // 计算影响程度
    const potentialImpact = this.calculateImpactLevel(
      directFiles,
      indirectFiles
    );

    return {
      directFiles,
      indirectFiles,
      potentialImpact
    };
  }

  private calculateImpactLevel(
    directFiles: string[],
    indirectFiles: string[]
  ): 'high' | 'medium' | 'low' {
    const totalImpact = directFiles.length + indirectFiles.length * 0.5;

    if (totalImpact > 10) return 'high';
    if (totalImpact > 5) return 'medium';
    return 'low';
  }

  private async findRelatedCommits(
    hash: string,
    changes: FileChange[],
    maxDepth: number = 10
  ): Promise<RelatedCommit[]> {
    const cacheKey = `related:${hash}`;
    const cached = this.getCachedData<RelatedCommit[]>(cacheKey);
    if (cached) return cached;

    try {
      const relatedCommits = new Map<string, RelatedCommit>();
      const files = changes.map(c => c.file);

      // 获取每个文件的历史提交
      for (const file of files) {
        const logs = await this.git.log({
          file,
          maxCount: maxDepth
        });

        for (const commit of logs.all) {
          if (commit.hash === hash) continue;

          const relevanceScore = await this.calculateRelevanceScore(
            hash,
            commit.hash,
            file
          );

          // 如果已存在这个提交，更新最高的相关性得分
          if (relatedCommits.has(commit.hash)) {
            const existing = relatedCommits.get(commit.hash)!;
            if (relevanceScore > existing.relevanceScore) {
              existing.relevanceScore = relevanceScore;
            }
          } else {
            relatedCommits.set(commit.hash, {
              hash: commit.hash,
              message: commit.message,
              date: new Date(commit.date),
              relevanceType: 'same-file',
              relevanceScore
            });
          }
        }
      }

      // 转换为数组并排序
      const result = Array.from(relatedCommits.values())
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, maxDepth);

      this.setCachedData(cacheKey, result);
      return result;
    } catch (error) {
      throw new GitAnalysisError(
        'findRelatedCommits',
        hash,
        (error as Error).message
      );
    }
  }

  private async calculateRelevanceScore(
    currentHash: string,
    relatedHash: string,
    file: string
  ): Promise<number> {
    const cacheKey = `score:${currentHash}:${relatedHash}:${file}`;
    const cached = this.getCachedData<number>(cacheKey);
    if (cached !== null) return cached;

    try {
      // 获取两个提交中文件的差异
      const diff = await this.git.diff([currentHash, relatedHash, '--', file]);

      // 计算更复杂的相关性得分
      const lines = diff.split('\n');
      const changedLines = lines.filter(
        line => line.startsWith('+') || line.startsWith('-')
      );
      const contextLines = lines.filter(
        line => !line.startsWith('+') && !line.startsWith('-') && !line.startsWith('@@')
      );

      // 考虑变更行数和上下文行数的比例
      const changeRatio = changedLines.length / (lines.length || 1);
      const contextRatio = contextLines.length / (lines.length || 1);

      // 结合变更比例和上下文比例计算最终得分
      const score = (1 - changeRatio) * 0.7 + contextRatio * 0.3;
      const finalScore = Math.max(0, Math.min(1, score));

      this.setCachedData(cacheKey, finalScore);
      return finalScore;
    } catch {
      return 0;
    }
  }

  // 清理过期缓存
  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.commitCache.entries()) {
      if (now - entry.timestamp >= this.CACHE_TTL) {
        this.commitCache.delete(key);
      }
    }
  }
} 