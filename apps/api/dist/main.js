"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const webOrigins = (process.env.WEB_ORIGINS || process.env.WEB_ORIGIN || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    const isProd = process.env.NODE_ENV === 'production';
    app.enableCors({
        origin: isProd && webOrigins.length > 0 ? webOrigins : true,
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const configService = app.get(config_1.ConfigService);
    const port = configService.get('API_PORT') || 3001;
    const swaggerFlag = configService.get('SWAGGER_ENABLED');
    const swaggerEnabled = swaggerFlag ? swaggerFlag === 'true' : !isProd;
    const swaggerPath = configService.get('SWAGGER_PATH') || 'api/docs';
    if (swaggerEnabled) {
        const swaggerConfig = new swagger_1.DocumentBuilder()
            .setTitle('XNova Reforged API')
            .setDescription('Documentation API pour XNova Reforged')
            .setVersion('1.0')
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
        swagger_1.SwaggerModule.setup(swaggerPath, app, document);
    }
    await app.listen(port);
    console.log(`🚀 API NestJS démarrée sur http://localhost:${port}`);
    if (swaggerEnabled) {
        console.log(`📘 Swagger disponible sur http://localhost:${port}/${swaggerPath}`);
    }
}
bootstrap();
//# sourceMappingURL=main.js.map