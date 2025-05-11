import logging

from auth.domain.interfaces import IAuthService, ITokenService, IEmailService
from auth.application.services.auth_service import AuthService
from auth.application.services.token_service import TokenService
from auth.infrastructure.email import EmailService
from auth.infrastructure.token_bearer import BearerTokenAuth
from auth.api.router import AuthRouter

logger = logging.getLogger(__name__)

email_service = EmailService()
auth_service = AuthService(email_service)
token_service = TokenService()

router = AuthRouter(auth_service, token_service).router
