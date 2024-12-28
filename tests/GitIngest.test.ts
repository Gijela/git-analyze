import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GitIngest, ValidationError, GitOperationError } from '../src/index.js';
import { rm, mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

describe('GitIngest', () => {
  let ingest: GitIngest;
  const tempDir = './temp-test';
  const testDir = './test-files';

  beforeEach(async () => {
    ingest = new GitIngest({ tempDir });

    // 创建测试目录
    if (!existsSync(testDir)) {
      await mkdir(testDir, { recursive: true });
    }
    if (!existsSync(join(testDir, 'dir'))) {
      await mkdir(join(testDir, 'dir'), { recursive: true });
    }
  });

  afterEach(async () => {
    // 清理测试目录和临时目录
    for (const dir of [tempDir, testDir]) {
      if (existsSync(dir)) {
        await rm(dir, { recursive: true, force: true });
      }
    }
  });

  describe('analyzeFromUrl', () => {
    it('should throw ValidationError for empty URL', async () => {
      await expect(ingest.analyzeFromUrl('')).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid URL format', async () => {
      await expect(ingest.analyzeFromUrl('not-a-url')).rejects.toThrow(ValidationError);
    });

    it('should throw GitOperationError for non-existent repository', async () => {
      await expect(
        ingest.analyzeFromUrl('https://github.com/nonexistent/repo')
      ).rejects.toThrow(GitOperationError);
    });
  });

  describe('analyzeFromDirectory', () => {
    it('should throw ValidationError for empty path', async () => {
      await expect(ingest.analyzeFromDirectory('')).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for non-existent directory', async () => {
      await expect(
        ingest.analyzeFromDirectory('./non-existent')
      ).rejects.toThrow(ValidationError);
    });

    it('should analyze test directory successfully', async () => {
      // 创建测试文件
      const testFiles = {
        'file1.txt': 'Hello World',
        'dir/file2.js': 'console.log("test")',
      };

      // 写入测试文件
      for (const [path, content] of Object.entries(testFiles)) {
        await writeFile(join(testDir, path), content, 'utf-8');
      }

      const result = await ingest.analyzeFromDirectory(testDir);

      // 验证结果
      expect(result).toBeDefined();
      expect(result.metadata.files).toBe(2);
      expect(result.tree).toContain('file1.txt');
      expect(result.tree).toContain('file2.js');
      expect(result.content).toContain('Hello World');
      expect(result.content).toContain('console.log("test")');
      expect(result.summary).toContain('总文件数: 2');
      expect(result.metadata.tokens).toBe(3); // "Hello World" = 2, "console.log("test")" = 1
    });

    it('should respect file size limits', async () => {
      // 创建一个超过大小限制的文件
      const largeContent = 'x'.repeat(2 * 1024 * 1024); // 2MB
      await writeFile(join(testDir, 'large.txt'), largeContent, 'utf-8');

      const result = await ingest.analyzeFromDirectory(testDir, {
        maxFileSize: 1024 * 1024 // 1MB
      });

      expect(result.metadata.files).toBe(0);
    });
  });
}); 