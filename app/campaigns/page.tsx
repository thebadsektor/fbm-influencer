import Link from "next/link";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Megaphone, FileText, Hash, Users } from "lucide-react";
import { getRequiredUser } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const user = await getRequiredUser();

  const campaigns = await prisma.campaign.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { khSets: true, documents: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight">Campaigns</h1>
          <p className="text-xl text-muted-foreground mt-1">
            Manage your influencer scouting campaigns
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button size="lg">
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Megaphone className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight mb-2">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Create your first campaign to start scouting influencers.
            </p>
            <Link href="/campaigns/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <Link key={c.id} href={`/campaigns/${c.id}`}>
              <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="scroll-m-20 text-xl font-semibold tracking-tight truncate">
                      {c.name}
                    </CardTitle>
                    <Badge variant={c.status === "active" ? "default" : "secondary"}>
                      {c.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-sm text-muted-foreground">
                    {c.brandNiche} &middot; {c.marketingGoal}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {c._count.documents}
                    </span>
                    <span className="flex items-center gap-1">
                      <Hash className="h-3.5 w-3.5" />
                      {c._count.khSets}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {c.minFollowers}+
                    </span>
                  </div>
                  <p className="text-sm leading-none font-medium text-muted-foreground/60 mt-3">
                    {new Date(c.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
