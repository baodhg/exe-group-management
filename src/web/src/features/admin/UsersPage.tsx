import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Lock, LockOpen, Pencil, Plus, UserRound, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "../../shared/auth/useAuth";
import { initialsOf, roleLabels } from "../../shared/layout/navigation";
import { fullNameMax, passwordMax } from "../account/accountRules";
import { RoleBadge } from "../account/RoleBadge";
import { errorText, formatDate } from "../common/messages";
import type { User } from "../common/types";
import { Badge, Choice, Criteria, Criterion, EmptyState, Failure, Field, PageHeader, Pager, SearchField, Section, Toolbar } from "../common/ui";
import { ClearFilters, FormDialog, PageFailure, TableSkeleton } from "./CatalogFrame";
import { errorCodeOf, isAccessFailure, isNotFound } from "./catalogRules";
import { useClampedPage } from "./useClampedPage";
import { userCodeMax, userDraftState, type UserDraft } from "./userRules";

const roles = ["Student", "Lecturer", "Administrator"] as const;
const heads = ["Người dùng", "Mã", "Vai trò", "Trạng thái", "Tạo ngày", "Thao tác"];

type Open = { kind: "create" } | { kind: "edit"; user: User } | { kind: "lock"; user: User } | null;

export function UsersPage() {
  const { api, user: me } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Open>(null);

  const users = useQuery({
    queryKey: ["users", search, role, status, page],
    queryFn: () => api.get<User[]>("/api/v1/users", { search, role: role === "all" ? undefined : role, status: status === "all" ? undefined : status, page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const changeStatus = useMutation({
    mutationFn: (user: User) => api.put(`/api/v1/users/${user.id}`, { fullName: user.fullName, userCode: user.userCode, roles: user.roles, status: user.status === "Active" ? "Locked" : "Active" }),
    onSuccess: async (_, user) => {
      toast.success(user.status === "Active" ? `Đã khoá ${user.fullName}` : `Đã mở khoá ${user.fullName}`);
      setOpen(null);
      await refresh();
    },
    onError: (error) => {
      toast.error(errorText(error));
      setOpen(null);
    },
  });
  const rows = users.data?.data ?? [];
  const pagination = users.data?.pagination;
  const filtered = search.trim() !== "" || role !== "all" || status !== "all";
  useClampedPage(pagination, page, setPage);

  const header = <PageHeader crumbs={[{ label: "Hệ thống" }, { label: "Tài khoản" }]} title="Tài khoản" description="Sinh viên thường được tạo khi nhập danh sách ở trang lớp. Ở đây tạo giảng viên và giáo vụ." />;

  if (isAccessFailure(users.error)) {
    return (
      <div className="space-y-4">
        {header}
        <PageFailure error={users.error} title="Không mở được trang tài khoản" backTo="/admin" backLabel="Về tổng quan" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}

      <Section flush title="Danh sách tài khoản" icon={UserRound}>
        <Toolbar
          actions={
            <Button onClick={() => setOpen({ kind: "create" })}>
              <Plus aria-hidden />
              Tạo tài khoản
            </Button>
          }
        >
          <SearchField
            value={search}
            placeholder="Tìm theo email, tên hoặc mã"
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
          <Choice
            label="Lọc vai trò"
            icon={UsersRound}
            value={role}
            options={[{ value: "all", label: "Mọi vai trò" }, ...roles.map((option) => ({ value: option, label: roleLabels[option] }))]}
            onChange={(value) => {
              setRole(value);
              setPage(1);
            }}
          />
          <Choice
            label="Lọc trạng thái"
            icon={Lock}
            value={status}
            options={[
              { value: "all", label: "Mọi trạng thái" },
              { value: "Active", label: "Hoạt động" },
              { value: "Locked", label: "Đã khoá" },
            ]}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
        </Toolbar>
        {users.isLoading && <TableSkeleton heads={heads} />}
        {users.isError && <Failure error={users.error} title="Không tải được danh sách tài khoản" onRetry={() => void users.refetch()} />}
        {users.isSuccess && rows.length === 0 && (
          <EmptyState
            icon={UsersRound}
            title="Không có tài khoản khớp bộ lọc"
            action={
              filtered ? (
                <ClearFilters
                  onClear={() => {
                    setSearch("");
                    setRole("all");
                    setStatus("all");
                    setPage(1);
                  }}
                />
              ) : undefined
            }
          />
        )}
        {!users.isError && rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Người dùng</TableHead>
                <TableHead>Mã</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Tạo ngày</TableHead>
                <TableHead className="w-px text-right whitespace-nowrap">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((user) => {
                const isMe = user.id === me?.userId;
                const active = user.status === "Active";
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar size="sm">
                          <AvatarFallback className="text-[10px] font-medium">{initialsOf(user.fullName)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{user.fullName}</p>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        {isMe && (
                          <Badge tone="info" icon={UserRound}>
                            Bạn
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={user.userCode ? "tabular" : "text-muted-foreground"}>{user.userCode ?? "Không có"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {user.roles.map((item) => (
                          <RoleBadge key={item} role={item} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge tone={active ? "good" : "bad"} icon={active ? Check : Lock}>
                        {active ? "Hoạt động" : "Đã khoá"}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular">{formatDate(user.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={`Sửa ${user.fullName}`} title={`Sửa ${user.fullName}`} onClick={() => setOpen({ kind: "edit", user })}>
                          <Pencil aria-hidden />
                        </Button>
                        {!isMe && (
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`${active ? "Khoá" : "Mở khoá"} ${user.fullName}`}
                            disabled={changeStatus.isPending}
                            pending={!active && changeStatus.isPending && changeStatus.variables?.id === user.id}
                            onClick={() => (active ? setOpen({ kind: "lock", user }) : changeStatus.mutate(user))}
                          >
                            {active ? <Lock aria-hidden /> : <LockOpen aria-hidden />}
                            {active ? "Khoá" : "Mở khoá"}
                          </Button>
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {!users.isError && <Pager pagination={pagination} page={page} onPage={setPage} unit="tài khoản" />}
      </Section>

      {open?.kind === "create" && <UserForm key="create" onClose={() => setOpen(null)} onSaved={refresh} />}
      {open?.kind === "edit" && <UserForm key={open.user.id} user={open.user} onClose={() => setOpen(null)} onSaved={refresh} />}
      {open?.kind === "lock" && (
        <AlertDialog open onOpenChange={(next) => !next && setOpen(null)}>
          <AlertDialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto data-[size=default]:max-w-[calc(100%-2rem)] data-[size=default]:sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg font-extrabold tracking-[-0.015em]">Khoá tài khoản {open.user.fullName}?</AlertDialogTitle>
            </AlertDialogHeader>
            <Criteria>
              <Criterion label="Đăng nhập mới">Không được cho tới khi mở khoá</Criterion>
              <Criterion label="Phiên đang mở">Còn dùng được tới khi token hết hạn, tối đa 60 phút</Criterion>
            </Criteria>
            <AlertDialogFooter>
              <Button variant="ghost" onClick={() => setOpen(null)}>
                Huỷ
              </Button>
              <Button variant="destructive" pending={changeStatus.isPending} onClick={() => changeStatus.mutate(open.user)}>
                {!changeStatus.isPending && <Lock aria-hidden />}
                {changeStatus.isPending ? "Đang khoá" : "Khoá"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

function UserForm({ user, onClose, onSaved }: { user?: User; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const { api } = useAuth();
  const mode = user ? "edit" : "create";
  const [draft, setDraft] = useState<UserDraft>({ email: user?.email ?? "", fullName: user?.fullName ?? "", userCode: user?.userCode ?? "", password: "", roles: user ? [...user.roles] : ["Lecturer"] });
  const [taken, setTaken] = useState({ email: "", code: "" });
  const [note, setNote] = useState<unknown>(null);
  const state = userDraftState(draft, mode, taken);

  const save = useMutation({
    mutationFn: () =>
      user
        ? api.put(`/api/v1/users/${user.id}`, { fullName: draft.fullName.trim(), userCode: state.code || null, roles: draft.roles, status: user.status })
        : api.post("/api/v1/users", { email: state.email, fullName: draft.fullName.trim(), userCode: state.code || undefined, password: draft.password, roles: draft.roles }),
    onSuccess: async () => {
      toast.success(user ? `Đã lưu tài khoản ${draft.fullName.trim()}` : `Đã tạo tài khoản ${state.email}`);
      onClose();
      await onSaved();
    },
    onError: async (error) => {
      const code = errorCodeOf(error);
      if (code === "EMAIL_TAKEN") {
        setTaken({ ...taken, email: state.email });
        setNote(null);
        return;
      }

      if (code === "USER_CODE_TAKEN") {
        setTaken({ ...taken, code: state.code });
        setNote(null);
        return;
      }

      if (isNotFound(error)) {
        toast.error(errorText(error));
        onClose();
        await onSaved();
        return;
      }

      setNote(error);
    },
  });

  const change = (patch: Partial<UserDraft>) => {
    setDraft({ ...draft, ...patch });
    setNote(null);
  };

  return (
    <FormDialog
      title={user ? `Sửa tài khoản ${user.fullName}` : "Tạo tài khoản"}
      description={user ? undefined : "Gửi email và mật khẩu cho người dùng. Họ đổi được mật khẩu ở trang Tài khoản của tôi."}
      icon={user ? undefined : Plus}
      submitLabel={user ? "Lưu" : "Tạo tài khoản"}
      pendingLabel={user ? "Đang lưu" : "Đang tạo"}
      canSubmit={state.canSubmit}
      pending={save.isPending}
      note={note}
      onClose={onClose}
      onSubmit={() => save.mutate()}
    >
      <Field label="Email" error={state.emailError || undefined} hint={user ? "Email cố định sau khi tạo." : undefined}>
        <Input type="email" aria-required="true" aria-invalid={state.emailError !== ""} disabled={user !== undefined} value={draft.email} onChange={(event) => change({ email: event.target.value })} />
      </Field>
      <Field label="Họ tên" counter={{ value: draft.fullName.length, max: fullNameMax }}>
        <Input aria-required="true" value={draft.fullName} onChange={(event) => change({ fullName: event.target.value })} />
      </Field>
      <Field label="Mã" error={state.codeError || undefined} hint={state.needsCode ? "Bắt buộc với sinh viên" : "Không bắt buộc với giảng viên và giáo vụ"} counter={{ value: state.code.length, max: userCodeMax }}>
        <Input aria-required={state.needsCode} aria-invalid={state.codeError !== "" || state.codeTooLong} value={draft.userCode} onChange={(event) => change({ userCode: event.target.value })} />
      </Field>
      <div role="group" aria-label="Vai trò" className="flex flex-col gap-1.5 text-[13px] font-bold">
        <span>Vai trò</span>
        <div className="flex flex-wrap items-center gap-3">
          {roles.map((option) => (
            <label key={option} className="inline-flex cursor-pointer items-center gap-1.5 font-normal">
              <Checkbox checked={draft.roles.includes(option)} onCheckedChange={(checked) => change({ roles: checked ? [...draft.roles, option] : draft.roles.filter((item) => item !== option) })} />
              <RoleBadge role={option} />
            </label>
          ))}
        </div>
        {state.noRole && <span className="text-xs font-medium text-danger-ink">Chọn ít nhất một vai trò.</span>}
      </div>
      {!user && (
        <Field label="Mật khẩu" error={state.passwordBad ? "Mật khẩu cần từ 8 đến 100 ký tự." : undefined} hint="Từ 8 đến 100 ký tự." counter={{ value: draft.password.length, max: passwordMax }}>
          <Input type="password" aria-required="true" aria-invalid={state.passwordBad} autoComplete="new-password" value={draft.password} onChange={(event) => change({ password: event.target.value })} />
        </Field>
      )}
    </FormDialog>
  );
}
