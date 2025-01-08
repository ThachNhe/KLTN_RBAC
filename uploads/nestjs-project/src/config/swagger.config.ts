import { INestApplication } from '@nestjs/common'
    import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
    
    // Swagger API Document
    export const swagger = (app: INestApplication) => {
      const config = new DocumentBuilder()
        .setTitle('Kaput API')
        .setVersion('0.1.0')
        .addBearerAuth()
        .build()
    
      const document = SwaggerModule.createDocument(app, config, {
        extraModels: [],
      })
    
      SwaggerModule.setup('/swagger', app, document)
    }
