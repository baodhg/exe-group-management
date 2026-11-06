import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "../../shared/theme/theme";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";
  const Icon = dark ? Sun : Moon;

  return (
    <Button type="button" variant="outline" size="sm" aria-label={dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"} onClick={() => setTheme(dark ? "light" : "dark")}>
      <Icon aria-hidden />
      {dark ? "Sáng" : "Tối"}
    </Button>
  );
}
