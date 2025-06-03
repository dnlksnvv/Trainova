# Константы базы данных для course service

# Таблицы
COURSES_TABLE = "courses"
COURSE_ENROLLMENTS_TABLE = "course_enrollments"
COURSE_REVIEWS_TABLE = "course_reviews"

# Индексы
COURSE_USER_INDEX = "idx_courses_user_id"
COURSE_PUBLISHED_INDEX = "idx_courses_is_published"
COURSE_RATING_INDEX = "idx_courses_rating"
COURSE_CREATED_INDEX = "idx_courses_created_at"

# SQL запросы - используем таблицу courses из общей схемы
# Таблица courses уже создается в init-db.sql, поэтому здесь только проверяем её существование
CREATE_COURSES_TABLE = """
-- Таблица courses создается в init-db.sql
SELECT 1;
"""

CREATE_COURSE_ENROLLMENTS_TABLE = """
CREATE TABLE IF NOT EXISTS course_enrollments (
    id SERIAL PRIMARY KEY,
    course_uuid UUID NOT NULL REFERENCES courses(course_uuid) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(course_uuid, user_id)
);
"""

CREATE_COURSE_REVIEWS_TABLE = """
CREATE TABLE IF NOT EXISTS course_reviews (
    id SERIAL PRIMARY KEY,
    course_uuid UUID NOT NULL REFERENCES courses(course_uuid) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating DECIMAL(3, 2) NOT NULL CHECK (rating >= 0.0 AND rating <= 5.0),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_uuid, user_id)
);
"""

# Таблица рейтинга пользователей
CREATE_USER_RATING_TABLE = """
CREATE TABLE IF NOT EXISTS user_rating (
    user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    rating DECIMAL(3, 2) NOT NULL DEFAULT 0.0 CHECK (rating >= 0.0 AND rating <= 5.0),
    rating_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""" 