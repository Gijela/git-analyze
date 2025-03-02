var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/core/gitAction.ts
import { simpleGit } from "simple-git";

// src/core/errors.ts
var GitIngestError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "GitIngestError";
  }
};
var GitOperationError = class extends GitIngestError {
  constructor(operation, details) {
    super(`Git operation '${operation}' failed: ${details}`);
    this.name = "GitOperationError";
  }
};
var FileProcessError = class extends GitIngestError {
  constructor(path3, reason) {
    super(`Failed to process file '${path3}': ${reason}`);
    this.name = "FileProcessError";
  }
};
var ValidationError = class extends GitIngestError {
  constructor(message) {
    super(`Validation failed: ${message}`);
    this.name = "ValidationError";
  }
};

// src/core/gitAction.ts
var GitAction = class {
  constructor() {
    this.git = simpleGit({ baseDir: process.cwd() });
  }
  clone(url, path3) {
    return __async(this, null, function* () {
      try {
        yield this.git.clone(url, path3);
      } catch (error) {
        throw new GitOperationError("clone", error.message);
      }
    });
  }
  checkoutBranch(path3, branch) {
    return __async(this, null, function* () {
      try {
        const git = simpleGit(path3);
        yield git.checkout(branch);
      } catch (error) {
        throw new GitOperationError("checkout", error.message);
      }
    });
  }
};

// src/core/scanner.ts
import { glob } from "glob";
import { readFile, stat } from "fs/promises";
import { dirname, join } from "path";

// src/utils/graphSearch.ts
function findRelatedNodes(graph, startNodes, maxDistance) {
  const relatedNodes = /* @__PURE__ */ new Set();
  const relatedEdges = /* @__PURE__ */ new Set();
  const processedNodeIds = /* @__PURE__ */ new Set();
  function processNode(node, distance) {
    if (distance > maxDistance || processedNodeIds.has(node.id)) return;
    processedNodeIds.add(node.id);
    relatedNodes.add(node);
    const directEdges = graph.edges.filter(
      (edge) => edge.source === node.id || edge.target === node.id
    );
    directEdges.forEach((edge) => {
      relatedEdges.add(edge);
      const otherId = edge.source === node.id ? edge.target : edge.source;
      const otherNode = graph.nodes.find((n) => n.id === otherId);
      if (otherNode && !processedNodeIds.has(otherNode.id)) {
        processNode(otherNode, distance + 1);
      }
    });
    if (node.type === "class") {
      const methodNodes = graph.nodes.filter((n) => {
        if (n.type !== "function" && n.type !== "class_method") return false;
        if (n.filePath !== node.filePath) return false;
        if (n.name === "constructor") return false;
        const classNode = graph.nodes.find(
          (c) => c.type === "class" && c.filePath === n.filePath && c.id === n.id.split("#")[0] + "#" + node.name
        );
        return classNode !== void 0;
      });
      methodNodes.forEach((methodNode) => {
        if (!processedNodeIds.has(methodNode.id)) {
          const edge = {
            source: node.id,
            target: methodNode.id,
            type: "defines",
            properties: {}
          };
          relatedEdges.add(edge);
          processNode(methodNode, distance + 1);
        }
      });
    }
    if (node.type === "class" && node.name.endsWith("Error")) {
      const parentNode = graph.nodes.find((n) => n.name === "Error");
      if (parentNode && !processedNodeIds.has(parentNode.id)) {
        const edge = {
          source: node.id,
          target: "Error",
          type: "extends",
          properties: {}
        };
        relatedEdges.add(edge);
        processNode(parentNode, distance + 1);
      }
    }
  }
  startNodes.forEach((node) => processNode(node, 0));
  return {
    nodes: Array.from(relatedNodes),
    edges: Array.from(relatedEdges)
  };
}
function searchKnowledgeGraph(graph, options) {
  const { entities, maxDistance = 2 } = options;
  const startNodes = graph.nodes.filter(
    (node) => entities.some((entity) => node.name === entity)
  );
  if (!startNodes.length) {
    console.warn(`[Warning] No nodes found for entities:`, entities);
    return {
      nodes: [],
      edges: [],
      metadata: {
        totalNodes: 0,
        totalEdges: 0,
        entities,
        relationTypes: [],
        maxDistance
      }
    };
  }
  const { nodes, edges } = findRelatedNodes(graph, startNodes, maxDistance);
  const methodNodes = nodes.filter((n) => n.type === "function" || n.type === "class_method");
  const classNodes = nodes.filter((n) => n.type === "class");
  methodNodes.forEach((method) => {
    const className = method.id.split("#")[1];
    const relatedClass = classNodes.find((c) => c.name === className);
    if (relatedClass) {
      edges.push({
        source: relatedClass.id,
        target: method.id,
        type: "defines",
        properties: {}
      });
    }
  });
  const errorClasses = classNodes.filter((n) => n.name.endsWith("Error"));
  errorClasses.forEach((errorClass) => {
    edges.push({
      source: errorClass.id,
      target: "Error",
      type: "extends",
      properties: {}
    });
  });
  return {
    nodes,
    edges,
    metadata: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      entities,
      relationTypes: Array.from(new Set(edges.map((e) => e.type))),
      maxDistance
    }
  };
}

// src/utils/index.ts
function estimateTokens(text) {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  const estimatedTokens = chineseChars * 2 + Math.ceil(otherChars / 4);
  return Math.ceil(estimatedTokens * 1.1);
}
function generateTree(files) {
  const tree = {};
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
  function stringify(node, prefix = "") {
    let result = "";
    const entries = Object.entries(node);
    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];
      const isLast = i === entries.length - 1;
      const connector = isLast ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 ";
      const childPrefix = isLast ? "    " : "\u2502   ";
      result += prefix + connector + key + "\n";
      if (value !== null) {
        result += stringify(value, prefix + childPrefix);
      }
    }
    return result;
  }
  return stringify(tree);
}
function buildSizeTree(files) {
  const root = {
    name: "root",
    token: 0,
    children: {},
    isFile: false
  };
  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLastPart = i === parts.length - 1;
      if (!current.children[part]) {
        current.children[part] = __spreadProps(__spreadValues({
          name: part,
          token: isLastPart ? file.token : 0
        }, isLastPart && file.content ? { content: file.content } : {}), {
          children: {},
          isFile: isLastPart
        });
      }
      current = current.children[part];
    }
  }
  function calculateSize(node) {
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

// src/core/scanner.ts
var BINARY_FILE_TYPES = [
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
  ".svg",
  ".ico",
  ".webp",
  ".mp4",
  ".mp3",
  ".wav",
  ".avi"
];
var FileScanner = class {
  constructor() {
    this.processedFiles = /* @__PURE__ */ new Set();
  }
  // 查找模块文件
  findModuleFile(importPath, currentDir, basePath) {
    return __async(this, null, function* () {
      if (!importPath.startsWith(".")) {
        return importPath;
      }
      const cleanCurrentDir = currentDir.replace(new RegExp(`^${basePath}/.*?/src/`), "src/").replace(new RegExp(`^${basePath}/`), "");
      const resolvedPath = join(cleanCurrentDir, importPath).replace(/\\/g, "/");
      const pathParts = resolvedPath.split("/");
      const fileName = pathParts.pop() || "";
      const dirPath = pathParts.join("/");
      const getExtensions = (importName) => {
        if (importName.toLowerCase().endsWith(".css")) {
          return [".css", ".less", ".scss", ".sass"];
        }
        return [".tsx", ".ts", ".jsx", ".js", ".vue"];
      };
      const extensions = getExtensions(fileName);
      const targetBasePath = join(basePath, dirPath);
      if (!fileName.includes(".")) {
        for (const ext of extensions) {
          const fullPath = join(targetBasePath, fileName + ext);
          try {
            const stats = yield stat(fullPath);
            if (stats.isFile()) {
              return join(dirPath, fileName + ext).replace(new RegExp(`^${basePath}/`), "").replace(/\\/g, "/");
            }
          } catch (error) {
            continue;
          }
        }
        const dirFullPath = join(targetBasePath, fileName);
        try {
          const stats = yield stat(dirFullPath);
          if (stats.isDirectory()) {
            for (const ext of extensions) {
              const indexPath = join(dirFullPath, "index" + ext);
              try {
                const indexStats = yield stat(indexPath);
                if (indexStats.isFile()) {
                  return join(dirPath, fileName, "index" + ext).replace(new RegExp(`^${basePath}/`), "").replace(/\\/g, "/");
                }
              } catch (error) {
                continue;
              }
            }
          }
        } catch (error) {
        }
      } else {
        const fullPath = join(targetBasePath, fileName);
        try {
          const stats = yield stat(fullPath);
          if (stats.isFile()) {
            return join(dirPath, fileName).replace(new RegExp(`^${basePath}/`), "").replace(/\\/g, "/");
          }
        } catch (error) {
        }
      }
      return null;
    });
  }
  // [依赖文件按需分析]: 分析依赖文件
  analyzeDependencies(content, filePath, basePath) {
    return __async(this, null, function* () {
      const dependencies = [];
      const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
      const contentWithoutComments = content.replace(/\/\*[\s\S]*?\*\//g, "");
      const lines = contentWithoutComments.split("\n").filter((line) => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith("//");
      }).join("\n");
      let match;
      while ((match = importRegex.exec(lines)) !== null) {
        const importPath = match[1];
        const currentDir = dirname(filePath);
        const resolvedPath = yield this.findModuleFile(
          importPath,
          currentDir,
          basePath
        );
        if (resolvedPath && !dependencies.includes(resolvedPath)) {
          dependencies.push(resolvedPath);
        }
      }
      return dependencies;
    });
  }
  // 扫描目录
  scanDirectory(path3, options) {
    return __async(this, null, function* () {
      if (!path3) {
        throw new ValidationError("Path is required");
      }
      try {
        this.processedFiles.clear();
        const allFiles = [];
        if (options.targetPaths && options.targetPaths.length > 0) {
          for (const targetPath of options.targetPaths) {
            yield this.processFileAndDependencies(
              path3,
              targetPath,
              options,
              allFiles
            );
          }
          return allFiles;
        }
        const files = yield glob("**/*", {
          cwd: path3,
          ignore: [
            ...options.excludePatterns || [],
            "**/node_modules/**",
            "**/.git/**"
          ],
          nodir: true,
          absolute: false,
          windowsPathsNoEscape: true
        });
        const results = yield Promise.all(
          files.map((file) => this.processFile(path3, file, options))
        );
        return results.filter((file) => file !== null);
      } catch (error) {
        throw new FileProcessError(path3, error.message);
      }
    });
  }
  // 扫描目标文件及其依赖文件
  processFileAndDependencies(basePath, relativePath, options, allFiles) {
    return __async(this, null, function* () {
      if (this.processedFiles.has(relativePath)) {
        return;
      }
      const fileInfo = yield this.processFile(basePath, relativePath, options);
      if (fileInfo) {
        this.processedFiles.add(relativePath);
        allFiles.push(fileInfo);
        if (options.includeDependencies !== false) {
          const dependencies = yield this.analyzeDependencies(
            fileInfo.content,
            relativePath,
            basePath
          );
          for (const dep of dependencies) {
            yield this.processFileAndDependencies(
              basePath,
              dep,
              options,
              allFiles
            );
          }
        }
      }
    });
  }
  // 尝试查找文件
  tryFindFile(basePath, filePath, options) {
    return __async(this, null, function* () {
      try {
        const stats = yield stat(filePath);
        if (options.maxFileSize && stats.size > options.maxFileSize) {
          return null;
        }
        const content = yield readFile(filePath, "utf-8");
        const basePathParts = basePath.split("/");
        const deleteHashRepoName = basePathParts[basePathParts.length - 1].replace(/-[^-]*$/, "");
        const relativePath = filePath.replace(new RegExp(`^${basePathParts[0]}/`), "").replace(
          new RegExp(`^${basePathParts[basePathParts.length - 1]}`),
          deleteHashRepoName
        ).replace(/\\/g, "/");
        return {
          path: relativePath,
          content,
          // size: stats.size,
          token: estimateTokens(content)
        };
      } catch (error) {
        return null;
      }
    });
  }
  // 扫描文件
  processFile(basePath, relativePath, options) {
    return __async(this, null, function* () {
      try {
        const ext = relativePath.toLowerCase().split(".").pop();
        if (ext && BINARY_FILE_TYPES.includes(`.${ext}`)) {
          return null;
        }
        const normalizedPath = relativePath.replace(/^[\/\\]+/, "").replace(/\\/g, "/");
        const pathParts = normalizedPath.split("/");
        const fileName = pathParts.pop() || "";
        const dirPath = pathParts.join("/");
        const targetBasePath = join(basePath, dirPath);
        const extensions = [".ts", ".tsx", ".js", ".jsx", ".vue"];
        if (!fileName.includes(".")) {
          for (const ext2 of extensions) {
            const fullPath = join(targetBasePath, fileName + ext2);
            const result = yield this.tryFindFile(basePath, fullPath, options);
            if (result) return result;
          }
          const dirFullPath = join(targetBasePath, fileName);
          for (const ext2 of extensions) {
            const indexPath = join(dirFullPath, "index" + ext2);
            const result = yield this.tryFindFile(basePath, indexPath, options);
            if (result) return result;
          }
        } else {
          const fullPath = join(targetBasePath, fileName);
          const result = yield this.tryFindFile(basePath, fullPath, options);
          if (result) return result;
        }
        return null;
      } catch (error) {
        console.warn(`Warning: Failed to process file ${relativePath}: ${error}`);
        return null;
      }
    });
  }
};

// src/core/codeAnalyzer.ts
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import path from "path";
var CodeAnalyzer = class {
  constructor() {
    this.codeElements = [];
    this.relations = [];
    this.currentFile = "";
    this.currentClass = null;
    this.currentFunctionId = null;
    this.scopeStack = [];
    this.parser = new Parser();
    this.parser.setLanguage(TypeScript.typescript);
  }
  /**
   * 分析代码文件
   */
  analyzeCode(filePath, sourceCode) {
    if (!filePath) {
      throw new Error("File path cannot be undefined");
    }
    this.currentFile = filePath;
    try {
      console.log(`[CodeAnalyzer] Processing file: ${filePath}`);
      const tree = this.parser.parse(sourceCode);
      console.log(`[CodeAnalyzer] AST generated for ${filePath}`);
      this.visitNode(tree.rootNode);
      console.log(`[CodeAnalyzer] Analysis complete for ${filePath}`);
      console.log(`[CodeAnalyzer] Found ${this.codeElements.length} nodes`);
      console.log(`[CodeAnalyzer] Found ${this.relations.length} relationships`);
    } catch (error) {
      console.error(`[CodeAnalyzer] Error analyzing file ${filePath}:`, error);
    }
  }
  /**
   * 访问 AST 节点
   */
  visitNode(node) {
    switch (node.type) {
      case "function_declaration":
      case "method_definition":
      // 添加方法定义
      case "arrow_function":
        this.analyzeFunctionDeclaration(node);
        break;
      case "class_declaration":
      case "class":
        this.analyzeClassDeclaration(node, this.currentFile);
        break;
      case "interface_declaration":
        this.analyzeInterface(node);
        break;
      case "type_alias_declaration":
        this.analyzeTypeAlias(node);
        break;
      case "call_expression":
      case "new_expression":
        this.analyzeCallExpression(node, this.scopeStack[this.scopeStack.length - 1]);
        break;
      case "import_declaration":
      case "import_statement":
        this.analyzeImportStatement(node, this.currentFile);
        break;
      case "variable_declaration":
        this.analyzeVariableDeclaration(node);
        break;
      case "implements_clause":
        this.analyzeImplementsRelation(node);
        break;
    }
    for (const child of node.children) {
      this.visitNode(child);
    }
  }
  /**
   * 分析函数声明
   */
  analyzeFunctionDeclaration(node) {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return;
    const element = {
      type: "function",
      name: nameNode.text,
      filePath: this.currentFile,
      location: {
        file: this.currentFile,
        line: nameNode.startPosition.row + 1
      },
      implementation: node.text
    };
    this.currentFunctionId = `${this.currentFile}#${nameNode.text}`;
    this.scopeStack.push(this.currentFunctionId);
    this.addCodeElement(element);
    this.currentFunctionId = null;
  }
  /**
   * 分析类声明
   */
  analyzeClassDeclaration(node, filePath) {
    const className = this.getNodeName(node);
    if (!className) return;
    const classElement = {
      type: "class",
      name: className,
      filePath: this.currentFile,
      location: {
        file: this.currentFile,
        line: node.startPosition.row + 1
      },
      implementation: node.text
    };
    this.addCodeElement(classElement);
    this.currentClass = className;
    const extendsClause = node.childForFieldName("extends");
    if (extendsClause) {
      const superClassName = this.getNodeName(extendsClause);
      if (superClassName) {
        const currentClassId = `${this.currentFile}#${className}`;
        const superClassId = this.resolveTypeReference(superClassName);
        if (superClassId) {
          console.log(`[Debug] Adding extends relation: ${className} extends ${superClassName}`);
          this.addRelation(currentClassId, superClassId, "extends");
        }
      }
    }
    for (const child of node.children) {
      if (child.type === "method_definition" || child.type === "constructor") {
        this.analyzeClassMethod(child, className);
      }
    }
    const implementsClause = node.childForFieldName("implements");
    if (implementsClause) {
      this.analyzeImplementsRelation(implementsClause);
    }
    this.currentClass = null;
  }
  /**
   * 分析接口声明
   */
  analyzeInterface(node) {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return;
    const element = {
      type: "interface",
      name: nameNode.text,
      filePath: this.currentFile,
      location: {
        file: this.currentFile,
        line: nameNode.startPosition.row + 1
      },
      id: `${this.currentFile}#Interface#${nameNode.text}`,
      implementation: node.text
    };
    this.addCodeElement(element);
  }
  /**
   * 分析函数调用
   */
  analyzeCallExpression(node, currentScope) {
    const calleeName = this.resolveCallee(node);
    if (calleeName) {
      const currentNode = this.codeElements.find((e) => e.id === currentScope);
      const calleeNode = this.codeElements.find((e) => e.id === calleeName);
      if (currentNode && calleeNode) {
        console.log(`[Debug] Found call expression:`, {
          caller: currentNode.name,
          callee: calleeNode.name,
          callerId: currentScope,
          calleeId: calleeName
        });
        this.addRelation(currentScope, calleeName, "calls");
      }
    }
  }
  /**
   * 分析导入声明
   */
  analyzeImportStatement(node, filePath) {
    const importPath = this.getImportPath(node);
    if (importPath) {
      console.log(`[Debug] Found import:`, {
        importer: filePath,
        imported: importPath
      });
      this.addRelation(filePath, importPath, "imports");
    }
  }
  normalizePath(importPath) {
    const builtinModules = ["fs", "path", "crypto", "util"];
    if (builtinModules.includes(importPath)) {
      return importPath;
    }
    const fullPath = path.resolve(path.dirname(this.currentFile), importPath);
    if (!fullPath.endsWith(".ts")) {
      return `${fullPath}.ts`;
    }
    return fullPath;
  }
  /**
   * 添加代码元素
   */
  addCodeElement(element) {
    const elementId = (() => {
      switch (element.type) {
        case "class":
          return `${element.filePath}#${element.name}`;
        case "class_method":
        case "constructor":
          return `${element.filePath}#${element.className}#${element.name}`;
        case "interface":
          return `${element.filePath}#Interface#${element.name}`;
        case "type_alias":
          return `${element.filePath}#Type#${element.name}`;
        default:
          return `${element.filePath}#${element.name}`;
      }
    })();
    const codeElement = __spreadProps(__spreadValues({}, element), {
      id: elementId
    });
    console.log(`[Debug] Adding code element:`, {
      type: element.type,
      name: element.name,
      id: elementId,
      className: "className" in element ? element.className : void 0
    });
    this.codeElements.push(codeElement);
  }
  /**
   * 添加关系
   */
  addRelation(source, target, type) {
    const sourceNode = this.codeElements.find((e) => e.id === source);
    const targetNode = this.codeElements.find((e) => e.id === target);
    if (!sourceNode) {
      console.warn(`[Warning] Source node not found: ${source}`);
      return;
    }
    if (!targetNode) {
      console.warn(`[Warning] Target node not found: ${target}`);
      return;
    }
    const relation = {
      sourceId: source,
      targetId: target,
      type
    };
    const exists = this.relations.some(
      (r) => r.sourceId === source && r.targetId === target && r.type === type
    );
    if (!exists) {
      this.relations.push(relation);
      console.log(`[Debug] Added relation: ${sourceNode.name} -[${type}]-> ${targetNode.name}`);
    }
  }
  /**
   * 获取代码索引
   */
  getCodeIndex() {
    const codeIndex = /* @__PURE__ */ new Map();
    this.codeElements.forEach((element) => {
      const filePath = element.filePath;
      const existingElements = codeIndex.get(filePath) || [];
      existingElements.push(element);
      codeIndex.set(filePath, existingElements);
    });
    return codeIndex;
  }
  /**
   * 获取知识图谱
   */
  getKnowledgeGraph() {
    console.log(`[Debug] Generating knowledge graph:`, {
      totalElements: this.codeElements.length,
      totalRelations: this.relations.length
    });
    const nodes = this.codeElements.map((element) => ({
      id: element.id,
      name: element.name,
      type: element.type,
      filePath: element.filePath,
      location: element.location,
      implementation: element.implementation || ""
      // 添加 implementation 字段
    }));
    const validRelations = this.relations.filter((relation) => {
      const sourceExists = this.codeElements.some((e) => e.id === relation.sourceId);
      const targetExists = this.codeElements.some((e) => e.id === relation.targetId);
      if (!sourceExists || !targetExists) {
        console.warn(`[Warning] Invalid relation:`, {
          source: relation.sourceId,
          target: relation.targetId,
          type: relation.type,
          sourceExists,
          targetExists
        });
        return false;
      }
      return true;
    });
    const edges = validRelations.map((relation) => ({
      source: relation.sourceId,
      target: relation.targetId,
      type: relation.type,
      properties: {}
    }));
    console.log(`[Debug] Knowledge graph generated:`, {
      nodes: nodes.length,
      edges: edges.length,
      relationTypes: new Set(edges.map((e) => e.type))
    });
    return { nodes, edges };
  }
  /**
   * 获取特定类型的所有元素
   */
  getElementsByType(type) {
    return this.codeElements.filter((element) => element.type === type);
  }
  /**
   * 获取特定元素的所有关系
   */
  getElementRelations(elementName) {
    return this.relations.filter(
      (edge) => edge.sourceId === elementName || edge.targetId === elementName
    );
  }
  /**
   * 导出分析结果
   */
  exportAnalysis() {
    return JSON.stringify({
      codeElements: this.codeElements,
      relations: this.relations
    }, null, 2);
  }
  // 添加变量声明分析
  analyzeVariableDeclaration(node) {
    const declarator = node.childForFieldName("declarator");
    const nameNode = declarator == null ? void 0 : declarator.childForFieldName("name");
    if (!nameNode) return;
    const element = {
      type: "variable",
      name: nameNode.text,
      filePath: this.currentFile,
      location: {
        file: this.currentFile,
        line: nameNode.startPosition.row + 1
      },
      implementation: node.text
    };
    this.addCodeElement(element);
  }
  validateAnalysis() {
    let isValid = true;
    const idSet = /* @__PURE__ */ new Set();
    this.codeElements.forEach((node) => {
      if (node.id && idSet.has(node.id)) {
        console.error(`[Validation] \u91CD\u590D\u8282\u70B9ID: ${node.id}`);
        isValid = false;
      }
      if (node.id) {
        idSet.add(node.id);
      }
    });
    this.relations.forEach((edge) => {
      const sourceExists = this.codeElements.some((e) => e.id === edge.sourceId);
      const targetExists = this.codeElements.some((e) => e.id === edge.targetId);
      if (!sourceExists) {
        console.error(`[Validation] \u65E0\u6548\u5173\u7CFB\u6E90: ${edge.sourceId}`);
        isValid = false;
      }
      if (!targetExists) {
        console.error(`[Validation] \u65E0\u6548\u5173\u7CFB\u76EE\u6807: ${edge.targetId}`);
        isValid = false;
      }
    });
    return isValid;
  }
  getNodeName(node) {
    const nameNode = node.childForFieldName("name");
    return nameNode == null ? void 0 : nameNode.text;
  }
  getImplementedInterfaces(node) {
    return node.text.replace("implements ", "").split(",").map((s) => s.trim());
  }
  analyzeClassMethod(node, className) {
    const isConstructor = node.type === "constructor";
    const methodNameNode = isConstructor ? node.childForFieldName("name") : node.childForFieldName("name");
    const methodName = (methodNameNode == null ? void 0 : methodNameNode.text) || "anonymous";
    const element = {
      type: isConstructor ? "constructor" : "class_method",
      name: methodName,
      filePath: this.currentFile,
      location: {
        file: this.currentFile,
        line: node.startPosition.row + 1
      },
      className
    };
    this.addCodeElement(element);
    const classId = `${this.currentFile}#${className}`;
    const methodId = `${this.currentFile}#${className}#${methodName}`;
    console.log(`[Debug] Adding class method relation:`, {
      class: className,
      method: methodName,
      classId,
      methodId,
      type: element.type
    });
    this.addRelation(classId, methodId, "defines");
  }
  // 添加一个辅助方法来验证关系
  validateMethodRelation(classId, methodId) {
    const classNode = this.codeElements.find((e) => e.id === classId);
    const methodNode = this.codeElements.find((e) => e.id === methodId);
    if (!classNode) {
      console.error(`[Error] Class node not found: ${classId}`);
      return false;
    }
    if (!methodNode) {
      console.error(`[Error] Method node not found: ${methodId}`);
      return false;
    }
    console.log(`[Debug] Validated method relation:`, {
      class: classNode.name,
      method: methodNode.name,
      classId,
      methodId
    });
    return true;
  }
  analyzeImplementsRelation(node) {
    const interfaces = this.getImplementedInterfaces(node);
    const currentClassId = `${this.currentFile}#${this.currentClass}`;
    interfaces.forEach((interfaceName) => {
      const interfaceId = this.resolveTypeReference(interfaceName.trim());
      if (interfaceId) {
        this.addRelation(currentClassId, interfaceId, "implements");
      }
    });
  }
  analyzeTypeAlias(node) {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return;
    const element = {
      type: "type_alias",
      name: nameNode.text,
      filePath: this.currentFile,
      location: {
        file: this.currentFile,
        line: nameNode.startPosition.row + 1
      }
    };
    this.addCodeElement(element);
  }
  resolveCallee(node) {
    const calleeNode = node.childForFieldName("function");
    if (!calleeNode) return void 0;
    const calleeName = calleeNode.text;
    const calleeClass = this.currentClass;
    const possibleIds = [
      `${this.currentFile}#${calleeName}`,
      // 普通函数
      `${this.currentFile}#${calleeClass}#${calleeName}`,
      // 类方法
      `${this.currentFile}#${calleeClass}#constructor`
      // 构造函数
    ];
    for (const id of possibleIds) {
      const element = this.codeElements.find((e) => e.id === id);
      if (element) return id;
    }
    return void 0;
  }
  getImportPath(node) {
    const moduleNode = node.childForFieldName("source");
    if (!moduleNode) return "";
    return moduleNode.text.replace(/['"]/g, "");
  }
  resolveTypeReference(typeName) {
    const element = this.codeElements.find((e) => e.name === typeName);
    return element == null ? void 0 : element.id;
  }
};

// src/index.ts
import path2 from "path";
import { mkdir, rm } from "fs/promises";
import { existsSync } from "fs";
import crypto from "crypto";
var GitIngest = class {
  constructor(config) {
    this.git = new GitAction();
    this.scanner = new FileScanner();
    this.analyzer = new CodeAnalyzer();
    this.config = __spreadValues({
      tempDir: "repo",
      // 默认保存仓库的目录名(不会暴露到外部)
      keepTempFiles: false,
      // 默认不保留临时文件
      defaultMaxFileSize: 1024 * 1024,
      // 默认检索不超过 1MB 的文件
      defaultPatterns: {
        include: ["**/*"],
        exclude: ["**/node_modules/**", "**/.git/**"]
      }
    }, config);
  }
  // 清理临时目录
  cleanupTempDir(dirPath) {
    return __async(this, null, function* () {
      try {
        if (existsSync(dirPath)) {
          yield rm(dirPath, { recursive: true, force: true });
        }
      } catch (error) {
        console.warn(
          `Warning: Failed to cleanup temporary directory ${dirPath}: ${error.message}`
        );
      }
    });
  }
  // 检查URL是否使用自定义域名，如果是则转换为原始GitHub URL
  transformCustomDomainUrl(url) {
    if (!this.config.customDomainMap) {
      return url;
    }
    const { targetDomain, originalDomain } = this.config.customDomainMap;
    if (url.includes(targetDomain)) {
      return url.replace(targetDomain, originalDomain);
    }
    return url;
  }
  // 检查URL是否匹配自定义域名
  isCustomDomainUrl(url) {
    if (!this.config.customDomainMap) {
      return false;
    }
    return url.includes(this.config.customDomainMap.targetDomain);
  }
  // [核心步骤0]: 开端，根据 url 按需获取仓库代码
  analyzeFromUrl(url, options) {
    return __async(this, null, function* () {
      const isCustomDomain = this.isCustomDomainUrl(url);
      const githubUrl = this.transformCustomDomainUrl(url);
      if (!githubUrl) {
        throw new ValidationError("URL is required");
      }
      if (!githubUrl.match(/^https?:\/\//)) {
        throw new ValidationError("Invalid URL format");
      }
      if (!this.config.tempDir) {
        throw new ValidationError("Temporary directory is required");
      }
      const repoMatch = githubUrl.match(/github\.com\/[^\/]+\/([^\/]+)/);
      const repoName = repoMatch ? repoMatch[1] : "unknown";
      const uniqueId = crypto.randomBytes(3).toString("base64url").slice(0, 4);
      const workDir = `${this.config.tempDir}/${repoName}-${uniqueId}`;
      let result;
      try {
        if (!existsSync(this.config.tempDir)) {
          yield mkdir(this.config.tempDir, { recursive: true });
        }
        yield this.git.clone(githubUrl, workDir);
        if (options == null ? void 0 : options.branch) {
          yield this.git.checkoutBranch(workDir, options.branch);
        }
        result = yield this.analyzeFromDirectory(workDir, options);
        if (!this.config.keepTempFiles) {
          yield this.cleanupTempDir(workDir);
        }
        return result;
      } catch (error) {
        if (!this.config.keepTempFiles) {
          yield this.cleanupTempDir(workDir);
        }
        if (error instanceof GitIngestError) {
          throw error;
        }
        throw new GitIngestError(
          `Failed to analyze repository: ${error.message}`
        );
      }
    });
  }
  // 分析扫描目录
  analyzeFromDirectory(dirPath, options) {
    return __async(this, null, function* () {
      var _a, _b;
      if (!dirPath) {
        throw new ValidationError("Path is required");
      }
      if (!existsSync(dirPath)) {
        throw new ValidationError(`Directory not found: ${dirPath}`);
      }
      try {
        const files = yield this.scanner.scanDirectory(dirPath, {
          maxFileSize: (options == null ? void 0 : options.maxFileSize) || this.config.defaultMaxFileSize,
          includePatterns: (options == null ? void 0 : options.includePatterns) || ((_a = this.config.defaultPatterns) == null ? void 0 : _a.include),
          excludePatterns: (options == null ? void 0 : options.excludePatterns) || ((_b = this.config.defaultPatterns) == null ? void 0 : _b.exclude),
          targetPaths: options == null ? void 0 : options.targetPaths,
          includeDependencies: true
        });
        if (files.length === 0) {
          throw new ValidationError("No files found in the specified directory");
        }
        this.analyzer = new CodeAnalyzer();
        for (const file of files) {
          try {
            if (/\.(ts|js|tsx|jsx)$/i.test(file.path)) {
              const content = file.content;
              const absolutePath = path2.resolve(dirPath, file.path);
              console.log(`Analyzing file: ${absolutePath}`);
              this.analyzer.analyzeCode(absolutePath, content);
            }
          } catch (error) {
            console.warn(
              `Warning: Failed to analyze file ${file.path}: ${error.message}`
            );
          }
        }
        const codeIndex = this.analyzer.getCodeIndex();
        const knowledgeGraph = this.analyzer.getKnowledgeGraph();
        console.log(`Analysis complete. Found ${codeIndex.size} code elements`);
        return {
          metadata: {
            files: files.length,
            tokens: files.reduce((acc, file) => acc + file.token, 0)
          },
          totalCode: files,
          fileTree: generateTree(files),
          sizeTree: buildSizeTree(files),
          codeAnalysis: {
            codeIndex,
            knowledgeGraph
          }
        };
      } catch (error) {
        if (error instanceof GitIngestError) {
          throw error;
        }
        throw new GitIngestError(
          `Failed to analyze directory: ${error.message}`
        );
      }
    });
  }
};
export {
  GitIngest,
  GitIngestError,
  GitOperationError,
  ValidationError,
  searchKnowledgeGraph
};
