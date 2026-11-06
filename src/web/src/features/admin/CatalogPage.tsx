import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Inbox, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "../../shared/auth/useAuth";
import { useDialogs } from "../common/dialogsContext";
import { errorText } from "../common/messages";
import type { CatalogItem } from "../common/types";
import { EmptyState, ErrorNote, Field, Loading, PageHeader, Pager, SearchField, Section, Toolbar } from "../common/ui";
import { MajorTag } from "../rooms/seats";
import type { CatalogConfig } from "./catalogs";

export function CatalogPage({ config }: { config: CatalogConfig }) {
  const { api } = useAuth();
  const { confirm } = useDialogs();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const path = `/api/v1/${config.resource}`;

  const items = useQuery({
    queryKey: [config.resource, search, page],
    queryFn: () => api.get<CatalogItem[]>(path, { search, page, pageSize: 20, sort: "code" }),
    placeholderData: keepPreviousData,
  });
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: [config.resource] }), queryClient.invalidateQueries({ queryKey: ["majors", "palette"] })]);

  const create = useMutation({
    mutationFn: () => api.post(path, { code: code.trim(), name: name.trim() }),
    onSuccess: async () => {
      toast.success(`Đã thêm ${config.unit} ${code.trim()}`);
      setCode("");
      setName("");
      await refresh();
    },
    onError: (error) => toast.error(errorText(error)),
  });
  const update = useMutation({
    mutationFn: (item: CatalogItem) => api.put(`${path}/${item.id}`, { code: item.code.trim(), name: item.name.trim() }),
    onSuccess: async () => {
      toast.success("Đã lưu");
      setEditing(null);
      await refresh();
    },
    onError: (error) => toast.error(errorText(error)),
  });
  const remove = useMutation({
    mutationFn: (item: CatalogItem) => api.delete(`${path}/${item.id}`).then(() => item),
    onSuccess: async (item) => {
      toast.success(`Đã xóa ${config.unit} ${item.code}`);
      await refresh();
    },
    onError: (error) => toast.error(errorText(error)),
  });
  const rows = items.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader crumbs={[{ label: "Dữ liệu nền" }, { label: config.title }]} title={config.title} description={config.description} />

      <Section title={`Thêm ${config.unit}`}>
        <form
          className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <Field label="Mã">
            <Input required className="h-9" placeholder={config.codeHint} value={code} onChange={(event) => setCode(event.target.value)} />
          </Field>
          <Field label="Tên">
            <Input required className="h-9" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Button type="submit" className="h-9" disabled={create.isPending}>
            <Plus />
            Thêm
          </Button>
        </form>
      </Section>

      <Section>
        <Toolbar>
          <SearchField
            value={search}
            placeholder="Tìm theo mã hoặc tên"
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
        </Toolbar>
        <ErrorNote error={items.error} />
        <Loading when={items.isLoading} rows={5} />
        {items.isSuccess && rows.length === 0 && <EmptyState icon={Inbox} title={search ? "Không có kết quả" : `Chưa có ${config.unit} nào`} />}
        {rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Mã</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead className="w-24 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) =>
                editing?.id === item.id ? (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Input className="h-8" value={editing.code} onChange={(event) => setEditing({ ...editing, code: event.target.value })} aria-label="Mã mới" />
                    </TableCell>
                    <TableCell>
                      <Input className="h-8" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} aria-label="Tên mới" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" aria-label="Lưu" disabled={update.isPending} onClick={() => update.mutate(editing)}>
                        <Check />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Thôi" onClick={() => setEditing(null)}>
                        <X />
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{config.resource === "majors" ? <MajorTag majorId={item.id} code={item.code} /> : item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" aria-label={`Sửa ${item.code}`} onClick={() => setEditing(item)}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Xóa ${item.code}`}
                        disabled={remove.isPending}
                        onClick={async () => {
                          if (await confirm({ title: `Xóa ${config.unit} ${item.code}?`, description: "Không xóa được nếu đang được dùng.", confirmLabel: "Xóa", destructive: true })) {
                            remove.mutate(item);
                          }
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        )}
        <Pager pagination={items.data?.pagination} page={page} onPage={setPage} unit={config.unit} />
      </Section>
    </div>
  );
}
