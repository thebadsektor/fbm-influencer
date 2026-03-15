import { getNotificationAnalytics } from "./actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Bell,
    CheckCircle,
    EnvelopeOpen,
    ChartLineUp,
} from "@phosphor-icons/react/dist/ssr";
import { SendNotificationDialog } from "@/components/notifications/SendNotificationDialog";

export default async function AdminNotificationsPage() {
    const { total, read, unread, activityData } = await getNotificationAnalytics();

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Notification Analytics</h1>
                    <p className="text-muted-foreground text-xs">Overview of system notification performance and reach.</p>
                </div>
                <SendNotificationDialog />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-none shadow-sm bg-primary/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
                        <Bell className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{total}</div>
                        <p className="text-[10px] text-muted-foreground">All-time system notifications</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-green-500/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Read Rate</CardTitle>
                        <EnvelopeOpen className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{total > 0 ? Math.round((read / total) * 100) : 0}%</div>
                        <p className="text-[10px] text-muted-foreground">{read} notifications opened by users</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-orange-500/5">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Pending Unread</CardTitle>
                        <CheckCircle className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{unread}</div>
                        <p className="text-[10px] text-muted-foreground">Notifications waiting to be seen</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none shadow-sm">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <ChartLineUp className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle className="text-lg">Recent Activity</CardTitle>
                            <CardDescription className="text-xs">
                                Notifications volumes over the last 7 days.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-[200px] flex items-end gap-2 pt-4">
                        {activityData.map((day) => (
                            <div key={day.date} className="flex-1 flex flex-col items-center gap-2 group">
                                <div 
                                    className="w-full bg-primary/20 rounded-t-sm transition-all group-hover:bg-primary/40 relative"
                                    style={{ 
                                        height: `${total > 0 ? (day.count / Math.max(...activityData.map(d => d.count), 1)) * 100 : 0}%`,
                                        minHeight: day.count > 0 ? '4px' : '0px'
                                    }}
                                >
                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                        {day.count}
                                    </div>
                                </div>
                                <span className="text-[10px] text-muted-foreground rotate-45 origin-left mt-2 whitespace-nowrap">
                                    {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                                </span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
