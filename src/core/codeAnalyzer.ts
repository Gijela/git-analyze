import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import path from 'path';
import fs from 'fs';
// 导入知识图谱相关接口
import { KnowledgeNode, KnowledgeEdge, KnowledgeGraph as IKnowledgeGraph } from '../utils/graphSearch';

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
  implementation?: string;
}

// 代码关系类型
export type RelationType =
  | 'calls'      // 函数调用关系
  | 'imports'    // 导入关系
  | 'extends'    // 继承关系
  | 'implements' // 接口实现关系
  | 'defines';   // 定义关系

// 代码关系接口
export interface CodeRelation {
  sourceId: string;
  targetId: string;
  type: RelationType;
}

// 修改知识图谱接口名称以避免冲突
interface KnowledgeGraph extends IKnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export class CodeAnalyzer {
  private parser: Parser;
  private codeElements: CodeElement[] = [];
  private relations: CodeRelation[] = [];
  private currentFile: string = '';
  private currentClass: string | null = null;
  private currentFunctionId: string | null = null;
  private scopeStack: string[] = [];

  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(TypeScript.typescript as any);
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
      console.log(`[CodeAnalyzer] Found ${this.codeElements.length} nodes`);
      console.log(`[CodeAnalyzer] Found ${this.relations.length} relationships`);
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
        this.analyzeClassDeclaration(node, this.currentFile);
        break;

      case 'interface_declaration':
        this.analyzeInterface(node);
        break;

      case 'type_alias_declaration':  // 添加类型别名
        this.analyzeTypeAlias(node);
        break;

      case 'call_expression':
      case 'new_expression':    // 添加 new 表达式
        this.analyzeCallExpression(node, this.scopeStack[this.scopeStack.length - 1]);
        break;

      case 'import_declaration':
      case 'import_statement':
        this.analyzeImportStatement(node, this.currentFile);
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
      },
      implementation: node.text
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
  private analyzeClassDeclaration(node: Parser.SyntaxNode, filePath: string): void {
    const className = this.getNodeName(node);
    if (!className) return;

    // 1. 添加类定义
    const classElement: CodeElement = {
      type: 'class',
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

    // 2. 分析继承关系
    const extendsClause = node.childForFieldName('extends');
    if (extendsClause) {
      const superClassName = this.getNodeName(extendsClause);
      if (superClassName) {
        const currentClassId = `${this.currentFile}#${className}`;
        const superClassId = this.resolveTypeReference(superClassName);
        if (superClassId) {
          console.log(`[Debug] Adding extends relation: ${className} extends ${superClassName}`);
          this.addRelation(currentClassId, superClassId, 'extends');
        }
      }
    }

    // 3. 分析类的方法
    for (const child of node.children) {
      if (child.type === 'method_definition' || child.type === 'constructor') {
        this.analyzeClassMethod(child, className);
      }
    }

    // 4. 分析接口实现
    const implementsClause = node.childForFieldName('implements');
    if (implementsClause) {
      this.analyzeImplementsRelation(implementsClause);
    }

    this.currentClass = null;
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
      id: `${this.currentFile}#Interface#${nameNode.text}`,
      implementation: node.text
    };
    this.addCodeElement(element);
  }

  /**
   * 分析函数调用
   */
  private analyzeCallExpression(node: Parser.SyntaxNode, currentScope: string) {
    const calleeName = this.resolveCallee(node);
    if (calleeName) {
      const currentNode = this.codeElements.find(e => e.id === currentScope);
      const calleeNode = this.codeElements.find(e => e.id === calleeName);

      if (currentNode && calleeNode) {
        console.log(`[Debug] Found call expression:`, {
          caller: currentNode.name,
          callee: calleeNode.name,
          callerId: currentScope,
          calleeId: calleeName
        });
        this.addRelation(currentScope, calleeName, 'calls');
      }
    }
  }

  /**
   * 分析导入声明
   */
  private analyzeImportStatement(node: Parser.SyntaxNode, filePath: string) {
    const importPath = this.getImportPath(node);
    if (importPath) {
      console.log(`[Debug] Found import:`, {
        importer: filePath,
        imported: importPath
      });
      this.addRelation(filePath, importPath, 'imports');
    }
  }

  private normalizePath(importPath: string): string {
    // 内置模块列表
    const builtinModules = ['fs', 'path', 'crypto', 'util'];

    if (builtinModules.includes(importPath)) {
      return importPath;
    }

    // 将相对路径转换为绝对路径
    const fullPath = path.resolve(path.dirname(this.currentFile), importPath);

    // 确保路径以 .ts 结尾
    if (!fullPath.endsWith('.ts')) {
      return `${fullPath}.ts`;
    }

    return fullPath;
  }

  /**
   * 添加代码元素
   */
  private addCodeElement(element: Omit<CodeElement, 'id'>): void {
    const elementId = (() => {
      switch (element.type) {
        case 'class':
          return `${element.filePath}#${element.name}`;
        case 'class_method':
        case 'constructor':
          return `${element.filePath}#${element.className}#${element.name}`;
        case 'interface':
          return `${element.filePath}#Interface#${element.name}`;
        case 'type_alias':
          return `${element.filePath}#Type#${element.name}`;
        default:
          return `${element.filePath}#${element.name}`;
      }
    })();

    const codeElement: CodeElement = {
      ...element,
      id: elementId
    };

    console.log(`[Debug] Adding code element:`, {
      type: element.type,
      name: element.name,
      id: elementId,
      className: 'className' in element ? element.className : undefined
    });

    this.codeElements.push(codeElement);
  }

  /**
   * 添加关系
   */
  private addRelation(source: string, target: string, type: RelationType): void {
    // 检查源节点和目标节点是否存在
    const sourceNode = this.codeElements.find(e => e.id === source);
    const targetNode = this.codeElements.find(e => e.id === target);

    if (!sourceNode) {
      console.warn(`[Warning] Source node not found: ${source}`);
      return;
    }
    if (!targetNode) {
      console.warn(`[Warning] Target node not found: ${target}`);
      return;
    }

    const relation: CodeRelation = {
      sourceId: source,
      targetId: target,
      type
    };

    // 检查是否已存在相同的关系
    const exists = this.relations.some(r =>
      r.sourceId === source &&
      r.targetId === target &&
      r.type === type
    );

    if (!exists) {
      this.relations.push(relation);
      console.log(`[Debug] Added relation: ${sourceNode.name} -[${type}]-> ${targetNode.name}`);
    }
  }

  /**
   * 获取代码索引
   */
  public getCodeIndex(): Map<string, CodeElement[]> {
    const codeIndex = new Map<string, CodeElement[]>();
    this.codeElements.forEach(element => {
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
  public getKnowledgeGraph(): KnowledgeGraph {
    console.log(`[Debug] Generating knowledge graph:`, {
      totalElements: this.codeElements.length,
      totalRelations: this.relations.length
    });

    // 1. 先转换节点,添加 implementation 字段
    const nodes: KnowledgeNode[] = this.codeElements.map(element => ({
      id: element.id!,
      name: element.name,
      type: element.type,
      filePath: element.filePath,
      location: element.location,
      implementation: element.implementation || '' // 添加 implementation 字段
    }));

    // 2. 验证所有关系
    const validRelations = this.relations.filter(relation => {
      const sourceExists = this.codeElements.some(e => e.id === relation.sourceId);
      const targetExists = this.codeElements.some(e => e.id === relation.targetId);

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

    // 3. 转换关系
    const edges: KnowledgeEdge[] = validRelations.map(relation => ({
      source: relation.sourceId,
      target: relation.targetId,
      type: relation.type,
      properties: {}
    }));

    console.log(`[Debug] Knowledge graph generated:`, {
      nodes: nodes.length,
      edges: edges.length,
      relationTypes: new Set(edges.map(e => e.type))
    });

    return { nodes, edges };
  }

  /**
   * 获取特定类型的所有元素
   */
  public getElementsByType(type: ElementType): CodeElement[] {
    return this.codeElements.filter(element => element.type === type);
  }

  /**
   * 获取特定元素的所有关系
   */
  public getElementRelations(elementName: string): CodeRelation[] {
    return this.relations.filter(
      edge => edge.sourceId === elementName || edge.targetId === elementName
    );
  }

  /**
   * 导出分析结果
   */
  public exportAnalysis(): string {
    return JSON.stringify({
      codeElements: this.codeElements,
      relations: this.relations
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
      filePath: this.currentFile,
      location: {
        file: this.currentFile,
        line: nameNode.startPosition.row + 1
      },
      implementation: node.text
    };

    this.addCodeElement(element);
  }

  public validateAnalysis(): boolean {
    let isValid = true;

    // 唯一性检查
    const idSet = new Set<string>();
    this.codeElements.forEach(node => {
      if (node.id && idSet.has(node.id)) {
        console.error(`[Validation] 重复节点ID: ${node.id}`);
        isValid = false;
      }
      if (node.id) {
        idSet.add(node.id);
      }
    });

    // 关系有效性检查
    this.relations.forEach(edge => {
      const sourceExists = this.codeElements.some(e => e.id === edge.sourceId);
      const targetExists = this.codeElements.some(e => e.id === edge.targetId);

      if (!sourceExists) {
        console.error(`[Validation] 无效关系源: ${edge.sourceId}`);
        isValid = false;
      }
      if (!targetExists) {
        console.error(`[Validation] 无效关系目标: ${edge.targetId}`);
        isValid = false;
      }
    });

    return isValid;
  }

  private getNodeName(node: Parser.SyntaxNode): string | undefined {
    const nameNode = node.childForFieldName('name');
    return nameNode?.text;
  }

  private getImplementedInterfaces(node: Parser.SyntaxNode): string[] {
    return node.text.replace('implements ', '').split(',').map(s => s.trim());
  }

  private analyzeClassMethod(node: Parser.SyntaxNode, className: string): void {
    const isConstructor = node.type === 'constructor';
    const methodNameNode = isConstructor
      ? node.childForFieldName('name')
      : node.childForFieldName('name');

    const methodName = methodNameNode?.text || 'anonymous';

    // 1. 添加方法定义
    const element: CodeElement = {
      type: isConstructor ? 'constructor' : 'class_method',
      name: methodName,
      filePath: this.currentFile,
      location: {
        file: this.currentFile,
        line: node.startPosition.row + 1
      },
      className
    };

    this.addCodeElement(element);

    // 2. 添加类定义方法的关系
    const classId = `${this.currentFile}#${className}`;
    const methodId = `${this.currentFile}#${className}#${methodName}`;

    console.log(`[Debug] Adding class method relation:`, {
      class: className,
      method: methodName,
      classId,
      methodId,
      type: element.type
    });

    this.addRelation(classId, methodId, 'defines');
  }

  // 添加一个辅助方法来验证关系
  private validateMethodRelation(classId: string, methodId: string): boolean {
    const classNode = this.codeElements.find(e => e.id === classId);
    const methodNode = this.codeElements.find(e => e.id === methodId);

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

  private analyzeImplementsRelation(node: Parser.SyntaxNode): void {
    const interfaces = this.getImplementedInterfaces(node);
    const currentClassId = `${this.currentFile}#${this.currentClass}`;

    interfaces.forEach(interfaceName => {
      const interfaceId = this.resolveTypeReference(interfaceName.trim());
      if (interfaceId) {
        this.addRelation(currentClassId, interfaceId, 'implements');
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

  private resolveCallee(node: Parser.SyntaxNode): string | undefined {
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
      const element = this.codeElements.find(e => e.id === id);
      if (element) return id;
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
    const element = this.codeElements.find(e => e.name === typeName);
    return element?.id;
  }
} 