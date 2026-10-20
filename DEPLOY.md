# ติดตั้ง PIX KU CSC ด้วย Docker

ระบบทั้งชุดรันเป็น 3 container จากไฟล์ `docker-compose.prod.yml`

| container | ทำอะไร                                                 | อยู่นานแค่ไหน                |
| --------- | ------------------------------------------------------ | ---------------------------- |
| `db`      | PostgreSQL 18                                          | ตลอด                         |
| `migrate` | สร้าง/อัปเดตตารางในฐานข้อมูลจาก `db/migrations` แล้วจบ | รันแล้วออก ทุกครั้งที่สตาร์ท |
| `app`     | ตัวเว็บ (Next.js standalone) ฟังที่ `127.0.0.1:3313`   | ตลอด                         |

ข้อมูลที่ต้องเก็บรักษาอยู่ใน 2 volume — **ต้องสำรองทั้งคู่ด้วยกัน**

| volume               | มีอะไร                                                                |
| -------------------- | --------------------------------------------------------------------- |
| `pix-ku-csc_pgdata`  | ฐานข้อมูลทั้งหมด                                                      |
| `pix-ku-csc_storage` | รูปต้นฉบับ รูปย่อ รูปหน้าที่ผู้ใช้บันทึกไว้ — ข้อมูลส่วนบุคคลตาม PDPA |

ใน image **ไม่มีรหัสผ่านหรือ key ใด ๆ** ทุกค่าใส่ตอนสตาร์ทจากไฟล์ `.env.docker`

---

## 1. สิ่งที่ต้องมี

- เครื่องที่ลง Docker Engine + Docker Compose v2 (Linux หรือ Docker Desktop) แรม 2GB ขึ้นไป
- Google OAuth client (Google Cloud Console → APIs & Services → Credentials)
  - Authorized redirect URI: `<APP_URL>/api/auth/callback/google`
- AWS access key ที่มีสิทธิ์ Rekognition (`CreateCollection`, `DeleteCollection`, `IndexFaces`,
  `SearchFacesByImage`, `DetectFaces`, `DeleteFaces`) — หรือใช้ `FACE_PROVIDER=mock` เพื่อลองระบบโดยไม่เรียก AWS
- ชื่อโดเมนที่จะเปิดให้คนเข้า (เช่นผ่าน Cloudflare Tunnel)

## 2. ตั้งค่า

```bash
cp .env.docker.example .env.docker
```

แก้ `.env.docker` อย่างน้อย:

| ค่า                                           | ใส่อะไร                                                                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                                     | ที่อยู่สาธารณะของเว็บ เช่น `https://pix-ku-csc.example.com` — QR ทุกอันชี้ไปที่นี่ เปลี่ยนทีหลังแล้ว QR ที่พิมพ์ไปแล้วจะเสีย |
| `POSTGRES_PASSWORD`                           | รหัสยาว ๆ แบบสุ่ม                                                                                                            |
| `AUTH_SECRET`                                 | `openssl rand -base64 32` — ถ้าเปลี่ยนทีหลัง ทุกคนต้องล็อกอินใหม่และต้องใส่ PIN งานส่วนตัวใหม่                               |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`       | จาก Google Cloud                                                                                                             |
| `ADMIN_EMAILS`                                | อีเมลที่จะเป็นแอดมินตอนล็อกอินครั้งแรก คั่นด้วย `,`                                                                          |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | จาก AWS                                                                                                                      |

`.env.docker` อยู่ใน `.gitignore` แล้ว ห้าม commit

## 3. ติดตั้งและเปิดใช้

```bash
docker compose -f docker-compose.prod.yml --env-file .env.docker up -d --build
```

ครั้งแรกใช้เวลาสร้าง image ราว 1–3 นาที จากนั้นตรวจ:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.docker ps
# migrate ต้องเป็น "Exited (0)" และ app ต้องเป็น "healthy"

curl -I http://127.0.0.1:3313/
```

เว็บฟังเฉพาะ `127.0.0.1` เท่านั้นโดยตั้งใจ ให้เปิดออกเน็ตผ่าน Cloudflare Tunnel หรือ reverse proxy
(ถ้าเปิดพอร์ตตรงให้ทั้งวง LAN คนในวงเดียวกันจะปลอม IP หลบ rate limit ได้)

ตัวอย่าง Cloudflare Tunnel (`config.yml` ของ cloudflared):

```yaml
ingress:
  - hostname: pix-ku-csc.example.com
    service: http://127.0.0.1:3313
  - service: http_status:404
```

## 4. ใช้งานประจำวัน

```bash
F="-f docker-compose.prod.yml --env-file .env.docker"

docker compose $F logs -f app          # ดู log เว็บ
docker compose $F restart app          # รีสตาร์ทเว็บ
docker compose $F down                 # หยุดทั้งหมด (ข้อมูลยังอยู่)
docker compose $F up -d                # เปิดกลับ
```

**ห้ามใช้ `down -v`** — `-v` ลบ volume คือลบฐานข้อมูลและรูปทั้งหมดทิ้ง

ระบบออกแบบให้รัน `app` **ตัวเดียว** (rate limit และคิวประมวลผลรูปอยู่ในหน่วยความจำ) อย่าตั้ง `replicas` มากกว่า 1

## 5. อัปเดตเป็นเวอร์ชันใหม่

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.docker up -d --build
```

`migrate` รันก่อน `app` เสมอ ถ้า migration ล้ม เว็บเวอร์ชันใหม่จะไม่สตาร์ท (เวอร์ชันเก่าถูกแทนแล้ว
ให้ดู `docker compose ... logs migrate`) — **สำรองข้อมูลก่อนอัปเดตทุกครั้ง**

## 6. ติดตั้งบนเครื่องที่ไม่มีซอร์สโค้ด

### ทางที่ 1: ดึง image จาก Docker Hub (GitHub Actions build ให้)

ไฟล์ `.github/workflows/docker-image.yml` build image แล้ว push ขึ้น Docker Hub ของคุณเองทุกครั้งที่
push เข้า `master` หรือ push tag เช่น `v1.2.3` (pull request จะ build เช็กเฉย ๆ ไม่ push)

**ตั้งค่าครั้งเดียว**

1. Docker Hub → Account settings → Personal access tokens → สร้าง token สิทธิ์ **Read & Write**
2. GitHub → repository → Settings → Secrets and variables → Actions
   - แท็บ **Variables**: `DOCKER_HUB_USERNAME` = ชื่อผู้ใช้ Docker Hub
   - แท็บ **Secrets**: `DOCKER_HUB_TOKEN` = token จากข้อ 1
3. push ขึ้น GitHub หรือกด Run workflow ในแท็บ Actions

repository บน Docker Hub ชื่อ `<ชื่อผู้ใช้>/pix-ku-csc` ถูกสร้างให้เองตอน push ครั้งแรก
ทั้งสอง image อยู่ใน repository เดียว แยกกันด้วย tag (แพ็กเกจฟรีของ Docker Hub ทำ private ได้ 1 repository):

| image    | tag                                                                  |
| -------- | -------------------------------------------------------------------- |
| เว็บ     | `master`, `sha-xxxxxxx`, และ `1.2.3` / `1.2` / `latest` เมื่อติด tag |
| migrator | tag เดียวกันต่อท้าย `-migrator` เช่น `master-migrator`               |

**ติดตั้ง** บนเครื่องปลายทางต้องมีแค่ `docker-compose.prod.yml` และ `.env.docker` ที่ตั้งค่า:

```
APP_IMAGE=<ชื่อผู้ใช้ Docker Hub>/pix-ku-csc
APP_VERSION=master
```

แล้ว

```bash
docker compose -f docker-compose.prod.yml --env-file .env.docker pull
docker compose -f docker-compose.prod.yml --env-file .env.docker up -d --no-build
```

ถ้า repository บน Docker Hub เป็น private ต้อง `docker login` บนเครื่องปลายทางก่อน
(ใช้ token สิทธิ์ Read-only ก็พอ)

### ทางที่ 2: ยกไฟล์ image ไปเอง

สร้าง image บนเครื่องนี้แล้วยกไปทั้งไฟล์:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.docker build
docker save pix-ku-csc:latest pix-ku-csc:latest-migrator postgres:18.4 | gzip > pix-ku-csc-images.tar.gz
```

บนเครื่องปลายทาง ต้องมีแค่ `pix-ku-csc-images.tar.gz`, `docker-compose.prod.yml`, `.env.docker`:

```bash
docker load < pix-ku-csc-images.tar.gz
docker compose -f docker-compose.prod.yml --env-file .env.docker up -d --no-build
```

(ถ้าจะ build ใหม่บนเครื่องที่ไม่มี image ต้องลบ `--no-build` และต้องมีซอร์สโค้ด)

## 7. สำรองและกู้คืน

สำรอง (ทำทั้งสองอย่าง):

```bash
F="-f docker-compose.prod.yml --env-file .env.docker"

# ฐานข้อมูล
docker compose $F exec -T db pg_dump -U pixku -d pixku -Fc > backup-db-$(date +%F).dump

# รูปทั้งหมด
docker run --rm -v pix-ku-csc_storage:/data -v "$PWD":/backup alpine \
  tar czf /backup/backup-storage-$(date +%F).tar.gz -C /data .
```

กู้คืนลงระบบที่เพิ่งติดตั้งใหม่ (หยุด `app` ก่อน):

```bash
docker compose $F stop app
docker compose $F exec -T db pg_restore -U pixku -d pixku --clean --if-exists < backup-db-YYYY-MM-DD.dump
docker run --rm -v pix-ku-csc_storage:/data -v "$PWD":/backup alpine \
  sh -c "tar xzf /backup/backup-storage-YYYY-MM-DD.tar.gz -C /data && chown -R 1000:1000 /data"
docker compose $F start app
```

ไฟล์สำรองมีข้อมูลใบหน้าของคน — เก็บในที่ที่จำกัดสิทธิ์เหมือนตัวฐานข้อมูล

## 8. ย้ายข้อมูลจากระบบเดิม (PM2 + `docker-compose.yml` ฐานข้อมูลพอร์ต 5433)

```bash
# 1) dump ฐานข้อมูลเดิม
docker exec findkudae-db pg_dump -U findkudae -d findkudae -Fc > old.dump

# 2) เปิดระบบใหม่ให้ migrate สร้างตารางก่อน แล้วหยุดเว็บ
docker compose -f docker-compose.prod.yml --env-file .env.docker up -d
docker compose -f docker-compose.prod.yml --env-file .env.docker stop app

# 3) เทข้อมูลเดิมลงไป (ทับตารางที่เพิ่งสร้าง)
docker compose -f docker-compose.prod.yml --env-file .env.docker exec -T db \
  pg_restore -U pixku -d pixku --clean --if-exists --no-owner < old.dump

# 4) คัดลอกรูปเดิม (โฟลเดอร์ storage ของโปรเจกต์)
docker run --rm -v pix-ku-csc_storage:/data -v "/path/to/pix-ku-csc/storage":/src alpine \
  sh -c "cp -a /src/. /data/ && chown -R 1000:1000 /data"

# 5) เปิดเว็บ
docker compose -f docker-compose.prod.yml --env-file .env.docker start app
```

- ใช้ `AUTH_SECRET` **ค่าเดิม** ถ้าไม่อยากให้ทุกคนต้องล็อกอินและใส่ PIN ใหม่
- `APP_URL` ต้องตรงกับที่ QR เดิมชี้อยู่
- ใบหน้าที่ index ไว้แล้วยังใช้ได้ เพราะแต่ละงานจำชื่อ collection บน AWS ของตัวเองไว้ในฐานข้อมูล
- อย่าเปิด PM2 กับ container พร้อมกันบนพอร์ตเดียวกัน — `pm2 stop pix-ku-csc` ก่อน

## 9. แก้ปัญหา

| อาการ                                         | ดูที่                                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `migrate` ไม่เป็น Exited (0)                  | `docker compose ... logs migrate` — มักเป็นรหัสผ่านฐานข้อมูลไม่ตรงกับ volume ที่มีอยู่ |
| ล็อกอิน Google แล้วขึ้น redirect_uri_mismatch | redirect URI ใน Google Cloud ต้องเป็น `<APP_URL>/api/auth/callback/google` ตรงตัว      |
| QR ชี้ไป localhost                            | ยังไม่ได้ตั้ง `APP_URL`                                                                |
| อัปโหลดรูปแล้วสถานะ failed                    | `logs app` — มักเป็น AWS key หรือสิทธิ์ Rekognition                                    |
| อยากลองระบบโดยไม่เสียค่า AWS                  | `FACE_PROVIDER=mock` แล้ว `up -d` ใหม่                                                 |
