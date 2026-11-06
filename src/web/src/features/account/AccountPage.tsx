import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Crown, KeyRound, Lock, LogIn, Pencil, Save } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AlertDialog, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { homeFor } from "../../shared/auth/homeFor";
import { useAuth } from "../../shared/auth/useAuth";
import { initialsOf } from "../../shared/layout/navigation";
import { PageFailure } from "../admin/CatalogFrame";
import { isAccessFailure } from "../admin/catalogRules";
import { errorText, formatDate } from "../common/messages";
import type { User } from "../common/types";
import { Badge, CheckItem, Checks, Criteria, Criterion, Failure, Field, Notice, PageHeader, Section } from "../common/ui";
import { canSaveName, fullNameMax, passwordLengthOk, passwordMax, wrongCurrentPassword } from "./accountRules";
import { RoleBadge } from "./RoleBadge";

const header = <PageHeader crumbs={[{ label: "Cá nhân" }, { label: "Tài khoản của tôi" }]} title="Tài khoản của tôi" description="Xem thông tin tài khoản, đổi họ tên và đổi mật khẩu." />;

export function AccountPage() {
  const { api, user } = useAuth();
  const account = useQuery({ queryKey: ["account", "me"], queryFn: () => api.get<User>("/api/v1/auth/me") });

  if (account.isLoading) {
    return (
      <div className="space-y-4">
        {header}
        <div className="flex flex-wrap items-start gap-4" aria-busy="true" aria-label="Đang tải">
          <div className="flex min-w-0 flex-[3_1_540px] flex-col gap-3.5">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
          <Skeleton className="h-96 min-w-0 flex-[2_1_340px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (isAccessFailure(account.error)) {
    return (
      <div className="space-y-4">
        {header}
        <PageFailure error={account.error} title="Không mở được tài khoản" backTo={homeFor(user?.roles ?? [])} backLabel="Về trang chính" />
      </div>
    );
  }

  if (!account.data) {
    return (
      <div className="space-y-4">
        {header}
        <Section>
          <Failure error={account.error} title="Không tải được tài khoản" onRetry={() => void account.refetch()} />
        </Section>
      </div>
    );
  }

  const me = account.data.data;

  return (
    <div className="space-y-4">
      {header}
      <div className="flex flex-wrap items-stretch gap-4">
        <div className="flex min-w-0 flex-[3_1_540px] flex-col gap-3.5">
          <NameSection key={me.fullName} savedName={me.fullName} />
          <PasswordSection savedName={me.fullName} />
        </div>
        <aside className="flex min-w-0 flex-[2_1_340px] flex-col gap-3.5" aria-label="Thông tin tài khoản">
          <Section className="grow">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-extrabold" aria-hidden>
                {initialsOf(me.fullName)}
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-extrabold tracking-[-0.015em]">{me.fullName}</h2>
                <p className="truncate text-[13px] text-muted-foreground">{me.email}</p>
              </div>
            </div>
            <ul className="flex list-none flex-col text-[13px]/normal">
              <InfoRow label="Mã">
                <span className="tabular">{me.userCode ?? "Không có"}</span>
              </InfoRow>
              <InfoRow label="Vai trò">
                <span className="flex flex-wrap items-center gap-1.5">
                  {me.roles.map((role) => (
                    <RoleBadge key={role} role={role} />
                  ))}
                </span>
              </InfoRow>
              <InfoRow label="Trạng thái">
                {me.status === "Active" ? (
                  <Badge tone="good" icon={Check}>
                    Hoạt động
                  </Badge>
                ) : (
                  <Badge tone="bad" icon={Lock}>
                    Đã khoá
                  </Badge>
                )}
              </InfoRow>
              <InfoRow label="Tạo ngày">
                <span className="tabular">{formatDate(me.createdAt)}</span>
              </InfoRow>
            </ul>
            <Criteria>
              <Criterion label="Email">Cố định sau khi tạo</Criterion>
              <Criterion label="Mã và vai trò">Do giáo vụ đổi</Criterion>
            </Criteria>
            {me.roles.includes("Student") && (
              <Notice tone="info" icon={Crown}>
                Trưởng nhóm là vai trò theo từng phòng, không thuộc tài khoản.
              </Notice>
            )}
          </Section>
        </aside>
      </div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t py-[9px] first:border-t-0">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </li>
  );
}

function NameSection({ savedName }: { savedName: string }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState(savedName);
  const empty = name.trim() === "";

  const save = useMutation({
    mutationFn: () => api.put("/api/v1/auth/me", { fullName: name.trim() }),
    onSuccess: async () => {
      toast.success("Đã lưu họ tên");
      await queryClient.invalidateQueries({ queryKey: ["account", "me"] });
    },
    onError: (error) => toast.error(errorText(error)),
  });

  return (
    <Section title="Họ tên" icon={Pencil}>
      <Field label="Họ tên" error={empty ? "Họ tên không được để trống." : undefined} counter={{ value: name.length, max: fullNameMax }}>
        <Input aria-required="true" aria-invalid={empty} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <div className="flex justify-end">
        <Button variant="outline" disabled={!canSaveName(name, savedName)} pending={save.isPending} onClick={() => save.mutate()}>
          {!save.isPending && <Save aria-hidden />}
          Lưu họ tên
        </Button>
      </div>
    </Section>
  );
}

function PasswordSection({ savedName }: { savedName: string }) {
  const { api, signOut } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [wrongCurrent, setWrongCurrent] = useState(false);
  const [done, setDone] = useState(false);
  const lengthOk = passwordLengthOk(next);
  const newBad = next !== "" && !lengthOk;

  const change = useMutation({
    mutationFn: () => api.put("/api/v1/auth/me", { fullName: savedName, currentPassword: current, newPassword: next }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setDone(true);
    },
    onError: (error) => {
      if (wrongCurrentPassword(error)) {
        setWrongCurrent(true);
        return;
      }

      toast.error(errorText(error));
    },
  });

  const signInAgain = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  return (
    <Section title="Đổi mật khẩu" icon={KeyRound} className="grow">
      <Notice tone="warn">Sau khi đổi mật khẩu, mọi phiên đăng nhập đều bị đăng xuất, kể cả phiên này. Bạn phải đăng nhập lại.</Notice>
      <form
        className="flex flex-col gap-3"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (current !== "" && lengthOk && !wrongCurrent && !change.isPending) {
            change.mutate();
          }
        }}
      >
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Mật khẩu hiện tại" error={wrongCurrent ? "Mật khẩu hiện tại không đúng." : undefined}>
            <Input
              type="password"
              aria-required="true"
              aria-invalid={wrongCurrent}
              autoComplete="current-password"
              value={current}
              onChange={(event) => {
                setCurrent(event.target.value);
                setWrongCurrent(false);
              }}
            />
          </Field>
          <Field label="Mật khẩu mới" error={newBad ? "Mật khẩu cần từ 8 đến 100 ký tự." : undefined} counter={{ value: next.length, max: passwordMax }}>
            <Input type="password" aria-required="true" aria-invalid={newBad} autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} />
          </Field>
        </div>
        <Checks single>
          <CheckItem ok={lengthOk} label="Từ 8 đến 100 ký tự" value={lengthOk ? "Đạt" : "Chưa đạt"} />
        </Checks>
        <div className="flex justify-end">
          <Button type="submit" disabled={current === "" || !lengthOk || wrongCurrent} pending={change.isPending}>
            {!change.isPending && <KeyRound aria-hidden />}
            {change.isPending ? "Đang đổi mật khẩu" : "Đổi mật khẩu"}
          </Button>
        </div>
      </form>

      <AlertDialog open={done} onOpenChange={(open) => !open && signInAgain()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-extrabold tracking-[-0.015em]">Đã đổi mật khẩu</AlertDialogTitle>
          </AlertDialogHeader>
          <Notice tone="good">Mọi phiên đăng nhập đã bị đăng xuất, kể cả phiên này. Hãy đăng nhập lại bằng mật khẩu mới.</Notice>
          <AlertDialogFooter>
            <Button onClick={signInAgain}>
              <LogIn aria-hidden />
              Đăng nhập lại
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}
