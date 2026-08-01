"""Identifier helpers."""
import uuid


def new_id() -> str:
    """Return a fresh random UUID4 string suitable for a primary key."""
    return str(uuid.uuid4())
