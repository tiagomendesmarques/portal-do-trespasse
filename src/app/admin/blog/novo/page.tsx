import { AdminHeader } from "@/components/admin/ui";
import { PostForm } from "../post-form";

export const metadata = { title: "Novo artigo" };

export default function NewPost() {
  return (<><AdminHeader crumbs={[{ href: "/admin/blog/", label: "Blog" }]} title="Novo artigo" /><PostForm /></>);
}
