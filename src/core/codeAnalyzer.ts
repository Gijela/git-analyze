import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import path from 'path';
import fs from 'fs';

// 代码元素类型定义
type ElementType = 
  | 'function' 
  | 'class' 
  | 'interface' 
  | 'variable' 
  | 'import'
  | 'constructor'
  | 'class_method'
  | 'type_alias';

// 代码元素接口
interface CodeElement {
  id?: string;
  type: ElementType;
  name: string;
  filePath: string;
  className?: string;
  location: {
    file: string;
    line: number;
  };
  // implementation?: string;
}

// 代码关系类型
type RelationType = 'calls' | 'extends' | 'implements' | 'imports' | 'uses';

// 代码关系接口
interface CodeRelation {
  source: string;
  target: string;
  type: string;
}

// 知识图谱接口
interface KnowledgeGraph {
  nodes: CodeElement[];
  edges: CodeRelation[];
}

export class CodeAnalyzer {
  private parser: Parser;
  private codeIndex: Map<string, CodeElement[]>;
  private knowledgeGraph: KnowledgeGraph;
  private currentFile: string;
  private currentClass: string | null = null;
  private currentFunctionId: string | null = null;
  private scopeStack: string[] = [];

  constructor() {
    // 初始化 Tree-sitter
    this.parser = new Parser();
    this.parser.setLanguage(TypeScript.typescript as any);

    this.codeIndex = new Map();
    this.knowledgeGraph = { nodes: [], edges: [] };
    this.currentFile = '';
  }

  /**
   * 分析代码文件
   */
  public analyzeCode(filePath: string, sourceCode: string): void {
    if (!filePath) {
      throw new Error('File path cannot be undefined');
    }
    this.currentFile = filePath;
    try {
      console.log(`[CodeAnalyzer] Processing file: ${filePath}`);

      const tree = this.parser.parse(sourceCode);
      console.log(`[CodeAnalyzer] AST generated for ${filePath}`);

      this.visitNode(tree.rootNode);

      console.log(`[CodeAnalyzer] Analysis complete for ${filePath}`);
      console.log(`[CodeAnalyzer] Found ${this.knowledgeGraph.nodes.length} nodes`);
      console.log(`[CodeAnalyzer] Found ${this.knowledgeGraph.edges.length} relationships`);
      console.log(`[CodeAnalyzer] Code index size: ${this.codeIndex.size}`);
    } catch (error) {
      console.error(`[CodeAnalyzer] Error analyzing file ${filePath}:`, error);
    }
  }

  /**
   * 访问 AST 节点
   */
  private visitNode(node: Parser.SyntaxNode): void {
    // 添加更多节点类型匹配
    switch (node.type) {
      case 'function_declaration':
      case 'method_definition':  // 添加方法定义
      case 'arrow_function':     // 添加箭头函数
        this.analyzeFunctionDeclaration(node);
        break;

      case 'class_declaration':
      case 'class':             // 添加类表达式
        this.analyzeClassDeclaration(node);
        break;

      case 'interface_declaration':
        this.analyzeInterface(node);
        break;

      case 'type_alias_declaration':  // 添加类型别名
        this.analyzeTypeAlias(node);
        break;

      case 'call_expression':
      case 'new_expression':    // 添加 new 表达式
        this.analyzeCallExpression(node);
        break;

      case 'import_declaration':
      case 'import_statement':
        this.analyzeImportStatement(node);
        break;

      case 'variable_declaration':    // 添加变量声明
        this.analyzeVariableDeclaration(node);
        break;

      case 'implements_clause':
        this.analyzeImplementsRelation(node);
        break;
    }

    // 递归访问子节点
    for (const child of node.children) {
      this.visitNode(child);
    }
  }

  /**
   * 分析函数声明
   */
  private analyzeFunctionDeclaration(node: Parser.SyntaxNode): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const element: CodeElement = {
      type: 'function',
      name: nameNode.text,
      filePath: this.currentFile,
      location: {
        file: this.currentFile,
        line: nameNode.startPosition.row + 1
      }
    };

    // 设置当前函数上下文
    this.currentFunctionId = `${this.currentFile}#${nameNode.text}`;
    this.scopeStack.push(this.currentFunctionId);  // 使用栈维护嵌套调用
    this.addCodeElement(element);
    this.currentFunctionId = null; // 重置上下文
  }

  /**
   * 分析类声明
   */
  private analyzeClassDeclaration(node: Parser.SyntaxNode): void {
    const classNameNode = node.childForFieldName('name');
    if (!classNameNode) return;

    this.currentClass = classNameNode.text; // 设置当前类
    const className = classNameNode.text;
    const element: CodeElement = {
      type: 'class',
      name: className,
      filePath: this.currentFile,
      location: {
        file: this.currentFile,
        line: classNameNode.startPosition.row + 1
      }
    };
    this.addCodeElement(element);

    // 分析继承和实现关系
    for (const child of node.children) {
      if (child.type === 'extends_clause') {
        const baseClass = child.text.replace('extends ', '');
        const sourceId = `${this.currentFile}#${className}`;
        const targetId = this.resolveTypeReference(baseClass); // 新方法解析类型引用
        
        if (targetId) {
          this.addRelation({
            source: sourceId,
            target: targetId,
            type: 'extends'
          });
        }
      } else if (child.type === 'implements_clause') {
        const interfaces = child.text.replace('implements ', '').split(',');
        interfaces.forEach(iface => {
          this.addRelation({
            source: `${this.currentFile}#${className}`,
            target: iface.trim(),
            type: 'implements'
          });
        });
      }
    }

    // 分析类的方法
    node.children
      .filter(child => child.type === 'method_definition')
      .forEach(method => this.analyzeClassMethod(method, this.currentClass!));
    
    this.currentClass = null; // 重置类上下文
  }

  /**
   * 分析接口声明
   */
  private analyzeInterface(node: Parser.SyntaxNode): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const element: CodeElement = {
      type: 'interface',
      name: nameNode.text,
      filePath: this.currentFile,
      location: {
        file: this.currentFile,
        line: nameNode.startPosition.row + 1
      },
      id: `${this.currentFile}#Interface#${nameNode.text}`
    };
    this.addCodeElement(element);
  }

  /**
   * 分析函数调用
   */
  private analyzeCallExpression(node: Parser.SyntaxNode) {
    const callee = this.resolveCallee(node);
    const caller = this.scopeStack[this.scopeStack.length - 1];
    
    if (caller && callee?.id) {
      this.addRelation({
        type: 'calls',
        source: caller,
        target: callee.id
      });
      
      // 调试日志
      console.log('[CALL]', {
        caller,
        callee: callee.id,
        node: node.text
      });
    }
  }

  /**
   * 分析导入声明
   */
  private analyzeImportStatement(node: Parser.SyntaxNode): void {
    const importPath = this.getImportPath(node); // 提取路径
    const normalizedPath = this.normalizePath(importPath); // 标准化路径
    
    this.addRelation({
      type: 'imports',
      source: this.currentFile,
      target: normalizedPath
    });
  }

  private normalizePath(importPath: string): string {
    // 内置模块列表
    const builtinModules = ['fs', 'path', 'crypto', 'util'];
    
    if (builtinModules.includes(importPath)) {
      return importPath; // 内置模块保持原样
    }
    
    let resolved = path.resolve(path.dirname(this.currentFile), importPath);
    if (fs.existsSync(resolved)) {
      if (fs.statSync(resolved).isDirectory()) {
        resolved = path.join(resolved, 'index.ts');
      }
    } else if (!resolved.endsWith('.ts')) {
      resolved += '.ts';
    }
    
    return resolved;
  }

  /**
   * 添加代码元素
   */
  private addCodeElement(element: Omit<CodeElement, 'id'>): void {
    const elementId = (() => {
      switch(element.type) {
        case 'class_method':
          return `${element.filePath}#${element.className}#${element.name}`;
        case 'interface':
          return `${element.filePath}#Interface#${element.name}`;
        case 'type_alias':
          return `${element.filePath}#Type#${element.name}`;
        case 'constructor':
          return `${element.filePath}#${element.className}#constructor`;
        default:
          return `${element.filePath}#${element.name}`;
      }
    })();

    const newElement: CodeElement = {
      ...element,
      id: elementId
    };

    // 添加到知识图谱
    this.knowledgeGraph.nodes.push(newElement);

    // 更新代码索引
    const existingElements = this.codeIndex.get(element.filePath) || [];
    existingElements.push(newElement);
    this.codeIndex.set(element.filePath, existingElements);
  }

  /**
   * 添加关系
   */
  private addRelation(relation: CodeRelation): void {
    this.knowledgeGraph.edges.push(relation);
  }

  /**
   * 获取代码索引
   */
  public getCodeIndex(): Map<string, CodeElement[]> {
    return this.codeIndex;
  }

  /**
   * 获取知识图谱
   */
  public getKnowledgeGraph(): KnowledgeGraph {
    return this.knowledgeGraph;
  }

  /**
   * 获取特定类型的所有元素
   */
  public getElementsByType(type: ElementType): CodeElement[] {
    return Array.from(this.codeIndex.values())
      .flat()
      .filter(element => element.type === type);
  }

  /**
   * 获取特定元素的所有关系
   */
  public getElementRelations(elementName: string): CodeRelation[] {
    return this.knowledgeGraph.edges.filter(
      edge => edge.source === elementName || edge.target === elementName
    );
  }

  /**
   * 导出分析结果
   */
  public exportAnalysis(): string {
    return JSON.stringify({
      codeIndex: Array.from(this.codeIndex.entries()),
      knowledgeGraph: this.knowledgeGraph
    }, null, 2);
  }

  // 添加变量声明分析
  private analyzeVariableDeclaration(node: Parser.SyntaxNode): void {
    const declarator = node.childForFieldName('declarator');
    const nameNode = declarator?.childForFieldName('name');
    if (!nameNode) return;

    const element: CodeElement = {
      type: 'variable',
      name: nameNode.text,
      location: {
        file: this.currentFile,
        line: nameNode.startPosition.row + 1
      },
      // implementation: node.text
    };

    this.addCodeElement(element);
  }

  public validateAnalysis(): boolean {
    let isValid = true;
    
    // 唯一性检查
    const idSet = new Set<string>();
    this.knowledgeGraph.nodes.forEach(node => {
      if (idSet.has(node.id)) {
        console.error(`[Validation] 重复节点ID: ${node.id}`);
        isValid = false;
      }
      idSet.add(node.id);
    });

    // 关系有效性检查
    this.knowledgeGraph.edges.forEach(edge => {
      if (!this.findElementById(edge.source)) {
        console.error(`[Validation] 无效关系源: ${edge.source}`);
        isValid = false;
      }
      if (!this.findElementById(edge.target)) {
        console.error(`[Validation] 无效关系目标: ${edge.target}`);
        isValid = false;
      }
    });

    return isValid;
  }

  private findElementById(id: string): CodeElement | undefined {
    return this.knowledgeGraph.nodes.find(node => node.id === id);
  }

  private analyzeClassMethod(node: Parser.SyntaxNode, className: string) {
    const isConstructor = node.type === 'constructor';
    const methodNameNode = isConstructor 
      ? node.childForFieldName('name') // 构造函数可能没有name字段
      : node.childForFieldName('name');
    
    const methodName = methodNameNode?.text || 'anonymous';
    
    const element: CodeElement = {
      type: isConstructor ? 'constructor' : 'class_method',
      name: isConstructor ? 'constructor' : methodName,
      id: isConstructor 
        ? `${this.currentFile}#${className}#constructor`
        : `${this.currentFile}#${className}#${methodName}`,
      className
    };
    
    // 调试日志
    console.log('[DEBUG] Adding class method:', {
      type: element.type,
      id: element.id,
      className
    });

    this.addCodeElement(element);
  }

  private analyzeImplementsRelation(node: Parser.SyntaxNode): void {
    const interfaces = node.text.replace('implements ', '').split(',');
    const currentClassId = `${this.currentFile}#${this.currentClass}`;

    interfaces.forEach(iface => {
      const interfaceId = this.resolveTypeReference(iface.trim());
      if (interfaceId) {
        this.addRelation({
          source: currentClassId,
          target: interfaceId,
          type: 'implements'
        });
      }
    });
  }

  private analyzeTypeAlias(node: Parser.SyntaxNode): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const element: CodeElement = {
      type: 'type_alias',
      name: nameNode.text,
      filePath: this.currentFile,
      location: {
        file: this.currentFile,
        line: nameNode.startPosition.row + 1
      }
    };
    this.addCodeElement(element);
  }

  private resolveCallee(node: Parser.SyntaxNode): CodeElement | undefined {
    const calleeNode = node.childForFieldName('function');
    if (!calleeNode) return undefined;

    // 通过完整路径查找元素
    const calleeName = calleeNode.text;
    const calleeClass = this.currentClass;
    
    // 构建可能的ID格式
    const possibleIds = [
      `${this.currentFile}#${calleeName}`,                    // 普通函数
      `${this.currentFile}#${calleeClass}#${calleeName}`,    // 类方法
      `${this.currentFile}#${calleeClass}#constructor`        // 构造函数
    ];

    // 查找匹配的元素
    for (const id of possibleIds) {
      const element = this.findElementById(id);
      if (element) return element;
    }

    return undefined;
  }

  private getImportPath(node: Parser.SyntaxNode): string {
    const moduleNode = node.childForFieldName('source');
    if (!moduleNode) return '';
    
    // 移除引号
    return moduleNode.text.replace(/['"]/g, '');
  }

  private resolveTypeReference(typeName: string): string | undefined {
    // 在当前文件中查找
    const localElement = this.findElementByName(typeName);
    if (localElement) return localElement.id;

    // 在导入中查找
    const importedElement = this.resolveImportedType(typeName);
    if (importedElement) return importedElement.id;

    return undefined;
  }
} 