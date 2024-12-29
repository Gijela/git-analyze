/**
 * 文件大小常量
 */
export const FILE_SIZE = {
  KB: 1024,
  MB: 1024 * 1024
};

/**
 * 代码质量阈值
 */
export const QUALITY_THRESHOLD = {
  // 可维护性指数阈值
  MAINTAINABILITY: {
    GOOD: 85,
    ACCEPTABLE: 65,
    POOR: 50
  },

  // 可靠性指数阈值
  RELIABILITY: {
    GOOD: 85,
    ACCEPTABLE: 70,
    POOR: 50
  },

  // 安全性指数阈值
  SECURITY: {
    GOOD: 90,
    ACCEPTABLE: 75,
    POOR: 60
  },

  // 效率指数阈值
  EFFICIENCY: {
    GOOD: 85,
    ACCEPTABLE: 70,
    POOR: 50
  },

  // 可重用性指数阈值
  REUSABILITY: {
    GOOD: 80,
    ACCEPTABLE: 65,
    POOR: 50
  },

  // 可测试性指数阈值
  TESTABILITY: {
    GOOD: 85,
    ACCEPTABLE: 70,
    POOR: 50
  },

  // 文档完整性阈值
  DOCUMENTATION: {
    GOOD: 80,
    ACCEPTABLE: 60,
    POOR: 40
  }
};

/**
 * 代码复杂度阈值
 */
export const COMPLEXITY_THRESHOLD = {
  // 圈复杂度阈值
  CYCLOMATIC: {
    GOOD: 10,
    ACCEPTABLE: 15,
    POOR: 20
  },

  // 方法长度阈值（行数）
  METHOD_LENGTH: {
    GOOD: 20,
    ACCEPTABLE: 30,
    POOR: 50
  },

  // 类大小阈值（方法数）
  CLASS_SIZE: {
    GOOD: 10,
    ACCEPTABLE: 20,
    POOR: 30
  },

  // 参数数量阈值
  PARAMETER_COUNT: {
    GOOD: 3,
    ACCEPTABLE: 4,
    POOR: 6
  },

  // 条件复杂度阈值（操作符数量）
  CONDITION: {
    GOOD: 2,
    ACCEPTABLE: 3,
    POOR: 5
  }
};

/**
 * 代码重复阈值
 */
export const DUPLICATION_THRESHOLD = {
  // 最小重复代码行数
  MIN_LINES: 6,
  // 重复代码块窗口大小
  WINDOW_SIZE: 10,
  // 相似度阈值
  SIMILARITY: 0.8
};

/**
 * 维护性指数计算常量
 */
export const MAINTAINABILITY_CONSTANTS = {
  BASE_VALUE: 171,
  VOLUME_WEIGHT: 5.2,
  COMPLEXITY_WEIGHT: 0.23,
  LOC_WEIGHT: 16.2,
  NORMALIZATION_FACTOR: 171
};

/**
 * 分析器常量
 */
export const ANALYZER_CONSTANTS = {
  // 默认分数
  DEFAULT_SCORE: 100,
  // 零值
  ZERO: 0,
  // 百分比转换
  PERCENTAGE: 100,
  // 最大分数
  MAX_SCORE: 100,
  // 最小分数
  MIN_SCORE: 0
};

/**
 * 错误扣分常量
 */
export const ERROR_PENALTIES = {
  // 错误处理缺失
  MISSING_ERROR_HANDLING: 20,
  // 空值检查缺失
  MISSING_NULL_CHECK: 15,
  // 边界检查缺失
  MISSING_BOUNDARY_CHECK: 15,
  // 安全问题
  SECURITY_ISSUES: {
    EVAL_USAGE: 30,
    INNER_HTML: 20,
    SENSITIVE_DATA: 15,
    INSECURE_PROTOCOL: 10
  }
};

/**
 * 性能问题扣分常量
 */
export const PERFORMANCE_PENALTIES = {
  // 嵌套循环
  NESTED_LOOPS: 20,
  // 字符串拼接
  STRING_CONCATENATION: 10,
  // 多次遍历
  MULTIPLE_ITERATIONS: 5
}; 