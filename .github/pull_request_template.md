## Issue
Closes #

## Thay đổi
-

## Đã kiểm tra
- [ ] `dotnet build` và `dotnet test` xanh (gồm test kiến trúc và test tích hợp)
- [ ] Có test mới cho hành vi mới; ca lỗi đã thấy đỏ trước khi sửa
- [ ] Endpoint mới đi theo golden path `Semesters` (envelope, `/api/v1`, mã lỗi trong `<Svc>ErrorCodes`)
- [ ] Đổi entity ⇒ có migration (`scripts/ef`) và cập nhật `database/schema.sql`
- [ ] Web: `npm run lint && npm run typecheck && npm test && npm run build`
- [ ] Không sửa tệp nền (BuildingBlocks, gateway, Docker, CI, `*.props`) — hoặc đã hỏi PM
- [ ] Chạy thử qua Swagger hoặc `docker compose up`
