import "server-only";

import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";

import type { StorageProvider } from "@/server/providers/storage/storage.provider";

const ROOT = resolve(process.cwd(), process.env.STORAGE_LOCAL_ROOT || ".data/uploads");

/** Guards against a key escaping the storage root via `..` segments. */
function resolveKeyPath(key: string): string {
  const target = resolve(ROOT, normalize(key));
  if (!target.startsWith(ROOT)) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return target;
}

export class LocalStorageProvider implements StorageProvider {
  async save(key: string, buffer: Buffer): Promise<{ sizeBytes: number }> {
    const path = resolveKeyPath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
    const info = await stat(path);
    return { sizeBytes: info.size };
  }

  async read(key: string): Promise<Buffer> {
    return readFile(resolveKeyPath(key));
  }

  async delete(key: string): Promise<void> {
    await rm(resolveKeyPath(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(resolveKeyPath(key));
      return true;
    } catch {
      return false;
    }
  }
}

export const storageProvider: StorageProvider = new LocalStorageProvider();

/** Exposed for tests / callers that need to build a key without saving. */
export function buildSourceStorageKey(clientId: string, sourceId: string, versionNumber: number, fileName: string) {
  return join(clientId, sourceId, `v${versionNumber}`, fileName);
}
