from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
import logging
import sys

from course import router as course_router
from course.infrastructure.database import Database
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
    title="Trainova Course Service API",
    description="API для управления курсами в приложении Trainova",
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

app.include_router(course_router)

@app.get("/")
def read_root():
    return {
        "name": "Trainova Course Service API",
        "version": "1.0.0",
        "description": "API для управления курсами в приложении Trainova",
        "docs_url": "/docs"
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
    logger.info("Course Service запущен")
    
    db = Database()
    try:
        await db.connect()
        logger.info("Соединение с базой данных установлено")
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
    
    logger.info("Course Service остановлен")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8006, reload=True) 