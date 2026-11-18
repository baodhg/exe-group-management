import { Award, Bell, Crown, Download, TriangleAlert, UsersRound } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "../../shared/auth/useAuth";
import type { OfficialGroup } from "../common/types";
import { Badge, EmptyState, Failure, Loading, Notice, Section, SummaryCard } from "../common/ui";
import { useOfficialGroups } from "./courseData";
import { TopicCell } from "../topics/GroupTopicPanel";
import { useMissingTopics } from "../topics/useMissingTopics";

export function OfficialGroupsPanel({ courseId }: { courseId: string }) {
  const { api } = useAuth();
  const groups = useOfficialGroups(courseId);
  const missing = useMissingTopics(courseId);
  const [downloading, setDownloading] = useState(false);
  const all = groups.data?.data.groups ?? [];
  const missingCount = missing.data?.data.groups.length ?? all.filter((group) => group.topicMissing).length;

  async function download() {
    setDownloading(true);
    try {
      const file = await api.download(`/api/v1/courses/${courseId}/groups/export.csv`);
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename ?? "nhom-chinh-thuc.csv";
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function refresh() {
    await Promise.all([groups.refetch(), missing.refetch()]);
  }

  return (
    <>
      {missingCount > 0 && (
        <Section title="Nhóm chưa có đề tài" icon={TriangleAlert} description="Sau khi lớp đã chốt nhóm, các nhóm chưa có đề tài cần được bổ sung.">
          <SummaryCard icon={TriangleAlert} label="Cần bổ sung đề tài" value={`${missingCount}/${all.length} nhóm`}>
            <span className="text-xs text-muted-foreground">Bạn có thể đặt đề tài giúp nhóm, hoặc nhắc trưởng nhóm bổ sung.</span>
          </SummaryCard>
          <Notice tone="warn" icon={Bell}>
            Không chặn việc chốt nhóm, nhưng nhóm không có đề tài sẽ khó chấm đồ án. Giảng viên phụ trách và giáo vụ đều có thể đặt đề tài hoặc nhắc trưởng nhóm.
          </Notice>
        </Section>
      )}
      <Section
        flush
        title="Nhóm chính thức"
        icon={Award}
        actions={
          <Button variant="outline" size="sm" onClick={() => void download()} pending={downloading} disabled={all.length === 0}>
            {!downloading && <Download aria-hidden />}
            Tải CSV
          </Button>
        }
      >
        <Loading when={groups.isLoading} rows={5} />
        {groups.isError && <Failure error={groups.error} title="Không tải được danh sách nhóm chính thức" onRetry={() => void groups.refetch()} />}
        {groups.isSuccess && all.length === 0 && <EmptyState icon={Award} title="Chưa có nhóm chính thức" description="Lớp mới chốt nhóm thì danh sách này mới có." />}
        {all.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nhóm</TableHead>
                <TableHead>Đề tài</TableHead>
                <TableHead>Trưởng nhóm</TableHead>
                <TableHead>Thành viên</TableHead>
                <TableHead>Ghế</TableHead>
                <TableHead>Điều kiện</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {all.map((group) => (
                <GroupRow key={group.roomId} group={group} courseId={courseId} onChanged={refresh} />
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </>
  );
}

function GroupRow({ group, courseId, onChanged }: { group: OfficialGroup; courseId: string; onChanged: () => Promise<unknown> }) {
  return (
    <TableRow>
      <TableCell>
        <Link to={`/rooms/${group.roomId}`} className="font-semibold whitespace-nowrap underline-offset-2 hover:underline">
          Nhóm {group.groupNo}: {group.roomName}
        </Link>
        <span className="block text-xs text-muted-foreground">{group.groupTypeName}</span>
      </TableCell>
      <TableCell className="max-w-72">
        <TopicCell courseId={courseId} group={group} onChanged={onChanged} />
      </TableCell>
      <TableCell className="whitespace-nowrap">{group.leaderName || <span className="text-muted-foreground">Chưa có</span>}</TableCell>
      <TableCell>
        <ul className="space-y-0.5">
          {group.members.map((member) => (
            <li key={member.studentId} className="flex items-center gap-1.5 whitespace-nowrap text-[13px]">
              {member.isLeader && <Crown className="size-3.5 shrink-0 text-warning-ink" aria-hidden />}
              <span className="font-medium">{member.fullName}</span>
              <span className="text-xs text-muted-foreground">
                {member.studentCode} · {member.majorCode}
              </span>
            </li>
          ))}
          {group.members.length === 0 && <li className="text-[13px] text-muted-foreground">Không có thành viên</li>}
        </ul>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <Badge icon={UsersRound}>
          {group.memberCount}/{group.capacity}
        </Badge>
      </TableCell>
      <TableCell>
        {group.eligible ? (
          <Badge tone="good" icon={Award}>
            Đủ điều kiện
          </Badge>
        ) : (
          <Badge tone="warn" icon={TriangleAlert}>
            Ngoại lệ
          </Badge>
        )}
      </TableCell>
    </TableRow>
  );
}
