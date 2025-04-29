import logging

from training.application.services.exercises_service import ExercisesService
from training.application.services.training_service import TrainingService
from training.application.services.admin_service import AdminService
from training.application.services.muscle_groups_service import MuscleGroupsService
from training.application.services.activity_service import ActivityService
from training.api.router import TrainingRouter

logger = logging.getLogger(__name__)

exercises_service = ExercisesService()
training_service = TrainingService()
admin_service = AdminService()
muscle_groups_service = MuscleGroupsService()
activity_service = ActivityService()

router = TrainingRouter(
    exercises_service, 
    training_service, 
    admin_service,
    muscle_groups_service,
    activity_service
).router
