from abc import ABC, abstractmethod
from typing import Any


class ITechnologyDetector(ABC):
    @abstractmethod
    def detect_from_package_files(self, files: list[Any]) -> list[str]:
        ...

    @abstractmethod
    def detect_from_filenames(self, filenames: list[str]) -> list[str]:
        ...


_EXTENSION_MAP = {
    ".py": "Python",
    ".js": "JavaScript",
    ".ts": "TypeScript",
    ".cs": "C#",
    ".java": "Java",
    ".go": "Go",
    ".rs": "Rust",
    ".rb": "Ruby",
    ".php": "PHP",
}


class TechnologyDetector(ITechnologyDetector):
    def detect_from_package_files(self, files: list[Any]) -> list[str]:
        techs = set()
        for content in files:
            if not isinstance(content, str):
                continue
            content_lower = content.lower()
            if "react" in content_lower:
                techs.add("React")
            if "vue" in content_lower:
                techs.add("Vue")
            if "angular" in content_lower:
                techs.add("Angular")
            if "django" in content_lower:
                techs.add("Django")
            if "flask" in content_lower:
                techs.add("Flask")
            if "fastapi" in content_lower:
                techs.add("FastAPI")
            if "next" in content_lower:
                techs.add("Next.js")
            if "express" in content_lower:
                techs.add("Express")
            if "nestjs" in content_lower or "nest" in content_lower:
                techs.add("NestJS")
            if "spring" in content_lower or "springboot" in content_lower:
                techs.add("Spring Boot")
            if "netcoreapp" in content_lower or "net8" in content_lower or "net9" in content_lower or "aspnetcore" in content_lower:
                techs.add(".NET Core")
        return list(techs)

    def detect_from_filenames(self, filenames: list[str]) -> list[str]:
        techs = set()
        for name in filenames:
            ext = "." + name.rsplit(".", 1)[-1] if "." in name else ""
            if ext in _EXTENSION_MAP:
                techs.add(_EXTENSION_MAP[ext])
        return list(techs)
