import { Clock, LayoutGrid, Megaphone, MessagesSquare, Sparkles, Star, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, Section } from "../common/ui";
import { SeatStrip } from "../rooms/seats";
import { sampleMajor } from "./landingContent";
import { DisplayHeading, paragraphClass, revealClass, Wrap } from "./parts";

const wideCard = cn("min-[900px]:col-span-4", revealClass);
const narrowCard = cn("min-[900px]:col-span-2", revealClass);

export function FeaturesSection() {
  return (
    <section id="features" className="py-18">
      <Wrap className="flex flex-col gap-8">
        <div className={cn("max-w-[44rem]", revealClass)}>
          <DisplayHeading>Thấy luật trước khi bấm, không phải sau khi bị từ chối</DisplayHeading>
        </div>
        <div className="grid gap-3.5 *:min-w-0 min-[900px]:grid-cols-6">
          <Section title="Ghế theo ngành" icon={UsersRound} className={wideCard}>
            <p className={paragraphClass}>Mỗi phòng cho thấy ngành đã có và ngành còn thiếu. Phòng giữ chỗ cho ngành bắt buộc nên nhóm không phải làm lại vào phút cuối.</p>
            <div className="flex flex-col gap-2">
              <SeatStrip capacity={6} memberCount={3} majors={[sampleMajor("SE", 2), sampleMajor("GD", 1), sampleMajor("MKT", 0, 1)]} missingMajorSeats={1} />
              <SeatStrip capacity={6} memberCount={4} majors={[sampleMajor("SE", 1), sampleMajor("MKT", 1), sampleMajor("IB", 1), sampleMajor("GD", 1)]} />
            </div>
          </Section>
          <Section title="Gợi ý có lý do" icon={Sparkles} className={narrowCard}>
            <p className={paragraphClass}>Xếp hạng phòng theo ngành và kỹ năng tự chấm, rồi nói rõ vì sao phòng đó hợp với bạn.</p>
            <ul className="flex flex-col divide-y text-[13px]/[1.45]">
              <li className="flex items-center gap-2 py-2.5">
                <Megaphone className="size-4 shrink-0" aria-hidden />
                Phòng đang thiếu đúng ngành của bạn
              </li>
              <li className="flex items-center gap-2 py-2.5">
                <Star className="size-4 shrink-0" aria-hidden />
                Bạn mạnh hơn về kỹ năng phòng đang yếu
              </li>
            </ul>
          </Section>
          <Section title="Hạn chót tự chạy" icon={Clock} className={narrowCard}>
            <p className={paragraphClass}>Tới hạn, lớp tự khoá và các đơn còn chờ được xử lý, không ai phải canh giờ.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="warn" icon={Clock}>Còn 2 ngày 4 giờ</Badge>
            </div>
          </Section>
          <Section title="Giáo vụ thấy cả lớp" icon={LayoutGrid} className={narrowCard}>
            <p className={paragraphClass}>Ai chưa có phòng, phòng nào chưa đủ điều kiện đều hiện ngay, trước khi quá muộn.</p>
            <progress value={20} max={30}>20 trên 30</progress>
            <span className="text-[13px]/[1.45] text-muted-foreground">Ví dụ: 20/30 sinh viên đã có phòng</span>
          </Section>
          <Section title="Trò chuyện trong phòng" icon={MessagesSquare} className={narrowCard}>
            <p className={paragraphClass}>Mỗi phòng có một cuộc trò chuyện riêng, cập nhật tức thời cho thành viên.</p>
            <div className="flex flex-col gap-2">
              <span className="max-w-[82%] self-start rounded-xl bg-muted px-3.5 py-2.5 text-[13px]/[1.45]">Nhóm đang cần MKT nhé.</span>
              <span className="max-w-[82%] self-end rounded-xl bg-primary px-3.5 py-2.5 text-[13px]/[1.45] text-primary-foreground">Mình vừa vào phòng!</span>
            </div>
          </Section>
        </div>
      </Wrap>
    </section>
  );
}
