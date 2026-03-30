"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  X,
  ShoppingBag,
  Trash2,
  Save,
  Import,
  User,
  Hash,
  Search,
  Flame,
} from "lucide-react";
import {
  type BasketItem,
  type BasketItemType,
  removeFromBasket,
  clearActiveBasket,
  saveBasket,
  loadBaskets,
  deleteBasket,
  type Basket,
} from "@/lib/basket";
import { useRouter } from "next/navigation";

interface BasketDrawerProps {
  open: boolean;
  onClose: () => void;
  items: BasketItem[];
  onUpdate: (items: BasketItem[]) => void;
}

const TYPE_ICONS: Record<BasketItemType, React.ReactNode> = {
  influencer: <User className="h-3.5 w-3.5" />,
  keyword: <Search className="h-3.5 w-3.5" />,
  hashtag: <Hash className="h-3.5 w-3.5" />,
  topic: <Flame className="h-3.5 w-3.5" />,
};

const TYPE_COLORS: Record<BasketItemType, string> = {
  influencer: "text-blue-400",
  keyword: "text-green-400",
  hashtag: "text-purple-400",
  topic: "text-orange-400",
};

export default function BasketDrawer({ open, onClose, items, onUpdate }: BasketDrawerProps) {
  const router = useRouter();
  const [basketName, setBasketName] = useState("");
  const [showSaved, setShowSaved] = useState(false);
  const [savedBaskets, setSavedBaskets] = useState<Basket[]>([]);

  if (!open) return null;

  const grouped = items.reduce<Record<BasketItemType, BasketItem[]>>(
    (acc, item) => {
      acc[item.type] = acc[item.type] || [];
      acc[item.type].push(item);
      return acc;
    },
    {} as Record<BasketItemType, BasketItem[]>
  );

  const handleRemove = (id: string) => {
    onUpdate(removeFromBasket(id));
  };

  const handleClear = () => {
    onUpdate(clearActiveBasket());
  };

  const handleSave = () => {
    if (!basketName.trim() || items.length === 0) return;
    saveBasket(basketName.trim());
    setBasketName("");
    onUpdate([]);
  };

  const handleShowSaved = () => {
    setSavedBaskets(loadBaskets());
    setShowSaved(!showSaved);
  };

  const handleDeleteSaved = (id: string) => {
    const updated = deleteBasket(id);
    setSavedBaskets(updated);
  };

  const handleImportToBasket = (basket: Basket) => {
    router.push(`/campaigns/new?basket=${basket.id}`);
    onClose();
  };

  const typeOrder: BasketItemType[] = ["influencer", "keyword", "hashtag", "topic"];
  const typeLabels: Record<BasketItemType, string> = {
    influencer: "Influencers",
    keyword: "Keywords",
    hashtag: "Hashtags",
    topic: "Topics",
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-96 max-w-[90vw] bg-background border-l z-50 flex flex-col shadow-2xl animate-in slide-in-from-right-5 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg">Basket</h2>
            <Badge variant="secondary" className="text-xs">{items.length}</Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {items.length === 0 && !showSaved ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Your basket is empty.</p>
              <p className="text-xs mt-1">Add items from the dashboard sections below.</p>
            </div>
          ) : (
            <>
              {typeOrder.map((type) => {
                const typeItems = grouped[type];
                if (!typeItems || typeItems.length === 0) return null;
                return (
                  <div key={type}>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${TYPE_COLORS[type]}`}>
                      {typeLabels[type]} ({typeItems.length})
                    </p>
                    <div className="space-y-1">
                      {typeItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/50 group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={TYPE_COLORS[item.type]}>{TYPE_ICONS[item.type]}</span>
                            <span className="text-sm truncate">{item.label}</span>
                          </div>
                          <button
                            onClick={() => handleRemove(item.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Saved Baskets */}
          {showSaved && (
            <div className="border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-muted-foreground">Saved Baskets</p>
              {savedBaskets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved baskets yet.</p>
              ) : (
                <div className="space-y-2">
                  {savedBaskets.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{b.name}</p>
                        <p className="text-xs text-muted-foreground">{b.items.length} items</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Import to campaign"
                          onClick={() => handleImportToBasket(b)}
                        >
                          <Import className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          title="Delete basket"
                          onClick={() => handleDeleteSaved(b.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 space-y-3">
          {items.length > 0 && (
            <>
              <div className="flex gap-2">
                <Input
                  placeholder="Basket name..."
                  value={basketName}
                  onChange={(e) => setBasketName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  className="text-sm"
                />
                <Button size="sm" onClick={handleSave} disabled={!basketName.trim()}>
                  <Save className="h-3.5 w-3.5 mr-1" />
                  Save
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={handleClear}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear All
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" className="w-full" onClick={handleShowSaved}>
            <ShoppingBag className="h-3.5 w-3.5 mr-1" />
            {showSaved ? "Hide" : "View"} Saved Baskets
          </Button>
        </div>
      </div>
    </>
  );
}
