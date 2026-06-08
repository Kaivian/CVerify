import { PipelineDefinition } from "./types";

class PipelineRegistry {
  private definitions = new Map<string, PipelineDefinition>();

  register(definition: PipelineDefinition) {
    this.definitions.set(definition.pipelineId, definition);
  }

  get(pipelineId: string): PipelineDefinition | undefined {
    return this.definitions.get(pipelineId);
  }

  getAll(): PipelineDefinition[] {
    return Array.from(this.definitions.values());
  }
}

export const pipelineRegistry = new PipelineRegistry();
