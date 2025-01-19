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
  // 文件预估消耗 token 数量
  token: number;
}

export interface AnalysisResult {
  // 项目概况
  metadata: {
    files: number;
    tokens: number;
  };
  // 文件树
  fileTree: string;
  // 总代码
  totalCode: {
    // 文件路径
    path: string;
    // 文件内容
    content: string;
    // 文件预估消耗 token 数量
    token: number;
  }[];
  // 文件大小树，表示文件及其子文件夹的大小结构
  sizeTree: {
    // 文件或文件夹的名称
    name: string;
    // 文件或文件夹预估消耗 token 数量
    token: number;
    // 是否为文件
    isFile: boolean;
    // 子文件或子文件夹的集合
    children?: {
      [key: string]: {
        // 子文件或子文件夹的名称
        name: string;
        // 子文件或子文件夹预估消耗 token 数量
        token: number;
        // 子文件或子文件夹的集合
        children?: any; // 递归定义，允许嵌套
        // 是否为文件
        isFile: boolean;
      };
    };
  };
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
