export class GitIngestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitIngestError';
  }
}

export class GitOperationError extends GitIngestError {
  constructor(operation: string, details: string) {
    super(`Git operation '${operation}' failed: ${details}`);
    this.name = 'GitOperationError';
  }
}

export class FileProcessError extends GitIngestError {
  constructor(path: string, reason: string) {
    super(`Failed to process file '${path}': ${reason}`);
    this.name = 'FileProcessError';
  }
}

export class ValidationError extends GitIngestError {
  constructor(message: string) {
    super(`Validation failed: ${message}`);
    this.name = 'ValidationError';
  }
} 