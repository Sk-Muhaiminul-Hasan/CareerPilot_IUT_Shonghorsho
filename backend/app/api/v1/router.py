"""API v1 router aggregating all sub-routers."""

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.api.v1.analytics import router as analytics_router
from app.api.v1.applications import router as applications_router
from app.api.v1.jobs import router as jobs_router
from app.api.v1.nudge import router as nudge_router
from app.api.v1.onboarding import router as onboarding_router
from app.api.v1.rag import router as rag_router
from app.api.v1.resumes import router as resumes_router
from app.api.v1.settings import router as settings_router

v1_router = APIRouter(dependencies=[Depends(get_current_user)])

v1_router.include_router(jobs_router, prefix="/jobs", tags=["Jobs"])
v1_router.include_router(applications_router, prefix="/applications", tags=["Applications"])
v1_router.include_router(resumes_router, prefix="/resumes", tags=["Resumes"])
v1_router.include_router(rag_router, prefix="/rag", tags=["RAG"])
v1_router.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])
v1_router.include_router(settings_router, prefix="/settings", tags=["Settings"])
v1_router.include_router(nudge_router, prefix="/nudge", tags=["Nudge"])
v1_router.include_router(onboarding_router, prefix="/onboarding", tags=["Onboarding"])

