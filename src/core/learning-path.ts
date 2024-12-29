import type { DependencyGraph } from './dependency';
import type { FileComplexity } from './complexity';
import type { CommentAnalysis } from './comment-analyzer';
import type { ChangeAnalysis } from './change-analyzer';

/**
 * 学习路径节点类型
 */
export enum LearningNodeType {
  ENTRY = 'entry',           // 入口文件
  CORE = 'core',            // 核心模块
  UTILITY = 'utility',      // 工具模块
  CONFIG = 'config',        // 配置文件
  EXAMPLE = 'example',      // 示例文件
  TEST = 'test'             // 测试文件
}

/**
 * 学习路径节点
 */
export interface LearningNode {
  file: string;
  type: LearningNodeType;
  description: string;
  priority: number;
  dependencies: string[];
  complexity?: number;
  docCoverage?: number;
  changeFrequency?: number;
  prerequisites: string[];
  learningPoints: string[];
}

/**
 * 学习路径
 */
export interface LearningPath {
  nodes: LearningNode[];
  stages: {
    name: string;
    description: string;
    files: string[];
    estimatedTime: string;
  }[];
  recommendations: {
    file: string;
    reason: string;
  }[];
}

/**
 * 学习路径生成器类
 */
export class LearningPathGenerator {
  constructor(
    private graph: DependencyGraph,
    private complexityMetrics?: Map<string, FileComplexity>,
    private commentAnalyses?: Map<string, CommentAnalysis>,
    private changeAnalysis?: ChangeAnalysis
  ) { }

  /**
   * 生成学习路径
   */
  generate(): LearningPath {
    const nodes = this.analyzeFiles();
    const stages = this.generateStages(nodes);
    const recommendations = this.generateRecommendations(nodes);

    return {
      nodes,
      stages,
      recommendations
    };
  }

  /**
   * 分析文件并生成学习节点
   */
  private analyzeFiles(): LearningNode[] {
    const nodes: LearningNode[] = [];

    for (const [file, node] of this.graph.nodes) {
      const type = this.determineFileType(file);
      const complexity = this.complexityMetrics?.get(file)?.metrics.cyclomaticComplexity;
      const docCoverage = this.commentAnalyses?.get(file)?.coverage.ratio;
      const changeFrequency = this.calculateChangeFrequency(file);

      nodes.push({
        file,
        type,
        description: this.generateDescription(file, node),
        priority: this.calculatePriority(type, complexity, docCoverage, changeFrequency),
        dependencies: Array.from(node.dependencies),
        complexity,
        docCoverage,
        changeFrequency,
        prerequisites: this.determinePrerequisites(file, node),
        learningPoints: this.extractLearningPoints(file)
      });
    }

    return this.sortByLearningOrder(nodes);
  }

  /**
   * 确定文件类型
   */
  private determineFileType(file: string): LearningNodeType {
    if (file.includes('index.ts')) {
      return LearningNodeType.ENTRY;
    }
    if (file.includes('/core/')) {
      return LearningNodeType.CORE;
    }
    if (file.includes('/utils/') || file.includes('/helpers/')) {
      return LearningNodeType.UTILITY;
    }
    if (file.includes('.config.') || file.includes('/config/')) {
      return LearningNodeType.CONFIG;
    }
    if (file.includes('/examples/') || file.includes('.example.')) {
      return LearningNodeType.EXAMPLE;
    }
    if (file.includes('.test.') || file.includes('.spec.')) {
      return LearningNodeType.TEST;
    }
    return LearningNodeType.UTILITY;
  }

  /**
   * 生成文件描述
   */
  private generateDescription(file: string, node: any): string {
    const exports = node.exports || [];
    const type = this.determineFileType(file);

    switch (type) {
      case LearningNodeType.ENTRY:
        return `项目入口文件，导出主要功能：${exports.join(', ')}`;
      case LearningNodeType.CORE:
        return `核心模块，实现关键功能：${exports.join(', ')}`;
      case LearningNodeType.UTILITY:
        return `工具模块，提供辅助功能：${exports.join(', ')}`;
      case LearningNodeType.CONFIG:
        return '项目配置文件，定义关键配置项';
      case LearningNodeType.EXAMPLE:
        return '示例文件，展示功能使用方法';
      case LearningNodeType.TEST:
        return '测试文件，验证功能正确性';
      default:
        return `模块导出：${exports.join(', ')}`;
    }
  }

  /**
   * 计算学习优先级
   */
  private calculatePriority(
    type: LearningNodeType,
    complexity?: number,
    docCoverage?: number,
    changeFrequency?: number
  ): number {
    let priority = 0;

    // 基于文件类型的基础优先级
    switch (type) {
      case LearningNodeType.ENTRY:
        priority += 100;
        break;
      case LearningNodeType.CORE:
        priority += 80;
        break;
      case LearningNodeType.CONFIG:
        priority += 70;
        break;
      case LearningNodeType.UTILITY:
        priority += 60;
        break;
      case LearningNodeType.EXAMPLE:
        priority += 50;
        break;
      case LearningNodeType.TEST:
        priority += 40;
        break;
    }

    // 根据复杂度调整优先级
    if (complexity) {
      if (complexity > 20) priority -= 20;
      else if (complexity > 10) priority -= 10;
    }

    // 根据文档覆盖率调整优先级
    if (docCoverage) {
      if (docCoverage > 0.8) priority += 10;
      else if (docCoverage < 0.3) priority -= 10;
    }

    // 根据变更频率调整优先级
    if (changeFrequency) {
      if (changeFrequency > 0.8) priority += 10;
      else if (changeFrequency < 0.2) priority -= 5;
    }

    return Math.max(0, Math.min(100, priority));
  }

  /**
   * 确定学习前置条件
   */
  private determinePrerequisites(file: string, node: any): string[] {
    const prerequisites: string[] = [];
    const type = this.determineFileType(file);

    // 添加直接依赖
    prerequisites.push(...Array.from(node.dependencies));

    // 根据文件类型添加建议的前置知识
    switch (type) {
      case LearningNodeType.CORE:
        if (!prerequisites.some(p => p.includes('/utils/'))) {
          const utils = Array.from(this.graph.nodes.keys())
            .filter(f => f.includes('/utils/'));
          prerequisites.push(...utils);
        }
        break;
      case LearningNodeType.TEST:
        const testedFile = file.replace('.test.', '.');
        if (this.graph.nodes.has(testedFile)) {
          prerequisites.push(testedFile);
        }
        break;
    }

    return [...new Set(prerequisites)];
  }

  /**
   * 提取学习要点
   */
  private extractLearningPoints(file: string): string[] {
    const points: string[] = [];
    const analysis = this.commentAnalyses?.get(file);

    if (analysis) {
      // 从文档注释中提取学习要点
      analysis.docComments.forEach(comment => {
        if (comment.content.includes('@example') ||
          comment.content.includes('@description') ||
          comment.content.includes('@summary')) {
          points.push(comment.content.trim());
        }
      });

      // 添加重要注释
      analysis.importantNotes.forEach(note => {
        points.push(note.content.trim());
      });
    }

    // 根据文件类型添加默认学习要点
    const type = this.determineFileType(file);
    switch (type) {
      case LearningNodeType.ENTRY:
        points.push('理解项目整体结构和主要功能');
        points.push('掌握模块导出和使用方式');
        break;
      case LearningNodeType.CORE:
        points.push('深入理解核心功能实现');
        points.push('掌握关键算法和数据结构');
        break;
      case LearningNodeType.UTILITY:
        points.push('学习常用工具函数的实现');
        points.push('理解代码复用和模块化设计');
        break;
    }

    return [...new Set(points)];
  }

  /**
   * 计算文件变更频率
   */
  private calculateChangeFrequency(file: string): number {
    if (!this.changeAnalysis) return 0;

    const fileChanges = this.changeAnalysis.files.find(f => f.filePath === file);
    if (!fileChanges) return 0;

    const maxChanges = Math.max(...this.changeAnalysis.files.map(f => f.changes));
    return fileChanges.changes / maxChanges;
  }

  /**
   * 按学习顺序排序节点
   */
  private sortByLearningOrder(nodes: LearningNode[]): LearningNode[] {
    const visited = new Set<string>();
    const sorted: LearningNode[] = [];

    // 定义递归访问函数
    const visit = (node: LearningNode) => {
      if (visited.has(node.file)) return;
      visited.add(node.file);

      // 先访问所有依赖
      node.prerequisites.forEach(dep => {
        const depNode = nodes.find(n => n.file === dep);
        if (depNode) visit(depNode);
      });

      sorted.push(node);
    };

    // 按优先级排序，优先访问高优先级节点
    const prioritized = [...nodes].sort((a, b) => b.priority - a.priority);
    prioritized.forEach(node => visit(node));

    return sorted;
  }

  /**
   * 生成学习阶段
   */
  private generateStages(nodes: LearningNode[]): { name: string; description: string; files: string[]; estimatedTime: string; }[] {
    return [
      {
        name: '项目概览',
        description: '了解项目结构和主要功能',
        files: nodes.filter(n => n.type === LearningNodeType.ENTRY).map(n => n.file),
        estimatedTime: '1-2小时'
      },
      {
        name: '基础工具',
        description: '学习常用工具和辅助函数',
        files: nodes.filter(n => n.type === LearningNodeType.UTILITY).map(n => n.file),
        estimatedTime: '2-3小时'
      },
      {
        name: '核心功能',
        description: '深入理解核心模块实现',
        files: nodes.filter(n => n.type === LearningNodeType.CORE).map(n => n.file),
        estimatedTime: '4-6小时'
      },
      {
        name: '配置系统',
        description: '学习项目配置和定制方式',
        files: nodes.filter(n => n.type === LearningNodeType.CONFIG).map(n => n.file),
        estimatedTime: '1-2小时'
      },
      {
        name: '实战练习',
        description: '通过示例掌握功能使用',
        files: nodes.filter(n => n.type === LearningNodeType.EXAMPLE).map(n => n.file),
        estimatedTime: '3-4小时'
      },
      {
        name: '测试用例',
        description: '学习测试方法和最佳实践',
        files: nodes.filter(n => n.type === LearningNodeType.TEST).map(n => n.file),
        estimatedTime: '2-3小时'
      }
    ];
  }

  /**
   * 生成学习建议
   */
  private generateRecommendations(nodes: LearningNode[]): { file: string; reason: string; }[] {
    const recommendations: { file: string; reason: string; }[] = [];

    // 推荐文档完善的文件
    nodes.forEach(node => {
      if (node.docCoverage && node.docCoverage > 0.8) {
        recommendations.push({
          file: node.file,
          reason: '文档完善，适合入门学习'
        });
      }
    });

    // 推荐核心但不太复杂的文件
    nodes.forEach(node => {
      if (node.type === LearningNodeType.CORE && node.complexity && node.complexity < 15) {
        recommendations.push({
          file: node.file,
          reason: '核心功能，复杂度适中'
        });
      }
    });

    // 推荐示例文件
    nodes.filter(n => n.type === LearningNodeType.EXAMPLE)
      .forEach(node => {
        recommendations.push({
          file: node.file,
          reason: '包含实际使用示例'
        });
      });

    return recommendations;
  }
} 