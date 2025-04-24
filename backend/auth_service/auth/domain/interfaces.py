from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Tuple

class ITokenService(ABC):
    @abstractmethod
    def create_access_token(self, user_id: str, role_id: int, email: str, token_type: str = "access", expire_minutes: Optional[int] = None, password_version: int = 0) -> str:
        pass
    
    @abstractmethod
    def create_refresh_token(self, user_id: str, role_id: int, email: str, password_version: int = 0) -> str:
        pass
    
    @abstractmethod
    def create_reset_password_token(self, user_id: str, role_id: int, email: str, expire_minutes: int = 30, password_version: int = 0) -> str:
        pass
    
    @abstractmethod
    def decode_jwt(self, token: str) -> Optional[Dict[str, Any]]:
        pass
    
    @abstractmethod
    def is_token_valid(self, token: str, expected_type: Optional[str] = None) -> bool:
        pass

class IAuthService(ABC):
    @abstractmethod
    def hash_password(self, password: str) -> str:
        pass
    
    @abstractmethod
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        pass
    
    @abstractmethod
    def normalize_contact(self, email: str) -> str:
        pass
    
    @abstractmethod
    def generate_verification_code(self, length: int = 6) -> str:
        pass
    
    @abstractmethod
    async def register_user(self, email: str, password: str, first_name: Optional[str] = None, last_name: Optional[str] = None) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        pass
    
    @abstractmethod
    async def verify_user(self, code: str) -> Tuple[bool, Optional[int], Optional[str]]:
        pass
        
    @abstractmethod
    async def login_user(self, email: str, password: str) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        pass
        
    @abstractmethod
    async def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    async def initiate_password_change(self, user_id: str) -> Tuple[bool, str, Optional[str]]:
        pass
        
    @abstractmethod
    async def verify_and_change_password(self, user_id: str, verification_code: str, new_password: str) -> Tuple[bool, Optional[str]]:
        pass

    @abstractmethod
    async def initiate_forgot_password(self, email: str) -> Tuple[bool, Optional[str], Optional[str]]:
        pass
        
    @abstractmethod
    async def reset_password_with_code(self, email: str, reset_code: str, new_password: str) -> Tuple[bool, Optional[str]]:
        pass
        
    @abstractmethod
    async def initiate_email_change(self, user_id: str, new_email: str) -> Tuple[bool, Optional[str], Optional[str]]:
        pass
        
    @abstractmethod
    async def verify_and_change_email(self, user_id: str, new_email: str, verification_code: str) -> Tuple[bool, Optional[str]]:
        pass

class IEmailService(ABC):
    @abstractmethod
    async def send_verification_email(self, email: str, verification_code: str, context: Optional[str] = None) -> bool:
        pass
        
    @abstractmethod
    async def send_reset_password_email(self, email: str, reset_url: str, expire_in_minutes: int = 30) -> bool:
        pass 