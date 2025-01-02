import type { DependencyAnalysis, ImportInfo, ExportInfo, FunctionCallInfo, ClassRelationInfo, FileType } from '../../types/dependency/index.js';

export interface ILanguageAnalyzer {
  analyzeFile(content: string, filePath: string): Promise<DependencyAnalysis>;
  getFileType(): FileType;
  isSupported(filePath: string): boolean;
}

export abstract class BaseLanguageAnalyzer implements ILanguageAnalyzer {
  protected abstract fileExtensions: string[];

  abstract analyzeFile(content: string, filePath: string): Promise<DependencyAnalysis>;
  abstract getFileType(): FileType;

  isSupported(filePath: string): boolean {
    const ext = filePath.toLowerCase().split('.').pop() || '';
    return this.fileExtensions.includes(`.${ext}`);
  }

  protected getEmptyAnalysis(filePath: string): DependencyAnalysis {
    return {
      filePath,
      fileType: this.getFileType(),
      imports: [],
      exports: [],
      functionCalls: [],
      classRelations: [],
      dependencies: []
    };
  }
} 