import { GitIngest } from "../src/index.js";

async function test() {
  // 1. 测试本地目录分析
  console.log("测试本地目录分析...");
  const localIngest = new GitIngest({
    tempDir: "./temp-test",
  });

  try {
    const localResult = await localIngest.analyzeFromDirectory("./src");
    console.log("\n本地目录分析结果:");
    console.log("文件数:", localResult.metadata.files);
    console.log("总大小:", localResult.metadata.size, "bytes");
    console.log("Token数:", localResult.metadata.tokens);
    console.log("\n目录结构:");
    console.log(localResult.tree);
    console.log("\n文件内容:");
    console.log(localResult.content);
  } catch (error) {
    console.error("本地目录分析失败:", error);
  }

  // 2. 测试 GitHub 仓库分析
  console.log("\n测试 GitHub 仓库分析...");
  const githubIngest = new GitIngest({
    tempDir: "./temp-test",
    defaultPatterns: {
      exclude: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
    },
  });

  try {
    const githubResult = await githubIngest.analyzeFromUrl(
      "https://github.com/Gijela/CR-Mentor",
      {
        branch: "master",
        maxFileSize: 500 * 1024, // 500KB
      }
    );
    console.log("\nGitHub 仓库分析结果:");
    console.log("文件数:", githubResult.metadata.files);
    console.log("总大小:", githubResult.metadata.size, "bytes");
    console.log("Token数:", githubResult.metadata.tokens);
    console.log("\n目录结构:");
    console.log(githubResult.tree);
    console.log("\n文件内容:");
    console.log(githubResult.content);
  } catch (error) {
    console.error("GitHub 仓库分析失败:", error);
  }
}

test().catch(console.error); 