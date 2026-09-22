import sys
import os
import pytest

# Ensure app root and workspace root are on Python sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from tests.fixtures.pdf_generator import generate_all_fixtures


@pytest.fixture(scope="session", autouse=True)
def setup_test_fixtures():
    fixtures_dir = os.path.join(os.path.dirname(__file__), "fixtures")
    generate_all_fixtures(fixtures_dir)
