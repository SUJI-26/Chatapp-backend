import Message from "../models/Message.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getReceiverSocketId, io } from "../socket/socket.js";

/**
 * @route   GET /api/messages/:conversationId
 * @desc    Get full message history between the logged-in user and
 *          :conversationId (the other participant's user id). Also marks
 *          all messages from that partner as seen (read receipts).
 * @access  Private
 */
export const getMessages = asyncHandler(async (req, res) => {
  const { conversationId: otherUserId } = req.params;
  const myId = req.user._id;

  const messages = await Message.find({
    $or: [
      { sender: myId, receiver: otherUserId },
      { sender: otherUserId, receiver: myId },
    ],
  })
    .sort({ createdAt: 1 })
    .lean();

  // Mark incoming messages as seen and notify the sender in real time
  // so their UI can flip single-tick to double-tick "seen" immediately.
  const unseenIds = messages
    .filter((m) => String(m.receiver) === String(myId) && !m.seen)
    .map((m) => m._id);

  if (unseenIds.length > 0) {
    await Message.updateMany(
      { _id: { $in: unseenIds } },
      { $set: { seen: true, seenAt: new Date() } }
    );

    const senderSocketId = getReceiverSocketId(otherUserId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messagesSeen", {
        by: myId,
        messageIds: unseenIds,
      });
    }
  }

  res.status(200).json({ success: true, messages });
});

/**
 * @route   POST /api/messages
 * @desc    Send a message to another user. Persists it, then emits it over
 *          the receiver's socket connection for instant delivery.
 * @access  Private
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const { receiverId, message, image } = req.body;
  const senderId = req.user._id;

  if (!message?.trim() && !image) {
    throw new ApiError(400, "Message cannot be empty");
  }

  if (String(receiverId) === String(senderId)) {
    throw new ApiError(400, "You cannot send a message to yourself");
  }

  const newMessage = await Message.create({
    sender: senderId,
    receiver: receiverId,
    message: message?.trim() || "",
    image: image || "",
  });

  // Real-time delivery: push straight to the receiver's socket if online.
  const receiverSocketId = getReceiverSocketId(receiverId);
  if (receiverSocketId) {
    io.to(receiverSocketId).emit("newMessage", newMessage);
  }

  res.status(201).json({ success: true, message: newMessage });
});
