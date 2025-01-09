import { PATH_ALIASES, FILE_EXTENSIONS } from './path-utils';
import { join } from 'path';

// 解析导入路径
export function resolveImportPath(currentFile: string, importPath: string, nodes: Map<string, Set<string>>): string | null {
  function tryResolveWithExtensions(basePath: string): string | null {
    if (nodes.has(basePath)) {
      return basePath;
    }

    for (const ext of FILE_EXTENSIONS) {
      const pathWithExt = basePath + ext;
      if (nodes.has(pathWithExt)) {
        return pathWithExt;
      }
    }

    for (const ext of FILE_EXTENSIONS) {
      const indexPath = join(basePath, 'index' + ext).replace(/\\/g, '/');
      if (nodes.has(indexPath)) {
        return indexPath;
      }
    }

    const pathVariations = [
      basePath.replace(/^.*?\/src\//, 'src/'),
      basePath.replace(/^.*?\/src\//, '')
    ];

    for (const path of pathVariations) {
      if (nodes.has(path)) {
        return path;
      }

      for (const ext of FILE_EXTENSIONS) {
        const pathWithExt = path + ext;
        if (nodes.has(pathWithExt)) {
          return pathWithExt;
        }
        const indexPath = join(path, 'index' + ext).replace(/\\/g, '/');
        if (nodes.has(indexPath)) {
          return indexPath;
        }
      }
    }

    return null;
  }

  for (const [alias, realPath] of Object.entries(PATH_ALIASES)) {
    if (importPath.startsWith(alias + '/')) {
      const resolvedPath = importPath.replace(alias, realPath);
      return tryResolveWithExtensions(resolvedPath);
    }
  }

  if (importPath.startsWith('/')) {
    const resolvedPath = importPath.slice(1);
    return tryResolveWithExtensions(resolvedPath);
  }

  if (importPath.startsWith('.')) {
    const currentDir = currentFile.split('/').slice(0, -1).join('/');
    const importParts = importPath.split('/');
    const importFileName = importParts.pop() || '';
    const importDirPath = importParts.join('/');

    let resolvedBasePath = importPath.startsWith('./')
      ? join(currentDir, importDirPath).replace(/\\/g, '/')
      : importPath.startsWith('../')
        ? join(currentDir, '..', importDirPath).replace(/\\/g, '/')
        : join(currentDir, importDirPath).replace(/\\/g, '/');

    resolvedBasePath = resolvedBasePath.split('/').reduce((acc: string[], part: string) => {
      if (part === '..') {
        acc.pop();
      } else if (part !== '.') {
        acc.push(part);
      }
      return acc;
    }, []).join('/');

    if (importFileName.includes('.')) {
      const fullPath = join(resolvedBasePath, importFileName).replace(/\\/g, '/');
      return nodes.has(fullPath) ? fullPath : null;
    }

    return tryResolveWithExtensions(join(resolvedBasePath, importFileName).replace(/\\/g, '/'));
  }

  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return importPath;
  }

  return null;
}
// 生成依赖图

export function generateDependencyGraph(result: any, projectName: string = 'Project') {
  let graph = 'graph LR\n';
  const nodes = new Map<string, Set<string>>();
  const externalDeps = new Set<string>();
  const edges = new Map<string, Set<string>>();

  const rootNodeId = 'root';
  graph += `  ${rootNodeId}["${projectName}"]\n`;

  const ignoredExtensions = ['.css', '.less', '.scss', '.sass', '.style', '.styles'];

  const isStyleFile = (path: string) => {
    return ignoredExtensions.some(ext =>
      path.toLowerCase().endsWith(ext) || path.toLowerCase().includes(ext + '.')
    );
  };

  result.content.split('File: ').forEach((section: string) => {
    if (!section) return;
    const lines = section.split('\n');
    const filePath = lines[0].trim();

    if (isStyleFile(filePath)) return;

    const exports = new Set<string>();

    lines.forEach((line: string) => {
      const classMatch = line.match(/export\s+class\s+(\w+)/);
      if (classMatch) {
        exports.add(classMatch[1]);
      }

      const typeMatch = line.match(/export\s+(type|interface)\s+(\w+)/);
      if (typeMatch) {
        exports.add(typeMatch[2]);
      }

      const constMatch = line.match(/export\s+(?:const|function)\s+(\w+)/);
      if (constMatch) {
        exports.add(constMatch[1]);
      }
    });

    nodes.set(filePath, exports);
  });

  const nodeIds = new Map<string, string>();
  Array.from(nodes.keys()).forEach((file, index) => {
    nodeIds.set(file, `n${index}`);
  });

  nodes.forEach((exports, file) => {
    const nodeId = nodeIds.get(file) || '';
    graph += `  ${nodeId}["${file}"]\n`;
    graph += `  ${rootNodeId} --> ${nodeId}\n`;
  });

  let externalNodeCount = 0;
  const externalNodeIds = new Map<string, string>();

  result.content.split('File: ').forEach((section: string) => {
    if (!section) return;
    const lines = section.split('\n');
    const currentFile = lines[0].trim();

    if (isStyleFile(currentFile)) return;

    const currentId = nodeIds.get(currentFile);
    if (!currentId) return;

    lines.forEach((line: string) => {
      const fileExt = currentFile.split('.').pop() || '';
      const importMatches = getImportMatches(line, fileExt);

      for (const match of importMatches) {
        if (!match) continue;

        const from = match[match.length - 1];
        let importItems = '';
        if (match[1] && match[2]) {
          importItems = match[1];
        } else if (match[1]) {
          importItems = match[1];
        }

        if (isStyleFile(from)) continue;

        if (!from.startsWith('.')) {
          if (!externalNodeIds.has(from)) {
            const extId = `ext${externalNodeCount++}`;
            externalNodeIds.set(from, extId);
            graph += `  ${extId}["${from}"]\n`;
          }
          const edgeKey = `${currentId},${externalNodeIds.get(from)}`;
          if (!edges.has(edgeKey)) {
            edges.set(edgeKey, new Set([importItems]));
          } else {
            edges.get(edgeKey)?.add(importItems);
          }
          continue;
        }

        const importPath = resolveImportPath(currentFile, from, nodes);
        if (importPath && !isStyleFile(importPath)) {
          const targetId = nodeIds.get(importPath);
          if (targetId) {
            const edgeKey = `${currentId},${targetId}`;
            if (!edges.has(edgeKey)) {
              edges.set(edgeKey, new Set([importItems]));
            } else {
              edges.get(edgeKey)?.add(importItems);
            }
          }
        }
      }
    });
  });

  edges.forEach((importItems, key) => {
    const [fromId, toId] = key.split(',');
    const label = Array.from(importItems).filter(Boolean).join(', ');
    graph += label
      ? `  ${fromId} -->|"${label}"| ${toId}\n`
      : `  ${fromId} --> ${toId}\n`;
  });

  return graph;
}

// 获取导入匹配
export function getImportMatches(line: string, fileExtension: string) {
  const patterns = {
    ts: [
      line.match(/import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/),
      line.match(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/),
      line.match(/import\s+\*\s+as\s+\w+\s+from\s+['"]([^'"]+)['"]/),
      line.match(/import\s+['"]([^'"]+)['"]/),
      line.match(/import\s+type\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/),
    ],
    js: [
      line.match(/import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/),
      line.match(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/),
      line.match(/import\s+\*\s+as\s+\w+\s+from\s+['"]([^'"]+)['"]/),
      line.match(/import\s+['"]([^'"]+)['"]/),
    ],
    py: [
      line.match(/^import\s+(\w+)/),
      line.match(/from\s+([.\w]+)\s+import\s+(.+)/),
      line.match(/import\s+([.\w]+)\s+as\s+\w+/),
      line.match(/from\s+([.\w]+)\s+import\s+\w+\s+as\s+\w+/),
      line.match(/from\s+([.\w]+)\s+import\s+\(([^)]+)\)/),
      line.match(/from\s+(\.+)([.\w]*)\s+import\s+(.+)/),
    ],
    go: [
      line.match(/import\s+([^\s]+)\s+([^\s]+)/),
      line.match(/import\s+\(\s*([^)]+)\s*\)/),
    ],
    java: [
      line.match(/import\s+([^;]+);/),
      line.match(/import\s+([^.]+\.[^;]+);/),
      line.match(/import\s+([^.]+)\.([^;]+)\*;/),
      line.match(/import\s+static\s+([^;]+);/),
      line.match(/import\s+static\s+([^.]+)\.([^;]+)\*;/),
    ],
  };

  const ext = fileExtension.toLowerCase().replace('.', '') as keyof typeof patterns;
  const matchPatterns = patterns[ext] || patterns.ts;

  return matchPatterns.filter(Boolean);
} 