import { watch, type FSWatcher } from "chokidar";

export interface FileWatcherEvents {
  onChange: (filePath: string) => void;
}

export function createFileWatcher(
  paths: string | string[],
  events: FileWatcherEvents,
): FSWatcher {
  const watcher = watch(paths, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  });

  watcher.on("change", (filePath) => {
    events.onChange(filePath);
  });

  return watcher;
}
