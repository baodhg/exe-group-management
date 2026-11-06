import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarRange, Check, Clock, DoorOpen, FileUp, Info, Lock, LockOpen, Rocket, Save, SlidersHorizontal, Sparkles, TriangleAlert, UsersRound, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "../../shared/api/apiClient";
import { useAuth } from "../../shared/auth/useAuth";
import type { Course, GroupType, RoomSummary } from "../common/types";
import { Badge, CheckItem, Checks, Criteria, Criterion, EmptyState, Failure, Field, LinkButton, Loading, NativeSelect, Notice, Section, SummaryCard } from "../common/ui";
import { useAllRooms, useAllRoster, useMajors, useNow } from "../courses/courseData";
import { shortDateTime } from "../courses/overview";
import { MajorTag } from "../rooms/seats";
import { courseFieldErrors, draftChanged, draftOf, settingsFor, stuckInSetup, validateDraft, type CourseDraft, type CourseFieldErrors } from "./courseDraft";
import { CourseForm, FactorButtons } from "./CourseForm";
import { failureToast } from "./courseErrors";
import { CourseHeader, FailureNote } from "./CourseHeader";
import { majorRequirement, setupCheck, type MajorSupply } from "./setupCheck";

const lockNotices: Partial<Record<Course["phase"], string>> = {
  Published: "Lớp đã mở nên chỉ đổi được giảng viên và dời hạn tìm nhóm về sau.",
  Expired: "Lớp đã hết hạn nên chỉ đổi được giảng viên.",
  Finalized: "Lớp đã chốt nhóm, không thay đổi được nữa.",
};

const supplyViews: Record<MajorSupply, { label: string; tone: "good" | "warn" | "bad"; icon: typeof Check }> = {
  enough: { label: "Đủ", tone: "good", icon: Check },
  tight: { label: "Vừa đủ", tone: "warn", icon: TriangleAlert },
  short: { label: "Thiếu", tone: "bad", icon: X },
};

function MajorsTable({ course, rule, minGroups }: { course: Course; rule: GroupType | null; minGroups: number }) {
  const roster = useAllRoster(course.id);
  const majors = useMajors();
  const counts = new Map<string, number>();
  for (const student of roster.data ?? []) {
    counts.set(student.majorCode, (counts.get(student.majorCode) ?? 0) + 1);
  }

  const codes = [...new Set([...counts.keys(), ...(rule?.majors.map((major) => major.majorCode) ?? [])])].sort((first, second) => first.localeCompare(second));
  const names = new Map((majors.data ?? []).map((major) => [major.code, major.name]));

  return (
    <Section
      flush
      title="Sinh viên của lớp"
      icon={UsersRound}
      actions={
        <LinkButton to={`/admin/courses/${course.id}/roster`} variant="outline" size="sm">
          <FileUp />
          Nhập từ tệp
        </LinkButton>
      }
    >
      <Loading when={roster.isLoading} rows={4} />
      {roster.isError && <Failure error={roster.error} title="Không tải được danh sách sinh viên" onRetry={() => void roster.refetch()} />}
      {roster.isSuccess && roster.data.length === 0 && (
        <EmptyState
          icon={UsersRound}
          title="Lớp chưa có sinh viên"
          description="Nhập danh sách lớp trước khi sinh phòng."
          action={
            <LinkButton to={`/admin/courses/${course.id}/roster`}>
              <FileUp />
              Nhập danh sách lớp
            </LinkButton>
          }
        />
      )}
      {roster.isSuccess && roster.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ngành</TableHead>
              <TableHead>Tên ngành</TableHead>
              <TableHead>Yêu cầu</TableHead>
              <TableHead>Mức đủ</TableHead>
              <TableHead className="text-right">Sinh viên</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {codes.map((code) => {
              const count = counts.get(code) ?? 0;
              const requirement = majorRequirement(code, count, minGroups, rule);
              const supply = requirement.supply ? supplyViews[requirement.supply] : null;
              return (
                <TableRow key={code}>
                  <TableCell className="w-px">
                    <MajorTag code={code} />
                  </TableCell>
                  <TableCell>{names.get(code) ?? code}</TableCell>
                  <TableCell>
                    {requirement.required === null && <Badge icon={Info}>Chưa chọn loại nhóm</Badge>}
                    {requirement.required === true && (
                      <Badge tone="info" icon={Lock}>
                        Bắt buộc
                      </Badge>
                    )}
                    {requirement.required === false && <Badge icon={LockOpen}>Không bắt buộc</Badge>}
                  </TableCell>
                  <TableCell>
                    {supply && (
                      <Badge tone={supply.tone} icon={supply.icon}>
                        {supply.label}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="tabular text-right font-semibold">{count}</TableCell>
                </TableRow>
              );
            })}
            <TableRow>
              <TableCell colSpan={4} className="font-semibold">
                Tổng cả lớp
              </TableCell>
              <TableCell className="tabular text-right font-semibold">{roster.data.length}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </Section>
  );
}

function GenerateRooms({ course, allowed, loadError, groupTypeId, onPick, rule, rooms }: { course: Course; allowed: readonly GroupType[] | undefined; loadError: unknown; groupTypeId: string; onPick: (id: string) => void; rule: GroupType | null; rooms: number }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const generate = useMutation({
    mutationFn: () => api.post<{ target: number; created: number; rooms: RoomSummary[] }>(`/api/v1/courses/${course.id}/rooms/generate`, { groupTypeId }),
    onSuccess: async (result) => {
      toast.success(result.data.created > 0 ? `Đã tạo ${result.data.created} phòng` : "Đã đủ phòng, không cần tạo thêm");
      await Promise.all([["course", course.id], ["rooms", course.id], ["courses"]].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
    onError: (error) => failureToast(error),
  });
  const none = allowed?.length === 0;

  return (
    <Section title="Sinh phòng" icon={DoorOpen}>
      <Criteria>
        <Criterion label="Sinh viên">{course.studentCount}</Criterion>
        <Criterion label="Cần có">{rooms} phòng</Criterion>
        <Criterion label="Đang có">{course.roomCount} phòng</Criterion>
        <Criterion label="Khi chạy lại">Chỉ tạo phần còn thiếu</Criterion>
      </Criteria>
      {none && (
        <Notice tone="warn">
          <p>Học kỳ chưa cho phép loại nhóm nào. Hãy chọn ở trang Loại nhóm trước.</p>
          <LinkButton to="/admin/group-types" variant="link" size="sm" className="h-auto p-0">
            Mở trang Loại nhóm
          </LinkButton>
        </Notice>
      )}
      {loadError !== null && <FailureNote error={loadError} text="Không tải được loại nhóm của học kỳ" />}
      <Field label="Loại nhóm">
        <NativeSelect value={groupTypeId} disabled={!allowed || none} onChange={(event) => onPick(event.target.value)}>
          <option value="">Chọn loại nhóm</option>
          {allowed?.map((groupType) => (
            <option key={groupType.id} value={groupType.id}>
              {groupType.code}: {groupType.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {rule && (
        <Criteria>
          <Criterion label="Ngành bắt buộc">
            {rule.majors.length === 0 ? (
              "Không có"
            ) : (
              <span className="flex flex-wrap gap-1.5">
                {rule.majors.map((major) => (
                  <MajorTag key={major.majorId} code={major.majorCode} />
                ))}
              </span>
            )}
          </Criterion>
          <Criterion label="Số ngành">Từ {rule.minDistinctMajors} ngành</Criterion>
        </Criteria>
      )}
      <Criteria>
        <Criterion label="Luật ngành thuộc về">Loại nhóm của từng phòng</Criterion>
        <Criterion label="Một lớp">Trộn được nhiều loại nhóm</Criterion>
      </Criteria>
      <Button variant="secondary" className="self-start" pending={generate.isPending} disabled={groupTypeId === ""} onClick={() => generate.mutate()}>
        {!generate.isPending && <Sparkles />}
        {generate.isPending ? "Đang sinh phòng" : "Sinh phòng"}
      </Button>
      {course.roomCount > 0 && (
        <LinkButton to={`/admin/courses/${course.id}/rooms`} variant="link" size="sm" className="h-auto self-start p-0">
          Xem {course.roomCount} phòng đã tạo
          <ArrowRight />
        </LinkButton>
      )}
    </Section>
  );
}

function PublishDialog({ course, open, onOpenChange, onPastDeadline }: { course: Course; open: boolean; onOpenChange: (open: boolean) => void; onPastDeadline: () => void }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [pastDeadline, setPastDeadline] = useState(false);
  const publish = useMutation({
    mutationFn: () => api.post<Course>(`/api/v1/courses/${course.id}/publish`),
    onSuccess: async () => {
      toast.success("Đã mở tìm nhóm", {
        description: `${course.studentCount} sinh viên nhận thông báo.`,
        action: { label: "Mở trang điều phối", onClick: () => navigate(`/admin/courses/${course.id}/overview`) },
      });
      onOpenChange(false);
      await Promise.all([["course", course.id], ["courses"], ["overview", course.id], ["rooms", course.id]].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
        setPastDeadline(true);
        onPastDeadline();
      }
    },
  });

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setPastDeadline(false);
      publish.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mở chọn phòng ngay?</DialogTitle>
        </DialogHeader>
        <Criteria>
          <Criterion label="Sinh viên nhận thông báo">{course.studentCount} sinh viên</Criterion>
          <Criterion label="Phòng để chọn">{course.roomCount} phòng</Criterion>
          <Criterion label="Hạn chọn phòng">{course.expireAt ? shortDateTime(course.expireAt) : "Chưa đặt"}</Criterion>
          <Criterion label="Hoàn tác">Không thể</Criterion>
        </Criteria>
        <FailureNote error={publish.error} text={pastDeadline ? "Hạn chọn phòng đã qua. Hãy dời hạn về sau rồi mở." : undefined} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)}>
            Huỷ
          </Button>
          <Button pending={publish.isPending} disabled={pastDeadline} onClick={() => publish.mutate()}>
            {!publish.isPending && <Rocket />}
            Mở chọn phòng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SettingsSection({ course }: { course: Course }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const now = useNow();
  const isSetup = course.phase === "Setup";
  const baseline = draftOf(course);
  const [draft, setDraft] = useState<CourseDraft>(baseline);
  const [errors, setErrors] = useState<CourseFieldErrors>({});
  const [groupTypeId, setGroupTypeId] = useState("");
  const [publishing, setPublishing] = useState(false);
  const allowed = useQuery({
    queryKey: ["semesterGroupTypes", course.semesterId],
    queryFn: () => api.get<GroupType[]>(`/api/v1/semesters/${course.semesterId}/group-types`),
    enabled: isSetup,
  });
  const roster = useAllRoster(course.id, isSetup);
  const rooms = useAllRooms(course.id, isSetup);
  const rule = allowed.data?.data.find((type) => type.id === groupTypeId) ?? null;
  const majorCounts: Record<string, number> = {};
  for (const student of roster.data ?? []) {
    majorCounts[student.majorCode] = (majorCounts[student.majorCode] ?? 0) + 1;
  }

  const check = setupCheck({ students: course.studentCount, maxGroupSize: draft.maxGroupSize, minGroupSize: draft.minGroupSize, roomFactor: draft.roomFactor, majorCounts, rule });
  const driftCapacity = isSetup ? rooms.data?.find((room) => room.capacity !== draft.maxGroupSize)?.capacity : undefined;

  const save = useMutation({
    mutationFn: (value: CourseDraft) => api.put<Course>(`/api/v1/courses/${course.id}`, settingsFor(course, value)),
    onSuccess: async (result) => {
      toast.success("Đã lưu cài đặt");
      setDraft(draftOf(result.data));
      setErrors({});
      await Promise.all([["course", course.id], ["courses"], ["overview", course.id]].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
    onError: (error) => {
      setErrors(courseFieldErrors(error));
      failureToast(error);
    },
  });

  function submit() {
    const found = validateDraft(draft, course.phase, baseline);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      toast.error(course.phase === "Published" ? (found.expireAt ?? "Dữ liệu chưa hợp lệ.") : "Dữ liệu chưa hợp lệ.");
      return;
    }

    save.mutate(draft);
  }

  const notice = lockNotices[course.phase];
  const next = course.phase === "Published" ? { section: "overview", label: "Mở trang điều phối" } : course.phase === "Expired" ? { section: "placement", label: "Xếp và chốt nhóm" } : null;

  return (
    <div className="space-y-5">
      <CourseHeader
        course={course}
        title="Thiết lập lớp"
        description={isSetup ? "Nhập sinh viên, tạo phòng và kiểm tra lớp có ghép được theo luật không, trước khi mở cho sinh viên." : "Cài đặt của lớp. Trường bị khoá theo giai đoạn hiện ở dạng không sửa được."}
        aside={
          isSetup ? (
            <SummaryCard icon={DoorOpen} label="Số phòng sẽ tạo" value={`${check.rooms} phòng`}>
              <span className="text-xs text-muted-foreground">
                {course.studentCount} sinh viên × hệ số {String(draft.roomFactor).replace(".", ",")} ÷ {draft.maxGroupSize} người, làm tròn lên
              </span>
            </SummaryCard>
          ) : (
            <SummaryCard icon={DoorOpen} label="Phòng của lớp" value={`${course.roomCount} phòng`}>
              <span className="text-xs text-muted-foreground">
                {course.studentCount} sinh viên, mỗi phòng {course.maxGroupSize} chỗ
              </span>
              {next && (
                <LinkButton to={`/admin/courses/${course.id}/${next.section}`} variant="link" size="sm" className="h-auto self-start p-0">
                  {next.label}
                  <ArrowRight />
                </LinkButton>
              )}
            </SummaryCard>
          )
        }
      />

      {notice && (
        <Notice tone="info" icon={Lock}>
          {notice}
        </Notice>
      )}
      {stuckInSetup(course, now) && (
        <Section>
          <Badge tone="warn" icon={TriangleAlert} className="self-start">
            Lớp không tự mở
          </Badge>
          <strong className="text-[15px] font-bold">Giờ tự mở và hạn chọn phòng đều đã qua nên lớp vẫn ở Chuẩn bị</strong>
          <Criteria columns={3}>
            <Criterion label="Tự mở lúc">{shortDateTime(course.publishAt)}, đã qua</Criterion>
            <Criterion label="Hạn chọn phòng">{shortDateTime(course.expireAt)}, đã qua</Criterion>
            <Criterion label="Cách xử lý">Dời hạn về sau, lưu rồi mở</Criterion>
          </Criteria>
        </Section>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          {isSetup && <MajorsTable course={course} rule={rule} minGroups={check.minGroups} />}
          <Section title="Cài đặt lớp" icon={SlidersHorizontal}>
            <FactorButtons
              value={draft.roomFactor}
              disabled={!isSetup}
              onChange={(roomFactor) => {
                setDraft({ ...draft, roomFactor });
                setErrors((current) => ({ ...current, roomFactor: undefined }));
              }}
            />
            {errors.roomFactor && <Notice tone="bad">{errors.roomFactor}</Notice>}
            <CourseForm
              creating={false}
              phase={course.phase}
              draft={draft}
              errors={errors}
              onChange={(value, field) => {
                setDraft(value);
                setErrors((current) => ({ ...current, [field]: undefined }));
              }}
            />
            {driftCapacity !== undefined && (
              <Notice tone="warn" title="Phòng đã tạo không đổi sức chứa">
                <Criteria columns={3} className="pt-1">
                  <Criterion label={`${course.roomCount} phòng đã tạo`}>Vẫn {driftCapacity} chỗ mỗi phòng</Criterion>
                  <Criterion label="Phòng tạo thêm">{draft.maxGroupSize} chỗ mỗi phòng</Criterion>
                  <Criterion label="Muốn đổi hết">Xoá phòng rồi sinh lại</Criterion>
                </Criteria>
              </Notice>
            )}
            {course.phase !== "Finalized" && (
              <Button variant="secondary" className="self-end" pending={save.isPending} disabled={!draftChanged(draft, baseline)} onClick={submit}>
                {!save.isPending && <Save />}
                Lưu cài đặt
              </Button>
            )}
          </Section>
        </div>

        <div className="min-w-0 space-y-5">
          {isSetup && (
            <>
              <Section>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <TriangleAlert className="size-3.5" aria-hidden />
                  Kiểm tra trước khi mở
                </span>
                <h2 className="text-lg font-extrabold tracking-[-0.015em]">{check.verdict}</h2>
                <Checks single>
                  {check.checks.map((item) => (
                    <CheckItem key={item.label} ok={item.ok} label={item.label} value={item.value} />
                  ))}
                </Checks>
                <Criteria>
                  <Criterion label="Số nhóm tối thiểu">{check.minGroups} nhóm</Criterion>
                  <Criterion label="Mở được khi">Không cần đủ phòng, đủ sinh viên</Criterion>
                </Criteria>
              </Section>
              <GenerateRooms course={course} allowed={allowed.data?.data} loadError={allowed.error} groupTypeId={groupTypeId} onPick={setGroupTypeId} rule={rule} rooms={check.rooms} />
            </>
          )}
          <Section title="Lịch của lớp" icon={CalendarRange}>
            <ul className="divide-y text-sm">
              <li className="flex items-center justify-between gap-3 py-2 first:pt-0">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <DoorOpen className="size-3.5" aria-hidden />
                  Mở chọn phòng
                </span>
                <strong>{course.publishAt ? shortDateTime(course.publishAt) : "Chưa hẹn giờ"}</strong>
              </li>
              <li className="flex items-center justify-between gap-3 py-2 last:pb-0">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="size-3.5" aria-hidden />
                  Hạn chọn phòng
                </span>
                <strong>{course.expireAt ? shortDateTime(course.expireAt) : "Chưa đặt"}</strong>
              </li>
            </ul>
            {isSetup && (
              <Button size="lg" className="w-full" onClick={() => setPublishing(true)}>
                <Rocket />
                Mở chọn phòng ngay
              </Button>
            )}
          </Section>
        </div>
      </div>

      {isSetup && <PublishDialog course={course} open={publishing} onOpenChange={setPublishing} onPastDeadline={() => setErrors((current) => ({ ...current, expireAt: "Hạn đã qua, hãy dời về sau." }))} />}
    </div>
  );
}
