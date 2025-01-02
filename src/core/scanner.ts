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
  protected processedFiles: Set<string> = new Set();

  private async findModuleFile(importPath: string, currentDir: string, basePath: string): Promise<string | null> {
    // 处理外部依赖
    if (!importPath.startsWith('.')) {
      return importPath; // 直接返回包名，让依赖图生成器处理
    }

    // 清理当前目录路径，移除临时目录部分
    const cleanCurrentDir = currentDir
      .replace(new RegExp(`^${basePath}/.*?/src/`), 'src/')
      .replace(new RegExp(`^${basePath}/`), '');

    // 解析基础目录路径
    const resolvedPath = join(cleanCurrentDir, importPath).replace(/\\/g, '/');
    const pathParts = resolvedPath.split('/');
    const fileName = pathParts.pop() || '';
    const dirPath = pathParts.join('/');

    // 可能的文件扩展名，根据导入文件类型调整优先级
    const getExtensions = (importName: string) => {
      if (importName.toLowerCase().endsWith('.css')) {
        return ['.css', '.less', '.scss', '.sass'];
      }
      return ['.tsx', '.ts', '.jsx', '.js', '.vue'];
    };

    const extensions = getExtensions(fileName);

    // 构建可能的基础路径
    const possibleBasePaths = [
      join(basePath, dirPath),
      join(basePath, 'src', dirPath),
      ...glob.sync(`${basePath}/*/src/${dirPath}`, { absolute: true })
    ];

    // 如果文件名没有扩展名
    if (!fileName.includes('.')) {
      for (const currentBasePath of possibleBasePaths) {
        // 1. 尝试直接添加扩展名
        for (const ext of extensions) {
          const fullPath = join(currentBasePath, fileName + ext);
          try {
            const stats = await stat(fullPath);
            if (stats.isFile()) {
              // 返回清理过的路径
              return join(dirPath, fileName + ext)
                .replace(new RegExp(`^${basePath}/.*?/src/`), 'src/')
                .replace(new RegExp(`^${basePath}/`), '')
                .replace(/\\/g, '/');
            }
          } catch (error) {
            continue;
          }
        }

        // 2. 尝试查找 index 文件
        const dirFullPath = join(currentBasePath, fileName);
        try {
          const stats = await stat(dirFullPath);
          if (stats.isDirectory()) {
            for (const ext of extensions) {
              const indexPath = join(dirFullPath, 'index' + ext);
              try {
                const indexStats = await stat(indexPath);
                if (indexStats.isFile()) {
                  // 返回清理过的路径
                  return join(dirPath, fileName, 'index' + ext)
                    .replace(new RegExp(`^${basePath}/.*?/src/`), 'src/')
                    .replace(new RegExp(`^${basePath}/`), '')
                    .replace(/\\/g, '/');
                }
              } catch (error) {
                continue;
              }
            }
          }
        } catch (error) {
          continue;
        }
      }

      console.warn(
        `Warning: Could not resolve import '${importPath}' in '${cleanCurrentDir}'. ` +
        `Tried extensions: ${extensions.join(', ')} and index files.`
      );
    } else {
      // 文件名已有扩展名，尝试所有可能的基础路径
      for (const currentBasePath of possibleBasePaths) {
        const fullPath = join(currentBasePath, fileName);
        try {
          const stats = await stat(fullPath);
          if (stats.isFile()) {
            // 返回清理过的路径
            return join(dirPath, fileName)
              .replace(new RegExp(`^${basePath}/.*?/src/`), 'src/')
              .replace(new RegExp(`^${basePath}/`), '')
              .replace(/\\/g, '/');
          }
        } catch (error) {
          continue;
        }
      }
      console.warn(`Warning: Could not find file '${resolvedPath}' referenced in '${cleanCurrentDir}'`);
    }

    return null;
  }

  protected async analyzeDependencies(content: string, filePath: string, basePath: string): Promise<string[]> {
    const dependencies: string[] = [];
    const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;

    // 移除多行注释
    const contentWithoutComments = content.replace(/\/\*[\s\S]*?\*\//g, '');
    const lines = contentWithoutComments.split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('//');
      })
      .join('\n');

    let match;
    while ((match = importRegex.exec(lines)) !== null) {
      const importPath = match[1];
      const currentDir = dirname(filePath);

      const resolvedPath = await this.findModuleFile(importPath, currentDir, basePath);
      if (resolvedPath && !dependencies.includes(resolvedPath)) {
        dependencies.push(resolvedPath);
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

  private async tryFindFile(basePath: string, filePath: string, options: ScanOptions): Promise<FileInfo | null> {
    try {
      const stats = await stat(filePath);
      if (options.maxFileSize && stats.size > options.maxFileSize) {
        return null;
      }

      const content = await readFile(filePath, 'utf-8');
      // 移除临时目录前缀，只保留项目相关路径
      const relativePath = filePath
        .replace(new RegExp(`^${basePath}/.*?/src/`), 'src/') // 处理带临时目录的路径
        .replace(new RegExp(`^${basePath}/`), '')             // 处理普通路径
        .replace(/\\/g, '/');                                 // 统一使用正斜杠

      return {
        path: relativePath,
        content,
        size: stats.size
      };
    } catch (error) {
      return null;
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

      // 获取基础路径和文件名部分
      const pathParts = normalizedPath.split('/');
      const fileName = pathParts.pop() || '';
      const dirPath = pathParts.join('/');

      // 构建完整的基础路径，包括可能的 src 目录
      const possibleBasePaths = [
        join(basePath, dirPath),
        join(basePath, 'src', dirPath),
        // 处理临时目录的情况
        ...glob.sync(`${basePath}/*/src/${dirPath}`, { absolute: true })
      ];

      // 可能的文件扩展名
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue'];

      // 如果路径没有扩展名，尝试多种可能性
      if (!fileName.includes('.')) {
        for (const currentBasePath of possibleBasePaths) {
          // 1. 尝试直接添加扩展名
          for (const ext of extensions) {
            const fullPath = join(currentBasePath, fileName + ext);
            const result = await this.tryFindFile(basePath, fullPath, options);
            if (result) return result;
          }

          // 2. 尝试作为目录查找 index 文件
          const dirFullPath = join(currentBasePath, fileName);
          for (const ext of extensions) {
            const indexPath = join(dirFullPath, 'index' + ext);
            const result = await this.tryFindFile(basePath, indexPath, options);
            if (result) return result;
          }
        }

        console.warn(
          `Warning: Could not find file ${fileName} in any possible location`
        );
      } else {
        // 文件名已有扩展名，尝试所有可能的基础路径
        for (const currentBasePath of possibleBasePaths) {
          const fullPath = join(currentBasePath, fileName);
          const result = await this.tryFindFile(basePath, fullPath, options);
          if (result) return result;
        }

        console.warn(`Warning: Could not find file ${normalizedPath}`);
      }

      return null;
    } catch (error) {
      console.warn(`Warning: Failed to process file ${relativePath}: ${error}`);
      return null;
    }
  }
} 