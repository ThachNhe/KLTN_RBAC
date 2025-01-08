import 'dotenv/config';

import { Snowyflake } from 'snowyflake';

const snowyflake = new Snowyflake({
  workerId: BigInt(process.env.WORKER_ID || '1'),
  epoch: 1577836800000n, // 2020-01-01 00:00:00 GMT
  // epoch: Epoch.Twitter,
});

export const genId = () => snowyflake.nextId().toString();

export const decodeId = (id: string) => snowyflake.deconstruct(BigInt(id));

export const genReqId = (req: any) => req.headers['x-request-id'] || genId();
