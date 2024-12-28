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
import { mkdir } from 'fs/promises';
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
      ...config
    };
  }

  async analyzeFromUrl(
    url: string,
    options?: AnalyzeOptions
  ): Promise<AnalysisResult> {
    if (!url) {
      throw new ValidationError('URL is required');
    }

    if (!url.match(/^https?:\/\//)) {
      throw new ValidationError('Invalid URL format');
    }

    if (!this.config.tempDir) {
      throw new ValidationError('Temporary directory is required');
    }

    const workDir = `${this.config.tempDir}/${Date.now()}`;

    try {
      // 确保临时目录存在
      if (!existsSync(this.config.tempDir)) {
        await mkdir(this.config.tempDir, { recursive: true });
      }

      // 克隆仓库
      await this.git.clone(url, workDir);

      // 如果指定了分支,切换到对应分支
      if (options?.branch) {
        await this.git.checkoutBranch(workDir, options.branch);
      }

      // 扫描文件
      return this.analyzeFromDirectory(workDir, options);
    } catch (error) {
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
        excludePatterns: options?.excludePatterns || this.config.defaultPatterns?.exclude
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