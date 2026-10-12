"""
Tests for the mock-data seed target guard (backend.devtools.mock_data.guard).

Pure logic: no database, no network. These rules protect the shared
hosted database from ever being seeded by accident.
"""

from backend.devtools.mock_data.guard import (
    Target,
    check_seed_target,
    describe_target,
    is_cloud_target,
    parse_target,
)


def test_parse_target_extracts_parts_without_password():
    target = parse_target(
        "postgresql+asyncpg://jodtod_dev:supersecret@127.0.0.1:55432/jodtod_local"
    )
    assert target.host == "127.0.0.1"
    assert target.database == "jodtod_local"
    assert target.user == "jodtod_dev"
    # Password never leaks into the summary.
    assert "supersecret" not in describe_target(target)


def test_parse_target_handles_psycopg_scheme():
    target = parse_target(
        "postgresql://jodtod_dev:pw@localhost:5432/jodtod_local"
    )
    assert (target.host, target.database, target.user) == (
        "localhost",
        "jodtod_local",
        "jodtod_dev",
    )


def test_cloud_target_detected_by_host_or_user():
    assert is_cloud_target(
        Target("aws-0-ap.pooler.supabase.com", "postgres", "postgres.abc")
    )
    assert is_cloud_target(Target("db.proj.supabase.co", "postgres", "x"))
    assert not is_cloud_target(
        Target("127.0.0.1", "jodtod_local", "jodtod_dev")
    )


def test_local_target_allowed_without_allow_remote():
    reason = check_seed_target(
        Target("127.0.0.1", "jodtod_local", "jodtod_dev")
    )
    assert reason is None


def test_cloud_target_refused_even_with_allow_remote():
    reason = check_seed_target(
        Target("aws-0.pooler.supabase.com", "postgres", "postgres.abc"),
        allow_remote=True,
    )
    assert reason is not None
    assert "shared hosted database" in reason


def test_non_local_host_refused_by_default_allowed_with_opt_in():
    target = Target("10.0.0.5", "jodtod_local", "jodtod_dev")
    assert check_seed_target(target) is not None
    assert check_seed_target(target, allow_remote=True) is None


def test_expect_db_and_user_must_match():
    target = Target("127.0.0.1", "jodtod_local", "jodtod_dev")
    assert check_seed_target(target, expect_db="jodtod_local") is None
    assert check_seed_target(target, expect_user="jodtod_dev") is None
    assert check_seed_target(target, expect_db="other") is not None
    assert check_seed_target(target, expect_user="root") is not None
