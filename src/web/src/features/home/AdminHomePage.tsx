import { Link } from "react-router";

const sections: ReadonlyArray<{ title: string; links: ReadonlyArray<{ to: string; label: string }> }> = [
  {
    title: "Dữ liệu nền",
    links: [
      { to: "/admin/semesters", label: "Học kỳ" },
      { to: "/admin/subjects", label: "Môn học" },
      { to: "/admin/majors", label: "Ngành" },
      { to: "/admin/skills", label: "Skill" },
      { to: "/admin/group-types", label: "Loại nhóm (theo học kỳ)" },
    ],
  },
  { title: "Vòng đời course", links: [{ to: "/admin/courses", label: "Course: tạo, import SV, sinh phòng, publish, xếp người, chốt nhóm" }] },
  { title: "Tài khoản", links: [{ to: "/admin/users", label: "Giảng viên, quản trị viên, sinh viên" }] },
];

export function AdminHomePage() {
  return (
    <section className="card">
      <h1>Quản trị</h1>
      <div className="tiles">
        {sections.map((section) => (
          <div key={section.title} className="tile">
            <h2>{section.title}</h2>
            <ul>
              {section.links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
