import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, LockOpen, Plus, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "../../shared/auth/useAuth";
import { initialsOf, roleLabels } from "../../shared/layout/navigation";
import { useDialogs } from "../common/dialogsContext";
import { errorText, formatDate } from "../common/messages";
import type { User } from "../common/types";
import { Badge, Choice, EmptyState, ErrorNote, Field, Loading, NativeSelect, PageHeader, Pager, SearchField, Section, Toolbar } from "../common/ui";

const roles = ["Student", "Lecturer", "Administrator"] as const;
const empty = { email: "", fullName: "", userCode: "", password: "", role: "Lecturer" as string };

function roleLabel(role: string): string {
  return role in roleLabels ? roleLabels[role as keyof typeof roleLabels] : role;
}

export function UsersPage() {
  const { api, user: me } = useAuth();
  const { confirm } = useDialogs();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(empty);

  const users = useQuery({
    queryKey: ["users", search, role, page],
    queryFn: () => api.get<User[]>("/api/v1/users", { search, role: role === "all" ? undefined : role, page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const create = useMutation({
    mutationFn: () =>
      api.post("/api/v1/users", {
        email: draft.email.trim(),
        fullName: draft.fullName.trim(),
        userCode: draft.userCode.trim() || undefined,
        password: draft.password,
        roles: [draft.role],
      }),
    onSuccess: async () => {
      toast.success(`Đã tạo tài khoản ${draft.email.trim()}`);
      setDraft(empty);
      setCreating(false);
      await refresh();
    },
    onError: (error) => toast.error(errorText(error)),
  });
  const setStatus = useMutation({
    mutationFn: (user: User) =>
      api.put(`/api/v1/users/${user.id}`, { fullName: user.fullName, userCode: user.userCode, roles: user.roles, status: user.status === "Active" ? "Locked" : "Active" }),
    onSuccess: async (_, user) => {
      toast.success(user.status === "Active" ? `Đã khóa ${user.fullName}` : `Đã mở khóa ${user.fullName}`);
      await refresh();
    },
    onError: (error) => toast.error(errorText(error)),
  });
  const rows = users.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ label: "Hệ thống" }, { label: "Tài khoản" }]}
        title="Tài khoản"
        description="Sinh viên thường được tạo khi import danh sách lớp ở trang course. Ở đây tạo giảng viên và quản trị viên."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus />
            Tạo tài khoản
          </Button>
        }
      />

      <Section>
        <Toolbar>
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
            value={role}
            options={[{ value: "all", label: "Mọi vai trò" }, ...roles.map((option) => ({ value: option, label: roleLabels[option] }))]}
            onChange={(value) => {
              setRole(value);
              setPage(1);
            }}
          />
        </Toolbar>
        <ErrorNote error={users.error} />
        <Loading when={users.isLoading} rows={5} />
        {users.isSuccess && rows.length === 0 && <EmptyState icon={UsersRound} title="Không có tài khoản khớp bộ lọc" />}
        {rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Người dùng</TableHead>
                <TableHead>Mã</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Tạo ngày</TableHead>
                <TableHead className="w-28 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarFallback className="text-[10px] font-medium">{initialsOf(user.fullName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{user.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{user.userCode ?? <span className="text-muted-foreground">Không có</span>}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((item) => (
                        <Badge key={item} tone={item === "Administrator" ? "info" : "neutral"}>
                          {roleLabel(item)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge tone={user.status === "Active" ? "good" : "bad"}>{user.status === "Active" ? "Hoạt động" : "Đã khóa"}</Badge>
                  </TableCell>
                  <TableCell className="tabular">{formatDate(user.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {user.id !== me?.userId && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={setStatus.isPending}
                        onClick={async () => {
                          if (
                            user.status === "Active" &&
                            !(await confirm({
                              title: `Khóa tài khoản ${user.fullName}?`,
                              description: "Người này sẽ không đăng nhập được cho tới khi được mở khóa.",
                              confirmLabel: "Khóa",
                              destructive: true,
                            }))
                          ) {
                            return;
                          }

                          setStatus.mutate(user);
                        }}
                      >
                        {user.status === "Active" ? <Lock /> : <LockOpen />}
                        {user.status === "Active" ? "Khóa" : "Mở khóa"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pager pagination={users.data?.pagination} page={page} onPage={setPage} unit="tài khoản" />
      </Section>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo tài khoản</DialogTitle>
            <DialogDescription>Gửi email và mật khẩu cho người dùng, họ đổi mật khẩu sau khi đăng nhập.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <Field label="Email">
              <Input required type="email" className="h-9" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
            </Field>
            <Field label="Họ tên">
              <Input required className="h-9" value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mã" hint="Không bắt buộc">
                <Input className="h-9" value={draft.userCode} onChange={(event) => setDraft({ ...draft, userCode: event.target.value })} />
              </Field>
              <Field label="Vai trò">
                <NativeSelect value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}>
                  {roles.map((option) => (
                    <option key={option} value={option}>
                      {roleLabels[option]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field label="Mật khẩu">
              <Input required type="password" className="h-9" autoComplete="new-password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} />
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                Tạo tài khoản
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
