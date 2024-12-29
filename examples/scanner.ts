import { GitIngest } from "../src/index.js";

async function test() {
  console.log("开始测试...\n");

  // 1. 测试本地目录选择性分析
  console.log("1. 测试本地目录选择性分析");
  const localIngest = new GitIngest({
    tempDir: "./temp-test",
    keepTempFiles: false,
  });

  try {
    // 测试分析特定文件
    console.log("\n1.2 分析特定文件：");
    console.log("正在分析文件...");
    const fileResult = await localIngest.analyzeFromDirectory("./", { // 分析当前目录下的文件
      targetPaths: ['examples/test/index.ts', 'examples/scanner.ts'] // 分析指定入口文件, 会递归分析出所有的依赖文件
    });
    console.log("分析完成！");
    console.log("\n分析结果:");
    console.log("- 文件数:", fileResult.metadata.files);
    console.log("- 总大小:", fileResult.metadata.size, "bytes");
    // console.log("\n文件内容:");
    // console.log(fileResult.content);
    console.log("\n特定文件扫描出来的的文件树(包含依赖文件)：");
    console.log(fileResult.tree);
  } catch (error) {
    console.error("本地目录分析失败:", error);
  }

  // 2. 测试 GitHub 仓库选择性分析
  console.log("\n2. 测试 GitHub 仓库选择性分析");
  const githubIngest = new GitIngest({
    tempDir: "./temp-test",
    keepTempFiles: false,
    defaultPatterns: {
      exclude: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
    }
  });

  try {
    console.log("\n1.2 GitHub 仓库分析特定文件：");
    console.log("正在分析文件...");
    const githubResult = await githubIngest.analyzeFromUrl(
      "https://github.com/Gijela/gitingest-ts", // 项目第一层作为分析的根目录
      {
        branch: "dev",
        maxFileSize: 500 * 1024, // 500KB
        targetPaths: ['examples/test/index.ts', 'examples/scanner.ts'] // 分析指定入口文件, 会递归分析出所有的依赖文件
      }
    );
    console.log("GitHub 仓库分析完成！");
    console.log("\n分析结果:");
    console.log("- 文件数:", githubResult.metadata.files);
    console.log("- 总大小:", githubResult.metadata.size, "bytes");
    console.log("\n仓库特定文件扫描出来的的文件树(包含依赖文件)：");
    console.log(githubResult.tree);
  } catch (error) {
    console.error("GitHub 仓库分析失败:", error);
  }
}

test().catch(console.error); 