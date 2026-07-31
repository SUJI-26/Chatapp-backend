import jwt from "jsonwebtoken";

/**
 * Signs a JWT for a given user id and sets it as an httpOnly cookie.
 * Using an httpOnly cookie (rather than localStorage) protects the token
 * from XSS attacks. The same token is also returned in the response body
 * so SPA clients that prefer header-based auth can use it too.
 */
export const generateToken = (res, userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

  res.cookie("jwt", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return token;
};
