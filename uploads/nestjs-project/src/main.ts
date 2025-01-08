import { swagger } from './config/swagger.config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  swagger(app);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
