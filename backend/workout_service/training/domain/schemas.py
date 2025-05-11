from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, date
from enum import Enum
from uuid import UUID


class MuscleGroup(str, Enum):
    CHEST = "chest"
    BACK = "back"
    LEGS = "legs"
    SHOULDERS = "shoulders"
    ARMS = "arms"
    ABS = "abs"
    FULL_BODY = "full_body"
    CARDIO = "cardio"
    OTHER = "other"


# Модели для работы с группами мышц
class MuscleGroupModel(BaseModel):
    id: Optional[int] = None
    name: str
    description: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MuscleGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None


class MuscleGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class DifficultyLevel(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class TrainingStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class Exercise(BaseModel):
    exercise_id: Optional[Union[str, UUID]] = None  
    title: str  
    description: str 
    muscle_group_id: int  # ID группы мышц
    gif_uuid: Optional[Union[str, UUID]] = None  
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ExerciseCreate(BaseModel):
    title: str  
    description: str 
    muscle_group_id: int  
    gif_uuid: Optional[Union[str, UUID]] = None  


class ExerciseUpdate(BaseModel):
    title: Optional[str] = None 
    description: Optional[str] = None 
    muscle_group_id: Optional[int] = None 
    gif_uuid: Optional[Union[str, UUID]] = None  


class TrainingExercise(BaseModel):
    id: Optional[int] = None
    exercise_id: int
    exercise: Optional[Exercise] = None
    sets: int
    reps: int
    weight: Optional[float] = None
    rest_time: Optional[int] = None  # в секундах
    exercise_order: int

    class Config:
        from_attributes = True


class TrainingExerciseCreate(BaseModel):
    exercise_id: int
    sets: int
    reps: int
    weight: Optional[float] = None
    rest_time: Optional[int] = None
    exercise_order: int


class TrainingExerciseUpdate(BaseModel):
    exercise_id: Optional[int] = None
    sets: Optional[int] = None
    reps: Optional[int] = None
    weight: Optional[float] = None
    rest_time: Optional[int] = None
    exercise_order: Optional[int] = None


class Training(BaseModel):
    id: Optional[int] = None
    name: str
    description: str
    difficulty: DifficultyLevel
    duration: Optional[int] = None  # в минутах
    created_by: int
    is_public: bool = True
    exercises: Optional[List[TrainingExercise]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TrainingCreate(BaseModel):
    name: str
    description: str
    difficulty: DifficultyLevel
    duration: Optional[int] = None
    is_public: bool = True
    exercises: List[TrainingExerciseCreate]


class TrainingUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    difficulty: Optional[DifficultyLevel] = None
    duration: Optional[int] = None
    is_public: Optional[bool] = None
    exercises: Optional[List[TrainingExerciseCreate]] = None


class UserTraining(BaseModel):
    id: Optional[int] = None
    user_id: int
    training_id: int
    training: Optional[Training] = None
    status: TrainingStatus = TrainingStatus.NOT_STARTED
    is_favorite: bool = False
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserTrainingCreate(BaseModel):
    training_id: int
    is_favorite: bool = False


class UserTrainingUpdate(BaseModel):
    status: Optional[TrainingStatus] = None
    is_favorite: Optional[bool] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class UserProgress(BaseModel):
    id: Optional[int] = None
    user_id: int
    training_id: int
    exercise_id: int
    sets_completed: int
    reps_completed: int
    weight_used: Optional[float] = None
    date: datetime
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class UserProgressCreate(BaseModel):
    training_id: int
    exercise_id: int
    sets_completed: int
    reps_completed: int
    weight_used: Optional[float] = None
    notes: Optional[str] = None


class UserProgressUpdate(BaseModel):
    sets_completed: Optional[int] = None
    reps_completed: Optional[int] = None
    weight_used: Optional[float] = None
    notes: Optional[str] = None


class TokenPayload(BaseModel):
    user_id: int
    email: str
    role: str
    exp: int


class AppWorkoutExercise(BaseModel):
    id: Optional[Union[str, UUID]] = None
    app_workout_uuid: Optional[Union[str, UUID]] = None
    exercise_id: Union[str, UUID]
    duration: Optional[int] = None 
    count: Optional[int] = None  
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    exercise_name: Optional[str] = None
    exercise_description: Optional[str] = None
    gif_uuid: Optional[Union[str, UUID]] = None
    muscle_group_name: Optional[str] = None
    muscle_group_id: Optional[int] = None
    
    order: Optional[int] = None

    class Config:
        from_attributes = True


class AppWorkoutExerciseCreate(BaseModel):
    exercise_id: Union[str, UUID]
    duration: Optional[int] = None
    count: Optional[int] = None


class AppWorkout(BaseModel):
    app_workout_uuid: Optional[Union[str, UUID]] = None
    name: str
    description: Optional[str] = None
    created_by: Optional[int] = None
    exercises: Optional[List[AppWorkoutExercise]] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # Информация о последней сессии тренировки пользователя
    last_session_uuid: Optional[Union[str, UUID]] = None
    last_session_start: Optional[datetime] = None
    last_session_stop: Optional[datetime] = None
    last_session_status: Optional[str] = None
    # Информация о последнем упражнении в тренировке
    last_exercise_session_uuid: Optional[Union[str, UUID]] = None
    last_exercise_start: Optional[datetime] = None
    last_exercise_stop: Optional[datetime] = None
    last_exercise_status: Optional[str] = None
    # Суммарное время тренировки (в секундах)
    total_workout_time: Optional[int] = None
    # Флаг видимости тренировки для других пользователей
    is_visible: bool = False

    class Config:
        from_attributes = True


class AppWorkoutCreate(BaseModel):
    name: str
    description: Optional[str] = None
    exercises: List[AppWorkoutExerciseCreate]
    is_visible: bool = False


class AppWorkoutUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    exercises: Optional[List[AppWorkoutExerciseCreate]] = None
    is_visible: Optional[bool] = None


class UserActivity(BaseModel):
    record_date: date
    workout_count: int = 0
    weight: Optional[float] = None
    last_workout_uuid: Optional[Union[str, UUID]] = None

    class Config:
        from_attributes = True


class UserActivityRequest(BaseModel):
    start_date: date
    end_date: date


class WorkoutProgress(BaseModel):
    workout_uuid: Optional[Union[str, UUID]] = None
    workout_session_uuid: Union[str, UUID]
    status: str  # "start" или "ended"
    datetime_start: Optional[datetime] = None
    datetime_end: Optional[datetime] = None
    exercise_uuid: Optional[Union[str, UUID]] = None  # UUID упражнения (для отслеживания отдельных упражнений)
    exercise_session_uuid: Optional[Union[str, UUID]] = None  # UUID сессии упражнения (для отслеживания конкретного выполнения)
    duration: Optional[int] = None      # Заданная длительность упражнения в секундах
    user_duration: Optional[int] = None # Фактически выполненная длительность упражнения в секундах
    count: Optional[int] = None         # Заданное количество повторений
    user_count: Optional[int] = None    # Фактически выполненное количество повторений
