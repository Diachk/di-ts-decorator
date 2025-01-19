import * as path from "path";

/**
 * Resolve a file path relative to Linkurious system directory.
 * Return an absolute file path.
 *
 * @param filePath a file path relative to the linkurious system root
 */
function resolvePathFromRoot(filePath: string): string {
  return path.resolve(__dirname, "..", "..", filePath);
}

/**
 * Resolve a file path relative to Linkurious data directory.
 * Return an absolute file path.
 *
 * The base path of the data directory can be specified using the DATA_PATH environment
 * variable. It can be either absolute, or relative to the Linkurious system directory. It
 * defaults to be '../data', that is besides of the system directory.
 *
 * @param filePath a file path relative to the linkurious data root
 */
function resolvePathFromDataFolder(filePath: string): string {
  if (filePath && path.isAbsolute(filePath)) {
    return filePath;
  }
  const dataPath = process.env.DATA_PATH ?? "../data";
  if (path.isAbsolute(dataPath)) {
    return path.resolve(dataPath, filePath);
  } else {
    return resolvePathFromRoot(path.join(dataPath, filePath));
  }
}

export const FileLocations = {
  resolvePathFromRoot: resolvePathFromRoot,
  resolvePathFromDataFolder: resolvePathFromDataFolder,
};
