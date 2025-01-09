export const PATH_ALIASES = {
  '@': 'src',
};

export const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.py', '.go', '.java'];

// 处理目标路径
export const processTargetPaths = (paths?: string) => {
  if (!paths) return undefined;
  return paths.split(',').map(p => p.trim()).filter(Boolean);
};

// 格式化文件内容
export const formatFileContent = (content: string) => {
  let projectName = '';

  const formattedContent = content.split('File: ')
    .filter(Boolean)
    .map(section => {
      const [path, ...contentLines] = section.trim().split('\n');
      if (!projectName) {
        const match = path.match(/^temp-web\/([^\/]+)-\d+\//);
        if (match) {
          projectName = match[1];
        }
      }

      const cleanPath = path
        .replace(/^temp-web\/[^/]+\//, '')
        .replace(/\\/g, '/');

      return `File: ${cleanPath}\n${contentLines.join('\n')}`;
    })
    .join('\n\n');

  return {
    content: formattedContent,
    projectName
  };
}; 