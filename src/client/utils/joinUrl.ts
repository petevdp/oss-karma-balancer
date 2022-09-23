export function joinUrl(...args: string[]): string {
  let urlStr: string = '';
  for (let mutPath of args) {
    if (urlStr.endsWith('/')) urlStr = urlStr.slice(0, urlStr.length - 1);
    if (!mutPath.startsWith('/')) mutPath = '/' + mutPath;
    urlStr = urlStr + mutPath;
  }
  return urlStr;
}
