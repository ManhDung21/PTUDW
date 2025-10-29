"""Helpers for interacting with Google Gemini models."""

from typing import Optional

import google.generativeai as genai


_MODEL: Optional[genai.GenerativeModel] = None


def get_model(api_key: str, model_name: str = "gemini-2.5-flash-preview-05-20") -> genai.GenerativeModel:
    """Return a cached Gemini model instance."""
    global _MODEL
    if _MODEL is None:
        genai.configure(api_key=api_key)
        _MODEL = genai.GenerativeModel(model_name)
    return _MODEL
