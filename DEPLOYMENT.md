# CI/CD Production

Branch deploy: `production`

Thông tin server production:

- Host: `160.25.166.147`
- SSH user: `root`
- SSH port: `22`
- Đường dẫn deploy: `/opt/quanly-trungtam`
- URL public (trước khi có domain): `https://160.25.166.147:8080`

## Quy trình CI/CD

**CI** kiểm tra xem project có thể build an toàn không:

1. Cài dependencies backend bằng `npm ci`.
2. Cài dependencies frontend bằng `npm ci`.
3. Build frontend bằng `npm run build`.
4. Build Docker image cho backend và frontend sau khi CI thành công.

**CD** triển khai bản build đã được duyệt:

1. Push Docker image lên Docker Hub:
   - `kdisme/quanly-backend`
   - `kdisme/quanly-frontend`
2. SSH vào server production.
3. Copy `docker-compose.prod.yml` vào `/opt/quanly-trungtam`.
4. Tạo file `.env.production` từ GitHub Secrets.
5. Pull image mới và chạy `docker compose up -d`.
6. Chạy migration backend bằng `npm run migrate`.
7. Health check tại `https://localhost:8080/health` (hoặc cổng cấu hình qua `FRONTEND_PORT`).
8. Gửi thông báo thành công hoặc thất bại qua Telegram.

## GitHub Secrets

Thêm các secret sau vào GitHub repo (Settings → Secrets and variables → Actions):

```text
DOCKERHUB_USERNAME=kdisme
DOCKERHUB_TOKEN=<docker_hub_access_token>

SERVER_HOST=160.25.166.147
SERVER_USER=root
SERVER_PORT=22
SERVER_SSH_KEY=<nội_dung_private_key>

POSTGRES_PASSWORD=<mật_khẩu_postgres_mạnh>
JWT_SECRET=<chuỗi_jwt_secret_ngẫu_nhiên>

TELEGRAM_BOT_TOKEN=<token_bot_telegram>
TELEGRAM_CHAT_ID=<chat_id_telegram>
```

Dùng `JWT_SECRET` và mật khẩu database đủ mạnh cho môi trường production.

## Tạo SSH Key

### Trên Git Bash, WSL, macOS hoặc Linux

**Bước 1:** Tạo SSH key trên máy local:

```bash
ssh-keygen -t ed25519 -C "github-actions-quanly" -f ~/.ssh/quanly_github_actions
```

> Khi hỏi passphrase, nhấn **Enter** để bỏ trống (không đặt mật khẩu).

**Bước 2:** Copy public key lên server:

```bash
ssh-copy-id -i ~/.ssh/quanly_github_actions.pub root@160.25.166.147
```

> Nếu không có lệnh `ssh-copy-id`, in public key ra:

```bash
cat ~/.ssh/quanly_github_actions.pub
```

Sau đó SSH vào server và thêm thủ công vào file:

```bash
echo "PASTE_PUBLIC_KEY_VÀO_ĐÂY" >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
```

**Bước 3:** Test đăng nhập SSH bằng key (không cần password):

```bash
ssh -i ~/.ssh/quanly_github_actions root@160.25.166.147
```

**Bước 4:** Lấy nội dung private key để thêm vào GitHub Secret `SERVER_SSH_KEY`:

```bash
cat ~/.ssh/quanly_github_actions
```

Copy **toàn bộ nội dung** (bao gồm cả dòng `-----BEGIN OPENSSH PRIVATE KEY-----` và `-----END OPENSSH PRIVATE KEY-----`).

---

### Trên Windows PowerShell

**Bước 1:** Tạo SSH key:

```powershell
ssh-keygen -t ed25519 -C "github-actions-quanly" -f "$env:USERPROFILE\.ssh\quanly_github_actions"
```

**Bước 2:** In public key ra và copy:

```powershell
Get-Content "$env:USERPROFILE\.ssh\quanly_github_actions.pub"
```

SSH vào server và thêm public key vào `/root/.ssh/authorized_keys`.

**Bước 3:** Test đăng nhập từ PowerShell:

```powershell
ssh -i "$env:USERPROFILE\.ssh\quanly_github_actions" root@160.25.166.147
```

**Bước 4:** Lấy private key để thêm vào GitHub Secret `SERVER_SSH_KEY`:

```powershell
Get-Content "$env:USERPROFILE\.ssh\quanly_github_actions" -Raw
```

## Tạo Telegram Bot

1. Mở Telegram và nhắn tin với `@BotFather`.
2. Gửi lệnh `/newbot`.
3. Làm theo hướng dẫn và copy token bot nhận được.
4. Lưu token vào GitHub Secret `TELEGRAM_BOT_TOKEN`.
5. Gửi bất kỳ tin nhắn nào từ tài khoản Telegram cá nhân đến bot mới tạo.
6. Mở URL sau trên trình duyệt (thay token thực vào):

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates
```

7. Tìm giá trị `message.chat.id`.
8. Lưu số đó vào GitHub Secret `TELEGRAM_CHAT_ID`.

## Cài đặt Server lần đầu

SSH vào server:

```bash
ssh root@160.25.166.147
```

Tạo thư mục deploy:

```bash
mkdir -p /opt/quanly-trungtam
```

Mở cổng HTTP nếu tường lửa đang bật:

```bash
ufw allow 80/tcp
ufw allow 22/tcp
ufw status
```

> Docker đã được cài sẵn trên server theo ghi chú triển khai hiện tại.

## Seed Database

Pipeline tự động chạy migration. Dữ liệu seed chỉ cần import một lần sau lần deploy đầu tiên.

Ví dụ nếu seed là file SQL:

```bash
docker cp seed.sql quanly-postgres:/tmp/seed.sql
docker exec -it quanly-postgres psql -U postgres -d QLTTNN -f /tmp/QLTTNN.sql
```

Vì dữ liệu production hiện không cần giữ lại, có thể reset database bằng cách xóa Docker volume:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down -v
```

> ⚠️ **Cảnh báo:** Chỉ chạy lệnh trên khi bạn **cố ý muốn xóa toàn bộ database**.
