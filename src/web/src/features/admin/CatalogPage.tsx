import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "../../shared/auth/useAuth";
import type { CatalogItem } from "../common/types";
import { ErrorNote, Pager } from "../common/ui";
import type { CatalogConfig } from "./catalogs";

export function CatalogPage({ config }: { config: CatalogConfig }) {
  const { api } = useAuth();
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
  const refresh = () => queryClient.invalidateQueries({ queryKey: [config.resource] });

  const create = useMutation({
    mutationFn: () => api.post(path, { code: code.trim(), name: name.trim() }),
    onSuccess: async () => {
      setCode("");
      setName("");
      await refresh();
    },
  });
  const update = useMutation({
    mutationFn: (item: CatalogItem) => api.put(`${path}/${item.id}`, { code: item.code.trim(), name: item.name.trim() }),
    onSuccess: async () => {
      setEditing(null);
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${path}/${id}`),
    onSuccess: refresh,
  });

  return (
    <section className="card">
      <h1>{config.title}</h1>
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <input required placeholder={`Mã (${config.codeHint})`} value={code} onChange={(event) => setCode(event.target.value)} aria-label="Mã" />
        <input required placeholder="Tên" value={name} onChange={(event) => setName(event.target.value)} aria-label="Tên" />
        <button type="submit" disabled={create.isPending}>
          Thêm
        </button>
      </form>
      <ErrorNote error={create.error ?? update.error ?? remove.error ?? items.error} />
      <div className="toolbar">
        <input
          placeholder="Tìm theo mã hoặc tên"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </div>
      <table>
        <thead>
          <tr>
            <th>Mã</th>
            <th>Tên</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.data?.data.map((item) =>
            editing?.id === item.id ? (
              <tr key={item.id}>
                <td>
                  <input value={editing.code} onChange={(event) => setEditing({ ...editing, code: event.target.value })} aria-label="Mã mới" />
                </td>
                <td>
                  <input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} aria-label="Tên mới" />
                </td>
                <td className="actions">
                  <button type="button" disabled={update.isPending} onClick={() => update.mutate(editing)}>
                    Lưu
                  </button>
                  <button type="button" onClick={() => setEditing(null)}>
                    Thôi
                  </button>
                </td>
              </tr>
            ) : (
              <tr key={item.id}>
                <td>{item.code}</td>
                <td>{item.name}</td>
                <td className="actions">
                  <button type="button" onClick={() => setEditing(item)}>
                    Sửa
                  </button>
                  <button
                    type="button"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(`Xóa ${config.unit} ${item.code}?`)) {
                        remove.mutate(item.id);
                      }
                    }}
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      <Pager pagination={items.data?.pagination} page={page} onPage={setPage} unit={config.unit} />
    </section>
  );
}
