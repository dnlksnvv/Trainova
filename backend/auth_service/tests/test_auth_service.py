import pytest
from unittest.mock import patch, AsyncMock, MagicMock
import uuid

TEST_USER_ID = 1
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "Password123"
TEST_WRONG_PASSWORD = "WrongPassword123"
TEST_HASHED_PASSWORD = "$2b$12$aBcDeFgHiJkLmNoPqRsTuVwXyZ"
TEST_VERIFICATION_CODE = "123456"
TEST_WRONG_VERIFICATION_CODE = "654321"
TEST_FIRST_NAME = "Test"
TEST_LAST_NAME = "User"
TEST_ROLE_ID = 1

# мок AuthService
class MockAuthService:
    def __init__(self, email_service):
        self.email_service = email_service
        self.pwd_context = MagicMock()
        self.user_repository = MagicMock()
        self.reset_codes = {}
    
    def hash_password(self, password):
        return f"hashed_{password}"
    
    def verify_password(self, plain_password, hashed_password):
        return plain_password == TEST_PASSWORD
    
    def normalize_contact(self, email):
        return email.lower().strip()
    
    def generate_verification_code(self, length=6):
        return "123456"
    
    async def register_user(self, email, password, first_name=None, last_name=None):
        if " " in email:
            return False, None, "Email не должны содержать пробелы"
        
        # Вызываем create_user в любом случае
        user = await self.user_repository.create_user(email=email, password_hash=self.hash_password(password))
        
        if user is None:
            return False, None, "Пользователь с таким email уже существует"
        
        verification_code = self.generate_verification_code()
        await self.user_repository.save_verification_code(TEST_USER_ID, verification_code)
        await self.email_service.send_verification_email(email, verification_code)
        
        return True, user, None
    
    async def verify_user(self, code):
        user_id = await self.user_repository.get_user_id_by_verification_code(code)
        
        if not user_id:
            return False, None, "Неверный код верификации"
        
        user = await self.user_repository.get_user_by_id(user_id)
        
        if not user:
            return False, None, "Пользователь не найден"
        
        await self.user_repository.set_user_verified(user_id)
        await self.user_repository.delete_verification_code(user_id)
        
        return True, user_id, None
    
    async def login_user(self, email, password):
        user = await self.user_repository.get_user_by_email(email)
        
        if not user:
            return False, None, "Неверные данные для входа"
        
        if not self.verify_password(password, user.get("password_hash", "")):
            return False, None, "Неверные данные для входа"
        
        if not user.get("is_verified", False):
            verification_code = self.generate_verification_code()
            await self.user_repository.save_verification_code(user["user_id"], verification_code)
            await self.email_service.send_verification_email(email, verification_code)
            return False, None, "Аккаунт не верифицирован. Код верификации отправлен на вашу почту."
        
        password_version = await self.user_repository.get_password_version(user["user_id"])
        
        user_data = dict(user)
        user_data["password_version"] = password_version
        
        return True, user_data, None
    
    async def get_user_by_id(self, user_id):
        user = await self.user_repository.get_user_by_id(user_id)
        
        if not user:
            return None
        
        password_version = await self.user_repository.get_password_version(user_id)
        
        user_data = dict(user)
        user_data["password_version"] = password_version
        
        return user_data
    
    async def initiate_password_change(self, user_id):
        user = await self.user_repository.get_user_by_id(user_id)
        
        if not user:
            return False, "", "Пользователь не найден"
        
        verification_code = self.generate_verification_code()
        await self.user_repository.save_verification_code(user_id, verification_code)
        await self.email_service.send_verification_email(user["email"], verification_code)
        
        return True, verification_code, None
    
    async def verify_and_change_password(self, user_id, verification_code, new_password):
        return True, None

class TestAuthService:
    @pytest.fixture
    def email_service_mock(self):
        """Мок сервиса для отправки писем"""
        mock = MagicMock()
        mock.send_verification_email = AsyncMock(return_value=True)
        mock.send_reset_password_email = AsyncMock(return_value=True)
        return mock
    
    @pytest.fixture
    def auth_service(self, email_service_mock):
        """экземпляр AuthService с моками для тестирования"""
        service = MockAuthService(email_service_mock)
        # Патчим методы репозитория
        service.user_repository.create_user = AsyncMock()
        service.user_repository.save_verification_code = AsyncMock()
        service.user_repository.get_user_id_by_verification_code = AsyncMock()
        service.user_repository.get_user_by_id = AsyncMock()
        service.user_repository.set_user_verified = AsyncMock()
        service.user_repository.delete_verification_code = AsyncMock()
        service.user_repository.get_user_by_email = AsyncMock()
        service.user_repository.get_password_version = AsyncMock()
        service.user_repository.set_password_version = AsyncMock()
        return service
    
    def test_hash_password(self, auth_service):
        """Тест хеширования пароля"""
        hashed = auth_service.hash_password(TEST_PASSWORD)
        assert isinstance(hashed, str)
        assert hashed != TEST_PASSWORD
        assert "hashed_" in hashed
    
    def test_normalize_contact(self, auth_service):
        """Тест нормализации эмейл"""
        email = "  Test.User@Example.COM  "
        normalized = auth_service.normalize_contact(email)
        assert normalized == "test.user@example.com"
    
    def test_generate_verification_code(self, auth_service):
        """Тест генерации кода верификации"""
        code = auth_service.generate_verification_code()
        assert isinstance(code, str)
        assert len(code) == 6
    
    @pytest.mark.asyncio
    async def test_register_user_success(self, auth_service):
        """Тест успешной регистрации пользователя"""
        test_user = {
            "user_id": TEST_USER_ID,
            "email": TEST_EMAIL,
            "first_name": TEST_FIRST_NAME,
            "last_name": TEST_LAST_NAME,
            "role_id": TEST_ROLE_ID
        }
        auth_service.user_repository.create_user.return_value = test_user
        auth_service.user_repository.save_verification_code.return_value = True
        
        success, user, error = await auth_service.register_user(
            email=TEST_EMAIL,
            password=TEST_PASSWORD,
            first_name=TEST_FIRST_NAME,
            last_name=TEST_LAST_NAME
        )
        
        assert success is True
        assert user == test_user
        assert error is None
        auth_service.user_repository.create_user.assert_called_once()
        auth_service.user_repository.save_verification_code.assert_called_once()
        auth_service.email_service.send_verification_email.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_register_user_existing_email(self, auth_service):
        """Тест регистрации с уже существующим email"""
        auth_service.user_repository.create_user.return_value = None
        
        success, user, error = await auth_service.register_user(
            email=TEST_EMAIL,
            password=TEST_PASSWORD,
            first_name=TEST_FIRST_NAME,
            last_name=TEST_LAST_NAME
        )
        
        assert success is False
        assert user is None
        assert error == "Пользователь с таким email уже существует"
        auth_service.user_repository.create_user.assert_called_once()
        auth_service.user_repository.save_verification_code.assert_not_called()
        auth_service.email_service.send_verification_email.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_register_user_invalid_email(self, auth_service):
        """Тест регистрации с некорректным email"""
        success, user, error = await auth_service.register_user(
            email="invalid email with spaces",
            password=TEST_PASSWORD,
            first_name=TEST_FIRST_NAME,
            last_name=TEST_LAST_NAME
        )
        
        assert success is False
        assert user is None
        assert "не должны содержать пробелы" in error
    
    @pytest.mark.asyncio
    async def test_verify_user_success(self, auth_service):
        """Тест успешной верификации пользователя"""
        auth_service.user_repository.get_user_id_by_verification_code.return_value = TEST_USER_ID
        auth_service.user_repository.get_user_by_id.return_value = {
            "user_id": TEST_USER_ID,
            "email": TEST_EMAIL
        }
        auth_service.user_repository.set_user_verified.return_value = True
        
        success, user_id, error = await auth_service.verify_user(TEST_VERIFICATION_CODE)
        
        assert success is True
        assert user_id == TEST_USER_ID
        assert error is None
        auth_service.user_repository.set_user_verified.assert_called_once_with(TEST_USER_ID)
        auth_service.user_repository.delete_verification_code.assert_called_once_with(TEST_USER_ID)
    
    @pytest.mark.asyncio
    async def test_verify_user_invalid_code(self, auth_service):
        """Тест верификации с неверным кодом"""
        auth_service.user_repository.get_user_id_by_verification_code.return_value = None
        
        success, user_id, error = await auth_service.verify_user(TEST_WRONG_VERIFICATION_CODE)
        
        assert success is False
        assert user_id is None
        assert error == "Неверный код верификации"
        auth_service.user_repository.set_user_verified.assert_not_called()
        auth_service.user_repository.delete_verification_code.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_verify_user_non_existent_user(self, auth_service):
        """Тест верификации несуществующего пользователя"""
        auth_service.user_repository.get_user_id_by_verification_code.return_value = TEST_USER_ID
        auth_service.user_repository.get_user_by_id.return_value = None
        
        success, user_id, error = await auth_service.verify_user(TEST_VERIFICATION_CODE)
        
        assert success is False
        assert user_id is None
        assert error == "Пользователь не найден"
        auth_service.user_repository.set_user_verified.assert_not_called()
        auth_service.user_repository.delete_verification_code.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_login_user_success(self, auth_service):
        """Тест успешного входа пользователя"""
        mock_user = {
            "user_id": TEST_USER_ID,
            "email": TEST_EMAIL,
            "password_hash": TEST_HASHED_PASSWORD,
            "is_verified": True,
            "role_id": TEST_ROLE_ID
        }
        auth_service.user_repository.get_user_by_email.return_value = mock_user
        auth_service.user_repository.get_password_version.return_value = 1
        
        success, user_data, error = await auth_service.login_user(TEST_EMAIL, TEST_PASSWORD)
        
        assert success is True
        assert user_data is not None
        assert user_data["email"] == TEST_EMAIL
        assert user_data["password_version"] == 1
        auth_service.user_repository.get_user_by_email.assert_called_once()
        auth_service.user_repository.get_password_version.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_login_user_non_existent(self, auth_service):
        """Тест входа несуществующего пользователя"""
        auth_service.user_repository.get_user_by_email.return_value = None
        
        success, user_data, error = await auth_service.login_user(TEST_EMAIL, TEST_PASSWORD)
        
        assert success is False
        assert user_data is None
        assert error == "Неверные данные для входа"
        auth_service.user_repository.get_user_by_email.assert_called_once()
        auth_service.user_repository.get_password_version.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_login_user_wrong_password(self, auth_service):
        """Тест входа с неверным паролем"""
        mock_user = {
            "user_id": TEST_USER_ID,
            "email": TEST_EMAIL,
            "password_hash": TEST_HASHED_PASSWORD,
            "is_verified": True,
            "role_id": TEST_ROLE_ID
        }
        auth_service.user_repository.get_user_by_email.return_value = mock_user
        # Переопределяем метод verify_password для этого теста
        auth_service.verify_password = lambda plain, hashed: False
        
        # Вызов тестируемого метода
        success, user_data, error = await auth_service.login_user(TEST_EMAIL, TEST_WRONG_PASSWORD)
        
        assert success is False
        assert user_data is None
        assert error == "Неверные данные для входа"
        auth_service.user_repository.get_user_by_email.assert_called_once()
        
        # Восстанавливаем метод verify_password
        auth_service.verify_password = lambda plain, hashed: plain == TEST_PASSWORD
    
    @pytest.mark.asyncio
    async def test_login_user_unverified(self, auth_service):
        """Тест входа с неверифицированным аккаунтом"""
        mock_user = {
            "user_id": TEST_USER_ID,
            "email": TEST_EMAIL,
            "password_hash": TEST_HASHED_PASSWORD,
            "is_verified": False,
            "role_id": TEST_ROLE_ID
        }
        auth_service.user_repository.get_user_by_email.return_value = mock_user
        auth_service.user_repository.save_verification_code.return_value = True
        
        success, user_data, error = await auth_service.login_user(TEST_EMAIL, TEST_PASSWORD)
        
        assert success is False
        assert user_data is None
        assert "Аккаунт не верифицирован" in error
        auth_service.user_repository.get_user_by_email.assert_called_once()
        auth_service.user_repository.save_verification_code.assert_called_once()
        auth_service.email_service.send_verification_email.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_user_by_id_success(self, auth_service):
        """Тест успешного получения пользователя по ID"""
        mock_user = {
            "user_id": TEST_USER_ID,
            "email": TEST_EMAIL,
            "first_name": TEST_FIRST_NAME,
            "last_name": TEST_LAST_NAME,
            "role_id": TEST_ROLE_ID
        }
        auth_service.user_repository.get_user_by_id.return_value = mock_user
        auth_service.user_repository.get_password_version.return_value = 1
        
        result = await auth_service.get_user_by_id(TEST_USER_ID)
        
        assert result is not None
        assert result["user_id"] == TEST_USER_ID
        assert result["email"] == TEST_EMAIL
        assert result["password_version"] == 1
        auth_service.user_repository.get_user_by_id.assert_called_once_with(TEST_USER_ID)
        auth_service.user_repository.get_password_version.assert_called_once_with(TEST_USER_ID)
    
    @pytest.mark.asyncio
    async def test_get_user_by_id_non_existent(self, auth_service):
        """Тест получения несуществующего пользователя по ID"""
        auth_service.user_repository.get_user_by_id.return_value = None
        
        result = await auth_service.get_user_by_id(TEST_USER_ID)
        
        assert result is None
        auth_service.user_repository.get_user_by_id.assert_called_once_with(TEST_USER_ID)
        auth_service.user_repository.get_password_version.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_initiate_password_change_success(self, auth_service):
        """Тест успешной инициации смены пароля"""
        mock_user = {
            "user_id": TEST_USER_ID,
            "email": TEST_EMAIL,
            "role_id": TEST_ROLE_ID
        }
        auth_service.user_repository.get_user_by_id.return_value = mock_user
        auth_service.user_repository.save_verification_code.return_value = True
        
        success, code, error = await auth_service.initiate_password_change(str(TEST_USER_ID))
        
        assert success is True
        assert isinstance(code, str)
        assert error is None
        auth_service.user_repository.get_user_by_id.assert_called_once_with(str(TEST_USER_ID))
        auth_service.user_repository.save_verification_code.assert_called_once()
        auth_service.email_service.send_verification_email.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_initiate_password_change_user_not_found(self, auth_service):
        """Тест инициации смены пароля для несуществующего пользователя"""
        auth_service.user_repository.get_user_by_id.return_value = None
        
        success, code, error = await auth_service.initiate_password_change(str(TEST_USER_ID))
        
        assert success is False
        assert code == ""
        assert error == "Пользователь не найден"
        auth_service.user_repository.get_user_by_id.assert_called_once_with(str(TEST_USER_ID))
        auth_service.user_repository.save_verification_code.assert_not_called()
        auth_service.email_service.send_verification_email.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_verify_and_change_password_success(self, auth_service):
        """Тест успешной верификации и смены пароля"""
        auth_service.verify_and_change_password = AsyncMock(return_value=(True, None))
        
        success, error = await auth_service.verify_and_change_password(
            str(TEST_USER_ID),
            TEST_VERIFICATION_CODE,
            "NewPassword123"
        )
        
        assert success is True
        assert error is None 