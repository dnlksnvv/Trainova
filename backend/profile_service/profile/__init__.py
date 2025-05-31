from profile.api.router import ProfileRouter
from profile.application.profile_service import ProfileServiceImpl

# Создание экземпляров сервисов
profile_service = ProfileServiceImpl()

# Создание роутера с внедренными сервисами
router = ProfileRouter(profile_service).router

__all__ = ['router'] 