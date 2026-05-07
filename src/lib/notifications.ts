export type NotificationType = "sign_in" | "image_upload" | "elite_purchase" | "other";

export type NotificationAudience =
  | "all"
  | "no_images"
  | "partial_images"
  | "all_images"
  | "elite";

export interface DashboardNotification {
  id: string;
  type: NotificationType;
  message: string;
  createdAt: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  metadata?: Record<string, unknown>;
}

