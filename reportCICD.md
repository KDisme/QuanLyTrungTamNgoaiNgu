# Báo Cáo CI/CD — Quản Lý Trung Tâm Ngoại Ngữ

> **Dự án:** Hệ thống quản lý trung tâm ngoại ngữ đa chi nhánh (multi-tenant)  
> **Stack:** Node.js (Express) · PostgreSQL · React + TypeScript (Vite) · Docker · GitHub Actions  
> **Branch deploy:** `production`  
> **Server production:** `http://160.25.166.147`

---

## Mục lục

1. [Tổng quan kiến trúc CI/CD](#1-tổng-quan-kiến-trúc-cicd)
2. [Chuẩn bị môi trường](#2-chuẩn-bị-môi-trường)
   - 2.1 [Cài đặt server lần đầu](#21-cài-đặt-server-lần-đầu)
   - 2.2 [Tạo SSH Key](#22-tạo-ssh-key)
   - 2.3 [Tạo Telegram Bot](#23-tạo-telegram-bot)
   - 2.4 [Cấu hình GitHub Secrets](#24-cấu-hình-github-secrets)
3. [Dockerfile](#3-dockerfile)
   - 3.1 [Backend Dockerfile](#31-backend-dockerfile)
   - 3.2 [Frontend Dockerfile](#32-frontend-dockerfile)
4. [Docker Compose](#4-docker-compose)
   - 4.1 [docker-compose.yml (Local Dev)](#41-docker-composeyml-local-dev)
   - 4.2 [docker-compose.prod.yml (Production)](#42-docker-composeprodymL-production)
5. [GitHub Actions Workflow](#5-github-actions-workflow)
   - 5.1 [Trigger & Concurrency](#51-trigger--concurrency)
   - 5.2 [Job 1: Build & Push Docker Images (CI)](#52-job-1-build--push-docker-images-ci)
   - 5.3 [Job 2: Deploy lên Server (CD)](#53-job-2-deploy-lên-server-cd)
   - 5.4 [Job 3: Thông báo Telegram](#54-job-3-thông-báo-telegram)
6. [Quy trình CI/CD từng bước](#6-quy-trình-cicd-từng-bước)
7. [Cơ chế Rollback tự động](#7-cơ-chế-rollback-tự-động)
8. [Backup Database](#8-backup-database)
9. [Sơ đồ luồng CI/CD](#9-sơ-đồ-luồng-cicd)
10. [Các vấn đề đã gặp và cách xử lý](#10-các-vấn-đề-đã-gặp-và-cách-xử-lý)

---

## 1. Tổng quan kiến trúc CI/CD

Hệ thống CI/CD được xây dựng trên **GitHub Actions**, tự động kích hoạt mỗi khi có commit được push lên nhánh `production`. Toàn bộ pipeline bao gồm 3 giai đoạn chính chạy tuần tự:

```
Push lên nhánh production
        │
        ▼
┌───────────────────┐
│  Job: docker      │  ← CI: Build Docker image backend + frontend
│  (Build & Push)   │      → Push lên Docker Hub
└────────┬──────────┘
         │ needs: docker
         ▼
┌───────────────────┐
│  Job: deploy      │  ← CD: SSH vào server, kéo image mới, restart services
│  (Deploy Server)  │      → Backup DB → Migration → Health check → Rollback nếu lỗi
└────────┬──────────┘
         │ needs: docker + deploy
         ▼
┌───────────────────┐
│  Job: notify      │  ← Gửi kết quả (thành công / thất bại) qua Telegram
│  (Telegram)       │
└───────────────────┘
```

**Docker Hub repositories:**
- `kdisme/quanly-backend` — image Node.js backend
- `kdisme/quanly-frontend` — image Nginx phục vụ React build

**Đường dẫn deploy trên server:** `/opt/quanly-trungtam`

---

## 2. Chuẩn bị môi trường

### 2.1 Cài đặt server lần đầu

SSH vào server và thực hiện các lệnh sau:

```bash
ssh root@160.25.166.147

# Tạo thư mục deploy
mkdir -p /opt/quanly-trungtam

# Mở cổng HTTP và SSH nếu tường lửa đang bật
ufw allow 80/tcp
ufw allow 22/tcp
ufw status
```

> **Lưu ý:** Docker đã được cài sẵn trên server. Nếu chưa có, cần cài Docker Engine và Docker Compose plugin trước.

---

### 2.2 Tạo SSH Key

Pipeline dùng SSH key để GitHub Actions kết nối vào server mà không cần mật khẩu.

#### Trên Git Bash / WSL / macOS / Linux

**Bước 1:** Tạo SSH key trên máy local:

```bash
ssh-keygen -t ed25519 -C "github-actions-quanly" -f ~/.ssh/quanly_github_actions
# Khi hỏi passphrase → nhấn Enter để bỏ trống
```

**Bước 2:** Copy public key lên server:

```bash
ssh-copy-id -i ~/.ssh/quanly_github_actions.pub root@160.25.166.147
# Nếu không có ssh-copy-id:
cat ~/.ssh/quanly_github_actions.pub
# Sau đó SSH vào server và chạy:
echo "PASTE_PUBLIC_KEY_VÀO_ĐÂY" >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
```

**Bước 3:** Kiểm tra đăng nhập bằng key:

```bash
ssh -i ~/.ssh/quanly_github_actions root@160.25.166.147
```

**Bước 4:** Lấy nội dung private key để thêm vào GitHub Secret:

```bash
cat ~/.ssh/quanly_github_actions
# Copy toàn bộ nội dung gồm cả dòng -----BEGIN OPENSSH PRIVATE KEY-----
```

#### Trên Windows PowerShell

```powershell
# Bước 1: Tạo key
ssh-keygen -t ed25519 -C "github-actions-quanly" -f "$env:USERPROFILE\.ssh\quanly_github_actions"

# Bước 2: In public key
Get-Content "$env:USERPROFILE\.ssh\quanly_github_actions.pub"
# Copy và thêm vào /root/.ssh/authorized_keys trên server

# Bước 3: Test kết nối
ssh -i "$env:USERPROFILE\.ssh\quanly_github_actions" root@160.25.166.147

# Bước 4: Lấy private key
Get-Content "$env:USERPROFILE\.ssh\quanly_github_actions" -Raw
```

---

### 2.3 Tạo Telegram Bot

Pipeline gửi thông báo deploy qua Telegram.

1. Mở Telegram → nhắn tin với `@BotFather`.
2. Gửi lệnh `/newbot` và làm theo hướng dẫn.
3. Copy **Bot Token** nhận được.
4. Gửi một tin nhắn bất kỳ từ Telegram cá nhân đến bot mới tạo.
5. Mở URL sau trên trình duyệt (thay token thực vào):

   ```
   https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates
   ```

6. Tìm giá trị `message.chat.id` trong JSON trả về.
7. Lưu Bot Token và Chat ID vào GitHub Secrets.

---

### 2.4 Cấu hình GitHub Secrets

Vào **GitHub Repo → Settings → Secrets and variables → Actions** và thêm các secret sau:

| Secret | Giá trị |
|--------|---------|
| `DOCKERHUB_USERNAME` | `kdisme` |
| `DOCKERHUB_TOKEN` | Docker Hub Access Token |
| `SERVER_HOST` | `160.25.166.147` |
| `SERVER_USER` | `root` |
| `SERVER_PORT` | `22` |
| `SERVER_SSH_KEY` | Nội dung private key SSH |
| `POSTGRES_PASSWORD` | Mật khẩu PostgreSQL mạnh |
| `JWT_SECRET` | Chuỗi JWT secret ngẫu nhiên |
| `TELEGRAM_BOT_TOKEN` | Token bot Telegram |
| `TELEGRAM_CHAT_ID` | Chat ID Telegram nhận thông báo |

---

## 3. Dockerfile

### 3.1 Backend Dockerfile

**File:** `backend/Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev
RUN node -e "require('multer'); require('busboy')"

COPY . .

RUN mkdir -p uploads/exams

EXPOSE 3001

CMD ["npm", "start"]
```

**Giải thích từng bước:**

| Lệnh | Mục đích |
|------|----------|
| `FROM node:20-alpine` | Base image nhẹ (~50MB), dùng Node.js 20 LTS |
| `ENV NODE_ENV=production` | Khai báo môi trường sớm để npm và code nhận đúng env |
| `npm ci --omit=dev` | Cài chính xác dependencies theo `package-lock.json`, bỏ devDependencies |
| `node -e "require('multer')..."` | Kiểm tra native modules có load được không (tránh lỗi runtime) |
| `mkdir -p uploads/exams` | Tạo sẵn thư mục lưu file upload để tránh lỗi quyền ghi |
| `CMD ["npm", "start"]` | Chạy `server.js` — migrate schema → khởi động Express |

---

### 3.2 Frontend Dockerfile

**File:** `frontend/Dockerfile`

```dockerfile
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**Giải thích — Multi-stage build:**

| Stage | Lệnh | Mục đích |
|-------|------|----------|
| **Stage 1 (build)** | `FROM node:20-alpine AS build` | Môi trường build React/TypeScript |
| | `npm ci` | Cài đầy đủ dependencies kể cả devDependencies (cần cho Vite) |
| | `npm run build` | Vite build → xuất ra `/app/dist` |
| **Stage 2 (runtime)** | `FROM nginx:1.27-alpine` | Image chỉ chứa Nginx (~25MB), không có Node.js |
| | `COPY --from=build /app/dist` | Copy chỉ phần static files đã build |
| | `COPY nginx.conf` | Config Nginx: proxy API về backend, SPA fallback |

> **Lợi ích Multi-stage:** Image cuối cùng chỉ ~30MB, không chứa source code hay devDependencies.

---

## 4. Docker Compose

### 4.1 docker-compose.yml (Local Dev)

Dùng để chạy toàn bộ stack trên máy local (build image từ source):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: quanly-postgres-local
    environment:
      POSTGRES_DB: ${DB_NAME:-db0807}
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-07122004}
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d db0807"]
      interval: 5s
      retries: 10

  backend:
    build: { context: ./backend }
    container_name: quanly-backend-local
    depends_on:
      postgres: { condition: service_healthy }
    environment:
      PORT: 3001
      DB_HOST: postgres
      # ... các biến môi trường khác
    ports:
      - "3001:3001"
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3001/health || exit 1"]
      interval: 10s
      retries: 10

  frontend:
    build: { context: ./frontend }
    container_name: quanly-frontend-local
    depends_on:
      backend: { condition: service_healthy }
    ports:
      - "80:80"
```

**Thứ tự khởi động:** `postgres` → (healthy) → `backend` → (healthy) → `frontend`

---

### 4.2 docker-compose.prod.yml (Production)

Dùng trên server production — **pull image từ Docker Hub** thay vì build:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: quanly-postgres
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data   # Dữ liệu persistent
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      retries: 10

  backend:
    image: ${BACKEND_IMAGE}     # VD: kdisme/quanly-backend:abc1234
    container_name: quanly-backend
    depends_on:
      postgres: { condition: service_healthy }
    environment:
      PORT: ${PORT}
      NODE_ENV: production
      DB_HOST: postgres
      JWT_SECRET: ${JWT_SECRET}
      # ... các biến môi trường khác
    volumes:
      - backend_uploads:/app/uploads   # File upload persistent
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:${PORT}/health || exit 1"]

  frontend:
    image: ${FRONTEND_IMAGE}    # VD: kdisme/quanly-frontend:abc1234
    container_name: quanly-frontend
    depends_on:
      backend: { condition: service_healthy }
    ports:
      - "${FRONTEND_PORT:-80}:80"

volumes:
  postgres_data:
  backend_uploads:
```

**Điểm khác biệt so với môi trường local:**
- Không có `ports` cho postgres và backend (chỉ expose nội bộ Docker network)
- Dùng volumes persist để không mất dữ liệu khi restart
- Image được chỉ định cụ thể theo tag commit SHA

---

## 5. GitHub Actions Workflow

**File:** `.github/workflows/production-cicd.yml`

### 5.1 Trigger & Concurrency

```yaml
on:
  push:
    branches:
      - production      # Tự động khi push lên nhánh production
  workflow_dispatch:    # Cho phép chạy thủ công từ GitHub UI

concurrency:
  group: production-deploy
  cancel-in-progress: false   # Không hủy deploy đang chạy, xếp hàng chờ
```

> **Tại sao `cancel-in-progress: false`?** Tránh trường hợp 2 pipeline chạy song song trên cùng server, có thể gây conflict file `.env.production` hoặc container restart không kiểm soát.

---

### 5.2 Job 1: Build & Push Docker Images (CI)

**Job name:** `docker`  
**Runner:** `ubuntu-latest`

```yaml
steps:
  - Checkout source code (actions/checkout@v4)
  - Set IMAGE_TAG = 7 ký tự đầu của commit SHA (GITHUB_SHA::7)
  - Login vào Docker Hub (docker/login-action@v3)
  - Setup Docker Buildx (docker/setup-buildx-action@v3)
  - Build & Push backend image:
      tags: kdisme/quanly-backend:<sha7>, kdisme/quanly-backend:production
      cache: type=gha,scope=backend
  - Build & Push frontend image:
      tags: kdisme/quanly-frontend:<sha7>, kdisme/quanly-frontend:production
      cache: type=gha,scope=frontend
```

**Ý nghĩa image tag kép:**
- Tag `<sha7>` (VD: `abc1234`): định danh bất biến theo commit, dùng để rollback
- Tag `production`: luôn trỏ đến bản mới nhất, tiện cho kiểm tra nhanh

**GitHub Actions Cache:** Layer Docker được cache lại theo scope `backend`/`frontend`. Các lần build sau (nếu Dockerfile/dependencies không đổi) sẽ nhanh hơn đáng kể.

---

### 5.3 Job 2: Deploy lên Server (CD)

**Job name:** `deploy`  
**Runner:** `ubuntu-latest`  
**Phụ thuộc:** `needs: docker` (chỉ chạy sau khi job `docker` thành công)

#### Bước 1: Chuẩn bị thư mục trên server

```bash
# Dùng appleboy/ssh-action@v1.2.0
mkdir -p /opt/quanly-trungtam
```

#### Bước 2: Copy file compose lên server

```bash
# Dùng appleboy/scp-action@v0.1.7
scp docker-compose.prod.yml root@server:/opt/quanly-trungtam/
```

#### Bước 3: Deploy toàn bộ stack

Tất cả các lệnh sau được thực thi qua SSH, với các biến môi trường được truyền từ GitHub Secrets:

```bash
set -e    # Dừng script ngay khi có lỗi
cd /opt/quanly-trungtam

# 1. Lưu image version hiện tại để rollback
ROLLBACK_BACKEND=$(grep '^BACKEND_IMAGE=' .env.production 2>/dev/null | cut -d= -f2 || echo "")
ROLLBACK_FRONTEND=$(grep '^FRONTEND_IMAGE=' .env.production 2>/dev/null | cut -d= -f2 || echo "")

# 2. Ghi .env.production từ GitHub Secrets
echo "BACKEND_IMAGE=kdisme/quanly-backend:<sha7>" > .env.production
echo "FRONTEND_IMAGE=kdisme/quanly-frontend:<sha7>" >> .env.production
# ... các biến khác

# 3. Pull images mới từ Docker Hub
docker compose --env-file .env.production -f docker-compose.prod.yml pull

# 4. Khởi động postgres trước, đợi healthy
docker compose ... up -d postgres
for i in $(seq 1 30); do
  if docker compose ... exec -T postgres pg_isready ...; then break; fi
  sleep 2
done

# 5. Backup database trước khi migration
docker exec quanly-postgres pg_dump -U postgres db0807 > backups/backup_YYYYMMDD_HHMMSS.sql
# Giữ tối đa 5 bản backup gần nhất

# 6. Khởi động toàn bộ services
docker compose ... up -d

# 7. Chạy migration schema
docker compose ... exec -T backend npm run migrate

# 8. Health check (tối đa 60 giây)
for i in $(seq 1 30); do
  if curl -fsS http://localhost:80/health; then HEALTHY=true; break; fi
  sleep 2
done

# 9. Rollback nếu health check thất bại
if [ "$HEALTHY" != "true" ]; then
  # Khôi phục image cũ và restart
  sed -i "s|BACKEND_IMAGE=.*|BACKEND_IMAGE=${ROLLBACK_BACKEND}|" .env.production
  docker compose ... up -d
  exit 1
fi
```

---

### 5.4 Job 3: Thông báo Telegram

**Job name:** `notify`  
**Điều kiện:** `if: always()` — luôn chạy dù deploy thành công hay thất bại  
**Phụ thuộc:** `needs: [docker, deploy]`

```bash
# Nếu thành công:
TITLE="[OK] Deploy production thanh cong"
# Kèm: Repo, Branch, Commit SHA, Author, Docker result, Deploy result, URL

# Nếu thất bại:
TITLE="[FAIL] CI/CD production that bai"
# Kèm: log lỗi chi tiết (lấy qua GitHub CLI gh run view --log-failed)
# + Link đến GitHub Actions run để xem đầy đủ
```

Gửi qua Telegram Bot API:
```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d chat_id="${TELEGRAM_CHAT_ID}" \
  --data-urlencode text="${MESSAGE}"
```

---

## 6. Quy trình CI/CD từng bước

Dưới đây là luồng đầy đủ từ khi developer push code đến khi ứng dụng chạy trên production:

| # | Bước | Thực hiện bởi | Mô tả |
|---|------|--------------|-------|
| 1 | Push code | Developer | `git push origin production` |
| 2 | Trigger workflow | GitHub | Phát hiện push lên nhánh `production` |
| 3 | Checkout source | GitHub Actions | Clone repo về runner |
| 4 | Set IMAGE_TAG | GitHub Actions | Tag = 7 ký tự đầu của commit SHA |
| 5 | Login Docker Hub | GitHub Actions | Xác thực với Docker Hub bằng Secret |
| 6 | Setup Buildx | GitHub Actions | Bật multi-platform build support |
| 7 | Build backend image | GitHub Actions | `docker build ./backend` với cache GHA |
| 8 | Push backend image | GitHub Actions | Push 2 tag: `<sha7>` và `production` |
| 9 | Build frontend image | GitHub Actions | Multi-stage: Node build → Nginx serve |
| 10 | Push frontend image | GitHub Actions | Push 2 tag: `<sha7>` và `production` |
| 11 | Chuẩn bị server | GitHub Actions | SSH tạo thư mục `/opt/quanly-trungtam` |
| 12 | Copy compose file | GitHub Actions | SCP `docker-compose.prod.yml` lên server |
| 13 | Lưu version hiện tại | Server script | Đọc `.env.production` để rollback nếu cần |
| 14 | Ghi `.env.production` | Server script | Ghi env vars từ GitHub Secrets |
| 15 | Pull images | Server | `docker compose pull` images mới |
| 16 | Khởi động Postgres | Server | `up -d postgres` → đợi `pg_isready` |
| 17 | **Backup database** | Server | `pg_dump` → lưu vào `backups/` |
| 18 | Khởi động services | Server | `docker compose up -d` (toàn bộ) |
| 19 | Chạy migration | Server | `docker exec backend npm run migrate` |
| 20 | **Health check** | Server | Poll `http://localhost:80/health` (60s) |
| 21 | Rollback (nếu lỗi) | Server | Khôi phục image cũ từ bước 13 |
| 22 | Thông báo Telegram | GitHub Actions | Gửi kết quả thành công / thất bại |

---

## 7. Cơ chế Rollback tự động

Trước mỗi lần deploy, pipeline lưu lại version image đang chạy:

```bash
ROLLBACK_BACKEND=$(grep '^BACKEND_IMAGE=' .env.production | cut -d= -f2)
ROLLBACK_FRONTEND=$(grep '^FRONTEND_IMAGE=' .env.production | cut -d= -f2)
```

Sau khi deploy, health check được thực hiện trong **60 giây** (30 lần × 2 giây/lần).  
Nếu health check **không pass**, pipeline tự động:

1. Khôi phục image tag cũ vào `.env.production`
2. Chạy lại `docker compose up -d` với image cũ
3. In ra logs của backend để debug
4. Kết thúc với `exit 1` → job fail → Telegram nhận thông báo lỗi

```
Health check failed!
🔄 Rolling back to: kdisme/quanly-backend:abc1234 ...
✅ Rollback complete
```

> **Lưu ý:** Rollback chỉ khả dụng nếu không phải lần deploy đầu tiên (file `.env.production` phải tồn tại).

---

## 8. Backup Database

Mỗi lần deploy, pipeline tự động backup database **trước khi chạy migration**:

```bash
mkdir -p /opt/quanly-trungtam/backups
BACKUP_FILE="backups/backup_$(date +%Y%m%d_%H%M%S).sql"
docker exec quanly-postgres pg_dump -U postgres db0807 > "$BACKUP_FILE"

# Giữ tối đa 5 bản backup gần nhất (xóa bản cũ hơn)
ls -t backups/*.sql | tail -n +6 | xargs rm -f || true
```

Ví dụ các file backup:
```
/opt/quanly-trungtam/backups/
├── backup_20260817_120000.sql   ← mới nhất
├── backup_20260816_093000.sql
├── backup_20260815_150000.sql
├── backup_20260814_110000.sql
└── backup_20260813_080000.sql   ← cũ nhất được giữ
```

Để restore thủ công từ backup:
```bash
docker exec -i quanly-postgres psql -U postgres db0807 < backups/backup_20260817_120000.sql
```

> ⚠️ **Reset hoàn toàn database** (xóa toàn bộ data):
> ```bash
> docker compose --env-file .env.production -f docker-compose.prod.yml down -v
> ```

---

## 9. Sơ đồ luồng CI/CD

```
Developer
    │
    │  git push origin production
    ▼
GitHub Repository (nhánh: production)
    │
    │  Trigger: on.push.branches: production
    ▼
┌─────────────────────────────────────────────────────────┐
│              GitHub Actions Runner (ubuntu-latest)       │
│                                                         │
│  JOB: docker ─────────────────────────────────────────  │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 1. Checkout code                                 │   │
│  │ 2. Set IMAGE_TAG = ${GITHUB_SHA::7}              │   │
│  │ 3. Login Docker Hub                              │   │
│  │ 4. Setup Buildx                                  │   │
│  │ 5. Build + Push backend → kdisme/quanly-backend  │   │
│  │ 6. Build + Push frontend → kdisme/quanly-frontend│   │
│  └──────────────────┬──────────────────────────────┘   │
│                     │ (success)                          │
│  JOB: deploy ───────▼─────────────────────────────────  │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 7.  SSH: mkdir /opt/quanly-trungtam              │   │
│  │ 8.  SCP: copy docker-compose.prod.yml            │   │
│  │ 9.  SSH: Lưu rollback image version              │   │
│  │ 10. SSH: Ghi .env.production từ Secrets          │   │
│  │ 11. SSH: docker compose pull                     │   │
│  │ 12. SSH: Start postgres → wait pg_isready        │   │
│  │ 13. SSH: pg_dump backup database                 │   │
│  │ 14. SSH: docker compose up -d (all services)     │   │
│  │ 15. SSH: npm run migrate                         │   │
│  │ 16. SSH: Health check /health (60s timeout)      │   │
│  │      ├─ PASS → Deploy thành công ✅              │   │
│  │      └─ FAIL → Rollback image cũ → exit 1 ❌    │   │
│  └──────────────────┬──────────────────────────────┘   │
│                     │ (always)                           │
│  JOB: notify ───────▼─────────────────────────────────  │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 17. Build message (success/failure + log)        │   │
│  │ 18. Send Telegram notification                   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
  Docker Hub                 VPS Server (160.25.166.147)
  kdisme/quanly-backend      /opt/quanly-trungtam/
  kdisme/quanly-frontend       ├── docker-compose.prod.yml
                               ├── .env.production
                               ├── backups/
                               └── (Docker volumes: postgres_data, backend_uploads)
```

---

## 10. Các vấn đề đã gặp và cách xử lý

| # | Vấn đề | Nguyên nhân | Giải pháp áp dụng |
|---|--------|------------|-------------------|
| 1 | 2 pipeline deploy song song gây conflict | Không có giới hạn concurrency | Thêm `concurrency.group: production-deploy`, `cancel-in-progress: false` |
| 2 | Deploy mới lỗi, không thể quay lại bản cũ | Không lưu image version trước | Đọc `.env.production` trước deploy, lưu ROLLBACK vars để `sed -i` khôi phục |
| 3 | Migration gây lỗi schema không rollback được | Chạy migration mà không backup | Thêm bước `pg_dump` tạo snapshot DB trước khi `npm run migrate` |
| 4 | Build chậm do không cache Docker layer | Mỗi lần build lại từ đầu | Dùng `cache-from/cache-to: type=gha,scope=backend/frontend` |
| 5 | Heredoc trong YAML gây lỗi indent khi ghi `.env` | YAML heredoc xử lý indentation | Thay bằng `echo` từng dòng trong một subshell `{ ... } > .env.production` |
| 6 | Backend start nhưng DB chưa ready | Postgres chưa accept connections | Khởi động postgres riêng, loop `pg_isready` tối đa 60 giây trước khi up các service còn lại |
| 7 | Data mất sau khi down container | Không dùng Docker volumes | Khai báo named volumes `postgres_data` và `backend_uploads` trong compose |
| 8 | Frontend không proxy được API | Nginx không có config proxy | Tạo `nginx.conf` với `proxy_pass` tới backend, SPA fallback `try_files` |
