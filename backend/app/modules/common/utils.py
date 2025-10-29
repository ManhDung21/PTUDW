
"""Common utilities shared across modules."""

import re
from datetime import datetime, timezone

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
PHONE_REGEX = re.compile(r"^[0-9]{10,11}$")


def is_email(identifier: str) -> bool:
    """Return True if the string matches a valid email address."""
    return bool(EMAIL_REGEX.match(identifier or ""))


def is_phone_number(identifier: str) -> bool:
    """Return True if the string looks like a Vietnamese phone number."""
    return bool(PHONE_REGEX.match(identifier or ""))


def normalize_email(email: str) -> str:
    """Normalize email strings before saving/searching."""
    return (email or "").strip().lower()


def utcnow() -> datetime:
    """Return aware UTC timestamps to keep storage consistent."""
    return datetime.now(timezone.utc)
