import { BaseLanguageAnalyzer } from './language-analyzer.js';
import type { DependencyAnalysis, ImportInfo, FileType } from '../../types/dependency/index.js';

export class JavaAnalyzer extends BaseLanguageAnalyzer {
  protected fileExtensions = ['.java'];

  getFileType(): FileType {
    return 'java';
  }

  async analyzeFile(content: string, filePath: string): Promise<DependencyAnalysis> {
    const analysis = this.getEmptyAnalysis(filePath);

    // 分析 package 声明
    const packageMatch = content.match(/package\s+([\w.]+);/);
    const packageName = packageMatch ? packageMatch[1] : '';

    // 分析导入语句
    const imports = this.analyzeImports(content, filePath);
    analysis.imports = imports;
    analysis.dependencies = imports.map(imp => this.resolveJavaImport(imp.source, packageName));

    // 分析类定义
    const classMatch = content.match(/class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/);
    if (classMatch) {
      const [, className, extendsClass, implementsStr] = classMatch;
      const implementsClasses = implementsStr ? implementsStr.split(',').map(s => s.trim()) : [];

      analysis.classRelations.push({
        className,
        extends: extendsClass,
        implements: implementsClasses,
        methods: this.analyzeMethods(content),
        location: { line: 1, column: 1, filePath }
      });
    }

    return analysis;
  }

  private analyzeImports(content: string, filePath: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const importRegex = /import\s+(?:static\s+)?([\w.]+\*?);/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push({
        source: match[1],
        specifiers: [match[1].split('.').pop() || ''],
        importType: 'named',
        location: {
          line: this.getLineNumber(content, match.index),
          column: 1,
          filePath
        }
      });
    }

    return imports;
  }

  private analyzeMethods(content: string): any[] {
    const methods = [];
    const methodRegex = /(public|private|protected)?\s+(?:static\s+)?[\w<>[\]]+\s+(\w+)\s*\([^)]*\)/g;

    let match;
    while ((match = methodRegex.exec(content)) !== null) {
      methods.push({
        name: match[2],
        visibility: (match[1] || 'public') as 'public' | 'private' | 'protected',
        isStatic: /static/.test(match[0]),
        location: {
          line: this.getLineNumber(content, match.index),
          column: 1,
          filePath: ''
        }
      });
    }

    return methods;
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private resolveJavaImport(importPath: string, currentPackage: string): string {
    // 移除末尾的 * 通配符
    importPath = importPath.replace(/\*$/, '');

    // 如果是相对于当前包的导入
    if (!importPath.includes('.')) {
      return `${currentPackage}.${importPath}`;
    }

    return importPath;
  }
} 