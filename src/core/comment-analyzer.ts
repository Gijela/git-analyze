import * as fs from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

/**
 * 注释类型
 */
export enum CommentType {
  TODO = 'TODO',
  FIXME = 'FIXME',
  NOTE = 'NOTE',
  IMPORTANT = 'IMPORTANT',
  DEPRECATED = 'DEPRECATED'
}

/**
 * 注释信息接口
 */
export interface CommentInfo {
  type: CommentType | string;
  content: string;
  line: number;
  file: string;
  isDocComment: boolean;
  priority: number;
  tags: string[];
}

/**
 * 注释分析结果接口
 */
export interface CommentAnalysis {
  todos: CommentInfo[];
  fixmes: CommentInfo[];
  docComments: CommentInfo[];
  importantNotes: CommentInfo[];
  coverage: {
    total: number;
    documented: number;
    ratio: number;
  };
  summary: {
    todoCount: number;
    fixmeCount: number;
    docCount: number;
    importantCount: number;
  };
}

/**
 * 注释分析器类
 */
export class CommentAnalyzer {
  /**
   * 分析文件中的注释
   */
  async analyzeFile(filePath: string): Promise<CommentAnalysis> {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    const comments: CommentInfo[] = [];
    let inMultilineComment = false;
    let currentMultilineComment = '';
    let multilineStartLine = 0;

    // 分析每一行
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 处理多行注释
      if (inMultilineComment) {
        if (line.includes('*/')) {
          inMultilineComment = false;
          currentMultilineComment += line.substring(0, line.indexOf('*/'));
          comments.push(this.parseComment(currentMultilineComment, multilineStartLine, filePath));
        } else {
          currentMultilineComment += line + '\n';
        }
        continue;
      }

      // 检查新的多行注释
      if (line.startsWith('/*')) {
        inMultilineComment = true;
        multilineStartLine = i + 1;
        currentMultilineComment = line.substring(2) + '\n';
        continue;
      }

      // 处理单行注释
      if (line.startsWith('//')) {
        const comment = line.substring(2).trim();
        comments.push(this.parseComment(comment, i + 1, filePath));
      }
    }

    return this.generateAnalysis(comments, lines.length);
  }

  /**
   * 解析注释内容
   */
  private parseComment(content: string, line: number, file: string): CommentInfo {
    const upperContent = content.toUpperCase();
    let type = CommentType.NOTE;
    let priority = 1;
    const tags: string[] = [];

    // 检查注释类型
    if (upperContent.includes('@IMPORTANT') || upperContent.includes('!IMPORTANT')) {
      type = CommentType.IMPORTANT;
      priority = 3;
      tags.push('important');
    } else if (upperContent.includes('TODO')) {
      type = CommentType.TODO;
      priority = 2;
      tags.push('todo');
    } else if (upperContent.includes('FIXME')) {
      type = CommentType.FIXME;
      priority = 3;
      tags.push('fixme');
    } else if (upperContent.includes('@DEPRECATED')) {
      type = CommentType.DEPRECATED;
      priority = 2;
      tags.push('deprecated');
    }

    // 检查是否为文档注释
    const isDocComment = content.startsWith('*') || content.startsWith('/**');

    // 提取其他标签
    const tagMatches = content.match(/@\w+/g);
    if (tagMatches) {
      tags.push(...tagMatches.map(tag => tag.substring(1)));
    }

    return {
      type,
      content: content.trim(),
      line,
      file,
      isDocComment,
      priority,
      tags
    };
  }

  /**
   * 生成分析结果
   */
  private generateAnalysis(comments: CommentInfo[], totalLines: number): CommentAnalysis {
    const todos = comments.filter(c => c.type === CommentType.TODO);
    const fixmes = comments.filter(c => c.type === CommentType.FIXME);
    const docComments = comments.filter(c => c.isDocComment);
    const importantNotes = comments.filter(c => c.type === CommentType.IMPORTANT);

    // 计算文档覆盖率
    const documented = new Set(docComments.map(c => Math.floor(c.line / 10))).size;
    const total = Math.ceil(totalLines / 10);
    const coverage = {
      total,
      documented,
      ratio: documented / total
    };

    return {
      todos,
      fixmes,
      docComments,
      importantNotes,
      coverage,
      summary: {
        todoCount: todos.length,
        fixmeCount: fixmes.length,
        docCount: docComments.length,
        importantCount: importantNotes.length
      }
    };
  }
} 