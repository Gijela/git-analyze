import { simpleGit, SimpleGit } from 'simple-git';
import { GitOperationError } from './errors';

export class GitAction {
  private git: SimpleGit;

  constructor() {
    this.git = simpleGit({ baseDir: process.cwd() });
  }

  async clone(url: string, path: string): Promise<void> {
    try {
      await this.git.clone(url, path);
    } catch (error) {
      throw new GitOperationError('clone', (error as Error).message);
    }
  }

  async checkoutBranch(path: string, branch: string): Promise<void> {
    try {
      const git = simpleGit(path);
      await git.checkout(branch);
    } catch (error) {
      throw new GitOperationError('checkout', (error as Error).message);
    }
  }
}