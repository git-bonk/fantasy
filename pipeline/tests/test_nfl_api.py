from fantasynfl.nfl_api import AthleteSeason, parse_athlete_stats


def _cat(name, labels, rows):
    return {
        "name": name,
        "labels": labels,
        "statistics": [
            {"teamSlug": slug, "season": {"year": year}, "stats": stats}
            for slug, year, stats in rows
        ],
    }


def test_parses_receiving_and_rushing_with_commas():
    payload = {
        "categories": [
            _cat(
                "receiving",
                ["GP", "REC", "TGTS", "YDS", "AVG", "TD", "LNG", "FD", "FUM", "LST"],
                [
                    (
                        "seattle-seahawks",
                        2025,
                        ["17", "119", "163", "1,793", "15.1", "10", "63", "79", "3", "1"],
                    )
                ],
            ),
            _cat(
                "rushing",
                ["GP", "CAR", "YDS", "AVG", "TD", "LNG", "FD", "FUM", "LST"],
                [("seattle-seahawks", 2025, ["17", "7", "36", "5.1", "0", "11", "2", "0", "0"])],
            ),
        ]
    }
    seasons = parse_athlete_stats(payload)
    assert len(seasons) == 1
    s = seasons[0]
    assert s.season_year == 2025
    assert s.nfl_team == "SEA"
    assert s.gp == 17
    assert s.stats["receivingReceptions"] == 119
    assert s.stats["receivingTargets"] == 163
    assert s.stats["receivingYards"] == 1793
    assert s.stats["receivingTouchdowns"] == 10
    assert s.stats["lostFumbles"] == 1
    assert s.stats["rushingAttempts"] == 7
    assert s.stats["rushingYards"] == 36
    assert "receivingYardsPerReception" not in s.stats


def test_parses_passing_and_skips_rates():
    payload = {
        "categories": [
            _cat(
                "passing",
                [
                    "GP",
                    "CMP",
                    "ATT",
                    "CMP%",
                    "YDS",
                    "AVG",
                    "TD",
                    "INT",
                    "LNG",
                    "SACK",
                    "RTG",
                    "QBR",
                ],
                [
                    (
                        "philadelphia-eagles",
                        2025,
                        [
                            "16",
                            "294",
                            "454",
                            "64.8",
                            "3,224",
                            "7.1",
                            "25",
                            "6",
                            "79",
                            "32",
                            "98.5",
                            "-",
                        ],
                    )
                ],
            )
        ]
    }
    s = parse_athlete_stats(payload)[0]
    assert s.stats["passingCompletions"] == 294
    assert s.stats["passingAttempts"] == 454
    assert s.stats["passingYards"] == 3224
    assert s.stats["passingTouchdowns"] == 25
    assert s.stats["passingInterceptions"] == 6
    assert len(s.stats) == 5


def test_parses_kicking_pairs():
    payload = {
        "categories": [
            _cat(
                "kicking",
                [
                    "GP",
                    "FG",
                    "FG%",
                    "1-19\t",
                    "20-29\t",
                    "30-39",
                    "40-49\t",
                    "50+",
                    "LNG",
                    "XPM",
                    "XPA",
                    "PTS",
                ],
                [
                    (
                        "dallas-cowboys",
                        2025,
                        [
                            "17",
                            "36-42",
                            "85.7",
                            "0-0",
                            "10-10",
                            "5-5",
                            "10-10",
                            "11-17",
                            "64",
                            "47",
                            "48",
                            "155",
                        ],
                    )
                ],
            )
        ]
    }
    s = parse_athlete_stats(payload)[0]
    assert s.stats["madeFieldGoals"] == 36
    assert s.stats["attemptedFieldGoals"] == 42
    assert s.stats["madeFieldGoalsFrom50Plus"] == 11
    assert s.stats["attemptedFieldGoalsFrom50Plus"] == 17
    assert s.stats["madeExtraPoints"] == 47
    assert s.stats["attemptedExtraPoints"] == 48


def test_skips_scoring_and_unknown_labels():
    payload = {
        "categories": [
            _cat(
                "scoring",
                ["GP", "PASS", "RUSH", "REC", "RET", "TD", "2PT", "PAT", "FG", "PTS"],
                [("x", 2025, ["16", "25", "8", "0", "0", "8", "0", "0", "0", "48"])],
            ),
            _cat("mystery", ["GP", "WHATEVER"], [("x", 2025, ["16", "9"])]),
        ]
    }
    assert parse_athlete_stats(payload) == []


def test_merges_categories_per_season_and_multi_season():
    payload = {
        "categories": [
            _cat(
                "receiving",
                ["GP", "REC", "TGTS", "YDS", "AVG", "TD", "LNG", "FD", "FUM", "LST"],
                [
                    (
                        "seattle-seahawks",
                        2023,
                        ["17", "63", "93", "628", "10.0", "4", "35", "29", "0", "0"],
                    ),
                    (
                        "seattle-seahawks",
                        2024,
                        ["17", "100", "137", "1,130", "11.3", "6", "46", "55", "1", "0"],
                    ),
                ],
            ),
            _cat(
                "rushing",
                ["GP", "CAR", "YDS", "AVG", "TD", "LNG", "FD", "FUM", "LST"],
                [("seattle-seahawks", 2024, ["17", "5", "26", "5.2", "0", "8", "1", "0", "0"])],
            ),
        ]
    }
    seasons = parse_athlete_stats(payload)
    assert [s.season_year for s in seasons] == [2023, 2024]
    assert seasons[1].nfl_team == "SEA"
    assert seasons[1].stats["receivingYards"] == 1130
    assert seasons[1].stats["rushingYards"] == 26
    assert seasons[0].stats["receivingYards"] == 628


def test_unknown_slug_is_kept_verbatim():
    payload = {
        "categories": [
            _cat(
                "receiving",
                ["GP", "REC", "TGTS", "YDS", "AVG", "TD", "LNG", "FD", "FUM", "LST"],
                [
                    (
                        "some-future-team",
                        2027,
                        ["17", "10", "15", "120", "12.0", "1", "30", "6", "0", "0"],
                    )
                ],
            )
        ]
    }
    assert parse_athlete_stats(payload)[0].nfl_team == "some-future-team"


def test_empty_categories_for_def_units():
    assert parse_athlete_stats({"categories": []}) == []
    assert parse_athlete_stats({}) == []


def test_athlete_season_is_frozen():
    s = AthleteSeason(season_year=2025, nfl_team=None, gp=None)
    assert s.stats == {}
