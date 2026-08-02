const express = require("express");
const router = express.Router();

const Post = require("../Model/Post");
const User = require("../Model/User");
const Friendship = require("../Model/Friendship");
const { verifyFirebaseUser } = require("../middleware/auth");
const { IST_OFFSET_MINUTES } = require("../utils/timeWindow");

/** Count accepted friends for a uid. */
async function countAcceptedFriends(uid) {
  const [asRequester, asAddressee] = await Promise.all([
    Friendship.countDocuments({ requester: uid, status: "accepted" }),
    Friendship.countDocuments({ addressee: uid, status: "accepted" }),
  ]);
  return asRequester + asAddressee;
}

/**
 * Posting limit from friend count:
 *  0 friends  → cannot post
 *  1 friend   → 1 post/day
 *  2 friends  → 2 posts/day
 *  3–10       → friendCount posts/day (natural extension)
 *  >10 friends → unlimited
 */
function maxPostsPerDay(friendCount) {
  if (friendCount === 0) return 0;
  if (friendCount > 10) return Infinity;
  return friendCount;
}

/** Count posts created by a uid since the start of "today" (IST). */
async function countPostsToday(uid) {
  const nowUtc = Date.now() + IST_OFFSET_MINUTES * 60 * 1000;
  const d = new Date(nowUtc);
  d.setUTCHours(0, 0, 0, 0);
  const startOfTodayUtc = new Date(d.getTime() - IST_OFFSET_MINUTES * 60 * 1000);
  return Post.countDocuments({ uid, createdAt: { $gte: startOfTodayUtc } });
}

/** GET /api/public/posts/limits — posting quota for the current user. */
router.get("/posts/limits", verifyFirebaseUser, async (req, res) => {
  try {
    const friendCount = await countAcceptedFriends(req.authUser.uid);
    const maxPerDay = maxPostsPerDay(friendCount);
    const postsToday = await countPostsToday(req.authUser.uid);
    const remaining = maxPerDay === Infinity ? Infinity : Math.max(0, maxPerDay - postsToday);
    return res.json({
      success: true,
      friendCount,
      maxPerDay,
      postsToday,
      unlimited: maxPerDay === Infinity,
      remaining,
    });
  } catch (err) {
    console.error("[public/limits]", err.message);
    return res.status(500).json({ error: "Could not fetch posting limits." });
  }
});

/** GET /api/public/posts — community feed (newest first). */
router.get("/posts", verifyFirebaseUser, async (req, res) => {
  try {
    const posts = await Post.find({}).sort({ createdAt: -1 }).limit(100);
    const uid = req.authUser.uid;
    const enriched = posts.map((p) => {
      const doc = p.toObject();
      doc.likeCount = doc.likes.length;
      doc.likedByMe = doc.likes.includes(uid);
      delete doc.likes;
      return doc;
    });
    return res.json({ success: true, data: enriched });
  } catch (err) {
    console.error("[public/posts:get]", err.message);
    return res.status(500).json({ error: "Could not fetch the feed." });
  }
});

/** POST /api/public/posts — create a post, enforcing the friend-based limit. */
router.post("/posts", verifyFirebaseUser, async (req, res) => {
  try {
    const { uid, name } = req.authUser;
    const { caption, media } = req.body || {};

    const friendCount = await countAcceptedFriends(uid);
    const maxPerDay = maxPostsPerDay(friendCount);
    if (maxPerDay === 0) {
      return res.status(403).json({
        error: "You need at least one friend to post in the Public Space.",
        friendCount,
      });
    }
    const postsToday = await countPostsToday(uid);
    if (maxPerDay !== Infinity && postsToday >= maxPerDay) {
      return res.status(403).json({
        error: `Daily posting limit reached (${maxPerDay} post(s) per day).`,
        maxPerDay,
        postsToday,
      });
    }

    const cleanMedia = Array.isArray(media)
      ? media
          .filter((m) => m && (m.type === "image" || m.type === "video") && m.data)
          .slice(0, 5)
      : [];

    if (!String(caption || "").trim() && cleanMedia.length === 0) {
      return res.status(400).json({ error: "Add a caption or media to your post." });
    }

    let authorPhoto = "";
    const user = await User.findOne({ uid }).select("name");
    const post = await Post.create({
      uid,
      authorName: name || (user && user.name) || "Anonymous",
      authorPhoto,
      caption: String(caption || "").trim(),
      media: cleanMedia,
    });

    return res.status(201).json({ success: true, data: post });
  } catch (err) {
    console.error("[public/posts:post]", err.message);
    return res.status(500).json({ error: "Could not create your post." });
  }
});

/** POST /api/public/posts/:id/like — toggle a like. */
router.post("/posts/:id/like", verifyFirebaseUser, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found." });
    const uid = req.authUser.uid;
    const liked = post.likes.includes(uid);
    if (liked) {
      post.likes = post.likes.filter((l) => l !== uid);
    } else {
      post.likes.push(uid);
    }
    await post.save();
    return res.json({
      success: true,
      liked: !liked,
      likeCount: post.likes.length,
    });
  } catch (err) {
    console.error("[public/posts:like]", err.message);
    return res.status(500).json({ error: "Could not update the like." });
  }
});

/** POST /api/public/posts/:id/comment — add a comment. */
router.post("/posts/:id/comment", verifyFirebaseUser, async (req, res) => {
  try {
    const { uid, name, email } = req.authUser;
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ error: "Comment cannot be empty." });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found." });

    post.comments.push({ uid, name: name || email || "User", photo: "", text });
    await post.save();
    return res.status(201).json({ success: true, data: post.comments[post.comments.length - 1] });
  } catch (err) {
    console.error("[public/posts:comment]", err.message);
    return res.status(500).json({ error: "Could not add your comment." });
  }
});

/** POST /api/public/posts/:id/share — increment share count. */
router.post("/posts/:id/share", verifyFirebaseUser, async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { shares: 1 } },
      { new: true }
    );
    if (!post) return res.status(404).json({ error: "Post not found." });
    return res.json({ success: true, shares: post.shares });
  } catch (err) {
    console.error("[public/posts:share]", err.message);
    return res.status(500).json({ error: "Could not share the post." });
  }
});

/** DELETE /api/public/posts/:id — delete your own post. */
router.delete("/posts/:id", verifyFirebaseUser, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found." });
    if (post.uid !== req.authUser.uid) {
      return res.status(403).json({ error: "You can only delete your own posts." });
    }
    await Post.deleteOne({ _id: post._id });
    return res.json({ success: true, message: "Post deleted." });
  } catch (err) {
    console.error("[public/posts:delete]", err.message);
    return res.status(500).json({ error: "Could not delete the post." });
  }
});

/* ------------------------------------------------------------------ */
/* Friends                                                              */
/* ------------------------------------------------------------------ */

/** GET /api/friends — accepted friends + count for the current user. */
router.get("/friends", verifyFirebaseUser, async (req, res) => {
  try {
    const uid = req.authUser.uid;
    const [asRequester, asAddressee] = await Promise.all([
      Friendship.find({ requester: uid, status: "accepted" }),
      Friendship.find({ addressee: uid, status: "accepted" }),
    ]);
    const friendUids = [
      ...asRequester.map((f) => f.addressee),
      ...asAddressee.map((f) => f.requester),
    ];
    const users = await User.find({ uid: { $in: friendUids } }).select("name email uid");
    return res.json({ success: true, count: friendUids.length, data: users });
  } catch (err) {
    console.error("[friends:list]", err.message);
    return res.status(500).json({ error: "Could not fetch friends." });
  }
});

/** GET /api/friends/requests — incoming pending requests. */
router.get("/friends/requests", verifyFirebaseUser, async (req, res) => {
  try {
    const uid = req.authUser.uid;
    const requests = await Friendship.find({ addressee: uid, status: "pending" });
    const requesterUids = requests.map((r) => r.requester);
    const users = await User.find({ uid: { $in: requesterUids } }).select("name email uid");
    return res.json({ success: true, data: users, count: users.length });
  } catch (err) {
    console.error("[friends:requests]", err.message);
    return res.status(500).json({ error: "Could not fetch friend requests." });
  }
});

/** GET /api/friends/pending — outgoing pending requests. */
router.get("/friends/pending", verifyFirebaseUser, async (req, res) => {
  try {
    const uid = req.authUser.uid;
    const pending = await Friendship.find({ requester: uid, status: "pending" });
    return res.json({ success: true, data: pending.map((p) => p.addressee) });
  } catch (err) {
    console.error("[friends:pending]", err.message);
    return res.status(500).json({ error: "Could not fetch pending requests." });
  }
});

/** POST /api/friends/request — send a friend request. Body: { uid }. */
router.post("/friends/request", verifyFirebaseUser, async (req, res) => {
  try {
    const requester = req.authUser.uid;
    const addressee = String(req.body?.uid || "").trim();
    if (!addressee || addressee === requester) {
      return res.status(400).json({ error: "Invalid friend id." });
    }
    const target = await User.findOne({ uid: addressee });
    if (!target) return res.status(404).json({ error: "User not found." });

    const existing = await Friendship.findOne({
      $or: [
        { requester, addressee },
        { requester: addressee, addressee: requester },
      ],
    });
    if (existing) {
      return res.status(409).json({
        error:
          existing.status === "accepted"
            ? "You are already friends."
            : "A friend request is already pending.",
      });
    }

    await Friendship.create({ requester, addressee });
    return res.status(201).json({ success: true, message: "Friend request sent." });
  } catch (err) {
    console.error("[friends:request]", err.message);
    return res.status(500).json({ error: "Could not send the friend request." });
  }
});

/** POST /api/friends/accept — accept a pending request. Body: { requesterId }. */
router.post("/friends/accept", verifyFirebaseUser, async (req, res) => {
  try {
    const addressee = req.authUser.uid;
    const requester = String(req.body?.requesterId || "").trim();
    const rel = await Friendship.findOneAndUpdate(
      { requester, addressee, status: "pending" },
      { $set: { status: "accepted" } },
      { new: true }
    );
    if (!rel) {
      return res.status(404).json({ error: "No pending request from this user." });
    }
    return res.json({ success: true, message: "Friend request accepted." });
  } catch (err) {
    console.error("[friends:accept]", err.message);
    return res.status(500).json({ error: "Could not accept the friend request." });
  }
});

/** POST /api/friends/remove — remove a friend. Body: { uid }. */
router.post("/friends/remove", verifyFirebaseUser, async (req, res) => {
  try {
    const uid = req.authUser.uid;
    const other = String(req.body?.uid || "").trim();
    const result = await Friendship.findOneAndDelete({
      status: "accepted",
      $or: [
        { requester: uid, addressee: other },
        { requester: other, addressee: uid },
      ],
    });
    if (!result) return res.status(404).json({ error: "Friendship not found." });
    return res.json({ success: true, message: "Friend removed." });
  } catch (err) {
    console.error("[friends:remove]", err.message);
    return res.status(500).json({ error: "Could not remove the friend." });
  }
});

module.exports = router;
