# Git-Analyze

一个强大的 GitHub 代码仓库分析工具,支持代码知识图谱构建、语义化代码检索和代码结构可视化。

## 核心特性

- 支持从 GitHub URL 或本地目录分析代码
- 智能代码依赖分析,自动追踪相关文件
- 生成代码知识图谱,展示代码结构和关系
- 支持代码 Token 消耗预估
- 支持二进制文件过滤和大小限制
- 支持自定义域名映射
- 基于知识图谱的智能代码检索
- 支持语义化代码理解和关联分析
- 自动构建代码知识库,支持上下文相关性检索
- 免费开源,无需 API Key

## 工作流程

### 1. 代码获取

- 支持从 GitHub URL 克隆代码
- 支持分析本地目录
- 自动处理临时文件清理

### 2. 智能知识图谱

系统会自动分析代码结构和依赖关系,构建知识图谱:

- 自动识别代码实体(类、函数、变量等)
- 分析实体间的调用、继承、实现关系
- 构建语义化的代码知识网络
- 支持基于图谱的相关性检索
- 提供可视化知识图谱展示

### 3. 依赖分析

```151:194:src/core/scanner.ts
  // [依赖文件按需分析]: 分析依赖文件
  protected async analyzeDependencies(
    content: string,
    filePath: string,
    basePath: string
  ): Promise<string[]> {
    const dependencies: string[] = [];
    // 匹配导入路径。示例: import { Button } from '@/components/Button'
    const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;

    // 移除多行注释
    const contentWithoutComments = content.replace(/\/\*[\s\S]*?\*\//g, "");
    const lines = contentWithoutComments
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith("//");
      })
      .join("\n");

    // 匹配导入路径
    let match;
    // 遍历每一行，匹配导入路径
    while ((match = importRegex.exec(lines)) !== null) {
      // 获取导入路径。示例: import { Button } from '@/components/Button'
      const importPath = match[1];
      // 获取当前文件路径。示例: src/components/Button/index.ts
      const currentDir = dirname(filePath);

      // 查找导入路径。示例: src/components/Button/index.ts
      const resolvedPath = await this.findModuleFile(
        importPath,
        currentDir,
        basePath
      );
      // 如果导入路径存在，且不在依赖列表中，则添加到依赖列表
      if (resolvedPath && !dependencies.includes(resolvedPath)) {
        dependencies.push(resolvedPath);
      }
    }

    // 返回依赖列表。示例：['src/components/Button/index.ts', 'src/components/Input/index.ts']
    return dependencies;
  }
```

### 4. 代码分析

```71:90:src/core/codeAnalyzer.ts
  public analyzeCode(filePath: string, sourceCode: string): void {
    if (!filePath) {
      throw new Error('File path cannot be undefined');
    }
    this.currentFile = filePath;
    try {
      console.log(`[CodeAnalyzer] Processing file: ${filePath}`);

      const tree = this.parser.parse(sourceCode);
      console.log(`[CodeAnalyzer] AST generated for ${filePath}`);

      this.visitNode(tree.rootNode);

      console.log(`[CodeAnalyzer] Analysis complete for ${filePath}`);
      console.log(`[CodeAnalyzer] Found ${this.codeElements.length} nodes`);
      console.log(`[CodeAnalyzer] Found ${this.relations.length} relationships`);
    } catch (error) {
      console.error(`[CodeAnalyzer] Error analyzing file ${filePath}:`, error);
    }
  }
```

### 5. 知识图谱生成

```382:431:src/core/codeAnalyzer.ts
  public getKnowledgeGraph(): KnowledgeGraph {
    console.log(`[Debug] Generating knowledge graph:`, {
      totalElements: this.codeElements.length,
      totalRelations: this.relations.length
    });

    // 1. 先转换节点,添加 implementation 字段
    const nodes: KnowledgeNode[] = this.codeElements.map(element => ({
      id: element.id!,
      name: element.name,
      type: element.type,
      filePath: element.filePath,
      location: element.location,
      implementation: element.implementation || '' // 添加 implementation 字段
    }));

    // 2. 验证所有关系
    const validRelations = this.relations.filter(relation => {
      const sourceExists = this.codeElements.some(e => e.id === relation.sourceId);
      const targetExists = this.codeElements.some(e => e.id === relation.targetId);

      if (!sourceExists || !targetExists) {
        console.warn(`[Warning] Invalid relation:`, {
          source: relation.sourceId,
          target: relation.targetId,
          type: relation.type,
          sourceExists,
          targetExists
        });
        return false;
      }
      return true;
    });

    // 3. 转换关系
    const edges: KnowledgeEdge[] = validRelations.map(relation => ({
      source: relation.sourceId,
      target: relation.targetId,
      type: relation.type,
      properties: {}
    }));

    console.log(`[Debug] Knowledge graph generated:`, {
      nodes: nodes.length,
      edges: edges.length,
      relationTypes: new Set(edges.map(e => e.type))
    });

    return { nodes, edges };
  }
```

## 使用示例

```typescript
import { GitIngest } from "git-analyze";

// 创建实例
const analyzer = new GitIngest({
  tempDir: "temp",
  defaultMaxFileSize: 1024 * 1024, // 1MB
  defaultPatterns: {
    include: ["**/*"],
    exclude: ["**/node_modules/**"],
  },
});

// 从 GitHub 分析
const result = await analyzer.analyzeFromUrl(
  "https://github.com/username/repo",
  {
    branch: "main",
    targetPaths: ["src/"],
  }
);

// 从本地目录分析
const result = await analyzer.analyzeFromDirectory("./my-project", {
  maxFileSize: 2 * 1024 * 1024,
  includePatterns: ["src/**/*.ts"],
});

// 分析结果
console.log(result.metadata); // 项目元数据
console.log(result.fileTree); // 文件树结构
console.log(result.sizeTree); // 大小树结构
console.log(result.codeAnalysis); // 代码分析结果

// 获取知识图谱
const graph = result.knowledgeGraph;

// 检索相关代码
const searchResult = await analyzer.searchRelatedCode("UserService", {
  maxResults: 10,
  includeContext: true,
});

// 获取代码关系
const relations = await analyzer.getCodeRelations("src/services/user.ts");
```

## 配置选项

### GitIngestConfig

```75:94:src/types/index.ts
export interface GitIngestConfig {
  // 保存克隆仓库的临时目录名
  tempDir?: string;
  /* 默认检索的最大的文件 */
  defaultMaxFileSize?: number;
  /* 文件模式 */
  defaultPatterns?: {
    /* 包含的文件/目录 */
    include?: string[];
    /* 不会去检索的文件/目录 */
    exclude?: string[];
  };
  /* 保留克隆的仓库 */
  keepTempFiles?: boolean;
  /* 自定义域名 */
  customDomainMap?: {
    targetDomain: string;
    originalDomain: string;
  };
}
```

### AnalyzeOptions

```1:14:src/types/index.ts
export interface AnalyzeOptions {
  // 最大文件大小
  maxFileSize?: number;
  // 包含的文件模式
  includePatterns?: string[];
  // 排除的文件模式
  excludePatterns?: string[];
  // 目标文件路径
  targetPaths?: string[];
  // 分支
  branch?: string;
  // 提交
  commit?: string;
}
```

## Token 预估算法

工具使用智能算法预估代码 Token 消耗:

```4:18:src/utils/index.ts
export function estimateTokens(text: string): number {
  // 1. 计算中文字符数量
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;

  // 2. 计算英文单词数量（包括数字和标点）
  const otherChars = text.length - chineseChars;

  // 3. 计算总 token：
  // - 中文字符通常是 1:1 或 1:2 的比例，保守起见使用 2
  // - 其他字符按照 1:0.25 的比例
  const estimatedTokens = chineseChars * 2 + Math.ceil(otherChars / 4);

  // 4. 添加 10% 的安全余量
  return Math.ceil(estimatedTokens * 1.1);
}
```

## 安装

```bash
npm install git-analyze
```

## 许可证

MIT

## 技术栈

- TypeScript
- tree-sitter (AST 解析)
- glob (文件匹配)
- 知识图谱算法

## 注意事项

1. 默认不保存临时文件,可通过 `keepTempFiles` 配置保留
2. 默认过滤二进制文件和 node_modules
3. 支持的代码文件类型: .ts, .tsx, .js, .jsx, .vue
4. Token 预估值包含 10% 的安全余量
