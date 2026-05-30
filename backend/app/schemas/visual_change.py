from pydantic import BaseModel


class VisualChangeCreate(BaseModel):
    variation_key: str
    selector: str
    type: str
    value: str


class VisualChange(BaseModel):
    id: str
    experiment_id: str
    variation_key: str
    selector: str
    type: str
    value: str
    created_at: str
