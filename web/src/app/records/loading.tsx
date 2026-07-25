import { PageSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <PageSkeleton cards={6} columns="lg:grid-cols-2" />;
}
