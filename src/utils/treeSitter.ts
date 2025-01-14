import Parser from "tree-sitter";
import HTML from "tree-sitter-html";
import JavaScript from "tree-sitter-javascript";
import CSS from "tree-sitter-css";

/**
 * 从 Vue 文件字符串中提取 `<template>`、`<script>` 和 `<style>` 部分
 * @param {string} sourceCode - Vue 文件内容
 * @returns {object} - 包含 template、script 和 style 的对象
 */
function extractVueSections(sourceCode: string) {
  const templateMatch = sourceCode.match(/<template>([\s\S]*?)<\/template>/);
  const scriptMatch = sourceCode.match(/<script>([\s\S]*?)<\/script>/);
  const styleMatch = sourceCode.match(/<style>([\s\S]*?)<\/style>/);

  return {
    template: templateMatch ? templateMatch[1].trim() : null,
    script: scriptMatch ? scriptMatch[1].trim() : null,
    style: styleMatch ? styleMatch[1].trim() : null,
  };
}

/**
 * 使用 Tree-sitter 解析代码并输出语法树
 * @param {string} code - 代码内容
 * @param {object} language - Tree-sitter 语言解析器
 * @param {string} sectionName - 部分名称（如 "template"）
 */
function parseCode(code: string, language: any, sectionName: string) {
  if (!code) {
    console.log(`No ${sectionName} section found.`);
    return;
  }

  const parser = new Parser();
  parser.setLanguage(language);

  const tree = parser.parse(code);
  console.log(`${sectionName} 语法树:`);
  console.log(tree.rootNode.toString());
  console.log("\n");
}

/**
 * 解析 Vue 文件字符串
 * @param {string} sourceCode - Vue 文件内容
 */
function parseVueFile(sourceCode: string) {
  // 提取各个部分
  const { template, script, style } = extractVueSections(sourceCode);

  // 解析 template 部分
  if (template) {
    parseCode(template, HTML, "template");
  }

  // 解析 script 部分
  if (script) {
    parseCode(script, JavaScript, "script");
  }

  // 解析 style 部分
  if (style) {
    parseCode(style, CSS, "style");
  }
}

// 示例：Vue 文件内容（字符串形式）
const vueFileContent = `
<template>
  <div class="example">
    <h1>{{ message }}</h1>
  </div>
</template>

<script>
export default {
  data() {
    return {
      message: "Hello, Vue!",
    };
  },
};
</script>

<style>
.example {
  color: red;
}
</style>
`;

// 解析 Vue 文件
parseVueFile(vueFileContent);