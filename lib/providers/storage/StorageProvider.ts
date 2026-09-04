export interface UploadResult {
  url: string;
  sizeBytes: number;
}

/** Contract every object-storage provider must satisfy (S3, R2, etc.). */
export interface StorageProvider {
  readonly name: string;
  upload(key: string, data: Buffer, mimeType: string): Promise<UploadResult>;
  delete(key: string): Promise<void>;
}
