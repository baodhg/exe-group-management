import {
  Award,
  Bell,
  BookOpen,
  Clock,
  Crown,
  DoorOpen,
  Eye,
  Inbox,
  Lock,
  MessagesSquare,
  Move,
  SlidersHorizontal,
  Sparkles,
  User,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { MajorCount } from "../common/types";

export const pageSections = [
  { href: "#how", label: "Cách hoạt động" },
  { href: "#features", label: "Tính năng" },
  { href: "#roles", label: "Vai trò" },
  { href: "#faq", label: "Hỏi đáp" },
];

export function sampleMajor(majorCode: string, members: number, required = 0): MajorCount {
  return { majorId: majorCode, majorCode, members, required };
}

export interface LandingTag {
  icon: LucideIcon;
  label: string;
}

export const marqueeTags: LandingTag[] = [
  { icon: UsersRound, label: "Ghế theo ngành" },
  { icon: Sparkles, label: "Gợi ý có lý do" },
  { icon: Clock, label: "Hạn chót tự động" },
  { icon: Lock, label: "Khoá phòng" },
  { icon: Inbox, label: "Duyệt đơn" },
  { icon: MessagesSquare, label: "Trò chuyện theo phòng" },
  { icon: Bell, label: "Thông báo tức thời" },
  { icon: Move, label: "Giáo vụ xếp người" },
  { icon: Award, label: "Nhóm chính thức" },
  { icon: Eye, label: "Giảng viên theo dõi" },
];

export const facts = [
  { value: "4", label: "giai đoạn từ chuẩn bị tới chốt nhóm" },
  { value: "4 đến 6", label: "người trong mỗi nhóm" },
  { value: "2+", label: "ngành trong mỗi nhóm" },
  { value: "1", label: "phòng cho mỗi sinh viên trong một lớp" },
];

export const phases: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: SlidersHorizontal, title: "Chuẩn bị", text: "Giáo vụ nhập sinh viên và tạo phòng. Sinh viên tự chấm kỹ năng." },
  { icon: DoorOpen, title: "Chọn phòng", text: "Sinh viên vào phòng hoặc gửi đơn. Trưởng nhóm khoá phòng và duyệt." },
  { icon: Move, title: "Xếp lại", text: "Tới hạn, sinh viên không đổi phòng được nữa. Giáo vụ xếp nốt người còn lại." },
  { icon: Award, title: "Chốt nhóm", text: "Phòng thành nhóm đánh số, cả lớp và giảng viên cùng xem một danh sách." },
];

export const comparisons = [
  { before: "Giáo vụ chỉ thấy kết quả cuối", after: "Thấy tiến độ cả lớp theo thời gian thực" },
  { before: "Nhóm thiếu ngành bắt buộc, phải lập lại", after: "Phòng giữ chỗ cho ngành còn thiếu" },
  { before: "Chọn theo bạn thân vì không biết ai giỏi gì", after: "Gợi ý theo thế mạnh, kèm lý do rõ ràng" },
  { before: "Hạn chót và danh sách cuối xử lý bằng tay", after: "Khoá đúng giờ, chốt thành nhóm đánh số" },
];

export const roles: { name: string; icon: LucideIcon; headline: string; points: string[] }[] = [
  {
    name: "Sinh viên",
    icon: User,
    headline: "Biết nên vào đâu và vì sao",
    points: ["Tự chấm thế mạnh từ 1 đến 5", "Xem phòng còn thiếu ngành nào, nhận gợi ý có lý do", "Vào phòng mở hoặc gửi đơn vào phòng đã khoá"],
  },
  {
    name: "Trưởng nhóm",
    icon: Crown,
    headline: "Giữ đội đúng hướng",
    points: ["Đặt đề tài để thu hút thành viên", "Khoá phòng, duyệt hoặc từ chối đơn", "Xoá thành viên kèm lý do, chuyển quyền trưởng nhóm"],
  },
  {
    name: "Giáo vụ",
    icon: SlidersHorizontal,
    headline: "Thấy cả lớp, xử lý đúng chỗ",
    points: ["Nhập sinh viên và tạo phòng theo công thức", "Theo dõi người chưa có phòng và phòng chưa đủ điều kiện", "Xếp người sau hạn, chốt nhóm đánh số chính thức"],
  },
  {
    name: "Giảng viên",
    icon: BookOpen,
    headline: "Nắm tiến độ lớp mình dạy",
    points: ["Xem tiến độ và danh sách phòng của lớp", "Thấy sinh viên chưa có phòng", "Xem danh sách nhóm chính thức, chỉ đọc"],
  },
];

export const faqs = [
  { question: "Ai tạo phòng?", answer: "Giáo vụ tạo phòng cho từng lớp theo sĩ số và số người tối đa của nhóm. Sinh viên chọn phòng thay vì tự lập nhóm." },
  { question: "Có được đổi phòng không?", answer: "Có, trước hạn chót sinh viên được rời phòng và chọn phòng khác. Sau hạn chỉ giáo vụ mới chuyển được người." },
  { question: "Hết hạn mà chưa có phòng thì sao?", answer: "Giáo vụ sẽ xếp bạn vào một phòng còn chỗ, có gợi ý từ hệ thống. Điều kiện đủ người và đủ ngành được kiểm lại lúc chốt nhóm." },
  { question: "Kỹ năng tự chấm có làm mình bị chặn không?", answer: "Không. Kỹ năng chỉ dùng để hiển thị và gợi ý, không bao giờ chặn việc vào phòng." },
  { question: "Ai đọc được cuộc trò chuyện của phòng?", answer: "Chỉ thành viên của phòng. Giảng viên không đọc được nội dung trò chuyện." },
];
