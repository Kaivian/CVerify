from abc import ABC, abstractmethod


class IPipelineMetrics(ABC):
    @abstractmethod
    def record_latency(self, stage: str, milliseconds_elapsed: int) -> None:
        ...

    @abstractmethod
    def record_token_usage(self, model: str, token_count: int) -> None:
        ...


class PipelineMetrics(IPipelineMetrics):
    def record_latency(self, stage: str, milliseconds_elapsed: int) -> None:
        # Implementation will go here - collect metrics
        pass

    def record_token_usage(self, model: str, token_count: int) -> None:
        # Implementation will go here
        pass
