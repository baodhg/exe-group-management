import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, CircleAlert, Clock, Crown, DoorOpen, Inbox, Info, Layers, Lock, Send, Sparkles, User, UsersRound, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "../../shared/auth/useAuth";
import { suggestionReasonText } from "../common/messages";
import type { RoomDetail, SuggestionReason } from "../common/types";
import { Badge, Failure, LinkButton, Notice, Section, type Tone } from "../common/ui";
import { RoomStatusBadge } from "../rooms/RoomCard";
import { roomPanelFor, type RoomPanelInput, type RoomPanelKind } from "../rooms/roomBoardLogic";
import { missingMajors } from "../rooms/seatLayout";
import { MajorChips, MajorTag, SkillTags } from "../rooms/seats";
import { RoomCheckList } from "./courseParts";

const eyebrows: Record<RoomPanelKind, { label: string; icon: LucideIcon }> = {
  mine: { label: "Phòng của bạn", icon: DoorOpen },
  mineExpired: { label: "Phòng của bạn", icon: DoorOpen },
  setup: { label: "Chi tiết phòng", icon: Info },
  expired: { label: "Chi tiết phòng", icon: Info },
  expiredHasRoom: { label: "Chi tiết phòng", icon: Info },
  hasRoom: { label: "Chi tiết phòng", icon: Info },
  stale: { label: "Chi tiết phòng", icon: Info },
  removed: { label: "Không vào được", icon: Lock },
  pending: { label: "Đơn của bạn", icon: Inbox },
  full: { label: "Phòng đã đủ người", icon: UsersRound },
  lockedFull: { label: "Khoá và đã đủ người", icon: Lock },
  noFit: { label: "Không còn chỗ cho ngành của bạn", icon: CircleAlert },
  suggested: { label: "Gợi ý cho bạn", icon: Sparkles },
  empty: { label: "Phòng trống", icon: Crown },
  open: { label: "Chi tiết phòng", icon: Info },
  locked: { label: "Chi tiết phòng", icon: Info },
};

interface PanelNote {
  tone: Tone;
  icon: LucideIcon;
  text: string;
}

function notesFor(kind: RoomPanelKind, room: RoomDetail, action: string, pendingElsewhere: readonly string[]): PanelNote[] {
  switch (kind) {
    case "mineExpired":
      return [{ tone: "warn", icon: Lock, text: "Đã hết hạn tìm nhóm, không còn rời phòng được. Trò chuyện của phòng vẫn mở." }];
    case "setup":
      return [{ tone: "info", icon: Info, text: "Lớp chưa mở tìm nhóm. Khi lớp mở, bạn sẽ nhận thông báo và có thể chọn phòng." }];
    case "expired":
      return [{ tone: "warn", icon: Clock, text: "Đã hết hạn tìm nhóm. Giáo vụ sẽ xếp bạn vào một phòng còn chỗ trước khi chốt nhóm." }];
    case "expiredHasRoom":
      return [{ tone: "warn", icon: Clock, text: "Bạn đã có phòng trong lớp này." }];
    case "hasRoom":
      return [{ tone: "neutral", icon: Info, text: "Bạn đã có phòng trong lớp này." }];
    case "stale":
      return [{ tone: "warn", icon: Clock, text: "Lớp không ở giai đoạn tìm nhóm." }];
    case "removed":
      return [{ tone: "bad", icon: CircleAlert, text: "Trưởng nhóm đã xoá bạn khỏi phòng này, không vào lại được." }];
    case "pending":
      return [{ tone: "info", icon: Inbox, text: "Đơn của bạn đang chờ duyệt. Bạn có thể rút đơn trước hạn tìm nhóm." }];
    case "full":
      return [{ tone: "warn", icon: CircleAlert, text: "Phòng đã đủ người. Có chỗ trở lại khi có bạn rời phòng." }];
    case "lockedFull":
      return [{ tone: "warn", icon: CircleAlert, text: "Phòng đang khoá và đã đủ người, chưa gửi đơn được. Có chỗ trở lại khi có bạn rời phòng." }];
    case "noFit": {
      const codes = missingMajors(room.majors).map((major) => major.majorCode);
      const base = "Vào phòng sẽ không còn đủ chỗ cho các ngành phòng còn thiếu.";
      return [{ tone: "warn", icon: CircleAlert, text: codes.length > 0 ? `${base} Chỗ còn lại giữ cho ngành ${codes.join(", ")}.` : base }];
    }
    default:
      break;
  }

  if (action === "apply") {
    return [{ tone: "neutral", icon: Lock, text: "Phòng đang khoá, trưởng nhóm sẽ xem đơn và quyết định." }];
  }

  if (action !== "join") {
    return [];
  }

  return [
    ...(room.memberCount === 0 ? [{ tone: "neutral" as const, icon: Crown, text: "Bạn sẽ thành trưởng nhóm vì vào đầu tiên, và có thể đặt đề tài ngay sau đó." }] : []),
    ...(pendingElsewhere.length > 0 ? [{ tone: "warn" as const, icon: Info, text: `Vào phòng này sẽ huỷ đơn đang chờ ở ${pendingElsewhere.join(", ")}.` }] : []),
  ];
}

export function RoomDetailPanel({
  roomId,
  context,
  userId,
  reasons,
  pendingElsewhere,
  joining,
  onJoin,
  onApply,
  onWithdraw,
}: {
  roomId: string;
  context: Omit<RoomPanelInput, "room">;
  userId: string | undefined;
  reasons: readonly SuggestionReason[];
  pendingElsewhere: readonly string[];
  joining: boolean;
  onJoin: (room: RoomDetail) => void;
  onApply: (room: RoomDetail) => void;
  onWithdraw: (room: RoomDetail) => void;
}) {
  const { api } = useAuth();
  const room = useQuery({ queryKey: ["room", roomId], queryFn: () => api.get<RoomDetail>(`/api/v1/rooms/${roomId}`) });

  if (room.isLoading) {
    return (
      <Section>
        <div className="space-y-3" aria-busy="true" aria-label="Đang tải phòng">
          <Skeleton className="h-6 w-48 rounded-full" />
          <Skeleton className="h-3 w-full rounded-full" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </Section>
    );
  }

  if (!room.data) {
    return (
      <Section>
        <Failure error={room.error} title="Không tải được phòng" onRetry={() => void room.refetch()} />
      </Section>
    );
  }

  const detail = room.data.data;
  const panel = roomPanelFor({ ...context, room: detail });
  const eyebrow = eyebrows[panel.kind];
  const EyebrowIcon = eyebrow.icon;
  const notes = notesFor(panel.kind, detail, panel.action, pendingElsewhere);

  return (
    <Section>
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <EyebrowIcon className="size-3.5" aria-hidden />
          {eyebrow.label}
        </span>
        <h2 className="text-lg font-extrabold tracking-[-0.015em]">{detail.name}</h2>
        <p className="text-sm text-muted-foreground">{detail.topic ?? "Chưa có đề tài"}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge icon={UsersRound}>
          <span className="tabular">
            {detail.memberCount}/{detail.capacity}
          </span>{" "}
          người
        </Badge>
        <RoomStatusBadge status={detail.status} />
        <Badge tone={detail.eligible ? "good" : "warn"} icon={detail.eligible ? Check : CircleAlert}>
          {detail.eligible ? "Đủ điều kiện" : "Chưa đủ điều kiện"}
        </Badge>
        <Badge icon={Layers}>{detail.groupTypeCode}</Badge>
      </div>
      <MajorChips majors={detail.majors} />
      <RoomCheckList room={detail} />
      {panel.kind === "suggested" && reasons.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Sparkles className="size-3.5" aria-hidden />
            Vì sao gợi ý phòng này
          </span>
          {reasons.map((reason) => (
            <span key={`${reason.code}-${reason.detail}`} className="flex items-center gap-1.5 text-[13px] text-ink">
              <Check className="size-3.5 shrink-0" aria-hidden />
              {suggestionReasonText(reason.code, reason.detail)}
            </span>
          ))}
        </div>
      )}
      <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <Crown className="size-3.5 shrink-0" aria-hidden />
        {detail.leaderName ? `Trưởng nhóm: ${detail.leaderName}` : "Chưa có trưởng nhóm"}
      </span>
      {detail.members.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Phòng chưa có ai.</p>
      ) : (
        <ul className="flex list-none flex-col" aria-label="Thành viên">
          {detail.members.map((member) => (
            <li key={member.studentId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t py-2.5 text-[13px] first:border-t-0">
              <span className="flex flex-wrap items-center gap-1.5">
                <strong>{member.fullName}</strong>
                <MajorTag code={member.majorCode} />
                {member.isLeader && (
                  <Badge className="border-current text-ink" icon={Crown}>
                    Trưởng nhóm
                  </Badge>
                )}
                {member.studentId === userId && (
                  <Badge tone="info" icon={User}>
                    Bạn
                  </Badge>
                )}
              </span>
              <SkillTags skills={member.skills} />
            </li>
          ))}
        </ul>
      )}
      {notes.map((note) => (
        <Notice key={note.text} tone={note.tone} icon={note.icon}>
          {note.text}
        </Notice>
      ))}
      {panel.action === "join" && (
        <Button pending={joining} disabled={panel.disabled} onClick={() => onJoin(detail)}>
          {!joining && (detail.memberCount === 0 ? <Crown aria-hidden /> : <ArrowRight aria-hidden />)}
          {joining ? "Đang vào phòng" : detail.memberCount === 0 ? "Vào và làm trưởng nhóm" : "Vào phòng"}
        </Button>
      )}
      {panel.action === "apply" && (
        <Button disabled={panel.disabled} onClick={() => onApply(detail)}>
          <Send aria-hidden />
          Gửi đơn xin vào
        </Button>
      )}
      {panel.action === "withdraw" && (
        <Button variant="outline" disabled={panel.disabled} onClick={() => onWithdraw(detail)}>
          <X aria-hidden />
          Rút đơn
        </Button>
      )}
      {panel.action === "enter" && (
        <LinkButton to={`/rooms/${detail.id}`}>
          <ArrowRight aria-hidden />
          Vào phòng
        </LinkButton>
      )}
    </Section>
  );
}
