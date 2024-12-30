export interface CommitInfo {
  hash: string;
  author: string;
  date: Date;
  message: string;
  branch?: string;
}

export interface FileChange {
  file: string;
  type: 'add' | 'modify' | 'delete';
  additions: number;
  deletions: number;
  patches: string[];
}

export interface ImpactAnalysis {
  directFiles: string[];      // 直接影响的文件
  indirectFiles: string[];    // 间接影响的文件
  potentialImpact: 'high' | 'medium' | 'low';
}

export interface RelatedCommit {
  hash: string;
  message: string;
  date: Date;
  relevanceType: 'same-file' | 'same-function' | 'dependency';
  relevanceScore: number;     // 相关性得分 0-1
}

export interface ChangeAnalysis {
  commitInfo: CommitInfo;
  changes: FileChange[];
  impacts: ImpactAnalysis;
  relatedCommits: RelatedCommit[];
}

export interface CommitRange {
  from: string;
  to: string;
  branch?: string;
}

export interface GitAnalysisOptions {
  maxDepth?: number;          // 最大分析深度
  includeMerges?: boolean;    // 是否包含合并提交
  analyzeImpact?: boolean;    // 是否分析影响
  findRelated?: boolean;      // 是否查找相关提交
} 