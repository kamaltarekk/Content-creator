"use client";

import Link from "next/link";
import { MoreHorizontal, ArrowUpRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import type { BrandType, ClientStatus } from "@prisma/client";
import { BRAND_TYPE_OPTIONS } from "@/server/domain/client-schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditClientDialog } from "@/components/clients/edit-client-dialog";
import { ArchiveClientDialog } from "@/components/clients/archive-client-dialog";

export type ClientRow = {
  id: string;
  name: string;
  displayName: string;
  brandType: BrandType;
  primaryMarket: string | null;
  defaultLanguage: string;
  timeZone: string;
  shortDescription: string | null;
  status: ClientStatus;
  updatedAt: Date;
  sourceCount: number;
  teamMemberCount: number;
  pendingReviews: number;
  completenessPercent: number | null;
};

function brandTypeLabel(brandType: BrandType) {
  return BRAND_TYPE_OPTIONS.find((option) => option.value === brandType)?.label ?? brandType;
}

export function ClientsTable({ clients }: { clients: ClientRow[] }) {
  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
        <p className="text-sm font-medium text-foreground">No clients yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Create your first client workspace to start uploading strategic sources.
        </p>
        <Button asChild className="mt-2">
          <Link href="/clients/new">Create New Client</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last updated</TableHead>
            <TableHead>Sources</TableHead>
            <TableHead>Pending reviews</TableHead>
            <TableHead>Completeness</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id}>
              <TableCell>
                <Link href={`/c/${client.id}`} className="group flex items-center gap-1.5">
                  <span className="font-medium text-foreground group-hover:underline">
                    {client.displayName}
                  </span>
                  <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{brandTypeLabel(client.brandType)}</TableCell>
              <TableCell>
                <Badge variant={client.status === "ACTIVE" ? "success" : "muted"}>
                  {client.status === "ACTIVE" ? "Active" : "Archived"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(client.updatedAt, { addSuffix: true })}
              </TableCell>
              <TableCell>{client.sourceCount}</TableCell>
              <TableCell>
                {client.pendingReviews > 0 ? (
                  <Badge variant="warning">{client.pendingReviews}</Badge>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {client.completenessPercent === null ? "—" : `${client.completenessPercent}%`}
              </TableCell>
              <TableCell className="text-muted-foreground">{client.teamMemberCount}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Actions for ${client.displayName}`}>
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/c/${client.id}`}>Open workspace</Link>
                    </DropdownMenuItem>
                    <EditClientDialog
                      clientId={client.id}
                      initialValues={{
                        name: client.name,
                        displayName: client.displayName,
                        brandType: client.brandType,
                        primaryMarket: client.primaryMarket ?? "",
                        defaultLanguage: client.defaultLanguage,
                        timeZone: client.timeZone,
                        shortDescription: client.shortDescription ?? "",
                      }}
                    />
                    {client.status === "ACTIVE" && (
                      <ArchiveClientDialog clientId={client.id} clientName={client.displayName} />
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
