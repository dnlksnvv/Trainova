-- Скрипт инициализации базы данных
-- Этот файл выполняется автоматически при запуске контейнера PostgreSQL

-- Устанавливаем часовой пояс UTC для базы данных
SET timezone = 'UTC';

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
    description TEXT,
    role_id INT DEFAULT 2,
    is_verified BOOLEAN DEFAULT FALSE,
    avatar_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу users
SELECT add_column_if_not_exists('users', 'id', 'SERIAL PRIMARY KEY');
SELECT add_column_if_not_exists('users', 'email', 'VARCHAR(255) UNIQUE NOT NULL');
SELECT add_column_if_not_exists('users', 'password_hash', 'VARCHAR(255) NOT NULL');
SELECT add_column_if_not_exists('users', 'first_name', 'VARCHAR(100)');
SELECT add_column_if_not_exists('users', 'last_name', 'VARCHAR(100)');
SELECT add_column_if_not_exists('users', 'description', 'TEXT');
SELECT add_column_if_not_exists('users', 'role_id', 'INT', '2');
SELECT add_column_if_not_exists('users', 'is_verified', 'BOOLEAN', 'FALSE');
SELECT add_column_if_not_exists('users', 'avatar_url', 'VARCHAR(255)');
SELECT add_column_if_not_exists('users', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице users
SELECT check_extra_columns('users', ARRAY['id', 'email', 'password_hash', 'first_name', 'last_name', 'description', 'role_id', 'is_verified', 'avatar_url', 'created_at']);

-- Таблица кодов верификации
CREATE TABLE IF NOT EXISTS verification_codes (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    verification_code VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу verification_codes
SELECT add_column_if_not_exists('verification_codes', 'id', 'SERIAL PRIMARY KEY');
SELECT add_column_if_not_exists('verification_codes', 'user_id', 'INT REFERENCES users(id) ON DELETE CASCADE');
SELECT add_column_if_not_exists('verification_codes', 'verification_code', 'VARCHAR(10) NOT NULL');
SELECT add_column_if_not_exists('verification_codes', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице verification_codes
SELECT check_extra_columns('verification_codes', ARRAY['id', 'user_id', 'verification_code', 'created_at']);

-- Таблица кодов сброса пароля
CREATE TABLE IF NOT EXISTS reset_codes (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    reset_code VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу reset_codes
SELECT add_column_if_not_exists('reset_codes', 'id', 'SERIAL PRIMARY KEY');
SELECT add_column_if_not_exists('reset_codes', 'user_id', 'INT REFERENCES users(id) ON DELETE CASCADE');
SELECT add_column_if_not_exists('reset_codes', 'reset_code', 'VARCHAR(10) NOT NULL');
SELECT add_column_if_not_exists('reset_codes', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице reset_codes
SELECT check_extra_columns('reset_codes', ARRAY['id', 'user_id', 'reset_code', 'created_at']);

-- Таблица кодов смены email
CREATE TABLE IF NOT EXISTS email_change_codes (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    new_email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу email_change_codes
SELECT add_column_if_not_exists('email_change_codes', 'id', 'SERIAL PRIMARY KEY');
SELECT add_column_if_not_exists('email_change_codes', 'user_id', 'INT REFERENCES users(id) ON DELETE CASCADE');
SELECT add_column_if_not_exists('email_change_codes', 'new_email', 'VARCHAR(255) NOT NULL');
SELECT add_column_if_not_exists('email_change_codes', 'code', 'VARCHAR(10) NOT NULL');
SELECT add_column_if_not_exists('email_change_codes', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице email_change_codes
SELECT check_extra_columns('email_change_codes', ARRAY['id', 'user_id', 'new_email', 'code', 'created_at']);

-- Таблица версий паролей пользователей
CREATE TABLE IF NOT EXISTS password_versions (
    user_id INT REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
    version INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу password_versions
SELECT add_column_if_not_exists('password_versions', 'user_id', 'INT REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY');
SELECT add_column_if_not_exists('password_versions', 'version', 'INT NOT NULL', '0');
SELECT add_column_if_not_exists('password_versions', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице password_versions
SELECT check_extra_columns('password_versions', ARRAY['user_id', 'version', 'created_at']);

-- Таблица отозванных токенов (черный список)
CREATE TABLE IF NOT EXISTS blacklisted_tokens (
    id SERIAL PRIMARY KEY,
    token TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT unique_token UNIQUE (token)
);

-- Проверка и добавление недостающих столбцов в таблицу blacklisted_tokens
SELECT add_column_if_not_exists('blacklisted_tokens', 'id', 'SERIAL PRIMARY KEY');
SELECT add_column_if_not_exists('blacklisted_tokens', 'token', 'TEXT NOT NULL');
SELECT add_column_if_not_exists('blacklisted_tokens', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('blacklisted_tokens', 'expires_at', 'TIMESTAMP WITH TIME ZONE NOT NULL');

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу exercises
SELECT add_column_if_not_exists('exercises', 'exercise_id', 'UUID PRIMARY KEY', 'gen_random_uuid()');
SELECT add_column_if_not_exists('exercises', 'muscle_group_id', 'INT NOT NULL REFERENCES muscle_groups(id) ON DELETE RESTRICT');
SELECT add_column_if_not_exists('exercises', 'title', 'VARCHAR(50) NOT NULL');
SELECT add_column_if_not_exists('exercises', 'description', 'VARCHAR(255)');
SELECT add_column_if_not_exists('exercises', 'gif_uuid', 'UUID');
SELECT add_column_if_not_exists('exercises', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('exercises', 'updated_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице exercises
SELECT check_extra_columns('exercises', ARRAY['exercise_id', 'muscle_group_id', 'title', 'description', 'gif_uuid', 'created_at', 'updated_at']);

-- Таблица тренировок
CREATE TABLE IF NOT EXISTS app_workouts (
    app_workout_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(25) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_visible BOOLEAN DEFAULT FALSE
);

-- Проверка и добавление недостающих столбцов в таблицу app_workouts
SELECT add_column_if_not_exists('app_workouts', 'app_workout_uuid', 'UUID PRIMARY KEY', 'gen_random_uuid()');
SELECT add_column_if_not_exists('app_workouts', 'name', 'VARCHAR(25) NOT NULL');
SELECT add_column_if_not_exists('app_workouts', 'description', 'VARCHAR(255)');
SELECT add_column_if_not_exists('app_workouts', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('app_workouts', 'updated_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу app_workout_exercises
SELECT add_column_if_not_exists('app_workout_exercises', 'id', 'UUID PRIMARY KEY', 'gen_random_uuid()');
SELECT add_column_if_not_exists('app_workout_exercises', 'app_workout_uuid', 'UUID NOT NULL REFERENCES app_workouts(app_workout_uuid) ON DELETE CASCADE');
SELECT add_column_if_not_exists('app_workout_exercises', 'exercise_id', 'UUID NOT NULL REFERENCES exercises(exercise_id) ON DELETE RESTRICT');
SELECT add_column_if_not_exists('app_workout_exercises', 'duration', 'INT');
SELECT add_column_if_not_exists('app_workout_exercises', 'count', 'INT');
SELECT add_column_if_not_exists('app_workout_exercises', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('app_workout_exercises', 'updated_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу user_workout_sessions
SELECT add_column_if_not_exists('user_workout_sessions', 'workout_session_uuid', 'UUID PRIMARY KEY', 'gen_random_uuid()');
SELECT add_column_if_not_exists('user_workout_sessions', 'user_id', 'INT NOT NULL');
SELECT add_column_if_not_exists('user_workout_sessions', 'workout_uuid', 'UUID NOT NULL');
SELECT add_column_if_not_exists('user_workout_sessions', 'datetime_start', 'TIMESTAMP WITH TIME ZONE NOT NULL');
SELECT add_column_if_not_exists('user_workout_sessions', 'datetime_stop', 'TIMESTAMP WITH TIME ZONE');
SELECT add_column_if_not_exists('user_workout_sessions', 'status', 'VARCHAR(20) NOT NULL', '''in_process''');
SELECT add_column_if_not_exists('user_workout_sessions', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('user_workout_sessions', 'updated_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
SELECT add_column_if_not_exists('user_exercise_sessions', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('user_exercise_sessions', 'updated_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице user_exercise_sessions
SELECT check_extra_columns('user_exercise_sessions', ARRAY['exercise_session_uuid', 'workout_session_uuid', 'user_id', 'exercise_uuid', 'datetime_start', 'datetime_end', 'status', 'duration', 'user_duration', 'count', 'user_count', 'created_at', 'updated_at']);

-- Комментарии к полям статистики упражнений для документации схемы
COMMENT ON COLUMN user_exercise_sessions.duration IS 'Заданная длительность упражнения в секундах';
COMMENT ON COLUMN user_exercise_sessions.user_duration IS 'Фактически выполненная длительность упражнения в секундах';
COMMENT ON COLUMN user_exercise_sessions.count IS 'Заданное количество повторений';
COMMENT ON COLUMN user_exercise_sessions.user_count IS 'Фактически выполненное количество повторений';

-- Таблица подписок
CREATE TABLE IF NOT EXISTS subscriptions (
    subscription_uuid VARCHAR(50) PRIMARY KEY,
    user_id INT NOT NULL,
    course_id VARCHAR(36) NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    recurring BOOLEAN DEFAULT FALSE,
    payment_id VARCHAR(36),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу subscriptions
SELECT add_column_if_not_exists('subscriptions', 'subscription_uuid', 'VARCHAR(50) PRIMARY KEY');
SELECT add_column_if_not_exists('subscriptions', 'user_id', 'INT NOT NULL');
SELECT add_column_if_not_exists('subscriptions', 'course_id', 'VARCHAR(36) NOT NULL');
SELECT add_column_if_not_exists('subscriptions', 'course_name', 'VARCHAR(255) NOT NULL');
SELECT add_column_if_not_exists('subscriptions', 'start_date', 'TIMESTAMP WITH TIME ZONE NOT NULL');
SELECT add_column_if_not_exists('subscriptions', 'end_date', 'TIMESTAMP WITH TIME ZONE');
SELECT add_column_if_not_exists('subscriptions', 'status', 'VARCHAR(20) NOT NULL');
SELECT add_column_if_not_exists('subscriptions', 'price', 'DECIMAL(10, 2) NOT NULL');
SELECT add_column_if_not_exists('subscriptions', 'recurring', 'BOOLEAN', 'FALSE');
SELECT add_column_if_not_exists('subscriptions', 'payment_id', 'VARCHAR(36)');
SELECT add_column_if_not_exists('subscriptions', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('subscriptions', 'updated_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице subscriptions
SELECT check_extra_columns('subscriptions', ARRAY['subscription_uuid', 'user_id', 'course_id', 'course_name', 'start_date', 'end_date', 'status', 'price', 'recurring', 'payment_id', 'created_at', 'updated_at']);

-- Таблица платежей
CREATE TABLE IF NOT EXISTS payments (
    payment_id VARCHAR(36) PRIMARY KEY,
    user_id INT NOT NULL,
    course_id VARCHAR(36) NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    payment_method_id VARCHAR(100),
    confirmation_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу payments
SELECT add_column_if_not_exists('payments', 'payment_id', 'VARCHAR(36) PRIMARY KEY');
SELECT add_column_if_not_exists('payments', 'user_id', 'INT NOT NULL');
SELECT add_column_if_not_exists('payments', 'course_id', 'VARCHAR(36) NOT NULL');
SELECT add_column_if_not_exists('payments', 'course_name', 'VARCHAR(255) NOT NULL');
SELECT add_column_if_not_exists('payments', 'payment_date', 'TIMESTAMP WITH TIME ZONE');
SELECT add_column_if_not_exists('payments', 'amount', 'DECIMAL(10, 2) NOT NULL');
SELECT add_column_if_not_exists('payments', 'status', 'VARCHAR(20) NOT NULL');
SELECT add_column_if_not_exists('payments', 'payment_method_id', 'VARCHAR(100)');
SELECT add_column_if_not_exists('payments', 'confirmation_url', 'TEXT');
SELECT add_column_if_not_exists('payments', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('payments', 'updated_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице payments
SELECT check_extra_columns('payments', ARRAY['payment_id', 'user_id', 'course_id', 'course_name', 'payment_date', 'amount', 'status', 'payment_method_id', 'confirmation_url', 'created_at', 'updated_at']);

-- Таблица методов оплаты
CREATE TABLE IF NOT EXISTS payment_methods (
    payment_method_id VARCHAR(100) PRIMARY KEY,
    user_id INT NOT NULL,
    method_type VARCHAR(50) NOT NULL,
    is_saved BOOLEAN DEFAULT TRUE,
    title VARCHAR(100),
    card_last4 VARCHAR(4),
    card_type VARCHAR(50),
    card_expiry_month VARCHAR(2),
    card_expiry_year VARCHAR(4),
    issuer_country VARCHAR(2),
    is_default BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу payment_methods
SELECT add_column_if_not_exists('payment_methods', 'payment_method_id', 'VARCHAR(100) PRIMARY KEY');
SELECT add_column_if_not_exists('payment_methods', 'user_id', 'INT NOT NULL');
SELECT add_column_if_not_exists('payment_methods', 'method_type', 'VARCHAR(50) NOT NULL');
SELECT add_column_if_not_exists('payment_methods', 'is_saved', 'BOOLEAN', 'TRUE');
SELECT add_column_if_not_exists('payment_methods', 'title', 'VARCHAR(100)');
SELECT add_column_if_not_exists('payment_methods', 'card_last4', 'VARCHAR(4)');
SELECT add_column_if_not_exists('payment_methods', 'card_type', 'VARCHAR(50)');
SELECT add_column_if_not_exists('payment_methods', 'card_expiry_month', 'VARCHAR(2)');
SELECT add_column_if_not_exists('payment_methods', 'card_expiry_year', 'VARCHAR(4)');
SELECT add_column_if_not_exists('payment_methods', 'issuer_country', 'VARCHAR(2)');
SELECT add_column_if_not_exists('payment_methods', 'is_default', 'BOOLEAN', 'FALSE');
SELECT add_column_if_not_exists('payment_methods', 'is_verified', 'BOOLEAN', 'FALSE');
SELECT add_column_if_not_exists('payment_methods', 'details', 'JSONB');
SELECT add_column_if_not_exists('payment_methods', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('payment_methods', 'updated_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице payment_methods
SELECT check_extra_columns('payment_methods', ARRAY['payment_method_id', 'user_id', 'method_type', 'is_saved', 'title', 'card_last4', 'card_type', 'card_expiry_month', 'card_expiry_year', 'issuer_country', 'is_default', 'is_verified', 'details', 'created_at', 'updated_at']);

-- Таблица курсов
CREATE TABLE IF NOT EXISTS courses (
    course_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2),
    duration INT, -- Длительность в секундах
    exercise_count INT DEFAULT 0,
    rating DECIMAL(3, 2) DEFAULT 0.0 CHECK (rating >= 0.0 AND rating <= 5.0),
    subscribers_count INT DEFAULT 0,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу courses
SELECT add_column_if_not_exists('courses', 'course_uuid', 'UUID PRIMARY KEY', 'gen_random_uuid()');
SELECT add_column_if_not_exists('courses', 'user_id', 'INT NOT NULL REFERENCES users(id) ON DELETE CASCADE');
SELECT add_column_if_not_exists('courses', 'name', 'VARCHAR(255) NOT NULL');
SELECT add_column_if_not_exists('courses', 'description', 'TEXT');
SELECT add_column_if_not_exists('courses', 'price', 'DECIMAL(10, 2)');
SELECT add_column_if_not_exists('courses', 'duration', 'INT'); -- Длительность в секундах
SELECT add_column_if_not_exists('courses', 'exercise_count', 'INT', '0');
SELECT add_column_if_not_exists('courses', 'rating', 'DECIMAL(3, 2)', '0.0');
SELECT add_column_if_not_exists('courses', 'subscribers_count', 'INT', '0');
SELECT add_column_if_not_exists('courses', 'is_published', 'BOOLEAN', 'FALSE');
SELECT add_column_if_not_exists('courses', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('courses', 'updated_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице courses
SELECT check_extra_columns('courses', ARRAY['course_uuid', 'user_id', 'name', 'description', 'price', 'duration', 'exercise_count', 'rating', 'subscribers_count', 'is_published', 'created_at', 'updated_at']);

-- Миграция поля duration: конвертация из VARCHAR в INT (секунды)
DO $$
DECLARE
    column_type TEXT;
BEGIN
    -- Проверяем текущий тип поля duration
    SELECT data_type INTO column_type
    FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'duration';
    
    -- Если поле существует и имеет тип VARCHAR, конвертируем его в INT
    IF column_type = 'character varying' THEN
        RAISE NOTICE 'Конвертируем поле duration из VARCHAR в INT';
        
        -- Добавляем временное поле
        ALTER TABLE courses ADD COLUMN duration_new INT;
        
        -- Конвертируем данные (примерная конвертация строк в секунды)
        UPDATE courses SET duration_new = CASE
            WHEN duration IS NULL THEN NULL
            WHEN duration ~ '^[0-9]+$' THEN duration::INT * 60  -- Если только цифры, считаем что это минуты
            WHEN duration ILIKE '%час%' OR duration ILIKE '%hour%' THEN 
                CASE 
                    WHEN duration ~ '^[0-9]+' THEN (regexp_replace(duration, '[^0-9]', '', 'g')::INT * 3600)
                    ELSE 3600  -- 1 час по умолчанию
                END
            WHEN duration ILIKE '%мин%' OR duration ILIKE '%min%' THEN 
                CASE 
                    WHEN duration ~ '^[0-9]+' THEN (regexp_replace(duration, '[^0-9]', '', 'g')::INT * 60)
                    ELSE 1800  -- 30 минут по умолчанию
                END
            ELSE 1800  -- 30 минут по умолчанию для неизвестных форматов
        END;
        
        -- Удаляем старое поле
        ALTER TABLE courses DROP COLUMN duration;
        
        -- Переименовываем новое поле
        ALTER TABLE courses RENAME COLUMN duration_new TO duration;
        
        RAISE NOTICE 'Поле duration успешно конвертировано в INT (секунды)';
    ELSIF column_type = 'integer' THEN
        RAISE NOTICE 'Поле duration уже имеет тип INT';
    ELSE
        RAISE NOTICE 'Поле duration не найдено или имеет неожиданный тип: %', column_type;
    END IF;
END
$$;

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

-- Индексы для таблицы subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_course_id ON subscriptions(course_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Индексы для таблицы payments
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Индексы для таблицы payment_methods
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_default ON payment_methods(is_default); 

-- Индексы для таблицы courses
CREATE INDEX IF NOT EXISTS idx_courses_user_id ON courses(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_is_published ON courses(is_published);
CREATE INDEX IF NOT EXISTS idx_courses_rating ON courses(rating);
CREATE INDEX IF NOT EXISTS idx_courses_created_at ON courses(created_at); 

-- Таблица тренировок в курсах
CREATE TABLE IF NOT EXISTS course_workouts (
    course_workout_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_uuid UUID NOT NULL REFERENCES courses(course_uuid) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    video_url VARCHAR(500),
    duration INT, -- Длительность в секундах
    rating DECIMAL(3, 2) DEFAULT 0.0 CHECK (rating >= 0.0 AND rating <= 5.0),
    is_paid BOOLEAN DEFAULT FALSE,
    is_published BOOLEAN DEFAULT FALSE,
    order_index INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу course_workouts
SELECT add_column_if_not_exists('course_workouts', 'course_workout_uuid', 'UUID PRIMARY KEY', 'gen_random_uuid()');
SELECT add_column_if_not_exists('course_workouts', 'course_uuid', 'UUID NOT NULL REFERENCES courses(course_uuid) ON DELETE CASCADE');
SELECT add_column_if_not_exists('course_workouts', 'name', 'VARCHAR(255) NOT NULL');
SELECT add_column_if_not_exists('course_workouts', 'description', 'TEXT');
SELECT add_column_if_not_exists('course_workouts', 'video_url', 'VARCHAR(500)');
SELECT add_column_if_not_exists('course_workouts', 'duration', 'INT');
SELECT add_column_if_not_exists('course_workouts', 'rating', 'DECIMAL(3, 2)', '0.0');
SELECT add_column_if_not_exists('course_workouts', 'is_paid', 'BOOLEAN', 'FALSE');
SELECT add_column_if_not_exists('course_workouts', 'is_published', 'BOOLEAN', 'FALSE');
SELECT add_column_if_not_exists('course_workouts', 'order_index', 'INT NOT NULL', '1');
SELECT add_column_if_not_exists('course_workouts', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('course_workouts', 'updated_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице course_workouts
SELECT check_extra_columns('course_workouts', ARRAY['course_workout_uuid', 'course_uuid', 'name', 'description', 'video_url', 'duration', 'rating', 'is_paid', 'is_published', 'order_index', 'created_at', 'updated_at']);

-- Миграция поля duration: конвертация из VARCHAR в INT (секунды)
DO $$
DECLARE
    column_type TEXT;
BEGIN
    -- Проверяем текущий тип поля duration
    SELECT data_type INTO column_type
    FROM information_schema.columns
    WHERE table_name = 'course_workouts' AND column_name = 'duration';
    
    -- Если поле существует и имеет тип VARCHAR, конвертируем его в INT
    IF column_type = 'character varying' THEN
        RAISE NOTICE 'Конвертируем поле duration из VARCHAR в INT';
        
        -- Добавляем временное поле
        ALTER TABLE course_workouts ADD COLUMN duration_new INT;
        
        -- Конвертируем данные (примерная конвертация строк в секунды)
        UPDATE course_workouts SET duration_new = CASE
            WHEN duration IS NULL THEN NULL
            WHEN duration ~ '^[0-9]+$' THEN duration::INT * 60  -- Если только цифры, считаем что это минуты
            WHEN duration ILIKE '%час%' OR duration ILIKE '%hour%' THEN 
                CASE 
                    WHEN duration ~ '^[0-9]+' THEN (regexp_replace(duration, '[^0-9]', '', 'g')::INT * 3600)
                    ELSE 3600  -- 1 час по умолчанию
                END
            WHEN duration ILIKE '%мин%' OR duration ILIKE '%min%' THEN 
                CASE 
                    WHEN duration ~ '^[0-9]+' THEN (regexp_replace(duration, '[^0-9]', '', 'g')::INT * 60)
                    ELSE 1800  -- 30 минут по умолчанию
                END
            ELSE 1800  -- 30 минут по умолчанию для неизвестных форматов
        END;
        
        -- Удаляем старое поле
        ALTER TABLE course_workouts DROP COLUMN duration;
        
        -- Переименовываем новое поле
        ALTER TABLE course_workouts RENAME COLUMN duration_new TO duration;
        
        RAISE NOTICE 'Поле duration успешно конвертировано в INT (секунды)';
    ELSIF column_type = 'integer' THEN
        RAISE NOTICE 'Поле duration уже имеет тип INT';
    ELSE
        RAISE NOTICE 'Поле duration не найдено или имеет неожиданный тип: %', column_type;
    END IF;
END
$$; 

-- Индексы для таблицы course_workouts
CREATE INDEX IF NOT EXISTS idx_course_workouts_course_uuid ON course_workouts(course_uuid);
CREATE INDEX IF NOT EXISTS idx_course_workouts_is_published ON course_workouts(is_published);
CREATE INDEX IF NOT EXISTS idx_course_workouts_order_index ON course_workouts(order_index);
CREATE INDEX IF NOT EXISTS idx_course_workouts_rating ON course_workouts(rating);
CREATE INDEX IF NOT EXISTS idx_course_workouts_created_at ON course_workouts(created_at); 

-- Таблица оценок тренировок
CREATE TABLE IF NOT EXISTS workout_ratings (
    rating_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_workout_uuid UUID NOT NULL REFERENCES course_workouts(course_workout_uuid) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating DECIMAL(2, 1) NOT NULL CHECK (rating >= 0.0 AND rating <= 5.0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (course_workout_uuid, user_id)
);

-- Проверка и добавление недостающих столбцов в таблицу workout_ratings
SELECT add_column_if_not_exists('workout_ratings', 'rating_uuid', 'UUID PRIMARY KEY', 'gen_random_uuid()');
SELECT add_column_if_not_exists('workout_ratings', 'course_workout_uuid', 'UUID NOT NULL REFERENCES course_workouts(course_workout_uuid) ON DELETE CASCADE');
SELECT add_column_if_not_exists('workout_ratings', 'user_id', 'INT NOT NULL REFERENCES users(id) ON DELETE CASCADE');
SELECT add_column_if_not_exists('workout_ratings', 'rating', 'DECIMAL(2, 1) NOT NULL CHECK (rating >= 0.0 AND rating <= 5.0)');
SELECT add_column_if_not_exists('workout_ratings', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('workout_ratings', 'updated_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице workout_ratings
SELECT check_extra_columns('workout_ratings', ARRAY['rating_uuid', 'course_workout_uuid', 'user_id', 'rating', 'created_at', 'updated_at']);

-- Индексы для таблицы workout_ratings
CREATE INDEX IF NOT EXISTS idx_workout_ratings_course_workout_uuid ON workout_ratings(course_workout_uuid);
CREATE INDEX IF NOT EXISTS idx_workout_ratings_user_id ON workout_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_ratings_rating ON workout_ratings(rating);

-- Функция для обновления среднего рейтинга тренировки при добавлении/изменении оценки
CREATE OR REPLACE FUNCTION update_workout_rating() RETURNS TRIGGER AS $$
DECLARE
    workout_avg_rating DECIMAL(3, 2);
    course_uuid_var UUID;
    trainer_id_var INT;
    course_avg_rating DECIMAL(3, 2);
    trainer_avg_rating DECIMAL(3, 2);
    trainer_ratings_count INT;
BEGIN
    -- Обновить средний рейтинг тренировки
    SELECT ROUND(AVG(rating)::numeric, 2) INTO workout_avg_rating
    FROM workout_ratings
    WHERE course_workout_uuid = NEW.course_workout_uuid;
    
    UPDATE course_workouts
    SET 
        rating = workout_avg_rating,
        updated_at = CURRENT_TIMESTAMP
    WHERE course_workout_uuid = NEW.course_workout_uuid;
    
    -- Получаем UUID курса и ID тренера
    SELECT cw.course_uuid, c.user_id INTO course_uuid_var, trainer_id_var
    FROM course_workouts cw
    JOIN courses c ON cw.course_uuid = c.course_uuid
    WHERE cw.course_workout_uuid = NEW.course_workout_uuid;
    
    -- Обновляем рейтинг курса (среднее по всем тренировкам)
    SELECT ROUND(COALESCE(AVG(rating), 0)::numeric, 2) INTO course_avg_rating
    FROM course_workouts
    WHERE course_uuid = course_uuid_var AND rating > 0;
    
    -- Обновляем рейтинг курса
    UPDATE courses
    SET rating = course_avg_rating, updated_at = CURRENT_TIMESTAMP
    WHERE course_uuid = course_uuid_var;
    
    -- Обновляем рейтинг тренера на основе всех его тренировок
    SELECT 
        ROUND(COALESCE(AVG(wr.rating), 0)::numeric, 2) as avg_rating,
        COUNT(DISTINCT wr.rating_uuid) as total_ratings
    INTO trainer_avg_rating, trainer_ratings_count
    FROM workout_ratings wr
    JOIN course_workouts cw ON wr.course_workout_uuid = cw.course_workout_uuid
    JOIN courses c ON cw.course_uuid = c.course_uuid
    WHERE c.user_id = trainer_id_var;
    
    -- Обновляем запись в user_ratings или создаем новую
    INSERT INTO user_ratings (user_id, rating, rating_count, updated_at)
    VALUES (trainer_id_var, trainer_avg_rating, trainer_ratings_count, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        rating = trainer_avg_rating,
        rating_count = trainer_ratings_count,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Удаляем старый триггер
DROP TRIGGER IF EXISTS trig_update_workout_rating ON workout_ratings;

-- Создаем новый триггер для автоматического обновления рейтинга тренировки, курса и тренера
CREATE TRIGGER trig_update_workout_rating
AFTER INSERT OR UPDATE OR DELETE ON workout_ratings
FOR EACH ROW EXECUTE FUNCTION update_workout_rating();

-- Таблица связи тренировок и групп мышц
CREATE TABLE IF NOT EXISTS workout_muscle_groups (
    id SERIAL PRIMARY KEY,
    course_workout_uuid UUID NOT NULL REFERENCES course_workouts(course_workout_uuid) ON DELETE CASCADE,
    muscle_group_id INT NOT NULL REFERENCES muscle_groups(id) ON DELETE CASCADE,
    percentage INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (course_workout_uuid, muscle_group_id)
);

-- Проверка и добавление недостающих столбцов в таблицу workout_muscle_groups
SELECT add_column_if_not_exists('workout_muscle_groups', 'id', 'SERIAL PRIMARY KEY');
SELECT add_column_if_not_exists('workout_muscle_groups', 'course_workout_uuid', 'UUID NOT NULL REFERENCES course_workouts(course_workout_uuid) ON DELETE CASCADE');
SELECT add_column_if_not_exists('workout_muscle_groups', 'muscle_group_id', 'INT NOT NULL REFERENCES muscle_groups(id) ON DELETE CASCADE');
SELECT add_column_if_not_exists('workout_muscle_groups', 'percentage', 'INT DEFAULT 0');
SELECT add_column_if_not_exists('workout_muscle_groups', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице workout_muscle_groups
SELECT check_extra_columns('workout_muscle_groups', ARRAY['id', 'course_workout_uuid', 'muscle_group_id', 'percentage', 'created_at']);

-- Добавляем комментарий к столбцу
COMMENT ON COLUMN workout_muscle_groups.percentage IS 'Процент задействованности группы мышц в тренировке (от 0 до 100)';

-- Добавляем ограничение на допустимые значения уровня жёсткости
DO $$
BEGIN
    -- Добавляем constraint только если он не существует
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_response_level_range' 
        AND table_name = 'user_response_levels'
    ) THEN
        ALTER TABLE user_response_levels 
        ADD CONSTRAINT check_response_level_range CHECK (response_level_id >= 1 AND response_level_id <= 3);
    END IF;
END $$;

-- Создаем функцию для проверки суммы процентов в тренировке
CREATE OR REPLACE FUNCTION check_workout_muscle_group_percentages()
RETURNS TRIGGER AS $$
DECLARE
    total_percentage INT;
BEGIN
    -- Проверяем сумму процентов для тренировки
    SELECT SUM(percentage) INTO total_percentage
    FROM workout_muscle_groups
    WHERE course_workout_uuid = NEW.course_workout_uuid;
    
    -- Если сумма превышает 100%, отменяем операцию
    IF total_percentage > 100 THEN
        RAISE EXCEPTION 'Общая сумма процентов для групп мышц в тренировке не может превышать 100%';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер для проверки суммы процентов при вставке или обновлении
DROP TRIGGER IF EXISTS trig_check_workout_muscle_group_percentages ON workout_muscle_groups;
CREATE TRIGGER trig_check_workout_muscle_group_percentages
AFTER INSERT OR UPDATE ON workout_muscle_groups
FOR EACH ROW EXECUTE FUNCTION check_workout_muscle_group_percentages();

-- Обновляем существующие записи, устанавливая равномерное распределение
DO $$
DECLARE
    workout_uuid UUID;
    group_count INT;
    equal_percentage INT;
BEGIN
    -- Для каждой тренировки
    FOR workout_uuid IN SELECT DISTINCT course_workout_uuid FROM workout_muscle_groups LOOP
        -- Считаем количество групп мышц в тренировке
        SELECT COUNT(*) INTO group_count FROM workout_muscle_groups 
        WHERE course_workout_uuid = workout_uuid;
        
        -- Если есть группы мышц, распределяем проценты равномерно
        IF group_count > 0 THEN
            equal_percentage := FLOOR(100 / group_count);
            
            -- Обновляем записи
            UPDATE workout_muscle_groups
            SET percentage = equal_percentage
            WHERE course_workout_uuid = workout_uuid;
            
            -- Корректируем сумму до 100% (добавляем остаток к первой группе)
            UPDATE workout_muscle_groups
            SET percentage = percentage + (100 - (equal_percentage * group_count))
            WHERE id = (
                SELECT MIN(id) FROM workout_muscle_groups 
                WHERE course_workout_uuid = workout_uuid
            );
        END IF;
    END LOOP;
END $$;

-- Индексы для таблицы workout_muscle_groups
CREATE INDEX IF NOT EXISTS idx_workout_muscle_groups_course_workout_uuid ON workout_muscle_groups(course_workout_uuid);
CREATE INDEX IF NOT EXISTS idx_workout_muscle_groups_muscle_group_id ON workout_muscle_groups(muscle_group_id);
CREATE INDEX IF NOT EXISTS idx_workout_muscle_groups_percentage ON workout_muscle_groups(percentage); 

-- Таблица рейтингов пользователей
CREATE TABLE IF NOT EXISTS user_ratings (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating DECIMAL(3, 2) DEFAULT 0.0 CHECK (rating >= 0.0 AND rating <= 5.0),
    rating_count INT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id)
);

-- Проверка и добавление недостающих столбцов в таблицу user_ratings
SELECT add_column_if_not_exists('user_ratings', 'id', 'SERIAL PRIMARY KEY');
SELECT add_column_if_not_exists('user_ratings', 'user_id', 'INT NOT NULL REFERENCES users(id) ON DELETE CASCADE');
SELECT add_column_if_not_exists('user_ratings', 'rating', 'DECIMAL(3, 2)', '0.0');
SELECT add_column_if_not_exists('user_ratings', 'rating_count', 'INT', '0');
SELECT add_column_if_not_exists('user_ratings', 'updated_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице user_ratings
SELECT check_extra_columns('user_ratings', ARRAY['id', 'user_id', 'rating', 'rating_count', 'updated_at']);

-- Создаем индекс для user_ratings
CREATE INDEX IF NOT EXISTS idx_user_ratings_user_id ON user_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ratings_rating ON user_ratings(rating);

-- Удаляем функцию для обновления среднего рейтинга курса, так как её функциональность теперь встроена в update_workout_rating
DROP FUNCTION IF EXISTS update_course_rating() CASCADE;

-- Удаляем функцию для обновления рейтинга тренера, так как её функциональность теперь встроена в update_workout_rating
DROP FUNCTION IF EXISTS update_trainer_rating() CASCADE;

-- Создаем функцию для проверки суммы процентов в тренировке
CREATE OR REPLACE FUNCTION check_workout_muscle_group_percentages()
RETURNS TRIGGER AS $$
DECLARE
    total_percentage INT;
BEGIN
    -- Проверяем сумму процентов для тренировки
    SELECT SUM(percentage) INTO total_percentage
    FROM workout_muscle_groups
    WHERE course_workout_uuid = NEW.course_workout_uuid;
    
    -- Если сумма превышает 100%, отменяем операцию
    IF total_percentage > 100 THEN
        RAISE EXCEPTION 'Общая сумма процентов для групп мышц в тренировке не может превышать 100%';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер для проверки суммы процентов при вставке или обновлении
DROP TRIGGER IF EXISTS trig_check_workout_muscle_group_percentages ON workout_muscle_groups;
CREATE TRIGGER trig_check_workout_muscle_group_percentages
AFTER INSERT OR UPDATE ON workout_muscle_groups
FOR EACH ROW EXECUTE FUNCTION check_workout_muscle_group_percentages();

-- Обновляем существующие записи, устанавливая равномерное распределение
DO $$
DECLARE
    workout_uuid UUID;
    group_count INT;
    equal_percentage INT;
BEGIN
    -- Для каждой тренировки
    FOR workout_uuid IN SELECT DISTINCT course_workout_uuid FROM workout_muscle_groups LOOP
        -- Считаем количество групп мышц в тренировке
        SELECT COUNT(*) INTO group_count FROM workout_muscle_groups 
        WHERE course_workout_uuid = workout_uuid;
        
        -- Если есть группы мышц, распределяем проценты равномерно
        IF group_count > 0 THEN
            equal_percentage := FLOOR(100 / group_count);
            
            -- Обновляем записи
            UPDATE workout_muscle_groups
            SET percentage = equal_percentage
            WHERE course_workout_uuid = workout_uuid;
            
            -- Корректируем сумму до 100% (добавляем остаток к первой группе)
            UPDATE workout_muscle_groups
            SET percentage = percentage + (100 - (equal_percentage * group_count))
            WHERE id = (
                SELECT MIN(id) FROM workout_muscle_groups 
                WHERE course_workout_uuid = workout_uuid
            );
        END IF;
    END LOOP;
END $$;

-- Индексы для таблицы workout_muscle_groups
CREATE INDEX IF NOT EXISTS idx_workout_muscle_groups_course_workout_uuid ON workout_muscle_groups(course_workout_uuid);
CREATE INDEX IF NOT EXISTS idx_workout_muscle_groups_muscle_group_id ON workout_muscle_groups(muscle_group_id);
CREATE INDEX IF NOT EXISTS idx_workout_muscle_groups_percentage ON workout_muscle_groups(percentage); 

-- Таблица средней нагруженности групп мышц по курсу
CREATE TABLE IF NOT EXISTS course_muscle_groups (
    id SERIAL PRIMARY KEY,
    course_uuid UUID NOT NULL REFERENCES courses(course_uuid) ON DELETE CASCADE,
    muscle_group_id INT NOT NULL REFERENCES muscle_groups(id) ON DELETE CASCADE,
    average_percentage DECIMAL(5, 2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (course_uuid, muscle_group_id)
);

-- Проверка и добавление недостающих столбцов в таблицу course_muscle_groups
SELECT add_column_if_not_exists('course_muscle_groups', 'id', 'SERIAL PRIMARY KEY');
SELECT add_column_if_not_exists('course_muscle_groups', 'course_uuid', 'UUID NOT NULL REFERENCES courses(course_uuid) ON DELETE CASCADE');
SELECT add_column_if_not_exists('course_muscle_groups', 'muscle_group_id', 'INT NOT NULL REFERENCES muscle_groups(id) ON DELETE CASCADE');
SELECT add_column_if_not_exists('course_muscle_groups', 'average_percentage', 'DECIMAL(5, 2)', '0.0');
SELECT add_column_if_not_exists('course_muscle_groups', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('course_muscle_groups', 'updated_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице course_muscle_groups
SELECT check_extra_columns('course_muscle_groups', ARRAY['id', 'course_uuid', 'muscle_group_id', 'average_percentage', 'created_at', 'updated_at']);

-- Добавляем комментарий к столбцу
COMMENT ON COLUMN course_muscle_groups.average_percentage IS 'Средний процент задействованности группы мышц во всех тренировках курса';

-- Создаем индексы для таблицы course_muscle_groups
CREATE INDEX IF NOT EXISTS idx_course_muscle_groups_course_uuid ON course_muscle_groups(course_uuid);
CREATE INDEX IF NOT EXISTS idx_course_muscle_groups_muscle_group_id ON course_muscle_groups(muscle_group_id);
CREATE INDEX IF NOT EXISTS idx_course_muscle_groups_average_percentage ON course_muscle_groups(average_percentage);

-- Функция для обновления средней нагруженности групп мышц в курсе
CREATE OR REPLACE FUNCTION update_course_muscle_groups() RETURNS TRIGGER AS $$
DECLARE
    course_uuid_var UUID;
    total_workouts INT;
BEGIN
    -- Получаем UUID курса для измененной тренировки
    SELECT cw.course_uuid INTO course_uuid_var
    FROM course_workouts cw
    WHERE cw.course_workout_uuid = 
        CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.course_workout_uuid
            ELSE NEW.course_workout_uuid
        END;
    
    -- Если UUID курса не найден, выходим
    IF course_uuid_var IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Получаем общее количество тренировок в курсе
    SELECT COUNT(*) INTO total_workouts
    FROM course_workouts
    WHERE course_uuid = course_uuid_var;
    
    -- Для каждой группы мышц, обновляем средний процент нагруженности
    -- 1. Удаляем старые записи о среднем проценте нагруженности для курса
    DELETE FROM course_muscle_groups
    WHERE course_uuid = course_uuid_var;
    
    -- 2. Вставляем новые записи с обновленными средними значениями
    INSERT INTO course_muscle_groups (course_uuid, muscle_group_id, average_percentage, updated_at)
    SELECT 
        course_uuid_var,
        wmg.muscle_group_id,
        ROUND(AVG(wmg.percentage)::numeric, 2) as avg_percentage,
        CURRENT_TIMESTAMP
    FROM workout_muscle_groups wmg
    JOIN course_workouts cw ON wmg.course_workout_uuid = cw.course_workout_uuid
    WHERE cw.course_uuid = course_uuid_var
    GROUP BY wmg.muscle_group_id;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер для обновления средней нагруженности при изменении групп мышц в тренировке
DROP TRIGGER IF EXISTS trig_update_course_muscle_groups ON workout_muscle_groups;
CREATE TRIGGER trig_update_course_muscle_groups
AFTER INSERT OR UPDATE OR DELETE ON workout_muscle_groups
FOR EACH ROW EXECUTE FUNCTION update_course_muscle_groups();

-- Создаем триггер для обновления средней нагруженности при удалении тренировки
DROP TRIGGER IF EXISTS trig_update_course_muscle_groups_on_workout_delete ON course_workouts;
CREATE TRIGGER trig_update_course_muscle_groups_on_workout_delete
AFTER DELETE ON course_workouts
FOR EACH ROW EXECUTE FUNCTION update_course_muscle_groups();

-- Заполняем таблицу course_muscle_groups начальными данными на основе существующих записей
DO $$
DECLARE
    course_uuid_var UUID;
BEGIN
    -- Для каждого курса
    FOR course_uuid_var IN SELECT DISTINCT course_uuid FROM courses LOOP
        -- Вставляем записи с обновленными средними значениями
        INSERT INTO course_muscle_groups (course_uuid, muscle_group_id, average_percentage, updated_at)
        SELECT 
            course_uuid_var,
            wmg.muscle_group_id,
            ROUND(AVG(wmg.percentage)::numeric, 2) as avg_percentage,
            CURRENT_TIMESTAMP
        FROM workout_muscle_groups wmg
        JOIN course_workouts cw ON wmg.course_workout_uuid = cw.course_workout_uuid
        WHERE cw.course_uuid = course_uuid_var
        GROUP BY wmg.muscle_group_id
        ON CONFLICT (course_uuid, muscle_group_id) DO UPDATE
        SET 
            average_percentage = EXCLUDED.average_percentage,
            updated_at = CURRENT_TIMESTAMP;
    END LOOP;
END $$; 

-- =================================================================================
-- ТАБЛИЦЫ ДЛЯ СЕРВИСА МОТИВАЦИИ
-- =================================================================================

-- Таблица ежедневных мотивационных сообщений
CREATE TABLE IF NOT EXISTS daily_motivation (
    daily_motivation_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_start DATE NOT NULL,
    date_ended DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'completed', 'failed', 'regenerating', 'deepfit-error')),
    motivation_message TEXT,
    fact TEXT,
    advice TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для таблицы daily_motivation
CREATE INDEX IF NOT EXISTS idx_daily_motivation_user_id ON daily_motivation(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_motivation_date_start ON daily_motivation(date_start);
CREATE INDEX IF NOT EXISTS idx_daily_motivation_date_ended ON daily_motivation(date_ended);
CREATE INDEX IF NOT EXISTS idx_daily_motivation_status ON daily_motivation(status);

-- Таблица очереди генерации нейросетью
CREATE TABLE IF NOT EXISTS neuro_generation_queue (
    neuro_generation_queue_id SERIAL PRIMARY KEY,
    daily_motivation_uuid UUID NOT NULL REFERENCES daily_motivation(daily_motivation_uuid) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'completed', 'failed', 'deepfit-error')),
    datetime_created TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    datetime_started TIMESTAMP WITH TIME ZONE,
    datetime_completed TIMESTAMP WITH TIME ZONE
);

-- Индексы для таблицы neuro_generation_queue
CREATE INDEX IF NOT EXISTS idx_neuro_generation_queue_status ON neuro_generation_queue(status);
CREATE INDEX IF NOT EXISTS idx_neuro_generation_queue_daily_motivation_uuid ON neuro_generation_queue(daily_motivation_uuid);
CREATE INDEX IF NOT EXISTS idx_neuro_generation_queue_datetime_created ON neuro_generation_queue(datetime_created); 

-- Обновляем CHECK constraint для существующей таблицы
DO $$
BEGIN
    -- Сначала удаляем старый constraint если существует
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%daily_motivation_status_check%' 
        AND table_name = 'daily_motivation'
    ) THEN
        ALTER TABLE daily_motivation DROP CONSTRAINT IF EXISTS daily_motivation_status_check;
    END IF;
    
    -- Добавляем новый constraint с расширенным списком статусов
    ALTER TABLE daily_motivation 
    ADD CONSTRAINT daily_motivation_status_check 
    CHECK (status IN ('new', 'in_progress', 'completed', 'failed', 'regenerating', 'deepfit-error'));
EXCEPTION
    WHEN others THEN
        -- Игнорируем ошибки если constraint уже обновлен
        NULL;
END $$; 

-- Таблица уровней жёсткости ответов нейросети для пользователей
CREATE TABLE IF NOT EXISTS user_response_levels (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    response_level_id INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id)
);

-- Проверка и добавление недостающих столбцов в таблицу user_response_levels
SELECT add_column_if_not_exists('user_response_levels', 'id', 'SERIAL PRIMARY KEY');
SELECT add_column_if_not_exists('user_response_levels', 'user_id', 'INT NOT NULL REFERENCES users(id) ON DELETE CASCADE');
SELECT add_column_if_not_exists('user_response_levels', 'response_level_id', 'INT NOT NULL', '1');
SELECT add_column_if_not_exists('user_response_levels', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('user_response_levels', 'updated_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице user_response_levels
SELECT check_extra_columns('user_response_levels', ARRAY['id', 'user_id', 'response_level_id', 'created_at', 'updated_at']);

-- Добавляем комментарии к таблице
COMMENT ON TABLE user_response_levels IS 'Таблица уровней жёсткости ответов нейросети для пользователей';
COMMENT ON COLUMN user_response_levels.response_level_id IS 'ID уровня жёсткости: 1 - лояльный, 2 - средний, 3 - жёсткий';

-- Добавляем ограничение на допустимые значения уровня жёсткости
DO $$
BEGIN
    -- Добавляем constraint только если он не существует
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_response_level_range' 
        AND table_name = 'user_response_levels'
    ) THEN
        ALTER TABLE user_response_levels 
        ADD CONSTRAINT check_response_level_range CHECK (response_level_id >= 1 AND response_level_id <= 3);
    END IF;
END $$;

-- Создаем индексы для таблицы user_response_levels
CREATE INDEX IF NOT EXISTS idx_user_response_levels_user_id ON user_response_levels(user_id);
CREATE INDEX IF NOT EXISTS idx_user_response_levels_response_level_id ON user_response_levels(response_level_id); 

-- Таблица комментариев к тренировкам курсов
CREATE TABLE IF NOT EXISTS comments (
    comment_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_workout_uuid UUID NOT NULL REFERENCES course_workouts(course_workout_uuid) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_uuid UUID REFERENCES comments(comment_uuid) ON DELETE CASCADE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Проверка и добавление недостающих столбцов в таблицу comments
SELECT add_column_if_not_exists('comments', 'comment_uuid', 'UUID PRIMARY KEY', 'gen_random_uuid()');
SELECT add_column_if_not_exists('comments', 'user_id', 'INT NOT NULL REFERENCES users(id) ON DELETE CASCADE');
SELECT add_column_if_not_exists('comments', 'course_workout_uuid', 'UUID NOT NULL REFERENCES course_workouts(course_workout_uuid) ON DELETE CASCADE');
SELECT add_column_if_not_exists('comments', 'content', 'TEXT NOT NULL');
SELECT add_column_if_not_exists('comments', 'parent_comment_uuid', 'UUID REFERENCES comments(comment_uuid) ON DELETE CASCADE');
SELECT add_column_if_not_exists('comments', 'is_deleted', 'BOOLEAN', 'FALSE');
SELECT add_column_if_not_exists('comments', 'created_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');
SELECT add_column_if_not_exists('comments', 'updated_at', 'TIMESTAMP WITH TIME ZONE', 'CURRENT_TIMESTAMP');

-- Проверка лишних столбцов в таблице comments
SELECT check_extra_columns('comments', ARRAY['comment_uuid', 'user_id', 'course_workout_uuid', 'content', 'parent_comment_uuid', 'is_deleted', 'created_at', 'updated_at']);

-- Индексы для таблицы комментариев
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_course_workout_uuid ON comments(course_workout_uuid);
CREATE INDEX IF NOT EXISTS idx_comments_parent_comment_uuid ON comments(parent_comment_uuid);
CREATE INDEX IF NOT EXISTS idx_comments_is_deleted ON comments(is_deleted);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at); 