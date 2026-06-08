"""Integration tests for the Applications API routes."""

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.documents.generator import GeneratedDocument
from app.models.application import Application
from app.models.job import Job
from app.models.resume import Resume

API_PREFIX = "/api/v1/applications"


def _build_mock_document_generator(pdf_path: str, docx_path: str | None = None):
    document = GeneratedDocument(
        document_id="cov123",
        type="cover_letter",
        template="modern",
        pdf_path=pdf_path,
        docx_path=docx_path,
    )
    generator = MagicMock()
    generator.generate_cover_letter = AsyncMock(return_value=document)
    return generator, document


class TestCoverLetterGeneration:
    """Tests for cover letter generation endpoints."""

    async def test_generate_cover_letter_success(self, client, sample_application_with_docs):
        pdf_path = str(Path("data/generated/cover_letters/cov123.pdf"))
        generator, _ = _build_mock_document_generator(pdf_path)

        with patch("app.services.application.DocumentGenerator", return_value=generator):
            response = await client.post(
                f"{API_PREFIX}/{sample_application_with_docs.id}/cover-letter",
            )

        assert response.status_code == 200
        body = response.json()
        assert body["id"] == sample_application_with_docs.id
        assert body["cover_letter_path"] == pdf_path

    async def test_generate_cover_letter_falls_back_to_docx(self, client, sample_application_with_docs):
        pdf_path = str(Path("data/generated/cover_letters/cov123.pdf"))
        docx_path = str(Path("data/generated/cover_letters/cov123.docx"))
        generator, document = _build_mock_document_generator(pdf_path, docx_path)
        generator.generate_cover_letter = AsyncMock(return_value=GeneratedDocument(**{**document.model_dump(), "pdf_path": None, "docx_path": docx_path}))

        with patch("app.services.application.DocumentGenerator", return_value=generator):
            response = await client.post(
                f"{API_PREFIX}/{sample_application_with_docs.id}/cover-letter",
            )

        assert response.status_code == 200
        body = response.json()
        assert body["cover_letter_path"] == docx_path

    async def test_download_cover_letter_returns_redirect(self, client, sample_application_with_docs):
        with patch("app.api.v1.applications.storage_client") as mock_storage:
            mock_storage.get_signed_url = AsyncMock(return_value="https://example.com/signed-url")
            response = await client.get(
                f"{API_PREFIX}/{sample_application_with_docs.id}/cover-letter/download",
            )

        assert response.status_code == 307
        assert response.headers["location"] == "https://example.com/signed-url"

    async def test_download_cover_letter_missing_returns_404(self, client, sample_application):
        response = await client.get(
            f"{API_PREFIX}/{sample_application.id}/cover-letter/download",
        )

        assert response.status_code == 404


@pytest.fixture
def job_data(sample_job_data):
    """Provide sample_job_data with skills_required as a dict (matching schema)."""
    data = dict(sample_job_data)
    data["skills_required"] = {"python": True, "fastapi": True, "postgresql": True}
    return data


@pytest.fixture
async def sample_job(db_session, job_data):
    """Create and return a persisted Job for use in application tests."""
    job = Job(**job_data)
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)
    return job


@pytest.fixture
async def sample_application(db_session, sample_job):
    """Create and return a persisted Application linked to sample_job."""
    app = Application(
        job_id=sample_job.id,
        apply_mode="review",
        status="queued",
    )
    db_session.add(app)
    await db_session.commit()
    await db_session.refresh(app)
    return app


@pytest.fixture
async def sample_resume(db_session):
    """Create a persisted Resume with non-empty content text."""
    resume = Resume(
        name="Test Resume",
        type="base",
        template_id="modern",
        content_text="Python, FastAPI, PostgreSQL, React, Docker",
    )
    db_session.add(resume)
    await db_session.commit()
    await db_session.refresh(resume)
    return resume


@pytest.fixture
async def sample_application_with_docs(db_session, sample_job, sample_resume):
    """Create an application linked to both job and resume for cover letter tests."""
    app = Application(
        job_id=sample_job.id,
        resume_id=sample_resume.id,
        apply_mode="review",
        status="queued",
    )
    db_session.add(app)
    await db_session.commit()
    await db_session.refresh(app)
    return app


class TestCreateApplication:
    """Tests for POST /api/v1/applications/."""

    async def test_create_application_success(self, client, sample_job):
        response = await client.post(
            f"{API_PREFIX}/",
            json={"job_id": sample_job.id, "apply_mode": "review"},
        )

        assert response.status_code == 201
        body = response.json()
        assert body["job_id"] == sample_job.id
        assert body["status"] == "queued"
        assert body["apply_mode"] == "review"
        assert "id" in body
        assert "created_at" in body

    async def test_create_application_missing_job_id(self, client):
        response = await client.post(f"{API_PREFIX}/", json={"apply_mode": "review"})

        assert response.status_code == 422


class TestBatchCreateApplications:
    """Tests for POST /api/v1/applications/batch."""

    async def test_batch_create_success(self, client, db_session, job_data):
        # Create two jobs
        job1_data = {**job_data, "platform_job_id": "job-batch-1"}
        job2_data = {**job_data, "platform_job_id": "job-batch-2"}
        job1 = Job(**job1_data)
        job2 = Job(**job2_data)
        db_session.add_all([job1, job2])
        await db_session.commit()
        await db_session.refresh(job1)
        await db_session.refresh(job2)

        response = await client.post(
            f"{API_PREFIX}/batch",
            json={"job_ids": [job1.id, job2.id], "apply_mode": "review"},
        )

        assert response.status_code == 201
        body = response.json()
        assert len(body) == 2
        returned_job_ids = {item["job_id"] for item in body}
        assert job1.id in returned_job_ids
        assert job2.id in returned_job_ids

    async def test_batch_create_empty_list_rejected(self, client):
        response = await client.post(
            f"{API_PREFIX}/batch",
            json={"job_ids": []},
        )

        assert response.status_code == 422


class TestListApplications:
    """Tests for GET /api/v1/applications/."""

    async def test_list_empty(self, client):
        response = await client.get(f"{API_PREFIX}/")

        assert response.status_code == 200
        body = response.json()
        assert body["items"] == []
        assert body["total"] == 0

    async def test_list_with_application(self, client, sample_application):
        response = await client.get(f"{API_PREFIX}/")

        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 1
        assert len(body["items"]) == 1
        assert body["items"][0]["id"] == sample_application.id

    async def test_list_with_pagination(self, client, sample_application):
        response = await client.get(
            f"{API_PREFIX}/", params={"page": 1, "page_size": 5}
        )

        assert response.status_code == 200
        body = response.json()
        assert body["page"] == 1
        assert body["page_size"] == 5


class TestGetApplication:
    """Tests for GET /api/v1/applications/{app_id}."""

    async def test_get_nonexistent_returns_404(self, client):
        response = await client.get(f"{API_PREFIX}/nonexistent-id")

        assert response.status_code == 404

    async def test_get_existing_application(self, client, sample_application):
        response = await client.get(f"{API_PREFIX}/{sample_application.id}")

        assert response.status_code == 200
        body = response.json()
        assert body["id"] == sample_application.id
        assert body["status"] == "queued"


class TestApproveApplication:
    """Tests for PUT /api/v1/applications/{app_id}/approve."""

    async def test_approve_nonexistent_returns_404(self, client):
        response = await client.put(f"{API_PREFIX}/nonexistent-id/approve")

        assert response.status_code == 404

    async def test_approve_pending_application(self, client, sample_application):
        response = await client.put(f"{API_PREFIX}/{sample_application.id}/approve")

        assert response.status_code == 200
        body = response.json()
        assert body["id"] == sample_application.id
        assert body["status"] == "approved"


class TestUpdateApplicationStatus:
    """Tests for PUT /api/v1/applications/{app_id}/status."""

    async def test_update_status_nonexistent_returns_404(self, client):
        response = await client.put(
            f"{API_PREFIX}/nonexistent-id/status",
            json={"status": "applied"},
        )

        assert response.status_code == 404

    async def test_update_status_success(self, client, sample_application):
        response = await client.put(
            f"{API_PREFIX}/{sample_application.id}/status",
            json={"status": "applied", "notes": "Submitted via LinkedIn"},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "applied"
        assert body["notes"] == "Submitted via LinkedIn"
        assert body["applied_at"] is not None

    async def test_update_status_without_notes(self, client, sample_application):
        response = await client.put(
            f"{API_PREFIX}/{sample_application.id}/status",
            json={"status": "interview"},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "interview"
