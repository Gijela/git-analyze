import { BaseLanguageAnalyzer } from './language-analyzer.js';
import type { DependencyAnalysis, ImportInfo, FileType } from '../../types/dependency/index.js';

export class GoAnalyzer extends BaseLanguageAnalyzer {
  protected fileExtensions = ['.go'];

  getFileType(): FileType {
    return 'go';
  }

  async analyzeFile(content: string, filePath: string): Promise<DependencyAnalysis> {
    const analysis = this.getEmptyAnalysis(filePath);

    // 分析包声明
    const packageMatch = content.match(/package\s+(\w+)/);
    const packageName = packageMatch ? packageMatch[1] : '';

    // 分析导入语句
    const imports = this.analyzeImports(content, filePath);
    analysis.imports = imports;
    analysis.dependencies = imports.map(imp => imp.source);

    // 分析结构体（类似于类）
    const structs = this.analyzeStructs(content, filePath);
    analysis.classRelations = structs;

    // 分析函数调用
    analysis.functionCalls = this.analyzeFunctionCalls(content, filePath);

    return analysis;
  }

  private analyzeImports(content: string, filePath: string): ImportInfo[] {
    const imports: ImportInfo[] = [];

    // 匹配单行导入
    const singleImportRegex = /import\s+"([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = singleImportRegex.exec(content)) !== null) {
      imports.push({
        source: match[1],
        specifiers: [match[1].split('/').pop() || ''],
        importType: 'default',
        location: {
          line: this.getLineNumber(content, match?.index ?? 0),
          column: 1,
          filePath
        }
      });
    }

    // 匹配多行导入
    const multiImportRegex = /import\s+\(([\s\S]*?)\)/g;
    while ((match = multiImportRegex.exec(content)) !== null) {
      const importBlock = match[1];
      const importLines = importBlock.match(/"[^"]+"/g) || [];

      importLines.forEach(line => {
        const importPath = line.replace(/"/g, '');
        imports.push({
          source: importPath,
          specifiers: [importPath.split('/').pop() || ''],
          importType: 'default',
          location: {
            line: this.getLineNumber(content, match?.index ?? 0),
            column: 1,
            filePath
          }
        });
      });
    }

    return imports;
  }

  private analyzeStructs(content: string, filePath: string): any[] {
    const structs = [];
    const structRegex = /type\s+(\w+)\s+struct\s*{([^}]*)}/g;

    let match;
    while ((match = structRegex.exec(content)) !== null) {
      const [, structName, structBody] = match;

      structs.push({
        className: structName,
        methods: this.analyzeStructMethods(content, structName),
        location: {
          line: this.getLineNumber(content, match.index),
          column: 1,
          filePath
        }
      });
    }

    return structs;
  }

  private analyzeStructMethods(content: string, structName: string): any[] {
    const methods = [];
    const methodRegex = new RegExp(`func\\s*\\(\\w+\\s*\\*?${structName}\\)\\s*(\\w+)\\s*\\([^)]*\\)`, 'g');

    let match;
    while ((match = methodRegex.exec(content)) !== null) {
      const [, methodName] = match;
      const isPrivate = methodName[0] === methodName[0].toLowerCase();

      methods.push({
        name: methodName,
        visibility: isPrivate ? 'private' : 'public',
        isStatic: false,
        location: {
          line: this.getLineNumber(content, match.index),
          column: 1,
          filePath: ''
        }
      });
    }

    return methods;
  }

  private analyzeFunctionCalls(content: string, filePath: string): any[] {
    const calls = [];
    const callRegex = /(\w+)\.(\w+)\(/g;

    let match;
    while ((match = callRegex.exec(content)) !== null) {
      const [, receiver, methodName] = match;

      calls.push({
        caller: {
          name: receiver,
          location: {
            line: this.getLineNumber(content, match.index),
            column: 1,
            filePath
          }
        },
        callee: {
          name: methodName,
          location: {
            line: this.getLineNumber(content, match.index),
            column: match.index - content.lastIndexOf('\n', match.index),
            filePath
          }
        }
      });
    }

    return calls;
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }
} 