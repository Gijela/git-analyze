import { glob } from 'glob';
import { readFile, stat } from 'fs/promises';
import type { FileInfo } from '../types/index.js';
import { FileProcessError, ValidationError } from '../core/errors.js';
import { dirname, join, resolve } from 'path';

interface ScanOptions {
  maxFileSize?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  targetPaths?: string[];
  includeDependencies?: boolean;
}

const BINARY_FILE_TYPES = [
  '.jpg', '.jpeg', '.png', '.gif', '.bmp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.zip', '.rar', '.7z', '.tar', '.gz',
  '.exe', '.dll', '.so', '.dylib'
];

export class FileScanner {
  private processedFiles: Set<string> = new Set();

  private async analyzeDependencies(content: string, filePath: string, basePath: string): Promise<string[]> {
    const dependencies: string[] = [];
    // 匹配 import 语句，包括 type 导入
    const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;

    // 移除多行注释
    const contentWithoutComments = content.replace(/\/\*[\s\S]*?\*\//g, '');
    // 按行分割并过滤掉单行注释和空行
    const lines = contentWithoutComments.split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('//');
      })
      .join('\n');

    let match;
    while ((match = importRegex.exec(lines)) !== null) {
      const importPath = match[1];

      // 只处理相对路径的导入
      if (importPath.startsWith('.')) {
        const currentDir = dirname(filePath);
        // 将 .js 扩展名替换为 .ts
        const resolvedPath = importPath.replace(/\.js$/, '.ts');
        // 解析相对路径
        const normalizedPath = join(currentDir, resolvedPath)
          .replace(/^[\/\\]+/, '')  // 移除开头的斜杠
          .replace(/\\/g, '/');     // 统一使用正斜杠

        // 如果路径没有扩展名，添加 .ts
        const finalPath = normalizedPath.endsWith('.ts') ? normalizedPath : `${normalizedPath}.ts`;

        if (!dependencies.includes(finalPath)) {
          dependencies.push(finalPath);
        }
      }
    }

    return dependencies;
  }

  async scanDirectory(
    path: string,
    options: ScanOptions
  ): Promise<FileInfo[]> {
    if (!path) {
      throw new ValidationError('Path is required');
    }

    try {
      this.processedFiles.clear();
      const allFiles: FileInfo[] = [];

      if (options.targetPaths && options.targetPaths.length > 0) {
        for (const targetPath of options.targetPaths) {
          await this.processFileAndDependencies(path, targetPath, options, allFiles);
        }
        return allFiles;
      }

      const files = await glob('**/*', {
        cwd: path,
        ignore: [
          ...(options.excludePatterns || []),
          '**/node_modules/**',
          '**/.git/**'
        ],
        nodir: true,
        absolute: false,
        windowsPathsNoEscape: true
      });

      const results = await Promise.all(
        files.map(file => this.processFile(path, file, options))
      );

      return results.filter((file): file is FileInfo => file !== null);
    } catch (error) {
      throw new FileProcessError(path, (error as Error).message);
    }
  }

  private async processFileAndDependencies(
    basePath: string,
    relativePath: string,
    options: ScanOptions,
    allFiles: FileInfo[]
  ): Promise<void> {
    if (this.processedFiles.has(relativePath)) {
      return;
    }

    const fileInfo = await this.processFile(basePath, relativePath, options);
    if (fileInfo) {
      this.processedFiles.add(relativePath);
      allFiles.push(fileInfo);

      if (options.includeDependencies !== false) {
        const dependencies = await this.analyzeDependencies(fileInfo.content, relativePath, basePath);
        for (const dep of dependencies) {
          await this.processFileAndDependencies(basePath, dep, options, allFiles);
        }
      }
    }
  }

  private async processFile(
    basePath: string,
    relativePath: string,
    options: ScanOptions
  ): Promise<FileInfo | null> {
    try {
      const ext = relativePath.toLowerCase().split('.').pop();
      if (ext && BINARY_FILE_TYPES.includes(`.${ext}`)) {
        return null;
      }

      // 规范化路径
      const normalizedPath = relativePath
        .replace(/^[\/\\]+/, '')  // 移除开头的斜杠
        .replace(/\\/g, '/');     // 统一使用正斜杠

      // 尝试多个可能的路径
      const possiblePaths = [
        join(basePath, normalizedPath),                    // 直接路径
        join(basePath, 'src', normalizedPath),             // src/下的路径
        join(basePath, normalizedPath.replace(/^src\//, '')) // 移除src/前缀的路径
      ];

      for (const path of possiblePaths) {
        try {
          const stats = await stat(path);
          if (options.maxFileSize && stats.size > options.maxFileSize) {
            continue;
          }

          const content = await readFile(path, 'utf-8');
          return {
            path: normalizedPath,
            content,
            size: stats.size
          };
        } catch (error) {
          // 继续尝试下一个路径
          continue;
        }
      }

      // 如果所有路径都失败了，返回null
      console.warn(`Warning: Could not find file ${relativePath} in any of the possible locations`);
      return null;
    } catch (error) {
      console.warn(`Warning: Failed to process file ${relativePath}: ${error}`);
      return null;
    }
  }
} 