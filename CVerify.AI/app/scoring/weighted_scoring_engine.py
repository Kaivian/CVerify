from abc import ABC, abstractmethod


class IWeightedScoringEngine(ABC):
    @abstractmethod
    def calculate_composite_score(self, dimensions: dict[str, float], weights: dict[str, float]) -> float:
        ...


class WeightedScoringEngine(IWeightedScoringEngine):
    def calculate_composite_score(self, dimensions: dict[str, float], weights: dict[str, float]) -> float:
        total_weight = sum(weights.get(k, 0) for k in dimensions)
        if total_weight == 0:
            return 0.0
        return sum(dimensions[k] * weights.get(k, 0) for k in dimensions) / total_weight
