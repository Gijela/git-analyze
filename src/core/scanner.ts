import { glob } from 'glob';
import { readFile, stat } from 'fs/promises';
import type { FileInfo } from '../types/index.js';
import { FileProcessError, ValidationError } from '../core/errors.js';

interface ScanOptions {
  maxFileSize?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  targetPaths?: string[];
}

const BINARY_FILE_TYPES = [
  '.jpg', '.jpeg', '.png', '.gif', '.bmp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.zip', '.rar', '.7z', '.tar', '.gz',
  '.exe', '.dll', '.so', '.dylib'
];

export class FileScanner {
  async scanDirectory(
    path: string,
    options: ScanOptions
  ): Promise<FileInfo[]> {
    if (!path) {
      throw new ValidationError('Path is required');
    }

    try {
      // 如果指定了targetPaths，只扫描指定的文件
      if (options.targetPaths && options.targetPaths.length > 0) {
        const results = await Promise.all(
          options.targetPaths.map(async (targetPath) => {
            try {
              const fullPath = `${path}/${targetPath}`;
              return await this.processFile(path, targetPath, options);
            } catch (error) {
              console.warn(`Warning: Failed to process ${targetPath}: ${error}`);
              return null;
            }
          })
        );

        return results.filter((file): file is FileInfo => file !== null);
      }

      // 如果没有指定targetPaths，扫描所有文件
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

  private async processFile(
    basePath: string,
    relativePath: string,
    options: ScanOptions
  ): Promise<FileInfo | null> {
    try {
      // 检查文件类型
      const ext = relativePath.toLowerCase().split('.').pop();
      if (ext && BINARY_FILE_TYPES.includes(`.${ext}`)) {
        return null;
      }

      const fullPath = `${basePath}/${relativePath}`;
      const stats = await stat(fullPath);

      if (options.maxFileSize && stats.size > options.maxFileSize) {
        return null;
      }

      const content = await readFile(fullPath, 'utf-8');

      return {
        path: relativePath,
        content,
        size: stats.size
      };
    } catch (error) {
      throw new FileProcessError(relativePath, (error as Error).message);
    }
  }
} 