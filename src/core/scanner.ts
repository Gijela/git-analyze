import { glob } from 'glob';
import { readFile, stat } from 'fs/promises';
import type { FileInfo } from '../types/index.js';
import { FileProcessError, ValidationError } from '../core/errors.js';

interface ScanOptions {
  maxFileSize?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
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
      const files = await glob('**/*', {
        cwd: path,
        ignore: [...(options.excludePatterns || []), '**/node_modules/**', '**/.git/**'],
        nodir: true,
        absolute: true,
        windowsPathsNoEscape: true
      });

      const results = await Promise.all(
        files.map(file => this.processFile(file, options))
      );

      return results.filter((file): file is FileInfo => file !== null);
    } catch (error) {
      throw new FileProcessError(path, (error as Error).message);
    }
  }

  private async processFile(
    path: string,
    options: ScanOptions
  ): Promise<FileInfo | null> {
    try {
      // 检查文件类型
      const ext = path.toLowerCase().split('.').pop();
      if (ext && BINARY_FILE_TYPES.includes(`.${ext}`)) {
        return null;
      }

      const stats = await stat(path);

      if (options.maxFileSize && stats.size > options.maxFileSize) {
        return null;
      }

      const content = await readFile(path, 'utf-8');

      return {
        path,
        content,
        size: stats.size
      };
    } catch (error) {
      throw new FileProcessError(path, (error as Error).message);
    }
  }
} 