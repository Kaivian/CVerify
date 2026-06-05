import json
from abc import ABC, abstractmethod
from typing import Any, Type, TypeVar

T = TypeVar("T")


class IStructuredOutputParser(ABC):
    @abstractmethod
    def parse(self, response: str, target_type: Type[T]) -> T:
        ...


class JsonSchemaValidator(IStructuredOutputParser):
    def parse(self, response: str, target_type: Type[T]) -> T:
        try:
            data = json.loads(response)
        except json.JSONDecodeError as e:
            raise ValueError("Response is not valid JSON") from e

        if isinstance(data, dict):
            try:
                return target_type(**data)  # type: ignore[misc]
            except TypeError as e:
                raise ValueError(
                    f"JSON object does not match constructor for {getattr(target_type, '__name__', target_type)}"
                ) from e
        return data  # type: ignore[return-value]
