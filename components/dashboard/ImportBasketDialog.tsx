"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Check, ArrowLeft, Import } from "lucide-react";
import {
  loadBaskets,
  type Basket,
  type BasketItem,
  type BasketItemType,
} from "@/lib/basket";

interface ImportBasketDialogProps {
  open: boolean;
  onClose: () => void;
  filterTypes?: BasketItemType[];
  onImport: (items: BasketItem[]) => void;
}

const TYPE_LABELS: Record<BasketItemType, string> = {
  influencer: "Influencers",
  keyword: "Keywords",
  hashtag: "Hashtags",
  topic: "Topics",
};

export default function ImportBasketDialog({
  open,
  onClose,
  filterTypes,
  onImport,
}: ImportBasketDialogProps) {
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [selectedBasket, setSelectedBasket] = useState<Basket | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setBaskets(loadBaskets());
      setSelectedBasket(null);
      setSelectedIds(new Set());
    }
  }, [open]);

  const getFilteredItems = (basket: Basket) =>
    filterTypes
      ? basket.items.filter((i) => filterTypes.includes(i.type))
      : basket.items;

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!selectedBasket) return;
    const items = getFilteredItems(selectedBasket);
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const handleImport = () => {
    if (!selectedBasket) return;
    const items = getFilteredItems(selectedBasket).filter((i) =>
      selectedIds.has(i.id)
    );
    onImport(items);
    onClose();
  };

  const handleSelectBasket = (basket: Basket) => {
    const items = getFilteredItems(basket);
    setSelectedBasket(basket);
    setSelectedIds(new Set(items.map((i) => i.id))); // select all by default
  };

  // Count relevant items per basket
  const basketsWithCounts = baskets
    .map((b) => ({ basket: b, count: getFilteredItems(b).length }))
    .filter((b) => b.count > 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Import from Basket
          </DialogTitle>
          <DialogDescription>
            {selectedBasket
              ? `Select items to import from "${selectedBasket.name}"`
              : "Choose a saved basket to import items from."}
          </DialogDescription>
        </DialogHeader>

        {!selectedBasket ? (
          // ── Basket List ──
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {basketsWithCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No saved baskets with{" "}
                {filterTypes
                  ? filterTypes.map((t) => TYPE_LABELS[t].toLowerCase()).join(" or ")
                  : "items"}
                . Go to the Dashboard to create one.
              </p>
            ) : (
              basketsWithCounts.map(({ basket, count }) => (
                <button
                  key={basket.id}
                  onClick={() => handleSelectBasket(basket)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors text-left border border-transparent hover:border-border"
                >
                  <div>
                    <p className="text-sm font-medium">{basket.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {count} {filterTypes ? filterTypes.map((t) => TYPE_LABELS[t].toLowerCase()).join("/") : "items"}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {count}
                  </Badge>
                </button>
              ))
            )}
          </div>
        ) : (
          // ── Item Selection ──
          <div className="space-y-3">
            <button
              onClick={() => {
                setSelectedBasket(null);
                setSelectedIds(new Set());
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to baskets
            </button>

            <div className="flex items-center justify-between">
              <button
                onClick={toggleAll}
                className="text-xs text-primary hover:underline"
              >
                {selectedIds.size === getFilteredItems(selectedBasket).length
                  ? "Deselect all"
                  : "Select all"}
              </button>
              <span className="text-xs text-muted-foreground">
                {selectedIds.size} selected
              </span>
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto">
              {getFilteredItems(selectedBasket).map((item) => {
                const checked = selectedIds.has(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      checked
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted/50 border border-transparent"
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                        checked
                          ? "bg-primary border-primary"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {checked && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <span className="text-sm truncate">{item.label}</span>
                    <Badge variant="outline" className="text-[10px] ml-auto shrink-0">
                      {item.type}
                    </Badge>
                  </button>
                );
              })}
            </div>

            <Button
              onClick={handleImport}
              disabled={selectedIds.size === 0}
              className="w-full"
              size="sm"
            >
              <Import className="h-4 w-4 mr-1.5" />
              Import {selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
