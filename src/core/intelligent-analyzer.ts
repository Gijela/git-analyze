import * as fs from 'fs';
import { promisify } from 'util';
import { glob } from 'glob';
import { parse } from '@typescript-eslint/parser';
import { AST_NODE_TYPES } from '@typescript-eslint/types';

const readFile = promisify(fs.readFile);

// 修改 AST 节点类型检查
const isNumericLiteral = (node: any) =>
  node.type === AST_NODE_TYPES.Literal && typeof node.value === 'number';

const isClassProperty = (node: any) =>
  node.type === AST_NODE_TYPES.PropertyDefinition;

/**
 * 代码模式类型
 */
export enum CodePatternType {
  DESIGN_PATTERN = 'design_pattern',
  CODE_SMELL = 'code_smell',
  BEST_PRACTICE = 'best_practice',
  REFACTORING = 'refactoring',
  ARCHITECTURE = 'architecture'
}

/**
 * 代码模式接口
 */
export interface CodePattern {
  type: CodePatternType;
  name: string;
  description: string;
  file: string;
  line?: number;
  code?: string;
  confidence: number;
  suggestion: string;
}

/**
 * 智能分析结果
 */
export interface IntelligentAnalysis {
  patterns: CodePattern[];
  summary: {
    totalPatterns: number;
    designPatterns: number;
    codeSmells: number;
    bestPractices: number;
    refactorings: number;
    architecturePatterns: number;
  };
  recommendations: {
    type: string;
    description: string;
    priority: number;
    effort: string;
  }[];
}

/**
 * 智能代码分析器类
 */
export class IntelligentAnalyzer {
  /**
   * 分析文件中的代码模式
   */
  async analyzeFile(filePath: string): Promise<CodePattern[]> {
    const content = await readFile(filePath, 'utf-8');
    const patterns: CodePattern[] = [];

    try {
      // 解析代码为AST
      const ast = parse(content, {
        sourceType: 'module',
        ecmaVersion: 2020,
        loc: true
      });

      // 识别设计模式
      this.detectDesignPatterns(ast, filePath, patterns);

      // 识别代码气味
      this.detectCodeSmells(ast, filePath, patterns);

      // 识别最佳实践
      this.detectBestPractices(ast, filePath, patterns);

      // 识别重构机会
      this.detectRefactoringOpportunities(ast, filePath, patterns);

      // 识别架构模式
      this.detectArchitecturePatterns(ast, filePath, patterns);

    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error);
    }

    return patterns;
  }

  /**
   * 分析目录中的所有文件
   */
  async analyzeDirectory(dirPath: string): Promise<IntelligentAnalysis> {
    const files = await glob('**/*.{js,ts}', {
      cwd: dirPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
      absolute: true
    });

    const allPatterns: CodePattern[] = [];
    for (const file of files) {
      try {
        const patterns = await this.analyzeFile(file);
        allPatterns.push(...patterns);
      } catch (error) {
        console.error(`Error analyzing file ${file}:`, error);
      }
    }

    // 生成分析结果
    const analysis: IntelligentAnalysis = {
      patterns: allPatterns,
      summary: this.generateSummary(allPatterns),
      recommendations: this.generateRecommendations(allPatterns)
    };

    return analysis;
  }

  /**
   * 识别设计模式
   */
  private detectDesignPatterns(ast: any, filePath: string, patterns: CodePattern[]): void {
    const visit = (node: any) => {
      // 识别单例模式
      if (node.type === AST_NODE_TYPES.ClassDeclaration) {
        const isSingleton = this.detectSingletonPattern(node);
        if (isSingleton) {
          patterns.push({
            type: CodePatternType.DESIGN_PATTERN,
            name: 'Singleton',
            description: '发现单例模式实现',
            file: filePath,
            line: node.loc?.start.line,
            confidence: 0.9,
            suggestion: '确保单例模式的使用是必要的，考虑依赖注入等替代方案'
          });
        }
      }

      // 识别工厂模式
      if (node.type === AST_NODE_TYPES.MethodDefinition &&
        node.static &&
        node.key.name?.toLowerCase().includes('create')) {
        patterns.push({
          type: CodePatternType.DESIGN_PATTERN,
          name: 'Factory Method',
          description: '发现工厂方法模式',
          file: filePath,
          line: node.loc?.start.line,
          confidence: 0.8,
          suggestion: '工厂方法有助于解耦对象创建，但要注意避免过度使用'
        });
      }

      // 识别观察者模式
      if (this.detectObserverPattern(node)) {
        patterns.push({
          type: CodePatternType.DESIGN_PATTERN,
          name: 'Observer',
          description: '发现观察者模式实现',
          file: filePath,
          line: node.loc?.start.line,
          confidence: 0.85,
          suggestion: '观察者模式适用于事件处理，但要注意内存泄漏问题'
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
   * 识别代码气味
   */
  private detectCodeSmells(ast: any, filePath: string, patterns: CodePattern[]): void {
    const visit = (node: any) => {
      // 检查长方法
      if (node.type === AST_NODE_TYPES.FunctionDeclaration ||
        node.type === AST_NODE_TYPES.MethodDefinition) {
        const bodyLength = node.body?.body?.length || 0;
        if (bodyLength > 30) {
          patterns.push({
            type: CodePatternType.CODE_SMELL,
            name: 'Long Method',
            description: `方法过长(${bodyLength}行)`,
            file: filePath,
            line: node.loc?.start.line,
            confidence: 0.9,
            suggestion: '建议将长方法拆分为多个小方法，每个方法专注于单一职责'
          });
        }
      }

      // 检查大类
      if (node.type === AST_NODE_TYPES.ClassDeclaration) {
        const methodCount = node.body.body.filter(
          (m: any) => m.type === AST_NODE_TYPES.MethodDefinition
        ).length;
        if (methodCount > 20) {
          patterns.push({
            type: CodePatternType.CODE_SMELL,
            name: 'Large Class',
            description: `类方法过多(${methodCount}个)`,
            file: filePath,
            line: node.loc?.start.line,
            confidence: 0.85,
            suggestion: '建议将大类拆分为多个小类，每个类专注于特定功能'
          });
        }
      }

      // 检查过多参数
      if (node.type === AST_NODE_TYPES.FunctionDeclaration ||
        node.type === AST_NODE_TYPES.ArrowFunctionExpression) {
        if (node.params?.length > 5) {
          patterns.push({
            type: CodePatternType.CODE_SMELL,
            name: 'Long Parameter List',
            description: `参数过多(${node.params.length}个)`,
            file: filePath,
            line: node.loc?.start.line,
            confidence: 0.9,
            suggestion: '建议使用对象参数或builder模式减少参数数量'
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
   * 识别最佳实践
   */
  private detectBestPractices(ast: any, filePath: string, patterns: CodePattern[]): void {
    const visit = (node: any) => {
      // 检查异常处理
      if (node.type === AST_NODE_TYPES.TryStatement) {
        if (!node.finalizer) {
          patterns.push({
            type: CodePatternType.BEST_PRACTICE,
            name: 'Missing Finally Block',
            description: '缺少finally块进行资源清理',
            file: filePath,
            line: node.loc?.start.line,
            confidence: 0.7,
            suggestion: '建议添加finally块确保资源正确释放'
          });
        }
      }

      // 检查魔法数字
      if (isNumericLiteral(node) &&
        !node.parent?.type?.includes('Variable')) {
        patterns.push({
          type: CodePatternType.BEST_PRACTICE,
          name: 'Magic Number',
          description: `发现魔法数字: ${node.value}`,
          file: filePath,
          line: node.loc?.start.line,
          confidence: 0.6,
          suggestion: '建议将魔法数字提取为命名常量'
        });
      }

      // 检查注释完整性
      if (node.type === AST_NODE_TYPES.FunctionDeclaration ||
        node.type === AST_NODE_TYPES.ClassDeclaration) {
        if (!node.leadingComments?.length) {
          patterns.push({
            type: CodePatternType.BEST_PRACTICE,
            name: 'Missing Documentation',
            description: '缺少文档注释',
            file: filePath,
            line: node.loc?.start.line,
            confidence: 0.8,
            suggestion: '建议添加JSDoc文档注释说明功能和参数'
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
   * 识别重构机会
   */
  private detectRefactoringOpportunities(ast: any, filePath: string, patterns: CodePattern[]): void {
    const visit = (node: any) => {
      // 检查重复代码
      if (node.type === AST_NODE_TYPES.BlockStatement) {
        const duplicates = this.findDuplicateCode(node);
        if (duplicates.length > 0) {
          patterns.push({
            type: CodePatternType.REFACTORING,
            name: 'Duplicate Code',
            description: `发现${duplicates.length}处重复代码`,
            file: filePath,
            line: node.loc?.start.line,
            confidence: 0.8,
            suggestion: '建议提取重复代码为独立函数'
          });
        }
      }

      // 检查过度耦合
      if (node.type === AST_NODE_TYPES.ClassDeclaration) {
        const coupling = this.calculateCoupling(node);
        if (coupling > 5) {
          patterns.push({
            type: CodePatternType.REFACTORING,
            name: 'High Coupling',
            description: `类耦合度过高(${coupling})`,
            file: filePath,
            line: node.loc?.start.line,
            confidence: 0.75,
            suggestion: '建议使用依赖注入或接口减少耦合'
          });
        }
      }

      // 检查条件复杂度
      if (node.type === AST_NODE_TYPES.IfStatement) {
        const complexity = this.calculateConditionComplexity(node);
        if (complexity > 3) {
          patterns.push({
            type: CodePatternType.REFACTORING,
            name: 'Complex Condition',
            description: `条件判断过于复杂(${complexity}层)`,
            file: filePath,
            line: node.loc?.start.line,
            confidence: 0.85,
            suggestion: '建议提取复杂条件为独立函数或使用策略模式'
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
   * 识别架构模式
   */
  private detectArchitecturePatterns(ast: any, filePath: string, patterns: CodePattern[]): void {
    // 识别MVC模式
    if (filePath.includes('/controllers/') ||
      filePath.includes('/models/') ||
      filePath.includes('/views/')) {
      patterns.push({
        type: CodePatternType.ARCHITECTURE,
        name: 'MVC Pattern',
        description: '使用MVC架构模式',
        file: filePath,
        confidence: 0.9,
        suggestion: 'MVC模式有助于分离关注点，但要注意控制器不要过于臃肿'
      });
    }

    // 识别分层架构
    if (filePath.includes('/core/') ||
      filePath.includes('/infrastructure/') ||
      filePath.includes('/application/')) {
      patterns.push({
        type: CodePatternType.ARCHITECTURE,
        name: 'Layered Architecture',
        description: '使用分层架构模式',
        file: filePath,
        confidence: 0.85,
        suggestion: '分层架构有助于关注点分离，但要注意避免层间耦合'
      });
    }

    // 识别微服务架构
    if (filePath.includes('/services/') ||
      filePath.includes('/api/')) {
      patterns.push({
        type: CodePatternType.ARCHITECTURE,
        name: 'Microservices',
        description: '可能使用微服务架构',
        file: filePath,
        confidence: 0.7,
        suggestion: '微服务架构提高了系统可扩展性，但要注意服务间通信成本'
      });
    }
  }

  /**
   * 检测单例模式
   */
  private detectSingletonPattern(node: any): boolean {
    // 检查是否有私有构造函数
    const hasPrivateConstructor = node.body.body.some((member: any) =>
      member.type === AST_NODE_TYPES.MethodDefinition &&
      member.kind === 'constructor' &&
      member.accessibility === 'private'
    );

    // 检查是否有静态实例属性
    const hasStaticInstance = node.body.body.some((member: any) =>
      isClassProperty(member) &&
      member.static &&
      member.key.name?.includes('instance')
    );

    // 检查是否有获取实例的静态方法
    const hasGetInstanceMethod = node.body.body.some((member: any) =>
      member.type === AST_NODE_TYPES.MethodDefinition &&
      member.static &&
      member.key.name?.includes('getInstance')
    );

    return hasPrivateConstructor && (hasStaticInstance || hasGetInstanceMethod);
  }

  /**
   * 检测观察者模式
   */
  private detectObserverPattern(node: any): boolean {
    // 检查是否有观察者列表
    const hasObservers = node.body?.body?.some((member: any) =>
      isClassProperty(member) &&
      (member.key.name?.includes('observers') ||
        member.key.name?.includes('listeners'))
    );

    // 检查是否有添加/删除观察者的方法
    const hasObserverMethods = node.body?.body?.some((member: any) =>
      member.type === AST_NODE_TYPES.MethodDefinition &&
      (member.key.name?.includes('add') || member.key.name?.includes('remove')) &&
      (member.key.name?.includes('Observer') || member.key.name?.includes('Listener'))
    );

    // 检查是否有通知方法
    const hasNotifyMethod = node.body?.body?.some((member: any) =>
      member.type === AST_NODE_TYPES.MethodDefinition &&
      (member.key.name?.includes('notify') || member.key.name?.includes('emit'))
    );

    return hasObservers && hasObserverMethods && hasNotifyMethod;
  }

  /**
   * 查找重复代码
   */
  private findDuplicateCode(node: any): any[] {
    const duplicates: any[] = [];
    const codeBlocks = new Map<string, any>();

    const visit = (node: any) => {
      if (node.type === AST_NODE_TYPES.BlockStatement) {
        const code = JSON.stringify(node);
        if (codeBlocks.has(code)) {
          duplicates.push({
            original: codeBlocks.get(code),
            duplicate: node
          });
        } else {
          codeBlocks.set(code, node);
        }
      }

      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          visit(node[key]);
        }
      }
    };

    visit(node);
    return duplicates;
  }

  /**
   * 计算耦合度
   */
  private calculateCoupling(node: any): number {
    const dependencies = new Set<string>();

    const visit = (node: any) => {
      if (node.type === AST_NODE_TYPES.ImportDeclaration) {
        dependencies.add(node.source.value);
      }
      if (node.type === AST_NODE_TYPES.Identifier) {
        dependencies.add(node.name);
      }

      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          visit(node[key]);
        }
      }
    };

    visit(node);
    return dependencies.size;
  }

  /**
   * 计算条件复杂度
   */
  private calculateConditionComplexity(node: any): number {
    let complexity = 1;

    const visit = (node: any) => {
      if (node.type === AST_NODE_TYPES.LogicalExpression) {
        complexity++;
      }
      if (node.type === AST_NODE_TYPES.ConditionalExpression) {
        complexity++;
      }

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
   * 生成分析概要
   */
  private generateSummary(patterns: CodePattern[]): {
    totalPatterns: number;
    designPatterns: number;
    codeSmells: number;
    bestPractices: number;
    refactorings: number;
    architecturePatterns: number;
  } {
    return {
      totalPatterns: patterns.length,
      designPatterns: patterns.filter(p => p.type === CodePatternType.DESIGN_PATTERN).length,
      codeSmells: patterns.filter(p => p.type === CodePatternType.CODE_SMELL).length,
      bestPractices: patterns.filter(p => p.type === CodePatternType.BEST_PRACTICE).length,
      refactorings: patterns.filter(p => p.type === CodePatternType.REFACTORING).length,
      architecturePatterns: patterns.filter(p => p.type === CodePatternType.ARCHITECTURE).length
    };
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(patterns: CodePattern[]): {
    type: string;
    description: string;
    priority: number;
    effort: string;
  }[] {
    const recommendations: {
      type: string;
      description: string;
      priority: number;
      effort: string;
    }[] = [];

    // 按类型分组
    const patternsByType = patterns.reduce((acc, pattern) => {
      acc[pattern.type] = (acc[pattern.type] || []).concat(pattern);
      return acc;
    }, {} as Record<string, CodePattern[]>);

    // 生成设计模式建议
    if (patternsByType[CodePatternType.DESIGN_PATTERN]) {
      const patterns = patternsByType[CodePatternType.DESIGN_PATTERN];
      recommendations.push({
        type: 'Design Patterns',
        description: `发现${patterns.length}个设计模式，建议审查其使用是否合理`,
        priority: 2,
        effort: 'Medium'
      });
    }

    // 生成代码气味建议
    if (patternsByType[CodePatternType.CODE_SMELL]) {
      const smells = patternsByType[CodePatternType.CODE_SMELL];
      recommendations.push({
        type: 'Code Smells',
        description: `发现${smells.length}个代码气味，需要进行重构`,
        priority: 1,
        effort: 'High'
      });
    }

    // 生成最佳实践建议
    if (patternsByType[CodePatternType.BEST_PRACTICE]) {
      const practices = patternsByType[CodePatternType.BEST_PRACTICE];
      recommendations.push({
        type: 'Best Practices',
        description: `有${practices.length}处违反最佳实践，建议改进`,
        priority: 1,
        effort: 'Medium'
      });
    }

    // 生成重构建议
    if (patternsByType[CodePatternType.REFACTORING]) {
      const refactorings = patternsByType[CodePatternType.REFACTORING];
      recommendations.push({
        type: 'Refactoring',
        description: `发现${refactorings.length}处需要重构的代码`,
        priority: 1,
        effort: 'High'
      });
    }

    // 生成架构建议
    if (patternsByType[CodePatternType.ARCHITECTURE]) {
      const architectures = patternsByType[CodePatternType.ARCHITECTURE];
      recommendations.push({
        type: 'Architecture',
        description: `识别出${architectures.length}种架构模式，建议确保一致性`,
        priority: 3,
        effort: 'High'
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }
} 