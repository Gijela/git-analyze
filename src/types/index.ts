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
  // 保存克隆仓库的临时目录名
  tempDir?: string;
  /* 默认检索的最大的文件 */
  defaultMaxFileSize?: number;
  /* 文件模式 */
  defaultPatterns?: {
    /* 包含的文件/目录 */
    include?: string[];
    /* 不会去检索的文件/目录 */
    exclude?: string[];
  };
  /* 保留克隆的仓库 */
  keepTempFiles?: boolean;
  /* 自定义域名 */
  customDomainMap?: {
    targetDomain: string;
    originalDomain: string;
  };
}
