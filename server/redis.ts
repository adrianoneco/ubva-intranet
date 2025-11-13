import Redis from 'ioredis';

let isRedisAvailable = false;
let hasLoggedRedisFailure = false;

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  lazyConnect: true, // Don't connect immediately
  retryStrategy(times: number) {
    if (times > 3) {
      return null; // Stop retrying after 3 attempts
    }
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

export const redis = new Redis(redisConfig);

redis.on('connect', () => {
  isRedisAvailable = true;
  // Don't reset hasLoggedRedisFailure - keep it sticky
  console.log('✓ Redis connected');
});

redis.on('error', (err) => {
  isRedisAvailable = false;
  // Only log the first connection error, then silence all subsequent errors
  if (!hasLoggedRedisFailure && err.message.includes('ECONNREFUSED')) {
    hasLoggedRedisFailure = true;
    // Don't log anything here - let the catch block handle it
  } else if (!err.message.includes('ECONNREFUSED')) {
    // Log non-connection errors
    console.error('Redis error:', err.message);
  }
});

// Try to connect, but don't fail if Redis is unavailable
redis.connect().catch(() => {
  if (!hasLoggedRedisFailure) {
    hasLoggedRedisFailure = true;
    console.log('⚠ Redis not available - caching disabled');
  }
});

export function isRedisReady(): boolean {
  return isRedisAvailable;
}

export async function getCache<T>(key: string): Promise<T | null> {
  if (!isRedisAvailable) return null;
  
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    return null;
  }
}

export async function setCache<T>(
  key: string,
  value: T,
  expirationSeconds: number = 3600
): Promise<void> {
  if (!isRedisAvailable) return;
  
  try {
    await redis.setex(key, expirationSeconds, JSON.stringify(value));
  } catch (error) {
    // Silently fail - cache is optional
  }
}

export async function deleteCache(key: string): Promise<void> {
  if (!isRedisAvailable) return;
  
  try {
    await redis.del(key);
  } catch (error) {
    // Silently fail - cache is optional
  }
}

export async function clearCachePattern(pattern: string): Promise<void> {
  // Exit early if Redis is not available - don't create stream or pipeline
  if (!isRedisAvailable) return;
  
  try {
    // Use SCAN instead of KEYS for production safety
    const stream = redis.scanStream({
      match: pattern,
      count: 100
    });

    const pipeline = redis.pipeline();
    let hasKeys = false;
    
    stream.on('data', (keys: string[]) => {
      if (keys.length) {
        hasKeys = true;
        keys.forEach(key => pipeline.del(key));
      }
    });

    await new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    // Only execute pipeline if we have keys to delete
    if (hasKeys) {
      await pipeline.exec();
    }
  } catch (error) {
    // Silently fail - cache is optional
  }
}
