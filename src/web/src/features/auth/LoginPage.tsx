import { CircleAlert, LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { homeFor } from "../../shared/auth/homeFor";
import { useAuth } from "../../shared/auth/useAuth";
import { Brand } from "../../shared/layout/Brand";
import { signInErrorText } from "../common/messages";

const previewRooms = [
  { name: "Phòng 03", topic: "Ứng dụng đặt sân thể thao", seats: [1, 1, 2, 3, 0, 0], short: null },
  { name: "Phòng 07", topic: "Nền tảng học nhóm", seats: [2, 4, 1, 0, -1, 0], short: "Còn thiếu ngành AI" },
  { name: "Phòng 11", topic: "Chưa có đề tài", seats: [3, 0, 0, 0, -1, -1], short: "Còn thiếu ngành SE, GD" },
] as const;

function PreviewSeat({ value }: { value: number }) {
  if (value > 0) {
    return <span className="size-4 rounded-[4px]" style={{ backgroundColor: `var(--major-${value})` }} />;
  }

  return value < 0 ? (
    <span className="size-4 rounded-[4px] border-[1.5px] border-dashed border-deadline bg-deadline/15" />
  ) : (
    <span className="size-4 rounded-[4px] border-[1.5px] border-dashed border-sidebar-muted/60" />
  );
}

export function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to={homeFor(user.roles)} replace />;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const signedIn = await signIn(email, password);
      navigate(homeFor(signedIn.roles), { replace: true });
    } catch (caught) {
      setError(signInErrorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex xl:p-14">
        <Brand />
        <div className="max-w-md space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl leading-tight font-semibold text-white xl:text-4xl">Lập nhóm EXE đủ ngành, kịp hạn.</h1>
            <p className="text-sidebar-foreground/80">
              Sinh viên thấy ngay phòng nào còn thiếu ngành của mình. Trưởng phòng duyệt đơn, giảng viên theo dõi tiến độ, phòng đào tạo chốt danh sách nhóm.
            </p>
          </div>
          <div className="space-y-3" aria-hidden>
            {previewRooms.map((room, index) => (
              <div
                key={room.name}
                className="rounded-xl border border-sidebar-border bg-sidebar-accent/70 p-4 shadow-lg shadow-black/10"
                style={{ marginLeft: `${index * 1.5}rem` }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold text-white">{room.name}</p>
                  <p className="truncate text-xs text-sidebar-muted">{room.topic}</p>
                </div>
                <div className="mt-3 flex items-center gap-1">
                  {room.seats.map((seat, seatIndex) => (
                    <PreviewSeat key={seatIndex} value={seat} />
                  ))}
                </div>
                {room.short && <p className="mt-2 text-xs text-[#f5b56f]">{room.short}</p>}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-sidebar-muted">Dành cho các môn làm dự án theo nhóm liên ngành.</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm space-y-8">
          <Brand tone="light" className="lg:hidden" />
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Đăng nhập</h2>
            <p className="text-sm text-muted-foreground">Dùng tài khoản nhà trường cấp cho bạn.</p>
          </div>
          <form className="space-y-5" onSubmit={submit}>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                className="h-10"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="username"
                aria-invalid={error !== null}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                className="h-10"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                aria-invalid={error !== null}
              />
            </div>
            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-danger-soft px-3 py-2.5 text-sm text-danger-ink">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {error}
              </div>
            )}
            <Button type="submit" className="h-10 w-full" disabled={busy}>
              {busy && <LoaderCircle className="animate-spin" aria-hidden />}
              {busy ? "Đang đăng nhập" : "Đăng nhập"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
