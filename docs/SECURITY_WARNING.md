# ⚠️ CẢNH BÁO BẢO MẬT - RESET PASSWORD

## Endpoint `/auth/reset-password-simple`

### ❌ VẤN ĐỀ BẢO MẬT NGHIÊM TRỌNG

Endpoint này **CHO PHÉP ĐỔI MẬT KHẨU MÀ KHÔNG CẦN XÁC THỰC**.

**Nguy cơ:**
- Bất kỳ ai biết email hoặc số điện thoại của người khác đều có thể chiếm tài khoản
- Không có cách nào ngăn chặn việc tấn công brute force
- Vi phạm nghiêm trọng các tiêu chuẩn bảo mật cơ bản

### Ví dụ tấn công:

```
Kịch bản:
1. Anh A biết số điện thoại của anh B: 0123456789
2. Anh A mở app/website, vào chức năng "Quên mật khẩu"
3. Nhập: 0123456789 và mật khẩu mới: "password123"
4. Hệ thống đổi mật khẩu thành công
5. Anh A đăng nhập bằng: 0123456789 / password123
6. → Anh A chiếm tài khoản của anh B!
```

---

## ⚠️ CHỈ SỬ DỤNG CHO:

- ✅ Môi trường phát triển (dev/testing)
- ✅ Demo sản phẩm nội bộ
- ✅ Prototype/MVP không có dữ liệu thật
- ❌ **TUYỆT ĐỐI KHÔNG dùng cho production**

---

## ✅ GIẢI PHÁP THAY THẾ AN TOÀN

### 1. Gửi mã xác thực qua SMS (Khuyên dùng)
**Chi phí:** ~500đ/SMS  
**Dịch vụ:** ESMS.vn, Twilio, AWS SNS

**Flow:**
```
User quên MK → Nhập SĐT → Hệ thống gửi mã 6 số qua SMS 
→ User nhập mã + MK mới → Đổi MK thành công
```

### 2. Gửi mã qua Email
**Chi phí:** Miễn phí (Gmail), hoặc rẻ (SendGrid, AWS SES)  
**Hạn chế:** Người nông dân có thể không có email

**Flow:**
```
User quên MK → Nhập email → Hệ thống gửi mã qua email
→ User nhập mã + MK mới → Đổi MK thành công
```

### 3. Câu hỏi bảo mật
**Chi phí:** Miễn phí  
**Hạn chế:** Câu trả lời dễ đoán

**Flow:**
```
User quên MK → Nhập email/SĐT → Trả lời câu hỏi bảo mật
→ Đúng → Cho phép đổi MK
```

### 4. Admin/Support reset
**Chi phí:** Miễn phí (nếu có nhân viên)  
**Hạn chế:** Cần có support team

**Flow:**
```
User quên MK → Gọi điện/chat với admin 
→ Admin xác thực danh tính → Admin reset MK
```

---

## 📝 CHECKLIST TRƯỚC KHI DEPLOY PRODUCTION

- [ ] **XÓA HOẶC VÔ HIỆU HÓA** endpoint `/auth/reset-password-simple`
- [ ] Implement ít nhất 1 trong 4 giải pháp an toàn ở trên
- [ ] Test kỹ flow reset password
- [ ] Thêm rate limiting (giới hạn số lần thử)
- [ ] Log tất cả các lần reset password
- [ ] Gửi email/SMS thông báo khi password thay đổi

---

## 🔧 CÁCH VÔ HIỆU HÓA ENDPOINT

### Cách 1: Comment endpoint
Mở `backend/app/main.py`, comment toàn bộ function `reset_password_simple`:

```python
# @app.post("/auth/reset-password-simple", response_model=MessageResponse)
# def reset_password_simple(...):
#     ...
```

### Cách 2: Thêm authentication
Yêu cầu user phải là admin mới dùng được:

```python
@app.post("/auth/reset-password-simple", response_model=MessageResponse)
def reset_password_simple(
    payload: ResetPasswordSimpleRequest,
    admin_user: User = Depends(get_admin_user),  # ← Thêm dòng này
    session: Session = Depends(get_session),
) -> MessageResponse:
    ...
```

### Cách 3: Xóa hoàn toàn
Xóa:
1. Function `reset_password_simple` trong `main.py`
2. Class `ResetPasswordSimpleRequest` trong `schemas.py`

---

## 📞 HỖ TRỢ

Nếu cần hỗ trợ implement giải pháp an toàn hơn, vui lòng liên hệ team dev.

**Lưu ý cuối:** Endpoint này chỉ là giải pháp tạm thời cho giai đoạn phát triển. 
Hãy thay thế bằng giải pháp an toàn trước khi có người dùng thật sử dụng!
