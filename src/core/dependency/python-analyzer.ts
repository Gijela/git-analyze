import { BaseLanguageAnalyzer } from './language-analyzer.js';
import type { DependencyAnalysis, ImportInfo, FileType } from '../../types/dependency/index.js';

export class PythonAnalyzer extends BaseLanguageAnalyzer {
  protected fileExtensions = ['.py'];

  getFileType(): FileType {
    return 'python';
  }

  async analyzeFile(content: string, filePath: string): Promise<DependencyAnalysis> {
    const analysis = this.getEmptyAnalysis(filePath);

    // 分析导入语句
    const imports = this.analyzeImports(content, filePath);
    analysis.imports = imports;
    analysis.dependencies = this.resolvePythonImports(imports);

    // 分析类定义
    const classDefinitions = this.analyzeClasses(content, filePath);
    analysis.classRelations = classDefinitions;

    // 分析函数调用
    analysis.functionCalls = this.analyzeFunctionCalls(content, filePath);

    return analysis;
  }

  private analyzeImports(content: string, filePath: string): ImportInfo[] {
    const imports: ImportInfo[] = [];

    // 匹配 import 语句
    const importRegex = /^import\s+([\w.]+)(?:\s+as\s+(\w+))?/gm;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push({
        source: match[1],
        specifiers: [match[2] || match[1].split('.').pop() || ''],
        importType: 'default',
        location: {
          line: this.getLineNumber(content, match.index),
          column: 1,
          filePath
        }
      });
    }

    // 匹配 from ... import 语句
    const fromImportRegex = /^from\s+([\w.]+)\s+import\s+([^#\n]+)/gm;
    while ((match = fromImportRegex.exec(content)) !== null) {
      const [, source, importList] = match;
      const specifiers = importList
        .split(',')
        .map(s => s.trim())
        .filter(s => s)
        .map(s => s.split(' as ')[0]);

      imports.push({
        source,
        specifiers,
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

  private analyzeClasses(content: string, filePath: string): any[] {
    const classes = [];
    const classRegex = /class\s+(\w+)(?:\(([\w,\s]+)\))?:/g;

    let match;
    while ((match = classRegex.exec(content)) !== null) {
      const [, className, inheritance] = match;
      const parentClasses = inheritance
        ? inheritance.split(',').map(s => s.trim())
        : [];

      classes.push({
        className,
        extends: parentClasses[0],
        implements: parentClasses.slice(1),
        methods: this.analyzeClassMethods(content, match.index),
        location: {
          line: this.getLineNumber(content, match.index),
          column: 1,
          filePath
        }
      });
    }

    return classes;
  }

  private analyzeClassMethods(content: string, classStart: number): any[] {
    const methods = [];
    const methodRegex = /def\s+(\w+)\s*\([^)]*\):/g;
    const classContent = content.slice(classStart);

    let match;
    while ((match = methodRegex.exec(classContent)) !== null) {
      const [, methodName] = match;
      const isPrivate = methodName.startsWith('_');

      methods.push({
        name: methodName,
        visibility: isPrivate ? 'private' : 'public',
        isStatic: false,
        location: {
          line: this.getLineNumber(content, classStart + match.index),
          column: 1,
          filePath: ''
        }
      });
    }

    return methods;
  }

  private analyzeFunctionCalls(content: string, filePath: string): any[] {
    const calls = [];
    const callRegex = /(\w+)\s*\(/g;

    let match;
    while ((match = callRegex.exec(content)) !== null) {
      const [, functionName] = match;
      // 排除内置函数和类定义
      if (!functionName.match(/^(class|def|if|for|while|print|len|str|int|float)$/)) {
        calls.push({
          caller: {
            name: 'unknown',
            location: {
              line: this.getLineNumber(content, match.index),
              column: 1,
              filePath
            }
          },
          callee: {
            name: functionName,
            location: {
              line: this.getLineNumber(content, match.index),
              column: match.index - content.lastIndexOf('\n', match.index),
              filePath
            }
          }
        });
      }
    }

    return calls;
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private resolvePythonImports(imports: ImportInfo[]): string[] {
    return imports.map(imp => {
      // 将点号分隔的导入路径转换为文件路径
      const path = imp.source.replace(/\./g, '/');
      return `${path}.py`;
    });
  }
} 