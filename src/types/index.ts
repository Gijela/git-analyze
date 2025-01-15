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
  // 项目概况
  metadata: {
    files: number;
    size: number;
    tokens: number;
  };
  // 文件树
  fileTree: string;
  // 总代码
  totalCode: string;
  // 文件大小树
  sizeTree: string;
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