"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { clientFormSchema, type ClientFormValues } from "@/server/domain/client-schema";
import { useUpdateClient } from "@/hooks/use-clients";
import { ClientFormFields } from "@/components/clients/client-form-fields";
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
import {
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function EditClientDialog({
  clientId,
  initialValues,
}: {
  clientId: string;
  initialValues: Omit<ClientFormValues, "name"> & { name: string };
}) {
  const [open, setOpen] = useState(false);
  const updateClient = useUpdateClient(clientId);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: initialValues,
  });

  const onSubmit = form.handleSubmit((values) => {
    updateClient.mutate(
      {
        displayName: values.displayName,
        brandType: values.brandType,
        primaryMarket: values.primaryMarket,
        defaultLanguage: values.defaultLanguage,
        timeZone: values.timeZone,
        shortDescription: values.shortDescription,
      },
      {
        onSuccess: () => {
          toast.success("Client updated.");
          setOpen(false);
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Failed to update client.");
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
          <Pencil />
          Edit client
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {initialValues.displayName}</DialogTitle>
          <DialogDescription>Update this client&apos;s workspace metadata.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <ClientFormFields form={form} includeName={false} />
          <DialogFooter>
            <Button type="submit" disabled={updateClient.isPending}>
              {updateClient.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
