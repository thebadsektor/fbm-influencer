"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { SignedIn } from "@daveyplate/better-auth-ui";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";

interface ForumFiltersProps {
    initialQ: string;
    initialSort: string;
    initialFilter: string;
}

export default function ForumFilters({ initialQ, initialSort, initialFilter }: ForumFiltersProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [search, setSearch] = useState(initialQ);
    const [debouncedSearch] = useDebounce(search, 500);

    // Update URL when debounced search changes
    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        const currentQ = params.get("q") || "";

        if (debouncedSearch !== currentQ) {
            if (debouncedSearch) {
                params.set("q", debouncedSearch);
            } else {
                params.delete("q");
            }
            params.set("page", "1"); // Reset to first page on search
            router.push(`/forum?${params.toString()}`);
        }
    }, [debouncedSearch, router, searchParams]);

    const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newValue = e.target.value;
        const params = new URLSearchParams(searchParams.toString());
        if (params.get("sort") !== newValue) {
            params.set("sort", newValue);
            params.set("page", "1");
            router.push(`/forum?${params.toString()}`);
        }
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newValue = e.target.value;
        const params = new URLSearchParams(searchParams.toString());
        if (params.get("filter") !== newValue) {
            params.set("filter", newValue);
            params.set("page", "1");
            router.push(`/forum?${params.toString()}`);
        }
    };

    return (
        <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                    placeholder="Search discussions..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
                <select
                    value={initialSort}
                    onChange={handleSortChange}
                    className="flex h-10 w-full md:w-[150px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <option value="latest">Latest</option>
                    <option value="oldest">Oldest</option>
                    <option value="views">Most Viewed</option>
                    <option value="upvotes">Most Upvoted</option>
                </select>
                <select
                    value={initialFilter}
                    onChange={handleFilterChange}
                    className="flex h-10 w-full md:w-[150px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <option value="all">All</option>
                    <option value="public">Public Only</option>
                    <option value="private">Private Only</option>
                    <SignedIn>
                        <option value="mine">My Discussions</option>
                    </SignedIn>
                </select>
            </div>
        </div>
    );
}
