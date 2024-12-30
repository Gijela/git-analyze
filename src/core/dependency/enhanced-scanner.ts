import { FileScanner } from '../scanner.js';
import type { DependencyAnalysis, ImportInfo } from '../../types/dependency/index.js';
import { DependencyAnalyzer } from './analyzer.js';

interface AnalysisCacheEntry {
  analysis: DependencyAnalysis;
  timestamp: number;
  contentHash: string;
}

export class EnhancedScanner extends FileScanner {
  private analysisCache: Map<string, AnalysisCacheEntry> = new Map();
  private readonly CACHE_TTL = 1000 * 60 * 5; // 5分钟缓存过期

  constructor(private dependencyAnalyzer: DependencyAnalyzer) {
    super();
  }

  private calculateContentHash(content: string): string {
    return Buffer.from(content).toString('base64');
  }

  private isCacheValid(entry: AnalysisCacheEntry, contentHash: string): boolean {
    const now = Date.now();
    return (
      entry.contentHash === contentHash &&
      now - entry.timestamp < this.CACHE_TTL
    );
  }

  protected override async analyzeDependencies(
    content: string,
    filePath: string,
    basePath: string
  ): Promise<string[]> {
    // 计算内容hash用于缓存验证
    const contentHash = this.calculateContentHash(content);
    const cacheKey = `${filePath}:${contentHash}`;

    // 检查缓存
    const cachedEntry = this.analysisCache.get(cacheKey);
    if (cachedEntry && this.isCacheValid(cachedEntry, contentHash)) {
      return cachedEntry.analysis.dependencies;
    }

    // 获取基础依赖分析
    const basicDeps = await super.analyzeDependencies(content, filePath, basePath);

    // 使用依赖分析器进行深度分析
    const analysis = await this.dependencyAnalyzer.analyzeFile(content, filePath);

    // 合并基础依赖和深度分析结果
    const enhancedAnalysis: DependencyAnalysis = {
      ...analysis,
      dependencies: basicDeps
    };

    // 更新缓存
    this.analysisCache.set(cacheKey, {
      analysis: enhancedAnalysis,
      timestamp: Date.now(),
      contentHash
    });

    return basicDeps;
  }

  // 获取完整的依赖分析结果
  async getAnalysis(
    content: string,
    filePath: string,
    basePath: string
  ): Promise<DependencyAnalysis> {
    await this.analyzeDependencies(content, filePath, basePath);
    const contentHash = this.calculateContentHash(content);
    const cacheKey = `${filePath}:${contentHash}`;
    return this.analysisCache.get(cacheKey)!.analysis;
  }

  // 清理过期缓存
  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.analysisCache.entries()) {
      if (now - entry.timestamp >= this.CACHE_TTL) {
        this.analysisCache.delete(key);
      }
    }
  }
} 