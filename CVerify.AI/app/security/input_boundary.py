MAX_TOKENS = 8000
MAX_CV_TEXT = 50000


class InputBoundary:
    def validate_token_count(self, text: str) -> None:
        # Implementation will go here - enforce token limits
        pass

    def validate_cv_size(self, text: str) -> None:
        if len(text) > MAX_CV_TEXT:
            raise ValueError(f"CV text exceeds maximum size of {MAX_CV_TEXT} characters")
