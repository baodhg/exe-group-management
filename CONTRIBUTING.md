# Hướng dẫn đóng góp — EXE Group Management

Tài liệu này là **chuẩn chung** của nhóm. Hạ tầng, khuôn mẫu và các tệp nền do PM (Người 1) giữ; mỗi thành viên chỉ viết tính năng / nghiệp vụ trong phần của mình. Đọc hết một lần trước khi mở PR đầu tiên.

## 1. Chuẩn bị máy

| Công cụ | Phiên bản | Ghi chú |
|---|---|---|
| .NET SDK | 10.0.403 trở lên (ghim ở `global.json`) | `winget install Microsoft.DotNet.SDK.10` |
| Docker Desktop | có Compose v2 | cần cho `docker compose up` và cho test tích hợp (Testcontainers) |
| Visual Studio | 2026 (18.0 trở lên) | chỉ khi muốn chạy F5, cần bộ ASP.NET and web development. VS 2022 không mở được solution này vì SDK đòi MSBuild 18 |
| Node.js | 22 | chỉ khi làm web (`src/web`) |
| Git | bất kỳ | |

```bash
git clone https://github.com/baodhg/exe-group-management.git
cd exe-group-management
cp .env.example .env            # giá trị mẫu dùng ngay được trên máy cá nhân, không cần sửa
dotnet tool restore             # cài dotnet-ef đúng phiên bản của repo
dotnet build ExeGroup.sln
dotnet test                     # cần Docker đang chạy
docker compose up -d --build    # cả hệ: web http://localhost:3000, gateway http://localhost:8080/swagger
```

Máy đã cài SQL Server sẵn (chiếm cổng 1433)? Không sao — container SQL mở ra host ở **14330** (`SQL_HOST_PORT` trong `.env`).

### Chạy và debug bằng Visual Studio (F5)

Cách này chạy các service ngay trên máy, chỉ SQL Server và Redis nằm trong Docker.

```bash
cp .env.local.example .env.local      # cấu hình cho F5 và dotnet run, git không theo dõi tệp này
docker compose up -d sqlserver redis
```

1. Mở `ExeGroup.sln`. Solution Explorer phải báo đủ số project, không có `(unloaded)`.
2. Bật một lần: **Tools > Options > All Settings > Preview Features > Enable Multi-Project Launch Profiles**.
3. Chọn profile **All services** trên thanh công cụ rồi bấm F5.
4. Mở gateway ở `http://localhost:5100/swagger`.

- Đã đổi `SA_PASSWORD` hoặc `SQL_HOST_PORT` trong `.env` thì đổi giống vậy trong `.env.local`, nếu không service sẽ không vào được SQL Server.
- Đã đổi `JWT_SIGNING_KEY` trong `.env` thì đổi `Jwt__SigningKey` giống vậy, nếu không token từ `dev-token.mjs` sẽ bị từ chối.
- Trong `.env.local`, luôn trỏ SQL Server tới `127.0.0.1`. Với `localhost`, service trên Windows có thể hết thời gian chờ khi kết nối rồi dừng hẳn.

Không dùng Visual Studio: `dotnet run --project src/GroupService/ExeGroup.Group.API --launch-profile group-service`, các service khác tương tự.

Token để thử API khi chưa có đăng nhập thật: `node scripts/dev-token.mjs Administrator` (hoặc `Student`, `Lecturer`) → dán vào nút **Authorize** trên Swagger.

## 2. Cấu trúc repo

```text
src/
  BuildingBlocks/        nền dùng chung (PM) — envelope, lỗi, phân trang, JWT, Swagger, health, job nền
  Contracts/             recommendation.proto (gRPC Group → Recommendation, sinh cả client và server)
  ApiGateway/            YARP — cổng vào duy nhất (PM)
  IdentityService/       ExeGroup.Identity.API / .Services / .Repositories
  GroupService/          ExeGroup.Group.API / .Services / .Repositories   ← có golden path Semesters
  RecommendationService/ ExeGroup.Recommendation.API / .Services / .Repositories   (chỉ gRPC, không DB — PM)
  RealtimeService/       ExeGroup.Realtime.API / .Services / .Repositories   (ChatDb, SignalR /hubs/realtime)
  web/                   React 19 + Vite (khung: PM, màn hình: Người 5)
tests/                   ExeGroup.Testing (dùng chung), ArchitectureTests, *.IntegrationTests
docker/ docker-compose.yml scripts/   hạ tầng (PM)
docs/                    đề bài, Lab, thiết kế PRN232_v3 (v3.2), sơ đồ C4
```

**Ai sở hữu gì:** vùng làm việc của thành viên ghi ở `.github/member-paths.txt`; mọi tệp ngoài danh sách này là tệp nền. PR chạm tệp nền (`BuildingBlocks`, gateway, Docker, CI, `Directory.*.props`, `global.json`, `scripts/`, `tests/ExeGroup.Testing`, `tests/ExeGroup.ArchitectureTests`) cần PM duyệt.

## 3. Luật kiến trúc (máy kiểm, không chỉ dặn)

1. **3 tầng, 3 project** mỗi service: `API` → `Services` → `Repositories`. `tests/ExeGroup.ArchitectureTests` làm đỏ CI nếu:
   - API dùng EF Core / DbContext / Entity,
   - Services hoặc Repositories dùng ASP.NET,
   - một service tham chiếu service khác.
2. **4 loại model** (Lab 1): Entity (`Repositories/Entities`) · Business model (`Services/<Feature>`) · Request · Response (`API/Models/<Feature>`). Không trả Entity ra ngoài; Request/Response không xuống Repositories.
3. **Mọi response là envelope** — chỉ trả qua helper của `ApiControllerBase`:

   ```json
   { "success": true, "message": "...", "data": {}, "errors": null, "traceId": "...", "pagination": { "page": 1, "pageSize": 20, "totalItems": 0, "totalPages": 0 } }
   { "success": false, "message": "...", "data": null, "errors": [{ "code": "GROUP_FULL", "field": null, "message": "..." }], "traceId": "..." }
   ```
4. **Lỗi nghiệp vụ = ném exception có mã**, không tự `return BadRequest(...)`:

   | Ném | HTTP | `errors[0].code` |
   |---|---|---|
   | `ValidationFailedException(field, message)` / DataAnnotations / FluentValidation | 400 | `VALIDATION_FAILED` |
   | `UnauthorizedException` | 401 | `UNAUTHORIZED` |
   | `ForbiddenException` | 403 | `FORBIDDEN` |
   | `NotFoundException("Semester", id)` | 404 | `NOT_FOUND` |
   | `ConflictException("<MÃ>", message)` | 409 | mã của bạn — đặt trong `<Svc>ErrorCodes` (đơn xin vào phòng dùng đúng ReasonCode của thiết kế) |
   | vi phạm unique không bắt / `DbUpdateConcurrencyException` | 409 | `DUPLICATE` / `CONCURRENCY_CONFLICT` |
5. **Route có version**: `[ApiVersion(1.0)]` + `[Route("api/v{version:apiVersion}/<tài-nguyên-số-nhiều>")]`.
6. **Mặc định phải đăng nhập** (fallback policy). Endpoint công khai phải ghi `[AllowAnonymous]` rõ ràng. Quyền theo vai trò: `[Authorize(Roles = Roles.Administrator)]`; quyền nghiệp vụ (leader của nhóm, lecturer của lớp) kiểm trong Services bằng `ICurrentUser`.
7. **Services không dùng EF Core** (test kiến trúc chặn). Mở transaction bằng `ITransactionRunner.ExecuteAsync(...)` inject vào service; đọc và sửa entity qua repository **bên trong** lambda (helper từ chối nếu context đang track entity từ trước). Bắt trùng unique trong repository bằng `TrySaveChangesAsync` rồi ném `ConflictException` có mã riêng ở service.
8. **Không chép helper**: cần thứ dùng ≥ 2 service ⇒ đề xuất đưa vào `BuildingBlocks` (PR riêng, PM duyệt).
9. **Không thêm package** trong csproj kèm `Version=`: phiên bản chỉ nằm ở `Directory.Packages.props` (PM).

## 4. Thêm một endpoint mới — làm theo golden path `Semesters`

Mở song song các tệp của `Semesters` trong `src/GroupService` và làm y hệt cho tính năng của bạn (ví dụ `Courses`):

| Bước | Tệp mẫu | Bạn tạo |
|---|---|---|
| 1. Entity | `ExeGroup.Group.Repositories/Entities/Semester.cs` | `Entities/Course.cs` |
| 2. Cấu hình EF (tên bảng, index, CHECK **đúng tên trong `database/schema.sql`**) | `Data/Configurations/SemesterConfiguration.cs` | `CourseConfiguration.cs` + `DbSet` trong `GroupDbContext` |
| 3. Migration | `scripts/ef.sh Group migrations add AddCourses` (Windows: `./scripts/ef.ps1 Group migrations add AddCourses`) | kiểm `scripts/ef.sh Group migrations script` khớp `schema.sql` |
| 4. Repository | `Interfaces/ISemesterRepository.cs`, `Repositories/SemesterRepository.cs` (SortMap có `ByDefault` + `TieBreaker`) | đăng ký trong `Repositories/DependencyInjection.cs` |
| 5. Business model + service | `ExeGroup.Group.Services/Semesters/*` | luật nghiệp vụ, ném exception có mã; đăng ký trong `Services/DependencyInjection.cs` |
| 6. Request / Response / mapping | `ExeGroup.Group.API/Models/Semesters/*` | DataAnnotations + 1 FluentValidator nếu có luật chéo trường |
| 7. Controller | `Controllers/SemestersController.cs` | `List` dùng `ListQueryRequest` + `Paged(...)`, `Get` có `Name =` cho `CreatedAtRoute`, ghi `[EndpointSummary]` thay cho chú thích |
| 8. Test tích hợp | `tests/ExeGroup.Group.IntegrationTests/SemestersEndpointTests.cs` | viết **trước** khi cài, chạy thấy đỏ, cài xong thấy xanh |

Danh sách nhận sẵn: `search`, `sort=title,-createdAt` (nhiều trường, `-` = giảm dần), `page`, `pageSize` (mặc định 20, tối đa 100), `fields=code,name`, `expand=...`.

## 5. Test

- `dotnet test` chạy toàn bộ (unit + kiến trúc + tích hợp SQL Server thật qua Testcontainers — cần Docker).
- Test tích hợp của service: dùng `ServiceApiFactory<Program>` + `SqlServerContainer` (`tests/ExeGroup.Testing`), gọi `MigrateAsync()` trong fixture, gọi API bằng `ClientAs(Roles.Student)`.
- Tên ca test mô tả hành vi (`A_duplicate_code_is_a_conflict_with_a_business_code`). Mỗi lỗi sửa phải kèm một test chứng minh đỏ trước / xanh sau.
- Web: `cd src/web && npm run lint && npm run typecheck && npm test && npm run build`.

## 6. Nhánh, commit, PR

- Nhánh: `feat/<số-issue>-<mô-tả-ngắn>` (ví dụ `feat/20-exe-classes`), `fix/...`, cắt từ `main` mới nhất. **Không push thẳng `main`** (đã bật branch protection).
- Commit: Conventional Commits **tiếng Anh**, ≤ 72 ký tự, nói điều thay đổi cho người đọc — `feat: let leaders approve join requests`, `fix: reject joins after the class deadline`.
- PR: tiêu đề dạng `feat(group): thêm tìm kiếm môn học` (đây sẽ là commit trên `main`). PR `feat` và `fix` phải có `Closes #20`.
- **Merge khi và chỉ khi CI xanh, không ai có ngoại lệ, kể cả PM.** Không cần chờ review. Bấm **Enable auto-merge** là xong, nhánh cũ thì bấm **Update branch**.

| Check | Máy kiểm gì |
|---|---|
| `dotnet` | Build không warning, `dotnet format`, toàn bộ test, đổi entity phải có migration |
| `web` | Lint, kiểm kiểu, test, build |
| `docker` | Compose hợp lệ, build được mọi image |
| `architecture` | Sơ đồ C4 hợp lệ |
| `conventions` | Tiêu đề PR, có issue, có test, không thêm chú thích, controller dùng envelope, không chép version package, migration có thao tác đi cùng `schema.sql`, không đổi số field proto (bỏ cả file contract thì được), web không viết cứng địa chỉ server, quét secret |
| `infra-guard` | PR của thành viên sửa tệp ngoài `.github/member-paths.txt`, hoặc bất kỳ tệp build nào (`*.csproj`, `Directory.*`, Dockerfile...), phải được PM duyệt đúng commit mới nhất, rồi bấm Re-run job này |
- Mã: tên định danh, message lỗi, log bằng **tiếng Anh**; chuỗi hiển thị trên web bằng tiếng Việt có dấu.

## 7. Web (`src/web`)

- Gọi API qua `useAuth().api` (`get / post / put / delete`) — đã gắn token, tự refresh một lần khi 401, lỗi thành `ApiError` (`code`, `fieldErrors()`, `traceId`).
- Trang danh sách: chép `src/features/semesters/SemestersPage.tsx` (TanStack Query + pagination).
- Duyệt đơn xin vào phòng trả **200** ngay (một transaction trong GroupDb), không còn 202 + polling. Cập nhật trực tiếp (bảng phòng, thông báo, chat) đi qua SignalR `/hubs/realtime`.
- Chặn theo vai trò: bọc route bằng `<RequireRole roles={["Student"]}>`.

## 8. Khi gặp khó

- Lỗi build "type/namespace not found" ⇒ sửa `using` / `ProjectReference`, **không** tạo lại lớp ở chỗ khác.
- Thiếu thứ gì ở nền (middleware, helper, package) ⇒ mở issue gắn nhãn `area:platform`, gán PM.
- Báo lỗi API: luôn kèm `traceId` trong envelope — tra log bằng `docker compose logs <service> | grep <traceId>`.
