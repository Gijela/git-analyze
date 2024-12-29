import * as fs from 'fs';
import { promisify } from 'util';
import { glob } from 'glob';

const readFile = promisify(fs.readFile);

/**
 * 安全问题类型
 */
export enum SecurityIssueType {
  VULNERABILITY = 'vulnerability',
  SENSITIVE_DATA = 'sensitive_data',
  INSECURE_PROTOCOL = 'insecure_protocol',
  WEAK_CRYPTO = 'weak_crypto',
  HARDCODED_SECRET = 'hardcoded_secret',
  UNSAFE_REGEX = 'unsafe_regex'
}

/**
 * 安全问题严重程度
 */
export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * 安全问题接口
 */
export interface SecurityIssue {
  type: SecurityIssueType;
  severity: SecuritySeverity;
  file: string;
  line: number;
  description: string;
  recommendation: string;
  code?: string;
}

/**
 * 安全分析结果
 */
export interface SecurityAnalysis {
  issues: SecurityIssue[];
  summary: {
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
  };
  recommendations: string[];
}

/**
 * 安全分析器类
 */
export class SecurityAnalyzer {
  private sensitivePatterns: RegExp[] = [
    /password\s*=\s*['"][^'"]+['"]/i,
    /api[_-]?key\s*=\s*['"][^'"]+['"]/i,
    /secret\s*=\s*['"][^'"]+['"]/i,
    /token\s*=\s*['"][^'"]+['"]/i
  ];

  private insecureProtocols: RegExp[] = [
    /http:\/\//,
    /ftp:\/\//,
    /telnet:\/\//
  ];

  private weakCryptoPatterns: RegExp[] = [
    /md5/i,
    /sha1/i,
    /des/i
  ];

  private unsafeRegexPatterns: RegExp[] = [
    /\.\*/,
    /\.\+/,
    /\{.*\}/
  ];

  /**
   * 分析文件安全问题
   */
  async analyzeFile(filePath: string): Promise<SecurityIssue[]> {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const issues: SecurityIssue[] = [];

    lines.forEach((line, index) => {
      // 检查敏感数据
      this.sensitivePatterns.forEach(pattern => {
        if (pattern.test(line)) {
          issues.push({
            type: SecurityIssueType.SENSITIVE_DATA,
            severity: SecuritySeverity.HIGH,
            file: filePath,
            line: index + 1,
            description: '发现可能的敏感数据硬编码',
            recommendation: '建议使用环境变量或配置管理系统存储敏感数据',
            code: line.trim()
          });
        }
      });

      // 检查不安全协议
      this.insecureProtocols.forEach(pattern => {
        if (pattern.test(line)) {
          issues.push({
            type: SecurityIssueType.INSECURE_PROTOCOL,
            severity: SecuritySeverity.MEDIUM,
            file: filePath,
            line: index + 1,
            description: '使用了不安全的协议',
            recommendation: '建议使用安全的协议(HTTPS/SFTP等)',
            code: line.trim()
          });
        }
      });

      // 检查弱加密算法
      this.weakCryptoPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          issues.push({
            type: SecurityIssueType.WEAK_CRYPTO,
            severity: SecuritySeverity.HIGH,
            file: filePath,
            line: index + 1,
            description: '使用了弱加密算法',
            recommendation: '建议使用强加密算法(如AES/SHA256等)',
            code: line.trim()
          });
        }
      });

      // 检查不安全的正则表达式
      this.unsafeRegexPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          issues.push({
            type: SecurityIssueType.UNSAFE_REGEX,
            severity: SecuritySeverity.MEDIUM,
            file: filePath,
            line: index + 1,
            description: '可能存在正则表达式注入风险',
            recommendation: '建议限制正则表达式的复杂度和长度',
            code: line.trim()
          });
        }
      });
    });

    return issues;
  }

  /**
   * 分析目录中的所有文件
   */
  async analyzeDirectory(dirPath: string): Promise<SecurityAnalysis> {
    const files = await glob('**/*.{js,ts,json,yaml,yml}', {
      cwd: dirPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
      absolute: true
    });

    const allIssues: SecurityIssue[] = [];
    for (const file of files) {
      try {
        const issues = await this.analyzeFile(file);
        allIssues.push(...issues);
      } catch (error) {
        console.error(`Error analyzing file ${file}:`, error);
      }
    }

    const analysis: SecurityAnalysis = {
      issues: allIssues,
      summary: {
        totalIssues: allIssues.length,
        criticalIssues: allIssues.filter(i => i.severity === SecuritySeverity.CRITICAL).length,
        highIssues: allIssues.filter(i => i.severity === SecuritySeverity.HIGH).length,
        mediumIssues: allIssues.filter(i => i.severity === SecuritySeverity.MEDIUM).length,
        lowIssues: allIssues.filter(i => i.severity === SecuritySeverity.LOW).length
      },
      recommendations: this.generateRecommendations(allIssues)
    };

    return analysis;
  }

  /**
   * 生成安全建议
   */
  private generateRecommendations(issues: SecurityIssue[]): string[] {
    const recommendations: string[] = [];

    // 按问题类型分组
    const issuesByType = issues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 生成建议
    Object.entries(issuesByType).forEach(([type, count]) => {
      switch (type) {
        case SecurityIssueType.SENSITIVE_DATA:
          recommendations.push(
            `发现 ${count} 处敏感数据硬编码，建议使用环境变量或安全的配置管理系统`
          );
          break;
        case SecurityIssueType.INSECURE_PROTOCOL:
          recommendations.push(
            `发现 ${count} 处不安全的协议使用，建议更换为安全的协议(HTTPS/SFTP等)`
          );
          break;
        case SecurityIssueType.WEAK_CRYPTO:
          recommendations.push(
            `发现 ${count} 处弱加密算法使用，建议更换为强加密算法(如AES/SHA256等)`
          );
          break;
        case SecurityIssueType.UNSAFE_REGEX:
          recommendations.push(
            `发现 ${count} 处不安全的正则表达式，建议限制正则表达式的复杂度和长度`
          );
          break;
      }
    });

    return recommendations;
  }
} 