# GitHub101

A tool for analyzing Git repository code, supporting dependency analysis, file tree generation and other features.

## Main Features

- Support code analysis from GitHub URL or local directory
- Analyze project file dependencies based on given entry points, scan relevant files as needed
- Generate project metadata (token consumption estimate, file size, file type)
- Generate project file tree structure
- Generate tree structure with file sizes and source code
- Support file filtering and size limits

## Workflow

1. **Code Retrieval**

   - Support cloning from GitHub URL
   - Support specifying local directory
   - Support custom domain mapping to GitHub

2. **File Scanning**

   - Recursively scan directory structure
   - Filter binary files
   - Support file size limits
   - Support custom file include/exclude rules

3. **Dependency Analysis**

   - Analyze import/require statements
   - Build dependency graph
   - Support relative path resolution
   - Support multiple file extensions

4. **Result Generation**
   - Generate file tree structure
   - Calculate code metrics and file sizes
   - Generate project metadata
   - Output complete analysis report

## Usage Example

```typescript
import { GitIngest } from "github101";

// Create instance
const gitIngest = new GitIngest({
  tempDir: "temp",
  defaultMaxFileSize: 1024 * 1024, // 1MB
  defaultPatterns: {
    include: ["**/*"],
    exclude: ["**/node_modules/**"],
  },
});

// Analyze from GitHub URL
const result = await gitIngest.analyzeFromUrl(
  "https://github.com/username/repo",
  {
    branch: "main",
    targetPaths: ["src/"],
  }
);

// Analyze from local directory
const result = await gitIngest.analyzeFromDirectory("./my-project", {
  maxFileSize: 2 * 1024 * 1024,
  includePatterns: ["src/**/*.ts"],
});

// Analysis results
console.log(result.metadata); // Project metadata
console.log(result.fileTree); // File tree structure
console.log(result.sizeTree); // File size tree
console.log(result.totalCode); // Total code content
```

## Configuration Options

### GitIngestConfig

```typescript
interface GitIngestConfig {
  tempDir?: string; // Temporary directory
  defaultMaxFileSize?: number; // Maximum file size
  defaultPatterns?: {
    include?: string[]; // File patterns to include
    exclude?: string[]; // File patterns to exclude
  };
  keepTempFiles?: boolean; // Whether to keep temporary files
  customDomainMap?: {
    // Custom domain mapping
    targetDomain: string;
    originalDomain: string;
  };
}
```

### AnalyzeOptions

```typescript
interface AnalyzeOptions {
  maxFileSize?: number; // Maximum size per file
  includePatterns?: string[]; // File patterns to include
  excludePatterns?: string[]; // File patterns to exclude
  targetPaths?: string[]; // Target file paths
  branch?: string; // Git branch
  commit?: string; // Git commit
}
```

## Installation

```bash
npm install github101
```

## License

MIT
