"use client";

import React, { useEffect, useState } from "react";
import { listSections, deleteSection, Section } from "@/lib/sections";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import AddEditSectionModal from "./AddEditSectionModal";
import DeleteConfirm from "@/components/admin/students/DeleteConfirm";

export default function SectionTable() {
  const [items, setItems] = useState<Section[]>([]);
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<Section | null>(null);
  const [deleteItem, setDeleteItem] = useState<Section | null>(null);

  useEffect(() => {
    setLoading(true);
    listSections({ page, per_page: perPage, q: query }).then((res) => {
      setItems(res.data);
      setTotal(res.total);
    }).finally(() => setLoading(false));
  }, [page, perPage, query]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sections..." />
          <Button variant="outline" onClick={() => { setQuery(""); setPage(1); }}>Clear</Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline">Import CSV</Button>
          <Button variant="outline">Export CSV</Button>
          <Button onClick={() => setPage(1)}>Refresh</Button>
          <Button onClick={() => setShowAdd(true)}>Add Section</Button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm table-auto">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-800/60 sticky top-0 z-10 bg-surface-900/90 backdrop-blur-md">
              <th className="py-3 pr-4">Section Name</th>
              <th className="py-3 pr-4">Batch ID</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading && (
              <tr>
                <td colSpan={4} className="py-8">
                  <div className="h-2 w-full bg-slate-800/40 rounded animate-pulse" />
                </td>
              </tr>
            )}

            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={4} className="py-12 text-center text-slate-400">No sections found.</td>
              </tr>
            )}

            {items.map((d) => (
              <tr key={d.id} className="hover:bg-surface-800/40 transition-colors">
                <td className="py-3 pr-4 font-semibold text-white">Section {d.name}</td>
                <td className="py-3 pr-4 font-mono text-xs text-slate-300">Batch #{d.batch_id}</td>
                <td className="py-3 pr-4">{d.is_active ? "Active" : "Inactive"}</td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditItem(d)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => setDeleteItem(d)}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-400">Showing {items.length} of {total} sections</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
          <div className="text-sm">Page {page}</div>
          <Button variant="outline" onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <AddEditSectionModal isOpen={showAdd} onClose={() => setShowAdd(false)} onSave={async (d) => {
        setItems((prev) => [d, ...prev]);
        setTotal((t) => t + 1);
        setShowAdd(false);
      }} />
      <AddEditSectionModal isOpen={!!editItem} onClose={() => setEditItem(null)} onSave={async (d) => {
        setItems((prev) => prev.map((p) => (p.id === d.id ? d : p)));
        setEditItem(null);
      }} initial={editItem || undefined} />
      <DeleteConfirm isOpen={!!deleteItem} onClose={() => setDeleteItem(null)} onConfirm={async () => {
        if (!deleteItem) return;
        await deleteSection(deleteItem.id);
        setItems((prev) => prev.filter((p) => p.id !== deleteItem.id));
        setDeleteItem(null);
        setTotal((t) => Math.max(0, t - 1));
      }} name={deleteItem?.name} title="Delete section" />
    </Card>
  );
}
