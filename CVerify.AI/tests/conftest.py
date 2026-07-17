import os
import json
import pytest
from unittest.mock import AsyncMock, MagicMock

@pytest.fixture
def snapshot_verify(request):
    """
    Fixture to perform snapshot testing.
    Compares the given data with the snapshot file stored in tests/snapshots/<name>_snapshot.json.
    Use pytest option --update-snapshots to update snapshots.
    """
    def _verify(name: str, data: any):
        snapshot_dir = os.path.join(os.path.dirname(__file__), "snapshots")
        os.makedirs(snapshot_dir, exist_ok=True)
        snapshot_path = os.path.join(snapshot_dir, f"{name}_snapshot.json")
        
        update_requested = request.config.getoption("--update-snapshots", default=False)
        
        if update_requested or not os.path.exists(snapshot_path):
            with open(snapshot_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            return True
            
        with open(snapshot_path, "r", encoding="utf-8") as f:
            expected = json.load(f)
            
        # Perform comparison. We convert to JSON and back to handle tuple/list differences
        serialized_data = json.loads(json.dumps(data))
        serialized_expected = json.loads(json.dumps(expected))
        assert serialized_data == serialized_expected, f"Snapshot mismatch for '{name}'."
    return _verify

def pytest_addoption(parser):
    parser.addoption(
        "--update-snapshots",
        action="store_true",
        default=False,
        help="Update saved snapshot files for AI-generated artifacts.",
    )
