import {
  QUALITY_THRESHOLD,
  COMPLEXITY_THRESHOLD,
  DUPLICATION_THRESHOLD,
  MAINTAINABILITY_CONSTANTS,
  ANALYZER_CONSTANTS,
  ERROR_PENALTIES,
  PERFORMANCE_PENALTIES
} from './constants';

/**
 * 代码质量指标接口
 */
export interface QualityMetrics {
  maintainability: number;
  reliability: number;
  security: number;
  efficiency: number;
  reusability: number;
  testability: number;
  documentation: number;
}

/**
 * 代码气味接口
 */
export interface CodeSmell {
  type: string;
  severity: 'high' | 'medium' | 'low';
  location: {
    file: string;
    line: number;
  };
  message: string;
  suggestion: string;
}

/**
 * 重复代码接口
 */
export interface DuplicateCode {
  sourceFile: string;
  targetFile: string;
  sourceLines: number[];
  targetLines: number[];
  similarity: number;
}

/**
 * 代码质量分析器类
 */
export class QualityAnalyzer {
  private readonly filePath: string;
  private readonly fileContent: string;

  constructor(filePath: string, fileContent: string) {
    this.filePath = filePath;
    this.fileContent = fileContent;
  }

  /**
   * 分析代码质量
   */
  public analyze(): {
    metrics: QualityMetrics;
    smells: CodeSmell[];
    duplicates: DuplicateCode[];
    suggestions: string[];
  } {
    const metrics = this.calculateMetrics();
    const smells = this.detectCodeSmells();
    const duplicates = this.findDuplicateCode();
    const suggestions = this.generateSuggestions(metrics, smells);

    return {
      metrics,
      smells,
      duplicates,
      suggestions
    };
  }

  /**
   * 计算代码质量指标
   */
  private calculateMetrics(): QualityMetrics {
    return {
      maintainability: this.calculateMaintainabilityIndex(),
      reliability: this.calculateReliabilityIndex(),
      security: this.calculateSecurityIndex(),
      efficiency: this.calculateEfficiencyIndex(),
      reusability: this.calculateReusabilityIndex(),
      testability: this.calculateTestabilityIndex(),
      documentation: this.calculateDocumentationIndex()
    };
  }

  /**
   * 计算可维护性指数
   */
  private calculateMaintainabilityIndex(): number {
    const { BASE_VALUE, VOLUME_WEIGHT, COMPLEXITY_WEIGHT, LOC_WEIGHT, NORMALIZATION_FACTOR } = MAINTAINABILITY_CONSTANTS;
    const volume = this.calculateHalsteadVolume();
    const complexity = this.calculateCyclomaticComplexity();
    const loc = this.countLinesOfCode();

    let index = BASE_VALUE - VOLUME_WEIGHT * Math.log(volume) -
      COMPLEXITY_WEIGHT * complexity - LOC_WEIGHT * Math.log(loc);

    // 归一化到0-100范围
    index = Math.max(0, Math.min(100, (index / NORMALIZATION_FACTOR) * 100));

    return index;
  }

  /**
   * 计算可靠性指数
   */
  private calculateReliabilityIndex(): number {
    let score = ANALYZER_CONSTANTS.DEFAULT_SCORE;

    // 检查错误处理
    if (!this.hasErrorHandling()) {
      score -= ERROR_PENALTIES.MISSING_ERROR_HANDLING;
    }

    // 检查空值检查
    if (!this.hasNullChecks()) {
      score -= ERROR_PENALTIES.MISSING_NULL_CHECK;
    }

    // 检查边界检查
    if (!this.hasBoundaryChecks()) {
      score -= ERROR_PENALTIES.MISSING_BOUNDARY_CHECK;
    }

    return Math.max(ANALYZER_CONSTANTS.MIN_SCORE, score);
  }

  /**
   * 计算安全性指数
   */
  private calculateSecurityIndex(): number {
    let score = ANALYZER_CONSTANTS.DEFAULT_SCORE;
    const { EVAL_USAGE, INNER_HTML, SENSITIVE_DATA, INSECURE_PROTOCOL } = ERROR_PENALTIES.SECURITY_ISSUES;

    // 检查eval使用
    if (this.fileContent.includes('eval(')) {
      score -= EVAL_USAGE;
    }

    // 检查innerHTML使用
    if (this.fileContent.includes('innerHTML')) {
      score -= INNER_HTML;
    }

    // 检查敏感数据
    if (this.hasSensitiveData()) {
      score -= SENSITIVE_DATA;
    }

    // 检查不安全的协议
    if (this.hasInsecureProtocol()) {
      score -= INSECURE_PROTOCOL;
    }

    return Math.max(ANALYZER_CONSTANTS.MIN_SCORE, score);
  }

  /**
   * 计算效率指数
   */
  private calculateEfficiencyIndex(): number {
    let score = ANALYZER_CONSTANTS.DEFAULT_SCORE;

    // 检查嵌套循环
    if (this.hasNestedLoops()) {
      score -= PERFORMANCE_PENALTIES.NESTED_LOOPS;
    }

    // 检查字符串拼接
    if (this.hasStringConcatenation()) {
      score -= PERFORMANCE_PENALTIES.STRING_CONCATENATION;
    }

    // 检查多次遍历
    if (this.hasMultipleIterations()) {
      score -= PERFORMANCE_PENALTIES.MULTIPLE_ITERATIONS;
    }

    return Math.max(ANALYZER_CONSTANTS.MIN_SCORE, score);
  }

  /**
   * 计算可重用性指数
   */
  private calculateReusabilityIndex(): number {
    const methodCount = this.countMethods();
    const avgMethodLength = this.calculateAverageMethodLength();
    const avgParameters = this.calculateAverageParameters();

    let score = ANALYZER_CONSTANTS.DEFAULT_SCORE;

    // 根据方法数量评分
    if (methodCount > COMPLEXITY_THRESHOLD.CLASS_SIZE.POOR) {
      score -= 30;
    } else if (methodCount > COMPLEXITY_THRESHOLD.CLASS_SIZE.ACCEPTABLE) {
      score -= 15;
    }

    // 根据平均方法长度评分
    if (avgMethodLength > COMPLEXITY_THRESHOLD.METHOD_LENGTH.POOR) {
      score -= 30;
    } else if (avgMethodLength > COMPLEXITY_THRESHOLD.METHOD_LENGTH.ACCEPTABLE) {
      score -= 15;
    }

    // 根据平均参数数量评分
    if (avgParameters > COMPLEXITY_THRESHOLD.PARAMETER_COUNT.POOR) {
      score -= 30;
    } else if (avgParameters > COMPLEXITY_THRESHOLD.PARAMETER_COUNT.ACCEPTABLE) {
      score -= 15;
    }

    return Math.max(ANALYZER_CONSTANTS.MIN_SCORE, score);
  }

  /**
   * 计算可测试性指数
   */
  private calculateTestabilityIndex(): number {
    const complexity = this.calculateCyclomaticComplexity();
    const dependencies = this.countDependencies();

    let score = ANALYZER_CONSTANTS.DEFAULT_SCORE;

    // 根据圈复杂度评分
    if (complexity > COMPLEXITY_THRESHOLD.CYCLOMATIC.POOR) {
      score -= 30;
    } else if (complexity > COMPLEXITY_THRESHOLD.CYCLOMATIC.ACCEPTABLE) {
      score -= 15;
    }

    // 根据依赖数量评分
    if (dependencies > 10) {
      score -= 30;
    } else if (dependencies > 5) {
      score -= 15;
    }

    return Math.max(ANALYZER_CONSTANTS.MIN_SCORE, score);
  }

  /**
   * 计算文档完整性指数
   */
  private calculateDocumentationIndex(): number {
    const lines = this.fileContent.split('\n');
    let commentLines = 0;
    let totalLines = lines.length;

    for (const line of lines) {
      if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
        commentLines++;
      }
    }

    const ratio = (commentLines / totalLines) * ANALYZER_CONSTANTS.PERCENTAGE;
    return Math.min(ratio * 2, ANALYZER_CONSTANTS.MAX_SCORE);
  }

  /**
   * 检测代码气味
   */
  private detectCodeSmells(): CodeSmell[] {
    const smells: CodeSmell[] = [];

    // 检测长方法
    this.detectLongMethods(smells);

    // 检测大类
    this.detectLargeClasses(smells);

    // 检测过多参数
    this.detectTooManyParameters(smells);

    // 检测复杂条件
    this.detectComplexConditions(smells);

    // 检测魔法数字
    this.detectMagicNumbers(smells);

    return smells;
  }

  /**
   * 查找重复代码
   */
  private findDuplicateCode(): DuplicateCode[] {
    // TODO: 实现重复代码检测逻辑
    return [];
  }

  /**
   * 生成改进建议
   */
  private generateSuggestions(metrics: QualityMetrics, smells: CodeSmell[]): string[] {
    const suggestions: string[] = [];

    // 根据指标生成建议
    this.generateMetricSuggestions(metrics, suggestions);

    // 根据代码气味生成建议
    this.generateSmellSuggestions(smells, suggestions);

    return suggestions;
  }

  // 辅助方法
  private calculateHalsteadVolume(): number {
    // TODO: 实现Halstead体积计算
    return 100;
  }

  private calculateCyclomaticComplexity(): number {
    let complexity = 1;
    const content = this.fileContent;

    // 计算条件语句
    complexity += (content.match(/if|else if|case|catch|&&|\|\|/g) || []).length;

    // 计算循环
    complexity += (content.match(/for|while|do/g) || []).length;

    return complexity;
  }

  private countLinesOfCode(): number {
    return this.fileContent.split('\n').filter(line => line.trim().length > 0).length;
  }

  private countMethods(): number {
    const methodMatches = this.fileContent.match(/function\s+\w+\s*\(|^\s*\w+\s*\([^)]*\)\s*{/gm);
    return methodMatches ? methodMatches.length : 0;
  }

  private calculateAverageMethodLength(): number {
    // TODO: 实现平均方法长度计算
    return 20;
  }

  private calculateAverageParameters(): number {
    // TODO: 实现平均参数数量计算
    return 3;
  }

  private countDependencies(): number {
    const importMatches = this.fileContent.match(/import\s+.*\s+from/g);
    return importMatches ? importMatches.length : 0;
  }

  private hasErrorHandling(): boolean {
    return this.fileContent.includes('try') && this.fileContent.includes('catch');
  }

  private hasNullChecks(): boolean {
    return this.fileContent.includes('=== null') || this.fileContent.includes('!== null');
  }

  private hasBoundaryChecks(): boolean {
    return this.fileContent.includes('length') && (this.fileContent.includes('>') || this.fileContent.includes('<'));
  }

  private hasSensitiveData(): boolean {
    return this.fileContent.includes('password') || this.fileContent.includes('token') || this.fileContent.includes('secret');
  }

  private hasInsecureProtocol(): boolean {
    return this.fileContent.includes('http://') && !this.fileContent.includes('https://');
  }

  private hasNestedLoops(): boolean {
    const content = this.fileContent;
    let depth = 0;
    let maxDepth = 0;

    for (let i = 0; i < content.length; i++) {
      if (content.substr(i).match(/^(for|while|do)/)) {
        depth++;
        maxDepth = Math.max(maxDepth, depth);
      } else if (content[i] === '}') {
        depth = Math.max(0, depth - 1);
      }
    }

    return maxDepth > 1;
  }

  private hasStringConcatenation(): boolean {
    const hasPlus = this.fileContent.includes('+');
    const hasSingleQuote = this.fileContent.includes('\'');
    const hasDoubleQuote = this.fileContent.includes('"');
    return hasPlus && (hasSingleQuote || hasDoubleQuote);
  }

  private hasMultipleIterations(): boolean {
    const iterationMatches = this.fileContent.match(/for|while|forEach|map|filter|reduce/g);
    const iterationCount = iterationMatches ? iterationMatches.length : 0;
    return iterationCount > 2;
  }

  private detectLongMethods(smells: CodeSmell[]): void {
    // TODO: 实现长方法检测
  }

  private detectLargeClasses(smells: CodeSmell[]): void {
    // TODO: 实现大类检测
  }

  private detectTooManyParameters(smells: CodeSmell[]): void {
    // TODO: 实现参数过多检测
  }

  private detectComplexConditions(smells: CodeSmell[]): void {
    // TODO: 实现复杂条件检测
  }

  private detectMagicNumbers(smells: CodeSmell[]): void {
    // TODO: 实现魔法数字检测
  }

  private generateMetricSuggestions(metrics: QualityMetrics, suggestions: string[]): void {
    if (metrics.maintainability < QUALITY_THRESHOLD.MAINTAINABILITY.ACCEPTABLE) {
      suggestions.push('提高代码可维护性：考虑重构复杂方法，减少代码重复');
    }

    if (metrics.reliability < QUALITY_THRESHOLD.RELIABILITY.ACCEPTABLE) {
      suggestions.push('提高代码可靠性：添加错误处理和边界检查');
    }

    if (metrics.security < QUALITY_THRESHOLD.SECURITY.ACCEPTABLE) {
      suggestions.push('提高代码安全性：避免使用不安全的API，加强数据验证');
    }

    if (metrics.efficiency < QUALITY_THRESHOLD.EFFICIENCY.ACCEPTABLE) {
      suggestions.push('提高代码效率：优化算法复杂度，减少不必要的计算');
    }

    if (metrics.reusability < QUALITY_THRESHOLD.REUSABILITY.ACCEPTABLE) {
      suggestions.push('提高代码可重用性：提取通用功能，使用设计模式');
    }

    if (metrics.testability < QUALITY_THRESHOLD.TESTABILITY.ACCEPTABLE) {
      suggestions.push('提高代码可测试性：减少依赖，简化复杂度');
    }

    if (metrics.documentation < QUALITY_THRESHOLD.DOCUMENTATION.ACCEPTABLE) {
      suggestions.push('改善文档完整性：添加必要的注释和文档说明');
    }
  }

  private generateSmellSuggestions(smells: CodeSmell[], suggestions: string[]): void {
    const smellTypes = new Set(smells.map(smell => smell.type));

    if (smellTypes.has('LongMethod')) {
      suggestions.push('重构长方法：将大型方法拆分为更小的函数');
    }

    if (smellTypes.has('LargeClass')) {
      suggestions.push('重构大类：考虑将类拆分为多个更小的类');
    }

    if (smellTypes.has('TooManyParameters')) {
      suggestions.push('减少参数数量：使用对象参数或构建器模式');
    }

    if (smellTypes.has('ComplexCondition')) {
      suggestions.push('简化复杂条件：提取条件判断到独立函数');
    }

    if (smellTypes.has('MagicNumber')) {
      suggestions.push('消除魔法数字：使用命名常量替代硬编码数值');
    }
  }
} 