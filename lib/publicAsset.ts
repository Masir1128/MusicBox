const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const publicBasePath = configuredBasePath === "/" ? "" : configuredBasePath.replace(/\/$/, "");

export function publicAsset(path: string): string {
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith("blob:") || path.startsWith("data:")) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${publicBasePath}${normalizedPath}`;
}
