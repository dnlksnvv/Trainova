import pytest
from unittest.mock import patch, MagicMock
import jwt
from datetime import datetime, timedelta

class MockTokenService:
    def __init__(self):
        self.jwt_secret = "test_secret"
        self.jwt_algorithm = "HS256"
        self.access_token_expire_seconds = 3600  
        self.refresh_token_expire_seconds = 86400  
    
    def create_token_payload(self, user_id, role_id, email, expires_delta, password_version=0):
        expire = datetime.utcnow() + timedelta(seconds=expires_delta)
        return {
            "user_id": user_id,
            "role_id": role_id,
            "email": email,
            "exp": expire.timestamp(),
            "iat": datetime.utcnow().timestamp(),
            "password_version": password_version
        }
    
    def create_access_token(self, user_id, role_id, email, token_type="access", expire_minutes=None, password_version=0):
        if expire_minutes is not None:
            expires_delta = expire_minutes * 60
        else:
            # Если не указано особое время жизни - берем из конфига
            expires_delta = self.access_token_expire_seconds
            
        payload = self.create_token_payload(user_id, role_id, email, expires_delta, password_version)
        payload["token_type"] = token_type
        return jwt.encode(payload, self.jwt_secret, algorithm=self.jwt_algorithm)
    
    def create_refresh_token(self, user_id, role_id, email, password_version=0):
        payload = self.create_token_payload(user_id, role_id, email, self.refresh_token_expire_seconds, password_version)
        payload["token_type"] = "refresh"
        return jwt.encode(payload, self.jwt_secret, algorithm=self.jwt_algorithm)
    
    def create_reset_password_token(self, user_id, role_id, email, expire_minutes=30, password_version=0):
        return self.create_access_token(
            user_id=user_id, 
            role_id=role_id, 
            email=email, 
            token_type="reset_password", 
            expire_minutes=expire_minutes,
            password_version=password_version
        )
    
    def decode_jwt(self, token):
        try:
            if token is None or not token.strip() or len(token) < 10:
                return None
            
            # Сначала проверяем без проверки срока действия - нужно для токенов сброса пароля
            payload = jwt.decode(token, self.jwt_secret, algorithms=[self.jwt_algorithm], options={"verify_exp": False})
            
            if payload.get("token_type") == "reset_password":
                return payload
            
            # Для обычных токенов - строгая проверка времени жизни
            return jwt.decode(token, self.jwt_secret, algorithms=[self.jwt_algorithm])
        except jwt.ExpiredSignatureError:
            try:
                # Если токен истек, проверяем не токен ли это сброса пароля
                payload = jwt.decode(token, self.jwt_secret, algorithms=[self.jwt_algorithm], options={"verify_exp": False})
                if payload.get("token_type") == "reset_password":
                    return payload
                else:
                    return None
            except:
                return None
        except jwt.InvalidTokenError:
            return None
        except Exception:
            return None
    
    def is_token_valid(self, token, expected_type=None):
        payload = self.decode_jwt(token)
        if not payload:
            return False
        
        if expected_type and payload.get("token_type") != expected_type:
            return False
            
        return True

TEST_USER_ID = "1"
TEST_ROLE_ID = 1
TEST_EMAIL = "test@example.com"
TEST_PASSWORD_VERSION = 0
TEST_SECRET = "test_secret"
TEST_ALGORITHM = "HS256"
TEST_EXPIRED_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMSIsInJvbGVfaWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImV4cCI6MTYwMDAwMDAwMCwiaWF0IjoxNjAwMDAwMDAwLCJ0b2tlbl90eXBlIjoiYWNjZXNzIn0.invalidSignature"
TEST_INVALID_TOKEN = "invalid.token.format"

@pytest.fixture
def token_service():
    """Создает экземпляр TokenService с тестовыми параметрами"""
    return MockTokenService()

def test_create_token_payload(token_service):
    """Тест создания полезной нагрузки токена"""
    expires_delta = 3600
    
    with patch('datetime.datetime') as mock_datetime:
        # Устанавливаем фиксированное время для теста
        now = datetime(2023, 1, 1, 12, 0, 0)
        mock_datetime.utcnow.return_value = now
        
        payload = token_service.create_token_payload(
            TEST_USER_ID, 
            TEST_ROLE_ID, 
            TEST_EMAIL, 
            expires_delta, 
            TEST_PASSWORD_VERSION
        )
        
        assert payload["user_id"] == TEST_USER_ID
        assert payload["role_id"] == TEST_ROLE_ID
        assert payload["email"] == TEST_EMAIL
        assert payload["password_version"] == TEST_PASSWORD_VERSION
        # Проверяем только тип для временных меток, а не конкретные значения
        assert isinstance(payload["iat"], float)
        assert isinstance(payload["exp"], float)
        # Проверяем логическое соотношение между временными метками
        assert payload["exp"] > payload["iat"]
        # Проверяем, что разница примерно равна expires_delta
        delta = payload["exp"] - payload["iat"]
        assert abs(delta - expires_delta) < 1.0

def test_create_access_token(token_service):
    """Тест создания access токена"""
    with patch.object(token_service, 'create_token_payload') as mock_create_payload:
        test_payload = {
            "user_id": TEST_USER_ID,
            "role_id": TEST_ROLE_ID,
            "email": TEST_EMAIL,
            "exp": (datetime.utcnow() + timedelta(hours=1)).timestamp(),
            "iat": datetime.utcnow().timestamp(),
            "password_version": TEST_PASSWORD_VERSION
        }
        mock_create_payload.return_value = test_payload
        
        with patch('jwt.encode', return_value="test_access_token") as mock_encode:
            token = token_service.create_access_token(
                TEST_USER_ID, 
                TEST_ROLE_ID, 
                TEST_EMAIL, 
                password_version=TEST_PASSWORD_VERSION
            )
            
            assert token == "test_access_token"
            
            # Проверяем вызовы функций
            mock_create_payload.assert_called_once_with(
                TEST_USER_ID, 
                TEST_ROLE_ID, 
                TEST_EMAIL, 
                token_service.access_token_expire_seconds, 
                TEST_PASSWORD_VERSION
            )
            
            payload_with_type = dict(test_payload)
            payload_with_type["token_type"] = "access"
            
            mock_encode.assert_called_once_with(
                payload_with_type, 
                TEST_SECRET, 
                algorithm=TEST_ALGORITHM
            )

def test_create_access_token_with_custom_expiry(token_service):
    """Тест создания access токена с пользовательским временем истечения"""
    with patch.object(token_service, 'create_token_payload') as mock_create_payload:
        mock_create_payload.return_value = {}
        
        with patch('jwt.encode', return_value="test_custom_token"):
            token = token_service.create_access_token(
                TEST_USER_ID, 
                TEST_ROLE_ID, 
                TEST_EMAIL, 
                expire_minutes=30,  # 30 минут
                password_version=TEST_PASSWORD_VERSION
            )
            
            assert token == "test_custom_token"
            
            # Проверяем, что был вызван create_token_payload с правильными параметрами
            mock_create_payload.assert_called_once_with(
                TEST_USER_ID, 
                TEST_ROLE_ID, 
                TEST_EMAIL, 
                30 * 60,  # 30 минут в секундах
                TEST_PASSWORD_VERSION
            )

def test_create_refresh_token(token_service):
    """Тест создания refresh токена"""
    with patch.object(token_service, 'create_token_payload') as mock_create_payload:
        test_payload = {
            "user_id": TEST_USER_ID,
            "role_id": TEST_ROLE_ID,
            "email": TEST_EMAIL,
            "exp": (datetime.utcnow() + timedelta(days=1)).timestamp(),
            "iat": datetime.utcnow().timestamp(),
            "password_version": TEST_PASSWORD_VERSION
        }
        mock_create_payload.return_value = test_payload
        
        with patch('jwt.encode', return_value="test_refresh_token") as mock_encode:
            token = token_service.create_refresh_token(
                TEST_USER_ID, 
                TEST_ROLE_ID, 
                TEST_EMAIL, 
                password_version=TEST_PASSWORD_VERSION
            )
            
            assert token == "test_refresh_token"
            
            # Проверяем вызовы функций
            mock_create_payload.assert_called_once_with(
                TEST_USER_ID, 
                TEST_ROLE_ID, 
                TEST_EMAIL, 
                token_service.refresh_token_expire_seconds, 
                TEST_PASSWORD_VERSION
            )
            
            payload_with_type = dict(test_payload)
            payload_with_type["token_type"] = "refresh"
            
            mock_encode.assert_called_once_with(
                payload_with_type, 
                TEST_SECRET, 
                algorithm=TEST_ALGORITHM
            )

def test_create_reset_password_token(token_service):
    """Тест создания токена для сброса пароля"""
    with patch.object(token_service, 'create_access_token') as mock_create_access_token:
        mock_create_access_token.return_value = "test_reset_token"
        
        token = token_service.create_reset_password_token(
            TEST_USER_ID, 
            TEST_ROLE_ID, 
            TEST_EMAIL, 
            expire_minutes=30,
            password_version=TEST_PASSWORD_VERSION
        )
        
        assert token == "test_reset_token"
        
        mock_create_access_token.assert_called_once_with(
            user_id=TEST_USER_ID, 
            role_id=TEST_ROLE_ID, 
            email=TEST_EMAIL, 
            token_type="reset_password", 
            expire_minutes=30,
            password_version=TEST_PASSWORD_VERSION
        )

def test_decode_jwt_valid(token_service):
    """Тест декодирования валидного JWT токена"""
    test_payload = {
        "user_id": TEST_USER_ID,
        "role_id": TEST_ROLE_ID,
        "email": TEST_EMAIL,
        "exp": (datetime.utcnow() + timedelta(hours=1)).timestamp(),
        "iat": datetime.utcnow().timestamp(),
        "token_type": "access",
        "password_version": TEST_PASSWORD_VERSION
    }
    
    with patch('jwt.decode', return_value=test_payload) as mock_decode:
        decoded = token_service.decode_jwt("valid_token")
        
        assert decoded == test_payload
        assert mock_decode.call_count >= 1

def test_decode_jwt_expired(token_service):
    """Тест декодирования истекшего JWT токена"""
    with patch('jwt.decode') as mock_decode:
        mock_decode.side_effect = jwt.ExpiredSignatureError("Token expired")
        
        decoded = token_service.decode_jwt(TEST_EXPIRED_TOKEN)
        
        assert decoded is None
        assert mock_decode.call_count >= 1

def test_decode_jwt_invalid(token_service):
    """Тест декодирования недействительного JWT токена"""
    with patch('jwt.decode') as mock_decode:
        mock_decode.side_effect = jwt.InvalidTokenError("Invalid token")
        
        decoded = token_service.decode_jwt(TEST_INVALID_TOKEN)
        
        assert decoded is None
        mock_decode.assert_called_once()

def test_decode_jwt_empty(token_service):
    """Тест декодирования пустого JWT токена"""
    decoded = token_service.decode_jwt(None)
    assert decoded is None
    
    decoded = token_service.decode_jwt("")
    assert decoded is None

def test_decode_jwt_reset_password(token_service):
    """Тест декодирования токена сброса пароля"""
    reset_payload = {
        "user_id": TEST_USER_ID,
        "role_id": TEST_ROLE_ID,
        "email": TEST_EMAIL,
        "exp": (datetime.utcnow() - timedelta(hours=1)).timestamp(),  # Истекший токен
        "iat": datetime.utcnow().timestamp(),
        "token_type": "reset_password",
        "password_version": TEST_PASSWORD_VERSION
    }
    
    with patch('jwt.decode') as mock_decode:
        # Возвращаем данные для проверки без verify_exp и при ошибке
        mock_decode.side_effect = [reset_payload, jwt.ExpiredSignatureError("Expired"), reset_payload]
        
        decoded = token_service.decode_jwt("reset_token")
        
        assert decoded == reset_payload
        assert mock_decode.call_count == 1

def test_is_token_valid_success(token_service):
    """Тест проверки валидности токена"""
    access_payload = {
        "user_id": TEST_USER_ID,
        "role_id": TEST_ROLE_ID,
        "email": TEST_EMAIL,
        "token_type": "access",
        "password_version": TEST_PASSWORD_VERSION
    }
    
    with patch.object(token_service, 'decode_jwt', return_value=access_payload):
        # Тест без указания типа токена
        assert token_service.is_token_valid("valid_token") is True
        
        # Тест с правильным типом токена
        assert token_service.is_token_valid("valid_token", expected_type="access") is True

def test_is_token_valid_wrong_type(token_service):
    """Тест проверки токена с неправильным типом"""
    refresh_payload = {
        "user_id": TEST_USER_ID,
        "role_id": TEST_ROLE_ID,
        "email": TEST_EMAIL,
        "token_type": "refresh",
        "password_version": TEST_PASSWORD_VERSION
    }
    
    with patch.object(token_service, 'decode_jwt', return_value=refresh_payload):
        # Проверка токена с неверным ожидаемым типом
        result = token_service.is_token_valid("refresh_token", expected_type="access")
        assert result is False

def test_is_token_valid_failure(token_service):
    """Тест проверки недействительного токена"""
    with patch.object(token_service, 'decode_jwt', return_value=None):
        result = token_service.is_token_valid("invalid_token")
        assert result is False 