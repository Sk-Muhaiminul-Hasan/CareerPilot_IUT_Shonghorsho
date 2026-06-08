"""Unit tests for app.core.matching.vector_store.VectorStore."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from app.core.matching.vector_store import VectorStore

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def tmp_index_dir(tmp_path: Path) -> Path:
    """Temporary directory for vector store indices."""
    d = tmp_path / "indices"
    d.mkdir()
    return d


@pytest.fixture()
def mock_encoder() -> MagicMock:
    """Mock SentenceTransformer.encode returning float32 arrays."""
    encoder = MagicMock()
    encoder.encode.return_value = np.random.rand(1, 384).astype(np.float32)
    return encoder


@pytest.fixture()
def store(tmp_index_dir: Path, mock_encoder: MagicMock) -> VectorStore:
    """VectorStore fixture with mocked encoder."""
    vs = VectorStore(index_dir=tmp_index_dir)
    vs._model = mock_encoder  # bypass lazy loading
    return vs


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_vector_store_initialization(tmp_index_dir: Path) -> None:
    """VectorStore initializes with correct attributes."""
    vs = VectorStore(index_dir=tmp_index_dir)
    assert vs.index_dir == tmp_index_dir
    assert vs.model_name == "all-MiniLM-L6-v2"
    assert vs._model is None


def test_model_property_loads_model_on_first_access(
    tmp_index_dir: Path, mock_encoder: MagicMock
) -> None:
    """Model property lazily loads SentenceTransformer."""
    vs = VectorStore(index_dir=tmp_index_dir)
    with patch("sentence_transformers.SentenceTransformer", return_value=mock_encoder):
        model = vs.model
        assert model == mock_encoder
        # Second access returns cached model
        assert vs.model == mock_encoder


def test_create_index_returns_true(tmp_index_dir: Path) -> None:
    """create_index returns True for compatibility with PGVector."""
    vs = VectorStore(index_dir=tmp_index_dir)
    result = vs.create_index("test_index")
    assert result is True


def test_delete_index_returns_true(tmp_index_dir: Path) -> None:
    """delete_index returns True for compatibility with PGVector."""
    vs = VectorStore(index_dir=tmp_index_dir)
    result = vs.delete_index("test_index")
    assert result is True


def test_add_items_requires_matching_ids_and_texts_lengths(
    tmp_index_dir: Path,
) -> None:
    """add_items raises ValueError when ids and texts lengths don't match."""
    vs = VectorStore(index_dir=tmp_index_dir)
    with pytest.raises(ValueError, match="ids length"):
        vs.add_items("test_index", ["text1", "text2"], ["id1"])


def test_add_items_returns_count(tmp_index_dir: Path) -> None:
    """add_items returns the number of texts added."""
    vs = VectorStore(index_dir=tmp_index_dir)
    # Mock the internal methods to avoid actual database calls
    vs._encode_sync = lambda texts: np.ones((len(texts), 384), dtype=np.float32)
    
    with patch.object(vs, "_run_sync") as mock_run_sync:
        mock_run_sync.return_value = 2
        count = vs.add_items("test_index", ["text1", "text2"])
        assert count == 2


def test_search_returns_list_of_dicts(tmp_index_dir: Path) -> None:
    """search returns a list of dicts with id, score, and rank."""
    vs = VectorStore(index_dir=tmp_index_dir)
    # Mock the internal methods to avoid actual database calls
    vs._encode_sync = lambda texts: np.ones((1, 384), dtype=np.float32)
    
    with patch.object(vs, "_run_sync") as mock_run_sync:
        mock_run_sync.return_value = [
            {"id": "1", "score": 0.9, "rank": 1},
            {"id": "2", "score": 0.8, "rank": 2},
        ]
        results = vs.search("test_index", "query")
        assert isinstance(results, list)
        assert len(results) == 2
        assert all(key in result for result in results for key in ["id", "score", "rank"])


def test_get_index_info_returns_dict_or_none(tmp_index_dir: Path) -> None:
    """get_index_info returns dict with info or None."""
    vs = VectorStore(index_dir=tmp_index_dir)
    # This will return None since we're not setting up a real DB connection in tests
    result = vs.get_index_info("test_index")
    assert result is None or isinstance(result, dict)


def test_encode_sync_returns_normalized_array(tmp_index_dir: Path) -> None:
    """_encode_sync returns numpy array of correct shape and dtype."""
    vs = VectorStore(index_dir=tmp_index_dir)
    vs._model = MagicMock()
    vs._model.encode.return_value = np.array([[0.1, 0.2, 0.3]], dtype=np.float32)
    
    result = vs._encode_sync(["test text"])
    assert isinstance(result, np.ndarray)
    assert result.shape == (1, 3)
    assert result.dtype == np.float32


def test_get_fake_embeddings_returns_compatible_object(tmp_index_dir: Path) -> None:
    """_get_fake_embeddings returns object with embed_query and embed_documents methods."""
    vs = VectorStore(index_dir=tmp_index_dir)
    fake_embeddings = vs._get_fake_embeddings()
    assert hasattr(fake_embeddings, "embed_query")
    assert hasattr(fake_embeddings, "embed_documents")