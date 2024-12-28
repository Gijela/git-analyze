# GitIngest-TS

一个用于将 Git 仓库转换为 LLM 友好文本的 TypeScript SDK。

## 🚀 特性

- **简单易用**: 支持从 GitHub URL 或本地目录分析代码
- **智能格式化**: 为 LLM 提示优化的输出格式
- **完整统计**:
  - 文件和目录结构
  - 代码大小统计
  - Token 数量估算
- **类型安全**: 完整的 TypeScript 类型定义
- **错误处理**: 全面的错误处理机制

## 📦 安装

```bash
npm install gitingest-ts
# 或者
pnpm add gitingest-ts
```

## 💡 基础用法

```typescript
import { GitIngest } from "gitingest-ts";

// 初始化实例
const ingest = new GitIngest({
  tempDir: "./temp",
  defaultMaxFileSize: 1024 * 1024, // 1MB
  defaultPatterns: {
    exclude: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
  },
});

// 从 GitHub 仓库分析
const result = await ingest.analyzeFromUrl("https://github.com/example/repo", {
  branch: "main",
});

// 或者分析本地目录
const result = await ingest.analyzeFromDirectory("./my-project");

// 使用分析结果
console.log(result.summary); // 项目摘要
console.log(result.tree); // 文件树
console.log(result.metadata); // 元数据
```

## 🔧 API 文档

### GitIngest 类

主要的分析类，用于初始化和执行分析。

#### 配置选项

```typescript
interface GitIngestConfig {
  tempDir?: string; // 临时目录路径
  defaultMaxFileSize?: number; // 默认最大文件大小
  defaultPatterns?: {
    include?: string[]; // 包含的文件模式
    exclude?: string[]; // 排除的文件模式
  };
}
```

#### 方法

- `analyzeFromUrl(url: string, options?: AnalyzeOptions): Promise<AnalysisResult>`
  - 从 GitHub URL 分析代码
- `analyzeFromDirectory(path: string, options?: AnalyzeOptions): Promise<AnalysisResult>`
  - 从本地目录分析代码

### 分析选项

```typescript
interface AnalyzeOptions {
  maxFileSize?: number; // 最大文件大小限制
  includePatterns?: string[]; // 要包含的文件模式
  excludePatterns?: string[]; // 要排除的文件模式
  branch?: string; // Git 分支名
  commit?: string; // Git commit 哈希
}
```

### 分析结果

```typescript
interface AnalysisResult {
  summary: string; // 项目摘要
  tree: string; // 文件树结构
  content: string; // 文件内容
  metadata: {
    files: number; // 文件数量
    size: number; // 总大小
    tokens: number; // Token 数量
  };
}
```

## ⚠️ 错误处理

```typescript
try {
  const result = await ingest.analyzeFromUrl("https://github.com/example/repo");
} catch (error) {
  if (error instanceof GitIngestError) {
    // 处理已知类型的错误
    console.error(error.message);
  } else {
    // 处理其他错误
    console.error("未知错误:", error);
  }
}
```

## 🤝 贡献

欢迎提交 Pull Request 来改进这个项目！

## 📄 许可证

MIT
