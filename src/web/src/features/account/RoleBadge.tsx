import { BookOpen, SlidersHorizontal, UserRound, type LucideIcon } from "lucide-react";
import { roleLabels } from "../../shared/layout/navigation";
import { Badge } from "../common/ui";

const roleIcons: Record<string, LucideIcon> = {
  Student: UserRound,
  Lecturer: BookOpen,
  Administrator: SlidersHorizontal,
};

export function RoleBadge({ role }: { role: string }) {
  return <Badge icon={roleIcons[role] ?? UserRound}>{role in roleLabels ? roleLabels[role as keyof typeof roleLabels] : role}</Badge>;
}
