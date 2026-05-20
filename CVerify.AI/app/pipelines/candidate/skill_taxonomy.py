"""
skill_taxonomy.py
=================
Maintained skill taxonomy dictionary for L2-001 SkillTaxonomyMapper.

Maps raw skill names → (normalized_name, sfia_category, onet_code).
Used by the orchestrator to pre-normalize before AI mapping, reducing
hallucination risk and ensuring consistent output.
"""

from __future__ import annotations
from typing import NamedTuple


class TaxonomyEntry(NamedTuple):
    normalized_name: str
    sfia_category: str
    onet_code: str


# ---------------------------------------------------------------------------
# Normalization table: raw_name_lower → TaxonomyEntry
# ---------------------------------------------------------------------------
SKILL_TAXONOMY: dict[str, TaxonomyEntry] = {
    # JavaScript / Frontend
    "reactjs": TaxonomyEntry("React", "Software Development", "15-1252.00"),
    "react.js": TaxonomyEntry("React", "Software Development", "15-1252.00"),
    "react": TaxonomyEntry("React", "Software Development", "15-1252.00"),
    "vuejs": TaxonomyEntry("Vue.js", "Software Development", "15-1252.00"),
    "vue.js": TaxonomyEntry("Vue.js", "Software Development", "15-1252.00"),
    "vue": TaxonomyEntry("Vue.js", "Software Development", "15-1252.00"),
    "angular": TaxonomyEntry("Angular", "Software Development", "15-1252.00"),
    "angularjs": TaxonomyEntry("Angular", "Software Development", "15-1252.00"),
    "next.js": TaxonomyEntry("Next.js", "Software Development", "15-1252.00"),
    "nextjs": TaxonomyEntry("Next.js", "Software Development", "15-1252.00"),
    "nuxt.js": TaxonomyEntry("Nuxt.js", "Software Development", "15-1252.00"),
    "nuxtjs": TaxonomyEntry("Nuxt.js", "Software Development", "15-1252.00"),
    "svelte": TaxonomyEntry("Svelte", "Software Development", "15-1252.00"),
    "typescript": TaxonomyEntry("TypeScript", "Software Development", "15-1252.00"),
    "javascript": TaxonomyEntry("JavaScript", "Software Development", "15-1252.00"),
    "js": TaxonomyEntry("JavaScript", "Software Development", "15-1252.00"),
    "ts": TaxonomyEntry("TypeScript", "Software Development", "15-1252.00"),
    "webpack": TaxonomyEntry("Webpack", "Software Development", "15-1252.00"),
    "vite": TaxonomyEntry("Vite", "Software Development", "15-1252.00"),
    "tailwind": TaxonomyEntry("Tailwind CSS", "Software Development", "15-1252.00"),
    "tailwindcss": TaxonomyEntry("Tailwind CSS", "Software Development", "15-1252.00"),
    "node": TaxonomyEntry("Node.js", "Software Development", "15-1252.00"),
    "nodejs": TaxonomyEntry("Node.js", "Software Development", "15-1252.00"),
    "node.js": TaxonomyEntry("Node.js", "Software Development", "15-1252.00"),
    "mern": TaxonomyEntry("MERN Stack", "Software Development", "15-1252.00"),
    "mern stack": TaxonomyEntry("MERN Stack", "Software Development", "15-1252.00"),

    # Backend / Frameworks
    "spring boot": TaxonomyEntry("Spring Framework", "Software Development", "15-1252.00"),
    "spring-boot": TaxonomyEntry("Spring Framework", "Software Development", "15-1252.00"),
    "springboot": TaxonomyEntry("Spring Framework", "Software Development", "15-1252.00"),
    "spring": TaxonomyEntry("Spring Framework", "Software Development", "15-1252.00"),
    "fastapi": TaxonomyEntry("FastAPI", "Software Development", "15-1252.00"),
    "django": TaxonomyEntry("Django", "Software Development", "15-1252.00"),
    "flask": TaxonomyEntry("Flask", "Software Development", "15-1252.00"),
    "express": TaxonomyEntry("Express.js", "Software Development", "15-1252.00"),
    "express.js": TaxonomyEntry("Express.js", "Software Development", "15-1252.00"),
    "expressjs": TaxonomyEntry("Express.js", "Software Development", "15-1252.00"),
    "nestjs": TaxonomyEntry("NestJS", "Software Development", "15-1252.00"),
    "nest.js": TaxonomyEntry("NestJS", "Software Development", "15-1252.00"),
    "laravel": TaxonomyEntry("Laravel", "Software Development", "15-1252.00"),
    "rails": TaxonomyEntry("Ruby on Rails", "Software Development", "15-1252.00"),
    "ruby on rails": TaxonomyEntry("Ruby on Rails", "Software Development", "15-1252.00"),
    "asp.net": TaxonomyEntry("ASP.NET", "Software Development", "15-1252.00"),
    "asp.net core": TaxonomyEntry("ASP.NET Core", "Software Development", "15-1252.00"),
    "gin": TaxonomyEntry("Gin (Go)", "Software Development", "15-1252.00"),
    "fiber": TaxonomyEntry("Fiber (Go)", "Software Development", "15-1252.00"),

    # Programming Languages
    "python": TaxonomyEntry("Python", "Programming/Scripting", "15-1252.00"),
    "java": TaxonomyEntry("Java", "Programming/Scripting", "15-1252.00"),
    "c#": TaxonomyEntry("C#", "Programming/Scripting", "15-1252.00"),
    "csharp": TaxonomyEntry("C#", "Programming/Scripting", "15-1252.00"),
    "c++": TaxonomyEntry("C++", "Programming/Scripting", "15-1252.00"),
    "cpp": TaxonomyEntry("C++", "Programming/Scripting", "15-1252.00"),
    "golang": TaxonomyEntry("Go", "Programming/Scripting", "15-1252.00"),
    "go": TaxonomyEntry("Go", "Programming/Scripting", "15-1252.00"),
    "rust": TaxonomyEntry("Rust", "Programming/Scripting", "15-1252.00"),
    "kotlin": TaxonomyEntry("Kotlin", "Programming/Scripting", "15-1252.00"),
    "swift": TaxonomyEntry("Swift", "Programming/Scripting", "15-1252.00"),
    "ruby": TaxonomyEntry("Ruby", "Programming/Scripting", "15-1252.00"),
    "php": TaxonomyEntry("PHP", "Programming/Scripting", "15-1252.00"),
    "scala": TaxonomyEntry("Scala", "Programming/Scripting", "15-1252.00"),
    "r": TaxonomyEntry("R", "Data Science", "15-2041.00"),
    "matlab": TaxonomyEntry("MATLAB", "Data Science", "15-2041.00"),

    # Databases
    "postgresql": TaxonomyEntry("PostgreSQL", "Database Administration", "15-1245.00"),
    "postgres": TaxonomyEntry("PostgreSQL", "Database Administration", "15-1245.00"),
    "mysql": TaxonomyEntry("MySQL", "Database Administration", "15-1245.00"),
    "mongodb": TaxonomyEntry("MongoDB", "Database Administration", "15-1245.00"),
    "mongo": TaxonomyEntry("MongoDB", "Database Administration", "15-1245.00"),
    "mongodb & mongoose": TaxonomyEntry("MongoDB", "Database Administration", "15-1245.00"),
    "mongoose": TaxonomyEntry("MongoDB", "Database Administration", "15-1245.00"),
    "redis": TaxonomyEntry("Redis", "Database Administration", "15-1245.00"),
    "sqlite": TaxonomyEntry("SQLite", "Database Administration", "15-1245.00"),
    "mssql": TaxonomyEntry("SQL Server", "Database Administration", "15-1245.00"),
    "sql server": TaxonomyEntry("SQL Server", "Database Administration", "15-1245.00"),
    "oracle": TaxonomyEntry("Oracle DB", "Database Administration", "15-1245.00"),
    "cassandra": TaxonomyEntry("Cassandra", "Database Administration", "15-1245.00"),
    "elasticsearch": TaxonomyEntry("Elasticsearch", "Database Administration", "15-1245.00"),
    "dynamodb": TaxonomyEntry("DynamoDB", "Database Administration", "15-1245.00"),

    # DevOps / Infrastructure
    "docker": TaxonomyEntry("Docker", "Infrastructure Management", "15-1244.00"),
    "kubernetes": TaxonomyEntry("Kubernetes", "Infrastructure Management", "15-1244.00"),
    "k8s": TaxonomyEntry("Kubernetes", "Infrastructure Management", "15-1244.00"),
    "terraform": TaxonomyEntry("Terraform", "Infrastructure Management", "15-1244.00"),
    "ansible": TaxonomyEntry("Ansible", "Infrastructure Management", "15-1244.00"),
    "jenkins": TaxonomyEntry("Jenkins", "Software Configuration Management", "15-1244.00"),
    "github actions": TaxonomyEntry("GitHub Actions", "Software Configuration Management", "15-1244.00"),
    "github-actions": TaxonomyEntry("GitHub Actions", "Software Configuration Management", "15-1244.00"),
    "gitlab ci": TaxonomyEntry("GitLab CI/CD", "Software Configuration Management", "15-1244.00"),
    "gitlab-ci": TaxonomyEntry("GitLab CI/CD", "Software Configuration Management", "15-1244.00"),
    "ci/cd": TaxonomyEntry("CI/CD", "Software Configuration Management", "15-1244.00"),
    "helm": TaxonomyEntry("Helm", "Infrastructure Management", "15-1244.00"),
    "aws": TaxonomyEntry("AWS", "Cloud Computing", "15-1244.00"),
    "gcp": TaxonomyEntry("Google Cloud Platform", "Cloud Computing", "15-1244.00"),
    "google cloud": TaxonomyEntry("Google Cloud Platform", "Cloud Computing", "15-1244.00"),
    "azure": TaxonomyEntry("Microsoft Azure", "Cloud Computing", "15-1244.00"),

    # Architecture / Patterns
    "microservices": TaxonomyEntry("Microservices Architecture", "Solution Architecture", "15-1299.08"),
    "rest api": TaxonomyEntry("REST API Design", "Solution Architecture", "15-1299.08"),
    "restful": TaxonomyEntry("REST API Design", "Solution Architecture", "15-1299.08"),
    "graphql": TaxonomyEntry("GraphQL", "Solution Architecture", "15-1299.08"),
    "grpc": TaxonomyEntry("gRPC", "Solution Architecture", "15-1299.08"),
    "message queue": TaxonomyEntry("Message Queue Systems", "Solution Architecture", "15-1299.08"),
    "rabbitmq": TaxonomyEntry("RabbitMQ", "Solution Architecture", "15-1299.08"),
    "kafka": TaxonomyEntry("Apache Kafka", "Solution Architecture", "15-1299.08"),
    "clean architecture": TaxonomyEntry("Clean Architecture", "Solution Architecture", "15-1299.08"),
    "ddd": TaxonomyEntry("Domain-Driven Design", "Solution Architecture", "15-1299.08"),
    "domain-driven design": TaxonomyEntry("Domain-Driven Design", "Solution Architecture", "15-1299.08"),
    "cqrs": TaxonomyEntry("CQRS", "Solution Architecture", "15-1299.08"),
    "event sourcing": TaxonomyEntry("Event Sourcing", "Solution Architecture", "15-1299.08"),
    "dependency injection": TaxonomyEntry("Dependency Injection", "Solution Architecture", "15-1299.08"),
    "di": TaxonomyEntry("Dependency Injection", "Solution Architecture", "15-1299.08"),
    "solid": TaxonomyEntry("SOLID Principles", "Solution Architecture", "15-1299.08"),

    # AI / ML
    "machine learning": TaxonomyEntry("Machine Learning", "Data Science", "15-2051.00"),
    "ml": TaxonomyEntry("Machine Learning", "Data Science", "15-2051.00"),
    "deep learning": TaxonomyEntry("Deep Learning", "Data Science", "15-2051.00"),
    "tensorflow": TaxonomyEntry("TensorFlow", "Data Science", "15-2051.00"),
    "pytorch": TaxonomyEntry("PyTorch", "Data Science", "15-2051.00"),
    "scikit-learn": TaxonomyEntry("Scikit-learn", "Data Science", "15-2051.00"),
    "sklearn": TaxonomyEntry("Scikit-learn", "Data Science", "15-2051.00"),
    "nlp": TaxonomyEntry("Natural Language Processing", "Data Science", "15-2051.00"),
    "llm": TaxonomyEntry("Large Language Models", "Data Science", "15-2051.00"),

    # Mobile
    "android": TaxonomyEntry("Android Development", "Mobile Development", "15-1252.00"),
    "ios": TaxonomyEntry("iOS Development", "Mobile Development", "15-1252.00"),
    "react native": TaxonomyEntry("React Native", "Mobile Development", "15-1252.00"),
    "flutter": TaxonomyEntry("Flutter", "Mobile Development", "15-1252.00"),

    # Testing
    "jest": TaxonomyEntry("Jest", "Software Testing", "15-1253.00"),
    "pytest": TaxonomyEntry("Pytest", "Software Testing", "15-1253.00"),
    "junit": TaxonomyEntry("JUnit", "Software Testing", "15-1253.00"),
    "selenium": TaxonomyEntry("Selenium", "Software Testing", "15-1253.00"),
    "playwright": TaxonomyEntry("Playwright", "Software Testing", "15-1253.00"),
    "cypress": TaxonomyEntry("Cypress", "Software Testing", "15-1253.00"),
    "tdd": TaxonomyEntry("Test-Driven Development", "Software Testing", "15-1253.00"),
    "bdd": TaxonomyEntry("Behavior-Driven Development", "Software Testing", "15-1253.00"),

    # VCS / Collaboration
    "git": TaxonomyEntry("Git", "Software Configuration Management", "15-1299.08"),
    "github": TaxonomyEntry("GitHub", "Software Configuration Management", "15-1299.08"),
    "gitlab": TaxonomyEntry("GitLab", "Software Configuration Management", "15-1299.08"),

    # Security
    "oauth": TaxonomyEntry("OAuth 2.0", "Information Security", "15-1212.00"),
    "oauth2": TaxonomyEntry("OAuth 2.0", "Information Security", "15-1212.00"),
    "jwt": TaxonomyEntry("JWT", "Information Security", "15-1212.00"),
    "ssl/tls": TaxonomyEntry("SSL/TLS", "Information Security", "15-1212.00"),
    "owasp": TaxonomyEntry("OWASP Security", "Information Security", "15-1212.00"),

    # Data
    "sql": TaxonomyEntry("SQL", "Database Administration", "15-1245.00"),
    "nosql": TaxonomyEntry("NoSQL", "Database Administration", "15-1245.00"),
    "etl": TaxonomyEntry("ETL Pipeline", "Data Engineering", "15-2051.00"),
    "spark": TaxonomyEntry("Apache Spark", "Data Engineering", "15-2051.00"),
    "hadoop": TaxonomyEntry("Hadoop", "Data Engineering", "15-2051.00"),
    "airflow": TaxonomyEntry("Apache Airflow", "Data Engineering", "15-2051.00"),
}


def normalize_skill(raw_name: str) -> TaxonomyEntry | None:
    """Return the taxonomy entry for a raw skill name, or None if not found."""
    return SKILL_TAXONOMY.get(raw_name.strip().lower())


def get_taxonomy_hints() -> dict[str, str]:
    """Return {normalized_name: sfia_category} for all known skills (for AI context)."""
    seen: dict[str, str] = {}
    for entry in SKILL_TAXONOMY.values():
        seen[entry.normalized_name] = entry.sfia_category
    return seen


def normalize_batch(raw_names: list[str]) -> list[dict]:
    """
    Normalize a list of raw skill names.
    Returns list of dicts with rawName, normalizedName, sfiaCategory, onetCode, found.
    """
    results = []
    for raw in raw_names:
        entry = normalize_skill(raw)
        if entry:
            results.append({
                "rawName": raw,
                "normalizedName": entry.normalized_name,
                "sfiaCategory": entry.sfia_category,
                "onetCode": entry.onet_code,
                "found": True,
            })
        else:
            results.append({
                "rawName": raw,
                "normalizedName": raw,
                "sfiaCategory": "Unknown",
                "onetCode": "",
                "found": False,
            })
    return results
