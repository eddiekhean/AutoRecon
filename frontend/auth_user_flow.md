# Tài Liệu API: Luồng Xác Thực Khách Máy (Authentication) & Quản Lý Cá Nhân

Tài liệu này mô tả chi tiết các API liên quan đến Authentication, luồng thao tác của Cá nhân (lấy Profile, đổi mật khẩu) và luồng Quản lý người dùng của Admin.

---

## 0. Quy Tắc Phân Quyền & Role (RBAC)

Hệ thống được bảo vệ qua 2 lớp Authentication (Xác thực) và Authorization (Phân quyền):
1. **Public Routes**: Có thể gọi mà không cần token.
2. **Protected Routes (Mọi User)**: Chứa các API liên quan đến cá nhân. Yêu cầu request phải có thẻ `Authorization: Bearer <access_token>` trong phần Request Headers. Token phải hợp lệ và chưa hết hạn.
3. **Admin-Only Routes**: Yêu cầu token hợp lệ VÀ quyền của tài khoản gọi API phải là `role_id = 1` (Admin).

---

## 1. Luồng Xác Thực (Authentication Flow)

### 1.1. Đăng nhập (Login)
- **Endpoint**: `POST /api/v1/auth/login`
- **Headers**: Không yêu cầu (Public Route)
- **Mô tả**: Dùng `email` và `password` để lấy Token khởi tạo phiên đăng nhập.
- **Request Body**:
  ```json
  {
    "email": "sale01@company.com",
    "password": "Mypassword@123"
  }
  ```
- **Response (200 OK - Không bị yêu cầu đổi mật khẩu)**:
  ```json
  {
    "status": "success",
    "data": {
      "access_token": "eyJhbG...",
      "refresh_token": "uuid-string-4321",
      "requires_password_change": false
    }
  }
  ```
- **Response (200 OK - Cấp mới / Admin Force Change Pass)**:
  Trường hợp Admin vừa tạo tài khoản, hệ thống sẽ giới hạn thời gian sống của Token và không trả về `refresh_token` để ép user tự gọi tới API Đổi mật khẩu.
  ```json
  {
    "status": "success",
    "data": {
      "access_token": "eyJhbG...",
      "requires_password_change": true
    }
  }
  ```

### 1.2. Làm mới Token (Refresh Token)
- **Endpoint**: `POST /api/v1/auth/refresh`
- **Headers**: Không yêu cầu (Public Route) - Dùng chính `refresh_token` ở phần Body để làm bằng chứng xác thực.
- **Mô tả**: Khi `access_token` hết hạn, gọi API này để xin cấp Access Token mới (và xoay vòng tự cấp lại Refresh Token mới).
- **Request Body**:
  ```json
  {
    "refresh_token": "uuid-string-4321"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": {
      "access_token": "eyJhbG...mới",
      "refresh_token": "uuid-string-mới"
    }
  }
  ```

### 1.3. Đăng xuất (Logout)
- **Endpoint**: `POST /api/v1/auth/logout`
- **Headers**: `Authorization: Bearer <access_token>` (Bắt buộc)
- **Mô tả**: Đưa `access_token` hiện tại vào danh sách đen (Blacklist) và thu hồi `refresh_token` dưới Database/Redis.
- **Request Body**:
  ```json
  {
    "refresh_token": "uuid-string-4321"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Logged out successfully. All sessions cleared."
  }
  ```

---

## 2. Quản Lý Cá Nhân (Personal Flow - Dành cho mọi User)

### 2.1. Lấy thông tin Profile (Get Profile)
- **Endpoint**: `GET /api/v1/users/me`
- **Headers**: `Authorization: Bearer <access_token>` (Bắt buộc)
- **Mô tả**: API dùng nhiều nhất ở Frontend. Lấy profile cơ bản để vẽ lên UI.
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": {
      "user_id": "uuid-string",
      "email": "sale01@company.com",
      "full_name": "Nguyễn Văn A",
      "role": "SALE"
    }
  }
  ```

### 2.2. Đổi mật khẩu cá nhân (Change Password)
- **Endpoint**: `PUT /api/v1/users/me/password`
- **Headers**: `Authorization: Bearer <access_token>` (Bắt buộc)
- **Mô tả**: 
  - Đổi password thông thường hoặc đổi pass lần đầu (bắt buộc) khi vừa được Admin cấp.
  - Khi dính cờ `requires_password_change = true`, sau khi gọi thành công sẽ **gỡ bỏ cờ**, người dùng sử dụng hệ thống bình thường.
  - Sau khi đổi thành công, **Server tự động xóa sạch mọi thiết bị/session đang đăng nhập**. User cần Login lại với password mới.
- **Request Body**:
  ```json
  {
    "old_password": "Company@2077",
    "new_password": "MySecretPassword@999"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "Password changed successfully. All previous sessions have been logged out."
  }
  ```

---

## 3. Luồng Cấp Phát và Quản Lý (Admin Flow - Chỉ Role Admin)

### 3.1. Cấp Mới Tài Khoản Cho Nhân Viên (Provision User)
- **Endpoint**: `POST /api/v1/admin/users`
- **Headers**: `Authorization: Bearer <access_token>` (Bắt buộc - Phân quyền Admin)
- **Mô tả**: Admin không cần điền mật khẩu, Server sẽ tự động generate ra một Mật Khẩu Siêu Cấp (12 kí tự gồm chữ cứng, chữ thường, số và kí tự đặc biệt). Đồng thời nhúng cờ `requires_password_change = true`.
- **Request Body**:
  ```json
  {
    "full_name": "Nguyễn Văn B",
    "email": "sale02@company.com",
    "role_id": 2
  }
  ```
- **Response (201 Created)**: Admin copy lại tham số định danh `default_password` này gửi cho nhân sự (Hệ thống không lưu lại plain text, chỉ hiển thị dòng này đúng 1 lần).
  ```json
  {
    "status": "success",
    "data": {
      "user_id": "uuid",
      "email": "sale02@company.com",
      "default_password": "pA6#9!lKz2@W" 
    }
  }
  ```

### 3.2. Lấy Danh Sách User (List Users)
- **Endpoint**: `GET /api/v1/admin/users`
- **Headers**: `Authorization: Bearer <access_token>` (Bắt buộc - Phân quyền Admin)
- **Truy vấn (Query Parameters)** - Hỗ trợ fillter:
  - `?role=SALE` (Tùy chọn)
  - `?status=INACTIVE` (Tùy chọn)
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": [
      {
        "user_id": "uuid",
        "full_name": "Nguyễn Văn A",
        "email": "sale01@company.com",
        "role": "SALE",
        "status": "ACTIVE",
        "created_at": "2024-03-01T12:00:00Z"
      }
    ]
  }
  ```

### 3.3. Khoá / Mở Khoá Tài Khoản (Update Status)
- **Endpoint**: `PUT /api/v1/admin/users/:id/status`
- **Headers**: `Authorization: Bearer <access_token>` (Bắt buộc - Phân quyền Admin)
- **Mô tả**: Khóa tài khoản nhân viên đã nghỉ việc (hoặc cần bảo mật) hoặc Mở khóa tài khoản trở lại.
  - Khi khóa (`INACTIVE`), Backend tự động **quét và ép văng ngắt mạng** mọi điểm truy cập (thu hồi sạch token trong Redis) của user đó ngay lập tức.
- **Request Body**:
  ```json
  {
    "status": "INACTIVE" 
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "message": "User status updated to INACTIVE. All active sessions have been cleared."
  }
  ```
