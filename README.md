## Description

Project use [Nest](https://github.com/nestjs/nest) 10 framework TypeScript 

## Requirements

- Docker and docker-compose are installed.
- NodeJS version 20 is installed.

## Development

Migrate database and running the app 

```bash
$ cp .env.example .env
$ docker-compose up
```

## Deploy
Prepare Database and update .env file

```bash
$ cp .env.example .env
```

Build app

```bash
$ yarn
$ yarn build
```

Migrate database and running the app 

```bash
$ ./bin/prod.sh
```

### API Document
http://localhost:8000/swagger
