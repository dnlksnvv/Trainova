from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
import logging
import sys
import jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from training import router as training_router
from training.infrastructure.database import Database
from training.domain.utils import verify_token
from config import settings


logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("main")


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):

        no_auth_paths = [
            "/",
            "/docs",
            "/openapi.json",
            "/redoc"
        ]
        
        if request.url.path in no_auth_paths:
            return await call_next(request)
        
        if request.method == "OPTIONS":
            return await call_next(request)
        
        try:
            auth_header = request.headers.get("Authorization")
            if auth_header:
                token_type, token = auth_header.split()
                if token_type.lower() == "bearer":
                    try:
                        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
                        request.state.user = payload
                    except jwt.PyJWTError as e:
                        logger.warning(f"Invalid token: {str(e)}")
        except Exception as e:
            logger.warning(f"Auth middleware error: {str(e)}")
        
        return await call_next(request)


app = FastAPI(
    title="Trainova Workout Service API",
    description="API для управления тренировками в приложении Trainova",
    version="1.0.0"
)


origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8001",
    "https://trainova.app",
    "https://trainova.duckdns.org"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "Set-Cookie", "Access-Control-Allow-Headers", 
                   "Access-Control-Allow-Origin", "Authorization", "X-Requested-With"],
    expose_headers=["Content-Type", "Set-Cookie"],
    max_age=600, 
)


app.add_middleware(AuthMiddleware)

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )


app.include_router(training_router)

@app.get("/")
def read_root():
    return {
        "name": "Trainova Workout Service API",
        "version": "1.0.0",
        "description": "API для управления тренировками в приложении Trainova",
        "docs_url": "/docs/api/workout"
    }


@app.options("/{path:path}")
async def options_handler(request: Request, path: str):
    logger.info(f"Обработка OPTIONS запроса для пути: {path}")
    return JSONResponse(
        status_code=200,
        content={"detail": "OK"}
    )

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
        }
    }
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

@app.on_event("startup")
async def startup_event():
    logger.info("Приложение запущено")
    db = Database()
    await db.connect()
    logger.info("Соединение с базой данных установлено")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Завершение работы приложения")
    db = Database()
    await db.disconnect()
    logger.info("Соединение с базой данных закрыто")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
