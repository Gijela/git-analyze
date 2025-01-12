export interface AnalyzeOptions {
  // 最大文件大小
  maxFileSize?: number;
  // 包含的文件模式
  includePatterns?: string[];
  // 排除的文件模式
  excludePatterns?: string[];
  // 目标文件路径
  targetPaths?: string[];
  // 分支
  branch?: string;
  // 提交
  commit?: string;
}

export interface FileInfo {
  // 文件路径
  path: string;
  // 文件内容
  content: string;
  // 文件大小
  size: number;
}

export interface AnalysisResult {
  summary: string;
  tree: string;
  content: string;
  metadata: {
    files: number;
    size: number;
    tokens: number;
  };
}

export interface GitIngestConfig {
  tempDir?: string;
  defaultMaxFileSize?: number;
  defaultPatterns?: {
    include?: string[];
    exclude?: string[];
  };
  keepTempFiles?: boolean;
  customDomainMap?: {
    targetDomain: string;
    originalDomain: string;
  };
} 