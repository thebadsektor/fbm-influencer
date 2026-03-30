"use client";

import { useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag,
  Check,
  Plus,
  ChevronDown,
  ChevronUp,
  Users,
  Search,
  Hash,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  Youtube,
} from "lucide-react";
import { INTERESTS } from "@/lib/constants-influencer";
import {
  type BasketItem,
  addToBasket,
  getActiveBasket,
} from "@/lib/basket";
import BasketDrawer from "./BasketDrawer";
import {
  MOCK_INFLUENCERS,
  MOCK_KEYWORDS,
  MOCK_HASHTAGS,
  MOCK_TOPICS,
  type MockInfluencer,
  type MockKeyword,
  type MockHashtag,
  type MockTopic,
} from "./mock-data";

const PLATFORM_ICON: Record<string, React.ReactNode> = {
  YouTube: <Youtube className="h-3.5 w-3.5 text-red-500" />,
  TikTok: <span className="text-xs">🎵</span>,
  Instagram: <span className="text-xs">📷</span>,
};

const TREND_ICON: Record<string, React.ReactNode> = {
  Rising: <TrendingUp className="h-3.5 w-3.5 text-green-500" />,
  Stable: <Minus className="h-3.5 w-3.5 text-muted-foreground" />,
  Declining: <TrendingDown className="h-3.5 w-3.5 text-red-500" />,
};

const COMP_COLOR: Record<string, string> = {
  Low: "text-green-500",
  Medium: "text-yellow-500",
  High: "text-red-500",
};

export default function Dashboard() {
  const [category, setCategory] = useState<string>("All");
  const [basketItems, setBasketItems] = useState<BasketItem[]>(() => getActiveBasket());
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Expanded state per section
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  const isInBasket = useCallback(
    (id: string) => basketItems.some((i) => i.id === id),
    [basketItems]
  );

  const handleAdd = (item: BasketItem) => {
    const updated = addToBasket(item);
    setBasketItems(updated);
  };

  // Filtering
  const filterByCategory = <T extends { categories: string[] }>(items: T[]) =>
    category === "All" ? items : items.filter((i) => i.categories.includes(category));

  const influencers = filterByCategory(MOCK_INFLUENCERS);
  const keywords = filterByCategory(MOCK_KEYWORDS);
  const hashtags = filterByCategory(MOCK_HASHTAGS);
  const topics = filterByCategory(MOCK_TOPICS);

  const DEFAULT_SHOW = 5;

  function AddButton({ id, item }: { id: string; item: BasketItem }) {
    const inBasket = isInBasket(id);
    return (
      <Button
        variant={inBasket ? "secondary" : "ghost"}
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={(e) => { e.stopPropagation(); if (!inBasket) handleAdd(item); }}
        disabled={inBasket}
      >
        {inBasket ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Plus className="h-3.5 w-3.5" />}
      </Button>
    );
  }

  function SectionHeader({ title, icon, count, sectionKey }: { title: string; icon: React.ReactNode; count: number; sectionKey: string }) {
    const isExpanded = expanded[sectionKey];
    return (
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            {icon}
            {title}
            <Badge variant="secondary" className="text-xs font-normal">{count}</Badge>
          </CardTitle>
          {count > DEFAULT_SHOW && (
            <Button variant="ghost" size="sm" onClick={() => toggle(sectionKey)} className="text-xs">
              {isExpanded ? (
                <><ChevronUp className="h-3.5 w-3.5 mr-1" /> Show Less</>
              ) : (
                <><ChevronDown className="h-3.5 w-3.5 mr-1" /> See All</>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
    );
  }

  function sliced<T>(items: T[], key: string) {
    return expanded[key] ? items : items.slice(0, DEFAULT_SHOW);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">Discovery Dashboard</h1>
        <p className="text-muted-foreground mt-1">Explore trending creators, keywords, and topics across categories.</p>
      </div>

      {/* Category Filter Bar */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        <button
          onClick={() => setCategory("All")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all whitespace-nowrap shrink-0 ${
            category === "All"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border hover:border-primary/50"
          }`}
        >
          All
        </button>
        {INTERESTS.map((interest) => (
          <button
            key={interest}
            onClick={() => setCategory(category === interest ? "All" : interest)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all whitespace-nowrap shrink-0 ${
              category === interest
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:border-primary/50"
            }`}
          >
            {interest}
          </button>
        ))}
      </div>

      {/* Top Influencers */}
      <Card>
        <SectionHeader title="Top Influencers" icon={<Users className="h-5 w-5 text-blue-500" />} count={influencers.length} sectionKey="influencers" />
        <CardContent className="pt-0">
          {influencers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No influencers in this category yet.</p>
          ) : (
            <div className="space-y-2">
              {sliced(influencers, "influencers").map((inf: MockInfluencer) => (
                <div key={inf.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                    {inf.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{inf.name}</span>
                      {PLATFORM_ICON[inf.platform]}
                    </div>
                    <span className="text-xs text-muted-foreground">{inf.handle}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">{inf.followers}</p>
                    <p className="text-xs text-green-500">{inf.engagementRate} ER</p>
                  </div>
                  <AddButton
                    id={inf.id}
                    item={{ id: inf.id, type: "influencer", label: `${inf.name} (${inf.handle})`, data: inf as unknown as Record<string, unknown> }}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Keywords */}
      <Card>
        <SectionHeader title="Top Keywords" icon={<Search className="h-5 w-5 text-green-500" />} count={keywords.length} sectionKey="keywords" />
        <CardContent className="pt-0">
          {keywords.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No keywords in this category yet.</p>
          ) : (
            <div className="space-y-2">
              {sliced(keywords, "keywords").map((kw: MockKeyword) => (
                <div key={kw.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">{kw.keyword}</span>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground shrink-0">{kw.searchVolume}</span>
                  <span className={`text-xs font-medium shrink-0 ${COMP_COLOR[kw.competition]}`}>{kw.competition}</span>
                  {TREND_ICON[kw.trend]}
                  <AddButton
                    id={kw.id}
                    item={{ id: kw.id, type: "keyword", label: kw.keyword, data: kw as unknown as Record<string, unknown> }}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Hashtags */}
      <Card>
        <SectionHeader title="Top Hashtags" icon={<Hash className="h-5 w-5 text-purple-500" />} count={hashtags.length} sectionKey="hashtags" />
        <CardContent className="pt-0">
          {hashtags.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No hashtags in this category yet.</p>
          ) : (
            <div className="space-y-2">
              {sliced(hashtags, "hashtags").map((ht: MockHashtag) => (
                <div key={ht.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <Hash className="h-4 w-4 text-purple-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">{ht.hashtag}</span>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground shrink-0">{ht.postCount} posts</span>
                  <span className="text-xs font-medium text-green-500 shrink-0">{ht.growth}</span>
                  <AddButton
                    id={ht.id}
                    item={{ id: ht.id, type: "hashtag", label: ht.hashtag, data: ht as unknown as Record<string, unknown> }}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trending Topics */}
      <Card>
        <SectionHeader title="Trending Topics" icon={<Flame className="h-5 w-5 text-orange-500" />} count={topics.length} sectionKey="topics" />
        <CardContent className="pt-0">
          {topics.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No topics in this category yet.</p>
          ) : (
            <div className="space-y-2">
              {sliced(topics, "topics").map((tp: MockTopic) => (
                <div key={tp.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="shrink-0">
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        background: `conic-gradient(hsl(${tp.heatScore * 1.2}, 80%, 50%) ${tp.heatScore}%, transparent 0)`,
                        color: tp.heatScore > 85 ? "#ef4444" : tp.heatScore > 70 ? "#f59e0b" : "#6b7280",
                      }}
                    >
                      {tp.heatScore}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{tp.topic}</p>
                    <p className="text-xs text-muted-foreground truncate">{tp.description}</p>
                  </div>
                  <AddButton
                    id={tp.id}
                    item={{ id: tp.id, type: "topic", label: tp.topic, data: tp as unknown as Record<string, unknown> }}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Basket FAB */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="fixed bottom-6 right-6 z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center"
      >
        <ShoppingBag className="h-6 w-6" />
        {basketItems.length > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
            {basketItems.length}
          </span>
        )}
      </button>

      {/* Basket Drawer */}
      <BasketDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={basketItems}
        onUpdate={setBasketItems}
      />
    </div>
  );
}
