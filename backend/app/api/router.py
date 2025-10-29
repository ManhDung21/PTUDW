
"""Aggregated API router mounting all module routers."""

from fastapi import APIRouter

from ..modules.admin.router import router as admin_router
from ..modules.chat.router import router as chat_router
from ..modules.notifications.router import router as notifications_router
from ..modules.cart.router import favorites_router, router as cart_router
from ..modules.catalog.router import router as catalog_router
from ..modules.orders.router import router as orders_router
from ..modules.payments.router import router as payments_router
from ..modules.shipping.router import admin_router as shipping_admin_router, router as shipping_router
from ..modules.sellers.router import admin_router as sellers_admin_router, router as sellers_router
from ..modules.users.router import auth_router, router as users_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(admin_router)
api_router.include_router(sellers_admin_router)
api_router.include_router(sellers_router)
api_router.include_router(payments_router)
api_router.include_router(shipping_router)
api_router.include_router(shipping_admin_router)
api_router.include_router(chat_router)
api_router.include_router(notifications_router)
api_router.include_router(cart_router)
api_router.include_router(favorites_router)
api_router.include_router(orders_router)
api_router.include_router(catalog_router)
