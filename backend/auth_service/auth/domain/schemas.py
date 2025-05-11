from pydantic import BaseModel, constr, EmailStr, Field
from typing import Optional

class UserRegisterRequest(BaseModel):
    email: str
    password: constr(min_length=8, max_length=128)
    first_name: Optional[str] = None
    last_name: Optional[str] = None

class UserVerifyRequest(BaseModel):
    email: str
    code: str

class UserLoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str

class LogoutRequest(BaseModel):
    refresh_token: str

class ErrorResponse(BaseModel):
    detail: str
    error_code: Optional[str] = None

class UserPayload(BaseModel):
    user_id: str
    role_id: int
    email: str
    exp: int

class ForgotPasswordRequest(BaseModel):
    email: str
    
class ResetPasswordRequest(BaseModel):
    email: str = Field(..., description="Email пользователя")
    code: str = Field(..., description="Код верификации из email")
    new_password: str = Field(..., description="Новый пароль")
    confirm_password: str = Field(..., description="Подтверждение нового пароля")
    
class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., description="Текущий пароль пользователя")

class VerifyPasswordChangeRequest(BaseModel):
    verification_code: str = Field(..., description="Код подтверждения, полученный на email")
    new_password: constr(min_length=8, max_length=128) = Field(..., description="Новый пароль")
    confirm_password: constr(min_length=8, max_length=128) = Field(..., description="Подтверждение нового пароля")

class ResetPasswordFormRequest(BaseModel):
    new_password: constr(min_length=8, max_length=128)
    confirm_password: constr(min_length=8, max_length=128)

class ResetPasswordResponse(BaseModel):
    success: bool
    message: str

class ChangeEmailRequest(BaseModel):
    new_email: str = Field(..., description="Новый адрес электронной почты")

class VerifyEmailChangeRequest(BaseModel):
    new_email: str = Field(..., description="Новый адрес электронной почты")
    verification_code: str = Field(..., description="Код подтверждения, отправленный на новый адрес")

class VerifyResetPasswordRequest(BaseModel):
    email: str = Field(..., description="Email пользователя")
    verification_code: str = Field(..., description="Код верификации, отправленный на email")
    new_password: str = Field(..., description="Новый пароль")
    confirm_password: str = Field(..., description="Подтверждение нового пароля") 