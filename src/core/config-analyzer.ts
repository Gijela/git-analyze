import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { glob } from 'glob';
import { load as yamlLoad } from 'js-yaml';
import { CommentAnalyzer } from './comment-analyzer';

const readFile = promisify(fs.readFile);

/**
 * 配置项类型
 */
export enum ConfigValueType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object',
  FUNCTION = 'function'
}

/**
 * 配置项接口
 */
export interface ConfigItem {
  key: string;
  type: ConfigValueType;
  defaultValue: any;
  description: string;
  required: boolean;
  deprecated?: boolean;
  examples?: string[];
  validation?: {
    type: string;
    rule: string;
  };
}

/**
 * 配置文件接口
 */
export interface ConfigFile {
  path: string;
  type: 'json' | 'js' | 'ts' | 'yaml';
  description: string;
  items: ConfigItem[];
  examples: string[];
  dependencies?: string[];
}

/**
 * 配置分析结果
 */
export interface ConfigAnalysis {
  files: ConfigFile[];
  summary: {
    totalConfigs: number;
    requiredConfigs: number;
    deprecatedConfigs: number;
  };
  recommendations: {
    type: string;
    message: string;
  }[];
}

/**
 * 配置分析器类
 */
export class ConfigAnalyzer {
  private commentAnalyzer: CommentAnalyzer;

  constructor() {
    this.commentAnalyzer = new CommentAnalyzer();
  }

  /**
   * 分析配置文件
   */
  async analyzeFile(filePath: string): Promise<ConfigFile> {
    const ext = path.extname(filePath);
    const content = await readFile(filePath, 'utf-8');
    const comments = await this.commentAnalyzer.analyzeFile(filePath);

    let type: 'json' | 'js' | 'ts' | 'yaml';
    switch (ext) {
      case '.json':
        type = 'json';
        break;
      case '.js':
        type = 'js';
        break;
      case '.ts':
        type = 'ts';
        break;
      case '.yml':
      case '.yaml':
        type = 'yaml';
        break;
      default:
        throw new Error(`Unsupported config file type: ${ext}`);
    }

    const description = this.extractFileDescription(comments);
    const items = await this.extractConfigItems(content, type);
    const examples = this.extractExamples(comments);

    return {
      path: filePath,
      type,
      description,
      items,
      examples
    };
  }

  /**
   * 分析目录中的所有配置文件
   */
  async analyzeDirectory(dirPath: string): Promise<ConfigAnalysis> {
    const configFiles: ConfigFile[] = [];
    const configPatterns = [
      '**/*.config.{js,ts,json,yaml,yml}',
      '**/config.{js,ts,json,yaml,yml}',
      '**/settings.{js,ts,json,yaml,yml}',
      '**/.{eslint,prettier,babel,tsconfig}*'
    ];

    // 扫描配置文件
    const files = await glob(configPatterns, {
      cwd: dirPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
      absolute: true
    });

    // 分析每个配置文件
    for (const file of files) {
      try {
        const configFile = await this.analyzeFile(file);
        configFiles.push(configFile);
      } catch (error) {
        console.error(`Error analyzing config file ${file}:`, error);
      }
    }

    const analysis: ConfigAnalysis = {
      files: configFiles,
      summary: {
        totalConfigs: 0,
        requiredConfigs: 0,
        deprecatedConfigs: 0
      },
      recommendations: []
    };

    // 更新统计信息
    configFiles.forEach(file => {
      analysis.summary.totalConfigs += file.items.length;
      analysis.summary.requiredConfigs += file.items.filter(item => item.required).length;
      analysis.summary.deprecatedConfigs += file.items.filter(item => item.deprecated).length;
    });

    // 生成建议
    this.generateRecommendations(analysis);

    return analysis;
  }

  /**
   * 提取文件描述
   */
  private extractFileDescription(comments: any): string {
    const fileComments = comments.docComments.filter((c: any) =>
      c.content.includes('@fileoverview') ||
      c.content.includes('@file') ||
      c.content.includes('@description')
    );

    if (fileComments.length > 0) {
      return fileComments[0].content
        .replace(/@fileoverview\s*/, '')
        .replace(/@file\s*/, '')
        .replace(/@description\s*/, '')
        .trim();
    }

    return '配置文件';
  }

  /**
   * 提取配置项
   */
  private async extractConfigItems(content: string, type: 'json' | 'js' | 'ts' | 'yaml'): Promise<ConfigItem[]> {
    const items: ConfigItem[] = [];

    switch (type) {
      case 'json':
        items.push(...this.parseJsonConfig(content));
        break;
      case 'js':
      case 'ts':
        items.push(...this.parseJsConfig(content));
        break;
      case 'yaml':
        items.push(...this.parseYamlConfig(content));
        break;
    }

    return items;
  }

  /**
   * 解析 JSON 配置
   */
  private parseJsonConfig(content: string): ConfigItem[] {
    const items: ConfigItem[] = [];
    try {
      const config = JSON.parse(content);
      this.extractConfigItemsFromObject(config, '', items);
    } catch (error) {
      console.error('Error parsing JSON config:', error);
    }
    return items;
  }

  /**
   * 解析 JavaScript/TypeScript 配置
   */
  private parseJsConfig(content: string): ConfigItem[] {
    const items: ConfigItem[] = [];

    // 提取导出的配置对象
    const exportMatches = content.match(/export\s+(default\s+)?({[\s\S]+?})/);
    if (exportMatches) {
      const configStr = exportMatches[2];
      try {
        // 注意：这里需要更安全的方式来解析 JS/TS 配置
        const config = eval(`(${configStr})`);
        this.extractConfigItemsFromObject(config, '', items);
      } catch (error) {
        console.error('Error parsing JS/TS config:', error);
      }
    }

    // 提取配置项注释
    const commentRegex = /\/\*\*\s*([\s\S]*?)\s*\*\/\s*(\w+):/g;
    let match;
    while ((match = commentRegex.exec(content)) !== null) {
      const comment = match[1];
      const key = match[2];
      const item = items.find(i => i.key === key);
      if (item) {
        this.updateConfigItemFromComment(item, comment);
      }
    }

    return items;
  }

  /**
   * 解析 YAML 配置
   */
  private parseYamlConfig(content: string): ConfigItem[] {
    const items: ConfigItem[] = [];
    try {
      const config = yamlLoad(content);
      if (config && typeof config === 'object') {
        this.extractConfigItemsFromObject(config as object, '', items);
      }
    } catch (error) {
      console.error('Error parsing YAML config:', error);
    }
    return items;
  }

  /**
   * 从对象中提取配置项
   */
  private extractConfigItemsFromObject(obj: any, prefix: string, items: ConfigItem[]): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        this.extractConfigItemsFromObject(value, fullKey, items);
      } else {
        items.push({
          key: fullKey,
          type: this.determineValueType(value),
          defaultValue: value,
          description: '',
          required: false,
          examples: []
        });
      }
    }
  }

  /**
   * 确定值类型
   */
  private determineValueType(value: any): ConfigValueType {
    if (Array.isArray(value)) {
      return ConfigValueType.ARRAY;
    }
    if (typeof value === 'function') {
      return ConfigValueType.FUNCTION;
    }
    if (typeof value === 'object' && value !== null) {
      return ConfigValueType.OBJECT;
    }
    return ConfigValueType[typeof value as keyof typeof ConfigValueType];
  }

  /**
   * 从注释中更新配置项信息
   */
  private updateConfigItemFromComment(item: ConfigItem, comment: string): void {
    // 提取描述
    const description = comment.replace(/@\w+.*$/gm, '').trim();
    if (description) {
      item.description = description;
    }

    // 提取其他标记
    const required = /@required/.test(comment);
    const deprecated = /@deprecated/.test(comment);
    const examples = comment.match(/@example\s+([^\n]+)/g)?.map(e => e.replace(/@example\s+/, ''));
    const validation = comment.match(/@validation\s+{([^}]+)}\s+(.+)/);

    item.required = required;
    item.deprecated = deprecated;
    if (examples) {
      item.examples = examples;
    }
    if (validation) {
      item.validation = {
        type: validation[1],
        rule: validation[2]
      };
    }
  }

  /**
   * 提取示例
   */
  private extractExamples(comments: any): string[] {
    return comments.docComments
      .filter((c: any) => c.content.includes('@example'))
      .map((c: any) => {
        const match = c.content.match(/@example\s+([^\n]+)/);
        return match ? match[1].trim() : '';
      })
      .filter((e: string) => e);
  }

  /**
   * 生成配置建议
   */
  private generateRecommendations(analysis: ConfigAnalysis): void {
    const { files, summary } = analysis;

    // 检查必需配置项
    if (summary.requiredConfigs > 0) {
      analysis.recommendations.push({
        type: 'required',
        message: `项目包含 ${summary.requiredConfigs} 个必需配置项，请确保正确设置`
      });
    }

    // 检查废弃配置项
    if (summary.deprecatedConfigs > 0) {
      analysis.recommendations.push({
        type: 'deprecated',
        message: `发现 ${summary.deprecatedConfigs} 个已废弃配置项，建议更新到最新版本`
      });
    }

    // 检查配置文件格式
    const formatTypes = new Set(files.map(f => f.type));
    if (formatTypes.size > 2) {
      analysis.recommendations.push({
        type: 'format',
        message: '项目使用了多种配置文件格式，建议统一配置文件格式以提高可维护性'
      });
    }

    // 检查配置文件分布
    const configPaths = files.map(f => f.path);
    const rootConfigs = configPaths.filter(p => !p.includes('/'));
    const nestedConfigs = configPaths.filter(p => p.includes('/'));
    if (rootConfigs.length > 0 && nestedConfigs.length > 0) {
      analysis.recommendations.push({
        type: 'structure',
        message: '配置文件分布在不同层级，建议集中管理配置文件'
      });
    }
  }
} 