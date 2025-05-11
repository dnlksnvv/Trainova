import os
import logging
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from fastapi.templating import Jinja2Templates
from pathlib import Path
import ssl
from typing import Optional

from config import settings
from auth.domain.interfaces import IEmailService

logger = logging.getLogger(__name__)

# Отключаем проверку SSL сертификатов - для локальной разработки
# TODO: убрать в проде
ssl._create_default_https_context = ssl._create_unverified_context

parent_directory = Path(__file__).parent.parent.parent
templates_folder = parent_directory / "templates"

# Конфиг почты
mail_config = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
    MAIL_STARTTLS=settings.MAIL_STARTTLS,
    MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=False,
    TEMPLATE_FOLDER=str(templates_folder),
)

class EmailService(IEmailService):
    def __init__(self):
        self.fastmail = FastMail(mail_config)
        self.templates = Jinja2Templates(directory=templates_folder)
    
    async def send_verification_email(self, email: str, verification_code: str, context: Optional[str] = None) -> bool:
        """
        Отправляет код подтверждения на указанный email
        
        """
        try:
            template_body = {
                "email": email,
                "verification_code": verification_code,
                "context": context or "registration"  
            }
            
            if context == "email_change":
                subject = "Код подтверждения смены email - Trainova"
            elif context == "password_change":
                subject = "Код подтверждения смены пароля - Trainova"
            elif context == "login":
                subject = "Код подтверждения входа - Trainova"
            else:  # регистрация
                subject = "Код подтверждения регистрации - Trainova"
            
            message = MessageSchema(
                subject=subject,
                recipients=[email],
                template_body=template_body,
                subtype=MessageType.html
            )
            
            await self.fastmail.send_message(message, template_name="verification_code_email.html")
            logger.info(f"Код подтверждения отправлен на {email} (контекст: {context or 'регистрация'})")
            return True
        except Exception as e:
            logger.error(f"Ошибка при отправке кода подтверждения: {str(e)}")
            return False
    
    async def send_reset_password_email(self, email: str, reset_url: str, expire_in_minutes: int = 30) -> bool:
        """
        Отправляет email с ссылкой для сброса пароля
        
        """
        try:
            template_body = {
                "reset_url": reset_url,
                "expire_in_minutes": expire_in_minutes
            }
            
            message = MessageSchema(
                subject="Сброс пароля - Trainova",
                recipients=[email],
                template_body=template_body,
                subtype=MessageType.html
            )
            
            await self.fastmail.send_message(message, template_name="reset_password_email.html")
            logger.info(f"Email для сброса пароля успешно отправлен на {email}")
            return True
        except Exception as e:
            logger.error(f"Ошибка при отправке email для сброса пароля: {str(e)}")
            return False 