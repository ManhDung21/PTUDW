# Notification & Event Flow

This document summarizes the notification events emitted by the backend, their triggers, target recipients, and example payloads. Channels currently supported: `in_app`. Email/Push can reuse the same metadata once providers are wired.

## Supported Event Types

| Event Type | Trigger | Recipients | Default Channel |
|------------|---------|------------|-----------------|
| `order_created` | Buyer places order via `/orders/checkout` | Buyer & Seller | in_app |
| `order_processing` | Seller confirms order (`/orders/{id}/confirm`) | Buyer | in_app |
| `order_shipping` | Seller marks ready-to-ship (`/orders/{id}/ready-to-ship`) or shipment created | Buyer | in_app |
| `order_delivered` | Seller marks delivered (`/orders/{id}/delivered`) or shipping webhook returns `delivered` | Buyer | in_app |
| `order_refunded` | Admin triggers refund (`/orders/{id}/refund`) | Buyer & Seller | in_app |
| `payment_paid` | MoMo/VNPay webhook success | Buyer & Seller | in_app |
| `payment_failed` | MoMo/VNPay webhook failure | Buyer | in_app |
| `shipment_created` | Shipping label created (`/shipping/orders/{id}` POST) | Buyer | in_app |
| `shipment_update` | Shipping webhook or manual update | Buyer (seller when cancelled/returned) | in_app |
| `chat_message` | Buyer/Seller sends chat message (`/chat/threads/{id}/messages`) | Counterparty | in_app |

## Sample Notification Payload

```json
{
  "_id": "66f0a1f4b4e9f8e3b1234567",
  "user_id": "66f0a1dea5a4bfe0c1234567",
  "type": "order_shipping",
  "title": "Order is on the way",
  "message": "Order ORD-20241027123000 is being prepared for shipment.",
  "metadata": {
    "order_id": "66f0a1dee7890fe0c1234567",
    "order_code": "ORD-20241027123000",
    "status": "shipping"
  },
  "is_read": false,
  "created_at": "2024-10-27T12:31:00Z",
  "read_at": null
}
```

## Preferences API

### GET `/notifications/preferences`
Returns merged defaults plus user overrides (currently for `in_app` channel).

```json
{
  "items": [
    {"event_type": "order_created", "channel": "in_app", "enabled": true, "created_at": null, "updated_at": null},
    {"event_type": "payment_paid", "channel": "in_app", "enabled": false, "created_at": "2024-10-27T12:34:00Z", "updated_at": "2024-10-27T12:34:00Z"},
    ...
  ]
}
```

### PUT `/notifications/preferences`
```
{
  "event_type": "payment_paid",
  "channel": "in_app",
  "enabled": false
}
```

## Unread Count API

`GET /notifications` response includes `unread_count` for quick badge rendering.

## Environment Variables

Add to `.env` (optional for future providers):
```
# Notification defaults
NOTIFICATION_DEFAULT_CHANNEL=in_app
```

## TODO / Next Steps
- Connect Resend/FCM and extend service to dispatch email/push.
- Socket.IO subscription for real-time delivery.
- Admin UI to manage global notification templates.
