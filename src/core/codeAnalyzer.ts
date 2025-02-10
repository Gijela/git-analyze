import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';

// 代码元素类型定义
type ElementType = 'function' | 'class' | 'interface' | 'variable' | 'import';

// 代码元素接口
interface CodeElement {
  type: string;
  name: string;
  location: {
    file: string;
    line: number;
  };
  implementation?: string;
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

  constructor() {
    // 初始化 Tree-sitter
    this.parser = new Parser();
    this.parser.setLanguage(TypeScript.typescript);
    
    this.codeIndex = new Map();
    this.knowledgeGraph = { nodes: [], edges: [] };
    this.currentFile = '';
  }

  /**
   * 分析代码文件
   */
  public analyzeCode(filePath: string, sourceCode: string): void {
    try {
      this.currentFile = filePath;
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
      case 'type_alias_declaration':  // 添加类型别名
        this.analyzeInterfaceDeclaration(node);
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
      location: {
        file: this.currentFile,
        line: nameNode.startPosition.row + 1
      },
      implementation: node.text
    };

    this.addCodeElement(element);
  }

  /**
   * 分析类声明
   */
  private analyzeClassDeclaration(node: Parser.SyntaxNode): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const element: CodeElement = {
      type: 'class',
      name: nameNode.text,
      location: {
        file: this.currentFile,
        line: nameNode.startPosition.row + 1
      },
      implementation: node.text
    };

    this.addCodeElement(element);

    // 分析继承和实现关系
    for (const child of node.children) {
      if (child.type === 'extends_clause') {
        const baseClass = child.text.replace('extends ', '');
        this.addRelation({
          source: element.name,
          target: baseClass,
          type: 'extends'
        });
      } else if (child.type === 'implements_clause') {
        const interfaces = child.text.replace('implements ', '').split(',');
        interfaces.forEach(iface => {
          this.addRelation({
            source: element.name,
            target: iface.trim(),
            type: 'implements'
          });
        });
      }
    }

    // 分析类的方法
    for (const child of node.children) {
      if (child.type === 'method_definition') {
        this.analyzeFunctionDeclaration(child);
      }
    }
  }

  /**
   * 分析接口声明
   */
  private analyzeInterfaceDeclaration(node: Parser.SyntaxNode): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const element: CodeElement = {
      type: 'interface',
      name: nameNode.text,
      location: {
        file: this.currentFile,
        line: nameNode.startPosition.row + 1
      },
      implementation: node.text
    };

    this.addCodeElement(element);
  }

  /**
   * 分析函数调用
   */
  private analyzeCallExpression(node: Parser.SyntaxNode): void {
    let functionName = '';
    const functionNode = node.childForFieldName('function');
    
    if (functionNode) {
      // 处理简单的函数调用
      functionName = functionNode.text;
    } else {
      // 处理方法调用 (obj.method())
      const memberNode = node.child(0);
      if (memberNode && memberNode.type === 'member_expression') {
        functionName = memberNode.text;
      }
    }

    if (functionName) {
      this.addRelation({
        source: this.currentFile,
        target: functionName,
        type: 'calls'
      });
    }
  }

  /**
   * 分析导入声明
   */
  private analyzeImportStatement(node: Parser.SyntaxNode): void {
    const source = node.childForFieldName('source')?.text.replace(/['"]/g, '');
    if (!source) return;

    this.addRelation({
      source: this.currentFile,
      target: source,
      type: 'imports'
    });
  }

  /**
   * 添加代码元素
   */
  private addCodeElement(element: CodeElement): void {
    const elements = this.codeIndex.get(element.name) || [];
    elements.push(element);
    this.codeIndex.set(element.name, elements);
    this.knowledgeGraph.nodes.push(element);
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
      implementation: node.text
    };

    this.addCodeElement(element);
  }

  public validateAnalysis(): boolean {
    const hasNodes = this.knowledgeGraph.nodes.length > 0;
    const hasEdges = this.knowledgeGraph.edges.length > 0;
    const hasIndex = this.codeIndex.size > 0;

    console.log(`[CodeAnalyzer] Validation results:`);
    console.log(`- Has nodes: ${hasNodes}`);
    console.log(`- Has edges: ${hasEdges}`);
    console.log(`- Has index: ${hasIndex}`);

    return hasNodes && hasEdges && hasIndex;
  }
} 