# Hướng Dẫn Cấu Hình Môi Trường & Chạy Docker (CVerify Platform)

Tài liệu này hướng dẫn cách quản lý cấu hình môi trường tập trung và vận hành Docker Compose trong dự án CVerify.

---

## 1. Tổng Quan Kiến Trúc Cấu Hình

Hệ thống cấu hình của CVerify sử dụng cơ chế **xếp chồng nhiều lớp (Layering)** và quản lý qua **một nguồn sự thật duy nhất (Single Source of Truth)** là file `.env.current`.

### Các file cấu hình chính ở thư mục gốc:
* **`.env.current`**: Định nghĩa môi trường đang hoạt động (ví dụ: `CVERIFY_ENVIRONMENT=Development`).
* **`.env.defaults`**: Chứa các biến cấu hình dùng chung cho mọi môi trường (được track bởi Git).
* **`.env.development` / `.env.testing` / `.env.staging` / `.env.production`**: Chứa cấu hình phi nhạy cảm đặc thù cho từng môi trường (được track bởi Git).
* **`.env.secrets`**: Chứa các mật khẩu, API key nhạy cảm của máy cá nhân (bị Git bỏ qua).
* **`.env`**: File môi trường tổng hợp được sinh ra tự động sau khi gộp các lớp trên lại (bị Git bỏ qua).

---

## 2. Cách Chọn Và Chuyển Đổi Môi Trường

Bạn chỉ cần thực hiện **một hành động duy nhất** để chuyển đổi toàn bộ nền tảng sang môi trường mong muốn.

### Cách 1: Sử dụng tham số dòng lệnh (Khuyên dùng)
Mở terminal tại thư mục gốc của dự án và chạy script tương ứng với hệ điều hành của bạn:

* **Trên Windows (PowerShell)**:
  ```powershell
  # Chuyển sang môi trường Phát triển (Development)
  ./setup.ps1 Development

  # Chuyển sang môi trường Kiểm thử (Testing)
  ./setup.ps1 Testing

  # Chuyển sang môi trường Staging
  ./setup.ps1 Staging
  ```

* **Trên Unix / Linux / macOS (Bash)**:
  ```bash
  # Cấp quyền thực thi nếu chạy lần đầu
  chmod +x setup.sh

  # Chuyển sang môi trường Phát triển
  ./setup.sh Development

  # Chuyển sang môi trường Kiểm thử
  ./setup.sh Testing
  ```

### Cách 2: Sửa trực tiếp file `.env.current`
1. Mở file [`.env.current`](file:///d:/Coding%20Space/Projects/CVerify/.env.current).
2. Sửa giá trị `CVERIFY_ENVIRONMENT` thành một trong bốn giá trị: `Development`, `Testing`, `Staging`, `Production`.
3. Chạy lại script setup không tham số để áp dụng cấu hình mới:
   ```powershell
   ./setup.ps1
   ```

---

## 3. Khởi Động Docker Compose

### Chạy tự động thông qua Script Setup
Khi bạn chạy `./setup.ps1 <Environment>` hoặc `./setup.sh <Environment>`, script sẽ tự động:
1. Gộp các file cấu hình.
2. Kiểm tra tính hợp lệ của cấu hình (Pre-flight Validation).
3. Ghi file `.env` tổng hợp ở gốc và đồng bộ sang frontend (`client/.env`).
4. Khởi động Docker Compose với các file override phù hợp (`docker/compose.yml` + `docker/compose.<env>.yml`).

### Sử dụng lệnh Docker Compose thủ công
Do script setup đã tự động chèn biến cấu hình `COMPOSE_FILE` tương ứng với môi trường vào file `.env` tổng hợp ở gốc, bạn có thể chạy các lệnh docker gốc trực tiếp từ thư mục gốc của dự án mà không cần chỉ định file `-f`:

* **Khởi động các dịch vụ (sau khi đã chạy setup lần đầu)**:
  ```bash
  docker compose up -d
  ```
* **Tắt toàn bộ dịch vụ**:
  ```bash
  docker compose down
  ```
* **Xem trạng thái các container**:
  ```bash
  docker compose ps
  ```

---

## 4. Cơ Chế Khóa Bảo Vệ Production (Production Lock)

Để ngăn chặn việc vô tình kết nối và ghi đè dữ liệu lên database Production khi chạy thử ở máy cá nhân:
* Khi thiết lập `CVERIFY_ENVIRONMENT=Production`, hệ thống sẽ kích hoạt chế độ khóa.
* Để mở khóa, bạn bắt buộc phải chỉnh sửa file [`.env.current`](file:///d:/Coding%20Space/Projects/CVerify/.env.current) và thiết lập:
  ```ini
  PRODUCTION_UNLOCK_CONFIRMATION=true
  ```
* Nếu không thiết lập giá trị trên là `true`, cả script setup và mã nguồn ASP.NET Core backend khi khởi động sẽ **ngay lập tức dừng hoạt động và báo lỗi bảo mật**, ngăn chặn mọi kết nối đến tài nguyên Production.

---

## 5. Kiểm Tra Sức Khỏe Cấu Hình (Health Report)

Mỗi lần chạy script setup, hệ thống sẽ thực hiện kiểm tra kiểm định (Pre-flight Validation) các cổng (Ports), định dạng URL, các khóa bắt buộc và ghi nhận kết quả vào file:
* [`logs/config-health-report.json`](file:///d:/Coding%20Space/Projects/CVerify/logs/config-health-report.json)

Bạn có thể mở file này để kiểm tra xem cấu hình của mình có thiếu sót gì không (ví dụ: thiếu API Key của bên thứ ba như Anthropic, Google Client Secret).

---

## 6. Chạy Dịch Vụ Cục Bộ (Không Qua Docker)

Nếu bạn muốn chạy trực tiếp các dịch vụ trên máy cá nhân để debug (ví dụ: chạy backend bằng `dotnet run` hoặc AI service bằng `uvicorn`):
* Cả **ASP.NET Core backend** và **Python FastAPI AI service** đều đã được tích hợp cơ chế **tự động tìm kiếm thư mục cha (parent traversal)** để nạp file `.env` ở thư mục gốc của dự án.
* Bạn không cần phải copy thủ công file `.env` vào các thư mục con nữa, hệ thống sẽ tự động sử dụng cấu hình môi trường đang hoạt động trong `.env.current`.
