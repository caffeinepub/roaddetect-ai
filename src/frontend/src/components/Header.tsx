import { Button } from "@/components/ui/button";
import { Activity, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import AccidentReportDialog from "./AccidentReportDialog";

export default function Header() {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-chart-1 to-chart-2 shadow-lg shadow-primary/20 transition-all duration-300 motion-safe:hover:shadow-glow">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="bg-gradient-to-r from-primary to-chart-1 bg-clip-text text-xl font-bold text-transparent">
            RoadDetect AI
          </span>
        </div>

        <div className="flex items-center gap-3">
          <AccidentReportDialog />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="btn-icon-align h-10 w-10 rounded-xl transition-colors duration-200 hover:bg-primary/10 motion-safe:hover:shadow-glow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-primary/40"
            aria-label="Toggle theme"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </div>
      </div>
    </header>
  );
}
