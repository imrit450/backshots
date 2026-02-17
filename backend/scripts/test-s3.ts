/**
 * Quick S3 connection test
 * Run: npx tsx scripts/test-s3.ts (from backend/)
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

const bucket = process.env.S3_BUCKET;
const region = process.env.S3_REGION || 'us-east-1';

async function test() {
  if (!bucket) {
    console.error('S3_BUCKET not set in .env');
    process.exit(1);
  }

  const client = new S3Client({
    region,
    credentials: process.env.S3_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        }
      : undefined,
  });

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log('✓ S3 connection successful');
    console.log(`  Bucket: ${bucket}`);
    console.log(`  Region: ${region}`);
  } catch (err: any) {
    console.error('✗ S3 connection failed');
    console.error('  Message:', err.message || err);
    if (err.name) console.error('  Name:', err.name);
    if (err.$metadata?.httpStatusCode) console.error('  HTTP:', err.$metadata.httpStatusCode);
    if (err.Code) console.error('  Code:', err.Code);
    process.exit(1);
  }
}

test();
