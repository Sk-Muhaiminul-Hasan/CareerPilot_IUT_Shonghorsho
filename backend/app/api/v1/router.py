"""API v1 router aggregating all sub-routers."""

from fastapi import APIRouter

from app.api.v1.analytics import router as analytics_router
from app.api.v1.applications import router as applications_router
from app.api.v1.calendar_events import router as calendar_router
from app.api.v1.goals import router as goals_router
from app.api.v1.jobs import router as jobs_router
from app.api.v1.resumes import router as resumes_router
from app.api.v1.settings import router as settings_router
from app.api.v1.todo_items import router as todos_router
from app.api.v1.tracker import router as tracker_router

v1_router = APIRouter()

v1_router.include_router(jobs_router, prefix="/jobs", tags=["Jobs"])
v1_router.include_router(applications_router, prefix="/applications", tags=["Applications"])
v1_router.include_router(resumes_router, prefix="/resumes", tags=["Resumes"])
v1_router.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])
v1_router.include_router(settings_router, prefix="/settings", tags=["Settings"])
v1_router.include_router(calendar_router, prefix="/calendar", tags=["Calendar"])
v1_router.include_router(goals_router, prefix="/goals", tags=["Goals"])
v1_router.include_router(todos_router, prefix="/todos", tags=["Todos"])
v1_router.include_router(tracker_router, prefix="/tracker", tags=["Tracker"])
