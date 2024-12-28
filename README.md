# GitIngest-TS

A lightweight Git code analysis tool optimized for LLM context.

## ✨ Key Features

- Support for GitHub repositories and local directory analysis
- Intelligent code parsing and formatting
- Automatic project structure and statistics generation
- Built-in token count estimation
- Type-safe TypeScript API

## 📦 Installation

todo

```bash
# npm install gitingest-ts
```

## 🚀 Quick Start

```typescript
import { GitIngest } from "gitingest-ts";

// Create analyzer instance
const ingest = new GitIngest({
  tempDir: "./temp",
  defaultPatterns: {
    exclude: ["**/node_modules/**", "**/.git/**"],
  },
});

// Analyze GitHub repository
const result = await ingest.analyzeFromUrl(
  "https://github.com/Gijela/gitingest-ts"
);

// Or analyze local directory
const result = await ingest.analyzeFromDirectory("./project");

console.log(result.summary); // Project overview
console.log(result.tree); // File structure
```

## 📖 Configuration Options

```typescript
interface GitIngestConfig {
  tempDir?: string; // Temporary file directory
  defaultMaxFileSize?: number; // File size limit
  defaultPatterns?: {
    include?: string[]; // Included file patterns
    exclude?: string[]; // Excluded file patterns
  };
}
```

## 🔍 Analysis Results

```typescript
interface AnalysisResult {
  summary: string; // Project summary
  tree: string; // File tree
  content: string; // Code content
  metadata: {
    files: number; // Number of files
    size: number; // Total size
    tokens: number; // Token count
  };
}
```

## ⚡️ Error Handling

```typescript
try {
  const result = await ingest.analyzeFromUrl(
    "https://github.com/Gijela/gitingest-ts"
  );
} catch (error) {
  if (error instanceof GitIngestError) {
    console.error("Analysis error:", error.message);
  }
}
```

## 📄 License

MIT
