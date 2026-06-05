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


class ConversionData(BaseModel):
    total: int
    by_variant: dict[str, int]
    rate: dict[str, float]


class StatisticalSignificance(BaseModel):
    p_value: Optional[float]
    is_significant: bool
    confidence: float
    winner: Optional[str]


class AnomalyWarning(BaseModel):
    variant: str
    message: str


class ExperimentAnalyticsResponse(BaseModel):
    impressions: ImpressionData
    conversions: ConversionData
    statistical_significance: StatisticalSignificance
    anomalies: list[AnomalyWarning]
