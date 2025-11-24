// MinIO has been removed from this project. This module remains as a compatibility shim.
// Any code importing these symbols should be migrated to use the local filesystem instead.

export const bucketName = '';

export async function initializeMinIO(): Promise<boolean> {
  console.warn('initializeMinIO called but MinIO support has been removed.');
  return false;
}

export function isMinIOReady(): boolean {
  return false;
}

export async function uploadFile(): Promise<string> {
  throw new Error('MinIO support removed; use local uploads instead');
}

export async function getPresignedUrl(): Promise<string> {
  throw new Error('MinIO support removed; use local uploads instead');
}

export async function getFile(): Promise<Buffer> {
  throw new Error('MinIO support removed; use local uploads instead');
}

export async function deleteFile(): Promise<void> {
  throw new Error('MinIO support removed; use local uploads instead');
}
