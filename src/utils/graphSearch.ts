export interface KnowledgeNode {
  id: string;
  name: string;
  type: string;
  filePath: string;
  description?: string;
  properties?: Record<string, any>;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  type: string;
  properties?: Record<string, any>;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export interface SearchOptions {
  entities: string[];         // 实体名称数组
  relationTypes?: string[];   // 按关系类型过滤
  maxDistance?: number;       // 关系距离限制
  limit?: number;             // 结果数量限制
}

export interface SearchResult {
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
export function searchKnowledgeGraph(
  graph: KnowledgeGraph,
  options: SearchOptions
): SearchResult {
  const {
    entities,
    relationTypes = [],
    maxDistance = 2,
    limit = 20
  } = options;

  console.log("[Debug] Input graph details:", {
    totalNodes: graph.nodes.length,
    totalEdges: graph.edges.length,
    sampleEdges: graph.edges.slice(0, 3)
  });

  // 1. 找到名称完全匹配的起始节点
  const startNodes = new Set(
    graph.nodes.filter(node =>
      entities.some(entity => node.name === entity)
    )
  );

  const relatedNodes = new Set<KnowledgeNode>();
  const relatedEdges = new Set<KnowledgeEdge>();

  function findRelatedNodes(nodeId: string, distance: number) {
    if (distance > maxDistance) return;

    // 查找所有相关边
    const connectedEdges = graph.edges.filter(edge => {
      // 处理普通关系（calls, defines 等）
      const directMatch = edge.source === nodeId || edge.target === nodeId;

      // 处理导入关系
      const importMatch = edge.type === 'imports' && (
        // 当前节点是文件路径的一部分
        nodeId.startsWith(edge.source) ||
        nodeId.startsWith(edge.target) ||
        // 或者当前节点就是文件路径
        nodeId === edge.source ||
        nodeId === edge.target
      );

      return directMatch || importMatch;
    });

    console.log(`[Debug] Found edges for ${nodeId}:`, connectedEdges);

    connectedEdges.forEach(edge => {
      relatedEdges.add(edge);

      // 对于导入关系，需要找到相关的节点
      if (edge.type === 'imports') {
        // 找到源文件中的所有节点
        const sourceFileNodes = graph.nodes.filter(n => n.filePath === edge.source);
        // 找到目标文件中的所有节点
        const targetFileNodes = graph.nodes.filter(n => n.filePath === edge.target);

        // 添加所有相关节点
        [...sourceFileNodes, ...targetFileNodes].forEach(node => {
          if (!relatedNodes.has(node)) {
            console.log(`[Debug] Adding node from import: ${node.name}`);
            relatedNodes.add(node);
            findRelatedNodes(node.id, distance + 1);
          }
        });
      } else {
        // 处理其他类型的关系
        const targetId = edge.source === nodeId ? edge.target : edge.source;
        const targetNode = graph.nodes.find(n => n.id === targetId);
        if (targetNode && !relatedNodes.has(targetNode)) {
          console.log(`[Debug] Adding node from relation: ${targetNode.name}`);
          relatedNodes.add(targetNode);
          findRelatedNodes(targetId, distance + 1);
        }
      }
    });
  }

  // 从每个起始节点开始搜索
  startNodes.forEach(node => {
    relatedNodes.add(node);
    findRelatedNodes(node.id, 1);
  });

  return {
    nodes: Array.from(relatedNodes).slice(0, limit),
    edges: Array.from(relatedEdges),
    metadata: {
      totalNodes: relatedNodes.size,
      totalEdges: relatedEdges.size,
      entities,
      relationTypes,
      maxDistance
    }
  };
}

function printGraphStats(graph: KnowledgeGraph) {
  console.log('Nodes:', graph.nodes.length);
  console.log('Edges:', graph.edges.length);
  console.log('Unique Relationships:',
    new Set(graph.edges.map(e => `${e.type}:${e.source}->${e.target}`)).size
  );
} 