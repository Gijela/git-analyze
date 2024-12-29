import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export interface DependencyNode {
  filePath: string;
  imports: string[];
  exports: string[];
  dependencies: Set<string>;
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  cycles: string[][];
}

interface FileTypeHandler {
  extensions: string[];
  extractImports: (content: string) => string[];
  extractExports: (content: string) => string[];
}

export class DependencyAnalyzer {
  private graph: DependencyGraph = {
    nodes: new Map(),
    cycles: []
  };

  private fileTypeHandlers: FileTypeHandler[] = [
    // TypeScript/JavaScript 处理器
    {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      extractImports: (content: string) => {
        const imports: string[] = [];
        const patterns = [
          /import\s+.*?from\s+['"]([^'"]+)['"]/g,
          /import\s+['"]([^'"]+)['"]/g,
          /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
          /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
        ];

        patterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            imports.push(match[1]);
          }
        });

        return [...new Set(imports)];
      },
      extractExports: (content: string) => {
        const exports: string[] = [];
        const patterns = [
          /export\s+(?:default\s+)?(?:class|interface|type|const|let|var|function)\s+(\w+)/g,
          /export\s*{\s*([^}]+)}/g
        ];

        patterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            if (pattern.source.includes('[^}]+')) {
              // 处理 export { ... } 语法
              match[1].split(',').forEach(exp => {
                const name = exp.trim().split(/\s+as\s+/)[0].trim();
                if (name) exports.push(name);
              });
            } else {
              exports.push(match[1]);
            }
          }
        });

        return [...new Set(exports)];
      }
    },
    // Vue 文件处理器
    {
      extensions: ['.vue'],
      extractImports: (content: string) => {
        const imports: string[] = [];
        // 处理<script>标签中的导入
        const scriptMatch = content.match(/<script\b[^>]*>([\s\S]*?)<\/script>/);
        if (scriptMatch) {
          const scriptContent = scriptMatch[1];
          imports.push(...DependencyAnalyzer.defaultImportExtractor(scriptContent));
        }
        return [...new Set(imports)];
      },
      extractExports: (content: string) => {
        const exports: string[] = [];
        const scriptMatch = content.match(/<script\b[^>]*>([\s\S]*?)<\/script>/);
        if (scriptMatch) {
          const scriptContent = scriptMatch[1];
          exports.push(...DependencyAnalyzer.defaultExportExtractor(scriptContent));
        }
        return [...new Set(exports)];
      }
    },
    // CSS/SCSS/LESS 处理器
    {
      extensions: ['.css', '.scss', '.less'],
      extractImports: (content: string) => {
        const imports: string[] = [];
        const patterns = [
          /@import\s+['"]([^'"]+)['"]/g,
          /@import\s+url\(['"]([^'"]+)['"]\)/g
        ];

        patterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            imports.push(match[1]);
          }
        });

        return [...new Set(imports)];
      },
      extractExports: () => [] // CSS 文件没有导出
    }
  ];

  constructor(private rootDir: string) { }

  private static defaultImportExtractor(content: string): string[] {
    const imports: string[] = [];
    const patterns = [
      /import\s+.*?from\s+['"]([^'"]+)['"]/g,
      /import\s+['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        imports.push(match[1]);
      }
    });

    return imports;
  }

  private static defaultExportExtractor(content: string): string[] {
    const exports: string[] = [];
    const patterns = [
      /export\s+(?:default\s+)?(?:class|interface|type|const|let|var|function)\s+(\w+)/g,
      /export\s*{\s*([^}]+)}/g
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (pattern.source.includes('[^}]+')) {
          match[1].split(',').forEach(exp => {
            const name = exp.trim().split(/\s+as\s+/)[0].trim();
            if (name) exports.push(name);
          });
        } else {
          exports.push(match[1]);
        }
      }
    });

    return exports;
  }

  /**
   * 分析项目的依赖关系
   */
  async analyze(entryPath: string): Promise<DependencyGraph> {
    await this.buildDependencyGraph(entryPath);
    this.detectCycles();
    return this.graph;
  }

  /**
   * 构建依赖图
   */
  private async buildDependencyGraph(filePath: string, visited = new Set<string>()): Promise<void> {
    const absolutePath = path.resolve(this.rootDir, filePath);

    if (visited.has(absolutePath)) {
      return;
    }

    visited.add(absolutePath);

    try {
      const content = await readFile(absolutePath, 'utf-8');
      const dependencies = await this.extractDependencies(content, filePath);

      this.graph.nodes.set(filePath, {
        filePath,
        imports: dependencies,
        exports: this.extractExports(content, filePath),
        dependencies: new Set(dependencies)
      });

      // 递归分析依赖
      for (const dep of dependencies) {
        if (dep) {  // 只处理有效的依赖路径
          await this.buildDependencyGraph(dep, visited);
        }
      }
    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error);
    }
  }

  /**
   * 提取文件中的依赖
   */
  private async extractDependencies(content: string, currentFile: string): Promise<string[]> {
    const ext = path.extname(currentFile).toLowerCase();
    const handler = this.fileTypeHandlers.find(h => h.extensions.includes(ext));

    if (!handler) {
      return [];
    }

    const imports = handler.extractImports(content);
    const resolvedImports: string[] = [];

    for (const imp of imports) {
      const resolvedPath = await this.resolvePath(imp, currentFile);
      if (resolvedPath) {
        resolvedImports.push(resolvedPath);
      }
    }

    return resolvedImports;
  }

  /**
   * 提取导出内容
   */
  private extractExports(content: string, currentFile: string): string[] {
    const ext = path.extname(currentFile).toLowerCase();
    const handler = this.fileTypeHandlers.find(h => h.extensions.includes(ext));
    return handler ? handler.extractExports(content) : [];
  }

  /**
   * 解析依赖路径
   */
  private async resolvePath(importPath: string, currentFile: string): Promise<string> {
    // 处理相对路径
    if (importPath.startsWith('.')) {
      // 将.js扩展名替换为.ts
      const normalizedPath = importPath.replace(/\.js$/, '.ts');
      const absolutePath = path.resolve(path.dirname(currentFile), normalizedPath);
      return this.resolveExtension(absolutePath);
    }

    // 处理绝对路径（项目内）
    if (importPath.startsWith('/')) {
      // 将.js扩展名替换为.ts
      const normalizedPath = importPath.replace(/\.js$/, '.ts');
      return this.resolveExtension(path.join(this.rootDir, normalizedPath));
    }

    // 处理node_modules（暂时忽略外部依赖）
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return '';
    }

    return importPath;
  }

  /**
   * 解析文件扩展名
   */
  private async resolveExtension(filePath: string): Promise<string> {
    // 优先检查.ts扩展名
    const tsPath = `${filePath}.ts`;
    if (await this.fileExists(tsPath)) {
      return tsPath;
    }

    // 检查原始路径
    if (await this.fileExists(filePath)) {
      return filePath;
    }

    // 检查其他扩展名
    const extensions = ['.tsx', '.js', '.jsx'];
    for (const ext of extensions) {
      const pathWithExt = `${filePath}${ext}`;
      if (await this.fileExists(pathWithExt)) {
        return pathWithExt;
      }
    }

    // 检查index文件，优先使用.ts
    const tsIndexPath = path.join(filePath, 'index.ts');
    if (await this.fileExists(tsIndexPath)) {
      return tsIndexPath;
    }

    // 检查其他index文件
    for (const ext of extensions) {
      const indexPath = path.join(filePath, `index${ext}`);
      if (await this.fileExists(indexPath)) {
        return indexPath;
      }
    }

    return filePath;
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const stats = await stat(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * 检测循环依赖
   */
  private detectCycles(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, path: string[] = []): void => {
      if (recursionStack.has(node)) {
        const cycleStart = path.indexOf(node);
        this.graph.cycles.push(path.slice(cycleStart));
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const dependencies = this.graph.nodes.get(node)?.dependencies || new Set();
      for (const dep of dependencies) {
        dfs(dep, [...path]);
      }

      recursionStack.delete(node);
    };

    for (const node of this.graph.nodes.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }
  }
}
