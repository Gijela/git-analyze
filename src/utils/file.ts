import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import type { FileInfo } from '../types/index.js';

const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

export class FileUtil {
  /**
   * Create FileInfo object from file path and content
   */
  static async createFileInfo(filePath: string, content: string): Promise<FileInfo> {
    const stats = await stat(filePath);

    return {
      path: filePath,
      name: path.basename(filePath),
      extension: path.extname(filePath),
      size: stats.size,
      lines: content.split('\n').length,
      content,
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime
    };
  }

  /**
   * Read file content
   */
  static async readFile(filePath: string): Promise<string> {
    return readFile(filePath, 'utf-8');
  }

  /**
   * Get file extension
   */
  static getExtension(filePath: string): string {
    return path.extname(filePath);
  }

  /**
   * Check if file is TypeScript
   */
  static isTypeScript(filePath: string): boolean {
    const ext = this.getExtension(filePath);
    return ext === '.ts' || ext === '.tsx';
  }

  /**
   * Check if file is JavaScript
   */
  static isJavaScript(filePath: string): boolean {
    const ext = this.getExtension(filePath);
    return ext === '.js' || ext === '.jsx';
  }

  /**
   * Get relative path from workspace root
   */
  static getRelativePath(filePath: string, workspaceRoot: string): string {
    return path.relative(workspaceRoot, filePath);
  }
} 