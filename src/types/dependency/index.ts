import { FileInfo } from '../index.js';

export interface CodeLocation {
  line: number;
  column: number;
  filePath: string;
}

export interface ImportInfo {
  source: string;
  specifiers: string[];
  importType: 'named' | 'default' | 'namespace' | 'type';
  location: CodeLocation;
}

export interface ExportInfo {
  name: string;
  type: 'named' | 'default';
  location: CodeLocation;
}

export interface FunctionCallInfo {
  caller: {
    name: string;
    location: CodeLocation;
  };
  callee: {
    name: string;
    source?: string;  // 如果是外部导入的函数
    location?: CodeLocation;
  };
}

export interface MethodInfo {
  name: string;
  visibility: 'public' | 'private' | 'protected';
  isStatic: boolean;
  location: CodeLocation;
}

export interface ClassRelationInfo {
  className: string;
  extends?: string;
  implements?: string[];
  methods: MethodInfo[];
  location: CodeLocation;
}

export interface DependencyAnalysis {
  filePath: string;
  fileType: 'typescript' | 'javascript';
  imports: ImportInfo[];
  exports: ExportInfo[];
  functionCalls: FunctionCallInfo[];
  classRelations: ClassRelationInfo[];
  dependencies: string[];  // 所有依赖文件的路径
}

export interface ProjectAnalysis {
  files: DependencyAnalysis[];
  dependencies: Map<string, string[]>;  // 文件依赖关系图
  exportMap: Map<string, ExportInfo[]>; // 导出映射
} 