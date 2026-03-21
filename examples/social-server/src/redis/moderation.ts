import { redis } from './client';

const deviceKey = (deviceId: string) => `ban:device:${deviceId}`;

export async function banDevice(deviceId: string, ttlSec?: number): Promise<void> {
  if (ttlSec && ttlSec > 0) {
    await redis.set(deviceKey(deviceId), '1', 'EX', ttlSec);
  } else {
    await redis.set(deviceKey(deviceId), '1');
  }
}

export async function isDeviceBanned(deviceId: string): Promise<boolean> {
  return (await redis.exists(deviceKey(deviceId))) === 1;
}
