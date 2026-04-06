# AutoRecon (Hệ thống Quản lý Đơn hàng và Đối soát Tự động)

Hệ thống cung cấp giải pháp tự động hóa quản lý đơn hàng và đối soát (reconciliation), đồng bộ dữ liệu giao dịch từ API ngân hàng.

## Cấu trúc thư mục (Monorepo)
- `backend/`: API & Cronjob backend viết bằng Golang (Gin & Gorm).
- `frontend/`: Ứng dụng quản trị SPA viết bằng React & TypeScript định dạng giao diện sắc nét (Vite).
- `docker-compose.yml`: Tự động khởi tạo PostgreSQL environment.

## Yêu cầu Hệ thống
- Docker & Docker Compose
- Node.js (phiên bản > 18)
- Go (phiên bản > 1.20)

## Hướng dẫn thiết lập Môi trường

Dự án có sử dụng `Makefile` để đơn giản hóa các thao tác cho cả 2 nhánh (Frontend và Backend).

### Chạy hệ thống đơn giản bằng Make
Từ thư mục ngoài cùng (root), bạn có thể chạy:
```bash
# Khởi động Backend + Frontend + Database cùng lúc
make dev

# Hoặc khởi động từng phần
make db-up
make frontend
make backend
```

### Cấu hình môi trường
Copy tự động biến môi trường cho Backend nếu chưa có:
```bash
cp backend/.env.example backend/.env
```
