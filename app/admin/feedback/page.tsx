"use client";

import { useState, useEffect, useMemo, useRef } from "react";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RedirectToSignIn } from "@daveyplate/better-auth-ui";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
    PaperPlaneTilt,
    CircleNotch,
    MagnifyingGlass,
    Funnel,
    CaretLeft,
    CaretRight,
    EnvelopeSimple,
    Plus,
    Trash,
    ChatCircleDots,
    Image as ImageIcon,
    X,
    Info
} from "@phosphor-icons/react";
import { formatDistanceToNow } from "date-fns";

import MarkdownRenderer from "@/components/forum/markdown-renderer";

import { FeedbackForm } from "@/components/feedback/FeedbackForm";

export default function AdminFeedbackPage() {
    const { data: session, isPending } = useSession();
    const router = useRouter();

    const [feedbacks, setFeedbacks] = useState<any[]>([]);
    const [notificationEmails, setNotificationEmails] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Reply states
    const [selectedFeedbackForReply, setSelectedFeedbackForReply] = useState<any>(null);
    const [replyText, setReplyText] = useState("");
    const [isReplying, setIsReplying] = useState(false);
    const [isReplyDialogOpen, setIsReplyDialogOpen] = useState(false);
    const [replyImages, setReplyImages] = useState<{ key: string; url: string; file: File }[]>([]);
    const [isReplyUploading, setIsReplyUploading] = useState(false);
    const replyFileInputRef = useRef<HTMLInputElement>(null);

    // Details states

    const [selectedFeedbackDetails, setSelectedFeedbackDetails] = useState<any>(null);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

    // Notification setting states
    const [newNotifEmail, setNewNotifEmail] = useState("");
    const [isAddingNotif, setIsAddingNotif] = useState(false);
    const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

    // Filter/Search states
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        if (!isPending && (!session || session.user.role !== "admin")) {
            router.push("/");
        }
    }, [session, isPending, router]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [fbRes, notifRes] = await Promise.all([
                fetch("/api/admin/feedback"),
                fetch("/api/admin/feedback/notifications")
            ]);

            if (fbRes.ok) setFeedbacks(await fbRes.json());
            if (notifRes.ok) setNotificationEmails(await notifRes.json());
        } catch (error) {
            toast.error("Failed to fetch data");
        } finally {
            setLoading(false);
        }
    };

    const handleReplyFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsReplyUploading(true);
        const newImages = [...replyImages];

        for (const file of Array.from(files)) {
            if (!file.type.startsWith("image/")) {
                toast.error(`${file.name} is not an image file.`);
                continue;
            }

            try {
                const res = await fetch("/api/upload", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        filename: file.name,
                        contentType: file.type,
                    }),
                });

                if (!res.ok) throw new Error("Failed to get upload URL");
                const { url, publicUrl, key } = await res.json();

                await fetch(url, {
                    method: "PUT",
                    body: file,
                    headers: { "Content-Type": file.type },
                });

                newImages.push({ key, url: publicUrl, file });
            } catch (error) {
                console.error("Upload error:", error);
                toast.error(`Failed to upload ${file.name}`);
            }
        }

        setReplyImages(newImages);
        setIsReplyUploading(false);
        if (replyFileInputRef.current) replyFileInputRef.current.value = "";
    };

    const removeReplyImage = (index: number) => {
        setReplyImages(replyImages.filter((_, i) => i !== index));
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSendReply = async () => {
        if (!replyText) {
            toast.error("Please enter a reply message");
            return;
        }

        setIsReplying(true);
        try {
            const res = await fetch("/api/admin/feedback/reply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    feedbackId: selectedFeedbackForReply.id,
                    replyText,
                    images: replyImages.map(img => img.url),
                }),
            });

            if (res.ok) {
                toast.success("Reply sent successfully");
                setIsReplyDialogOpen(false);
                setReplyText("");
                setReplyImages([]);
                fetchData();
            } else {
                toast.error("Failed to send reply");
            }

        } catch (error) {
            toast.error("An error occurred while sending reply");
        } finally {
            setIsReplying(false);
        }
    };

    const handleAddNotifEmail = async () => {
        if (!newNotifEmail) return;

        setIsAddingNotif(true);
        try {
            const res = await fetch("/api/admin/feedback/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: newNotifEmail }),
            });

            if (res.ok) {
                toast.success("Notification email added");
                setNewNotifEmail("");
                fetchData();
            } else {
                toast.error("Failed to add notification email");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setIsAddingNotif(false);
        }
    };

    const handleDeleteNotifEmail = async (id: string) => {
        try {
            const res = await fetch("/api/admin/feedback/notifications", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });

            if (res.ok) {
                toast.success("Notification email removed");
                fetchData();
            } else {
                toast.error("Failed to remove notification email");
            }
        } catch (error) {
            toast.error("An error occurred");
        }
    };

    const filteredFeedbacks = useMemo(() => {
        return feedbacks.filter((fb) => {
            const matchesSearch =
                fb.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                fb.text.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === "all" || fb.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [feedbacks, searchTerm, statusFilter]);

    const totalPages = Math.ceil(filteredFeedbacks.length / itemsPerPage);
    const paginatedFeedbacks = filteredFeedbacks.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    if (isPending || (!session || session.user.role !== "admin")) {
        return (
            <div className="flex items-center justify-center min-h-screen text-xs">
                <CircleNotch className="h-4 w-4 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <RedirectToSignIn />
            <div className="space-y-6 max-w-full mx-auto p-0">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Feedback Management</h1>
                        <p className="text-muted-foreground text-xs mt-0.5">Review and respond to user submissions.</p>
                    </div>
                    <Button
                        variant="outline"
                        className="rounded-xl h-9 text-xs flex items-center gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all"
                        onClick={() => setIsSettingsDialogOpen(true)}
                    >
                        <EnvelopeSimple size={14} weight="bold" />
                        Notification Settings
                    </Button>
                </div>

                <div className=" gap-6">
                    {/* Feedback List */}
                    <Card className=" border-none shadow-sm bg-background/50">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg font-semibold">Submissions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col md:flex-row gap-3 mb-6">
                                <div className="relative flex-1">
                                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search feedback..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10 text-xs bg-muted/20 border-muted-foreground/10 h-9 rounded-xl"
                                    />
                                </div>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-full md:w-[140px] text-xs bg-muted/20 border-muted-foreground/10 h-9 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <Funnel className="h-3 w-3 text-muted-foreground" />
                                            <SelectValue placeholder="Status" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="replied">Replied</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="rounded-xl border border-muted/50 overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/30 text-[10px] uppercase tracking-wider font-bold">
                                        <TableRow>
                                            <TableHead className="h-10">Sender</TableHead>
                                            <TableHead className="h-10">Message</TableHead>
                                            <TableHead className="h-10 text-center">Source</TableHead>
                                            <TableHead className="h-10 text-center">Status</TableHead>
                                            <TableHead className="h-10 text-right pr-4">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody className="text-xs">
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-16">
                                                    <CircleNotch className="h-6 w-6 animate-spin mx-auto text-primary" />
                                                </TableCell>
                                            </TableRow>
                                        ) : paginatedFeedbacks.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                                                    No feedback found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            paginatedFeedbacks.map((fb) => (
                                                <TableRow
                                                    key={fb.id}
                                                    className="hover:bg-muted/5 transition-colors border-muted/50 cursor-pointer"
                                                    onClick={() => {
                                                        setSelectedFeedbackDetails(fb);
                                                        setIsDetailsDialogOpen(true);
                                                    }}
                                                >
                                                    <TableCell className="py-3">
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold">{fb.user?.name || "Guest"}</span>
                                                            <span className="text-[10px] text-muted-foreground">{fb.email}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-3 max-w-[200px]">
                                                        <div className="truncate text-muted-foreground italic" title={fb.text}>
                                                            "{fb.text}"
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-3 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Badge variant="secondary" className="text-[9px] py-0 px-1.5 font-medium opacity-70">
                                                                {fb.source || "general"}
                                                            </Badge>
                                                            {fb.images?.length > 0 && (
                                                                <div className="flex items-center text-[10px] text-muted-foreground">
                                                                    <ImageIcon size={12} weight="bold" />
                                                                    <span className="ml-0.5">{fb.images.length}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-3 text-center">
                                                        {fb.status === "replied" ? (
                                                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 rounded-md">
                                                                Replied
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-amber-500/10 text-amber-600 border-amber-500/20 rounded-md">
                                                                Pending
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="py-3 text-right pr-4" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex gap-2 justify-end">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 px-2.5 text-primary text-[11px] rounded-lg"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedFeedbackForReply(fb);
                                                                    setIsReplyDialogOpen(true);
                                                                }}
                                                            >
                                                                <ChatCircleDots className="h-3.5 w-3.5 mr-1" />
                                                                Reply
                                                            </Button>
                                                            {fb.discussionId ? (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 px-2.5 text-emerald-600 hover:text-emerald-700 text-[11px] rounded-lg"
                                                                    asChild
                                                                >
                                                                    <Link href={`/forum/${fb.discussionId}`}>
                                                                        <ChatCircleDots className="h-3.5 w-3.5 mr-1" />
                                                                        View Forum
                                                                    </Link>
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 px-2.5 text-amber-600 hover:text-amber-700 text-[11px] rounded-lg"
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        if (confirm("Convert this feedback into a private discussion?")) {
                                                                            try {
                                                                                await fetch(`/api/admin/feedback/${fb.id}/convert`, { method: "POST" });
                                                                                toast.success("Converted to private discussion and notified user!");
                                                                                fetchData();
                                                                            } catch (err) {
                                                                                toast.error("Failed to convert feedback");
                                                                            }
                                                                        }
                                                                    }}
                                                                >
                                                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                                                    Convert
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {totalPages > 1 && (
                                <div className="flex items-center justify-between pt-4">
                                    <p className="text-[10px] text-muted-foreground font-medium">
                                        Displaying {paginatedFeedbacks.length} of {filteredFeedbacks.length} items
                                    </p>
                                    <div className="flex gap-1.5">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7 rounded-lg"
                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            <CaretLeft className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7 rounded-lg"
                                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            <CaretRight className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Test Feedback Form */}
                    {/* <div className="lg:col-span-1 space-y-6">
                    <FeedbackForm source="Admin Test" className="shadow-none border border-muted/50" />
                </div> */}
                </div>

                {/* Notification Settings Dialog */}
                <AlertDialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                    <AlertDialogContent className="max-w-md rounded-3xl p-6">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <EnvelopeSimple weight="bold" className="text-primary" />
                                Notification Settings
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-xs">
                                Manage emails that receive alerts for new feedback submissions.
                            </AlertDialogDescription>
                        </AlertDialogHeader>

                        <div className="py-4 space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Admin email address..."
                                    value={newNotifEmail}
                                    onChange={(e) => setNewNotifEmail(e.target.value)}
                                    className="text-xs bg-muted/20 border-muted-foreground/10 h-10 rounded-xl px-4"
                                />
                                <Button size="icon" className="h-10 w-10 shrink-0 rounded-xl" onClick={handleAddNotifEmail} disabled={isAddingNotif || !newNotifEmail}>
                                    {isAddingNotif ? <CircleNotch className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" weight="bold" />}
                                </Button>
                            </div>

                            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                                {notificationEmails.length === 0 ? (
                                    <div className="text-center py-6 px-4 rounded-2xl bg-muted/20 border border-dashed border-muted/50">
                                        <p className="text-[10px] text-muted-foreground">No alerts configured.</p>
                                    </div>
                                ) : (
                                    notificationEmails.map((notif) => (
                                        <div key={notif.id} className="group flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-muted/50">
                                            <span className="text-[11px] font-medium truncate">{notif.email}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-muted-foreground hover:text-red-500 rounded-lg"
                                                onClick={() => handleDeleteNotifEmail(notif.id)}
                                            >
                                                <Trash className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl h-10 text-xs">Close</AlertDialogCancel>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Details Dialog */}
                <AlertDialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
                    <AlertDialogContent className="max-w-2xl p-0 overflow-hidden border-none rounded-3xl shadow-2xl ">
                        <button
                            onClick={() => setIsDetailsDialogOpen(false)}
                            className="absolute top-6 right-6 p-2 rounded-full hover:bg-muted/50 transition-colors z-10"
                        >
                            <X size={20} weight="bold" className="text-muted-foreground" />
                        </button>

                        <div className="p-8 space-y-6">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-2xl font-bold flex items-center gap-2">
                                    <ChatCircleDots size={24} weight="bold" className="text-primary" />
                                    Feedback Details
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-sm flex flex-col gap-1">
                                    <span>From: <span className="font-semibold text-foreground">{selectedFeedbackDetails?.email}</span></span>
                                    <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                                        Received on {selectedFeedbackDetails && new Date(selectedFeedbackDetails.createdAt).toLocaleString()}
                                        {selectedFeedbackDetails && ` (${formatDistanceToNow(new Date(selectedFeedbackDetails.createdAt), { addSuffix: true })})`}
                                    </span>
                                </AlertDialogDescription>
                            </AlertDialogHeader>

                            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Content</label>
                                    <div className="p-6 bg-muted/20 rounded-2xl border border-muted-foreground/10 prose prose-sm dark:prose-invert max-w-none">
                                        <MarkdownRenderer content={selectedFeedbackDetails?.text || ""} />
                                    </div>
                                </div>

                                {selectedFeedbackDetails?.images?.length > 0 && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Attachments ({selectedFeedbackDetails.images.length})</label>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            {selectedFeedbackDetails.images.map((img: string, i: number) => (
                                                <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="group relative rounded-xl overflow-hidden aspect-square border border-muted-foreground/10">
                                                    <img src={img} alt={`attachment-${i}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <span className="text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/30">View Full</span>
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedFeedbackDetails?.replies?.length > 0 && (
                                    <div className="space-y-4">
                                        <label className="text-[10px] uppercase tracking-widest font-bold text-emerald-600">Reply History ({selectedFeedbackDetails.replies.length})</label>
                                        <div className="space-y-4">
                                            {selectedFeedbackDetails.replies.map((reply: any, i: number) => (
                                                <div key={reply.id} className="p-5 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 space-y-3 relative">
                                                    <span className="absolute -top-2.5 right-4 px-2 py-0.5 bg-emerald-500 text-[8px] uppercase tracking-widest font-bold text-white rounded-full">
                                                        Response {i + 1}
                                                    </span>
                                                    <div className="text-xs text-foreground/80 leading-relaxed">
                                                        {reply.text}
                                                    </div>
                                                    {reply.images?.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            {reply.images.map((img: string, idx: number) => (
                                                                <a key={idx} href={img} target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-lg overflow-hidden border border-emerald-500/20">
                                                                    <img src={img} alt="reply-attachment" className="w-full h-full object-cover" />
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">
                                                        Sent on {new Date(reply.createdAt).toLocaleString()}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedFeedbackDetails?.status === "replied" && (!selectedFeedbackDetails?.replies || selectedFeedbackDetails?.replies?.length === 0) && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase tracking-widest font-bold text-emerald-600">Admin Response</label>
                                        <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 text-xs italic text-foreground/80">
                                            This feedback has been addressed and replied to.
                                        </div>
                                    </div>
                                )}

                            </div>

                            <AlertDialogFooter className="flex flex-col gap-4 pt-4 border-t border-muted/50">
                                <div className="flex items-center gap-3 w-full">

                                    {selectedFeedbackDetails?.status !== "replied" && !selectedFeedbackDetails?.discussionId && (
                                        <div className="flex-1 flex flex-col gap-1.5">
                                            <Button
                                                variant="outline"
                                                className="w-full rounded-2xl h-12 border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 transition-all flex items-center justify-center gap-2"
                                                onClick={async () => {
                                                    if (confirm("Convert this feedback into a private discussion? The user will be notified.")) {
                                                        try {
                                                            await fetch(`/api/admin/feedback/${selectedFeedbackDetails.id}/convert`, { method: "POST" });
                                                            toast.success("Converted to private discussion and notified user!");
                                                            setIsDetailsDialogOpen(false);
                                                            fetchData();
                                                        } catch (err) {
                                                            toast.error("Failed to convert feedback");
                                                        }
                                                    }
                                                }}
                                            >
                                                <Plus size={18} weight="bold" />
                                                Convert to Discussion
                                            </Button>
                                        </div>
                                    )}

                                    {selectedFeedbackDetails?.status !== "replied" && (
                                        <Button
                                            className="flex-1 rounded-2xl h-12 bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                            onClick={() => {
                                                setSelectedFeedbackForReply(selectedFeedbackDetails);
                                                setIsReplyDialogOpen(true);
                                                setIsDetailsDialogOpen(false);
                                            }}
                                        >
                                            <ChatCircleDots className="h-5 w-5 mr-2" weight="bold" />
                                            Reply Now
                                        </Button>
                                    )}

                                    {selectedFeedbackDetails?.discussionId && (
                                        <Button
                                            variant="outline"
                                            className="flex-1 rounded-2xl h-12 border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400 transition-all"
                                            asChild
                                        >
                                            <Link href={`/forum/${selectedFeedbackDetails.discussionId}`}>
                                                <ChatCircleDots className="h-5 w-5 mr-2" weight="bold" />
                                                View in Forum
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            </AlertDialogFooter>
                        </div>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Reply Dialog */}
                <AlertDialog open={isReplyDialogOpen} onOpenChange={setIsReplyDialogOpen}>
                    <AlertDialogContent className="max-w-xl p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
                        <div className="p-8 space-y-6">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-2xl font-bold">Reply to Feedback</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm">
                                    Respond to <span className="font-semibold text-foreground">{selectedFeedbackForReply?.email}</span>
                                </AlertDialogDescription>
                            </AlertDialogHeader>

                            <div className="space-y-4">
                                <div className="p-5 bg-primary/5 rounded-2xl border border-primary/10 relative">
                                    <span className="absolute -top-2.5 left-4 px-2 py-0.5 bg-primary text-[9px] uppercase tracking-widest font-bold text-primary-foreground rounded-full">User Message</span>
                                    <div className="text-xs text-foreground/80 italic leading-relaxed line-clamp-3">
                                        "{selectedFeedbackForReply?.text}"
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">Your Response</label>
                                    <Textarea
                                        placeholder="Type your reply here..."
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        className="min-h-[160px] text-sm bg-muted/20 border-muted-foreground/10 p-5 rounded-2xl focus-visible:ring-primary/20"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">Attachments</label>
                                    <div className="flex flex-wrap gap-2">
                                        {replyImages.map((img, index) => (
                                            <div key={img.key} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-muted-foreground/10">
                                                <img src={img.url} alt="preview" className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeReplyImage(index)}
                                                    className="absolute top-1 right-1 bg-black/50 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X size={10} weight="bold" />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => replyFileInputRef.current?.click()}
                                            disabled={isReplyUploading}
                                            className="w-16 h-16 rounded-lg border border-dashed border-muted-foreground/20 flex flex-col items-center justify-center hover:border-primary/50 hover:bg-primary/5 transition-all group"
                                        >
                                            {isReplyUploading ? (
                                                <CircleNotch className="h-4 w-4 animate-spin text-primary" />
                                            ) : (
                                                <>
                                                    <ImageIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                                    <span className="text-[8px] mt-1 text-muted-foreground uppercase font-bold group-hover:text-primary">Add</span>
                                                </>
                                            )}
                                        </button>
                                        <input
                                            type="file"
                                            ref={replyFileInputRef}
                                            onChange={handleReplyFileChange}
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                        />
                                    </div>
                                </div>
                            </div>

                            <AlertDialogFooter className="pt-4 flex !justify-between gap-4">
                                <AlertDialogCancel
                                    className="rounded-2xl h-12 px-6 border-muted-foreground/10 hover:bg-muted/30"
                                    onClick={() => {
                                        setReplyText("");
                                        setReplyImages([]);
                                        setSelectedFeedbackForReply(null);
                                    }}
                                >
                                    Cancel
                                </AlertDialogCancel>
                                <Button
                                    className="rounded-2xl h-12 px-8 flex-1 bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    onClick={handleSendReply}
                                    disabled={isReplying || isReplyUploading || !replyText}
                                >

                                    {isReplying ? (
                                        <CircleNotch className="h-5 w-5 animate-spin mr-2" />
                                    ) : (
                                        <PaperPlaneTilt className="h-5 w-5 mr-2" weight="bold" />
                                    )}
                                    {isReplying ? "Sending..." : "Send Response"}
                                </Button>
                            </AlertDialogFooter>
                        </div>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </>
    );
}
