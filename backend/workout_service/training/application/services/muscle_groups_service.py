import logging
from typing import List, Optional, Dict, Any
from training.domain.schemas import MuscleGroupModel, MuscleGroupCreate, MuscleGroupUpdate
from training.infrastructure.database import Database
from training.domain.db_constants import *

logger = logging.getLogger(__name__)

class MuscleGroupsService:
    """
    Сервис для работы с группами мышц
    """
    
    def __init__(self):
        self.db = Database()
    
    async def get_all_muscle_groups(self) -> List[MuscleGroupModel]:
        """
        Получает список всех групп мышц
        
        Returns:
            Список групп мышц
        """
        try:
            query = f"""
                SELECT * FROM {MUSCLE_GROUPS_TABLE}
                ORDER BY {MUSCLE_GROUP_NAME}
            """
            
            rows = await self.db.fetch(query)
            return [self._map_to_model(row) for row in rows]
        except Exception as e:
            logger.error(f"Ошибка при получении списка групп мышц: {str(e)}")
            raise
    
    async def get_muscle_group_by_id(self, muscle_group_id: int) -> Optional[MuscleGroupModel]:
        """
        Получает группу мышц по ID
        
        Args:
            muscle_group_id: ID группы мышц
            
        Returns:
            Объект группы мышц или None, если группа не найдена
        """
        try:
            query = f"""
                SELECT * FROM {MUSCLE_GROUPS_TABLE}
                WHERE {MUSCLE_GROUP_ID} = $1
            """
            
            row = await self.db.fetchrow(query, muscle_group_id)
            return self._map_to_model(row) if row else None
        except Exception as e:
            logger.error(f"Ошибка при получении группы мышц по ID {muscle_group_id}: {str(e)}")
            raise
    
    async def create_muscle_group(self, muscle_group_data: MuscleGroupCreate) -> MuscleGroupModel:
        """
        Создает новую группу мышц
        
        Args:
            muscle_group_data: Данные для создания группы мышц
            
        Returns:
            Созданная группа мышц
        """
        try:
            query = f"""
                INSERT INTO {MUSCLE_GROUPS_TABLE} (
                    {MUSCLE_GROUP_NAME}, 
                    {MUSCLE_GROUP_DESCRIPTION}
                )
                VALUES ($1, $2)
                RETURNING *
            """
            
            description = muscle_group_data.description or ""
            
            row = await self.db.fetchrow(
                query, 
                muscle_group_data.name,
                description
            )
            
            print(f"Созданная группа мышц: {row}")
            
            return self._map_to_model(row)
        except Exception as e:
            logger.error(f"Ошибка при создании группы мышц: {str(e)}")
            raise
    
    async def update_muscle_group(self, muscle_group_id: int, muscle_group_data: MuscleGroupUpdate) -> Optional[MuscleGroupModel]:
        """
        Обновляет существующую группу мышц
        
        Args:
            muscle_group_id: ID группы мышц
            muscle_group_data: Данные для обновления
            
        Returns:
            Обновленная группа мышц или None, если группа не найдена
        """
        try:
            current_muscle_group = await self.get_muscle_group_by_id(muscle_group_id)
            if not current_muscle_group:
                return None
            
            update_fields = []
            params = []
            param_index = 1
            
            if muscle_group_data.name is not None:
                update_fields.append(f"{MUSCLE_GROUP_NAME} = ${param_index}")
                params.append(muscle_group_data.name)
                param_index += 1
            
            if muscle_group_data.description is not None:
                update_fields.append(f"{MUSCLE_GROUP_DESCRIPTION} = ${param_index}")
                params.append(muscle_group_data.description)
                param_index += 1
            
            if not update_fields:
                return current_muscle_group
                        
            query = f"""
                UPDATE {MUSCLE_GROUPS_TABLE}
                SET {", ".join(update_fields)}
                WHERE {MUSCLE_GROUP_ID} = ${param_index}
                RETURNING *
            """
            
            params.append(muscle_group_id)
            
            row = await self.db.fetchrow(query, *params)
            return self._map_to_model(row)
        except Exception as e:
            logger.error(f"Ошибка при обновлении группы мышц {muscle_group_id}: {str(e)}")
            raise
    
    async def delete_muscle_group(self, muscle_group_id: int) -> bool:
        """
        Удаляет группу мышц
        
        Args:
            muscle_group_id: ID группы мышц
            
        Returns:
            True, если группа успешно удалена, иначе False
        """
        try:
            query = f"""
                DELETE FROM {MUSCLE_GROUPS_TABLE}
                WHERE {MUSCLE_GROUP_ID} = $1
                RETURNING {MUSCLE_GROUP_ID}
            """
            
            result = await self.db.fetchval(query, muscle_group_id)
            return result is not None
        except Exception as e:
            logger.error(f"Ошибка при удалении группы мышц {muscle_group_id}: {str(e)}")
            raise
            
    def _map_to_model(self, row: Dict[str, Any]) -> Optional[MuscleGroupModel]:
        """
        Преобразует результат запроса в модель группы мышц
        
        Args:
            row: Результат запроса к БД
            
        Returns:
            Модель группы мышц или None, если row is None
        """
        if not row:
            return None
            
        return MuscleGroupModel(
            id=row.get(MUSCLE_GROUP_ID),
            name=row.get(MUSCLE_GROUP_NAME, ""), # Значение по умолчанию, если None
            description=row.get(MUSCLE_GROUP_DESCRIPTION, ""), # Значение по умолчанию, если None
            created_at=row.get(MUSCLE_GROUP_CREATED_AT),
            updated_at=row.get(MUSCLE_GROUP_UPDATED_AT)
        ) 