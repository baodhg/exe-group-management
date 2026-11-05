import { Link } from "react-router";

const sections: ReadonlyArray<{ title: string; links: ReadonlyArray<{ to: string; label: string }> }> = [
  { title: "Dữ liệu nền", links: [{ to: "/admin/semesters", label: "Học kỳ" }] },
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
