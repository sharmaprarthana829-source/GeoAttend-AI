"use client";

import React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export default function DeleteConfirm({ isOpen, onClose, onConfirm, name, title }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; name?: string; title?: string }) {
  const modalTitle = title ?? "Delete item";
  const descName = name ?? "this item";
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} description={`Are you sure you want to delete ${descName}?`}>
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { onConfirm(); onClose(); }} variant="danger">Delete</Button>
      </div>
    </Modal>
  );
}
