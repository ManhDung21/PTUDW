"""Type hints for MongoDB documents used in the application."""

from datetime import datetime
from typing import Any, Optional, TypedDict

from bson import ObjectId


class UserDocument(TypedDict, total=False):
    _id: ObjectId
    email: Optional[str]
    phone_number: Optional[str]
    hashed_password: str
    role: str  # buyer, seller, admin
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserProfileDocument(TypedDict, total=False):
    _id: ObjectId
    user_id: ObjectId
    display_name: Optional[str]
    avatar_url: Optional[str]
    gender: Optional[str]
    date_of_birth: Optional[datetime]
    bio: Optional[str]
    created_at: datetime
    updated_at: datetime


class AddressDocument(TypedDict, total=False):
    _id: ObjectId
    user_id: ObjectId
    label: Optional[str]
    recipient_name: str
    phone_number: str
    address_line: str
    ward: Optional[str]
    district: Optional[str]
    province: Optional[str]
    postal_code: Optional[str]
    country: str
    is_default: bool
    created_at: datetime
    updated_at: datetime


class SellerDocument(TypedDict, total=False):
    _id: ObjectId
    user_id: ObjectId
    shop_name: str
    slug: str
    description: Optional[str]
    logo_url: Optional[str]
    cover_image_url: Optional[str]
    status: str  # pending, approved, rejected, suspended
    verification_notes: Optional[str]
    social_links: list[str]
    created_at: datetime
    updated_at: datetime


class CategoryDocument(TypedDict, total=False):
    _id: ObjectId
    name: str
    slug: str
    parent_id: Optional[ObjectId]
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TagDocument(TypedDict, total=False):
    _id: ObjectId
    name: str
    slug: str
    created_at: datetime
    updated_at: datetime


class ProductVariantDocument(TypedDict, total=False):
    _id: ObjectId
    sku: str
    attributes: dict[str, str]
    price: float
    compare_at_price: Optional[float]
    stock_quantity: int
    low_stock_threshold: int
    weight_grams: Optional[int]
    barcode: Optional[str]
    created_at: datetime
    updated_at: datetime


class ProductDocument(TypedDict, total=False):
    _id: ObjectId
    seller_id: ObjectId
    name: str
    slug: str
    summary: Optional[str]
    description_ai_id: Optional[ObjectId]
    description_custom: Optional[str]
    seo_title: Optional[str]
    seo_description: Optional[str]
    categories: list[ObjectId]
    tags: list[str]
    status: str  # draft, active, inactive, archived
    thumbnail_url: Optional[str]
    image_urls: list[str]
    variants: list[ProductVariantDocument]
    attributes: dict[str, str]
    base_price: float
    unit: Optional[str]
    min_order_quantity: int
    media: list[dict]
    created_at: datetime
    updated_at: datetime


class InventoryLogDocument(TypedDict, total=False):
    _id: ObjectId
    product_id: ObjectId
    variant_id: Optional[ObjectId]
    delta: int
    reason: str
    note: Optional[str]
    created_at: datetime
    created_by: ObjectId


class DescriptionDocument(TypedDict, total=False):
    _id: ObjectId
    user_id: Optional[ObjectId]
    timestamp: datetime
    source: str
    style: str
    content: str
    image_path: Optional[str]


class PasswordResetTokenDocument(TypedDict, total=False):
    _id: ObjectId
    user_id: ObjectId
    token_hash: str
    created_at: datetime
    expires_at: datetime
    used: bool


class CartItemDocument(TypedDict, total=False):
    item_id: ObjectId
    product_id: ObjectId
    variant_id: Optional[ObjectId]
    product_name: str
    variant_name: Optional[str]
    thumbnail_url: Optional[str]
    attributes: dict[str, str]
    quantity: int
    price: float
    compare_at_price: Optional[float]
    created_at: datetime
    updated_at: datetime


class CartDocument(TypedDict, total=False):
    _id: ObjectId
    user_id: ObjectId
    items: list[CartItemDocument]
    updated_at: datetime


class FavoriteDocument(TypedDict, total=False):
    _id: ObjectId
    user_id: ObjectId
    product_id: ObjectId
    product_name: str
    thumbnail_url: Optional[str]
    created_at: datetime


class OrderItemDocument(TypedDict, total=False):
    product_id: ObjectId
    variant_id: Optional[ObjectId]
    product_name: str
    sku: Optional[str]
    quantity: int
    price: float
    total_amount: float
    thumbnail_url: Optional[str]
    attributes: dict[str, str]


class OrderTimelineEntryDocument(TypedDict, total=False):
    status: str
    note: Optional[str]
    created_at: datetime
    actor_id: Optional[ObjectId]


class OrderDocument(TypedDict, total=False):
    _id: ObjectId
    buyer_id: ObjectId
    seller_id: ObjectId
    order_code: str
    address_snapshot: dict
    payment_method: str
    payment_status: str
    fulfillment_status: str
    subtotal_amount: float
    total_amount: float
    shipping_fee: float
    discount_amount: float
    items: list[OrderItemDocument]
    timeline: list[OrderTimelineEntryDocument]
    tracking_number: Optional[str]
    created_at: datetime
    updated_at: datetime
    note: Optional[str]


class PaymentDocument(TypedDict, total=False):
    _id: ObjectId
    order_id: ObjectId
    order_code: str
    provider: str
    amount: float
    currency: str
    transaction_id: Optional[str]
    request_id: Optional[str]
    payment_url: Optional[str]
    status: str  # pending, paid, failed, refunded
    raw_payload: dict
    created_at: datetime
    updated_at: datetime


class ShipmentDocument(TypedDict, total=False):
    _id: ObjectId
    order_id: ObjectId
    provider: str
    tracking_number: str
    status: str
    status_history: list[dict]
    estimated_delivery: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    payload: dict[str, Any]


class ReturnRequestDocument(TypedDict, total=False):
    _id: ObjectId
    order_id: ObjectId
    order_item_id: ObjectId
    user_id: ObjectId
    reason: str
    status: str  # pending, approved, rejected, refunded
    notes: list[dict]
    created_at: datetime
    updated_at: datetime


class ReviewDocument(TypedDict, total=False):
    _id: ObjectId
    product_id: ObjectId
    order_id: ObjectId
    user_id: ObjectId
    rating: int
    content: str
    image_urls: list[str]
    status: str  # pending, published, hidden
    created_at: datetime
    updated_at: datetime


class NotificationPreferenceDocument(TypedDict, total=False):
    _id: ObjectId
    user_id: ObjectId
    channel: str  # in_app, email, push
    enabled: bool
    event_type: str
    created_at: datetime
    updated_at: datetime


class NotificationDocument(TypedDict, total=False):
    _id: ObjectId
    user_id: ObjectId
    type: str
    title: str
    message: str
    metadata: dict
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime]

    created_at: datetime
    read_at: Optional[datetime]


class ChatThreadDocument(TypedDict, total=False):
    _id: ObjectId
    buyer_id: ObjectId
    seller_id: ObjectId
    order_id: ObjectId
    last_message_at: datetime
    created_at: datetime
    updated_at: datetime
    last_message_preview: Optional[str]


class ChatMessageDocument(TypedDict, total=False):
    _id: ObjectId
    thread_id: ObjectId
    sender_id: ObjectId
    message_type: str  # text, image, system
    content: str
    attachments: list[str]
    is_read: bool
    created_at: datetime
    order_id: Optional[ObjectId]
