import { GitAction } from './core/gitAction';
import { FileScanner } from './core/scanner';
import type {
  AnalyzeOptions,
  AnalysisResult,
  GitIngestConfig,
  FileInfo
} from './types/index';
import { estimateTokens, generateTree, buildSizeTree } from './utils/index';
import { GitIngestError, ValidationError, GitOperationError } from './core/errors';
import { mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';

export class GitIngest {
  private git: GitAction;
  private scanner: FileScanner;
  private config: GitIngestConfig;

  constructor(config?: GitIngestConfig) {
    this.git = new GitAction();
    this.scanner = new FileScanner();
    this.config = {
      tempDir: 'repo', // 默认保存仓库的目录名(不会暴露到外部)
      keepTempFiles: false, // 默认不保留临时文件
      defaultMaxFileSize: 1024 * 1024, // 默认检索不超过 1MB 的文件
      defaultPatterns: {
        include: ['**/*'],
        exclude: ['**/node_modules/**', '**/.git/**']
      },
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

  // [核心步骤0]: 开端，根据 url 按需获取仓库代码
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
    const uniqueId = crypto.randomBytes(3).toString('base64url').slice(0, 4);
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

      // [核心步骤一]: 调用扫描目录
      result = await this.analyzeFromDirectory(workDir, options);

      // 如果不保留临时文件，则清理
      if (!this.config.keepTempFiles) {
        await this.cleanupTempDir(workDir);
      }

      // 如果是自定义域名访问，添加额外信息
      // if (isCustomDomain) {
      //   result.summary = `通过自定义域名 ${this.config.customDomainMap?.targetDomain} 访问\n原始仓库: ${githubUrl}\n\n${result.summary}`;
      // }

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

  // 分析扫描目录
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
      // [核心步骤二]: 执行目录扫描
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
        // summary: generateSummary(files, metadata),
        metadata,
        fileTree: generateTree(files),
        totalCode: this.generateContent(files),
        sizeTree: JSON.stringify(buildSizeTree(files), null, 2)
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
      tokens: files.reduce((acc, file) => acc + estimateTokens(file.content), 0)
    };
  }

  private generateContent(files: FileInfo[]): string {
    return files.map(file => {
      return `File: ${file.path}\n${'='.repeat(40)}\n${file.content}\n\n`;
    }).join('\n');
  }
}

// 导出错误类型
export { GitIngestError, ValidationError, GitOperationError } from './core/errors';

// 导出类型定义
export type {
  AnalyzeOptions,
  AnalysisResult,
  GitIngestConfig,
  FileInfo
};