"use client";

import React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";

interface EntityDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  entityType: string;
  entityName: string;
  loading: boolean;
  error?: string | null;
}

export function EntityDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  entityType,
  entityName,
  loading,
  error,
}: EntityDeleteModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      title={`Delete ${entityType}`}
      maxWidth="md"
    >
      <div className="space-y-4 pt-1">
        <div className="flex items-start gap-3 bg-red-950/20 border border-red-500/20 rounded-xl p-3.5 text-slate-300">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-medium text-red-200">
              Are you sure you want to delete this {entityType.toLowerCase()}?
            </p>
            <p className="text-slate-400">
              <span className="font-semibold text-white">&ldquo;{entityName}&rdquo;</span> will be permanently removed or deactivated.
            </p>
            <p className="text-slate-400">
              If this entity has active dependent records (departments, branches, batches, sections, groups, enrollments, or attendance logs), deletion will be safely rejected by the system.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-500/30 rounded-lg p-3 text-xs text-red-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold">Action Blocked:</span>
              <p>{error}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                Confirm Delete
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
