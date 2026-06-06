"""Analytics and dashboard service.

Provides aggregated statistics for the dashboard UI.
"""

import structlog
from sqlalchemy import String as SAString
from sqlalchemy import cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.constants import ApplicationStatus
from app.models.application import Application
from app.models.job import Job
from app.models.llm_usage import LLMUsage
from app.schemas.analytics import (
    ApplicationFunnelData,
    ATSScoreDistribution,
    DashboardStats,
    LLMUsageStats,
    TimelineEntry,
)

logger = structlog.get_logger(__name__)

_FUNNEL_STAGES = [
    ApplicationStatus.QUEUED,
    ApplicationStatus.PENDING_REVIEW,
    ApplicationStatus.APPROVED,
    ApplicationStatus.APPLYING,
    ApplicationStatus.APPLIED,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.OFFER,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
]


async def get_dashboard_stats(db: AsyncSession, user_id: str = "default_user") -> DashboardStats:
    """Compute top-level dashboard statistics."""
    total_jobs = (
        await db.execute(
            select(func.count(Job.id)).where(Job.user_id == user_id),
        )
    ).scalar() or 0

    total_apps = (
        await db.execute(
            select(func.count(Application.id)).where(Application.user_id == user_id),
        )
    ).scalar() or 0

    def _count_status(status: str):  # noqa: ANN202
        return select(func.count(Application.id)).where(
            Application.status == status,
            Application.user_id == user_id,
        )

    pending = (await db.execute(_count_status(ApplicationStatus.PENDING_REVIEW))).scalar() or 0
    applied = (await db.execute(_count_status(ApplicationStatus.APPLIED))).scalar() or 0
    interview = (await db.execute(_count_status(ApplicationStatus.INTERVIEW))).scalar() or 0
    rejected = (await db.execute(_count_status(ApplicationStatus.REJECTED))).scalar() or 0
    offer = (await db.execute(_count_status(ApplicationStatus.OFFER))).scalar() or 0

    avg_ats = (
        await db.execute(
            select(func.avg(Application.ats_score)).where(
                Application.ats_score.isnot(None),
                Application.status == ApplicationStatus.APPLIED,
                Application.user_id == user_id,
            ),
        )
    ).scalar() or 0.0

    total_llm_cost = (
        await db.execute(
            select(func.coalesce(func.sum(LLMUsage.cost_usd), 0.0)).where(
                LLMUsage.user_id == user_id,
            ),
        )
    ).scalar() or 0.0

    return DashboardStats(
        total_jobs_found=total_jobs,
        total_applications=total_apps,
        applications_pending=pending,
        applications_applied=applied,
        applications_interview=interview,
        applications_rejected=rejected,
        applications_offer=offer,
        avg_ats_score=round(float(avg_ats), 3),
        total_llm_cost_usd=round(float(total_llm_cost), 4),
    )


async def get_funnel(db: AsyncSession, user_id: str = "default_user") -> list[ApplicationFunnelData]:
    """Get application funnel stage counts."""
    result = await db.execute(
        select(Application.status, func.count(Application.id))
        .where(Application.user_id == user_id)
        .group_by(Application.status),
    )
    counts = {row[0]: row[1] for row in result.all()}

    return [
        ApplicationFunnelData(stage=stage, count=counts.get(stage, 0))
        for stage in _FUNNEL_STAGES
    ]


async def get_ats_distribution(db: AsyncSession, user_id: str = "default_user") -> list[ATSScoreDistribution]:
    """Get ATS score distribution histogram."""
    ranges = [
        ("0-20", 0.0, 0.2),
        ("20-40", 0.2, 0.4),
        ("40-60", 0.4, 0.6),
        ("60-80", 0.6, 0.8),
        ("80-100", 0.8, 1.01),
    ]

    distribution: list[ATSScoreDistribution] = []
    for label, low, high in ranges:
        count = (
            await db.execute(
                select(func.count(Application.id)).where(
                    Application.ats_score >= low,
                    Application.ats_score < high,
                    Application.user_id == user_id,
                ),
            )
        ).scalar() or 0
        distribution.append(ATSScoreDistribution(range_label=label, count=count))

    return distribution


async def get_llm_usage(db: AsyncSession, user_id: str = "default_user") -> list[LLMUsageStats]:
    """Get LLM usage statistics grouped by provider + model."""
    result = await db.execute(
        select(
            LLMUsage.provider,
            LLMUsage.model,
            func.count(LLMUsage.id).label("total_requests"),
            func.coalesce(func.sum(LLMUsage.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(LLMUsage.cost_usd), 0.0).label("total_cost"),
            func.coalesce(func.avg(LLMUsage.latency_ms), 0.0).label("avg_latency"),
        )
        .where(LLMUsage.user_id == user_id)
        .group_by(LLMUsage.provider, LLMUsage.model)
        .order_by(func.sum(LLMUsage.cost_usd).desc()),
    )

    return [
        LLMUsageStats(
            provider=row.provider,
            model=row.model,
            total_requests=row.total_requests,
            total_tokens=row.total_tokens,
            total_cost_usd=round(float(row.total_cost), 6),
            avg_latency_ms=round(float(row.avg_latency), 1),
        )
        for row in result.all()
    ]


async def get_timeline(db: AsyncSession, user_id: str = "default_user") -> list[TimelineEntry]:
    """Get daily activity timeline for the last 30 days."""
    created_q = await db.execute(
        select(
            cast(Application.created_at, SAString).label("date"),
            func.count(Application.id).label("cnt"),
        )
        .where(Application.user_id == user_id)
        .group_by(cast(Application.created_at, SAString))
        .order_by(cast(Application.created_at, SAString).desc())
        .limit(30),
    )
    created_by_date = {str(r.date)[:10]: r.cnt for r in created_q.all()}

    applied_q = await db.execute(
        select(
            cast(Application.applied_at, SAString).label("date"),
            func.count(Application.id).label("cnt"),
        )
        .where(Application.applied_at.isnot(None), Application.user_id == user_id)
        .group_by(cast(Application.applied_at, SAString))
        .order_by(cast(Application.applied_at, SAString).desc())
        .limit(30),
    )
    applied_by_date = {str(r.date)[:10]: r.cnt for r in applied_q.all()}

    jobs_q = await db.execute(
        select(
            cast(Job.created_at, SAString).label("date"),
            func.count(Job.id).label("cnt"),
        )
        .where(Job.user_id == user_id)
        .group_by(cast(Job.created_at, SAString))
        .order_by(cast(Job.created_at, SAString).desc())
        .limit(30),
    )
    jobs_by_date = {str(r.date)[:10]: r.cnt for r in jobs_q.all()}

    all_dates = sorted(
        set(created_by_date) | set(applied_by_date) | set(jobs_by_date),
        reverse=True,
    )[:30]

    return [
        TimelineEntry(
            date=d,
            applications_created=created_by_date.get(d, 0),
            applications_applied=applied_by_date.get(d, 0),
            jobs_found=jobs_by_date.get(d, 0),
        )
        for d in all_dates
    ]
