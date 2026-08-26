-- Segment.order was only indexed, and new segments took their order from
-- count(), so once deletion exists two segments in a song can claim the same
-- slot -- which breaks both the rail's ordering and the "mark done up to
-- here" cascade (which selects on order < target).
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_songId_order_key" UNIQUE ("songId", "order");
