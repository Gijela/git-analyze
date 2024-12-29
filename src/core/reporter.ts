import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import type { DependencyGraph, DependencyNode } from './dependency';
import { ComplexityAnalyzer, FileComplexity } from './complexity';
import { ChangeAnalyzer, ChangeAnalysis } from './change-analyzer';
import { CommentAnalyzer, CommentAnalysis } from './comment-analyzer';
import { LearningPathGenerator } from './learning-path';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

interface ReportOptions {
  outputDir: string;
  format: 'json' | 'html' | 'mermaid' | 'dot';
  includeExports?: boolean;
  excludeNodeModules?: boolean;
  includeComplexity?: boolean;
  includeChanges?: boolean;
  includeComments?: boolean;
  includeLearningPath?: boolean;
  since?: string;
}

interface CommentItem {
  file: string;
  line: number;
  content: string;
}

export class DependencyReporter {
  private complexityAnalyzer: ComplexityAnalyzer;
  private changeAnalyzer: ChangeAnalyzer;
  private commentAnalyzer: CommentAnalyzer;
  private complexityMetrics: Map<string, FileComplexity> = new Map();
  private changeAnalysis?: ChangeAnalysis;
  private commentAnalyses: Map<string, CommentAnalysis> = new Map();

  constructor(
    private graph: DependencyGraph,
    private rootDir: string
  ) {
    this.complexityAnalyzer = new ComplexityAnalyzer();
    this.changeAnalyzer = new ChangeAnalyzer(rootDir);
    this.commentAnalyzer = new CommentAnalyzer();
  }

  /**
   * 生成依赖报告
   */
  async generateReport(options: ReportOptions): Promise<void> {
    await this.ensureOutputDir(options.outputDir);

    if (options.includeComplexity) {
      await this.analyzeComplexity();
    }

    if (options.includeChanges) {
      this.changeAnalysis = await this.changeAnalyzer.analyze(options.since);
    }

    if (options.includeComments) {
      await this.analyzeComments();
    }

    switch (options.format) {
      case 'json':
        await this.generateJsonReport(options);
        break;
      case 'html':
        await this.generateHtmlReport(options);
        break;
      case 'mermaid':
        await this.generateMermaidReport(options);
        break;
      case 'dot':
        await this.generateDotReport(options);
        break;
    }
  }

  /**
   * 分析所有文件的复杂度
   */
  private async analyzeComplexity(): Promise<void> {
    for (const [filePath] of this.graph.nodes) {
      try {
        const absolutePath = path.resolve(this.rootDir, filePath);
        const complexity = await this.complexityAnalyzer.analyzeFile(absolutePath);
        this.complexityMetrics.set(filePath, complexity);
      } catch (error) {
        console.error(`Error analyzing complexity for ${filePath}:`, error);
      }
    }
  }

  /**
   * 分析所有文件的注释
   */
  private async analyzeComments(): Promise<void> {
    for (const [filePath] of this.graph.nodes) {
      try {
        const absolutePath = path.resolve(this.rootDir, filePath);
        const analysis = await this.commentAnalyzer.analyzeFile(absolutePath);
        this.commentAnalyses.set(filePath, analysis);
      } catch (error) {
        console.error(`Error analyzing comments for ${filePath}:`, error);
      }
    }
  }

  /**
   * 生成JSON格式报告
   */
  private async generateJsonReport(options: ReportOptions): Promise<void> {
    const report = {
      nodes: Array.from(this.graph.nodes.entries()).map(([key, node]) => ({
        file: key,
        imports: Array.from(node.dependencies),
        exports: options.includeExports ? node.exports : undefined,
        complexity: options.includeComplexity ? this.complexityMetrics.get(key) : undefined,
        changes: options.includeChanges ? this.changeAnalysis?.files.find(f => f.filePath === key) : undefined,
        comments: options.includeComments ? this.commentAnalyses.get(key) : undefined
      })),
      cycles: this.graph.cycles,
      summary: this.generateSummary(options),
      changes: options.includeChanges ? {
        hotspots: this.changeAnalysis?.hotspots,
        riskAreas: this.changeAnalysis?.riskAreas,
        contributors: this.changeAnalysis?.contributors,
        timeline: this.changeAnalysis?.timeline
      } : undefined,
      comments: options.includeComments ? this.generateCommentsSummary() : undefined,
      learningPath: options.includeLearningPath ? this.generateLearningPath() : undefined
    };

    await writeFile(
      path.join(options.outputDir, 'dependency-report.json'),
      JSON.stringify(report, null, 2)
    );
  }

  /**
   * 生成HTML格式报告
   */
  private async generateHtmlReport(options: ReportOptions): Promise<void> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>依赖关系报告</title>
  <style>
    ${this.getStyles()}
    ${this.getCommentStyles()}
    ${this.getLearningPathStyles()}
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <h1>项目依赖关系报告</h1>
  
  <div class="section">
    <h2>依赖关系概要</h2>
    <div class="summary">
      ${this.generateHtmlSummary(options)}
    </div>
  </div>

  <div class="section">
    <h2>文件依赖</h2>
    ${this.generateHtmlDependencies(options)}
  </div>

  ${this.graph.cycles.length > 0 ? `
  <div class="section">
    <h2>循环依赖</h2>
    ${this.generateHtmlCycles()}
  </div>
  ` : ''}

  ${options.includeComplexity ? `
  <div class="section">
    <h2>复杂度分析</h2>
    ${this.generateHtmlComplexity()}
  </div>
  ` : ''}

  ${options.includeChanges && this.changeAnalysis ? `
  <div class="section">
    <h2>变更分析</h2>
    ${this.generateHtmlChanges()}
  </div>
  ` : ''}

  ${options.includeComments ? this.generateHtmlComments() : ''}

  ${options.includeLearningPath ? this.generateHtmlLearningPath() : ''}

  ${options.includeChanges && this.changeAnalysis ? `
  <div class="section">
    <h2>变更时间线</h2>
    <canvas id="timelineChart"></canvas>
  </div>
  <script>
    ${this.generateTimelineChart()}
  </script>
  ` : ''}
</body>
</html>`;

    return writeFile(
      path.join(options.outputDir, 'dependency-report.html'),
      html
    );
  }

  /**
   * 生成HTML格式的复杂度报告
   */
  private generateHtmlComplexity(): string {
    return Array.from(this.complexityMetrics.entries())
      .map(([file, complexity]) => {
        const { metrics, functions } = complexity;
        const complexityClass = metrics.cyclomaticComplexity > 20 ? 'critical' :
          metrics.cyclomaticComplexity > 10 ? 'warning' : '';

        return `
          <div class="file-entry ${complexityClass}">
            <h3 class="file">${file}</h3>
            <div class="metrics-grid">
              <div class="metric-card">
                <h4>圈复杂度</h4>
                <div class="progress-bar">
                  <div class="progress-bar-fill" style="width: ${Math.min(100, metrics.cyclomaticComplexity * 5)}%"></div>
                </div>
                <p>${metrics.cyclomaticComplexity}</p>
              </div>
              <div class="metric-card">
                <h4>可维护性指数</h4>
                <div class="progress-bar">
                  <div class="progress-bar-fill" style="width: ${metrics.maintainabilityIndex}%"></div>
                </div>
                <p>${metrics.maintainabilityIndex.toFixed(2)}</p>
              </div>
              <div class="metric-card">
                <h4>代码行数</h4>
                <p>${metrics.linesOfCode}</p>
              </div>
              <div class="metric-card">
                <h4>注释率</h4>
                <div class="progress-bar">
                  <div class="progress-bar-fill" style="width: ${metrics.commentRatio * 100}%"></div>
                </div>
                <p>${(metrics.commentRatio * 100).toFixed(1)}%</p>
              </div>
            </div>
            ${functions.length > 0 ? `
              <div class="functions">
                <h4>函数复杂度</h4>
                <ul>
                  ${functions.map(fn => `
                    <li class="${fn.metrics.cyclomaticComplexity > 15 ? 'complexity-critical' :
            fn.metrics.cyclomaticComplexity > 8 ? 'complexity-warning' : ''}">
                      ${fn.name}: ${fn.metrics.cyclomaticComplexity}
                    </li>
                  `).join('\n')}
                </ul>
              </div>
            ` : ''}
          </div>
        `;
      }).join('\n');
  }

  /**
   * 生成Mermaid格式报告
   */
  private async generateMermaidReport(options: ReportOptions): Promise<void> {
    let mermaid = 'graph TD;\n';

    this.graph.nodes.forEach((node, file) => {
      const nodeId = this.sanitizeId(file);
      node.dependencies.forEach(dep => {
        if (!options.excludeNodeModules || !dep.includes('node_modules')) {
          mermaid += `  ${nodeId} --> ${this.sanitizeId(dep)};\n`;
        }
      });
    });

    await writeFile(
      path.join(options.outputDir, 'dependency-graph.mmd'),
      mermaid
    );
  }

  /**
   * 生成DOT格式报告
   */
  private async generateDotReport(options: ReportOptions): Promise<void> {
    let dot = 'digraph DependencyGraph {\n';
    dot += '  node [shape=box];\n';

    this.graph.nodes.forEach((node, file) => {
      const nodeId = this.sanitizeId(file);
      node.dependencies.forEach(dep => {
        if (!options.excludeNodeModules || !dep.includes('node_modules')) {
          dot += `  "${nodeId}" -> "${this.sanitizeId(dep)}";\n`;
        }
      });
    });

    dot += '}\n';

    await writeFile(
      path.join(options.outputDir, 'dependency-graph.dot'),
      dot
    );
  }

  /**
   * 生成报告概要
   */
  private generateSummary(options: ReportOptions): object {
    const totalFiles = this.graph.nodes.size;
    const totalDependencies = Array.from(this.graph.nodes.values())
      .reduce((sum, node) => sum + node.dependencies.size, 0);
    const avgDependencies = totalDependencies / totalFiles;
    const maxDependencies = Math.max(
      ...Array.from(this.graph.nodes.values())
        .map(node => node.dependencies.size)
    );

    return {
      totalFiles,
      totalDependencies,
      avgDependencies,
      maxDependencies,
      circularDependencies: this.graph.cycles.length
    };
  }

  /**
   * 生成HTML格式的概要
   */
  private generateHtmlSummary(options: ReportOptions): string {
    const summary = this.generateSummary(options) as any;
    return `
      <p>总文件数: ${summary.totalFiles}</p>
      <p>总依赖数: ${summary.totalDependencies}</p>
      <p>平均依赖数: ${summary.avgDependencies.toFixed(2)}</p>
      <p>最大依赖数: ${summary.maxDependencies}</p>
      <p>循环依赖数: ${summary.circularDependencies}</p>
    `;
  }

  /**
   * 生成HTML格式的依赖关系
   */
  private generateHtmlDependencies(options: ReportOptions): string {
    return Array.from(this.graph.nodes.entries())
      .map(([file, node]) => `
        <div class="file-entry">
          <h3 class="file">${file}</h3>
          <p>依赖 (${node.dependencies.size}):</p>
          <ul>
            ${Array.from(node.dependencies)
          .filter(dep => !options.excludeNodeModules || !dep.includes('node_modules'))
          .map(dep => `<li>${dep}</li>`)
          .join('\n')}
          </ul>
          ${options.includeExports && node.exports.length > 0 ? `
            <p>导出 (${node.exports.length}):</p>
            <ul>
              ${node.exports.map(exp => `<li>${exp}</li>`).join('\n')}
            </ul>
          ` : ''}
        </div>
      `).join('\n');
  }

  /**
   * 生成HTML格式的循环依赖
   */
  private generateHtmlCycles(): string {
    return this.graph.cycles
      .map((cycle, index) => `
        <div class="cycle">
          <h3>循环依赖 #${index + 1}</h3>
          <p>${cycle.join(' → ')} → ${cycle[0]}</p>
        </div>
      `).join('\n');
  }

  /**
   * 清理ID以用于图形生成
   */
  private sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * 确保输出目录存在
   */
  private async ensureOutputDir(dir: string): Promise<void> {
    try {
      await mkdir(dir, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * 生成HTML格式的变更分析
   */
  private generateHtmlChanges(): string {
    if (!this.changeAnalysis) return '';

    return `
      <div class="changes-container">
        <div class="changes-section">
          <h3>热点文件</h3>
          <ul class="hotspots">
            ${this.changeAnalysis.hotspots.map(file => `
              <li class="hotspot">
                <span class="file">${file}</span>
                ${this.getFileChangeStats(file)}
              </li>
            `).join('\n')}
          </ul>
        </div>

        <div class="changes-section">
          <h3>风险区域</h3>
          <ul class="risk-areas">
            ${this.changeAnalysis.riskAreas.map(file => `
              <li class="risk-area">
                <span class="file">${file}</span>
                ${this.getFileRiskInfo(file)}
              </li>
            `).join('\n')}
          </ul>
        </div>

        <div class="changes-section">
          <h3>贡献者统计</h3>
          <ul class="contributors">
            ${this.changeAnalysis.contributors.map(contributor => `
              <li class="contributor">
                <div class="contributor-info">
                  <span class="name">${contributor.name}</span>
                  <span class="stats">
                    提交: ${contributor.commits} | 变更: ${contributor.changes}
                  </span>
                </div>
                <div class="progress-bar">
                  <div class="progress-bar-fill" style="width: ${(contributor.changes / Math.max(...this.changeAnalysis!.contributors.map(c => c.changes))) * 100
      }%"></div>
                </div>
              </li>
            `).join('\n')}
          </ul>
        </div>
      </div>
    `;
  }

  /**
   * 获取文件变更统计
   */
  private getFileChangeStats(filePath: string): string {
    const fileChange = this.changeAnalysis?.files.find(f => f.filePath === filePath);
    if (!fileChange) return '';

    return `
      <div class="file-stats">
        <span class="stat">添加: ${fileChange.additions}</span>
        <span class="stat">删除: ${fileChange.deletions}</span>
        <span class="stat">变更: ${fileChange.changes}</span>
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width: ${Math.min(100, fileChange.impactScore)}%"></div>
        </div>
      </div>
    `;
  }

  /**
   * 获取文件风险信息
   */
  private getFileRiskInfo(filePath: string): string {
    const fileChange = this.changeAnalysis?.files.find(f => f.filePath === filePath);
    if (!fileChange) return '';

    const risks = [];
    if (fileChange.complexity.cyclomaticComplexity > 15) {
      risks.push('高复杂度');
    }
    if (fileChange.changes > 100) {
      risks.push('频繁变更');
    }
    if (fileChange.complexity.maintainabilityIndex < 65) {
      risks.push('低可维护性');
    }

    return `
      <div class="risk-info">
        <div class="risk-tags">
          ${risks.map(risk => `<span class="risk-tag">${risk}</span>`).join('')}
        </div>
        <div class="progress-bar">
          <div class="progress-bar-fill ${fileChange.impactScore > 75 ? 'critical' :
        fileChange.impactScore > 50 ? 'warning' : ''
      }" style="width: ${Math.min(100, fileChange.impactScore)}%"></div>
        </div>
      </div>
    `;
  }

  /**
   * 生成时间线图表
   */
  private generateTimelineChart(): string {
    if (!this.changeAnalysis) return '';

    const data = this.changeAnalysis.timeline;
    return `
      const ctx = document.getElementById('timelineChart').getContext('2d');
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: ${JSON.stringify(data.map(d => d.date))},
          datasets: [{
            label: '变更量',
            data: ${JSON.stringify(data.map(d => d.changes))},
            borderColor: '#0984e3',
            backgroundColor: 'rgba(9, 132, 227, 0.1)',
            fill: true
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    `;
  }

  /**
   * 获取样式
   */
  private getStyles(): string {
    return `
      ${this.getBaseStyles()}
      
      .changes-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
        margin: 20px 0;
      }

      .changes-section {
        background: #fff;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .hotspots, .risk-areas, .contributors {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .hotspot, .risk-area, .contributor {
        margin-bottom: 15px;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 4px;
      }

      .file-stats, .risk-info {
        margin-top: 8px;
      }

      .stat {
        margin-right: 15px;
        color: #666;
      }

      .risk-tags {
        margin: 5px 0;
      }

      .risk-tag {
        display: inline-block;
        padding: 2px 8px;
        margin-right: 5px;
        background: #ff7675;
        color: white;
        border-radius: 12px;
        font-size: 12px;
      }

      .contributor-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 5px;
      }

      .name {
        font-weight: bold;
      }

      .stats {
        color: #666;
        font-size: 14px;
      }
    `;
  }

  /**
   * 获取基础样式
   */
  private getBaseStyles(): string {
    return `
      body { 
        font-family: Arial, sans-serif; 
        margin: 20px;
        background: #f8f9fa;
      }
      .section { 
        margin-bottom: 30px;
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .cycle { color: #d63031; }
      .file { color: #0984e3; }
      .summary { 
        background: #f5f6fa; 
        padding: 15px; 
        border-radius: 5px;
      }
      .complexity-warning { color: #e17055; }
      .complexity-critical { color: #d63031; }
      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 15px;
        margin: 15px 0;
      }
      .metric-card {
        background: #fff;
        padding: 15px;
        border-radius: 5px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .progress-bar {
        width: 100%;
        height: 8px;
        background: #eee;
        border-radius: 4px;
        overflow: hidden;
      }
      .progress-bar-fill {
        height: 100%;
        background: #00b894;
        transition: width 0.3s ease;
      }
      .warning .progress-bar-fill { background: #fdcb6e; }
      .critical .progress-bar-fill { background: #d63031; }
    `;
  }

  private generateCommentsSummary(): object {
    const allAnalyses = Array.from(this.commentAnalyses.values());

    const totalTodos = allAnalyses.reduce((sum, analysis) => sum + analysis.summary.todoCount, 0);
    const totalFixmes = allAnalyses.reduce((sum, analysis) => sum + analysis.summary.fixmeCount, 0);
    const totalDocs = allAnalyses.reduce((sum, analysis) => sum + analysis.summary.docCount, 0);
    const totalImportant = allAnalyses.reduce((sum, analysis) => sum + analysis.summary.importantCount, 0);

    const avgCoverage = allAnalyses.reduce((sum, analysis) => sum + analysis.coverage.ratio, 0) / allAnalyses.length;

    return {
      total: {
        todos: totalTodos,
        fixmes: totalFixmes,
        docComments: totalDocs,
        importantNotes: totalImportant
      },
      coverage: {
        average: avgCoverage,
        files: Array.from(this.commentAnalyses.entries()).map(([file, analysis]) => ({
          file,
          ratio: analysis.coverage.ratio
        }))
      },
      todos: Array.from(this.commentAnalyses.entries())
        .flatMap(([file, analysis]) =>
          analysis.todos.map(todo => ({ ...todo, file }))
        ),
      fixmes: Array.from(this.commentAnalyses.entries())
        .flatMap(([file, analysis]) =>
          analysis.fixmes.map(fixme => ({ ...fixme, file }))
        ),
      importantNotes: Array.from(this.commentAnalyses.entries())
        .flatMap(([file, analysis]) =>
          analysis.importantNotes.map(note => ({ ...note, file }))
        )
    };
  }

  private generateHtmlComments(): string {
    if (this.commentAnalyses.size === 0) return '';

    const summary = this.generateCommentsSummary() as any;

    return `
      <div class="section">
        <h2>注释分析</h2>
        
        <div class="summary-grid">
          <div class="summary-card">
            <h3>待办事项</h3>
            <p class="large-number">${summary.total.todos}</p>
          </div>
          <div class="summary-card">
            <h3>需修复项</h3>
            <p class="large-number">${summary.total.fixmes}</p>
          </div>
          <div class="summary-card">
            <h3>文档注释</h3>
            <p class="large-number">${summary.total.docComments}</p>
          </div>
          <div class="summary-card">
            <h3>重要注释</h3>
            <p class="large-number">${summary.total.importantNotes}</p>
          </div>
        </div>

        <div class="subsection">
          <h3>文档覆盖率</h3>
          <div class="coverage-chart">
            <div class="progress-bar">
              <div class="progress-bar-fill" style="width: ${summary.coverage.average * 100}%"></div>
            </div>
            <p>平均覆盖率: ${(summary.coverage.average * 100).toFixed(1)}%</p>
          </div>
        </div>

        ${summary.todos.length > 0 ? `
          <div class="subsection">
            <h3>待办事项列表</h3>
            <ul class="todo-list">
              ${summary.todos.map((todo: CommentItem) => `
                <li>
                  <span class="file-name">${todo.file}</span>
                  <span class="line-number">行 ${todo.line}</span>
                  <span class="content">${todo.content}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        ${summary.fixmes.length > 0 ? `
          <div class="subsection">
            <h3>需修复项列表</h3>
            <ul class="fixme-list">
              ${summary.fixmes.map((fixme: CommentItem) => `
                <li>
                  <span class="file-name">${fixme.file}</span>
                  <span class="line-number">行 ${fixme.line}</span>
                  <span class="content">${fixme.content}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        ${summary.importantNotes.length > 0 ? `
          <div class="subsection">
            <h3>重要注释列表</h3>
            <ul class="important-list">
              ${summary.importantNotes.map((note: CommentItem) => `
                <li>
                  <span class="file-name">${note.file}</span>
                  <span class="line-number">行 ${note.line}</span>
                  <span class="content">${note.content}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  }

  private getCommentStyles(): string {
    return `
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin: 20px 0;
      }

      .summary-card {
        background: #fff;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        text-align: center;
      }

      .large-number {
        font-size: 2em;
        font-weight: bold;
        color: #0984e3;
        margin: 10px 0;
      }

      .coverage-chart {
        margin: 20px 0;
      }

      .todo-list, .fixme-list, .important-list {
        list-style: none;
        padding: 0;
      }

      .todo-list li, .fixme-list li, .important-list li {
        background: #f8f9fa;
        margin: 10px 0;
        padding: 10px;
        border-radius: 4px;
        display: grid;
        grid-template-columns: 200px 100px 1fr;
        gap: 10px;
      }

      .file-name {
        color: #0984e3;
        font-family: monospace;
      }

      .line-number {
        color: #666;
      }

      .content {
        color: #2d3436;
      }

      .fixme-list li {
        border-left: 4px solid #d63031;
      }

      .todo-list li {
        border-left: 4px solid #fdcb6e;
      }

      .important-list li {
        border-left: 4px solid #00b894;
      }
    `;
  }

  private generateLearningPath(): object {
    const pathGenerator = new LearningPathGenerator(
      this.graph,
      this.complexityMetrics,
      this.commentAnalyses,
      this.changeAnalysis
    );
    return pathGenerator.generate();
  }

  private generateHtmlLearningPath(): string {
    const learningPath = this.generateLearningPath() as any;

    return `
      <div class="section">
        <h2>学习路径</h2>
        
        <div class="learning-stages">
          ${learningPath.stages.map((stage: any, index: number) => `
            <div class="learning-stage">
              <h3>${index + 1}. ${stage.name}</h3>
              <p class="stage-description">${stage.description}</p>
              <p class="stage-time">预计耗时: ${stage.estimatedTime}</p>
              
              <div class="stage-files">
                ${stage.files.map((file: string) => {
      const node = learningPath.nodes.find((n: any) => n.file === file);
      return node ? `
                    <div class="file-card">
                      <h4 class="file-name">${file}</h4>
                      <p class="file-description">${node.description}</p>
                      
                      ${node.complexity ? `
                        <div class="metric">
                          <span>复杂度:</span>
                          <div class="progress-bar">
                            <div class="progress-bar-fill" style="width: ${Math.min(100, node.complexity * 5)}%"></div>
                          </div>
                        </div>
                      ` : ''}
                      
                      ${node.docCoverage ? `
                        <div class="metric">
                          <span>文档覆盖率:</span>
                          <div class="progress-bar">
                            <div class="progress-bar-fill" style="width: ${node.docCoverage * 100}%"></div>
                          </div>
                        </div>
                      ` : ''}
                      
                      ${node.learningPoints.length > 0 ? `
                        <div class="learning-points">
                          <h5>学习要点:</h5>
                          <ul>
                            ${node.learningPoints.map((point: string) => `
                              <li>${point}</li>
                            `).join('')}
                          </ul>
                        </div>
                      ` : ''}
                    </div>
                  ` : '';
    }).join('')}
              </div>
            </div>
          `).join('')}
        </div>

        <div class="recommendations">
          <h3>学习建议</h3>
          <ul>
            ${learningPath.recommendations.map((rec: any) => `
              <li>
                <span class="file-name">${rec.file}</span>
                <span class="reason">${rec.reason}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      </div>
    `;
  }

  private getLearningPathStyles(): string {
    return `
      .learning-stages {
        display: flex;
        flex-direction: column;
        gap: 30px;
        margin: 20px 0;
      }

      .learning-stage {
        background: #fff;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .stage-description {
        color: #666;
        margin: 10px 0;
      }

      .stage-time {
        color: #0984e3;
        font-weight: bold;
      }

      .stage-files {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
        margin-top: 20px;
      }

      .file-card {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 6px;
        border-left: 4px solid #0984e3;
      }

      .file-name {
        color: #0984e3;
        margin: 0 0 10px 0;
        font-family: monospace;
      }

      .file-description {
        color: #2d3436;
        margin: 10px 0;
      }

      .metric {
        margin: 10px 0;
      }

      .metric span {
        display: block;
        margin-bottom: 5px;
        color: #666;
      }

      .learning-points {
        margin-top: 15px;
      }

      .learning-points h5 {
        color: #2d3436;
        margin: 0 0 10px 0;
      }

      .learning-points ul {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .learning-points li {
        padding: 5px 0;
        color: #666;
        position: relative;
        padding-left: 20px;
      }

      .learning-points li:before {
        content: "•";
        color: #0984e3;
        position: absolute;
        left: 0;
        font-weight: bold;
      }

      .recommendations {
        margin-top: 30px;
      }

      .recommendations ul {
        list-style: none;
        padding: 0;
      }

      .recommendations li {
        display: flex;
        align-items: center;
        padding: 10px;
        background: #f8f9fa;
        margin: 10px 0;
        border-radius: 4px;
      }

      .recommendations .file-name {
        min-width: 200px;
        margin: 0;
      }

      .recommendations .reason {
        color: #666;
      }
    `;
  }
} 