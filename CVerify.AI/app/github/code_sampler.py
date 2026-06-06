from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class CodeSample:
    file_content: list[str] = field(default_factory=list)
    file_names: list[str] = field(default_factory=list)


@dataclass
class CodeSamplingOptions:
    max_files: int = 10
    max_lines_per_file: int = 100
    extensions: list[str] = field(default_factory=list)


class ICodeSampler(ABC):
    @abstractmethod
    async def sample_async(self, repo: Any, token: str, options: CodeSamplingOptions) -> CodeSample:
        ...


class CodeSampler(ICodeSampler):
    async def sample_async(self, repo: Any, token: str, options: CodeSamplingOptions) -> CodeSample:
        import os
        repo_path = str(repo)
        
        file_names = []
        file_contents = []
        
        excluded_dirs = {".git", "node_modules", "bin", "obj", "dist", "vendor", "venv", "packages", "__pycache__"}
        
        package_files = []
        doc_files = []
        code_files = []
        
        package_names = {"package.json", "requirements.txt", "go.mod", "pom.xml", "cargo.toml", "docker-compose.yml"}
        doc_names = {"readme.md", "architecture.md", "contributing.md"}
        code_extensions = {".py", ".js", ".ts", ".tsx", ".cs", ".java", ".go", ".rs", ".rb", ".php"}
        
        total_size = 0
        total_files = 0
        
        for root, dirs, files in os.walk(repo_path):
            dirs[:] = [d for d in dirs if d not in excluded_dirs]
            
            for f in files:
                total_files += 1
                full_path = os.path.join(root, f)
                try:
                    total_size += os.path.getsize(full_path)
                except OSError:
                    pass
                
                rel_path = os.path.relpath(full_path, repo_path)
                lower_f = f.lower()
                
                if lower_f in package_names or f.endswith(".csproj"):
                    package_files.append((rel_path, full_path))
                elif lower_f in doc_names:
                    doc_files.append((rel_path, full_path))
                else:
                    _, ext = os.path.splitext(lower_f)
                    if ext in code_extensions:
                        try:
                            size = os.path.getsize(full_path)
                            code_files.append((rel_path, full_path, size))
                        except OSError:
                            pass
                            
        if total_files > 10000:
            raise Exception("Repository exceeds the maximum limit of 10,000 files.")
        if total_size > 150 * 1024 * 1024:
            raise Exception("Repository exceeds the maximum limit of 150MB in size.")

        def read_truncated(path: str, max_lines: int) -> str:
            lines = []
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f_in:
                    for _ in range(max_lines):
                        line = f_in.readline()
                        if not line:
                            break
                        lines.append(line)
            except Exception:
                return "[Error reading file]"
            return "".join(lines)

        for rel_path, full_path in package_files:
            file_names.append(rel_path)
            file_contents.append(read_truncated(full_path, options.max_lines_per_file))
            
        for rel_path, full_path in doc_files:
            file_names.append(rel_path)
            file_contents.append(read_truncated(full_path, options.max_lines_per_file))
            
        code_files.sort(key=lambda x: x[2], reverse=True)
        selected_code = code_files[:options.max_files]
        for rel_path, full_path, _ in selected_code:
            file_names.append(rel_path)
            file_contents.append(read_truncated(full_path, options.max_lines_per_file))
            
        return CodeSample(file_content=file_contents, file_names=file_names)
