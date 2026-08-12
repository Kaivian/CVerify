import logging
from typing import Dict, Any, Type, Optional, Callable, List
from pydantic import BaseModel

logger = logging.getLogger("schema_versioning")

DEFAULT_SCHEMA_VERSION = "2.0.0"

class ContractRegistry:
    _registry: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def register_contract(
        cls,
        task_name: str,
        version: str,
        model_cls: Optional[Type[BaseModel]] = None,
        custom_validator: Optional[Callable[[Dict[str, Any]], List[str]]] = None
    ):
        if task_name not in cls._registry:
            cls._registry[task_name] = {}
        
        cls._registry[task_name][version] = {
            "model_cls": model_cls,
            "custom_validator": custom_validator
        }
        logger.info(f"Registered schema contract for task '{task_name}' v{version}")

    @classmethod
    def get_contract(cls, task_name: str, version: str = DEFAULT_SCHEMA_VERSION) -> Optional[Dict[str, Any]]:
        task_schemas = cls._registry.get(task_name)
        if not task_schemas:
            return None
        return task_schemas.get(version) or task_schemas.get(DEFAULT_SCHEMA_VERSION)
