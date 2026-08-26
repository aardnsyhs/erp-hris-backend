# HRIS & ERP Core Module Backend

Backend service untuk sistem **ERP & HRIS (Human Resource Information System)** yang mengelola siklus hidup kepegawaian, autentikasi berbasis RBAC (Role-Based Access Control), struktur organisasi (Department), manajemen absensi (Attendance), pengajuan & persetujuan cuti (Leave Request), serta pemrosesan payroll berkala.

---

## 1. Tech Stack Aktual

- **Runtime & Framework**: [Node.js](https://nodejs.org/) (v20+) & [NestJS](https://nestjs.com/) `v11.0.1`
- **Database & ORM**: [PostgreSQL](https://www.postgresql.org/) `v16+` & [Prisma ORM](https://www.prisma.io/) `v7.10.0` (menggunakan `@prisma/adapter-pg`)
- **Authentication & Security**:
  - Access Token: `@nestjs/jwt` `v11.0.2` & `passport-jwt` `v4.0.1` (Short-lived, in-memory)
  - Refresh Token: Database-persisted with single-use rotation, reuse detection, dan `httpOnly` secure cookie (`cookie-parser` `v1.4.7`)
  - Password Hashing: `bcrypt` `v6.0.0`
  - Rate Limiting: `@nestjs/throttler` `v6.5.0`
- **Validation & Serialization**: `class-validator` `v0.15.1` & `class-transformer` `v0.5.1`
- **API Documentation**: OpenAPI / Swagger via `@nestjs/swagger` `v11.4.7`
- **Testing**: [Jest](https://jestjs.io/) `v30.0.0` & [Supertest](https://github.com/ladjs/supertest) `v7.0.0`

---

## 2. Struktur Folder & Arsitektur

Backend menerapkan pola arsitektur **Controller $\rightarrow$ Service $\rightarrow$ Repository** yang konsisten dan terisolasi per modul bisnis:

```text
src/
├── common/                     # Cross-cutting concerns & shared utilities
│   ├── decorators/             # @Public, @Roles, @CurrentUser
│   ├── guards/                 # JwtAuthGuard (Global), RolesGuard (Global), JwtRefreshGuard
│   ├── interfaces/             # AuthenticatedUser interface
│   └── strategies/             # JwtStrategy, JwtRefreshStrategy
├── config/                     # Konfigurasi aplikasi & environment
├── modules/                    # Modul-modul domain bisnis
│   ├── auth/                   # Autentikasi, login, rotating refresh token, logout, profil
│   │   ├── dto/                # LoginDto, AuthResponseDto
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.repository.ts
│   │   └── auth.module.ts
│   ├── department/             # Manajemen departemen & validasi dependensi karyawan
│   │   ├── dto/                # CreateDepartmentDto, UpdateDepartmentDto, PaginationQueryDto
│   │   ├── department.controller.ts
│   │   ├── department.service.ts
│   │   ├── department.repository.ts
│   │   └── department.module.ts
│   ├── employee/               # Manajemen data karyawan (soft-delete, Decimal salary)
│   │   ├── dto/                # CreateEmployeeDto, UpdateEmployeeDto, EmployeeQueryDto
│   │   ├── employee.controller.ts
│   │   ├── employee.service.ts
│   │   ├── employee.repository.ts
│   │   └── employee.module.ts
│   ├── attendance/             # Absensi harian (check-in, check-out, unique daily guard)
│   │   ├── dto/                # CheckInDto, CheckOutDto, AttendanceQueryDto
│   │   ├── attendance.controller.ts
│   │   ├── attendance.service.ts
│   │   ├── attendance.repository.ts
│   │   └── attendance.module.ts
│   ├── leave-request/          # Pengajuan cuti, validasi overlap, approval workflow
│   │   ├── dto/                # CreateLeaveRequestDto, RejectLeaveRequestDto, LeaveRequestQueryDto
│   │   ├── leave-request.controller.ts
│   │   ├── leave-request.service.ts
│   │   ├── leave-request.repository.ts
│   │   └── leave-request.module.ts
│   └── payroll/                # Draft payroll, snapshotting gaji, status lifecycle, visibility filtering
│       ├── dto/                # CreatePayrollDto, UpdatePayrollDto, PayrollQueryDto, PayrollResponseDto
│       ├── payroll.controller.ts
│       ├── payroll.service.ts
│       ├── payroll.repository.ts
│       └── payroll.module.ts
├── prisma/                     # Prisma schema, PrismaService, adapter setup, dan seed data
├── app.module.ts               # Root module pendaftaran guard global & modul domain
└── main.ts                     # Bootstrap aplikasi, global pipes, prefix api/v1, Swagger setup
```

---

## 3. Daftar Endpoint Lengkap

Dokumentasi interaktif OpenAPI / Swagger dapat diakses di: `http://localhost:3000/api/docs`.

### A. System & Health Check (`/api/v1/health`)
| Method | Path | Role yang Diizinkan | Deskripsi |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Public | Health check status service `{ status: 'ok', service: 'erp-hris-backend', timestamp }` |

### B. Autentikasi (`/api/v1/auth`)
| Method | Path | Role yang Diizinkan | Deskripsi |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Public (Rate limited: 5 req/min) | Login pengguna, menghasilkan access token & cookie refresh token |
| `POST` | `/api/v1/auth/refresh` | Public (Cookie) | Rotasi access token & single-use refresh token |
| `POST` | `/api/v1/auth/logout` | Public (Cookie) | Revoke token session di database & hapus cookie |
| `GET` | `/api/v1/auth/me` | All Authenticated | Ambil profil pengguna yang sedang login |

### B. Departemen (`/api/v1/departments`)
| Method | Path | Role yang Diizinkan | Deskripsi |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/departments` | `HR_ADMIN` | Buat departemen baru (kode unik) |
| `GET` | `/api/v1/departments` | All Authenticated | Ambil daftar departemen terpaginasi & pencarian |
| `GET` | `/api/v1/departments/:id` | All Authenticated | Ambil detail satu departemen |
| `PATCH` | `/api/v1/departments/:id` | `HR_ADMIN` | Update nama atau kode departemen |
| `DELETE` | `/api/v1/departments/:id` | `HR_ADMIN` | Hapus permanen departemen (ditolak jika ada karyawan aktif) |

### C. Karyawan (`/api/v1/employees`)
| Method | Path | Role yang Diizinkan | Deskripsi |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/employees` | `HR_ADMIN` | Tambah karyawan baru (NIP & email unik) |
| `GET` | `/api/v1/employees` | All Authenticated | List karyawan terpaginasi (HR_ADMIN: semua, MANAGER: tim dept, EMPLOYEE: diri sendiri) |
| `GET` | `/api/v1/employees/:id` | All Authenticated | Detail karyawan (Role-scoped) |
| `PATCH` | `/api/v1/employees/:id` | `HR_ADMIN` | Update data profil karyawan |
| `DELETE` | `/api/v1/employees/:id` | `HR_ADMIN` | Soft delete karyawan (`deletedAt: now()`, `status: INACTIVE`) |

### D. Absensi (`/api/v1/attendances`)
| Method | Path | Role yang Diizinkan | Deskripsi |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/attendances/check-in` | All Authenticated (with employeeId) | Check-in harian untuk user aktif (status default PRESENT) |
| `PATCH` | `/api/v1/attendances/check-out` | All Authenticated (with employeeId) | Check-out hari ini (ditolak jika belum check-in atau waktu mundur) |
| `GET` | `/api/v1/attendances` | All Authenticated | Riwayat absensi terpaginasi (HR_ADMIN: semua, MANAGER: tim dept, EMPLOYEE: diri sendiri) |

### E. Pengajuan Cuti (`/api/v1/leave-requests`)
| Method | Path | Role yang Diizinkan | Deskripsi |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/leave-requests` | All Authenticated (with employeeId) | Ajukan cuti baru (status PENDING, tolak jika ada overlap APPROVED) |
| `GET` | `/api/v1/leave-requests` | All Authenticated | Daftar cuti terpaginasi (Role-scoped) |
| `GET` | `/api/v1/leave-requests/:id` | All Authenticated | Detail cuti (Role-scoped) |
| `PATCH` | `/api/v1/leave-requests/:id/approve` | `HR_ADMIN`, `MANAGER` | Setujui cuti (Tolak jika self-approval atau beda departemen) |
| `PATCH` | `/api/v1/leave-requests/:id/reject` | `HR_ADMIN`, `MANAGER` | Tolak cuti dengan alasan penolakan wajib (`rejectionReason`) |

### F. Payroll (`/api/v1/payrolls`)
| Method | Path | Role yang Diizinkan | Deskripsi |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/payrolls` | `HR_ADMIN` | Generate draft payroll baru (snapshot `basicSalary`, hitung `netSalary`) |
| `GET` | `/api/v1/payrolls` | All Authenticated | Daftar payroll (Role-scoped & Field-Stripping untuk Manager) |
| `GET` | `/api/v1/payrolls/:id` | All Authenticated | Detail payroll (Role-scoped & Field-Stripping) |
| `PATCH` | `/api/v1/payrolls/:id/process` | `HR_ADMIN` | Transisi status `DRAFT` $\rightarrow$ `PROCESSED` |
| `PATCH` | `/api/v1/payrolls/:id/pay` | `HR_ADMIN` | Transisi status `PROCESSED` $\rightarrow$ `PAID` (set `paymentDate` UTC) |
| `PATCH` | `/api/v1/payrolls/:id` | `HR_ADMIN` | Update allowances/deductions saat status `DRAFT` |
| `DELETE` | `/api/v1/payrolls/:id` | `HR_ADMIN` | Hapus payroll saat status `DRAFT` (PROCESSED/PAID dilindungi) |

---

## 4. Penjelasan Role-Based Access Control (RBAC)

Sistem menggunakan 3 level hak akses (*UserRole*):
1. **`HR_ADMIN`**:
   - Memiliki hak akses penuh (*Full Access*) untuk membuat, membaca, memperbarui, dan menghapus seluruh entitas di semua departemen.
   - Akses penuh terhadap seluruh data finansial payroll.
2. **`MANAGER`**:
   - Dibatasi secara ketat pada lingkup departemennya (*Department-Scoped*). "Tim" seorang Manager didefinisikan sebagai seluruh karyawan yang berada di `departmentId` yang sama dengan akun Manager tersebut.
   - Dapat menyetujui (`approve`) dan menolak (`reject`) permohonan cuti anggota timnya, namun **dicegah melakukan self-approval** terhadap permohonannya sendiri.
   - **Khusus Modul Payroll**: Manager hanya dapat melihat ringkasan status non-finansial anggota timnya (`PayrollManagerViewDto`). Nilai finansial (`basicSalary`, `allowances`, `deductions`, `netSalary`) **secara ketat disembunyikan/di-strip**. Namun, jika Manager mengakses slip gajinya **sendiri**, data finansial lengkap tetap ditampilkan (*Self-access Precedence*).
3. **`EMPLOYEE`**:
   - Hanya memiliki izin untuk melihat dan mengelola data miliknya sendiri (*Self-Service Scope*).
   - Melakukan check-in/check-out harian, mengajukan permohonan cuti pribadi, dan melihat slip gaji personal miliknya.

---

## 5. Keputusan Desain & Catatan Arsitektur Penting

1. **Snapshotting `basicSalary` pada Payroll**:
   - Kolom `basicSalary` pada tabel `payrolls` adalah tipe `Decimal(15, 2)` mandiri. Saat `create()` dipanggil, nilai `Employee.baseSalary` saat itu disalin secara permanen (*copy value*). Kenaikan gaji karyawan di masa depan tidak akan mengubah riwayat payroll yang telah di-generate sebelumnya.
2. **Aritmatika Desimal Presisi Tinggi**:
   - Seluruh operasi finansial menggunakan metode objek `Prisma.Decimal` (`.plus()`, `.minus()`) untuk mencegah potensi ketidakakuratan pembulatan *floating-point* JavaScript:
     $$\text{netSalary} = \text{basicSalary} + \text{allowances} - \text{deductions}$$
3. **Pencegahan Race Condition via Atomic `updateMany`**:
   - Transisi status lifecycle (`DRAFT` $\rightarrow$ `PROCESSED` $\rightarrow$ `PAID`) dan penghapusan payroll menggunakan klausa atomik `WHERE status = expectedStatus` di tingkat database PostgreSQL. Jika dua request bersaing secara bersamaan, PostgreSQL *row-level lock* memastikan hanya satu transisi yang berhasil (`count = 1`), sedangkan request kedua gagal dengan `ConflictException` (`count = 0`).
4. **Dokumentasi Limitasi Update Draft Konkuren**:
   - Pada endpoint `PATCH /payrolls/:id`, karena status sebelum dan sesudah update tetap `DRAFT`, dua request update yang mengedit allowances dan deductions secara simultan berpotensi mengalami *lost-update*. Hal ini diterima sebagai limitasi yang terdokumentasi untuk Phase 1.
5. **Whitelist Response Transformer**:
   - Untuk mencegah kebocoran data finansial ke role `MANAGER`, sistem tidak menggunakan mutasi *delete property*, melainkan *explicit whitelist mapper* (`mapToManagerView`) yang sama sekali tidak menginstansiasi properti finansial pada objek keluaran.

---

## 6. Petunjuk Instalasi & Menjalankan Aplikasi

### A. Prasyarat
- Node.js `v20+`
- PostgreSQL `v16+` (berjalan pada port `5432`)

### B. Konfigurasi Environment (`.env`)
Salin atau buat file `.env` di folder `erp-hris-backend/`:

```env
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hris_erp?schema=public"

JWT_ACCESS_SECRET="super-secret-jwt-access-key-2026"
JWT_ACCESS_EXPIRATION="15m"

JWT_REFRESH_SECRET="super-secret-jwt-refresh-key-2026"
JWT_REFRESH_EXPIRATION="7d"

THROTTLE_TTL=60000
THROTTLE_LIMIT=100
```

### C. Migrasi Database & Seeding
```bash
# Jalankan migrasi Prisma ke database PostgreSQL
npx prisma migrate dev

# Jalankan seeder data awal (2 departemen, 5 karyawan, absensi, cuti, dan payroll)
npm run seed
```

### D. Menjalankan Server
```bash
# Development Mode (Hot-reload)
npm run start:dev

# Production Mode
npm run build
npm run start:prod
```

### Kredensial Akun Seeding untuk Pengujian
| Email | Password | Role | Departemen |
| :--- | :--- | :--- | :--- |
| `admin.hr@example.com` | `password123` | `HR_ADMIN` | Human Resources |
| `manager.eng@example.com` | `password123` | `MANAGER` | Engineering |
| `dev.andi@example.com` | `password123` | `EMPLOYEE` | Engineering |
| `dev.siti@example.com` | `password123` | `EMPLOYEE` | Engineering |
| `hr.rian@example.com` | `password123` | `EMPLOYEE` | Human Resources |

---

## 7. Pengujian (Testing)

Suite pengujian mencakup **97 Unit Test** dan **3 E2E Test** (Total: **100 Tests Passed**):

```bash
# 1. Menjalankan seluruh unit test
npm test

# 2. Menjalankan pengujian per modul spesifik
npx jest src/modules/auth/auth.service.spec.ts
npx jest src/modules/department/department.service.spec.ts
npx jest src/modules/employee/employee.service.spec.ts
npx jest src/modules/attendance/attendance.service.spec.ts
npx jest src/modules/leave-request/leave-request.service.spec.ts
npx jest src/modules/payroll/payroll.service.spec.ts

# 3. Menjalankan End-to-End (E2E) test
npm run test:e2e
```
