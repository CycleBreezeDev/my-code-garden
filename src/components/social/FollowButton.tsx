import { Button } from "@/components/ui/button";
import { useFollow } from "@/hooks/useFollows";
import { Loader2, UserMinus, UserPlus } from "lucide-react";

export const FollowButton = ({ userId, size = "sm", variant = "default" }: { userId: string; size?: "sm" | "default"; variant?: "default" | "outline" }) => {
  const { isFollowing, loading, toggle, canFollow } = useFollow(userId);
  if (!canFollow) return null;
  return (
    <Button
      size={size}
      variant={isFollowing ? "outline" : variant}
      onClick={toggle}
      disabled={loading}
      className="gap-1.5"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isFollowing ? <UserMinus className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
      {isFollowing ? "Following" : "Follow"}
    </Button>
  );
};
