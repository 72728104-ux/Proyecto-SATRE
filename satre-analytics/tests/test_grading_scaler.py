from app.services.deterministic.grading_scaler import PeruvianGradingScaler


def test_qualitative_to_numeric_conversion():
    assert PeruvianGradingScaler.to_numeric("AD") == 19.0
    assert PeruvianGradingScaler.to_numeric("A") == 15.5
    assert PeruvianGradingScaler.to_numeric("B") == 12.0
    assert PeruvianGradingScaler.to_numeric("C") == 8.0


def test_qualitative_to_numeric_is_case_and_whitespace_insensitive():
    assert PeruvianGradingScaler.to_numeric(" ad ") == 19.0
    assert PeruvianGradingScaler.to_numeric("a") == 15.5
    assert PeruvianGradingScaler.to_numeric(None) == 8.0
    assert PeruvianGradingScaler.to_numeric("Z") == 8.0


def test_numeric_to_qualitative_conversion():
    assert PeruvianGradingScaler.to_qualitative(18.5) == "AD"
    assert PeruvianGradingScaler.to_qualitative(15.0) == "A"
    assert PeruvianGradingScaler.to_qualitative(11.5) == "B"
    assert PeruvianGradingScaler.to_qualitative(7.0) == "C"


def test_numeric_to_qualitative_official_minedu_boundaries():
    assert PeruvianGradingScaler.to_qualitative(20.0) == "AD"
    assert PeruvianGradingScaler.to_qualitative(18.0) == "AD"
    assert PeruvianGradingScaler.to_qualitative(17.9) == "A"
    assert PeruvianGradingScaler.to_qualitative(14.0) == "A"
    assert PeruvianGradingScaler.to_qualitative(13.9) == "B"
    assert PeruvianGradingScaler.to_qualitative(11.0) == "B"
    assert PeruvianGradingScaler.to_qualitative(10.9) == "C"
    assert PeruvianGradingScaler.to_qualitative(0.0) == "C"


def test_roundtrip_representative_centroids():
    for label in ("AD", "A", "B", "C"):
        numeric = PeruvianGradingScaler.to_numeric(label)
        assert PeruvianGradingScaler.to_qualitative(numeric) == label
