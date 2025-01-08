import { Options } from '@mikro-orm/core';
import { defineConfig } from '@mikro-orm/postgresql';
import { configDotenv } from 'dotenv';
configDotenv();
const {
  NODE_ENV = 'development',
  DB_HOST,
  DB_PORT,
  DB_MAIN,
  DB_TEST,
  DB_USER,
  DB_PASS,
} = process.env;

const isTest = NODE_ENV === 'test';
const isDev = NODE_ENV === 'development';

const dbConfig: Options = defineConfig({
  host: DB_HOST,
  port: Number(DB_PORT),
  dbName: isTest ? DB_TEST : DB_MAIN,
  user: DB_USER,
  password: DB_PASS,
  discovery: { warnWhenNoEntities: false },
  debug: isDev ? true : false,
  allowGlobalContext: true,
  pool: {
    min: 0,
  },
  entities: ['./dist/db/entities/*.js'],
  entitiesTs: ['./src/db/entities/*.ts'],
  migrations: {
    path: './dist/db/migrations',
    pathTs: './src/db/migrations',
  },
  seeder: {
    path: './dist/db/seeders',
    pathTs: './src/db/seeders',
  },
});

export default dbConfig;
