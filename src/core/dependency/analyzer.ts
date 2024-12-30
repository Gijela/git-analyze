import * as ts from 'typescript';
import type {
  DependencyAnalysis,
  ImportInfo,
  ExportInfo,
  FunctionCallInfo,
  ClassRelationInfo,
  MethodInfo,
  CodeLocation
} from '../../types/dependency/index.js';

export class DependencyAnalyzer {
  private program: ts.Program;

  constructor(configPath?: string) {
    // 如果提供了tsconfig路径，使用它创建program
    if (configPath) {
      const config = ts.readConfigFile(configPath, ts.sys.readFile);
      const parsedConfig = ts.parseJsonConfigFileContent(
        config.config,
        ts.sys,
        process.cwd()
      );
      this.program = ts.createProgram(
        parsedConfig.fileNames,
        parsedConfig.options
      );
    }
  }

  private getSourceFile(content: string, filePath: string): ts.SourceFile {
    return ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );
  }

  private getCodeLocation(node: ts.Node, sourceFile: ts.SourceFile): CodeLocation {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart()
    );
    return {
      line: line + 1,
      column: character + 1,
      filePath: sourceFile.fileName
    };
  }

  private analyzeImports(sourceFile: ts.SourceFile): ImportInfo[] {
    const imports: ImportInfo[] = [];

    const visitNode = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        const importPath = (node.moduleSpecifier as ts.StringLiteral).text;
        const specifiers: string[] = [];
        let importType: ImportInfo['importType'] = 'named';

        if (node.importClause) {
          if (node.importClause.name) {
            specifiers.push(node.importClause.name.text);
            importType = 'default';
          }

          const namedBindings = node.importClause.namedBindings;
          if (namedBindings) {
            if (ts.isNamespaceImport(namedBindings)) {
              importType = 'namespace';
              specifiers.push(namedBindings.name.text);
            } else if (ts.isNamedImports(namedBindings)) {
              namedBindings.elements.forEach(element => {
                specifiers.push(element.name.text);
              });
            }
          }
        }

        imports.push({
          source: importPath,
          specifiers,
          importType,
          location: this.getCodeLocation(node, sourceFile)
        });
      }

      ts.forEachChild(node, visitNode);
    };

    visitNode(sourceFile);
    return imports;
  }

  private analyzeExports(sourceFile: ts.SourceFile): ExportInfo[] {
    const exports: ExportInfo[] = [];

    const visitNode = (node: ts.Node) => {
      if (ts.isExportDeclaration(node)) {
        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          node.exportClause.elements.forEach(element => {
            exports.push({
              name: element.name.text,
              type: 'named',
              location: this.getCodeLocation(element, sourceFile)
            });
          });
        }
      } else if (ts.isExportAssignment(node)) {
        exports.push({
          name: node.expression.getText(),
          type: 'default',
          location: this.getCodeLocation(node, sourceFile)
        });
      }

      ts.forEachChild(node, visitNode);
    };

    visitNode(sourceFile);
    return exports;
  }

  private analyzeFunctionCalls(sourceFile: ts.SourceFile): FunctionCallInfo[] {
    const functionCalls: FunctionCallInfo[] = [];

    const visitNode = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        if (ts.isIdentifier(callee)) {
          functionCalls.push({
            caller: {
              name: this.getFunctionName(node),
              location: this.getCodeLocation(node, sourceFile)
            },
            callee: {
              name: callee.text,
              location: this.getCodeLocation(callee, sourceFile)
            }
          });
        }
      }

      ts.forEachChild(node, visitNode);
    };

    visitNode(sourceFile);
    return functionCalls;
  }

  private getFunctionName(node: ts.Node): string {
    let current = node.parent;
    while (current) {
      if (ts.isFunctionDeclaration(current) && current.name) {
        return current.name.text;
      }
      if (ts.isMethodDeclaration(current) && current.name) {
        return current.name.getText();
      }
      current = current.parent;
    }
    return 'anonymous';
  }

  private analyzeClassRelations(sourceFile: ts.SourceFile): ClassRelationInfo[] {
    const classRelations: ClassRelationInfo[] = [];

    const visitNode = (node: ts.Node) => {
      if (ts.isClassDeclaration(node) && node.name) {
        const className = node.name.text;
        const extendsClause = node.heritageClauses?.find(
          clause => clause.token === ts.SyntaxKind.ExtendsKeyword
        );
        const implementsClause = node.heritageClauses?.find(
          clause => clause.token === ts.SyntaxKind.ImplementsKeyword
        );

        const methods: MethodInfo[] = node.members
          .filter(ts.isMethodDeclaration)
          .map(method => ({
            name: method.name.getText(),
            visibility: this.getMethodVisibility(method),
            isStatic: method.modifiers?.some(
              mod => mod.kind === ts.SyntaxKind.StaticKeyword
            ) ?? false,
            location: this.getCodeLocation(method, sourceFile)
          }));

        classRelations.push({
          className,
          extends: extendsClause?.types[0].expression.getText(),
          implements: implementsClause?.types.map(t => t.expression.getText()),
          methods,
          location: this.getCodeLocation(node, sourceFile)
        });
      }

      ts.forEachChild(node, visitNode);
    };

    visitNode(sourceFile);
    return classRelations;
  }

  private getMethodVisibility(method: ts.MethodDeclaration): 'public' | 'private' | 'protected' {
    if (method.modifiers) {
      if (method.modifiers.some(mod => mod.kind === ts.SyntaxKind.PrivateKeyword)) {
        return 'private';
      }
      if (method.modifiers.some(mod => mod.kind === ts.SyntaxKind.ProtectedKeyword)) {
        return 'protected';
      }
    }
    return 'public';
  }

  async analyzeFile(
    content: string,
    filePath: string
  ): Promise<DependencyAnalysis> {
    const sourceFile = this.getSourceFile(content, filePath);

    return {
      filePath,
      fileType: filePath.endsWith('.ts') ? 'typescript' : 'javascript',
      imports: this.analyzeImports(sourceFile),
      exports: this.analyzeExports(sourceFile),
      functionCalls: this.analyzeFunctionCalls(sourceFile),
      classRelations: this.analyzeClassRelations(sourceFile),
      dependencies: [] // 这个会在 EnhancedScanner 中填充
    };
  }
} 