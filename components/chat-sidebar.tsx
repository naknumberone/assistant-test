"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";

type ChatItem = {
  id: string;
  title: string;
};

export function ChatSidebar() {
  const params = useParams<{ id?: string }>();

  const { data: chats, isLoading } = useQuery<ChatItem[]>({
    queryKey: ["chats"],
    queryFn: () => fetch("/api/chats").then((r) => r.json()),
  });

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={!params.id}
              render={
                <Link
                  className="flex w-full items-center gap-2"
                  href="/chat"
                  prefetch
                />
              }
            >
                <PlusIcon />
                <span className="truncate">New chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuSkeleton />
                  </SidebarMenuItem>
                ))}
              {chats?.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton
                    isActive={params.id === chat.id}
                    render={
                      <Link
                        className="flex w-full min-w-0 items-center gap-2"
                        href={`/chat/${chat.id}`}
                        prefetch
                      />
                    }
                  >
                    <span className="truncate" title={chat.title}>
                      {chat.title}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
