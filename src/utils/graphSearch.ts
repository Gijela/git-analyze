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

  console.log("🚀 ~ searchKnowledgeGraph ~ entities:", entities)
  console.log("🚀 ~ searchKnowledgeGraph ~ nodes:", graph.nodes[0])

  // 1. 找到名称匹配的起始节点
  const startNodes = new Set(
    graph.nodes.filter(node =>
      entities.some(entity => {
        const searchKey = node.type === 'class' ? `${node.filePath}#${node.name}` : node.name;
        return searchKey.toLowerCase().includes(entity.toLowerCase())
      })
    )
  );

  // 2. 找到相关联的节点和边
  const relatedNodes = new Set<KnowledgeNode>();
  const relatedEdges = new Set<KnowledgeEdge>();

  function findRelatedNodes(nodeId: string, distance: number) {
    if (distance > maxDistance) return;

    const edges = graph.edges.filter(edge => {
      // 双重过滤：类型过滤+方向过滤
      const typeMatch = relationTypes.length ? relationTypes.includes(edge.type) : true;
      const directionMatch = edge.type === 'imports' ? edge.source === nodeId : true;
      return typeMatch && directionMatch;
    });

    edges.forEach(edge => {
      const isBidirectional = !['imports', 'extends'].includes(edge.type);
      const targetNodeId = edge.source === nodeId ? edge.target : isBidirectional ? edge.source : null;

      if (targetNodeId) {
        const relatedNode = graph.nodes.find(n => n.id === targetNodeId);
        if (relatedNode && !relatedNodes.has(relatedNode)) {
          relatedNodes.add(relatedNode);
          findRelatedNodes(targetNodeId, distance + 1);
        }
      }
    });
  }

  // 从每个起始实体开始搜索关联
  startNodes.forEach(node => {
    relatedNodes.add(node);
    findRelatedNodes(node.id, 1);
  });

  // 如果没有找到任何起始节点，返回空结果
  if (startNodes.size === 0) {
    return {
      nodes: [],
      edges: [],
      metadata: {
        totalNodes: 0,
        totalEdges: 0,
        entities,
        relationTypes,
        maxDistance
      }
    };
  }

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

function printGraphStats() {
  console.log('Nodes:', this.knowledgeGraph.nodes.length);
  console.log('Edges:', this.knowledgeGraph.edges.length);
  console.log('Unique Relationships:', 
    new Set(this.knowledgeGraph.edges.map(e => `${e.type}:${e.source}->${e.target}`)).size
  );
} 