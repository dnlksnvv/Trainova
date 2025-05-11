"""
Константы для работы с базой данных.
Содержит имена таблиц и полей, используемых в приложении.
"""

# Имена таблиц
TRAININGS_TABLE = "trainings"
EXERCISES_TABLE = "exercises"
TRAINING_EXERCISES_TABLE = "training_exercises"
USER_TRAININGS_TABLE = "user_trainings"
USER_PROGRESS_TABLE = "user_progress"
MUSCLE_GROUPS_TABLE = "muscle_groups"

# Поля таблицы групп мышц
MUSCLE_GROUP_ID = "id"
MUSCLE_GROUP_NAME = "name"
MUSCLE_GROUP_DESCRIPTION = "description"
MUSCLE_GROUP_CREATED_AT = "created_at"
MUSCLE_GROUP_UPDATED_AT = "updated_at"

# Поля таблицы тренировок
TRAINING_ID = "id"
TRAINING_NAME = "name"
TRAINING_DESCRIPTION = "description"
TRAINING_DIFFICULTY = "difficulty"
TRAINING_DURATION = "duration"
TRAINING_CREATED_BY = "created_by"
TRAINING_IS_PUBLIC = "is_public"
TRAINING_CREATED_AT = "created_at"
TRAINING_UPDATED_AT = "updated_at"

# Поля таблицы упражнений
EXERCISE_ID = "id"
EXERCISE_NAME = "name"
EXERCISE_TITLE = "title"
EXERCISE_DESCRIPTION = "description"
EXERCISE_MUSCLE_GROUP = "muscle_group"
EXERCISE_MUSCLE_GROUP_ID = "muscle_group_id"
EXERCISE_IMAGE_URL = "image_url"
EXERCISE_VIDEO_URL = "video_url"
EXERCISE_CREATED_AT = "created_at"
EXERCISE_UPDATED_AT = "updated_at"

# Поля связной таблицы  тренировка-упражнение
TRAINING_EXERCISE_ID = "id"
TRAINING_EXERCISE_TRAINING_ID = "training_id"
TRAINING_EXERCISE_EXERCISE_ID = "exercise_id"
TRAINING_EXERCISE_SETS = "sets"
TRAINING_EXERCISE_REPS = "reps"
TRAINING_EXERCISE_WEIGHT = "weight"
TRAINING_EXERCISE_REST_TIME = "rest_time"
TRAINING_EXERCISE_ORDER = "exercise_order"

# Поля таблицы тренировок пользователя
USER_TRAINING_ID = "id"
USER_TRAINING_USER_ID = "user_id"
USER_TRAINING_TRAINING_ID = "training_id"
USER_TRAINING_STATUS = "status"
USER_TRAINING_FAVORITE = "is_favorite"
USER_TRAINING_STARTED_AT = "started_at"
USER_TRAINING_COMPLETED_AT = "completed_at"

# Поля таблицы прогресса пользователя
USER_PROGRESS_ID = "id"
USER_PROGRESS_USER_ID = "user_id"
USER_PROGRESS_TRAINING_ID = "training_id"
USER_PROGRESS_EXERCISE_ID = "exercise_id"
USER_PROGRESS_SETS_COMPLETED = "sets_completed"
USER_PROGRESS_REPS_COMPLETED = "reps_completed"
USER_PROGRESS_WEIGHT_USED = "weight_used"
USER_PROGRESS_DATE = "date"
USER_PROGRESS_NOTES = "notes"
