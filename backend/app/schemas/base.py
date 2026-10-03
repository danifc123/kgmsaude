from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base dos schemas: snake_case no Python, camelCase no JSON."""

    model_config = ConfigDict(alias_generator=to_camel, from_attributes=True, populate_by_name=True)
