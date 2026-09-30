import { PostCard } from "@/components/post-card";
import { TrackClick } from "@/components/track-click";
import type { RecommendationCard as Card } from "@/lib/career-match/recommendations";

// おすすめ記事のカード。リンク先は内部の Blog 記事だけ（価格・確認日・PR・外部リンクは記事側で扱う）
export function RecommendationCard({ card }: { card: Card }) {
  return (
    <TrackClick
      className="h-full"
      event="recommendation_clicked"
      data={{
        article_id: card.article_id,
        type: card.type,
        placement: card.placement,
        goal_id: card.goal_id,
        step_id: card.step_id,
        position_index: card.position_index,
      }}
    >
      <PostCard
        post={{ id: card.article_id, title: card.title, description: card.description, eyecatch: card.eyecatch, category: null }}
        label={card.type_label}
        href={card.href}
      />
    </TrackClick>
  );
}
