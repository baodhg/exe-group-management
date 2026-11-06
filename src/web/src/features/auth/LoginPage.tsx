import { CircleAlert, Clock, Info, Lock, LogIn, Mail, type LucideIcon } from "lucide-react";
import { useState, type ComponentProps, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { homeFor } from "../../shared/auth/homeFor";
import { useAuth } from "../../shared/auth/useAuth";
import { Brand } from "../../shared/layout/Brand";
import { Field, Notice } from "../common/ui";
import { Glow, HeroTitle } from "../landing/parts";
import { ThemeToggle } from "../landing/ThemeToggle";
import { cameFromGuardedRoute, loginFailureOf, missingFieldsOf, nothingMissing, sessionEndedText, type LoginFailure, type LoginFieldErrors } from "./loginForm";

const emailLimit = 255;
const passwordLimit = 100;

function IconInput({ icon: Icon, ...props }: { icon: LucideIcon } & ComponentProps<typeof Input>) {
  return (
    <span className="relative flex font-normal">
      <Icon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input className="pl-[38px]" {...props} />
    </span>
  );
}

function BrandPanel() {
  return (
    <section className="relative hidden min-w-0 flex-[3_1_560px] flex-col justify-between gap-10 overflow-hidden border-r bg-card px-12 pt-8 pb-12 lg:flex">
      <Glow className="-bottom-[24%] -left-[8%] size-[760px]" />
      <Link to="/" className="relative self-start rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Brand />
      </Link>
      <div className="relative flex flex-col gap-4">
        <HeroTitle>Lập nhóm EXE đủ ngành, kịp hạn.</HeroTitle>
        <p className="max-w-[48rem] text-[15px]/normal text-muted-foreground">Sinh viên thấy ngay phòng nào còn thiếu ngành của mình. Trưởng nhóm duyệt đơn, giảng viên theo dõi tiến độ, giáo vụ chốt danh sách nhóm.</p>
      </div>
      <div className="relative flex max-w-[25rem] flex-col gap-1.5 rounded-[18px] border bg-card px-4 py-3.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Info className="size-3.5 shrink-0" aria-hidden />
          Tài khoản do giáo vụ cấp
        </span>
        <span className="text-[15px]/normal text-muted-foreground">Không có đăng ký tự do. Nếu chưa có tài khoản, hãy liên hệ giáo vụ của lớp.</span>
      </div>
    </section>
  );
}

export function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<LoginFailure | null>(null);
  const [missing, setMissing] = useState<LoginFieldErrors>(nothingMissing);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to={homeFor(user.roles)} replace />;
  }

  function clearFeedback() {
    setFailure(null);
    setMissing(nothingMissing);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    setFailure(null);
    const nextMissing = missingFieldsOf(email, password);
    setMissing(nextMissing);
    if (nextMissing.email || nextMissing.password) {
      return;
    }

    setBusy(true);
    try {
      const signedIn = await signIn(email, password);
      navigate(homeFor(signedIn.roles), { replace: true });
    } catch (caught) {
      setFailure(loginFailureOf(caught));
    } finally {
      setBusy(false);
    }
  }

  const rejected = failure?.credentialsRejected ?? false;

  return (
    <div className="min-h-svh lg:flex">
      <BrandPanel />
      <main className="flex min-h-svh min-w-0 flex-[2_1_400px] flex-col justify-center gap-6 px-4 py-8 sm:px-12 lg:min-h-0">
        <Link to="/" className="self-start rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden">
          <Brand />
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="mt-0.5 text-[clamp(1.75rem,2.2vw,2.25rem)] leading-[1.2] font-extrabold tracking-[-0.02em]">Đăng nhập</h2>
            <p className="text-sm/[1.55] text-muted-foreground">Dùng tài khoản nhà trường cấp cho bạn.</p>
          </div>
          <ThemeToggle />
        </div>
        {cameFromGuardedRoute(location.state) && !attempted && (
          <Notice tone="warn" icon={Clock}>
            {sessionEndedText}
          </Notice>
        )}
        <form noValidate className="flex flex-col gap-4" aria-busy={busy} onSubmit={submit}>
          <Field label="Email" error={missing.email}>
            <IconInput
              icon={Mail}
              type="email"
              required
              maxLength={emailLimit}
              autoComplete="username"
              placeholder="ban@truong.edu.vn"
              aria-invalid={rejected || missing.email !== null}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearFeedback();
              }}
            />
          </Field>
          <Field label="Mật khẩu" error={missing.password}>
            <IconInput
              icon={Lock}
              type="password"
              required
              maxLength={passwordLimit}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu"
              aria-invalid={rejected || missing.password !== null}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                clearFeedback();
              }}
            />
          </Field>
          {failure && (
            <Notice tone="bad" icon={CircleAlert}>
              {failure.message}
            </Notice>
          )}
          <Button type="submit" size="lg" className="w-full" pending={busy}>
            {!busy && <LogIn aria-hidden />}
            {busy ? "Đang đăng nhập" : "Đăng nhập"}
          </Button>
        </form>
      </main>
    </div>
  );
}
