import { createClient } from 'redis';

export type Redis = ReturnType<typeof createClient>;
