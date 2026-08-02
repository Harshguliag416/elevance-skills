import apiClient from "@/lib/apiClient";

/**
 * Public Space + Friends API (Task 4).
 * - Posts: create (friend-based limits), feed, like, comment, share, delete
 * - Friends: list, requests, pending, request, accept, remove
 */

export interface PostMedia {
  type: "image" | "video";
  data: string;
}

export interface PostComment {
  _id: string;
  uid: string;
  name: string;
  photo: string;
  text: string;
  createdAt: string;
}

export interface Post {
  _id: string;
  uid: string;
  authorName: string;
  authorPhoto: string;
  caption: string;
  media: PostMedia[];
  comments: PostComment[];
  shares: number;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
}

export interface PostingLimits {
  friendCount: number;
  maxPerDay: number;
  postsToday: number;
  unlimited: boolean;
  remaining: number;
}

export interface Friend {
  uid: string;
  name: string;
  email: string;
}

export async function getPostingLimits() {
  const { data } = await apiClient.get<{ success: boolean; data: PostingLimits }>(
    "/public/posts/limits"
  );
  return data.data;
}

export async function getFeed() {
  const { data } = await apiClient.get<{ success: boolean; data: Post[] }>(
    "/public/posts"
  );
  return data.data;
}

export async function createPost(payload: { caption: string; media: PostMedia[] }) {
  const { data } = await apiClient.post("/public/posts", payload);
  return data;
}

export async function toggleLike(postId: string) {
  const { data } = await apiClient.post(`/public/posts/${postId}/like`);
  return data;
}

export async function addComment(postId: string, text: string) {
  const { data } = await apiClient.post(`/public/posts/${postId}/comment`, { text });
  return data;
}

export async function sharePost(postId: string) {
  const { data } = await apiClient.post(`/public/posts/${postId}/share`);
  return data;
}

export async function deletePost(postId: string) {
  const { data } = await apiClient.delete(`/public/posts/${postId}`);
  return data;
}

/* ---------------- Friends ---------------- */

export async function getFriends() {
  const { data } = await apiClient.get<{ success: boolean; count: number; data: Friend[] }>(
    "/public/friends"
  );
  return data;
}

export async function getFriendRequests() {
  const { data } = await apiClient.get<{ success: boolean; count: number; data: Friend[] }>(
    "/public/friends/requests"
  );
  return data;
}

export async function getPendingRequests() {
  const { data } = await apiClient.get<{ success: boolean; data: string[] }>(
    "/public/friends/pending"
  );
  return data.data;
}

export async function sendFriendRequest(uid: string) {
  const { data } = await apiClient.post("/public/friends/request", { uid });
  return data;
}

export async function acceptFriendRequest(requesterId: string) {
  const { data } = await apiClient.post("/public/friends/accept", { requesterId });
  return data;
}

export async function removeFriend(uid: string) {
  const { data } = await apiClient.post("/public/friends/remove", { uid });
  return data;
}

/** All interns (from GET /interns) used to find people to add as friends. */
export async function getAllInterns() {
  const { data } = await apiClient.get<{ success: boolean; data: Friend[] }>("/interns");
  return data.data;
}
