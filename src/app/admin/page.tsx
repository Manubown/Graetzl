import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { fetchReportsWithContext } from "@/lib/admin/fetch";
import { AdminRowActions } from "@/components/admin/admin-row-actions";
import { REPORT_REASONS } from "@/lib/reports/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: false } };

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function AdminPage({ searchParams }: PageProps) {
  try {
    await requireAdmin();
  } catch {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Nicht berechtigt</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Du hast keinen Zugriff auf diesen Bereich.
        </p>
      </div>
    );
  }

  const { status } = await searchParams;
  const statusFilter =
    status === "reviewed" || status === "dismissed" || status === "all"
      ? status
      : "open";
  const reports = await fetchReportsWithContext(
    statusFilter as "open" | "reviewed" | "dismissed" | "all",
  );

  const reasonLabel = (r: string) =>
    REPORT_REASONS.find((R) => R.value === r)?.label ?? r;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Reports verwalten — Service-Role-Zugriff.
          </p>
        </div>
        <nav className="flex gap-1 rounded-full border border-border bg-background p-0.5 text-xs">
          {(["open", "reviewed", "dismissed", "all"] as const).map((s) => (
            <Link
              key={s}
              href={`/admin?status=${s}`}
              className={
                "rounded-full px-3 py-1.5 transition-colors " +
                (statusFilter === s
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted")
              }
            >
              {s === "open" ? "Offen" : s === "reviewed" ? "Geprüft" : s === "dismissed" ? "Verworfen" : "Alle"}
            </Link>
          ))}
        </nav>
      </header>

      {reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
          Keine Reports in dieser Ansicht.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-border bg-background p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-0.5 font-medium uppercase tracking-wide">
                      {r.status}
                    </span>
                    <span>{new Date(r.created_at).toLocaleString("de-AT")}</span>
                    {r.reporter_handle && (
                      <Link
                        href={`/u/${r.reporter_handle}`}
                        className="hover:text-foreground"
                      >
                        gemeldet von @{r.reporter_handle}
                      </Link>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium">
                    Grund: {reasonLabel(r.reason)}
                  </p>
                  {r.notes && (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                      &bdquo;{r.notes}&ldquo;
                    </p>
                  )}

                  {r.pin ? (
                    <Link
                      href={`/pin/${r.pin.id}`}
                      className="mt-3 inline-flex flex-col gap-0.5 rounded-lg border border-border bg-muted/40 p-3 hover:bg-muted"
                    >
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        Pin {r.pin.is_hidden ? "(verborgen)" : ""}
                      </span>
                      <span className="font-medium">{r.pin.title}</span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {r.pin.body}
                      </span>
                      {r.pin.author_handle && (
                        <span className="text-xs text-muted-foreground">
                          von @{r.pin.author_handle}
                        </span>
                      )}
                    </Link>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Pin nicht mehr verfügbar.
                    </p>
                  )}
                </div>

                {r.pin && (
                  <AdminRowActions
                    reportId={r.id}
                    pinId={r.pin.id}
                    pinHidden={r.pin.is_hidden}
                    reportStatus={r.status}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
