#!/bin/sh
yarn mikro-orm migration:up
node dist/main
