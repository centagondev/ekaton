import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, CheckCheck, MessageSquare, Calendar, UserCheck, AlertTriangle, Loader2 } from "lucide-react";
import userApi from "@/services/userApi";

// ── Notification icon by type ─────────────────────────────────────────────────
function NotificationIcon({ type }) {
  const iconMap = {
    match: <MessageSquare className="size-4 text-[#FFDE00]" />,
    reveal: <UserCheck className="size-4 text-[#CCFF00]" />,
    event: <Calendar className="size-4 text-blue-500" />,
    complaint: <AlertTriangle className="size-4 text-red-400" />,
  };
  return (
    <div className="flex size-9 shrink-0 items-center justify-center border-2 border-black bg-black shadow-[2px_2px_0px_black]">
      {iconMap[type] || <Bell className="size-4 text-white" />}
    </div>
  );
}

// ── Format time ───────────────────────────────────────────────────────────────
function timeAgo(isoString) {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── NotificationsPage ─────────────────────────────────────────────────────────
const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const result = await userApi.get("notifications/");
      const data = result.data?.data ?? result.data;
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      // Backend not yet implemented — show empty state gracefully
      if (err.response?.status !== 404) {
        toast.error("Failed to load notifications.");
      }
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      await userApi.patch("notifications/mark-all-read/");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success("All notifications marked as read.");
    } catch {
      // Optimistically mark as read anyway
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-dvh bg-[#FBF9F5] px-4 py-10 md:px-6">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between">
          <div className="border-l-4 border-black pl-4">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black uppercase tracking-tight">
                Notifications
              </h1>
              {unreadCount > 0 && (
                <span className="border-2 border-black bg-[#FFDE00] px-2 py-0.5 text-sm font-extrabold shadow-[2px_2px_0px_black]">
                  {unreadCount}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-gray-500">
              Stay updated on matches, reveals, and events.
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 border-2 border-black bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-wider shadow-[3px_3px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_black] transition-all"
            >
              <CheckCheck className="size-3.5" />
              Mark All Read
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="size-8 animate-spin text-gray-400" />
          </div>
        )}

        {/* Empty state */}
        {!loading && notifications.length === 0 && (
          <div className="flex flex-col items-center gap-4 border-2 border-black bg-white py-20 text-center shadow-[5px_5px_0px_black]">
            <div className="flex size-16 items-center justify-center border-2 border-black bg-[#E8EBFF] shadow-[3px_3px_0px_black]">
              <Bell className="size-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-extrabold uppercase">You're All Caught Up</h3>
            <p className="text-sm font-medium text-gray-500">
              No notifications yet. Start chatting to get your first one!
            </p>
          </div>
        )}

        {/* Notification list */}
        {!loading && notifications.length > 0 && (
          <div className="flex flex-col divide-y-2 divide-black border-2 border-black bg-white shadow-[5px_5px_0px_black]">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-start gap-4 px-5 py-4 transition-colors ${
                  !notification.is_read ? "bg-[#FFFDE7]" : "bg-white"
                }`}
              >
                <NotificationIcon type={notification.type} />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm leading-snug ${
                      !notification.is_read ? "font-bold text-black" : "font-medium text-gray-700"
                    }`}
                  >
                    {notification.message || notification.title}
                  </p>
                  <p className="mt-1 text-[10px] font-medium text-gray-400">
                    {timeAgo(notification.created_at)}
                  </p>
                </div>
                {!notification.is_read && (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#FFDE00] border border-black" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
