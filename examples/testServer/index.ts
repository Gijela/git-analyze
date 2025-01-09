import Koa from 'koa';
import { koaBody } from 'koa-body';
import cors from '@koa/cors';
import serve from 'koa-static';
import path from 'path';
import { fileURLToPath } from 'url';
import analyzeRouter from './routes/analyze';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = new Koa();

app.use(koaBody());
app.use(cors({
  allowMethods: ['GET', 'POST'],
  allowHeaders: ['Content-Type', 'Authorization']
}));
app.use(serve(__dirname));

app.use(analyzeRouter.routes()).use(analyzeRouter.allowedMethods());

app.on('error', (err, ctx) => {
  console.error('服务器错误:', err);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] 服务器启动成功: http://localhost:${PORT}`);
}); 