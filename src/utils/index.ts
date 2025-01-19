import type { FileInfo } from "../types/index";

// 估计内容 token 数量
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

// 生成目录树
export function generateTree(files: FileInfo[]): string {
  const tree: { [key: string]: any } = {};

  for (const file of files) {
    const parts = file.path.split("/");
    let current = tree;

    for (const part of parts.slice(0, -1)) {
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = null;
  }

  function stringify(node: any, prefix = ""): string {
    let result = "";
    const entries = Object.entries(node);

    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];
      const isLast = i === entries.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const childPrefix = isLast ? "    " : "│   ";

      result += prefix + connector + key + "\n";

      if (value !== null) {
        result += stringify(value, prefix + childPrefix);
      }
    }

    return result;
  }

  return stringify(tree);
}

interface TreeNode {
  name: string;
  token: number;
  content?: string;
  children: { [key: string]: TreeNode };
  isFile: boolean;
}

// 构建文件大小树
export function buildSizeTree(files: FileInfo[]): TreeNode {
  // 创建根节点
  const root: TreeNode = {
    name: "root",
    token: 0,
    children: {},
    isFile: false,
  };

  // 构建树结构
  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    // 遍历路径的每一部分
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLastPart = i === parts.length - 1;

      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          token: isLastPart ? file.token : 0,
          ...(isLastPart && file.content ? { content: file.content } : {}),
          children: {},
          isFile: isLastPart,
        };
      }

      current = current.children[part];
    }
  }

  // 计算每个目录的总大小
  function calculateSize(node: TreeNode): number {
    if (node.isFile) {
      return node.token;
    }

    let totalToken = 0;
    for (const child of Object.values(node.children)) {
      totalToken += calculateSize(child);
    }
    node.token = totalToken;
    return totalToken;
  }

  calculateSize(root);
  return root;
}
