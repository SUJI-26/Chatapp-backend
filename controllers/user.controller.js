import User from "../models/User.js";
import Message from "../models/Message.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";

/**
 * @route   GET /api/users
 * @desc    Get all users (excluding self), optionally filtered by ?search=
 *          Also attaches each conversation's last message and unread count,
 *          which powers the sidebar conversation list in a single request.
 * @access  Private
 */
export const getUsers = asyncHandler(async (req, res) => {
  const { search } = req.query;

  const filter = { _id: { $ne: req.user._id } };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const users = await User.find(filter)
    .select("name email avatar isOnline lastSeen bio")
    .sort({ isOnline: -1, name: 1 })
    .lean();

  const userIds = users.map((u) => u._id);

  // Aggregate: last message + unread count per conversation partner.
  const [lastMessages, unreadCounts] = await Promise.all([
    Message.aggregate([
      {
        $match: {
          $or: [
            { sender: req.user._id, receiver: { $in: userIds } },
            { sender: { $in: userIds }, receiver: req.user._id },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$sender", req.user._id] },
              "$receiver",
              "$sender",
            ],
          },
          message: { $first: "$message" },
          image: { $first: "$image" },
          createdAt: { $first: "$createdAt" },
          sender: { $first: "$sender" },
        },
      },
    ]),
    Message.aggregate([
      { $match: { receiver: req.user._id, seen: false, sender: { $in: userIds } } },
      { $group: { _id: "$sender", count: { $sum: 1 } } },
    ]),
  ]);

  const lastMessageMap = new Map(lastMessages.map((m) => [String(m._id), m]));
  const unreadMap = new Map(unreadCounts.map((u) => [String(u._id), u.count]));

  const usersWithMeta = users.map((u) => ({
    ...u,
    lastMessage: lastMessageMap.get(String(u._id)) || null,
    unreadCount: unreadMap.get(String(u._id)) || 0,
  }));

  // Conversations with a message sort to the top, most recent first.
  usersWithMeta.sort((a, b) => {
    if (a.lastMessage && !b.lastMessage) return -1;
    if (!a.lastMessage && b.lastMessage) return 1;
    if (a.lastMessage && b.lastMessage) {
      return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
    }
    return 0;
  });

  res.status(200).json({ success: true, users: usersWithMeta });
});

/**
 * @route   GET /api/users/:id
 * @desc    Get a single user's public profile
 * @access  Private
 */
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(
    "name email avatar isOnline lastSeen bio"
  );

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json({ success: true, user });
});

/**
 * @route   PUT /api/users/profile
 * @desc    Update the logged-in user's own profile (name, bio, avatar URL)
 * @access  Private
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, bio, avatar } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(404, "User not found");

  if (name) user.name = name;
  if (bio !== undefined) user.bio = bio;
  if (avatar !== undefined) user.avatar = avatar;

  await user.save();

  res.status(200).json({
    success: true,
    message: "Profile updated",
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
    },
  });
});
