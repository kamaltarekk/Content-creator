/**
 * Abstract file storage boundary. LocalStorageProvider (dev) writes to disk;
 * a future S3-compatible provider implements the same interface so callers
 * (sourceService, the download route handler) never change.
 */
export interface StorageProvider {
  /** Persist a buffer under `key` and return the byte count actually written. */
  save(key: string, buffer: Buffer): Promise<{ sizeBytes: number }>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
