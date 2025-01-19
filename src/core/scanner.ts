import { glob } from "glob";
import { readFile, stat } from "fs/promises";
import type { FileInfo } from "../types/index";
import { FileProcessError, ValidationError } from "./errors";
import { dirname, join } from "path";
import { estimateTokens } from "../utils";

interface ScanOptions {
  maxFileSize?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  targetPaths?: string[];
  includeDependencies?: boolean;
}

const BINARY_FILE_TYPES = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
];

export class FileScanner {
  protected processedFiles: Set<string> = new Set();

  // 查找模块文件
  private async findModuleFile(
    importPath: string,
    currentDir: string,
    basePath: string
  ): Promise<string | null> {
    // 处理外部依赖
    if (!importPath.startsWith(".")) {
      return importPath; // 直接返回包名，让依赖图生成器处理
    }

    // 清理当前目录路径，移除临时目录部分
    const cleanCurrentDir = currentDir
      .replace(new RegExp(`^${basePath}/.*?/src/`), "src/")
      .replace(new RegExp(`^${basePath}/`), "");

    // 解析基础目录路径
    const resolvedPath = join(cleanCurrentDir, importPath).replace(/\\/g, "/");
    const pathParts = resolvedPath.split("/");
    const fileName = pathParts.pop() || "";
    const dirPath = pathParts.join("/");

    // 可能的文件扩展名，根据导入文件类型调整优先级
    const getExtensions = (importName: string) => {
      if (importName.toLowerCase().endsWith(".css")) {
        return [".css", ".less", ".scss", ".sass"];
      }
      return [".tsx", ".ts", ".jsx", ".js", ".vue"];
    };

    const extensions = getExtensions(fileName);

    const targetBasePath = join(basePath, dirPath);

    // 构建可能的基础路径
    // const possibleBasePaths = [
    //   join(basePath, dirPath),
    //   join(basePath, 'src', dirPath),
    //   ...glob.sync(`${basePath}/*/src/${dirPath}`, { absolute: true })
    // ];

    // 如果文件名没有扩展名
    if (!fileName.includes(".")) {
      // for (const currentBasePath of possibleBasePaths) {
      // 1. 尝试直接添加扩展名
      for (const ext of extensions) {
        const fullPath = join(targetBasePath, fileName + ext);
        try {
          const stats = await stat(fullPath);
          if (stats.isFile()) {
            // 返回清理过的路径
            return join(dirPath, fileName + ext)
              .replace(new RegExp(`^${basePath}/`), "")
              .replace(/\\/g, "/");
          }
        } catch (error) {
          continue;
        }
      }

      // 2. 尝试查找 index 文件
      const dirFullPath = join(targetBasePath, fileName);
      try {
        const stats = await stat(dirFullPath);
        if (stats.isDirectory()) {
          for (const ext of extensions) {
            const indexPath = join(dirFullPath, "index" + ext);
            try {
              const indexStats = await stat(indexPath);
              if (indexStats.isFile()) {
                return join(dirPath, fileName, "index" + ext)
                  .replace(new RegExp(`^${basePath}/`), "")
                  .replace(/\\/g, "/");
              }
            } catch (error) {
              continue;
            }
          }
        }
      } catch (error) {
        // continue;
      }
      // }
    } else {
      // 文件名已有扩展名，尝试所有可能的基础路径
      // for (const currentBasePath of possibleBasePaths) {
      const fullPath = join(targetBasePath, fileName);
      try {
        const stats = await stat(fullPath);
        if (stats.isFile()) {
          return join(dirPath, fileName)
            .replace(new RegExp(`^${basePath}/`), "")
            .replace(/\\/g, "/");
        }
      } catch (error) {
        // continue;
      }
      // }
    }

    return null;
  }

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

  // 扫描目录
  async scanDirectory(path: string, options: ScanOptions): Promise<FileInfo[]> {
    if (!path) {
      throw new ValidationError("Path is required");
    }

    try {
      // 清除已处理文件
      this.processedFiles.clear();
      const allFiles: FileInfo[] = [];

      // 如果指定了目标文件路径，则扫描目标文件及其依赖文件
      if (options.targetPaths && options.targetPaths.length > 0) {
        for (const targetPath of options.targetPaths) {
          // [核心步骤三]: 扫描目标文件及其依赖文件
          await this.processFileAndDependencies(
            path,
            targetPath,
            options,
            allFiles
          );
        }
        return allFiles;
      }

      const files = await glob("**/*", {
        cwd: path,
        ignore: [
          ...(options.excludePatterns || []),
          "**/node_modules/**",
          "**/.git/**",
        ],
        nodir: true,
        absolute: false,
        windowsPathsNoEscape: true,
      });

      const results = await Promise.all(
        files.map((file) => this.processFile(path, file, options))
      );

      return results.filter((file): file is FileInfo => file !== null);
    } catch (error) {
      throw new FileProcessError(path, (error as Error).message);
    }
  }

  // 扫描目标文件及其依赖文件
  private async processFileAndDependencies(
    basePath: string,
    relativePath: string,
    options: ScanOptions,
    allFiles: FileInfo[]
  ): Promise<void> {
    if (this.processedFiles.has(relativePath)) {
      return;
    }

    /**
     * 核心步骤四: 扫描目标文件
     * 示例: fileInfo: { path: 'src/components/Button/index.ts', content: '...', size: 1024 }
     */
    const fileInfo = await this.processFile(basePath, relativePath, options);
    // 如果文件存在，则添加到已处理文件集合，并添加到结果数组
    if (fileInfo) {
      this.processedFiles.add(relativePath);
      allFiles.push(fileInfo);

      // [依赖文件按需分析]: 如果 includeDependencies 为 true，则分析依赖文件
      if (options.includeDependencies !== false) {
        // 分析依赖文件
        const dependencies = await this.analyzeDependencies(
          fileInfo.content,
          relativePath,
          basePath
        );
        // 遍历依赖文件，递归扫描依赖文件
        for (const dep of dependencies) {
          await this.processFileAndDependencies(
            basePath,
            dep,
            options,
            allFiles
          );
        }
      }
    }
  }

  // 尝试查找文件
  private async tryFindFile(
    basePath: string,
    filePath: string,
    options: ScanOptions
  ): Promise<FileInfo | null> {
    try {
      const stats = await stat(filePath);
      if (options.maxFileSize && stats.size > options.maxFileSize) {
        return null;
      }

      // [核心步骤六]: 读取文件内容
      const content = await readFile(filePath, "utf-8");
      /**
       * @desc 移除临时目录前缀，只保留项目相关路径
       * 示例:
       * filePath: repo/github101-250644/src/core/gitAction.ts
       * basePath: 'repo/github101-492772'
       * relativePath: repo/github101-250644/src/core/gitAction.ts
       */
      const basePathParts = basePath.split("/"); // eg: ['repo', 'github101-492772']
      const deleteHashRepoName = basePathParts[
        basePathParts.length - 1
      ].replace(/-[^-]*$/, ""); // github101
      const relativePath = filePath
        .replace(new RegExp(`^${basePathParts[0]}/`), "") // 去除临时目录前缀 repo/
        .replace(
          new RegExp(`^${basePathParts[basePathParts.length - 1]}`),
          deleteHashRepoName
        ) // 去掉[-hash]
        .replace(/\\/g, "/"); // 统一使用正斜杠

      return {
        path: relativePath,
        content,
        // size: stats.size,
        token: estimateTokens(content),
      };
    } catch (error) {
      return null;
    }
  }

  // 扫描文件
  private async processFile(
    basePath: string,
    relativePath: string,
    options: ScanOptions
  ): Promise<FileInfo | null> {
    try {
      // 获取文件扩展名
      const ext = relativePath.toLowerCase().split(".").pop();
      // 如果文件是二进制文件，则跳过
      if (ext && BINARY_FILE_TYPES.includes(`.${ext}`)) {
        return null;
      }

      /**
       * @desc 规范化路径
       * 示例:
       * relativePath: src/components/Button/index.ts
       * normalizedPath: src/components/Button/index.ts
       */
      const normalizedPath = relativePath
        .replace(/^[\/\\]+/, "") // 移除开头的斜杠
        .replace(/\\/g, "/"); // 统一使用正斜杠

      /**
       * @desc 获取基础路径和文件名部分
       * 示例:
       * normalizedPath: src/components/Button/index.ts
       * pathParts: ['src', 'components', 'Button', 'index.ts']
       * fileName: 'index.ts'
       * dirPath: 'src/components/Button'
       * targetBasePath: ${basePath}/src/components/Button
       */
      const pathParts = normalizedPath.split("/");
      const fileName = pathParts.pop() || "";
      const dirPath = pathParts.join("/");
      const targetBasePath = join(basePath, dirPath);

      // 可能的文件扩展名
      const extensions = [".ts", ".tsx", ".js", ".jsx", ".vue"];

      // [核心步骤五]: tryFindFile 尝试查找文件
      // 如果路径没有扩展名，尝试多种可能性
      if (!fileName.includes(".")) {
        // 1. 尝试直接添加扩展名
        for (const ext of extensions) {
          const fullPath = join(targetBasePath, fileName + ext);
          const result = await this.tryFindFile(basePath, fullPath, options);
          if (result) return result;
        }

        // 2. 尝试作为目录查找 index 文件
        const dirFullPath = join(targetBasePath, fileName);
        for (const ext of extensions) {
          const indexPath = join(dirFullPath, "index" + ext);
          const result = await this.tryFindFile(basePath, indexPath, options);
          if (result) return result;
        }
      } else {
        // 文件名已有扩展名，尝试所有可能的基础路径
        const fullPath = join(targetBasePath, fileName);
        const result = await this.tryFindFile(basePath, fullPath, options);
        if (result) return result;
      }

      return null;
    } catch (error) {
      console.warn(`Warning: Failed to process file ${relativePath}: ${error}`);
      return null;
    }
  }
}
