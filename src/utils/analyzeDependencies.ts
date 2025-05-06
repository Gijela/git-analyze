import { cruise } from "dependency-cruiser";

// 根据指定目录分析依赖关系
export const analyzeDependencies = async (rootDir: string) => {
  try {
    const result = await cruise(
      [rootDir], // 要分析的目录
      { // 配置选项
        exclude: "node_modules", // 排除 node_modules
        outputType: "json", // 输出为 JSON 格式
      }
    );

    const dependencies = JSON.parse(result.output as string);

    return dependencies;
  } catch (error) {
    console.error("Error analyzing dependencies:", error);
  }
}
