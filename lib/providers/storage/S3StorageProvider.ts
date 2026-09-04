import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { StorageProvider, UploadResult } from './StorageProvider';

/**
 * S3-compatible object storage. Works unmodified against AWS S3 or
 * Cloudflare R2 (R2 exposes the same API surface) — set STORAGE_ENDPOINT
 * for R2, leave it unset for AWS S3.
 */
export class S3StorageProvider implements StorageProvider {
  readonly name = 'r2';

  private get client(): S3Client {
    const endpoint = process.env.STORAGE_ENDPOINT || undefined;
    const accessKeyId = process.env.STORAGE_ACCESS_KEY;
    const secretAccessKey = process.env.STORAGE_SECRET_KEY;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('STORAGE_ACCESS_KEY / STORAGE_SECRET_KEY are not configured.');
    }

    return new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  private get bucket(): string {
    const bucket = process.env.STORAGE_BUCKET;
    if (!bucket) throw new Error('STORAGE_BUCKET is not configured.');
    return bucket;
  }

  async upload(key: string, data: Buffer, mimeType: string): Promise<UploadResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: mimeType,
      }),
    );

    const publicBase = process.env.STORAGE_PUBLIC_URL?.replace(/\/$/, '');
    const url = publicBase ? `${publicBase}/${key}` : `s3://${this.bucket}/${key}`;

    return { url, sizeBytes: data.byteLength };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

let _instance: S3StorageProvider | null = null;
export function getStorageProvider(): StorageProvider {
  if (!_instance) _instance = new S3StorageProvider();
  return _instance;
}
