import { GitHandler } from './core/git.js';
import { FileScanner } from './core/scanner.js';
import type {
  AnalyzeOptions,
  AnalysisResult,
  GitIngestConfig,
  FileInfo
} from './types/index.js';
import { estimateTokens, generateTree, generateSummary } from './utils/index.js';
import { GitIngestError, ValidationError, GitOperationError } from './core/errors.js';
import { mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';

export class GitIngest {
  private git: GitHandler;
  private scanner: FileScanner;
  private config: GitIngestConfig;

  constructor(config?: GitIngestConfig) {
    this.git = new GitHandler();
    this.scanner = new FileScanner();
    this.config = {
      tempDir: './temp',
      defaultMaxFileSize: 1024 * 1024, // 1MB
      defaultPatterns: {
        include: ['**/*'],
        exclude: ['**/node_modules/**', '**/.git/**']
      },
      keepTempFiles: false, // 默认不保留临时文件
      ...config
    };
  }

  // 清理临时目录
  private async cleanupTempDir(dirPath: string): Promise<void> {
    try {
      if (existsSync(dirPath)) {
        await rm(dirPath, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(`Warning: Failed to cleanup temporary directory ${dirPath}: ${(error as Error).message}`);
    }
  }

  // 检查URL是否使用自定义域名，如果是则转换为原始GitHub URL
  private transformCustomDomainUrl(url: string): string {
    if (!this.config.customDomainMap) {
      return url;
    }

    const { targetDomain, originalDomain } = this.config.customDomainMap;
    if (url.includes(targetDomain)) {
      return url.replace(targetDomain, originalDomain);
    }

    return url;
  }

  // 检查URL是否匹配自定义域名
  private isCustomDomainUrl(url: string): boolean {
    if (!this.config.customDomainMap) {
      return false;
    }

    return url.includes(this.config.customDomainMap.targetDomain);
  }

  async analyzeFromUrl(
    url: string,
    options?: AnalyzeOptions
  ): Promise<AnalysisResult> {
    // 检查是否是自定义域名URL
    const isCustomDomain = this.isCustomDomainUrl(url);
    // 转换URL
    const githubUrl = this.transformCustomDomainUrl(url);

    if (!githubUrl) {
      throw new ValidationError('URL is required');
    }

    if (!githubUrl.match(/^https?:\/\//)) {
      throw new ValidationError('Invalid URL format');
    }

    if (!this.config.tempDir) {
      throw new ValidationError('Temporary directory is required');
    }

    // 从URL中提取仓库名
    const repoMatch = githubUrl.match(/github\.com\/[^\/]+\/([^\/]+)/);
    const repoName = repoMatch ? repoMatch[1] : 'unknown';
    // 生成唯一标识符（使用时间戳的后6位作为唯一值）
    const uniqueId = Date.now().toString().slice(-6);
    const workDir = `${this.config.tempDir}/${repoName}-${uniqueId}`;

    let result: AnalysisResult;

    try {
      // 确保临时目录存在
      if (!existsSync(this.config.tempDir)) {
        await mkdir(this.config.tempDir, { recursive: true });
      }

      // 克隆仓库
      await this.git.clone(githubUrl, workDir);

      // 如果指定了分支,切换到对应分支
      if (options?.branch) {
        await this.git.checkoutBranch(workDir, options.branch);
      }

      // 扫描文件
      result = await this.analyzeFromDirectory(workDir, options);

      // 如果不保留临时文件，则清理
      if (!this.config.keepTempFiles) {
        await this.cleanupTempDir(workDir);
      }

      // 如果是自定义域名访问，添加额外信息
      if (isCustomDomain) {
        result.summary = `通过自定义域名 ${this.config.customDomainMap?.targetDomain} 访问\n原始仓库: ${githubUrl}\n\n${result.summary}`;
      }

      return result;
    } catch (error) {
      // 发生错误时也尝试清理临时文件
      if (!this.config.keepTempFiles) {
        await this.cleanupTempDir(workDir);
      }

      if (error instanceof GitIngestError) {
        throw error;
      }
      throw new GitIngestError(`Failed to analyze repository: ${(error as Error).message}`);
    }
  }

  async analyzeFromDirectory(
    path: string,
    options?: AnalyzeOptions
  ): Promise<AnalysisResult> {
    if (!path) {
      throw new ValidationError('Path is required');
    }

    if (!existsSync(path)) {
      throw new ValidationError(`Directory not found: ${path}`);
    }

    try {
      const files = await this.scanner.scanDirectory(path, {
        maxFileSize: options?.maxFileSize || this.config.defaultMaxFileSize,
        includePatterns: options?.includePatterns || this.config.defaultPatterns?.include,
        excludePatterns: options?.excludePatterns || this.config.defaultPatterns?.exclude,
        targetPaths: options?.targetPaths,
        includeDependencies: true
      });

      if (files.length === 0) {
        throw new ValidationError('No files found in the specified directory');
      }

      // 计算元数据
      const metadata = this.calculateMetadata(files);

      // 生成分析结果
      return {
        summary: this.generateSummary(files, metadata),
        tree: this.generateTree(files),
        content: this.generateContent(files),
        metadata
      };
    } catch (error) {
      if (error instanceof GitIngestError) {
        throw error;
      }
      throw new GitIngestError(`Failed to analyze directory: ${(error as Error).message}`);
    }
  }

  private calculateMetadata(files: FileInfo[]) {
    return {
      files: files.length,
      size: files.reduce((acc, file) => acc + file.size, 0),
      tokens: files.reduce((acc, file) => acc + this.estimateTokens(file.content), 0)
    };
  }

  private generateSummary(files: FileInfo[], metadata: any): string {
    return generateSummary(files, metadata);
  }

  private generateTree(files: FileInfo[]): string {
    return generateTree(files);
  }

  private generateContent(files: FileInfo[]): string {
    return files.map(file => {
      return `File: ${file.path}\n${'='.repeat(40)}\n${file.content}\n\n`;
    }).join('\n');
  }

  private estimateTokens(content: string): number {
    return estimateTokens(content);
  }
}

// 导出错误类型
export { GitIngestError, ValidationError, GitOperationError } from './core/errors.js';

// 导出类型定义
export type {
  AnalyzeOptions,
  AnalysisResult,
  GitIngestConfig,
  FileInfo
}; 