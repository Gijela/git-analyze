import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";

// 初始化 TS 解析器
const parser = new Parser();
parser.setLanguage(TypeScript.tsx as any);

/**
 * 提取代码的核心功能和工作流程
 * @param {string} sourceCode - 合并后的代码字符串
 */
function extractCodeFlow(sourceCode: string) {
  // 按文件分割代码
  const files = sourceCode.split(/File: .+?\n=+\n/).filter(Boolean);

  const flow: string[] = [];
  const sequenceDiagram: string[] = [];

  files.forEach((fileContent) => {
    // 解析代码
    const tree = parser.parse(fileContent);

    // 提取核心功能
    const fileFlow = extractFlowFromTree(tree.rootNode);
    flow.push(...fileFlow);
  });

  console.log("代码工作流程:");
  console.log(flow.join("\n"));

}

/**
 * 从语法树中提取核心功能
 * @param {any} node - 语法树节点
 * @returns {string[]} - 核心功能和工作流程
 */
function extractFlowFromTree(node: any): string[] {
  const flow: string[] = [];

  // 遍历语法树节点
  if (node.type === "class_declaration") {
    // 提取类定义
    const className = node.child(1)?.text || "";
    flow.push(`定义类: ${className}`);

    // 提取类方法
    node.children.forEach((child: any) => {
      if (child.type === "method_definition") {
        const methodName = child.child(0)?.text || "";
        flow.push(`定义方法: ${className}.${methodName}`);
      }
    });
  } else if (node.type === "export_statement") {
    // 提取导出逻辑
    const exportName = node.child(1)?.text || "";
    console.log("🚀 ~ extractFlowFromTree ~ node.child(1):", node.child(1))
    // console.log("🚀 ~ extractFlowFromTree ~ exportName:", exportName)
    // flow.push(`导出: ${exportName}`);
  } else if (node.type === "call_expression") {
    // 提取方法调用
    const functionName = node.child(0)?.text || "";
    flow.push(`调用方法: ${functionName}`);
  } else if (node.type === "try_statement") {
    // 提取错误处理逻辑
    flow.push("错误处理: try-catch");
  }

  // 递归遍历子节点
  for (let child of node.children) {
    flow.push(...extractFlowFromTree(child));
  }

  return flow;
}

// 示例：合并后的代码字符串
const mergedCode = `
File: repo/github101-866480/src/core/gitAction.ts
========================================
import { simpleGit, SimpleGit } from 'simple-git';
import { GitOperationError } from './errors';
import { env } from '../utils/env';

export class GitAction {
  private git: SimpleGit;

  constructor() {
    const config: string[] = [];

    console.log("HTTP_PROXY:", env.HTTP_PROXY);
    console.log("HTTPS_PROXY:", env.HTTPS_PROXY);

    // 如果存在vpn代理，则使用环境变量
    if (env.HTTP_PROXY) {
      config.push(\`http.proxy=\${env.HTTP_PROXY}\`);
    }
    if (env.HTTPS_PROXY) {
      config.push(\`https.proxy=\${env.HTTPS_PROXY}\`);
    }

    this.git = simpleGit({
      baseDir: process.cwd(),
      ...(config.length > 0 ? { config } : {})
    });
  }

  async clone(url: string, path: string): Promise<void> {
    try {
      await this.git.clone(url, path);
    } catch (error) {
      throw new GitOperationError('clone', (error as Error).message);
    }
  }

  async checkoutBranch(path: string, branch: string): Promise<void> {
    try {
      const git = simpleGit(path);
      await git.checkout(branch);
    } catch (error) {
      throw new GitOperationError('checkout', (error as Error).message);
    }
  }
}


File: repo/github101-866480/src/core/errors.ts
========================================
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
    super(\`Git operation '\${operation}' failed: \${details}\`);
    this.name = 'GitOperationError';
  }
}

// 文件处理错误
export class FileProcessError extends GitIngestError {
  constructor(path: string, reason: string) {
    super(\`Failed to process file '\${path}': \${reason}\`);
    this.name = 'FileProcessError';
  }
}

// 验证错误
export class ValidationError extends GitIngestError {
  constructor(message: string) {
    super(\`Validation failed: \${message}\`);
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
    super(\`[\${errorType}] \${message} in file: \${filePath}\`);
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
    super(\`Git analysis failed: \${message} (\${operation} on \${target})\`);
    this.name = 'GitAnalysisError';
  }
}


File: repo/github101-866480/src/utils/env.ts
========================================
import { config } from 'dotenv';
import { join } from 'path';

// 加载环境变量
config({ path: join(process.cwd(), '.env') });

// 导出环境变量类型
export interface Env {
  HTTP_PROXY?: string;
  HTTPS_PROXY?: string;
  NODE_ENV?: string;
}

// 导出环境变量
export const env: Env = {
  HTTP_PROXY: process.env.HTTP_PROXY,
  HTTPS_PROXY: process.env.HTTPS_PROXY,
  NODE_ENV: process.env.NODE_ENV
};
`;

// 提取代码工作流程
extractCodeFlow(mergedCode);