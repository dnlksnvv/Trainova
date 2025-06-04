# Инициализация пакета comment 

import logging

from comment.application.comment_service import CommentService
from comment.api.router import CommentRouter

logger = logging.getLogger(__name__)

comment_service = CommentService()
router = CommentRouter().router 