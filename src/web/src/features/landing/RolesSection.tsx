import { ArrowRight, Check } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LinkButton, Section } from "../common/ui";
import { roles } from "./landingContent";
import { DisplayHeading, revealClass, Wrap } from "./parts";

export function RolesSection() {
  return (
    <section id="roles" className="pb-18">
      <Wrap className="flex flex-col gap-4">
        <DisplayHeading className={revealClass}>Mỗi người một việc rõ ràng</DisplayHeading>
        <Tabs defaultValue={roles[0]?.name} className="gap-4">
          <TabsList aria-label="Chọn vai trò">
            {roles.map(({ name, icon: Icon }) => (
              <TabsTrigger key={name} value={name}>
                <Icon aria-hidden />
                {name}
              </TabsTrigger>
            ))}
          </TabsList>
          {roles.map((role) => (
            <TabsContent key={role.name} value={role.name}>
              <Section>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <div className="flex min-w-0 flex-auto flex-col gap-2">
                    <h3 className="text-lg/[1.3] font-extrabold tracking-[-0.015em]">{role.headline}</h3>
                    <ul className="flex flex-col divide-y text-[13px]/[1.45]">
                      {role.points.map((point) => (
                        <li key={point} className="flex items-center gap-2 py-2.5">
                          <Check className="size-4 shrink-0" aria-hidden />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <LinkButton to="/login">
                    <ArrowRight aria-hidden />
                    Xem màn hình {role.name}
                  </LinkButton>
                </div>
              </Section>
            </TabsContent>
          ))}
        </Tabs>
      </Wrap>
    </section>
  );
}
