export function joinUrl(url: URL|string, path: string): string {
  let urlStr = url.toString()
  let mutPath = path;

  // normalize delimiters
  if (urlStr.endsWith('/')) urlStr = urlStr.slice(0, urlStr.length - 1);
  if (!mutPath.startsWith('/')) mutPath = '/' + mutPath;

  return urlStr + mutPath;
}
