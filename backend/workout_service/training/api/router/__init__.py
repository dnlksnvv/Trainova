from fastapi import APIRouter, Depends, HTTPException, Request, status, File, UploadFile, Form
from typing import List, Optional
from uuid import UUID, uuid4
import os
import shutil
from pathlib import Path
from datetime import date, timedelta

from training.application.services.exercises_service import ExercisesService
from training.application.services.training_service import TrainingService
from training.application.services.admin_service import AdminService
from training.application.services.muscle_groups_service import MuscleGroupsService
from training.application.services.activity_service import ActivityService
from training.domain.schemas import (
    Exercise, ExerciseCreate, ExerciseUpdate,
    Training, TrainingCreate, TrainingUpdate,
    UserTraining, UserTrainingCreate, UserTrainingUpdate,
    UserProgress, UserProgressCreate, UserProgressUpdate,
    MuscleGroup, MuscleGroupModel, MuscleGroupCreate, MuscleGroupUpdate,
    AppWorkout, AppWorkoutCreate, AppWorkoutUpdate, AppWorkoutExercise,
    UserActivity, UserActivityRequest, WorkoutProgress
)
from training.domain.utils import verify_token, get_current_user_id, is_admin_or_trainer, is_admin
from config import settings

# Директория для сохранения GIF-файлов упражнений
EXERCISES_CONTENT_DIR = Path("exercises_content")

# Создаем директорию, если она еще не существует
os.makedirs(EXERCISES_CONTENT_DIR, exist_ok=True)
# Убедимся, что у директории есть нужные права доступа
try:
    os.chmod(EXERCISES_CONTENT_DIR, 0o777)
    print(f"Установлены права 777 для директории {EXERCISES_CONTENT_DIR}")
    
    # Дополнительная отладочная информация о директории
    import stat
    st = os.stat(EXERCISES_CONTENT_DIR)
    permissions = oct(st.st_mode)[-3:]
    print(f"Директория {EXERCISES_CONTENT_DIR} существует, права доступа: {permissions}")
    
    try:
        import pwd, grp
        uid = os.getuid()
        gid = os.getgid()
        user = pwd.getpwuid(st.st_uid).pw_name
        group = grp.getgrgid(st.st_gid).gr_name
        print(f"Владелец: {user} (UID: {st.st_uid}), группа: {group} (GID: {st.st_gid})")
        print(f"Текущий процесс: UID={uid}, GID={gid}")
    except Exception as user_err:
        print(f"Не удалось получить информацию о пользователе: {user_err}")
        
except Exception as e:
    print(f"Предупреждение: не удалось установить права для директории exercises_content: {e}")

class TrainingRouter:
    """
    Класс для определения маршрутов API тренировок
    """
    
    def __init__(
        self, 
        exercises_service: ExercisesService,
        training_service: TrainingService,
        admin_service: AdminService,
        muscle_groups_service: MuscleGroupsService,
        activity_service: ActivityService
    ):
        self.exercises_service = exercises_service
        self.training_service = training_service
        self.admin_service = admin_service
        self.muscle_groups_service = muscle_groups_service
        self.activity_service = activity_service
        
        # Создаем основной роутер
        self.router = APIRouter(prefix=settings.WORKOUT_API_PREFIX)
        
        # Регистрируем маршруты
        self._register_routes()
    
    def _register_routes(self):
        """
        Регистрируем все маршруты API
        """
        # маршруты для групп мышц
        self.router.add_api_route(
            "/muscle-groups",
            self.get_muscle_groups,
            methods=["GET"],
            response_model=List[MuscleGroupModel],
            summary="Получить список всех групп мышц",
            description="Возвращает список всех доступных групп мышц"
        )
        
        self.router.add_api_route(
            "/muscle-groups/{muscle_group_id}",
            self.get_muscle_group,
            methods=["GET"],
            response_model=MuscleGroupModel,
            summary="Получить группу мышц по ID",
            description="Возвращает группу мышц по её ID"
        )
        
        self.router.add_api_route(
            "/muscle-groups",
            self.create_muscle_group,
            methods=["POST"],
            response_model=MuscleGroupModel,
            summary="Создать новую группу мышц",
            description="Создает новую группу мышц"
        )
        
        self.router.add_api_route(
            "/muscle-groups/{muscle_group_id}",
            self.update_muscle_group,
            methods=["PUT"],
            response_model=MuscleGroupModel,
            summary="Обновить группу мышц",
            description="Обновляет существующую группу мышц"
        )
        
        self.router.add_api_route(
            "/muscle-groups/{muscle_group_id}",
            self.delete_muscle_group,
            methods=["DELETE"],
            response_model=bool,
            summary="Удалить группу мышц",
            description="Удаляет группу мышц по её ID"
        )
        
        self.router.add_api_route(
            "/muscle-groups/{muscle_group_id}/exercises",
            self.get_exercises_by_muscle_group_id,
            methods=["GET"],
            response_model=List[Exercise],
            summary="Получить упражнения по ID группы мышц",
            description="Возвращает список упражнений для указанной группы мышц по её ID"
        )
        
        # маршруты для  упражнений
        self.router.add_api_route(
            "/exercises",
            self.get_exercises,
            methods=["GET"],
            response_model=List[Exercise],
            summary="Получить список всех упражнений",
            description="Возвращает список всех доступных упражнений"
        )
        
        self.router.add_api_route(
            "/exercises/{exercise_id}",
            self.get_exercise,
            methods=["GET"],
            response_model=Exercise,
            summary="Получить упражнение по ID",
            description="Возвращает упражнение по его ID"
        )
        
        self.router.add_api_route(
            "/exercises",
            self.create_exercise,
            methods=["POST"],
            response_model=Exercise,
            summary="Создать новое упражнение",
            description="Создает новое упражнение"
        )
        
        self.router.add_api_route(
            "/exercises/{exercise_id}",
            self.update_exercise,
            methods=["PUT"],
            response_model=Exercise,
            summary="Обновить упражнение",
            description="Обновляет существующее упражнение"
        )
        
        self.router.add_api_route(
            "/exercises/{exercise_id}",
            self.delete_exercise,
            methods=["DELETE"],
            response_model=bool,
            summary="Удалить упражнение",
            description="Удаляет упражнение по его ID"
        )
        
        self.router.add_api_route(
            "/exercises/muscle-group/{muscle_group}",
            self.get_exercises_by_muscle_group,
            methods=["GET"],
            response_model=List[Exercise],
            summary="Получить упражнения по группе мышц",
            description="Возвращает список упражнений для указанной группы мышц"
        )
        
        # Маршруты для тренировоок
        self.router.add_api_route(
            "/trainings",
            self.get_trainings,
            methods=["GET"],
            response_model=List[Training],
            summary="Получить список тренировок",
            description="Возвращает список всех публичных тренировок и личных тренировок пользователя"
        )
        
        self.router.add_api_route(
            "/trainings/{training_id}",
            self.get_training,
            methods=["GET"],
            response_model=Training,
            summary="Получить тренировку по ID",
            description="Возвращает тренировку по ее ID"
        )
        
        self.router.add_api_route(
            "/trainings",
            self.create_training,
            methods=["POST"],
            response_model=Training,
            summary="Создать новую тренировку",
            description="Создает новую тренировку"
        )
        
        self.router.add_api_route(
            "/trainings/{training_id}",
            self.update_training,
            methods=["PUT"],
            response_model=Training,
            summary="Обновить тренировку",
            description="Обновляет существующую тренировку"
        )
        
        self.router.add_api_route(
            "/trainings/{training_id}",
            self.delete_training,
            methods=["DELETE"],
            response_model=bool,
            summary="Удалить тренировку",
            description="Удаляет тренировку по ее ID"
        )

        # маршруты для работы с гивками упражнений
        self.router.add_api_route(
            "/exercises/{exercise_id}/upload-gif",
            self.upload_exercise_gif,
            methods=["POST"],
            response_model=Exercise,
            summary="Загрузить GIF для упражнения",
            description="Загружает GIF-анимацию для упражнения и привязывает ее к нему"
        )
        
        self.router.add_api_route(
            "/exercises/{exercise_id}/delete-gif",
            self.delete_exercise_gif,
            methods=["DELETE"],
            response_model=Exercise,
            summary="Удалить GIF упражнения",
            description="Удаляет GIF-анимацию упражнения"
        )
        
        self.router.add_api_route(
            "/exercises/gif/{gif_uuid}",
            self.get_exercise_gif,
            methods=["GET"],
            summary="Получить GIF упражнения",
            description="Возвращает GIF-анимацию упражнения по ее UUID"
        )
        
        # Маршруты для пользовательских тренировок (app_workouts)
        self.router.add_api_route(
            "/app-workouts",
            self.get_app_workouts,
            methods=["GET"],
            response_model=List[AppWorkout],
            summary="Получить список тренировок пользователя",
            description="Возвращает список всех тренировок текущего пользователя"
        )
        
        self.router.add_api_route(
            "/app-workouts/{workout_uuid}",
            self.get_app_workout,
            methods=["GET"],
            response_model=AppWorkout,
            summary="Получить тренировку пользователя по ID",
            description="Возвращает тренировку пользователя по её UUID"
        )
        
        self.router.add_api_route(
            "/app-workouts",
            self.create_app_workout,
            methods=["POST"],
            response_model=AppWorkout,
            summary="Создать новую тренировку пользователя",
            description="Создает новую тренировку для текущего пользователя"
        )
        
        self.router.add_api_route(
            "/app-workouts/{workout_uuid}",
            self.update_app_workout,
            methods=["PUT"],
            response_model=AppWorkout,
            summary="Обновить тренировку пользователя",
            description="Обновляет существующую тренировку пользователя"
        )
        
        self.router.add_api_route(
            "/app-workouts/{workout_uuid}",
            self.delete_app_workout,
            methods=["DELETE"],
            response_model=bool,
            summary="Удалить тренировку пользователя",
            description="Удаляет тренировку пользователя по её UUID"
        )

        # Маршрут для сохранения прогресса тренировки через активность пользователя
        self.router.add_api_route(
            "/user-activity/save-progress",
            self.save_workout_progress,
            methods=["POST"],
            response_model=dict,
            summary="Сохранить прогресс тренировки и обновить активность пользователя"
        )

        # маршруты для активности пользователя
        self.router.add_api_route(
            "/user-activity",
            self.get_user_activity,
            methods=["GET"],
            response_model=List[UserActivity],
            summary="Получить активность пользователя",
            description="Возвращает данные об активности пользователя за указанный период"
        )
        
        self.router.add_api_route(
            "/user-activity",
            self.update_user_activity,
            methods=["POST"],
            response_model=UserActivity,
            summary="Обновить активность пользователя",
            description="Обновляет данные об активности пользователя за указанную дату"
        )
    
    
    # методы для упражнений
    async def get_exercises(self) -> List[Exercise]:
        """Получает список всех упражнений"""
        return await self.exercises_service.get_all_exercises()
    
    async def get_exercise(self, exercise_id: UUID) -> Exercise:
        """Получает упражнение по ID"""
        exercise = await self.exercises_service.get_exercise_by_id(exercise_id)
        if not exercise:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Упражнение с ID {exercise_id} не найдено"
            )
        return exercise
    
    async def create_exercise(self, exercise_data: ExerciseCreate, request: Request) -> Exercise:
        """Создает новое упражнение"""
        if not is_admin_or_trainer(request):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только администраторы и тренеры могут создавать упражнения"
            )
        return await self.exercises_service.create_exercise(exercise_data)
    
    async def update_exercise(self, exercise_id: UUID, exercise_data: ExerciseUpdate, request: Request) -> Exercise:
        """Обновляет упражнение"""
        if not is_admin_or_trainer(request):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только администраторы и тренеры могут обновлять упражнения"
            )
        exercise = await self.exercises_service.update_exercise(exercise_id, exercise_data)
        if not exercise:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Упражнение с ID {exercise_id} не найдено"
            )
        return exercise
    
    async def delete_exercise(self, exercise_id: UUID, request: Request) -> bool:
        """Удаляет упражнение"""
        if not is_admin_or_trainer(request):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только администраторы и тренеры могут удалять упражнения"
            )
        result = await self.exercises_service.delete_exercise(exercise_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Упражнение с ID {exercise_id} не найдено"
            )
        return result
    
    async def get_exercises_by_muscle_group(self, muscle_group: MuscleGroup) -> List[Exercise]:
        """Получает упражнения по группе мышц"""
        return await self.exercises_service.get_exercises_by_muscle_group(muscle_group.value)
    
    # методы для тренировок
    async def get_trainings(self, request: Request) -> List[Training]:
        """Получает список тренировок"""
        try:
            user_id = await get_current_user_id(request)
        except:
            user_id = None
        return await self.training_service.get_all_trainings(user_id)
    
    async def get_training(self, training_id: int, request: Request) -> Training:
        """Получает тренировку по ID"""
        try:
            user_id = await get_current_user_id(request)
        except:
            user_id = None
        training = await self.training_service.get_training_by_id(training_id, user_id)
        if not training:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Тренировка с ID {training_id} не найдена или недоступна"
            )
        return training
    
    async def create_training(self, training_data: TrainingCreate, request: Request) -> Training:
        """Создает новую тренировку"""
        if not is_admin(request):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только администраторы могут создавать тренировки"
            )
        user_id = await get_current_user_id(request)
        return await self.training_service.create_training(training_data, user_id)
    
    async def update_training(self, training_id: int, training_data: TrainingUpdate, request: Request) -> Training:
        """Обновляет тренировку"""
        if not is_admin(request):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только администраторы могут обновлять тренировки"
            )
        user_id = await get_current_user_id(request)
        training = await self.training_service.update_training(training_id, training_data, user_id)
        if not training:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Тренировка с ID {training_id} не найдена или у вас нет прав для ее обновления"
            )
        return training
    
    async def delete_training(self, training_id: int, request: Request) -> bool:
        """Удаляет тренировку"""
        if not is_admin(request):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только администраторы могут удалять тренировки"
            )
        user_id = await get_current_user_id(request)
        result = await self.training_service.delete_training(training_id, user_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Тренировка с ID {training_id} не найдена или у вас нет прав для ее удаления"
            )
        return result
    
    # Методы для групп мышц
    async def get_muscle_groups(self) -> List[MuscleGroupModel]:
        """Получает список всех групп мышц"""
        return await self.muscle_groups_service.get_all_muscle_groups()
    
    async def get_muscle_group(self, muscle_group_id: int) -> MuscleGroupModel:
        """Получает группу мышц по ID"""
        muscle_group = await self.muscle_groups_service.get_muscle_group_by_id(muscle_group_id)
        if not muscle_group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Группа мышц с ID {muscle_group_id} не найдена"
            )
        return muscle_group
    
    async def create_muscle_group(self, muscle_group_data: MuscleGroupCreate, request: Request) -> MuscleGroupModel:
        """Создает новую группу мышц"""
        if not is_admin_or_trainer(request):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только администраторы и тренеры могут создавать группы мышц"
            )
        
        print(f"Создание группы мышц с данными: {muscle_group_data}")
        result = await self.muscle_groups_service.create_muscle_group(muscle_group_data)
        print(f"Результат создания группы мышц: {result}")
        
        return result
    
    async def update_muscle_group(self, muscle_group_id: int, muscle_group_data: MuscleGroupUpdate, request: Request) -> MuscleGroupModel:
        """Обновляет группу мышц"""
        if not is_admin_or_trainer(request):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только администраторы и тренеры могут обновлять группы мышц"
            )
        muscle_group = await self.muscle_groups_service.update_muscle_group(muscle_group_id, muscle_group_data)
        if not muscle_group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Группа мышц с ID {muscle_group_id} не найдена"
            )
        return muscle_group
    
    async def delete_muscle_group(self, muscle_group_id: int, request: Request) -> bool:
        """Удаляет группу мышц"""
        if not is_admin_or_trainer(request):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только администраторы и тренеры могут удалять группы мышц"
            )
        result = await self.muscle_groups_service.delete_muscle_group(muscle_group_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Группа мышц с ID {muscle_group_id} не найдена"
            )
        return result
    
    async def get_exercises_by_muscle_group_id(self, muscle_group_id: int) -> List[Exercise]:
        """Получает упражнения по ID группы мышц"""
        return await self.exercises_service.get_exercises_by_muscle_group_id(muscle_group_id)

    async def upload_exercise_gif(self, request: Request, exercise_id: UUID, gif_file: UploadFile = File(...)) -> Exercise:
        """Загружает гифки для упражнения"""
        if not is_admin_or_trainer(request):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только администраторы и тренеры могут загружать GIF-анимации для упражнений"
            )
        
        #прооверяем, что упражнение существует
        exercise = await self.exercises_service.get_exercise_by_id(exercise_id)
        if not exercise:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Упражнение с ID {exercise_id} не найдено"
            )
        
        # Проверяем тип файла
        if not gif_file.content_type or not gif_file.content_type.startswith("image/gif"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Загружаемый файл должен быть gif"
            )
        
        # Генерируем новый UUID для gif
        gif_uuid = str(uuid4())
        
        # Проверяем, существует ли директория, если нет - создаем и устанавливаем права
        if not os.path.exists(EXERCISES_CONTENT_DIR):
            try:
                os.makedirs(EXERCISES_CONTENT_DIR, exist_ok=True)
                os.chmod(EXERCISES_CONTENT_DIR, 0o777)  # Устанавливаем права 777 (rwx для всех)
                print(f"Создана директория {EXERCISES_CONTENT_DIR} с правами 777")
            except Exception as e:
                print(f"Ошибка при создании директории: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Не удалось создать директорию для GIF-файлов: {str(e)}"
                )
        
        # Проверяем права доступа к директории
        if not os.access(EXERCISES_CONTENT_DIR, os.W_OK):
            try:
                print(f"Нет прав доступа к директории {EXERCISES_CONTENT_DIR}, пробуем изменить права")
                os.chmod(EXERCISES_CONTENT_DIR, 0o777)
                print(f"Права успешно изменены")
            except Exception as e:
                print(f"Не удалось изменить права доступа: {str(e)}")
                # Получим информацию о владельце и правах директории
                try:
                    import pwd
                    import stat
                    st = os.stat(EXERCISES_CONTENT_DIR)
                    owner = pwd.getpwuid(st.st_uid).pw_name
                    permissions = oct(st.st_mode)[-3:]
                    current_user = os.getuid()
                    error_msg = f"Недостаточно прав для директории {EXERCISES_CONTENT_DIR}. "
                    error_msg += f"Владелец: {owner}, права: {permissions}, текущий пользователь UID: {current_user}"
                    print(error_msg)
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=error_msg
                    )
                except Exception as stat_err:
                    print(f"Ошибка при получении статистики: {str(stat_err)}")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Недостаточно прав для директории: {str(e)}"
                    )
                
        file_path = EXERCISES_CONTENT_DIR / f"{gif_uuid}.gif"
        
        # Если gif уже существует, удаляем старый файл
        if exercise.gif_uuid:
            old_file_path = EXERCISES_CONTENT_DIR / f"{exercise.gif_uuid}.gif"
            if os.path.exists(old_file_path):
                try:
                    os.remove(old_file_path)
                    print(f"Удален старый файл: {old_file_path}")
                except PermissionError as e:
                    print(f"Ошибка доступа при удалении старого файла: {str(e)}")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Ошибка доступа при удалении старого файла. Проверьте права доступа к {old_file_path}"
                    )
                except Exception as e:
                    print(f"Неожиданная ошибка при удалении файла: {str(e)}")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Ошибка при удалении старого файла: {str(e)}"
                    )
        
        # Сохраняем новый файл
        try:
            print(f"Начинаем сохранение файла в {file_path}")
            content = await gif_file.read()
            with open(file_path, "wb") as buffer:
                buffer.write(content)
            
            print(f"Файл сохранен, устанавливаем права доступа")
            # Устанавливаем права доступа на файл
            os.chmod(file_path, 0o666)  # rw для всех
            print(f"Права установлены успешно")
        except PermissionError as e:
            print(f"Ошибка прав доступа при сохранении файла: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Недостаточно прав для сохранения файла. Детали: {str(e)}"
            )
        except Exception as e:
            print(f"Ошибка при сохранении файла: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при сохранении файла: {str(e)}"
            )
        finally:
            await gif_file.close()
        
        try:
            print(f"Обновляем упражнение, устанавливаем gif_uuid={gif_uuid}")
            update_data = ExerciseUpdate(gif_uuid=gif_uuid)
            updated_exercise = await self.exercises_service.update_exercise(exercise_id, update_data)
            
            if not updated_exercise or not updated_exercise.gif_uuid:
                print("Не удалось обновить GIF-анимацию упражнения")
                if os.path.exists(file_path):
                    os.remove(file_path)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Не удалось обновить GIF-анимацию упражнения"
                )
            
            print(f"Упражнение успешно обновлено")
            return updated_exercise
            
        except Exception as e:
            # Если не удалось обновить упражнение, удаляем созданный файл
            print(f"Ошибка при обновлении упражнения: {str(e)}")
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при обновлении упражнения: {str(e)}"
            )
    
    async def delete_exercise_gif(self, exercise_id: UUID, request: Request) -> Exercise:
        """Удаляет GIF упражнения"""
        if not is_admin_or_trainer(request):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только администраторы и тренеры могут удалять GIF-анимации упражнений"
            )
        
        # Проверяем, что упражнение существует
        exercise = await self.exercises_service.get_exercise_by_id(exercise_id)
        if not exercise:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Упражнение с ID {exercise_id} не найдено"
            )
        
        # Если у упражнения нет GIF-файла, возвращаем ошибку
        if not exercise.gif_uuid:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="У упражнения нет GIF-анимации"
            )
        
        file_path = EXERCISES_CONTENT_DIR / f"{exercise.gif_uuid}.gif"
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Ошибка при удалении файла: {str(e)}"
                )
        try:
            update_data = ExerciseUpdate(gif_uuid=None)
            updated_exercise = await self.exercises_service.update_exercise(exercise_id, update_data)
            
            if not updated_exercise:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Не удалось обновить упражнение"
                )
            
            return updated_exercise
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при обновлении упражнения: {str(e)}"
            )
    
    async def get_exercise_gif(self, gif_uuid: str):
        """Возвращает GIF-анимацию упражнения по её UUID"""
        from fastapi.responses import FileResponse

        file_path = EXERCISES_CONTENT_DIR / f"{gif_uuid}.gif"
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="GIF-анимация не найдена"
            )
            
        return FileResponse(file_path, media_type="image/gif")

    # Методы для обработки маршрутов app_workouts
    # \/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/
    
    async def get_app_workouts(self, request: Request) -> List[AppWorkout]:
        """Получить список тренировок пользователя"""
        user_id = await get_current_user_id(request)
        return await self.training_service.get_app_workouts(user_id)
    
    async def get_app_workout(self, workout_uuid: UUID, request: Request) -> AppWorkout:
        """Получить тренировку пользователя по ID"""
        user_id = await get_current_user_id(request)
        workout = await self.training_service.get_app_workout_by_id(workout_uuid, user_id)
        if not workout:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Тренировка с UUID {workout_uuid} не найдена"
            )
        return workout
    
    async def create_app_workout(self, data: AppWorkoutCreate, request: Request) -> AppWorkout:
        """Создать новую тренировку пользователя"""
        if not is_admin(request):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только администратор может создавать новые тренировки"
            )
        
        user_id = await get_current_user_id(request)
        return await self.training_service.create_app_workout(data, user_id)
    
    async def update_app_workout(self, workout_uuid: UUID, data: AppWorkoutCreate, request: Request) -> AppWorkout:
        """Обновить тренировку пользователя"""
        if not is_admin(request):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только администратор может обновлять тренировки"
            )
        
        user_id = await get_current_user_id(request)
        workout = await self.training_service.update_app_workout(workout_uuid, data, user_id)
        if not workout:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Тренировка с UUID {workout_uuid} не найдена или недоступна"
            )
        return workout
    
    async def delete_app_workout(self, workout_uuid: UUID, request: Request) -> bool:
        """Удалить тренировку пользователя"""
        if not is_admin(request):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только администратор может удалять тренировки"
            )
        user_id = await get_current_user_id(request)
        success = await self.training_service.delete_app_workout(workout_uuid, user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Тренировка с UUID {workout_uuid} не найдена или недоступна"
            )
        return success

    async def get_user_activity(self, request: Request, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[UserActivity]:
        """
        Получаем данные об активности пользователя за указанный период.
        Если даты не указаны, возвращаем данные за последнюю неделю.
        """
        user_id = await get_current_user_id(request)
        
        # Если даты не указаны, используем последнюю неделю
        if not start_date:
            start_date = date.today() - timedelta(days=6)
        if not end_date:
            end_date = date.today()
        
        return await self.activity_service.get_user_activity(int(user_id), start_date, end_date)
    
    async def update_user_activity(self, activity_data: UserActivity, request: Request) -> UserActivity:
        """
        Обновляем данные об активности пользователя за указанную дату.
        """
        user_id = await get_current_user_id(request)
        
        is_admin_user = is_admin(request)
        if str(user_id) != activity_data.user_id and not is_admin_user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав для обновления данных другого пользователя"
            )
        return await self.activity_service.update_user_activity(
            int(activity_data.user_id),
            activity_data.record_date,
            activity_data.workout_count
        )

    async def save_workout_progress(self, workout_data: WorkoutProgress, request: Request):
        """
        Сохраняем прогресс тренировки пользователя и увеличиваем счетчик тренировок за день
        """
        try:
            # Получаем ID пользователя из данных запроса и преобразуем его в int
            user_id = int(workout_data.user_id)
            
            # Сохраняем прогресс тренировки, передавая UUID тренировки и время завершения
            result = await self.activity_service.save_workout_progress(
                user_id=user_id,
                workout_uuid=workout_data.workout_uuid,
                completed_at=workout_data.completed_at
            )
            
            return result
            
        except ValueError as e:
            # Если не удалось преобразовать user_id в int
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Некорректный формат user_id: {str(e)}"
            )
        except Exception as e:
            # Другие ошибки
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при сохранении прогресса тренировки: {str(e)}"
            )
