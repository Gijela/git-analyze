import { simpleGit, SimpleGit } from 'simple-git';
import { GitOperationError } from './errors';
import { env } from '../utils/env';

export class GitAction {
  private git: SimpleGit;

  constructor() {
    const config: string[] = [];

    console.log("HTTP_PROXY:", env.HTTP_PROXY);
    console.log("HTTPS_PROXY:", env.HTTPS_PROXY);

    // 如果存在vpn代理，则使用环境变量
    if (env.HTTP_PROXY) {
      config.push(`http.proxy=${env.HTTP_PROXY}`);
    }
    if (env.HTTPS_PROXY) {
      config.push(`https.proxy=${env.HTTPS_PROXY}`);
    }

    this.git = simpleGit({
      baseDir: process.cwd(),
      ...(config.length > 0 ? { config } : {})
    });
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