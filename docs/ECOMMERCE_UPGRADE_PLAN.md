# Ke hoach nang cap he thong thanh san thuong mai

## 1. Tong quan
- Muc tieu: nang cap ung dung sinh mo ta AI hien tai thanh nen tang marketplace nong san ket hop AI ho tro nguoi mua, nguoi ban va admin.
- Phuong an: giu lai FastAPI + Next.js lam nen tang, mo rong thanh modular monolith (co the tach dich vu sau) ket hop co so du lieu quan he cho giao dich va MongoDB hien co cho noi dung AI/lich su.
- Uu tien: dam bao quy trinh mua hang hoan chinh (gio hang -> thanh toan -> van chuyen), quan ly nguoi ban, thanh phan thong ke va cac tinh nang tu dong hoa.

## 2. Hien trang du an
- Backend FastAPI da co cac module auth co ban (email/password), lich su sinh noi dung, tich hop Cloudinary va Gemini API.
- Luu tru MongoDB thong qua motor/pymongo (models UserDocument, DescriptionDocument, PasswordResetTokenDocument).
- Frontend Next.js (chua danh gia chi tiet) phuc vu UI sinh mo ta san pham.
- Chua co cac bang/collection cho san pham, don hang, chat, thanh toan.
- Chua tich hop he thong real-time, payment, notification, hay phan quyen role-based.

## 3. Phan loai chuc nang theo persona
- Buyer: dang ky/dang nhap, cap nhat ho so, tim kiem & loc, xem san pham, chat, gio hang, dat hang, theo doi trang thai, danh gia, thong bao.
- Seller: tao tai khoan, xac minh shop, CRUD san pham + bien the, kho hang, tra loi chat, quan ly don, thong ke, chia se QR, phan hoi binh luan.
- Admin: quan ly nguoi dung/phan quyen, duyet seller, quan ly danh muc tu khoa, thong ke he thong, cau hinh danh muc, phi -> giam sat log, webhook -> xu ly bao cao vi pham.
- AI & tu dong: sinh mo ta/slogan, rewrite, goi y gia, phan loai hinh anh, chatbot ho tro, goi y san pham.
- Chat & thong bao: realtime socket, push/email/app, loc spam.
- Thanh toan & van chuyen: MoMo, VNPay, COD, tracking.
- Quan ly & bao cao: dashboard, xuat Excel/PDF, loc theo filter.
- Bao mat & hieu nang: JWT + refresh, rate limit, upload safe, log, fraud detection.

## 4. Kien truc de xuat
- Tong quan: giu monorepo voi backend FastAPI, frontend Next.js; tach modules backend: auth, catalog, order, payment, chat, notification, analytics, ai.
- Cong nghe: FastAPI async + MongoDB (danh muc noi dung) + (du kien) PostgreSQL cho giao dich neu mo rong; Redis (cache, queue), Celery/RQ (background); Socket.IO realtime.
- Frontend: Next.js 14 (App Router), React Query, state manager (Zustand/Redux), UI library (Ant/Tailwind), SSR/ISR cho trang san pham.
- Ngoai : Cloudinary (media), OpenAI/Gemini (noi dung), MoMo/VNPay, FCM/OneSignal push, Resend/Sendgrid email, Sentry/Logging.
- Trien khai: Docker Compose dev, deployment Vercel (frontend), Render/Fly.io/AWS (backend), S3/Cloudinary storage.

## 5. Mo hinh du lieu MongoDB (chinh)
- users: email, phone, hashed_password, role, is_active, created_at, updated_at.
- user_profiles: user_id, display_name, avatar_url, gender, date_of_birth, bio.
- addresses: user_id, recipient, phone, address_line, ward/district/province, postal_code, country, is_default.
- sellers: user_id, shop_name, slug, description, status, social_links, verification info.
- categories, tags: slug + metadata.
- products: seller_id, name, slug, summary, description_ai_id, description_custom, seo, categories, tags, status, thumbnail, images, variants, attributes, base_price, unit, min_order_quantity, created_at, updated_at.
- product_variants (embedded), inventory_logs (collection) tracking stock.
- carts, favorites.
- orders: buyer_id, seller_id, address_snapshot, payment_method/status, fulfillment_status, totals, items, timeline, tracking_number.
- payments, shipments, returns, reviews, notifications, chat_threads, chat_messages, ai logs.

## 6. Modules backend
- `modules/users`: auth, profile, address, seller onboarding.
- `modules/catalog`: categories, tags, products, inventory.
- `modules/cart`: gio hang, yeu thich.
- `modules/orders`: orders, payments, shipments, returns, reviews.
- `modules/chat`: realtime messaging, threads.
- `modules/notifications`: push/email/in-app.
- `modules/ai`: tich hop mo ta AI, goi y.
- `modules/admin`: quan tri he thong, thong ke, log.

## 7. Luong nguoi dung
- Buyer: signup -> verify -> cap nhat dia chi -> tim kiem -> xem -> chat -> them gio hang -> checkout (MoMo/VNPay/COD) -> theo doi -> danh gia -> doi tra.
- Seller: dang ky -> nop ho so -> admin duyet -> tao san pham -> su dung AI mo ta/gia -> quan ly kho ton -> nhan don -> dong goi -> cap nhat van chuyen -> giai quyet doi tra -> xem bao cao.
- Admin: dashboard -> duyet seller -> quan ly danh muc/san pham -> cau hinh phi, banner -> giam sat log, thong bao -> xu ly vi pham.

## 8. Chat & thong bao
- Dung Socket.IO (FastAPI + Redis) cho chat buyer-seller, in-app notify.
- Push thong bao (FCM/OneSignal) + email (Resend) + in-app.
- Bo loc spam, canh bao noi dung nhay cam (AI moderation).

## 9. AI & automation
- AI content: microservice nho call OpenAI/Gemini -> luu version, cho phep edit.
- AI rewrite, goi y gia ban, phan loai hinh anh, chatbot FAQ, goi y san pham (recommendation).
- Log cost + caching ket qua.

## 10. Thanh toan & van chuyen
- Payment service: webhook MoMo/VNPay, log, update order, outbox pattern.
- COD: trang thai `pending_cod` -> success/fail.
- Shipping integration (Giao Hang Nhanh, Viettel Post...) hoac manual tracking.
- Quan ly phi van chuyen theo khu vuc/khong luong.

## 11. Bao cao & thong ke
- Seller dashboard: revenue, orders, trend, low stock.
- Admin dashboard: system revenue, orders, seller stats, traffic (qua third-party).
- Export Excel/PDF (pandas + xlsxwriter / WeasyPrint).
- Filter theo thoi gian, danh muc, trang thai.

## 12. Bao mat & hieu nang
- JWT + refresh tokens (Redis), password hash (argon2/bcrypt), 2FA optional.
- Rate-limit, CORS/CSRF, Helmet, MIME check, 5MB limit, logging (Sentry), fraud detection heuristics.
- Backup MongoDB, audit logs, GDPR-like compliance.

## 13. Lo trinh (6 sprint ~ 12 tuan)
1. Nen tang + data: module structure, Mongo indexes, auth refactor (role, profile), API v2 skeleton.
2. Buyer core: catalog APIs, search/filter, gio hang, checkout COD, notifications co ban.
3. Seller portal: onboarding, CRUD product, ton kho, AI mo ta, dashboard so bo.
4. Orders & payments: payment gateway sandbox, webhook, shipping, email/push thong bao.
5. Reviews, doi tra, chat realtime, AI chatbot, recommend.
6. Admin console, bao cao, bao mat, testing & optimization, go-live checklist.

## 14. Testing
- Unit (pytest) cho services.
- Integration API (httpx/pytest).
- Socket tests (websockets).
- E2E (Playwright) flows buyer/seller.
- Performance (Locust) cho checkout/search.
- Security (OWASP ZAP), penetration test.

## 15. Next steps
- Xac nhan model du lieu, phan cong user stories (Jira/Notion).
- Thiet ke UI/UX (Figma), openAPI spec.
- Lien ket he thong thanh toan (dang ky sandbox), logistic DOI tac.
- Lap ke hoach monitoring & observability tu dau (logging, metrics, tracing).
