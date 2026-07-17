"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Archive } from "lucide-react";

import { useArchiveClient } from "@/hooks/use-clients";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function ArchiveClientDialog({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [open, setOpen] = useState(false);
  const archiveClient = useArchiveClient();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem variant="destructive" onSelect={(event) => event.preventDefault()}>
          <Archive />
          Archive client
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive {clientName}?</DialogTitle>
          <DialogDescription>
            The workspace, its sources, and its Client Brain are preserved and can still be viewed —
            archiving only removes it from active workflows. This does not delete anything.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={archiveClient.isPending}
            onClick={() =>
              archiveClient.mutate(clientId, {
                onSuccess: () => {
                  toast.success(`${clientName} archived.`);
                  setOpen(false);
                },
                onError: (error) => {
                  toast.error(error instanceof Error ? error.message : "Failed to archive client.");
                },
              })
            }
          >
            {archiveClient.isPending ? "Archiving…" : "Archive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
