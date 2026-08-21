import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  Camera,
  CheckCircle2,
  Heart,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Send,
  Share2,
  Trash2,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";
import { selectuser } from "@/Feature/Userslice";
import {
  acceptFriendRequest,
  addComment,
  createPost,
  deletePost,
  getAllInterns,
  getFeed,
  getFriendRequests,
  getFriends,
  getPendingRequests,
  getPostingLimits,
  sendFriendRequest,
  sharePost,
  toggleLike,
  removeFriend,
  type Friend,
  type Post,
  type PostingLimits,
} from "@/services/publicSpaceService";

const MAX_IMAGE_SIZE = 2.5 * 1024 * 1024; // 2.5 MB
const MAX_VIDEO_SIZE = 20 * 1024 * 1024; // 20 MB

const PublicSpacePage = () => {
  const { t } = useTranslation();
  const user = useSelector(selectuser);

  const [limits, setLimits] = useState<PostingLimits | null>(null);
  const [feed, setFeed] = useState<Post[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  // Post composer
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<{ type: "image" | "video"; data: string }[]>([]);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Comment input per post
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  // Friends
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [requests, setRequests] = useState<Friend[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [interns, setInterns] = useState<Friend[]>([]);
  const [friendSearch, setFriendSearch] = useState("");

  const loadAll = useCallback(async () => {
    try {
      const [lim, f, feedRes] = await Promise.all([
        getPostingLimits(),
        getFriends(),
        getFeed(),
      ]);
      setLimits(lim);
      setFriendCount(f.count);
      setFriends(f.data);
      setFeed(feedRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    loadAll();
    getFriendRequests().then((r) => setRequests(r.data)).catch(() => undefined);
    getPendingRequests().then(setPending).catch(() => undefined);
    getAllInterns().then(setInterns).catch(() => undefined);
  }, [user?.uid, loadAll]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video");
    const limit = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > limit) {
      toast.error(isVideo ? t("public.videoTooLarge") : t("public.imageTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setMedia((prev) => [...prev, { type: isVideo ? "video" : "image", data: String(reader.result) }]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handlePost = async () => {
    if (!caption.trim() && media.length === 0) {
      toast.error(t("public.postEmpty"));
      return;
    }
    setPosting(true);
    try {
      await createPost({ caption: caption.trim(), media });
      setCaption("");
      setMedia([]);
      toast.success(t("public.postCreated"));
      loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t("public.postFailed"));
      loadAll();
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (post: Post) => {
    const res = await toggleLike(post._id);
    setFeed((prev) =>
      prev.map((p) =>
        p._id === post._id ? { ...p, likedByMe: res.liked, likeCount: res.likeCount } : p
      )
    );
  };

  const handleComment = async (postId: string) => {
    const text = (commentDrafts[postId] || "").trim();
    if (!text) return;
    try {
      const res = await addComment(postId, text);
      setFeed((prev) =>
        prev.map((p) =>
          p._id === postId ? { ...p, comments: [...p.comments, res.data] } : p
        )
      );
      setCommentDrafts((d) => ({ ...d, [postId]: "" }));
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t("public.commentFailed"));
    }
  };

  const handleShare = async (post: Post) => {
    try {
      await sharePost(post._id);
      setFeed((prev) =>
        prev.map((p) => (p._id === post._id ? { ...p, shares: p.shares + 1 } : p))
      );
      if (navigator.share) {
        navigator.share({ title: post.caption || "InternArea post", url: window.location.href });
      } else {
        toast.success(t("public.shared"));
      }
    } catch {
      toast.error(t("public.shareFailed"));
    }
  };

  const handleDelete = async (postId: string) => {
    try {
      await deletePost(postId);
      setFeed((prev) => prev.filter((p) => p._id !== postId));
      toast.success(t("public.deleted"));
    } catch {
      toast.error(t("public.deleteFailed"));
    }
  };

  const handleFriendRequest = async (uid: string) => {
    try {
      await sendFriendRequest(uid);
      setPending((p) => [...p, uid]);
      toast.success(t("public.requestSent"));
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t("public.requestFailed"));
    }
  };

  const handleAccept = async (requesterId: string) => {
    try {
      await acceptFriendRequest(requesterId);
      setRequests((r) => r.filter((x) => x.uid !== requesterId));
      toast.success(t("public.accepted"));
      loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t("public.acceptFailed"));
    }
  };

  const handleRemoveFriend = async (uid: string) => {
    try {
      await removeFriend(uid);
      toast.success(t("public.friendRemoved"));
      loadAll();
    } catch {
      toast.error(t("public.friendRemoveFailed"));
    }
  };

  const filteredInterns = interns.filter(
    (x) =>
      x.uid !== user?.uid &&
      x.name.toLowerCase().includes(friendSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t("public.title")}</h1>
          <p className="text-gray-500 mt-2">{t("public.subtitle")}</p>
          {limits && (
            <p className="text-sm text-gray-600 mt-2">
              {t("public.friendCount", { count: limits.friendCount })} •{" "}
              {limits.unlimited
                ? t("public.unlimitedPosts")
                : t("public.postsLeft", { remaining: limits.remaining })}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main feed */}
          <div className="lg:col-span-2 space-y-6">
            {/* Composer */}
            <div className="bg-white rounded-2xl shadow p-4">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
                placeholder={t("public.postPlaceholder")}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm resize-none"
              />
              {media.length > 0 && (
                <div className="flex gap-2 mt-2 overflow-x-auto">
                  {media.map((m, i) => (
                    <div key={i} className="relative shrink-0">
                      {m.type === "image" ? (
                        <img src={m.data} alt="" className="h-20 w-20 rounded-lg object-cover" />
                      ) : (
                        <video src={m.data} className="h-20 w-20 rounded-lg object-cover" />
                      )}
                      <button
                        onClick={() => setMedia((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5"
                        aria-label="remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between mt-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFile}
                  className="hidden"
                  id="post-media"
                />
                <div className="flex gap-2">
                  <label
                    htmlFor="post-media"
                    className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 cursor-pointer"
                  >
                    <Camera className="h-4 w-4" /> {t("public.photo")}
                  </label>
                </div>
                <button
                  onClick={handlePost}
                  disabled={posting}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-60"
                >
                  {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {t("public.post")}
                </button>
              </div>
            </div>

            {/* Feed */}
            {loadingFeed ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : feed.length === 0 ? (
              <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-500">
                {t("public.emptyFeed")}
              </div>
            ) : (
              feed.map((post) => (
                <div key={post._id} className="bg-white rounded-2xl shadow overflow-hidden">
                  <div className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold uppercase">
                      {(post.authorName || "U").charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{post.authorName}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(post.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {post.uid === user?.uid && (
                      <button
                        onClick={() => handleDelete(post._id)}
                        className="ml-auto text-gray-400 hover:text-red-500"
                        aria-label="delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {post.caption && (
                    <p className="px-4 pb-3 text-gray-800 text-sm">{post.caption}</p>
                  )}
                  {post.media.map((m, i) =>
                    m.type === "image" ? (
                      <img key={i} src={m.data} alt="" className="w-full max-h-96 object-cover" />
                    ) : (
                      <video key={i} src={m.data} controls className="w-full max-h-96 bg-black" />
                    )
                  )}

                  <div className="p-3 border-t flex items-center justify-around text-sm text-gray-600">
                    <button
                      onClick={() => handleLike(post)}
                      className={`inline-flex items-center gap-1.5 hover:text-blue-600 ${post.likedByMe ? "text-blue-600" : ""}`}
                    >
                      <Heart className={`h-4 w-4 ${post.likedByMe ? "fill-current" : ""}`} />
                      {post.likeCount}
                    </button>
                    <button className="inline-flex items-center gap-1.5 hover:text-blue-600">
                      <MessageCircle className="h-4 w-4" /> {post.comments.length}
                    </button>
                    <button onClick={() => handleShare(post)} className="inline-flex items-center gap-1.5 hover:text-blue-600">
                      <Share2 className="h-4 w-4" /> {post.shares}
                    </button>
                  </div>

                  {/* Comments */}
                  <div className="px-4 pb-4 space-y-2">
                    {post.comments.map((c) => (
                      <div key={c._id} className="flex gap-2 text-sm">
                        <span className="font-semibold text-gray-800">{c.name}:</span>
                        <span className="text-gray-600">{c.text}</span>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        value={commentDrafts[post._id] || ""}
                        onChange={(e) =>
                          setCommentDrafts((d) => ({ ...d, [post._id]: e.target.value }))
                        }
                        onKeyDown={(e) => e.key === "Enter" && handleComment(post._id)}
                        placeholder={t("public.commentPlaceholder")}
                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
                      />
                      <button
                        onClick={() => handleComment(post._id)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-3"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Friends sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow p-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-blue-600" />
                {t("public.friends")} ({friendCount})
              </h2>

              {requests.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                    {t("public.requests")}
                  </p>
                  {requests.map((r) => (
                    <div key={r.uid} className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-gray-700 truncate">{r.name}</span>
                      <button
                        onClick={() => handleAccept(r.uid)}
                        className="text-xs font-medium bg-green-100 text-green-700 rounded-lg px-2 py-1 hover:bg-green-200"
                      >
                        {t("public.accept")}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {friends.map((f) => (
                <div key={f.uid} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-gray-700 truncate">{f.name}</span>
                  <button
                    onClick={() => handleRemoveFriend(f.uid)}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {friends.length === 0 && requests.length === 0 && (
                <p className="text-sm text-gray-400">{t("public.noFriends")}</p>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow p-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <UserPlus className="h-4 w-4 text-blue-600" />
                {t("public.addFriends")}
              </h2>
              <input
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
                placeholder={t("public.searchFriends")}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm mb-3"
              />
              <div className="max-h-64 overflow-y-auto space-y-1">
                {filteredInterns.map((x) => {
                  const isFriend = friends.some((f) => f.uid === x.uid);
                  const isPending = pending.includes(x.uid);
                  return (
                    <div key={x.uid} className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-gray-700 truncate">
                        {x.name}
                        <span className="text-xs text-gray-400"> · {x.email}</span>
                      </span>
                      {isFriend ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : isPending ? (
                        <span className="text-xs text-amber-600">{t("public.pending")}</span>
                      ) : (
                        <button
                          onClick={() => handleFriendRequest(x.uid)}
                          className="text-xs font-medium bg-blue-100 text-blue-700 rounded-lg px-2 py-1 hover:bg-blue-200"
                        >
                          {t("public.add")}
                        </button>
                      )}
                    </div>
                  );
                })}
                {filteredInterns.length === 0 && (
                  <p className="text-sm text-gray-400">{t("public.noUsers")}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicSpacePage;
