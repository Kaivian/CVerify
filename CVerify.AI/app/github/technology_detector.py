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
        # Implementation will go here - detect from package.json, *.csproj, etc.
        return []

    def detect_from_filenames(self, filenames: list[str]) -> list[str]:
        techs = set()
        for name in filenames:
            ext = "." + name.rsplit(".", 1)[-1] if "." in name else ""
            if ext in _EXTENSION_MAP:
                techs.add(_EXTENSION_MAP[ext])
        return list(techs)
