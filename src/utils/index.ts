import type { FileInfo } from '../types/index.js';

// 估计文件内容 token 数量
export function estimateTokens(content: string): number {
  return content.trim().split(/\s+/).length;
}

// 生成目录树
export function generateTree(files: FileInfo[]): string {
  const tree: { [key: string]: any } = {};

  for (const file of files) {
    const parts = file.path.split('/');
    let current = tree;

    for (const part of parts.slice(0, -1)) {
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = null;
  }

  function stringify(node: any, prefix = ''): string {
    let result = '';
    const entries = Object.entries(node);

    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];
      const isLast = i === entries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = isLast ? '    ' : '│   ';

      result += prefix + connector + key + '\n';

      if (value !== null) {
        result += stringify(value, prefix + childPrefix);
      }
    }

    return result;
  }

  return stringify(tree);
}

// 生成项目概况
export function generateSummary(files: FileInfo[], metadata: any): string {
  const fileTypes = new Map<string, number>();

  for (const file of files) {
    const ext = file.path.split('.').pop() || 'unknown';
    fileTypes.set(ext, (fileTypes.get(ext) || 0) + 1);
  }

  let summary = `项目概况:\n`;
  summary += `- 总文件数: ${metadata.files}\n`;
  summary += `- 总大小: ${formatSize(metadata.size)}\n`;
  summary += `- 预估Token数: ${metadata.tokens}\n\n`;

  summary += `文件类型分布:\n`;
  for (const [ext, count] of fileTypes) {
    summary += `- ${ext}: ${count} 个文件\n`;
  }

  return summary;
}

// 格式化文件大小
function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
} 