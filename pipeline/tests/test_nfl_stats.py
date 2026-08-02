from fantasynfl.nfl_stats import REAL_STATS, extract_real_stats


def test_keeps_real_counters():
    breakdown = {
        "rushingAttempts": 19.0,
        "rushingYards": 38.0,
        "rushingTouchdowns": 1.0,
        "receivingReceptions": 2.0,
    }
    assert extract_real_stats(breakdown) == breakdown


def test_drops_fantasy_buckets_and_noise():
    breakdown = {
        "rushingYards": 70.0,
        "27": 14.0,
        "210": 1.0,
        "teamWin": 1.0,
        "pointsScored": 6.0,
        "rushingYardsPerAttempt": 11.7,
    }
    assert extract_real_stats(breakdown) == {"rushingYards": 70.0}


def test_drops_zero_values_and_empty():
    assert extract_real_stats({"passingInterceptions": 0.0}) == {}
    assert extract_real_stats({}) == {}
    assert extract_real_stats(None) == {}


def test_real_stats_are_named_keys():
    assert all(not key.isdigit() for key in REAL_STATS)
