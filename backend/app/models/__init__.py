"""ORM models. Importing this module registers all tables on Base.metadata."""
from app.models.conversation import Conversation
from app.models.job import Job
from app.models.memory_entry import MemoryEntry
from app.models.message import Message
from app.models.notification import Notification
from app.models.preference import Preference
from app.models.project import Project
from app.models.reminder import Reminder
from app.models.settings_record import SettingsRecord

__all__ = [
    "Conversation",
    "Message",
    "Project",
    "Preference",
    "Notification",
    "Reminder",
    "MemoryEntry",
    "SettingsRecord",
    "Job",
]
