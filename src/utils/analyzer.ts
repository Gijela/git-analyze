import { FileUtil } from './file.js';
import type { FileInfo } from '../types/index.js';

/**
 * Code Analysis Result Interface
 */
interface CodeAnalysis {
  complexity: number;
  tokens: string[];
  lines: number;
  commentLines: number;
  emptyLines: number;
  functions: {
    name: string;
    complexity: number;
    parameters: number;
    lines: number;
  }[];
  classes: {
    name: string;
    methods: number;
    properties: number;
    complexity: number;
  }[];
  imports: string[];
  exports: string[];
  dependencies: Set<string>;
}

/**
 * Code Analyzer Utility Class
 * Provides methods for analyzing code structure and quality
 */
export class CodeAnalyzer {
  /**
   * Analyze code content
   * 
   * @param content - Code content to analyze
   * @param filePath - File path for context
   * @returns Analysis results
   */
  static analyzeCode(content: string, filePath: string): CodeAnalysis {
    return {
      complexity: FileUtil.estimateComplexity(content),
      tokens: FileUtil.extractTokens(content),
      lines: this.countLines(content),
      commentLines: this.countCommentLines(content),
      emptyLines: this.countEmptyLines(content),
      functions: this.analyzeFunctions(content),
      classes: this.analyzeClasses(content),
      imports: this.findImports(content),
      exports: this.findExports(content),
      dependencies: this.findDependencies(content)
    };
  }

  /**
   * Count total lines of code
   * 
   * @param content - Code content
   * @returns Number of lines
   */
  private static countLines(content: string): number {
    return content.split('\n').length;
  }

  /**
   * Count comment lines
   * 
   * @param content - Code content
   * @returns Number of comment lines
   */
  private static countCommentLines(content: string): number {
    const lines = content.split('\n');
    let count = 0;
    let inMultilineComment = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (inMultilineComment) {
        count++;
        if (trimmed.includes('*/')) {
          inMultilineComment = false;
        }
      } else if (trimmed.startsWith('//')) {
        count++;
      } else if (trimmed.startsWith('/*')) {
        count++;
        inMultilineComment = !trimmed.includes('*/');
      }
    }

    return count;
  }

  /**
   * Count empty lines
   * 
   * @param content - Code content
   * @returns Number of empty lines
   */
  private static countEmptyLines(content: string): number {
    return content.split('\n').filter(line => line.trim().length === 0).length;
  }

  /**
   * Analyze functions in code
   * 
   * @param content - Code content
   * @returns Array of function information
   */
  private static analyzeFunctions(content: string): {
    name: string;
    complexity: number;
    parameters: number;
    lines: number;
  }[] {
    const functions: {
      name: string;
      complexity: number;
      parameters: number;
      lines: number;
    }[] = [];

    // Match function declarations
    const functionRegex = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()(.*?)\)\s*{([^}]*)}/g;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const name = match[1] || match[2];
      const params = match[3].split(',').filter(p => p.trim().length > 0);
      const body = match[4];

      functions.push({
        name,
        complexity: FileUtil.estimateComplexity(body),
        parameters: params.length,
        lines: body.split('\n').length
      });
    }

    return functions;
  }

  /**
   * Analyze classes in code
   * 
   * @param content - Code content
   * @returns Array of class information
   */
  private static analyzeClasses(content: string): {
    name: string;
    methods: number;
    properties: number;
    complexity: number;
  }[] {
    const classes: {
      name: string;
      methods: number;
      properties: number;
      complexity: number;
    }[] = [];

    // Match class declarations
    const classRegex = /class\s+(\w+)(?:\s+extends\s+\w+)?\s*{([^}]*)}/g;
    let match;

    while ((match = classRegex.exec(content)) !== null) {
      const name = match[1];
      const body = match[2];

      const methods = (body.match(/(?:async\s+)?[\w]+\s*\([^)]*\)\s*{/g) || []).length;
      const properties = (body.match(/^\s*[\w]+\s*[=:]/gm) || []).length;

      classes.push({
        name,
        methods,
        properties,
        complexity: FileUtil.estimateComplexity(body)
      });
    }

    return classes;
  }

  /**
   * Find import statements
   * 
   * @param content - Code content
   * @returns Array of import statements
   */
  private static findImports(content: string): string[] {
    const imports = new Set<string>();
    const importRegex = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.add(match[1]);
    }

    return Array.from(imports);
  }

  /**
   * Find export statements
   * 
   * @param content - Code content
   * @returns Array of export statements
   */
  private static findExports(content: string): string[] {
    const exports = new Set<string>();
    const exportRegex = /export\s+(?:default\s+)?(?:class|interface|type|function|const|let|var)\s+(\w+)/g;
    let match;

    while ((match = exportRegex.exec(content)) !== null) {
      exports.add(match[1]);
    }

    return Array.from(exports);
  }

  /**
   * Find code dependencies
   * 
   * @param content - Code content
   * @returns Set of dependencies
   */
  private static findDependencies(content: string): Set<string> {
    const dependencies = new Set<string>();

    // Add imports
    this.findImports(content).forEach(imp => dependencies.add(imp));

    // Add type references
    const typeRegex = /(?:extends|implements|:)\s+(\w+)(?:\s*[,<{]|$)/g;
    let match;

    while ((match = typeRegex.exec(content)) !== null) {
      dependencies.add(match[1]);
    }

    return dependencies;
  }

  /**
   * Find potential code issues
   * 
   * @param content - Code content
   * @returns Array of potential issues
   */
  static findIssues(content: string): string[] {
    const issues: string[] = [];

    // Check for long functions
    const longFunctions = this.analyzeFunctions(content)
      .filter(f => f.lines > 30);
    if (longFunctions.length > 0) {
      issues.push(`Found ${longFunctions.length} functions longer than 30 lines`);
    }

    // Check for complex functions
    const complexFunctions = this.analyzeFunctions(content)
      .filter(f => f.complexity > 10);
    if (complexFunctions.length > 0) {
      issues.push(`Found ${complexFunctions.length} functions with high complexity`);
    }

    // Check for large classes
    const largeClasses = this.analyzeClasses(content)
      .filter(c => c.methods > 10);
    if (largeClasses.length > 0) {
      issues.push(`Found ${largeClasses.length} classes with more than 10 methods`);
    }

    // Check comment ratio
    const lines = this.countLines(content);
    const commentLines = this.countCommentLines(content);
    const commentRatio = commentLines / lines;
    if (commentRatio < 0.1) {
      issues.push('Low comment ratio (less than 10%)');
    }

    return issues;
  }

  /**
   * Generate code metrics report
   * 
   * @param files - Array of file information
   * @returns Formatted report string
   */
  static generateReport(files: FileInfo[]): string {
    let report = 'Code Analysis Report\n';
    report += '===================\n\n';

    let totalLines = 0;
    let totalComments = 0;
    let totalComplexity = 0;
    let totalFunctions = 0;
    let totalClasses = 0;

    for (const file of files) {
      const analysis = this.analyzeCode(file.content, file.path);

      totalLines += analysis.lines;
      totalComments += analysis.commentLines;
      totalComplexity += analysis.complexity;
      totalFunctions += analysis.functions.length;
      totalClasses += analysis.classes.length;

      report += `File: ${file.path}\n`;
      report += `-----------------\n`;
      report += `Lines of Code: ${analysis.lines}\n`;
      report += `Comment Lines: ${analysis.commentLines}\n`;
      report += `Empty Lines: ${analysis.emptyLines}\n`;
      report += `Complexity: ${analysis.complexity}\n`;
      report += `Functions: ${analysis.functions.length}\n`;
      report += `Classes: ${analysis.classes.length}\n`;

      const issues = this.findIssues(file.content);
      if (issues.length > 0) {
        report += 'Issues:\n';
        issues.forEach(issue => {
          report += `- ${issue}\n`;
        });
      }

      report += '\n';
    }

    report += 'Summary\n';
    report += '-------\n';
    report += `Total Files: ${files.length}\n`;
    report += `Total Lines: ${totalLines}\n`;
    report += `Total Comments: ${totalComments}\n`;
    report += `Comment Ratio: ${((totalComments / totalLines) * 100).toFixed(1)}%\n`;
    report += `Average Complexity: ${(totalComplexity / files.length).toFixed(1)}\n`;
    report += `Total Functions: ${totalFunctions}\n`;
    report += `Total Classes: ${totalClasses}\n`;

    return report;
  }
} 