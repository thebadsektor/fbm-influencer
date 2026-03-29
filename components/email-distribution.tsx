"use client";

import { useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
  Eye,
  Mail,
  Globe,
  Users as UsersIcon,
  TrendingUp,
  Shield,
} from "lucide-react";
import EmailComposer from "@/components/email-composer";

/* ── Types ── */
interface Lead {
  id: string;
  creatorName: string;
  creatorHandle: string;
  platform: string;
  email: string;
  emailSource: string;
  confidence: string;
  followers: string;
  engagementRate: string;
  profileUrl: string;
  draftStatus: "pending" | "generated" | "sent";
  emailDraft: { subject: string; body: string } | null;
}

/* ── Mock data (20 records) ── */
const MOCK_LEADS: Lead[] = [
  { id: "1", creatorName: "Sarah Chen", creatorHandle: "@sarahcreates", platform: "YouTube", email: "sarah@creator.co", emailSource: "profile", confidence: "high", followers: "245K", engagementRate: "4.2%", profileUrl: "https://youtube.com/@sarahcreates", draftStatus: "generated", emailDraft: { subject: "Collaboration Opportunity — Brand Partnership", body: "<p>Hi Sarah,</p><p>We love your content on sustainable living and think there's a great fit with our brand. We'd love to explore a collaboration where you create a dedicated video featuring our eco-friendly product line.</p><p>Would you be open to a quick call this week?</p><p>Best,<br/>The Team</p>" } },
  { id: "2", creatorName: "Marcus Rivera", creatorHandle: "@marcusfitlife", platform: "TikTok", email: "marcus@fitlife.io", emailSource: "enrichment", confidence: "medium", followers: "512K", engagementRate: "6.8%", profileUrl: "https://tiktok.com/@marcusfitlife", draftStatus: "generated", emailDraft: { subject: "Partnership Proposal — Fitness Campaign", body: "<p>Hey Marcus,</p><p>Your fitness content is incredible! We're launching a new health supplement line and would love to have you as a campaign partner.</p><p>Let us know if you're interested and we'll send over the details.</p><p>Cheers,<br/>The Team</p>" } },
  { id: "3", creatorName: "Aisha Patel", creatorHandle: "@aisha.beauty", platform: "YouTube", email: "aisha@beautymail.com", emailSource: "profile", confidence: "high", followers: "189K", engagementRate: "5.1%", profileUrl: "https://youtube.com/@aisha.beauty", draftStatus: "pending", emailDraft: null },
  { id: "4", creatorName: "Jake Thompson", creatorHandle: "@jakecooks", platform: "TikTok", email: "jake@foodcreator.net", emailSource: "enrichment", confidence: "high", followers: "678K", engagementRate: "7.3%", profileUrl: "https://tiktok.com/@jakecooks", draftStatus: "generated", emailDraft: { subject: "Cooking Collab — Sponsored Recipe Series", body: "<p>Hi Jake,</p><p>We're huge fans of your recipe content! We'd love to sponsor a 3-part recipe series featuring our kitchen products.</p><p>Interested? Let's chat!</p><p>Best,<br/>The Team</p>" } },
  { id: "5", creatorName: "Luna Martinez", creatorHandle: "@lunalifestyle", platform: "YouTube", email: "luna@lifestyle.co", emailSource: "profile", confidence: "medium", followers: "320K", engagementRate: "3.9%", profileUrl: "https://youtube.com/@lunalifestyle", draftStatus: "pending", emailDraft: null },
  { id: "6", creatorName: "David Kim", creatorHandle: "@davidtech", platform: "YouTube", email: "david@techreviews.io", emailSource: "profile", confidence: "high", followers: "890K", engagementRate: "4.5%", profileUrl: "https://youtube.com/@davidtech", draftStatus: "generated", emailDraft: { subject: "Tech Review Partnership", body: "<p>Hi David,</p><p>We're launching a new smartwatch and would love for you to do an honest review. We'll send you an early unit plus compensation for the video.</p><p>Let me know!</p><p>Best,<br/>The Team</p>" } },
  { id: "7", creatorName: "Emma Wilson", creatorHandle: "@emmadiy", platform: "TikTok", email: "emma@diycraft.com", emailSource: "enrichment", confidence: "low", followers: "156K", engagementRate: "8.2%", profileUrl: "https://tiktok.com/@emmadiy", draftStatus: "pending", emailDraft: null },
  { id: "8", creatorName: "Tyler Brooks", creatorHandle: "@tyleroutdoors", platform: "YouTube", email: "tyler@outdooradv.com", emailSource: "profile", confidence: "high", followers: "445K", engagementRate: "5.7%", profileUrl: "https://youtube.com/@tyleroutdoors", draftStatus: "generated", emailDraft: { subject: "Adventure Gear Sponsorship", body: "<p>Hey Tyler,</p><p>Your hiking and camping content is exactly what we're looking for. We'd love to send you our new camping gear collection for an honest review series.</p><p>Interested?</p><p>Cheers,<br/>The Team</p>" } },
  { id: "9", creatorName: "Nina Russo", creatorHandle: "@ninasings", platform: "TikTok", email: "nina@musiccreator.co", emailSource: "enrichment", confidence: "medium", followers: "234K", engagementRate: "9.1%", profileUrl: "https://tiktok.com/@ninasings", draftStatus: "pending", emailDraft: null },
  { id: "10", creatorName: "Chris Nguyen", creatorHandle: "@chrisgaming", platform: "YouTube", email: "chris@gamezone.net", emailSource: "profile", confidence: "high", followers: "1.2M", engagementRate: "3.4%", profileUrl: "https://youtube.com/@chrisgaming", draftStatus: "generated", emailDraft: { subject: "Gaming Sponsorship Deal", body: "<p>Hi Chris,</p><p>We're big fans of your gaming content. We'd love to sponsor your next stream and have you showcase our new gaming peripherals.</p><p>Let's discuss the details!</p><p>Best,<br/>The Team</p>" } },
  { id: "11", creatorName: "Priya Sharma", creatorHandle: "@priyawellness", platform: "YouTube", email: "priya@wellness.org", emailSource: "profile", confidence: "high", followers: "367K", engagementRate: "4.8%", profileUrl: "https://youtube.com/@priyawellness", draftStatus: "pending", emailDraft: null },
  { id: "12", creatorName: "Leo Zhang", creatorHandle: "@leoeats", platform: "TikTok", email: "leo@foodtok.com", emailSource: "enrichment", confidence: "medium", followers: "423K", engagementRate: "7.6%", profileUrl: "https://tiktok.com/@leoeats", draftStatus: "generated", emailDraft: { subject: "Food Brand Collaboration", body: "<p>Hey Leo,</p><p>Your food content always makes us hungry! We'd love to partner on a series featuring our organic snack line.</p><p>Can we schedule a call?</p><p>Best,<br/>The Team</p>" } },
  { id: "13", creatorName: "Mia Johnson", creatorHandle: "@miastyle", platform: "TikTok", email: "mia@fashiontok.co", emailSource: "enrichment", confidence: "high", followers: "556K", engagementRate: "6.2%", profileUrl: "https://tiktok.com/@miastyle", draftStatus: "pending", emailDraft: null },
  { id: "14", creatorName: "Omar Hassan", creatorHandle: "@omarfitness", platform: "YouTube", email: "omar@gymlife.io", emailSource: "profile", confidence: "high", followers: "298K", engagementRate: "5.5%", profileUrl: "https://youtube.com/@omarfitness", draftStatus: "sent", emailDraft: { subject: "Fitness Supplement Partnership", body: "<p>Hi Omar,</p><p>Your training videos are top-notch. We'd love to have you represent our new pre-workout supplement.</p><p>Details attached!</p><p>Best,<br/>The Team</p>" } },
  { id: "15", creatorName: "Rachel Green", creatorHandle: "@rachelplants", platform: "TikTok", email: "rachel@plantlife.com", emailSource: "enrichment", confidence: "medium", followers: "178K", engagementRate: "8.9%", profileUrl: "https://tiktok.com/@rachelplants", draftStatus: "pending", emailDraft: null },
  { id: "16", creatorName: "Sam Taylor", creatorHandle: "@sambuilds", platform: "YouTube", email: "sam@makerspace.io", emailSource: "profile", confidence: "high", followers: "612K", engagementRate: "4.1%", profileUrl: "https://youtube.com/@sambuilds", draftStatus: "generated", emailDraft: { subject: "Maker Space Sponsorship", body: "<p>Hi Sam,</p><p>We love your woodworking and maker content! We'd like to sponsor your workshop with our new power tool line.</p><p>Let us know!</p><p>Best,<br/>The Team</p>" } },
  { id: "17", creatorName: "Yuki Tanaka", creatorHandle: "@yukiart", platform: "TikTok", email: "yuki@artcreator.jp", emailSource: "enrichment", confidence: "low", followers: "134K", engagementRate: "10.3%", profileUrl: "https://tiktok.com/@yukiart", draftStatus: "pending", emailDraft: null },
  { id: "18", creatorName: "Ben Carter", creatorHandle: "@benfinance", platform: "YouTube", email: "ben@financeyt.com", emailSource: "profile", confidence: "high", followers: "789K", engagementRate: "3.7%", profileUrl: "https://youtube.com/@benfinance", draftStatus: "sent", emailDraft: { subject: "Fintech App Review", body: "<p>Hi Ben,</p><p>We'd love for you to review our new budgeting app in one of your finance videos.</p><p>Happy to discuss compensation!</p><p>Best,<br/>The Team</p>" } },
  { id: "19", creatorName: "Chloe Park", creatorHandle: "@chloedance", platform: "TikTok", email: "chloe@dancetok.co", emailSource: "enrichment", confidence: "medium", followers: "345K", engagementRate: "11.2%", profileUrl: "https://tiktok.com/@chloedance", draftStatus: "pending", emailDraft: null },
  { id: "20", creatorName: "Alex Morgan", creatorHandle: "@alextravel", platform: "YouTube", email: "alex@travelcreator.com", emailSource: "profile", confidence: "high", followers: "467K", engagementRate: "5.3%", profileUrl: "https://youtube.com/@alextravel", draftStatus: "pending", emailDraft: null },
];

const PAGE_SIZE = 10;

export default function EmailDistribution({ khSetId }: { khSetId: string }) {
  const [leads] = useState<Lead[]>(MOCK_LEADS);
  const [page, setPage] = useState(0);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null);

  const totalPages = Math.ceil(leads.length / PAGE_SIZE);
  const paginatedLeads = leads.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const drawerOpen = drawerLead !== null;

  const openModal = (lead: Lead) => {
    setSelectedLead(lead);
    setModalOpen(true);
  };

  const openDrawer = (lead: Lead) => {
    setDrawerLead(lead);
  };

  const closeDrawer = () => {
    setDrawerLead(null);
  };

  const handleGenerate = () => {
    alert(`Generate emails triggered for KH Set: ${khSetId} (mock)`);
  };

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
            Email Distribution
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {leads.length} leads with emails ready for outreach
          </p>
        </div>
        <Button onClick={handleGenerate} size="sm">
          <Sparkles className="h-4 w-4 mr-2" />
          Generate Emails
        </Button>
      </div>

      {/* Main layout — flex row for table + drawer */}
      <div className="flex gap-4 transition-all duration-300">
        {/* Table column */}
        <div
          className={`transition-all duration-300 ${
            drawerOpen ? "w-1/3 min-w-0" : "w-full"
          }`}
        >
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator</TableHead>
                  {!drawerOpen && <TableHead>Email</TableHead>}
                  <TableHead>Platform</TableHead>
                  <TableHead className="text-right">Draft</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className={`cursor-pointer ${
                      drawerLead?.id === lead.id ? "bg-muted" : ""
                    }`}
                    onClick={() => openModal(lead)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm truncate">{lead.creatorName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {lead.creatorHandle}
                        </p>
                      </div>
                    </TableCell>
                    {!drawerOpen && (
                      <TableCell className="text-sm truncate max-w-[200px]">
                        {lead.email}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {lead.platform}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {lead.draftStatus === "pending" && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Pending
                        </Badge>
                      )}
                      {lead.draftStatus === "generated" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs text-green-500 border-green-500/30 hover:bg-green-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDrawer(lead);
                          }}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View Draft
                        </Button>
                      )}
                      {lead.draftStatus === "sent" && (
                        <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
                          Sent
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Drawer — email composer panel */}
        {drawerOpen && drawerLead && (
          <div className="w-2/3 border rounded-lg overflow-hidden animate-in slide-in-from-right-5 duration-300">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
              <div>
                <p className="text-sm font-semibold">{drawerLead.creatorName}</p>
                <p className="text-xs text-muted-foreground">{drawerLead.creatorHandle}</p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={closeDrawer}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Email composer */}
            <EmailComposer
              to="test@email.com"
              subject={drawerLead.emailDraft?.subject || ""}
              body={drawerLead.emailDraft?.body || ""}
              onSend={() => alert(`Send email to ${drawerLead.email} (mock)`)}
              onDiscard={closeDrawer}
            />
          </div>
        )}
      </div>

      {/* Full-screen lead detail modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-4xl w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {selectedLead?.creatorName}
              <span className="text-muted-foreground font-normal ml-2 text-base">
                {selectedLead?.creatorHandle}
              </span>
            </DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="grid grid-cols-2 gap-4 mt-2">
              <DetailRow icon={<Mail className="h-4 w-4" />} label="Email" value={selectedLead.email} />
              <DetailRow icon={<Globe className="h-4 w-4" />} label="Platform" value={selectedLead.platform} />
              <DetailRow icon={<UsersIcon className="h-4 w-4" />} label="Followers" value={selectedLead.followers} />
              <DetailRow icon={<TrendingUp className="h-4 w-4" />} label="Engagement Rate" value={selectedLead.engagementRate} />
              <DetailRow icon={<Shield className="h-4 w-4" />} label="Confidence" value={selectedLead.confidence} />
              <DetailRow icon={<Mail className="h-4 w-4" />} label="Email Source" value={selectedLead.emailSource} />
              <div className="col-span-2">
                <DetailRow
                  icon={<Globe className="h-4 w-4" />}
                  label="Profile URL"
                  value={selectedLead.profileUrl}
                  isLink
                />
              </div>
              <div className="col-span-2">
                <Separator />
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-sm text-muted-foreground">Draft Status:</span>
                  {selectedLead.draftStatus === "pending" && (
                    <Badge variant="outline">Pending</Badge>
                  )}
                  {selectedLead.draftStatus === "generated" && (
                    <Badge className="bg-green-500/20 text-green-400">Generated</Badge>
                  )}
                  {selectedLead.draftStatus === "sent" && (
                    <Badge className="bg-blue-500/20 text-blue-400">Sent</Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Helper ── */
function DetailRow({
  icon,
  label,
  value,
  isLink,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  isLink?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {isLink ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:underline truncate block"
          >
            {value}
          </a>
        ) : (
          <p className="text-sm font-medium">{value}</p>
        )}
      </div>
    </div>
  );
}
