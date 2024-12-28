import { config } from 'dotenv';
import { join } from 'path';

// 加载环境变量
config({ path: join(process.cwd(), '.env') });

// 导出环境变量类型
export interface Env {
  HTTP_PROXY?: string;
  HTTPS_PROXY?: string;
  NODE_ENV?: string;
}

// 导出环境变量
export const env: Env = {
  HTTP_PROXY: process.env.HTTP_PROXY,
  HTTPS_PROXY: process.env.HTTPS_PROXY,
  NODE_ENV: process.env.NODE_ENV
}; 