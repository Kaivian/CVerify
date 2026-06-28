export interface AiSuggestionField {
  aiValue: string;
  source: 'user' | 'ai';
  generatedAt?: string;
}

export type AiSuggestionsMap = Record<string, AiSuggestionField>;

/**
 * Parses the AI suggestions JSON from the backend.
 */
export function parseAiSuggestions(json: string | null | undefined): AiSuggestionsMap {
  if (!json) return {};
  try {
    return JSON.parse(json) as AiSuggestionsMap;
  } catch (e) {
    console.error("Failed to parse AI suggestions JSON:", e);
    return {};
  }
}

/**
 * Stringifies the AI suggestions map for sending to the backend.
 */
export function stringifyAiSuggestions(map: AiSuggestionsMap): string {
  return JSON.stringify(map);
}

/**
 * Gets or initializes the suggestion state for a specific field.
 */
export function getFieldSuggestion(
  suggestions: AiSuggestionsMap,
  fieldName: string,
  latestAiValue?: string | null
): AiSuggestionField {
  const existing = suggestions[fieldName];
  if (existing) {
    // If backend reports a new AI value not yet in suggestions, update it
    if (latestAiValue && latestAiValue !== existing.aiValue) {
      return {
        ...existing,
        aiValue: latestAiValue,
        generatedAt: new Date().toISOString()
      };
    }
    return existing;
  }

  return {
    aiValue: latestAiValue || "",
    source: 'user',
    generatedAt: latestAiValue ? new Date().toISOString() : undefined
  };
}

/**
 * Updates suggestion state when user selects the AI suggestion.
 */
export function selectSuggestion(
  suggestions: AiSuggestionsMap,
  fieldName: string,
  aiValue: string
): AiSuggestionsMap {
  return {
    ...suggestions,
    [fieldName]: {
      aiValue,
      source: 'ai',
      generatedAt: suggestions[fieldName]?.generatedAt || new Date().toISOString()
    }
  };
}

/**
 * Updates suggestion state when user edits the value directly or chooses to keep their own.
 */
export function selectUserValue(
  suggestions: AiSuggestionsMap,
  fieldName: string
): AiSuggestionsMap {
  const existing = suggestions[fieldName];
  return {
    ...suggestions,
    [fieldName]: {
      aiValue: existing?.aiValue || "",
      source: 'user',
      generatedAt: existing?.generatedAt
    }
  };
}
