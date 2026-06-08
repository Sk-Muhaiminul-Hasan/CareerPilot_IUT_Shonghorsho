"""Supabase Storage client.

Wraps the ``supabase-py`` client so the rest of the codebase never
touches local filesystem paths for resume or generated-document storage.

All backend storage operations use ``SUPABASE_SERVICE_ROLE_KEY`` so
bucket-level RLS policies do not block server-side uploads.

Buckets
-------
- ``resumes`` - user-uploaded base resumes (PDF / DOCX).
- ``generated`` - tailored resumes and cover letters produced by the backend.

Both buckets must be created as **private** in the Supabase dashboard
before any of these helpers will work.  Files are served to callers
via short-lived signed URLs (default 1 hour) rather than public URLs.
"""

from __future__ import annotations

from typing import Any

import structlog
from app.config.settings import get_settings

logger = structlog.get_logger(__name__)


class StorageError(Exception):
    """Raised when a Supabase Storage operation fails."""


class SupabaseStorage:
    """Thin async-friendly wrapper around ``supabase-py`` Storage.

    Parameters
    ----------
    bucket_resumes:
        Name of the bucket used for user-uploaded resumes.
    bucket_generated:
        Name of the bucket used for AI-generated documents.
    """

    def __init__(
        self,
        bucket_resumes: str = "resumes",
        bucket_generated: str = "generated",
    ) -> None:
        self._bucket_resumes = bucket_resumes
        self._bucket_generated = bucket_generated
        self._client = self._build_client()

    @staticmethod
    def _build_client() -> Any:
        settings = get_settings()
        url = settings.supabase_url
        key = settings.supabase_service_role_key
        if not url or not key:
            raise StorageError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment"
            )
        try:
            from supabase import create_client
        except ImportError as exc:
            raise StorageError(
                "supabase-py is not installed. Add 'supabase' to requirements.txt."
            ) from exc
        return create_client(url, key)

    @property
    def _resumes(self) -> Any:
        return self._client.storage.from_(self._bucket_resumes)

    @property
    def _generated(self) -> Any:
        return self._client.storage.from_(self._bucket_generated)

    async def upload_file(
        self,
        bucket: str,
        path: str,
        file_bytes: bytes,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Upload raw bytes to Supabase Storage.

        Parameters
        ----------
        bucket:
            Either ``"resumes"`` or ``"generated"``.
        path:
            Storage object path, e.g. ``"user_123/resume_abc.pdf"``.
        file_bytes:
            Raw file contents to upload.
        content_type:
            MIME type sent as the ``content-type`` metadata.

        Returns
        -------
        str
            The *path* argument that was stored (useful as a DB value).

        Raises
        ------
        StorageError
            If the upload fails.
        """
        client = self._resumes if bucket == "resumes" else self._generated
        try:
            options = {"contentType": content_type}
            client.upload(path, file_bytes, options)
        except Exception as exc:
            logger.error("storage.upload_failed", bucket=bucket, path=path, error=str(exc))
            raise StorageError(f"Upload failed: {exc}") from exc
        logger.info("storage.uploaded", bucket=bucket, path=path, size=len(file_bytes))
        return path

    async def get_signed_url(
        self,
        bucket: str,
        path: str,
        expires_in: int = 3600,
    ) -> str:
        """Return a temporary signed download URL for a private file.

        Parameters
        ----------
        bucket:
            Either ``"resumes"`` or ``"generated"``.
        path:
            Storage object path.
        expires_in:
            URL validity window in seconds (default 3600 = 1 hour).

        Returns
        -------
        str
            Absolute signed URL.

        Raises
        ------
        StorageError
            If the signed URL cannot be created (e.g. file does not exist).
        """
        client = self._resumes if bucket == "resumes" else self._generated
        try:
            response = client.create_signed_url(path, expires_in)
        except Exception as exc:
            logger.error(
                "storage.signed_url_failed",
                bucket=bucket,
                path=path,
                error=str(exc),
            )
            raise StorageError(f"Failed to create signed URL: {exc}") from exc

        signed_url = (
            response.get("signedURL")
            or response.get("signed_url")
            or response.get("signedUrl")
        )
        if not signed_url:
            raise StorageError(
                f"Unexpected signed URL response: {response!r}"
            )
        return signed_url

    async def delete_file(self, bucket: str, path: str) -> None:
        """Delete a file from Supabase Storage.

        Parameters
        ----------
        bucket:
            Either ``"resumes"`` or ``"generated"``.
        path:
            Storage object path to remove.

        Raises
        ------
        StorageError
            If the delete operation fails.
        """
        client = self._resumes if bucket == "resumes" else self._generated
        try:
            client.remove([path])
        except Exception as exc:
            logger.error(
                "storage.delete_failed",
                bucket=bucket,
                path=path,
                error=str(exc),
            )
            raise StorageError(f"Delete failed: {exc}") from exc
        logger.info("storage.deleted", bucket=bucket, path=path)


storage = SupabaseStorage()
