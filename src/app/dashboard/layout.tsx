 "use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import type { DashboardRole } from "@/lib/dashboard-roles";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Bell,
  Users,
  Building2,
  FolderKanban,
  Database,
  HeartHandshake,
  MessageCircleHeart,
  LineChart,
  Info,
  ShieldCheck,
  LogOut,
} from "lucide-react";

const adminStaffNav = [
  { href: "/dashboard", label: "Overview", permission: "canViewStats" as const, icon: <LayoutDashboard className="h-4 w-4 text-[#4a5568]" /> },
  { href: "/dashboard/notifications", label: "Notifications", permission: "canViewStats" as const, icon: <Bell className="h-4 w-4 text-[#4a5568]" /> },
  { href: "/dashboard/users", label: "Users", permission: "canViewUsers" as const, icon: <Users className="h-4 w-4 text-[#4a5568]" /> },
  { href: "/dashboard/franchises", label: "Franchises", permission: "canViewFranchises" as const, icon: <Building2 className="h-4 w-4 text-[#4a5568]" /> },
  { href: "/dashboard/franchise-requests", label: "Franchise requests", adminOnly: true, icon: <FolderKanban className="h-4 w-4 text-[#4a5568]" /> },
  { href: "/dashboard/app-data", label: "App Data", permission: "canViewAppData" as const, icon: <Database className="h-4 w-4 text-[#4a5568]" /> },
  { href: "/dashboard/youtube-help", label: "YouTube Help", permission: "canViewAppData" as const, icon: <Database className="h-4 w-4 text-[#4a5568]" /> },
  { href: "/dashboard/coupons", label: "Coupons", permission: "canViewAppData" as const, icon: <Database className="h-4 w-4 text-[#4a5568]" /> },
  { href: "/dashboard/counselling", label: "Counselling services", permission: "canViewAppData" as const, icon: <HeartHandshake className="h-4 w-4 text-[#4a5568]" /> },
  { href: "/dashboard/testimonials", label: "Testimonials", permission: "canViewAppData" as const, icon: <MessageCircleHeart className="h-4 w-4 text-[#4a5568]" /> },
  { href: "/dashboard/points-and-usage", label: "Points & Usage", permission: "canViewAppData" as const, icon: <LineChart className="h-4 w-4 text-[#4a5568]" /> },
  { href: "/dashboard/about-us", label: "About Us", permission: "canViewAppData" as const, icon: <Info className="h-4 w-4 text-[#4a5568]" /> },
  { href: "/dashboard/permissions", label: "Staff permissions", adminOnly: true, icon: <ShieldCheck className="h-4 w-4 text-[#4a5568]" /> },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, roleInfo, roleLoading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !roleLoading && !user) router.replace("/login");
    if (!loading && !roleLoading && user && roleInfo === null) router.replace("/login");
  }, [user, loading, roleInfo, roleLoading, router]);

  useEffect(() => {
    if (!roleInfo || roleLoading) return;
    if (pathname === "/dashboard" && roleInfo.role === "user") router.replace("/dashboard/me");
    else if (pathname === "/dashboard" && roleInfo.role === "franchise") router.replace("/dashboard/my-franchise");
  }, [pathname, roleInfo, roleLoading, router]);

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }
  if (!user) return null;
  if (roleInfo === null) return null;

  const role = roleInfo.role as DashboardRole;
  const isAdmin = role === "admin";
  const can = (key: string) => isAdmin || Boolean(roleInfo.permissions?.[key as keyof typeof roleInfo.permissions]);

  const navLinks =
    role === "user"
      ? [
          {
            href: "/dashboard/me",
            label: "Profile and data",
            icon: <Users className="h-4 w-4 text-[#4a5568]" />,
          },
        ]
      : role === "franchise"
        ? [
            {
              href: "/dashboard/my-franchise",
              label: "My franchise",
              icon: <Building2 className="h-4 w-4 text-[#4a5568]" />,
            },
          ]
        : adminStaffNav.filter(
            (item) =>
              ("adminOnly" in item && item.adminOnly ? isAdmin : can((item as { permission: string }).permission))
          );

  const homeHref =
    role === "user"
      ? "/dashboard/me"
      : role === "franchise"
        ? "/dashboard/my-franchise"
        : "/dashboard";

  return (
    <div className="h-screen flex flex-col md:flex-row bg-[#f5f7fa]">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}>
        <SidebarBody className="justify-between gap-6">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden sidebar-scroll">
            <Link
              href={homeHref}
              className="flex items-center gap-3 mb-6 px-1 mt-1"
            >
              <Image
                src="/logo.png"
                alt="Genetix"
                width={32}
                height={32}
                className="h-8 w-auto object-contain flex-shrink-0"
              />
              <span className="font-bold text-[#2d3748] text-lg">
                Genetix
              </span>
            </Link>
            <div className="flex flex-col gap-1">
              {navLinks.map((item) => (
                <SidebarLink
                  key={item.href}
                  link={{
                    href: item.href,
                    label: item.label,
                    icon: (
                      <span className="flex items-center justify-center h-7 w-7 rounded-md bg-white text-[#4a5568] shadow-sm">
                        {"icon" in item && item.icon ? item.icon : <LayoutDashboard className="h-4 w-4" />}
                      </span>
                    ),
                  }}
                  className={
                    pathname === item.href
                      ? "bg-[#4059ad] text-white shadow-md"
                      : "text-[#4a5568]"
                  }
                />
              ))}
            </div>
          </div>
          <div className="border-t border-[#e2e8f0] pt-4 mt-4 opacity-0 translate-y-1 transition-all duration-200 group-hover/sidebar:opacity-100 group-hover/sidebar:translate-y-0 pointer-events-none group-hover/sidebar:pointer-events-auto">
            <p
              className="px-2 py-1 text-xs text-[#718096] truncate"
              title={user.email ?? ""}
            >
              {user.email}
            </p>
            <p className="px-2 pb-1 text-xs text-[#2d3748] font-medium capitalize">
              {role}
            </p>
            <button
              onClick={() =>
                signOut().then(() => {
                  setSidebarOpen(false);
                  router.replace("/login");
                })
              }
              className="mt-2 w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-[#718096] hover:bg-white hover:text-[#2d3748] transition"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </div>
        </SidebarBody>
      </Sidebar>
      <main className="flex-1 w-full md:h-screen overflow-y-auto bg-[#f5f7fa]">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
