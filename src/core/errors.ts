// 错误基类
export class GitIngestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitIngestError';
  }
}

// 错误基类
export class GitOperationError extends GitIngestError {
  constructor(operation: string, details: string) {
    super(`Git operation '${operation}' failed: ${details}`);
    this.name = 'GitOperationError';
  }
}

// 文件处理错误
export class FileProcessError extends GitIngestError {
  constructor(path: string, reason: string) {
    super(`Failed to process file '${path}': ${reason}`);
    this.name = 'FileProcessError';
  }
}

// 验证错误
export class ValidationError extends GitIngestError {
  constructor(message: string) {
    super(`Validation failed: ${message}`);
    this.name = 'ValidationError';
  }
}

// 依赖分析错误
export class DependencyAnalysisError extends Error {
  constructor(
    public readonly filePath: string,
    public readonly errorType: 'parse' | 'resolve' | 'analyze',
    message: string
  ) {
    super(`[${errorType}] ${message} in file: ${filePath}`);
    this.name = 'DependencyAnalysisError';
  }
}

// git 分析错误
export class GitAnalysisError extends Error {
  constructor(
    public readonly operation: string,
    public readonly target: string,
    message: string
  ) {
    super(`Git analysis failed: ${message} (${operation} on ${target})`);
    this.name = 'GitAnalysisError';
  }
} 