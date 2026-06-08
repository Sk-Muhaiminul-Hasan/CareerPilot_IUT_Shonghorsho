"""Pydantic API schemas -- request/response models for all endpoints."""

from app.schemas.analytics import (
    ApplicationFunnelData,
    ATSScoreDistribution,
    DashboardStats,
    LLMUsageStats,
    TimelineEntry,
)
from app.schemas.application import (
    ApplicationBatchCreate,
    ApplicationCreate,
    ApplicationListResponse,
    ApplicationResponse,
    ApplicationStatusUpdate,
)
from app.schemas.calendar_event import (
    CalendarEventCreate,
    CalendarEventListResponse,
    CalendarEventResponse,
    CalendarEventUpdate,
)
from app.schemas.goal import (
    GoalCreate,
    GoalListResponse,
    GoalProgressUpdate,
    GoalResponse,
    GoalUpdate,
)
from app.schemas.job import (
    JobAnalysisResponse,
    JobListingResponse,
    JobListResponse,
    JobSearchRequest,
)
from app.schemas.resume import (
    ResumeGenerateRequest,
    ResumeListResponse,
    ResumeResponse,
    ResumeScoreRequest,
    ResumeScoreResponse,
    ResumeUploadResponse,
)
from app.schemas.scheduled_search import (
    ScheduledSearchCreate,
    ScheduledSearchResponse,
    ScheduledSearchUpdate,
)
from app.schemas.settings import LLMProviderStatus, SettingsResponse, SettingsUpdate
from app.schemas.todo_item import (
    TodoItemCreate,
    TodoItemListResponse,
    TodoItemResponse,
    TodoItemUpdate,
)
from app.schemas.tracker import (
    TrackerCardResponse,
    TrackerLabelCreate,
    TrackerLabelResponse,
    TrackerLabelUpdate,
    TrackerNoteCreate,
    TrackerNoteResponse,
    TrackerNoteUpdate,
)

__all__ = [
    # analytics
    "ATSScoreDistribution",
    "ApplicationFunnelData",
    "DashboardStats",
    "LLMUsageStats",
    "TimelineEntry",
    # application
    "ApplicationBatchCreate",
    "ApplicationCreate",
    "ApplicationListResponse",
    "ApplicationResponse",
    "ApplicationStatusUpdate",
    # calendar
    "CalendarEventCreate",
    "CalendarEventListResponse",
    "CalendarEventResponse",
    "CalendarEventUpdate",
    # goal
    "GoalCreate",
    "GoalListResponse",
    "GoalProgressUpdate",
    "GoalResponse",
    "GoalUpdate",
    # job
    "JobAnalysisResponse",
    "JobListResponse",
    "JobListingResponse",
    "JobSearchRequest",
    # scheduled search
    "ScheduledSearchCreate",
    "ScheduledSearchResponse",
    "ScheduledSearchUpdate",
    # settings
    "LLMProviderStatus",
    "SettingsResponse",
    "SettingsUpdate",
    # resume
    "ResumeGenerateRequest",
    "ResumeListResponse",
    "ResumeResponse",
    "ResumeScoreRequest",
    "ResumeScoreResponse",
    "ResumeUploadResponse",
    # todo
    "TodoItemCreate",
    "TodoItemListResponse",
    "TodoItemResponse",
    "TodoItemUpdate",
    # tracker
    "TrackerCardResponse",
    "TrackerLabelCreate",
    "TrackerLabelResponse",
    "TrackerLabelUpdate",
    "TrackerNoteCreate",
    "TrackerNoteResponse",
    "TrackerNoteUpdate",
]
