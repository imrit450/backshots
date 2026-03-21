import { PrismaClient } from '@prisma/client';
import { config as envConfig } from '../config';

export type StorageType = 'filesystem' | 's3';

export type RuntimeS3Config = {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrl: string;
  forcePathStyle?: boolean;
};

export type RuntimeStorageConfig =
  | { storageType: 'filesystem'; s3: null }
  | { storageType: 's3'; s3: RuntimeS3Config };

let _runtimeStorage: RuntimeStorageConfig = {
  storageType: envConfig.storageType,
  s3: envConfig.s3,
} as any;

export function getRuntimeStorageConfig(): RuntimeStorageConfig {
  return _runtimeStorage;
}

export function setRuntimeStorageConfig(next: RuntimeStorageConfig) {
  _runtimeStorage = next;
}

export async function initRuntimeConfig(prisma: PrismaClient) {
  // Ensure there is always a row (single-row table)
  const row = await prisma.systemConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  const storageType = (row.storageType as StorageType) || 'filesystem';

  if (storageType !== 's3') {
    setRuntimeStorageConfig({ storageType: 'filesystem', s3: null });
    return;
  }

  // If DB fields are incomplete, fall back to env.
  if (!row.s3Bucket || !row.s3PublicUrl) {
    setRuntimeStorageConfig({
      storageType: envConfig.storageType,
      s3: envConfig.s3 as any,
    } as any);
    return;
  }

  setRuntimeStorageConfig({
    storageType: 's3',
    s3: {
      bucket: row.s3Bucket,
      region: row.s3Region || 'us-east-1',
      endpoint: row.s3Endpoint || undefined,
      accessKeyId: row.s3AccessKeyId || undefined,
      secretAccessKey: row.s3SecretAccessKey || undefined,
      publicUrl: row.s3PublicUrl,
      forcePathStyle: row.s3ForcePathStyle || false,
    },
  });
}

