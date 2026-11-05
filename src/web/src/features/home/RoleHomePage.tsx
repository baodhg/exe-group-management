const plans: Record<string, { title: string; items: string[] }> = {
  student: {
    title: "Trang sinh viên",
    items: ["Lớp của tôi", "Tìm nhóm và xem chi tiết nhóm", "Tạo nhóm", "Gửi / huỷ yêu cầu tham gia"],
  },
  lecturer: {
    title: "Trang giảng viên",
    items: ["Lớp được phân công", "Tổng quan lớp", "Sinh viên chưa có nhóm"],
  },
  admin: {
    title: "Trang quản trị",
    items: ["Học kỳ (đã có — xem menu Học kỳ)", "Môn học", "Lớp và roster", "Người dùng và vai trò"],
  },
};

export function RoleHomePage({ area }: { area: keyof typeof plans }) {
  const plan = plans[area]!;
  return (
    <section className="card">
      <h1>{plan.title}</h1>
      <p>Các màn hình sẽ được thêm vào đây:</p>
      <ul>
        {plan.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
