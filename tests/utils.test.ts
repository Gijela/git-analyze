import { describe, it, expect } from 'vitest';
import { estimateTokens, generateTree, generateSummary } from '../src/utils/index.js';
import type { FileInfo } from '../src/types/index.js';

describe('Utils', () => {
  describe('estimateTokens', () => {
    it('should count tokens correctly', () => {
      expect(estimateTokens('hello world')).toBe(2);
      expect(estimateTokens('  hello   world  ')).toBe(2);
      expect(estimateTokens('')).toBe(0);
    });
  });

  describe('generateTree', () => {
    it('should generate correct tree structure', () => {
      const files: FileInfo[] = [
        { path: 'file1.txt', content: '', size: 0 },
        { path: 'dir/file2.js', content: '', size: 0 },
        { path: 'dir/subdir/file3.ts', content: '', size: 0 },
      ];

      const tree = generateTree(files);
      expect(tree).toContain('file1.txt');
      expect(tree).toContain('dir');
      expect(tree).toContain('file2.js');
      expect(tree).toContain('subdir');
      expect(tree).toContain('file3.ts');
    });
  });

  describe('generateSummary', () => {
    it('should generate correct summary', () => {
      const files: FileInfo[] = [
        { path: 'file1.txt', content: 'hello world', size: 11 },
        { path: 'file2.js', content: 'console.log()', size: 13 },
      ];

      const metadata = {
        files: 2,
        size: 24,
        tokens: 3,
      };

      const summary = generateSummary(files, metadata);
      expect(summary).toContain('总文件数: 2');
      expect(summary).toContain('24 B');
      expect(summary).toContain('txt: 1');
      expect(summary).toContain('js: 1');
    });
  });
}); 