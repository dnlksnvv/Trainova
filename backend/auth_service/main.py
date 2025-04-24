from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
import logging
import sys

from auth import router as auth_router
from auth.infrastructure.database import Database
from auth.infrastructure.token_blacklist_service import TokenBlacklistService
from config import settings

logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("main")

app = FastAPI(
    title="Trainova Auth Service API",
    description="API для авторизации и аутентификации в приложении Trainova",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

app.include_router(auth_router)

@app.get("/")
def read_root():
    return {
        "name": "Trainova Auth Service API",
        "version": "1.0.0",
        "description": "API для авторизации и аутентификации в приложении Trainova",
        "docs_url": "/docs/api/auth"
    }

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
    try:
        await db.connect()
        logger.info("Соединение с базой данных установлено")
        
        count = await TokenBlacklistService.clean_expired_tokens()
        logger.info(f"При запуске очищено {count} истекших токенов")
    except Exception as e:
        logger.error(f"Ошибка при подключении к базе данных: {str(e)}")

@app.on_event("shutdown")
async def shutdown_event():
    db = Database()
    try:
        await db.disconnect()
        logger.info("Соединение с базой данных закрыто")
    except Exception as e:
        logger.error(f"Ошибка при закрытии соединения с базой данных: {str(e)}")
    
    logger.info("Приложение остановлено")

@app.post("/admin/clean-expired-tokens")
async def clean_expired_tokens():
    try:
        count = await TokenBlacklistService.clean_expired_tokens()
        return {"message": f"Очищено {count} истекших токенов"}
    except Exception as e:
        logger.error(f"Ошибка при очистке токенов: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Ошибка при очистке токенов: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)