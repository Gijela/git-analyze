import type { CommitInfo } from './index.js';

export interface BranchDiffAnalysis {
  // 基本信息
  sourceBranch: string;
  targetBranch: string;

  // 提交差异
  commits: {
    ahead: CommitInfo[];    // source 比 target 多的提交
    behind: CommitInfo[];   // source 比 target 少的提交
    diverged: CommitInfo[]; // 分叉的提交
  };

  // 文件差异
  files: {
    added: string[];      // 新增的文件
    modified: string[];   // 修改的文件
    deleted: string[];    // 删除的文件
    renamed: {           // 重命名的文件
      from: string;
      to: string;
    }[];
  };

  // 冲突分析
  conflicts: {
    files: string[];           // 可能冲突的文件
    probability: number;       // 冲突概率
    conflictAreas: {          // 具体冲突区域
      file: string;
      lines: number[];
      severity: 'high' | 'medium' | 'low';
    }[];
  };

  // 依赖影响
  dependencyImpact: {
    broken: string[];         // 破坏的依赖关系
    affected: string[];       // 受影响的模块
    risk: 'high' | 'medium' | 'low';
  };
}

export interface BranchAnalysisOptions {
  includeCommits?: boolean;     // 是否包含提交信息
  includeConflicts?: boolean;   // 是否分析冲突
  includeDependencies?: boolean; // 是否分析依赖影响
  maxDepth?: number;            // 分析的最大深度
} 