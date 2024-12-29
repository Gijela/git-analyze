import * as fs from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  maintainabilityIndex: number;
  linesOfCode: number;
  commentLines: number;
  commentRatio: number;
}

export interface FileComplexity {
  filePath: string;
  metrics: ComplexityMetrics;
  functions: {
    name: string;
    metrics: ComplexityMetrics;
  }[];
}

export class ComplexityAnalyzer {
  /**
   * 分析文件复杂度
   */
  async analyzeFile(filePath: string): Promise<FileComplexity> {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    const metrics = this.calculateMetrics(content);
    const functions = this.analyzeFunctions(content);

    return {
      filePath,
      metrics,
      functions
    };
  }

  /**
   * 计算代码度量指标
   */
  private calculateMetrics(content: string): ComplexityMetrics {
    const lines = content.split('\n');
    const linesOfCode = this.countLinesOfCode(lines);
    const commentLines = this.countCommentLines(lines);
    const cyclomaticComplexity = this.calculateCyclomaticComplexity(content);

    // 计算可维护性指数
    // 使用Microsoft的可维护性指数公式的简化版本
    const maintainabilityIndex = Math.max(0, (
      171 -
      5.2 * Math.log(cyclomaticComplexity) -
      0.23 * (linesOfCode - commentLines) -
      16.2 * Math.log(linesOfCode)
    ) * 100 / 171);

    return {
      cyclomaticComplexity,
      maintainabilityIndex,
      linesOfCode,
      commentLines,
      commentRatio: commentLines / linesOfCode
    };
  }

  /**
   * 分析函数复杂度
   */
  private analyzeFunctions(content: string): { name: string; metrics: ComplexityMetrics }[] {
    const functionRegex = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(.*?\)\s*=>)/g;
    const functions: { name: string; metrics: ComplexityMetrics }[] = [];
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1] || match[2];
      const functionBody = this.extractFunctionBody(content, match.index);

      if (functionBody) {
        functions.push({
          name: functionName,
          metrics: this.calculateMetrics(functionBody)
        });
      }
    }

    return functions;
  }

  /**
   * 提取函数体
   */
  private extractFunctionBody(content: string, startIndex: number): string | null {
    let braceCount = 0;
    let bodyStart = -1;
    let bodyEnd = -1;

    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === '{') {
        if (braceCount === 0) {
          bodyStart = i;
        }
        braceCount++;
      } else if (content[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          bodyEnd = i + 1;
          break;
        }
      }
    }

    return bodyStart !== -1 && bodyEnd !== -1
      ? content.slice(bodyStart, bodyEnd)
      : null;
  }

  /**
   * 计算圈复杂度
   */
  private calculateCyclomaticComplexity(content: string): number {
    const patterns = [
      /\bif\b/g,
      /\belse\s+if\b/g,
      /\bwhile\b/g,
      /\bfor\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\b&&\b/g,
      /\b\|\|\b/g,
      /\?\s*[^:]+\s*:/g  // 三元运算符
    ];

    return 1 + patterns.reduce((complexity, pattern) => {
      const matches = content.match(pattern);
      return complexity + (matches ? matches.length : 0);
    }, 0);
  }

  /**
   * 统计代码行数
   */
  private countLinesOfCode(lines: string[]): number {
    return lines.filter(line => {
      const trimmed = line.trim();
      return trimmed && !this.isComment(trimmed);
    }).length;
  }

  /**
   * 统计注释行数
   */
  private countCommentLines(lines: string[]): number {
    let inMultilineComment = false;
    let commentCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) continue;

      if (inMultilineComment) {
        commentCount++;
        if (trimmed.includes('*/')) {
          inMultilineComment = false;
        }
      } else if (trimmed.startsWith('/*')) {
        commentCount++;
        if (!trimmed.includes('*/')) {
          inMultilineComment = true;
        }
      } else if (trimmed.startsWith('//')) {
        commentCount++;
      }
    }

    return commentCount;
  }

  /**
   * 判断是否为注释行
   */
  private isComment(line: string): boolean {
    return line.startsWith('//') || line.startsWith('/*') || line.startsWith('*');
  }
} 