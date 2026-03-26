"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Key, Shield } from "lucide-react";
import { toast } from "sonner";

interface Credential {
  id: string;
  serviceType: string;
  provider: string;
  label: string;
  isPlatform: boolean;
  isActive: boolean;
  createdAt: string;
}

const SERVICE_TYPES = [
  { value: "llm", label: "LLM" },
  { value: "n8n", label: "n8n" },
  { value: "apify", label: "Apify" },
  { value: "twenty", label: "Twenty CRM" },
  { value: "custom", label: "Custom" },
];

const PROVIDERS_BY_SERVICE: Record<string, { value: string; label: string }[]> = {
  llm: [
    { value: "anthropic", label: "Anthropic" },
    { value: "openai", label: "OpenAI" },
    { value: "gemini", label: "Gemini" },
  ],
  n8n: [{ value: "n8n", label: "n8n" }],
  apify: [{ value: "apify", label: "Apify" }],
  twenty: [{ value: "twenty", label: "Twenty CRM" }],
  custom: [{ value: "custom", label: "Custom" }],
};

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [platformCredentials, setPlatformCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCred, setEditingCred] = useState<Credential | null>(null);

  // Form state
  const [serviceType, setServiceType] = useState("llm");
  const [provider, setProvider] = useState("openai");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/credentials");
    if (res.ok) {
      const data = await res.json();
      setCredentials(data.credentials);
      setPlatformCredentials(data.platformCredentials);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setServiceType("llm");
    setProvider("openai");
    setLabel("");
    setValue("");
    setEditingCred(null);
  };

  const openAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (cred: Credential) => {
    setEditingCred(cred);
    setServiceType(cred.serviceType);
    setProvider(cred.provider);
    setLabel(cred.label);
    setValue("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingCred) {
        const body: Record<string, unknown> = { label };
        if (value) body.value = value;
        const res = await fetch(`/api/credentials/${editingCred.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success("Credential updated");
      } else {
        if (!value) {
          toast.error("API key is required");
          setSaving(false);
          return;
        }
        const res = await fetch("/api/credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceType, provider, label, value }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success("Credential added");
      }
      setDialogOpen(false);
      resetForm();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/credentials/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Credential deleted");
      await load();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to delete");
    }
  };

  const handleToggle = async (cred: Credential) => {
    const res = await fetch(`/api/credentials/${cred.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !cred.isActive }),
    });
    if (res.ok) {
      await load();
    }
  };

  const allCreds = [
    ...platformCredentials.map((c) => ({ ...c, source: "platform" as const })),
    ...credentials.map((c) => ({ ...c, source: c.isPlatform ? "platform" as const : "user" as const })),
  ];

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-muted-foreground">
        Loading credentials...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight">Credentials</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage API keys for LLM providers and integrations
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Credential
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Your credentials and platform keys available with your plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allCreds.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p>No credentials yet. Add one to start using LLM features.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allCreds.map((cred) => (
                  <TableRow key={cred.id}>
                    <TableCell className="font-medium capitalize">
                      {cred.provider}
                    </TableCell>
                    <TableCell>{cred.label}</TableCell>
                    <TableCell>
                      {cred.source === "platform" ? (
                        <Badge variant="secondary">
                          <Shield className="h-3 w-3 mr-1" />
                          Platform
                        </Badge>
                      ) : (
                        <Badge variant="outline">{cred.serviceType}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={cred.isActive ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => cred.source !== "platform" && handleToggle(cred)}
                      >
                        {cred.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {cred.source !== "platform" && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(cred)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(cred.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCred ? "Edit Credential" : "Add Credential"}
            </DialogTitle>
            <DialogDescription>
              {editingCred
                ? "Update label or replace the API key."
                : "Add a new API key for an integration."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!editingCred && (
              <>
                <div className="space-y-2">
                  <Label>Service Type</Label>
                  <Select
                    value={serviceType}
                    onValueChange={(v) => {
                      if (!v) return;
                      setServiceType(v);
                      const providers = PROVIDERS_BY_SERVICE[v];
                      if (providers?.length) setProvider(providers[0].value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPES.map((st) => (
                        <SelectItem key={st.value} value={st.value}>
                          {st.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={provider} onValueChange={(v) => v && setProvider(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(PROVIDERS_BY_SERVICE[serviceType] || []).map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                placeholder="e.g. My OpenAI key"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>
                {editingCred ? "New API Key (leave blank to keep current)" : "API Key"}
              </Label>
              <Input
                type="password"
                placeholder={editingCred ? "Enter new key to update" : "sk-..."}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || (!editingCred && !value)}>
              {saving ? "Saving..." : editingCred ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
