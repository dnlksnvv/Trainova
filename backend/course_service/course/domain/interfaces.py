from abc import ABC, abstractmethod
from typing import List, Optional
from .schemas import CourseCreate, CourseUpdate, CourseResponse


class ICourseRepository(ABC):
    """Интерфейс репозитория курсов"""
    
    @abstractmethod
    async def create_course(self, course_data: CourseCreate) -> CourseResponse:
        """Создать новый курс"""
        pass
    
    @abstractmethod
    async def get_course_by_id(self, course_id: str) -> Optional[CourseResponse]:
        """Получить курс по ID"""
        pass
    
    @abstractmethod
    async def get_courses(self, skip: int = 0, limit: int = 100) -> List[CourseResponse]:
        """Получить список курсов"""
        pass
    
    @abstractmethod
    async def update_course(self, course_id: str, course_data: CourseUpdate) -> Optional[CourseResponse]:
        """Обновить курс"""
        pass
    
    @abstractmethod
    async def delete_course(self, course_id: str) -> bool:
        """Удалить курс"""
        pass


class ICourseService(ABC):
    """Интерфейс сервиса курсов"""
    
    @abstractmethod
    async def create_course(self, course_data: CourseCreate) -> CourseResponse:
        """Создать новый курс"""
        pass
    
    @abstractmethod
    async def get_course(self, course_id: str) -> CourseResponse:
        """Получить курс по ID"""
        pass
    
    @abstractmethod
    async def get_courses(self, skip: int = 0, limit: int = 100) -> List[CourseResponse]:
        """Получить список курсов"""
        pass
    
    @abstractmethod
    async def update_course(self, course_id: str, course_data: CourseUpdate) -> CourseResponse:
        """Обновить курс"""
        pass
    
    @abstractmethod
    async def delete_course(self, course_id: str) -> bool:
        """Удалить курс"""
        pass 