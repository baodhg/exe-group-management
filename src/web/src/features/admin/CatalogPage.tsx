import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "../../shared/auth/useAuth";
import { errorText } from "../common/messages";
import type { CatalogItem } from "../common/types";
import { CheckItem, Checks, EmptyState, Failure, Field, PageHeader, Pager, SearchField, Section, Toolbar } from "../common/ui";
import { MajorTag } from "../rooms/seats";
import { ClearFilters, DeleteDialog, FormDialog, PageFailure, TableSkeleton } from "./CatalogFrame";
import { badCodeText, catalogCodeChecks, errorCodeOf, isAccessFailure, isNotFound, normalizeCode } from "./catalogRules";
import type { CatalogConfig } from "./catalogs";
import { useClampedPage } from "./useClampedPage";

type Open = { kind: "add" } | { kind: "edit"; item: CatalogItem } | { kind: "delete"; item: CatalogItem } | null;

const heads = ["Mã", "Tên", "Thao tác"];

export function CatalogPage({ config }: { config: CatalogConfig }) {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Open>(null);
  const path = `/api/v1/${config.resource}`;

  const items = useQuery({
    queryKey: [config.resource, search, page],
    queryFn: () => api.get<CatalogItem[]>(path, { search, page, pageSize: 20, sort: "code" }),
    placeholderData: keepPreviousData,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: [config.resource] });
  const rows = items.data?.data ?? [];
  const pagination = items.data?.pagination;
  const filtered = search.trim() !== "";
  useClampedPage(pagination, page, setPage);

  const header = <PageHeader crumbs={[{ label: "Dữ liệu nền" }, { label: config.title }]} title={config.title} description={config.description} />;

  if (isAccessFailure(items.error)) {
    return (
      <div className="space-y-4">
        {header}
        <PageFailure error={items.error} title={`Không mở được trang ${config.title.toLocaleLowerCase("vi-VN")}`} backTo="/admin" backLabel="Về tổng quan" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}

      <Section flush title={config.listTitle} icon={config.icon}>
        <Toolbar
          actions={
            <Button onClick={() => setOpen({ kind: "add" })}>
              <Plus aria-hidden />
              Thêm
            </Button>
          }
        >
          <SearchField
            value={search}
            placeholder="Tìm theo mã hoặc tên"
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
        </Toolbar>
        {items.isLoading && <TableSkeleton heads={heads} />}
        {items.isError && <Failure error={items.error} title={`Không tải được ${config.listTitle.toLocaleLowerCase("vi-VN")}`} onRetry={() => void items.refetch()} />}
        {items.isSuccess && rows.length === 0 && (
          <EmptyState
            icon={Inbox}
            title={filtered ? "Không có kết quả" : `Chưa có ${config.unit} nào`}
            action={
              filtered ? (
                <ClearFilters
                  onClear={() => {
                    setSearch("");
                    setPage(1);
                  }}
                />
              ) : undefined
            }
          />
        )}
        {!items.isError && rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead className="w-px text-right whitespace-nowrap">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-semibold">{config.resource === "majors" ? <MajorTag code={item.code} /> : item.code}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label={`Sửa ${item.code}`} onClick={() => setOpen({ kind: "edit", item })}>
                        <Pencil aria-hidden />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Xoá ${item.code}`} onClick={() => setOpen({ kind: "delete", item })}>
                        <Trash2 aria-hidden />
                      </Button>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!items.isError && <Pager pagination={pagination} page={page} onPage={setPage} unit={config.unit} />}
      </Section>

      {open?.kind === "add" && <CatalogForm key="add" config={config} path={path} onClose={() => setOpen(null)} onSaved={refresh} />}
      {open?.kind === "edit" && <CatalogForm key={open.item.id} config={config} path={path} item={open.item} onClose={() => setOpen(null)} onSaved={refresh} />}
      {open?.kind === "delete" && (
        <DeleteDialog
          key={open.item.id}
          title={`Xoá ${config.unit} ${open.item.code}?`}
          criteria={config.blockers.map((value) => ({ label: "Không xoá được nếu còn", value }))}
          successText={`Đã xoá ${config.unit} ${open.item.code}`}
          run={() => api.delete(`${path}/${open.item.id}`)}
          onDone={refresh}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function CatalogForm({ config, path, item, onClose, onSaved }: { config: CatalogConfig; path: string; item?: CatalogItem; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const { api } = useAuth();
  const [draft, setDraft] = useState({ code: item?.code ?? "", name: item?.name ?? "" });
  const [taken, setTaken] = useState<{ code: string; text: string } | null>(null);
  const [note, setNote] = useState<unknown>(null);
  const checks = catalogCodeChecks(draft.code, config.codeMax);
  const code = normalizeCode(draft.code);
  const name = draft.name.trim();
  const isTaken = taken?.code === code;
  const nameTooLong = draft.name.length > config.nameMax;
  const codeError = isTaken ? taken?.text : checks.patternBad ? badCodeText : undefined;

  const save = useMutation({
    mutationFn: () => (item ? api.put(`${path}/${item.id}`, { code, name }) : api.post(path, { code, name })),
    onSuccess: async () => {
      toast.success(item ? "Đã lưu" : `Đã thêm ${config.unit} ${code}`);
      onClose();
      await onSaved();
    },
    onError: async (error) => {
      if (errorCodeOf(error) === config.takenCode) {
        setTaken({ code, text: errorText(error) });
        setNote(null);
        return;
      }

      if (isNotFound(error)) {
        toast.error(errorText(error));
        onClose();
        await onSaved();
        return;
      }

      setNote(error);
    },
  });

  const change = (patch: Partial<typeof draft>) => {
    setDraft({ ...draft, ...patch });
    setNote(null);
  };

  return (
    <FormDialog
      title={item ? `Sửa ${config.unit} ${item.code}` : `Thêm ${config.unit}`}
      canSubmit={checks.usable && !isTaken && name !== "" && !nameTooLong}
      pending={save.isPending}
      note={note}
      onClose={onClose}
      onSubmit={() => save.mutate()}
    >
      <Field label="Mã" error={codeError} counter={{ value: draft.code.trim().length, max: config.codeMax }}>
        <Input aria-required="true" aria-invalid={codeError !== undefined || !checks.shortEnough} placeholder={config.codeHint} value={draft.code} onChange={(event) => change({ code: event.target.value })} />
      </Field>
      <Checks single>
        <CheckItem ok={checks.startsWell} label="Bắt đầu bằng chữ hoặc số" value={checks.startsWell ? "Đạt" : "Chưa đạt"} />
        <CheckItem ok={code !== "" && checks.onlyAllowed} label="Chỉ gồm chữ, số, dấu chấm, gạch dưới, gạch ngang" value={code !== "" && checks.onlyAllowed ? "Đạt" : "Chưa đạt"} />
        <CheckItem ok={code !== "" && checks.shortEnough} label={`Tối đa ${config.codeMax} ký tự`} value={code !== "" && checks.shortEnough ? "Đạt" : "Chưa đạt"} />
      </Checks>
      <Field label="Tên" counter={{ value: draft.name.length, max: config.nameMax }}>
        <Input aria-required="true" value={draft.name} onChange={(event) => change({ name: event.target.value })} />
      </Field>
    </FormDialog>
  );
}
