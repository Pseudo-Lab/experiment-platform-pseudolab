from pydantic import BaseModel
from typing import Optional


class ImpressionTimeSeries(BaseModel):
    date: str
    count: int


class ImpressionData(BaseModel):
    total: int
    by_variant: dict[str, int]
    by_url: dict[str, int]
    time_series: list[ImpressionTimeSeries]
    time_series_by_variant: dict[str, list[ImpressionTimeSeries]] = {}


class ConversionData(BaseModel):
    total: int
    by_variant: dict[str, int]
    rate: dict[str, float]


class VariantSignificance(BaseModel):
    variant: str
    p_value_raw: Optional[float]
    p_value: Optional[float]  # Bonferroni-corrected
    is_significant: bool


class StatisticalSignificance(BaseModel):
    p_value: Optional[float]
    is_significant: bool
    confidence: float
    winner: Optional[str]
    per_variant: list[VariantSignificance] = []


class AnomalyWarning(BaseModel):
    variant: str
    message: str


class ExperimentAnalyticsResponse(BaseModel):
    impressions: ImpressionData
    conversions: ConversionData
    statistical_significance: StatisticalSignificance
    anomalies: list[AnomalyWarning]
    srm_warning: bool = False


class AvailableEventsResponse(BaseModel):
    event_types: list[str]
    has_impressions: bool
    has_conversions: bool
    conversion_events: list[str]
    total_events: int
