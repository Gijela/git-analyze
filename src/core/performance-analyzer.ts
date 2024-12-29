import * as fs from 'fs';
import { promisify } from 'util';
import { glob } from 'glob';
import { parse } from '@typescript-eslint/parser';
import { AST_NODE_TYPES } from '@typescript-eslint/types';

const readFile = promisify(fs.readFile);

/**
 * 性能指标类型
 */
export enum PerformanceMetricType {
  TIME_COMPLEXITY = 'time_complexity',
  SPACE_COMPLEXITY = 'space_complexity',
  MEMORY_USAGE = 'memory_usage',
  CPU_USAGE = 'cpu_usage',
  NETWORK_CALLS = 'network_calls'
}

/**
 * 性能问题严重程度
 */
export enum PerformanceSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * 性能指标接口
 */
export interface PerformanceMetric {
  type: PerformanceMetricType;
  value: number;
  severity: PerformanceSeverity;
  file: string;
  function?: string;
  line?: number;
  description: string;
  recommendation: string;
}

/**
 * 性能分析结果
 */
export interface PerformanceAnalysis {
  metrics: PerformanceMetric[];
  summary: {
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
  };
  hotspots: {
    file: string;
    issues: number;
    severity: PerformanceSeverity;
  }[];
  recommendations: string[];
}

/**
 * 性能分析器类
 */
export class PerformanceAnalyzer {
  /**
   * 分析文件性能
   */
  async analyzeFile(filePath: string): Promise<PerformanceMetric[]> {
    const content = await readFile(filePath, 'utf-8');
    const metrics: PerformanceMetric[] = [];

    try {
      // 解析代码为AST
      const ast = parse(content, {
        sourceType: 'module',
        ecmaVersion: 2020,
        loc: true
      });

      // 分析时间复杂度
      this.analyzeTimeComplexity(ast, filePath, metrics);

      // 分析空间复杂度
      this.analyzeSpaceComplexity(ast, filePath, metrics);

      // 分析内存使用
      this.analyzeMemoryUsage(ast, filePath, metrics);

      // 分析网络调用
      this.analyzeNetworkCalls(ast, filePath, metrics);

    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error);
    }

    return metrics;
  }

  /**
   * 分析目录中的所有文件
   */
  async analyzeDirectory(dirPath: string): Promise<PerformanceAnalysis> {
    const files = await glob('**/*.{js,ts}', {
      cwd: dirPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
      absolute: true
    });

    const allMetrics: PerformanceMetric[] = [];
    for (const file of files) {
      try {
        const metrics = await this.analyzeFile(file);
        allMetrics.push(...metrics);
      } catch (error) {
        console.error(`Error analyzing file ${file}:`, error);
      }
    }

    // 生成分析结果
    const analysis: PerformanceAnalysis = {
      metrics: allMetrics,
      summary: this.generateSummary(allMetrics),
      hotspots: this.identifyHotspots(allMetrics),
      recommendations: this.generateRecommendations(allMetrics)
    };

    return analysis;
  }

  /**
   * 分析时间复杂度
   */
  private analyzeTimeComplexity(ast: any, filePath: string, metrics: PerformanceMetric[]): void {
    const visit = (node: any) => {
      if (node.type === AST_NODE_TYPES.FunctionDeclaration ||
        node.type === AST_NODE_TYPES.FunctionExpression ||
        node.type === AST_NODE_TYPES.ArrowFunctionExpression) {

        const complexity = this.calculateTimeComplexity(node);
        const severity = this.getComplexitySeverity(complexity);

        metrics.push({
          type: PerformanceMetricType.TIME_COMPLEXITY,
          value: complexity,
          severity,
          file: filePath,
          function: node.id?.name,
          line: node.loc?.start.line,
          description: `函数时间复杂度为 O(n^${complexity})`,
          recommendation: this.getComplexityRecommendation(complexity)
        });
      }

      // 递归访问子节点
      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          visit(node[key]);
        }
      }
    };

    visit(ast);
  }

  /**
   * 分析空间复杂度
   */
  private analyzeSpaceComplexity(ast: any, filePath: string, metrics: PerformanceMetric[]): void {
    const visit = (node: any) => {
      if (node.type === AST_NODE_TYPES.FunctionDeclaration ||
        node.type === AST_NODE_TYPES.FunctionExpression ||
        node.type === AST_NODE_TYPES.ArrowFunctionExpression) {

        const complexity = this.calculateSpaceComplexity(node);
        const severity = this.getComplexitySeverity(complexity);

        metrics.push({
          type: PerformanceMetricType.SPACE_COMPLEXITY,
          value: complexity,
          severity,
          file: filePath,
          function: node.id?.name,
          line: node.loc?.start.line,
          description: `函数空间复杂度为 O(n^${complexity})`,
          recommendation: this.getSpaceComplexityRecommendation(complexity)
        });
      }

      // 递归访问子节点
      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          visit(node[key]);
        }
      }
    };

    visit(ast);
  }

  /**
   * 分析内存使用
   */
  private analyzeMemoryUsage(ast: any, filePath: string, metrics: PerformanceMetric[]): void {
    const visit = (node: any) => {
      // 检查大数组创建
      if (node.type === AST_NODE_TYPES.ArrayExpression && node.elements.length > 1000) {
        metrics.push({
          type: PerformanceMetricType.MEMORY_USAGE,
          value: node.elements.length,
          severity: PerformanceSeverity.HIGH,
          file: filePath,
          line: node.loc?.start.line,
          description: `创建了大型数组(${node.elements.length}个元素)`,
          recommendation: '考虑使用流式处理或分批处理大数组'
        });
      }

      // 检查内存泄漏风险
      if (node.type === AST_NODE_TYPES.FunctionDeclaration) {
        const closureVars = this.findClosureVariables(node);
        if (closureVars.length > 0) {
          metrics.push({
            type: PerformanceMetricType.MEMORY_USAGE,
            value: closureVars.length,
            severity: PerformanceSeverity.MEDIUM,
            file: filePath,
            function: node.id?.name,
            line: node.loc?.start.line,
            description: `闭包中可能存在内存泄漏风险(${closureVars.length}个变量)`,
            recommendation: '注意及时清理不再使用的闭包变量'
          });
        }
      }

      // 递归访问子节点
      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          visit(node[key]);
        }
      }
    };

    visit(ast);
  }

  /**
   * 分析网络调用
   */
  private analyzeNetworkCalls(ast: any, filePath: string, metrics: PerformanceMetric[]): void {
    const visit = (node: any) => {
      // 检查网络请求
      if (node.type === AST_NODE_TYPES.CallExpression &&
        (node.callee.name === 'fetch' ||
          node.callee.property?.name === 'get' ||
          node.callee.property?.name === 'post')) {

        metrics.push({
          type: PerformanceMetricType.NETWORK_CALLS,
          value: 1,
          severity: PerformanceSeverity.MEDIUM,
          file: filePath,
          line: node.loc?.start.line,
          description: '发现网络请求调用',
          recommendation: '考虑使用缓存或批量请求优化网络调用'
        });
      }

      // 递归访问子节点
      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          visit(node[key]);
        }
      }
    };

    visit(ast);
  }

  /**
   * 计算时间复杂度
   */
  private calculateTimeComplexity(node: any): number {
    let complexity = 1;

    const visit = (node: any) => {
      // 检查循环
      if (node.type === AST_NODE_TYPES.ForStatement ||
        node.type === AST_NODE_TYPES.ForInStatement ||
        node.type === AST_NODE_TYPES.ForOfStatement ||
        node.type === AST_NODE_TYPES.WhileStatement ||
        node.type === AST_NODE_TYPES.DoWhileStatement) {
        complexity++;
      }

      // 检查嵌套循环
      if (node.body && Array.isArray(node.body)) {
        node.body.forEach(visit);
      }
      if (node.body && typeof node.body === 'object') {
        visit(node.body);
      }
    };

    visit(node);
    return complexity;
  }

  /**
   * 计算空间复杂度
   */
  private calculateSpaceComplexity(node: any): number {
    let complexity = 1;

    const visit = (node: any) => {
      // 检查数组创建
      if (node.type === AST_NODE_TYPES.ArrayExpression) {
        complexity++;
      }

      // 检查对象创建
      if (node.type === AST_NODE_TYPES.ObjectExpression) {
        complexity++;
      }

      // 检查递归调用
      if (node.type === AST_NODE_TYPES.CallExpression &&
        node.callee.name === node.parent?.id?.name) {
        complexity++;
      }

      // 递归访问子节点
      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          visit(node[key]);
        }
      }
    };

    visit(node);
    return complexity;
  }

  /**
   * 查找闭包变量
   */
  private findClosureVariables(node: any): string[] {
    const variables: string[] = [];
    const scopeVariables = new Set<string>();

    // 收集作用域内的变量
    const collectScopeVariables = (node: any) => {
      if (node.type === AST_NODE_TYPES.VariableDeclaration) {
        node.declarations.forEach((decl: any) => {
          if (decl.id.type === AST_NODE_TYPES.Identifier) {
            scopeVariables.add(decl.id.name);
          }
        });
      }
    };

    // 检查变量引用
    const checkVariableReferences = (node: any) => {
      if (node.type === AST_NODE_TYPES.Identifier &&
        !scopeVariables.has(node.name)) {
        variables.push(node.name);
      }
    };

    // 遍历AST
    const visit = (node: any) => {
      collectScopeVariables(node);
      checkVariableReferences(node);

      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          visit(node[key]);
        }
      }
    };

    visit(node);
    return [...new Set(variables)];
  }

  /**
   * 获取复杂度严重程度
   */
  private getComplexitySeverity(complexity: number): PerformanceSeverity {
    if (complexity > 3) return PerformanceSeverity.CRITICAL;
    if (complexity > 2) return PerformanceSeverity.HIGH;
    if (complexity > 1) return PerformanceSeverity.MEDIUM;
    return PerformanceSeverity.LOW;
  }

  /**
   * 获取复杂度优化建议
   */
  private getComplexityRecommendation(complexity: number): string {
    if (complexity > 3) {
      return '建议重构代码,使用更高效的算法或数据结构';
    }
    if (complexity > 2) {
      return '考虑优化循环嵌套,减少时间复杂度';
    }
    if (complexity > 1) {
      return '可以考虑使用缓存或查找表优化性能';
    }
    return '当前复杂度可以接受';
  }

  /**
   * 获取空间复杂度优化建议
   */
  private getSpaceComplexityRecommendation(complexity: number): string {
    if (complexity > 3) {
      return '建议优化数据结构,减少内存占用';
    }
    if (complexity > 2) {
      return '考虑使用流式处理或释放不需要的内存';
    }
    if (complexity > 1) {
      return '可以考虑重用对象或使用对象池';
    }
    return '当前空间复杂度可以接受';
  }

  /**
   * 生成分析概要
   */
  private generateSummary(metrics: PerformanceMetric[]): {
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
  } {
    return {
      totalIssues: metrics.length,
      criticalIssues: metrics.filter(m => m.severity === PerformanceSeverity.CRITICAL).length,
      highIssues: metrics.filter(m => m.severity === PerformanceSeverity.HIGH).length,
      mediumIssues: metrics.filter(m => m.severity === PerformanceSeverity.MEDIUM).length,
      lowIssues: metrics.filter(m => m.severity === PerformanceSeverity.LOW).length
    };
  }

  /**
   * 识别性能热点
   */
  private identifyHotspots(metrics: PerformanceMetric[]): {
    file: string;
    issues: number;
    severity: PerformanceSeverity;
  }[] {
    const hotspots = new Map<string, {
      issues: number;
      severityScore: number;
    }>();

    // 统计每个文件的问题
    metrics.forEach(metric => {
      const fileStats = hotspots.get(metric.file) || { issues: 0, severityScore: 0 };
      fileStats.issues++;
      fileStats.severityScore += this.getSeverityScore(metric.severity);
      hotspots.set(metric.file, fileStats);
    });

    // 转换为数组并排序
    return Array.from(hotspots.entries())
      .map(([file, stats]) => ({
        file,
        issues: stats.issues,
        severity: this.getSeverityFromScore(stats.severityScore / stats.issues)
      }))
      .sort((a, b) => b.issues - a.issues);
  }

  /**
   * 获取严重程度分数
   */
  private getSeverityScore(severity: PerformanceSeverity): number {
    switch (severity) {
      case PerformanceSeverity.CRITICAL:
        return 4;
      case PerformanceSeverity.HIGH:
        return 3;
      case PerformanceSeverity.MEDIUM:
        return 2;
      case PerformanceSeverity.LOW:
        return 1;
    }
  }

  /**
   * 根据分数获取严重程度
   */
  private getSeverityFromScore(score: number): PerformanceSeverity {
    if (score >= 3.5) return PerformanceSeverity.CRITICAL;
    if (score >= 2.5) return PerformanceSeverity.HIGH;
    if (score >= 1.5) return PerformanceSeverity.MEDIUM;
    return PerformanceSeverity.LOW;
  }

  /**
   * 生成性能优化建议
   */
  private generateRecommendations(metrics: PerformanceMetric[]): string[] {
    const recommendations: string[] = [];

    // 按问题类型分组
    const issuesByType = metrics.reduce((acc, metric) => {
      acc[metric.type] = (acc[metric.type] || []).concat(metric);
      return acc;
    }, {} as Record<string, PerformanceMetric[]>);

    // 生成建议
    Object.entries(issuesByType).forEach(([type, issues]) => {
      const criticalIssues = issues.filter(i => i.severity === PerformanceSeverity.CRITICAL);
      const highIssues = issues.filter(i => i.severity === PerformanceSeverity.HIGH);

      if (criticalIssues.length > 0) {
        recommendations.push(
          `发现 ${criticalIssues.length} 个严重的 ${type} 问题，需要立即优化`
        );
      }

      if (highIssues.length > 0) {
        recommendations.push(
          `发现 ${highIssues.length} 个高危的 ${type} 问题，建议尽快优化`
        );
      }

      // 添加具体的优化建议
      const uniqueRecommendations = new Set(
        issues.map(i => i.recommendation)
      );
      recommendations.push(...uniqueRecommendations);
    });

    return recommendations;
  }
} 