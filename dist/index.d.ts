interface AnalyzeOptions {
    maxFileSize?: number;
    includePatterns?: string[];
    excludePatterns?: string[];
    targetPaths?: string[];
    branch?: string;
    commit?: string;
}
interface FileInfo {
    path: string;
    content: string;
    token: number;
}
interface AnalysisResult {
    metadata: {
        files: number;
        tokens: number;
    };
    fileTree: string;
    totalCode: {
        path: string;
        content: string;
        token: number;
    }[];
    sizeTree: {
        name: string;
        token: number;
        isFile: boolean;
        children?: {
            [key: string]: {
                name: string;
                token: number;
                children?: any;
                isFile: boolean;
            };
        };
    };
    codeAnalysis: CodeAnalysis;
}
interface CodeAnalysis {
    codeIndex: Map<string, any[]>;
    knowledgeGraph: {
        nodes: any[];
        edges: any[];
    };
}
interface GitIngestConfig {
    tempDir?: string;
    defaultMaxFileSize?: number;
    defaultPatterns?: {
        include?: string[];
        exclude?: string[];
    };
    keepTempFiles?: boolean;
    customDomainMap?: {
        targetDomain: string;
        originalDomain: string;
    };
}

declare class GitIngestError extends Error {
    constructor(message: string);
}
declare class GitOperationError extends GitIngestError {
    constructor(operation: string, details: string);
}
declare class ValidationError extends GitIngestError {
    constructor(message: string);
}

interface KnowledgeNode {
    id: string;
    name: string;
    type: string;
    filePath: string;
    location: {
        file: string;
        line: number;
    };
    description?: string;
    properties?: Record<string, any>;
    implementation?: string;
}
interface KnowledgeEdge {
    source: string;
    target: string;
    type: string;
    properties?: Record<string, any>;
}
interface KnowledgeGraph {
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
}
interface SearchOptions {
    entities: string[];
    relationTypes?: string[];
    maxDistance?: number;
    limit?: number;
}
interface SearchResult {
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
    metadata: {
        totalNodes: number;
        totalEdges: number;
        entities: string[];
        relationTypes: string[];
        maxDistance: number;
    };
}
/**
 * 基于实体名称列表搜索关联的知识图谱
 * @param graph 知识图谱
 * @param options 搜索选项
 * @returns 搜索结果
 */
declare function searchKnowledgeGraph(graph: KnowledgeGraph, options: SearchOptions): SearchResult;

declare class GitIngest {
    private git;
    private scanner;
    private analyzer;
    private config;
    constructor(config?: GitIngestConfig);
    private cleanupTempDir;
    private transformCustomDomainUrl;
    private isCustomDomainUrl;
    analyzeFromUrl(url: string, options?: AnalyzeOptions): Promise<AnalysisResult>;
    analyzeFromDirectory(dirPath: string, options?: AnalyzeOptions): Promise<AnalysisResult>;
}

export { type AnalysisResult, type AnalyzeOptions, type CodeAnalysis, type FileInfo, GitIngest, type GitIngestConfig, GitIngestError, GitOperationError, type KnowledgeEdge, type KnowledgeGraph, type KnowledgeNode, type SearchOptions, type SearchResult, ValidationError, searchKnowledgeGraph };
