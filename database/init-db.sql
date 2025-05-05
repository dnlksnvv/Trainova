-- Скрипт инициализации базы данных
-- Этот файл выполняется автоматически при запуске контейнера PostgreSQL

-- Создание функции для добавления столбца, если он не существует
CREATE OR REPLACE FUNCTION add_column_if_not_exists(
    _table_name text, _column_name text, _column_type text, _default_value text DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    _temp text;
BEGIN
    -- Проверяем существование столбца
    SELECT column_name INTO _temp
    FROM information_schema.columns
    WHERE table_name = _table_name AND column_name = _column_name;
    
    -- Если столбец не существует, добавляем его
    IF _temp IS NULL THEN
        IF _default_value IS NULL THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', _table_name, _column_name, _column_type);
        ELSE
            EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s DEFAULT %s', _table_name, _column_name, _column_type, _default_value);
        END IF;
        RAISE NOTICE 'Столбец %.% успешно добавлен', _table_name, _column_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Создание функции для проверки лишних столбцов в таблице
CREATE OR REPLACE FUNCTION check_extra_columns(
    _table_name text, _expected_columns text[]
) RETURNS VOID AS $$
DECLARE
    _col record;
BEGIN
    FOR _col IN 
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = _table_name
    LOOP
        IF NOT (_col.column_name = ANY(_expected_columns)) THEN
            RAISE WARNING 'Предупреждение: столбец %.% существует в базе, но отсутствует в определении схемы', 
                _table_name, _col.column_name;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role_id INT DEFAULT 2,
    is_verified BOOLEAN DEFAULT FALSE,
    avatar_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу users
SELECT add_column_if_not_exists('users', 'id', 'SERIAL PRIMARY KEY');
SELECT add_column_if_not_exists('users', 'email', 'VARCHAR(255) UNIQUE NOT NULL');
SELECT add_column_if_not_exists('users', 'password_hash', 'VARCHAR(255) NOT NULL');
SELECT add_column_if_not_exists('users', 'first_name', 'VARCHAR(100)');
SELECT add_column_if_not_exists('users', 'last_name', 'VARCHAR(100)');
SELECT add_column_if_not_exists('users', 'role_id', 'INT', '2');
SELECT add_column_if_not_exists('users', 'is_verified', 'BOOLEAN', 'FALSE');
SELECT add_column_if_not_exists('users', 'avatar_url', 'VARCHAR(255)');
SELECT add_column_if_not_exists('users', 'created_at', 'TIMESTAMP', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице users
SELECT check_extra_columns('users', ARRAY['id', 'email', 'password_hash', 'first_name', 'last_name', 'role_id', 'is_verified', 'avatar_url', 'created_at']);

-- Таблица кодов верификации
CREATE TABLE IF NOT EXISTS verification_codes (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    verification_code VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу verification_codes
SELECT add_column_if_not_exists('verification_codes', 'id', 'SERIAL PRIMARY KEY');
SELECT add_column_if_not_exists('verification_codes', 'user_id', 'INT REFERENCES users(id) ON DELETE CASCADE');
SELECT add_column_if_not_exists('verification_codes', 'verification_code', 'VARCHAR(10) NOT NULL');
SELECT add_column_if_not_exists('verification_codes', 'created_at', 'TIMESTAMP', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице verification_codes
SELECT check_extra_columns('verification_codes', ARRAY['id', 'user_id', 'verification_code', 'created_at']);

-- Таблица кодов сброса пароля
CREATE TABLE IF NOT EXISTS reset_codes (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    reset_code VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу reset_codes
SELECT add_column_if_not_exists('reset_codes', 'id', 'SERIAL PRIMARY KEY');
SELECT add_column_if_not_exists('reset_codes', 'user_id', 'INT REFERENCES users(id) ON DELETE CASCADE');
SELECT add_column_if_not_exists('reset_codes', 'reset_code', 'VARCHAR(10) NOT NULL');
SELECT add_column_if_not_exists('reset_codes', 'created_at', 'TIMESTAMP', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице reset_codes
SELECT check_extra_columns('reset_codes', ARRAY['id', 'user_id', 'reset_code', 'created_at']);

-- Таблица кодов смены email
CREATE TABLE IF NOT EXISTS email_change_codes (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    new_email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу email_change_codes
SELECT add_column_if_not_exists('email_change_codes', 'id', 'SERIAL PRIMARY KEY');
SELECT add_column_if_not_exists('email_change_codes', 'user_id', 'INT REFERENCES users(id) ON DELETE CASCADE');
SELECT add_column_if_not_exists('email_change_codes', 'new_email', 'VARCHAR(255) NOT NULL');
SELECT add_column_if_not_exists('email_change_codes', 'code', 'VARCHAR(10) NOT NULL');
SELECT add_column_if_not_exists('email_change_codes', 'created_at', 'TIMESTAMP', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице email_change_codes
SELECT check_extra_columns('email_change_codes', ARRAY['id', 'user_id', 'new_email', 'code', 'created_at']);

-- Таблица версий паролей пользователей
CREATE TABLE IF NOT EXISTS password_versions (
    user_id INT REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
    version INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу password_versions
SELECT add_column_if_not_exists('password_versions', 'user_id', 'INT REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY');
SELECT add_column_if_not_exists('password_versions', 'version', 'INT NOT NULL', '0');
SELECT add_column_if_not_exists('password_versions', 'created_at', 'TIMESTAMP', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице password_versions
SELECT check_extra_columns('password_versions', ARRAY['user_id', 'version', 'created_at']);

-- Таблица отозванных токенов (черный список)
CREATE TABLE IF NOT EXISTS blacklisted_tokens (
    id SERIAL PRIMARY KEY,
    token TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    CONSTRAINT unique_token UNIQUE (token)
);

-- Проверка и добавление недостающих столбцов в таблицу blacklisted_tokens
SELECT add_column_if_not_exists('blacklisted_tokens', 'id', 'SERIAL PRIMARY KEY');
SELECT add_column_if_not_exists('blacklisted_tokens', 'token', 'TEXT NOT NULL');
SELECT add_column_if_not_exists('blacklisted_tokens', 'created_at', 'TIMESTAMP', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('blacklisted_tokens', 'expires_at', 'TIMESTAMP NOT NULL');

-- Проверка лишних столбцов в таблице blacklisted_tokens
SELECT check_extra_columns('blacklisted_tokens', ARRAY['id', 'token', 'created_at', 'expires_at']);

-- Таблица групп мышц
CREATE TABLE IF NOT EXISTS muscle_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу muscle_groups
SELECT add_column_if_not_exists('muscle_groups', 'id', 'SERIAL PRIMARY KEY');
SELECT add_column_if_not_exists('muscle_groups', 'name', 'VARCHAR(100) UNIQUE NOT NULL');
SELECT add_column_if_not_exists('muscle_groups', 'description', 'TEXT');
SELECT add_column_if_not_exists('muscle_groups', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('muscle_groups', 'updated_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице muscle_groups
SELECT check_extra_columns('muscle_groups', ARRAY['id', 'name', 'description', 'created_at', 'updated_at']);

-- Таблица упражнений
CREATE TABLE IF NOT EXISTS exercises (
    exercise_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), 
    muscle_group_id INT NOT NULL REFERENCES muscle_groups(id) ON DELETE RESTRICT, 
    title VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    gif_uuid UUID, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу exercises
SELECT add_column_if_not_exists('exercises', 'exercise_id', 'UUID PRIMARY KEY', 'gen_random_uuid()');
SELECT add_column_if_not_exists('exercises', 'muscle_group_id', 'INT NOT NULL REFERENCES muscle_groups(id) ON DELETE RESTRICT');
SELECT add_column_if_not_exists('exercises', 'title', 'VARCHAR(50) NOT NULL');
SELECT add_column_if_not_exists('exercises', 'description', 'VARCHAR(255)');
SELECT add_column_if_not_exists('exercises', 'gif_uuid', 'UUID');
SELECT add_column_if_not_exists('exercises', 'created_at', 'TIMESTAMP', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('exercises', 'updated_at', 'TIMESTAMP', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице exercises
SELECT check_extra_columns('exercises', ARRAY['exercise_id', 'muscle_group_id', 'title', 'description', 'gif_uuid', 'created_at', 'updated_at']);

-- Таблица тренировок
CREATE TABLE IF NOT EXISTS app_workouts (
    app_workout_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(25) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_visible BOOLEAN DEFAULT FALSE
);

-- Проверка и добавление недостающих столбцов в таблицу app_workouts
SELECT add_column_if_not_exists('app_workouts', 'app_workout_uuid', 'UUID PRIMARY KEY', 'gen_random_uuid()');
SELECT add_column_if_not_exists('app_workouts', 'name', 'VARCHAR(25) NOT NULL');
SELECT add_column_if_not_exists('app_workouts', 'description', 'VARCHAR(255)');
SELECT add_column_if_not_exists('app_workouts', 'created_at', 'TIMESTAMP', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('app_workouts', 'updated_at', 'TIMESTAMP', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('app_workouts', 'is_visible', 'BOOLEAN', 'FALSE');

-- Проверка лишних столбцов в таблице app_workouts
SELECT check_extra_columns('app_workouts', ARRAY['app_workout_uuid', 'name', 'description', 'created_at', 'updated_at', 'is_visible']);

-- Таблица упражнений в тренировке
CREATE TABLE IF NOT EXISTS app_workout_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_workout_uuid UUID NOT NULL REFERENCES app_workouts(app_workout_uuid) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(exercise_id) ON DELETE RESTRICT,
    duration INT, 
    count INT, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу app_workout_exercises
SELECT add_column_if_not_exists('app_workout_exercises', 'id', 'UUID PRIMARY KEY', 'gen_random_uuid()');
SELECT add_column_if_not_exists('app_workout_exercises', 'app_workout_uuid', 'UUID NOT NULL REFERENCES app_workouts(app_workout_uuid) ON DELETE CASCADE');
SELECT add_column_if_not_exists('app_workout_exercises', 'exercise_id', 'UUID NOT NULL REFERENCES exercises(exercise_id) ON DELETE RESTRICT');
SELECT add_column_if_not_exists('app_workout_exercises', 'duration', 'INT');
SELECT add_column_if_not_exists('app_workout_exercises', 'count', 'INT');
SELECT add_column_if_not_exists('app_workout_exercises', 'created_at', 'TIMESTAMP', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('app_workout_exercises', 'updated_at', 'TIMESTAMP', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице app_workout_exercises
SELECT check_extra_columns('app_workout_exercises', ARRAY['id', 'app_workout_uuid', 'exercise_id', 'duration', 'count', 'created_at', 'updated_at']);

-- Таблица активности пользователей
CREATE TABLE IF NOT EXISTS user_activities (
    user_id INT NOT NULL,
    record_date DATE NOT NULL,
    workout_count INT DEFAULT 0,
    last_workout_uuid UUID,
    PRIMARY KEY (user_id, record_date)
);

-- Проверка и добавление недостающих столбцов в таблицу user_activities
SELECT add_column_if_not_exists('user_activities', 'user_id', 'INT NOT NULL');
SELECT add_column_if_not_exists('user_activities', 'record_date', 'DATE NOT NULL');
SELECT add_column_if_not_exists('user_activities', 'workout_count', 'INT', '0');
SELECT add_column_if_not_exists('user_activities', 'last_workout_uuid', 'UUID');

-- Проверка лишних столбцов в таблице user_activities
SELECT check_extra_columns('user_activities', ARRAY['user_id', 'record_date', 'workout_count', 'last_workout_uuid']);

-- Таблица весов пользователей
CREATE TABLE IF NOT EXISTS user_weights (
    user_id INT NOT NULL,
    record_date DATE NOT NULL,
    weight DECIMAL(5,2) NOT NULL,
    PRIMARY KEY (user_id, record_date)
);

-- Проверка и добавление недостающих столбцов в таблицу user_weights
SELECT add_column_if_not_exists('user_weights', 'user_id', 'INT NOT NULL');
SELECT add_column_if_not_exists('user_weights', 'record_date', 'DATE NOT NULL');
SELECT add_column_if_not_exists('user_weights', 'weight', 'DECIMAL(5,2) NOT NULL');

-- Проверка лишних столбцов в таблице user_weights
SELECT check_extra_columns('user_weights', ARRAY['user_id', 'record_date', 'weight']);

-- Таблица сессий тренировок пользователей
CREATE TABLE IF NOT EXISTS user_workout_sessions (
    workout_session_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INT NOT NULL,
    workout_uuid UUID NOT NULL,
    datetime_start TIMESTAMP WITH TIME ZONE NOT NULL,
    datetime_stop TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'in_process',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу user_workout_sessions
SELECT add_column_if_not_exists('user_workout_sessions', 'workout_session_uuid', 'UUID PRIMARY KEY', 'gen_random_uuid()');
SELECT add_column_if_not_exists('user_workout_sessions', 'user_id', 'INT NOT NULL');
SELECT add_column_if_not_exists('user_workout_sessions', 'workout_uuid', 'UUID NOT NULL');
SELECT add_column_if_not_exists('user_workout_sessions', 'datetime_start', 'TIMESTAMP WITH TIME ZONE NOT NULL');
SELECT add_column_if_not_exists('user_workout_sessions', 'datetime_stop', 'TIMESTAMP WITH TIME ZONE');
SELECT add_column_if_not_exists('user_workout_sessions', 'status', 'VARCHAR(20) NOT NULL', '''in_process''');
SELECT add_column_if_not_exists('user_workout_sessions', 'created_at', 'TIMESTAMP', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('user_workout_sessions', 'updated_at', 'TIMESTAMP', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице user_workout_sessions
SELECT check_extra_columns('user_workout_sessions', ARRAY['workout_session_uuid', 'user_id', 'workout_uuid', 'datetime_start', 'datetime_stop', 'status', 'created_at', 'updated_at']);

-- Таблица упражнений в рамках сессии тренировки
CREATE TABLE IF NOT EXISTS user_exercise_sessions (
    exercise_session_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_session_uuid UUID NOT NULL REFERENCES user_workout_sessions(workout_session_uuid) ON DELETE CASCADE,
    user_id INT NOT NULL,
    exercise_uuid UUID NOT NULL,
    datetime_start TIMESTAMP WITH TIME ZONE,
    datetime_end TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'in_process',
    duration INTEGER,
    user_duration INTEGER,
    count INTEGER,
    user_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу user_exercise_sessions
SELECT add_column_if_not_exists('user_exercise_sessions', 'exercise_session_uuid', 'UUID PRIMARY KEY', 'gen_random_uuid()');
SELECT add_column_if_not_exists('user_exercise_sessions', 'workout_session_uuid', 'UUID NOT NULL REFERENCES user_workout_sessions(workout_session_uuid) ON DELETE CASCADE');
SELECT add_column_if_not_exists('user_exercise_sessions', 'user_id', 'INT NOT NULL');
SELECT add_column_if_not_exists('user_exercise_sessions', 'exercise_uuid', 'UUID NOT NULL');
SELECT add_column_if_not_exists('user_exercise_sessions', 'datetime_start', 'TIMESTAMP WITH TIME ZONE');
SELECT add_column_if_not_exists('user_exercise_sessions', 'datetime_end', 'TIMESTAMP WITH TIME ZONE');
SELECT add_column_if_not_exists('user_exercise_sessions', 'status', 'VARCHAR(20) NOT NULL', '''in_process''');
SELECT add_column_if_not_exists('user_exercise_sessions', 'duration', 'INTEGER');
SELECT add_column_if_not_exists('user_exercise_sessions', 'user_duration', 'INTEGER');
SELECT add_column_if_not_exists('user_exercise_sessions', 'count', 'INTEGER');
SELECT add_column_if_not_exists('user_exercise_sessions', 'user_count', 'INTEGER');
SELECT add_column_if_not_exists('user_exercise_sessions', 'created_at', 'TIMESTAMP', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('user_exercise_sessions', 'updated_at', 'TIMESTAMP', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице user_exercise_sessions
SELECT check_extra_columns('user_exercise_sessions', ARRAY['exercise_session_uuid', 'workout_session_uuid', 'user_id', 'exercise_uuid', 'datetime_start', 'datetime_end', 'status', 'duration', 'user_duration', 'count', 'user_count', 'created_at', 'updated_at']);

-- Комментарии к полям статистики упражнений для документации схемы
COMMENT ON COLUMN user_exercise_sessions.duration IS 'Заданная длительность упражнения в секундах';
COMMENT ON COLUMN user_exercise_sessions.user_duration IS 'Фактически выполненная длительность упражнения в секундах';
COMMENT ON COLUMN user_exercise_sessions.count IS 'Заданное количество повторений';
COMMENT ON COLUMN user_exercise_sessions.user_count IS 'Фактически выполненное количество повторений';

-- Создание индексов
CREATE INDEX IF NOT EXISTS idx_usersemail_ ON users(email);
CREATE INDEX IF NOT EXISTS idx_verification_codes_user_id ON verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_codes_user_id ON reset_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_email_change_codes_user_id ON email_change_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_exercises_muscle_group_id ON exercises(muscle_group_id);
CREATE INDEX IF NOT EXISTS idx_app_workout_exercises_app_workout_uuid ON app_workout_exercises(app_workout_uuid);
CREATE INDEX IF NOT EXISTS idx_app_workout_exercises_exercise_id ON app_workout_exercises(exercise_id);
CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_expires_at ON blacklisted_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_record_date ON user_activities(record_date);
CREATE INDEX IF NOT EXISTS idx_user_weights_user_id ON user_weights(user_id);
CREATE INDEX IF NOT EXISTS idx_user_weights_record_date ON user_weights(record_date);
CREATE INDEX IF NOT EXISTS idx_user_workout_sessions_user_id ON user_workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_workout_sessions_workout_uuid ON user_workout_sessions(workout_uuid);
CREATE INDEX IF NOT EXISTS idx_user_workout_sessions_status ON user_workout_sessions(status);
CREATE INDEX IF NOT EXISTS idx_user_exercise_sessions_workout_session_uuid ON user_exercise_sessions(workout_session_uuid);
CREATE INDEX IF NOT EXISTS idx_user_exercise_sessions_user_id ON user_exercise_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_exercise_sessions_exercise_uuid ON user_exercise_sessions(exercise_uuid);
CREATE INDEX IF NOT EXISTS idx_user_exercise_sessions_status ON user_exercise_sessions(status); 