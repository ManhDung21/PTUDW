"""MongoDB connection utilities and helpers."""

from typing import Optional

from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.database import Database

from ..config import get_settings

settings = get_settings()

_client: Optional[MongoClient] = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(settings.mongodb_uri)
    return _client


def get_database() -> Database:
    return get_client()[settings.mongodb_db]


def init_db() -> None:
    """Ensure collections and indexes exist."""
    db = get_database()

    users = db.get_collection("users")
    users.create_index("email", unique=True, sparse=True)
    users.create_index("phone_number", unique=True, sparse=True)
    users.create_index("role")
    users.create_index("created_at")

    descriptions = db.get_collection("descriptions")
    descriptions.create_index([("user_id", ASCENDING), ("timestamp", DESCENDING)])

    tokens = db.get_collection("password_reset_tokens")
    tokens.create_index("user_id")
    tokens.create_index("created_at")

    profiles = db.get_collection("user_profiles")
    profiles.create_index("user_id", unique=True)

    addresses = db.get_collection("addresses")
    addresses.create_index("user_id")
    addresses.create_index([("user_id", ASCENDING), ("is_default", DESCENDING)])

    sellers = db.get_collection("sellers")
    sellers.create_index("user_id", unique=True, sparse=True)
    sellers.create_index("slug", unique=True)
    sellers.create_index("status")

    categories = db.get_collection("categories")
    categories.create_index("slug", unique=True)
    categories.create_index("parent_id")
    categories.create_index("is_active")

    tags = db.get_collection("tags")
    tags.create_index("slug", unique=True)

    products = db.get_collection("products")
    products.create_index("seller_id")
    products.create_index("slug", unique=True)
    products.create_index("status")
    products.create_index("categories")
    products.create_index("tags")
    products.create_index([("name", ASCENDING), ("status", ASCENDING)])
    products.create_index(
        [("name", "text"), ("summary", "text"), ("tags", "text")],
        name="product_text_search",
    )

    inventory_logs = db.get_collection("inventory_logs")
    inventory_logs.create_index("product_id")
    inventory_logs.create_index("variant_id")
    inventory_logs.create_index("created_at")

    carts = db.get_collection("carts")
    carts.create_index("user_id", unique=True)

    favorites = db.get_collection("favorites")
    favorites.create_index([("user_id", ASCENDING), ("product_id", ASCENDING)], unique=True)

    orders = db.get_collection("orders")
    orders.create_index("buyer_id")
    orders.create_index("seller_id")
    orders.create_index("payment_status")
    orders.create_index("fulfillment_status")
    orders.create_index("created_at")

    payments = db.get_collection("payments")
    payments.create_index("order_id")
    payments.create_index("provider")
    payments.create_index("status")
    payments.create_index("order_code")

    shipments = db.get_collection("shipments")
    shipments.create_index("order_id")
    shipments.create_index("tracking_number", unique=True, sparse=True)
    shipments.create_index("status")

    returns = db.get_collection("returns")
    returns.create_index("order_id")
    returns.create_index("order_item_id")
    returns.create_index("status")

    reviews = db.get_collection("reviews")
    reviews.create_index("product_id")
    reviews.create_index("user_id")
    reviews.create_index("status")

    notifications = db.get_collection("notifications")
    notifications.create_index("user_id")
    notifications.create_index("is_read")
    notifications.create_index("created_at")

    notification_preferences = db.get_collection("notification_preferences")
    notification_preferences.create_index([("user_id", ASCENDING), ("event_type", ASCENDING), ("channel", ASCENDING)], unique=True)


    chat_threads = db.get_collection("chat_threads")
    chat_threads.create_index(
        [("buyer_id", ASCENDING), ("seller_id", ASCENDING), ("order_id", ASCENDING)],
        unique=True,
    )
    chat_threads.create_index("last_message_at")

    chat_messages = db.get_collection("chat_messages")
    chat_messages.create_index("thread_id")
    chat_messages.create_index("sender_id")
    chat_messages.create_index("created_at")
    chat_messages.create_index("order_id")
