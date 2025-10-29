from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    gemini_api_key: str = Field(..., alias="GEMINI_API_KEY")
    jwt_secret: str = Field(..., alias="JWT_SECRET")
    mongodb_uri: str = Field(default="mongodb://localhost:27017", alias="MONGODB_URI")
    mongodb_db: str = Field(default="ptud2", alias="MONGODB_DB")
    debug: bool = Field(default=True)
    app_name: str = Field(default="AI Product Description Generator")
    cors_allow_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"], alias="CORS_ALLOW_ORIGINS")
    cors_allow_origin_regex: str | None = Field(default=r"https://.*\.vercel\.app", alias="CORS_ALLOW_ORIGIN_REGEX")
    smtp_host: str | None = Field(default=None, alias="SMTP_HOST")
    smtp_port: int | None = Field(default=None, alias="SMTP_PORT")
    smtp_username: str | None = Field(default=None, alias="SMTP_USERNAME")
    smtp_password: str | None = Field(default=None, alias="SMTP_PASSWORD")
    smtp_sender: str | None = Field(default=None, alias="SMTP_SENDER")
    cloudinary_cloud_name: str | None = Field(default=None, alias="CLOUDINARY_CLOUD_NAME")
    cloudinary_api_key: str | None = Field(default=None, alias="CLOUDINARY_API_KEY")
    cloudinary_api_secret: str | None = Field(default=None, alias="CLOUDINARY_API_SECRET")
    resend_api_key: str | None = Field(default=None, alias="RESEND_API_KEY")
    resend_sender: str | None = Field(default=None, alias="RESEND_SENDER")

    # MoMo sandbox
    momo_partner_code: str | None = Field(default=None, alias="MOMO_PARTNER_CODE")
    momo_access_key: str | None = Field(default=None, alias="MOMO_ACCESS_KEY")
    momo_secret_key: str | None = Field(default=None, alias="MOMO_SECRET_KEY")
    momo_endpoint: str = Field(default="https://test-payment.momo.vn/v2/gateway/api/create", alias="MOMO_ENDPOINT")
    momo_ipn_secret: str | None = Field(default=None, alias="MOMO_IPN_SECRET")
    momo_redirect_url: str | None = Field(default=None, alias="MOMO_REDIRECT_URL")
    momo_ipn_url: str | None = Field(default=None, alias="MOMO_IPN_URL")

    # VNPay sandbox
    vnpay_tmn_code: str | None = Field(default=None, alias="VNPAY_TMN_CODE")
    vnpay_hash_secret: str | None = Field(default=None, alias="VNPAY_HASH_SECRET")
    vnpay_return_url: str | None = Field(default=None, alias="VNPAY_RETURN_URL")
    vnpay_ipn_url: str | None = Field(default=None, alias="VNPAY_IPN_URL")
    vnpay_base_url: str = Field(default="https://sandbox.vnpayment.vn/paymentv2/vpcpay.html", alias="VNPAY_BASE_URL")
    vnpay_api_url: str = Field(default="https://sandbox.vnpayment.vn/merchant_webapi/api/transaction", alias="VNPAY_API_URL")

    # Cấu hình đọc file .env
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: list[str] | str | None) -> list[str]:
        if value is None:
            return ["http://localhost:3000"]
        if isinstance(value, str):
            items = [item.strip() for item in value.split(",") if item.strip()]
            return items or ["http://localhost:3000"]
        if not value:
            return ["http://localhost:3000"]
        return value


@lru_cache()
def get_settings() -> Settings:
    return Settings()
