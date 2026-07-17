"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { clientFormSchema, type ClientFormValues } from "@/server/domain/client-schema";
import { useCreateClient } from "@/hooks/use-clients";
import { ClientFormFields } from "@/components/clients/client-form-fields";
import { Button } from "@/components/ui/button";

export function CreateClientForm() {
  const router = useRouter();
  const createClient = useCreateClient();

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: "",
      displayName: "",
      brandType: "PERSONAL_BRAND",
      primaryMarket: "",
      defaultLanguage: "en",
      timeZone: "UTC",
      shortDescription: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    createClient.mutate(values, {
      onSuccess: ({ clientId }) => {
        toast.success(`${values.displayName} created.`);
        router.push(`/c/${clientId}/sources/upload`);
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Failed to create client.");
      },
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <ClientFormFields form={form} includeName />
      <Button type="submit" disabled={createClient.isPending} className="self-start">
        {createClient.isPending ? "Creating…" : "Create client"}
      </Button>
    </form>
  );
}
