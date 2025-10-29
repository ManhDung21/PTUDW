"""FastAPI application entrypoint backed by MongoDB."""

from datetime import datetime, timedelta
from io import BytesIO
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError
from pymongo.collection import Collection
from pymongo.database import Database
import socketio

from .api.router import api_router
from .config import get_settings
from .db.models import DescriptionDocument, PasswordResetTokenDocument, UserDocument
from .db.session import get_database, init_db
from .schemas import (
    ChangePasswordRequest,
    DescriptionResponse,
    ForgotPasswordRequest,
    GenerateTextRequest,
    HistoryItem,
    MessageResponse,
    ResetPasswordRequest,
    TokenResponse,
    UserCreate,
    UserOut,
)
from .modules.common.utils import is_email, is_phone_number, normalize_email, utcnow
from .modules.users.dependencies import (
    find_user_by_identifier,
    get_current_user,
    get_current_user_optional,
    require_admin,
    token_subject,
    users_collection,
)
from .realtime.chat_namespace import ChatNamespace
from .realtime.manager import set_socket_server
from .services import auth, content, email as email_service, history as history_service
from .services import cloudinary_service

app = FastAPI(title="AI Product Description Service")

BASE_STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
IMAGES_DIR = BASE_STATIC_DIR / "images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=BASE_STATIC_DIR), name="static")
app.include_router(api_router, prefix="/api/v2")


def _descriptions_collection(db: Database) -> Collection:
    return db.get_collection("descriptions")


def _reset_tokens_collection(db: Database) -> Collection:
    return db.get_collection("password_reset_tokens")


def _user_out(user: UserDocument) -> UserOut:
    created_at = user.get("created_at") or utcnow()
    return UserOut(
        id=str(user["_id"]),
        email=normalize_email(user.get("email") or "") or None,
        phone_number=user.get("phone_number"),
        created_at=created_at.isoformat(),
    )


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    seed_admin_user()
    
    # Configure Cloudinary
    settings = get_settings()
    if settings.cloudinary_cloud_name and settings.cloudinary_api_key and settings.cloudinary_api_secret:
        cloudinary_service.configure_cloudinary(
            settings.cloudinary_cloud_name,
            settings.cloudinary_api_key,
            settings.cloudinary_api_secret
        )


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.vercel.app",
        "https://vercel.app",
        "*"  # Allow all for development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> JSONResponse:
    """Simple health-check endpoint."""
    return JSONResponse({"status": "ok"})


def seed_admin_user() -> None:
    db = get_database()
    users = users_collection(db)
    email = normalize_email("admin@example.com")
    if users.find_one({"email": email}):
        return
    admin: UserDocument = {
        "email": email,
        "phone_number": None,
        "hashed_password": auth.hash_password("123456"),
        "role": "admin",
        "is_active": True,
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    users.insert_one(admin)


@app.post("/auth/register", response_model=TokenResponse)
def register(payload: UserCreate, db: Database = Depends(get_database)) -> TokenResponse:
    users = users_collection(db)
    identifier = payload.identifier.strip()

    if is_email(identifier):
        email = normalize_email(identifier)
        phone_number = None
        if users.find_one({"email": email}):
            raise HTTPException(status_code=400, detail="Email ─æ├ú tß╗ôn tß║íi")
    elif is_phone_number(identifier):
        email = None
        phone_number = identifier
        if users.find_one({"phone_number": phone_number}):
            raise HTTPException(status_code=400, detail="Sß╗æ ─æiß╗çn thoß║íi ─æ├ú tß╗ôn tß║íi")
    else:
        raise HTTPException(status_code=400, detail="Vui l├▓ng nhß║¡p email hoß║╖c sß╗æ ─æiß╗çn thoß║íi hß╗úp lß╗ç")

    user: UserDocument = {
        "hashed_password": auth.hash_password(payload.password),
        "role": "buyer",
        "is_active": True,
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }

    if email is not None:
        user["email"] = email
    if phone_number is not None:
        user["phone_number"] = phone_number
    result = users.insert_one(user)

    subject = email or phone_number or str(result.inserted_id)
    token = auth.create_access_token(subject)
    return TokenResponse(access_token=token)


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: UserCreate, db: Database = Depends(get_database)) -> TokenResponse:
    users = users_collection(db)
    identifier = payload.identifier.strip()

    user = find_user_by_identifier(db, identifier)

    if not user or not auth.verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Th├┤ng tin ─æ─âng nhß║¡p kh├┤ng ch├¡nh x├íc")

    token = auth.create_access_token(token_subject(user))
    return TokenResponse(access_token=token)


@app.post("/auth/forgot-password", response_model=MessageResponse)
def forgot_password(
    payload: ForgotPasswordRequest,
    db: Database = Depends(get_database),
) -> MessageResponse:
    identifier = payload.identifier.strip()
    if not is_email(identifier):
        raise HTTPException(status_code=400, detail="Vui l├▓ng nhß║¡p email hß╗úp lß╗ç")

    users = users_collection(db)
    tokens = _reset_tokens_collection(db)

    email = identifier.lower()
    user = users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=400, detail="Email ch╞░a ─æ╞░ß╗úc ─æ─âng k├╜")

    tokens.update_many({"user_id": user["_id"], "used": False}, {"$set": {"used": True}})

    code, token_hash = auth.generate_reset_token()
    reset_entry: PasswordResetTokenDocument = {
        "user_id": user["_id"],
        "token_hash": token_hash,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(minutes=30),
        "used": False,
    }
    result = tokens.insert_one(reset_entry)
    reset_entry["_id"] = result.inserted_id

    try:
        mail_sent = email_service.send_password_reset_code(email, code)
    except RuntimeError as exc:
        tokens.delete_one({"_id": reset_entry["_id"]})
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    message = "─É├ú gß╗¡i m├ú x├íc thß╗▒c tß╗¢i email cß╗ºa bß║ín."
    if not mail_sent:
        message += " (Chß║┐ ─æß╗Ö debug: kiß╗âm tra log m├íy chß╗º ─æß╗â lß║Ñy m├ú.)"
    return MessageResponse(message=message)


@app.post("/auth/reset-password", response_model=MessageResponse)
def reset_password(
    payload: ResetPasswordRequest,
    db: Database = Depends(get_database),
) -> MessageResponse:
    identifier = payload.identifier.strip()
    if not is_email(identifier):
        raise HTTPException(status_code=400, detail="Vui l├▓ng nhß║¡p email hß╗úp lß╗ç")

    users = users_collection(db)
    tokens = _reset_tokens_collection(db)

    email = identifier.lower()
    user = users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=400, detail="Email ch╞░a ─æ╞░ß╗úc ─æ─âng k├╜")

    token_entry = tokens.find_one(
        {"user_id": user["_id"], "used": False},
        sort=[("created_at", -1)],
    )

    if not token_entry or not auth.match_reset_token(payload.token, token_entry["token_hash"]):
        raise HTTPException(status_code=400, detail="M├ú x├íc thß╗▒c kh├┤ng hß╗úp lß╗ç")

    if token_entry.get("expires_at", datetime.utcnow()) < datetime.utcnow():
        tokens.update_one({"_id": token_entry["_id"]}, {"$set": {"used": True}})
        raise HTTPException(status_code=400, detail="M├ú x├íc thß╗▒c ─æ├ú hß║┐t hß║ín")

    users.update_one(
        {"_id": user["_id"]},
        {"$set": {"hashed_password": auth.hash_password(payload.new_password)}},
    )
    tokens.update_one({"_id": token_entry["_id"]}, {"$set": {"used": True}})

    return MessageResponse(message="Mß║¡t khß║⌐u ─æ├ú ─æ╞░ß╗úc ─æß║╖t lß║íi th├ánh c├┤ng.")


@app.post("/auth/change-password", response_model=MessageResponse)
def change_password(
    payload: ChangePasswordRequest,
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> MessageResponse:
    users = users_collection(db)
    user = users.find_one({"_id": current_user["_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="Kh├┤ng t├¼m thß║Ñy ng╞░ß╗¥i d├╣ng")

    if not auth.verify_password(payload.current_password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Mß║¡t khß║⌐u hiß╗çn tß║íi kh├┤ng ch├¡nh x├íc")

    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="Mß║¡t khß║⌐u mß╗¢i phß║úi kh├íc mß║¡t khß║⌐u hiß╗çn tß║íi")

    users.update_one(
        {"_id": user["_id"]},
        {"$set": {"hashed_password": auth.hash_password(payload.new_password)}},
    )

    return MessageResponse(message="─É├ú ─æß╗òi mß║¡t khß║⌐u th├ánh c├┤ng.")


@app.get("/auth/me", response_model=UserOut)
def me(current_user: UserDocument = Depends(get_current_user)) -> UserOut:
    return _user_out(current_user)


def _store_description(
    descriptions: Collection,
    description: DescriptionDocument,
) -> DescriptionDocument:
    result = descriptions.insert_one(description)
    description["_id"] = result.inserted_id
    return description


@app.post("/api/descriptions/image", response_model=DescriptionResponse)
async def generate_description_from_image(
    file: UploadFile = File(...),
    style: str = Form("Tiß║┐p thß╗ï"),
    current_user: Optional[UserDocument] = Depends(get_current_user_optional),
    db: Database = Depends(get_database),
) -> DescriptionResponse:
    settings = get_settings()

    try:
        image_bytes = await file.read()
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=400, detail="Tß╗çp h├¼nh ß║únh kh├┤ng hß╗úp lß╗ç") from exc

    # Upload image to Cloudinary
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png"}:
        suffix = ".jpg"
    filename = f"{uuid4().hex}{suffix}"
    
    # Try to upload to Cloudinary, fallback to local storage if fails
    cloudinary_url: Optional[str] = None
    if settings.cloudinary_cloud_name and settings.cloudinary_api_key and settings.cloudinary_api_secret:
        cloudinary_url = cloudinary_service.upload_image(image, filename)
    
    # Fallback to local storage if Cloudinary is not configured or upload fails
    image_url: Optional[str] = None
    stored_image_path: Optional[str] = None
    if cloudinary_url:
        image_url = cloudinary_url
        stored_image_path = cloudinary_url
    else:
        # Save locally as fallback
        relative_image_path = Path("images") / filename
        image_path: Optional[Path] = None
        try:
            image_path = IMAGES_DIR / filename
            save_kwargs = {}
            if suffix in {".jpg", ".jpeg"}:
                save_kwargs["format"] = "JPEG"
            elif suffix == ".png":
                save_kwargs["format"] = "PNG"
            image.save(image_path, **save_kwargs)
            if image_path:
                image_url = f"/static/{relative_image_path.as_posix()}"
                stored_image_path = relative_image_path.as_posix()
        except Exception:  # noqa: BLE001
            pass

    description_text = content.generate_from_image(settings.gemini_api_key, image, style)
    if not description_text:
        raise HTTPException(status_code=502, detail="Kh├┤ng tß║ío ─æ╞░ß╗úc m├┤ tß║ú tß╗½ h├¼nh ß║únh")

    history_payload = None
    if current_user:
        description_doc: DescriptionDocument = {
            "user_id": current_user["_id"],
            "timestamp": datetime.utcnow(),
            "source": "image",
            "style": style,
            "content": description_text,
            "image_path": stored_image_path,
        }
        stored = _store_description(_descriptions_collection(db), description_doc)
        history_payload = history_service.history_item_from_doc(stored)

    return DescriptionResponse(
        description=description_text,
        history_id=history_payload["id"] if history_payload else "",
        timestamp=history_payload["timestamp"] if history_payload else datetime.utcnow().isoformat(),
        style=style,
        source="image",
        image_url=history_payload.get("image_url") if history_payload else image_url,
    )


@app.post("/api/descriptions/text", response_model=DescriptionResponse)
async def generate_description_from_text(
    payload: GenerateTextRequest,
    current_user: Optional[UserDocument] = Depends(get_current_user_optional),
    db: Database = Depends(get_database),
) -> DescriptionResponse:
    settings = get_settings()

    description_text = content.generate_from_text(settings.gemini_api_key, payload.product_info, payload.style)
    if not description_text:
        raise HTTPException(status_code=502, detail="Kh├┤ng tß║ío ─æ╞░ß╗úc m├┤ tß║ú tß╗½ v─ân bß║ún")

    history_payload = None
    if current_user:
        description_doc: DescriptionDocument = {
            "user_id": current_user["_id"],
            "timestamp": datetime.utcnow(),
            "source": "text",
            "style": payload.style,
            "content": description_text,
            "image_path": None,
        }
        stored = _store_description(_descriptions_collection(db), description_doc)
        history_payload = history_service.history_item_from_doc(stored)

    return DescriptionResponse(
        description=description_text,
        history_id=history_payload["id"] if history_payload else "",
        timestamp=history_payload["timestamp"] if history_payload else datetime.utcnow().isoformat(),
        style=payload.style,
        source="text",
        image_url=history_payload.get("image_url") if history_payload else None,
    )


@app.get("/api/history", response_model=list[HistoryItem])
def get_history(
    limit: int = 20,
    current_user: UserDocument = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> list[HistoryItem]:
    """Return recent description history."""
    entries = history_service.get_history_for_user(
        _descriptions_collection(db),
        current_user["_id"],
        limit,
    )
    return [HistoryItem(**entry) for entry in entries]


@app.get("/api/styles")
def get_styles() -> JSONResponse:
    """Return supported writing styles."""
    return JSONResponse(sorted(content.STYLE_PROMPTS.keys()))


@app.get("/users", response_model=list[UserOut])
def get_all_users(
    db: Database = Depends(get_database),
) -> list[UserOut]:
    """Get all users (no authentication required)."""
    users = users_collection(db).find()
    return [_user_out(user) for user in users]


# --- Socket.IO integration -------------------------------------------------
fastapi_app = app
socket_server = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=["*"],
    ping_interval=25,
    ping_timeout=60,
    logger=False,
    engineio_logger=False,
)
socket_server.register_namespace(ChatNamespace("/ws/chat"))
set_socket_server(socket_server)
app = socketio.ASGIApp(socket_server, other_asgi_app=fastapi_app, socketio_path="/ws/socket.io")
