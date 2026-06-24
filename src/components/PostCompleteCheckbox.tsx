import { togglePostComplete } from "@/actions/completions";
import { PostCompleteButton } from "@/components/PostCompleteButton";

type PostCompleteCheckboxProps = {
  postId: string;
  completed: boolean;
  compact?: boolean;
};

export function PostCompleteCheckbox({
  postId,
  completed,
  compact = false,
}: PostCompleteCheckboxProps) {
  return (
    <form action={togglePostComplete} className="shrink-0">
      <input type="hidden" name="postId" value={postId} />
      <PostCompleteButton completed={completed} compact={compact} />
    </form>
  );
}
