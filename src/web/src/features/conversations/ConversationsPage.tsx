import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { DoorOpen, LayoutGrid, Layers, Lock, MessagesSquare, School, Trash2, type LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "../../shared/auth/useAuth";
import type { Course, RoomDetail } from "../common/types";
import { Badge, Criteria, Criterion, EmptyState, Failure, LinkButton, PageHeader, Section, type Tone } from "../common/ui";
import { ChatPanel } from "../realtime/ChatPanel";
import { useRealtime } from "../realtime/realtimeContext";
import { dayTime } from "../rooms/roomActions";
import { conversationPreview, conversationStanding, conversationTime, isRoomGone, orderConversations, selectConversation, type Conversation, type ConversationStanding } from "./conversations";

const standingBadges: Record<ConversationStanding, { label: string; tone: Tone; icon: LucideIcon }> = {
  current: { label: "Đang ở phòng", tone: "good", icon: DoorOpen },
  former: { label: "Đã rời phòng", tone: "neutral", icon: Lock },
  deleted: { label: "Phòng đã bị xoá", tone: "warn", icon: Trash2 },
};

function ConversationsLoading() {
  return (
    <div className="flex flex-wrap items-stretch gap-4 pt-2.5" aria-busy="true" aria-label="Đang tải">
      <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-11 w-full rounded-[10px]" />
        ))}
      </div>
      <Skeleton className="h-96 min-w-0 flex-[3_1_540px] rounded-xl" />
    </div>
  );
}

function LeftRules({ conversation, standing }: { conversation: Conversation; standing: ConversationStanding }) {
  const left = dayTime(conversation.leftAt);
  return (
    <Criteria columns={3}>
      {standing === "deleted" ? (
        <>
          <Criterion label="Phòng">Đã bị xoá khi chốt nhóm</Criterion>
          <Criterion label="Tin nhắn">Xem tới lúc rời, {left}</Criterion>
        </>
      ) : (
        <Criterion label="Rời phòng lúc">{left}</Criterion>
      )}
      <Criterion label="Gửi tin">Không còn gửi được</Criterion>
      {standing === "former" && <Criterion label="Vào lại phòng">Mở lại cuộc trò chuyện này</Criterion>}
    </Criteria>
  );
}

export function ConversationsPage() {
  const { api, user } = useAuth();
  const { onMessage } = useRealtime();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();

  const list = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get<Conversation[]>("/api/v1/conversations"),
  });
  const courses = useQuery({
    queryKey: ["courses", "mine"],
    queryFn: () => api.get<Course[]>("/api/v1/courses", { mine: true, pageSize: 100, sort: "-expireAt" }),
  });

  const conversations = orderConversations(list.data?.data ?? []);
  const former = conversations.filter((conversation) => !conversation.canSend);
  const rooms = useQueries({
    queries: former.map((conversation) => ({
      queryKey: ["room", conversation.id],
      queryFn: () => api.get<RoomDetail>(`/api/v1/rooms/${conversation.id}`),
    })),
  });
  const goneIds = new Set(former.filter((_, index) => isRoomGone(rooms[index]?.error)).map((conversation) => conversation.id));
  const liveIds = conversations
    .filter((conversation) => conversation.canSend)
    .map((conversation) => conversation.id)
    .join(",");

  useEffect(() => {
    const stops = liveIds
      .split(",")
      .filter(Boolean)
      .map((id) => onMessage(id, () => void queryClient.invalidateQueries({ queryKey: ["conversations"] })));
    return () => stops.forEach((stop) => stop());
  }, [liveIds, onMessage, queryClient]);

  const header = <PageHeader title="Trò chuyện" description="Chat của các phòng bạn đang ở và đã từng ở." />;

  if (list.isPending) {
    return (
      <>
        {header}
        <ConversationsLoading />
      </>
    );
  }

  if (list.isError) {
    return (
      <>
        {header}
        <Section className="mt-2.5">
          <Failure error={list.error} title="Không tải được tin nhắn" onRetry={() => void list.refetch()} />
        </Section>
      </>
    );
  }

  const selected = selectConversation(conversations, params.get("id"));
  if (!selected) {
    return (
      <>
        {header}
        <Section className="mt-2.5">
          <EmptyState
            icon={MessagesSquare}
            title="Bạn chưa có cuộc trò chuyện nào"
            description="Chat xuất hiện khi bạn vào một phòng."
            action={
              <LinkButton to="/student" variant="outline">
                <LayoutGrid aria-hidden />
                Xem bảng phòng
              </LinkButton>
            }
          />
        </Section>
      </>
    );
  }

  const courseLabel = (courseId: string) => {
    const course = courses.data?.data.find((item) => item.id === courseId);
    return course ? `${course.subjectCode} ${course.classCode}` : null;
  };
  const standing = conversationStanding(selected, goneIds.has(selected.id));

  return (
    <>
      {header}
      <div className="flex flex-wrap items-stretch gap-4 pt-2.5">
        <Section flush className="min-w-0 flex-[1_1_300px] self-start" title="Cuộc trò chuyện" icon={MessagesSquare} actions={<Badge icon={Layers}>{conversations.length} cuộc</Badge>}>
          <div className="flex flex-col pt-2.5">
            {conversations.map((conversation) => {
              const look = standingBadges[conversationStanding(conversation, goneIds.has(conversation.id))];
              const course = courseLabel(conversation.courseId);
              const isOn = conversation.id === selected.id;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  aria-pressed={isOn}
                  onClick={() => setParams({ id: conversation.id })}
                  className={cn("flex w-full cursor-pointer flex-col gap-0.5 border-t px-4 py-3 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset", isOn && "bg-primary/8 hover:bg-primary/8")}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[13.5px]/[1.35] font-bold">{conversation.title}</span>
                    <span className="tabular flex-none text-xs text-muted-foreground">{conversationTime(conversation.lastMessage?.sentAt ?? null)}</span>
                  </span>
                  <span className="line-clamp-2 text-[13px]/[1.4] text-muted-foreground">{conversationPreview(conversation, user?.userId)}</span>
                  <span className="flex flex-wrap items-center gap-1.5 pt-1">
                    {course && <Badge icon={School}>{course}</Badge>}
                    <Badge tone={look.tone} icon={look.icon}>
                      {look.label}
                    </Badge>
                  </span>
                </button>
              );
            })}
          </div>
        </Section>
        <Section className="min-w-0 flex-[3_1_540px] self-start lg:sticky lg:top-4">
          {standing !== "current" && <LeftRules conversation={selected} standing={standing} />}
          {standing !== "deleted" && (
            <LinkButton to={`/rooms/${selected.id}`} variant="link" className="self-start">
              <DoorOpen aria-hidden />
              {standing === "current" ? "Mở" : "Xem"} {selected.title}
            </LinkButton>
          )}
          <ChatPanel key={selected.id} conversationId={selected.id} title={selected.title} readOnly={!selected.canSend} />
        </Section>
      </div>
    </>
  );
}
