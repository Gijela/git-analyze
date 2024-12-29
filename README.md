# GitIngest-TS

一个强大的 TypeScript 代码分析工具，用于深入分析 Git 仓库中的代码质量、依赖关系和变更历史。

## 主要功能

### 1. 智能代码分析

- 设计模式识别（单例模式、工厂模式、观察者模式等）
- 代码气味检测（长方法、大类、过多参数等）
- 最佳实践建议
- 重构机会识别
- 架构模式分析（MVC、分层架构、微服务等）
- 代码重复检测
- 耦合度分析
- 条件复杂度计算

### 2. 依赖分析

- 项目依赖关系图生成
- 模块间依赖分析
- 循环依赖检测
- 依赖健康度评估
- 导入/导出分析
- 依赖图可视化

### 3. 多格式报告生成

- JSON 格式报告（详细的依赖和分析数据）
- HTML 可视化报告（交互式界面）
- Mermaid 图表（依赖关系图）
- DOT 格式图表（可用于 Graphviz 等工具）

### 4. 代码质量分析

- 代码复杂度评估
  - 圈复杂度计算
  - 可维护性指数
  - 代码行数统计
  - 注释覆盖率
- 性能分析
  - 时间复杂度评估
  - 空间复杂度评估
  - 内存使用分析
  - CPU 使用分析
  - 网络调用分析
- 代码重复检测
- 耦合度分析

### 5. 安全分析

- 漏洞检测
- 敏感数据检查
- 不安全协议使用检测
- 弱加密算法识别
- 硬编码密钥检测
- 不安全正则表达式检测

### 6. 变更分析

- 代码变更历史追踪
- 变更热点识别
- 风险区域识别
- 贡献者分析
- 变更时间线生成
- 变更影响评估

### 7. 配置分析

- 配置文件识别
- 配置项验证
- 废弃配置检测
- 必需配置检查
- 配置最佳实践建议

### 8. 注释分析

- 注释覆盖率统计
- 文档完整性检查
- API 文档生成
- 示例代码提取
- TODO/FIXME 追踪

### 9. 项目统计分析

- 文件类型分布统计
- 项目大小计算
- Token 数量估算
- 目录结构树生成
- 项目概况总结

### 10. 学习路径分析

- 代码复杂度递进
- 依赖关系图学习路径
- 核心模块识别
- 入门建议生成

### 11. 文件处理

- 智能文件类型识别
- 二进制文件过滤
- 大文件处理策略
- 文件编码自动检测
- 增量分析支持

### 12. 错误处理

- Git 操作异常处理
- 文件处理错误恢复
- 输入验证
- 优雅降级策略
- 详细错误报告

### 13. AST 分析

- 代码结构解析
- 语法树遍历
- 节点类型识别
- 代码模式匹配
- 语义分析

### 14. 代码优化建议

- 性能优化建议
- 代码质量建议
- 架构改进建议
- 安全加固建议
- 优先级评估
- 工作量评估

### 15. 代码度量

- 代码行数统计
- 注释密度分析
- 函数复杂度
- 类复杂度
- 接口复杂度
- 继承深度分析

## 使用方法

```typescript
// 示例：分析项目
import { DependencyAnalyzer } from "./src/core/dependency";
import { DependencyReporter } from "./src/core/reporter";

const analyzer = new DependencyAnalyzer(rootDir);
const graph = await analyzer.analyze("index.ts");

const reporter = new DependencyReporter(graph, rootDir);
await reporter.generateReport({
  outputDir,
  format: "html",
  includeExports: true,
  includeComplexity: true,
  includeChanges: true,
  includeComments: true,
});
```

## 报告输出

分析结果将生成以下格式的报告：

- `dependency-report.json`: 详细的依赖分析数据
- `dependency-report.html`: 可视化的分析报告
- `dependency-graph.mmd`: Mermaid 格式的依赖图
- `dependency-graph.dot`: DOT 格式的依赖图

## 性能指标

工具会计算以下性能指标：

- 时间复杂度 (O(n), O(n²) 等)
- 空间复杂度
- 内存使用情况
- CPU 使用情况
- 网络调用频率

## 安全等级

安全问题分为以下等级：

- 严重 (Critical)
- 高危 (High)
- 中危 (Medium)
- 低危 (Low)

## 配置选项

分析工具支持以下配置选项：

- `outputDir`: 输出目录路径
- `format`: 报告格式 (json/html/mermaid/dot)
- `includeExports`: 是否包含导出分析
- `includeComplexity`: 是否包含复杂度分析
- `includeChanges`: 是否包含变更分析
- `includeComments`: 是否包含注释分析
- `includeLearningPath`: 是否包含学习路径
- `since`: Git 历史分析起始时间
- `excludePatterns`: 需要排除的文件模式
- `maxFileSize`: 最大分析文件大小限制

## 错误类型

工具定义了以下错误类型以便于问题定位：

- `GitIngestError`: 基础错误类型
- `GitOperationError`: Git 操作相关错误
- `FileProcessError`: 文件处理错误
- `ValidationError`: 输入验证错误

## 限制说明

工具有以下使用限制：

- 最大支持文件大小：可配置
- 支持的文件类型：所有文本文件
- 不支持的文件类型：二进制文件（如图片、PDF等）
- Git 历史分析深度：可配置
- 并发分析限制：可配置

## 分析维度

工具从以下维度进行代码分析：

- 语法维度：代码结构和语法正确性
- 语义维度：代码逻辑和业务含义
- 复杂度维度：代码复杂程度和可维护性
- 性能维度：代码执行效率和资源使用
- 安全维度：代码安全性和漏洞风险
- 质量维度：代码规范和最佳实践
- 架构维度：系统设计和模块关系
- 变更维度：代码历史和演进过程

## 测试命令和预期结果

### 1. 智能代码分析测试

```typescript
// 测试设计模式识别
import { IntelligentAnalyzer } from './src/core/intelligent-analyzer';

const analyzer = new IntelligentAnalyzer();
const patterns = await analyzer.analyzeFile('src/example/singleton.ts');

// 预期输出
{
  "patterns": [
    {
      "type": "design_pattern",
      "name": "Singleton",
      "description": "发现单例模式实现",
      "confidence": 0.9,
      "suggestion": "确保单例模式的使用是必要的，考虑依赖注入等替代方案"
    }
  ]
}
```

### 2. 依赖分析测试

```typescript
// 测试依赖关系分析
import { DependencyAnalyzer } from './src/core/dependency';

const analyzer = new DependencyAnalyzer('./src');
const graph = await analyzer.analyze('index.ts');

// 预期输出
{
  "nodes": [
    {
      "file": "src/index.ts",
      "dependencies": ["./core/analyzer", "./utils/logger"],
      "exports": ["analyze", "report"]
    }
  ],
  "cycles": []
}
```

### 3. 性能分析测试

```typescript
// 测试性能分析
import { PerformanceAnalyzer } from './src/core/performance-analyzer';

const analyzer = new PerformanceAnalyzer();
const metrics = await analyzer.analyzeFile('src/core/heavy-computation.ts');

// 预期输出
{
  "metrics": [
    {
      "type": "time_complexity",
      "value": 2,
      "severity": "high",
      "description": "函数时间复杂度为 O(n²)",
      "recommendation": "考虑优化循环嵌套,减少时间复杂度"
    }
  ]
}
```

### 4. 安全分析测试

```typescript
// 测试安全分析
import { SecurityAnalyzer } from './src/core/security-analyzer';

const analyzer = new SecurityAnalyzer();
const issues = await analyzer.analyzeFile('src/utils/auth.ts');

// 预期输出
{
  "issues": [
    {
      "type": "sensitive_data",
      "severity": "high",
      "description": "发现可能的敏感数据硬编码",
      "recommendation": "建议使用环境变量或配置管理系统存储敏感数据"
    }
  ]
}
```

### 5. 变更分析测试

```typescript
// 测试变更分析
import { ChangeAnalyzer } from './src/core/change-analyzer';

const analyzer = new ChangeAnalyzer('./');
const analysis = await analyzer.analyze('1 month');

// 预期输出
{
  "hotspots": ["src/core/analyzer.ts"],
  "contributors": [
    {
      "name": "developer1",
      "commits": 23,
      "changes": 156
    }
  ],
  "timeline": [
    {
      "date": "2024-01-01",
      "changes": 45
    }
  ]
}
```

### 6. 配置分析测试

```typescript
// 测试配置分析
import { ConfigAnalyzer } from './src/core/config-analyzer';

const analyzer = new ConfigAnalyzer();
const config = await analyzer.analyzeFile('tsconfig.json');

// 预期输出
{
  "items": [
    {
      "key": "compilerOptions",
      "type": "object",
      "required": true,
      "deprecated": false
    }
  ],
  "recommendations": [
    {
      "type": "required",
      "message": "项目包含 5 个必需配置项，请确保正确设置"
    }
  ]
}
```

### 7. 注释分析测试

```typescript
// 测试注释分析
import { CommentAnalyzer } from './src/core/comment-analyzer';

const analyzer = new CommentAnalyzer();
const analysis = await analyzer.analyzeFile('src/core/analyzer.ts');

// 预期输出
{
  "coverage": {
    "ratio": 0.85,
    "documented": 17,
    "total": 20
  },
  "todos": [
    {
      "line": 45,
      "content": "TODO: 优化性能"
    }
  ]
}
```

### 8. AST分析测试

```typescript
// 测试AST分析
import { ASTAnalyzer } from './src/core/ast-analyzer';

const analyzer = new ASTAnalyzer();
const ast = await analyzer.parseFile('src/utils/helper.ts');

// 预期输出
{
  "structure": {
    "type": "Program",
    "body": [
      {
        "type": "FunctionDeclaration",
        "name": "calculateMetrics"
      }
    ]
  }
}
```

### 9. 代码度量测试

```typescript
// 测试代码度量
import { ComplexityAnalyzer } from './src/core/complexity';

const analyzer = new ComplexityAnalyzer();
const metrics = await analyzer.analyzeFile('src/core/complex-class.ts');

// 预期输出
{
  "metrics": {
    "cyclomaticComplexity": 12,
    "maintainabilityIndex": 65,
    "linesOfCode": 234,
    "commentRatio": 0.15
  }
}
```

### 10. 项目统计测试

```typescript
// 测试项目统计
import { ProjectAnalyzer } from './src/core/project-analyzer';

const analyzer = new ProjectAnalyzer();
const stats = await analyzer.analyzeDirectory('./src');

// 预期输出
{
  "summary": {
    "files": 45,
    "size": "1.2MB",
    "tokens": 12500
  },
  "fileTypes": {
    "ts": 35,
    "js": 8,
    "json": 2
  }
}
```

注意：所有测试命令都需要在项目根目录下运行，并确保已安装所有依赖：

```bash
# 安装依赖
pnpm install

# 运行所有测试
pnpm test

# 运行特定测试
pnpm test:security
pnpm test:performance
pnpm test:complexity
```

## 命令使用说明

### 1. 基础命令

```bash
# 安装依赖
pnpm install

# 开发模式（监听文件变化）
pnpm dev

# 构建项目
pnpm build

# 运行单元测试
pnpm test

# 代码检查
pnpm lint

# 代码格式化
pnpm format
```

### 2. 分析命令

```bash
# 分析代码复杂度
pnpm analyze:complexity
# 输出: examples/reports/complexity-report.json
# 分析结果包含：圈复杂度、维护性指数、代码行数等指标

# 分析代码变更
pnpm analyze:changes
# 输出: examples/reports/changes-report.json
# 分析结果包含：提交历史、变更热点、贡献者统计等

# 分析整个项目
pnpm analyze:project
# 输出: examples/reports/project-report.json
# 分析结果包含：项目概览、文件统计、整体评估等

# 分析代码质量
pnpm analyze:quality
# 输出: examples/reports/quality-report.json
# 分析结果包含：代码气味、重复度、最佳实践等

# 分析代码安全性
pnpm analyze:security
# 输出: examples/reports/security-report.json
# 分析结果包含：漏洞检测、敏感信息、安全风险等

# 分析性能问题
pnpm analyze:performance
# 输出: examples/reports/performance-report.json
# 分析结果包含：时间复杂度、内存使用、性能瓶颈等

# 智能代码分析
pnpm analyze:intelligent
# 输出: examples/reports/intelligent-report.json
# 分析结果包含：设计模式、架构评估、改进建议等

# 运行示例测试
pnpm test:example
# 运行所有分析示例并生成报告
```

### 3. 报告格式

所有分析命令都会在 `examples/reports` 目录下生成以下格式的报告：

- `xxx-report.json`: 详细的分析数据（JSON格式）
- `xxx-report.html`: 可视化分析报告（HTML格式）
- `xxx-graph.mmd`: 关系图表（Mermaid格式）
- `xxx-graph.dot`: 关系图表（DOT格式）

### 4. 示例报告内容

1. 复杂度报告 (complexity-report.json):

```json
{
  "summary": {
    "totalFiles": 45,
    "averageComplexity": 15.2,
    "highComplexityFiles": 5
  },
  "details": {
    "cyclomaticComplexity": 15,
    "maintainabilityIndex": 68,
    "linesOfCode": 342
  }
}
```

2. 变更报告 (changes-report.json):

```json
{
  "summary": {
    "totalCommits": 125,
    "totalAuthors": 8,
    "timeSpan": "3 months"
  },
  "changes": {
    "filesChanged": 23,
    "insertions": 1500,
    "deletions": 500
  }
}
```

3. 质量报告 (quality-report.json):

```json
{
  "summary": {
    "overallScore": 85,
    "qualityGrade": "B+"
  },
  "details": {
    "codeSmells": 12,
    "duplications": 5,
    "coverage": 85,
    "issues": 8
  }
}
```

4. 安全报告 (security-report.json):

```json
{
  "summary": {
    "riskLevel": "Medium",
    "totalIssues": 11
  },
  "issues": {
    "critical": 1,
    "high": 2,
    "medium": 5,
    "low": 3
  }
}
```

5. 性能报告 (performance-report.json):

```json
{
  "summary": {
    "performanceScore": 78,
    "criticalIssues": 2
  },
  "details": {
    "timeComplexityIssues": 4,
    "memoryLeaks": 2,
    "heavyComputations": 3
  }
}
```

6. 智能分析报告 (intelligent-report.json):

```json
{
  "summary": {
    "patternCount": 15,
    "recommendations": 8
  },
  "patterns": {
    "designPatterns": 5,
    "architecturePatterns": 3,
    "codeSmells": 8
  }
}
```

### 5. 注意事项

- 所有命令都需要在项目根目录下运行
- 确保已安装所有依赖 (`pnpm install`)
- 分析大型项目时可能需要较长时间
- 报告文件会自动覆盖，注意备份重要数据
- 部分分析需要完整的 Git 历史记录
