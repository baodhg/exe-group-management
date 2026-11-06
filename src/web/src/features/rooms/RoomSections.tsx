import { useQuery } from "@tanstack/react-query";
import { Award, Check, CircleAlert, Clock, Crown, DoorOpen, Flag, Inbox, Layers, Lock, ShieldAlert, SlidersHorizontal, Sparkles, User, Users, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "../../shared/auth/useAuth";
import { initialsOf } from "../../shared/layout/navigation";
import { phaseLabels, roomStatusLabels, suggestionReasonText } from "../common/messages";
import type { CoursePhase, RoomDetail, RoomMember, RoomSuggestions, RoomSummary } from "../common/types";
import { Badge, CheckItem, Checks, Criteria, Criterion, EmptyState, Failure, Loading, Notice, Section, type Tone } from "../common/ui";
import { missingMajors } from "./seatLayout";
import { dayTime, roomChecks, unmetConditions } from "./roomActions";
import { MajorTag, SeatStrip, SkillTags } from "./seats";

const statusLooks: Record<RoomSummary["status"], { tone: Tone; icon: LucideIcon }> = {
  Open: { tone: "good", icon: DoorOpen },
  Locked: { tone: "warn", icon: Lock },
  Finalized: { tone: "good", icon: Award },
};

const phaseLooks: Record<CoursePhase, { tone: Tone; icon: LucideIcon }> = {
  Setup: { tone: "info", icon: SlidersHorizontal },
  Published: { tone: "good", icon: DoorOpen },
  Expired: { tone: "warn", icon: Clock },
  Finalized: { tone: "info", icon: Flag },
};

const joinLooks: Record<string, { label: string; icon: LucideIcon }> = {
  Open: { label: "Vào thẳng", icon: DoorOpen },
  Application: { label: "Qua đơn xin vào", icon: Inbox },
  Admin: { label: "Giáo vụ xếp", icon: SlidersHorizontal },
};

export function StatusChip({ status }: { status: RoomSummary["status"] }) {
  const look = statusLooks[status];
  return (
    <Badge tone={look.tone} icon={look.icon}>
      {roomStatusLabels[status]}
    </Badge>
  );
}

export function PhaseChip({ phase }: { phase: CoursePhase }) {
  const look = phaseLooks[phase];
  return (
    <Badge tone={look.tone} icon={look.icon}>
      {phaseLabels[phase]}
    </Badge>
  );
}

export function EligibleChip({ eligible }: { eligible: boolean }) {
  return eligible ? (
    <Badge tone="good" icon={Check}>
      Đủ điều kiện
    </Badge>
  ) : (
    <Badge tone="warn" icon={CircleAlert}>
      Chưa đủ điều kiện
    </Badge>
  );
}

export function CountChip({ room }: { room: Pick<RoomDetail, "memberCount" | "capacity"> }) {
  return (
    <Badge icon={Users}>
      {room.memberCount}/{room.capacity} người
    </Badge>
  );
}

export function Composition({ room, single = true }: { room: RoomDetail; single?: boolean }) {
  const reserved = room.missingMajorSeats ?? missingMajors(room.majors).reduce((sum, major) => sum + major.required - major.members, 0);
  return (
    <Section title="Thành phần nhóm" icon={Layers} description={`Loại nhóm ${room.groupTypeName} (${room.groupTypeCode})`} actions={<CountChip room={room} />}>
      <SeatStrip capacity={room.capacity} memberCount={room.memberCount} majors={room.majors} missingMajorSeats={reserved} />
      <Checks single={single}>
        {roomChecks(room).map((check) => (
          <CheckItem key={check.label} ok={check.ok} label={check.label} value={check.value} />
        ))}
      </Checks>
    </Section>
  );
}

function MemberRow({ member, isMe, joinDetails, actions }: { member: RoomMember; isMe: boolean; joinDetails: boolean; actions?: ReactNode }) {
  const via = joinLooks[member.joinedVia];
  return (
    <li className="flex items-start justify-between gap-3 border-t py-2.5 text-[13px] first:border-t-0">
      <div className="flex min-w-0 items-start gap-2.5">
        <Avatar className="size-7">
          <AvatarFallback className="text-[11px] font-extrabold">{initialsOf(member.fullName)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <strong>{member.fullName}</strong>
            <span className="text-muted-foreground">{member.studentCode}</span>
            {member.isLeader && (
              <Badge tone="info" icon={Crown}>
                Trưởng nhóm
              </Badge>
            )}
            {isMe && <Badge icon={User}>Bạn</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <MajorTag code={member.majorCode} />
            <SkillTags skills={member.skills} />
          </div>
          {joinDetails && (
            <div className="flex flex-wrap items-center gap-1.5">
              {via && <Badge icon={via.icon}>{via.label}</Badge>}
              <span className="text-xs text-muted-foreground">Vào {dayTime(member.joinedAt)}</span>
            </div>
          )}
        </div>
      </div>
      {actions}
    </li>
  );
}

export function MemberList({ room, userId, joinDetails = false, readOnlyChip = false, actionsFor }: { room: RoomDetail; userId?: string; joinDetails?: boolean; readOnlyChip?: boolean; actionsFor?: (member: RoomMember) => ReactNode }) {
  return (
    <Section title="Thành viên" icon={Users} actions={readOnlyChip ? <Badge icon={Lock}>Chỉ đọc</Badge> : undefined}>
      {room.members.length === 0 ? (
        <EmptyState icon={Users} title="Phòng chưa có ai." />
      ) : (
        <ul className="flex list-none flex-col">
          {room.members.map((member) => (
            <MemberRow key={member.studentId} member={member} isMe={member.studentId === userId} joinDetails={joinDetails} actions={actionsFor?.(member)} />
          ))}
        </ul>
      )}
    </Section>
  );
}

export function ExceptionBox({ room }: { room: RoomDetail }) {
  const unmet = unmetConditions(room);
  return (
    <Section title="Nhóm được chốt theo ngoại lệ" icon={ShieldAlert}>
      <Criteria>
        {unmet.length > 0 && <Criterion label="Điều kiện chưa đạt">{unmet.join(", ")}</Criterion>}
        <Criterion label="Quyết định">Giáo vụ chấp nhận khi chốt</Criterion>
      </Criteria>
    </Section>
  );
}

export function AfterDeadline() {
  return (
    <Section title="Sau hạn chọn phòng" icon={Clock}>
      <Criteria>
        <Criterion label="Rời phòng">Không còn được</Criterion>
        <Criterion label="Đề tài">Trưởng nhóm vẫn sửa được</Criterion>
        <Criterion label="Chat">Vẫn gửi được</Criterion>
        <Criterion label="Xếp người còn lại">Giáo vụ</Criterion>
      </Criteria>
    </Section>
  );
}

export function SuggestionsBox({ courseId, expireAt }: { courseId: string; expireAt: string | null }) {
  const { api } = useAuth();
  const suggestions = useQuery({
    queryKey: ["suggestions", courseId],
    queryFn: () => api.get<RoomSuggestions>(`/api/v1/courses/${courseId}/rooms/suggestions`, { top: 3 }),
  });
  const data = suggestions.data?.data;

  return (
    <Section title="Phòng hợp với bạn" icon={Sparkles} description="Xếp theo ngành phòng còn thiếu và kỹ năng bạn bổ sung được cho phòng.">
      <Loading when={suggestions.isPending} className="px-0 py-0" />
      {suggestions.isError && <Failure error={suggestions.error} title="Không tải được gợi ý" onRetry={() => void suggestions.refetch()} />}
      {data && !data.ranked && <Notice tone="neutral">Chưa xếp hạng được lúc này, đây là các phòng bạn vào được.</Notice>}
      {data?.rooms.length === 0 && <EmptyState icon={DoorOpen} title="Không còn phòng nào bạn vào được." />}
      {data && data.rooms.length > 0 && (
        <ul className="flex list-none flex-col">
          {data.rooms.map((item) => (
            <li key={item.room.id} className="flex items-start justify-between gap-3 border-t py-2.5 text-[13px] first:border-t-0">
              <div className="flex min-w-0 flex-col gap-0.5">
                <Link to={`/rooms/${item.room.id}`} className="font-semibold underline-offset-2 hover:underline">
                  {item.room.name}
                </Link>
                <span className="text-xs text-muted-foreground">{item.room.topic ?? "Chưa có đề tài"}</span>
                {item.reasons.map((reason) => (
                  <span key={`${reason.code}-${reason.detail}`} className="inline-flex items-center gap-1.5 text-xs">
                    <Check className="size-3.5 shrink-0" aria-hidden />
                    {suggestionReasonText(reason.code, reason.detail)}
                  </span>
                ))}
              </div>
              <CountChip room={item.room} />
            </li>
          ))}
        </ul>
      )}
      <Criteria>
        <Criterion label="Muốn đổi phòng">Rời phòng này trước</Criterion>
        <Criterion label="Hạn đổi phòng">{dayTime(expireAt)}</Criterion>
      </Criteria>
    </Section>
  );
}
