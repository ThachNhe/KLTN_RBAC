#!/bin/sh
_rand() {
  cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w ${1:-16} | head -n 1
}
sed -i "s|DB_PASS=.*|DB_PASS=$(_rand 16)|" .env
sed -i "s|JWT_SECRET=.*|JWT_SECRET=$(_rand 32)|" .env
sed -i "s|COOKIE_SECRET=.*|COOKIE_SECRET=$(_rand 32)|" .env
