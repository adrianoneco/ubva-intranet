import * as Minio from 'minio';

const minioConfig = {
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
};

export const minioClient = new Minio.Client(minioConfig);

export const bucketName = process.env.MINIO_BUCKET_NAME || 'taskflow-uploads';

let isMinIOAvailable = false;

export async function initializeMinIO(): Promise<boolean> {
  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      await minioClient.makeBucket(bucketName, 'us-east-1');
      console.log(`✓ MinIO bucket "${bucketName}" created`);
    } else {
      console.log(`✓ MinIO bucket "${bucketName}" already exists`);
    }
    isMinIOAvailable = true;
    return true;
  } catch (error: any) {
    isMinIOAvailable = false;
    console.log(`⚠ MinIO not available - file storage disabled`);
    return false;
  }
}

export function isMinIOReady(): boolean {
  return isMinIOAvailable;
}

export async function uploadFile(
  fileName: string,
  fileBuffer: Buffer,
  contentType: string = 'application/octet-stream'
): Promise<string> {
  if (!isMinIOAvailable) {
    throw new Error('MinIO storage is not available');
  }

  try {
    const metaData = {
      'Content-Type': contentType,
    };

    await minioClient.putObject(
      bucketName,
      fileName,
      fileBuffer,
      fileBuffer.length,
      metaData
    );

    const url = await minioClient.presignedGetObject(bucketName, fileName, 24 * 60 * 60);
    return url;
  } catch (error) {
    console.error('File upload error:', error);
    throw new Error('Failed to upload file');
  }
}

export async function getFile(fileName: string): Promise<Buffer> {
  try {
    const dataStream = await minioClient.getObject(bucketName, fileName);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      dataStream.on('data', (chunk) => chunks.push(chunk));
      dataStream.on('end', () => resolve(Buffer.concat(chunks)));
      dataStream.on('error', reject);
    });
  } catch (error) {
    console.error('File get error:', error);
    throw new Error('Failed to get file');
  }
}

export async function deleteFile(fileName: string): Promise<void> {
  try {
    await minioClient.removeObject(bucketName, fileName);
  } catch (error) {
    console.error('File delete error:', error);
    throw new Error('Failed to delete file');
  }
}

export async function getPresignedUrl(
  fileName: string,
  expirySeconds: number = 24 * 60 * 60
): Promise<string> {
  try {
    return await minioClient.presignedGetObject(bucketName, fileName, expirySeconds);
  } catch (error) {
    console.error('Presigned URL error:', error);
    throw new Error('Failed to generate presigned URL');
  }
}
